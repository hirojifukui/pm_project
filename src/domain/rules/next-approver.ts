// 次承認者の解決（BR-007 / BR-008 / BR-009 / BR-012 / BR-014 / EX-006 と連動）。
// 役割の分岐:
// - APPLICANT／ACCOUNTANT／SYSTEM_ADMIN: 初期 = 直属所属長（SECTION_MANAGER_APPROVAL）
// - SECTION_MANAGER（BR-009）: 初期 = 部長（DIRECTOR_APPROVAL）
// - DIRECTOR（BR-014）: 初期 = 経理部長（ACCOUNTING_DIRECTOR_APPROVAL）
// - ACCOUNTING_DIRECTOR（BR-009 variant）: 初期 = 経理部長の上位者（ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL）
// - ACCOUNTING_DIRECTOR_SUPERIOR: 本機能ではオフライン運用（spec.md エッジケース）
//
// 承認後の遷移:
// - SECTION_MANAGER_APPROVAL approve → BR-008/EX-006/BR-009 で DIRECTOR_APPROVAL か ACCOUNTING_REVIEW
// - DIRECTOR_APPROVAL approve → ACCOUNTING_REVIEW
// - ACCOUNTING_DIRECTOR_APPROVAL approve → ACCOUNTING_REVIEW
// - ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL approve → ACCOUNTING_REVIEW

import type { Employee } from "@prisma/client";
import type { ApplicationStatus, EmployeeRole } from "@/domain/types";

export type NextApproverContext = {
  applicant: Employee;
  // 経理部長の empNo（DB 検索で解決した結果）。
  accountingDirectorEmpNo?: string | null;
  // 経理部長の上位者の empNo（DB 検索で解決した結果）。
  accountingDirectorSuperiorEmpNo?: string | null;
};

export type NextApprovalStatus = Extract<
  ApplicationStatus,
  | "SECTION_MANAGER_APPROVAL"
  | "DIRECTOR_APPROVAL"
  | "ACCOUNTING_DIRECTOR_APPROVAL"
  | "ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL"
  | "ACCOUNTING_REVIEW"
>;

export type NextApproverResolution = {
  nextApproverEmpNo: string | null;
  nextStatus: NextApprovalStatus;
  reason?: string;
};

/**
 * 提出直後の初期承認者を返す。BR-007 / BR-009 / BR-014 を反映する。
 */
export function resolveInitialApprover(
  ctx: NextApproverContext,
): NextApproverResolution {
  const { applicant } = ctx;
  const role = applicant.role as EmployeeRole;

  if (role === "SECTION_MANAGER") {
    // BR-009: 所属長本人の申請は部長が承認する
    if (!applicant.sectionManagerEmpNo) {
      return {
        nextApproverEmpNo: null,
        nextStatus: "DIRECTOR_APPROVAL",
        reason:
          "部長が設定されていません。システム管理者に連絡してください。",
      };
    }
    return {
      nextApproverEmpNo: applicant.sectionManagerEmpNo,
      nextStatus: "DIRECTOR_APPROVAL",
    };
  }

  if (role === "DIRECTOR") {
    // BR-014: 部長本人の申請は経理部長が承認する
    if (!ctx.accountingDirectorEmpNo) {
      return {
        nextApproverEmpNo: null,
        nextStatus: "ACCOUNTING_DIRECTOR_APPROVAL",
        reason:
          "経理部長が設定されていません。システム管理者に連絡してください。",
      };
    }
    return {
      nextApproverEmpNo: ctx.accountingDirectorEmpNo,
      nextStatus: "ACCOUNTING_DIRECTOR_APPROVAL",
    };
  }

  if (role === "ACCOUNTING_DIRECTOR") {
    // BR-009 variant: 経理部長本人の申請は上位者が承認する
    if (!ctx.accountingDirectorSuperiorEmpNo) {
      return {
        nextApproverEmpNo: null,
        nextStatus: "ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL",
        reason:
          "経理部長の上位者が未登録のためシステム管理者へ連絡してください。登録後に承認対象として表示されます。",
      };
    }
    return {
      nextApproverEmpNo: ctx.accountingDirectorSuperiorEmpNo,
      nextStatus: "ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL",
    };
  }

  if (role === "ACCOUNTING_DIRECTOR_SUPERIOR") {
    // 本機能ではオフライン運用（spec.md § 前提）
    return {
      nextApproverEmpNo: null,
      nextStatus: "SECTION_MANAGER_APPROVAL",
      reason:
        "経理部長の上位者本人の精算は本機能のスコープ外です（オフライン運用で処理してください）。",
    };
  }

  // APPLICANT／ACCOUNTANT／SYSTEM_ADMIN: 直属所属長から
  if (!applicant.sectionManagerEmpNo) {
    return {
      nextApproverEmpNo: null,
      nextStatus: "SECTION_MANAGER_APPROVAL",
      reason:
        "直属の所属長が設定されていません。システム管理者に連絡してください。",
    };
  }
  return {
    nextApproverEmpNo: applicant.sectionManagerEmpNo,
    nextStatus: "SECTION_MANAGER_APPROVAL",
  };
}

