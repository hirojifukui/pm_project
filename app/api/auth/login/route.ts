import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loginAs } from "@/server/auth/dev-login";
import { toUserError } from "@/server/errors/to-user-message";

const Input = z.object({ empNo: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const parsed = Input.parse(await req.json());
    const user = await loginAs(parsed.empNo);
    return NextResponse.json(user);
  } catch (err) {
    const { status, body } = toUserError(err);
    return NextResponse.json(body, { status });
  }
}
