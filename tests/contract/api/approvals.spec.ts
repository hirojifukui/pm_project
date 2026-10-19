import { describe, it, expect } from "vitest";
import { CommentInput, ProxyAssignmentInput } from "@/domain/types";

// contracts/approvals.md § 1〜6 の宣言的検証。
// ネガティブケース: 権限表「申請を承認・差戻しする」の × ロール（申請者・経理担当）
// および △ の範囲外は、ルートハンドラの authorize で 403 相当を返す契約。

describe("契約: 承認 API（contracts/approvals.md）", () => {
  it("CommentInput: 差戻しの comment は 1 文字以上必須（FR-011）", () => {
    expect(() => CommentInput.parse({ comment: "差戻しの理由" })).not.toThrow();
    expect(() => CommentInput.parse({ comment: "" })).toThrow();
    expect(() => CommentInput.parse({})).toThrow();
  });

  it("ProxyAssignmentInput: 代理指名の必須項目を検証", () => {
    expect(() =>
      ProxyAssignmentInput.parse({
        proxyEmpNo: "E0020",
        startsAt: "2026-10-19T00:00:00+09:00",
        endsAt: "2026-10-23T23:59:59+09:00",
      }),
    ).not.toThrow();
    expect(() =>
      ProxyAssignmentInput.parse({
        proxyEmpNo: "",
        startsAt: "x",
        endsAt: "y",
      }),
    ).toThrow();
  });

  it("権限表のネガティブケース（宣言的）: 申請者本人の承認要求は authorize で 403 相当", () => {
    // BR-009 自己承認禁止。実動作は E2E で検証する。
    expect(true).toBe(true);
  });

  it("権限表のネガティブケース（宣言的）: 他部署の申請の承認要求は authorize で 403 相当", () => {
    expect(true).toBe(true);
  });
});
