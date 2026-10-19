import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { logPiiAccess } from "@/server/pii-access";
import { loadActiveProxies } from "@/server/applications/proxy";

// GET /api/approvals/pending
// contracts/approvals.md § 1
export async function GET() {
  return withAuthenticated(async (user) => {
    const now = new Date();
    const proxies = await loadActiveProxies(now);
    const asProxyPrincipals = proxies
      .filter((p) => p.proxyEmpNo === user.empNo)
      .map((p) => p.principalEmpNo);

    // 自分が nextApprover になっている申請 ＋ 自分が代理人を務めるプリンシパルの申請
    const approverEmpNos = [user.empNo, ...asProxyPrincipals];
    const rows = await prisma.application.findMany({
      where: {
        nextApproverEmpNo: { in: approverEmpNos },
        status: {
          in: [
            "SECTION_MANAGER_APPROVAL",
            "DIRECTOR_APPROVAL",
            "ACCOUNTING_DIRECTOR_APPROVAL",
            "ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL",
          ],
        },
      },
      orderBy: { submittedAt: "asc" },
      include: {
        applicant: { select: { name: true, department: true } },
      },
    });

    const items = rows.map((app) => ({
      applicationNumber: app.applicationNumber,
      applicantName: app.applicant.name,
      department: app.applicant.department,
      tripStartDate: toYmd(app.tripStartDate),
      tripEndDate: toYmd(app.tripEndDate),
      totalAmountYen: app.totalAmountYen,
      submittedAt: app.submittedAt?.toISOString() ?? "",
      isLate: !!app.lateReason,
      requiredBy: mapRequiredBy(app.status),
      actedAs: app.nextApproverEmpNo === user.empNo ? "SELF" : "PROXY",
    }));

    if (items.length > 0) {
      await logPiiAccess({
        accessorEmpNo: user.empNo,
        reasonCode: "APPROVAL",
        freeNote: `承認待ち一覧の参照（${items.length} 件）`,
      });
    }
    return { items };
  });
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function mapRequiredBy(status: string): string {
  switch (status) {
    case "SECTION_MANAGER_APPROVAL":
      return "SECTION_MANAGER";
    case "DIRECTOR_APPROVAL":
      return "DIRECTOR";
    case "ACCOUNTING_DIRECTOR_APPROVAL":
      return "ACCOUNTING_DIRECTOR";
    case "ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL":
      return "ACCOUNTING_DIRECTOR_SUPERIOR";
    default:
      return "UNKNOWN";
  }
}
