---
description: "機能実装向けのタスクリスト"
---

# タスク: 旅費精算（申請〜経理確定〜支払用 CSV 出力）

**入力**: `/specs/001-travel-expense-reimbursement/` の設計ドキュメント

**前提条件**:

- [plan.md](./plan.md)（技術スタック: Next.js 15 + TS 5.6 + Prisma + SQLite）
- [spec.md](./spec.md)（US1 P1、US2 P1、US3 P2、US4 P1）
- [research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/](./contracts/)、[quickstart.md](./quickstart.md)
- [constitution.md](../../.specify/memory/constitution.md)

**テスト**: 本プロジェクトは憲法 III（業務ルールはテストで検証、NON-NEGOTIABLE）に
より、業務ルール BR-### と業務上の例外処理 EX-### には自動テストを**必ず**先に
用意する。契約テスト（Vitest）と E2E（Playwright）も同じ順序で先行させる。

**構成**: タスクはユーザーストーリー単位でグループ化し、各ストーリーを独立して
実装・テストできるようにする。

## 形式: `[ID] [P?] [Story] 説明`

- **[P]**: 並列実行可能（別ファイル、依存なし）
- **[Story]**: US1／US2／US3／US4
- 説明には正確なファイルパスと、該当する BR-###／EX-###／FR-###／SC-### を明示する

## パス規約

本機能は Web アプリケーション（Next.js App Router 単一アプリ）。パスは plan.md の
「ソースコード（リポジトリルート）」の構成に従う。

---

## フェーズ1: セットアップ（共通基盤）

**目的**: Next.js 雛形の移送、依存関係の導入、プロジェクト構造の整備

- [X] T001 一時フォルダ `%TEMP%\next-scaffold-<timestamp>\travel-expense-app\` で `npx create-next-app@latest` を実行し、生成された `src/`、`app/`、`public/`、`package.json`、`tsconfig.json`、`next.config.mjs`、`tailwind.config.ts`、`postcss.config.mjs`、`.eslintrc.json` を `C:\dev\projects\travel-expense\` へ移送する（quickstart.md § 2 の手順）。既存の `CLAUDE.md`／`.specify/`／`docs/`／`specs/` は上書きしない。`.git` と `node_modules` は移送しない。
- [X] T002 `C:\dev\projects\travel-expense\package.json` の依存関係に `prisma @prisma/client better-sqlite3 zod iron-session date-fns date-fns-tz ulid @tailwindcss/forms pino` を追加し、`npm install` を実行する
- [X] T003 [P] `C:\dev\projects\travel-expense\package.json` の devDependencies に `vitest @vitest/ui @vitejs/plugin-react playwright @playwright/test tsx @types/better-sqlite3 eslint-plugin-tailwindcss` を追加し、`npx playwright install chromium webkit` を実行する
- [X] T004 [P] `C:\dev\projects\travel-expense\CLAUDE.md` の末尾に空行 1 行を挟んで `@AGENTS.md` の 1 行だけを追記する（既存の本文は変更しない）
- [X] T005 [P] `C:\dev\projects\travel-expense\AGENTS.md` を新規作成する。内容は、本機能は `/speckit-*` ワークフローで駆動、業務ルール変更はテスト先行（憲法 III）、`npm run check` をコミット前必須、文言は `src/i18n/ja.ts` 集約(憲法 I)、PII を URL／ログ／外部送信に出さない（憲法 IV、FR-019）、の 5 項目を日本語で明記する
- [X] T006 [P] `C:\dev\projects\travel-expense\tsconfig.json` の `compilerOptions` に `"strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true, "noImplicitOverride": true` を追加する（research.md § 3）
- [X] T007 [P] `C:\dev\projects\travel-expense\.eslintrc.json` に `@typescript-eslint/recommended`、`plugin:tailwindcss/recommended` を適用し、`no-console: ["error", { allow: ["warn", "error"] }]` を設定する
- [X] T008 [P] `C:\dev\projects\travel-expense\vitest.config.ts` を作成し、`environment: "node"`、`include: ["tests/**/*.spec.ts"]`、`setupFiles: ["tests/setup.ts"]` を設定する
- [X] T009 [P] `C:\dev\projects\travel-expense\playwright.config.ts` を作成し、`projects: [{name:"Desktop Chrome", use: devices["Desktop Chrome"]}, {name:"iPhone 13", use: devices["iPhone 13"]}]`、`webServer: { command: "npm run dev", url: "http://localhost:3000" }` を設定する（FR-029、SC-009）
- [X] T010 [P] `C:\dev\projects\travel-expense\package.json` の `scripts` に `dev`、`build`、`start`、`typecheck`（`tsc --noEmit`）、`lint`、`test:unit`（Vitest）、`test:contract`（`vitest run --dir tests/contract`）、`test:e2e`（Playwright）、`scan:pii`（`node scripts/scan-pii.mjs`）、`check`（上記 5 つを順に実行）、`db:migrate`、`db:seed`、`db:studio` を追加する
- [X] T011 [P] 空ディレクトリ `src/domain/rules/`、`src/server/`、`src/i18n/`、`src/components/`、`app/`、`tests/unit/domain/rules/`、`tests/contract/api/`、`tests/e2e/`、`scripts/`、`data/`、`data/uploads/`、`data/mail/`、`data/exports/`、`prisma/` を作成する
- [X] T012 [P] `C:\dev\projects\travel-expense\.gitignore` に `node_modules/`、`.next/`、`data/`、`.env*`、`playwright-report/`、`test-results/`、`coverage/` を追記する

---

## フェーズ2: 基盤構築（ブロッキング前提）

**目的**: すべてのユーザーストーリーが依存する中核基盤を整える

**⚠️ 重要**: このフェーズが完了するまで、ユーザーストーリー（US1〜US4）の作業は
一切開始できない

