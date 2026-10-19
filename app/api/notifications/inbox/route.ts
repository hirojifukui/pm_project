import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";

// GET /api/notifications/inbox
// contracts/notifications.md § 2
export async function GET() {
  return withAuthenticated(async (user) => {
    const rows = await prisma.notification.findMany({
      where: { recipientEmpNo: user.empNo, channel: "IN_APP" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        applicationNumber: r.applicationNumber,
        templateId: r.templateId,
        operation: r.operation,
        sentAt: r.sentAt?.toISOString() ?? null,
        readAt: r.readAt?.toISOString() ?? null,
        linkPath: r.applicationNumber
          ? `/applications/by-number/${r.applicationNumber}`
          : null,
      })),
    };
  });
}
