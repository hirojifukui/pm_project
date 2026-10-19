import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "@/server/errors/to-user-message";
import { SubmitInput } from "@/domain/types";
import { newUlid } from "@/domain/id";
import { isWithinDeadline } from "@/domain/rules/BR-001.deadline";
import { isReceiptRequired } from "@/domain/rules/BR-006.receipts";
import { findOverlappingTrip } from "@/domain/rules/BR-010.no-overlap";
import { hasValidTaxiReason, parseTaxiReasons } from "@/domain/rules/BR-005.taxi-exceptions";
import { resolveInitialApprover } from "@/domain/rules/next-approver";
import { loadRuleSnapshot } from "@/server/applications/rule-values";
import { enqueueNotification } from "@/server/notifications/inbox";
import {
  findAccountingDirectorEmpNo,
  findAccountingDirectorSuperiorEmpNo,
} from "@/server/applications/role-lookup";

const SUBMITTABLE = new Set<string>(["DRAFT", "REMANDED"]);

// POST /api/applications/{applicationNumber}/submit
// contracts/applications.md § 5
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ applicationNumber: string }> },
) {
  const { applicationNumber } = await params;
  return withAuthenticated(async (user) => {
    const body = SubmitInput.parse(await req.json().catch(() => ({})));
    const application = await prisma.application.findUnique({
      where: { applicationNumber },
      include: {
        lines: {
          include: { receipts: { select: { id: true } } },
        },
      },
    });
    if (!application) throw new NotFoundError();
    authorize({
      operation: "SUBMIT_OWN_APPLICATION",
      user,
      application,
    });
    if (!SUBMITTABLE.has(application.status)) {
      throw new ConflictError(
        "この申請は提出できません（下書きまたは差戻し中のみ提出できます）。",
      );
    }

    const snapshot = await loadRuleSnapshot(application.tripEndDate);
    const violations: Array<{ path?: string; message: string; ruleId?: string }> = [];

    // BR-001: 期限
    const submittedAt = new Date();
    const within = isWithinDeadline(
      submittedAt,
      application.tripEndDate,
      snapshot.deadlineDays,
    );
    if (!within && (!body.lateReason || body.lateReason.trim() === "")) {
      violations.push({
        path: "lateReason",
        message:
          "申請期限（出張終了日の翌日から 30 日）を過ぎています。遅延理由を記入してください。",
        ruleId: "BR-001",
      });
    }

    // BR-005: タクシー事由必須
    for (let i = 0; i < application.lines.length; i += 1) {
      const line = application.lines[i];
      if (!line) continue;
      if (line.transportMode === "TAXI") {
        if (!hasValidTaxiReason(parseTaxiReasons(line.taxiReasons))) {
          violations.push({
            path: `lines[${i}].taxiReasons`,
            message:
              "タクシーの明細では例外事由（22:00 以降／荷物 15kg 以上／顧客と同乗）を 1 件以上選んでください。",
            ruleId: "BR-005",
          });
        }
      }
    }

    // BR-006: 領収書の必須検査
    for (let i = 0; i < application.lines.length; i += 1) {
      const line = application.lines[i];
      if (!line) continue;
      const needed = isReceiptRequired(
        {
          category: line.category as "TRANSPORT" | "LODGING" | "PER_DIEM" | "OTHER",
          transportMode:
            (line.transportMode as "TRAIN" | "SHINKANSEN" | "BUS" | "TAXI" | "FLIGHT" | "OTHER" | null) ??
            null,
          amountYen: line.amountYen,
        },
        {
          threshold: snapshot.receiptRequiredThreshold,
          limitedExpressWaived: snapshot.limitedExpressReceiptWaived,
        },
      );
      if (needed && line.receipts.length === 0) {
        violations.push({
          path: `lines[${i}]`,
          message:
            "領収書の添付が必要な明細があります。該当する明細に領収書を添付してください。",
          ruleId: "BR-006",
        });
      }
    }

    // BR-010: 重複出張
    const existing = await prisma.application.findMany({
      where: {
        applicantEmpNo: user.empNo,
        NOT: { applicationNumber },
      },
      select: {
        applicationNumber: true,
        tripStartDate: true,
        tripEndDate: true,
        status: true,
      },
    });
    const overlap = findOverlappingTrip(
      {
        start: application.tripStartDate,
        end: application.tripEndDate,
      },
      existing,
    );
    if (overlap) {
      throw new ConflictError(
        "出張期間が重なる自分の申請が既に存在します。",
        {
          code: "OVERLAPPING_TRIP",
          extra: { conflictingApplicationNumber: overlap.applicationNumber },
        },
      );
    }

    if (violations.length > 0) {
      throw new BusinessRuleError(violations);
    }

    const applicant = await prisma.employee.findUnique({
      where: { empNo: user.empNo },
    });
    if (!applicant) throw new NotFoundError();
    const [accountingDirectorEmpNo, accountingDirectorSuperiorEmpNo] =
      await Promise.all([
        findAccountingDirectorEmpNo(),
        findAccountingDirectorSuperiorEmpNo(),
      ]);
    const resolution = resolveInitialApprover({
      applicant,
      accountingDirectorEmpNo,
      accountingDirectorSuperiorEmpNo,
    });
    // 経理部長本人の申請で上位者が未登録の場合は、提出は許可するが
    // 承認待ちには登録後に初めて表示する（spec.md エッジケース）。
    const isAccountingDirectorSelfPending =
      applicant.role === "ACCOUNTING_DIRECTOR" &&
      resolution.nextStatus === "ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL" &&
      !resolution.nextApproverEmpNo;
    if (!resolution.nextApproverEmpNo && !isAccountingDirectorSelfPending) {
      throw new ConflictError(
        resolution.reason ?? "承認者を解決できませんでした。",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { applicationNumber },
        data: {
          status: resolution.nextStatus,
          submittedAt,
          nextApproverEmpNo: resolution.nextApproverEmpNo,
          lateReason: body.lateReason ?? null,
        },
      });
      await tx.approvalHistory.create({
        data: {
          id: newUlid(),
          applicationNumber,
          operatorEmpNo: user.empNo,
          actedAs: "SELF",
          operation: "SUBMIT",
        },
      });
    });

    const notifications: Promise<void>[] = [
      enqueueNotification({
        recipientEmpNo: user.empNo,
        applicationNumber,
        templateId: "SUBMITTED_SELF_CONFIRM",
        operation: "SUBMIT",
      }),
    ];
    if (resolution.nextApproverEmpNo) {
      notifications.push(
        enqueueNotification({
          recipientEmpNo: resolution.nextApproverEmpNo,
          applicationNumber,
          templateId: "SUBMITTED_TO_APPROVER",
          operation: "SUBMIT",
        }),
      );
    }
    await Promise.all(notifications);

    return {
      applicationNumber,
      status: resolution.nextStatus,
      nextApprover: { empNo: resolution.nextApproverEmpNo },
    };
  });
}
