---
name: "speckit-implement"
description: tasks.md に定義された全タスクを処理・実行し、実装計画を遂行する
argument-hint: "Optional implementation guidance or task filter"
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/implement.md"
user-invocable: true
disable-model-invocation: false
---

## ユーザー入力

```text
$ARGUMENTS
```

続行する前に、ユーザー入力（空でない場合）を**必ず**考慮すること。

## 実行前チェック

**拡張フックの確認（実装前）**:
- プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在する場合は読み込み、`hooks.before_implement` キー配下のエントリを探す
- YAML がパースできない、または不正な場合は黙ってスキップしない。`.specify/extensions.yml` を読めなかったこと（パーサーのエラーを含める）と、そこに登録された必須（`optional: false`）フックを含めてフックが一切チェックされなかったことをユーザーに伝え、その上で通常どおり続行する
- `enabled` が明示的に `false` のフックは除外する。`enabled` フィールドを持たないフックは既定で有効として扱う。
- 残った各フックについて、フックの `condition` 式を解釈・評価しようと**しない**こと:
  - フックに `condition` フィールドがない、または null/空の場合、そのフックは実行可能として扱う
  - フックが空でない `condition` を定義している場合、そのフックはスキップし、condition の評価は HookExecutor の実装に委ねる
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
    上記のブロックを出力した後、実際にフックを呼び出し、その完了を待ってから続行しなければならない。このエージェント/セッションで自分がそのコマンドを実行するのと同じ方法で実行すること（呼び出し方は上に示した文字どおりの `{command}` ID とは異なる場合がある。例えば skills モードのエージェントでは `/skill:speckit-...` や `$speckit-...` として実行する）。ブロックを出力しただけではフックは実行されない。
- フックが登録されていない、または `.specify/extensions.yml` が存在しない場合は、黙ってスキップする

## 手順概要

1. リポジトリルートから `{SCRIPT}` を実行し、FEATURE_DIR と AVAILABLE_DOCS のリストをパースする。すべてのパスは絶対パスでなければならない。"I'm Groot" のように引数にシングルクォートが含まれる場合は、エスケープ構文を使う。例: 'I'\''m Groot'（可能ならダブルクォートでもよい: "I'm Groot"）。

2. **チェックリストの状態を確認する**（FEATURE_DIR/checklists/ が存在する場合）:
   - チェックリストのマーカーは読み取り専用のゲートとして扱う。チェックボックスの状態をスキャンし、状態を報告し、必要に応じて続行前に確認を取ること。チェックリストのファイルやマーカーを変更しては**ならない**
   - `checklists/requirements.md` は `/speckit-specify` と `/speckit-clarify` が保守する組み込みの仕様書品質チェックリストである。`/speckit-checklist` が生成するカスタムチェックリストは、レビュアーが所有する要件品質レビューの成果物である
   - カスタムチェックリストにおいて `[x]` は、レビュアーがその要件品質基準を満たしていると判断したことを意味する。実装作業が完了したという意味では**ない**
   - checklists/ ディレクトリ内のすべてのチェックリストファイルをスキャンする
   - 各チェックリストについて、次を数える:
     - 総項目数: `- [ ]`、`- [X]`、`- [x]` のいずれかに一致する全行
     - チェック済み項目数: `- [X]` または `- [x]` に一致する行
     - 未チェック項目数: `- [ ]` に一致する行
   - 状態テーブルを作成する:

     ```text
     | Checklist | Total | Checked | Unchecked | Status |
     |-----------|-------|---------|-----------|--------|
     | ux.md     | 12    | 12      | 0         | ✓ PASS |
     | test.md   | 8     | 5       | 3         | ✗ FAIL |
     | security.md | 6   | 6       | 0         | ✓ PASS |
     ```

   - 全体の状態を算出する:
     - **PASS**: すべてのチェックリストで未チェック項目が 0
     - **FAIL**: 1つ以上のチェックリストに未チェック項目がある

   - **未チェック項目があるチェックリストが1つでもある場合**:
     - 未チェック項目数を含めてテーブルを表示する
     - **停止**して次を尋ねる: 「未チェック項目が残っているチェックリストがあります。それでも実装を進めますか？（はい/いいえ）」
     - 続行する前にユーザーの応答を待つ
     - ユーザーが「いいえ」「待って」「停止」と答えた場合、実行を中止する
     - ユーザーが「はい」「進めて」「続行」と答えた場合、手順3へ進む

   - **すべてのチェックリストがチェック済みの場合**:
     - すべてのチェックリストが合格したことを示すテーブルを表示する
     - 自動的に手順3へ進む

