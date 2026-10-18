---
name: "speckit-plan"
description: 計画テンプレートを用いて実装計画ワークフローを実行し、設計成果物を生成する。
argument-hint: "Optional guidance for the planning phase"
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/plan.md"
user-invocable: true
disable-model-invocation: false
---

## ユーザー入力

```text
$ARGUMENTS
```

先に進む前に、（空でなければ）ユーザー入力を**必ず**考慮すること。

## 実行前チェック

**拡張フックの確認（計画策定の前）**:
- プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在する場合はそれを読み、`hooks.before_plan` キー配下のエントリを探す
- YAML がパースできない、または不正な場合は黙ってスキップしない: `.specify/extensions.yml` を読めなかったこと（パーサーのエラーを含める）、およびそこに登録された必須（`optional: false`）フックを含めてフックが一切チェックされなかったことをユーザーに伝え、その後は通常どおり続行する
- `enabled` が明示的に `false` のフックを除外する。`enabled` フィールドを持たないフックは既定で有効として扱う。
- 残った各フックについて、フックの `condition` 式を解釈・評価しようと**しない**こと:
  - フックに `condition` フィールドがない、または null/空の場合、そのフックは実行可能として扱う
  - フックが空でない `condition` を定義している場合、そのフックはスキップし、条件の評価は HookExecutor の実装に委ねる
