import { describe, it, expect } from "vitest";
import { isReceiptRequired } from "@/domain/rules/BR-006.receipts";

// BR-006:
// - 1 件 3,000円 以上の支出は領収書必須
// - 宿泊費・タクシーは金額にかかわらず必須
// - 電車・バス・新幹線・特急の運賃は不要（Q-06 の確定）

const CFG = { threshold: 3000, limitedExpressWaived: true };

describe("BR-006 isReceiptRequired", () => {
  it("宿泊費は金額にかかわらず必須", () => {
    expect(
      isReceiptRequired(
        { category: "LODGING", amountYen: 1000 },
        CFG,
      ),
    ).toBe(true);
    expect(
      isReceiptRequired(
        { category: "LODGING", amountYen: 50000 },
        CFG,
      ),
    ).toBe(true);
  });

  it("タクシーは金額にかかわらず必須", () => {
    expect(
      isReceiptRequired(
        { category: "TRANSPORT", transportMode: "TAXI", amountYen: 500 },
        CFG,
      ),
    ).toBe(true);
  });

  it("電車の運賃は不要", () => {
    expect(
      isReceiptRequired(
        { category: "TRANSPORT", transportMode: "TRAIN", amountYen: 300 },
        CFG,
      ),
    ).toBe(false);
  });

  it("バスの運賃は不要", () => {
    expect(
      isReceiptRequired(
        { category: "TRANSPORT", transportMode: "BUS", amountYen: 500 },
        CFG,
      ),
    ).toBe(false);
  });

  it("新幹線・特急の運賃は不要（3,000円を超えても）", () => {
    expect(
      isReceiptRequired(
        { category: "TRANSPORT", transportMode: "SHINKANSEN", amountYen: 15000 },
        CFG,
      ),
    ).toBe(false);
  });

  it("その他 3,000円ちょうど（境界）は必須", () => {
    expect(
      isReceiptRequired({ category: "OTHER", amountYen: 3000 }, CFG),
    ).toBe(true);
  });

  it("その他 2,999円は不要", () => {
    expect(
      isReceiptRequired({ category: "OTHER", amountYen: 2999 }, CFG),
    ).toBe(false);
  });

  it("日当（PER_DIEM）は領収書不要", () => {
    expect(
      isReceiptRequired(
        { category: "PER_DIEM", amountYen: 5000 },
        CFG,
      ),
    ).toBe(false);
  });

  it("TRAIN_LIMITED_EXPRESS_RECEIPT_WAIVED が false のとき、新幹線・特急も通常ルールに従う", () => {
    expect(
      isReceiptRequired(
        { category: "TRANSPORT", transportMode: "SHINKANSEN", amountYen: 15000 },
        { threshold: 3000, limitedExpressWaived: false },
      ),
    ).toBe(true);
  });
});
