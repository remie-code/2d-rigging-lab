# 調査: player 写像層の strength 調整機能の現状（母音スロットを乗せられるか）

- 調査者: Sylph（風／調査）
- 依頼元: L0（Undine / Fable）
- 日付: 2026-07-06
- 種別: 事実調査（設計提案なし）。事実は file:line 証跡付き。推測は「推測」と明記。
- 対象: `C:\workspace\remie\code\ai-native-live2d-editor`
- 前提調査: `player-ifacialmocap-survey.md` / `player-calibration-survey.md`

---

## 結論（一文）

**strength は「スロット単位のスカラー（0〜2、既定 1）」で、`RuntimePlayerMappingSlot.strength` に保持され、モデル単位の永続プロファイル `model-mapping-profiles`（`ModelMappingProfileSlot.strength`）に保存される。適用は「default を軸に、正規化済みの activation/normalized が生む変位に strength を線形に掛ける」= `default + (targetValue - default) * strength`。weight 系（口・まばたき）と centered 系（頭・視線）で数式は違うが strength の掛かり方（変位を線形スケール）は同型。そして写像は 1 スロット → 1 parameterId の完全な 1:1（`slot.target.parameterId` に単一値を書くだけ、`runtime-parameter-frame.ts:54`）。1 スロットが複数ターゲットに値を出す構造は現状存在しない。母音（推定器1つ→5パラメータ）は、この 1:1・1次元 strength の枠には収まらず、新しい sourceKind を1個足すだけでは実装できない（複数ターゲット出力・母音別 activation ベクトルという新機構が要る）。**

---

## 1. strength の定義と保存

### 1-A. 実行時スロット型（メモリ上）
- 型: `RuntimePlayerMappingSlot`（`apps/runtime-player/src/preload/model-mapping-bridge-contract.ts:34-49`）
  - `strength: number`（必須, :41）。ほか `smoothing?`, `bodyRotationStrength?`, `bodyPositionStrength?` の追加スカラー（:42-46, body 専用）。
- スロットの target は**単一**: `target: RuntimePlayerMappingTarget | null`（:38）、`RuntimePlayerMappingTarget = { parameterId, displayName, min, max, default, ... }`（:20-27）。**parameterId は 1 個**。

### 1-B. 既定値と値域
- 既定 strength はスロット定義に固定: `SemanticSlotDefinition.defaultStrength`（`semantic-slot-definitions.ts:29`）。
  - 頭/目/口/まばたき系はすべて `defaultStrength: 1`（:47,58,69,80,90,100,111,122,132）。body-x のみ `0.35`（:142）、body-z は `1`（:154）。
- auto-mapping 生成時に `strength: definition.defaultStrength` として載る（`runtime-export-auto-mapping.ts:28`）。
- 値域: **0〜2**（更新バリデーション `model-mapping-bridge-request-validation.ts:79-96`、`readOptionalStrength` が `value < 0 || value > 2` を拒否、`Math.round(value*100)/100` で 2 桁丸め）。UI のスライダも `min="0" max="2" step="0.05"`（`mapping-page.tsx:250-253`）。
- `bodyRotationStrength / bodyPositionStrength` も同じ `readOptionalStrength`（0〜2）を共有（:22-29）。`smoothing` は別枠 0〜0.95（:98-112）。

### 1-C. 永続保存
- 保存型: `ModelMappingProfileSlot.strength: number`（`model-mapping-profile-document.ts:29-40`, :34）。
- ドキュメント: `ModelMappingProfileDocument`（:42-49）= `schemaVersion, createdAtIso, updatedAtIso, exportIdentity, autoMappingVersion, slots[]`。
- **保存単位はモデル（runtime-export）単位**: `exportIdentity`（packageId/packageRevision/parameterSignatureHash 等, :10-15）でモデルを識別。→ キャリブレーション（`profiles.json` = 入力ソース単位）とは**別ストア・別粒度**。
- schemaVersion 定数: `"runtime-player-model-mapping-profile-v1"`（:5-6）。単一版（マイグレーション未実装）。
- 保存時 `strength: slot.strength` を素通し（`model-mapping-profile-slots.ts:129`）、復元時も `strength: input.profileSlot.strength`（:159）。

