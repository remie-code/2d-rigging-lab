# C6 Domain B レビュー (spec レーン): 契約 `intent.speech` + validation + fixture + 参照ドライバ

> レビュア: Review-Sylph(spec レーン)。Orch-Sylph からの委任。2026-07-12。
> 判定基準: c6-wave-plan.md §8 AC / §3 責務境界 / §9 Subagent契約 / 設計 §7 裁定4・裁定7。
> スコープ: wave plan AC と絶対条件(Domain B 該当分)への spec 適合。設計思想細部は design レーン、テスト網羅は test-adequacy レーンが担当。

## 判定: **合格(blocking なし)**

縦貫・契約三者同期・512拒否・単調検証・fixture・ドライバ無退行・C4/C5 後方互換・保護対象無変更、spec レーンの blocking 8 観点すべてコードの実体で確認。対象テスト 136 pass(control-channel 全域)、typecheck EXIT 0。要修正なし。

## 観点別の適合(コード位置つき)

### 1. `intent.speech` の縦貫(モーラ列→口が話す) — 適合
供給側から順に繋がっている:
- supportedKinds に `"intent.speech"` 追加(`contract/channel-protocol-contract.ts:34` の const、`channel-envelope-schema.json:7`)。
- validation: `channel-intent-validation.ts` の `validateControlChannelIntentSpeech`(ok 時に検証済み `readonly SpeechMora[]` を返す)。
- dispatch: `channel-request-dispatch.ts` の `intent.speech` 分岐 → `dispatchIntentSpeech` → `{ kind:"reply", reply: accepted, speech:{ moras } }`。
- server: `channel-server.ts:318` `else if (dispatch.speech !== undefined)` で `this.#overlayStore.setSpeech(dispatch.speech.moras, this.#nowMs())`。
経路は一本、絶対時刻は server が `nowMs()` で供給(envelope と同型、payload は相対時刻のみ)。`channel-server.test.ts` の speech 配線テストと `control-channel-overlay-store.test.ts` の group 駆動テストが wiring 越しの保存を実証。

### 2. 契約三者同期(schema JSON / TS型 / validation) — 適合
byte-sync test(`contract/channel-protocol-contract.test.ts`)が TS↔JSON を強制:
- vowel enum: `intentSpeechPayloadSchema...vowel.enum` を `runtimePlayerControlChannelSpeechVowels`(`["a","i","u","e","o"]`)と `toStrictEqual`。
- maxItems: schema `512` を const `runtimePlayerControlChannelSpeechMaxTimelineLength` と `toBe`、minItems `1` も pin。
- s 域: schema の `normalizedRanges` と per-item `s.minimum/maximum` を `semanticSlotNormalizedRange("mouth-vowel")`(0..1)と `toStrictEqual`。
TS型 `RuntimePlayerControlChannelIntentSpeechPayload` の timeline 要素 `{timeMs, vowel, s}` と schema `required`/`additionalProperties:false` が一致。validation は同じ const/range を参照(`channel-intent-validation.ts` の import)。三者一致。

### 3. 上限512拒否(拒否語彙の不増殖・裁定4) — 適合
`parseIntentSpeechTimeline` で `timeline.length > runtimePlayerControlChannelSpeechMaxTimelineLength` → `null` → 呼び出し側で `invalidPayload`。**クランプ/切詰めなし**(`return null`)。`channel-envelope-schema.json` の `rejectionCodes` 配列は無変更(diff は description のみ)、contract TS の RejectionCode 定義も無変更 = **新 rejection code を足していない**。テスト: 「at 512 は ok / 513 は invalidPayload」を実証(validation.test.ts:379)。

### 4. 時刻単調検証・各拒否コード対応 — 適合
`parseIntentSpeechTimeline` で `timeMs <= previousTimeMs`(前要素以下)を `null`(=invalidPayload)。空配列/非配列/非record モーラ/非有限 timeMs/未知 vowel/非有限 s も invalidPayload。s 有限だが域外 → `slotValueOutOfRange`(`semanticSlotNormalizedRange` 流用、クランプなし)。6口グループ非writable → `slotNotWritable`(payload に slotId 無し=固定6スロット group 形、unknownSlot 経路なし)。**チェック順序**=形 parse → s 域 → writable、precedence テスト(validation.test.ts:555「shape beats range」)が形不正の優先を実証。単調違反(≤前・減少両方)テスト有り(:445)。妥当。

### 5. fixtureフレーズ「これじっさいのところどうなってるの」 — 適合
契約 examples `channel-exchange-examples.json` の `speechPath` に 15 モーラ payload が載る。母音列 `o,e,i,a,i, o,o,o,o,o, u,a,e,u,o`、idx 5..9 = **o×5 連続(「のところど」)** を byte-sync test(:131)が `toStrictEqual(["o","o","o","o","o"])` で pin。timeMs 単調・s 0..1 も検証。同一値が参照ドライバ `speechTimelineMoras()` と一致(手写し golden)。促音「っ」省略は設計 §7 裁定7 の想定内。

