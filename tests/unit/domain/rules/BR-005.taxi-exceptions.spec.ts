import { describe, it, expect } from "vitest";
import { hasValidTaxiReason } from "@/domain/rules/BR-005.taxi-exceptions";

// BR-005: タクシーは原則使わない。例外として:
// (a) 22:00 以降の移動
// (b) 携行荷物が合計 15kg 以上
// (c) 顧客と同じ車に同乗する必要がある
// いずれかに該当する場合に、申請者が該当事由を選択・記入すれば認める。

describe("BR-005 hasValidTaxiReason", () => {
  it("事由が未選択はブロック", () => {
    expect(hasValidTaxiReason(undefined)).toBe(false);
    expect(hasValidTaxiReason([])).toBe(false);
  });

  it("AFTER_22 が選ばれていれば OK", () => {
    expect(hasValidTaxiReason(["AFTER_22"])).toBe(true);
  });

  it("HEAVY_LUGGAGE が選ばれていれば OK", () => {
    expect(hasValidTaxiReason(["HEAVY_LUGGAGE"])).toBe(true);
  });

  it("CUSTOMER_RIDE が選ばれていれば OK", () => {
    expect(hasValidTaxiReason(["CUSTOMER_RIDE"])).toBe(true);
  });

  it("複数の事由を同時に選べる", () => {
    expect(hasValidTaxiReason(["AFTER_22", "HEAVY_LUGGAGE"])).toBe(true);
  });
});
