import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import { canFinalize } from "@/domain/rules/BR-015.accountant-own";
import { logPiiAccess } from "@/server/pii-access";
import type { EmployeeRole } from "@/domain/types";

// GET /api/accounting/pending
// contracts/accounting.md § 1
// 現在ユーザーが経理確定できる候補を返す（BR-009／BR-015 を適用）。
export async function GET() {
  return withAuthenticated(async (user) => {
    // 粗い認可: 経理担当以上
    authorize({ operation: "EXPORT_PAYMENT_CSV", user });

    const rows = await prisma.application.findMany({
      where: { status: "ACCOUNTING_REVIEW" },
      orderBy: { finalApprovedAt: "asc" },
      include: {
        applicant: {
          select: {
            empNo: true,
            name: true,
            department: true,
            role: true,
          },
        },
        lines: { select: { receipts: { select: { id: true } } } },
      },
    });

    const items = rows
      .filter((app) =>
        canFinalize({
          userRole: user.role as EmployeeRole,
          userEmpNo: user.empNo,
          applicantRole: app.applicant.role as EmployeeRole,
          applicantEmpNo: app.applicant.empNo,
        }),
      )
      .map((app) => ({
        applicationNumber: app.applicationNumber,
        applicantName: app.applicant.name,
        department: app.applicant.department,
        totalAmountYen: app.totalAmountYen,
        tripStartDate: toYmd(app.tripStartDate),
        tripEndDate: toYmd(app.tripEndDate),
        hasAllReceipts: app.lines.every((l) => l.receipts.length > 0),
        isSelfOfApplicant: app.applicantEmpNo === user.empNo,
        requiredBy: mapRequiredBy(app.applicant.role as EmployeeRole),
      }));

    if (items.length > 0) {
      await logPiiAccess({
        accessorEmpNo: user.empNo,
        reasonCode: "ACCOUNTING",
        freeNote: `経理確定待ち一覧の参照（${items.length} 件）`,
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

function mapRequiredBy(applicantRole: EmployeeRole): string {
  if (applicantRole === "ACCOUNTANT") return "ACCOUNTING_DIRECTOR";
  if (applicantRole === "ACCOUNTING_DIRECTOR")
    return "ACCOUNTING_DIRECTOR_SUPERIOR";
  return "ACCOUNTANT";
}
