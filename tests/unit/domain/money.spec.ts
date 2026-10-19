import { describe, it, expect } from "vitest";
import { Amount, floorToYen, sumAmounts } from "@/domain/money";

describe("Amount 値オブジェクト（憲法 追加の制約・金額）", () => {
  it("円単位の整数のみ受け入れる", () => {
    expect(Amount.fromYen(0).toYen()).toBe(0);
    expect(Amount.fromYen(10000).toYen()).toBe(10000);
  });

  it("非整数は拒否する（浮動小数点に落とさない）", () => {
    expect(() => Amount.fromYen(100.5)).toThrow();
  });

  it("負値は拒否する", () => {
    expect(() => Amount.fromYen(-1)).toThrow();
  });

  it("非数値（NaN、Infinity）は拒否する", () => {
    expect(() => Amount.fromYen(Number.NaN)).toThrow();
    expect(() => Amount.fromYen(Number.POSITIVE_INFINITY)).toThrow();
  });

  it("加算は交換法則を満たす", () => {
    const a = Amount.fromYen(2000);
    const b = Amount.fromYen(3500);
    expect(a.add(b).toYen()).toBe(5500);
    expect(b.add(a).toYen()).toBe(5500);
  });

  it("減算の結果が負値になる場合は拒否する", () => {
    const a = Amount.fromYen(1000);
    const b = Amount.fromYen(2000);
    expect(() => a.subtract(b)).toThrow();
  });

  it("整数係数の乗算のみ許容する", () => {
    const d = Amount.fromYen(2000);
    expect(d.multiplyByInt(3).toYen()).toBe(6000);
    expect(() => d.multiplyByInt(1.5)).toThrow();
    expect(() => d.multiplyByInt(-1)).toThrow();
  });

  it("ゼロ金額どうしは等しい", () => {
    expect(Amount.zero().equals(Amount.fromYen(0))).toBe(true);
  });

  it("sumAmounts が複数金額を合計する", () => {
    const total = sumAmounts([
      Amount.fromYen(1000),
      Amount.fromYen(2500),
      Amount.fromYen(500),
    ]);
    expect(total.toYen()).toBe(4000);
  });
});

describe("floorToYen", () => {
  it("切り捨てで整数化する", () => {
    expect(floorToYen(100.9)).toBe(100);
    expect(floorToYen(100)).toBe(100);
  });

  it("非有限値を拒否する", () => {
    expect(() => floorToYen(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => floorToYen(Number.NaN)).toThrow();
  });
});