- [X] T013 `prisma/schema.prisma` に data-model.md § 2 の 12 エンティティ（Employee、RuleValue、Holiday、Application、ExpenseLine、Receipt、ApprovalHistory、ProxyApproverAssignment、Notification、PaymentCsvExport、HrImportResult、PiiAccessLog）と列定義、enum、関連、§ 5 のインデックスを定義する
- [X] T014 `npx prisma migrate dev --name init` でローカル SQLite マイグレーションを生成し、`prisma/migrations/` に初期スキーマを配置する
- [X] T015 `src/server/db/client.ts` に `PrismaClient` シングルトン（開発時 HMR で複数接続を作らないガード）を実装する
- [X] T016 [P] `src/server/db/seed.ts` を実装し、quickstart.md § 5 の既定社員 7 名（E0001 山田 太郎／E0010 鈴木 花子／E0020 佐藤 次郎／E0030 高橋 三郎／E0040 田中 四郎／E0050 伊藤 五郎／E9000 管理者）と、既定の規程値（PER_DIEM_* / LODGING_CAP_* / RECEIPT_REQUIRED_THRESHOLD=3000 / DEADLINE_DAYS=30 / DIRECTOR_APPROVAL_THRESHOLD=100000 / TRAIN_LIMITED_EXPRESS_RECEIPT_WAIVED=true）、2026 年の日本の祝日（Holiday）をシードする
- [X] T017 [P] `src/domain/types.ts` に共通 Zod スキーマと列挙を定義する（`ApplicationStatus`、`ExpenseCategory`、`TransportMode`、`EmployeeRole`、`ApprovalOperation`、`TaxiReason`、`NotificationTemplateId` ほか data-model.md と contracts/ に出現するすべて）
- [X] T018 [P] `src/domain/money.ts` の `Amount` 値オブジェクト（円単位の整数、切り捨てを一箇所に集約）と、`tests/unit/domain/money.spec.ts` の境界値テスト（0 円、負値禁止、浮動小数点が入ったときの拒否）を実装する（憲法 追加の制約・金額）
- [X] T019 [P] `src/domain/holidays.ts`（DB の `Holiday` を参照して祝日判定）と、`src/domain/workdays.ts`（営業日計算、BR-011／BR-012 の両方で使う）、`tests/unit/domain/workdays.spec.ts`（25 日が土日・祝日の前営業日調整、3 営業日以上の判定境界）を実装する
- [X] T020 [P] `src/i18n/ja.ts` に、画面文言キー → 日本語の辞書を初期セットで用意する（ロール名、操作名、エラーメッセージ、ステータス名、業務ルール違反メッセージの雛形）。英数字と記号は CSV・PDF・ID の固有名詞に限る（憲法 I）
- [X] T021 [P] `src/server/errors/to-user-message.ts` に、例外・Zod エラー・業務ルール違反を日本語メッセージへ変換する関数を実装する。英語の技術例外や `undefined`／`null` 文字列を UI に露出させないガードを含める（FR-018、憲法 I）
- [X] T022 [P] `src/server/log.ts` に Pino ロガーを初期化し、`redact: ["req.body.name", "req.body.empNo", "req.body.amount", "req.body.destination", "req.body.account*", "*.receipt*"]` などの PII 伏せ字パターンを定義する（憲法 IV、FR-019）
- [X] T023 [P] `src/server/auth/session.ts` に `getCurrentUser()` の関数境界を実装する（iron-session からログイン済み社員番号を読み、`Employee` レコードを返す。未ログイン時は `null`）。SSO 実装への差し替え点となる唯一のモジュール（FR-030）
- [X] T024 `src/server/auth/dev-login.ts` に、簡易ログイン（利用者切替）の実装を書く。`iron-session` の設定は `HttpOnly, SameSite=Lax`、Secure は `NODE_ENV=production` のみ（contracts/admin.md § 1）
- [X] T025 `src/server/auth/authorize.ts` に、権限表（spec.md § 業務要件 > 権限）を忠実に実装した単一関数 `authorize({ operation, user, application })` を書き、`src/i18n/ja.ts` のキー `error.forbidden`（＝「権限がありません」）で 403 相当エラーを投げられるようにする（憲法 II、FR-020）
- [X] T026 [P] `src/server/notifications/mailer.ts` にファイル保存トランスポートを実装する（`./data/mail/<ULID>.eml`）。SMTP 実装への差し替え点（research.md § 9）
- [X] T027 [P] `src/server/notifications/inbox.ts` に `enqueueNotification({ recipientEmpNo, applicationNumber, templateId, operation })` を実装し、EMAIL と IN_APP の 2 レコードを作る（contracts/notifications.md § 1、FR-022）
- [X] T028 [P] `src/server/notifications/templates/` に日本語テンプレートを配置する（SUBMITTED_TO_APPROVER／SUBMITTED_SELF_CONFIRM／APPROVED_TO_APPLICANT／APPROVED_TO_NEXT_APPROVER／REMANDED_TO_APPLICANT／ACCOUNTING_FINALIZED_TO_APPLICANT／ACCOUNTING_REMAND_TO_APPLICANT／CSV_EXPORTED_TO_ACCOUNTING／HR_IMPORT_FAILED_TO_ADMIN／HR_IMPORT_FAILED_TO_ACCOUNTING／PROXY_ASSIGNED）。本文には申請番号と操作名のみを埋め込み、PII を含めない（FR-022、憲法 IV）
- [X] T029 [P] `src/server/storage/receipts.ts` に、領収書画像のローカル保存（`./data/uploads/<申請番号>/<ULID>.<ext>`）、SHA-256 計算、サイズ・MIME の検査（JPEG／PNG、10MB／合計 30MB／最大 20 枚）を実装する（FR-003）
- [X] T030 [P] `src/domain/id.ts` に、申請番号（`JP-YYYY-NNNNNN`、年ごとの連番）と ULID の生成関数を実装する（research.md § 残課題）
- [X] T031 [P] `scripts/scan-pii.mjs` に、`console.*` と `logger.info/warn/error` の第 2 引数に PII キーワード（`name|empNo|amount|destination|account|receipt|address`）を直接渡しているコードを AST で検出するスキャナを実装する。違反は非 0 で終了する（憲法 IV、SC-008）
- [X] T032 [P] `tests/setup.ts` に Vitest のグローバルセットアップ（タイムゾーン `Asia/Tokyo` 固定、Prisma の SQLite in-memory 切替）を実装する
- [X] T033 [P] `src/server/pii-access.ts` に `logPiiAccess({ accessor, application, target, reasonCode, freeNote })` を実装し、個人情報を直接表示する画面・API ハンドラの先頭で呼び出せるようにする（憲法 IV 監査、FR-017）
- [X] T034 `app/layout.tsx` に、`lang="ja"`、Noto Sans JP フォント（`next/font/google` でセルフホスト）、Tailwind のベースクラス、`viewport` の `width=device-width` 設定、`SessionProvider` を組み込む（FR-029、憲法 I）
- [X] T035 契約テスト先行: `tests/contract/api/admin-auth.spec.ts` を作成し、`GET /api/auth/switchable-users`、`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me` の入出力を contracts/admin.md § 1 の定義どおりに検証する（まだ実装がないため **失敗する** ことを確認）
- [X] T036 `app/api/auth/switchable-users/route.ts`、`app/api/auth/login/route.ts`、`app/api/auth/logout/route.ts`、`app/api/auth/me/route.ts` を実装し、T035 の契約テストが通ることを確認する
- [X] T037 [P] `app/(public)/login/page.tsx`（利用者切替の簡易ログイン画面）を実装する。文言は `src/i18n/ja.ts` から読む（憲法 I）
- [X] T038 [P] `src/components/ConfirmationDialog.tsx`（不可逆操作用、件数・内容を要約表示）を実装する（憲法 II）

