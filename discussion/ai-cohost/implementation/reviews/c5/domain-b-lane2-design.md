# C5 Domain B レビュー (lane2: design/development)

> Review-Sylph → Orch-Sylph。対象=契約 `intent.envelope` additive + validation + dispatch + server 配線 + 参照ドライバ拡張。ブランチ `feature/2d-rigging-eco-system` 未コミット（Domain A+B 混在ツリー）。読み取り専任・自分で git diff / テスト実行。
> 規範: [c5-composition-and-envelopes.md](../../../architecture/c5-composition-and-envelopes.md) §2/§6/§7-4・[c5-planning-inventory.md](../../orchestration/c5-planning-inventory.md) §2.5/§2.6・[c5-wave-plan.md](../../orchestration/c5-wave-plan.md) §6 Domain B/§8。実装報告 [domain-b-report.md](../../waves/c5/domain-b-report.md)（クロスチェック用・鵜呑みにせず）。

## 判定: **合格**

design/development レーンの blocking 観点（validation 健全性・peak 符号設計・dispatch 分岐・server 配線・型安全・参照ドライバ堅牢性・C6 前方互換・命名規律）はすべて満たされている。要修正なし。非 blocking の観察 3 件を末尾に記す。

---

## design 適合（観点別・根拠つき）

### 1. validation の健全性 — 適合
`validateControlChannelIntentEnvelope`（`channel-intent-validation.ts:181-244`）は `validateControlChannelIntentSet`（同 :50-96）の 4 段ゲート（parse→unknownSlot→slotValueOutOfRange→slotNotWritable）を忠実に踏襲。`isMappingSlotId`/`findSemanticSlotDefinition`/`semanticSlotNormalizedRange`/`isSlotWritable`/`isRecord` を無変更で共用（新コード不在）。

- **`parseDurationMs`（:298-303）の `parseTtlMs`（:129-139）からの意図的乖離が正しい**: `parseTtlMs` は `value <= 0` を invalid（TTL 0 = 即時失効で無意味）。`parseDurationMs` は `value < 0` を null（**単一 duration の 0 は正当** — attack=0 の瞬間立ち上がりや decay=0）。総生存は別途 `attackMs+sustainMs+decayMs <= 0`（:283-285）で invalidPayload 化。三つとも非負保証済みなので `<= 0` は実質 `=== 0`（防御的で無害）。**クランプ無し**（parse は null 返しのみ、値の書き換えなし）。
- 非 number/非有限 peak・duration は parse で拒否（:270-272, :302）。生存ゼロは既存 `invalidPayload` に畳む（裁定4 遵守、新コードゼロ）。`channel-protocol-contract.ts:49-56` の rejection 列挙は git diff で無変更を確認。
- peak 範囲チェック（:239）は set（:72）と同型: `peak < range.min || peak > range.max`。**境界は両端 inclusive**（peak=±1・範囲端は accepted）で set と一致。

### 2. peak 符号の設計整合（重点） — 適合。設計判断は妥当で、維持すべき
委任文 B-2 は「peak 負値→invalidPayload」と「peak 域外→slotValueOutOfRange」を**同時に要求しており内部矛盾**する（centered slot の域は -1..1 なので負 peak は域内=正当）。Gnome はこの矛盾を正しく識別し、**peak の符号を parse から除外し `slotValueOutOfRange` に委ねる**方向で解決（報告§9-1）。これは design 上健全:

- **set の `value` と完全同型**: `parseIntentSetPayload`（:113）も符号を問わず finite のみ検査し、負値は range check（min=-1）に委ねる。peak はこの前例を写経しているだけで、set との一貫性が保たれる。
- **centered slot の双方向性を保存**: head/gaze/body の負域 envelope（例: head-vertical 下向き）が生き、§2 の表現力・連続性原則 3.1 の双方向性が損なわれない。参照ドライバの重ねがけ envelope（`reference-driver.mjs:135` peak **-0.3**）がこれを実駆動で実証。
- **weight/vowel slot（0..1）では負 peak が `slotValueOutOfRange` で正しく拒否**される（負 < min=0）。つまり「符号を無検査にした」のではなく、「域の担当に一本化した」だけ。
- 報告§9-1 は「意図と異なれば escalate 対象」と正しく旗を立てているが、**この解決が正解**であり反転（peak 負値→invalidPayload）すべきではない。反転は centered の片側を潰し set より非力な envelope を生む。委任文の文言矛盾側を修正すべき。

