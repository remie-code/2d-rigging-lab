# C6 Domain B レビュー(test-adequacy レーン): 契約 `intent.speech` + validation + fixture + 参照ドライバ

> レビュア: Review-Sylph(test-adequacy レーン)。Orch-Sylph からのサブエージェント委任。2026-07-12。
> レーン焦点: validation 全拒否ケースの検証十分性 / byte-sync・dispatch・server・ドライバ配線テストの十分性 / 実行結果の裏取り / C4/C5 無退行と既知baselineの分類。
> 判定基準: `../../orchestration/c6-wave-plan.md`(§6・§8・§10)、裏取り対象 `../../waves/c6/domain-b-report.md`。

## 判定: **合格**(要修正なし。非blockingの軽微な指摘1件)

Gnome 報告 §3〜§5 の主張は、自分で読んだテスト本文と自分で実行したスイート/typecheck/check スクリプトの生結果と**すべて一致**した。validation の全拒否ケースは実際に検証されており、アサーションは甘くない(happy-path は `toStrictEqual`、拒否は具体コードで固定)。byte-sync/dispatch/server/ドライバ配線はいずれも十分。既知baseline(browser-source 2件 + check:source physiology 1件)以外の新規退行・新規違反は無い。

## 1. テスト実行の生結果(自分で実行)

- `pnpm run test:unit`(runtime-player): **137 files passed / 2 failed、904 tests passed / 2 failed**(全906)。Duration 13.78s。→ 報告 §4 の「904 passed / 2 failed」と一致。
  - 失敗2件(全FAIL行を列挙・照合):
    1. `src/main/broadcast-source/browser-source-server.test.ts > … serves current Runtime Export payload …`
    2. `src/stage/browser-source/browser-source-server-message.test.ts > readBrowserSourceRuntimeExportResponse > accepts the not-loaded response shape`
    - 両者とも差分は `+ "effectiveDynamicsTuning": null`(browser-source 系・`effectiveDynamicsTuning` 由来)。**control-channel と無関係・無変更**。→ 既知baseline分類は正しい。**control-channel 側の失敗はゼロ**。
- `pnpm run typecheck`(runtime-player): **exit 0、エラー0**。→ 報告 §4 と一致。
- `pnpm run check:source`(root, check-source-organization.mjs): exit 1。違反は**唯一** `apps/runtime-player/src/main/physiology/index.ts: index.ts must remain a barrel-only entrypoint`。→ 既知 C3 baseline の1件のみ。control-channel の新規違反なし。
- `node scripts/check-soul-zone-boundary.mjs`: **exit 0**(1248 files scanned、器→魂 import 無し・魂→器 code import 無し)。ドライバ拡張は依存ゼロ .mjs のまま。
- `pnpm install` は**未実行**(不要だった)。

**本ドメイン affected 5ファイルの内訳(ログ実測)**: contract 16 / validation 41 / dispatch 13 / server 10 / speech-driver 1 = **81 tests 全 pass**。報告 §4 と一致。

## 2. 観点別のテスト十分性評価

### 観点1: validation 全拒否ケース網羅(`channel-intent-validation.test.ts` `describe("validateControlChannelIntentSpeech")`)
実装(`channel-intent-validation.ts` `parseIntentSpeechTimeline`)と突き合わせ、全ケースが**実際に検証**され甘くないことを確認:

| 観点の要求ケース | テスト箇所 | 期待コード | 甘さ判定 |
|---|---|---|---|
| 空配列 | L414-423(`[]` を含む) | invalidPayload | ○ 配列に `[]` 明示 |
| 非配列 | L414-423(`"nope",3,null,undefined,{}`) | invalidPayload | ○ |
| 非record要素 | L425-432(2要素目 `"mora"`) | invalidPayload | ○ |
| timeMs 非有限 | L434-443(NaN,+Inf,"0",null) | invalidPayload | ○ |
| timeMs 負 | L434-443(-1) | invalidPayload | ○ |
| timeMs **非単調** | L445-472(=前=拒否 と 減少=拒否 の**両方**) | invalidPayload | ○ 両分岐を固定 |
| 未知vowel | L474-483("x","A","",0,null,"aa") | invalidPayload | ○ 大文字/空/非文字/複数字まで |
| s 非有限 | L485-494(NaN,+Inf,"0.5",null) | invalidPayload | ○ 形不正として分離 |
| s 域外(0..1外) | L496-505(1.5,-0.1) | **slotValueOutOfRange** | ○ 形不正と別コード |
| s 境界 0/1 | L507-519 | ok | ○ クランプ無し境界受理 |
| 6スロットいずれか非writable | L521-532(mouth-vowel-u 欠) / L534-544(mouth-open disabled) / L546-553(null) | **slotNotWritable** | ○ 3経路 |
| happy-path | L361-368 | ok + 検証済モーラ列 | ○ `toStrictEqual({ok:true, moras:validTimeline})` |
| **512ちょうど ok / 513 拒否** | L379-401(const `runtimePlayerControlChannelSpeechMaxTimelineLength` と `+1`) | at cap→ok / over→invalidPayload | ○ 境界を実定数で駆動。ハードコード512でなく契約定数参照=同期漏れに強い |

