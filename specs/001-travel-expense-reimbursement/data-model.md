# フェーズ1 データモデル: 旅費精算

**計画**: [plan.md](./plan.md) ／ **仕様書**: [spec.md](./spec.md) の「主要エンティティ」

本書は、SQLite + Prisma 上に実装するエンティティ、属性、関連、バリデーション、状態
遷移を記述する。属性名は `snake_case`（DB 列）／`camelCase`（アプリ側）を Prisma の
`@map` で接続する。金額は円単位の `Int`、日時は UTC の `DateTime` として保存し、
画面・CSV への表示では `Asia/Tokyo` に変換する。

---

## 1. エンティティ一覧

| エンティティ | 役割 | 主キー |
|--------------|------|--------|
| `Employee` | 社員情報（人事 CSV から取り込み、職位ロールを保持） | `empNo` |
| `RuleValue` | 規程値のバージョン管理（日当・宿泊費上限・申請期限など） | `(ruleKey, effectiveFrom)` |
| `Holiday` | 日本の祝日マスタ（営業日計算に使用） | `date` |
| `Application` | 旅費精算申請の本体 | `applicationNumber` |
| `ExpenseLine` | 精算明細（1 申請に複数） | `id` |
| `Receipt` | 領収書画像のメタデータ | `id` |
| `ApprovalHistory` | 承認・差戻し・経理確定・取下げ・CSV 出力の履歴 | `id` |
| `ProxyApproverAssignment` | 代理承認指名（所属長 → 部長） | `id` |
| `Notification` | 利用者ごとの通知（メールとアプリ内の両方を 1 レコードで追跡） | `id` |
| `PaymentCsvExport` | 支払用 CSV 出力のスナップショット | `id` |
| `HrImportResult` | 人事 CSV 取込の実行結果（成功・失敗・エラー行） | `id` |
| `PiiAccessLog` | 個人情報を直接参照したイベントの監査ログ | `id` |

---

## 2. 列定義

### 2.1 `Employee`

- `empNo` (string, 主キー) — 社員番号。
- `name` (string) — 氏名。
- `email` (string, unique) — 社内メールアドレス。認証（簡易ログイン／将来の SSO）の
  突合キー。
- `department` (string) — 所属（部単位）。
- `rankKind` (enum `STAFF | MANAGEMENT`) — 役職区分（日当計算、BR-002）。
- `role` (enum `APPLICANT | SECTION_MANAGER | DIRECTOR | ACCOUNTANT |
   ACCOUNTING_DIRECTOR | ACCOUNTING_DIRECTOR_SUPERIOR | SYSTEM_ADMIN`) — 職位ロール。
  仕様書「主要エンティティ > 社員情報」の職位ロール 7 種に対応。
- `sectionManagerEmpNo` (string, nullable) — 所属長の社員番号（自己参照）。
- `status` (enum `ACTIVE | SUSPENDED | RETIRED`) — 在籍状態。
- `effectiveFrom` (date) — 社員情報の有効開始日。
- `createdAt`, `updatedAt` (datetime)

**バリデーション**:

- `email` は `@` を含む形式。簡易ログインは email で選択、SSO は email を本人識別子
  として受け取る。
- `role = SECTION_MANAGER` を持つ Employee は、少なくとも 1 名の部下（他レコードの
  `sectionManagerEmpNo` に自分の `empNo` が指定されている）を持ちうる（0 名も可）。
- 自分自身を所属長に指定することは禁止（アプリ側で検査）。
- `role = ACCOUNTING_DIRECTOR_SUPERIOR` の社員は 1 名以上登録されていること（経理
  部長本人の精算を扱うため）。登録 0 のまま経理部長本人の申請が発生した場合は、
  仕様書エッジケース（経理部長本人の精算で上位者未登録）に従う。

### 2.2 `RuleValue`

- `ruleKey` (string) — 規程値のキー。既定で以下を定義:
  - `PER_DIEM_STAFF_LODGING`（宿泊時の一般社員の日当）= 2000
  - `PER_DIEM_MANAGEMENT_LODGING` = 2500
  - `PER_DIEM_DAY_TRIP` = 1000
  - `LODGING_CAP_STANDARD` = 10000
  - `LODGING_CAP_METRO` = 12000（東京23区・大阪市）
  - `METRO_PREFECTURE_CODES`（JSON）= 対象自治体コードの配列
  - `RECEIPT_REQUIRED_THRESHOLD` = 3000
  - `DEADLINE_DAYS` = 30
  - `DIRECTOR_APPROVAL_THRESHOLD` = 100000
  - `TRAIN_LIMITED_EXPRESS_RECEIPT_WAIVED` = true（R-06 の既定）
