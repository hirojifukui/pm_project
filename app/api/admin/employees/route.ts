import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { withAuthenticated, respondCreated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import { logPiiAccess } from "@/server/pii-access";
import {
  EmployeeRole,
  RankKind,
  EmployeeStatus,
} from "@/domain/types";

// GET /api/admin/employees
// POST /api/admin/employees
// contracts/admin.md § 2.1〜2.2

export async function GET() {
  return withAuthenticated(async (user) => {
    authorize({ operation: "MANAGE_EMPLOYEE_OR_RULE", user });
    const rows = await prisma.employee.findMany({
      orderBy: { empNo: "asc" },
    });
    await logPiiAccess({
      accessorEmpNo: user.empNo,
      reasonCode: "ADMIN_LOOKUP",
      freeNote: `社員情報一覧の参照（${rows.length} 件）`,
    });
    return {
      items: rows.map((r) => ({
        empNo: r.empNo,
        name: r.name,
        email: r.email,
        department: r.department,
        rankKind: r.rankKind,
        role: r.role,
        sectionManagerEmpNo: r.sectionManagerEmpNo,
        status: r.status,
        effectiveFrom: r.effectiveFrom.toISOString(),
      })),
    };
  });
}

const CreateInput = z.object({
  empNo: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  department: z.string().min(1),
  rankKind: RankKind,
  role: EmployeeRole,
  sectionManagerEmpNo: z.string().nullable().optional(),
  status: EmployeeStatus.optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(req: NextRequest) {
  return withAuthenticated(async (user) => {
    authorize({ operation: "MANAGE_EMPLOYEE_OR_RULE", user });
    const body = CreateInput.parse(await req.json());
    const created = await prisma.employee.create({
      data: {
        empNo: body.empNo,
        name: body.name,
        email: body.email,
        department: body.department,
        rankKind: body.rankKind,
        role: body.role,
        sectionManagerEmpNo: body.sectionManagerEmpNo ?? null,
        status: body.status ?? "ACTIVE",
        effectiveFrom: new Date(`${body.effectiveFrom}T00:00:00.000Z`),
      },
      select: { empNo: true },
    });
    return respondCreated(created);
  });
}
