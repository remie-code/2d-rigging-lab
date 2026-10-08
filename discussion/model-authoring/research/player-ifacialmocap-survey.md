# 調査: player の iFacialMocap → runtime 接続 現状（母音口パクが動かない件）

- 調査者: Sylph（風／調査）
- 依頼元: L0（Undine / Fable）
- 日付: 2026-07-06
- 種別: 事実調査（設計提案なし）。事実は file:line 証跡付き。推測は明記。
- 対象リポジトリ: `C:\workspace\remie\code\ai-native-live2d-editor`

---

## 結論（一文）

**母音データは「受信段階で欠落」しているのではなく、「写像層に母音スロットが存在しないため捨てられている」。** iFacialMocap は ARKit 52 blendshape を送るが母音（あいうえお）フィールド自体を持たず（＝上流に母音の生値は無い）、かつ player の写像層 `semanticSlotDefinitions` は口を `mouth-open`(jawOpen) と `mouth-smile` の 2 スロットしか定義しておらず、エクスポートに存在する `param_mouth_vowel_a/i/u/e/o` を評価対象の `parameterValues` に一切載せない。ギャップは写像層。評価系（stage 適用）は parameterId さえ載れば汎用に評価できる状態。

---

## データフロー（文章図）

```
[iPhone iFacialMocap アプリ]
  │ UDP :49983  raw text frame  "name-value|name-value|...|=head#...|rightEye#...|leftEye#...|"
  ▼
(1) 受信   ifacialmocap-udp-receiver.ts  … UDP datagram を rawFrame 文字列で onMessage
  ▼
(2) パース parseIFacialMocapFrame()      … "|"分割 → blendshapes{name:number} + head/eyes
  ▼
(3) 正規化 normalizeIFacialMocapParsedFrame() … 値/100 して 0..1 clamp、TrackingFrame へ
  ▼   TrackingFrame.blendshapes{ jawOpen, mouthSmile_L, ... }（ARKit名のまま全保持）
  │
(4) 写像   createRuntimeParameterFrame()  ← ここが断絶点
  │   slots(= createAutoMappingSlots by semanticSlotDefinitions) を1つずつ評価
  │   口は mouth-open(jawOpen) と mouth-smile のみ。母音スロット無し。
  ▼   parameterValues{ param_mouth_open: x, ... }  ← 母音 parameterId は入らない
  │
(5) 配信   liveParameters.publishFrame → IPC → stage window
  ▼
(6) 評価/適用 static-stage-canvas-renderer.setLiveParameterFrame
  │   → createEvaluatedRuntimeExportStageRenderInput(authoredParameterValues = parameterValues, deltaTimeMs, ...)
  ▼   parameterValues に載った parameterId のみが authored 値として適用され、その後 dynamics 評価
[WebGL2 描画]
```

断絶点は **(4) 写像層**。母音 parameterId が (4) で `parameterValues` に載らないため、(6) の汎用評価器には母音の入力が届かない。

---

## 1. 受信経路

- プロトコル/ポート/形式:
  - UDP 受信。ポートは接続要求で指定（テストデータ実測 `49983`）。`test_data/iFaceMocap/01_forward.json:9` `"receivePort": 49983`。
  - 受信本体: `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts`。onMessage で rawFrame 文字列を渡す（`input-bridge-handlers.ts:94-98`）。
  - パケット形式は独自テキスト（ARKit 生 blendshape 名 + 独自 transform セグメント）。区切り `|`、name-value 区切りは `&` または `-`（`ifacialmocap-frame-parser.ts:207`）。head/eye は `=head#`/`head#`/`rightEye#`/`leftEye#` プレフィックス（同 9-12）。TCP フレーム区切り `___iFacialMocap` を末尾から剥がす（同 9, 373-383）。
- パース箇所: `parseIFacialMocapFrame`（`ifacialmocap-frame-parser.ts:33`）。blendshape は `blendshapes: Record<string, number>`（同 41, 241）に名前そのままで格納。head=6値の euler+pos（同 142-170）、eye=3値 euler（同 172-200）。
- 受信フィールドの全体像 — **ARKit blendshape 52 種の生値**（＋独自 2 種）。母音フィールドは存在しない。実測フレーム `test_data/iFaceMocap/01_forward.json:16-236, 710`（`blendshapeCount: 54`）:
  - ARKit 52 標準: browDown_L/R, browInnerUp, browOuterUp_L/R, cheekPuff, cheekSquint_L/R, eyeBlink_L/R, eyeLookDown_L/R, eyeLookIn_L/R, eyeLookOut_L/R, eyeLookUp_L/R, eyeSquint_L/R, eyeWide_L/R, jawForward, jawLeft, **jawOpen**, jawRight, mouthClose, mouthDimple_L/R, mouthFrown_L/R, mouthFunnel, mouthLeft, mouthLowerDown_L/R, mouthPress_L/R, mouthPucker, mouthRight, mouthRollLower, mouthRollUpper, mouthShrugLower, mouthShrugUpper, **mouthSmile_L/R**, mouthStretch_L/R, mouthUpperUp_L/R, noseSneer_L/R, tongueOut。
  - 独自 2 種: `trackingStatus`（状態フラグ）, `hapihapi`（アプリ独自の追加シェイプ、`:109`）。
  - 加えて head(rot+pos), leftEye/rightEye(rot)（`:237-256, 710`）。
