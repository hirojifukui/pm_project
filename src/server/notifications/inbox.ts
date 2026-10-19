// 通知のディスパッチと受信管理。EMAIL と IN_APP の 2 レコードを 1 件のイベントに対して生成する（FR-022）。

import { prisma } from "@/server/db/client";
import { newUlid } from "@/domain/id";
import type { NotificationTemplateId } from "@/domain/types";
import { renderTemplate } from "./templates";
import { sendMail } from "./mailer";

export type EnqueueNotificationInput = {
  recipientEmpNo: string;
  applicationNumber?: string;
  templateId: NotificationTemplateId;
  operation: string;
};

export async function enqueueNotification(
  input: EnqueueNotificationInput,
): Promise<void> {
  const recipient = await prisma.employee.findUnique({
    where: { empNo: input.recipientEmpNo },
  });
  if (!recipient) return;

  // IN_APP 側は常にレコードを作成する（本文は保持しない）。
  await prisma.notification.create({
    data: {
      id: newUlid(),
      recipientEmpNo: input.recipientEmpNo,
      applicationNumber: input.applicationNumber ?? null,
      channel: "IN_APP",
      templateId: input.templateId,
      operation: input.operation,
      sentAt: new Date(),
    },
  });

  // EMAIL 側はトランスポートに委ねる。失敗は IN_APP には影響させない。
  const emailRecord = await prisma.notification.create({
    data: {
      id: newUlid(),
      recipientEmpNo: input.recipientEmpNo,
      applicationNumber: input.applicationNumber ?? null,
      channel: "EMAIL",
      templateId: input.templateId,
      operation: input.operation,
      deliveryStatus: "PENDING",
    },
  });

  const rendered = renderTemplate(input.templateId, {
    operation: input.operation,
    ...(input.applicationNumber !== undefined
      ? { applicationNumber: input.applicationNumber }
      : {}),
  });
  const result = await sendMail({
    to: recipient.email,
    subject: rendered.subject,
    body: rendered.body,
    templateId: input.templateId,
    operation: input.operation,
    ...(input.applicationNumber !== undefined
      ? { applicationNumber: input.applicationNumber }
      : {}),
  });

  await prisma.notification.update({
    where: { id: emailRecord.id },
    data: result.ok
      ? { deliveryStatus: "SENT", sentAt: new Date() }
      : {
          deliveryStatus: "FAILED",
          failureReason: result.failureReason ?? "unknown",
        },
  });
}

export async function markAsRead(
  id: string,
  recipientEmpNo: string,
): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, recipientEmpNo, channel: "IN_APP", readAt: null },
    data: { readAt: new Date() },
  });
}

/**
 * 承認・差戻し・経理確定などの処理完了時に、該当する IN_APP 通知を自動的に既読にする。
 * contracts/notifications.md § 4 と対応。
 */
export async function autoMarkRead(
  applicationNumber: string,
  operation: string,
  recipientEmpNo: string,
): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      applicationNumber,
      recipientEmpNo,
      operation,
      channel: "IN_APP",
      readAt: null,
    },
    data: { readAt: new Date() },
  });
}