**チェックポイント**: 基盤が整った — ユーザーストーリー US1〜US4 を並列に開始できる

---

## フェーズ3: ユーザーストーリー1 - 申請者が旅費精算を画面から作成し提出する (優先度: P1) 🎯 MVP

**ゴール**: 申請者が、Excel と乗換案内を往復せず、Web 画面で下書き作成・明細追加・
領収書添付・自動検査・提出・取下げまでを完結できる状態にする。

**独立テスト**: 申請者（E0001 山田 太郎）でログインし、`/applications/new` で
下書きを作って提出・取下げまで一通り操作でき、BR-001〜BR-006／BR-010／BR-013 の
違反が日本語メッセージで提出をブロックすることを、Playwright の Desktop Chrome と
iPhone 13 プロファイルの両方で確認する（SC-001〜SC-002、SC-007、SC-009）。

### ユーザーストーリー1 の業務ルールテスト（先行）⚠️

> **重要**: 以下のテストを実装より先に書き、`npm run test:unit` で失敗することを
> 確認してから対応する実装タスクに進む（憲法 III）。

- [X] T039 [P] [US1] 申請期限ルール BR-001 の単体テスト `tests/unit/domain/rules/BR-001.deadline.spec.ts`: 出張終了日の翌日から 30 日目 23:59 は期限内、31 日目は EX-006 経路に切り替わる、を検証
- [X] T040 [P] [US1] 日当ルール BR-002 の単体テスト `tests/unit/domain/rules/BR-002.per-diem.spec.ts`: 一般社員 宿泊 2,000円/日、管理職 宿泊 2,500円/日、日帰り片道 100km 以上 1,000円、出発日と帰着日も 1 日として数える、を検証
- [X] T041 [P] [US1] 宿泊費上限ルール BR-003 の単体テスト `tests/unit/domain/rules/BR-003.lodging-cap.spec.ts`: 標準 1 泊 10,000円、東京23区・大阪市 12,000円、上限超過時は `exceedsLodgingCapReason` 必須、を検証
- [X] T042 [P] [US1] 経済的経路ルール BR-004 の単体テスト `tests/unit/domain/rules/BR-004.economic-route.spec.ts`: 新幹線・特急は片道 100km 以上で可、グリーン車は役職を問わず不可、を検証
- [X] T043 [P] [US1] タクシー例外ルール BR-005 の単体テスト `tests/unit/domain/rules/BR-005.taxi-exceptions.spec.ts`: 例外事由が `AFTER_22`／`HEAVY_LUGGAGE`／`CUSTOMER_RIDE` のいずれか 1 件以上あれば受理、未選択はブロック、を検証（FR-027）
- [X] T044 [P] [US1] 領収書要否ルール BR-006 の単体テスト `tests/unit/domain/rules/BR-006.receipts.spec.ts`: 1 件 3,000円以上は領収書必須、宿泊費・タクシーは金額にかかわらず必須、電車・バス・新幹線・特急の運賃は不要（Q-06 の確定を踏襲）、を検証
- [X] T045 [P] [US1] 重複出張ルール BR-010 の単体テスト `tests/unit/domain/rules/BR-010.no-overlap.spec.ts`: 同一申請者で `status NOT IN (DRAFT, WITHDRAWN)` かつ出張期間が重なる既存申請がある場合は提出不可、を検証
- [X] T046 [P] [US1] 契約テスト `tests/contract/api/applications.spec.ts` を contracts/applications.md § 1〜7 どおりに作成する（下書き作成 201、提出時の 409 重複、不備時の 400 メッセージ構造、取下げ 409、申請一覧の PII 範囲）。権限表（spec.md § 業務要件 > 権限）の「他人の申請を作成・編集／取下げる」「他部署の申請を見る」などの「×」行について、申請者が他人の申請番号に対して各エンドポイントを呼ぶと 403 相当（`error:"権限がありません"`）になることを**ネガティブケース**として必ず含める

### ユーザーストーリー1 のドメイン実装

