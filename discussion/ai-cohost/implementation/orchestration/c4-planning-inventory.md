# C4 planning gate inventory: 外から動かせる(操縦チャネル・参照ドライバ・粗いオーバーレイ)コード接地棚卸し

> Status: 調査完了(Sylph、2026-07-11)。対象=`apps/runtime-player` 現HEAD(C3完全閉鎖済み、コミット `4475795`)+モノレポ構成。**読み取りのみ**(ソース変更・テスト実行・`pnpm install`・アプリ起動なし)。
> 基盤設計=[../../architecture/c4-control-channel-v0.md](../../architecture/c4-control-channel-v0.md)(Accepted)、UX=[../screens/c4-channel-diagnostics.md](../screens/c4-channel-diagnostics.md)(Accepted)、特区憲章=[../../concept/mvp-boundary-amendment.md](../../concept/mvp-boundary-amendment.md) §6(Accepted)、C3棚卸し=[c3-planning-inventory.md](c3-planning-inventory.md)。
> 事実はファイル:行で接地。設計上の見立ては「推測:」を前置。C2/C3棚卸しと同じ構造。
> 依頼元: Undine(L0)。本文書は最終報告の裏付け。Verdict は §5、先行判断すべき論点は §6、質問は §7。

---

## 1. 要約(先に結論)

- **C4の構造適合性は高い**。C3が「ツマミ→走行中生成器への即時反映seam」を新設した結果、**心臓の tick には既に「毎tick外部状態を読んで合成する」骨格がある**(`autonomous-frame-heart.ts:158-208` の `getPhysiologyConfig()` 再読み+再構築)。粗いオーバーレイはこれと**同型の第二のseam**(config用とは別の overlay 値+TTL 用 provider)を tick に足し、`generator.sample()` の出力に Record マージするだけで素直に入る。physiology純度(決定論fixture境界)は、C3がタイムスタンプ/sequence/config反映を境界の外に置いた前例そのままに保てる——オーバーレイは wall-clock TTL を持つ runtime 状態で、生成器の pure な sample には触れない。
- **主コストは5点**: (A) **操縦チャネル用の第二WSサーバ**(Browser Sourceの transport 核=frame codec/connection/token/loopback-listen は再利用可、だが session 意味論=request/reply+hello+拒否列挙 と手動開閉ライフサイクルは完全新規)。(B) **粗いオーバーレイ state + heart への第二seam + TTL評価**(§2.2)。(C) **チャネル検証層**(§2.6。resolver は「沈黙で落とす+クランプ」なので**拒否列挙には使えない**——検証は resolver の上に新設する前置ゲート)。(D) **Channel bridge + Channel ページ + 自律版Overview + degraded解消**(physiology-bridge を完全な先例として並列複製、§2.4/§2.7)。(E) **特区 `apps/<魂>` の物理コスト**(§2.5。`apps/*` は workspace glob 内 = package.json を足すと `pnpm-lock.yaml` の `importers:` が変わり `pnpm install` が要る。参照ドライバは Node22 ネイティブ `WebSocket` で依存ゼロに書ける)。
- **重要な発見(ドキュメント矛盾)**: 特区憲章(§6)は「本リポジトリには境界を機械検証する道具(`check:deps` の**非循環DAG検証**)が既にある」と述べるが、**実物の `check:deps`(`scripts/check-dependencies.mjs`)は禁止パッケージ名スキャナ(Live2D/Cubism/moc3等)であって、import方向・非循環モジュールグラフの検証は一切していない**(§2.5)。`check:source` も catch-all ファイル名/barrel/行数リンタで、依存方向は見ない。よって特区の「魂→契約のみ、器は魂をimportしない」一方向規律を機械強制するのは**既存DAG検証器の拡張ではなく新規機構の製作**。憲章の前提が現状ツールに接地していない。
- **Verdict: `needs_design`**(§5)。設計討議もUXもAccepted済みで骨格適合性は高いが、§6の先行判断6点——特にオーバーレイseamの形、チャネル=自律専有サブシステムの確認、第二ポート/token採番、**特区のlockfile物理コストの受容(またはstandalone-script回避)**、そして**check:depsのDAG検証ギャップをC4で作るか繰延するか**——が複数ドメインに波及し、wave分割の前提になる。

---

## 2. 観点別リポジトリ事実

### 2.1 観点1: WSサーバの並列複製コスト

