import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors/to-user-message";
import { newUlid } from "@/domain/id";
import { canFinalize } from "@/domain/rules/BR-015.accountant-own";
import { enqueueNotification, autoMarkRead } from "@/server/notifications/inbox";
import type { EmployeeRole } from "@/domain/types";

// POST /api/accounting/{applicationNumber}/finalize
// contracts/accounting.md § 2
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ applicationNumber: string }> },
) {
  const { applicationNumber } = await params;
  return withAuthenticated(async (user) => {
    const application = await prisma.application.findUnique({
      where: { applicationNumber },
      include: { applicant: true },
    });
    if (!application) throw new NotFoundError();

    if (application.status !== "ACCOUNTING_REVIEW") {
      throw new ConflictError(
        "この申請は経理確定できる状態ではありません（ACCOUNTING_REVIEW のみ）。",
      );
    }

    authorize({ operation: "ACCOUNTING_FINALIZE_OR_REMAND", user, application });

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

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { applicationNumber },
        data: {
          status: "ACCOUNTING_FINALIZED",
          accountingFinalizedAt: now,
          nextApproverEmpNo: null,
        },
      });
      await tx.approvalHistory.create({
        data: {
          id: newUlid(),
          applicationNumber,
          operatorEmpNo: user.empNo,
          operation: "ACCOUNTING_FINALIZE",
        },
      });
    });

    await enqueueNotification({
      recipientEmpNo: application.applicantEmpNo,
      applicationNumber,
      templateId: "ACCOUNTING_FINALIZED_TO_APPLICANT",
      operation: "ACCOUNTING_FINALIZE",
    });
    await autoMarkRead(applicationNumber, "APPROVE", user.empNo);

    return {
      status: "ACCOUNTING_FINALIZED" as const,
      accountingFinalizedAt: now.toISOString(),
    };
  });
}
