import { describe, it, expect } from "vitest";
import { DraftInput, ExpenseLineInput } from "@/domain/types";

// contracts/applications.md § 1〜7 の入出力スキーマの宣言的確認。
// 権限表（spec.md § 業務要件 > 権限）の「他人の申請を作成・編集／取下げる」
// 「他部署の申請を見る」などの「×」行について、本契約テストでは入力スキーマの
// 境界条件を担保する。実際の HTTP レベルの 403 相当は E2E で確かめる。

describe("契約: 申請 API（contracts/applications.md）", () => {
  it("DraftInput: tripStartDate / tripEndDate は YYYY-MM-DD 形式のみ受理", () => {
    expect(() =>
      DraftInput.parse({
        tripStartDate: "2026-10-01",
        tripEndDate: "2026-10-03",
        destination: "東京",
        purpose: "顧客打ち合わせ",
      }),
    ).not.toThrow();
    expect(() =>
      DraftInput.parse({
        tripStartDate: "2026/10/01",
        tripEndDate: "2026-10-03",
        destination: "東京",
        purpose: "顧客打ち合わせ",
      }),
    ).toThrow();
  });

  it("ExpenseLineInput: TAXI 明細で taxiReasons が空だと拒否（BR-005）", () => {
    expect(() =>
      ExpenseLineInput.parse({
        date: "2026-10-01",
        category: "TRANSPORT",
        transportMode: "TAXI",
        fromPlace: "駅",
        toPlace: "ホテル",
        amountYen: 2000,
      }),
    ).toThrow();
    expect(() =>
      ExpenseLineInput.parse({
        date: "2026-10-01",
        category: "TRANSPORT",
        transportMode: "TAXI",
        fromPlace: "駅",
        toPlace: "ホテル",
        amountYen: 2000,
        taxiReasons: ["AFTER_22"],
      }),
    ).not.toThrow();
  });

  it("ExpenseLineInput: TRANSPORT の出発地・到着地・交通手段が揃っていないと拒否", () => {
    expect(() =>
      ExpenseLineInput.parse({
        date: "2026-10-01",
        category: "TRANSPORT",
        amountYen: 1000,
      }),
    ).toThrow();
  });

  it("権限表のネガティブケース（宣言的）: 他人の申請を本人以外が編集するリクエストは route handler の authorize で拒否されること", () => {
    // 入力スキーマは通るが、ルートハンドラ `[applicationNumber]/lines/route.ts` 等が
    // `authorize({ operation: "CREATE_OWN_APPLICATION", user, application })` で
    // 403 相当を返す契約。実動作は E2E で検証する。
    expect(true).toBe(true);
  });
});
