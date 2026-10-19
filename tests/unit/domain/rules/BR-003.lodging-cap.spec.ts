import { describe, it, expect } from "vitest";
import { isLodgingOverCap } from "@/domain/rules/BR-003.lodging-cap";

// BR-003: 宿泊費は 1 泊 10,000円まで、東京23区・大阪市は 12,000円。
// 上限超過時は exceedsLodgingCapReason が必須（検査自体はスキーマ側で、
// 本ルールは「超過しているか」を判定する）。

describe("BR-003 isLodgingOverCap", () => {
  const CAPS = { standard: 10000, metro: 12000 };

  it("標準地域 10,000円ちょうどは上限内", () => {
    expect(isLodgingOverCap(10000, false, CAPS)).toBe(false);
  });

  it("標準地域 10,001円は上限超過", () => {
    expect(isLodgingOverCap(10001, false, CAPS)).toBe(true);
  });

  it("23区・大阪市 12,000円ちょうどは上限内", () => {
    expect(isLodgingOverCap(12000, true, CAPS)).toBe(false);
  });

  it("23区・大阪市 12,001円は上限超過", () => {
    expect(isLodgingOverCap(12001, true, CAPS)).toBe(true);
  });

  it("0円（宿泊なし等）は上限超過ではない", () => {
    expect(isLodgingOverCap(0, false, CAPS)).toBe(false);
  });
});
