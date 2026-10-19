# フェーズ0 調査結果: 旅費精算

**計画**: [plan.md](./plan.md) ／ **仕様書**: [spec.md](./spec.md)

本書は実装計画の技術コンテキストに関する調査結果をまとめる。各項目は
Decision / Rationale / Alternatives considered の 3 点で記録する。

---

## 1. フレームワーク: Next.js 15（App Router）

- **Decision**: Next.js 15 を App Router 構成で採用し、UI と API を 1 アプリに同居させる。
- **Rationale**:
  - ユーザー指示（Next.js + TypeScript、ローカル PC で動かす）に合致。
  - App Router の Server Actions と Route Handlers で、業務担当者向け UI と API を
    1 プロセスで動かせるため、ローカル配備が簡潔（`next dev` 1 コマンド）。
  - レスポンシブ（FR-029）に標準対応しやすく、PC・タブレット・スマホのブラウザで
    同一の画面を提供できる。
- **Alternatives considered**:
  - Pages Router: サポートは継続中だが、新規採用は App Router が標準。差替えを前提に
    する利点は薄い。
  - Remix + Vite: ローカル SQLite との組合せは良いが、Next.js ほどのエコシステム
    支援（Prisma・画像・i18n）を得にくい。
  - 独立したバックエンド（Fastify/Express）＋ SPA: 単独 PC 運用には過剰。

## 2. ランタイム: Node.js 20 LTS

- **Decision**: Node.js 20 LTS を採用。
- **Rationale**:
  - Next.js 15 の最低要件（Node 18.18 以降）を満たしつつ、2026 年時点で LTS 対象期間が
    長い。
  - better-sqlite3 のビルド済みバイナリが提供されており、ネイティブ依存の導入が
    容易。
- **Alternatives considered**:
  - Bun: 業務ルールの純粋 TS 部分は動くが、Prisma の互換性と better-sqlite3 のビルド
    確認が未成熟。
  - Node 22: 本機能のリリース時点で LTS 入りが近いが、2026-10 時点で枯れた LTS である
    Node 20 を選ぶ方が安全。

## 3. 言語: TypeScript 5.6（厳格モード）

- **Decision**: TypeScript 5.6、`strict: true` に加えて `noUncheckedIndexedAccess`、
  `exactOptionalPropertyTypes`、`noImplicitOverride` を有効化。
- **Rationale**:
  - 業務ルール（BR-###）を型で表現し、Zod のバリデーションと型の 1 対 1 対応を取る。
  - `noUncheckedIndexedAccess` により、配列・レコードの undefined をコンパイル時に
    気づけるため、業務担当者が触る画面での「undefined」文言の露出（憲法 I）を抑制。
- **Alternatives considered**:
  - 既定の `strict: true` のみ: 本件のドメインは境界が多く、追加の厳格オプションで
    拾える不具合が多いので採用。

## 4. ORM: Prisma 5 + better-sqlite3

- **Decision**: Prisma 5 を採用し、SQLite ドライバーは `better-sqlite3`（同期ドライバー）
  を使用。
- **Rationale**:
  - 型安全なクエリと、`prisma migrate dev` によるローカルマイグレーションが、
    業務ルールテスト用のシード・リセット運用に適合。
  - `better-sqlite3` は同期 I/O だが、ローカル PC 単独運用（低並行）なので、素直で
    デバッグしやすい。
- **Alternatives considered**:
  - Drizzle ORM: 軽量で魅力的だが、Prisma Studio のような GUI 補助が無く、学習用途の
    初動が重い。
  - 生 SQL（kysely）: 業務ルールのテスト容易性を最優先する本件では、ORM の型支援を
    使う方が投資対効果が高い。

## 5. ストレージ: SQLite ファイル + ローカル画像保存

- **Decision**: `./data/app.sqlite` を単一の SQLite ファイルとして使い、領収書画像は
  `./data/uploads/<申請番号>/<ULID>.<ext>` に保存。DB には画像パス・MIME・サイズ・
  SHA-256 ハッシュを保持する。
- **Rationale**:
  - 自分の PC だけで動かす制約から、外部ストレージは禁。
  - 画像を DB の BLOB に入れない方が、Prisma Studio やバックアップ時の負担が低い。
  - SHA-256 を記録することで、添付し忘れ修正時（EX-002）の差替え前後の判定が可能。
- **Alternatives considered**:
  - DB の BLOB 列: 単一ファイルで完結する利点はあるが、ハッシュ・MIME のインデックスを
    独自に組む手間が増える。
  - クラウドストレージ: スコープ外（ローカル専用）。

## 6. 認証: 簡易ログイン（利用者切替）

- **Decision**: `src/server/auth/dev-login.ts` を実装し、画面でユーザー一覧から選択して
  `iron-session` のセッションクッキーに社員番号を保存する。`src/server/auth/session.ts`
  の `getCurrentUser()` が単一境界となり、将来の SSO 実装（`sso-login.ts`）に差し替え
  可能。
