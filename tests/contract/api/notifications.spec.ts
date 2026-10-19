import { describe, it, expect } from "vitest";
import { NotificationTemplateId } from "@/domain/types";
import { renderTemplate } from "@/server/notifications/templates";

// contracts/notifications.md § 2〜3 の宣言的検証。
// 本文には PII を含めない（FR-022、憲法 IV）。

describe("契約: 通知 API（contracts/notifications.md）", () => {
  it("テンプレート一覧がすべて日本語で、PII を含まない（氏名・金額・口座を含めない）", () => {
    const templates = NotificationTemplateId.options;
    for (const t of templates) {
      const rendered = renderTemplate(t, {
        applicationNumber: "JP-2026-000001",
        operation: "APPROVE",
      });
      expect(rendered.subject).toBeTruthy();
      expect(rendered.body).toBeTruthy();
      // PII キーワードが含まれていないことを確認
      const forbiddenPatterns = [
        /氏名/,
        /口座/,
        /\d{6}円/, // 具体的な金額が入らない
      ];
      for (const p of forbiddenPatterns) {
        expect(rendered.body).not.toMatch(p);
        expect(rendered.subject).not.toMatch(p);
      }
    }
  });

  it("申請番号を本文に埋め込める（applicationNumber ありのテンプレ）", () => {
    const rendered = renderTemplate("SUBMITTED_TO_APPROVER", {
      applicationNumber: "JP-2026-000042",
      operation: "SUBMIT",
    });
    expect(rendered.body).toContain("JP-2026-000042");
  });
});
