import { NextResponse } from "next/server";
import { logout } from "@/server/auth/dev-login";
import { toUserError } from "@/server/errors/to-user-message";

export async function POST() {
  try {
    await logout();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = toUserError(err);
    return NextResponse.json(body, { status });
  }
}