**Browser Sourceサーバの構造(事実、`browser-source-server.ts`)**:
- 単一クラス `RuntimePlayerBrowserSourceServer` が **HTTP + WS upgrade を1つの `node:http` createServer で兼ねる**(`:147-153`)。WS は `server.on("upgrade")` → `#handleUpgrade`(`:495-563`)で 101 handshake を手書き(`createWebSocketAccept` = sha1+GUID、`:772-776`)。
- **token検証**: URLクエリ `?token=`(`isBrowserSourceTokenMatch`、`:513-524`)。HTTP側もWS upgrade側も同じ token 照合。
- **ライフサイクル**: `start()`(`:141-179`)/ `stop()`(`:181-201`)。`start` は既に走行中なら no-op(`:142-144`)= 冪等。heartbeat timer は `unref()`(`:573`)。
- **port fallback**: 希望ポートで listen 失敗+EADDRINUSE なら port 0(揮発)へ退避(`:156-163`、`listenOnLoopback`/`isAddressInUseError`)。
- **transport核の再利用可能部品(事実)**:
  - `browser-source-websocket-frame.ts`: **純RFC6455 frame codec**(`encode/decodeBrowserSourceWebSocketFrame*`、opcodes、`browserSourceMaxClientMessageBytes=4096`)。browser-source固有の結合は名前接頭辞と定数だけ——中身は汎用。
  - `browser-source-websocket-connection.ts`: connection ラッパ(バッファリング、ping/pong、close)。`send(message)` の型が `RuntimePlayerBrowserSourceServerMessage` に固定(`:42`)だが実体は `JSON.stringify` で汎用化は自明。
  - `browser-source-token.ts`: `createBrowserSourceToken()` / `isBrowserSourceTokenMatch()`(汎用token生成・照合)。
  - `listenOnLoopback` / port fallback / `createWebSocketAccept` / bind address(`127.0.0.1`)。

**切り方(推測)**:
- **共通化すべき部分**: frame codec・connection ラッパ・token util・loopback listen+fallback・upgrade handshake。これらは neutral module へ抽出して両サーバで共有するか(名前を browserSource→ 中立に改名)、小さいので複製するか。**request/reply の意味論は持たない純transportなので抽出が素直**。
- **複製すべき/新規の部分**: (i) **HTTPルーティングの大半は不要**——チャネルはWS専用(`/stage`・`/runtime-export/*`・asset serving・client-diagnostics は無関係)。せいぜい 401/404 の最小HTTP。(ii) **session意味論が別物**: Browser Source は「runtime-export/frame をN clientへbroadcast」(`browser-source-session.ts`)。チャネルは **hello告知 → intent.set request → accepted/rejected reply → overlay書込** の request/reply。broadcast state は不要、代わりに overlay state と相関ID対応。(iii) 拒否列挙(`unknownKind`/`invalidPayload`/`unknownSlot`/`slotValueOutOfRange`/`slotNotWritable`/`channelClosed`)は完全新規。
- **手動開放ライフサイクルの前例=無い(重要な事実)**: Browser Source は **起動時に自動 start**(`runtime-player-main.ts:333` `await browserSourceServer.start().catch(() => undefined)`)。UIから開閉するコマンドは無い(bridge は `getStatus`/`statusChanged` の観測のみ、`browser-source-bridge-handlers.ts:24-34`)。→ チャネルの「起動時Closed・UIから Open」は**新ライフサイクル**。server の `start()/stop()` が冪等な機構は流用できるが、(a) 起動時は start しない、(b) Channel ページからの open/close コマンドを受ける bridge invoke、(c) 開閉状態の status 通知、は新規。

### 2.2 観点2: 粗いオーバーレイの挿入点

**心臓の tick 構造(事実、`autonomous-frame-heart.ts:158-209`)**:
1. `config = getPhysiologyConfig()`(毎tick再読み)→ 参照が変われば generator 再構築(`:169-173`)。
2. `logicalTimeMs = max(0, wallNow - epoch)`(`:178`)。
3. `activations = heartbeat.generator.sample(logicalTimeMs)`(`:179`、**pure**、fixtureが固定する対象)。
4. Stage Presence 用に body-x/body-z を snapshot(`:184-188`)。
5. `resolveSemanticSlotParameterValues({ slots, activations })`(`:189-192`)。
6. sequence++・timestamp・publishFrame(`:194-208`)。

**素直な挿入点(推測)**: **手順3と手順5の間**、`activations` に対しチャネルのオーバーレイ値を Record マージする:
```
const overlay = getChannelOverlay(wallNowMs)   // 新seam
const merged = overlay === null ? activations : { ...activations, ...overlay.liveValues }
```
これで「有効な間チャネル値が生成器値を上書き、失効・切断で基底へ戻る」(設計§6)が Record 上書きで実現。resolver は `activations[slot.slotId] ?? null` を引く(`headless-slot-resolver.ts:59`)ので、マージ後の Record をそのまま渡せば slotId 単位の上書きになる。

**TTL失効の評価タイミング(推測)**: **tick ごとに `wallNowMs` と各オーバーレイの失効時刻を照合**が自然。心臓は既に wall clock を所有(`now()`、決定論境界の外、`:175`)。オーバーレイstate は `slotId → { value, expiresAtMs }` の Map で、tick 冒頭で `expiresAtMs <= wallNowMs` を掃く。TTL省略時の既定窓もここで `receivedAtMs + defaultWindowMs` として付与済みにしておけば、評価は一様。

