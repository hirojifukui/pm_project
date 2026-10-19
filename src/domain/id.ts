import { ulid } from "ulid";

// 申請番号の採番ルール: JP-YYYY-NNNNNN（年ごとの 6 桁連番）
// 本機能のローカル実装では、既存の最大採番値を DB から取得して +1 する。

export function newUlid(): string {
  return ulid();
}

export function formatApplicationNumber(year: number, serial: number): string {
  const paddedYear = String(year).padStart(4, "0");
  const paddedSerial = String(serial).padStart(6, "0");
  return `JP-${paddedYear}-${paddedSerial}`;
}

export function parseApplicationNumber(
  applicationNumber: string,
): { year: number; serial: number } | null {
  const match = /^JP-(\d{4})-(\d{6})$/.exec(applicationNumber);
  if (!match) return null;
  const yearStr = match[1];
  const serialStr = match[2];
  if (!yearStr || !serialStr) return null;
  return {
    year: Number(yearStr),
    serial: Number(serialStr),
  };
}
