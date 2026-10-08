# C2 Domain A 完了報告: 頭無し(headless)意味スロットリゾルバの非破壊抽出

> 実装: Gnome(opus)。委任元: Orch-Sylph。日付: 2026-07-10。ブランチ: feature/2d-rigging-eco-system。対象アプリ: apps/runtime-player。

## 判定

**completed**

非破壊抽出は既存トラッキング経路の挙動を変えずに達成できた(Escalate 条件に該当せず)。抽出前後の `parameterValues` 完全一致を golden 等価性テストで機械的に固定済み。

## 作成/変更ファイル(絶対パス)

- 新規: `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\live-mapping\headless-slot-resolver.ts`
  - 頭無しリゾルバ本体。`createRuntimeParameterFrame` 内に private で埋まっていた変換段(`createWeightValue` / `createCenteredTargetValue` / vowel の target 写像 / body smoothing / clamp)をここへ移設し、`resolveSemanticSlotParameterValues` として export。TrackingFrame・InputProfile・calibration に一切依存しない純関数。
- 変更: `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\live-mapping\runtime-parameter-frame.ts`
  - `createRuntimeParameterFrame(input)` を「Stage1: 活性度計算(TrackingFrame + calibration + 共有vowel推定 → slotId ごとのスカラー)」→「Stage2: 抽出したリゾルバ呼び出し」の二段構成に非破壊で書き換え。**公開シグネチャ `CreateRuntimeParameterFrameInput` と戻り値 `RuntimePlayerLiveParameterFrame` は不変**(呼び出し側 `model-mapping-bridge-handlers.ts` は無変更)。変換段の関数は削除しリゾルバへ移設、活性度計算ヘルパー(`computeSlotActivation` ほか)は残置/リネーム。
- 新規: `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\live-mapping\headless-slot-resolver.test.ts`
  - リゾルバ直接テスト(blink 活性度極性・沈黙・clamp・body smoothing 経路)。全 11 件。
- 新規: `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\live-mapping\runtime-parameter-frame-equivalence.test.ts`
  - 代表 TrackingFrame 入力群 20 シナリオの golden 等価性テスト。
- 新規: `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\live-mapping\runtime-parameter-frame-equivalence.golden.json`
  - **リファクタ前(pre-refactor)の実装**から捕獲した golden 出力。等価性の突合対象。

作業ツリーの既存 M ファイル(discussion 配下等)には一切触れていない。

## 抽出したリゾルバの export シグネチャ(Domain B/C 契約)

`headless-slot-resolver.ts` より:

```ts
export type SemanticSlotActivations = Readonly<
  Record<string, number | null | undefined>
>; // key = slotId

export type ResolveSemanticSlotParameterValuesInput = {
  readonly slots: readonly RuntimePlayerMappingSlot[];
  readonly activations: SemanticSlotActivations;
  readonly bodyFollowState?: RuntimePlayerBodyFollowState; // body スロットの平滑化メモリ。blink 生成器は渡さない
};

export function resolveSemanticSlotParameterValues(
  input: ResolveSemanticSlotParameterValuesInput
): Record<string, number>; // key = parameterId
```

### 入力スカラーの意味論(sourceKind 別)

`activations` は **slotId → スカラー**。スカラーの意味は slot の sourceKind で決まり、トラッキング経路が現在変換段へ流し込んでいる入力スカラーと同一:

- weight系(`blink-left` / `blink-right` / `mouth-open` / `mouth-smile`): 活性度 0..1
- centered系(`head-centered` / `gaze-centered` / `body-x` / `body-z`): normalized -1..1
- `mouth-vowel`: 事前ブレンド済み活性度(`s × 正規化per-vowel重み`)

`null` / `undefined` / 非有限、無効スロット、target=null のスロットは **黙って落ちる**(parameterId を書き出さない)。

### Domain B/C(生成器・心臓)への使い方

生成器は blink スロット(weight系, 0..1活性度, 0=開/1=閉)についてのみ `activations` を供給すればよい。auto-mapping が返す `slots` をそのまま渡し、blink 以外の slotId は `activations` に含めなければ(undefined)自動的に沈黙する。`bodyFollowState` は不要(渡さなくてよい)。極性は既存 `eye-blink-*` 既定(`defaultInvert:true` / `defaultStrength:1`)が吸収する(裁定5)ため、生成器側で新しい極性を発明しない。

