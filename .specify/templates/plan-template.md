# 実装計画: [機能]

**ブランチ**: `[###-feature-name]` | **日付**: [DATE] | **仕様書**: [link]

**入力**: `/specs/[###-feature-name]/spec.md` の機能仕様書

**注記**: このテンプレートは `/speckit-plan` コマンドが埋める。実行ワークフローはその定義に記述されている。

## 概要

[機能仕様書から抽出: 主要な要件 + リサーチに基づく技術的アプローチ]

## 技術コンテキスト

<!--
  要対応: このセクションの内容を、プロジェクトの技術的詳細で
  置き換えること。ここに示す構成は、反復のプロセスを導くための
  参考として提示されている。
-->

**言語／バージョン**: [例: Python 3.11、Swift 5.9、Rust 1.75 または NEEDS CLARIFICATION]

**主要な依存関係**: [例: FastAPI、UIKit、LLVM または NEEDS CLARIFICATION]

**ストレージ**: [該当する場合、例: PostgreSQL、CoreData、ファイル または N/A]

**テスト**: [例: pytest、XCTest、cargo test または NEEDS CLARIFICATION]

**ターゲットプラットフォーム**: [例: Linux サーバー、iOS 15+、WASM または NEEDS CLARIFICATION]

**プロジェクト種別**: [例: library/cli/web-service/mobile-app/compiler/desktop-app または NEEDS CLARIFICATION]

**パフォーマンス目標**: [ドメイン固有、例: 1000 req/s、10k lines/sec、60 fps または NEEDS CLARIFICATION]

**制約**: [ドメイン固有、例: p95 で 200ms 未満、メモリ 100MB 未満、オフライン対応 または NEEDS CLARIFICATION]

**規模／スコープ**: [ドメイン固有、例: 1万ユーザー、100万行、50画面 または NEEDS CLARIFICATION]

## 憲法チェック

*ゲート: フェーズ0のリサーチ前に通過しなければならない。フェーズ1の設計後に再チェックする。*

[憲法ファイルに基づいて決定されるゲート]

## プロジェクト構成

### ドキュメント（本機能）

```text
specs/[###-feature]/
├── plan.md              # このファイル（/speckit-plan コマンドの出力）
├── research.md          # フェーズ0の出力（/speckit-plan コマンド）
├── data-model.md        # フェーズ1の出力（/speckit-plan コマンド）
├── quickstart.md        # フェーズ1の出力（/speckit-plan コマンド）
├── contracts/           # フェーズ1の出力（/speckit-plan コマンド）
└── tasks.md             # フェーズ2の出力（/speckit-tasks コマンド — /speckit-plan は作成しない）
```

### ソースコード（リポジトリルート）
<!--
  要対応: 以下のプレースホルダのツリーを、本機能の具体的なレイアウトで
  置き換えること。使わない選択肢は削除し、選んだ構成を実際のパス
  （例: apps/admin、packages/something）で展開する。納品する計画には、
  オプションのラベルを含めてはならない。
-->

```text
# [REMOVE IF UNUSED] オプション1: 単一プロジェクト（デフォルト）
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] オプション2: Web アプリケーション（"frontend" + "backend" を検出した場合）
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] オプション3: モバイル + API（"iOS/Android" を検出した場合）
api/
└── [上記の backend と同じ]

ios/ または android/
└── [プラットフォーム固有の構成: 機能モジュール、UI フロー、プラットフォームのテスト]
```

**構成の決定**: [選択した構成を記録し、上で捉えた実際の
ディレクトリを参照すること]

## 複雑度トラッキング

> **憲法チェックに、正当化が必要な違反がある場合のみ記入する**

| 違反 | 必要な理由 | より単純な代替案を却下した理由 |
|-----------|------------|-------------------------------------|
| [例: 4つ目のプロジェクト] | [現在のニーズ] | [なぜ3プロジェクトでは不十分か] |
| [例: リポジトリパターン] | [具体的な問題] | [なぜ DB への直接アクセスでは不十分か] |
