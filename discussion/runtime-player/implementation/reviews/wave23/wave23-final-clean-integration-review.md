# Wave23 Final Clean Integration Review — Vowel Shape Blend

> Reviewer: Review-Sylph（読み取り専任・独立検証）
> Date: 2026-07-08
> Scope: Domain A（母音の正規化凸ブレンド化 / cp17 解除 / mouth_open=s 一般化）の統合結果
> 手法: basis（plan §7 AC / §3.2 invariant / §9 柵、design shape-blend / mouth-open-coupling / mapping）を自分で読み、`git diff` で実装差分を独立に読み、typecheck と focused Vitest / full test:unit を自分で再実行。Domain A 報告・3レーンレビューには依存していない。

## 総合判定: **pass**

blocking 指摘なし。AC / invariant / 本波禁止事項の全件を実装・テストの両面から確認。回帰なし。任意改善（residual）2点は非 blocking。要エスカレーションなし。

---

## 実測コマンド結果

| 項目 | 結果 |
|---|---|
| typecheck (`tsc --noEmit -p tsconfig.json`) | **エラー 0**（clean） |
| focused Vitest (`src/main/live-mapping`) | **38 passed / 0 failed**（4 files: runtime-parameter-frame 19 / vowel-lipsync-estimator 10 / live-mapping-state 6 / runtime-export-auto-mapping 3） |
| full test:unit | **479 passed / 2 failed**（2 fail は `src/stage/browser-source/browser-source-server-message.test.ts`） |

### pre-existing 2 fail の裏取り

- 2 fail は共に `browser-source-server-message.test.ts` の `readBrowserSourceRuntimeExportResponse`。差分は期待値に `effectiveDynamicsTuning: null` フィールドが増えたことによる `toStrictEqual` 不一致で、**dynamics-tuning 系の別サブシステム**に属し母音リップシンクと無関係。
- `git diff --name-only -- 'apps/**/*.ts'` の出力は **live-mapping 4 ファイルのみ**（`vowel-lipsync-estimator.ts` / `.test.ts`, `runtime-parameter-frame.ts` / `.test.ts`）。
- `git status --short -- '*browser-source*'` は空 ＝ browser-source 系ファイルは本 Wave の作業ツリー変更に含まれない。
- 結論: **2 fail は本 Wave 前から存在する pre-existing であり、本差分が起因ではない**（裏取り済み）。

---

## 検証項目1: AC §7 / invariant §3.2 / §9 柵

### cp17 解除（○）
`createVowelValue`（runtime-parameter-frame.ts:378）は各母音について `activation = estimate.s * estimate.weightByVowel[vowelLabel]` を算出し、null 分岐なく全母音を publish。有効・ゲート開時に5母音が `s × 正規化重み`（Σ≈s）で同時出力される。mapping テスト（:338, :632）が5母音全 publish・Σ=mouth-open を pin。

### strength を正規化前段で一度だけ（二重適用なし）（○）
- 前段: `computeVowelBlend`（estimator.ts:347）で `value = raw * max(0, strength_v)` を Σ で割る。strength は**ここで一度だけ**。
- 末端: `createVowelValue` は `target.min + targetActivation*(max-min)` を直接返し、**`createWeightValue` の末端 `slot.strength` 乗算（:352）を意図的に迂回**。母音経路で二重適用は起きない。
- strength=0 → biased=0 → weight=0 → 当該母音は blend から脱落。estimator テスト（:186）・mapping テスト（:467）で pin。
- 二重適用 pin の質: mapping テスト（:402-465）は i を strength=3 に上げ、(1) i の相対配分上昇 (2) Σ母音=mouth-open(=s) 維持 (3) mouth-open が strength 非依存、を検証。**末端で再乗算されていれば Σ=s×Σ(weight×strength)≠s となり fail する形**＝トートロジーでない本物の pin（target default=0 でも末端再乗算は activation×3 に化けて Σ が崩れるため検出可能）。

### s の分母＝生 argmax 最近傍 d_min（○）
`estimate()`（estimator.ts:407）は `computeIntensity(scores.activity, scores.winnerDistance)`。`winnerDistance` は `scoreVowels` の**生 argmax 最近傍距離**（:248-256）で、ヒステリシス勝者距離ではない（ヒステリシス自体が撤去済み）。

### τ は参照確定時1回計算・キャッシュ（○）
- `resolveTemperature`（estimator.ts:418）は `cachedReferences===null || !referencesEqual(cached, refs)` の時のみ `computeVowelBlendTemperature` を呼ぶ。default 参照は identity fast-path（`a===b`）、較正参照は毎フレーム再生成されるが**内容比較**で同一なら再計算を回避。**毎フレーム median 再計算しない**。
- τ = `0.3 × median(母音間 Δ ペアワイズ距離)`。`computeVowelBlendTemperature`（:286）は5母音Δの10ペア距離を median（偶数個→5th/6th の平均）。design §2.2 の k=0.30・実値≈0.13〜0.18 と一致（テスト :276-277 が 0.12〜0.18 帯を sanity pin）。

