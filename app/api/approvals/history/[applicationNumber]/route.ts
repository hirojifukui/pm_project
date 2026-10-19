import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import { NotFoundError } from "@/server/errors/to-user-message";

// GET /api/approvals/history/{applicationNumber}
// contracts/approvals.md § 6
export async function GET(
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
      operation: "VIEW_SUBORDINATE_APPLICATION",
      user,
      application,
    });

    const histories = await prisma.approvalHistory.findMany({
      where: { applicationNumber },
      orderBy: { occurredAt: "asc" },
      include: {
        operator: { select: { empNo: true, name: true } },
      },
    });

    return {
      items: histories.map((h) => ({
        id: h.id,
        operatorName: h.operator.name,
        actedAs: h.actedAs,
        operation: h.operation,
        comment: h.comment,
        occurredAt: h.occurredAt.toISOString(),
      })),
    };
  });
}
