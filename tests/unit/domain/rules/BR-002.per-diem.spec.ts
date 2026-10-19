import { describe, it, expect } from "vitest";
import { calculatePerDiem } from "@/domain/rules/BR-002.per-diem";

// BR-002: 日当
// - 宿泊: 一般社員 2,000円/日、管理職 2,500円/日
// - 日帰り: 片道 100km 以上の場合に限り 1,000円
// - 出発日と帰着日も 1 日として数える

const RULES = {
  staffLodgingDaily: 2000,
  managementLodgingDaily: 2500,
  dayTripFlat: 1000,
};

describe("BR-002 calculatePerDiem", () => {
  it("宿泊 2 泊 3 日（一般社員）は 2,000円 × 3 = 6,000円", () => {
    const amount = calculatePerDiem({
      isDayTrip: false,
      rankKind: "STAFF",
      days: 3,
      rules: RULES,
    });
    expect(amount).toBe(6000);
  });

  it("宿泊 1 泊 2 日（管理職）は 2,500円 × 2 = 5,000円", () => {
    const amount = calculatePerDiem({
      isDayTrip: false,
      rankKind: "MANAGEMENT",
      days: 2,
      rules: RULES,
    });
    expect(amount).toBe(5000);
  });

  it("日帰り片道 99km は日当なし（0円）", () => {
    const amount = calculatePerDiem({
      isDayTrip: true,
      rankKind: "STAFF",
      days: 1,
      oneWayKm: 99,
      rules: RULES,
    });
    expect(amount).toBe(0);
  });

  it("日帰り片道 100km（境界値）は 1,000円", () => {
    const amount = calculatePerDiem({
      isDayTrip: true,
      rankKind: "STAFF",
      days: 1,
      oneWayKm: 100,
      rules: RULES,
    });
    expect(amount).toBe(1000);
  });

  it("日帰り片道 150km（管理職でも同じ）は 1,000円", () => {
    const amount = calculatePerDiem({
      isDayTrip: true,
      rankKind: "MANAGEMENT",
      days: 1,
      oneWayKm: 150,
      rules: RULES,
    });
    expect(amount).toBe(1000);
  });

  it("日数が 0 以下は 0円", () => {
    const amount = calculatePerDiem({
      isDayTrip: false,
      rankKind: "STAFF",
      days: 0,
      rules: RULES,
    });
    expect(amount).toBe(0);
  });
});
