// BR-009（所属長本人申請）: 申請者本人が所属長の場合、承認者は部長で、
// 初期ステータスは DIRECTOR_APPROVAL になる（所属長本人の承認対象には現れない）。

import type { EmployeeRole } from "@/domain/types";

export function isSectionManagerSelf(applicantRole: EmployeeRole): boolean {
  return applicantRole === "SECTION_MANAGER";
}

/**
 * 自己承認禁止の最終ガード: 承認者（operator）と申請者（applicant）が同一の場合は不許可。
 * 本関数は `authorize.ts` の APPROVE_OR_REMAND の内側で既にチェックされているが、
 * ドメイン層でも別途テスト可能にするために定義する。
 */
export function isSelfApproval(
  operatorEmpNo: string,
  applicantEmpNo: string,
): boolean {
  return operatorEmpNo === applicantEmpNo;
}