- **Rationale**:
  - ユーザー要請（PC だけで動かす、簡易な利用者切替で良い）に沿う。
  - FR-030／FR-031 の受入契約（「本人識別子を返して職位ロールへ突合する」）を同じ
    境界で満たすため、SSO への差し替え時にアプリ本体の改修を抑えられる。
- **Alternatives considered**:
  - NextAuth.js の Credentials プロバイダ: 本番向けの SSO プロバイダ切替に強いが、
    「ユーザー一覧から選ぶだけ」の学習用途には過剰。
  - URL パラメータでの切替: 社員番号を URL に乗せるため、憲法 IV（個人情報を URL に
    出さない）に抵触。却下。

## 7. UI: Tailwind CSS 3

- **Decision**: Tailwind CSS 3 のユーティリティで、PC（1280px 以上）・タブレット（768px
  以上）・スマホ（360px 以上）の 3 ブレークポイントを設計。
- **Rationale**:
  - FR-029（レスポンシブ、スマホ横幅 360px でスクロール以外の追加操作なしで完了）を
    最小の CSS で満たせる。
  - 画面共通の `src/components/*` に Tailwind のクラスを集約すれば、文言と見た目を
    分離できる（憲法 I と相性が良い）。
- **Alternatives considered**:
  - CSS Modules: 単独で使うと冗長で、スマホ対応のメディアクエリが散在しやすい。
  - MUI: デザインの日本語化・用語の統制で逆に手間が増える。

## 8. バリデーション: Zod

- **Decision**: 入力は Route Handlers と Server Actions の入口で Zod スキーマで検査し、
  ドメイン層へは正規化済みの値のみを渡す。エラーは `src/server/errors/to-user-message.ts`
  経由で日本語メッセージへ変換。
- **Rationale**:
  - 業務ルールの境界（BR-### の数値・条件）を Zod で宣言的に表現できる。
  - 画面側の `react-hook-form` でも同じスキーマを再利用でき、重複を避けられる。
- **Alternatives considered**:
  - Yup / Joi: TypeScript 推論は Zod の方が洗練されている。
  - 手書きの型ガード: 業務ルールの境界値を宣言的に書けず、変更追従が重い。

## 9. 通知

- **Decision**: 既定でファイルトランスポート（`nodemailer` 相当の自作ドライバー）で
  `./data/mail/*.eml` に保存。将来の本番で SMTP／社内メール API に差し替える。
  アプリ内のお知らせは `notifications` テーブルに保存し、既読日時を持つ。
- **Rationale**:
  - ローカル PC 運用でも、送られた通知を人間が確認できるようにする（検証容易性）。
  - FR-022（メール＋アプリ内）の受入契約を同じインターフェースで満たす。
- **Alternatives considered**:
  - 標準出力ログに吐くだけ: 検証時に見づらく、タイミングも分かりにくい。
  - MailHog コンテナ: 外部プロセス依存が増える（本機能のスコープ外）。

## 10. 日時・営業日計算: date-fns + date-fns-tz

- **Decision**: すべての日時は `Asia/Tokyo` を既定とし、`date-fns-tz` で変換。営業日
  計算（BR-011、BR-012）は、日本の祝日マスタをアプリ内の静的テーブル
  （`src/domain/holidays.ts`）として保持し、改定時はシステム管理者が追加できる。
- **Rationale**:
  - 憲法「追加の制約」で `Asia/Tokyo` と `YYYY-MM-DD` を既定として要求。
  - 外部 API に祝日を取りに行かない（ローカル PC・個人情報露出の観点とは別の、
    ネットワーク非依存の原則）。
- **Alternatives considered**:
  - Luxon: 代替としては優秀だが、Next.js のサーバーアクションでのバンドルサイズが
    重め。
  - Day.js: タイムゾーンプラグインの精度が date-fns-tz に劣る。

## 11. テスト

- **Decision**:
  - 単体: Vitest。業務ルール（BR-###）1 ルール 1 ファイルに対して、通常ケース・
    境界値・異常系の 3 系列を最低限用意。
  - 契約: Vitest で Route Handlers を直接呼び出し、`contracts/*.md` の入出力表に
    合致することを確認。
  - E2E: Playwright。US1〜US4 と EX-001〜EX-007 の受け入れシナリオを、Desktop Chrome
    と iPhone 13 プロファイルで実行（FR-029、SC-009）。
- **Rationale**:
  - 業務ルールの正しさは「テストが通る」で担保する（憲法 III）。
  - E2E でレスポンシブ検証を Playwright のプロファイル 1 行で網羅できる。
