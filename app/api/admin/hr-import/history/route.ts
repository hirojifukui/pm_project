import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";

// GET /api/admin/hr-import/history
// contracts/admin.md § 3.2
export async function GET() {
  return withAuthenticated(async (user) => {
    authorize({ operation: "MANAGE_EMPLOYEE_OR_RULE", user });
    const rows = await prisma.hrImportResult.findMany({
      orderBy: { startedAt: "desc" },
      take: 30,
      include: {
        importedBy: { select: { name: true } },
      },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        importedBy: r.importedBy.name,
        sourceFileName: r.sourceFileName,
        status: r.status,
        errorKind: r.errorKind,
        rowCount: r.rowCount,
        errorRows: r.errorRows ? JSON.parse(r.errorRows) : [],
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
      })),
    };
  });
}
