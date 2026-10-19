// 権限表（spec.md § 業務要件 > 権限）の単一判定点（憲法 II、FR-020）。
// 権限表の各セルを 1 つの関数で解釈し、違反時は ForbiddenError を投げる。

import type { Application, Employee } from "@prisma/client";
import { AuthorizedOperation } from "@/domain/types";
import { ForbiddenError } from "@/server/errors/to-user-message";

export type AuthorizeInput = {
  operation: AuthorizedOperation;
  user: Employee | null;
  application?: Application | null;
};

/**
 * 権限表の該当セルを評価し、許可されない場合に ForbiddenError を投げる。
 * 自己承認の禁止（BR-009）など、申請者＝操作者の判定もここに集約する。
 */
export function authorize(input: AuthorizeInput): void {
  const { operation, user, application } = input;
  if (!user) {
    throw new ForbiddenError();
  }

  const isApplicant =
    application != null && application.applicantEmpNo === user.empNo;

  switch (operation) {
    case "CREATE_OWN_APPLICATION":
    case "SUBMIT_OWN_APPLICATION":
      // 全ロールが「自分の申請」を作成・提出できる。本人以外は不可。
      if (application && !isApplicant) throw new ForbiddenError();
      return;

    case "WITHDRAW_OWN_APPLICATION":
      // 本人のみ。取下げ可否の状態判定は呼び出し側で行う。
      if (!application || !isApplicant) throw new ForbiddenError();
      return;

    case "VIEW_SUBORDINATE_APPLICATION": {
      if (!application) throw new ForbiddenError();
      // 本人・次承認者・経理担当以上・システム管理者が閲覧可能
      if (isApplicant) return;
      if (application.nextApproverEmpNo === user.empNo) return;
      if (
        user.role === "ACCOUNTANT" ||
        user.role === "ACCOUNTING_DIRECTOR" ||
        user.role === "ACCOUNTING_DIRECTOR_SUPERIOR" ||
        user.role === "SYSTEM_ADMIN"
      ) {
        return;
      }
      throw new ForbiddenError();
    }

    case "VIEW_OTHER_DEPARTMENT_APPLICATION":
      // 経理担当・経理部長・上位者のみ
      if (
        user.role === "ACCOUNTANT" ||
        user.role === "ACCOUNTING_DIRECTOR" ||
        user.role === "ACCOUNTING_DIRECTOR_SUPERIOR"
      ) {
        return;
      }
      throw new ForbiddenError();

    case "APPROVE_OR_REMAND": {
      if (!application) throw new ForbiddenError();
      // BR-009 自己承認禁止
      if (isApplicant) throw new ForbiddenError();
      // 承認者は、現時点の nextApproverEmpNo が自分であるか、
      // 代理指名により割り当てられている場合に許可する（代理の判定は呼び出し側で済ませる前提）。
      if (application.nextApproverEmpNo !== user.empNo) {
        throw new ForbiddenError();
      }
      return;
    }

    case "ACCOUNTING_FINALIZE_OR_REMAND": {
      if (!application) throw new ForbiddenError();
      if (isApplicant) throw new ForbiddenError();
      // 経理担当・経理部長・経理部長の上位者のみ経理確定操作が可能。
      // 申請者ロールに応じた細かな可否判定は、呼び出し側で BR-015 の
      // `canFinalize` を併用して行う（本関数は粗い通過を担当）。
      if (
        user.role !== "ACCOUNTANT" &&
        user.role !== "ACCOUNTING_DIRECTOR" &&
        user.role !== "ACCOUNTING_DIRECTOR_SUPERIOR"
      ) {
        throw new ForbiddenError();
      }
      return;
    }

    case "EXPORT_PAYMENT_CSV":
      // 経理担当は常時可。経理部長は経理担当の代替として可。
      if (
        user.role === "ACCOUNTANT" ||
        user.role === "ACCOUNTING_DIRECTOR"
      ) {
        return;
      }
      throw new ForbiddenError();

    case "MANAGE_EMPLOYEE_OR_RULE":
      // システム管理者のみ
      if (user.role === "SYSTEM_ADMIN") return;
      throw new ForbiddenError();

    default:
      // 想定外の操作は拒否（型が狭められていれば unreachable）
      throw new ForbiddenError();
  }
}

export function assertAuthenticated(user: Employee | null): asserts user is Employee {
  if (!user) throw new ForbiddenError();
}

// `AuthorizedOperation` Zod を型安全に使うためのヘルパー（型チェックのみ）
export type OperationKey = typeof AuthorizedOperation._type;
