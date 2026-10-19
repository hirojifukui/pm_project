// BR-007: すべての申請は所属長が承認する（出典: R-07）。
// 本ルールは `resolveInitialApprover` が「初期承認者 = 直属所属長」を返すことで
// 実現する（APPLICANT ロールの場合）。独立した判定関数は `isSectionManagerApprovalRequired`
// として、SECTION_MANAGER_APPROVAL ステータスを辿る必要があるかの純粋判定を提供する。

import type { EmployeeRole } from "@/domain/types";

export function isSectionManagerApprovalRequired(
  applicantRole: EmployeeRole,
): boolean {
  // 所属長本人の申請（SECTION_MANAGER）は BR-009 により部長から直接承認を得る。
  // それ以外のロールは所属長の承認を経る（部長本人・経理担当本人・経理部長本人も
  // 所属長を経由した後、BR-008／BR-009 で経路分岐する）。
  return applicantRole !== "SECTION_MANAGER";
}