**physiology純度(決定論)との関係(事実+推測)**:
- 生成器の `sample()` は **pure**(seed+config+time→slot列)で fixture が固定。オーバーレイは **その外側**——wall-clock TTL を持ち、WS受信という runtime I/O 由来。**C3が timestamp/sequence/「config再読み+再構築」を決定論境界の外(心臓=physiology/の外、wall clock許可、`:26-29`)に置いた前例と完全に同型**。オーバーレイも心臓に置けば生成器の純度は無傷。
- **seam の形(推測)**: C3の `getPhysiologyConfig?: PhysiologyConfigProvider`(`:112`)と**並列の第二provider** `getChannelOverlay?: (nowMs) => ChannelOverlaySnapshot | null` を `CreateAutonomousFrameHeartInput` に足す。default provider は「常にnull(オーバーレイ無し)」= 既存テスト/tracking は完全にC2/C3挙動。fixtureは「オーバーレイ無し」列を従来どおり pin し、オーバーレイ適用は別の runtime テスト(「有効窓内は上書き・失効で基底復帰」)で固定——config反映テストと同じ切り分け。
- **config seam との違い(注意)**: `getPhysiologyConfig` は**config(ツマミ)**で参照が変われば再構築。オーバーレイは**値+TTL**で再構築を伴わない(sample出力へのマージのみ)。両者は別concern・別seam。混ぜない。

### 2.3 観点3: チャネル用の第二ポート採番

**現状のポート採番(事実)**:
- 既定ポートは **スロット名で keyed**(`host-role.ts:61-68` `runtimePlayerDefaultSlotPreferredPorts`): `tracking-default → 17308`(`runtimePlayerBrowserSourceDefaultPort`、`browser-source-url.ts:6`)、`autonomous-default → 17308+1 = 17309`。**1スロット=1ポート**(Browser Source用)。
- 非既定(custom)スロットは `findFreeLoopbackPort()` で自動採番(`role-launch-resolution.ts:135-142`、`slot-preferred-port.ts:12-36`)。port は config に一度だけ生成・永続(`browser-source-config-store.ts:106-114`)。

**チャネル用の足し方(推測)**:
- **第二ポートは第二の record か offset**。C4 UX は 17310 を例示(`c4-channel-diagnostics.md:20`)。`17308+2=17310` は autonomous-default のチャネル。ただし現行 `+1` は browser-source-url 由来の browser-source専用導出なので、`runtimePlayerDefaultSlotChannelPorts: Record<slotName, number>`(autonomous-default → 17310)を新設するのが type上素直。**チャネルは自律専有(§2.2/§2.4)なので tracking-default にチャネルポートは要らない**。custom 自律スロットのチャネルポートは同じ `findFreeLoopbackPort()` で自動採番。
- **token分離(事実+推測)**: Browser Source config は `{token, preferredPort}` を `browser-source/browser-source-config.json`(slot userData配下)に持つ(`browser-source-config-store.ts:52-57`)。チャネルは**別token・別ファイル**(例 `channel/channel-config.json`)を並列複製。`createBrowserSourceToken()` は汎用token生成なので流用可(または channel専用に改名複製)。config store 自体が小さいので**並列複製**が素直(C3のphysiology-profile-store が Dynamics Tune を並列複製したのと同じ判断)。

### 2.4 観点4: 診断bridge配線

**physiology-bridge が完全な先例(事実)**:
- **契約**(`preload/physiology-bridge-contract.ts`): `getStatus`/action invoke群/`statusChanged` push。**`available: boolean` を DATA で返し**(`:90-98`)、renderer は `available:false` で空状態を描く(role分岐ゼロ)。
- **channels**(`preload/physiology-bridge-channels.ts`): IPC channel 名の定数table。
- **main handler**(`physiology-bridge-handlers.ts`): `registerPhysiologyBridgeHandlers`。**両ロールで登録**(`:41-48` docstring)、`getStatus` が state の availability を data で返す。action は request validation(`physiology-bridge-request-validation.ts`)→ state 更新 → status push。
- **ページ**(`control/physiology-page.tsx`): spec配列駆動、空状態(`available:false` → tracking空ページ、`physiology-page.test.ts:21-24`)。

**Channel bridge のコスト(推測)**: physiology-bridge を**並列複製**。Channel の getStatus が返す data:
- 接続状態(Closed/Open/Connected + protocol版)、Endpoint URL(token込み、rendererに出るのはtokenのみ=UX §4 の秘匿規律)、**Active overlays**(slotId+値+残TTL)、**Recent Events**(直近N件、受理/拒否+コード/接続)、`available`(自律のみtrue)。
- **開閉コマンド**は physiology には無い新action(`openChannel`/`closeChannel` invoke)。§2.1(iii)のライフサイクル新規分。
- **イベントログの保持場所(前例、事実)**: session-only の直近N件保持は Browser Source の client diagnostic 群(`browser-source-server.ts:54-62` の `clientDiagnosticEvents` Set + session への `markClientDiagnostic`、`browser-source-session.ts`)が最も近い前例。UX §4「イベントログはsession-only(永続化しない)」= main プロセスのチャネルstate内にリングバッファで持ち、status に載せて push。永続store(physiology-profile系)は**不要**。

### 2.5 観点5: 特区の物理コスト(重要)

**workspace glob(事実、`pnpm-workspace.yaml`)**: `packages: [packages/*, apps/*]`。**`apps/*` は含まれる**。

