# クイックスタート: 旅費精算（自分の PC で動かす）

本書は、本機能をローカル PC で初期セットアップし、受け入れシナリオを一通り手で
確かめるための手順を示す。実装の詳細（モデル・サービス・コントローラの本体や
マイグレーション）は含めない。それらは `tasks.md` と実装フェーズで扱う。

**関連資料**: [plan.md](./plan.md)、[spec.md](./spec.md)、[data-model.md](./data-model.md)、
[contracts/](./contracts/)

---

## 1. 前提条件

- Windows 11（本プロジェクトの環境、ただし macOS／Linux も可）
- Node.js 20 LTS（`node -v` で `v20.x` を確認）
- npm 10 以降
- Git（任意、本機能はローカルで完結）
- 空き容量: 2GB 以上（Next.js・Prisma・Playwright のブラウザドライバを含む）
- ブラウザ: Chrome／Firefox／Edge／Safari の最新版

本機能は **自分の PC だけで動かす** 前提のため、外部クラウドサービスへの登録は
不要。認証も本機能のローカル実装（利用者切替）で完結する（詳細: plan.md § 概要）。

---

## 2. Next.js 雛形の生成と本プロジェクトへの移送

ユーザー指示に従い、`create-next-app` は本プロジェクトの直下では実行せず、別の
一時フォルダで実行してから必要なファイルだけを移送する。既存の `CLAUDE.md`／
`.specify/`／`docs/`／`specs/` を壊さないためである。

```powershell
# 1) 一時フォルダを作る（%TEMP% は Windows の環境変数）
$ScaffoldDir = Join-Path $env:TEMP ("next-scaffold-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $ScaffoldDir | Out-Null
Set-Location $ScaffoldDir

# 2) create-next-app を一時フォルダ内で実行
npx create-next-app@latest travel-expense-app `
  --typescript --tailwind --app --src-dir `
  --import-alias "@/*" --eslint --use-npm --no-turbopack

# 3) 生成物のうち、以下を本プロジェクトへ移送する（既存ファイルを上書きしない）
#    - package.json / package-lock.json / tsconfig.json / next.config.mjs
#    - tailwind.config.ts / postcss.config.mjs / .eslintrc.json
#    - .gitignore（既存と差分統合）
#    - src/* / app/* / public/*
#    - README.md（既存の読み物を壊さないよう、本プロジェクトでは README-nextjs.md に改名）
#
#    注意: .git フォルダと node_modules は移送しない。
```

移送後、本プロジェクト直下で `npm install` を実行し直す（Prisma など追加依存は
手順3 で入れる）。

---

## 3. 追加依存の導入

```bash
npm install prisma @prisma/client better-sqlite3 \
  zod iron-session date-fns date-fns-tz ulid \
  @tailwindcss/forms
npm install -D vitest @vitest/ui @vitejs/plugin-react \
  playwright @playwright/test \
  @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  eslint-plugin-tailwindcss @types/better-sqlite3 \
  tsx
npx playwright install chromium webkit
```

---

## 4. CLAUDE.md と AGENTS.md

ユーザー指示に従い、`CLAUDE.md` は現状の内容を**残し**、末尾に空行 1 行を挟んで
`@AGENTS.md` の 1 行だけを追記する。`AGENTS.md` はエージェント向けの運用ガイドと
して新規作成する（計画・テンプレ・PII スキャンの要点のみ）。

- 更新対象: `C:\dev\projects\travel-expense\CLAUDE.md`（末尾に `@AGENTS.md`）
- 新規作成: `C:\dev\projects\travel-expense\AGENTS.md`

`AGENTS.md` に含める内容の目安（詳細は実装フェーズのタスクで記述）:

- 本機能は `/speckit-*` ワークフローで駆動すること
- 業務ルール（BR-###）を変える場合はテストを先に書くこと（憲法 III）
- `npm run check` をコミット前に必ず走らせること（型・lint・業務ルールテスト・
  PII 静的スキャン）
- 画面文言は `src/i18n/ja.ts` に集約すること（憲法 I）
- 個人情報を URL・ログ・外部送信に出さないこと（憲法 IV、FR-019）

---

## 5. データベースの初期化とシード

```bash
# Prisma スキーマは tasks.md のステップ T0xx で生成する前提
npx prisma migrate dev --name init
npm run db:seed    # tsx scripts/seed.ts
```

シードで登録する既定の社員（簡易ログインの切替候補）:

- `E0001 山田 太郎`（申請者、営業部）
- `E0010 鈴木 花子`（所属長、営業部、E0001 の上司）
- `E0020 佐藤 次郎`（部長、営業部、E0010 の上司）
- `E0030 高橋 三郎`（経理担当、経理部）
- `E0040 田中 四郎`（経理部長、経理部、E0030 の上司）
- `E0050 伊藤 五郎`（経理部長の上位者、経営企画部）
- `E9000 管理者`（システム管理者）

