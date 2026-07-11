# C5 Domain B 実装報告: 契約 `intent.envelope` additive + dispatch + 参照ドライバ拡張 + 持続駆動テスト

> Gnome (実装) → Orch-Sylph。ブランチ `feature/2d-rigging-eco-system`、未コミット（作業ツリーに残置）。前提 Domain A も未コミットで同ツリーに存在。
> 規範: [c5-wave-plan.md](../../orchestration/c5-wave-plan.md) §3/§6 Domain B/§8/§9・[c5-composition-and-envelopes.md](../../../architecture/c5-composition-and-envelopes.md) §2/§7-4・[c5-planning-inventory.md](../../orchestration/c5-planning-inventory.md) §2.5/§2.6/§4・[domain-a-report.md](domain-a-report.md)（前提の実物）。

## 1. 作成 / 変更ファイル

**新規**
- `apps/runtime-player/src/main/control-channel/contract/channel-intent-envelope-payload-schema.json` — `intent.envelope` の payload schema（`channel-intent-set-payload-schema.json` を雛形に。slotId enum・peak・attack/sustain/decay(minimum 0)・normalizedRanges）。**命名注意**: C4 外殻封筒 `channel-envelope-schema.json`（メッセージ封筒）とは別概念で同語。C5 payload は本ファイル名で分離。

**変更（source, Domain B）**
- `contract/channel-protocol-contract.ts` — `runtimePlayerControlChannelSupportedKinds` に `"intent.envelope"` 追加（→ hello が自動告知）。新型 `RuntimePlayerControlChannelIntentEnvelopePayload = { slotId, peak, attackMs, sustainMs, decayMs }`。拒否列挙は無変更。
- `contract/channel-envelope-schema.json` — `supportedKinds` を `["intent.set","intent.envelope"]` に。kind/payload の description を両 kind 言及に更新。`rejectionCodes` は無変更。
- `contract/channel-exchange-examples.json` — happyPath の server.hello を 2 kind に。新 `envelopePath` セクション（intent.envelope 送信 → accepted のやり取り例）を追加。rejections は無変更。
- `channel-intent-validation.ts` — 新関数 `validateControlChannelIntentEnvelope`（`validateControlChannelIntentSet` を踏襲）+ `parseIntentEnvelopePayload` / `parseDurationMs`。既存 set 関数・`parseTtlMs`・`isMappingSlotId`・`isSlotWritable`・`isRecord` は無変更で共用。
- `channel-request-dispatch.ts` — 新型 `ControlChannelEnvelopeWrite`。`ControlChannelRequestDispatch` に `envelope?` を additive 追加（`overlay?` と併存）。`dispatchControlChannelRequest` を kind で分岐（`dispatchIntentSet` / `dispatchIntentEnvelope` に抽出、set 経路は挙動不変）。
- `channel-server.ts` — `#handleClientMessage` に envelope 分岐: `this.#overlayStore.setEnvelope(slotId, spec, this.#nowMs())` + accepted イベント（`value = peak`）。set の setOverlay 経路は無変更。

**変更（test, Domain B）**
- `contract/channel-protocol-contract.test.ts` — envelope schema の slotId enum / normalizedRanges の byte-sync 検証・hello 2 kind 検証・envelopePath 例の parse/accepted 検証を追加。set 検証は既存のまま。
- `channel-intent-validation.test.ts` — `validateControlChannelIntentEnvelope` の describe 一式（下記 §3 のマッピング全網羅）。set の describe は無変更。
- `channel-request-dispatch.test.ts` — envelope accepted→envelope write（overlay 無）・envelope 拒否コード・not accepting 時 channelClosed を追加。set は無変更。
- `channel-server.test.ts` — hello 2 kind に更新。envelope end-to-end（WS→accepted→store に曲線が立つ: mid-attack 中間値 + sustain で peak）を追加。set 系は無変更。
- `channel-server-events.test.ts` — envelope accepted イベント（`value = peak`）を追加。
- `reference-driver-sustained-drive.test.ts` — `intentCount`/`acceptedCount`/`rttMs.count` を 8→11。SCENARIO_SLOTS に head-vertical/body-x を追加。envelope 観測（body-x peak・head-vertical peak・中間値・release後 base 復帰）を追加。