## 等価性テストの手法と実行結果

**手法**: 承認アプローチ(a) golden fixture 捕獲方式。
1. リファクタ前の commit 済み `createRuntimeParameterFrame` に対し、代表入力 20 シナリオを走らせ `parameterValues` を JSON golden として捕獲(`UPDATE_RESOLVER_GOLDEN=1` の一度きり生成、その後は assert 専用。env 未設定時は常に突合)。
2. golden はリポジトリにコミットし、リファクタ後の実装が **各シナリオで `.toEqual` 完全一致** することを検証。1 件でも差が出れば「非破壊でない」ことを機械が検出する。

**代表入力群のカバレッジ**: blink 単独(部分/全閉/全開)、head/gaze centered(session neutral あり)、head invert+strength+clamp、custom learned signs/ranges、mouth-open(jawOpen fallback)、mouth-smile(左右平均)、複数スロット混在、disabled + clamp、NaN/Infinity/無効レンジ→沈黙、body-x/body-z(calibrated)、body-z 成分strength+反転、body clamp 極値、body-z rotation-only(position calibration 欠落)、body smoothing のフレーム跨ぎ lag(ステートフル)、vowel blend 有効(a / i+strength boost)、vowel gate 閉(neutral)、vowel 無効(キー脱落)、session neutral 無し。

加えて既存 `runtime-parameter-frame.test.ts`(19件, 全て `.toEqual` 完全一致)も**変更せず全通過**しており、これ自体が独立した等価性アンカーとして機能する。

**実行結果**:
- 等価性 golden: `npx vitest run src/main/live-mapping/runtime-parameter-frame-equivalence.test.ts` → **20/20 pass**(リファクタ前 assert でも 20/20、リファクタ後も 20/20 で不変を確認)
- 既存 frame テスト: `runtime-parameter-frame.test.ts` → **19/19 pass**(無変更)
- live-mapping ディレクトリ全体: `npx vitest run src/main/live-mapping/` → **69/69 pass**
- 別consumer: `src/main/model-mapping-profiles/model-mapping-profile-slots.test.ts` → **3/3 pass**
- typecheck: `npx tsc --noEmit -p tsconfig.json` → **exit 0(エラーゼロ)**
- app 全体: `npx vitest run` → **565 pass / 2 fail**。fail 2 件はいずれも browser-source-server 系(`browser-source-server.test.ts` / `browser-source-server-message.test.ts`、`effectiveDynamicsTuning` = Wave21 Dynamics Tune 由来)で、**既知 baseline**。live-mapping には非該当・当方の変更とは無関係。触れていない。

## blink 活性度直接入力テスト・沈黙テストの結果

`headless-slot-resolver.test.ts`(11件全通過):

- **blink 極性(裁定5)**: 素の `eye-blink-*` 既定(`defaultInvert:true`/`defaultStrength:1`、slot の invert/strength は `findSemanticSlotDefinition` の default から構築)に活性度を直接注入し、
  - 活性度 1(閉)→ `target.min`(閉)、活性度 0(開)→ `target.max`(開)、活性度 0.5 → 中間値(0.5)を確認。
  - 非単位レンジ target(0.2..0.9)でも min=閉/max=開 の向きを確認(浮動小数のため `toBeCloseTo`)。
- **左右同値(裁定4)**: 左右同一活性度供給で `param_eye_left_open === param_eye_right_open` を確認。
- **沈黙(未写像)**: target=null / disabled / 活性度 null / 活性度エントリ無し(undefined) / 活性度 NaN・Infinity のいずれも parameterId を書き出さない(`{}`)ことを確認。混在時は無効スロットのみ落ち、有効スロットは残ることも確認。
- clamp(strength 過大で target.max へ丸め)、body smoothing 経路(bodyFollowState 無し=素通し / 有り=lag)も直接固定。

## 裁量判断(活性度計算段とリゾルバの境界)

**境界の切り方**: 「変換段(意味写像の知識)」= リゾルバ、「活性度計算段(TrackingFrame/calibration からのスカラー抽出)」= `createRuntimeParameterFrame` 内、という切り分け。裁定1「まぶたの解決の知識を一箇所」に対応させ、**invert/strength の適用・target 写像・clamp・body smoothing を全てリゾルバ側**に集約した(sourceKind→変換形の対応表がリゾルバの `resolveSlotValue` 一点)。トラッキング経路もこのリゾルバを通る。