3. 実装コンテキストを読み込んで分析する:
   - **必須**: tasks.md を読み、タスク一覧と実行計画の全体を把握する
   - **必須**: plan.md を読み、技術スタック・アーキテクチャ・ファイル構成を把握する
   - **存在する場合**: data-model.md を読み、エンティティと関連を把握する
   - **存在する場合**: contracts/ を読み、API 仕様とテスト要件を把握する
   - **存在する場合**: research.md を読み、技術的決定と制約を把握する
   - **存在する場合**: /memory/constitution.md を読み、ガバナンス上の制約を把握する
   - **存在する場合**: quickstart.md を読み、統合シナリオを把握する

4. **プロジェクトセットアップの検証**:
   - **必須**: 実際のプロジェクト構成に基づいて ignore ファイルを作成/検証する:

   **検出と作成のロジック**:
   - 次のコマンドが成功するかどうかでリポジトリが git リポジトリかを判定する（そうであれば .gitignore を作成/検証する）:

     ```sh
     git rev-parse --git-dir 2>/dev/null
     ```

   - Dockerfile* が存在する、または plan.md に Docker の記載があるか確認 → .dockerignore を作成/検証
   - .eslintrc* が存在するか確認 → .eslintignore を作成/検証
   - eslint.config.* が存在するか確認 → 設定の `ignores` エントリが必要なパターンを網羅していることを保証する
   - .prettierrc* が存在するか確認 → .prettierignore を作成/検証
   - .npmrc または package.json が存在するか確認 → .npmignore を作成/検証（公開する場合）
   - terraform ファイル（*.tf）が存在するか確認 → .terraformignore を作成/検証
   - .helmignore が必要か確認（helm チャートがある場合）→ .helmignore を作成/検証

   **ignore ファイルが既に存在する場合**: 必須パターンが含まれているか検証し、不足している重要なパターンのみを追記する
   **ignore ファイルが存在しない場合**: 検出された技術向けの完全なパターン一式で作成する

   **技術別の共通パターン**（plan.md の技術スタックに基づく）:
   - **Node.js/JavaScript/TypeScript**: `node_modules/`, `dist/`, `build/`, `*.log`, `.env*`
   - **Python**: `__pycache__/`, `*.pyc`, `.venv/`, `venv/`, `dist/`, `*.egg-info/`
   - **Java**: `target/`, `*.class`, `*.jar`, `.gradle/`, `build/`
   - **C#/.NET**: `bin/`, `obj/`, `*.user`, `*.suo`, `packages/`
   - **Go**: `*.exe`, `*.test`, `vendor/`, `*.out`
   - **Ruby**: `.bundle/`, `log/`, `tmp/`, `*.gem`, `vendor/bundle/`
   - **PHP**: `vendor/`, `*.log`, `*.cache`, `*.env`
   - **Rust**: `target/`, `debug/`, `release/`, `*.rs.bk`, `*.rlib`, `*.prof*`, `.idea/`, `*.log`, `.env*`
   - **Kotlin**: `build/`, `out/`, `.gradle/`, `.idea/`, `*.class`, `*.jar`, `*.iml`, `*.log`, `.env*`
   - **C++**: `build/`, `bin/`, `obj/`, `out/`, `*.o`, `*.so`, `*.a`, `*.exe`, `*.dll`, `.idea/`, `*.log`, `.env*`
   - **C**: `build/`, `bin/`, `obj/`, `out/`, `*.o`, `*.a`, `*.so`, `*.exe`, `*.dll`, `autom4te.cache/`, `config.status`, `config.log`, `.idea/`, `*.log`, `.env*`
   - **Swift**: `.build/`, `DerivedData/`, `*.swiftpm/`, `Packages/`
   - **R**: `.Rproj.user/`, `.Rhistory`, `.RData`, `.Ruserdata`, `*.Rproj`, `packrat/`, `renv/`
   - **共通**: `.DS_Store`, `Thumbs.db`, `*.tmp`, `*.swp`, `.vscode/`, `.idea/`

   **ツール固有のパターン**:
   - **Docker**: `node_modules/`, `.git/`, `Dockerfile*`, `.dockerignore`, `*.log*`, `.env*`, `coverage/`
   - **ESLint**: `node_modules/`, `dist/`, `build/`, `coverage/`, `*.min.js`
   - **Prettier**: `node_modules/`, `dist/`, `build/`, `coverage/`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
   - **Terraform**: `.terraform/`, `*.tfstate*`, `*.tfvars`, `.terraform.lock.hcl`
   - **Kubernetes/k8s**: `*.secret.yaml`, `secrets/`, `.kube/`, `kubeconfig*`, `*.key`, `*.crt`

