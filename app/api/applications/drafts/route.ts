import { NextRequest } from "next/server";
import { prisma } from "@/server/db/client";
import { withAuthenticated, respondCreated } from "@/server/http/handler";
import { DraftInput } from "@/domain/types";
import { allocateNextApplicationNumber } from "@/server/applications/numbering";
import { BusinessRuleError } from "@/server/errors/to-user-message";

// POST /api/applications/drafts
// contracts/applications.md § 1
export async function POST(req: NextRequest) {
  return withAuthenticated(async (user) => {
    const body = DraftInput.parse(await req.json());
    const start = new Date(`${body.tripStartDate}T00:00:00.000Z`);
    const end = new Date(`${body.tripEndDate}T00:00:00.000Z`);
    if (start.getTime() > end.getTime()) {
      throw new BusinessRuleError([
        {
          path: "tripEndDate",
          message: "出張の終了日は、開始日と同じかそれより後の日付を指定してください。",
        },
      ]);
    }
    const applicationNumber = await allocateNextApplicationNumber();
    const created = await prisma.application.create({
      data: {
        applicationNumber,
        applicantEmpNo: user.empNo,
        department: user.department,
        tripStartDate: start,
        tripEndDate: end,
        destination: body.destination,
        purpose: body.purpose,
        status: "DRAFT",
      },
      select: { applicationNumber: true, status: true },
    });
    return respondCreated(created);
  });
}
