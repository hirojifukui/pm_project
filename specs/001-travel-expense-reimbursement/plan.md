# 実装計画: 旅費精算（申請〜経理確定〜支払用 CSV 出力）

**ブランチ**: `001-travel-expense-reimbursement` | **日付**: 2026-10-19 | **仕様書**: [spec.md](./spec.md)

**入力**: `/specs/001-travel-expense-reimbursement/spec.md` の機能仕様書

## 概要

国内出張の旅費精算を、申請者・所属長・部長・経理担当・経理部長・経理部長の上位者・
システム管理者が Web 画面で扱える機能を Next.js + TypeScript + SQLite の単一アプリ
として作る。本機能は現時点では学習・検証用途として自分の PC だけで動かすため、
認証（FR-030）は、Clarifications Q3 で確定した社内 SSO 連携を**本番展開まで保留**し、
受入契約（本人識別子を返して職位ロールへ突合する）を同じ関数境界で満たす「利用者
切替の簡易ログイン」で**暫定実装**する。この取り扱いは plan.md § 複雑度トラッキング
で書面化された例外として扱い、SSO 連携実装のタスクは本番展開前に別途起票する。
仕様書の FR-030／FR-031 の受入要件は、暫定実装でも同じ関数境界により満たされる。
将来の本番展開では、簡易ログインを置き換えるだけで本来の SSO 連携に差し替えできる
ように、認証周りは境界を切る。

主要な技術的アプローチ:

- Next.js（App Router、Node ランタイム）で UI と API を 1 アプリに同居させる。
  レスポンシブ（FR-029）は Tailwind CSS のユーティリティで実現する。
- SQLite を Prisma 経由で使う。開発中は `prisma migrate dev`、動かすときは `.sqlite`
  ファイルをプロジェクト直下の `./data/app.sqlite` に置く。
- 通知（FR-022）はローカル PC 想定のため、メール送信は本番は SMTP ドライバの差替え
  を前提にしつつ、既定ではファイルトランスポート（`.local/mail/*.eml` へ保存）で
  完了とする。アプリ内のお知らせは DB テーブル `notifications` に保存する。
- 認証境界: `src/server/auth/session.ts` に `getCurrentUser()` を集約し、簡易ログイン
  実装 `src/server/auth/dev-login.ts` と、将来の SSO 実装の差し替えを可能にする。
- 業務ルール（BR-###）はドメイン層（`src/domain/rules/*.ts`）に純粋関数として置き、
  Vitest で網羅的に単体テストする（憲法 III「業務ルールはテストで検証」）。
- 画面文言は `src/i18n/ja.ts` に一元化し、英語の技術メッセージが UI に漏れない
  ことを静的に検査する（憲法 I）。

Next.js の雛形は、ユーザー指示に従い別の一時フォルダで `create-next-app` を実行し、
生成されたファイルを本プロジェクトへ移送する。この手順と、既存の `CLAUDE.md`／
`.specify/`／`docs/` の保全方針は `quickstart.md` で詳細化する。

## 技術コンテキスト

**言語／バージョン**: TypeScript 5.6 / Node.js 20 LTS

**主要な依存関係**:

- Next.js 15（App Router、Server Actions、Route Handlers）
- React 19
- Prisma 5（ORM、マイグレーション）＋ `@prisma/client`
- SQLite 3（better-sqlite3 バックエンド）
- Tailwind CSS 3（レスポンシブユーティリティ、FR-029）
- Zod（入力バリデーション、業務ルールとの境界）
- Vitest（単体・契約テスト）、Playwright（受け入れシナリオの E2E）
- iron-session（簡易ログインのセッションクッキー署名）
- date-fns／date-fns-tz（Asia/Tokyo の日付・営業日計算）

**ストレージ**: SQLite 3（単一ファイル `./data/app.sqlite`、Prisma が生成）。領収書画像
は `./data/uploads/<申請番号>/<ULID>.<ext>` にローカル保存し、DB にはファイルパスと
メタデータのみを格納する。バックアップはユーザーが `./data/` フォルダを丸ごと
コピーすれば足りる形にする。