- **「あいうえお」（母音）相当フィールドは存在しない。** ARKit blendshape 規格に母音カテゴリは無く、実測フレームにも `vowel`/`A`/`I`/`U`/`E`/`O` 等の名は一切現れない（事実）。口の開閉は `jawOpen`、口形は `mouthPucker`/`mouthFunnel`/`mouthSmile`/`mouthStretch` 等の組合せで表現される規格（推測: 母音は複数 blendshape から合成する必要がある）。

## 2. 写像層（受信フィールド → モデルパラメータ）

- 定義場所: **ハードコード表** `apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts:38-162`（`semanticSlotDefinitions` 配列）。設定ファイルではない。
- 現在定義される全スロット（11 個）と使用フィールド:

| slotId | sourceKind | 使う受信フィールド | 対象 preset alias | 定義行 |
|---|---|---|---|---|
| head-horizontal | head-centered | head.rotationEulerDeg | face.angle.x | :40 |
| head-vertical | head-centered | head.rotationEulerDeg | face.angle.y | :50 |
| head-tilt | head-centered | head.rotationEulerDeg | face.angle.z | :61 |
| eye-blink-left | blink-left | `eyeBlink_L` | eye.left.open | :72 |
| eye-blink-right | blink-right | `eyeBlink_R` | eye.right.open | :82 |
| gaze-horizontal | gaze-centered | eyes.left/right euler | eyeball.x | :92 |
| gaze-vertical | gaze-centered | eyes.left/right euler | eyeball.y | :103 |
| **mouth-open** | mouth-open | **`jawOpen`** | mouth.open | :114 |
| **mouth-smile** | mouth-smile | **`mouthSmile_L/R`** 平均 | mouth.smile | :124 |
| body-x | body-x | head.rotation | body.angle.x / param_body_angle_x | :134 |
| body-z | body-z | head.rotation+position | body.angle.z / param_body_angle_z | :146 |

- 実際に評価に使われる受信フィールド: `jawOpen`, `mouthSmile_L/R`, `eyeBlink_L/R`, head euler(x/y/z), head position, 両目 euler。
- **捨てられている受信フィールド（写像層で未参照）**: 上記以外すべて。口周りでは `mouthClose, mouthDimple_L/R, mouthFrown_L/R, mouthFunnel, mouthLeft/Right, mouthLowerDown_L/R, mouthPress_L/R, mouthPucker, mouthRollLower/Upper, mouthShrugLower/Upper, mouthStretch_L/R, mouthUpperUp_L/R, jawForward/Left/Right, tongueOut, cheek*`、眉 `brow*`、`noseSneer*`、独自 `hapihapi`。これらは TrackingFrame まで正規化され保持されるが（`normalizeBlendshapes` は全 blendshape を素通しで残す `ifacialmocap-normalizer.ts:54-69`）、写像層 `createSlotParameterValue` の switch に対応 case が無いため参照されずに落ちる。
- 評価の実体: `createSlotParameterValue`（`runtime-parameter-frame.ts:85-131`）の switch は `head-centered/gaze-centered/blink-left/blink-right/mouth-open/mouth-smile/body-x/body-z` の **8 種のみ**。母音の case は存在しない。

## 3. 口まわりの現状

- Mouth Open を駆動しているもの: `jawOpen` 単独。`runtime-parameter-frame.ts:108-116`（`case "mouth-open"` → `readRangeActivation(trackingFrame.blendshapes.jawOpen, neutral/min, max)`）。neutral は sessionNeutral.jawOpen ?? calibration.mouth.jawOpenMin。
- Mouth Smile: `mouthSmile_L/R` の平均（`runtime-parameter-frame.ts:117-125, 475-484`）。
- 母音系フィールドがどこで落ちるか — **該当するのは「受信データにそもそも母音フィールドが無い（未パースではなく非存在）」＋「母音を合成する写像スロットが定義されていない（写像層に不在）」の二段**。母音 parameterId（`param_mouth_vowel_*`）は「参照する写像スロットが存在しない」ため `parameterValues` に載らない。ARKit 由来の口形 blendshape（pucker/funnel/stretch 等）は「パース済みだが写像層で未参照」。

## 4. パラメータ解決

