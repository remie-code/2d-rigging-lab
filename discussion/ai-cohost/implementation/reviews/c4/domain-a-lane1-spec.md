# C4 Domain A レビュー (Lane1: spec突合)

> Review-Sylph → Orch-Sylph。task=`cohost-c4-channel-server-contract`。
> レーン=spec突合(wave-plan §6/§8 + 設計 c4-control-channel-v0 §3〜§8 + UX c4-channel-diagnostics との適合)。design品質・test網羅は他レーン。
> 判定: **合格**(blocking なし。non-blocking 3件・soft question 1件)。

## 0. 検証の土台(自分で確認した事実)

- `git status --short`(セッション実測): 変更は `?? apps/runtime-player/src/main/control-channel/` と `?? discussion/…/waves/c4/` の**未追跡2件のみ**。runtime-player 配下に modified tracked ファイルは**ゼロ**。→ Gnome報告の「全て additive・既存無変更」を**実測で確認**(additive extension の前提が成立)。
- slotId enum の正当性: schema `channel-intent-set-payload-schema.json` の slotId enum(16件)= `runtimePlayerMappingSlotIds`(`preload/model-mapping-bridge-contract.ts`)と**要素・順序とも完全一致**。契約テスト L35-39 が `toStrictEqual` で束縛。
- sourceKind 網羅: `semantic-slot-normalized-range.ts` の switch が `SemanticSlotSourceKind`(9種)を default 無しで**網羅**。値域(centered=-1..1 / weight・vowel=0..1)は payload schema の `normalizedRanges` と一致。
- browser-source 採番実測: tracking-default=17308 / autonomous-default=17309(`host-role.ts` L61-68, `browser-source-url.ts`)。チャネル=17310 と非衝突。

## 1. 外殻5点(設計§3) — 適合

| 点 | 実装 | 適合 |
|---|---|---|
| ①token-in-URL接続 | `channel-url.ts`: `ws://127.0.0.1:<port>/channel?token=`。loopback専用・独立モジュール(browser-source url に非結合) | ○ |
| ②要求 `{v,id,kind,payload}` | TS `RuntimePlayerControlChannelRequestEnvelope` / schema `$defs.request`(required 4件・additionalProperties:false) | ○ |
| ③応答 `{v,replyTo,result}(+error)` | TS accepted/rejected union / schema acceptedResponse・rejectedResponse。拒否は `error.code` 列挙付き | ○ |
| ④`server.hello`(capabilities) | `#handleUpgrade` が接続直後に `createControlChannelServerHello()` 送出。protocol+supportedKinds 告知 | ○ |
| ⑤寛容規則(双方向) | 未知kind=`unknownKind` 拒否だが**切断せず**(dispatch L73-83、接続維持)。相関不能封筒=沈黙ドロップ+接続維持 | ○ |

**additive extension の基礎**: 封筒の `kind` は TS で `string`(union に固めていない)。未知kindは parse→dispatch で拒否され封筒は不変。新kindは `supportedKinds` と payload schema の追加のみで既存を壊さない。設計§2「後から載せる基礎」を正しく体現。**三者同期**(TS union / envelope schema top-level `rejectionCodes`+`rejectedResponse.error.code.enum` / exchange examples 6例)を目視照合し一致、契約テスト(`channel-protocol-contract.test.ts`)が `toStrictEqual` で機械束縛。

## 2. 拒否列挙の網羅(blocking観点) — 適合

- 6コード `unknownKind`/`invalidPayload`/`unknownSlot`/`slotValueOutOfRange`/`slotNotWritable`/`channelClosed` が **TS `runtimePlayerControlChannelRejectionCodes` / schema 2箇所 / exchange examples 6例** で完全一致(設計§3.3列挙と一致)。
- **拒否はクランプしない**が守られている: `channel-intent-validation.ts` L70-80 は `semanticSlotNormalizedRange` の域を読み、範囲外を **丸めず** `slotValueOutOfRange` で拒否。`semantic-slot-normalized-range.ts` の doc-comment が「resolver は clamp するが channel はしない・resolver 本体は未接触」を明言(設計意図と一致)。exchange example の note も「1.5 is out of range and is NOT clamped」。
- 決定層の分離が設計どおり: `unknownKind`/`channelClosed` は dispatch 層、`invalidPayload`/`unknownSlot`/`slotValueOutOfRange`/`slotNotWritable` は validation 層。

