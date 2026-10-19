// BR-010: 同一申請者について、出張期間が重なる既存申請（DRAFT・WITHDRAWN を除く）が
// ある場合は提出を認めない（出典: R-10、2026-10-19 の改訂で正式ルール化）。

export type TripRange = {
  start: Date;
  end: Date;
};

export type ExistingApplication = {
  applicationNumber: string;
  tripStartDate: Date;
  tripEndDate: Date;
  status: string;
};

const EXCLUDED_STATUSES = new Set<string>(["DRAFT", "WITHDRAWN"]);

function overlaps(a: TripRange, b: TripRange): boolean {
  // 境界包含: a.start <= b.end かつ b.start <= a.end で重なりありとする。
  return (
    a.start.getTime() <= b.end.getTime() &&
    b.start.getTime() <= a.end.getTime()
  );
}

export function findOverlappingTrip(
  newTrip: TripRange,
  existing: readonly ExistingApplication[],
): ExistingApplication | null {
  for (const app of existing) {
    if (EXCLUDED_STATUSES.has(app.status)) continue;
    if (
      overlaps(newTrip, {
        start: app.tripStartDate,
        end: app.tripEndDate,
      })
    ) {
      return app;
    }
  }
  return null;
}
