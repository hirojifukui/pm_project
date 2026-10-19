# エージェント向け運用ガイド（旅費精算システム）

このファイルは Claude Code を含むエージェントがこのプロジェクトを扱うときの運用規約を日本語でまとめたものです。CLAUDE.md から `@AGENTS.md` 構文で参照されます。

## 1. 本機能の進め方

- 本機能は Spec Kit 日本語版のワークフローで駆動します。既存の成果物は `.specify/` と `specs/001-travel-expense-reimbursement/` にあります。
- 新しい変更は `/speckit-*` コマンドで扱う前提です。業務要件を変える場合は `docs/requirements/travel-expense-hearing.md` の対応 ID（R-xx / E-xx / Q-xx）を一次情報として参照してください。

## 2. 業務ルールはテスト先行（憲法 III、NON-NEGOTIABLE）

- 業務ルール（BR-###）と業務上の例外処理（EX-###）には必ず自動テストを**先に**書いてください（Red → Green の順）。
- テストは `tests/unit/domain/rules/BR-###.*.spec.ts` に 1 ルール 1 ファイルで配置し、境界値・異常系・通常ケースの 3 系列を網羅します。
- 業務ルールの実装は `src/domain/rules/BR-###.*.ts` に配置します。Node ランタイムに依存しない純粋関数として書き、Prisma や Next.js を import しないでください。

## 3. コミット前に必ず実行するコマンド

```bash
npm run check
```

このコマンドは以下を順に実行します。1 つでも失敗したらコミットしません。

1. `tsc --noEmit`（型チェック）
2. `eslint`（lint）
3. `vitest run --dir tests/unit`（業務ルール単体テスト）
4. `vitest run --dir tests/contract`（契約テスト）
5. `node scripts/scan-pii.mjs`（個人情報の静的スキャン）

## 4. 画面文言は `src/i18n/ja.ts` に集約（憲法 I）

- 画面に出るすべての文字列（ラベル・ボタン・エラー・バリデーション・通知・CSV ヘッダ）は `src/i18n/ja.ts` の辞書を参照して描画してください。
- 例外は必ず `src/server/errors/to-user-message.ts` を通して日本語メッセージに変換します。英語の技術例外（`undefined`、`null`、`Internal Server Error` 等）を UI にそのまま出さないでください。

## 5. 個人情報を URL・ログ・外部送信に出さない（憲法 IV、FR-019）

- URL のクエリ・パスパラメータに氏名・社員番号・金額・口座情報・出張先を乗せません。申請の識別には `applicationNumber`（`JP-YYYY-NNNNNN`）だけを使います。
- ログは Pino の `redact` 設定で PII キーワード（`name`、`empNo`、`amount`、`destination`、`account*`、`receipt*`）を伏せ字にします。
- 個人情報を直接表示する画面・API ハンドラは、必ず冒頭で `logPiiAccess({ accessor, application, reasonCode })` を呼び、監査ログに残します（`src/server/pii-access.ts`）。
- `npm run scan:pii`（T031 で実装）が `console.*` と `logger.*` の第 2 引数に PII が渡っていないかを AST で検出します。違反は 0 件を保つこと。

## 6. 認証の境界

- 本機能のローカル実装では、`src/server/auth/dev-login.ts`（利用者切替の簡易ログイン）で認証を代替しています。これは FR-030 の例外運用で、本番展開前に本来の社内 SSO 連携に差し替える前提です。
- 認証に関わるすべてのサーバーコードは `src/server/auth/session.ts` の `getCurrentUser()` を単一の境界として使ってください。
