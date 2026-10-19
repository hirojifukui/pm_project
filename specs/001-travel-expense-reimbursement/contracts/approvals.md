# 契約: 承認・差戻し（Approvals）

所属長・部長・経理部長・経理部長の上位者が使う。本契約は 1 本の実装（権限表で分岐）
で複数ロールをまかなう。

認可は `src/server/auth/authorize.ts` で、申請の現在状態 × 操作者のロールが権限表に
整合することを検査する（憲法 II）。

---

## 1. `GET /api/approvals/pending`

自分が承認対象として割り当てられている申請の一覧。代理承認指名が有効な場合は、
プリンシパルの代わりに取得される。

**入力（クエリ）**: `?role=auto`（既定、現在のログイン利用者のロールで自動判定）。

**出力 (200)**:

```ts
{
  items: Array<{
    applicationNumber: string;
    applicantName: string;        // 画面表示用（PII、画面でのみ扱う）
    department: string;
    tripStartDate: string;
    tripEndDate: string;
    totalAmountYen: number;
    submittedAt: string;
    isLate: boolean;              // BR-001 超過
    requiredBy: "SECTION_MANAGER" | "DIRECTOR" | "ACCOUNTING_DIRECTOR" |
                "ACCOUNTING_DIRECTOR_SUPERIOR";
    actedAs: "SELF" | "PROXY";
  }>;
}
```

**制約**:

- 返却範囲は、権限表の「申請を承認・差戻しする」行の △ 条件に合致するものだけ
  （FR-009、FR-020）。
- 氏名・部署などの PII は画面表示用途に限って返す。レスポンス全体をログに
  落とさない（`src/server/http/log.ts` の redact で遮断、FR-019）。

---

## 2. `POST /api/approvals/{applicationNumber}/approve`

承認する。

**入力**:

```ts
{
  comment?: string;   // 任意（承認時）
}
```

**処理**:

- 認可: 自分が `nextApproverEmpNo` と一致、または `ProxyApproverAssignment` で
  プリンシパルから代理指名されていること。
- BR-009 の自己承認禁止: `operatorEmpNo == applicantEmpNo` のときは 403 相当として
  拒否。
- `nextApprover` を再評価し、状態遷移（data-model.md §3）に従って更新。
- 代理承認時は `ApprovalHistory.actedAs = PROXY`。
- 通知を発行（Notifications 契約）。

**出力 (200)**: `{ status: ApplicationStatus; nextApprover: {...} | null }`

**エラー**: 403／409。

---

## 3. `POST /api/approvals/{applicationNumber}/remand`

差戻しする。

**入力**:

```ts
{
  comment: string;        // 必須（FR-011）、空白のみは不可
}
```

**処理**:

- コメントが空のときは 400、`error: "差戻しの理由（コメント）を入力してください"`。
- 状態を `REMANDED` に遷移し、`nextApproverEmpNo` を null に。
- 通知を申請者宛てに発行。

**出力 (200)**: `{ status: "REMANDED" }`

---

## 4. `POST /api/approvals/proxy-assignments`

所属長が自分の代理承認指名を登録する（本人のみ）。

**入力**:

```ts
{
  proxyEmpNo: string;
  startsAt: string;       // ISO8601、Asia/Tokyo
  endsAt: string;         // ISO8601、Asia/Tokyo
}
```

**処理**:

- `endsAt - startsAt >= 3 営業日`（BR-012、`cutoffPaymentDate` 等と同じ営業日判定を
  共通化）。
- 既存の有効期間との重複は 409。

**出力 (201)**: `{ id: string }`

---

## 5. `DELETE /api/approvals/proxy-assignments/{id}`

代理指名を取り消す（本人のみ）。既に進行中の承認待ちは、取消後に本人へ再割当される。
再割当は非同期ではなくリクエスト内で実行する。

**出力 (200)**: `{ reassignedApplications: number }`

---

## 6. `GET /api/approvals/history/{applicationNumber}`

申請の履歴を取得（FR-017）。閲覧権限がある利用者のみ。

**出力 (200)**:

```ts
{
  items: Array<{
    operatorName: string;
    actedAs: "SELF" | "PROXY";
    operation: ApprovalOperation;
    comment: string | null;
    occurredAt: string;
  }>;
}
```
