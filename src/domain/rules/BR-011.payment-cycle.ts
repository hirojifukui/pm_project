// BR-011: 支払周期（出典: R-11）。
// 毎月 25 日の締め日（土日・祝日なら前営業日）、翌月 10 日に給与口座へ振り込む。

import { previousBusinessDay, isBusinessDay } from "@/domain/workdays";
import type { HolidayCalendar } from "@/domain/holidays";

export type CutoffPaymentResult = {
  effectiveCutoff: string; // YYYY-MM-DD
  paymentDate: string; // YYYY-MM-DD
};

function parseYmd(ymd: string): Date {
  const [yStr, mStr, dStr] = ymd.split("-") as [string, string, string];
  return new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr)));
}

function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * 指定の締め日候補（通常は毎月 25 日）に基づき、
 * 実効締め日と翌月 10 日の支払予定日を返す。
 */
export function cutoffPaymentDate(
  cutoffYmd: string,
  calendar: HolidayCalendar,
): CutoffPaymentResult {
  const candidate = parseYmd(cutoffYmd);
  // 休日なら前営業日に繰り上げ
  const effective = isBusinessDay(candidate, calendar)
    ? toYmd(candidate)
    : previousBusinessDay(candidate, calendar);

  // 翌月 10 日
  const paymentDate = new Date(
    Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 10),
  );
  return {
    effectiveCutoff: effective,
    paymentDate: toYmd(paymentDate),
  };
}
