import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from "@/server/errors/to-user-message";
import { CommentInput } from "@/domain/types";
import { newUlid } from "@/domain/id";
import { findActiveProxyFor } from "@/server/applications/proxy";
import { enqueueNotification, autoMarkRead } from "@/server/notifications/inbox";

// POST /api/approvals/{applicationNumber}/remand
// contracts/approvals.md § 3
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ applicationNumber: string }> },
) {
  const { applicationNumber } = await params;
  return withAuthenticated(async (user) => {
    const raw = await req.json().catch(() => ({}));
    // コメント必須（FR-011）: Zod で検証
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
    });
    if (!application) throw new NotFoundError();

    if (application.applicantEmpNo === user.empNo) {
      throw new ForbiddenError();
    }

    let actedAs: "SELF" | "PROXY" = "SELF";
    if (application.nextApproverEmpNo !== user.empNo) {
      if (!application.nextApproverEmpNo) throw new ForbiddenError();
      const proxy = await findActiveProxyFor(
        application.nextApproverEmpNo,
        user.empNo,
      );
      if (!proxy) throw new ForbiddenError();
      actedAs = "PROXY";
    } else {
      authorize({ operation: "APPROVE_OR_REMAND", user, application });
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
          actedAs,
          operation: "REMAND",
          comment: body.comment,
        },
      });
    });

    await enqueueNotification({
      recipientEmpNo: application.applicantEmpNo,
      applicationNumber,
      templateId: "REMANDED_TO_APPLICANT",
      operation: "REMAND",
    });
    await autoMarkRead(applicationNumber, "SUBMIT", user.empNo);

    return { status: "REMANDED" as const };
  });
}