**テスト**:

- Vitest（業務ルール単体テスト、ドメイン純粋関数、Zod スキーマ、API コントラクト）
- Playwright（受け入れシナリオ US1〜US4 と EX-001〜EX-007 の E2E。レスポンシブは
  デバイス `iPhone 13` と `Desktop Chrome` の 2 プロファイルで実行）
- `@typescript-eslint` と `tsc --noEmit` を CI 相当のローカルフックで実行

**ターゲットプラットフォーム**: 自分の PC（Windows 11、macOS、Linux のいずれか）
でのローカル実行。公開は想定しない。利用者端末のブラウザは Chrome 最新・
Firefox 最新・Safari 最新・Edge 最新を対象。

**プロジェクト種別**: Web アプリケーション（Next.js の単一アプリに UI と API を
同居させる構成）

**パフォーマンス目標（ローカル検証用）**:

- 画面遷移（P50）: 500ms 以内（PC、SSD、ローカル SQLite）
- 一覧画面（承認待ち 50 件程度）の初回表示: 1 秒以内
- 支払用 CSV（300 件相当）の生成: 5 秒以内

**制約**:

- 自分の PC のみで動かす（オフライン前提）。外部クラウドサービスには一切接続しない。
- 個人情報を URL・ログ・外部送信に出さない（憲法 IV、FR-019）。
- 画面・メッセージ・CSV ヘッダは日本語のみ（憲法 I、FR-018、SC-007）。
- 既存の `C:\dev\projects\travel-expense\CLAUDE.md`／`.specify/`／`docs/` は保全。
  `CLAUDE.md` は末尾に `@AGENTS.md` 参照の 1 行を追加するだけ。

**規模／スコープ**:

- 社員約 500 名、月約 300 申請、1 申請あたり明細平均 6 行・最大 30 行、領収書画像
  平均 2 枚（§9）。ローカル検証ではこれらをシード想定として扱う。

## 憲法チェック

憲法 v1.0.0（2026-10-18 批准）に対する評価。ゲート: フェーズ0 の調査前に全項目通過
が必要、フェーズ1 の設計後に再チェックする。

| 原則 | 評価 | 根拠 |
|------|------|------|
| I. 日本語ユーザー体験 (NON-NEGOTIABLE) | PASS | 画面文言を `src/i18n/ja.ts` に集約し、UI コンポーネントはキー参照で描画。例外は `src/server/errors/to-user-message.ts` で日本語メッセージへ変換する層を必ず通す。CSV ヘッダ・通知文面も日本語既定。 |
| II. 業務担当者ファーストの操作性 | PASS | 画面ラベルはヒアリングシートの用語を採用。確認ダイアログは `src/components/ConfirmationDialog.tsx` で統一し、不可逆操作で件数・内容を要約。設定ファイル・CLI・環境変数での操作は不要。 |
| III. 業務ルールはテストで検証 (NON-NEGOTIABLE) | PASS | BR-001〜BR-015 ごとに `src/domain/rules/*.ts` の純粋関数と Vitest ケース（境界値を含む）を一対一で用意。TDD の順序は `tasks.md` が強制する。 |
| IV. 個人情報の露出禁止 (NON-NEGOTIABLE) | PASS | ルーティングは申請 ID 経由（`/applications/[id]` ではなく `/applications/by-number/[applicationNumber]`）とし、クエリに氏名・金額・口座を乗せない。アクセスログは Pino の `redact` 設定で `name/empNo/amount/destination/account` を伏せる。外部送信は無し。 |
| V. 仕様駆動開発（Spec Kit 日本語版の遵守） | PASS | 本計画は `/speckit-plan` の生成物。`spec.md` の `[NEEDS CLARIFICATION]` は 0 件、Clarifications も 5 件統合済み。業務ルールの出典 ID はヒアリングシート `docs/requirements/travel-expense-hearing.md` に遡及可能。 |

