import { describe, it, expect } from "vitest";
import { requiresDirectorApproval } from "@/domain/rules/BR-008.director-approval";

// BR-008: 申請合計が 100,000円を超える場合は、所属長の承認に加えて部長の承認を得る。

describe("BR-008 requiresDirectorApproval", () => {
  it("100,000円ちょうどは部長承認不要（境界値）", () => {
    expect(
      requiresDirectorApproval({ totalAmountYen: 100000, threshold: 100000 }),
    ).toBe(false);
  });

  it("100,001円は部長承認必要", () => {
    expect(
      requiresDirectorApproval({ totalAmountYen: 100001, threshold: 100000 }),
    ).toBe(true);
  });

  it("0円は部長承認不要", () => {
    expect(
      requiresDirectorApproval({ totalAmountYen: 0, threshold: 100000 }),
    ).toBe(false);
  });

  it("規程値の閾値を上書きできる", () => {
    expect(
      requiresDirectorApproval({ totalAmountYen: 50001, threshold: 50000 }),
    ).toBe(true);
  });
});
