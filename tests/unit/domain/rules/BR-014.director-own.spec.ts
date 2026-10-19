import { describe, it, expect } from "vitest";
import { resolveInitialApprover } from "@/domain/rules/next-approver";
import type { Employee } from "@prisma/client";

// BR-014: 部長本人が申請者となる精算申請は、経理部長が承認する。
// R-14 の表題誤り（事前申請）は本仕様では「部長本人の精算申請」として扱う。

function mkDirector(): Employee {
  return {
    empNo: "E0020",
    name: "佐藤 次郎",
    email: "sato@example.invalid",
    department: "営業部",
    rankKind: "MANAGEMENT",
    role: "DIRECTOR",
    sectionManagerEmpNo: null,
    status: "ACTIVE",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("BR-014 部長本人申請", () => {
  it("申請者が DIRECTOR の場合、初期ステータスは ACCOUNTING_DIRECTOR_APPROVAL", () => {
    const result = resolveInitialApprover({
      applicant: mkDirector(),
      accountingDirectorEmpNo: "E0040",
      accountingDirectorSuperiorEmpNo: "E0050",
    });
    expect(result.nextApproverEmpNo).toBe("E0040");
    expect(result.nextStatus).toBe("ACCOUNTING_DIRECTOR_APPROVAL");
  });

  it("経理部長が未登録の場合、承認者を解決できない旨の reason を返す", () => {
    const result = resolveInitialApprover({
      applicant: mkDirector(),
      accountingDirectorEmpNo: null,
      accountingDirectorSuperiorEmpNo: "E0050",
    });
    expect(result.nextApproverEmpNo).toBeNull();
    expect(result.reason).toBeTruthy();
  });

  it("部長本人の承認対象には現れない（自己承認禁止）", () => {
    const director = mkDirector();
    const result = resolveInitialApprover({
      applicant: director,
      accountingDirectorEmpNo: "E0040",
      accountingDirectorSuperiorEmpNo: "E0050",
    });
    expect(result.nextApproverEmpNo).not.toBe(director.empNo);
  });
});
