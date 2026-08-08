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
| [player-survey.md](player-survey.md) | (B) Runtime Player / runtime-core レンダリング性能 現状把握調査(live経路・残る候補#1〜#5) | Recorded(2026-07-08)。後続 Waves13–19 が fast-path / diagnostics / cadence を実装。旧「#5 deep profiling live 配線から再開」は superseded。 |

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

## Runtime Player 側の現行状態（Waves13–19実装済み / 製品deep profilerなし）

- Runtime Player Waves13–19 で frame pacing、evaluation cache、compiled evaluator、render-frame fast path、軽量 diagnostics、Browser Source cadence diagnostics を実装・検証済み。Wave18 は product Control/Stage/Browser Source への deep-profiling transport を撤去し、`runtimeCoreProfiling: "deep"` は developer/test 専用。
- 後続 parent map の手動 OBS-vs-Chrome/Edge 比較は、Chrome/Edge の near-60fps applied/render cadence と OBS/CEF 側の低い cadence を記録している。これは手動観測であり、Runtime Player が 60fps を保証する benchmark ではない。
- C7 の Browser Source 二体並走は「この PC では少し厳しい」というユーザー印象のみで、CPU/GPU/FPS capture は未計測。性能改善は C7 scope 外で、再開は別ユーザー裁定と hardware/browser target が必要（記録: [../ai-cohost/implementation/orchestration/c7-closure-record.md](../ai-cohost/implementation/orchestration/c7-closure-record.md) §3）。

## 次の行動

1. 現行 product work は保留。必要なら C7 二体負荷の developer/test-only hardware capture を新規実験として承認し、候補 #1/#3/#4 は実測でボトルネック確定後にのみ検討する。
2. Product bridge へ deep profiling を再公開しない。Wave106 は dynamics/schema semantics の置換であり、render-performance 改善の証拠ではない。

## 確定済み(設計・実装)

- Historical target: 30fps(33ms)で一旦締め(2026-07-07 ユーザー合意)。Editor は実モデル確認で十分として close し、数値 gate は現行要求ではない。
- 案A 契約変更承認 / Wave 2 は A+D 一括 / 案C(レンダー外化)は再計測後に判断
- **Perf Wave 2 実装完了(2026-07-08)**: 案A(選択駆動遅延化)+ 案D+E(表示経路最適化)実装・レビュー合格・合成ベンチ検証済み。ユーザー実モデル確認は「Editor の動作として十分」で close。`real-model-003.md` は存在せず、30fps の数値再計測は回帰または明示要求がある場合のみ再開する。

## 未決事項

| 項目 | 状態 |
|---|---|
| 目標値(許容1フレーム時間・対象モデル規模) | `real-model-003.md` が無く数値は未計測。Editor close を再開する回帰または明示要求がある場合のみ再合意 |
| Runtime Player 側の改善スコープ | Waves13–19 の fast-path / diagnostics / cadence は実装済み。C7 二体同時起動の体感負荷は未計測の optional reopen。対象 hardware/browser、測定項目、deep profiling の developer/test-only 境界をユーザーが裁定する |
