# Render Performance Map

> Editor/Viewer 描画パフォーマンス改善トピックの地図。本文は各成果物ファイルへ委譲する。

## この階層の役割

デフォーマの細かいモデルでのスライダー操作時の描画遅延(Editor Canvas / Editor 内 Viewer)を解消する取り組み。「現状調査 → 計測基盤 → 実測 → 改善設計 → 実装 → 再計測」の複数フェーズを扱う。

## 直下のファイル

| Path | Content | Status |
|---|---|---|
| [improvement-approach.md](improvement-approach.md) | 方針と合意事項(症状・診断要点・ユーザー判断5件・フェーズ計画) | Accepted(2026-07-07) |
| [design-inputs.md](design-inputs.md) | 設計材料調査(createCanvasEvaluatedRigControls 内部構造・消費者分析・5案スケッチ) | Recorded(2026-07-07)。**消費者は最大1個、描画は非参照**が要 |
| [double-evaluation-diagnosis.md](double-evaluation-diagnosis.md) | 二重評価の根本原因診断(StrictMode 開発モード二重実行・完全冗長)+ユーザー確認追記 | Recorded(2026-07-07) |
| [improvement-design.md](improvement-design.md) | 改善設計 第1弾(案A: 選択駆動遅延化 / 案D: 表示経路最適化 / 目標30fps / 案Cは保留) | **Implemented(Perf Wave 2, 2026-07-08)** |

## 子ディレクトリ

| Path | Role | Status |
|---|---|---|
| [implementation/](implementation/) | wave計画・実装報告・レビュー(トピック内に閉じる、runtime-player方式) | Perf Wave 1(計測基盤)完了 / **Perf Wave 2(案A+D+E 実装)完了・F/G 各2レーンレビュー合格・[final-report.md](implementation/waves/perf-wave2/final-report.md)** |
| [measurements/](measurements/) | 計測結果(合成ベンチ・実モデル) | v3([baseline-synthetic-v3.md](measurements/baseline-synthetic-v3.md))で主犯 `createCanvasEvaluatedRigControls` 確定 → **[after-wave2-synthetic.md](measurements/after-wave2-synthetic.md) で before/after 記録(主経路の evaluation 全体 medium −87%/heavy −91%/rigHeavy −88%)** |

## 関連(トピック外)

- 現状調査レポート: [../reports/editor-render-performance/current-state-survey.md](../reports/editor-render-performance/current-state-survey.md)

## 計測フェーズ完結(2026-07-07)— 確定した診断

- 評価1回 127ms(実モデル)の **75.8% = artworkBoundsAndAssembly、その内側の 99.84% = `createCanvasEvaluatedRigControls`**(rig control 全量再構築+cloneVec2)。標的は関数一点([measurements/real-model-002.md](measurements/real-model-002.md)、baseline-synthetic-v3.md)
- 二重評価(評価=描画の2倍)は **StrictMode の開発モード二重実行**で確定([double-evaluation-diagnosis.md](double-evaluation-diagnosis.md))。本番には無いが、ユーザーの日常作業は dev server のため体感に直撃
- 第二標的: deformerVertex 17%(オブジェクト生成+toFixed+クローン)。副次: 全メッシュ毎フレーム WebGL 再アップロード

## 次の行動

1. **Perf Wave 2 完了**([implementation/orchestration/perf-wave2-plan.md](implementation/orchestration/perf-wave2-plan.md)): Batch1 案A(選択駆動遅延化)・Batch2 案D+E(表示経路最適化)・Batch3 統合(before/after・計測003手順)すべて完了。合成ベンチで主経路の evaluation 全体を大幅削減(§measurements)。詳細は [final-report.md](implementation/waves/perf-wave2/final-report.md)。
2. **→ ユーザー実モデル計測003**: final-report §「ユーザー実モデル計測003の手順と30fps判定方法」に従い、実モデルでスライダー操作の `canvas.evaluation.ms` avg を計測。**avg ≤ 33ms なら 30fps 達成**。dev の StrictMode 二重評価は「本番相当=1回分 / dev 体感=2回分」の両面で読む。
3. 計測003の結果で続行(案C レンダー外化 / 60fps狙い)の要否を実数判断。**案C は保留のまま**。

## 確定済み(設計・実装)

- 目標: 30fps(33ms)で一旦締め(2026-07-07 ユーザー合意)
- 案A 契約変更承認 / Wave 2 は A+D 一括 / 案C(レンダー外化)は再計測後に判断
- **Perf Wave 2 実装完了(2026-07-08)**: 案A(選択駆動遅延化)+ 案D+E(表示経路最適化)実装・レビュー合格・合成ベンチ検証済み。実装事実は improvement-design Status=Implemented に反映。60fps 続行可否と案C は実モデル計測003待ち(未決)

## 未決事項

| 項目 | 状態 |
|---|---|
| 目標値(許容1フレーム時間・対象モデル規模) | 計測往復で実数を見てから合意 |
| Runtime Player 側の改善スコープ | Editor 側の設計確定後に判断 |