- player はモデルパラメータをどう特定するか: **projectPresetAlias 優先 → parameterId 一致 → displayName 一致** の 3 段フォールバック。`runtime-export-auto-mapping.ts:105-134`（`findTargetForDefinition`）。各スロット定義の `targetAliases`（例 `mouth.open`）を alias/parameterId/displayName に照合。
- 直接ターゲット候補の抽出条件: `runtimeRole==="external-input"` かつ `externalInput` かつ `!readOnly` かつ `valueSource==="authoredInput"` かつ manifest の externalInputParameterIds に含まれ、computed/hidden に含まれない（`runtime-export-auto-mapping.ts:71-88`）。
- **エクスポート形式に母音パラメータは含まれる（事実）**: preset カタログに `param_mouth_vowel_a/i/u/e/o`（alias `mouth.vowel.a/i/u/e/o`, group "mouth", weight 0..1）が定義済み。`packages/package-format/src/parameter-presets.ts:74-78`。加えて `param_mouth_form`(mouth.form) `:69`。
- したがって player 側が「汎用に評価できる状態か」: **YES（評価系は汎用）**。評価器は `authoredParameterValues`（parameterId→値の辞書）を受け、載っている parameterId をそのまま authored 値として適用する（`static-stage-canvas-renderer.ts:604-617`）。母音 parameterId を辞書に入れさえすれば評価される。**ギャップは写像層のみ。評価系に母音固有の欠けは無い**（＝母音スロットを写像層に足し、対応 alias `mouth.vowel.*` を拾わせれば通る、という構造）。

## 5. 適用パイプライン（受信値→パラメータ値の変換と挿入層）

変換の位置関係（母音写像を新設する場合の挿入層判断材料）:

1. **正規化**: raw 値 /100 → 0..1 clamp。全 blendshape 一律。`ifacialmocap-normalizer.ts:71-86`。母音を合成するならこの後段（TrackingFrame.blendshapes を入力に）。
2. **写像（スロット評価）**: `createRuntimeParameterFrame`（`runtime-parameter-frame.ts:28-75`）。スロット毎に activation 算出 → `createWeightValue`（invert/strength 適用, `:263-279`）or `createCenteredTargetValue`（`:241-261`）→ 最後に `clamp(value, slot.target.min, slot.target.max)`（`:54-58`）。**母音写像を足すならここ（新 sourceKind + semanticSlotDefinitions への母音スロット追加 + createSlotParameterValue の case 追加）が挿入層。** ここで parameterValues にキーが載る。
3. **スムージング**: body 系のみ `applyBodySmoothing`(bodyFollowState, `:409-423`)。口/目の weight 系にスムージングは無い（現状）。
4. **スケール/クランプ**: 上記 target.min/max clamp、strength 乗算。
5. **dynamics との位置関係**: dynamics は写像より**下流**。stage 側 `createEvaluatedRuntimeExportStageRenderInput` に `authoredParameterValues` と `deltaTimeMs`/`effectiveDynamicsTuning` を渡し（`static-stage-canvas-renderer.ts:605-617`）、そこで authored 適用後に dynamics（sway 等）が評価される構造。母音は authored 値として写像層で決めれば、dynamics より前段に入る。

補足（スロット供給元）: `getSlots()` はオートマッピング（`createAutoMappingSlots`）か保存プロファイル復元のいずれか（`live-mapping-state.ts:56-57, 65-71, 112, 332`）。どちらも母音スロットを生成しない（前者は semanticSlotDefinitions を map するだけ `runtime-export-auto-mapping.ts:15`、後者は保存済みスロットの復元で元が無ければ生成されない）。

---

## 証跡ファイル一覧

- 受信: `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver.ts`, `.../input-bridge-handlers.ts`
- パース: `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser.ts`, `.../ifacialmocap-parsed-frame.ts`
- 正規化: `apps/runtime-player/src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer.ts`
- 実測受信データ: `test_data/iFaceMocap/01_forward.json`（他 02〜07 も同構造）
- 写像スロット定義: `apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts`
- 写像評価: `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`
- オートマッピング/解決: `apps/runtime-player/src/main/live-mapping/runtime-export-auto-mapping.ts`
- スロット供給: `apps/runtime-player/src/main/live-mapping/live-mapping-state.ts`
- frame 生成呼出: `apps/runtime-player/src/main/model-mapping-bridge-handlers.ts`
- 配信: `apps/runtime-player/src/main/live-parameter-bridge-handlers.ts`
- 適用/評価: `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts`, `.../stage-live-parameter-frame-match.ts`
- エクスポート preset（母音定義）: `packages/package-format/src/parameter-presets.ts`

## 未解明点 / L0 への質問

1. **母音の入力ソース設計は未確定（要方針）**: iFacialMocap は母音生値を送らない。母音を出すには (a) jawOpen + mouthPucker/mouthFunnel/mouthStretch/mouthSmile 等から「あいうえお」を合成する規則を写像層に実装する、(b) 別トラッキング（VMC 等の母音対応プロトコル）を追加する、のいずれかが要る。どちらを想定しているか未調査（本調査は事実確認のみ）。
2. `evaluated-runtime-export-stage-scene.ts`(`createEvaluatedRuntimeExportStageRenderInput` 実体) は本調査で内部未読。「authored parameterId をそのまま適用する」ことは呼出契約（`authoredParameterValues: liveFrame.parameterValues`）から事実だが、母音 parameterId が computed/hidden 扱いで評価器側で無視される可能性は未確認。要すれば追加調査可能。
3. 保存済み mapping プロファイル（`model-mapping-profiles/*`）にユーザが手動で母音スロットを足せる UI 経路があるかは未調査（現状の semanticSlotDefinitions 固定 11 スロットから、UI も母音を出さないと推測）。
