// BR-006: 領収書要否（出典: R-06）。
// - 宿泊費・タクシーは金額にかかわらず必須
// - 1 件 3,000円以上の支出は必須
// - 電車・バス・新幹線・特急の運賃は不要（Q-06 の確定、既定で TRAIN_LIMITED_EXPRESS_RECEIPT_WAIVED=true）

import type { ExpenseCategory, TransportMode } from "@/domain/types";

export type ReceiptRuleConfig = {
  threshold: number;
  limitedExpressWaived: boolean;
};

export type ReceiptCandidateLine = {
  category: ExpenseCategory;
  transportMode?: TransportMode | null | undefined;
  amountYen: number;
};

export function isReceiptRequired(
  line: ReceiptCandidateLine,
  cfg: ReceiptRuleConfig,
): boolean {
  // 日当は常に不要
  if (line.category === "PER_DIEM") return false;

  // 宿泊費は常に必須
  if (line.category === "LODGING") return true;

  // 交通費は交通手段により分岐
  if (line.category === "TRANSPORT") {
    const mode = line.transportMode;
    if (mode === "TAXI") return true;
    if (mode === "TRAIN" || mode === "BUS") return false;
    if (mode === "SHINKANSEN") {
      if (cfg.limitedExpressWaived) return false;
      // 既定の金額判定にフォールスルー
    }
  }

  // 残り（OTHER、SHINKANSEN で waiver=false、FLIGHT 等）は金額閾値で判定
  return line.amountYen >= cfg.threshold;
}
