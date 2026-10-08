# C6 Domain B レビュー(design レーン): 契約 `intent.speech` + validation + fixture + 参照ドライバ

> レビュア: Review-Sylph(design レーン・読み取り専任)。2026-07-12。Orch-Sylph からの委任。
> 焦点: additive 契約規律・byte-sync 契約-of-record・pre-gate validation 規律・拒否語彙不増殖(裁定4)・命名規律・fixtureモーラ列の設計忠実性・zone boundary。
> AC 充足(spec)・テスト網羅(test-adequacy)は別レーン担当。

## 判定: **合格(PASS)**

blocking なし。全8観点で設計規律に忠実。非blocking の推奨1件(golden 二重コピーの drift-guard)を末尾に記す。裏取りとして byte-sync/validation/driver テスト58件を自分で実行し全 pass を確認。

---

## 観点別 適合

### 1. additive 契約規律 — 適合
- `channel-envelope-schema.json` の diff は純加算(`git diff HEAD~1` で確認): `supportedKinds` に `"intent.speech"` 追記 + kind/payload/description 文言更新のみ。`$defs`(request/response/hello shape)・`rejectionCodes`(6件)は不変。C5 の `intent.envelope` 追加と同型。
- `channel-protocol-contract.ts`: 削除行は doc コメントと const 配列内の `"intent.envelope"` 行のみ(→ `"intent.envelope",` + `"intent.speech"` へ展開)。既存 TS型/enum の改変ゼロ。
- 既存 payload schema の byte-identical は**テストで強制**: `channel-protocol-contract.test.ts:58-62`(envelope slotId enum == set)、`:233-240`(envelope normalizedRanges == set)。intent.set/intent.envelope の schema・enum・normalizedRanges は一切触られていない。

### 2. byte-sync 契約-of-record 規律 — 適合
- 新 payload schema JSON と TS const の byte-sync がテストで強制(`channel-protocol-contract.test.ts`):
  - `:64-68` vowel enum ↔ `runtimePlayerControlChannelSpeechVowels`
  - `:70-77` maxItems ↔ `runtimePlayerControlChannelSpeechMaxTimelineLength`(512)+ minItems==1
  - `:242-255` normalizedRanges.mouth-vowel ↔ `semanticSlotNormalizedRange("mouth-vowel")` + per-item s bounds(minimum/maximum)== 同域
- 魂は JSON のみ読む前提を維持: wire payload は `{timeline:[{timeMs,vowel,s}]}` で TS 固有物(型名・const)は wire に漏れない。vowel は**ラベル**で slotId を wire に載せない(器内マッピング)。

### 3. pre-gate validation 規律 — 適合
- `validateControlChannelIntentSpeech`(`channel-intent-validation.ts:351-387`)は set/envelope validator と同型: 形 parse→ s 域 → group writable の三段。silently drop を explicit reject に反転・クランプしない規律を踏襲。
- s 切り分けが envelope の peak と**同型**: `s` 非有限 = 形不正(`invalidPayload`, `parseIntentSpeechTimeline:434`)、`s` 有限だが域外 = `slotValueOutOfRange`(`:366-375`, `semanticSlotNormalizedRange("mouth-vowel")` 流用・クランプなし)。envelope の peak(`:279` 非有限=parse失敗 / `:230` 域外=slotValueOutOfRange)と一致。

### 4. 拒否語彙の不増殖(裁定4) — 適合
- 512超過・空配列・単調違反(`timeMs <= previousTimeMs`)・未知vowel を**すべて `invalidPayload` に畳む**(`parseIntentSpeechTimeline:408-413, 422-436`)。切詰め/クランプなし。
- 6スロット group writable は `slotNotWritable`(`:378-384`)。payload に slotId が無い=固定6スロットの group 形なので `unknownSlot` 経路は無い(妥当)。
- `rejectionCodes` enum は6件のまま不変(envelope schema `rejectionCodes` / contract.ts `runtimePlayerControlChannelRejectionCodes` / rejectedResponse.code.enum、いずれも byte-sync test で相互固定 `:36-41`)。**新 rejection code ゼロ**。裁定4 の忠実な延長。

### 5. 知識の置き場(§2 モーラ契約の思想) — 適合
- 音素→母音写像を器に持ち込んでいない。vowel は5母音**ラベル**として受け、器が固定口グループへ写す(schema description・contract.ts:150-166 の NOTE・validation コメントで明記)。器は言語中立=一拍一母音の列を受けるだけ。
- fixtureモーラ列(音素→母音の写像**結果**)は参照ドライバ/examples に「作成例」として置かれるのみ(設計§6 で明示許容)。写像**ロジック**は器に無い。