- `value` (string) — 値（数値・真偽・JSON いずれも文字列で保持し、アプリ層で解釈）。
- `effectiveFrom` (date) — 有効開始日（申請の出張終了日時点で最新の値を適用、FR-021）。
- `changedBy` (string) — 変更者の社員番号。
- `changeReason` (string) — 改定理由。
- `createdAt` (datetime)

**バリデーション**:

- `(ruleKey, effectiveFrom)` の複合一意。
- `effectiveFrom` が未来日の RuleValue は保存可（施行待ち）。
- 削除は不可（履歴は保持）。

### 2.3 `Holiday`

- `date` (date, 主キー) — 祝日の日付。
- `name` (string) — 祝日名。
- `addedBy` (string) — 追加者の社員番号。

### 2.4 `Application`

- `applicationNumber` (string, 主キー, 書式 `JP-YYYY-NNNNNN`) — 申請番号。URL にも
  この番号を使う（憲法 IV）。
- `applicantEmpNo` (string, FK → Employee) — 申請者。
- `department` (string) — 申請時点の所属（スナップショット）。
- `tripStartDate` (date), `tripEndDate` (date) — 出張期間。
- `destination` (string) — 行先。
- `purpose` (string) — 目的。
- `totalAmountYen` (int) — 合計金額（システム算出、明細の合計）。
- `status` (enum、下記 § 3 の状態遷移を参照)。
- `submittedAt` (datetime, nullable)
- `firstApprovedAt` (datetime, nullable) — 所属長承認日時。
- `finalApprovedAt` (datetime, nullable) — 部長／経理部長／上位者の最終承認日時。
- `accountingFinalizedAt` (datetime, nullable) — 経理確定日時。
- `paidAt` (datetime, nullable) — 支払済み日時（CSV 出力後に、人手で更新する運用、
  本機能のスコープはここまで）。
- `withdrawnAt` (datetime, nullable)
- `nextApproverEmpNo` (string, nullable, FK → Employee) — 現在の承認待ち相手。
- `createdAt`, `updatedAt` (datetime)

**バリデーション**:

- `tripStartDate <= tripEndDate`。
- `department` は提出時にスナップショット。経理確定後の社員異動では変化しない。
- `totalAmountYen >= 0`。
- `status = DRAFT` または `REMANDED` 以外では、`applicantEmpNo` は変更不可（アプリ側
  検査）。
- `BR-010`: 同一申請者で `status NOT IN (DRAFT, WITHDRAWN)` かつ出張期間が重なる既存の
  申請がある場合、提出不可。

### 2.5 `ExpenseLine`

- `id` (string, 主キー, ULID)
- `applicationNumber` (string, FK → Application)
- `date` (date) — 発生日。
- `category` (enum `TRANSPORT | LODGING | PER_DIEM | OTHER`)
- `fromPlace`, `toPlace` (string, nullable) — 交通費のみ必須。
- `transportMode` (enum `TRAIN | SHINKANSEN | BUS | TAXI | FLIGHT | OTHER`, nullable)
- `amountYen` (int) — 金額（PER_DIEM はシステムが設定、申請者は編集不可）。
- `isSystemGenerated` (boolean) — PER_DIEM など、システム生成の明細に `true`。
- `taxiReasons` (JSON array of enum `AFTER_22` | `HEAVY_LUGGAGE` | `CUSTOMER_RIDE`,
  nullable) — BR-005 の例外事由（タクシー明細に 1 件以上必須）。
- `exceedsLodgingCapReason` (string, nullable) — BR-003 の超過理由。
- `remarks` (string, nullable)

**バリデーション**:

- `category = TRANSPORT` のとき `fromPlace`、`toPlace`、`transportMode` 必須。
- `category = PER_DIEM` のとき `isSystemGenerated = true`、`amountYen` はシステム算出
  （BR-002）に一致、`transportMode` は null。
- `category = LODGING` で `amountYen > 地域別上限` のとき `exceedsLodgingCapReason`
  必須（BR-003）。
- `transportMode = TAXI` のとき `taxiReasons` に 1 件以上の値（BR-005、FR-027）。

### 2.6 `Receipt`

- `id` (string, 主キー, ULID)
- `expenseLineId` (string, FK → ExpenseLine)
- `storagePath` (string) — `./data/uploads/<申請番号>/<ULID>.<ext>`
- `mimeType` (string, enum `image/jpeg | image/png`)
- `sizeBytes` (int) — 10MB 以下。
- `sha256` (string) — 差替え判定に使う。
- `uploadedAt` (datetime)
- `isSupportingDocument` (boolean) — 支払証明書（EX-002）の場合 true。
- `supportingReason` (string, nullable) — 支払証明書の理由（EX-002）。