- [X] T047 [P] [US1] BR-001 の実装 `src/domain/rules/BR-001.deadline.ts`（出張終了日 + 30 日の判定、`effectiveRuleValue(DEADLINE_DAYS, tripEndDate)` を参照）
- [X] T048 [P] [US1] BR-002 の実装 `src/domain/rules/BR-002.per-diem.ts`（`calculatePerDiem(trip, employee, ruleValues)`、日数計算は出発日と帰着日も 1 日）
- [X] T049 [P] [US1] BR-003 の実装 `src/domain/rules/BR-003.lodging-cap.ts`（地域別上限、`METRO_PREFECTURE_CODES` の JSON を参照、超過時は要理由）
- [X] T050 [P] [US1] BR-004 の実装 `src/domain/rules/BR-004.economic-route.ts`（距離 100km 未満の新幹線・特急を拒否、グリーン車を拒否）
- [X] T051 [P] [US1] BR-005 の実装 `src/domain/rules/BR-005.taxi-exceptions.ts`（タクシー明細に `taxiReasons[]` 1 件以上必須）
- [X] T052 [P] [US1] BR-006 の実装 `src/domain/rules/BR-006.receipts.ts`（`isReceiptRequired(line)`、宿泊費・タクシーは金額にかかわらず true、電車・バス・新幹線・特急の運賃は false）
- [X] T053 [P] [US1] BR-010 の実装 `src/domain/rules/BR-010.no-overlap.ts`（`hasOverlappingTrip(applicant, newTrip, existing)` が重複申請を返す）
- [X] T054 [US1] BR-013 の UI 注意事項を `src/i18n/ja.ts` に `applicationNew.receiptRetentionNotice` として登録する（原本は精算が「経理確定」になるまで申請者が保管）
- [X] T055 [US1] `src/domain/rules/next-approver.ts` の US1 分（提出直後の初期承認者 = 申請者の直属所属長）を実装し、`tests/unit/domain/rules/next-approver.us1.spec.ts` も用意する（BR-007 と連動、US2 でさらに拡張）

### ユーザーストーリー1 のルートハンドラ実装

- [X] T056 [US1] `app/api/applications/drafts/route.ts` の POST を実装する（contracts/applications.md § 1、入力 Zod 検証、`src/domain/id.ts` で `applicationNumber` 生成）
- [X] T057 [US1] `app/api/applications/by-number/[applicationNumber]/route.ts` の GET を実装する（contracts/applications.md § 2、認可は申請者本人／次承認者／経理担当・経理部長／システム管理者、PII 画面表示は `logPiiAccess` を呼ぶ）
- [X] T058 [US1] `app/api/applications/[applicationNumber]/lines/route.ts` の PUT を実装する（contracts/applications.md § 3、BR-002 で PER_DIEM 行を上書き、FR-004、BR-003 の `exceedsLodgingCapReason` チェック、BR-005 の `taxiReasons` チェック）
- [X] T059 [US1] `app/api/applications/[applicationNumber]/receipts/route.ts` の POST を実装する（contracts/applications.md § 4、`src/server/storage/receipts.ts` を呼ぶ、`isSupportingDocument` と `supportingReason` の整合）
- [X] T060 [US1] `app/api/applications/[applicationNumber]/submit/route.ts` の POST を実装する（contracts/applications.md § 5、BR-001・BR-005・BR-006・BR-010 の最終チェック、`nextApprover` 解決、`ApprovalHistory` に SUBMIT 記録、通知発行 `SUBMITTED_TO_APPROVER` と `SUBMITTED_SELF_CONFIRM`）
- [X] T061 [US1] `app/api/applications/[applicationNumber]/withdraw/route.ts` の POST を実装する（contracts/applications.md § 6、所属長が承認する前のみ、通知 `WITHDRAWN_SELF_CONFIRM` を発行）
- [X] T062 [US1] `app/api/applications/mine/route.ts` の GET を実装する（contracts/applications.md § 7、本人のみ、クエリに PII を乗せない FR-019）

### ユーザーストーリー1 のUI実装

- [X] T063 [P] [US1] `app/(authed)/applications/new/page.tsx` を実装する（下書き作成フォーム、BR-013 注意事項の表示、BR-001 の期限リマインダ、業務担当者ファーストの用語を採用 — 用語集準拠）
- [X] T064 [P] [US1] `app/(authed)/applications/drafts/page.tsx` を実装する（自分の下書き一覧、BR-010 の重複警告バッジ）
- [X] T065 [P] [US1] `app/(authed)/applications/by-number/[applicationNumber]/page.tsx` を実装する（明細の追加・編集・削除、領収書添付、BR-003 の超過理由、BR-005 のタクシー事由、BR-006 の領収書要否バッジ、提出・取下げボタンに ConfirmationDialog）
- [X] T066 [US1] EX-002 領収書紛失の UI フロー: `page.tsx` 上で `isSupportingDocument` チェックを使う入力を追加し、`supportingReason` の必須検査を実装する（FR-003、US1 のシナリオで所属長の画面上の承認で成立）
- [X] T067 [US1] EX-003 出張途中の予定変更: `page.tsx` の明細ごとに「備考」欄を実装し、延泊・行先追加の経緯を記入する運用を可能にする

### ユーザーストーリー1 の受け入れ検証

- [X] T068 [US1] E2E テスト `tests/e2e/us1-applicant.spec.ts` を Playwright で実装する。US1 の受け入れシナリオ 1〜6 を Desktop Chrome と iPhone 13 の両プロファイルで実行し、SC-002（10 分以内）／SC-007（日本語化 100%）／SC-009（スマホで PC と同じ手順）を観測可能にする

**チェックポイント**: この時点で US1 は完全に機能し、独立してテスト可能であること

---

## フェーズ4: ユーザーストーリー2 - 所属長が外出先からでも承認・差戻しする (優先度: P1)

**ゴール**: 所属長が社外からでも Web 画面で承認・差戻し（コメント必須）を実行でき、
3 営業日以上の長期不在時には部長への代理承認指名を使って回付を止めない状態にする。

**独立テスト**: 鈴木 花子（E0010）でログインし、山田（E0001）の提出済み申請を
`/approvals` で承認／差戻し／代理指名／履歴参照できること、他部署の申請が一覧に
出ないこと、BR-009 により自分の申請が自分の承認対象に出ないことを、Desktop Chrome
と iPhone 13 の両方で確認する（SC-003、SC-007）。

### ユーザーストーリー2 の業務ルールテスト（先行）⚠️