**変更（特区 `apps/soul`, シナリオ拡張のみ）**
- `apps/soul/reference-driver/reference-driver.mjs` — `sendEnvelope(intent)`（kind `intent.envelope`, RTT 相関流用）。`envelopePhase`（3 envelope, 下記 §5）を接続1の切断直前に追加。`scenarioSlotIds` に envelope slot を含め自己照合。`expectedKinds`（contract-json / fallback とも）に `intent.envelope` を追加。**package.json・依存は追加せず**（readFileSync の契約読取のみ、憲章 §6.2）。

## 2. 契約 additive の要点

- **新 kind**: `runtimePlayerControlChannelSupportedKinds = ["intent.set","intent.envelope"]`。hello は `createControlChannelServerHello` が同定数を載せるため**自動で 2 kind 告知**（メッセージ層は無変更）。
- **byte-sync**: `channel-protocol-contract.test.ts` が (a) envelope schema slotId enum == 語彙 == set schema enum、(b) envelope schema normalizedRanges == set schema == TS 分類器、(c) hello == `["intent.set","intent.envelope"]` == happyPath 例、(d) envelopePath 例の request parse + accepted builder 一致、を検証。schema/型/examples の三者同期を機械化。
- **intent.set 不変の証拠（additive 実証）**:
  - set の payload schema (`channel-intent-set-payload-schema.json`)・型 `RuntimePlayerControlChannelIntentSetPayload`・rejections 例は**一切変更なし**（git diff で該当ファイル無変更）。
  - set の validation (`validateControlChannelIntentSet`)・dispatch（`dispatchIntentSet` に抽出したが外形不変、既存 dispatch テスト 6 件が無変更で通過）は挙動不変。
  - 既存の `supportedKinds === ["intent.set"]` を固定していたアサーション（contract test / channel-server test）は**設計どおりの additive 拡張として** 2 kind へ更新（退行でなく育成、§7-1 の裁定命名規律・inventory §2.5 準拠）。
  - 古い魂（set のみ送る経路）は不変: hello は上位互換で 2 kind を告げるだけ、set の request/validation/write は byte-identical。参照ドライバの旧 4 相（set）は無変更で全 accepted（§6 テストで実証）。

## 3. validation の拒否マッピング（既存列挙のみ・新コード不在）

`validateControlChannelIntentEnvelope` は既存 6 コードのみ使用（`channel-protocol-contract.ts:49-56` 無変更）:

| 不正入力 | 既存コード | 根拠 |
|---|---|---|
| 非オブジェクト payload / slotId 欠落・非文字列・空 | `invalidPayload` | set の `parseIntentSetPayload` と同型 |
| peak 非number / 非有限 | `invalidPayload` | set の `value` 形チェックと同型（**符号は不問**、下記§8） |
| attack/sustain/decay 非number / 非有限 / **負値** | `invalidPayload` | `parseTtlMs` の `value<=0→invalid` 前例を duration に一般化（`parseDurationMs`: `value<0→null`） |
| 生存ゼロ（attack+sustain+decay=0） | `invalidPayload` | envelope 固有の不正を既存コードに畳む（裁定4）。新コード不要 |
| slotId が語彙外 | `unknownSlot` | `isMappingSlotId`（`runtimePlayerMappingSlotIds`） |
| peak が正規化域外（クランプ禁止） | `slotValueOutOfRange` | `semanticSlotNormalizedRange(definition.sourceKind)` |
| slot 書込不可 / モデル未ロード | `slotNotWritable` | `isSlotWritable` |

**新コード追加ゼロ**（裁定4 遵守）。生存ゼロも既存 `invalidPayload` に問題なく畳めた（escalate 不要）。

## 4. dispatch / server 配線

- dispatch: `isSupportedKind` 後、`envelope.kind === "intent.envelope"` なら `dispatchIntentEnvelope`（validation→`envelope: { slotId, spec:{peak,attackMs,sustainMs,decayMs} }`）、それ以外 `dispatchIntentSet`（従来の `overlay` write）。envelope write は**絶対時刻を持たない**（startAtMs はサーバが渡す設計。overlay の `expiresAtMs` 計算とは非対称だが、これは曲線 store が自時計を持つ設計に整合）。
- server: envelope write のとき `this.#overlayStore.setEnvelope(slotId, spec, this.#nowMs())`（受理時刻=startAtMs）。accepted イベントは `value = spec.peak`（診断表示用）。set の setOverlay 経路・accepted(`value`) は無変更。
- 縦の貫通は `channel-server.test.ts` の envelope e2e（accepted → store に mid-attack 中間値 + sustain で peak）と持続駆動テスト（下記§6）で実証。

