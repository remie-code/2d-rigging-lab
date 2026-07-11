# C4 Domain A 実装報告: 契約の家 + チャネルWSサーバ + 拒否列挙 + port/token採番

> Gnome(実装担当)→ Orch-Sylph。task=`cohost-c4-channel-server-contract`。
> 全成果物は **新規追加ファイルのみ**(既存トラッキング/ファイルの変更ゼロ)。`apps/runtime-player/src/main/control-channel/` 配下に閉じている。

## 1. 作成/変更ファイル一覧

**変更した既存ファイル: なし**(全て additive。`git status --short` で確認、`apps/runtime-player/` 配下の modified tracked ファイルはゼロ)。

新規ファイル(すべて `apps/runtime-player/src/main/control-channel/` 配下):

### A-1 契約の家 (`contract/`)
- `contract/channel-protocol-contract.ts` — 封筒/reply/hello/intent.set payload の TS型、protocolVersion、supportedKinds、拒否コード union(JSONの正の写像)
- `contract/channel-envelope-schema.json` — 外殻5点の JSON schema(request/acceptedResponse/rejectedResponse/serverHello、protocolVersion・supportedKinds・rejectionCodes を宣言)
- `contract/channel-intent-set-payload-schema.json` — intent.set payload の JSON schema(slotId enum・value・ttlMs・normalizedRanges)
- `contract/channel-exchange-examples.json` — やり取り例(happyPath: connect→hello→intent.set→accepted×2、rejections: 6拒否コード各1例)。**純JSON**。

### A-2 チャネルWSサーバ(transport核は複製・session意味論と手動開閉は新設)
- `channel-websocket-frame.ts` — RFC6455 frame codec(複製、channel-neutral名)
- `channel-websocket-connection.ts` — connection ラッパ(複製、`send(message: unknown)`)
- `channel-token.ts` — token生成/照合(複製)
- `channel-url.ts` — `ws://127.0.0.1:<port>/channel?token=` 構成、bind address、path、token query key
- `channel-server.ts` — `RuntimePlayerControlChannelServer`(手動 open()/close()、Closed/Open/Connected 状態機械、hello送出、request/reply相関、overlay書込、切断→clearAll)+ `runtimePlayerControlChannelDefaultWindowMs`

### A-3 検証層(拒否列挙・resolver手前の前置ゲート)
- `semantic-slot-normalized-range.ts` — sourceKind→正規化域の新規分類器(-1..1 / 0..1)。resolverのclampには相乗りせず、同じ値域source-of-truthを読むだけ
- `channel-intent-validation.ts` — `validateControlChannelIntentSet`(invalidPayload/unknownSlot/slotValueOutOfRange/slotNotWritable)
- `channel-protocol-messages.ts` — envelope parse + hello/accepted/rejected builder
- `channel-request-dispatch.ts` — `dispatchControlChannelRequest`(socket-free 決定核。ignore/channelClosed/unknownKind + validation委譲 + overlay expiresAtMs確定)

### A-4 overlay store 骨格
- `control-channel-overlay-store.ts` — `RuntimePlayerControlChannelOverlayStore`(setOverlay / clearAll / snapshot)

### A-5 port/token 採番拡張
- `channel-slot-ports.ts` — `runtimePlayerControlChannelDefaultPort=17310` + `runtimePlayerDefaultSlotChannelPorts`(autonomous-default→17310 のみ)
- `channel-config-store.ts` — `RuntimePlayerControlChannelConfigStore`(別token・別ファイル `channel/channel-config.json`)