**vowel 推定**: vowel の**推定**(共有推定器の実行・memoize、`weightByVowel`、per-vowel strength の pre-normalization bias)は活性度計算段に残置し、リゾルバへ渡すスカラーは `estimate.s × estimate.weightByVowel[label]`(= 現 `createVowelValue` の activation 行と同一)とした。リゾルバ側の vowel 変換(`createVowelTargetValue`)は「strength 末尾再適用なし・target.default ピボットなしで min..max へ線形写像」という現 `createVowelValue` の tail 挙動を厳密に保持(二重適用回避 §3.2 C を維持)。

**body smoothing**: `applyBodySmoothing`(ステートフルな `bodyFollowState.apply`)はリゾルバ側へ移設。等価性の要:
- 元コードは body スロットで `createCenteredTargetValue` → `applyBodySmoothing` の順、`targetValue===null` の時は `apply` を呼ばず null 返却(state 不変)。この分岐を保持し、活性度 null → `createCenteredTargetValue(null)=null` → `applyBodySmoothing(null)=null`(state 不触)という経路が元の「rotation undefined で早期 null 返却」と**同一の state 遷移**になることを確認済み。
- リゾルバは `input.slots` を元と同じ順序で反復するため、`apply` の呼び出し順・回数・引数が完全一致し、平滑化メモリの時間発展が不変(フレーム跨ぎ lag シナリオ・既存 reset テストで固定)。

**mouth-open の vowel gate**: 元の「`readVowelEstimate` が配線されている時のみ `estimate.s`、それ以外は jawOpen 正規化」という分岐を活性度計算段にそのまま残置。配線条件(`mouth-open` かつ `vowelLipsyncEnabled`)も不変。

**二段化に伴う安全性**: activation 段と resolve 段を分離しても、(1) vowel 推定は memoize され反復順非依存、(2) `bodyFollowState` は resolve 段(= slot 順)でのみ書かれ activation 段は触れない、ため state 遷移は元の単一ループと同一。この点は golden(body smoothing lag / vowel 各種)で機械的に担保。

**リゾルバの入力キー**: activations は slotId キー。活性度スカラーは slot 固有の invert/strength/target に依存しない(sourceKind + definition + trackingFrame + calibration のみで決まる)ため、slotId キーでの注入は同一 slotId 重複があっても元挙動と等価(実運用では slotId は一意)。

## Subagent Contract 遵守確認

- **`pnpm install` 未実施**。回避工作なし。lockfile・`pnpm-workspace.yaml` 無変更。新規依存の追加なし。
- **Editor ソース / package-format / Runtime Export schema 無変更**。変更は `apps/runtime-player/src/main/live-mapping/` 配下のみ(+ 完了報告)。
- Runtime Export / package-format に触れていない(要件6遵守)。
- **実行時 `if (role===...)` 分岐なし**(Domain A は役割合成に非関与)。
- physiology/ には触れていない(Domain B/C の領分)。
- 既存の外部シグネチャ不変により、C1 成果・Browser Source primary path・Wave10/11/12/17/18/19/20/21・Wave22/23 vowel lip sync を退行させていない(vowel lip sync ロジックは境界を跨がず活性度段に残置、既存 vowel テスト全通過で確認)。
- 無関係変更の revert なし。作業ツリーの既存 M ファイルに不接触。
- ドメイン想定外の共有ファイルには触れていない(新規リゾルバファイルと当該フレームファイルのみ)。

## 質問(ユーザー/上位判断が必要な曖昧点)

- なし(ブロッカーなし)。参考として Domain B/C 実装者へ 2 点申し送り:
  1. **リゾルバ配置**: 現状 `apps/runtime-player/src/main/live-mapping/headless-slot-resolver.ts`。生成器(physiology/)からの import は相対で可能。Electron import ゼロ・純関数なので physiology/ の純度制約とは独立に import 可(型 `RuntimePlayerBodyFollowState` も Electron 非依存クラス)。第二段の packages 移設時にリゾルバも同伴するかは C2 スコープ外(裁定2 の繰延に含めるか要確認)。
  2. **golden 更新口**: 等価性テストは `UPDATE_RESOLVER_GOLDEN=1` で意図的再生成できる env ガード付き(既定は assert)。Domain C 以降でトラッキング挙動を**意図的に**変える場合以外は再生成しないこと(不変条件の背骨のため)。