## 5. 参照ドライバ拡張の振り付け（人間ゲート §7 の証人）

接続1（注視→傾げ→沈黙→再開）の**後・意図的切断の直前**に `envelopePhase`（3 envelope、時間圧縮 `phaseScale` 準拠）を追加。旧 4 相（set）は維持し additive 共存を実証:

| envelope | slotId / peak / attack・sustain・decay | 人間ゲート §7 の目玉 |
|---|---|---|
| ① 表情ピーク | `head-vertical` peak 0.6 / 60·120·90ms | **目玉②**: 滑らかに立ち上がり・保持・減衰 |
| ② 重ねがけ | `head-vertical` peak **-0.3**（符号反転）/ 60·120·90ms | **目玉③**: 同一スロットへ連続 envelope（現在値からの re-attack の連続性。負 peak で centered 双方向を実証） |
| ③ body 持続駆動 | `body-x` peak 0.5 / 60·**400**·90ms（長 sustain） | Stage/decay 観察用の持続駆動。切断時にまだ生存 |

**目玉④ 魂殺し**: ③ の直後に接続1を意図的 close（`first.close()`）→ body-x envelope が**生存中に切断** → サーバ `releaseAll`（Domain A）で全スロット同時 release → 呼吸だけが残る。持続駆動テストが release 中間値と base 復帰を観測。

`expectedKinds` を 2 kind にし、hello が両 kind を告知することを自己照合（`connect()` の capabilities 照合）。envelope slot（head-vertical/body-x）も `scenarioSlotIds` で契約語彙自己照合に含めた。

## 6. 持続駆動テストの更新

- **件数**: 旧 8（set: gaze2+tilt2+resume2+reconnect2）+ 新 3（envelope）= **11**。`intentCount`/`acceptedCount`/`rttMs.count` を 11 に更新（全 accepted = 域内値のみ送る前提を維持）。理由: envelope 相 3 本の追加。
- **envelope 観測**（既存 `head-horizontal>=5` 縦貫通の envelope 版を追加）:
  - `body-x` (peak 0.5→+15) が長 sustain で `ParamBodyX>=5` のフレームを多数生成（envelope ピークがフレームに出た）。
  - `head-vertical` (peak 0.6→+18) も `|ParamAngleY|>=5` に到達（表情ピーク貫通）。
  - `body-x` が 0<値<14 の中間フレームを持つ（attack ramp + mid-kill 後の release ease。**曲線であってスナップでない**証人 = 目玉②/④の機械化）。
  - 切断後 600ms で head-horizontal / body-x / head-vertical が全て base(0) 復帰（release 完了）。
- フレーム停滞なし（sequence 単調増加・>20 前進）・RTT p95<100ms を envelope 込みで維持（テスト pass）。settle delay 600ms は Domain A loop-1 の更新（release 400ms 待ち）を維持。

## 7. テスト結果（pass/fail・既知baseline分離）

Windows/PowerShell、`pnpm install` 不使用・既存 node_modules。
- `npx vitest run -c vitest.config.ts channel-protocol-contract channel-intent-validation channel-request-dispatch channel-server` → **58 passed**（contract 12 / validation 25 / dispatch 10 / server 9 / server-events 2）。
- `npx vitest run -c vitest.config.ts reference-driver-sustained-drive` → **1 passed**（外部プロセスの参照ドライバ自己照合 contractSource=contract-json / 11 accepted / RTT p95<100ms を経由）。
- `pnpm run typecheck`（tsc --noEmit）→ **pass**。
- 全 runtime-player `npx vitest run -c vitest.config.ts` → **854 passed / 2 failed / 136 files**。
- `node scripts/check-soul-zone-boundary.mjs` → **passed**（1244 files, 器→魂/魂→器 の code import なし。ドライバ拡張は readFileSync の契約読取のみ）。

