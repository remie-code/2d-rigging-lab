# C4 Domain C 実装報告: Channel bridge + Channelページ + 自律版Overview + degraded解消 + 合成根のサーバ配線

> Gnome(実装担当)→ Orch-Sylph。task=`cohost-c4-channel-page-degraded`。
> 前提=Domain A(契約の家・サーバ・overlay store・採番)+ Domain B(overlay store の heart 配線・`subsystem.getControlChannelOverlayStore()` seam)完了。
> スコープ=Channel bridge・Channelページ・自律版Overview・degraded 6面・合成根のサーバ配線。Domain A/B 成果は配線・呼び出しに徹し、不足2点のみ最小追加(§Domain A追加)。

## 1. 作成/変更ファイル一覧

### 新規追加(Domain C 本体)
- `apps/runtime-player/src/preload/channel-bridge-contract.ts` — renderer向け contract(status/connection/activeOverlays/recentEvents/action result/API 型)。**preload層は自己完結**(main の wire 契約を import しない。protocolVersion=number, rejection code=string で受ける)。
- `apps/runtime-player/src/preload/channel-bridge-channels.ts` — IPC channel 名 table(getStatus/openChannel/closeChannel/statusChanged)。
- `apps/runtime-player/src/main/channel-bridge-handlers.ts` — `registerControlChannelBridgeHandlers`(両ロール登録・session-only リングバッファ・open/close・status 構築+push)。
- `apps/runtime-player/src/control/channel-page.tsx` — Channelページ(UX §1 mockup 準拠)。
- `apps/runtime-player/src/control/channel-page.test.ts`(8)
- `apps/runtime-player/src/control/control-window-app.channel.test.ts`(3)
- `apps/runtime-player/src/control/control-window-degraded.test.ts`(6)
- `apps/runtime-player/src/main/channel-bridge-handlers.test.ts`(6)
- `apps/runtime-player/src/main/control-channel/channel-server-events.test.ts`(1)

### 変更した既存ファイル(Domain C)
- `control/control-window-shell.tsx` — `ControlWindowPage` union に `"channel"`、nav table の Physiology **直後**に `{ id: "channel", label: "Channel" }`(裁定9・UX§1)。
- `control/control-window-app.tsx` — channel status state・`connectControlWindowChannelStatusBridge`・`renderControlWindowChannelRoute`・`runChannelAction`・`copyChannelUrl`・channel route 分岐・`shouldRenderInputDiagnosticsPanel` に `"channel"` 追加・`providesPhysiology`/`providesChannel`/`drivenByPhysiology` 派生・Header `Drive: Physiology` 差し替え・各ページへの data 配線。
- `control/control-window-components.tsx` — 共有 `EmptySubsystemNotice`(空状態一文+任意 action)を additive export(既存 export 無変更)。
- `control/overview-page.tsx` — 自律版=Model/Physiology/Channel カード(`providesPhysiology`/`providesChannel` data 分岐)。Runtime Export パネルを `ModelOverviewPanel` に抽出し両レイアウトで共有。tracking 4パネルは維持。
- `control/input-page.tsx` — `drivenByPhysiology` で空状態(UX§3)。
- `control/mapping-page.tsx` — 同上。
- `control/live-controller-page.tsx` — Motion Safety パネルを `drivenByPhysiology` で空状態+Physiology誘導に置換(`onOpenPhysiology`)。両新propは optional(default false)で tracking テスト無改変。
- `control/stage-motion-panel.tsx` — `drivenByPhysiology`(必須)で空状態。
- `control/stage-page.tsx` — `drivenByPhysiology`(optional default false)を StageMotionPanel に透過。
- `preload/runtime-player-bridge-contract.ts` — `RuntimePlayerApi.channel` 追加。
- `preload/runtime-player-bridge.ts` — channel API 配線 + `subscribeToChannelEvent`。
- `main/runtime-player-main.ts` — 合成根のサーバ配線(§3)。

