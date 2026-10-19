// 規程値（RuleValue）の有効値解決。
// 申請の対象日時点で有効な値を返す（FR-021 連動）。

import { prisma } from "@/server/db/client";
import type { RuleKey } from "@/domain/types";

async function latestFor(
  key: RuleKey,
  atDate: Date,
): Promise<string | null> {
  const row = await prisma.ruleValue.findFirst({
    where: {
      ruleKey: key,
      effectiveFrom: { lte: atDate },
    },
    orderBy: { effectiveFrom: "desc" },
    select: { value: true },
  });
  return row?.value ?? null;
}

export async function resolveRuleValue(
  key: RuleKey,
  atDate: Date,
): Promise<string | null> {
  return latestFor(key, atDate);
}

export async function resolveRuleNumber(
  key: RuleKey,
  atDate: Date,
): Promise<number | null> {
  const v = await latestFor(key, atDate);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function resolveRuleBoolean(
  key: RuleKey,
  atDate: Date,
): Promise<boolean | null> {
  const v = await latestFor(key, atDate);
  if (v === null) return null;
  return v === "true";
}

export async function resolveRuleStringArray(
  key: RuleKey,
  atDate: Date,
): Promise<string[] | null> {
  const v = await latestFor(key, atDate);
  if (v === null) return null;
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
    return null;
  } catch {
    return null;
  }
}

export type ApplicationRuleSnapshot = {
  staffLodgingDaily: number;
  managementLodgingDaily: number;
  dayTripFlat: number;
  lodgingCapStandard: number;
  lodgingCapMetro: number;
  metroPrefectureCodes: string[];
  receiptRequiredThreshold: number;
  deadlineDays: number;
  directorApprovalThreshold: number;
  limitedExpressReceiptWaived: boolean;
  minKmForLimitedExpress: number;
};

export async function loadRuleSnapshot(
  atDate: Date,
): Promise<ApplicationRuleSnapshot> {
  const [
    staff,
    mgmt,
    dayTrip,
    capStd,
    capMetro,
    metroCodes,
    threshold,
    deadline,
    directorThreshold,
    limitedExpressWaived,
    minKm,
  ] = await Promise.all([
    resolveRuleNumber("PER_DIEM_STAFF_LODGING", atDate),
    resolveRuleNumber("PER_DIEM_MANAGEMENT_LODGING", atDate),
    resolveRuleNumber("PER_DIEM_DAY_TRIP", atDate),
    resolveRuleNumber("LODGING_CAP_STANDARD", atDate),
    resolveRuleNumber("LODGING_CAP_METRO", atDate),
    resolveRuleStringArray("METRO_PREFECTURE_CODES", atDate),
    resolveRuleNumber("RECEIPT_REQUIRED_THRESHOLD", atDate),
    resolveRuleNumber("DEADLINE_DAYS", atDate),
    resolveRuleNumber("DIRECTOR_APPROVAL_THRESHOLD", atDate),
    resolveRuleBoolean("TRAIN_LIMITED_EXPRESS_RECEIPT_WAIVED", atDate),
    resolveRuleNumber("ECONOMICAL_LIMITED_EXPRESS_MIN_KM", atDate),
  ]);
  return {
    staffLodgingDaily: staff ?? 2000,
    managementLodgingDaily: mgmt ?? 2500,
    dayTripFlat: dayTrip ?? 1000,
    lodgingCapStandard: capStd ?? 10000,
    lodgingCapMetro: capMetro ?? 12000,
    metroPrefectureCodes: metroCodes ?? [],
    receiptRequiredThreshold: threshold ?? 3000,
    deadlineDays: deadline ?? 30,
    directorApprovalThreshold: directorThreshold ?? 100000,
    limitedExpressReceiptWaived: limitedExpressWaived ?? true,
    minKmForLimitedExpress: minKm ?? 100,
  };
}
