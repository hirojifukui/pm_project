import { describe, it, expect } from "vitest";
import { checkEconomicalRoute } from "@/domain/rules/BR-004.economic-route";

// BR-004: 交通手段は最も経済的な経路を使う
// - 新幹線・特急は片道 100km 以上で利用可
// - グリーン車は役職を問わず不可

const MIN_KM = 100;

describe("BR-004 checkEconomicalRoute", () => {
  it("新幹線・特急で片道 100km（境界）は OK", () => {
    const r = checkEconomicalRoute({
      transportMode: "SHINKANSEN",
      oneWayKm: 100,
      isGreenCar: false,
      minKmForLimitedExpress: MIN_KM,
    });
    expect(r.ok).toBe(true);
  });

  it("新幹線・特急で片道 99km は NG", () => {
    const r = checkEconomicalRoute({
      transportMode: "SHINKANSEN",
      oneWayKm: 99,
      isGreenCar: false,
      minKmForLimitedExpress: MIN_KM,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBeDefined();
  });

  it("グリーン車（役職を問わず）は NG", () => {
    const r = checkEconomicalRoute({
      transportMode: "SHINKANSEN",
      oneWayKm: 300,
      isGreenCar: true,
      minKmForLimitedExpress: MIN_KM,
    });
    expect(r.ok).toBe(false);
  });

  it("在来線（TRAIN）は距離制約なし", () => {
    const r = checkEconomicalRoute({
      transportMode: "TRAIN",
      oneWayKm: 10,
      isGreenCar: false,
      minKmForLimitedExpress: MIN_KM,
    });
    expect(r.ok).toBe(true);
  });

  it("バスは距離制約なし", () => {
    const r = checkEconomicalRoute({
      transportMode: "BUS",
      oneWayKm: 50,
      isGreenCar: false,
      minKmForLimitedExpress: MIN_KM,
    });
    expect(r.ok).toBe(true);
  });
});