### Domain A への最小追加(不足2点・additive・既存挙動不変)
両方 UX §1 が要求する診断のために不可欠で、read-only 観測 seam。既存の振る舞い・テストは無変更。
- `main/control-channel/control-channel-overlay-store.ts` — `activeOverlays(nowMs)` メソッド追加(§4)。既存 `snapshot` は無変更。
- `main/control-channel/channel-server.ts` — `onEvent(listener)` seam +`RuntimePlayerControlChannelServerEvent` 型追加。connect/accept/reject/disconnect の4点で emit(§2)。状態機械・open/close・overlay 書込は無変更。

### 触っていない(Domain A/B の uncommitted 成果・退行させていない)
`role-composition/autonomous-frame-heart.ts`・`input-subsystem.ts`・`input-subsystem.test.ts`・`runtime-player-boundary.test.ts`・`control-channel/` の他ファイル(server本体のライフサイクル・contract・dispatch・validation・config/port)。`git diff --stat` で確認済み(role-composition の差分は Domain B 報告 §1 と完全一致)。

## 2. bridge 契約の data 形(token以外の秘匿が無いことの明示)

`RuntimePlayerControlChannelStatus`(renderer に渡る全情報):
- `available: boolean` — チャネルサブシステム有無(自律のみ true)。**role 問い合わせでなく `server !== null` の data**。
- `connection` — `{closed}` / `{open}` / `{connected, protocolVersion}`(server の `getState()` の写像)。
- `endpointUrl: string | null` — `ws://127.0.0.1:<port>/channel?token=…`。**Open/Connected のみ非null**(port は bind 後に判明)、Closed/tracking は null。**token が renderer に露出する唯一の面**(URL構成要素)。
- `activeOverlays: {slotId, value, remainingTtlMs}[]` — slotId=実スロット語彙(`head-horizontal` 等)、value=クライアント送信値、**残TTL=相対値のみ**(絶対 `expiresAtMs` は渡さない)。
- `recentEvents: {id, kind, slotId?, value?, code?}[]` — session-only。kind=accepted/rejected/connected/disconnected。code=拒否列挙(`slotValueOutOfRange` 等)。
- `revision`・`updatedAtIso` — 単調マーカー・時刻。

**秘匿非露出の担保**: token は endpointUrl 内のみ(bridge test「Closed→JSON に token 無し / Open→token は JSON 内で endpointUrl の1回のみ」で固定)。seed・rawスロット・シードは一切なし(同 test で `"seed"` 非包含を assert)。overlay の絶対 expiresAtMs も非露出(test で確認)。Recent Events も slotId/value/code のみ(server event 型が enum/公開語彙に限定、`channel-server-events.test.ts` で JSON に token 非包含を assert)。

## 3. 合成根のサーバ配線方式(生成タイミング・open/close・overlayStore/getCurrentSlots)