## 3. TTL統一(設計§4) — 適合

- `ttlMs` 省略可(payload schema `required:["slotId","value"]`、`exclusiveMinimum:0`)。省略時 `defaultWindowMs`(=1000ms)適用。
- **expiresAtMs は受理時に確定**: `channel-request-dispatch.ts` L101-108 で `receivedAtMs + (ttlMs ?? defaultWindowMs)` を dispatch(=受理点)で固定。overlay store は絶対壁時計を受け取るだけ(時刻源フリー)。設計§4「受信時刻+TTL」に一致。
- **切断→全失効の土台**: `close()` と `#handleClientClose` の双方で `overlayStore.clearAll()`(設計§4「送りが止まれば落ちる」の基礎)。
- 明示ttl/既定窓が**同一契約上の使い分け**(payload の ttlMs 有無だけの差)になっている(設計§4b/c)。exchange examples happyPath が両スタイルを1例ずつ収録。
- `defaultWindowMs=1000` は server option で上書き可(Domain B/テスト差替え可能)。値の妥当性は妥当(§4 意味論=サブ秒ゆらぎ吸収+~1s基底復帰)。

## 4. hello capabilities(設計§3.4) — 適合

接続直後に `{v:1, kind:"server.hello", payload:{protocol:1, supportedKinds:["intent.set"]}}` を送出。契約テスト L41-50 が builder=schema=example 一致を束縛。id を持たない(サーバ起点で相関不要)のは正しい。

## 5. 手動開閉(設計§3.1・UX§1) — 適合

- 初期状態 `#state = { kind:"closed" }`。**コンストラクタは listen しない**(自動start無し)。`open()` 明示呼び出しで初めて listen(設計§3.1「手動開放」・UX§1「起動時は常にClosed」に一致)。
- 状態機械 Closed / Open(listening,port) / Connected(port,protocolVersion) が UX§1 の三段(Closed / Open — no client / Connected(protocol版))と一致。`getState()`/`onStateChanged()` を Domain C 観測用に露出。
- `close()` は client 切断・overlay clearAll・server.close を順に実施し Closed へ。open() は idempotent(`#server!==null` で早期return)。

## 6. port/token採番(裁定3) — 適合

- チャネル既定 `runtimePlayerControlChannelDefaultPort=17310`(`channel-slot-ports.ts`)。`runtimePlayerDefaultSlotChannelPorts` は **autonomous-default のみ**に 17310 を持たせ、**tracking-default は持たない**(裁定2「トラッキングホストにチャネル不在」を record 構造で表現)。
- 17310 は browser-source(17308/17309)と**別record・独立const**(offset導出に非結合)。doc-comment が明言。
- `channel-config-store.ts` は browser-source config と**別ファイル**(`channel/channel-config.json`)・**別token**(`createControlChannelToken()`)・schemaVersion 独立。custom自律スロットは `createPreferredPort` seam 経由で `findFreeLoopbackPort` を注入可能(手動ポート禁止の規律維持)。スロット独立(slot userData 配下)。

## 7. fixture=純JSON(設計§8・裁定8) — 適合

`contract/*.json`(envelope schema / intent-set payload schema / exchange examples)はいずれも純JSON。**TS漏れなし**(contract.ts の TS型は「正の写像」で、契約の正はJSON側)。物理配置は器側 `control-channel/contract/`(Gnome §9-4 が特区import経路確定時の昇格を裁定8で繰延、と明記)。本waveでは器側配置で spec 上問題なし。

## 8. スコープ遵守 — 適合

Domain B(heart統合・TTL網羅・Recordマージ)、C(bridge/Channelページ/token秘匿露出)、D(特区/参照ドライバ)へは**踏み込んでいない**。overlay store は set/clearAll/snapshot の基本のみ、server は getState/onStateChanged/getCurrentSlots seam を用意して配線を後続に委譲。境界の未実装は §5/§9 で明示(逆にDomain Aで作るべきものの欠落なし)。

## 9. 裁量判断10件(Gnome §8)の spec評価

