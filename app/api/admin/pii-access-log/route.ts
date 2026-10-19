import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import { logPiiAccess } from "@/server/pii-access";

// GET /api/admin/pii-access-log
// contracts/admin.md § 4
export async function GET() {
  return withAuthenticated(async (user) => {
    authorize({ operation: "MANAGE_EMPLOYEE_OR_RULE", user });
    const rows = await prisma.piiAccessLog.findMany({
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: {
        accessor: { select: { empNo: true, name: true } },
        target: { select: { empNo: true, name: true } },
      },
    });
    // 本エンドポイントの呼び出し自体も監査対象
    await logPiiAccess({
      accessorEmpNo: user.empNo,
      reasonCode: "AUDIT",
      freeNote: `PII アクセスログの参照（${rows.length} 件）`,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        accessor: r.accessor,
        target: r.target,
        applicationNumber: r.applicationNumber,
        reasonCode: r.reasonCode,
        freeNote: r.freeNote,
        occurredAt: r.occurredAt.toISOString(),
      })),
    };
  });
}