**新 `apps/<魂>`(package.json持ち)を足すと lockfile が変わるか(事実)**:
- `pnpm-lock.yaml` には **`importers:` セクションが全workspace package を列挙**(`:10` `importers:`、`.:`/`apps/authoring-host`/`apps/editor`/`apps/runtime-player`/`packages/*`)。**依存ゼロでも importer エントリ自体は記録される**(現に `packages/render-core: {}` が空importer形で存在、`:315`)。
- → **`apps/<魂>/package.json` を `apps/*` glob 下に置くと `importers:` に `apps/<魂>: {}` が加わり lockfile が変わる。`pnpm install` が必要**(依存ゼロでも importer 登録のため)。これは特区の**確定した物理コスト**。差分は最小(空importer1行相当)だが、install自体は避けられない。

**回避オプション(推測)**:
- **選択肢A(正式workspace app)**: `apps/<魂>/package.json` → lockfile差分 → `pnpm install`。app 固有の tsconfig/test 構成・`check:deps` の apps スキャン対象化が得られる。install 一回のコストを許容。
- **選択肢B(standalone script、package.json無し)**: pnpm の glob は **package.json を持つdirのみを package として拾う**。`apps/<魂>/` に `.ts`/`.mjs` だけ置き package.json を作らなければ importer にならず**lockfile不変・install不要**。または `scripts/`(workspace glob外)へ置く。ただし「app」identity・per-app設定を捨てる。特区憲章は「`apps/<魂>` ディレクトリ(package.json持ち)」(§6)と明記しているので、選択肢Bは憲章の字義から外れる → 先行判断(§6-4)。

**参照ドライバを依存ゼロで書けるか(事実+推測)**:
- **Nodeバージョン**: リポジトリ全体で `@types/node 22.15.29`、`packageManager pnpm@10.12.1`。`.nvmrc`/`.node-version` は**無い**。runtime-player は `electron ^42`(Node 22系同梱)。→ **Node 22 のグローバル `WebSocket`(undici由来のクライアント)が unflagged で利用可**。参照ドライバは常駐プロセスで、器のWSサーバへ**繋ぐ側=WSクライアント**。ネイティブ `WebSocket` はクライアントなので**外部依存ゼロで書ける**(確認: WSサーバ実装は不要、クライアントのみ)。
- **TS vs JS の但し書き(推測)**: 「依存ゼロ」を厳密に取ると、TSで書いて実行するには tsx/ts-node 等が要る(=依存)。回避は (a) 参照ドライバを**素の `.mjs`**(JS、ネイティブWebSocket、`node driver.mjs` で直実行、依存ゼロ)で書く、(b) tsx を dev依存として許容(「依存ゼロ」を緩める)、(c) Node の `--experimental-strip-types`(22.6+)で `.ts` 直実行。設計§8.3 は「参照クライアント(=ゲートのテストスクリプト)はTS」だが、それは vitest 下のゲートテスト(vitest は既存依存)。**常駐参照ドライバ本体**の言語は別問題 → 先行判断(§6-5)。

**check:deps の検証機構(事実、重要な矛盾)**:
- `scripts/check-dependencies.mjs` は **禁止パッケージ名/禁止アセットのスキャナ**: `forbiddenDependencyPatterns`(live2d/cubism/moc3/cmo3/model3/motion3/physics3/pose3、`:18-28`)を全 `package.json` の依存節と `pnpm-lock.yaml` のパッケージ名に対して照合(`:157-191`)。**import方向・モジュールグラフ・非循環性は一切見ない**。
- `scripts/check-source-organization.mjs` は catch-all ファイル名禁止/index.ts barrel強制/大型ファイル行数(`:180-198`)。**依存方向は見ない**。
- → **特区憲章§6(と mvp-boundary-amendment 由来)の「`check:deps` の非循環DAG検証が既にある」は現状ツールに接地していない**。「魂→契約のみ、器は魂をimportしない」の一方向規律を機械強制するには、**depcruise 相当のimport-graph検証を新規に作る**必要がある(既存 `check:deps` の拡張ではない)。加えて、LLMプロバイダ依存(openai/anthropic等)は現 `forbiddenDependencyPatterns` に**含まれない**ので、特区外にそれらが混入しても現 `check:deps` は検知しない。特区の「機械検証可能になる分だけ強くなる」(§6末)という主張は、**その機械検証機構をC4で作って初めて成立する**。→ 先行判断(§6-6)。

### 2.6 観点6: 拒否列挙の実装土台

