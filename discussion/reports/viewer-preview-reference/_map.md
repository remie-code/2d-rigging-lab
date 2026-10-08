# Viewer / Preview Reference Report Map

> `discussion/reports/viewer-preview-reference/` 直下の調査レポートだけを示す地図。

---

## 位置付け

この調査トピックは、Open 2D Character Rigging Stack の Editor preview と Viewer を検討した過去調査を保管する。Cubism Editor / Viewer 関連の記述は歴史的参照・リスク確認に限定し、仕様・実装・UXの根拠にはしない。

Cubism公式資料は参考資料であり、Open 2D Character Rigging Stack のオラクルではない。UI模倣、互換、提携、承認を示唆しない。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | この調査トピックの入口地図 | Historical evidence index（現行UX oracleではない） |
| [cubism-editor-preview-observable-features.md](cubism-editor-preview-observable-features.md) | Cubism Editor の制作中 preview / view area / palette / warning 表示から観測できる確認機能の整理 | 作成済み |
| [cubism-viewer-runtime-observable-features.md](cubism-viewer-runtime-observable-features.md) | Cubism Viewer / runtime package 確認で観測できる model loading、parameter、motion、expression、physics 等の確認機能の整理 | 作成済み |
| [open-stack-viewer-preview-design-implications.md](open-stack-viewer-preview-design-implications.md) | Open Stack MVP の Editor preview / Viewer 境界、必要機能、設計推奨、未決事項の整理 | 作成済み |

## 現行正本への導線

- Editor Preview / Viewer / Shared Runtime の境界: [MVP vertical-slice architecture](../../design/mvp-authoring-runtime/00-mvp-vertical-slice-architecture.md)
- Shared Runtime evaluation と diagnostics: [runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md)
- Cubism Viewer 互換を採らない権利・スコープ境界: [rights-risk-cleanup map](../rights-risk-cleanup/_map.md)

この階層の Cubism Editor / Viewer 観測は、上記の project-defined UI・runtime contract を置き換えない。

## 調査観点

| 観点 | 内容 |
|------|------|
| Editor preview | 制作中の直接操作、parameter確認、mesh / deformer / clipping / draw order / warning 表示 |
| Viewer / runtime確認 | package読み込み、parameter slider、motion / expression / physics確認、runtime表示差分、diagnostics |
| 境界設計 | Editor preview と Viewer を同一アプリ内機能にするとき、共有すべきRuntime、分けるべき制作支援表示 |
| MVP採用 | GUI Editor必須MVPで最低限必要なpreview / viewer能力と、MVP外へ送る機能 |
| Validator / AI連携 | warning、runtime state、inspection、AI-readable report / diff へどう接続するか |

## 歴史的フォローアップ（現行作業ではない）

1. 過去レポート間の差分は、上記の MVP architecture / runtime contract に反映済み。ここから新たな設計タスクを起こさない。
2. 境界を変更する場合は、現行 contract の変更提案として別途 review する。
3. Cubism Viewer 相当機能を再検討する場合は、権利・permission・scope review を先行する。

## 歴史的未決（現行作業ではない）

以下は過去調査の候補・判断待ちを保存した register である。現行仕様の未完了タスクとして解釈しない。

| 項目 | 状態 |
|------|------|
| Editor preview と Viewer が共有すべき runtime 評価API | 過去調査時点の推奨（現行作業ではない）。Shared Runtime evaluation core 共有・loader境界の論点は [runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md) を正とする |
| Editor preview にのみ必要な制作支援表示 | 過去調査時点の候補（現行作業ではない）。selection / lock / hide / overlay / dirty operation などの現行境界は MVP architecture を参照 |
| Viewer に必要な runtime diagnostics / inspection | 過去調査時点の MVP候補（現行作業ではない）。package load diagnostics、parameter操作、runtime snapshot 等の現行契約は runtime-core / viewer design を参照 |
| Cubism Viewer相当機能のうちMVP外に置くもの | 過去調査時点の除外整理（現行作業ではない）。motion / expression asset / full physics / pose / Cubism互換Viewer機能は現方針で対象外。再検討時も権利確認前提の別調査 |