### ヒステリシス撤去・ゲート維持（○）
`updateConfirmedWinner`・ヒステリシス状態/定数は全撤去。状態クラスは τ キャッシュ保持に転用。ゲート `scores.activity < vowelGateActivityThreshold(0.15)` → `gatedEstimate {s:0, 全weight 0}`（:395）で口閉じ。mapping テスト（:580）が mouth-open=0、estimator テスト（:162）が全 weight 0 を pin。ヒステリシス撤去は mapping テスト（:598 単一 a フレームで即勝者反転）で pin。

### 小 τ で単一勝者収束（後方互換）（○）
`computeVowelBlend` の τ→0 分岐（`d_v ≤ d_min ? 1 : 0`）＋ estimator テスト（:198 τ=1e-4 で argmax 収束）。s は τ→0 で `activity/(activity+勝者距離)`＝Wave22 の w に一致（design §2.4 と整合）。

### 本波禁止事項（全て「入っていない」を確認）（○）
時間平滑化（estimator は memoryless・τ キャッシュのみ）／鋭さ τ ユーザーツマミ（`vowelBlendTemperatureFactor` 固定定数）／jawOpen 味付け second term（mouth-open は `estimate.s` のみ・:178）／top-k／次元重み手術（`vowelDimensionWeights` 全1）／え ゲート／s・重みのカーブ整形 — **いずれも未混入**。

## 検証項目2: 回帰なし（○）
- 母音分類: `scoreVowels` の距離計算・argmax は不変。
- トグル配線: OFF 時 mouth-vowel スキップ（:87）・readVowelEstimate 注入条件（:100-103）維持。mapping テスト（:382）が disabled 時に母音 parameterId 非発行を pin。
- body follow / head / gaze / blink / smile 経路: 無改修。既存テスト（body x/z, smoothing, reset 等）全 pass。
- mouth-open jawOpen フォールバック: 無効/非対応（readVowelEstimate 未注入）で legacy 正規化維持（:181-188）。mapping テスト（:523 の enabled↔disabled 対比 / :564 純フォールバック）で pin。
- キャリブレーション経路: `convertInputProfileVowelCalibrationToReferences` 呼び出しは不変。

## 検証項目3: テスト再実行（自分で）
上記「実測コマンド結果」の通り。`pnpm install` は未実行。

## 検証項目4: テスト妥当性（○）
- 二重適用 pin: 本物（末端再乗算で Σ≠s となり fail する形。前述）。
- τ 導出テスト（estimator.test.ts:220-278）: 参照Δから距離・median を**独立に再計算**して `computeVowelBlendTemperature` と照合。実装をなぞる呼び出し比較でなく独立再計算＋帯 sanity。トートロジーでない。
- 後方互換 pin（:198）あり。ゲート閉 pin（estimator :162 / mapping :580）あり。reset 後 τ 再導出 pin（:280）あり。

---

## blocking 指摘
なし。

## 任意改善（residual・非 blocking）

### (a) ゲート閉での「全母音 param 0 発行」を mapping 層で pin — **取り込む価値あり（trivial）**
現状、ゲート閉時に全 weight 0 は estimator 層（:162）で、mouth-open=0 は mapping 層（:580）で pin 済みだが、**mapping 層で 5つの `param_mouth_vowel_*` が 0（finite・null/undefined でない）として発行される**ことを直接 pin するテストは無い。:580 のテストに母音スロットを足して各 `param_mouth_vowel_* === 0` を assert すれば、`createVowelValue` の s=0 経路（null でなく finite 0 を返す）という統合シームを閉じられる。低コスト・実挙動を固定する価値あり。→ trivial に取り込む価値あり。

### (b) `createVowelValue` の target.default 無視コメント — **取り込む価値あり（doc のみ・marginal）**
`createVowelValue`（:378-384）は `target.min + targetActivation*(max-min)` を直接返し、`createWeightValue` が使う `target.default` 起点のピボット（`default + (targetValue-default)*strength`）を**使わない**。既存コメントは strength 迂回は説明するが、target.default を敢えて無視する理由（strength が前段に畳まれているため default 相対スケールを再導入しない／min 基準の凸マッピングがブレンド契約）には触れていない。1行の補足で将来の読み手を助ける。純 doc・限界的価値だが無害。→ 取り込む価値あり（優先度低）。

いずれも AC 充足には不要で、本 Wave の pass を妨げない。

## 要エスカレーション（ユーザー判断を要する設計の穴）
なし。設計 §2.5 で「え寄生は素の softmax で目視 benign」「(B)時間平滑化・(B')τ ツマミは実機観測後に判断」が明示的保留として plan §12 Out of Scope に載っており、本 Wave の実装はその境界を正しく守っている。残るは plan §7 の**手動ユーザー gate**（実機で切替パチつき解消 / え benign / う ジッタ）で、これは設計上ユーザー目視に委ねられた既知の次段であり、コード上の穴ではない。

## Domain A 報告との食い違い
独立検証の範囲で、Domain A の 3レーン pass 結論と食い違う点は検出されなかった（追認ではなく独立再現の結果として一致）。