### 3. dispatch 分岐の設計 — 適合
- `ControlChannelRequestDispatch` の `envelope?`（`channel-request-dispatch.ts:57`）は `overlay?`（:56）と additive 併存。一つの dispatch は set→overlay / envelope→envelope の**排他的にどちらか一方のみ**を返す（`dispatchIntentSet`/`dispatchIntentEnvelope`）ため衝突なし。reject は両方とも不在。
- set 経路は `dispatchIntentSet`（:110-146）へ抽出されたが**外形不変**（引数名 id/payload 化のみ、ロジック byte 等価）。既存 set dispatch テスト・set validation テストが無変更で通過（58 passed に含む）。
- envelope write が絶対時刻を持たず server が startAtMs を渡す非対称（報告§9-3）は妥当: envelope spec は相対時間のみ（peak/attack/sustain/decay）で、store が自時計で曲線を描く Domain A 設計に整合。overlay write の `expiresAtMs`（絶対）と非対称だが、これは「set は失効時刻を dispatch が確定、envelope は曲線 store が受理時刻を anchor」という設計差の正しい反映。dispatch は絶対時刻を持たずテスト容易。

### 4. server 配線 — 適合
- `setEnvelope(dispatch.envelope.slotId, dispatch.envelope.spec, this.#nowMs())`（`channel-server.ts:305-309`）: 第3引数 startAtMs = 受理時刻 = `#nowMs()`。store 側 `setEnvelope(slotId, spec, startAtMs)`（`control-channel-overlay-store.ts:103-117`）のシグネチャと一致。store は `startValue = #effectiveStart(slotId)`（案B の現在実効値）で re-attack 起点を確定するので、server が渡すのは startAtMs のみで正しい。
- accepted イベント `value = spec.peak`（:313）は診断用途で妥当: set の `value = overlay.value`（:301、ターゲット値）と同義（曲線のターゲット値）。
- set の setOverlay 経路・accepted（value）は無変更（:293-302）。
- 補足: `clearAll`→`releaseAll` 差し替え（:196, :332）は Domain A 責務だが、Domain B の server は正しく `releaseAll(this.#nowMs())` を呼んでおり配線として整合（切断→全スロット同時 release, §2.3）。

### 5. 型安全 — 適合
- `exactOptionalPropertyTypes: true`（`apps/runtime-player/tsconfig.json` / ルート `tsconfig.json`）下で `pnpm run typecheck` **pass**。`envelope?`/`overlay?` の additive optional は、dispatch 返却オブジェクトが `undefined` を明示的に載せず「キーごと存在/不在」で分岐するため exactOptional と両立。
- `ControlChannelEnvelopeWrite.spec`（:44-49）は構造的に `RuntimePlayerControlChannelEnvelopeSpec`（store :39-44）と一致し、server の受け渡しが型整合（typecheck 実証）。
- 新型 `RuntimePlayerControlChannelIntentEnvelopePayload`（`channel-protocol-contract.ts:139-145`）と JSON schema の齟齬なし（下記 byte-sync が機械保証）。

### 6. 参照ドライバの堅牢性 — 適合
- `sendEnvelope`（`reference-driver.mjs:404-427`）は `sendIntent`（:388-402 付近）と同水準: 同一 `pending` map・`replyTo` 相関・`t0=performance.now()` RTT 計測・`withTimeout` を流用。エラー処理（reject 経路）も共通の pending 機構で同等。
- `.mjs` **依存ゼロ維持**: git diff に import 追加なし。契約 JSON は `readFileSync`（`loadContract`）読取のみで import ではない。`node scripts/check-soul-zone-boundary.mjs` **pass**（1244 files, 器→魂/魂→器 code import なし）。
- `expectedKinds` を contract-json（happyPath hello supportedKinds）と fallback の双方で 2 kind に更新（:287-291, :305）、hello の両 kind 告知を capabilities 自己照合（:379-384）。envelope slot（head-vertical/body-x）も `scenarioSlotIds` で語彙自己照合（:151-160）。

