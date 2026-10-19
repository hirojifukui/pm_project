import { describe, it, expect } from "vitest";
import {
  validateProxyAssignmentPeriod,
  resolveEffectiveApprover,
  type ProxyAssignmentForCheck,
} from "@/domain/rules/BR-012.proxy-approver";

// BR-012: 所属長は 3 営業日以上の不在期間に代理承認者（部長）を指名できる。
// 代理期間中は、本人宛ての承認対象を代理に振り替える。

const CAL_2026: ReadonlySet<string> = new Set([
  "2026-01-01",
  "2026-04-29",
  "2026-05-03",
  "2026-10-12",
]);

describe("BR-012 validateProxyAssignmentPeriod（3 営業日以上必須、重複不可）", () => {
  it("月曜〜水曜（平日 3 日連続）は OK", () => {
    const r = validateProxyAssignmentPeriod({
      startsAt: new Date("2026-10-19T00:00:00+09:00"),
      endsAt: new Date("2026-10-21T23:59:59+09:00"),
      calendar: CAL_2026,
      existing: [],
    });
    expect(r.ok).toBe(true);
  });

  it("金〜日（営業日 1 日のみ）は 3 営業日未満で NG", () => {
    const r = validateProxyAssignmentPeriod({
      startsAt: new Date("2026-10-23T00:00:00+09:00"),
      endsAt: new Date("2026-10-25T23:59:59+09:00"),
      calendar: CAL_2026,
      existing: [],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("既存の有効期間と重複する場合は NG", () => {
    const existing: ProxyAssignmentForCheck[] = [
      {
        startsAt: new Date("2026-10-19T00:00:00+09:00"),
        endsAt: new Date("2026-10-23T23:59:59+09:00"),
      },
    ];
    const r = validateProxyAssignmentPeriod({
      startsAt: new Date("2026-10-21T00:00:00+09:00"),
      endsAt: new Date("2026-10-27T23:59:59+09:00"),
      calendar: CAL_2026,
      existing,
    });
    expect(r.ok).toBe(false);
  });

  it("終了日が開始日より前の場合は NG", () => {
    const r = validateProxyAssignmentPeriod({
      startsAt: new Date("2026-10-21T00:00:00+09:00"),
      endsAt: new Date("2026-10-20T00:00:00+09:00"),
      calendar: CAL_2026,
      existing: [],
    });
    expect(r.ok).toBe(false);
  });
});

describe("BR-012 resolveEffectiveApprover（代理期間中はプロキシへ振替）", () => {
  const PRINCIPAL = "E0010";
  const PROXY = "E0020";
  const assignments = [
    {
      principalEmpNo: PRINCIPAL,
      proxyEmpNo: PROXY,
      startsAt: new Date("2026-10-19T00:00:00+09:00"),
      endsAt: new Date("2026-10-23T23:59:59+09:00"),
    },
  ];

  it("代理期間内の時刻ではプロキシが有効承認者", () => {
    const effective = resolveEffectiveApprover(
      PRINCIPAL,
      assignments,
      new Date("2026-10-21T10:00:00+09:00"),
    );
    expect(effective.empNo).toBe(PROXY);
    expect(effective.actedAs).toBe("PROXY");
  });

  it("代理期間外では本人が承認者", () => {
    const effective = resolveEffectiveApprover(
      PRINCIPAL,
      assignments,
      new Date("2026-10-25T10:00:00+09:00"),
    );
    expect(effective.empNo).toBe(PRINCIPAL);
    expect(effective.actedAs).toBe("SELF");
  });

  it("対象プリンシパルの代理指名が無い場合は本人が承認者", () => {
    const effective = resolveEffectiveApprover(
      "E0030",
      assignments,
      new Date("2026-10-21T10:00:00+09:00"),
    );
    expect(effective.empNo).toBe("E0030");
    expect(effective.actedAs).toBe("SELF");
  });
});
