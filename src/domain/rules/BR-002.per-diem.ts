// BR-002: 日当（出典: R-02）。
// - 宿泊: 一般 2,000円/日、管理職 2,500円/日
// - 日帰り: 片道 100km 以上の場合に限り 1,000円
// - 出発日と帰着日も 1 日として数える（days を呼び出し側で算定済みの前提）

import type { RankKind } from "@/domain/types";

export type PerDiemRules = {
  staffLodgingDaily: number;
  managementLodgingDaily: number;
  dayTripFlat: number;
};

export type CalculatePerDiemInput = {
  isDayTrip: boolean;
  rankKind: RankKind;
  days: number;
  oneWayKm?: number;
  rules: PerDiemRules;
};

const MIN_KM_DAY_TRIP = 100;

export function calculatePerDiem(input: CalculatePerDiemInput): number {
  if (input.days <= 0) return 0;
  if (input.isDayTrip) {
    const km = input.oneWayKm ?? 0;
    if (km < MIN_KM_DAY_TRIP) return 0;
    return input.rules.dayTripFlat;
  }
  const daily =
    input.rankKind === "MANAGEMENT"
      ? input.rules.managementLodgingDaily
      : input.rules.staffLodgingDaily;
  return daily * input.days;
}