### 1-D. centered 系 vs weight 系での strength の意味論の違い
- **数式は下記 §3 参照**。結論だけ先に言うと、**strength の「掛け先」は共通で「default からの変位」**。ただし変位の作り方が違う:
  - weight 系（口/まばたき）: activation ∈ [0,1] → `min..max` へ写像 → default からの変位に strength。
  - centered 系（頭/視線）: normalized ∈ [-1,1] → default から min/max 方向へ写像 → default からの変位に strength。
  - つまり strength は「意味論」ではなく「効き幅の一次スケール」として両系で同型に働く。**strength だけ見れば 1 次元スカラーで統一されている。**

---

## 2. UI（スライドバーの実装箇所と列挙）

- 画面: Control ウィンドウの **Mapping ページ**（`mapping-page.tsx`）、`Panel title="Semantic Slots"`（:141-161）。
- スライダ実体:
  - 標準スロット（head/eyes/mouth）: `StandardMappingSlotRow`（:190-268）内の `type="range" min=0 max=2 step=0.05`、ラベル `Strength {Math.round(slot.strength*100)}%`（:247-264）。onChange → `onUpdateSlot({slotId, strength})`。
  - body スロット: `BodyMappingSlotRow`（:270-316）で分岐。body-x は Strength+Lag（`BodyXControls` :344-392）、body-z は Rotation/Position strength+Lag（`BodyZControls` :394-472）。汎用 `NumberSlider`（:499-529）。
- **スロット列挙は semanticSlotDefinitions 由来の自動列挙**:
  - `createAutoMappingSlots` が `semanticSlotDefinitions.map(...)`（`runtime-export-auto-mapping.ts:15-49`）で全定義からスロットを生成。
  - UI は `mappingStatus.slots` を group（head/eyes/mouth/body）で filter して描画（`groupMappingSlots` `mapping-page.tsx:531-557`）。**group は 4 種ハードコード**（head/eyes/mouth/body, :539-556, `RuntimePlayerMappingSlotGroup` 型 `model-mapping-bridge-contract.ts:18`）。
- **新スロットを足すと UI に自動で出るか** → **条件付きで自動で出る**:
  - `semanticSlotDefinitions` に1件足し、`runtimePlayerMappingSlotIds`（`model-mapping-bridge-contract.ts:1-13`）に slotId を足せば、`createAutoMappingSlots` が拾い、UI の group filter が既存 4 group のいずれかなら**自動的にスライダ付き行が出る**（推測: 新 group を作ると `groupMappingSlots` のハードコード 4 group に載らず表示されない、:539-556）。
  - strength スライダは `StandardMappingSlotRow` が group≠body の全スロットに一律で出す（:190-268）ので、**strength UI は新スロットに自動で付いてくる**（新 group を作らない限り）。

---

## 3. 適用の意味論（strength の正確な数式）

写像入口: `createRuntimeParameterFrame`（`runtime-parameter-frame.ts:28-75`）。各スロットを評価し `parameterValues[slot.target.parameterId] = clamp(value, target.min, target.max)`（:54-58）。**1 スロット = 1 parameterId への代入**（§4 参照）。

### 3-A. weight 系（口・まばたき） `createWeightValue`（:263-279）
```
activation = readRangeActivation(value, min, max)   // = clamp((value-min)/(max-min), 0, 1)  :458-473
targetActivation = invert ? (1 - activation) : activation           // ← invert は activation 段で反転
targetValue = target.min + targetActivation * (target.max - target.min)
戻り値 = target.default + (targetValue - target.default) * strength   // ← strength は最後
最終 = clamp(戻り値, target.min, target.max)                          // 呼び出し側 :54
```
- **順序**: activation 生成 → invert（activation を 1-x で反転）→ min/max 補間 → **strength を最後に「default からの変位」へ乗算** → clamp。
- strength=0 で default に張り付く、strength=2 で変位 2 倍（ただし呼び出し側 clamp で target.min/max に頭打ち）。
- 使用例: mouth-open は `blendshapes.jawOpen` を `sessionNeutral?.jawOpen ?? mouth.jawOpenMin` 〜 `mouth.jawOpenMax` で正規化（:108-116）。mouth-smile は `mouthSmile_L/R` 平均を `smileMin〜smileMax`（:117-125, :475-484）。blink は `eyes.blink*Min/Max`（:91-107）。