- [X] T069 [P] [US2] BR-007 所属長承認ルールの単体テスト `tests/unit/domain/rules/BR-007.manager-approval.spec.ts`: すべての申請が所属長の承認を経ることを `nextApprover` の初期値で検証
- [X] T070 [P] [US2] BR-009（所属長本人申請）の単体テスト `tests/unit/domain/rules/BR-009.section-manager-self.spec.ts`: 申請者本人が所属長の場合、`nextApprover` が部長になり、所属長本人の承認対象には現れない、を検証
- [X] T071 [P] [US2] BR-012 代理承認指名の単体テスト `tests/unit/domain/rules/BR-012.proxy-approver.spec.ts`: 開始〜終了が 3 営業日以上必須、重複期間不可、代理期間中は `nextApprover` を部長に差し替え、を検証（営業日計算は `src/domain/workdays.ts` を再利用）
- [X] T072 [P] [US2] 契約テスト `tests/contract/api/approvals.spec.ts` を contracts/approvals.md § 1〜6 どおりに作成する（承認待ち一覧の範囲、承認 200・差戻し 400（コメント空）、代理指名 201、代理削除時の `reassignedApplications`、履歴の時系列）。権限表の「申請を承認・差戻しする」の「×」ロール（申請者・経理担当）と、「△」の範囲外（他部署の申請、所属長本人申請、BR-009 自己承認）を**ネガティブケース**として含め、いずれも 403 相当を返すことを検証する

### ユーザーストーリー2 のドメイン実装

- [X] T073 [P] [US2] BR-007 の実装 `src/domain/rules/BR-007.manager-approval.ts`
- [X] T074 [P] [US2] BR-009（所属長本人申請）の実装 `src/domain/rules/BR-009.section-manager-self.ts`（`src/domain/rules/next-approver.ts` から呼び出す）
- [X] T075 [P] [US2] BR-012 の実装 `src/domain/rules/BR-012.proxy-approver.ts`
- [X] T076 [US2] `src/domain/rules/next-approver.ts` の US2 分（代理承認差し替え、所属長本人申請時の部長へのルーティング）を拡張する

### ユーザーストーリー2 のルートハンドラ実装

- [X] T077 [US2] `app/api/approvals/pending/route.ts` の GET を実装する（contracts/approvals.md § 1、認可はログイン利用者のロールと `nextApproverEmpNo` で絞る、FR-009／FR-020、PII 画面表示は `logPiiAccess` を呼ぶ）
- [X] T078 [US2] `app/api/approvals/[applicationNumber]/approve/route.ts` の POST を実装する（contracts/approvals.md § 2、BR-009 の自己承認禁止、代理承認時の `ApprovalHistory.actedAs=PROXY`、次承認者に `APPROVED_TO_NEXT_APPROVER`、申請者に `APPROVED_TO_APPLICANT` の通知を発行、EX-001 連動）
- [X] T079 [US2] `app/api/approvals/[applicationNumber]/remand/route.ts` の POST を実装する（contracts/approvals.md § 3、コメント空は 400、申請者に `REMANDED_TO_APPLICANT` の通知、EX-005 の履歴保持 FR-025）
- [X] T080 [US2] `app/api/approvals/proxy-assignments/route.ts` の POST を実装する（contracts/approvals.md § 4、BR-012 の 3 営業日以上と重複チェック、通知 `PROXY_ASSIGNED`）
- [X] T081 [US2] `app/api/approvals/proxy-assignments/[id]/route.ts` の DELETE を実装する（contracts/approvals.md § 5、取消後に進行中の承認対象を本人へ再割当て）
- [X] T082 [US2] `app/api/approvals/history/[applicationNumber]/route.ts` の GET を実装する（contracts/approvals.md § 6、FR-017、関係者のみ）

### ユーザーストーリー2 のUI実装

- [X] T083 [P] [US2] `app/(authed)/approvals/page.tsx` を実装する（承認待ち一覧、代理指名による振替表示、`actedAs` の表示、`requiredBy` のフィルタ）
- [X] T084 [P] [US2] `app/(authed)/approvals/[applicationNumber]/page.tsx` を実装する（詳細表示、承認・差戻し操作、ConfirmationDialog、差戻しコメント必須）
- [X] T085 [P] [US2] `app/(authed)/approvals/proxy-assignments/page.tsx` を実装する（代理指名の作成・一覧・取消、BR-012 の 3 営業日以上の UI バリデーション）
- [X] T086 [US2] アプリ内のお知らせ画面 `app/(authed)/notifications/page.tsx` を実装する（contracts/notifications.md § 2、既読操作と自動既読の反映）

### ユーザーストーリー2 の受け入れ検証

- [X] T087 [US2] E2E テスト `tests/e2e/us2-manager.spec.ts` を Playwright で実装する。US2 の受け入れシナリオ 1〜6 を Desktop Chrome と iPhone 13 の両方で実行する（SC-003 を観測）

**チェックポイント**: この時点で US1・US2 がそれぞれ独立して動作し、申請〜所属長
承認までのフローが成立していること

---

## フェーズ5: ユーザーストーリー3 - 部長が高額・期限超過を追加承認する (優先度: P2)

**ゴール**: 部長が、申請合計 100,000円超の案件、申請期限を超過した案件、所属長本人
の申請、代理指名案件、および部長本人の精算（経理部長が承認）を Web 画面で追加承認
できる状態にする。

**独立テスト**: 佐藤 次郎（E0020、部長）でログインし、該当案件のみが
`/approvals` に表示されること、田中 四郎（E0040、経理部長）でログインしたときに
部長本人の精算申請が経理部長の対象として現れること、伊藤 五郎（E0050、経理部長の
上位者）で経理部長本人の精算申請が対象として現れることを確認する（SC-003 を US3
でも維持）。

### ユーザーストーリー3 の業務ルールテスト（先行）⚠️

- [X] T088 [P] [US3] BR-008 部長承認ルールの単体テスト `tests/unit/domain/rules/BR-008.director-approval.spec.ts`: 合計 100,000円ちょうどは所属長のみで経理に進む、100,001円以上は部長の承認を要する、を検証
- [X] T089 [P] [US3] BR-014 部長本人申請の単体テスト `tests/unit/domain/rules/BR-014.director-own.spec.ts`: 部長本人の精算申請は経理部長が承認する、を検証
- [X] T090 [P] [US3] EX-006 期限超過の単体テスト `tests/unit/domain/rules/EX-006.deadline-exceeded.spec.ts`: 31 日目以降の提出は遅延理由必須、提出後は部長の追加承認を要する、を検証（FR-010(b)）
- [X] T091 [P] [US3] BR-009（経理部長本人申請）の単体テスト `tests/unit/domain/rules/BR-009.accounting-director-self.spec.ts`: 経理部長本人の精算は経理部長の上位者が承認・経理確定する、を検証

