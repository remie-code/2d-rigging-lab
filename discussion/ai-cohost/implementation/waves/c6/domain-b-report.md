# C6 Domain B 完了報告: 契約 `intent.speech` + validation + fixture + 参照ドライバ発話シナリオ (`cohost-c6-speech-contract-driver`)

> 実装者: Gnome(Orch-Sylph からのサブエージェント委任)。2026-07-12。
> スコープ: 契約 `intent.speech`(可変長モーラ列 payload)の additive 追加・validation・dispatch・server 配線・契約 examples・byte-sync test・fixture音素列・参照ドライバ発話シナリオ。
> ⚠️ Domain A の `speech-timeline-state.ts` 評価ロジック・store の `setSpeech`/`snapshot`/後着置換調停は **無変更**(呼ぶのみ)。

## 1. 作成/変更ファイル一覧(絶対パス)

**新規**:
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\control-channel\contract\channel-intent-speech-payload-schema.json` — speech payload schema(timeline 配列・vowel enum・s 域 0..1・maxItems 512・minItems 1・additionalProperties:false・normalizedRanges)。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\control-channel\reference-driver-speech-timeline.test.ts` — ドライバ発話シナリオの --print-timeline dry-run 検証(spawn 前例、器→魂 import 無し)。

**変更(additive)**:
- `...\contract\channel-protocol-contract.ts` — supportedKinds に `"intent.speech"` 追加 / TS型 `RuntimePlayerControlChannelIntentSpeechPayload` / vowel const `runtimePlayerControlChannelSpeechVowels` + 型 / cap const `runtimePlayerControlChannelSpeechMaxTimelineLength = 512`。
- `...\contract\channel-envelope-schema.json` — supportedKinds に `"intent.speech"` 追加 + kind/payload description 追記。
- `...\contract\channel-exchange-examples.json` — hello supportedKinds を3 kind化 + `speechPath` happy-path 例(fixtureモーラ列15個)追加。
- `...\channel-intent-validation.ts` — `validateControlChannelIntentSpeech` + helper(`parseIntentSpeechTimeline`/`isSpeechVowel`/`speechMouthGroupWritable`)。
- `...\channel-request-dispatch.ts` — `ControlChannelSpeechWrite` 型 / dispatch reply に `speech?` / `intent.speech` 分岐 + `dispatchIntentSpeech`。
- `...\channel-server.ts` — `#handleClientMessage` に `dispatch.speech → store.setSpeech(moras, this.#nowMs())` の1分岐 + accepted event(anchor slot = mouth-open, value = 先頭モーラ s)。import `RUNTIME_PLAYER_SPEECH_MOUTH_OPEN_SLOT`。
- `...\contract\channel-protocol-contract.test.ts` — speech payload schema の byte-sync(vowel enum / maxItems / minItems / normalizedRanges / s域)・hello 3 kind化・speechPath worked exchange 検証・全 worked example parse に speechPath 追加。
- `...\channel-intent-validation.test.ts` — `validateControlChannelIntentSpeech` describe(23 assertion群)。
- `...\channel-request-dispatch.test.ts` — intent.speech accept→speech write / 各拒否コード / channelClosed(kind-agnostic)。
- `...\channel-server.test.ts` — hello 3 kind化 / `startOpenServer` に getCurrentSlots override / speech 配線テスト(setSpeech→group駆動+凸恒等がwiring越しに保存)。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\soul\reference-driver\reference-driver.mjs` — `sendSpeech(timeline)` / `speechTimelineMoras()` / `speechSections()` / `--scenario=speech`(parseScenarioFlag) / buildTimeline speech節 / `runSpeechScenario` / fallback expectedKinds に intent.speech。**依存ゼロ .mjs 維持(readFileSync のみ、package.json 不在)**。

## 2. 要旨

### 契約 `intent.speech`(additive)
- **TS型**: `RuntimePlayerControlChannelIntentSpeechPayload = { readonly timeline: readonly { timeMs:number; vowel:"a"|"i"|"u"|"e"|"o"; s:number }[] }`。契約層は wire 自己完結(魂は JSON のみ読む)のため vowel enum/512 cap を契約 const として持ち、byte-sync test の TS 正として使う。validation/dispatch は Domain A の `SpeechMora` 型に橋渡し(構造同一なので clean)。
- **schema**: `channel-intent-speech-payload-schema.json`。envelope schema の流儀(title/description/NOTE 命名注意/additionalProperties:false/normalizedRanges)を踏襲。`timeline`(minItems 1・maxItems 512)、各要素 {timeMs(minimum 0)・vowel(enum a/i/u/e/o)・s(0..1)}。
- **exchange examples**: `speechPath` に fixtureフレーズ payload を1つ(§下記)。

### validation(既存 pre-gate 規律・新 rejection code 不増)
`validateControlChannelIntentSpeech` は set/envelope validator と同型。ok 時は **検証済み `readonly SpeechMora[]`**(Domain A 型)を返す。

### dispatch + server 配線
- dispatch: `intent.speech` 分岐 → `dispatchIntentSpeech` → validation ok なら `{ speech: { moras } }`。`ControlChannelSpeechWrite = { readonly moras: readonly SpeechMora[] }`。envelope 版と同型(絶対時刻を持たず、startAtMs は server が供給)。
- server: `dispatch.speech !== undefined` の1分岐で `store.setSpeech(dispatch.speech.moras, this.#nowMs())`。**store 側 setSpeech 実装は Domain A のもので無変更**。accepted event は既存 `{kind:"accepted", slotId, value}` shape を再利用(event 型は無変更 = 最小 additive): slotId = "mouth-open"(グループ anchor)、value = 先頭モーラ s(client が送った実 0..1 値)。

### fixture音素列「これじっさいのところどうなってるの」
採用母音列(15モーラ、促音「っ」= **省略**): `o,e,i,a,i, o,o,o,o,o, u,a,e,u,o`。「のところど」= idx 5..9 の o×5 連続(再調音ディップの試金石)。timeMs(手書き、単調増加、〜110〜130ms 間隔)/ s(手書き、器の s縮小前 0.5〜0.9):

| idx | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| vowel | o | e | i | a | i | o | o | o | o | o | u | a | e | u | o |
| timeMs | 0 | 120 | 250 | 380 | 510 | 630 | 740 | 850 | 960 | 1070 | 1190 | 1320 | 1450 | 1580 | 1700 |
| s | .6 | .7 | .5 | .85 | .55 | .7 | .65 | .7 | .65 | .7 | .6 | .8 | .7 | .55 | .6 |

同一値を契約 examples(`speechPath`)と参照ドライバ `speechTimelineMoras()` に手写しで固定(golden)。

### ドライバ拡張
`--scenario=speech` を additive に追加。`sendSpeech({v:1,id,kind:"intent.speech",payload:{timeline}})`(RTT/replyTo 相関流用)。`runSpeechScenario` は connect → sendSpeech → 発話尺+600ms 観測 → close(終端 release で口が閉じる)。**圧縮/知覚シナリオの実行経路・出力・exit code は不変**(手動確認済み)。契約自己照合: hello の supportedKinds に intent.speech(connect() の既存 kind 照合が担う)。

## 3. validation 拒否コード対応表

| 不正 | コード |
|---|---|
| payload 非record | `invalidPayload` |
| `timeline` 非配列 | `invalidPayload` |
| `timeline` **空配列** | `invalidPayload` |
| `timeline` 長 **> 512**(超過) | `invalidPayload`(裁定4 に畳む・クランプ/切詰め禁止) |
| モーラ要素 非record | `invalidPayload` |
| `timeMs` 非有限 / 負 / **単調増加でない(≤前要素)** | `invalidPayload` |
| `vowel` が a/i/u/e/o 外(未知ラベル) | `invalidPayload` |
| `s` 非有限(形不正) | `invalidPayload` |
| `s` **域外(mouth-vowel 0..1 外の有限値)** | `slotValueOutOfRange`(`semanticSlotNormalizedRange("mouth-vowel")` 流用・クランプ禁止) |
| 6口グループスロット(`mouth-open`+`mouth-vowel-a/i/u/e/o`)の**いずれか非writable** | `slotNotWritable`(payload に slotId 無し=固定6スロットの group 形。unknownSlot 経路は無し) |

- **チェック順序**: 形 parse(invalidPayload)→ s 域(slotValueOutOfRange)→ 6スロット writable(slotNotWritable)。形不正は域不正に優先(テストで実証)。
- 512上限=`invalidPayload`、単調違反/空配列/未知vowel=`invalidPayload`、s域外=`slotValueOutOfRange`、6スロット writable=`slotNotWritable`。**既存語彙のみで表現でき、新 rejection code は不要だった**(escalate 不要)。

## 4. テスト結果

- **対象テスト(本ドメイン affected 5ファイル)**: `pnpm exec vitest run` → **81 tests 全 pass**(contract 16 / validation 41 / dispatch 13 / server 10 / speech-driver 1)。
- **全体スイート** `pnpm run test:unit`: **137 files passed / 2 failed**、**904 tests passed / 2 failed**。
  - 既知 baseline fail 2件 = `src/main/broadcast-source/browser-source-server.test.ts` と `src/stage/browser-source/browser-source-server-message.test.ts`(**browser-source 系・`effectiveDynamicsTuning` 由来。Domain A 報告 §4 が実装前 baseline として記録済み。control-channel と無関係・無変更**)。
  - Domain A 時点 881(879+2) → 906(904+2)。**+25 tests(本ドメイン追加分)**。
- **typecheck** `pnpm run typecheck`: **pass**(0 error)。
- **check:source**(`scripts/check-source-organization.mjs`): 唯一の違反 = `apps/runtime-player/src/main/physiology/index.ts`(barrel-only)。**これは既知 C3 baseline の1件で control-channel と無関係。新規違反は足していない**。
- **check:soul-zone**(`scripts/check-soul-zone-boundary.mjs`): **pass**(1248 files scanned、器→魂 import 無し・魂→器 code import 無し)。ドライバ拡張は依存ゼロ .mjs のまま。
- **既知 baseline 分類明示(触らない)**: browser-source 系2件 + check:source の C3既存1件(physiology/index.ts)。

## 5. C4/C5 無退行の実証(additive)

- **byte-sync**: 既存の intent.set / intent.envelope の supportedKinds・payload schema・normalizedRanges 同期テストは無変更で通過(speech は additive に追加、既存 enum/範囲は byte-identical のまま)。
- **validation/dispatch**: 既存 `validateControlChannelIntentSet`/`validateControlChannelIntentEnvelope`(41-13 の既存分)無変更通過。intent.set/intent.envelope の accept/reject 経路は無変更。
- **server**: intent.set overlay 配線・intent.envelope 曲線配線・切断 releaseAll テスト無変更通過(hello の supportedKinds hardcode のみ 3 kind へ更新=告知が additive に増えた事実の反映)。
- **圧縮/知覚シナリオ・持続駆動**: `reference-driver-sustained-drive.test.ts`(引数なし spawn=compressed)・`reference-driver-perceptual-timeline.test.ts`(--scenario=perceptual --print-timeline)は無変更で通過(full suite に含まれ pass)。手動でも compressed/perceptual の --print-timeline 出力と speech 無URL の exit 2 を確認済み(実行経路・出力・exit code 不変)。

## 6. 裁量判断

1. **促音「っ」= 省略**(母音を持たないため)。task の目安母音列(15モーラ)と一致し最も明快。fixture 著者判断として省略を採用(保持だと直前母音の重複でモーラ数が増え、フレーズ意図の「全母音+o×5」の試金石性は変わらないが、省略の方が単純)。
2. **fixture の timeMs / s 具体値**: 手書き(設計§7)。timeMs は 110〜130ms 間隔で単調増加、s は 0.5〜0.9(器の s縮小前基準)。§2 の表に固定し golden 化。
3. **参照ドライバ契約自己照合と slotId-less payload**: speech payload は slotId を持たない。ドライバの **slotId 語彙照合は speech では N/A**(母音ラベル→固定口グループは器内マッピング)。**kind 照合(hello に intent.speech)は connect() の既存機構がそのまま担う**ため、既存機構で speech を表現でき **escalate 不要**。runSpeechScenario は slotId 照合を実行しない(compressed/perceptual の slotId 照合経路は不変)。
4. **accepted event の代表値**: event 型を変えず(最小 additive)、slotId="mouth-open"(グループ anchor・常時駆動)+ value=先頭モーラ s(client が実際に送った 0..1 値)を診断値に。Recent Events ログに speech 受理を偽りなく surface。
5. **s域外 vs 形不正の切り分け**: envelope の peak と同型に、`s` 非有限=形不正(invalidPayload)、`s` 域外(有限だが 0..1 外)=`slotValueOutOfRange`。既存 pre-gate 規律を踏襲。

## 7. escalate / 質問

- **escalate なし**。設計裁定(§7 裁定4=512/invalidPayload・裁定7=フレーズ)・棚卸し(§2.5)の想定通り、既存拒否語彙(invalidPayload / slotValueOutOfRange / slotNotWritable)で全ケースを畳めた。新 rejection code 不要。可変長 payload / 512上限 / 単調検証も既存 pre-gate の延長で表現でき、Escalate 条件「既存拒否語彙で表現できないケース」は不発生。
- **質問**: 特になし。fixture の timeMs/s は手書き裁量(§6-2)で確定。人間ゲート(二体並置・「のところど」観察・終端 release)は Domain C / ユーザー実演の領分。

## 8. 規約遵守の自己申告

- `pnpm install` **不使用**(手動symlink・独自resolver・tsconfig paths 迂回等の回避工作も無し)。**依存追加なし**。
- **`apps/soul` に package.json・依存を置いていない**。reference-driver.mjs は依存ゼロ .mjs のまま拡張(readFileSync のみ)。zone boundary check pass。
- **Domain A 実装無変更**: `speech-timeline-state.ts` の評価ロジック・store の `setSpeech`/`snapshot`/後着置換調停は呼ぶのみ(1文字も変更していない)。
- **保護対象無変更**: physiology/・`headless-slot-resolver.ts`・心臓 `autonomous-frame-heart.ts`/`input-subsystem.ts` の merge seam/cadence・Runtime Export schema・package-format・Editor・lockfile。
- 実行時 `if (role === ...)` 等の**ロール分岐を新設していない**。
- **拒否コード(rejection code)を新規追加していない**(invalidPayload/slotValueOutOfRange/slotNotWritable に畳んだ)。
- 無関係な既存差分の revert **なし**。想定外に広い共有ファイル変更なし(event 型は変えず既存 shape を再利用)。