### 3-B. centered 系（頭・視線） `createCenteredTargetValue`（:241-261）
```
normalized = readCenteredNormalizedValue(...)   // [-1,1] 双方向正規化  :198-239
adjusted = clamp(normalized, -1, 1) * (invert ? -1 : 1)              // ← invert は normalized 段で反転
targetValue = adjusted >= 0
  ? target.default + adjusted * (target.max - target.default)
  : target.default + adjusted * (target.default - target.min)
戻り値 = target.default + (targetValue - target.default) * strength   // ← strength は最後
最終 = clamp(戻り値, target.min, target.max)                          // 呼び出し側 :54
```
- **順序**: normalized 生成 → invert（符号反転）→ default 起点で正負に補間 → **strength を最後に「default からの変位」へ乗算** → clamp。
- weight 系と共通: **strength は常に `(targetValue - default) * strength` の形**で、default からの変位の線形スケール。
- 使用例: head-centered（:133-159, angle x/y/z）、gaze-centered（:161-196）。
- body-x（:281-310）は centered と同じだが後段に `applyBodySmoothing`。body-z（:312-340）は strength を使わず rotation/position 各 strength を内部合成（:368-370, :404-406）してから `createCenteredTargetValue(..., strength:1)`（:337）。

### 3-C. まとめ
- **strength = 「入力の正規化された効き（activation/normalized）が生む default からの変位」への一次係数**。clamp は最後（呼び出し側）。invert は strength より前（activation/normalized 段）。**strength は純粋な 1 次元スカラーで、両系で意味が一致している。**

---

## 4. 1 スロット → 複数ターゲットの可否 ★核心

- **現行は完全な 1:1**。根拠:
  - `RuntimePlayerMappingSlot.target` は `RuntimePlayerMappingTarget | null`（**単数**, `model-mapping-bridge-contract.ts:38`）。配列でない。
  - 評価は `parameterValues[slot.target.parameterId] = clamp(value, ...)`（`runtime-parameter-frame.ts:54`）。1 スロットの評価が書く parameterId は **1 個だけ**。`createSlotParameterValue` の戻り値も `number | null`（スカラー1個, :77-131）。
  - `targetAliases` は複数持てる（`semantic-slot-definitions.ts:25`, 例 body-x は `["body.angle.x","param_body_angle_x"]` :138）が、これは**マッチ候補の別名リスト**であって出力先ではない。`findTargetForDefinition` は候補の中から**1 つだけ**選んで返す（`runtime-export-auto-mapping.ts:105-134`, 戻り値 `... | null` 単数）。
- **1 スロットが複数 parameterId に値を出す構造は存在しない。**
- → 母音は「1つの推定器 → 5パラメータ（あ/い/う/え/お、または口形パラメータ群）」の形になり得るが、**現行の 1 スロット=1 パラメータ=1 スカラー strength の枠には構造的に収まらない**（推測ではなく型・評価ループから断定できる事実）。

---

## 5. スロット追加の変更面（新 sourceKind / スロット1個を足す場合）

新スロット（例: 母音を仮に「1スロット1パラメータ」の単純形で足す場合でも）触るファイル:

