// 営業日計算。
// - BR-011: 毎月25日の締め日。25 日が土日または祝日のときは直前の営業日に繰り上げる。
// - BR-012: 代理承認指名の最小期間（3 営業日以上）判定。
// 本モジュールは `Asia/Tokyo` を既定タイムゾーンとして扱う（憲法 追加の制約）。

import { HolidayCalendar, toDateKey, isHoliday } from "./holidays";

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function addDays(d: Date, delta: number): Date {
  const copy = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  copy.setUTCDate(copy.getUTCDate() + delta);
  return copy;
}

function parseYmd(ymd: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error(`無効な日付: ${ymd}`);
  }
  const [yStr, mStr, dStr] = ymd.split("-") as [string, string, string];
  return new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr)));
}

/**
 * 指定日が営業日か。
 * 平日かつ、祝日カレンダーに含まれない日のみ営業日とみなす。
 */
export function isBusinessDay(
  date: Date | string,
  calendar: HolidayCalendar,
): boolean {
  const d = typeof date === "string" ? parseYmd(date) : date;
  if (isWeekend(d)) return false;
  if (isHoliday(d, calendar)) return false;
  return true;
}

/**
 * 指定日が営業日でない場合、直前の営業日まで繰り上げる。
 * BR-011「25 日が休日なら前営業日」で使う。
 */
export function previousBusinessDay(
  date: Date | string,
  calendar: HolidayCalendar,
): string {
  let d = typeof date === "string" ? parseYmd(date) : date;
  while (!isBusinessDay(d, calendar)) {
    d = addDays(d, -1);
  }
  return toDateKey(d);
}

/**
 * BR-012「3 営業日以上の不在期間」判定。
 * 開始・終了の両端を含めた日数を数え、営業日数が指定の最小日数以上かを返す。
 */
export function hasAtLeastBusinessDays(
  startsAt: Date | string,
  endsAt: Date | string,
  minDays: number,
  calendar: HolidayCalendar,
): boolean {
  const start = typeof startsAt === "string" ? parseYmd(startsAt) : startsAt;
  const end = typeof endsAt === "string" ? parseYmd(endsAt) : endsAt;
  if (end.getTime() < start.getTime()) {
    return false;
  }
  let count = 0;
  let cur = start;
  while (cur.getTime() <= end.getTime()) {
    if (isBusinessDay(cur, calendar)) count += 1;
    if (count >= minDays) return true;
    cur = addDays(cur, 1);
  }
  return false;
}
