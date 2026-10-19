// BR-009（経理部長本人申請）: 経理部長本人の精算は、経理部長の上位者（例: 担当役員）が
// 承認・経理確定する。
// 判定ユーティリティ。経路の分岐は `next-approver.ts` の `resolveInitialApprover` に実装する。

import type { EmployeeRole } from "@/domain/types";

export function isAccountingDirectorSelf(
  applicantRole: EmployeeRole,
): boolean {
  return applicantRole === "ACCOUNTING_DIRECTOR";
}