| 面 | ファイル / 箇所 | 内容 |
|---|---|---|
| slotId 列挙 | `model-mapping-bridge-contract.ts:1-13` | `runtimePlayerMappingSlotIds` に slotId 追加（型 `RuntimePlayerMappingSlotId` が波及） |
| group 型 | 同 `:18` | 新 group なら `RuntimePlayerMappingSlotGroup` に追加 |
| sourceKind 型 | `semantic-slot-definitions.ts:11-19` | `SemanticSlotSourceKind` に新 kind 追加 |
| 定義表 | 同 `:38-162` | `semanticSlotDefinitions` に定義追加（strength 既定はここに書けば自動で付く） |
| 評価 switch | `runtime-parameter-frame.ts:85-130` | `createSlotParameterValue` の switch に case 追加（新 kind の数式） |
| blendshape 読み取り | `runtime-parameter-frame.ts`（各 create*Value） | 母音なら新 blendshape/activation ベクトルの読み取りが必要（現状 jawOpen/smile/blink/head/gaze/pos のみ） |
| UI group filter | `mapping-page.tsx:531-557` | **新 group なら `groupMappingSlots` のハードコード 4 group に追加が必要**（既存 group なら不要） |
| 保存（自動追随） | `model-mapping-profile-slots.ts:113-183` | `toProfileSlot`/`restoreSlotControls` は `strength` を素通しで扱うので**単純スロットなら追加コード不要**。ただし新フィールド（例: 母音別 activation 配列）を保存するなら `ModelMappingProfileSlot` 型（`model-mapping-profile-document.ts:29-40`）拡張＋保存/復元コード追加＋schemaVersion 版上げ（現状 v1 単一、マイグレーション未実装）が必要（推測） |
| 更新バリデーション | `model-mapping-bridge-request-validation.ts` | 新スカラー UI を出すなら `RuntimePlayerMappingSlotUpdateRequest`（contract :88-98）とバリデーション（:9-54）に項目追加 |

- **strength がスロット追加に自動で付いてくるか** → **YES（単純スロットなら）**。`defaultStrength` を定義表に書けば auto-mapping・保存・復元・UI（Standard 行）すべてが既存経路で strength を扱う。追加コード不要。
- **ただし母音の本質（1推定器→複数ターゲット）を素直に実装するには 1:1 前提そのものを壊す必要があり、上表の「単純スロット追加」では足りない**（§4）。複数ターゲット出力を許すには `slot.target` の単数前提（contract:38）と評価ループの単一代入（runtime-parameter-frame.ts:54）の両方を作り替える必要（事実）。

---

## 6. 事実 vs 推測

- 事実（file:line 済み）: §1〜§5 の型・数式・列挙・保存経路すべて。特に「1 スロット=1 parameterId=1 スカラー」（§4）と strength 数式（§3）は型と評価ループから断定。
- 推測（明記）:
  - 新 group を作ると `groupMappingSlots` のハードコードに載らず UI 非表示（コード構造からの帰結, `mapping-page.tsx:539-556`）。
  - 母音別 activation ベクトルを保存するなら schemaVersion 版上げが要る（v1 単一・マイグレーション未実装からの帰結）。

## 7. L0 への回答材料（問い: strength に母音を乗せられるか）

- **strength は 1 次元スカラー（0〜2）で、その正体は「default からの変位の一次係数」**。母音を「強さ1本」で表すのは意味的に無理（母音は5次元の相互排他的ラベルであり、単一スカラーの強弱ではない）。
- **写像は 1:1（1スロット→1パラメータ）で固定**。母音「1推定器→5パラメータ」は、現行の 1 スロット=1 ターゲットの枠を**構造的に超える**（型 contract:38 と評価 runtime-parameter-frame.ts:54 の両方を改修しないと不可能）。
- 逆に言えば、母音を**5つの独立スロット（あ/い/う/え/お それぞれ mouth-open と同型の weight スロット）**として足すなら、既存の strength・保存・UI 経路にそのまま乗る（§5「単純スロット追加」）。この場合 strength は「各母音の効き幅」として自然に機能する。ただし「推定器1つが5母音を相互排他的に配分する（softmax 的）」ロジックは現行の per-slot 独立評価には無く、別途必要（事実: 各スロットは独立に activation を読む、runtime-parameter-frame.ts:33-59 のループに相互作用なし）。
