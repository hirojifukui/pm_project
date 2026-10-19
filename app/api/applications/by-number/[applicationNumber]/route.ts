import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import { logPiiAccess } from "@/server/pii-access";
import { parseTaxiReasons } from "@/domain/rules/BR-005.taxi-exceptions";
import { NotFoundError } from "@/server/errors/to-user-message";

// GET /api/applications/by-number/{applicationNumber}
// contracts/applications.md § 2
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ applicationNumber: string }> },
) {
  const { applicationNumber } = await params;
  return withAuthenticated(async (user) => {
    const application = await prisma.application.findUnique({
      where: { applicationNumber },
      include: {
        applicant: {
          select: {
            empNo: true,
            name: true,
            department: true,
          },
        },
        lines: {
          orderBy: { date: "asc" },
          include: {
            receipts: {
              select: {
                id: true,
                mimeType: true,
                sizeBytes: true,
                isSupportingDocument: true,
                supportingReason: true,
                uploadedAt: true,
              },
            },
          },
        },
        histories: {
          orderBy: { occurredAt: "asc" },
          include: {
            operator: { select: { empNo: true, name: true } },
          },
        },
        nextApprover: { select: { empNo: true, name: true } },
      },
    });
    if (!application) throw new NotFoundError();

    authorize({
      operation: "VIEW_SUBORDINATE_APPLICATION",
      user,
      application,
    });

    // PII 直接表示経路を監査（氏名・金額が画面に出るため）
    await logPiiAccess({
      accessorEmpNo: user.empNo,
      applicationNumber,
      targetEmpNo: application.applicantEmpNo,
      reasonCode:
        user.empNo === application.applicantEmpNo
          ? "ADMIN_LOOKUP"
          : user.role === "ACCOUNTANT" ||
              user.role === "ACCOUNTING_DIRECTOR" ||
              user.role === "ACCOUNTING_DIRECTOR_SUPERIOR"
            ? "ACCOUNTING"
            : "APPROVAL",
    });

    return {
      applicationNumber: application.applicationNumber,
      applicant: application.applicant,
      department: application.department,
      tripStartDate: toYmd(application.tripStartDate),
      tripEndDate: toYmd(application.tripEndDate),
      destination: application.destination,
      purpose: application.purpose,
      totalAmountYen: application.totalAmountYen,
      status: application.status,
      submittedAt: application.submittedAt?.toISOString() ?? null,
      firstApprovedAt: application.firstApprovedAt?.toISOString() ?? null,
      finalApprovedAt: application.finalApprovedAt?.toISOString() ?? null,
      accountingFinalizedAt:
        application.accountingFinalizedAt?.toISOString() ?? null,
      nextApprover: application.nextApprover,
      lines: application.lines.map((l) => ({
        id: l.id,
        date: toYmd(l.date),
        category: l.category,
        fromPlace: l.fromPlace,
        toPlace: l.toPlace,
        transportMode: l.transportMode,
        amountYen: l.amountYen,
        isSystemGenerated: l.isSystemGenerated,
        taxiReasons: parseTaxiReasons(l.taxiReasons),
        exceedsLodgingCapReason: l.exceedsLodgingCapReason,
        remarks: l.remarks,
        receipts: l.receipts,
      })),
      histories: application.histories.map((h) => ({
        id: h.id,
        operator: h.operator,
        actedAs: h.actedAs,
        operation: h.operation,
        comment: h.comment,
        occurredAt: h.occurredAt.toISOString(),
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
