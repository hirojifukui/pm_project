// BR-008: 申請合計が 100,000円を超える場合は、所属長の承認に加えて部長の承認を得る。

export type DirectorApprovalInput = {
  totalAmountYen: number;
  threshold: number;
};

export function requiresDirectorApproval(input: DirectorApprovalInput): boolean {
  return input.totalAmountYen > input.threshold;
}
