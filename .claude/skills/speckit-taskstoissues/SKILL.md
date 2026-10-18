---
name: "speckit-taskstoissues"
description: 既存のタスクを、利用可能な設計成果物に基づき、実行可能で依存関係順に並んだ GitHub Issue へ変換する。
argument-hint: "Optional filter or label for GitHub issues"
compatibility: "Requires spec-kit project structure with .specify/ directory"
metadata:
  author: "github-spec-kit"
  source: "templates/commands/taskstoissues.md"
user-invocable: true
disable-model-invocation: false
---

## ユーザー入力

```text
$ARGUMENTS
```

続行する前に、ユーザー入力（空でない場合）を**必ず**考慮すること。

## 実行前チェック

**拡張フックの確認（タスクから Issue への変換前）**:
- プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在する場合は読み込み、`hooks.before_taskstoissues` キー配下のエントリを探す
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
1. **存在する場合**: `/memory/constitution.md` を読み込み、プロジェクトの原則とガバナンス上の制約を把握する。
1. 実行したスクリプトの出力から、**tasks** へのパスを抽出する。
1. 次を実行して Git のリモートを取得する:

```bash
git config --get remote.origin.url
```

> [!CAUTION]
> リモートが GitHub の URL である場合のみ、次の手順に進むこと

1. **重複排除のために既存 Issue を取得する**: 何かを作成する前に、これから処理するタスク ID の集合を `tasks.md` から構築する（各 ID は `T` に**少なくとも**3桁の数字が続く形式。例: `T001`。`/speckit-converge` は新しい ID を `T{M+1:03d}` で割り当てるが、これは上限ではなく下限なので、ファイル内のタスクが999個を超えると ID は4桁以上になる）。次に、GitHub MCP サーバーの `list_issues` ツールを使い、それらの ID を既にカバーしている Issue を探す。`state` の値は渡さないこと。省略するとツールがオープンとクローズド両方の Issue を返すためである。呼び出し回数を抑えるため `perPage: 100` を指定し、またこのツールはカーソルベースのページネーションを使うので、`after` パラメータ（前回のレスポンスの `endCursor` を使用）でページを要求する。各 Issue のタイトルをタスク ID のパターン `\bT\d{3,}\b` と照合し（`{3,}` は4桁以上の ID も受け付ける。`\d{3}` では末尾の `\b` が数字と数字の間には入らないため、`T1000` を含むタイトルはまったく一致せず、そのタスクは重複排除も作成もされないまま黙って取りこぼされる。単語境界は `ST001` のようなトークンが一致するのを引き続き防ぎ、数字の連なり全体を消費させるので `T100` が `T1000` の内部に一致することはない。これは `T001 ...`、`T001: ...`、`[T001] ...` と書かれたタイトルも認識する）、自分のタスク ID のいずれかに一致した場合、その ID は既に Issue があるものとしてマークする。すべてのタスク ID が一致し終えた時点、またはページが尽きた時点でページネーションを停止し、すべてのタスク ID の所在が判明した後もリポジトリ全体の Issue 履歴を取得し続けないようにする。これにより Issue 履歴が巨大なリポジトリでも呼び出し回数が抑えられ、`tasks.md` の再生成後やスキルの再実行後にこのコマンドを再度実行しても重複を防げる。
1. リスト内の各タスクについて、GitHub MCP サーバーを使い、その Git リモートに対応するリポジトリに新しい Issue を作成する。`tasks.md` のタスク行は markdown のチェックボックスで始まるため、まず先頭の `- [ ]`（および `[P]` / `[US#]` マーカー）を取り除いて、タスク ID とその説明を復元する。Issue は `T001: <description>` という形式の単一の正規タイトルで作成し、ID を1度だけ書いた後にタスクの説明を続ける（例えば `- [ ] T001 Create project structure` という行は、タイトル `T001: Create project structure` になる）。
   - 前の手順で得た既存 Issue の集合に ID が既に含まれているタスクは**スキップ**し、その旨を報告する（例: `T001 already has an issue, skipping`）。
   - 対応する Issue がまだ存在しないタスクについてのみ Issue を作成する。

> [!CAUTION]
> リモート URL と一致しないリポジトリに Issue を作成することは、いかなる状況でも絶対に禁止

## 実行後チェック

**拡張フックの確認（タスクから Issue への変換後）**:
プロジェクトルートに `.specify/extensions.yml` が存在するか確認する。
- 存在する場合は読み込み、`hooks.after_taskstoissues` キー配下のエントリを探す
- YAML がパースできない、または不正な場合は黙ってスキップしない。`.specify/extensions.yml` を読めなかったこと（パーサーのエラーを含める）と、そこに登録された必須（`optional: false`）フックを含めてフックが一切チェックされなかったことをユーザーに伝え、その上で通常どおり続行する
- `enabled` が明示的に `false` のフックは除外する。`enabled` フィールドを持たないフックは既定で有効として扱う。
- 残った各フックについて、フックの `condition` 式を解釈・評価しようと**しない**こと:
  - フックに `condition` フィールドがない、または null/空の場合、そのフックは実行可能として扱う
  - フックが空でない `condition` を定義している場合、そのフックはスキップし、condition の評価は HookExecutor の実装に委ねる
- 実行可能な各フックについて、その `optional` フラグに応じて以下を出力する:
  - **任意フック**（`optional: true`）:
    ```
    ## Extension Hooks

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **必須フック**（`optional: false`）:
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
    上記のブロックを出力した後、実際にフックを呼び出し、その完了を待ってから続行しなければならない。このエージェント/セッションで自分がそのコマンドを実行するのと同じ方法で実行すること（呼び出し方は上に示した文字どおりの `{command}` ID とは異なる場合がある。例えば skills モードのエージェントでは `/skill:speckit-...` や `$speckit-...` として実行する）。ブロックを出力しただけではフックは実行されない。
- フックが登録されていない、または `.specify/extensions.yml` が存在しない場合は、黙ってスキップする


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