→ **境界(512 ちょうど/超過)・非単調(=前・減少の両方)を含め全ケース網羅、アサーションはトートロジーでない。**十分。

### 観点2: チェック順序
- **形不正 > 域不正**: L555-569 で「非単調 timeMs **かつ** s域外(1.5)」の同時不正に対し `invalidPayload` が返る(域不正コードに勝つ)ことを固定。実装(parse→s域→writable)と整合。**十分。**
- 軽微な指摘(非blocking): **域不正 > writable** の順序を固定するテストは無い(s域外 かつ group非writable のケースで `slotValueOutOfRange` が返ることの明示なし)。実装は parse→range→writable の順で明確だが、range と writable を入れ替える改変は現行テストで捕捉されない。両者とも拒否経路であり深刻度は低いため**非blocking**。将来 §2 の順序全体を固定したいなら1ケース追加を推奨。

### 観点3: byte-sync(`channel-protocol-contract.test.ts`)
- vowel enum ↔ `runtimePlayerControlChannelSpeechVowels`(L64-68)。
- maxItems=512 ↔ `runtimePlayerControlChannelSpeechMaxTimelineLength`、minItems=1(L70-77)。
- normalizedRanges: schema の `{"mouth-vowel": …}` ↔ `semanticSlotNormalizedRange("mouth-vowel")`、**かつ per-item s の minimum/maximum も同域**(L242-255)。
- supportedKinds 3 kind化: envelope schema 同期(L33)+ hello builder が `["intent.set","intent.envelope","intent.speech"]`(L79-91)。
- speechPath worked example を parse(L101-103)+ accepted reply が builder と一致(L134-169、15モーラ・o×5・単調・s∈0..1 も検証)。
→ TS↔JSON の乖離・supportedKinds 未更新を確実に拾う。**十分。**

### 観点4: dispatch/server 配線
- dispatch(`channel-request-dispatch.test.ts` L244-318): accept→`speech:{moras}`(`toStrictEqual`、golden)/ empty→invalidPayload / s域外→slotValueOutOfRange / group非writable→slotNotWritable / channelClosed(not accepting、kind-agnostic)。speech が overlay/envelope フィールドに**乗らない**ことも明示(L260-261)。unknownKind は kind-agnostic(L82-92 で intent.wave が担保)。
- server(`channel-server.test.ts` L174-218): WS 経由 accept→`store.setSpeech` 配線を実証。startAtMs=server nowMs、mid-timeline で mouth-open 駆動(0<x≤1)、かつ **凸恒等 Σ(5母音)=mouth-open が wiring 越しに保存**(`toBeCloseTo(mouthOpen, 9)`)。hello 3 kind化(L89)・unknownKind 後も接続維持(L220-257)・切断 releaseAll(L267-297)も維持。
→ **十分。**(凸恒等そのものの全tick性質テストは Domain A の担当だが、server レーンでも wiring 越しの保存を1点で確認しており配線レベルでは適切。)

### 観点5: ドライバ発話シナリオ(`reference-driver-speech-timeline.test.ts`)
- `--scenario=speech --print-timeline` を `child_process.spawn` で dry-run(**器→魂 import 無し**、既存 sustained-drive/perceptual と同じ spawn 前例)。
- 検証: exit 0 / scenario="speech" / 1節・kind="intent.speech"・slotId=null / **15モーラ**・母音列が fixture(o,e,i,a,i,o,o,o,o,o,u,a,e,u,o)と `toStrictEqual` / 「のところど」= idx5..9 の o×5 / timeMs 単調増加 / s∈0.5..0.9。
→ fixtureモーラ列の射影を正しく検証。**十分。**

### 観点6: C4/C5 無退行(additive 実証)
- 既存 intent.set(validation L52-184)/intent.envelope(L186-341)の validation・dispatch(L94-231)・byte-sync(L44-62, L233-240)テストは無変更で全通過。
- **持続駆動 `reference-driver-sustained-drive.test.ts`: pass(1809ms)**、**知覚 `reference-driver-perceptual-timeline.test.ts`: pass(278ms)**(いずれも full suite 実測で ✓)。
- server の intent.set overlay 配線・intent.envelope 曲線配線・切断 releaseAll テスト通過。
→ additive であることが実行で裏取れた。**十分。**

### 観点7 / 観点8: 実行裏取り・既知baseline分類
上記 §1 の通り、報告 §4/§5 の数字(904/2、typecheck 0、check:source physiology のみ、check:soul-zone pass)を**すべて再現**。失敗2件の名前・違反1件の名前を列挙照合し、**既知baseline以外の新規 fail / 新規 check 違反が紛れ込んでいないこと**を確認した。

## 3. 甘い/欠落テストの指摘
- (非blocking・軽微)観点2の通り、**range > writable の順序固定テストが無い**。shape > range は固定済み。深刻度低。追加は任意。
- 他に blocking な欠落・甘いアサーションは無し。happy-path/accept 系は `toStrictEqual` で golden 固定、拒否系は具体コードで固定されており、トートロジー化していない。

## 4. 質問
- 特になし。テスト十分性・実行裏取り・無退行分類のいずれも test-adequacy レーンの blocking 観点を満たしている。順序テストの軽微な補強は Orch-Sylph 判断に委ねる(合格判定は変わらない)。