### ユーザーストーリー3 のドメイン実装

- [X] T092 [P] [US3] BR-008 の実装 `src/domain/rules/BR-008.director-approval.ts`
- [X] T093 [P] [US3] BR-014 の実装 `src/domain/rules/BR-014.director-own.ts`
- [X] T094 [P] [US3] EX-006 の実装 `src/domain/rules/EX-006.deadline-exceeded.ts`（期限超過時に `lateReason` 必須、`nextApprover` を強制的に部長に）
- [X] T095 [P] [US3] BR-009（経理部長本人）の実装 `src/domain/rules/BR-009.accounting-director-self.ts`
- [X] T096 [US3] `src/domain/rules/next-approver.ts` の US3 分（部長承認後の経路、ACCOUNTING_DIRECTOR_APPROVAL と ACCOUNTING_DIRECTOR_SUPERIOR_APPROVAL への分岐）を拡張する

### ユーザーストーリー3 のUI実装

- [X] T097 [US3] `app/(authed)/approvals/page.tsx` を拡張し、`requiredBy` に `DIRECTOR`／`ACCOUNTING_DIRECTOR`／`ACCOUNTING_DIRECTOR_SUPERIOR` を表示し、ロールに応じて並び替え・絞り込みする
- [X] T098 [US3] エッジケース「経理部長本人の精算で上位者未登録」の案内文言と提出時のバナーを `app/(authed)/applications/by-number/[applicationNumber]/page.tsx` と `src/i18n/ja.ts` に実装する（spec.md エッジケース、FR-030 連動）

### ユーザーストーリー3 の受け入れ検証

- [X] T099 [US3] E2E テスト `tests/e2e/us3-director.spec.ts` を Playwright で実装する。US3 の受け入れシナリオ 1〜5（部長の承認、期限超過経路、部長本人申請の経理部長承認、経理部長本人申請の上位者承認）を Desktop と iPhone の両方で実行する

**チェックポイント**: この時点で US1・US2・US3 がそれぞれ独立して動作し、追加承認
経路が業務ルールどおりに分岐すること

---

## フェーズ6: ユーザーストーリー4 - 経理担当が経理確定し支払用 CSV を出力する (優先度: P1)

**ゴール**: 経理担当が、承認済み申請を経理確定または差戻しし、月の締め日に支払用
CSV をスナップショットで出力できる状態にする。経理担当本人の精算は経理部長が、
経理部長本人の精算は経理部長の上位者が経理確定する。

**独立テスト**: 高橋 三郎（E0030、経理担当）でログインし、承認済み申請の経理確定と
差戻し、取消（FR-023）、締め日に基づく CSV 出力ができること、本人の申請が本人の
対象から外れることを、Desktop Chrome と iPhone 13 の両方で確認する（SC-004、
SC-005）。

### ユーザーストーリー4 の業務ルールテスト（先行）⚠️

- [X] T100 [P] [US4] BR-011 支払周期ルールの単体テスト `tests/unit/domain/rules/BR-011.payment-cycle.spec.ts`: 毎月 25 日、25 日が土日・祝日の場合は前営業日、翌月 10 日が支払予定日、を検証（`src/domain/workdays.ts` を再利用）
- [X] T101 [P] [US4] BR-015 経理担当本人申請の単体テスト `tests/unit/domain/rules/BR-015.accountant-own.spec.ts`: 経理担当本人が申請者の場合、本人の経理確定対象には現れず、経理部長の対象になる、を検証
- [X] T102 [P] [US4] 契約テスト `tests/contract/api/accounting.spec.ts` を contracts/accounting.md § 1〜6 どおりに作成する（経理確定待ち一覧、確定 200、取消 200、CSV 出力の 200・409（既存スナップショット）、layoutVersion と列定義の既定 default-v1）。権限表の「経理確定・差戻しする」「支払用 CSV を出力する」の「×」ロール（申請者・所属長・部長）と「△」の範囲外（経理担当本人の申請を経理担当本人が経理確定、経理部長本人の申請を経理部長本人が経理確定）を**ネガティブケース**として含め、403 相当を返すことを検証する

### ユーザーストーリー4 のドメイン実装

- [X] T103 [P] [US4] BR-011 の実装 `src/domain/rules/BR-011.payment-cycle.ts`（`cutoffPaymentDate(cutoffDate, holidays)`）
- [X] T104 [P] [US4] BR-015 の実装 `src/domain/rules/BR-015.accountant-own.ts`
- [X] T105 [US4] `src/server/csv/payment.ts` を実装する（`layoutVersion="default-v1"` の既定列 5 件: 社員番号／氏名／申請番号／支払金額／支払予定日、UTF-8、CRLF、`YYYY-MM-DD`、BOM 無し、スナップショット方式、FR-016）

### ユーザーストーリー4 のルートハンドラ実装

- [X] T106 [US4] `app/api/accounting/pending/route.ts` の GET を実装する（contracts/accounting.md § 1、BR-009／BR-015／FR-014 により本人申請を本人の対象から除外、経理部長・上位者の対象を併記）
- [X] T107 [US4] `app/api/accounting/[applicationNumber]/finalize/route.ts` の POST を実装する（contracts/accounting.md § 2、BR-001〜BR-010 の最終再チェック、通知 `ACCOUNTING_FINALIZED_TO_APPLICANT`）
- [X] T108 [US4] `app/api/accounting/[applicationNumber]/remand/route.ts` の POST を実装する（contracts/accounting.md § 3、コメント必須、通知 `ACCOUNTING_REMAND_TO_APPLICANT`）
- [X] T109 [US4] `app/api/accounting/[applicationNumber]/undo/route.ts` の POST を実装する（contracts/accounting.md § 4、FR-023、コメント必須、履歴 ACCOUNTING_UNDO）
- [X] T110 [US4] `app/api/accounting/exports/route.ts` の POST を実装する（contracts/accounting.md § 5、`cutoffPaymentDate` でスナップショット、`PaymentCsvExport` を作成、`ApprovalHistory` に対象申請ごとに CSV_EXPORT を記録、通知 `CSV_EXPORTED_TO_ACCOUNTING`）
- [X] T111 [US4] `app/api/accounting/exports/[exportId]/route.ts` の GET を実装する（contracts/accounting.md § 6、スナップショット詳細を返す）