**現状の検証・写像の性格(事実)**:
- resolver `resolveSemanticSlotParameterValues`(`headless-slot-resolver.ts:48-82`)は **「failure is silence」**: `!slot.enabled || slot.target === null`(`:54`)、非有限/null activation(`:70`)を**沈黙で drop**。最終値は `clamp(value, min, max)`(`:74`)で**範囲外を黙って丸める**。→ **チャネルの拒否列挙(範囲外・不正ID・書込不可を明示的に reject、クランプ禁止=設計§3.3)には resolver をそのまま使えない**。検証は resolver の**上に前置ゲート**として新設する。
- **slotId 検証の土台(事実)**: `findSemanticSlotDefinition(slotId)`(`semantic-slot-definitions.ts:222-234`)は**未知 slotId で throw**。→ `unknownSlot` 拒否の直接土台。
- **書込可否の土台(事実)**: auto-mapping は `createAutoMappingSlots(payload)`(`runtime-export-auto-mapping.ts:10-50`)で slot ごとに `enabled = target !== null`・`status: "missing-target"|"mapped"` を付ける。target は `createDirectTargetCandidates` が `inputManifest.externalInputParameterIds` 等から選ぶ(`:52-88`、`runtimeRole==="external-input" && externalInput && !readOnly && ...`)。→ **`slotNotWritable` = 現在ロード中モデルの auto-mapping で当該 slot が disabled(target無し)**。resolver が沈黙で落とす条件(`:54`)を、チャネルでは**明示reject**に変換する。心臓は既に `createAutoMappingSlots(payload)` を保持(`input-subsystem.ts:250`)ので、チャネル検証は**同じ slots 配列**を参照できる。
- **値域情報の在り処(事実、注意)**: 正規化値域(-1..1 vs 0..1)は**宣言的フィールドではなく `sourceKind` に暗黙**:
  - centered(`head-centered`/`gaze-centered`/`body-x`/`body-z`)= **-1..1**(`headless-slot-resolver.ts:19-21` docコメント、`createCenteredTargetValue` が `clamp(normalized,-1,1)`、`:147`)。
  - weight(`blink-left/right`/`mouth-open`/`mouth-smile`)= **0..1**。
  - `mouth-vowel` = 0..1(pre-blended)。
  → **`slotValueOutOfRange` 検証には `sourceKind → 正規化域` の小さな新規分類器**が要る(既存に「正規化域を返す」ヘルパは無い)。`semanticSlotDefinitions` に min/max 正規化域フィールドを足すか、sourceKind switch で判定するか。

**含意(推測)**: チャネル検証層 = (1) `intent.set` payload パース(`invalidPayload`)、(2) `findSemanticSlotDefinition`(`unknownSlot`)、(3) sourceKind→域で範囲チェック(`slotValueOutOfRange`、**クランプせず reject**)、(4) 現auto-mapping slots で enabled+target 確認(`slotNotWritable`)。すべて resolver の**手前**。土台は既存関数に接地するが、**「沈黙で落とす」を「明示reject」に反転**する薄い層が新規。

### 2.7 観点7: degraded解消の対象

**現状(事実)、C4 UX §3 の置換先=physiology の `available:false` 空状態パターン**:

| degraded面 | 現在の実装 | 現状の挙動 | 置換コスト(推測) |
|---|---|---|---|
| 自律ホスト Input ページ | `control/input-page.tsx` | input status=null → Connection「Disconnected」等の劣化表示(formatters が null を食う) | Input subsystem の「tracking入力の有無」data(既に `usesTrackingInput`/`providesPhysiology` あり)で空状態一文に置換。physiology の空状態が完全な型 |
| 自律ホスト Mapping ページ | `control/mapping-page.tsx` | 同上(mapping status劣化) | 同パターン |
| Overview | `control/overview-page.tsx` | **role非依存で Runtime Export/Input Source/Input Profile/Mapping の4パネルを無条件描画**(`:87-247`)。自律では Input系が劣化値 | UX §2 の自律版=Model/Physiology/Channel カードへ差し替え。**サブシステム有無data**(`providesPhysiology`/新`providesChannel`)で描き分け。physiology status(`available`)は既に data で来る |
| Live Controller Motion Safety | `control/live-controller-page.tsx:117-137`(C3棚卸しで特定) | 「Stage Motion On/Off」ボタン=Stageページ Enabled と同じ `stageMotion.settings.enabled` を切替。自律では eff果ゼロ(input null で毎tick reset) | UX §3「Stage presence is driven by Physiology on this host.」空状態へ。生理駆動の別意味論(C3 Domain D `stage-presence-drive.ts`)と混同させない |
| Stage ページ Stage Motion パネル | `control/stage-motion-panel.tsx` / `stage-page.tsx` | 同上(Enabled チェックボックス) | 同空状態パターン |
| Header `Input:` 表示 | `control/control-window-shell.tsx:110` `<StatusPill tone={inputTone}>{inputLabel}</StatusPill>`(props は `control-window-app.tsx` から) | inputLabel/inputTone は input status 由来。自律では「Disconnected」に近い嘘 | UX §3 例 `Drive: Physiology`。inputLabel/inputTone をサブシステム有無data由来に差し替え(shell は props受けなので app 側の派生を変える) |

- **置換機構の前例(事実)**: physiology-bridge の `getStatus().available`(`physiology-bridge-contract.ts:90-98`)が「サブシステム有無をdataで返す」完成型。degraded面はいずれも**同じdata源(subsystem seam の `providesX` フラグ or bridge status の `available`)を足して空状態を描く**だけで、`if(role===)` を書かずに済む。nav は `control-window-shell.tsx:44-56` の静的table(現在8ページ)——Channel追加は1行+`ControlWindowPage` union に `"channel"`。
- **コスト感(推測)**: 各面は小(空状態一文+data配線)。ただし**Overviewの自律版カード化(Model/Physiology/Channel)は新規レイアウト**で、physiology/channel の status を data で受ける配線を要する。degraded解消は C4 の借金返済で、機構リスクは低いが面数(6面)ぶんの機械的作業。

