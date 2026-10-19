// 通知テンプレート。本文には PII を含めない（FR-022、憲法 IV）。
// 件名と本文は申請番号・操作名・画面リンクのみを埋め込む。

import type { NotificationTemplateId } from "@/domain/types";

export type RenderInput = {
  applicationNumber?: string;
  operation?: string;
};

type Template = (ctx: RenderInput) => { subject: string; body: string };

const link = (applicationNumber?: string) =>
  applicationNumber
    ? `/applications/by-number/${applicationNumber}`
    : "/notifications";

const templates: Record<NotificationTemplateId, Template> = {
  SUBMITTED_TO_APPROVER: (ctx) => ({
    subject: `[旅費精算] 承認待ち: 申請 ${ctx.applicationNumber ?? ""}`,
    body: `承認が必要な申請があります。\n申請番号: ${ctx.applicationNumber ?? "-"}\n画面: ${link(ctx.applicationNumber)}`,
  }),
  SUBMITTED_SELF_CONFIRM: (ctx) => ({
    subject: `[旅費精算] 申請を受け付けました: 申請 ${ctx.applicationNumber ?? ""}`,
    body: `提出した申請を受け付けました。\n申請番号: ${ctx.applicationNumber ?? "-"}\n画面: ${link(ctx.applicationNumber)}`,
  }),
  APPROVED_TO_APPLICANT: (ctx) => ({
    subject: `[旅費精算] 承認されました: 申請 ${ctx.applicationNumber ?? ""}`,
    body: `申請が承認されました。次の工程に進みます。\n申請番号: ${ctx.applicationNumber ?? "-"}\n画面: ${link(ctx.applicationNumber)}`,
  }),
  APPROVED_TO_NEXT_APPROVER: (ctx) => ({
    subject: `[旅費精算] 承認待ち: 申請 ${ctx.applicationNumber ?? ""}`,
    body: `承認が必要な申請があります。\n申請番号: ${ctx.applicationNumber ?? "-"}\n画面: ${link(ctx.applicationNumber)}`,
  }),
  REMANDED_TO_APPLICANT: (ctx) => ({
    subject: `[旅費精算] 差戻しされました: 申請 ${ctx.applicationNumber ?? ""}`,
    body: `申請が差戻しされました。コメントを確認し、修正して再提出してください。\n申請番号: ${ctx.applicationNumber ?? "-"}\n画面: ${link(ctx.applicationNumber)}`,
  }),
  ACCOUNTING_FINALIZED_TO_APPLICANT: (ctx) => ({
    subject: `[旅費精算] 経理確定されました: 申請 ${ctx.applicationNumber ?? ""}`,
    body: `申請が経理確定されました。該当締め日の支払用 CSV に含まれます。\n申請番号: ${ctx.applicationNumber ?? "-"}\n画面: ${link(ctx.applicationNumber)}`,
  }),
  ACCOUNTING_REMAND_TO_APPLICANT: (ctx) => ({
    subject: `[旅費精算] 経理から差戻しされました: 申請 ${ctx.applicationNumber ?? ""}`,
    body: `経理担当から差戻しされました。コメントを確認し、修正して再提出してください。\n申請番号: ${ctx.applicationNumber ?? "-"}\n画面: ${link(ctx.applicationNumber)}`,
  }),
  CSV_EXPORTED_TO_ACCOUNTING: () => ({
    subject: `[旅費精算] 支払用 CSV の出力が完了しました`,
    body: `支払用 CSV の出力が完了しました。経理確定の履歴から詳細を確認できます。\n画面: /accounting/exports`,
  }),
  HR_IMPORT_FAILED_TO_ADMIN: () => ({
    subject: `[旅費精算] 人事情報の取込に失敗しました（管理者宛て）`,
    body: `月次の社員情報 CSV の取込に失敗しました。管理画面から再取込してください。\n画面: /admin/hr-import`,
  }),
  HR_IMPORT_FAILED_TO_ACCOUNTING: () => ({
    subject: `[旅費精算] 人事情報の取込に失敗しました（経理担当宛て）`,
    body: `月次の社員情報 CSV の取込に失敗しました。システム管理者からの再取込をお待ちください。`,
  }),
  PROXY_ASSIGNED: () => ({
    subject: `[旅費精算] 代理承認者に指名されました`,
    body: `代理承認者として指名されました。期間中は該当承認を担当してください。\n画面: /approvals`,
  }),
  WITHDRAWN_SELF_CONFIRM: (ctx) => ({
    subject: `[旅費精算] 申請を取り下げました: 申請 ${ctx.applicationNumber ?? ""}`,
    body: `申請を取り下げました。\n申請番号: ${ctx.applicationNumber ?? "-"}`,
  }),
};

export function renderTemplate(
  templateId: NotificationTemplateId,
  ctx: RenderInput,
): { subject: string; body: string } {
  const t = templates[templateId];
  return t(ctx);
}
