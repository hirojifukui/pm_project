// 月次 人事情報 CSV 取込（FR-032）。
// 期待列: empNo,name,email,department,rankKind,role,sectionManagerEmpNo,status,effectiveFrom
// 取込失敗時でも本機能は停止せず、直近の社員情報を適用し続ける。

import { prisma } from "@/server/db/client";
import { newUlid } from "@/domain/id";
import type { HrImportStatus, HrImportErrorKind } from "@/domain/types";
import { enqueueNotification } from "@/server/notifications/inbox";

const EXPECTED_COLUMNS = [
  "empNo",
  "name",
  "email",
  "department",
  "rankKind",
  "role",
  "sectionManagerEmpNo",
  "status",
  "effectiveFrom",
] as const;

export type HrImportInput = {
  importedByEmpNo: string;
  sourceFileName: string;
  fileContent: string | null;
};

export type HrImportRowError = {
  lineNumber: number;
  empNo?: string;
  reason: string;
};

export type HrImportResultSummary = {
  id: string;
  status: HrImportStatus;
  errorKind: HrImportErrorKind;
  rowCount: number;
  errorRows: HrImportRowError[];
};

function parseCsv(content: string): string[][] {
  // RFC4180 風の素朴なパーサ（ダブルクォートで囲まれたフィールドをサポート）
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < content.length; i += 1) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // BOM 除去（UTF-8 BOM が付いていた場合）
  if (rows.length > 0) {
    const first = rows[0];
    if (first && first.length > 0 && first[0] && first[0].charCodeAt(0) === 0xfeff) {
      first[0] = first[0].slice(1);
    }
  }
  return rows;
}

export async function runHrImport(
  input: HrImportInput,
): Promise<HrImportResultSummary> {
  const importedAt = new Date();
  const id = newUlid();

  // 1) ファイル未着
  if (input.fileContent === null || input.fileContent === "") {
    const row = await prisma.hrImportResult.create({
      data: {
        id,
        importedByEmpNo: input.importedByEmpNo,
        sourceFileName: input.sourceFileName,
        status: "FAILED",
        errorKind: "FILE_MISSING",
        rowCount: 0,
        startedAt: importedAt,
        finishedAt: new Date(),
      },
    });
    await notifyFailure(input.importedByEmpNo);
    return summarize(row, []);
  }

  // 2) 形式のパース
  let rows: string[][];
  try {
    rows = parseCsv(input.fileContent);
  } catch {
    const row = await prisma.hrImportResult.create({
      data: {
        id,
        importedByEmpNo: input.importedByEmpNo,
        sourceFileName: input.sourceFileName,
        status: "FAILED",
        errorKind: "FORMAT_INVALID",
        rowCount: 0,
        startedAt: importedAt,
        finishedAt: new Date(),
      },
    });
    await notifyFailure(input.importedByEmpNo);
    return summarize(row, []);
  }

  if (rows.length === 0) {
    const row = await prisma.hrImportResult.create({
      data: {
        id,
        importedByEmpNo: input.importedByEmpNo,
        sourceFileName: input.sourceFileName,
        status: "FAILED",
        errorKind: "FORMAT_INVALID",
        rowCount: 0,
        startedAt: importedAt,
        finishedAt: new Date(),
      },
    });
    await notifyFailure(input.importedByEmpNo);
    return summarize(row, []);
  }

  // 3) ヘッダ列の検査
  const header = rows[0] ?? [];
  const missingColumns = EXPECTED_COLUMNS.filter((c) => !header.includes(c));
  if (missingColumns.length > 0) {
    const errorRows: HrImportRowError[] = [
      {
        lineNumber: 1,
        reason: `必須列が不足しています: ${missingColumns.join(", ")}`,
      },
    ];
    const row = await prisma.hrImportResult.create({
      data: {
        id,
        importedByEmpNo: input.importedByEmpNo,
        sourceFileName: input.sourceFileName,
        status: "FAILED",
        errorKind: "COLUMN_MISSING",
        rowCount: 0,
        errorRows: JSON.stringify(errorRows),
        startedAt: importedAt,
        finishedAt: new Date(),
      },
    });
    await notifyFailure(input.importedByEmpNo);
    return summarize(row, errorRows);
  }

  // 4) 行単位の取込
  const headerIndex = new Map<string, number>(
    header.map((h, i) => [h, i] as [string, number]),
  );
  const errorRows: HrImportRowError[] = [];
  let appliedCount = 0;

  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i];
    if (!r || r.every((v) => v === "")) continue;
    const empNo = cell(r, headerIndex, "empNo");
    try {
      await prisma.employee.upsert({
        where: { empNo: empNo ?? "" },
        create: toEmployeeData(r, headerIndex),
        update: toEmployeeData(r, headerIndex),
      });
      appliedCount += 1;
    } catch (err) {
      const emp: HrImportRowError = {
        lineNumber: i + 1,
        reason: err instanceof Error ? err.message : "取込エラー",
      };
      if (empNo) emp.empNo = empNo;
      errorRows.push(emp);
    }
  }

  const status: HrImportStatus =
    errorRows.length === 0
      ? "SUCCESS"
      : appliedCount > 0
        ? "PARTIAL"
        : "FAILED";
  const errorKind: HrImportErrorKind =
    errorRows.length > 0 ? "ROW_ERRORS" : "NONE";

  const row = await prisma.hrImportResult.create({
    data: {
      id,
      importedByEmpNo: input.importedByEmpNo,
      sourceFileName: input.sourceFileName,
      status,
      errorKind,
      rowCount: appliedCount,
      errorRows: errorRows.length > 0 ? JSON.stringify(errorRows) : null,
      startedAt: importedAt,
      finishedAt: new Date(),
    },
  });

  if (status !== "SUCCESS") {
    await notifyFailure(input.importedByEmpNo);
  }

  return summarize(row, errorRows);
}

