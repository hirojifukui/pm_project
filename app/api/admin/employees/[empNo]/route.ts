import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { authorize } from "@/server/auth/authorize";
import { NotFoundError } from "@/server/errors/to-user-message";
import { EmployeeRole, EmployeeStatus } from "@/domain/types";

// PUT /api/admin/employees/{empNo}
// contracts/admin.md § 2.3

const UpdateInput = z.object({
  role: EmployeeRole.optional(),
  sectionManagerEmpNo: z.string().nullable().optional(),
  status: EmployeeStatus.optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ empNo: string }> },
) {
  const { empNo } = await params;
  return withAuthenticated(async (user) => {
    authorize({ operation: "MANAGE_EMPLOYEE_OR_RULE", user });
    const body = UpdateInput.parse(await req.json());
    const existing = await prisma.employee.findUnique({ where: { empNo } });
    if (!existing) throw new NotFoundError();

    const data: {
      role?: string;
      sectionManagerEmpNo?: string | null;
      status?: string;
      effectiveFrom?: Date;
    } = {};
    if (body.role !== undefined) data.role = body.role;
    if (body.sectionManagerEmpNo !== undefined)
      data.sectionManagerEmpNo = body.sectionManagerEmpNo;
    if (body.status !== undefined) data.status = body.status;
    if (body.effectiveFrom !== undefined)
      data.effectiveFrom = new Date(`${body.effectiveFrom}T00:00:00.000Z`);

    const updated = await prisma.employee.update({
      where: { empNo },
      data,
      select: {
        empNo: true,
        role: true,
        sectionManagerEmpNo: true,
        status: true,
      },
    });
    return updated;
  });
}
