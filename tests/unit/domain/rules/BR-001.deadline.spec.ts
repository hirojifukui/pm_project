import { describe, it, expect } from "vitest";
import { isWithinDeadline } from "@/domain/rules/BR-001.deadline";

// BR-001: 申請は、出張終了日の翌日から30日以内に提出する
// 期限最終日（出張終了日の翌日から 30 日目）23:59 は期限内、31 日目以降は EX-006 経路。

describe("BR-001 isWithinDeadline", () => {
  const tripEnd = new Date("2026-10-01T00:00:00+09:00");

  it("出張終了日当日に提出した場合は期限内", () => {
    const submittedAt = new Date("2026-10-01T10:00:00+09:00");
    expect(isWithinDeadline(submittedAt, tripEnd, 30)).toBe(true);
  });

  it("出張終了日の翌日に提出した場合は期限内", () => {
    const submittedAt = new Date("2026-10-02T00:00:00+09:00");
    expect(isWithinDeadline(submittedAt, tripEnd, 30)).toBe(true);
  });

  it("30 日目の 23:59 は期限内（境界値）", () => {
    const submittedAt = new Date("2026-10-31T23:59:59+09:00");
    expect(isWithinDeadline(submittedAt, tripEnd, 30)).toBe(true);
  });

  it("31 日目は期限超過", () => {
    const submittedAt = new Date("2026-11-01T00:00:00+09:00");
    expect(isWithinDeadline(submittedAt, tripEnd, 30)).toBe(false);
  });

  it("出張終了日より前の日付は期限内として扱う", () => {
    const submittedAt = new Date("2026-09-30T12:00:00+09:00");
    expect(isWithinDeadline(submittedAt, tripEnd, 30)).toBe(true);
  });
});
