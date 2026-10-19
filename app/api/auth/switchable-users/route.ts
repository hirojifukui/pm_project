import { NextResponse } from "next/server";
import { listSwitchableUsers } from "@/server/auth/dev-login";
import { toUserError } from "@/server/errors/to-user-message";

export async function GET() {
  try {
    const items = await listSwitchableUsers();
    return NextResponse.json({ items });
  } catch (err) {
    const { status, body } = toUserError(err);
    return NextResponse.json(body, { status });
  }
}