### ユーザーストーリー4 のUI実装

- [X] T112 [P] [US4] `app/(authed)/accounting/pending/page.tsx` を実装する（経理確定待ち、申請者氏名・部署・申請合計・添付領収書の有無、本人申請除外の表示）
- [X] T113 [P] [US4] `app/(authed)/accounting/exports/page.tsx` を実装する（支払用 CSV 出力ボタン、`cutoffDate` 既定値 = 当月 25 日、layoutVersion・rowCount・totalAmountYen の表示、出力履歴の一覧）
- [X] T114 [US4] EX-007 退職者精算の UI 経路: `app/(authed)/accounting/pending/page.tsx` に、退職扱いの申請者の未処理申請を経理担当が代理で参照・差戻し・経理確定できる操作を追加する（spec.md EX-007、FR-031 連動）

### ユーザーストーリー4 の受け入れ検証

- [X] T115 [US4] E2E テスト `tests/e2e/us4-accounting.spec.ts` を Playwright で実装する。US4 の受け入れシナリオ 1〜6（経理確定、本人申請除外、CSV 出力、差戻し）を Desktop と iPhone の両方で実行する

**チェックポイント**: すべてのユーザーストーリーが独立して機能し、申請〜経理確定〜
支払用 CSV 出力までのエンドツーエンドが成立すること

---

## フェーズ7: 仕上げと横断的関心事

**目的**: 全ストーリーで共有する管理機能・監査・PII ガード・ドキュメントの仕上げ

- [X] T116 契約テスト `tests/contract/api/admin.spec.ts` を contracts/admin.md § 2〜4 どおりに作成する（社員・規程値の CRUD、人事取込、PII アクセスログ）。権限表の「社員情報・規程値を登録・変更する」が SYSTEM_ADMIN のみ可であること、および `/api/admin/pii-access-log` が SYSTEM_ADMIN 以外からは 403 相当を返すことを**ネガティブケース**として含める
- [X] T117 契約テスト `tests/contract/api/notifications.spec.ts` を contracts/notifications.md § 2〜3 どおりに作成する（受信一覧、既読操作、本文に PII が含まれないこと）
- [X] T118 [P] `app/api/admin/employees/route.ts`、`app/api/admin/employees/[empNo]/route.ts` を実装する（contracts/admin.md § 2.1〜2.3、認可は SYSTEM_ADMIN のみ）
- [X] T119 [P] `app/api/admin/rules/route.ts` を実装する（contracts/admin.md § 2.4〜2.5、`RuleValue` の履歴保存 FR-021）
- [X] T120 [P] `src/server/csv/hr-import.ts` を実装する（FR-032、`FILE_MISSING`／`FORMAT_INVALID`／`COLUMN_MISSING`／`ROW_ERRORS` の分類、部分適用、`HrImportResult` 保存、通知 `HR_IMPORT_FAILED_TO_*`）
- [X] T121 `app/api/admin/hr-import/route.ts`（POST）と `app/api/admin/hr-import/history/route.ts`（GET）と `app/api/admin/hr-import/retry/[id]/route.ts`（POST）を実装する（contracts/admin.md § 3）
- [X] T122 [P] `app/api/admin/pii-access-log/route.ts` を実装する（contracts/admin.md § 4、自身の呼び出しも `PiiAccessLog` に `AUDIT` として記録）
- [X] T123 [P] `app/(authed)/admin/employees/page.tsx` を実装する（社員情報の一覧・追加・編集・経理部長の上位者の登録）
- [X] T124 [P] `app/(authed)/admin/rules/page.tsx` を実装する（規程値の一覧・改定、`effectiveFrom` と `changeReason` 必須）
- [X] T125 [P] `app/(authed)/admin/hr-import/page.tsx` を実装する（CSV アップロード、履歴、再取込、エラー行表示）
- [X] T126 [P] `app/(authed)/admin/pii-access-log/page.tsx` を実装する（監査ログ閲覧、画面側で PII を直接表示するため `logPiiAccess` を呼ぶ）
- [X] T127 US2 で入れたお知らせ画面に、`autoMarkRead(applicationNumber, operation, recipientEmpNo)` の起動点を US1・US2・US3・US4 の該当ルートハンドラに追加する（contracts/notifications.md § 4）
- [X] T128 `src/i18n/ja.ts` の全文言キーに対応する日本語を確認し、英語の技術用語（`undefined`、`null`、`Internal Server Error` 等）がどこにも露出しないことを `grep` で確認するスクリプト `scripts/scan-i18n.mjs` を追加する（SC-007）
- [X] T129 `npm run scan:pii` を全ソースに対して実行し、違反 0 件で終了することを確認する（SC-008、憲法 IV）
- [X] T130 Playwright のレスポンシブ検証を全 E2E で実行し、iPhone 13 プロファイルでも PC と同じ操作手順で各シナリオが成立することを確認する（SC-009、FR-029）
- [X] T131 `quickstart.md` § 7（受け入れシナリオの手動検証）を手で実行し、本機能が自分の PC で動くことを確認して、気づいた不足を各担当タスクに切り戻す
- [X] T132 `C:\dev\projects\travel-expense\specs\001-travel-expense-reimbursement\checklists\requirements.md` の各項目を再評価し、必要なら未達項目を補足に記録する

---

## 依存関係と実行順序

### フェーズ間の依存

