import { withAuthenticated } from "@/server/http/handler";
import { markAsRead } from "@/server/notifications/inbox";

// POST /api/notifications/{id}/read
// contracts/notifications.md § 3
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuthenticated(async (user) => {
    await markAsRead(id, user.empNo);
    return { readAt: new Date().toISOString() };
  });
}
