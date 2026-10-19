// 領収書画像のローカル保存（FR-003）。
// JPEG/PNG、1 枚 10MB 以下、1 申請あたり合計 30MB・最大 20 枚までを検証する。

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { newUlid } from "@/domain/id";

const UPLOAD_ROOT = path.resolve(process.cwd(), "data", "uploads");
const PER_FILE_LIMIT = 10 * 1024 * 1024;
const PER_APPLICATION_TOTAL_LIMIT = 30 * 1024 * 1024;
const PER_APPLICATION_MAX_FILES = 20;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png"]);

export type SaveReceiptInput = {
  applicationNumber: string;
  mimeType: string;
  buffer: Buffer;
  existingTotalBytes: number;
  existingFileCount: number;
};

export type SaveReceiptResult = {
  id: string;
  storagePath: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
};

export class ReceiptValidationError extends Error {
  readonly ja: string;
  constructor(ja: string) {
    super(ja);
    this.ja = ja;
    this.name = "ReceiptValidationError";
  }
}

export async function saveReceipt(
  input: SaveReceiptInput,
): Promise<SaveReceiptResult> {
  if (!ALLOWED_MIME.has(input.mimeType)) {
    throw new ReceiptValidationError(
      "領収書画像は JPEG または PNG で添付してください。",
    );
  }
  if (input.buffer.byteLength > PER_FILE_LIMIT) {
    throw new ReceiptValidationError(
      "1 枚あたりのファイルサイズは 10MB 以内にしてください。",
    );
  }
  if (
    input.existingTotalBytes + input.buffer.byteLength >
    PER_APPLICATION_TOTAL_LIMIT
  ) {
    throw new ReceiptValidationError(
      "1 申請あたりの領収書合計サイズは 30MB 以内にしてください。",
    );
  }
  if (input.existingFileCount + 1 > PER_APPLICATION_MAX_FILES) {
    throw new ReceiptValidationError(
      "1 申請あたりの領収書枚数は 20 枚までにしてください。",
    );
  }

  const ext = input.mimeType === "image/png" ? ".png" : ".jpg";
  const id = newUlid();
  const dir = path.join(UPLOAD_ROOT, input.applicationNumber);
  await fs.mkdir(dir, { recursive: true });
  const storagePath = path.join(dir, `${id}${ext}`);
  await fs.writeFile(storagePath, input.buffer);

  const sha256 = crypto.createHash("sha256").update(input.buffer).digest("hex");
  return {
    id,
    storagePath,
    sha256,
    sizeBytes: input.buffer.byteLength,
    mimeType: input.mimeType,
  };
}
