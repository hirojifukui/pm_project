// 利用者切替の簡易ログイン（FR-030 の暫定実装）。
// FR-030 の本来の要件（社内 SSO）は本番展開時に SSO 実装に差し替える。
// 本モジュールは `./session.ts` の `getCurrentUser()` と同じ関数境界を満たす
// 「本人識別子を受け取ってセッションに保存する」窓口。

import { prisma } from "@/server/db/client";
import { setSessionEmpNo, clearSession } from "./session";
import { ForbiddenError, NotFoundError } from "@/server/errors/to-user-message";

export type SwitchableUser = {
  empNo: string;
  name: string;
  department: string;
  role: string;
};

/**
 * 簡易ログイン画面に表示する切替可能な利用者の一覧（contracts/admin.md § 1.1）。
 * 本機能のローカル実装でのみ有効。本番展開時には無効化する。
 */
export async function listSwitchableUsers(): Promise<SwitchableUser[]> {
  const rows = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    orderBy: { empNo: "asc" },
  });
  return rows.map((r) => ({
    empNo: r.empNo,
    name: r.name,
    department: r.department,
    role: r.role,
  }));
}

export async function loginAs(empNo: string): Promise<SwitchableUser> {
  const row = await prisma.employee.findUnique({ where: { empNo } });
  if (!row) {
    throw new NotFoundError();
  }
  if (row.status !== "ACTIVE") {
    throw new ForbiddenError();
  }
  await setSessionEmpNo(empNo);
  return {
    empNo: row.empNo,
    name: row.name,
    department: row.department,
    role: row.role,
  };
}

export async function logout(): Promise<void> {
  await clearSession();
}
