import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import {
  BusinessRuleError,
  NotFoundError,
  ConflictError,
} from "@/server/errors/to-user-message";
import { ExpenseLineInput } from "@/domain/types";
import { newUlid } from "@/domain/id";
import { calculatePerDiem } from "@/domain/rules/BR-002.per-diem";
import { isLodgingOverCap } from "@/domain/rules/BR-003.lodging-cap";
import { serializeTaxiReasons } from "@/domain/rules/BR-005.taxi-exceptions";
import { loadRuleSnapshot } from "@/server/applications/rule-values";

const BodySchema = z.object({
  lines: z.array(ExpenseLineInput),
});

const EDITABLE_STATUSES = new Set<string>(["DRAFT", "REMANDED"]);

// PUT /api/applications/{applicationNumber}/lines
// contracts/applications.md § 3
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ applicationNumber: string }> },
) {
  const { applicationNumber } = await params;
  return withAuthenticated(async (user) => {
    const body = BodySchema.parse(await req.json());
    const application = await prisma.application.findUnique({
      where: { applicationNumber },
    });
    if (!application) throw new NotFoundError();
    authorize({
      operation: "CREATE_OWN_APPLICATION",
      user,
      application,
    });
    if (!EDITABLE_STATUSES.has(application.status)) {
      throw new ConflictError(
        "この申請は現在編集できません（下書きまたは差戻し中のみ編集できます）。",
      );
    }

    const snapshot = await loadRuleSnapshot(application.tripEndDate);
    const applicant = await prisma.employee.findUnique({
      where: { empNo: application.applicantEmpNo },
    });
    if (!applicant) throw new NotFoundError();

    // BR-002 日当: PER_DIEM 行はシステムで上書き
    const days = diffDaysInclusive(
      application.tripStartDate,
      application.tripEndDate,
    );
    const isDayTrip = days === 1;

    const violations: Array<{ path: string; message: string; ruleId?: string }> = [];
    const linesToPersist = body.lines.map((line, idx) => {
      if (line.category === "PER_DIEM") {
        const amount = calculatePerDiem({
          isDayTrip,
          rankKind: applicant.rankKind as "STAFF" | "MANAGEMENT",
          days,
          rules: {
            staffLodgingDaily: snapshot.staffLodgingDaily,
            managementLodgingDaily: snapshot.managementLodgingDaily,
            dayTripFlat: snapshot.dayTripFlat,
          },
        });
        return {
          ...line,
          amountYen: amount,
          isSystemGenerated: true,
        };
      }
      // BR-003 宿泊費上限: 都市判定は目的地だけでは厳密に判定できないため、
      // 既定で standard を用いる。都市判定は UI の都市チェック or 将来の拡張に委ねる。
      if (line.category === "LODGING") {
        const over = isLodgingOverCap(line.amountYen, false, {
          standard: snapshot.lodgingCapStandard,
          metro: snapshot.lodgingCapMetro,
        });
        if (over && !line.exceedsLodgingCapReason) {
          violations.push({
            path: `lines[${idx}].exceedsLodgingCapReason`,
            message: "宿泊費が 1 泊あたりの上限を超えています。超過理由を記入してください。",
            ruleId: "BR-003",
          });
        }
      }
      return { ...line, isSystemGenerated: false };
    });

    if (violations.length > 0) {
      throw new BusinessRuleError(violations);
    }

    // 一括置き換え: 既存の明細を削除してから挿入し直す。
    // 既存の添付領収書も cascade で削除される。
    await prisma.$transaction(async (tx) => {
      await tx.expenseLine.deleteMany({
        where: { applicationNumber },
      });
      for (const line of linesToPersist) {
        await tx.expenseLine.create({
          data: {
            id: line.id ?? newUlid(),
            applicationNumber,
            date: new Date(`${line.date}T00:00:00.000Z`),
            category: line.category,
            fromPlace: line.fromPlace ?? null,
            toPlace: line.toPlace ?? null,
            transportMode: line.transportMode ?? null,
            amountYen: line.amountYen,
            isSystemGenerated: line.isSystemGenerated ?? false,
            taxiReasons: serializeTaxiReasons(line.taxiReasons),
            exceedsLodgingCapReason: line.exceedsLodgingCapReason ?? null,
            remarks: line.remarks ?? null,
          },
        });
      }
      const total = linesToPersist.reduce((s, l) => s + l.amountYen, 0);
      await tx.application.update({
        where: { applicationNumber },
        data: { totalAmountYen: total },
      });
    });

    return { ok: true };
  });
}

function diffDaysInclusive(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, days);
}
