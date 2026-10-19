import { prisma } from "@/server/db/client";
import { PiiAccessReason } from "@/domain/types";
import { newUlid } from "@/domain/id";

export type LogPiiAccessInput = {
  accessorEmpNo: string;
  applicationNumber?: string;
  targetEmpNo?: string;
  reasonCode: PiiAccessReason;
  freeNote?: string;
};

/**
 * 個人情報（氏名・社員番号・金額・出張先・口座情報・領収書画像）を直接
 * 表示する画面・API ハンドラの冒頭で呼び出す（憲法 IV、FR-017）。
 * ログ自体には PII を書かない。識別子（empNo, applicationNumber）のみを残す。
 */
export async function logPiiAccess(input: LogPiiAccessInput): Promise<void> {
  await prisma.piiAccessLog.create({
    data: {
      id: newUlid(),
      accessorEmpNo: input.accessorEmpNo,
      applicationNumber: input.applicationNumber ?? null,
      targetEmpNo: input.targetEmpNo ?? null,
      reasonCode: input.reasonCode,
      freeNote: input.freeNote ?? null,
    },
  });
}
