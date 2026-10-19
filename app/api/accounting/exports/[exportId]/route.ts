import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import { NotFoundError } from "@/server/errors/to-user-message";

// GET /api/accounting/exports/{exportId}
// contracts/accounting.md § 6
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ exportId: string }> },
) {
  const { exportId } = await params;
  return withAuthenticated(async (user) => {
    authorize({ operation: "EXPORT_PAYMENT_CSV", user });
    const row = await prisma.paymentCsvExport.findUnique({
      where: { id: exportId },
      include: {
        exportedBy: { select: { name: true } },
      },
    });
    if (!row) throw new NotFoundError();

    const applicationNumbers = (
      JSON.parse(row.includedApplicationNumbers) as unknown
    ) as string[];
    const applications = await prisma.application.findMany({
      where: { applicationNumber: { in: applicationNumbers } },
      include: {
        applicant: { select: { empNo: true, name: true } },
      },
      orderBy: { applicationNumber: "asc" },
    });

    return {
      id: row.id,
      cutoffDate: row.cutoffDate.toISOString().slice(0, 10),
      paymentDate: row.paymentDate.toISOString().slice(0, 10),
      rowCount: row.rowCount,
      totalAmountYen: row.totalAmountYen,
      layoutVersion: row.layoutVersion,
      exportedBy: row.exportedBy.name,
      exportedAt: row.exportedAt.toISOString(),
      fileRelativePath: row.fileRelativePath,
      applications: applications.map((a) => ({
        applicationNumber: a.applicationNumber,
        applicantEmpNo: a.applicant.empNo,
        applicantName: a.applicant.name,
        totalAmountYen: a.totalAmountYen,
      })),
    };
  });
}