function cell(
  row: string[],
  idx: Map<string, number>,
  key: string,
): string | undefined {
  const i = idx.get(key);
  if (i === undefined) return undefined;
  return row[i];
}

function toEmployeeData(
  row: string[],
  idx: Map<string, number>,
): {
  empNo: string;
  name: string;
  email: string;
  department: string;
  rankKind: string;
  role: string;
  sectionManagerEmpNo: string | null;
  status: string;
  effectiveFrom: Date;
} {
  const empNo = cell(row, idx, "empNo")?.trim();
  const name = cell(row, idx, "name")?.trim();
  const email = cell(row, idx, "email")?.trim();
  const department = cell(row, idx, "department")?.trim();
  const rankKind = cell(row, idx, "rankKind")?.trim();
  const role = cell(row, idx, "role")?.trim();
  const sm = cell(row, idx, "sectionManagerEmpNo")?.trim();
  const status = cell(row, idx, "status")?.trim();
  const effectiveFrom = cell(row, idx, "effectiveFrom")?.trim();

  if (!empNo) throw new Error("empNo が空です");
  if (!name) throw new Error("name が空です");
  if (!email) throw new Error("email が空です");
  if (!department) throw new Error("department が空です");
  if (!rankKind) throw new Error("rankKind が空です");
  if (!role) throw new Error("role が空です");
  if (!effectiveFrom) throw new Error("effectiveFrom が空です");

  return {
    empNo,
    name,
    email,
    department,
    rankKind,
    role,
    sectionManagerEmpNo: sm && sm.length > 0 ? sm : null,
    status: status && status.length > 0 ? status : "ACTIVE",
    effectiveFrom: new Date(`${effectiveFrom}T00:00:00.000Z`),
  };
}

async function notifyFailure(importedByEmpNo: string): Promise<void> {
  await enqueueNotification({
    recipientEmpNo: importedByEmpNo,
    templateId: "HR_IMPORT_FAILED_TO_ADMIN",
    operation: "HR_IMPORT",
  });
  // 経理担当にも周知
  const accountants = await prisma.employee.findMany({
    where: { role: "ACCOUNTANT", status: "ACTIVE" },
    select: { empNo: true },
  });
  for (const a of accountants) {
    await enqueueNotification({
      recipientEmpNo: a.empNo,
      templateId: "HR_IMPORT_FAILED_TO_ACCOUNTING",
      operation: "HR_IMPORT",
    });
  }
}

function summarize(
  row: {
    id: string;
    status: string;
    errorKind: string;
    rowCount: number;
  },
  errorRows: HrImportRowError[],
): HrImportResultSummary {
  return {
    id: row.id,
    status: row.status as HrImportStatus,
    errorKind: row.errorKind as HrImportErrorKind,
    rowCount: row.rowCount,
    errorRows,
  };
}
