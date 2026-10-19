import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors/to-user-message";
import { CommentInput } from "@/domain/types";
import { newUlid } from "@/domain/id";

// POST /api/accounting/{applicationNumber}/undo
// contracts/accounting.md § 4（FR-023 経理確定の取消）
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ applicationNumber: string }> },
) {
  const { applicationNumber } = await params;
  return withAuthenticated(async (user) => {
    // 経理担当のみ FR-023
    if (user.role !== "ACCOUNTANT") {
      throw new ForbiddenError();
    }
    const raw = await req.json().catch(() => ({}));
    let body;
    try {
      body = CommentInput.parse(raw);
    } catch {
      throw new BusinessRuleError([
        {
          path: "comment",
          message: "経理確定の取消理由（コメント）を入力してください。",
          ruleId: "FR-023",
        },
      ]);
    }

    const application = await prisma.application.findUnique({
      where: { applicationNumber },
    });
    if (!application) throw new NotFoundError();
    if (application.status !== "ACCOUNTING_FINALIZED") {
      throw new ConflictError(
        "この申請は経理確定の取消対象ではありません（ACCOUNTING_FINALIZED のみ）。",
      );
    }
    if (application.paymentCsvExportId) {
      throw new ConflictError(
        "この申請は既に支払用 CSV に含まれているため取消できません。",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { applicationNumber },
        data: {
          status: "REMANDED",
          accountingFinalizedAt: null,
          nextApproverEmpNo: null,
        },
      });
      await tx.approvalHistory.create({
        data: {
          id: newUlid(),
          applicationNumber,
          operatorEmpNo: user.empNo,
          operation: "ACCOUNTING_UNDO",
          comment: body.comment,
        },
      });
    });

    return { status: "REMANDED" as const };
  });
}
