# Deformer Structure Technology Report Map

> `discussion/reports/deformer-structure-technology/` 直下の調査レポートだけを示す地図。

---

## 位置付け

この調査トピックは、Open Live2D Stack の deformer 相当構造を設計するために、Cubism Editor の観測可能な deformer semantics、Open実装可能な変形アルゴリズム候補、MVPで採用すべき構造案を分けて調査する。

Cubism公式資料は参考資料であり、Open Live2D Stack のオラクルではない。内部実装の推測は、公式事実や一般的な計算幾何・画像変形技術と区別して記録する。

## 直下のファイル

| Path | Role | Status |
|------|------|--------|
| [_map.md](_map.md) | この調査トピックの入口地図 | 作成済み |
| [cubism-observable-deformer-semantics.md](cubism-observable-deformer-semantics.md) | Cubism公式資料から観測できる warp / rotation deformer の概念、操作、検証機能の整理 | 作成済み |
| [open-deformation-algorithm-candidates.md](open-deformation-algorithm-candidates.md) | Open Stackで実装可能な変形アルゴリズム候補の比較 | 作成済み |
| [mvp-deformer-design-recommendation.md](mvp-deformer-design-recommendation.md) | MVPで採用すべきdeformer相当構造の推奨案と残リスク | 作成済み |

## 調査観点

| 観点 | 内容 |
|------|------|
| Cubism参照 | warp / rotation、親子階層、parameter / keyform接続、検証機能、ただし内部実装は推測扱い |
| Open実装 | affine transform、lattice / FFD、bilinear / bicubic、Bezier patch、MLS、cage deformation などの候補比較 |
| GUI適性 | 制御点編集、直接操作、undo/redo、operation log、AI-readable diff |
| Runtime適性 | Web / TypeScript / WebGL 実装、決定性、毎フレーム評価、Editor preview / Viewer共通化 |
| Validator適性 | 親子循環、空deformer、はみ出し、未接続parameter、存在しないtarget ID、NaN / bounds異常 |
| MVP採用 | rotation相当とwarp相当の最小構成、補間方式、MVP外に置く高度機能 |

## 次の行動

1. レポート間の食い違いを Undine が統合し、設計議論の論点として `discussion/design/` に反映する。
2. MVP deformer の補間方式、bind space、評価順序を設計議論で決める。

## 未決事項

| 項目 | 状態 |
|------|------|
| MVP warp deformer の補間方式 | 調査済み。`bilinear-grid-v1` から始め、将来補間方式を追加可能にする方針で暫定合意 |
| Cubismのベジェ分割数相当をMVPに含めるか | 要調査 |
| rotation deformer を pivot付き2D affine transform と見なして十分か | 調査済み。MVPでは pivot付き2D transform / affine node で暫定合意 |
| 3D回転補助や深度推定をMVP外に置いてよいか | 暫定MVP外、調査で確認 |
