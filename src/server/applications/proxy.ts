// 代理承認の集約ヘルパー。
// DB の ProxyApproverAssignment を Date 範囲でフィルタして、呼び出し側に扱いやすい形で返す。

import { prisma } from "@/server/db/client";

export type ActiveProxy = {
  id: string;
  principalEmpNo: string;
  proxyEmpNo: string;
  startsAt: Date;
  endsAt: Date;
};

export async function loadActiveProxies(now: Date = new Date()): Promise<ActiveProxy[]> {
  const rows = await prisma.proxyApproverAssignment.findMany({
    where: {
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    select: {
      id: true,
      principalEmpNo: true,
      proxyEmpNo: true,
      startsAt: true,
      endsAt: true,
    },
  });
  return rows;
}

/**
 * 操作者が特定の principal の有効な代理であれば、その指名情報を返す。
 */
export async function findActiveProxyFor(
  principalEmpNo: string,
  operatorEmpNo: string,
  now: Date = new Date(),
): Promise<ActiveProxy | null> {
  if (principalEmpNo === operatorEmpNo) return null;
  const rows = await prisma.proxyApproverAssignment.findMany({
    where: {
      principalEmpNo,
      proxyEmpNo: operatorEmpNo,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    select: {
      id: true,
      principalEmpNo: true,
      proxyEmpNo: true,
      startsAt: true,
      endsAt: true,
    },
    take: 1,
  });
  return rows[0] ?? null;
}
