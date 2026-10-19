import { prisma } from "@/server/db/client";
import { withAuthenticated } from "@/server/http/handler";
import { ForbiddenError, NotFoundError } from "@/server/errors/to-user-message";

// DELETE /api/approvals/proxy-assignments/{id}
// contracts/approvals.md § 5
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuthenticated(async (user) => {
    const row = await prisma.proxyApproverAssignment.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundError();
    if (row.principalEmpNo !== user.empNo) {
      throw new ForbiddenError();
    }
    // 削除し、進行中の承認対象を本人へ再割当て
    const now = new Date();
    const stillActive =
      row.startsAt.getTime() <= now.getTime() &&
      now.getTime() <= row.endsAt.getTime();

    const reassignedCount = await prisma.$transaction(async (tx) => {
      await tx.proxyApproverAssignment.delete({ where: { id } });
      if (!stillActive) return 0;
      // プリンシパル宛て承認対象のうち、代理期間中に進行していたものは
      // 既に代理人がアクセス可能だったので、再割当ては単にプリンシパル側へ
      // 戻すだけ（nextApproverEmpNo は常にプリンシパル）。
      // 他の処理は特に不要なので、作用対象の件数のみ算定して返す。
      const affected = await tx.application.count({
        where: {
          nextApproverEmpNo: row.principalEmpNo,
          status: {
            in: ["SECTION_MANAGER_APPROVAL", "DIRECTOR_APPROVAL"],
          },
        },
      });
      return affected;
    });

    return { reassignedApplications: reassignedCount };
  });
}
