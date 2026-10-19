import { describe, it, expect } from "vitest";
import { resolveInitialApprover } from "@/domain/rules/next-approver";
import type { Employee } from "@prisma/client";

// BR-007: すべての申請は所属長が承認する（出典: R-07）
// resolveInitialApprover が「申請者の直属所属長」を返すことを確認する。

function mkApplicant(overrides: Partial<Employee> = {}): Employee {
  return {
    empNo: "E0001",
    name: "山田 太郎",
    email: "yamada@example.invalid",
    department: "営業部",
    rankKind: "STAFF",
    role: "APPLICANT",
    sectionManagerEmpNo: "E0010",
    status: "ACTIVE",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("BR-007 すべての申請は所属長が承認する", () => {
  it("APPLICANT ロールの初期承認者は直属所属長で、状態は SECTION_MANAGER_APPROVAL", () => {
    const result = resolveInitialApprover({ applicant: mkApplicant() });
    expect(result.nextApproverEmpNo).toBe("E0010");
    expect(result.nextStatus).toBe("SECTION_MANAGER_APPROVAL");
  });

  it("直属所属長が未設定（null）の場合は、承認者を解決できない旨の reason を返す", () => {
    const result = resolveInitialApprover({
      applicant: mkApplicant({ sectionManagerEmpNo: null }),
    });
    expect(result.nextApproverEmpNo).toBeNull();
    expect(result.reason).toBeTruthy();
  });
});
