// EX-006: 申請期限（出張終了日の翌日から 30 日）を過ぎた場合、申請者は遅延理由を記入し、
// 所属長の承認に加えて部長の承認も得る。
// 本モジュールは「期限超過か否か」を判定する純粋関数のみを提供する。
// 遅延理由の必須チェックは submit route handler、部長承認への分岐は next-approver。

import { isWithinDeadline } from "./BR-001.deadline";

export function isDeadlineExceeded(
  submittedAt: Date,
  tripEndDate: Date,
  deadlineDays: number,
): boolean {
  return !isWithinDeadline(submittedAt, tripEndDate, deadlineDays);
}
