# Mesh Generation Map

> メッシュ自動生成の商用風改修トピックの地図。本文はここに書かず、各成果物ファイルへ委譲する。

## この階層の役割

パーツ画像(アルファ付き)からの変形用メッシュ自動生成を、商用リギングツール風の出力特性(マージン付き簡略輪郭・疎な頂点・細部の粗い包み)へ改修する取り組み。「概念設計 → 現状調査 → v7実装 → 品質評価 → v6系整理」の複数フェーズを扱う。Editor実装(Wave102で一旦停止中)の部分的再開にあたる。

## 直下のファイル

| Path | Content | Status |
|---|---|---|
| [concept-design.md](concept-design.md) | 合意済み概念設計。パイプライン、不変条件(被覆保証・ε<r・決定性)、3プリセット方針、実装方針(v7新method / v6削除)、実装委任時の3層優先順位 | Accepted(2026-07-07) |
| [current-implementation-survey.md](current-implementation-survey.md) | 現状実装(v1〜v6、17 method)のSylph調査。所在、アルゴリズム工程分解、MeshDto構造、パラメータ、概念設計との差分分析、改修時の制約 | Recorded(2026-07-07)。未確認箇所は文書内に明示 |
| [pre-wave-inventory.md](pre-wave-inventory.md) | 計画前の境界調査。UI露出面、レンダラ前提、export互換、validator検査項目、自前DP実装の所在、AI契約面、既存テスト地形と計画への含意 | Recorded(2026-07-07)。survey §6 の未確認項目を解消 |

## 子ディレクトリ

| Path | Role | Status |
|---|---|---|
| [implementation/](implementation/) | wave計画・実装報告・レビュー(トピック内に閉じる、runtime-player方式) | [mesh-wave1-plan.md](implementation/orchestration/mesh-wave1-plan.md) Planned |

## 次の行動

1. Mesh Wave 1 の起動(Batch 1: Domain A 中立部品抽出から)。計画は [implementation/orchestration/mesh-wave1-plan.md](implementation/orchestration/mesh-wave1-plan.md) が正
2. wave 完了後: ユーザー目視評価 gate → 合格なら v6削除を Mesh Wave 2 として計画

## 未決事項

| 項目 | 状態 |
|---|---|
| v6削除の品質評価基準(何をもって「v7の品質が高い」とするか) | 評価フェーズ入口でユーザーと合意する |
| リグ済みパーツの再生成時の keyform 追従(vertexStableIds 全交換の影響) | 初版スコープ外の既知課題。survey §6 参照 |
| マージンがテクスチャ境界を超える場合の UV clamp 整合 | 実装計画で扱う。survey §6 参照 |
| 穴あきポリゴン対応 | 初版では穴を埋める(合意済み)。対応自体は将来課題 |