| 追加の制約・開発ワークフロー | 評価 | 根拠 |
|------------------------------|------|------|
| ロケール / タイムゾーン ja-JP / Asia/Tokyo | PASS | date-fns-tz で全ての日時操作に `Asia/Tokyo` を適用。`YYYY-MM-DD` で表示・保存・CSV 出力。 |
| 金額は円単位の整数 | PASS | ドメイン層で `Amount` 値オブジェクトを導入。計算中に浮動小数点へ落とさない。丸めは切り捨てを一箇所（`src/domain/money.ts`）で実施。 |
| 認可 | PASS | `src/server/auth/authorize.ts` で職位ロール×操作の表（権限表に対応）を単一関数で判定。範囲外は 403 相当で「権限がありません」。 |
| 監査（提出・承認・差戻し・確定・取消・PII 参照） | PASS | `approval_history` テーブルを `src/domain/history.ts` 経由で書き込み、個人情報参照イベントは `pii_access_log` に別途記録。 |
| PR / CI ゲート | PARTIAL | ローカル PC 単独運用のため CI は未使用。代替として `npm run check`（型・lint・テスト・PII 静的スキャン）をコミット前に手動実行する運用で代替する。本番展開前に CI 化が必要（**書面化された例外**として扱う）。 |

**ゲート判定**: PASS（PR/CI ゲートの PARTIAL は、ローカル PC での学習用途に限定した書面化された例外。本番展開時に再評価する）。

## プロジェクト構成

### ドキュメント（本機能）

```text
specs/001-travel-expense-reimbursement/
├── plan.md              # このファイル
├── research.md          # フェーズ0の出力
├── data-model.md        # フェーズ1の出力
├── quickstart.md        # フェーズ1の出力
├── contracts/           # フェーズ1の出力
│   ├── applications.md
│   ├── approvals.md
│   ├── accounting.md
│   ├── notifications.md
│   └── admin.md
├── checklists/
│   └── requirements.md  # 既存（/speckit-specify の成果物）
└── tasks.md             # /speckit-tasks の出力（本コマンドでは作成しない）
```

### ソースコード（リポジトリルート）

