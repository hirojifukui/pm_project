import { describe, it, expect } from "vitest";
import { cutoffPaymentDate } from "@/domain/rules/BR-011.payment-cycle";

// BR-011: 毎月 25 日の締め日（休日なら前営業日）、翌月 10 日に給与口座へ振り込む。

const CAL_2026: ReadonlySet<string> = new Set([
  "2026-10-12",
  "2026-11-03",
  "2026-11-23",
]);

describe("BR-011 cutoffPaymentDate", () => {
  it("25 日が平日なら、そのまま締め日。支払予定日は翌月 10 日", () => {
    // 2026-11-25 は水曜日（平日）
    const r = cutoffPaymentDate("2026-11-25", CAL_2026);
    expect(r.effectiveCutoff).toBe("2026-11-25");
    expect(r.paymentDate).toBe("2026-12-10");
  });

  it("25 日が土曜なら、前営業日の金曜に繰り上げ", () => {
    // 2026-04-25 は土曜日
    const r = cutoffPaymentDate("2026-04-25", CAL_2026);
    expect(r.effectiveCutoff).toBe("2026-04-24"); // 金曜
    expect(r.paymentDate).toBe("2026-05-10");
  });

  it("25 日が日曜なら、前営業日の金曜に繰り上げ", () => {
    // 2026-10-25 は日曜
    const r = cutoffPaymentDate("2026-10-25", CAL_2026);
    expect(r.effectiveCutoff).toBe("2026-10-23"); // 金曜
    expect(r.paymentDate).toBe("2026-11-10");
  });

  it("25 日が祝日なら、前営業日に繰り上げ", () => {
    // 2026-11-23 は勤労感謝の日（祝日）だが、25 日ではない。
    // 2026-11-25 は水曜なので祝日判定は影響しない。別の仮想祝日で検証。
    const altCal = new Set([...CAL_2026, "2026-11-25"]);
    const r = cutoffPaymentDate("2026-11-25", altCal);
    expect(r.effectiveCutoff).toBe("2026-11-24"); // 火曜
  });
});
