# プロジェクト指示

<!-- BEGIN speckit-ja: 言語ポリシー -->
## 言語ポリシー（Spec Kit 日本語版）

- 仕様書・計画・タスク・チェックリスト・憲法など、`specs/` および `.specify/memory/` 配下の成果物は**日本語**で記述する。
- チャットでの応答も日本語で行う。
- コード、識別子、ファイルパス、ブランチ名、`[NEEDS CLARIFICATION: ...]` や `FR-###`・`BR-###`・`EX-###` などの機械可読マーカー、`**Given**` / `**When**` / `**Then**` は英語のまま維持する。
- 業務ルールの仕様化では、`docs/requirements/` のヒアリングシート（雛形は `.specify/templates/hearing-sheet-template.md`）を一次情報とし、仕様書の `## 業務要件` に出典 ID を付けて反映する。
- ファイルを書き込んだら読み直し、置換文字（U+FFFD）や mojibake が無いか確認する。見つかったら UTF-8 (BOMなし) で丸ごと書き直す。
<!-- END speckit-ja: 言語ポリシー -->