### テスト(9ファイル、focused、決定論)
- `contract/channel-protocol-contract.test.ts`(JSON↔TS同期・拒否コード全網羅の例存在）
- `channel-token.test.ts` / `semantic-slot-normalized-range.test.ts` / `control-channel-overlay-store.test.ts`
- `channel-intent-validation.test.ts`(検証層の全拒否コード)
- `channel-request-dispatch.test.ts`(ignore/channelClosed/unknownKind/accepted+overlay/default窓)
- `channel-config-store.test.ts`(browser-sourceと別file・別token・別port独立)
- `channel-slot-ports.test.ts`(browser-source採番と非衝突)
- `channel-server.test.ts`(closed起動・hello・相関・unknownKind拒否かつ接続維持・bad token拒否・切断→clearAll→open復帰・open/close/reopen)

## 2. transport核: 「複製」を選択(根拠)

**複製**を選んだ。根拠:
- 共有 connection ラッパの `send()` は `RuntimePlayerBrowserSourceServerMessage` に**型で束縛**されている。抽出共有するにはこの型を汎用化する編集が必要で、`browser-source-websocket-connection.ts`・`browser-source-server.ts`・関連テストという**動作中・テスト済みの共有ファイル群**に波及する。
- browser-source系には**既知baseline fail 2件が現存**(§7)。そのfragileな経路を触れば退行判定が困難になる。「無関係な共有ファイルを触る前に報告」「退行させない」の制約を優先。
- 複製対象(frame codec ~140行・connection ~120行・token ~25行)は**request/reply意味論ゼロの純transportで、機械的コピー**。wave plan §A-2 が「小さいので複製するか、構造的に素直な方を選ぶ」と明示的に許容。
- 結果、チャネルは browser-source を1行も編集せず**完全隔離**。将来 neutral module への統合は実物の魂の日のfollow-upとして繰延可能(本waveのスコープ外)。

複製部は挙動byte互換で、名前と `controlChannelMaxClientMessageBytes` 定数のみ channel-scoped。

## 3. 拒否コードの確定完全列挙(6件)

`runtimePlayerControlChannelRejectionCodes`(`contract/channel-protocol-contract.ts`):

| code | 契機 | 決定層 |
|---|---|---|
| `unknownKind` | 封筒 kind が supportedKinds 外 | dispatch(接続維持=§3.5) |
| `invalidPayload` | intent.set payload パース失敗(slotId非文字列・value非有限・ttlMs≤0/非数) | validation |
| `unknownSlot` | slotId が意味スロット語彙外 | validation |
| `slotValueOutOfRange` | value が sourceKind正規化域外(**クランプせず拒否**) | validation |
| `slotNotWritable` | 現auto-mapping slot が enabled+target無し(モデル未ロード=null含む) | validation |
| `channelClosed` | 非受理中(closed/closing)に受信 | dispatch |

schema JSON(`rejectionCodes` と rejectedResponse.error.code.enum)・やり取り例(6例全存在)・TS union の三者を `channel-protocol-contract.test.ts` が同期検証。

**封筒として不成立なメッセージ**(非JSON・id無し・kind無し=相関不能)は拒否コードを付けず**沈黙ドロップ+接続維持**(§3.5 の寛容規則の解釈。replyを捏造しない)。

## 4. defaultWindowMs = 1000ms(根拠)

`runtimePlayerControlChannelDefaultWindowMs = 1000`(`channel-server.ts`)。TTL省略時に `expiresAtMs = receivedAtMs + 1000` を intent受理時に確定。根拠:
- ストリーミングスタイル(魂が自リズムで送り続け途絶=既定窓で失効、§4c)で、サブ秒のメッセージ間隔ゆらぎを吸収できる長さ。
- 実切断ではなく socket維持のままの停滞時に、~1秒で生理基底へ落ちる応答性。
- ハード切断は即 `clearAll` するので、既定窓が効くのは「切断せず送信だけ止まる」停滞ケースのみ。

`defaultWindowMs` は server option で上書き可(Domain B/テストが差し替え可能)。

## 5. overlay store の API(Domain Bが配線する形)

`RuntimePlayerControlChannelOverlayStore`(`control-channel-overlay-store.ts`):
- `setOverlay(slotId: string, value: number, expiresAtMs: number): void` — サーバが intent受理で呼ぶ。expiresAtMs は受理時に確定済みの絶対壁時計。
- `clearAll(): void` — サーバが**クライアント切断**で呼ぶ(切断→全失効の土台)。
- `snapshot(nowMs: number): Record<string, number>` — **未失効分のみ**(`expiresAtMs > nowMs`、失効境界=expiresAtMsちょうどで失効)を `slotId→value` で返す。

**Domain B への配線**: `getChannelOverlay(nowMs) → store.snapshot(nowMs)` として heart tick に接続し、`generator.sample()` 出力へ Recordマージ。TTL失効の網羅(既定窓/明示ttlMs境界)・心臓tick統合・Recordマージ優先・切断→基底復帰の統合テストは **Domain B の担当**なのでここでは作っていない(基本動作 set/clear/snapshot のみテスト)。at most 16スロットで map は自然に有界(同slotId再setは上書き)。

**サーバとの結線**: `RuntimePlayerControlChannelServer` は option `overlayStore` を受け、受理で setOverlay・切断で clearAll を呼ぶ。検証用に option `getCurrentSlots: () => slots | null`(Domain B/Cが autonomous composer の `createAutoMappingSlots(payload)` を渡す)。

## 6. port/token採番の実装形

- **port record**: `runtimePlayerDefaultSlotChannelPorts`(`channel-slot-ports.ts`)= `{ [autonomous-default]: 17310 }`。**tracking-default は持たない**(チャネル=自律専有、裁定2)。`runtimePlayerControlChannelDefaultPort = 17310` は browser-source(17308/17309)と**別record・独立const**(browser-sourceのoffset導出には結合しない)。custom自律スロットは `findFreeLoopbackPort()` 自動採番(config store の async `createPreferredPort` seam経由)。
- **config配置**: `channel/channel-config.json`(slot userData配下)。schemaVersion=`runtime-player-control-channel-config-v1`。browser-source の `browser-source/browser-source-config.json` と**別token・別ファイル**で並列複製。`createControlChannelToken()`(browser-source token を channel専用に改名複製)。
- テストで browser-source と同一slot内で token/port/file が独立し相互汚染しないことを確認。

## 7. テスト結果

- **focused(control-channel)**: `pnpm -C apps/runtime-player exec vitest run -c vitest.config.ts src/main/control-channel`
  → **9 files / 51 tests 全passed**。
- **runtime-player全体**: `pnpm -C apps/runtime-player exec vitest run -c vitest.config.ts`
  → **781 passed / 2 failed(129 files: 127 passed / 2 failed)**。
- **2件の fail は既知baseline(Wave21 browser-source系)**で本実装と無関係:
  1. `src/main/broadcast-source/browser-source-server.test.ts > serves current Runtime Export payload…`
  2. `src/stage/browser-source/browser-source-server-message.test.ts > readBrowserSourceRuntimeExportResponse > accepts the not-loaded response shape`
  両方とも browser-source の `effectiveDynamicsTuning` フィールド不一致で、**私は既存ファイルを1つも変更していない**(全て新規control-channelファイル、他モジュールからは未import)ため因果的に影響不能。
- **typecheck**: `pnpm -C apps/runtime-player run typecheck`(tsc --noEmit)→ **passed**。
- **check:deps**: passed(新規依存なし)。
- **check:source**: 唯一の違反は `apps/runtime-player/src/main/physiology/index.ts`(**C3の既存committed済みファイル、私は未接触・index.ts未作成**)。control-channel の私のファイルは違反ゼロ。
- **lockfile/workspace**: `pnpm-lock.yaml`・`pnpm-workspace.yaml` 無変更(git status確認)。`pnpm install` 未実行。

## 8. 裁量判断(設計未定義を合理的に埋めた箇所)

1. **transport核=複製**(§2)。
2. **defaultWindowMs=1000ms**(§4)。
3. **拒否コード=正確に6件**に確定(§3.3「等・実装時確定」を6で閉じる)。
4. **相関不能な封筒**(非JSON/id無し/kind無し)は拒否せず沈黙ドロップ+接続維持(§3.5 の寛容規則を「replyを捏造できないメッセージには適用」と解釈)。
5. **channelClosed の到達**: サーバでは `accepting = #server !== null`。close中は先にconnectionを閉じるので実運用ではrace稀。dispatch単体テストで `accepting:false` として決定論的に網羅。
6. **複数接続を許容**し、**いずれの切断でも clearAll**(v0=単一参照ドライバ前提の「切断→全失効」意味論。複数駆動は想定外)。
7. **値域境界**: value は `[min,max]` 閉区間で受理、厳密に外側のみ拒否。overlay失効境界: `expiresAtMs > nowMs` で生存(ちょうどで失効)。
8. **channel port 17310** は browser-source offsetから導出せず独立const。
9. **snapshot は未失効のみ返し、失効エントリを削除しない**(16スロットで有界のため掃除不要。Domain B が失効意味論の正を所有)。
10. **状態機械の protocolVersion**: connected状態に `protocolVersion:1` を載せる(§A-2「Connected(protocol版つき)」に従う。実質定数)。

## 9. 質問 / 引き継ぎ(Orch/後続ドメイン判断が要る点)

blocking な質問はなし。以下は境界の引き継ぎメモ:

1. **Domain B へ**: overlay store の heart配線(`getChannelOverlay(nowMs)→snapshot(nowMs)`)・TTL網羅/Recordマージ/切断→基底復帰の統合テストは B の担当として明示的に未実装。store API は配線可能な形で確定済み(§5)。
2. **Domain C へ**: サーバの open()/close() API と `getState()`/`onStateChanged()` 観測点は用意した。bridge invoke 配線・Channelページ・token以外秘匿の露出境界は C の担当。サーバ construction(slotごとの config store・custom slot の `findFreeLoopbackPort` 配線・autonomous composer からの `getCurrentSlots` 供給=`createAutoMappingSlots(payload)`)も合成根で C/主プロセスが行う。
3. **モデルunload中のoverlay掃除**(inventory risk#3): サーバは unload を知らない。getCurrentSlots=null で**新規write**は slotNotWritable で防げるが、既存overlayは TTL失効まで残る。ロード中モデルのunload時に即掃除したい場合は合成根(C)または heart統合(B)で `clearAll` を呼ぶ配線が要る。Domain A の責務外として未実装。
4. **fixture(純JSON)の物理配置**: 現状 `apps/runtime-player/src/main/control-channel/contract/` に置いた(器側 main近傍)。特区(`apps/soul`)がこれを読むだけ、という Domain D の import 経路が確定した際、配置の昇格(packages/contracts等)が要るかは実物の魂の日に検討(裁定8で繰延)。本waveでは器側配置で問題なし。
