import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";

// GET /api/applications/mine
// contracts/applications.md § 7
export async function GET() {
  return withAuthenticated(async (user) => {
    const rows = await prisma.application.findMany({
      where: { applicantEmpNo: user.empNo },
      orderBy: { updatedAt: "desc" },
      select: {
        applicationNumber: true,
        tripStartDate: true,
        tripEndDate: true,
        totalAmountYen: true,
        status: true,
        submittedAt: true,
        nextApprover: { select: { empNo: true, name: true } },
      },
    });
    return {
      items: rows.map((r) => ({
        applicationNumber: r.applicationNumber,
        tripStartDate: toYmd(r.tripStartDate),
        tripEndDate: toYmd(r.tripEndDate),
        totalAmountYen: r.totalAmountYen,
        status: r.status,
        submittedAt: r.submittedAt?.toISOString() ?? null,
        nextApprover: r.nextApprover,
      })),
    };
  });
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
