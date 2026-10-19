// 経理部長・経理部長の上位者の empNo を解決するヘルパー。
// 本機能では 1 名を想定するが、複数居る場合は最小の empNo を返す（決定論的に）。

import { prisma } from "@/server/db/client";

export async function findAccountingDirectorEmpNo(): Promise<string | null> {
  const row = await prisma.employee.findFirst({
    where: { role: "ACCOUNTING_DIRECTOR", status: "ACTIVE" },
    orderBy: { empNo: "asc" },
    select: { empNo: true },
  });
  return row?.empNo ?? null;
}

export async function findAccountingDirectorSuperiorEmpNo(): Promise<
  string | null
> {
  const row = await prisma.employee.findFirst({
    where: { role: "ACCOUNTING_DIRECTOR_SUPERIOR", status: "ACTIVE" },
    orderBy: { empNo: "asc" },
    select: { empNo: true },
  });
  return row?.empNo ?? null;
}