5. tasks.md の構造をパースし、次を抽出する:
   - **タスクフェーズ**: セットアップ、テスト、コア、統合、仕上げ
   - **タスク依存関係**: 逐次実行か並列実行かのルール
   - **タスク詳細**: ID、説明、ファイルパス、並列マーカー [P]
   - **実行フロー**: 順序と依存関係の要件

6. タスク計画に従って実装を実行する:
   - **フェーズごとの実行**: 次に進む前に各フェーズを完了させる
   - **依存関係の尊重**: 逐次タスクは順番に実行し、並列タスク [P] は同時に実行してよい
   - **TDD アプローチの遵守**: テストタスクを、対応する実装タスクより先に実行する
   - **ファイル単位の調整**: 同じファイルに影響するタスクは逐次実行しなければならない
   - **検証チェックポイント**: 各フェーズの完了を検証してから次へ進む

7. 実装実行のルール:
   - **まずセットアップ**: プロジェクト構成、依存関係、設定を初期化する
   - **コードよりテストを先に**: コントラクト、エンティティ、統合シナリオのテストを書く必要がある場合
   - **コア開発**: モデル、サービス、CLI コマンド、エンドポイントを実装する
   - **統合作業**: データベース接続、ミドルウェア、ロギング、外部サービス
   - **仕上げと検証**: ユニットテスト、パフォーマンス最適化、ドキュメント

8. 進捗管理とエラー処理:
   - タスクを1つ完了するごとに進捗を報告する
   - 並列でないタスクが失敗した場合は実行を中止する
   - 並列タスク [P] については、成功したタスクは続行し、失敗したものを報告する
   - デバッグに役立つコンテキストを含む明確なエラーメッセージを提供する
   - 実装を続行できない場合は次のステップを提案する
   - **重要** 完了したタスクは、tasks ファイル内で必ず `[X]` としてマークすること。

9. 完了検証:
   - 必要なタスクがすべて完了していることを検証する
   - 実装された機能が元の仕様書と一致していることを確認する
   - テストが通り、カバレッジが要件を満たしていることを検証する
   - 実装が技術計画に従っていることを確認する

注: このコマンドは tasks.md に完全なタスク分解が存在することを前提としている。タスクが不完全または欠落している場合は、まず `/speckit-tasks` を実行してタスク一覧を再生成するよう提案すること。

## 必須の実行後フック

**ユーザーに完了を報告する前に、このセクションを必ず完了させること。**

プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在しない場合、または `hooks.after_implement` 配下にフックが登録されていない場合は、完了レポートまでスキップする。
- 存在する場合は読み込み、`hooks.after_implement` キー配下のエントリを探す。
- YAML がパースできない、または不正な場合は黙ってスキップしない。`.specify/extensions.yml` を読めなかったこと（パーサーのエラーを含める）と、そこに登録された必須（`optional: false`）フックを含めてフックが一切チェックされなかったことをユーザーに伝え、その上で完了レポートへ進む。
- `enabled` が明示的に `false` のフックは除外する。`enabled` フィールドを持たないフックは既定で有効として扱う。
- 残った各フックについて、フックの `condition` 式を解釈・評価しようと**しない**こと:
  - フックに `condition` フィールドがない、または null/空の場合、そのフックは実行可能として扱う
  - フックが空でない `condition` を定義している場合、そのフックはスキップし、condition の評価は HookExecutor の実装に委ねる
- 実行可能な各フックについて、その `optional` フラグに応じて以下を出力する:
  - **必須フック**（`optional: false`） — **必須フックごとに `EXECUTE_COMMAND:` を必ず出力すること**:
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
    上記のブロックを出力した後、実際にフックを呼び出し、その完了を待ってから続行しなければならない。このエージェント/セッションで自分がそのコマンドを実行するのと同じ方法で実行すること（呼び出し方は上に示した文字どおりの `{command}` ID とは異なる場合がある。例えば skills モードのエージェントでは `/skill:speckit-...` や `$speckit-...` として実行する）。ブロックを出力しただけではフックは実行されない。
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

完了した作業の要約とともに最終状態を報告する。

## 完了条件

- [ ] tasks.md の全タスクが完了し、`[X]` でマークされている
- [ ] 実装が仕様書・計画・テストカバレッジに照らして検証されている
- [ ] 拡張フックが、上記「必須の実行後フック」のルールに従ってディスパッチまたはスキップされている
- [ ] 完了した作業の要約とともに、ユーザーに完了が報告されている


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
