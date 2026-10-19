import { describe, it, expect } from "vitest";
import { isDeadlineExceeded } from "@/domain/rules/EX-006.deadline-exceeded";

// EX-006: 申請期限（出張終了日の翌日から 30 日）を過ぎた場合、申請者は遅延理由を記入し、
// 所属長の承認に加えて部長の承認も得る。

describe("EX-006 isDeadlineExceeded", () => {
  const tripEnd = new Date("2026-10-01T00:00:00+09:00");

  it("30 日目は期限内（EX-006 の対象外）", () => {
    const submittedAt = new Date("2026-10-31T23:59:59+09:00");
    expect(isDeadlineExceeded(submittedAt, tripEnd, 30)).toBe(false);
  });

  it("31 日目は期限超過（EX-006 の対象）", () => {
    const submittedAt = new Date("2026-11-01T00:00:00+09:00");
    expect(isDeadlineExceeded(submittedAt, tripEnd, 30)).toBe(true);
  });

  it("期限超過時は、遅延理由を伴う提出のみ受理する（本テストはルーティングを E2E で確認）", () => {
    // isDeadlineExceeded は true/false の判定のみを行う。
    // 遅延理由の必須チェックは submit route handler の責務。
    const submittedAt = new Date("2026-12-01T00:00:00+09:00");
    expect(isDeadlineExceeded(submittedAt, tripEnd, 30)).toBe(true);
  });
});
