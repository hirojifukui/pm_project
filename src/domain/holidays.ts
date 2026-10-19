// 祝日判定。DB の Holiday テーブルから取得した祝日集合を使って、
// 「与えられた日付が祝日か」を判定する純粋関数を提供する。
// 日付は Asia/Tokyo の `YYYY-MM-DD` 文字列として表現する。

export type HolidayCalendar = ReadonlySet<string>;

export function toDateKey(date: Date | string): string {
  if (typeof date === "string") {
    // 期待形式: YYYY-MM-DD or ISO 文字列
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    return new Date(date).toISOString().slice(0, 10);
  }
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isHoliday(
  date: Date | string,
  calendar: HolidayCalendar,
): boolean {
  return calendar.has(toDateKey(date));
}

// 2026 年の日本の祝日（研修用の固定値）
export const DEFAULT_HOLIDAYS_2026: ReadonlyArray<{
  date: string;
  name: string;
}> = [
  { date: "2026-01-01", name: "元日" },
  { date: "2026-01-12", name: "成人の日" },
  { date: "2026-02-11", name: "建国記念の日" },
  { date: "2026-02-23", name: "天皇誕生日" },
  { date: "2026-03-20", name: "春分の日" },
  { date: "2026-04-29", name: "昭和の日" },
  { date: "2026-05-03", name: "憲法記念日" },
  { date: "2026-05-04", name: "みどりの日" },
  { date: "2026-05-05", name: "こどもの日" },
  { date: "2026-05-06", name: "振替休日" },
  { date: "2026-07-20", name: "海の日" },
  { date: "2026-08-11", name: "山の日" },
  { date: "2026-09-21", name: "敬老の日" },
  { date: "2026-09-22", name: "国民の休日" },
  { date: "2026-09-23", name: "秋分の日" },
  { date: "2026-10-12", name: "スポーツの日" },
  { date: "2026-11-03", name: "文化の日" },
  { date: "2026-11-23", name: "勤労感謝の日" },
];
