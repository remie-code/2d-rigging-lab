# Editor/Viewer 描画パフォーマンス改善 — 方針と合意事項

> Status: Accepted(2026-07-07 ユーザー合意)
> Owner: Undine(ユーザーとの対話で更新)

## 1. 症状と目的

デフォーマを細かく作り込んだモデルで、パラメータスライダー操作時の描画が極端に重くなる(Editor Canvas / Editor 内 Viewer の両方)。Runtime Player は同型の非効率を持つが症状は相対的に軽い。この体感遅延を解消することが目的。

## 2. 現状診断(調査済み)

正は [reports/editor-render-performance/current-state-survey.md](../reports/editor-render-performance/current-state-survey.md)(2026-07-07、file:line 付き)。要点:

- Editor Canvas と Editor 内 Viewer は同じ評価パイプライン(`canvas-evaluation.ts`)を共有。**パラメータ1tickごとに全 drawable・全 keyformSet を全量再評価**し、評価層に dirty tracking / メモ化 / 部分再評価は存在しない
- スライダー入力は rAF コアレシング済み → 問題は入力頻度でなく1フレームの評価+描画コスト
- ボトルネック仮説順位: **A(最有力)** = 頂点変形の内側(chain各段×全頂点の新規オブジェクト生成 + 座標ごとの `toFixed(12)` 文字列往復 + 評価→projection→adapter の3重クローン、O(Σ頂点数×chain深さ)) / **B(有力)** = keyform 全量再サンプリング+projection 全量再構築 / **C(中)** = マスク付き drawable の毎フレーム FBO 再レンダリング(WebGL2)
- render-software(CPUラスタライザ)は Editor 実描画に未使用(WebGL2 描画)。CPU ラスタライズ犯人説は棄却
- 定量ベースラインは未記録(backlog 既載)

## 3. 確定済みユーザー判断(2026-07-07)

1. **主戦場**: Editor Canvas + Editor 内 Viewer(共有経路)。Runtime Player は副次(改善余地があれば取り組んでよい)
2. **決定性の二層分離**: **表示経路の丸め・正規化は緩和可**(typed array 化・toFixed 除去等を解禁)。**保存・export・provenance に残る値のバイト互換は不可侵**
3. **進め方**: 計測 → 設計の順。まずフェーズ計測(keyform評価/デフォーマ変形/クローン/正規化/描画)を小改修で入れ、実測で仮説を確定してから改善設計に入る
4. **改善対象の操作**: パラメータスライダーに加え、**rig ツールのドラッグ操作(プレビュー経路)も対象に含める**(2026-07-07 追加)
5. **実行形態の前提**: ユーザーの日常作業は dev server 上。StrictMode 由来の二重評価は開発モード限定だが体感に直撃するため、設計では「本番にも効く本丸(rig control 再構築)」と「開発体感に効く評価のレンダー外化」を区別して扱う(2026-07-07 追加)

## 4. 進め方(フェーズ)

1. **Perf Wave 1(計測基盤)**: 表示経路のフェーズ計測(既定OFF・挙動不変)+ 決定的な合成ヘビーモデルベンチ。合成ベンチの内訳実測を記録し、ユーザーの実モデル計測手順を提示
2. **計測往復**: ユーザー実モデルでの実測値を [measurements/](measurements/) に記録し、仮説A/B/C の寄与を確定
3. **改善設計**: 確定したボトルネックに対する設計(このトピック内で Undine×ユーザー対話)→ 実装 wave
4. **再計測**: 同一ベンチで before/after を比較し改善を定量で締める

## 5. 未決事項

- 目標値(スライダー操作時に許容する1フレーム時間 / 対象モデル規模)— 計測往復で実数を見てから合意する
- Runtime Player 側の改善スコープ — Editor 側の設計が固まってから判断

## 6. 関連文書

- 現状調査(リポジトリ事実): [reports/editor-render-performance/current-state-survey.md](../reports/editor-render-performance/current-state-survey.md)
- トピック地図: [_map.md](_map.md)
