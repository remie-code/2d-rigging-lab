# Wave23 Domain A — Vowel Shape Blend 3レーンレビュー

> 対象: 母音リップシンクの単一勝者(argmax) → 正規化凸ブレンド化（cp17 解除・mouth_open=s 一般化）。
> レビュー実施: Review-Sylph（独立検証・読み取り専任 + typecheck/Vitest 再実行）。
> 判定: **総合 pass**（3レーン全 pass・blocking なし・エスカレーション不要）。ループ 1 回で確定。

## 実測結果（Review-Sylph が独立に再実行）

| 項目 | コマンド | 結果 |
|---|---|---|
| typecheck | `pnpm --filter @private-2d-rigging-lab/runtime-player run typecheck` | **0 エラー（pass）** |
| focused Vitest | `pnpm --filter …/runtime-player exec vitest run -c vitest.config.ts src/main/live-mapping` | **38 passed / 0 failed**（estimator 10・parameter-frame 19・auto-mapping 3・state 6） |
| 全体 test:unit（pre-existing 裏取り） | `pnpm --filter …/runtime-player run test:unit` | 481 中 **2 failed / 479 passed** |

pre-existing fail の裏取り: 2 fail は `broadcast-source/browser-source-server.test.ts` と `stage/browser-source/browser-source-server-message.test.ts`。**両方 browser-source ドメインで live-mapping 無関係**。`git diff --stat` で本 Wave 差分は live-mapping 配下 4 ファイルのみと確認済み。構造上 pre-existing で確定（Gnome 申告のファイル名が 1 つずれていたが結論は正しい）。

## Lane 1: spec compliance — pass

計画 §5 Required Behavior / §7 Acceptance / §9 Contract を各条確認:

- 5母音 `s×正規化重み` 同時出力（Σ=s）: `createVowelValue` が `activation = estimate.s * estimate.weightByVowel[vowelLabel]`。Σ_v(s×weight_v)=s。テストが Σ≈mouth_open を pin。
- `mouth_open = s`: mouth-open case `activation: estimate.s`。
- ゲート閉で s=0・全母音0: estimator の gated 経路が weightByVowel 全0・s=0。
- τ キャッシュ: 参照変化時のみ median 再計算。
- jawOpen フォールバック維持: `readVowelEstimate === undefined` 枝無改修、配線条件維持。
- τ→0 で単一勝者収束（後方互換）。
- 禁止項目（時間平滑化/τ ツマミ/jawOpen second term/top-k/次元重み手術/え ゲート/カーブ整形）いずれも未混入。`vowelDimensionWeights` 全1のまま。キャリブレーション経路・母音参照・トグル未改変。scope は live-mapping 4 ファイル。

## Lane 2: design-development compliance — pass

- パイプライン一致: `computeVowelBlend` が `raw=exp(−(d_v−d_min)/τ)` → `×max(0,strength_v)` → `÷Σ`。設計 §2.1 ①②③ と厳密一致。s は `computeIntensity(activity, winnerDistance)` で winnerDistance = 生 argmax 最近傍（invariant「s の分母=生 d_min」充足、ヒステリシス勝者距離ではない）。
- τ: `computeVowelBlendTemperature = 0.3 × median(10ペアの Δ間 weightedDistance)`。§2.2/§6 一致。テストが独立再計算で pin し実測 τ が 0.12〜0.18 帯に入る。
- ヒステリシス撤去・クラス存置: `updateConfirmedWinner`・confirmedWinner/candidate/streak・margin/frames 定数すべて削除。`RuntimePlayerVowelLipsyncState` は τ キャッシュ保持に転用して存置。

Gnome 裁量判断の重点検証:

1. 配線/二重適用: `createVowelValue` は末端乗算 `createWeightValue` を**経由せず** `min + targetActivation*(max-min)` を直接返す。strength は blend 前段で一度だけ。二重適用は数学的にも無い（Σ_v s×weight_v=s、weight は正規化で Σ=1）。invert は `1-activation` で保持（旧 weight 経路と同一挙動）。
2. d_min 減算の正規化不変性: 共通因子 `exp(d_min/τ)` が分子分母で相殺し `exp(−d_v/τ)` 正規化と数学的に同一。最大項を exp(0)=1 に固定する標準的 softmax 安定化で後方互換の小 τ 収束も壊さない。設計未記載だが正当。
3. 未マップ母音 strength 既定=1（judge）: 設計は5母音全解決前提で、その前提下では既定不使用 → runtime 差ゼロ。部分構成では未マップ母音が blend 質量を持つが emit されず Σ<s になり得るが、非対応構成であり benign。→ minor（設計前提下で無害）。
4. publish 挙動変化（judge）: 有効・ゲート開で5母音厳密非0を毎フレーム発行、ゲート閉で有限値0発行。設計 §2.6 cp17 解除の意図通り。disabled 経路は従来どおり未発行。→ 契約変化だが設計合致で問題なし。

## Lane 3: test adequacy — pass（minor gap 1点）

- 二重適用 pin が本物: mapping テスト "applies per-vowel strength…without double-applying" が非一様 strength(i=3) で `Σvowels ≈ mouth_open(=s)` を assert。末端再乗算していれば Σ=s×(1+2·w_i)≠s で **fail する形**。トートロジーでなく退行を実際に検出できる。
- τ 導出テスト: median を独立再実装し突合＋帯域チェック。実装なぞりでない。
- 後方互換: `computeVowelBlend(…, 1e-4)` で argmax 収束を pin。
- strength=0 除外: estimator/mapping 両層で weight 0・Σ≈1 維持を pin。
- minor gap（非 blocking）: ゲート閉時の母音値が有限0で発行されることは estimator 層のみで pin。mapping 層の中立テストは mouth_open=0 しか見ていない。旧「敗者 undefined」→「全母音0発行」への出力契約変化を mapping 層で直接 pin するテストがあると回帰保護が厚い。任意。

## 総合判定: pass

3レーンすべて pass。invariant 7項（二重適用禁止/d_min=生 argmax/τ=0.3×中央値キャッシュ/ヒステリシス撤去・クラス存置/ゲート短絡/jawOpen フォールバック/小 τ 後方互換）を実装・テストとも満たす。禁止項目の混入なし。typecheck 0 エラー、focused Vitest 38 passed。ブロッキング修正要求なし。

### 任意改善（minor・Final Integration までに握れるが必須でない）

- ゲート閉で全母音が有限0発行される契約変化を mapping 層テストで直接 pin する。
- `createVowelValue` は `target.default` を無視して `min..max` へ線形写像する（strength を tail に置かない帰結）。母音 target は慣習上 default=0 のため実害ないが、default≠0 の母音 target 運用が将来入るなら写像意図を1行コメントで固定しておくと安全。

### 要エスカレーション（ユーザー判断）

**なし。** judge #3（未マップ母音 strength 既定=1）は設計「5母音全解決」前提下で runtime 差ゼロ。judge #4（publish 挙動変化）も設計 §2.6 cp17 解除の範囲内で新たなユーザー判断は生じない。