**バリデーション**:

- 同一の `expenseLineId` に対して、画像枚数の上限は 20 枚、合計 30MB
  （FR-003 とスコープ内の既定）。
- `mimeType` は `image/jpeg` または `image/png` のみ。
- `isSupportingDocument = true` のとき `supportingReason` 必須。

### 2.7 `ApprovalHistory`

- `id` (string, 主キー, ULID)
- `applicationNumber` (string, FK → Application)
- `operatorEmpNo` (string, FK → Employee)
- `actedAs` (enum `SELF | PROXY`) — 代理承認か否か。
- `operation` (enum `SUBMIT | APPROVE | REMAND | ACCOUNTING_FINALIZE |
   ACCOUNTING_REMAND | ACCOUNTING_UNDO | WITHDRAW | CSV_EXPORT`)
- `comment` (string, nullable) — 差戻し・取消では必須。
- `occurredAt` (datetime)

**バリデーション**:

- `operation IN (REMAND, ACCOUNTING_REMAND, ACCOUNTING_UNDO)` のとき `comment` 必須
  （FR-011、FR-023）。

### 2.8 `ProxyApproverAssignment`

- `id` (string, 主キー, ULID)
- `principalEmpNo` (string, FK → Employee) — 代理を立てる所属長本人。
- `proxyEmpNo` (string, FK → Employee) — 代理承認者（部長）。
- `startsAt`, `endsAt` (datetime)
- `createdBy` (string, FK → Employee) — 設定者（本人または上位者）。
- `createdAt` (datetime)

**バリデーション**:

- `endsAt - startsAt >= 3 営業日`（BR-012）。
- `principalEmpNo != proxyEmpNo`。
- 重複する期間の指名は不可（1 principal につき 1 期間）。

### 2.9 `Notification`

- `id` (string, 主キー, ULID)
- `recipientEmpNo` (string, FK → Employee)
- `applicationNumber` (string, FK → Application, nullable) — 管理通知は null 可。
- `channel` (enum `EMAIL | IN_APP`)
- `templateId` (string) — `src/server/notifications/templates/*` のキー。
- `operation` (string) — 対応する `ApprovalHistory.operation` または管理イベント名。
- `sentAt` (datetime, nullable)
- `readAt` (datetime, nullable) — IN_APP のみ。
- `deliveryStatus` (enum `PENDING | SENT | FAILED`, nullable) — EMAIL のみ。
- `failureReason` (string, nullable)

**バリデーション**:

- 本文列は持たない（個人情報露出の予防、FR-022）。表示時にテンプレート ID と
  申請番号から日本語本文を生成する。

### 2.10 `PaymentCsvExport`

- `id` (string, 主キー, ULID)
- `cutoffDate` (date) — 締め日。
- `paymentDate` (date) — 支払予定日（翌月10日）。
- `includedApplicationNumbers` (JSON array of string) — スナップショット（BR-011、
  FR-015）。
- `rowCount` (int)
- `totalAmountYen` (int)
- `layoutVersion` (string) — 採用した会計システム側のレイアウトのバージョン（FR-016）。
- `exportedByEmpNo` (string, FK → Employee)
- `exportedAt` (datetime)
- `fileRelativePath` (string) — `./data/exports/<cutoffDate>-<layoutVersion>.csv`

### 2.11 `HrImportResult`

- `id` (string, 主キー, ULID)
- `importedByEmpNo` (string, FK → Employee) — 実行したシステム管理者。
- `sourceFileName` (string)
- `status` (enum `SUCCESS | PARTIAL | FAILED`)
- `errorKind` (enum `FILE_MISSING | FORMAT_INVALID | COLUMN_MISSING | ROW_ERRORS |
   NONE`)
- `errorRows` (JSON) — 行単位エラーの一覧。
- `startedAt`, `finishedAt` (datetime)

### 2.12 `PiiAccessLog`

- `id` (string, 主キー, ULID)
- `accessorEmpNo` (string, FK → Employee)
- `applicationNumber` (string, nullable)
- `targetEmpNo` (string, nullable)
- `reasonCode` (enum `APPROVAL | ACCOUNTING | AUDIT | ADMIN_LOOKUP`)
- `freeNote` (string, nullable)
- `occurredAt` (datetime)

**バリデーション**: 個人情報を直接表示する画面を開いた時点で記録する（憲法 IV 監査）。

