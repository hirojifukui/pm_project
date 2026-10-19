import { describe, it, expect } from "vitest";
import { resolveInitialApprover } from "@/domain/rules/next-approver";
import type { Employee } from "@prisma/client";

// BR-009（所属長本人申請）: 申請者本人が所属長の場合、承認者は部長で、
// 初期ステータスは DIRECTOR_APPROVAL になる（所属長本人の承認対象には現れない）。

function mkSectionManager(sectionManagerEmpNo: string | null = "E0020"): Employee {
  return {
    empNo: "E0010",
    name: "鈴木 花子",
    email: "suzuki@example.invalid",
    department: "営業部",
    rankKind: "MANAGEMENT",
    role: "SECTION_MANAGER",
    sectionManagerEmpNo,
    status: "ACTIVE",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("BR-009 所属長本人申請の自己承認禁止", () => {
  it("申請者が SECTION_MANAGER の場合、初期承認者は部長（applicant.sectionManagerEmpNo）", () => {
    const result = resolveInitialApprover({ applicant: mkSectionManager() });
    expect(result.nextApproverEmpNo).toBe("E0020");
    expect(result.nextStatus).toBe("DIRECTOR_APPROVAL");
  });

  it("所属長本人申請では、本人の承認対象にならない（nextApproverEmpNo が本人と一致しない）", () => {
    const sm = mkSectionManager();
    const result = resolveInitialApprover({ applicant: sm });
    expect(result.nextApproverEmpNo).not.toBe(sm.empNo);
  });

  it("部長が設定されていない場合は、承認者を解決できない旨の reason を返す", () => {
    const result = resolveInitialApprover({
      applicant: mkSectionManager(null),
    });
    expect(result.nextApproverEmpNo).toBeNull();
    expect(result.reason).toBeTruthy();
  });
});
