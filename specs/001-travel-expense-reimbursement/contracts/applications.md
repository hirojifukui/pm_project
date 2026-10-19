# 契約: 申請（Applications）

Route Handlers と Server Actions の入出力定義。クライアント・サーバー間で共有する
Zod スキーマは `src/domain/types.ts` に集約し、本契約はそのスキーマに準拠する。

全ての認可は `src/server/auth/authorize.ts` で権限表に照合してから実行する（憲法 II）。
失敗時は 403 相当として `{"error":"権限がありません"}` を返す。

---

## 1. `POST /api/applications/drafts`

申請者が新規下書きを作成する。

**入力**:

```ts
{
  tripStartDate: string;   // YYYY-MM-DD
  tripEndDate: string;     // YYYY-MM-DD
  destination: string;
  purpose: string;
}
```

**出力 (201)**:

```ts
{
  applicationNumber: string;  // 例: "JP-2026-000123"
  status: "DRAFT";
}
```

**エラー**:

- 400: `tripStartDate > tripEndDate`、文字列が空、など（日本語メッセージ）。
- 401: 未ログイン。

---

## 2. `GET /api/applications/by-number/{applicationNumber}`

申請詳細を返す。認可: 本人、承認対象として割り当てられている承認者、経理担当・
経理部長、システム管理者。

**出力 (200)**:

```ts
{
  applicationNumber: string;
  applicant: { empNo: string; name: string; department: string };
  tripStartDate: string;
  tripEndDate: string;
  destination: string;
  purpose: string;
  totalAmountYen: number;
  status: ApplicationStatus;
  nextApprover: { empNo: string; name: string } | null;
  lines: ExpenseLine[];
  receipts: Receipt[];  // 画像バイナリは別エンドポイント
  history: ApprovalHistory[];
}
```

**エラー**: 403／404。

---

## 3. `PUT /api/applications/{applicationNumber}/lines`

明細一括更新（下書き・差戻し中のみ）。

**入力**:

```ts
{
  lines: Array<{
    id?: string;                                 // 既存更新時のみ
    date: string;
    category: "TRANSPORT" | "LODGING" | "PER_DIEM" | "OTHER";
    fromPlace?: string;
    toPlace?: string;
    transportMode?: "TRAIN" | "SHINKANSEN" | "BUS" | "TAXI" | "FLIGHT" | "OTHER";
    amountYen: number;                           // PER_DIEM は無視（システム算出）
    taxiReasons?: Array<"AFTER_22" | "HEAVY_LUGGAGE" | "CUSTOMER_RIDE">;
    exceedsLodgingCapReason?: string;
    remarks?: string;
  }>;
}
```

**処理**:

- PER_DIEM 明細はクライアント入力を無視し、`calculatePerDiem` の結果で置き換える
  （FR-004）。
- TAXI 明細は `taxiReasons` が 1 件以上あることを検査（FR-027）。
- LODGING 明細で `amountYen > 地域別上限` のとき `exceedsLodgingCapReason` 必須
  （FR-005）。

**出力 (200)**: 更新後の明細一覧。

**エラー**:

- 400: バリデーション違反（どの明細のどの項目かを特定する日本語メッセージ）。
- 409: 申請が編集不可の状態。

---

## 4. `POST /api/applications/{applicationNumber}/receipts`

領収書画像のアップロード（`multipart/form-data`）。

**入力フィールド**:

- `expenseLineId` (string)
- `file` (binary; JPEG または PNG、10MB 以下)
- `isSupportingDocument` (boolean、省略時は false)
- `supportingReason` (string, 支払証明書時のみ)

**出力 (201)**:

```ts
{
  id: string;
  storagePath: string;
  sha256: string;
}
```

**エラー**: 400（形式・サイズ）、403、409（編集不可）。

---

## 5. `POST /api/applications/{applicationNumber}/submit`

下書きを提出する。

**処理順**:

1. 認可（申請者本人であること）。
2. `isWithinDeadline`（BR-001）: 期限内なら `SECTION_MANAGER_APPROVAL`、超過なら
   提出者が遅延理由を同梱する必要がある。遅延理由があれば受け入れ、無ければ 400。
3. `hasOverlappingTrip`（BR-010）: 重複があれば 409 と重複する申請番号を返す。
4. `isReceiptRequired`（BR-006）と添付の整合性を確認。
5. `nextApprover`（BR-007 / BR-008 / BR-009）で次の承認者を解決し、
   `nextApproverEmpNo` を設定。
6. `ApprovalHistory` に `SUBMIT` を追加。
7. 通知を発行（FR-022、Notifications 契約参照）。

**入力**:

```ts
{
  lateReason?: string;  // 期限超過時のみ必須
}
```

**出力 (200)**:

```ts
{
  applicationNumber: string;
  status: "SECTION_MANAGER_APPROVAL" | "DIRECTOR_APPROVAL" |
          "ACCOUNTING_DIRECTOR_APPROVAL";
  nextApprover: { empNo: string; name: string };
}
```

**エラー**:

- 400: 遅延理由未入力、必須明細の添付不足、業務ルール違反。各違反はどの明細の
  どの条件が原因かを日本語で返す。
- 409: 重複出張（`conflictingApplicationNumber` を含める）。

---

## 6. `POST /api/applications/{applicationNumber}/withdraw`

取下げ（所属長が承認する前のみ）。

**入力**: なし。

**出力 (200)**: `{ status: "WITHDRAWN" }`

**エラー**: 409（既に承認済み・取下げ済み）。

---

## 7. `GET /api/applications/mine`

自分の申請一覧（`?status=` フィルタ可）。クエリに個人情報は乗せない（FR-019）。

**出力 (200)**:

```ts
{
  items: Array<{
    applicationNumber: string;
    tripStartDate: string;
    tripEndDate: string;
    totalAmountYen: number;
    status: ApplicationStatus;
    nextApprover: { empNo: string; name: string } | null;
    submittedAt: string | null;
  }>;
}
```

---

## 共通: エラー形式

```ts
{
  error: string;                 // 日本語の 1 文メッセージ（画面表示用）
  code?: string;                 // 内部用（ログに個人情報を乗せないための分類キー）
  violations?: Array<{
    path: string;                // 例: "lines[2].amountYen"
    message: string;             // 日本語
    ruleId?: string;             // 例: "BR-003"
  }>;
}
```
