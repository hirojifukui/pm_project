// ルートハンドラ共通: 認証チェック・例外 → 日本語メッセージ変換・JSON レスポンス。

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import {
  UnauthorizedError,
  toUserError,
} from "@/server/errors/to-user-message";
import type { Employee } from "@prisma/client";

export type AuthenticatedHandler = (user: Employee) => Promise<unknown>;

export async function withAuthenticated(
  handler: AuthenticatedHandler,
): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    const result = await handler(user);
    if (result instanceof Response) return result;
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = toUserError(err);
    return NextResponse.json(body, { status });
  }
}

export async function respondCreated(data: unknown): Promise<Response> {
  return NextResponse.json(data, { status: 201 });
}
