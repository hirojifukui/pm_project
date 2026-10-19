// BR-001: 申請は、出張終了日の翌日から 30 日以内に提出する（出典: R-01）。
// 期限最終日の 23:59 まで期限内、翌日は EX-006 経路。

export function isWithinDeadline(
  submittedAt: Date,
  tripEndDate: Date,
  deadlineDays: number,
): boolean {
  // 期限の最終時点 = 出張終了日の翌日から deadlineDays 日目の 23:59:59.999
  const deadline = new Date(tripEndDate.getTime());
  deadline.setDate(deadline.getDate() + deadlineDays);
  // 「翌日から」なので、tripEndDate + deadlineDays 日目の末尾まで。
  // tripEndDate が 10/01 なら、翌日 10/02 から数えて 30 日目は 10/31、その末尾まで許容。
  deadline.setHours(23, 59, 59, 999);
  return submittedAt.getTime() <= deadline.getTime();
}
