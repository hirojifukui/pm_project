import { NextRequest } from "next/server";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import { CsvExportInput } from "@/domain/types";
import { generatePaymentCsv } from "@/server/csv/payment";
import { prisma } from "@/server/db/client";

// POST /api/accounting/exports
// contracts/accounting.md § 5
export async function POST(req: NextRequest) {
  return withAuthenticated(async (user) => {
    authorize({ operation: "EXPORT_PAYMENT_CSV", user });
    const body = CsvExportInput.parse(await req.json().catch(() => ({})));
    const result = await generatePaymentCsv({
      ...(body.cutoffDate !== undefined ? { cutoffYmd: body.cutoffDate } : {}),
      exportedByEmpNo: user.empNo,
      ...(body.force !== undefined ? { force: body.force } : {}),
    });
    return result;
  });
}

// GET /api/accounting/exports → 履歴
export async function GET() {
  return withAuthenticated(async (user) => {
    authorize({ operation: "EXPORT_PAYMENT_CSV", user });
    const rows = await prisma.paymentCsvExport.findMany({
      orderBy: { exportedAt: "desc" },
      take: 50,
      include: { exportedBy: { select: { name: true } } },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        cutoffDate: r.cutoffDate.toISOString().slice(0, 10),
        paymentDate: r.paymentDate.toISOString().slice(0, 10),
        rowCount: r.rowCount,
        totalAmountYen: r.totalAmountYen,
        layoutVersion: r.layoutVersion,
        exportedBy: r.exportedBy.name,
        exportedAt: r.exportedAt.toISOString(),
        fileRelativePath: r.fileRelativePath,
      })),
    };
  });
}