- **セットアップ（フェーズ1）**: 依存なし — ただちに開始できる
- **基盤構築（フェーズ2）**: セットアップの完了に依存 — すべての US をブロックする
- **ユーザーストーリー（フェーズ3〜6）**: すべて基盤構築（フェーズ2）の完了に依存
  - US1・US2・US3・US4 は、基盤完了後は並列に進められる
- **仕上げ（フェーズ7）**: 対象ユーザーストーリーの完了に依存

### ユーザーストーリー間の依存

- **US1 (P1)**: 基盤完了後に単独で開始可能。他ストーリーへの依存なし
- **US2 (P1)**: 基盤完了後に開始可能。US1 の提出済み申請が存在すると E2E 検証が
  しやすい（モック提出で代替可）
- **US3 (P2)**: US2 で導入する `next-approver.ts` を拡張する形で進む。US2 完了後に
  開始するほうが摩擦が少ないが、別ファイルに切ることで並列も可能
- **US4 (P1)**: 基盤完了後に開始可能。承認済み申請のシードがあれば単独で E2E 検証
  できる（US2・US3 を待たなくてもよい）

### 各ユーザーストーリー内の依存

- 業務ルールテスト（BR-###、EX-###、Red）→ 対応するドメイン実装（Green）→ 契約
  テスト（Red）→ ルートハンドラ実装（Green）→ UI 実装 → E2E（Playwright）
- モデルはサービスより先、サービスはエンドポイントより先、エンドポイントは UI より先

### 並列実行の機会

- フェーズ1 の [P] タスクはすべて並列実行できる（T003〜T012）
- フェーズ2 の [P] タスクは、T013／T014 完了後に並列実行できる（T016〜T038 のうち [P]）
- 基盤構築完了後は、US1・US2・US3・US4 を異なるメンバーが並行して進められる
- 各 US の業務ルールテストタスク（[P]）は並列実行できる
- 各 US のドメイン実装タスク（[P]）は並列実行できる
- 各 US の UI 実装タスク（[P]）は並列実行できる

---

## 並列実行例: ユーザーストーリー1

```bash
# US1 の業務ルールテスト（Red フェーズ）をまとめて起動する:
Task: "BR-001 単体テスト in tests/unit/domain/rules/BR-001.deadline.spec.ts"
Task: "BR-002 単体テスト in tests/unit/domain/rules/BR-002.per-diem.spec.ts"
Task: "BR-003 単体テスト in tests/unit/domain/rules/BR-003.lodging-cap.spec.ts"
Task: "BR-004 単体テスト in tests/unit/domain/rules/BR-004.economic-route.spec.ts"
Task: "BR-005 単体テスト in tests/unit/domain/rules/BR-005.taxi-exceptions.spec.ts"
Task: "BR-006 単体テスト in tests/unit/domain/rules/BR-006.receipts.spec.ts"
Task: "BR-010 単体テスト in tests/unit/domain/rules/BR-010.no-overlap.spec.ts"

# US1 のドメイン実装（Green フェーズ）をまとめて起動する:
Task: "BR-001 実装 in src/domain/rules/BR-001.deadline.ts"
Task: "BR-002 実装 in src/domain/rules/BR-002.per-diem.ts"
Task: "BR-003 実装 in src/domain/rules/BR-003.lodging-cap.ts"
Task: "BR-004 実装 in src/domain/rules/BR-004.economic-route.ts"
Task: "BR-005 実装 in src/domain/rules/BR-005.taxi-exceptions.ts"
Task: "BR-006 実装 in src/domain/rules/BR-006.receipts.ts"
Task: "BR-010 実装 in src/domain/rules/BR-010.no-overlap.ts"
```

---

## 実装戦略

### MVP ファースト（US1 のみ）

1. フェーズ1: セットアップを完了する（Next.js 雛形移送、依存導入、構造作成）
2. フェーズ2: 基盤構築を完了する（Prisma、認証境界、通知、PII スキャナ、ログイン）
3. フェーズ3: US1 を完了する（申請者が画面で申請・提出・取下げまで）
4. **停止して検証する**: 山田 太郎で E2E を走らせ、`npm run check` を通す
5. ここで自分の PC での利用を始められる（MVP）

### 漸進的デリバリー

1. セットアップ＋基盤完了 → 基盤が整う
2. US1 追加 → 独立 E2E ＋ 手動検証 → ローカル検証（MVP、SC-002／SC-007）
3. US2 追加 → 独立 E2E ＋ 代理指名の検証 → ローカル検証（SC-003）
4. US4 追加 → CSV 出力の検証 → ローカル検証（SC-004、SC-005）
5. US3 追加 → 高額・期限超過・本人申請の分岐検証 → ローカル検証（SC-003 の維持）
6. フェーズ7（管理・監査・仕上げ）→ `npm run check` の全パス、`quickstart.md` の
   §7 手動検証を実施

### 単独開発者向けの逐次戦略

1 人で進める場合は、業務上の優先度（P1 は MVP、P2 は後置）に素直に従って
US1 → US2 → US4 → US3 → フェーズ7 の順で進めるのが最短です。US4 を US2 の次に
置くのは、「申請が溜まる前に CSV 出力の検証ができる」ことと、
US3 の経理部長系の分岐が US4 の実装（経理確定の UI・ハンドラ）と相性が良いため。

---

## 補足

- [P] タスク = 別ファイル、依存なし
- [Story] ラベルは、トレーサビリティのためタスクを特定の US に紐付ける
- 各 US は独立して完了・テストできること（受け入れシナリオ単位でチェックポイント）
- 業務ルールのテストは実装前に失敗（Red）することを確認する（憲法 III）
- 画面・メッセージ・CSV ヘッダはすべて日本語、英語の技術用語を UI に出さない
  （憲法 I、FR-018、SC-007）
- 個人情報（氏名・社員番号・金額・口座・出張先・領収書画像）を URL／ログ／外部
  送信に出さない。`npm run scan:pii` と Pino の redact で機械的に守る（憲法 IV、
  FR-019、SC-008）
- タスクごと、または論理的なまとまりごとにローカルコミットする
- 任意のチェックポイントで停止し、ストーリーを独立して検証する
- 避けること: 曖昧なタスク、同一ファイルの競合、独立性を壊すストーリー間の依存