- **Alternatives considered**:
  - Jest: Next.js 公式サポートは健在だが、Vite ベースの Vitest の方が TypeScript 推論と
    ESM 対応が素直。
  - Cypress: Playwright のモバイル端末エミュレーションの方が選択肢が広い。

## 12. 静的解析: ESLint + TypeScript + PII 静的スキャン

- **Decision**:
  - `@typescript-eslint/eslint-plugin`、`eslint-plugin-react`、`eslint-plugin-tailwindcss`。
  - PII 静的スキャン: `scripts/scan-pii.mjs` を自作し、ログ出力（Pino 以外の `console.*`、
    `logger.info(...)` 等）に、ドメインの PII キーワード
    （`name|empNo|amount|destination|accountNumber|receipt|address`）が直接渡っていない
    かを AST で検査する。違反は `npm run check` を失敗させる。
- **Rationale**:
  - 憲法 IV の MUST NOT を手運用に頼らず、CI 代替のローカルフックで強制。
  - SC-008（PII の 0 件）を機械的に測る。
- **Alternatives considered**:
  - 本番の APM／SIEM での検知: ローカル運用には不向き。
  - 手動レビューのみ: 継続性に欠ける。

## 13. Next.js 雛形の生成手順

- **Decision**: ユーザー指示に従い、別の一時フォルダ（例:
  `C:\Users\hiroj\AppData\Local\Temp\next-scaffold-<timestamp>\`）で
  `npx create-next-app@latest travel-expense-app --typescript --tailwind --app
   --src-dir --import-alias "@/*" --eslint --use-npm` を実行し、生成されたファイル・
  フォルダ群から、`.git`／`node_modules` を除外しつつ、必要なものだけを本プロジェクト
  （`C:\dev\projects\travel-expense\`）へ移送する。
- **Rationale**:
  - 既存の `CLAUDE.md`／`.specify/`／`docs/`／`specs/` を保全したいため、
    `create-next-app` を本フォルダ直下では走らせない。
  - 既存ファイルとの衝突（`README.md`、`.gitignore` など）は、必要な差分のみを
    手動で統合する。
- **Alternatives considered**:
  - 本フォルダで直接 `create-next-app` を走らせ、生成前にリポジトリ内の既存ファイル
    を一時退避する: 衝突回避の手順が増えて壊れやすい。
  - 手で `package.json` を作り依存を追加する: 公式テンプレの設定（App Router、
    `src/` レイアウト、Tailwind）が揃うのは `create-next-app` が最短。

## 14. CLAUDE.md と AGENTS.md

- **Decision**:
  - 既存の `CLAUDE.md` は中身を**変更せず**、ファイル末尾に空行 1 行を挟んで
    `@AGENTS.md` の 1 行だけを追記する。
  - `AGENTS.md` を新規作成し、エージェント向けの運用ガイド（本計画の抜粋、`npm run check`
    の必須実行、PII スキャンの意義、業務ルールテスト先行の原則）を日本語で書く。
- **Rationale**:
  - ユーザー指示（CLAUDE.md は現状維持、末尾に `@AGENTS.md` を追加）に沿う。
  - エージェント（Claude Code）が開くときに `@AGENTS.md` 構文で参照されるため、
    ガイダンスが読み込まれる。
- **Alternatives considered**:
  - CLAUDE.md 自体に全規約を書き足す: 現状維持の指示に反する。
  - AGENTS.md を各ディレクトリに置く: 本機能の規模では過剰。

## 15. 日本語フォント / i18n

- **Decision**: Next.js の `next/font/google` で Noto Sans JP を自ホストに取り込み、
  オフラインでも表示が崩れないようにする。文言は `src/i18n/ja.ts` に平文のキー表で
  集約する（軽量のため i18next は入れない）。
- **Rationale**:
  - ローカル PC・ネットワーク非依存。
  - 画面文言キーを 1 ファイルに置くことで、新規追加・レビューが容易。
- **Alternatives considered**:
  - i18next + react-i18next: ロケール複数対応には強いが、本機能は ja-JP のみなので過剰。

## 残課題（計画段階では確定しない項目）

次は `/speckit-tasks` の起票・または別途のクラリフィケーションで扱うべき事項として
捕捉しておく（本計画の NEEDS CLARIFICATION ではなく、タスク粒度の未確定）。

- 支払用 CSV の列定義: 経理担当・会計システム担当からの受領を待って
  `src/server/csv/payment.ts` の列マッピングを確定する（FR-016、Q4 の確定時に合意済み）。
- 下書き自動失効の期限（未指示のため、既定で 180 日とし、タスク化時に再確認）。
- 申請番号の採番ルール: 既定で `JP-YYYY-NNNNNN`（年ごとの連番）とし、タスク化時に
  要承認。
- 監査ログの保持期間: `pii_access_log` は 2 年、`approval_history` は 7 年を既定とする
  が、タスク化時に再確認。
