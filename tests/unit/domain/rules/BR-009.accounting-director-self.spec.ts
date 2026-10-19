import { describe, it, expect } from "vitest";
import { resolveInitialApprover } from "@/domain/rules/next-approver";
import type { Employee } from "@prisma/client";

// BR-009（経理部長本人申請）: 経理部長本人の精算は、経理部長の上位者（例: 担当役員）が
// 承認・経理確定する。

function mkAccountingDirector(): Employee {
  return {
    empNo: "E0040",
    name: "田中 四郎",
    email: "tanaka@example.invalid",
    department: "経理部",
    rankKind: "MANAGEMENT",
    role: "ACCOUNTING_DIRECTOR",
    sectionManagerEmpNo: "E0050",
    status: "ACTIVE",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("BR-009 経理部長本人申請", () => {
  it("申請者が ACCOUNTING_DIRECTOR の場合、初期ステータスは ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL", () => {
    const result = resolveInitialApprover({
      applicant: mkAccountingDirector(),
      accountingDirectorEmpNo: "E0040",
      accountingDirectorSuperiorEmpNo: "E0050",
    });
    expect(result.nextApproverEmpNo).toBe("E0050");
    expect(result.nextStatus).toBe("ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL");
  });

  it("上位者が未登録の場合、承認者を解決できない旨の reason を返す（spec.md エッジケース）", () => {
    const result = resolveInitialApprover({
      applicant: mkAccountingDirector(),
      accountingDirectorEmpNo: "E0040",
      accountingDirectorSuperiorEmpNo: null,
    });
    expect(result.nextApproverEmpNo).toBeNull();
    expect(result.reason).toBeTruthy();
  });

  it("経理部長本人の承認対象には現れない（自己承認禁止）", () => {
    const ad = mkAccountingDirector();
    const result = resolveInitialApprover({
      applicant: ad,
      accountingDirectorEmpNo: "E0040",
      accountingDirectorSuperiorEmpNo: "E0050",
    });
    expect(result.nextApproverEmpNo).not.toBe(ad.empNo);
  });
});
