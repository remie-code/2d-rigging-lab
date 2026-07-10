# C2 Domain A レビュー(Review-Sylph レーン①: spec compliance)

> レビュー: Review-Sylph(opus)。委任元: Orch-Sylph。日付: 2026-07-10。対象アプリ: apps/runtime-player。読み取り専任。
> レーン: spec compliance(wave plan + c2 設計討議への突合)。design/development compliance と test adequacy は別レーン担当。

## 判定

**合格(要修正なし)**

裁定1(Option B 非破壊抽出)・裁定5(極性)・§6 Required Behavior・§11 Subagent Contract・§10 Acceptance(Domain A 該当分)・設計討議 §3.1 保護のいずれも spec レベルで満たされている。blocking 差分なし。

## 検証根拠(自分で確認した事実)

- 変更ファイル範囲(`git diff --stat` / `git status`): 変更は `apps/runtime-player/src/main/live-mapping/` 配下のみ。M=`runtime-parameter-frame.ts`(+111/-240)、新規=`headless-slot-resolver.ts` / `headless-slot-resolver.test.ts` / `runtime-parameter-frame-equivalence.test.ts` / `runtime-parameter-frame-equivalence.golden.json`。lockfile・`pnpm-workspace.yaml`・package-format・Runtime Export schema・Editor ソースに変更なし。
- テスト実行(自分で実行): `npx vitest run` で対象3ファイル → **50/50 pass**(resolver 11 / equivalence golden 20 / 既存 frame 19)。等価性メカニズムは机上の存在でなく実際に生きている。
- 変換関数の所在(`grep`): `createWeightValue` / `createCenteredTargetValue` / `createVowelTargetValue` / `resolveSemanticSlotParameterValues` は `headless-slot-resolver.ts`(実装)+ `runtime-parameter-frame.ts`(import して呼ぶ)+ resolver テストにのみ出現。**変換ロジックの二重定義は存在しない**。

## spec 適合状況(裁定・§ごと)

### 裁定1(Option B 非破壊抽出) — 充足

- `createRuntimeParameterFrame` 内に private で埋まっていた変換段(`createWeightValue` / `createCenteredTargetValue` / vowel target 写像 / body smoothing / clamp)が `headless-slot-resolver.ts` へ移設され、`resolveSemanticSlotParameterValues({ slots, activations, bodyFollowState? })` として export された。TrackingFrame / InputProfile / calibration に非依存の純関数(import は型と `findSemanticSlotDefinition` のみ)。「活性度 + slots → parameterValues」の頭無しリゾルバという契約に合致。
- **トラッキング経路が同一リゾルバを呼ぶ**: `createRuntimeParameterFrame` は `import { resolveSemanticSlotParameterValues } from "./headless-slot-resolver"` し、Stage2 で呼ぶ(diff の該当追加行)。トラッキング用と生成器用で変換ロジックが分岐していない=写像の知識が一箇所に集約(§3.1 保護2)。生成器(Domain B/C)は同じ export を叩く契約であり、駆動源 N × モデル M の掛け算にならない。
- 非破壊性: 公開シグネチャ `CreateRuntimeParameterFrameInput` と戻り値 `RuntimePlayerLiveParameterFrame` は不変。呼び出し側 `model-mapping-bridge-handlers.ts` は無変更(diff に出現せず)。二段化は活性度計算(Stage1、TrackingFrame→スカラー)と変換(Stage2、リゾルバ)の分離で、slot 反復順・body smoothing の state 遷移・vowel 推定の memoize が保存される構造。Escalate 条件(既存挙動を変えずに抽出不能)には該当しなかった。

### 裁定5(極性) — 充足

- リゾルバ `createWeightValue`(headless-slot-resolver.ts:159-175): `targetActivation = slot.invert ? 1-activation : activation` → `target.min + targetActivation*(max-min)` → strength 適用。`eye-blink-*` 既定(invert:true / strength:1)で activation=1(閉)→ targetActivation=0 → **target.min=閉**、activation=0(開)→ targetActivation=1 → **target.max=開**。裁定5「blink 活性度 0=開/1=閉、target.min=閉/target.max=開」に一致。
- 新しい極性を発明していない: 極性は既存 slot の invert/strength 既定(`findSemanticSlotDefinition` 由来)がそのまま吸収し、リゾルバは既存の変換式を移設しただけ。resolver 直接テスト(activation 1→min、0→max、0.5→中間、非単位レンジでも min=閉/max=開)で契約が固定されている。

### §6 Required Behavior — 充足

