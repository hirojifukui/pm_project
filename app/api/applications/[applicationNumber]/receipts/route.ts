import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { withAuthenticated, respondCreated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from "@/server/errors/to-user-message";
import { saveReceipt, ReceiptValidationError } from "@/server/storage/receipts";

const EDITABLE_STATUSES = new Set<string>(["DRAFT", "REMANDED"]);

// POST /api/applications/{applicationNumber}/receipts
// contracts/applications.md § 4
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ applicationNumber: string }> },
) {
  const { applicationNumber } = await params;
  return withAuthenticated(async (user) => {
    const application = await prisma.application.findUnique({
      where: { applicationNumber },
    });
    if (!application) throw new NotFoundError();
    authorize({
      operation: "CREATE_OWN_APPLICATION",
      user,
      application,
    });
    if (!EDITABLE_STATUSES.has(application.status)) {
      throw new ConflictError(
        "この申請は現在編集できません（下書きまたは差戻し中のみ編集できます）。",
      );
    }

    const form = await req.formData();
    const expenseLineId = form.get("expenseLineId");
    const file = form.get("file");
    const isSupportingDocumentRaw = form.get("isSupportingDocument");
    const supportingReason = form.get("supportingReason");

    if (typeof expenseLineId !== "string" || !expenseLineId) {
      throw new BusinessRuleError([
        { path: "expenseLineId", message: "明細を指定してください。" },
      ]);
    }
    if (!(file instanceof File)) {
      throw new BusinessRuleError([
        { path: "file", message: "領収書画像を選択してください。" },
      ]);
    }

    const line = await prisma.expenseLine.findUnique({
      where: { id: expenseLineId },
      include: {
        receipts: {
          select: { sizeBytes: true },
        },
      },
    });
    if (!line || line.applicationNumber !== applicationNumber) {
      throw new NotFoundError();
    }

    const existingTotalBytes = line.receipts.reduce(
      (s, r) => s + r.sizeBytes,
      0,
    );
    const existingFileCount = line.receipts.length;

    const isSupportingDocument = isSupportingDocumentRaw === "true";
    const reason =
      typeof supportingReason === "string" ? supportingReason : "";
    if (isSupportingDocument && reason.length === 0) {
      throw new BusinessRuleError([
        {
          path: "supportingReason",
          message: "支払証明書として扱う場合は、紛失・支給理由を記入してください。",
          ruleId: "EX-002",
        },
      ]);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      const saved = await saveReceipt({
        applicationNumber,
        mimeType: file.type,
        buffer,
        existingTotalBytes,
        existingFileCount,
      });

      const row = await prisma.receipt.create({
        data: {
          id: saved.id,
          expenseLineId,
          storagePath: saved.storagePath,
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes,
          sha256: saved.sha256,
          isSupportingDocument,
          supportingReason: isSupportingDocument ? reason : null,
        },
        select: { id: true, sha256: true, storagePath: true },
      });
      return respondCreated(row);
    } catch (err) {
      if (err instanceof ReceiptValidationError) {
        throw new BusinessRuleError([
          { path: "file", message: err.ja, ruleId: "FR-003" },
        ]);
      }
      throw err;
    }
  });
}
