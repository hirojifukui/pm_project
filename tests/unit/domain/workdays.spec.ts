import { describe, it, expect } from "vitest";
import {
  isBusinessDay,
  previousBusinessDay,
  hasAtLeastBusinessDays,
} from "@/domain/workdays";

const CAL_2026: ReadonlySet<string> = new Set([
  "2026-01-01",
  "2026-04-29",
  "2026-05-03",
  "2026-07-20",
  "2026-10-12",
  "2026-11-23",
]);

describe("isBusinessDay", () => {
  it("平日かつ祝日でなければ営業日", () => {
    expect(isBusinessDay("2026-10-19", CAL_2026)).toBe(true); // 月曜
  });

  it("土曜は営業日ではない", () => {
    expect(isBusinessDay("2026-10-17", CAL_2026)).toBe(false);
  });

  it("日曜は営業日ではない", () => {
    expect(isBusinessDay("2026-10-18", CAL_2026)).toBe(false);
  });

  it("祝日は営業日ではない", () => {
    expect(isBusinessDay("2026-10-12", CAL_2026)).toBe(false); // スポーツの日（月曜）
  });
});

describe("previousBusinessDay（BR-011、25日が休日なら前営業日）", () => {
  it("営業日はそのまま返す", () => {
    expect(previousBusinessDay("2026-11-25", CAL_2026)).toBe("2026-11-25");
  });

  it("土曜はその前の金曜に繰り上げる", () => {
    // 2026-10-24 は土曜
    expect(previousBusinessDay("2026-10-24", CAL_2026)).toBe("2026-10-23");
  });

  it("日曜はその前の金曜に繰り上げる", () => {
    // 2026-10-25 は日曜
    expect(previousBusinessDay("2026-10-25", CAL_2026)).toBe("2026-10-23");
  });

  it("月曜が祝日かつ前日・前々日が週末のとき、前の金曜まで繰り上げる", () => {
    // 2026-10-12 月曜（スポーツの日）、10-11 日曜、10-10 土曜 → 10-09 金曜
    expect(previousBusinessDay("2026-10-12", CAL_2026)).toBe("2026-10-09");
  });
});

describe("hasAtLeastBusinessDays（BR-012、3 営業日以上の不在期間）", () => {
  it("月曜〜水曜（3 日連続平日）は 3 営業日以上を満たす", () => {
    expect(
      hasAtLeastBusinessDays("2026-10-19", "2026-10-21", 3, CAL_2026),
    ).toBe(true);
  });

  it("金曜〜日曜は 1 営業日しか含まないため 3 営業日未満", () => {
    expect(
      hasAtLeastBusinessDays("2026-10-23", "2026-10-25", 3, CAL_2026),
    ).toBe(false);
  });

  it("3 営業日より少ない期間は false", () => {
    expect(
      hasAtLeastBusinessDays("2026-10-19", "2026-10-20", 3, CAL_2026),
    ).toBe(false);
  });

  it("終了日が開始日より前なら false", () => {
    expect(
      hasAtLeastBusinessDays("2026-10-21", "2026-10-19", 3, CAL_2026),
    ).toBe(false);
  });
});