---

## 3. C4計画への含意(ドメイン分割の示唆、主コスト)

**ドメイン分割の示唆(推測、設計§2の二層化=外殻/payload と整合)**:
- **Domain 契約外殻**(依存なし、additive extension基礎): 封筒スキーマ(`v/id/kind/payload`、reply、`server.hello`、拒否列挙)+ **fixture=純JSON**(スキーマ+やり取り例)。TS型は preload contract として。ゲート「fixtureから face.angle.x が動く/契約違反が拒否される」の証拠土台。
- **Domain WSサーバ + ライフサイクル**: transport核(browser-source frame codec/connection/token/loopback を共有抽出 or 複製)+ channel session(request/reply、hello、手動開閉)。**第二ポート/token採番**(§2.3)。§2.1(iii)の新規分。
- **Domain 検証 + 拒否列挙**: §2.6 の前置ゲート(unknownKind/invalidPayload/unknownSlot/slotValueOutOfRange/slotNotWritable/channelClosed)。resolver の上、auto-mapping slots 参照。
- **Domain 粗いオーバーレイ + 心臓seam**: overlay state(slotId→値+TTL)+ 心臓の第二provider seam(§2.2)+ tick での TTL評価+マージ。**自律専有**。fixture境界の外の runtime テスト。
- **Domain Channel bridge + ページ + degraded解消**: physiology-bridge 並列複製 + Channel ページ + 自律版Overview(Model/Physiology/Channel)+ degraded 6面の空状態化(§2.4/§2.7)。
- **Domain 特区 + 参照ドライバ**(特区最初の住人): `apps/<魂>` 骨組み + 依存ゼロ参照ドライバ(Node22 ネイティブWebSocket、シナリオ駆動)+ 持続駆動機械テスト(数分駆動でフレーム停滞なし・切断/再接続・応答遅延計測)。**check:deps の一方向規律機構をここで作るか**(§2.5/§6-6)。

**主コスト順(推測)**:
1. **WSサーバ第二インスタンス + 手動開閉ライフサイクル**(§2.1)——transport核は再利用可だが session意味論・拒否列挙・開閉コマンドは新規で最も重い。
2. **特区物理コスト + 参照ドライバ + check:deps機構**(§2.5)——lockfile/install の受容判断 + 依存ゼロドライバ + **DAG検証の新規製作(するなら)**。設計荷重が高い。
3. **オーバーレイ state + 心臓第二seam + TTL**(§2.2)——C3の config seam前例で構造は素直、だが overlay と config を混ぜない設計判断。
4. **検証層**(§2.6)——土台は既存関数、「沈黙→明示reject」反転の薄層。
5. **bridge + ページ + degraded 6面**(§2.4/§2.7)——physiology 並列複製で低リスク、面数ぶんの機械作業。

**C3/C2からの再利用(事実)**: 心臓の tick骨格・config再読みseam・subsystem合成テーブル・`providesPhysiology` data パターン・physiology-bridge/store/state テンプレ・sanitization境界・auto-mapping slots・resolver・token util・WS frame codec は全て流用可。C4の真の新規は「外部WS request/reply」「拒否列挙」「overlay+TTL」「特区」の4本。

---

## 4. リスクと未知

1. **check:deps のDAG検証ギャップ(§2.5、最重要)**: 特区憲章の機械強制前提が現状ツールに無い。C4で作らないと「境界が機械検証可能」という改定二号の根拠が空手形のまま。作るなら depcruise相当の新規機構で、C4スコープが膨らむ。→ §6-6。
2. **overlay と config seam の混同(§2.2)**: 両者を1つのproviderに混ぜると、overlay値変更が generator再構築を誘発する等の事故。別seam・別concern を明示分離する設計が要る。
3. **手動開閉ライフサイクルの状態機械(§2.1)**: Closed/Open(listening)/Connected の遷移、port fallback時の Endpoint URL 更新、開いたまま Runtime Export unload された時のoverlay掃除。前例が無いぶん状態設計の未知。
4. **特区のlockfile/install コスト(§2.5)**: 選択肢A(package.json)はinstall必須、選択肢B(standalone)は憲章字義から外れる。どちらもトレードオフ。→ §6-4。
5. **参照ドライバの言語(§2.5)**: 「依存ゼロ」厳密なら素の.mjs。TS希望なら tsx依存 or `--experimental-strip-types`。→ §6-5。
6. **Overview自律版の新レイアウト(§2.7)**: Model/Physiology/Channel カードは既存Overviewの単純置換ではなく新規。physiology/channel status の data配線が要る。
7. **未知: 応答遅延計測の基準(設計§1/§7)**: 「持続駆動テストで応答遅延計測」のゲート閾値・計測法(intent.set送信→overlay反映→frame publish までの時間?)が未定義。参照ドライバ製作時に確定。