---

## 3. `Application.status` の状態遷移

```text
DRAFT
  ├─ submit → SECTION_MANAGER_APPROVAL
  └─ delete (下書き削除)

SECTION_MANAGER_APPROVAL
  ├─ approve (<=100,000円かつ所属長本人申請でない)
  │    └→ ACCOUNTING_REVIEW
  ├─ approve (>100,000円 または 所属長本人申請) → DIRECTOR_APPROVAL
  ├─ remand → REMANDED
  └─ withdraw → WITHDRAWN

DIRECTOR_APPROVAL
  ├─ approve (部長本人申請でない) → ACCOUNTING_REVIEW
  ├─ approve (部長本人申請) → ACCOUNTING_DIRECTOR_APPROVAL
  └─ remand → REMANDED

ACCOUNTING_DIRECTOR_APPROVAL (BR-009 により部長本人／経理担当本人)
  ├─ approve (経理部長本人申請でない) → ACCOUNTING_REVIEW
  ├─ approve (経理部長本人申請) → ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL
  └─ remand → REMANDED

ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL (経理部長本人の申請)
  ├─ approve → ACCOUNTING_REVIEW
  └─ remand → REMANDED

ACCOUNTING_REVIEW
  ├─ accounting_finalize → ACCOUNTING_FINALIZED
  └─ accounting_remand → REMANDED

ACCOUNTING_FINALIZED
  ├─ include_in_csv → ACCOUNTING_FINALIZED（paymentCsvExportId を関連）
  ├─ paid (人手の運用で更新) → PAID
  └─ accounting_undo (経理担当のみ) → REMANDED

REMANDED
  └─ resubmit → SECTION_MANAGER_APPROVAL（履歴は保持）

WITHDRAWN  (終端)
PAID       (終端)
```

- 承認・経理確定の経路分岐は、業務ルール `BR-008`／`BR-009` と権限表を純粋関数
  `src/domain/rules/next-approver.ts` にまとめ、1 箇所でテスト可能にする。
- 代理承認（BR-012）は、`nextApproverEmpNo` を解決するときに
  `ProxyApproverAssignment` を参照して、プリンシパルを代理に差し替える。
- `include_in_csv` は状態遷移としては `ACCOUNTING_FINALIZED` のまま、`Application`
  に `paymentCsvExportId` の関連を追加するという意味。

---

## 4. 関連図（主要なものだけ）

```text
Employee 1──* Application (applicant)
Employee 1──* Application (nextApprover)
Application 1──* ExpenseLine
ExpenseLine 1──* Receipt
Application 1──* ApprovalHistory
Employee 1──* ApprovalHistory (operator)
Employee 1──* ProxyApproverAssignment (principal)
Employee 1──* ProxyApproverAssignment (proxy)
Employee 1──* Notification (recipient)
Application 1──* Notification
PaymentCsvExport 1──* Application (snapshot)
Employee 1──* HrImportResult (importedBy)
Employee 1──* PiiAccessLog (accessor)
```

---

## 5. インデックス

- `Application(applicantEmpNo, status)` — 自分の申請一覧の高速化。
- `Application(nextApproverEmpNo, status)` — 承認・経理確定待ちの一覧。
- `Application(tripStartDate, tripEndDate, applicantEmpNo)` — BR-010 重複検出。
- `ApprovalHistory(applicationNumber, occurredAt)` — 履歴の時系列参照。
- `Notification(recipientEmpNo, readAt)` — 未読お知らせの取り出し。
- `RuleValue(ruleKey, effectiveFrom)` — 有効値の取り出し。
- `Receipt(expenseLineId)`。

---

## 6. ドメイン純粋関数の責務（データ変更を伴わない計算）

- `calculatePerDiem(trip, employee, ruleValues)` → `number`
- `isLodgingOverCap(line, ruleValues)` → `boolean`
- `isReceiptRequired(line, ruleValues)` → `boolean`
- `isWithinDeadline(submittedAt, tripEndDate, ruleValues)` → `boolean`
- `hasOverlappingTrip(applicant, newTrip, existingApplications)` → `Application | null`
- `nextApprover(application, proxyAssignments, employees)` → `Employee`
- `shouldAllowSelfApproval(application, operator)` → `false`（BR-009）
- `cutoffPaymentDate(cutoffDate, holidays)` → `date`（BR-011）
- `effectiveRuleValue(ruleKey, date, ruleValues)` → `RuleValue`

これらは `src/domain/` 配下に 1 関数 1 ファイルで配置し、`tests/unit/domain/` で
境界値を含むテストを用意する（憲法 III）。
