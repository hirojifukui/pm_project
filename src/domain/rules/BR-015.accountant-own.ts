// BR-015: 経理担当本人が申請者となる精算申請は、経理部長が経理確定する。
// BR-009 と連動して、経理確定の実行可否を判定する純粋関数を提供する。

import type { EmployeeRole } from "@/domain/types";

export type CanFinalizeInput = {
  userRole: EmployeeRole;
  userEmpNo: string;
  applicantRole: EmployeeRole;
  applicantEmpNo: string;
};

/**
 * 経理確定（accounting_finalize）の実行可否。
 * - BR-009: 申請者本人は不可
 * - BR-015: 申請者が ACCOUNTANT の場合、経理担当では不可（経理部長が行う）
 * - BR-009 variant: 申請者が ACCOUNTING_DIRECTOR の場合、経理部長・経理担当では不可（上位者が行う）
 * - それ以外: ACCOUNTANT 以上であれば可
 */
export function canFinalize(input: CanFinalizeInput): boolean {
  // BR-009 自己承認禁止
  if (input.userEmpNo === input.applicantEmpNo) return false;

  if (input.applicantRole === "ACCOUNTANT") {
    // BR-015: 経理部長 または 上位者 のみ可
    return (
      input.userRole === "ACCOUNTING_DIRECTOR" ||
      input.userRole === "ACCOUNTING_DIRECTOR_SUPERIOR"
    );
  }
  if (input.applicantRole === "ACCOUNTING_DIRECTOR") {
    // 上位者のみ可
    return input.userRole === "ACCOUNTING_DIRECTOR_SUPERIOR";
  }
  if (input.applicantRole === "ACCOUNTING_DIRECTOR_SUPERIOR") {
    // 本機能ではオフライン運用（spec.md 前提）
    return false;
  }

  // それ以外（APPLICANT／SECTION_MANAGER／DIRECTOR／SYSTEM_ADMIN）: 経理担当以上
  return (
    input.userRole === "ACCOUNTANT" ||
    input.userRole === "ACCOUNTING_DIRECTOR" ||
    input.userRole === "ACCOUNTING_DIRECTOR_SUPERIOR"
  );
}