### 6. 参照ドライバ発話シナリオ・無退行 — 適合
- `--scenario=speech` 追加(`parseScenarioFlag` に speech 分岐、値不正は既定 compressed に倒す=既存挙動不変)。`buildTimeline` は if/else 化したが perceptual/compressed の節列生成は無変更。`runSpeechScenario`/`sendSpeech`/`speechTimelineMoras`/`speechSections` は additive。
- 依存ゼロ .mjs 維持: `readFileSync` のみ、`apps/soul` に package.json 不在(下記 8 で確認)。
- 既存の compressed(引数なし spawn)・perceptual シナリオ: `reference-driver-sustained-drive.test.ts`(1 pass)・`reference-driver-perceptual-timeline.test.ts`(1 pass)が無変更で通過。`--print-timeline` は URL 検査より前(reference-driver.mjs:101-103)で exit 0 = 発話 dry-run テストの前提を既存構造が満たす。fallback expectedKinds に intent.speech 追加(hello 不読時の告知整合)。

### 7. C4/C5 後方互換(additive 実証) — 適合
- byte-sync: 既存 intent.set / intent.envelope の schema・enum・normalizedRanges 同期テスト無変更通過。envelope schema diff は description 追記と supportedKinds 追加のみ、既存 enum/範囲は byte-identical。
- validation/dispatch: 既存 set/envelope validator(41 assertion群・dispatch 13)無変更で通過。dispatch は speech 分岐を先頭に追加するが kind は排他文字列のため既存分岐に影響なし。
- server: intent.set overlay 配線・intent.envelope 曲線配線・切断 releaseAll テスト無変更通過。hello の supportedKinds hardcode のみ 3 kind へ(告知の additive 増加の反映)。
- control-channel 136 tests 全 pass(C4/C5 の compressed/perceptual/sustained-drive/envelope/set 含む)。

### 8. 保護対象・規約 — 適合
- **Domain A store 無改変**: server/validation/dispatch は `store.setSpeech(...)` を**呼ぶだけ**。`control-channel-overlay-store.ts` の `setSpeech`/`snapshot` マージ/`#yieldSpeechForSlot`/`#forceReleaseSpeech`(後着置換調停)は Domain A 実装で、B の3ファイル(validation/dispatch/server)からストア内部への到達はゼロ。B の唯一の A への接触点は `setSpeech(moras, nowMs())` の呼び出し1行(channel-server.ts:319)で、これは想定インターフェース。`speech-timeline-state.ts` も Domain A、B は型/const を import するのみ。
- 実行時 role 分岐の新設なし(dispatch は kind 分岐、role 分岐ではない)。
- rejectionCodes 無変更(新拒否語彙ゼロ)。event 型無変更(既存 `{kind:"accepted", slotId, value}` 再利用)。

## 裁量判断への評価
- 促音「っ」省略(§6-1)・fixture の timeMs/s 手書き値(§6-2): 設計 §7 裁定7 の範囲内、fixture 著者判断として妥当。golden 化(examples/driver/byte-sync 三点一致)されており drift 検知が効く。
- slotId-less payload とドライバ契約自己照合 N/A(§6-3): speech は母音ラベル→固定口グループ(器内)のため slotId 語彙照合は不要、kind 照合は connect() の hello 機構が担う。既存機構で表現でき escalate 不要 — 妥当。
- accepted event の代表値(§6-4): slotId="mouth-open"(anchor)+ value=先頭モーラ s(pre-scale, client 送信の実値)。event 型を変えぬ最小 additive の診断表現で、spec 違反なし。**参考所見**: value は s の pre-scale 値(器が 0.8 縮小前)であり「口の実効開き」ではないが、これは診断ログ上の値の意味づけであって縦貫・契約の正しさには無関係。blocking ではない。

## blocking の有無
**なし。** spec レーンの要修正事項ゼロ。

## 検証実行ログ
- `npx vitest run src/main/control-channel/` → **136 tests / 14 files 全 pass**(contract 16 / validation 41 / dispatch 13 / server 10 / speech-driver 1 / store 26 / speech-state 12 / 既存 compressed・perceptual・sustained-drive 含む)。
- `npx tsc --noEmit`(runtime-player) → **EXIT 0**。
- 新 rejection code なし(envelope schema rejectionCodes・contract TS RejectionCode いずれも diff で無変更を確認)。

## 質問(呼び出し元 Orch-Sylph へ)
- なし。Domain B の spec 適合は完結。
- 留保(spec レーン範囲外・参考): A と B は共に未コミットのため、`git diff` で「A の store 変更」と「B の変更」を機械的に分離できない。本レビューは**ファイル所有(store/speech-timeline-state = Domain A、validation/dispatch/server/driver/contract = Domain B)と接触点の一意性**でB が A store 内部を改変していないと判定した。Domain A の store ロジック自体の正しさ(凸恒等・後着置換・release 数学)は Domain A の 3 レビューの領分。
