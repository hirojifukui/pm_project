import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import { ConflictError, NotFoundError } from "@/server/errors/to-user-message";
import { newUlid } from "@/domain/id";
import { enqueueNotification } from "@/server/notifications/inbox";

// POST /api/applications/{applicationNumber}/withdraw
// contracts/applications.md § 6（取下げは所属長が承認する前のみ）
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ applicationNumber: string }> },
) {
  const { applicationNumber } = await params;
  return withAuthenticated(async (user) => {
    const application = await prisma.application.findUnique({
      where: { applicationNumber },
    });
    if (!application) throw new NotFoundError();
    authorize({
      operation: "WITHDRAW_OWN_APPLICATION",
      user,
      application,
    });
    if (application.status !== "SECTION_MANAGER_APPROVAL") {
      throw new ConflictError(
        "この申請は取下げできません（所属長が承認する前の提出済み申請のみ取下げできます）。",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { applicationNumber },
        data: {
          status: "WITHDRAWN",
          withdrawnAt: new Date(),
          nextApproverEmpNo: null,
        },
      });
      await tx.approvalHistory.create({
        data: {
          id: newUlid(),
          applicationNumber,
          operatorEmpNo: user.empNo,
          actedAs: "SELF",
          operation: "WITHDRAW",
        },
      });
    });

    await enqueueNotification({
      recipientEmpNo: user.empNo,
      applicationNumber,
      templateId: "WITHDRAWN_SELF_CONFIRM",
      operation: "WITHDRAW",
    });

    return { status: "WITHDRAWN" as const };
  });
}
