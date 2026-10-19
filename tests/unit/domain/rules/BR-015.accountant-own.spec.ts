import { describe, it, expect } from "vitest";
import { canFinalize } from "@/domain/rules/BR-015.accountant-own";

// BR-015: 経理担当本人が申請者となる精算申請は、経理部長が経理確定する。
// 一般には:
// - 申請者本人は自分の精算を経理確定できない（BR-009）
// - 申請者が ACCOUNTANT の場合は、経理担当では経理確定できず、経理部長が行う
// - 申請者が ACCOUNTING_DIRECTOR の場合は、経理担当・経理部長では経理確定できず、
//   経理部長の上位者が行う
// - それ以外は、通常の経理担当が経理確定できる

describe("BR-015 canFinalize（経理確定の実行可否）", () => {
  it("申請者本人による経理確定は不可（BR-009）", () => {
    expect(
      canFinalize({
        userRole: "ACCOUNTANT",
        userEmpNo: "E0030",
        applicantRole: "ACCOUNTANT",
        applicantEmpNo: "E0030",
      }),
    ).toBe(false);
  });

  it("経理担当本人の精算は、別の経理担当では不可（BR-015）", () => {
    expect(
      canFinalize({
        userRole: "ACCOUNTANT",
        userEmpNo: "E0031",
        applicantRole: "ACCOUNTANT",
        applicantEmpNo: "E0030",
      }),
    ).toBe(false);
  });

  it("経理担当本人の精算は、経理部長が経理確定できる", () => {
    expect(
      canFinalize({
        userRole: "ACCOUNTING_DIRECTOR",
        userEmpNo: "E0040",
        applicantRole: "ACCOUNTANT",
        applicantEmpNo: "E0030",
      }),
    ).toBe(true);
  });

  it("経理部長本人の精算は、経理担当・経理部長では不可", () => {
    expect(
      canFinalize({
        userRole: "ACCOUNTANT",
        userEmpNo: "E0030",
        applicantRole: "ACCOUNTING_DIRECTOR",
        applicantEmpNo: "E0040",
      }),
    ).toBe(false);
    expect(
      canFinalize({
        userRole: "ACCOUNTING_DIRECTOR",
        userEmpNo: "E0040",
        applicantRole: "ACCOUNTING_DIRECTOR",
        applicantEmpNo: "E0040",
      }),
    ).toBe(false);
  });

  it("経理部長本人の精算は、上位者が経理確定できる", () => {
    expect(
      canFinalize({
        userRole: "ACCOUNTING_DIRECTOR_SUPERIOR",
        userEmpNo: "E0050",
        applicantRole: "ACCOUNTING_DIRECTOR",
        applicantEmpNo: "E0040",
      }),
    ).toBe(true);
  });

  it("通常の申請者（APPLICANT）の精算は、経理担当が経理確定できる", () => {
    expect(
      canFinalize({
        userRole: "ACCOUNTANT",
        userEmpNo: "E0030",
        applicantRole: "APPLICANT",
        applicantEmpNo: "E0001",
      }),
    ).toBe(true);
  });

  it("申請者ロールが所属長・部長の精算は、経理担当が経理確定できる", () => {
    expect(
      canFinalize({
        userRole: "ACCOUNTANT",
        userEmpNo: "E0030",
        applicantRole: "SECTION_MANAGER",
        applicantEmpNo: "E0010",
      }),
    ).toBe(true);
    expect(
      canFinalize({
        userRole: "ACCOUNTANT",
        userEmpNo: "E0030",
        applicantRole: "DIRECTOR",
        applicantEmpNo: "E0020",
      }),
    ).toBe(true);
  });
});
