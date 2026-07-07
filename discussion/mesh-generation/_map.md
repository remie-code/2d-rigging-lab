# Mesh Generation Map

> メッシュ自動生成の商用風改修トピックの地図。本文はここに書かず、各成果物ファイルへ委譲する。

## この階層の役割

パーツ画像(アルファ付き)からの変形用メッシュ自動生成を、商用リギングツール風の出力特性(マージン付き簡略輪郭・疎な頂点・細部の粗い包み)へ改修する取り組み。「概念設計 → 現状調査 → v7実装 → 品質評価 → v6系整理」の複数フェーズを扱う。Editor実装(Wave102で一旦停止中)の部分的再開にあたる。

## 直下のファイル

| Path | Content | Status |
|---|---|---|
| [concept-design.md](concept-design.md) | 合意済み概念設計。パイプライン、不変条件(被覆保証・ε<r・決定性)、3プリセット方針、実装方針(v7新method / v6削除)、実装委任時の3層優先順位 | Implemented(Mesh Wave 1) |
| [current-implementation-survey.md](current-implementation-survey.md) | 現状実装(v1〜v6、17 method)のSylph調査。所在、アルゴリズム工程分解、MeshDto構造、パラメータ、概念設計との差分分析、改修時の制約 | Recorded(2026-07-07)。未確認箇所は文書内に明示 |
| [pre-wave-inventory.md](pre-wave-inventory.md) | 計画前の境界調査。UI露出面、レンダラ前提、export互換、validator検査項目、自前DP実装の所在、AI契約面、既存テスト地形と計画への含意 | Recorded(2026-07-07)。survey §6 の未確認項目を解消 |
| [evaluation-log.md](evaluation-log.md) | v7 目視評価の往復記録(所見・機序診断・裁定・対応) | 往復1 記録済み(境界張り付き・密度過密 → Mesh Wave 1.1 で修正中) |

## 子ディレクトリ

| Path | Role | Status |
|---|---|---|
| [implementation/](implementation/) | wave計画・実装報告・レビュー(トピック内に閉じる、runtime-player方式) | Mesh Wave 1 実装完了(全ドメイン pass)・ユーザー目視評価待ち。[final-report.md](implementation/waves/mesh-wave1/final-report.md) が評価 gate 手順の正 |

## 次の行動

1. **トピック保留中(2026-07-07)**: 往復2 の所見「v6/v7 は一長一短」により v6/v7 併存継続・世代トグル残置。優先課題(Editor描画パフォーマンス)へ移行のため Mesh Wave 2 は棚上げ。再開時は [evaluation-log.md](evaluation-log.md) 往復2 と未決事項から

## 未決事項

| 項目 | 状態 |
|---|---|
| v6削除の品質評価基準(何をもって「v7の品質が高い」とするか) | 評価フェーズ入口でユーザーと合意する |
| **トグル(v6/v7切替UI)の寿命**: v6を恒常的に残すか、切替の器だけ残すか、予定通り削除か | 往復1でユーザーが「残してもいいかも」に言及。v7修正の収束後に改めて判断(未決) |
| リグ済みパーツの再生成時の keyform 追従(vertexStableIds 全交換の影響) | 初版スコープ外の既知課題。survey §6 参照 |
| マージンがテクスチャ境界を超える場合の UV clamp 整合 | 実装計画で扱う。survey §6 参照 |
| 穴あきポリゴン対応 | 初版では穴を埋める(合意済み)。対応自体は将来課題 |
| v7 が統合層ヘルパ `computeMeshQualityMetrics`(V6型参照)に依存している。Mesh Wave 2(v6削除)計画の入力として、この共有ヘルパが v6削除対象になり得るか=v7 が孤立しないかを検討する | Mesh Wave 2 計画時に扱う |
| preset をそのまま初期化する operation の新設と `projectPresetAlias` の扱い(現状 inert・schema 有効・tutorial 4呼び出しに一貫付与)は将来設計案件(Domain R 由来) | 将来設計案件 |
