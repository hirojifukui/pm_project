// BR-014: 部長本人が申請者となる精算申請は、経理部長が承認する。
// 判定ユーティリティ。経路の実際の分岐は `next-approver.ts` の
// `resolveInitialApprover` に実装する。

import type { EmployeeRole } from "@/domain/types";

export function isDirectorSelf(applicantRole: EmployeeRole): boolean {
  return applicantRole === "DIRECTOR";
}
