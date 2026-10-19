// BR-005: タクシーは原則使わない（出典: R-05、Q-04 の確定）。
// 例外として:
// (a) 移動が 22:00 以降である
// (b) 携行荷物が合計 15kg 以上である
// (c) 顧客と同じ車に同乗する必要がある
// のいずれかに該当する場合に、申請者が該当事由を選択・記入すれば認める。

import type { TaxiReason } from "@/domain/types";

export function hasValidTaxiReason(
  taxiReasons: readonly TaxiReason[] | undefined,
): boolean {
  if (!taxiReasons) return false;
  return taxiReasons.length > 0;
}

export function serializeTaxiReasons(
  taxiReasons: readonly TaxiReason[] | undefined,
): string | null {
  if (!taxiReasons || taxiReasons.length === 0) return null;
  return taxiReasons.join(",");
}

export function parseTaxiReasons(
  stored: string | null,
): TaxiReason[] {
  if (!stored) return [];
  return stored
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is TaxiReason =>
      s === "AFTER_22" || s === "HEAVY_LUGGAGE" || s === "CUSTOMER_RIDE",
    );
}
