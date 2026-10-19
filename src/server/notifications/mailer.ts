// ファイル保存トランスポート（本機能ローカル実装の既定）。
// 本番展開時は SMTP ドライバーに差し替える。
// 生成物は `./data/mail/<ULID>.eml` に保存され、人間が目視で確認できる。

import { promises as fs } from "node:fs";
import path from "node:path";
import { newUlid } from "@/domain/id";

export type MailMessage = {
  to: string; // 受信者メールアドレス
  subject: string;
  body: string; // 本文（PII を含めない）
  templateId: string;
  operation: string;
  applicationNumber?: string;
};

export type MailSendResult = {
  ok: boolean;
  filePath?: string;
  failureReason?: string;
};

const MAIL_DIR = path.resolve(process.cwd(), "data", "mail");

export async function sendMail(message: MailMessage): Promise<MailSendResult> {
  try {
    await fs.mkdir(MAIL_DIR, { recursive: true });
    const id = newUlid();
    const filePath = path.join(MAIL_DIR, `${id}.eml`);
    const now = new Date().toUTCString();
    const content =
      `Date: ${now}\r\n` +
      `From: travel-expense-local@example.invalid\r\n` +
      `To: ${message.to}\r\n` +
      `Subject: ${message.subject}\r\n` +
      `X-Template-Id: ${message.templateId}\r\n` +
      `X-Operation: ${message.operation}\r\n` +
      (message.applicationNumber
        ? `X-Application-Number: ${message.applicationNumber}\r\n`
        : "") +
      `Content-Type: text/plain; charset=UTF-8\r\n` +
      `\r\n` +
      message.body;
    await fs.writeFile(filePath, content, { encoding: "utf8" });
    return { ok: true, filePath };
  } catch (err) {
    return {
      ok: false,
      failureReason: err instanceof Error ? err.message : "unknown",
    };
  }
}