**発見したドキュメント矛盾/ギャップ(黙って直さず列挙)**:
- **[重要] 特区憲章§6 と mvp-boundary-amendment §6.3 の「`check:deps` の非循環DAG検証が既にある」は事実に反する**(§2.5)。実物は禁止パッケージ名スキャナ。一方向依存規律の機械強制は新規製作。憲章の「機械検証可能になる分だけ強くなる」はその機構をC4で作って初めて成立。
- **c4-channel-diagnostics.md §1 のport例 17310 と現行採番の非明示**: 現行は `runtimePlayerBrowserSourceDefaultPort(17308) + 1 = 17309`(autonomous-default browser source)。チャネル 17310 は「browser-source + 2」だが、その導出規則は未定義。第二record か offset かは実装判断(§2.3)。矛盾ではないが採番方式が UX に接地していない。
- **チャネルの自律専有性が設計/UXで暗黙**: UX §1 は「トラッキングホストで開いた場合…空状態」と述べ、チャネルが tracking でも「開ける」かに読めるが、オーバーレイは心臓(自律のみ)無しには効かない。**チャネル=physiology と同じ自律専有サブシステム**(tracking では `available:false` で開けない)と解釈するのが構造的に自然(§2.2/§2.4)。設計に明記が無い → §6-2。

---

## 5. Verdict

**`needs_design`**。

設計討議([c4-control-channel-v0.md](../../architecture/c4-control-channel-v0.md))もUX([c4-channel-diagnostics.md](../screens/c4-channel-diagnostics.md))もAccepted済みで、C3が残した心臓の tick骨格・config seam・subsystem合成テーブル・physiology-bridge テンプレのおかげで**構造適合性は高い**。しかし wave分割の前に §6 の先行判断6点、特に (i) **check:deps のDAG検証ギャップ**(特区憲章の前提が現状ツールに無い——C4で作るか繰延か)、(ii) オーバーレイseamの形とチャネル自律専有の確認、(iii) 第二ポート/token採番方式、(iv) **特区のlockfile/install物理コストの受容 or standalone回避**、が複数ドメインに波及し未確定。これらは wave計画の前提になる。裁定が済めば実装は素直で、C2/C3資産を大きく再利用できる。

---

## 6. 先行判断すべき論点(wave計画前にユーザー/Undine裁定)

1. **オーバーレイseamの位置と形**(§2.2): 心臓に C3の `getPhysiologyConfig` と**並列の第二provider**(`getChannelOverlay?: (nowMs) => snapshot | null`)を足し、tick で TTL評価+`activations` への Record マージ、で確定か。config seam とは別concern(再構築を伴わない)として分離する点の確認。fixtureは「オーバーレイ無し」列を維持、適用は別runtimeテスト、でよいか。
2. **チャネル=自律専有サブシステムの確認**(§2.2/§2.4/§4矛盾): チャネルは physiology と同じく**自律ホスト専有**(`providesChannel` data、tracking では `available:false` で開けない・空状態一文)で確定か。tracking で「開ける」余地は持たせない、でよいか。
3. **第二ポート/token採番方式**(§2.3): チャネルポートを `runtimePlayerDefaultSlotChannelPorts`(autonomous-default→17310)の新record + custom自律は `findFreeLoopbackPort` 自動採番、token/config は browser-source と別ファイル(`channel/channel-config.json`)に並列複製、で確定か。
4. **特区の物理コスト受容**(§2.5): `apps/<魂>/package.json` を置いて `pnpm install`(lockfile importer追加)を一度受け入れる[選択肢A]か、package.json無しの standalone script で lockfile不変[選択肢B、ただし憲章字義から外れる]か。憲章は「package.json持ち」と明記しているのでAが字義通りだが、install コストの受容確認が要る。
5. **参照ドライバの言語**(§2.5): 「依存ゼロ」を厳密に取り素の `.mjs`(Node22ネイティブWebSocket、直実行)で書くか、tsx を dev依存として許し `.ts` で書くか。設計§8.3 の「参照クライアントはTS」は vitest下のゲートテストを指すと解し、常駐ドライバ本体は .mjs でよいか。
6. **check:deps のDAG検証をC4で作るか**(§2.5/§4-1、最重要): 特区憲章の「一方向依存を `check:deps` で検証」を成立させるため、import-graph の非循環/方向検証機構(depcruise相当)を**C4スコープ内で新規製作**するか、C4は特区骨組み+参照ドライバに留め DAG検証は別問題として繰延するか。憲章の機械検証前提が現状ツールに無い以上、ここは明示裁定が要る。

---

## 7. 質問(Undine経由でユーザー確認したい点)

1. **応答遅延計測ゲートの定義**(§4-7): 持続駆動テストの「応答遅延計測」は何を測るか(intent.set 受信→overlay反映→次frame publish までの時間?)、合否閾値はあるか。C4ゲートの機械判定に必要。設計§1では「計測する」とのみ。
2. **fixture の正の置き場**(設計§8.2「fixtureは純JSON」): 純JSONスキーマ+やり取り例を `apps/<魂>` 配下(魂がimportする契約)に置くか、器側の preload/contract 近傍に置くか。特区憲章§6.2「魂がimportしてよいのは契約(型・fixture)だけ」との整合で、fixture の物理配置を確認したい。
3. **Channel ページの nav 位置**(UX §1「Physiology の近くが自然」): `control-window-shell.tsx:44-56` の静的nav table で Physiology(6番目)の直後に Channel を挿すで確定か(実装時決定と書かれているが方向確認)。

