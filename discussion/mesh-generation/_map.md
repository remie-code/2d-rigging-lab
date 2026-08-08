# Mesh Generation Map

> メッシュ自動生成の商用風改修トピックの地図。本文はここに書かず、各成果物ファイルへ委譲する。現行 default、品質 hold、後続 rendering contract の境界だけを案内する。

## この階層の役割

パーツ画像(アルファ付き)からの変形用メッシュ自動生成を、商用リギングツール風の出力特性(マージン付き簡略輪郭・疎な頂点・細部の粗い包み)へ改修する取り組み。「概念設計 → 現状調査 → v7実装 → 品質評価 → v6系整理」の複数フェーズを扱う。Wave102 後に bounded track として実装され、現在は v6/v7 品質 hold で保留中。

## 直下のファイル

| Path | Content | Status |
|---|---|---|
| [concept-design.md](concept-design.md) | 合意済み概念設計。パイプライン、不変条件(被覆保証・ε<r・決定性)、3プリセット方針、実装方針(v7新method / v6削除) | Implemented(Mesh Wave 1); v6削除は品質 hold で未承認 |
| [current-implementation-survey.md](current-implementation-survey.md) | 現状実装(v1〜v6、17 method)のSylph調査。所在、アルゴリズム工程分解、MeshDto構造、パラメータ、概念設計との差分分析、改修時の制約 | Recorded(2026-07-07)。未確認箇所は文書内に明示 |
| [pre-wave-inventory.md](pre-wave-inventory.md) | 計画前の境界調査。UI露出面、レンダラ前提、export互換、validator検査項目、自前DP実装の所在、AI契約面、既存テスト地形と計画への含意 | Recorded(2026-07-07)。survey §6 の未確認項目を解消 |
| [evaluation-log.md](evaluation-log.md) | v7 目視評価の往復記録(所見・機序診断・裁定・対応) | 往復1/2 記録済み。往復2は v6/v7 一長一短・併存 hold |

## 子ディレクトリ

| Path | Role | Status |
|---|---|---|
| [implementation/](implementation/) | wave計画・実装報告・レビュー(トピック内に閉じる、runtime-player方式) | Mesh Wave 1/1.1/1.2/1.3 実装・レビュー完了。往復2評価済みで Wave 2(v6削除)は棚上げ |

## 現在の状態

- Editor の default は `auto-outline-v6d-adaptive-contour-constrainautor`。v7 (`auto-outline-v7-margin-contour`) は薄い generation-family toggle で比較可能。v6a/b/c 等の backend selector は現行 UI ではない。
- Mesh Wave 1/1.1/1.2/1.3 の source/test/review は完了。往復2のユーザー所見「v6/v7 は一長一短」を品質判定の正とし、v6 default + v7 toggle を維持する。
- Wave108/109 は mesh quality の勝敗を変えず、生成 UV 非クランプ + size-dependent transparent padding/gutter + LINEAR + contentInset/uvRect preflight の rendering/data contract を実装済み。詳細は [../design/mesh-rendering/_map.md](../design/mesh-rendering/_map.md) と [../implementation/waves/wave108/wave108-final-integration-report.md](../implementation/waves/wave108/wave108-final-integration-report.md)。

## 次の行動

1. トピックは保留。再開には v6/v7 quality criteria、v6恒常保持か toggle-only か、Wave 2(v6削除)の承認が必要。
2. Atlas Runtime 実機目視、GPU/pixel parity、`original` inset 再現などの rendering gates は [../design/mesh-rendering/_map.md](../design/mesh-rendering/_map.md) で別管理する。

## 未決事項

| 項目 | 状態 |
|---|---|
| v6削除の品質評価基準(何をもって「v7の品質が高い」とするか) | 評価フェーズ入口でユーザーと合意する |
| **トグル(v6/v7切替UI)の寿命**: v6を恒常的に残すか、切替の器だけ残すか、予定通り削除か | 往復1でユーザーが「残してもいいかも」に言及。v7修正の収束後に改めて判断(未決) |
| リグ済みパーツの再生成時の keyform 追従(vertexStableIds 全交換の影響) | 初版スコープ外の既知課題。survey §6 参照 |
| マージンがテクスチャ境界を超える場合の UV clamp 整合 | Wave108 Option E で解決済み（生成UV非クランプ + size-dependent transparent padding/gutter + LINEAR）。Wave109 が non-zero inset の export preflight を整合 |
| 穴あきポリゴン対応 | 初版では穴を埋める(合意済み)。対応自体は将来課題 |
| v7 が統合層ヘルパ `computeMeshQualityMetrics`(V6型参照)に依存している。Mesh Wave 2(v6削除)計画の入力として、この共有ヘルパが v6削除対象になり得るか=v7 が孤立しないかを検討する | Mesh Wave 2 計画時に扱う |
| preset をそのまま初期化する operation の新設と `projectPresetAlias` の扱い(現状 inert・schema 有効・tutorial 4呼び出しに一貫付与)は将来設計案件(Domain R 由来) | 将来設計案件 |
