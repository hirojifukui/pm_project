// BR-004: 交通手段は最も経済的な経路を使う（出典: R-04）。
// - 新幹線・特急は片道 100km 以上で利用可
// - グリーン車は役職を問わず不可

import type { TransportMode } from "@/domain/types";

export type EconomicalRouteInput = {
  transportMode: TransportMode;
  oneWayKm?: number;
  isGreenCar: boolean;
  minKmForLimitedExpress: number;
};

export type EconomicalRouteResult = {
  ok: boolean;
  reason?: string;
};

export function checkEconomicalRoute(
  input: EconomicalRouteInput,
): EconomicalRouteResult {
  if (input.isGreenCar) {
    return {
      ok: false,
      reason: "グリーン車は役職を問わず利用できません。",
    };
  }
  if (input.transportMode === "SHINKANSEN") {
    const km = input.oneWayKm ?? 0;
    if (km < input.minKmForLimitedExpress) {
      return {
        ok: false,
        reason: `新幹線・特急は片道 ${input.minKmForLimitedExpress}km 以上で利用できます。`,
      };
    }
  }
  return { ok: true };
}
