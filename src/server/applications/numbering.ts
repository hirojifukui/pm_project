// 申請番号の採番（JP-YYYY-NNNNNN）。
// 現在年の最大番号 + 1 を発行する。

import { prisma } from "@/server/db/client";
import { formatApplicationNumber, parseApplicationNumber } from "@/domain/id";

export async function allocateNextApplicationNumber(
  tzOffsetMinutes = 540, // Asia/Tokyo
): Promise<string> {
  const now = new Date();
  const localized = new Date(now.getTime() + tzOffsetMinutes * 60 * 1000);
  const year = localized.getUTCFullYear();
  const prefix = `JP-${year}-`;

  const latest = await prisma.application.findFirst({
    where: { applicationNumber: { startsWith: prefix } },
    orderBy: { applicationNumber: "desc" },
    select: { applicationNumber: true },
  });

  const nextSerial = latest
    ? (parseApplicationNumber(latest.applicationNumber)?.serial ?? 0) + 1
    : 1;
  return formatApplicationNumber(year, nextSerial);
}
