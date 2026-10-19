# 契約: 通知（Notifications）

FR-022 の 2 経路配信（メール＋アプリ内）を 1 本の `enqueueNotification()` で扱う。
本文は保持せず、テンプレート ID と申請番号から生成する（憲法 IV）。

---

## 1. 内部 API: `enqueueNotification(input)`

Route Handlers 内から呼ぶ。公開 HTTP エンドポイントではない。

**入力**:

```ts
{
  recipientEmpNo: string;
  applicationNumber?: string;
  templateId: NotificationTemplateId;   // 列挙は下記
  operation: ApprovalOperation | AdminEvent;
}
```

**処理**:

1. `Notification` を 2 件作成（`channel: EMAIL` と `channel: IN_APP`）、
   `deliveryStatus = PENDING`／`readAt = null`。
2. メール: `src/server/notifications/mailer.ts` のドライバー（既定はファイル保存）
   に投げる。成功時 `deliveryStatus = SENT`、失敗時 `FAILED` と `failureReason` を
   設定。アプリ内のお知らせは残る。
3. 失敗はシステム管理者が参照できる管理ログ（`PiiAccessLog` ではなく `admin.log`）
   に記録。個人情報は含めない。

**テンプレート ID**（既定、`src/server/notifications/templates/`）:

- `SUBMITTED_TO_APPROVER` — 承認者宛て、提出通知。
- `SUBMITTED_SELF_CONFIRM` — 申請者宛て、受付確認。
- `APPROVED_TO_APPLICANT` — 申請者宛て、承認通知。
- `APPROVED_TO_NEXT_APPROVER` — 次承認者宛て。
- `REMANDED_TO_APPLICANT` — 差戻し通知。
- `ACCOUNTING_FINALIZED_TO_APPLICANT` — 経理確定通知。
- `ACCOUNTING_REMAND_TO_APPLICANT` — 経理差戻し通知。
- `CSV_EXPORTED_TO_ACCOUNTING` — 経理担当宛て、CSV 出力完了。
- `HR_IMPORT_FAILED_TO_ADMIN` — システム管理者宛て、取込失敗。
- `HR_IMPORT_FAILED_TO_ACCOUNTING` — 経理担当宛て、取込失敗。
- `PROXY_ASSIGNED` — 代理指名の確認。

**本文の生成規則**: `件名/本文` は日本語テンプレートに `申請番号` と `操作名` のみを
埋め込む。氏名・金額・口座など PII は含めない（FR-022）。本文の末尾にアプリ内の
該当画面への相対リンク（例: `/applications/by-number/JP-2026-000123`）を含める。

---

## 2. `GET /api/notifications/inbox`

アプリ内のお知らせ一覧。認可: 本人のみ。

**出力 (200)**:

```ts
{
  items: Array<{
    id: string;
    applicationNumber: string | null;
    templateId: NotificationTemplateId;
    operation: string;
    sentAt: string;
    readAt: string | null;
    linkPath: string | null;    // 相対パス
  }>;
}
```

---

## 3. `POST /api/notifications/{id}/read`

既読にする。

**出力 (200)**: `{ readAt: string }`

---

## 4. 自動既読

承認・差戻し・経理確定などの処理が完了した時点で、関連する `IN_APP` 通知のうち
その操作に対応するものを自動的に既読にする（仕様書 FR-022）。これは
`enqueueNotification` と対になる `autoMarkRead(applicationNumber, operation,
recipientEmpNo)` で実装し、Route Handler 内から呼ぶ。
