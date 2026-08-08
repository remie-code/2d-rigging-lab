# Deformer Structure Technology Report Map

> `discussion/reports/deformer-structure-technology/` 直下の調査レポートだけを示す地図。

---

## 位置付け

この調査トピックは、Open 2D Character Rigging Stack の変形制御を検討した過去調査を保管する。Cubism Editor 関連の記述は歴史的参照・リスク確認に限定し、仕様・実装・UXの根拠にはしない。

Cubism公式資料は参考資料であり、Open 2D Character Rigging Stack のオラクルではない。内部実装の推測は、公式事実や一般的な計算幾何・画像変形技術と区別して記録する。実装文書では `rig control` / `drawable mesh` などの独自・一般語彙を使う。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | この調査トピックの入口地図 | Historical evidence index（現行仕様・実装の正ではない） |
| [cubism-observable-deformer-semantics.md](cubism-observable-deformer-semantics.md) | Cubism公式資料から観測できる warp / rotation deformer の概念、操作、検証機能の整理 | 作成済み |
| [open-deformation-algorithm-candidates.md](open-deformation-algorithm-candidates.md) | Open Stackで実装可能な変形アルゴリズム候補の比較 | 作成済み |
| [mvp-deformer-design-recommendation.md](mvp-deformer-design-recommendation.md) | MVPで採用すべきdeformer相当構造の推奨案と残リスク | 作成済み |

## 現行正本への導線

- MVP runtime-visible `rotation2d` / `warpLattice2d` 契約: [runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md)
- 現行 module 境界と Cubism 非互換方針: [module-boundaries.md](../../design/module-contracts/module-boundaries.md)
- 権利・スコープ確認: [rights-risk-cleanup map](../rights-risk-cleanup/_map.md)

この階層の候補比較・Cubism観測は歴史的証拠であり、上記の project-defined contract を置き換えない。

## 調査観点

| 観点 | 内容 |
|------|------|
| Cubism参照 | warp / rotation、親子階層、parameter / keyform接続、検証機能、ただし内部実装は推測扱い |
| Open実装 | affine transform、lattice / FFD、bilinear / bicubic、Bezier patch、MLS、cage deformation などの候補比較 |
| GUI適性 | 制御点編集、直接操作、undo/redo、operation log、AI-readable diff |
| Runtime適性 | Web / TypeScript / WebGL 実装、決定性、毎フレーム評価、Editor preview / Viewer共通化 |
| Validator適性 | 親子循環、空deformer、はみ出し、未接続parameter、存在しないtarget ID、NaN / bounds異常 |
| MVP採用 | rotation相当とwarp相当の最小構成、補間方式、MVP外に置く高度機能 |

## 歴史的フォローアップ（現行作業ではない）

1. 過去レポート間の食い違いを統合した結果は、上記の runtime contract に反映済み。ここから新たな設計タスクを起こさない。
2. 追加の補間方式・bind space・評価順序を検討する場合は、現行 contract の変更提案として別途 review する。

## 歴史的未決（現行作業ではない）

以下は候補調査時点の保留事項である。`rotation2d` / `warpLattice2d` の現行契約や MVP 外の Cubism 機能を、この表から再び未完了タスクへ戻さない。

| 項目 | 状態 |
|------|------|
| MVP warp deformer の補間方式 | 過去候補は `bilinear-grid-v1`。現行の project-defined `warpLattice2d` 契約は [runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md) を正とする |
| Cubismのベジェ分割数相当をMVPに含めるか | 過去の検討項目（現行MVP外・現行作業ではない） |
| rotation deformer を pivot付き2D affine transform と見なして十分か | 過去候補。現行の `rotation2d` 契約は [runtime-core-contract.md](../../design/module-contracts/runtime-core-contract.md) を正とする |
| 3D回転補助や深度推定をMVP外に置いてよいか | 過去の暫定MVP外判断（現行作業ではない） |