---

## 付録: 主要ファイル索引(絶対パス)

**WSサーバ / transport(観点1)**:
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\broadcast-source\browser-source-server.ts`(HTTP+WS兼用サーバ・upgrade handshake・start/stop・port fallback)
- `...\apps\runtime-player\src\main\broadcast-source\browser-source-websocket-frame.ts`(汎用RFC6455 frame codec・再利用核)
- `...\apps\runtime-player\src\main\broadcast-source\browser-source-websocket-connection.ts`(connection ラッパ・再利用核)
- `...\apps\runtime-player\src\main\broadcast-source\browser-source-token.ts`(汎用token生成・照合)
- `...\apps\runtime-player\src\main\broadcast-source\browser-source-url.ts`(:6 default port 17308・bind address)
- `...\apps\runtime-player\src\main\broadcast-source\browser-source-config-store.ts`(token+preferredPort 永続・並列複製テンプレ)
- `...\apps\runtime-player\src\main\broadcast-source\browser-source-bridge-handlers.ts`(getStatus/statusChanged のみ=開閉コマンド無し=手動開放前例の不在)
- `...\apps\runtime-player\src\main\runtime-player-main.ts`(:333 browser source 自動start=手動開放前例の不在)

**オーバーレイ挿入点(観点2)**:
- `...\apps\runtime-player\src\main\role-composition\autonomous-frame-heart.ts`(:158-209 tick骨格・:112 config provider seam・:169-173 再読み+再構築=overlay第二seamの前例)
- `...\apps\runtime-player\src\main\role-composition\input-subsystem.ts`(:98 physiologyConfigProvider seam・:202-262 自律composer・:229-241 getStageMotionDrive=第二provider配線の前例)

**ポート採番(観点3)**:
- `...\apps\runtime-player\src\main\profile-slots\host-role.ts`(:61-68 スロット名keyedポートrecord・autonomous-default=17309)
- `...\apps\runtime-player\src\main\profile-slots\role-launch-resolution.ts`(:135-142 port plan・fixed/auto-assign)
- `...\apps\runtime-player\src\main\profile-slots\slot-preferred-port.ts`(findFreeLoopbackPort・preferred port factory)

**診断bridge(観点4)**:
- `...\apps\runtime-player\src\main\physiology-bridge-handlers.ts`(両ロール登録・available data・並列複製テンプレ)
- `...\apps\runtime-player\src\preload\physiology-bridge-contract.ts`(:90-98 available data パターン)
- `...\apps\runtime-player\src\preload\physiology-bridge-channels.ts`(IPC channel table)
- `...\apps\runtime-player\src\control\physiology-page.tsx`(空状態=available:false ページ先例)

**特区 / check(観点5)**:
- `...\pnpm-workspace.yaml`(apps/* が glob 内)
- `...\pnpm-lock.yaml`(:10 importers セクション・:315 packages/render-core: {} 空importer形)
- `...\package.json`(:16-18 check:deps/check:source/check・@types/node 22系)
- `...\scripts\check-dependencies.mjs`(禁止パッケージ名スキャナ=DAG検証ではない)
- `...\scripts\check-source-organization.mjs`(catch-all/barrel/行数リンタ=依存方向を見ない)
- `...\apps\runtime-player\package.json`(:41 electron ^42=Node22系・native WebSocket)

**検証土台(観点6)**:
- `...\apps\runtime-player\src\main\live-mapping\headless-slot-resolver.ts`(:54/:70 沈黙drop・:74 clamp=拒否列挙に流用不可・:19-21 sourceKind値域)
- `...\apps\runtime-player\src\main\live-mapping\semantic-slot-definitions.ts`(:222-234 findSemanticSlotDefinition=未知slot throw・sourceKind定義)
- `...\apps\runtime-player\src\main\live-mapping\runtime-export-auto-mapping.ts`(:52-88 createDirectTargetCandidates・externalInputParameterIds・enabled=target有無)

**degraded解消(観点7)**:
- `...\apps\runtime-player\src\control\overview-page.tsx`(:87-247 role非依存4パネル無条件描画=自律版差替対象)
- `...\apps\runtime-player\src\control\input-page.tsx` / `mapping-page.tsx`(自律劣化表示)
- `...\apps\runtime-player\src\control\live-controller-page.tsx`(:117-137 Motion Safety)
- `...\apps\runtime-player\src\control\stage-motion-panel.tsx` / `stage-page.tsx`(Stage Motion Enabled)
- `...\apps\runtime-player\src\control\control-window-shell.tsx`(:44-56 静的nav table=Channel追加点・:110 Header inputLabel/inputTone)
- `...\apps\runtime-player\src\main\presence\stage-presence-drive.ts`(C3 Domain D=生理駆動Stage、Motion Safety混同回避の別意味論)