export type SectionManagerApprovedInput = {
  applicant: Employee;
  director: Employee | null;
  totalAmountYen: number;
  directorApprovalThreshold: number;
  isLate: boolean;
};

/**
 * 所属長が承認した後の遷移先を決める（US2 と US3 の経路分岐）。
 * - 100,000円を超える（BR-008）、または期限超過（EX-006）、
 *   または所属長本人申請（BR-009）→ DIRECTOR_APPROVAL
 * - それ以外 → ACCOUNTING_REVIEW
 */
export function resolveAfterSectionManagerApproval(
  input: SectionManagerApprovedInput,
): NextApproverResolution {
  const needsDirector =
    input.totalAmountYen > input.directorApprovalThreshold ||
    input.isLate ||
    input.applicant.role === "SECTION_MANAGER";

  if (needsDirector) {
    if (!input.director) {
      return {
        nextApproverEmpNo: null,
        nextStatus: "DIRECTOR_APPROVAL",
        reason: "部長が設定されていません。",
      };
    }
    return {
      nextApproverEmpNo: input.director.empNo,
      nextStatus: "DIRECTOR_APPROVAL",
    };
  }

  return {
    nextApproverEmpNo: null,
    nextStatus: "ACCOUNTING_REVIEW",
  };
}

export type DirectorApprovedInput = {
  applicant: Employee;
  accountingDirectorEmpNo: string | null;
};

/**
 * 部長が承認した後の遷移先。
 * - 部長本人の申請（既に ACCOUNTING_DIRECTOR_APPROVAL に居るはず）はここに来ない
 * - その他 → ACCOUNTING_REVIEW（経理担当のプール）
 */
export function resolveAfterDirectorApproval(
  _input: DirectorApprovedInput,
): NextApproverResolution {
  return {
    nextApproverEmpNo: null,
    nextStatus: "ACCOUNTING_REVIEW",
  };
}

export type AccountingDirectorApprovedInput = {
  applicant: Employee;
};

/**
 * 経理部長が承認した後の遷移先。
 * - 経理担当本人の申請（BR-015）は、経理部長が「経理確定」を行う運用のため、
 *   承認 = 確定として ACCOUNTING_FINALIZED へ直接遷移するのではなく、
 *   本機能では ACCOUNTING_REVIEW に落として経理担当本人以外の経理担当が
 *   処理するフォールバック経路を取る（US4 の finalize 側で本人除外を担保）。
 * - 部長本人の申請（BR-014）は、ACCOUNTING_REVIEW に落として経理担当が処理する。
 */
export function resolveAfterAccountingDirectorApproval(
  _input: AccountingDirectorApprovedInput,
): NextApproverResolution {
  return {
    nextApproverEmpNo: null,
    nextStatus: "ACCOUNTING_REVIEW",
  };
}

/**
 * 経理部長の上位者が承認した後の遷移先 → ACCOUNTING_REVIEW。
 */
export function resolveAfterAccountingDirectorSuperiorApproval(): NextApproverResolution {
  return {
    nextApproverEmpNo: null,
    nextStatus: "ACCOUNTING_REVIEW",
  };
}
