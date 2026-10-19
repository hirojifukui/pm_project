// 支払用 CSV ジェネレータ（T105、FR-016、BR-011）。
// 既定レイアウト default-v1: 社員番号・氏名・申請番号・支払金額・支払予定日。
// UTF-8、CRLF、BOM 無し、日付は YYYY-MM-DD、金額は 3 桁区切りなしの整数。

import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@/server/db/client";
import { cutoffPaymentDate } from "@/domain/rules/BR-011.payment-cycle";
import { newUlid } from "@/domain/id";
import { ConflictError, NotFoundError } from "@/server/errors/to-user-message";
import { enqueueNotification } from "@/server/notifications/inbox";

const EXPORT_DIR = path.resolve(process.cwd(), "data", "exports");
const DEFAULT_LAYOUT = "default-v1";

export type GenerateCsvInput = {
  cutoffYmd?: string;
  exportedByEmpNo: string;
  layoutVersion?: string;
  force?: boolean;
};

export type GenerateCsvResult = {
  exportId: string;
  cutoffDate: string;
  paymentDate: string;
  rowCount: number;
  totalAmountYen: number;
  fileRelativePath: string;
  layoutVersion: string;
};

function toYmdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function parseYmdUtc(ymd: string): Date {
  const [yStr, mStr, dStr] = ymd.split("-") as [string, string, string];
  return new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr)));
}

function defaultCutoffYmd(now: Date = new Date()): string {
  // Asia/Tokyo のオフセット分を加算した「当月」の 25 日
  const tz = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return `${tz.getUTCFullYear()}-${String(tz.getUTCMonth() + 1).padStart(2, "0")}-25`;
}

export async function generatePaymentCsv(
  input: GenerateCsvInput,
): Promise<GenerateCsvResult> {
  const layoutVersion = input.layoutVersion ?? DEFAULT_LAYOUT;
  const cutoffYmd = input.cutoffYmd ?? defaultCutoffYmd();

  // 祝日カレンダー読み込み（BR-011）
  const holidays = await prisma.holiday.findMany({ select: { date: true } });
  const calendar = new Set(
    holidays.map((h) => h.date.toISOString().slice(0, 10)),
  );
  const { effectiveCutoff, paymentDate } = cutoffPaymentDate(cutoffYmd, calendar);

  // 既存スナップショットの重複チェック
  const existing = await prisma.paymentCsvExport.findFirst({
    where: {
      cutoffDate: parseYmdUtc(effectiveCutoff),
      layoutVersion,
    },
  });
  if (existing && !input.force) {
    throw new ConflictError(
      "この締め日・レイアウトの支払用 CSV は既に出力済みです。再出力するには force=true を指定してください。",
      {
        code: "CSV_SNAPSHOT_EXISTS",
        extra: { exportId: existing.id },
      },
    );
  }

  // 対象申請の収集: 経理確定済みかつ未リンク、effectiveCutoff の 23:59:59 まで
  const cutoffEndOfDay = new Date(
    parseYmdUtc(effectiveCutoff).getTime() + 24 * 60 * 60 * 1000 - 1,
  );
  const applications = await prisma.application.findMany({
    where: {
      status: "ACCOUNTING_FINALIZED",
      paymentCsvExportId: null,
      accountingFinalizedAt: { lte: cutoffEndOfDay },
    },
    include: { applicant: { select: { empNo: true, name: true } } },
    orderBy: { applicationNumber: "asc" },
  });

  if (applications.length === 0) {
    throw new NotFoundError();
  }

  // CSV 本体の生成
  const header = "社員番号,氏名,申請番号,支払金額,支払予定日";
  const rows = applications.map((a) =>
    [
      a.applicant.empNo,
      csvCell(a.applicant.name),
      a.applicationNumber,
      a.totalAmountYen,
      paymentDate,
    ].join(","),
  );
  const content = [header, ...rows].join("\r\n") + "\r\n";

  await fs.mkdir(EXPORT_DIR, { recursive: true });
  const fileName = `${effectiveCutoff}-${layoutVersion}.csv`;
  const absolutePath = path.join(EXPORT_DIR, fileName);
  const fileRelativePath = `./data/exports/${fileName}`;
  await fs.writeFile(absolutePath, content, { encoding: "utf8" });

  // スナップショットレコード作成 + 対象申請への紐付け + 履歴
  const exportId = newUlid();
  const totalAmountYen = applications.reduce(
    (s, a) => s + a.totalAmountYen,
    0,
  );
  await prisma.$transaction(async (tx) => {
    await tx.paymentCsvExport.create({
      data: {
        id: exportId,
        cutoffDate: parseYmdUtc(effectiveCutoff),
        paymentDate: parseYmdUtc(paymentDate),
        includedApplicationNumbers: JSON.stringify(
          applications.map((a) => a.applicationNumber),
        ),
        rowCount: applications.length,
        totalAmountYen,
        layoutVersion,
        exportedByEmpNo: input.exportedByEmpNo,
        fileRelativePath,
      },
    });
    for (const app of applications) {
      await tx.application.update({
        where: { applicationNumber: app.applicationNumber },
        data: { paymentCsvExportId: exportId },
      });
      await tx.approvalHistory.create({
        data: {
          id: newUlid(),
          applicationNumber: app.applicationNumber,
          operatorEmpNo: input.exportedByEmpNo,
          operation: "CSV_EXPORT",
        },
      });
    }
  });

  // 経理担当宛て通知
  await enqueueNotification({
    recipientEmpNo: input.exportedByEmpNo,
    templateId: "CSV_EXPORTED_TO_ACCOUNTING",
    operation: "CSV_EXPORT",
  });

  return {
    exportId,
    cutoffDate: effectiveCutoff,
    paymentDate,
    rowCount: applications.length,
    totalAmountYen,
    fileRelativePath,
    layoutVersion,
  };
}

function csvCell(value: string): string {
  // 氏名などに , や " が含まれるケースに備えてクォート処理
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