| # | 裁量 | spec評価 |
|---|---|---|
| 1 | transport核=複製 | 是認。wave-plan §A-2 が明示許容。browser-source 完全隔離は additive維持に資する(spec中立) |
| 2 | defaultWindowMs=1000 | 是認。§4「既定窓」の実装裁量。値は妥当 |
| 3 | 拒否コード=6件確定 | 是認。§3.3「等・実装時確定」を設計列挙どおり6で閉じた |
| 4 | 相関不能封筒=沈黙ドロップ | 是認。reply に replyTo(=id)必須ゆえ捏造不可。§3.5 の妥当解釈 |
| 5 | channelClosed=accepting:false 単体網羅 | 是認。dispatch を socket-free にした決定核設計で決定論網羅 |
| 6 | 複数接続許容+いずれ切断で clearAll | **soft question**(下記)。v0単一ドライバ前提では許容だが意味論の穴あり |
| 7 | 値域閉区間受理/expiry厳密境界 | 是認。「範囲内=受理」で妥当。expiresAtMs ちょうどで失効も一貫 |
| 8 | 17310 独立const | 是認。裁定3どおり |
| 9 | snapshot 未失効のみ・削除しない | 是認。Domain B が失効の正を所有(§5明示)。16スロットで有界 |
| 10 | connected に protocolVersion | 是認。§A-2/UX§1「protocol版数つき」に適合 |

## 10. 差分

### blocking
なし。

### non-blocking
1. **exchange-examples の note 残骸**: `channel-exchange-examples.json` happyPath L23 の note が「Turn the head toward **face.angle.x**」だが、実際の payload slotId は `head-horizontal`。設計§3.2/§5 の例示語彙 `face.angle.x`(実語彙は意味スロット)がドキュメント note に残ったもの。実装(payload)は正しく実語彙を使用しており**契約は正しい**。純JSON fixture を魂が読む§8性格上、note の実語彙化が望ましい。修正指針: note を `head-horizontal` 表記に統一。
2. **request 封筒の `v` 未検証**: `parseControlChannelRequestEnvelope`(`channel-protocol-messages.ts`)は入力の `v` を検査せず常に `1` を stamp(`v` 欠落・`v:2` でも v1 扱いで受理)。envelope schema の request は `v:{const:1}` required と宣言しており、パーサはこれより寛容。v0 は version 1 のみ存在しバージョン不整合の拒否コードが契約に無いため spec違反ではないが、schema 宣言との厳密性ギャップ。修正指針(任意): v の const:1 チェックを加えるか、schema 側で「v0 はバージョンを検査せず tolerant」と注記して意図を明文化。
3. **UX§1 mockup の face.angle.x 表示**: UX doc 側(実装対象外)も face.angle.x のまま。Domain C の Live overlays/Recent Events 実装時に実語彙へ揃うべき旨、C への引き継ぎに載せると親切(Domain A の責務外)。

## 11. soft question(Orch/ユーザー判断が要る点)

- **裁量#6(複数接続時の clearAll 意味論)**: 現状は複数接続を許容し、**いずれか1接続の切断で全 overlay を clearAll**。v0=単一参照ドライバ前提では設計§4「切断→全失効」に沿い問題ないが、仮に2魂が同時接続した場合、片方の切断でもう片方が書いた overlay も消える。設計は複数駆動を想定していない(§7 は単一疑似魂)ので v0 スコープでは許容と判断したが、Domain C の配線で「単一接続のみ許可(2本目を拒否)」に締めるか、複数接続を明示的にサポート外として据え置くか、方針をOrchかCで確定しておくと将来の穴を塞げる。**本wave合格を妨げない**。

## 12. 判定

**合格**。外殻5点・拒否列挙(クランプせず拒否・三者同期)・TTL統一(受理時確定・切断clearAll)・hello・手動開閉(自動start無し)・port/token採番(裁定2/3)・fixture純JSON・スコープ、すべて仕様適合。blocking差分なし。non-blocking 3件は fixture note の実語彙化(推奨)と v検証ギャップの明文化(任意)で、いずれも契約の正しさを損なわない。soft question 1件は複数接続 clearAll 意味論の将来方針で、後続ドメインで確定すればよい。