**既知baseline fail（Domain B 責任外・分離明記）**: 2 件とも `browser-source` 系 `effectiveDynamicsTuning` schema drift（Wave21）——
- `src/main/broadcast-source/browser-source-server.test.ts`
- `src/stage/browser-source/browser-source-server-message.test.ts`

wave plan §8/委任の「既知baseline=Wave21 browser-source系2件」に一致。当該ファイルは一切触れていない。C3 の `check:source` lint 1 件（vitest には出ない）も既知として触っていない。

## 8. 触っていないことの確認

- **Domain A の store 曲線ロジック**: `control-channel-overlay-store.ts`・`slot-curve-state.ts` は**一切 Edit していない**（store は `setEnvelope`/`snapshot` を**呼ぶ**だけ）。曲線評価・setEnvelope 実装・release/forcedRelease は Domain A のまま。
- `physiology/` 配下・`headless-slot-resolver.ts`・`autonomous-frame-heart.ts` のマージ/retain: 無変更（heart は Domain A の変更のまま。Domain B は heart を触っていない）。
- Runtime Export schema / package-format / Editor ソース: 無変更。
- 拒否コード列挙（`channel-protocol-contract.ts:49-56`）: 無変更（新コードゼロ、裁定4）。
- `pnpm-lock.yaml`: 無変更（`pnpm install` 未実行・回避工作なし）。
- `apps/soul/package.json`: **存在しない**（追加せず、standalone `.mjs` のまま）。
- 実行時 `if (role===…)` 分岐: 新設なし。renderer へ token 以外の秘匿/シード/raw スロットを流していない（accepted イベントの `value` は魂自身が送った peak）。

## 9. 裁量判断 / 質問 / escalate

1. **peak の符号は「域概念」であり parse 失敗ではない（重要な裁量・要確認）**: 委任文 B-2 は「peak/attack/sustain/decay が …**負値** → invalidPayload」と記すが、同 B-2 は別途「peak が正規化域外 → slotValueOutOfRange（`semanticSlotNormalizedRange`）」も要求する。centered slot（head/gaze/body）の域は **-1..1** なので、**負 peak を invalidPayload にすると centered の負域が range check に到達せず、envelope が set より非力になる**（例: head-vertical を下向き=負に envelope できない。目玉②③の表情ピークが片側に潰れる）。両要求を同時に満たせないため、**「負値」は duration（attack/sustain/decay）にのみ適用**し、**peak は非number/非有限のみ parse 拒否・符号を含む域は `slotValueOutOfRange` の担当**、と解釈して実装した（set の `value` と同型・連続性原則3.1 の双方向性・§2 の表現力に整合）。参照ドライバの重ねがけ envelope も負 peak(-0.3)でこれを実証。**この解釈が意図と異なる場合は escalate 対象**（validation の1行 `parseDurationMs` を peak にも掛ければ「peak 負値→invalidPayload」に切替可能。ただし表現力を失う）。
2. **生存ゼロ envelope**: 既存 `invalidPayload` に問題なく畳めた（`attack+sustain+decay<=0` を parse で null 化）。新コード不要・escalate 不要（裁定4 通り）。
3. **envelope write の時刻非対称**: overlay write は `expiresAtMs`（絶対）を dispatch が計算、envelope write は spec のみでサーバが `setEnvelope(…, this.#nowMs())` を渡す。曲線 store が自時計（`#lastNowMs`/明示 startAtMs）を持つ Domain A 設計に整合させた裁量。dispatch の純粋性（絶対時刻を持たない envelope write）はテスト容易。
4. **Channel ページの accepted 表示（スコープ外・観察）**: `channel-page.tsx:187` の `formatEvent` は accepted を `"✓ intent.set …"` と固定表示するため、envelope の accepted も「intent.set」と表示される（accepted イベントに kind を載せていないため）。**退行ではない**（envelope は新規）が、envelope を「intent.set」と表示するのは誤解を招く。**Domain C（Channel ページ配線）の対象**と判断し Domain B では触っていない。Domain C/D で accepted イベントに kind を additive に足すか表示を kind 非依存化するのが妥当（要 Orch-Sylph 判断）。
