import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import {
  UnauthorizedError,
  toUserError,
} from "@/server/errors/to-user-message";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    return NextResponse.json({
      empNo: user.empNo,
      name: user.name,
      role: user.role,
      department: user.department,
    });
  } catch (err) {
    const { status, body } = toUserError(err);
    return NextResponse.json(body, { status });
  }
}
