// BR-003: 宿泊費上限（出典: R-03）。
// 標準 1 泊 10,000円、東京23区・大阪市は 12,000円。
// 上限超過時は申請者が理由を記入し、所属長が認めれば超過分も支給。

export type LodgingCaps = {
  standard: number;
  metro: number;
};

export function isLodgingOverCap(
  lodgingAmountYen: number,
  isMetro: boolean,
  caps: LodgingCaps,
): boolean {
  const cap = isMetro ? caps.metro : caps.standard;
  return lodgingAmountYen > cap;
}
