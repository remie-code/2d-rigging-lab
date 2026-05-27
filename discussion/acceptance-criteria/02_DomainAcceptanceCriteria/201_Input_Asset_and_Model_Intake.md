# DOMAIN-01: Input Asset and Project Package Intake

> Status: Current for Private Prototype baseline.

## 問い

Private Prototypeは、どの入力素材とproject packageを制作・検証対象として扱うべきか。

## 方針

入力の正は、rights-cleanなlayered character artとproject-defined model packageである。Cubism形式、既存Cubismモデル、公式/第三者サンプル、nizima素材、権利不明素材は、読み込み、解析、変換、再構築の対象にしない。

### AC-IN-001: 静的な2D素材を受け取れること

Private GUI editorは、自作、生成、または明示許諾済みのPSDまたはsplit PNG setを受け取れること。

### AC-IN-002: 入力素材をproject-defined制作対象へ変換できること

Private GUI editorは、入力素材をdrawable、mesh、part、texture、metadata、provenanceなどのproject-defined package構成要素へ変換できること。

### AC-IN-003: project-defined model packageを読み込めること

Private GUI editor、private runtime core、private viewer、validatorは、project-defined model packageを読み込み、制作・表示・検証対象として扱えること。

### AC-IN-004: Cubism runtime packageを入力・解析対象にしないこと

`.model3.json`、`.moc3`、texture、physics3、motion3、exp3などのCubism runtime packageは、読み込み、観測、解析、変換、再構築の対象にしないこと。

### AC-IN-005: `.cmo3`の独立読み書きを実装スコープ外にすること

`.cmo3`の読み書き、復元、変換、互換出力は、現在MVPの成功条件にしないこと。

### AC-IN-006: 入力由来情報と欠落情報を保持できること

入力素材、変換結果、provenance、rights metadata、import warning、欠落情報を、後続の編集・検証・demo-safe判断に利用できる形で保持できること。
