import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors/to-user-message";
import { CommentInput } from "@/domain/types";
import { newUlid } from "@/domain/id";
import { canFinalize } from "@/domain/rules/BR-015.accountant-own";
import { enqueueNotification } from "@/server/notifications/inbox";
import type { EmployeeRole } from "@/domain/types";

// POST /api/accounting/{applicationNumber}/remand
// contracts/accounting.md § 3
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ applicationNumber: string }> },
) {
  const { applicationNumber } = await params;
  return withAuthenticated(async (user) => {
    const raw = await req.json().catch(() => ({}));
    let body;
    try {
      body = CommentInput.parse(raw);
    } catch {
      throw new BusinessRuleError([
        {
          path: "comment",
          message: "差戻しの理由（コメント）を入力してください。",
          ruleId: "FR-011",
        },
      ]);
    }

    const application = await prisma.application.findUnique({
      where: { applicationNumber },
      include: { applicant: true },
    });
    if (!application) throw new NotFoundError();
    if (application.status !== "ACCOUNTING_REVIEW") {
      throw new ConflictError(
        "この申請は経理差戻しできる状態ではありません。",
      );
    }

    authorize({
      operation: "ACCOUNTING_FINALIZE_OR_REMAND",
      user,
      application,
    });
    if (
      !canFinalize({
        userRole: user.role as EmployeeRole,
        userEmpNo: user.empNo,
        applicantRole: application.applicant.role as EmployeeRole,
        applicantEmpNo: application.applicant.empNo,
      })
    ) {
      throw new ForbiddenError();
    }

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { applicationNumber },
        data: {
          status: "REMANDED",
          nextApproverEmpNo: null,
        },
      });
      await tx.approvalHistory.create({
        data: {
          id: newUlid(),
          applicationNumber,
          operatorEmpNo: user.empNo,
          operation: "ACCOUNTING_REMAND",
          comment: body.comment,
        },
      });
    });

    await enqueueNotification({
      recipientEmpNo: application.applicantEmpNo,
      applicationNumber,
      templateId: "ACCOUNTING_REMAND_TO_APPLICANT",
      operation: "ACCOUNTING_REMAND",
    });

    return { status: "REMANDED" as const };
  });
}