```text
app/                            # Next.js App Router のルート
├── (public)/
│   └── login/                  # 簡易ログイン画面（本物の SSO への差し替え点）
├── (authed)/
│   ├── applications/           # US1: 申請者
│   │   ├── new/
│   │   ├── drafts/
│   │   └── by-number/[applicationNumber]/
│   ├── approvals/              # US2・US3: 所属長・部長・経理部長・上位者
│   ├── accounting/             # US4: 経理確定・CSV 出力
│   ├── notifications/          # アプリ内のお知らせ
│   └── admin/                  # システム管理者: 社員・規程値・人事取込
├── api/
│   ├── applications/           # Route Handlers（契約: contracts/applications.md）
│   ├── approvals/
│   ├── accounting/
│   ├── notifications/
│   └── admin/
└── layout.tsx                  # 日本語ロケール、Tailwind、SessionProvider

src/
├── domain/                     # 純粋ドメイン（Node 依存なし、テスト容易）
│   ├── money.ts                # Amount 値オブジェクト、丸め方針
│   ├── workdays.ts             # 営業日計算（締め日・振込日）
│   ├── rules/                  # 業務ルール（1 ルール 1 ファイル）
│   │   ├── BR-001.deadline.ts
│   │   ├── BR-002.per-diem.ts
│   │   ├── BR-003.lodging-cap.ts
│   │   ├── BR-004.economic-route.ts
│   │   ├── BR-005.taxi-exceptions.ts
│   │   ├── BR-006.receipts.ts
│   │   ├── BR-007.manager-approval.ts
│   │   ├── BR-008.director-approval.ts
│   │   ├── BR-009.self-approval-ban.ts
│   │   ├── BR-010.no-overlap.ts
│   │   ├── BR-011.payment-cycle.ts
│   │   ├── BR-012.proxy-approver.ts
│   │   ├── BR-013.receipt-retention.ts
│   │   ├── BR-014.director-own.ts
│   │   └── BR-015.accountant-own.ts
│   ├── history.ts              # 承認履歴の書き込み
│   └── types.ts                # Zod スキーマで表現する業務型
├── server/                     # Next.js ランタイム依存のあるサーバー層
│   ├── auth/
│   │   ├── session.ts          # getCurrentUser() の境界
│   │   ├── dev-login.ts        # 利用者切替ログイン（本機能のローカル実装）
│   │   └── authorize.ts        # 権限表の単一判定点
│   ├── db/
│   │   ├── client.ts           # PrismaClient シングルトン
│   │   └── seed.ts             # ローカル用シードデータ
│   ├── errors/
│   │   └── to-user-message.ts  # 例外 → 日本語メッセージへ変換
│   ├── notifications/
│   │   ├── mailer.ts           # ファイル保存トランスポート（既定）
│   │   └── inbox.ts            # アプリ内のお知らせ
│   ├── csv/
│   │   ├── payment.ts          # 支払用 CSV 出力（FR-016 レイアウト適用）
│   │   └── hr-import.ts        # 月次人事 CSV 取込（FR-032 失敗時挙動）
│   └── storage/
│       └── receipts.ts         # 領収書画像のローカル保存
├── i18n/
│   └── ja.ts                   # UI 文言キー → 日本語
└── components/                 # 画面共通コンポーネント

prisma/
├── schema.prisma               # SQLite スキーマ（data-model.md と連動）
└── migrations/

tests/
├── unit/
│   └── domain/rules/*.spec.ts  # BR-### に対応する単体テスト（必須）
├── contract/
│   └── api/*.spec.ts           # Route Handlers の契約テスト（Vitest）
└── e2e/
    └── *.spec.ts               # Playwright: US1〜US4、EX-001〜EX-007

data/
├── app.sqlite                  # ローカル DB（git ignore）
├── uploads/                    # 領収書画像（git ignore）
└── mail/                       # ファイル保存トランスポートの eml（git ignore）

docs/
└── requirements/
    └── travel-expense-hearing.md  # 既存

AGENTS.md                       # エージェント向け運用ガイド（新規）
CLAUDE.md                       # 既存。末尾に @AGENTS.md 参照を追記
```

**構成の決定**: Web アプリケーション（Next.js 単一アプリ）を採用。フロントとバックを
分けないのは、ローカル PC 単独で動かす制約と、業務担当者 UI の 1 アプリ性を優先した
ため。業務ルールは Node・Next.js ランタイムに依存しない `src/domain/` へ切り出し、
Vitest から直接テストできる構成にする（憲法 III）。

## 複雑度トラッキング

| 違反 | 必要な理由 | より単純な代替案を却下した理由 |
|------|------------|-------------------------------|
| 認証を SSO（FR-030）ではなく簡易ログインで実装 | ユーザー要請（自分の PC のみで動かす）。本番 SSO 基盤が未整備の学習用途。 | FR-030 の受入契約（本人識別子を返して職位ロールへ突合）を同じ関数境界（`getCurrentUser()`）で満たすため、将来の差し替え時にインターフェースの破壊的変更は発生しない。SSO 連携を先に実装するのは、ローカル検証では過剰。 |
| CI 未使用（憲法「開発ワークフローと品質ゲート」の PR/CI ゲートに部分不適合） | 単独 PC での学習用途のため、PR も CI 環境も存在しない。 | `npm run check` のローカル必須スクリプトで型・lint・業務ルールテスト・PII 静的スキャンを一括実行し、コミット前フックで強制する。本番展開前に CI 化を再評価する（書面化された例外、再評価日: 本番展開を検討する時点）。 |
