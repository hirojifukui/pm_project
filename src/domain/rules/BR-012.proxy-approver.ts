// BR-012: 所属長は 3 営業日以上の不在期間に代理承認者（部長）を指名できる。
// 代理期間中は、本人宛ての承認対象を代理に振り替える。

import { hasAtLeastBusinessDays } from "@/domain/workdays";
import type { HolidayCalendar } from "@/domain/holidays";
import type { ActedAs } from "@/domain/types";

const MIN_BUSINESS_DAYS = 3;

export type ProxyAssignmentForCheck = {
  startsAt: Date;
  endsAt: Date;
};

export type ValidateProxyInput = {
  startsAt: Date;
  endsAt: Date;
  calendar: HolidayCalendar;
  existing: readonly ProxyAssignmentForCheck[];
};

export type ValidateProxyResult = {
  ok: boolean;
  reason?: string;
};

export function validateProxyAssignmentPeriod(
  input: ValidateProxyInput,
): ValidateProxyResult {
  if (input.endsAt.getTime() < input.startsAt.getTime()) {
    return {
      ok: false,
      reason: "終了日時は開始日時と同じかそれより後を指定してください。",
    };
  }
  const meetsDays = hasAtLeastBusinessDays(
    input.startsAt,
    input.endsAt,
    MIN_BUSINESS_DAYS,
    input.calendar,
  );
  if (!meetsDays) {
    return {
      ok: false,
      reason: `代理承認指名は ${MIN_BUSINESS_DAYS} 営業日以上の期間が必要です。`,
    };
  }
  // 重複判定: 既存期間と交差があれば NG
  for (const e of input.existing) {
    if (
      input.startsAt.getTime() <= e.endsAt.getTime() &&
      e.startsAt.getTime() <= input.endsAt.getTime()
    ) {
      return {
        ok: false,
        reason: "既存の代理指名と期間が重なっています。",
      };
    }
  }
  return { ok: true };
}

export type ProxyAssignmentForResolve = {
  principalEmpNo: string;
  proxyEmpNo: string;
  startsAt: Date;
  endsAt: Date;
};

export type EffectiveApprover = {
  empNo: string;
  actedAs: ActedAs;
};

export function resolveEffectiveApprover(
  principalEmpNo: string,
  assignments: readonly ProxyAssignmentForResolve[],
  now: Date = new Date(),
): EffectiveApprover {
  const t = now.getTime();
  const match = assignments.find(
    (a) =>
      a.principalEmpNo === principalEmpNo &&
      a.startsAt.getTime() <= t &&
      t <= a.endsAt.getTime(),
  );
  if (match) {
    return { empNo: match.proxyEmpNo, actedAs: "PROXY" };
  }
  return { empNo: principalEmpNo, actedAs: "SELF" };
}