既定の規程値はヒアリングシート §5 の値（BR-002〜BR-008、BR-011）を適用。

---

## 6. 開発起動

```bash
npm run dev
# → http://localhost:3000 を開く
```

初回アクセス時、`/login` で切替可能な利用者の一覧が表示される。社員番号を選択
するとセッションクッキーが設定され、`/applications` などへ遷移できる。

---

## 7. 受け入れシナリオの手動検証（抜粋）

本機能の実装後、以下の順でブラウザから操作して、受け入れシナリオ（spec.md）が
満たされることを確認する。詳細な E2E は `tests/e2e/` の Playwright が担うため、
ここでは手で確かめる要点だけを列挙する。

### 7.1 US1 — 申請者の提出

1. 山田 太郎（E0001）でログイン。
2. `/applications/new` を開き、出張期間・行先・目的を入力。
3. 明細タブで交通費・宿泊費を追加（宿泊費は上限超過を試す）。
4. 明細のタクシー行を追加し、`BR-005` の例外事由を未選択で提出 → ブロックされる
   ことを確認。
5. 事由を選択し直して提出 → 申請番号が発行され、状態が
   「所属長の承認待ち」になる。
6. BR-010 の確認: 期間を重ねた 2 件目の下書きを提出 → 重複警告で止まる。

### 7.2 US2 — 所属長の承認・差戻し

1. 鈴木 花子（E0010）でログイン、`/approvals` を開く。
2. 山田の申請を開いてコメントなしで承認 → 100,000円以下なら経理に進む、超過なら
   部長に進む。
3. 別の申請でコメントを空のまま差戻しを試す → ブロックされる。
4. `/approvals/proxy-assignments` を開き、代理に E0020 を指名（開始〜終了を 3 営業日
   以上に）。
5. 山田の 2 件目を提出 → 代理（E0020）が承認対象として現れる。

### 7.3 US3 — 部長の追加承認

1. 佐藤 次郎（E0020）でログイン、`/approvals` を開く。
2. 100,000円超の申請、期限超過の申請を確認して承認／差戻し。
3. 鈴木本人の申請を鈴木（E0010）で提出 → 佐藤の承認対象として表示される
   （所属長本人申請、BR-009）。

### 7.4 US4 — 経理確定と CSV 出力

1. 高橋（E0030）でログイン、`/accounting/pending` を開く。
2. 承認済みの申請を経理確定。
3. 経理担当本人（E0030）が自分で申請した案件は、E0030 の対象から外れていて、田中
   （E0040、経理部長）の対象として現れることを確認（BR-009 / FR-014）。
4. `/accounting/exports` で当月の支払用 CSV を出力。`./data/exports/` にファイルが
   生成されることを確認。

### 7.5 認証の切替

- `/login` で利用者を切替えるたびにセッションが更新され、権限表に沿って表示が
  変わる。URL に氏名や金額が乗っていないことをブラウザのアドレスバーで確認する
  （憲法 IV）。

---

## 8. テスト実行

```bash
# 型チェックと lint
npm run typecheck
npm run lint

# 単体（業務ルール BR-### 中心）
npm run test:unit

# 契約（Route Handlers と contracts/*.md の整合）
npm run test:contract

# E2E（Playwright、Desktop + iPhone 13 の 2 プロファイル）
npm run test:e2e

# PII 静的スキャン（ログ出力に個人情報が渡っていないか）
npm run scan:pii

# 一括（コミット前）
npm run check
```

CI は未使用（本機能はローカル PC 単独運用のため、plan.md の複雑度トラッキング参照）。
`npm run check` をコミット前フックとして呼ぶ想定で、husky 等での自動化は実装
タスクで検討する。

---

## 9. バックアップ

本機能のデータは `C:\dev\projects\travel-expense\data\` に集約する。バックアップは
このフォルダを丸ごとコピーすれば十分（SQLite ファイル・領収書画像・ファイル保存の
メール `.eml`・支払用 CSV すべて含む）。

---

## 10. トラブルシュート

- 画面に英語の例外が出た: `src/server/errors/to-user-message.ts` の変換経路を通って
  いない。例外を投げる手前で変換するか、UI 側 `error.tsx` で救う（憲法 I）。
- ログイン後に `/approvals` が空: 権限表の設定、または `nextApproverEmpNo` の
  解決（代理指名の有効期間）を確認する。
- 支払用 CSV の列が足りない: `PaymentCsvExport.layoutVersion` を確認し、受領した
  レイアウト定義で新しいバージョンを追加する（FR-016）。
- 人事 CSV 取込が失敗: `/admin/hr-import/history` でエラー行を確認し、同じ CSV を
  修正して再取込する。既存の社員情報はそのまま適用され続ける（FR-032）。
