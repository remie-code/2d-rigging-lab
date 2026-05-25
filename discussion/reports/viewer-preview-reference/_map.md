# Viewer / Preview Reference Report Map

> `discussion/reports/viewer-preview-reference/` 直下の調査レポートだけを示す地図。

---

## 位置付け

この調査トピックは、Open Live2D Stack の Editor preview と Viewer を設計するために、Cubism Editor の制作中プレビュー機能、Cubism Viewer / runtime確認機能、Open Stack MVPへの設計含意を分けて調査する。

Cubism公式資料は参考資料であり、Open Live2D Stack のオラクルではない。UI模倣ではなく、GUI Editor必須の Authoring-to-Runtime MVP を成立させるために必要な確認・検証能力を抽出する。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | この調査トピックの入口地図 | 作成済み |
| [cubism-editor-preview-observable-features.md](cubism-editor-preview-observable-features.md) | Cubism Editor の制作中 preview / view area / palette / warning 表示から観測できる確認機能の整理 | 作成済み |
| [cubism-viewer-runtime-observable-features.md](cubism-viewer-runtime-observable-features.md) | Cubism Viewer / runtime package 確認で観測できる model loading、parameter、motion、expression、physics 等の確認機能の整理 | 作成済み |
| [open-stack-viewer-preview-design-implications.md](open-stack-viewer-preview-design-implications.md) | Open Stack MVP の Editor preview / Viewer 境界、必要機能、設計推奨、未決事項の整理 | 作成済み |

## 調査観点

| 観点 | 内容 |
|------|------|
| Editor preview | 制作中の直接操作、parameter確認、mesh / deformer / clipping / draw order / warning 表示 |
| Viewer / runtime確認 | package読み込み、parameter slider、motion / expression / physics確認、runtime表示差分、diagnostics |
| 境界設計 | Editor preview と Viewer を同一アプリ内機能にするとき、共有すべきRuntime、分けるべき制作支援表示 |
| MVP採用 | GUI Editor必須MVPで最低限必要なpreview / viewer能力と、MVP外へ送る機能 |
| Validator / AI連携 | warning、runtime state、inspection、AI-readable report / diff へどう接続するか |

## 次の行動

1. レポート間の差分を Undine が統合し、設計議論の論点として `discussion/design/` に反映する。
2. Editor preview / Viewer / Shared Runtime / Validator-AI bridge の境界を設計文書化する。

## 未決事項

| 項目 | 状態 |
|------|------|
| Editor preview と Viewer が共有すべき runtime 評価API | 調査済み。Shared Runtime evaluation core 共有が推奨。loader境界は未決 |
| Editor preview にのみ必要な制作支援表示 | 調査済み。selection / lock / hide / overlay / dirty operation などは Editor-only とする方向 |
| Viewer に必要な runtime diagnostics / inspection | 調査済み。package load diagnostics、parameter操作、runtime snapshot、drawable / mask inspection がMVP候補 |
| Cubism Viewer相当機能のうちMVP外に置くもの | 調査済み。motion / expression asset / full physics / pose / Cubism互換Viewer機能は原則Post-MVP候補 |