### 7. C6 前方互換（§6） — 適合
envelope 契約は「1 スロット当たりの曲線 spec（peak/attack/sustain/decay）」という素直な形で、C6「タイムスタンプ付きエンベロープ断片列」を将来 additive に載せる妨げがない。C5 が `intent.set` の上に `intent.envelope` を additive に足したのと同じ型で、C6 は新 kind（例 `intent.timeline`）を additive に足せる。過度な特殊化（時刻列を今の payload に押し込む等）はなく、`slot-curve-state` が C6 再利用の曲線基盤（設計§6）として温存されている。

### 8. 命名規律・コード品質 — 適合
- 封筒 envelope（`channel-envelope-schema.json` = C4 メッセージ外殻）と アニメ envelope（`channel-intent-envelope-payload-schema.json` = C5 曲線）の分離が、新 schema 名・schema description・TS 型 doc コメント（`channel-protocol-contract.ts:127-138`）の三箇所で明示。契約 kind `intent.envelope` は Accepted 済みで不変。内部曲線側は `slot-curve-state`/`SlotCurveState`（curve 系）。
- 重複なし（validation/dispatch とも set の抽出・写経で DRY）。エラーメッセージは範囲・slotId を含み診断的。

---

## byte-sync の機械保証（design lane の要・drift 防止）

`channel-protocol-contract.test.ts`（12 tests pass）が additive の主張を機械強制:
- envelope schema `slotId.enum` == `runtimePlayerMappingSlotIds`（レジストリ）
- envelope schema `slotId.enum` == set schema `slotId.enum`（同一語彙・byte 一致）
- envelope schema `normalizedRanges` == set schema `normalizedRanges`（peak が value と同域を共有）
- hello `supportedKinds` == `["intent.set","intent.envelope"]` == happyPath 例
- `envelopePath` worked exchange の request parse + accepted builder 一致

→ 「peak は value の域を共有」「同一語彙」という設計主張が将来の drift に対して機械保証されている。design lane 的に強い。

---

## 差分・要修正

**なし**（blocking / 要修正いずれも該当なし）。

## 非 blocking の観察（記録のみ・修正不要）

- **Obs-1（命名の軽い緊張）**: dispatch の `ControlChannelEnvelopeWrite` と store の `setEnvelope`/`RuntimePlayerControlChannelEnvelopeSpec` は「envelope」をアニメ側の意味で用いており、規律「envelope は封筒側に譲る」と軽く擦れる。ただし契約 kind 名 `intent.envelope`（Accepted・不変）を鏡写しにした write/spec 命名であり defensible。内部曲線モジュール本体（slot-curve-state）は curve 系を守っている。修正不要。
- **Obs-2（表示・Domain C スコープ）**: accepted イベントに kind を載せないため、Channel ページ `formatEvent` が envelope の accepted も「intent.set …」と表示する（報告§9-4）。退行ではなく Domain B スコープ外（Domain C/D で accepted に kind を additive に足すか表示を kind 非依存化）。lane2 として blocking でない。
- **Obs-3（driver 自己照合の前提）**: `expectedKinds` の fallback が両 kind を必須化したため、C5 ドライバを C4-only サーバ（intent.set のみ告知）に繋ぐと capabilities 照合が fail する。C5 ドライバ→C5 サーバが前提なので実害なし・許容。

---

## テスト / typecheck 結果（自分で実行）

Windows/PowerShell、`pnpm install` 不使用・既存 node_modules。

- `npx vitest run channel-protocol-contract channel-intent-validation channel-request-dispatch channel-server` → **58 passed**（contract 12 / validation 25 / dispatch 10 / server 9 / server-events 2）。報告§7 と一致。
- `npx vitest run reference-driver-sustained-drive` → **1 passed**（外部プロセス参照ドライバ自己照合・11 accepted・RTT p95 予算経由）。
- `pnpm run typecheck`（tsc --noEmit）→ **pass**（エラー出力なし）。
- `node scripts/check-soul-zone-boundary.mjs` → **passed**（1244 files scanned; 器↔魂 の code import なし）。

（全 runtime-player 走査は未実施だが、報告§7 の「既知baseline fail 2件=Wave21 browser-source系」は Domain B 無関係ファイルであり、対象テスト群では 0 fail を確認済み。）

## 質問

なし。peak 符号設計（重点論点）は上記 §2 のとおり Gnome の解決が正解で、委任文の文言矛盾側を正すべきと判断する。Orch-Sylph 側で「peak 負値→invalidPayload」への反転を検討する余地はなし（表現力を失うため）と明記しておく。
