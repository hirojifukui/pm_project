import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { withAuthenticated, respondCreated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import { RuleKey } from "@/domain/types";

// GET /api/admin/rules
// POST /api/admin/rules
// contracts/admin.md § 2.4〜2.5

export async function GET() {
  return withAuthenticated(async (user) => {
    authorize({ operation: "MANAGE_EMPLOYEE_OR_RULE", user });
    const rows = await prisma.ruleValue.findMany({
      orderBy: [{ ruleKey: "asc" }, { effectiveFrom: "desc" }],
    });
    return {
      items: rows.map((r) => ({
        ruleKey: r.ruleKey,
        effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10),
        value: r.value,
        changedByEmpNo: r.changedByEmpNo,
        changeReason: r.changeReason,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });
}

const CreateInput = z.object({
  ruleKey: RuleKey,
  value: z.string().min(1),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  changeReason: z.string().min(1),
});

export async function POST(req: NextRequest) {
  return withAuthenticated(async (user) => {
    authorize({ operation: "MANAGE_EMPLOYEE_OR_RULE", user });
    const body = CreateInput.parse(await req.json());
    const created = await prisma.ruleValue.upsert({
      where: {
        ruleKey_effectiveFrom: {
          ruleKey: body.ruleKey,
          effectiveFrom: new Date(`${body.effectiveFrom}T00:00:00.000Z`),
        },
      },
      create: {
        ruleKey: body.ruleKey,
        effectiveFrom: new Date(`${body.effectiveFrom}T00:00:00.000Z`),
        value: body.value,
        changedByEmpNo: user.empNo,
        changeReason: body.changeReason,
      },
      update: {
        value: body.value,
        changedByEmpNo: user.empNo,
        changeReason: body.changeReason,
      },
      select: { ruleKey: true, effectiveFrom: true },
    });
    return respondCreated({
      ruleKey: created.ruleKey,
      effectiveFrom: created.effectiveFrom.toISOString().slice(0, 10),
    });
  });
}
