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
| [player-survey.md](player-survey.md) | (B) Runtime Player / runtime-core レンダリング性能 現状把握調査(live経路は最適化済み・残る非効率4件・改善候補#1〜#5) | Recorded(2026-07-08、Sylph調査)。**結論「改善不要(現状で十分)が有力」で一旦保留**: 決定性・snapshot互換に触る最適化は実測でボトルネック確定まで着手しない。再開点=#5(deep profiling live配線)→#1/#4 |

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

## Editor 側クローズ(2026-07-08 ユーザー受け入れ)

Perf Wave 2 の成果をユーザーが実モデルで確認し「**Editor の動作としては十分**」と受け入れ。**案C(レンダー外化)と60fps続行は不要としてクローズ**(必要が再燃したら improvement-design §4 から再開)。

## Runtime Player 側 = 一旦保留(2026-07-08)、再開条件が満たされた(2026-07-12)

- [player-survey.md](player-survey.md)(2026-07-08)の結論: live 経路は既に手厚く最適化済みで「改善不要(現状で十分)が有力」。残る非効率4件(toFixed・無駄なZod parse・頂点4重クローン・三角形インデックス毎フレーム再構築)は決定性・snapshot互換に直結するため、**実測でボトルネック確定まで着手しない=一旦保留**。同調査の未解決質問に「stage と Browser Source 同時起動時の負荷は未計測」を残置。
- **2026-07-12 初の実データ**: ai-cohost C7 ゲート(OBS 二体並走=runtime-player 2インスタンス+Browser Source 2本)で、ユーザー観測「このPCのスペックで2個動かすのはちょっときつそう」。ハードウェア側要因の可能性が高いが未計測。性能改善は C7 スコープ外と裁定(記録: [../ai-cohost/implementation/orchestration/c7-closure-record.md](../ai-cohost/implementation/orchestration/c7-closure-record.md) §3)。
- **再開するときの初手**(player-survey の推奨のまま): #5 `runtimeCoreProfiling: "deep"` の live 配線(計測のみ・副作用ほぼ無し)→ 実測で犯人を確定 → 低リスクの #1(無駄な getState() parse 除去)/#4(三角形インデックスキャッシュ)。再開の要否・時期はユーザー裁定待ち。

## 次の行動

1. 再開が裁定されたら上記の初手(#5 計測配線)から。それまで本トピックは保留のまま。

## 確定済み(設計・実装)

- 目標: 30fps(33ms)で一旦締め(2026-07-07 ユーザー合意)
- 案A 契約変更承認 / Wave 2 は A+D 一括 / 案C(レンダー外化)は再計測後に判断
- **Perf Wave 2 実装完了(2026-07-08)**: 案A(選択駆動遅延化)+ 案D+E(表示経路最適化)実装・レビュー合格・合成ベンチ検証済み。実装事実は improvement-design Status=Implemented に反映。60fps 続行可否と案C は実モデル計測003待ち(未決)

## 未決事項

| 項目 | 状態 |
|---|---|
| 目標値(許容1フレーム時間・対象モデル規模) | 計測往復で実数を見てから合意 |
| Runtime Player 側の改善スコープ | **一旦保留(2026-07-08、player-survey)**。二体同時起動の体感負荷(2026-07-12)で再開条件は満たされた——再開の要否・時期はユーザー裁定待ち |