`runtime-player-main.ts`、`registerPhysiologyBridgeHandlers` の直後:
- **自律のみ生成(data 分岐)**: `controlChannelOverlayStore = inputSubsystem.getControlChannelOverlayStore()`。非null(自律)のときだけ `RuntimePlayerControlChannelConfigStore` を作り `getOrCreateConfig()` で token/port を取得し `RuntimePlayerControlChannelServer` を生成。tracking は overlay store が null → server も null。**実行時 `if(role)` なし**。
- **port 採番**: config store の `createPreferredPort = () => launch.preferredPort.mode === "fixed" ? runtimePlayerControlChannelDefaultPort(17310) : findFreeLoopbackPort()`。autonomous-default は固定17310、custom自律は auto-assign(browser-source と同じ規律)。別token・別ファイル `channel/channel-config.json`(Domain A)。
- **起動時 start しない**: server は生成のみ。**Closed 起動**(UX§1)。open/close は Channel bridge の invoke 経由(`server.open()`/`server.close()`)。
- **overlayStore 配線**: `RuntimePlayerControlChannelServer` の option `overlayStore` に `getControlChannelOverlayStore()` の**同一インスタンス**(Domain B の共有)を渡す。server が intent受理で setOverlay・切断で clearAll(Domain A 実装済み)。
- **getCurrentSlots 配線**: 合成根が `currentControlChannelSlots` を保持し `getCurrentSlots: () => currentControlChannelSlots` を渡す。`onRuntimeExportLoaded` で `createAutoMappingSlots(payload)`(**heart と同じ純関数・同じ payload → 同一 slots**、乖離なし)、`onRuntimeExportChanging`/`Cleared` で null。
- **bridge は両ロール登録**: `registerControlChannelBridgeHandlers({ windows, server, overlayStore })`。tracking は server=null → available:false。
- **モデル unload の overlay 掃除(Domain A 引き継ぎ#3)**: `onRuntimeExportChanging`/`Cleared` で `currentControlChannelSlots=null` + `controlChannelOverlayStore?.clearAll()` + `controlChannelBridge.publishStatus()`。新規write は slotNotWritable で防がれ、既存 overlay は TTL 待たず即時掃除(体が即生理基底へ)。**channel server 自体は unload で閉じない**(開閉は手動のみ、UX§1)。
- **quit**: `will-quit` で `controlChannelBridge.dispose()` + `void controlChannelServer?.close()`。

## 4. Active overlays の残TTL の取得(store への追加根拠)

Domain A の `overlay-store.snapshot(nowMs)` は `Record<slotId, value>` のみで**残TTLを出せない**。UX§1「Active overlays: slotId+値+残TTL」に不可欠なため、store に read-only の `activeOverlays(nowMs): {slotId, value, remainingTtlMs}[]` を追加。`snapshot` と同じ liveness(`expiresAtMs > nowMs`)で、各行に**相対**残TTL(`expiresAtMs - nowMs`)を載せる。絶対 expiresAtMs は返さない(renderer に絶対壁時計を出さない規律)。エントリの mutate/失効は行わない(Domain B が失効の正を所有)。bridge が `Date.now()`(seam注入可)で照会。bridge test で「残300ms・失効分除外・JSON に絶対時刻非包含」を固定。

## 5. degraded 6面の置換内容(空状態文・data源)

すべて `EmptySubsystemNotice`(physiology の空状態と同品位)。data源は **physiology availability(`physiologyStatus.available === true` = `drivenByPhysiology`)**。physiology は自律専有サブシステムなので「この host は生理駆動=tracking入力なし」の正しいマーカーで、既に renderer に配線済み。channel availability も等価(両者自律専有・常に共在)だが、無関係ページへ channel status を通さないため既配線の physiology マーカーを採用。tracking では false → 従来表示(退行なし)。

1. **自律 Input**(`input-page.tsx`): 「This host has no tracking input; the body is driven by physiology and the channel.」— tracking接続UIを全置換。
2. **自律 Mapping**(`mapping-page.tsx`): 同一文。
3. **Live Controller Motion Safety**(`live-controller-page.tsx`): 「Stage presence is driven by Physiology on this host.」+ `Open Physiology` 誘導。押せて効かない toggle を置換。
4. **Stage Motion パネル**(`stage-motion-panel.tsx`, `stage-page.tsx` 経由): 「Stage presence is driven by Physiology on this host.」
5. **Header `Input:`**(`control-window-app.tsx` の inputLabel/inputTone): 自律で `Drive: Physiology`(tone teal)、tracking で従来 `getInputStatusPillLabel(inputStatus)`。data源=`drivenByPhysiology`。

## 6. 自律版Overview(C-4)

`overview-page.tsx`: `providesPhysiology` が true(自律)→ **Model / Physiology / Channel** カード。`providesChannel` で Channel カードを描く(自律で常に true)。Channel カードは Closed/Open/Connected の鏡写し+`Open Channel`(Channelページ導線)、操作本体はページ側。tracking(両フラグ false)→ 既存4パネル維持。`control-window-degraded.test.ts` で自律=Model/Physiology/Channel+`Open Physiology`/`Open Channel`・tracking=Input Source/Profile+Channel カード無し、を固定。

## 7. 複数接続の扱いの決定と根拠

**v0 は「複数接続を許容し、いずれの切断でも clearAll(現状の fail-safe 据え置き)」を採用**(Domain A 裁定6 と整合)。根拠:
- UX§1 の Connected 表示は単数(単一参照ドライバ前提)。Overview/Channelページの状態は「1本でも接続あれば connected」で足りる(server の `connections.size > 0` で connected、Domain A 実装)。
- 2本目を能動的に拒否する実装(既存置換 / reject)は v0 スコープに対し過剰。Domain A は複数接続を受理し、**どの切断でも全 overlay clearAll**(fail-safe)。この意味論で v0 は破綻しない(最後発の値が overlay を上書き、切断で基底へ)。
- 複数ドライバのフルサポート(優先規則・per-connection overlay 帰属)は C5 以降。Domain C では**現状の Domain A/B 意味論に配線するのみ**で、追加の複数接続ロジックは作らない。

## 8. nav位置・Header Drive表示の実装

- **nav**: `control-window-shell.tsx` の静的 table で Physiology 直後に Channel(裁定9・UX§1)。union にも `"channel"`。
- **Header Drive**: `control-window-app.tsx` で `inputLabel = drivenByPhysiology ? "Drive: Physiology" : getInputStatusPillLabel(inputStatus)`、tone 同様(teal / 従来)。自律の「Disconnected」の嘘を data で差し替え。tracking 無退行。

## 9. テスト結果

- **focused(Domain C 新規)**: `pnpm -C apps/runtime-player exec vitest run -c vitest.config.ts src/control/channel-page.test.ts src/control/control-window-app.channel.test.ts src/control/control-window-degraded.test.ts src/main/channel-bridge-handlers.test.ts src/main/control-channel/channel-server-events.test.ts`
  → **5 files / 24 tests 全 pass**。
- **control-channel + control + boundary**: `… src/main/control-channel src/control src/runtime-player-boundary.test.ts`
  → **24 files / 119 tests 全 pass**(Domain A/B の既存 control-channel テスト・physiology-page・live-controller・stage-page 系・boundary 含め無退行)。
- **runtime-player 全体**: `pnpm -C apps/runtime-player exec vitest run -c vitest.config.ts`
  → **816 passed / 2 failed(135 files: 133 passed / 2 failed)**。
  - Domain B 報告(792 passed)+ Domain C 新規24 = **816 で整合**。
  - **2件は既知 baseline(Wave21 browser-source系、`effectiveDynamicsTuning` フィールド不一致)**: `broadcast-source/browser-source-server.test.ts` と `stage/browser-source/browser-source-server-message.test.ts`。**私は browser-source を1バイトも触っていない**(因果的に無関係)。Domain A/B と同一 baseline。
- **typecheck**: `pnpm -C apps/runtime-player run typecheck`(tsc --noEmit)→ **pass**。
- **check:deps**: `node scripts/check-dependencies.mjs` → **passed**(新規依存なし)。
- **check:source**: 唯一の違反は `main/physiology/index.ts`(C3 既存 committed、**私は未接触**)。Domain C の追加/変更ファイルは違反ゼロ。Domain A/B と同一 baseline。
- **lockfile/workspace**: `pnpm-lock.yaml`・`pnpm-workspace.yaml` **無変更**(`git status --short` で空)。**`pnpm install` 未実行**。回避工作なし・新規依存なし。

## 10. 裁量判断・質問

裁量判断:
1. **Domain A への最小追加2点**(§1)。`activeOverlays`(store)と `onEvent`(server)は UX§1 の Active overlays/Recent Events に不可欠で、`snapshot`/`onStateChanged` だけでは残TTL・accept/reject/connect/disconnect が観測不能。read-only・additive・既存挙動不変。勝手な再設計はせず観測 seam のみ。
2. **degraded の data源=physiology availability**(§5)。channel availability と等価(両者自律専有・共在)だが、既配線の physiology マーカーで無関係ページへ channel status を通さない。
3. **Recent Events の rejected 行は code のみ**(slotId なし)。accepted は `dispatch.overlay` から slotId+value を持つが、rejected の slotId 取得は dispatch/validation の拡張(Domain A の再変更)を要するため、UX の要点「rejected+code」に絞り slotId を省いた。mockup の rejected 行の slotId は省略(最小追加の範囲)。必要なら follow-up で dispatch に logSlotId を足せる。
4. **preload contract は自己完結**(main の wire 契約を import しない)。protocolVersion=number, code=string で受け、bridge handler(main)が権威型→この形へ写す。renderer/preload と main の層分離を保つ。
5. **LiveControllerPage/StagePage の新prop は optional(default false)**。既存 tracking テストの call site を無改変にするため。app は常に値を渡す。InputPage/MappingPage/StageMotionPanel/OverviewPage の新propは required(直接renderの既存テスト無し)。
6. **複数接続=許容+全clearAll 据え置き**(§7)。
7. **endpointUrl は Open/Connected のみ非null**(port は bind 後判明)。Closed/tracking は null → mockup の「(Open後)URL表示」と一致。

質問(Orch/Undine判断が要る点、blocking なし):
1. **Domain A 追加2点(§1)の受容確認**。read-only 観測 seam・既存挙動不変だが、Domain A ファイルへの追加のため明示報告。不可なら escalate(代替は bridge が server を wrap する形だが、reject/connect/disconnect は server 内でしか観測できず、seam 無しでは UX の Recent Events が実装不能)。
2. **Recent Events の rejected 行に slotId を出すか**(§10-3)。現状 code のみ。mockup 準拠で slotId も要るなら dispatch への logSlotId 追加(Domain A 変更)が要る。v0 は code のみで足りると判断。

blocking な質問はなし(全機械ゲート緑、無退行、無変更制約遵守)。

## ループ2追記(test adequacy 指摘の欠落埋め)

3レーンレビュー合格(blocking ゼロ)。Domain A 追加2点も受容。test adequacy から1点(Header degraded のテスト欠落)+任意1点(`activeOverlays` 直接ユニット)を追記。**テスト追加に徹し、Domain A/B の他ファイルは無変更**。

### 追加/変更ファイル
- `control/control-window-app.tsx`(自ファイル): Header の inline ternary を**純ヘルパ2本に抽出**(挙動不変)。`getControlWindowHeaderInputLabel`・`getControlWindowHeaderInputTone`(export)。ShellのinputLabel/inputTone がこれを呼ぶ。テスト可能な seam 化のみで、レンダリング挙動は同一。
- `control/control-window-degraded.test.ts`: Header テスト2件追加(計6→8)。
  1. 自律ホスト → label `"Drive: Physiology"`・tone `"teal"`。
  2. トラッキングホスト(receiving inputStatus)→ label が `"Drive: Physiology"` でなく、既存 formatter への委譲(`getInputStatusPillLabel/Tone(inputStatus)` と一致)= **退行なし**を固定。
- `main/control-channel/control-channel-overlay-store.test.ts`(Orch 指定の追記先): `activeOverlays` 直接ユニット2件追加(計5→7)。
  1. 残TTL=**相対値**(`expiresAtMs - nowMs`=300)、絶対 expiresAtMs 非露出。
  2. 空store → `[]`、失効境界(`expiresAtMs` ちょうどで除外)・複数slotの未失効のみ返却。

### テスト結果(ループ2)
- **typecheck**: pass。
- **focused(`src/control` + `src/main/control-channel`)**: `pnpm -C apps/runtime-player exec vitest run -c vitest.config.ts src/control src/main/control-channel` → **23 files / 118 tests 全 pass**(Header +2・activeOverlays +2 を含む。Domain A/B の control-channel 既存テスト無退行)。
- 既知 baseline(Wave21 browser-source系2件)は本 focused 範囲外(未接触)。全体 suite の 2 failed は §9 と同一・因果無関係。

### 繰延(Undine 報告事項・今回は非対象)
Recent Events の rejected 行 slotId・connected 行 client IP(mockup 忠実性)は Domain A/UX 変更を要するため v0 繰延。