### 6. fixtureモーラ列の設計忠実性(裁定7) — 適合
- 母音読みの妥当性: 「これじっさいのところどうなってるの」= こ・れ・じ・[っ]・さ・い・の・と・こ・ろ・ど・う・な・[っ]・て・る・の → `o,e,i,a,i,o,o,o,o,o,u,a,e,u,o`(15モーラ)。促音「っ」2箇所(じっ/なっ)を省略。報告§6-1「促音省略」は両occurrence への一貫適用で正しい。省略は母音を持たない子音要素の合理的処理。
- 「のところど」= idx5..9 が **o×5連続**として正しく現れる(の-と-こ-ろ-ど)。再調音ディップの試金石として妥当。
- 全5母音を含む(a:3,11 / i:2,4 / u:10,13 / e:1,12 / o:多数)。
- timeMs 単調増加(0..1700, ~110-130ms 間隔)。s は 0.5〜0.9 で器の s縮小前基準として妥当。
- **golden 一致**: examples(`channel-exchange-examples.json` speechPath)と参照ドライバ `speechTimelineMoras()` の15エントリを timeMs/vowel/s まで**バイト単位で照合し完全一致**を確認。

### 7. 命名規律 — 適合
- 新 identifier は speech/timeline 系(`RuntimePlayerControlChannelIntentSpeechPayload`・`...SpeechVowels`・`...SpeechMaxTimelineLength`・`validateControlChannelIntentSpeech`・`ControlChannelSpeechWrite`)。curve/envelope と衝突なし。
- C4「封筒 envelope」/C5「曲線 envelope」との混同注意を踏襲: contract.ts:192-195 と speech schema description に `NOTE — name collision` を明記(「speech timeline は GROUP mouth timeline で、C5 per-slot animation envelope とも C4 message 封筒とも別概念」)。棚卸し§4末尾の連鎖注意に応答済み。

### 8. zone boundary(依存ゼロ .mjs) — 適合
- `reference-driver.mjs` 拡張は `readFileSync` のみ(契約JSON読み)。器→魂の code import なし。`sendSpeech` は socket 送信のみ。package.json/依存追加なし(diff にゼロ)。
- `check-soul-zone-boundary.mjs` は**無変更**(`git diff HEAD~1` 空)。報告§4 の check:soul-zone pass(1248 files)と整合。
- driver テスト `reference-driver-speech-timeline.test.ts` は `child_process.spawn` 前例に倣い import 回避(`:11-16` で方向ルール明記)。zone 越え read/spawn のみで違反なし。

---

## 裁量判断への評価

- **促音省略**(報告§6-1): 妥当。母音を持たない要素の自然な扱いで、母音列が task 目安と一致。
- **s域外 vs 形不正の切り分け**(§6-5): envelope peak と同型で規律的に正しい。
- **accepted event の代表値**(§6-4): event 型を変えず slotId="mouth-open"(group anchor)+value=先頭モーラ s。最小 additive で診断値を偽りなく surface。妥当。
- **slotId-less payload の契約自己照合 N/A**(§6-3): speech は母音ラベル→固定口グループなので slotId 語彙照合は不要、kind 照合は connect() の hello 側が担う。escalate 不要の判断は正しい。
- **monotonicity が schema でなく validation**: JSON Schema はモーラ間の単調性を静的表現できないため、schema=shape(minimum:0)+ validation=cross-element 制約(`timeMs <= previousTimeMs` 拒否)の分担。envelope の zero-life 検証(validation-only)と同じ前例で一貫。schema description に単調要件を明記済み。適合。

## blocking の有無
**なし。**

## 非blocking の推奨(裁量・任意)
- **golden 二重コピーの drift-guard 不在**: fixtureモーラ列は examples JSON と driver.mjs の2箇所に手写しで固定され、現状バイト一致を確認済み。ただし両者を**厳密等価で突き合わせる自動テストは無い**。contract test は examples 側の invariant(長さ/o×5/単調/s∈0..1)を、driver test は driver 側の invariant(母音列/o×5/単調/s∈0.5..0.9)を各々検証するのみで、片方の値だけを変えた drift(例: examples の s=0.85→0.8)は捕捉されない。zone boundary 上、driver テスト(器zone)は examples JSON を `readFileSync` し、spawn で得た driver timeline と厳密比較でき、boundary を破らず drift-guard を追加可能。現状は正しく同期しているため blocking ではないが、golden の「固定」を機械的に保証したいなら将来の小追撃候補。

## 質問
- なし。設計裁定(§7 裁定4/裁定7)・棚卸し(§2.5)の想定通りに畳めており、design レーンの規律逸脱は検出されなかった。
