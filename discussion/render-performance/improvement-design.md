# 描画パフォーマンス改善 — 設計(第1弾: 案A+案D)

> Status: Implemented(Perf Wave 2, 2026-07-08) — 案A+案D+案E を実装・レビュー合格・合成ベンチで検証完了
> 履歴: Accepted(2026-07-07 ユーザー合意)
> Owner: Undine(ユーザーとの対話で更新)
> 設計材料: [design-inputs.md](design-inputs.md)(消費者分析・5案スケッチ、file:line 付き)
> 実装成果: [implementation/waves/perf-wave2/final-report.md](implementation/waves/perf-wave2/final-report.md) / before-after 計測 [measurements/after-wave2-synthetic.md](measurements/after-wave2-synthetic.md)

## 1. 目標と根拠

- **目標: スライダー・ドラッグ操作中 30fps(1フレーム33ms)相当**。到達後に再計測・体感確認し、続行(60fps狙い)の要否を実数で判断する
- 現状: 評価1回 127ms(実モデル計測002)。うち 75.8% が `createCanvasEvaluatedRigControls`(全 rig control の評価済み形状を毎評価再構築)、17.0% が deformerVertex(オブジェクト生成+toFixed+3重クローン)
- **決定的事実(design-inputs)**: rigControls 出力の消費者は最大1個(選択中のオーバーレイ)で、実描画は一切参照しない。スライダー操作中(rig 非選択)は0個で足りる

## 2. 案A: rig control 評価の選択駆動遅延化(主犯対策・本番にも効く)

- `CanvasEvaluatedScene.rigControls` の契約を**「全件配列」から「選択駆動の部分集合」へ変更**(ユーザー承認済み 2026-07-07)。評価時に「必要 rig 集合」(選択中 rigControlId + preview draft + それらの評価に必要な祖先チェーン)だけを評価し、非選択時は空
- rig ツールのドラッグ preview 経路も同じ遅延評価を通す(対象確定済み)
- オーバーレイ解決(`resolveDeformerOverlay` の `.find()`)は部分集合でも同一結果になる形に追従
- **不変条件**: 評価された rig の形状値は従来と数値同一(案A単体では値を変えない)。描画結果(drawables)は不変。既存テストの「全件配列」前提は契約変更として書き換える(意味論の緩和ではなく契約の縮小)

## 3. 案D: deformerVertex の表示経路最適化(第二標的)

- 表示経路の `toFixed(12)` 正規化(normalizeTransformNumber)の除去または数値演算への置換、および評価→projection→adapter の3重クローン削減。分離点は `cloneMesh`(canvas-evaluation.ts:921)以降が表示専用と確認済み(design-inputs §5)
- **不変条件(決定性の二層分離、improvement-approach §3-2)**: 保存・export・provenance に残る値のバイト互換は不可侵(この経路には触れない)。表示値は従来比 epsilon(1e-9)以内の等価。描画の見た目は不変
- ついで掃除: unionRects の spread 除去(案E、効果0.07%だが同区間を触るため同時に)

## 4. 案C(評価のレンダー外化)は保留

StrictMode の開発モード二重評価対策。A+D 実施後の再計測で dev 体感が目標未達の場合の次弾とする(A で1評価が軽くなれば二重実行の絶対コストも1/10前後に下がる見込みのため)。

## 5. 検証設計

- 合成ベンチ before/after(特に rigHeavy で artworkBoundsAndAssembly がほぼ消えること)
- 描画等価: drawables 出力が案Aで不変・案Dで epsilon 等価であることのテスト
- 実モデル計測003(ユーザー)で目標判定
- 回帰ガード: 「rigControls は要求集合以外を評価しない」構造テスト(時間 assertion は使わない)

## 6. 実装は Perf Wave 2

計画: [implementation/orchestration/perf-wave2-plan.md](implementation/orchestration/perf-wave2-plan.md)(Batch: 案A → 案D+E → 統合再計測)

**実装完了(2026-07-08)**: Domain F(案A)/ Domain G(案D+E)/ Domain H(統合・再計測)を Perf Wave 2 で実装。F/G は設計適合・テスト妥当性の2レーンレビュー各合格。合成ベンチ before(v3)/after で、rig 非選択(本番スライダー操作の主経路)の evaluation 全体を medium −87.0% / heavy −91.3% / rigHeavy −88.1% / light −67.3% 削減、主犯 `createCanvasEvaluatedRigControls`(`assembly.rigControls`)は主経路でほぼゼロ化(rigHeavy 67.824→0.001ms/eval)。詳細は [measurements/after-wave2-synthetic.md](measurements/after-wave2-synthetic.md) と [implementation/waves/perf-wave2/final-report.md](implementation/waves/perf-wave2/final-report.md)。**案C(レンダー外化)は保留のまま**(A+D 後の実モデル計測003で dev 体感が目標未達の場合の次弾)。**30fps 続行可否はユーザー実モデル計測003待ち**。
