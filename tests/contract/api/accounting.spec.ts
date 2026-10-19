import { describe, it, expect } from "vitest";
import { CsvExportInput, CommentInput } from "@/domain/types";
import { canFinalize } from "@/domain/rules/BR-015.accountant-own";

// contracts/accounting.md § 1〜7 の宣言的検証。
// ネガティブケース: 権限表「経理確定・差戻しする」「支払用 CSV を出力する」の
// 「×」ロールは authorize で 403 相当。「△」の範囲外は BR-015 で拒否。

describe("契約: 経理 API（contracts/accounting.md）", () => {
  it("CsvExportInput: cutoffDate は YYYY-MM-DD で任意、force は boolean 任意", () => {
    expect(() =>
      CsvExportInput.parse({ cutoffDate: "2026-11-25", force: false }),
    ).not.toThrow();
    expect(() => CsvExportInput.parse({})).not.toThrow();
    expect(() => CsvExportInput.parse({ cutoffDate: "2026/11/25" })).toThrow();
  });

  it("CommentInput: 経理差戻しや経理確定の取消で comment は必須", () => {
    expect(() => CommentInput.parse({ comment: "取消理由" })).not.toThrow();
    expect(() => CommentInput.parse({})).toThrow();
  });

  it("権限表のネガティブケース: 申請者・所属長・部長は経理確定できない", () => {
    const applicant = {
      applicantRole: "APPLICANT" as const,
      applicantEmpNo: "E0001",
      userEmpNo: "E0001",
    };
    expect(
      canFinalize({ ...applicant, userRole: "APPLICANT" }),
    ).toBe(false);
    expect(
      canFinalize({ ...applicant, userEmpNo: "E0010", userRole: "SECTION_MANAGER" }),
    ).toBe(false);
    expect(
      canFinalize({ ...applicant, userEmpNo: "E0020", userRole: "DIRECTOR" }),
    ).toBe(false);
  });

  it("権限表の △ 条件: 経理担当本人の精算を経理担当本人が経理確定することは不可", () => {
    expect(
      canFinalize({
        userRole: "ACCOUNTANT",
        userEmpNo: "E0030",
        applicantRole: "ACCOUNTANT",
        applicantEmpNo: "E0030",
      }),
    ).toBe(false);
  });
});
