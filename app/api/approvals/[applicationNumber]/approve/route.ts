import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors/to-user-message";
import { newUlid } from "@/domain/id";
import {
  resolveAfterSectionManagerApproval,
  resolveAfterDirectorApproval,
  resolveAfterAccountingDirectorApproval,
  resolveAfterAccountingDirectorSuperiorApproval,
  type NextApproverResolution,
} from "@/domain/rules/next-approver";
import { loadRuleSnapshot } from "@/server/applications/rule-values";
import { findActiveProxyFor } from "@/server/applications/proxy";
import { enqueueNotification, autoMarkRead } from "@/server/notifications/inbox";

const Input = z.object({ comment: z.string().optional() });

// POST /api/approvals/{applicationNumber}/approve
// contracts/approvals.md § 2（US2/US3 対応: SECTION_MANAGER_APPROVAL / DIRECTOR_APPROVAL /
// ACCOUNTING_DIRECTOR_APPROVAL / ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL のすべてで承認可）
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ applicationNumber: string }> },
) {
  const { applicationNumber } = await params;
  return withAuthenticated(async (user) => {
    const body = Input.parse(await req.json().catch(() => ({})));
    const application = await prisma.application.findUnique({
      where: { applicationNumber },
      include: { applicant: true },
    });
    if (!application) throw new NotFoundError();

    // BR-009 自己承認禁止
    if (application.applicantEmpNo === user.empNo) {
      throw new ForbiddenError();
    }

    // 代理指名の反映
    let actedAs: "SELF" | "PROXY" = "SELF";
    if (application.nextApproverEmpNo !== user.empNo) {
      if (application.nextApproverEmpNo == null) {
        throw new ForbiddenError();
      }
      const proxy = await findActiveProxyFor(
        application.nextApproverEmpNo,
        user.empNo,
      );
      if (!proxy) throw new ForbiddenError();
      actedAs = "PROXY";
    } else {
      authorize({ operation: "APPROVE_OR_REMAND", user, application });
    }

    const resolution = await resolveNextByCurrentState(application);

    if (
      resolution.nextStatus !== "ACCOUNTING_REVIEW" &&
      !resolution.nextApproverEmpNo
    ) {
      throw new ConflictError(
        resolution.reason ?? "次の承認者を解決できませんでした。",
      );
    }

    const now = new Date();
    const isFirstApproval = application.status === "SECTION_MANAGER_APPROVAL";
    const isFinalBeforeAccounting =
      resolution.nextStatus === "ACCOUNTING_REVIEW";

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { applicationNumber },
        data: {
          status: resolution.nextStatus,
          nextApproverEmpNo: resolution.nextApproverEmpNo,
          ...(isFirstApproval ? { firstApprovedAt: now } : {}),
          ...(isFinalBeforeAccounting ? { finalApprovedAt: now } : {}),
        },
      });
      await tx.approvalHistory.create({
        data: {
          id: newUlid(),
          applicationNumber,
          operatorEmpNo: user.empNo,
          actedAs,
          operation: "APPROVE",
          comment: body.comment ?? null,
        },
      });
    });

    await enqueueNotification({
      recipientEmpNo: application.applicantEmpNo,
      applicationNumber,
      templateId: "APPROVED_TO_APPLICANT",
      operation: "APPROVE",
    });
    if (resolution.nextApproverEmpNo) {
      await enqueueNotification({
        recipientEmpNo: resolution.nextApproverEmpNo,
        applicationNumber,
        templateId: "APPROVED_TO_NEXT_APPROVER",
        operation: "APPROVE",
      });
    }
    await autoMarkRead(applicationNumber, "SUBMIT", user.empNo);

    return {
      status: resolution.nextStatus,
      nextApprover: resolution.nextApproverEmpNo
        ? { empNo: resolution.nextApproverEmpNo }
        : null,
    };
  });
}

async function resolveNextByCurrentState(application: {
  status: string;
  totalAmountYen: number;
  lateReason: string | null;
  tripEndDate: Date;
  applicant: {
    empNo: string;
    role: string;
    sectionManagerEmpNo: string | null;
  };
}): Promise<NextApproverResolution> {
  const applicant = application.applicant;
  if (application.status === "SECTION_MANAGER_APPROVAL") {
    const snapshot = await loadRuleSnapshot(application.tripEndDate);
    const sectionManager = applicant.sectionManagerEmpNo
      ? await prisma.employee.findUnique({
          where: { empNo: applicant.sectionManagerEmpNo },
        })
      : null;
    const directorEmpNo = sectionManager?.sectionManagerEmpNo ?? null;
    const director = directorEmpNo
      ? await prisma.employee.findUnique({ where: { empNo: directorEmpNo } })
      : null;

    return resolveAfterSectionManagerApproval({
      applicant: applicant as never,
      director,
      totalAmountYen: application.totalAmountYen,
      directorApprovalThreshold: snapshot.directorApprovalThreshold,
      isLate: !!application.lateReason,
    });
  }
  if (application.status === "DIRECTOR_APPROVAL") {
    return resolveAfterDirectorApproval({
      applicant: applicant as never,
      accountingDirectorEmpNo: null,
    });
  }
  if (application.status === "ACCOUNTING_DIRECTOR_APPROVAL") {
    return resolveAfterAccountingDirectorApproval({
      applicant: applicant as never,
    });
  }
  if (application.status === "ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL") {
    return resolveAfterAccountingDirectorSuperiorApproval();
  }
  return {
    nextApproverEmpNo: null,
    nextStatus: "ACCOUNTING_REVIEW",
    reason: "この申請は現在、承認対象ではありません。",
  };
}