- 実行可能な各フックについて、その `optional` フラグに応じて以下を出力する:
  - **任意フック**（`optional: true`）:
    ```
    ## Extension Hooks

    **Optional Pre-Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **必須フック**（`optional: false`）:
    ```
    ## Extension Hooks

    **Automatic Pre-Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}

    Wait for the result of the hook command before proceeding to the Outline.
    ```
    上記のブロックを出力した後、続行する前に実際にフックを起動し、その完了を待つこと。自分がこのエージェント／セッションでそのコマンドを実行するのと同じやり方で実行する（起動方法は上に示した文字どおりの `{command}` ID とは異なる場合がある。例: skills モードのエージェントは `/skill:speckit-...` または `$speckit-...` として実行する）。ブロックを出力しただけではフックは実行されない。
- フックが1つも登録されていない場合、または `.specify/extensions.yml` が存在しない場合は、黙ってスキップする

## 概略

1. **セットアップ**: リポジトリルートから `{SCRIPT}` を実行し、JSON をパースして FEATURE_SPEC、IMPL_PLAN、FEATURE_DIR、BRANCH を取得する。"I'm Groot" のように引数にシングルクォートが含まれる場合は、エスケープ記法を使う: 例 'I'\''m Groot'（可能ならダブルクォートでもよい: "I'm Groot"）。

2. **コンテキストの読み込み**: FEATURE_SPEC と `/memory/constitution.md` を読む。IMPL_PLAN テンプレート（コピー済み）を読み込む。

3. **計画ワークフローの実行**: IMPL_PLAN テンプレートの構成に従い、以下を行う:
   - 技術コンテキストを埋める（不明点は "NEEDS CLARIFICATION" と記す）
   - 憲法から憲法チェックのセクションを埋める
   - ゲートを評価する（違反が正当化されていない場合は ERROR）
   - フェーズ0: research.md を生成する（すべての NEEDS CLARIFICATION を解消する）
   - フェーズ1: data-model.md、contracts/、quickstart.md を生成する
   - 設計後に憲法チェックを再評価する

## 必須の実行後フック

**ユーザーに完了を報告する前に、このセクションを必ず完了させること。**

プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在しない場合、または `hooks.after_plan` 配下にフックが登録されていない場合は、「完了レポート」へ進む。
- 存在する場合はそれを読み、`hooks.after_plan` キー配下のエントリを探す。
- YAML がパースできない、または不正な場合は黙ってスキップしない: `.specify/extensions.yml` を読めなかったこと（パーサーのエラーを含める）、およびそこに登録された必須（`optional: false`）フックを含めてフックが一切チェックされなかったことをユーザーに伝え、その後「完了レポート」へ続行する。
- `enabled` が明示的に `false` のフックを除外する。`enabled` フィールドを持たないフックは既定で有効として扱う。
- 残った各フックについて、フックの `condition` 式を解釈・評価しようと**しない**こと:
  - フックに `condition` フィールドがない、または null/空の場合、そのフックは実行可能として扱う
  - フックが空でない `condition` を定義している場合、そのフックはスキップし、条件の評価は HookExecutor の実装に委ねる
- 実行可能な各フックについて、その `optional` フラグに応じて以下を出力する:
  - **必須フック**（`optional: false`） — **必須フックごとに `EXECUTE_COMMAND:` を必ず出力すること**:
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
    上記のブロックを出力した後、続行する前に実際にフックを起動し、その完了を待つこと。自分がこのエージェント／セッションでそのコマンドを実行するのと同じやり方で実行する（起動方法は上に示した文字どおりの `{command}` ID とは異なる場合がある。例: skills モードのエージェントは `/skill:speckit-...` または `$speckit-...` として実行する）。ブロックを出力しただけではフックは実行されない。
  - **任意フック**（`optional: true`）:
    ```
    ## Extension Hooks

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```

## 完了レポート

コマンドはフェーズ1の設計をもって終了する。ブランチ、IMPL_PLAN のパス、生成された成果物を報告する。

## フェーズ

### フェーズ0: 概略と調査

1. 上記の**技術コンテキストから不明点を抽出する**:
   - NEEDS CLARIFICATION ごと → 調査タスク
   - 依存関係ごと → ベストプラクティス調査タスク
   - 統合ポイントごと → パターン調査タスク

2. **調査エージェントの生成とディスパッチ**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. 次の形式で `research.md` に**調査結果を集約する**:
   - Decision: [何を選んだか]
   - Rationale: [なぜ選んだか]
   - Alternatives considered: [ほかに何を評価したか]

**出力**: すべての NEEDS CLARIFICATION が解消された research.md

### フェーズ1: 設計と契約

**前提条件:** `research.md` が完了していること

1. **機能仕様書からエンティティを抽出する** → `data-model.md`:
   - エンティティ名、フィールド、関連
   - 要件に基づくバリデーション規則
   - 該当する場合は状態遷移

2. **インターフェース契約を定義する**（プロジェクトが外部インターフェースを持つ場合） → `/contracts/`:
   - プロジェクトがユーザーや他システムに公開するインターフェースを特定する
   - プロジェクトの種類に適した契約形式で文書化する
   - 例: ライブラリの公開 API、CLI ツールのコマンドスキーマ、Web サービスのエンドポイント、パーサーの文法、アプリケーションの UI 契約
   - プロジェクトが純粋に内部向け（ビルドスクリプト、使い捨てツールなど）の場合はスキップする

3. **クイックスタート検証ガイドを作成する** → `quickstart.md`:
   - 機能がエンドツーエンドで動作することを示す、実行可能な検証シナリオを文書化する
   - 前提条件、セットアップコマンド、テスト／実行コマンド、期待される結果を含める
   - 契約やデータモデルの詳細は複製せず、リンクまたは参照を用いる
   - 完全な実装コード、モデル／サービス／コントローラの本体、マイグレーション、完全なテストスイートは含めない
   - この成果物は検証・実行のガイドとして保つ。実装の詳細は `tasks.md` と実装フェーズに属する

**出力**: data-model.md、/contracts/*、quickstart.md

## 主要ルール

- ファイルシステム操作には絶対パスを使う。ドキュメント内の参照にはプロジェクト相対パスを使う
- ゲートの失敗や未解消の明確化がある場合は ERROR とする

## 完了条件

- [ ] 計画ワークフローが実行され、設計成果物が生成されている
- [ ] 上記「必須の実行後フック」のルールに従って拡張フックがディスパッチまたはスキップされている
- [ ] ブランチ、計画のパス、生成された成果物とともに完了がユーザーに報告されている


---

## 日本語出力ガードレール（Spec Kit 日本語版 / 全コマンド共通）

このセクションは Spec Kit 日本語版が全コマンドに付与する共通の後処理規約である。**省略してはならない。**

### G1. 成果物の記述言語

このコマンドがファイルを生成・更新する場合（`spec.md` / `plan.md` / `tasks.md` / `checklists/*.md` / `.specify/memory/constitution.md` / `research.md` / `data-model.md` / `quickstart.md` / `contracts/` 配下など）、その本文は**日本語**で記述すること。ユーザーへのチャット応答も日本語で行う。

次のものは例外として**英語のまま**維持する。

- ソースコード、シェルコマンド、識別子、型名、ファイルパス、ディレクトリ名、ブランチ名
- `[NEEDS CLARIFICATION: ...]`、`[P]`、`FR-###`、`SC-###`、`NFR-###`、`US1`/`US2`/`US3`、`T001` などの機械可読マーカーおよびID書式
- 業務分析拡張の ID 書式（`BR-###`、`EX-###`）と、ヒアリングシートの ID 書式（`AS-01`、`TB-01`、`R-01`、`E-01`、`Q-01`）
- `**Given**` / `**When**` / `**Then**`（Gherkin 記法）
- 外部ツールやこのコマンド自身が解釈する固定文字列（`EXECUTE_COMMAND:` など）
- 技術用語の原語表記が適切な場合の英単語（API、CI、OAuth など）

ユーザーが英語で指示した場合や、既存の成果物が英語で書かれている場合は、その言語に合わせてよい。それ以外は日本語を既定とする。

### G2. 文字化け検証（書き込み後に必ず実行）

ファイルの書き込み・編集が完了したら、**毎回**次の手順を実行する。

1. 書き込んだファイルを読み直す。
2. 次のいずれかに該当しないか確認する。
   - 置換文字 U+FFFD（いわゆる「黒ひし形に疑問符」の記号）が含まれる
   - mojibake パターンが含まれる（`ã`, `â`, `ï¿½`, `ãƒ`, `æ–‡`, `ð` で始まる不自然な連なりなど）
   - 日本語で書くべき本文が英語のままになっている（G1 の例外を除く）
   - 見出しや表が壊れている（列数の不一致、閉じていないコードフェンス）
3. 該当した場合は、そのファイルを **UTF-8 (BOMなし)** で**丸ごと書き直す**。差分パッチや部分置換で済ませない。
4. 書き直しを2回試しても解消しない場合は、作業を中断し、ユーザーに次を報告する。

   > 文字化けが解消しません。エディタまたは端末のエンコーディング設定（UTF-8 / コードページ）を確認してください。Windows PowerShell の場合は `$PSDefaultParameterValues['*:Encoding']='utf8'` と `chcp 65001` を確認してください。

### G3. 用語の統一

同一プロジェクト内では訳語を揺らさない。既に `spec.md` や `constitution.md` で使われている訳語があれば、それに合わせる。判断に迷う場合は英語を併記する（例: 受け入れシナリオ (acceptance scenario)）。