- リゾルバ抽出(純関数)+ トラッキング経路が同一リゾルバを呼ぶ: 上記のとおり。
- 等価性テスト: 代表 TrackingFrame 入力群 20 シナリオ(blink 単独/混在、head/gaze centered、custom signs、mouth-open jawOpen fallback、mouth-smile、body-x/z 各種、body smoothing のフレーム跨ぎ lag、vowel blend 有効/gate 閉/無効、session neutral 有無、NaN/Infinity 沈黙)で `parameterValues` の完全一致を assert。実行で 20/20 pass 確認。
- 活性度直接入力で eye-blink が正しい向き・範囲: resolver テストで固定(裁定5 節)。
- 未写像スロットの沈黙: `resolveSemanticSlotParameterValues` は `!slot.enabled || slot.target===null` を continue、`value===null || !Number.isFinite(value)` を continue で parameterId を書き出さない。既存挙動維持。
- Runtime Export / package-format 無変更: diff に該当ファイルなし。

### §11 Subagent Contract — 遵守

- `pnpm install` 未実施・回避工作なし(lockfile / `pnpm-workspace.yaml` 無変更で確認)。新規依存なし。
- Editor / package-format / Runtime Export schema / lockfile 無変更(`git diff --stat` で live-mapping 配下のみ)。
- 実行時 role 分岐なし(Domain A は役割合成に非関与、diff に `if (role` 系の追加なし)。physiology/ 不接触。
- 無関係 revert なし。作業ツリーの既存 M ファイル(discussion 配下)に不接触。

### §10 Acceptance Criteria(Domain A 該当分) — 構造として充足

- 「等価性テストによりトラッキング経路の出力が抽出前後で完全一致」を主張する仕組みが存在し、かつ実際に pass する: golden fixture 突合方式(`UPDATE_RESOLVER_GOLDEN=1` で捕獲、既定は assert)。加えて**変更していない既存 `runtime-parameter-frame.test.ts`(19 件)が抽出後も全 pass** しており、これはリファクタ以前に書かれた独立アンカーとしてトラッキング出力を pin している。二重の等価性保証構造。
- テストの実効性(golden が真に pre-refactor から捕獲されたかの技術的深掘り)は test adequacy レーンに委ねる。spec レベルの「等価性を主張する仕組みが存在するか」は充足。下記「質問」に残余点を1つ記載。

### 設計討議 §3.1 の保護 — 担保

1. 生成器はモデルを知らない: リゾルバは (A) 振る舞い知識を持たず、slotId→スカラー(活性度)と `slots`(身体知識 B は auto-map slots が保持)を受けるだけ。生成器は blink 活性度のみ供給すれば足りる契約。
2. 写像の二重化防止: 変換ロジックが `headless-slot-resolver.ts` の一箇所のみ(grep で確認)。トラッキング経路も生成器経路もこの一関数を通る。
3. 失敗の作法が既存と揃う: 沈黙(未写像 → parameterId を書かない)を既存挙動どおり保持。

## blocking 差分

なし。

## 裁量注記(非 blocking)

- **リゾルバ配置**: 現状 `apps/runtime-player/src/main/live-mapping/headless-slot-resolver.ts`。裁定1・wave §4.1 はファイルパスを規定しておらず、live-mapping 内配置は合理的(Electron import ゼロ・純関数で physiology/ からの相対 import も可能)。第二段の packages 移設時にリゾルバを同伴するかは C2 スコープ外(裁定2 の繰延に含めるか)を Gnome 報告も申し送りに挙げている。spec 違反ではない。
- **vowel activation の分割**: 旧 `createVowelValue` の「`estimate.s × weightByVowel[label]`」算出を活性度計算段(`computeVowelActivation`)へ、target 写像を resolver(`createVowelTargetValue`)へ分けた。二重適用不変条件(§3.2 C:strength 末尾再適用なし / target.default ピボットなし)はコメントとテストで保持。裁定・§ に反しない合理的境界。
- **body-x の活性度共有**: `computeSlotActivation` で body-x を head-centered と同じ `computeHeadRotationNormalized` へ束ね、smoothing のみ Stage2 に残した。旧 `createBodyXValue` と等価で、等価性 golden(body-x calibrated / clamp / smoothing lag)が担保。設計未定義の合理的実装。

## 質問(上位判断・他レーンへの申し送り)

- **Q1(test adequacy レーンへ)**: 等価性 golden(`runtime-parameter-frame-equivalence.golden.json`)は untracked の新規ファイルであり、成果物単体からは「pre-refactor 実装から捕獲された」ことを機械的に証明できない(Gnome 報告はそう主張、手法も妥当)。ただし spec レベルでは、変更していない既存 `runtime-parameter-frame.test.ts`(19 件、リファクタ以前作成)が抽出後も全 pass するという独立アンカーが存在するため、等価性の spec 保証は成立していると判断した。golden 捕獲手順の追検証(例: pre-refactor commit で `UPDATE_RESOLVER_GOLDEN=1` を回して差分ゼロを確認できるか)は test adequacy レーンの領分として申し送る。
- Orch-Sylph への確認事項なし(本レーンとしては合格、次ドメイン進行に spec 上の障害なし)。
