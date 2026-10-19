import { describe, it, expect } from "vitest";
import { findOverlappingTrip } from "@/domain/rules/BR-010.no-overlap";

// BR-010: 同一申請者について、出張期間が重なる既存申請（下書き・取下げを除く）が
// ある場合は提出を認めない。

const yen = (n: number) => n; // ダミー

const BASE_EXISTING = [
  {
    applicationNumber: "JP-2026-000001",
    tripStartDate: new Date("2026-10-01T00:00:00+09:00"),
    tripEndDate: new Date("2026-10-05T00:00:00+09:00"),
    status: "SECTION_MANAGER_APPROVAL",
  },
  {
    applicationNumber: "JP-2026-000002",
    tripStartDate: new Date("2026-10-10T00:00:00+09:00"),
    tripEndDate: new Date("2026-10-12T00:00:00+09:00"),
    status: "ACCOUNTING_FINALIZED",
  },
];

describe("BR-010 findOverlappingTrip", () => {
  it("期間が完全に重なる場合は重複として検出", () => {
    const result = findOverlappingTrip(
      {
        start: new Date("2026-10-02T00:00:00+09:00"),
        end: new Date("2026-10-04T00:00:00+09:00"),
      },
      BASE_EXISTING,
    );
    expect(result?.applicationNumber).toBe("JP-2026-000001");
  });

  it("境界日（終了日=既存の開始日）は重複として検出", () => {
    const result = findOverlappingTrip(
      {
        start: new Date("2026-09-29T00:00:00+09:00"),
        end: new Date("2026-10-01T00:00:00+09:00"),
      },
      BASE_EXISTING,
    );
    expect(result?.applicationNumber).toBe("JP-2026-000001");
  });

  it("既存の翌日以降（期間が重ならない）は重複ではない", () => {
    const result = findOverlappingTrip(
      {
        start: new Date("2026-10-06T00:00:00+09:00"),
        end: new Date("2026-10-09T00:00:00+09:00"),
      },
      BASE_EXISTING,
    );
    expect(result).toBeNull();
  });

  it("DRAFT 状態の既存申請とは重複判定しない", () => {
    const existing = [
      {
        applicationNumber: "JP-2026-000003",
        tripStartDate: new Date("2026-10-01T00:00:00+09:00"),
        tripEndDate: new Date("2026-10-05T00:00:00+09:00"),
        status: "DRAFT",
      },
    ];
    const result = findOverlappingTrip(
      {
        start: new Date("2026-10-02T00:00:00+09:00"),
        end: new Date("2026-10-04T00:00:00+09:00"),
      },
      existing,
    );
    expect(result).toBeNull();
  });

  it("WITHDRAWN 状態の既存申請とは重複判定しない", () => {
    const existing = [
      {
        applicationNumber: "JP-2026-000004",
        tripStartDate: new Date("2026-10-01T00:00:00+09:00"),
        tripEndDate: new Date("2026-10-05T00:00:00+09:00"),
        status: "WITHDRAWN",
      },
    ];
    const result = findOverlappingTrip(
      {
        start: new Date("2026-10-02T00:00:00+09:00"),
        end: new Date("2026-10-04T00:00:00+09:00"),
      },
      existing,
    );
    expect(result).toBeNull();
  });

  it("REMANDED や経理確定の重複は検出する", () => {
    const result = findOverlappingTrip(
      {
        start: new Date("2026-10-11T00:00:00+09:00"),
        end: new Date("2026-10-13T00:00:00+09:00"),
      },
      BASE_EXISTING,
    );
    expect(result?.applicationNumber).toBe("JP-2026-000002");
  });
});

// yen を未使用で残しておいて tsc の警告を回避
void yen;
