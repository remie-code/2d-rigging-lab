# Cubism SDK Runtime Structure Research Map

> `discussion/reports/cubism-sdk-runtime-structure/` 直下の調査ファイルだけを示す地図。

---

## 位置付け

この階層は、Cubism SDK/Core に関する過去調査を保管する。現在の方針では Cubism SDK/Core に依存せず、`.model3.json` + `.moc3` の読み込み、解析、変換、再構築を行わないため、この階層の内容はリスク確認・スコープ除外判断の文脈に限定する。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | この階層の入口地図 | 起草済み |
| [official-sdk-runtime-api-report.md](official-sdk-runtime-api-report.md) | 公式SDK/Core/APIドキュメントに基づくランタイム構造調査 | 作成済み |
| [web-framework-runtime-observation-report.md](web-framework-runtime-observation-report.md) | Cubism SDK for Web / Web Framework の実装・APIから取れる情報の調査 | 作成済み |
| [structured-output-field-map.md](structured-output-field-map.md) | サンプルwebアプリで出力すべき構造化データ項目と取得元の整理 | 作成済み |
| [runtime-structure-summary.md](runtime-structure-summary.md) | 調査結果の統合サマリとサンプルアプリへの示唆 | 作成済み |
| [web-moc3-inspector-implementation-note.md](web-moc3-inspector-implementation-note.md) | `experiments/cubism-web-moc3-inspector/` の実装内容、検証結果、残ブロッカー | 作成済み |

## 調査観点

- 公式事実: SDK/Core/APIリファレンス、SDK manual、CubismSpecs
- 実装事実: 公開Web Framework/サンプルコードで実際に呼ばれているAPI
- 取得可能データ: parameters, parts, drawables, canvas/model info, clipping/masks, texture index, vertices, indices, opacities, draw order, render order
- 取得困難データ: authoring mesh semantics, deformer hierarchy, keyforms, source PSD/layer information
- サンプルアプリ影響: `ref/kipfel2_vts` を読み込んで出力できるJSONの最小項目

## 未決事項

| 項目 | 状態 |
|------|------|
| Cubism SDK for Webだけで十分か、Native/Core APIも並行確認するか | 初回サンプルはWebで十分。Core API差分は実験時に確認 |
| `.moc3`ロード後にデフォーマ階層やキーフォームまで観測できるか | 公式/API調査上は取得不可として扱う |
| 出力サンプルの必須フィールドをどこまでにするか | `runtime-structure-summary.md` と `structured-output-field-map.md` を基準にする |
