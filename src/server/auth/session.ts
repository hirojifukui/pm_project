// 認証境界の単一モジュール（FR-030 の受入契約を実装する唯一の関数境界）。
// 本機能のローカル実装では `./dev-login.ts` の簡易ログインが本モジュールを満たす。
// 本番展開時には同じインターフェースで SSO 実装に差し替える。

import type { Employee } from "@prisma/client";
import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/server/db/client";

export type SessionData = {
  empNo?: string;
};

const sessionOptions = {
  password:
    process.env.SESSION_PASSWORD ??
    "local-dev-session-password-at-least-32-characters-long",
  cookieName: "travel-expense-session",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  // Next.js 16 の `cookies()` の戻り型と iron-session の期待型に差分があるため型アサーションで橋渡し。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getIronSession<SessionData>(cookieStore as any, sessionOptions);
}

/**
 * 現在のログイン利用者を返す単一のエントリ。
 * 認証に関わるサーバーコードは本関数のみを使う（憲法 IV 連動、FR-030）。
 */
export async function getCurrentUser(): Promise<Employee | null> {
  const session = await getSession();
  if (!session.empNo) return null;
  return prisma.employee.findUnique({ where: { empNo: session.empNo } });
}

export async function setSessionEmpNo(empNo: string): Promise<void> {
  const session = await getSession();
  session.empNo = empNo;
  await session.save();
}

export async function clearSession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}
