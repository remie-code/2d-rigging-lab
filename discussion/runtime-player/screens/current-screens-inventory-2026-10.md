# 今の画面の棚卸し(2026-10、サムネ用スクショ機能の検討材料)

> Status: 調査メモ(2026-10-28、master `8450062a` 時点)。
> Sylph による調査。設計判断ではない。置き場・保存体験の推奨は書かない。事実には `path:line` を付け、推測は【推測】と書く。
> 目的: 「背景透過のチャッピー(Live2D)を、窓に映っているそのままの大きさ・ステージ全体・その瞬間で PNG に撮る」機能の未決事項(撮る操作の置き場、保存先と保存の体験)を、今の画面の姿から考えるための材料。

パス略記: `RP/` = `apps/runtime-player/src/`、`AG/` = `apps/soul/agent/`。

---

## 1. 器(Runtime Player)の画面一覧

器は Electron アプリで、窓は **Control Window**(操作用)と **Stage Window**(透明・モデルのみ)の 2 枚。加えて OBS 用の **Browser Source** ページ(OBS 側のブラウザで開く)がある。起動ロールは `Tracking Host` / `Autonomous Host` の 2 種(`RP/main/profile-slots/host-role.ts:32-35`)で、Control Window のヘッダにロールのバッジが出る(`RP/control/control-window-shell.tsx:20-32,100`)。チャネル(魂からの頼み)は Autonomous Host だけが持つ(`RP/main/runtime-player-main.ts:496-501`)。

### 1.1 Control Window の骨組み

- ヘッダ(常時表示): 状態のピル 4 つ(Model / Input / Profile / Live)とボタン 3 つ `Open Export` / `Look Forward` / `Focus Stage`(`RP/control/control-window-shell.tsx:105-139`)。
- 左ナビ: 9 ページ(`RP/control/control-window-shell.tsx:45-58`)。初期ページは `overview`(`RP/control/control-window-app.tsx:100`)。
- アプリメニュー/トレイ: `Show Control Window` / `Focus Stage` / `Disable Click-through` / `Quit Runtime Player` の 4 項目のみ(`RP/main/window-management/runtime-player-tray-menu.ts:105-136`)。グローバルホットキーの登録は器には無い(`globalShortcut` の使用なし)。
- 操作結果は Control Window の feedback 文言で返す流儀(例: `Performance diagnostics report copied.` `RP/control/control-window-app.tsx:477-485`)。

### 1.2 ページ一覧

「使う場面」は、コード内の注記と `discussion/runtime-player/screens/` の文書の記述からの整理。文書に根拠が無いものは【推測】。

| ページ | 使う場面 | 主なパネル / 操作 | file:line |
|---|---|---|---|
| Overview | 起動直後・配信前に「揃っているか」を見る | Input Source / Input Profile / Mapping・Live / Model / Physiology / Channel の要約。`Look Forward`・`Start Calibration`・`Open Mapping`・`Retry Restore`・`Open Physiology`・`Open Channel` など各ページへの導線 | `RP/control/overview-page.tsx:55,144-376` |
| Live Controller | 配信中の即時操作(文書: `live-controller-page.md`) | Status / Variants(`Reset to Model Default`)/ Recenter(`Look Forward`)/ Motion Safety(Stage Motion のトグル)/ View Recovery(`Center Model`) | `RP/control/live-controller-page.tsx:35,85-163` |
| Input | 配信前の準備(iFacialMocap 接続・キャリブレーション)。Autonomous Host では「No tracking input on this host」 | Source(接続/`Disconnect`)/ Input Profile(`Run Missing Only`・`Full Calibration` 等)/ Input Calibration(`Record Sample`・`Save Profile` 等) | `RP/control/input-page.tsx:40,93-351` |
| Mapping | 調整(Tracking Host)。Autonomous Host では「No tracking input on this host」 | Mapping Profile(`Reset to Auto Map`)/ Mapping Readiness / Semantic Slots(Invert・Strength・Lag) | `RP/control/mapping-page.tsx:35,67-514` |
| Dynamics Tune | 調整(揺れものの強さ等) | Dynamics Tune(自動保存の状態・`Retry`)/ Dynamics Groups | `RP/control/dynamics-tune-page.tsx:79,97-269` |
| Physiology | 調整(Autonomous Host の生理: まばたき等) | Blink / Gaze / Head / Posture / Speech / Stage Presence | `RP/control/physiology-page.tsx:47-141,143,162-330` |
| Channel | 配信前に魂との接続口を開く。配信中の受理/拒否の確認 | Channel(`Open Channel`/`Close`・Endpoint・`Copy Channel URL`)/ Live(上書き中のスロット)/ Recent Events | `RP/control/channel-page.tsx:17-25,39-104` |
| Stage | 表示まわりの設定(窓の位置・大きさ、表示の拡大・パン、OBS 出力、透明窓の性質) | 下記 1.3 | `RP/control/stage-page.tsx:38,94-330` |
| Performance Diagnostics | 低優先度の計測(文書: 通常の live 操作導線とは分ける) | Target / Duration 選択、`Start Capture`・`Stop Capture`・`Copy Report`・`Clear Report`、Report Preview | `RP/control/performance-diagnostics-page.tsx:76,211-356` |

### 1.3 Stage ページの中身(表示まわりの操作が並ぶページ)

上から順に(`RP/control/stage-page.tsx`):

1. **Stage Window** パネル: Status / Position / **Size**(窓の bounds)/ Render、`Focus Stage`・`Arrange Stage`(`:94-126`)
2. **View** パネル: Zoom / Pan、`Reset View`・`Center Model`(`:128-158`)
3. **Stage Motion** パネル(`:161-168`、中身は `RP/control/stage-motion-panel.tsx:41-220`)
4. **Browser Source Output** パネル: URL・Server・Port・URL Token・**Recommended OBS Size**・Clients・Local Preview・WebGL2・各種 FPS、`Copy URL`(`:171-174`、中身は `RP/control/browser-source-output-panel.tsx:31-104`)
5. **Local Preview / Fallback** パネル: Stage Window / Runtime Export / Model / `Background: Transparent`(固定表示)/ Stage UI / Window Title / Click-through / Always on top、`Enable/Disable Click-through`・`Enable/Disable Always on Top`・`Copy Window Title`(`:176-244`)
6. **Auto Save** パネル: Status / Updated / Storage(`window-state/runtime-player.json` を相対表記で表示)(`:246-265`)
7. **Startup** パネル: 前回の Runtime Export・Storage(`startup-state/runtime-player-startup.json`)、`Retry Restore`・`Open Runtime Export`(`:267-310`)

---

## 2. ステージの描画と透明・サイズ

### 2.1 Stage Window(Electron の透明窓)

- 窓の生成オプション: `frame: false`, `transparent: true`, `hasShadow: false`, `backgroundColor: "#00000000"`, `backgroundThrottling: false`(`RP/main/window-management/browser-window-options.ts:45-72`)。
- 既定サイズ 720×900、最小 360×480(`browser-window-options.ts:14-19`)。前回の bounds は Window State から復元(`browser-window-options.ts:75-94`、`RP/main/window-management/runtime-player-windows.ts:215-235`)。
- 中身は `<main class="stage-window-shell">` に `<canvas class="stage-render-canvas">` 1 枚と、Arrange 中だけ出るオーバーレイ(`RP/stage/stage-window-app.tsx:247-261,293-310`)。
- CSS: body/root/shell/canvas すべて `background: transparent`、canvas は `100vw × 100vh`(`RP/styles/global.css:26-50`)。Arrange オーバーレイは canvas の上に重なる別要素(枠線・薄い緑のグラデーション・ドラッグ用ハンドル)(`global.css:52-96`)。
- **canvas のピクセル数** = 窓の CSS サイズ × `devicePixelRatio`(下限 1)。描画のたびに合わせる(`RP/stage/stage-renderer/static-stage-canvas-renderer.ts:892-910,940-944`)。
- Stage ページの `Size` 表示は窓の bounds(`stage-page.tsx:100`)。【推測】Electron の bounds は DIP 単位なので、DPI 拡大が 100% でない環境では canvas の実ピクセル数と一致しない。

### 2.2 WebGL2 の設定

- 器の Stage も Browser Source も同じ描画部品 `createStaticStageCanvasRenderer` → `createWebGl2RendererFromCanvas` を使う(`static-stage-canvas-renderer.ts:107-117`、`RP/stage/browser-source/browser-source-stage-renderer.ts:49-55`)。
- コンテキスト属性: `alpha: true`, `antialias: true`, `premultipliedAlpha: true`, `stencil: false`。**`preserveDrawingBuffer` は指定なし(= 既定の false)**(`packages/render-webgl2/src/webgl2-renderer.ts:281-292`、Browser Source 側の事前確認も同じ属性 `browser-source-stage-renderer.ts:118-133`)。
- 毎フレーム `clearColor(0,0,0,0)` で透明クリア、ブレンドは `ONE, ONE_MINUS_SRC_ALPHA`(premultiplied)(`webgl2-renderer.ts:111-118`)。
- 描画は「変化があったら rAF で 1 回」の方式(常時ループではない)。`requestScheduledRender` が rAF を 1 本だけ予約し(`static-stage-canvas-renderer.ts:549-563`)、即時描画(`renderCurrentImmediate`)の呼び出し箇所も複数ある(`:193,222,269,285,321,336,381,526,639`)。
- レンダラの公開メソッドに読み出し(画像化)系は無い(`static-stage-canvas-renderer.ts:53-78`)。

### 2.3 Browser Source(OBS 用)

- 器のメインプロセスが loopback の HTTP/WebSocket サーバを立て、OBS がその URL(token 付き)を開く。ページは model-only の Stage クライアント(`RP/main/broadcast-source/`、`RP/stage/browser-source/`)。
- CSS は html/body/root/shell/canvas すべて透明・`pointer-events: none`(`RP/styles/global.css:98-130`)。
- 表示サイズは OBS のブラウザソースの幅・高さで決まる。器は `Recommended OBS Size` として **Stage Window の bounds の幅×高さ** を表示するだけ(`RP/control/browser-source-output-panel.tsx:177-190`)。
- ブラウザソース → 器 の WebSocket メッセージは `browser-source-resync-request` / `browser-source-client-heartbeat` / `browser-source-renderer-diagnostics` の 3 種のみ(`RP/main/broadcast-source/browser-source-client-message.ts:29-43`)。
- **Browser Source が接続中は、器の Stage Window へ live frame を届けない**(`deliverToStageWindow: !localPreviewLiveRenderPolicy.isSuspended()`、`RP/main/runtime-player-main.ts:408-414`、切断後 2 秒の猶予で再開 `RP/main/broadcast-source/local-preview-live-render-suspension.ts:29`)。Control 側には「Live rendering suspended while Browser Source is connected」と出る(`browser-source-output-panel.tsx:218`)。【推測】この間 Stage Window の canvas は最後に描いた姿のまま止まる。

---

## 3. 器のファイル入出力の体験

### 3.1 ダイアログ

- 使っているのは **フォルダを開くダイアログ 1 つだけ**: `Open Runtime Export`(`properties: ["openDirectory"]`、親は Control Window)(`RP/main/runtime-export-loader/runtime-export-bridge-handlers.ts:79-83`)。ヘッダの `Open Export`、Stage ページ Startup の `Open Runtime Export` などから開く。
- 保存ダイアログ(`showSaveDialog`)、「フォルダを開く」(`shell.openPath` / `shell.showItemInFolder`)は **器のどこにも無い**(`RP/` 全体を grep して該当なし)。

### 3.2 決まった場所への自動保存(userData 配下)

- userData はスロットごとに `<既定 userData>/slots/<slotName>` へ差し替える(`app.setPath("userData", …)` `RP/main/runtime-player-main.ts:150-153`、`RP/main/profile-slots/slot-paths.ts:17-33`)。既定スロット名は `tracking-default` / `autonomous-default`(`host-role.ts:40-43`)。
- 【推測】既定 userData の実体は `%APPDATA%\<アプリ名>`。開発起動時のアプリ名が `package.json` の `name` か `build.productName`(`Runtime Player`)かは未確認(`productName` は electron-builder 設定の中 `apps/runtime-player/package.json:49-51`)。

| 保存物 | userData からの相対パス | 根拠 |
|---|---|---|
| 窓の位置・大きさ・always-on-top・Stage Motion 設定 | `window-state/runtime-player.json` | `RP/main/window-state/window-state-store.ts:42-46` |
| 前回の Runtime Export のフォルダ | `startup-state/runtime-player-startup.json` | `RP/main/startup-state/runtime-player-startup-state-store.ts:43-47` |
| Browser Source の設定(port・token) | `browser-source/browser-source-config.json` | `RP/main/broadcast-source/browser-source-config-store.ts:52-56` |
| Channel の設定(port・token) | `channel/channel-config.json` | `RP/main/control-channel/channel-config-store.ts:62-66` |
| Input Profile | `input-profiles/ifacialmocap/profiles.json` | `RP/main/input-profiles/input-profile-store.ts:41-46` |
| Mapping / Dynamics / Physiology の Profile | `<種類>-profiles/<safePackageId>/<fingerprint>.json` | `model-mapping-profile-store.ts:47-62`、`dynamics-tuning-profile-store.ts:49-64`、`physiology-profile-store.ts:58-75` |
| チャネルの診断ログ | `ai-cohost-fire-diagnostics/runtime-player/control-channel.jsonl`(起動ごとに空にして 1 ファイルだけ) | `RP/main/control-channel/fire-diagnostics.ts:10-14,70-79` |

- 画面上の見せ方: Stage ページの Auto Save / Startup パネルが `Storage` として相対パスを文字で表示する(`stage-page.tsx:256,277`、`RP/main/window-state/window-state-controller.ts:69`)。Mapping / Dynamics / Physiology も「Persistence: Automatic」と状態の文言を出す(`dynamics-tune-page.tsx:111`、`physiology-page.tsx:168`)。フォルダを開く手段は無い。

### 3.3 「書き出し・報告」はクリップボード

ファイルへのエクスポートは無く、すべてクリップボードへのコピー:

- Performance Diagnostics の `Copy Report`(`RP/control/control-window-app.tsx:477-485`、`writeClipboardText` は `navigator.clipboard` → 失敗時 `execCommand("copy")` `:1401-1421`)
- Input の診断コピー(`control-window-app.tsx:446`)、Browser Source の `Copy URL`(`:461`)、Channel の `Copy Channel URL`(`:596`)
- `Copy Window Title` だけはメインプロセスの `clipboard.writeText`(`RP/main/stage-view-bridge-handlers.ts:561-568`)

---

## 4. 操縦席(cockpit)の画面一覧

操縦席は Electron ではなく、**魂のプロセス(Node)が 127.0.0.1 に立てる小さな HTTP サーバのページを、普通のブラウザで開く**もの(`AG/scripts/cockpit.mjs:1-10`、`AG/src/cockpit/cockpit-server.mjs:115,140-162`)。`--open` で既定ブラウザを開ける(`cockpit.mjs:143,161,2350`)。UI は preact(htm)で、`AG/src/cockpit/ui/app.mjs` が全体を組む。

文書上の前提: 配信者だけが別モニターで横目で見る画面。**配信中は操縦席を操作しない**、発火と KILL はホットキー(`discussion/ai-cohost/implementation/screens/cockpit-glance-redesign.md` §1-§2)。

### 4.1 メイン画面

| 区画 | 中身 | file:line |
|---|---|---|
| 上の細い帯(TopBar) | 名前・頭のモデル名・状態のピル(聞いてる/考えてる/喋ってる/圧縮中)・異常時だけの警告・残量ゲージ 2 本・小さな KILL(KILL 中は帯が赤く復帰ボタン) | `AG/src/cockpit/ui/header.mjs:1-15`、`app.mjs:325-338` |
| 会話タイムライン(左・主役) | 配信前(耳が止まっている間)は中央に「準備・設定を開く」 | `app.mjs:340`、`ui/conversation.mjs` |
| コメント(右) | 視聴者コメント | `app.mjs:341`、`ui/comments.mjs` |
| 下の細い帯 | 運転設定の表示・遅延の凡例・歯車「準備・設定」 | `AG/src/cockpit/ui/bottom-bar.mjs:1-25`、`app.mjs:343` |

### 4.2 準備・設定(モーダル、6 タブ)

タブ定義 `AG/src/cockpit/ui/settings-drawer.mjs:138-145`、見出し「準備・設定」`:811`。

| タブ | 主な操作 | file:line |
|---|---|---|
| 接続 | 器(Channel)の URL 入力 + `Set`、YouTube の `Connect`/`Disconnect` | `settings-drawer.mjs:833-884` |
| 入出力 | マイク + Start/Stop、文字起こし、声、声の出力先、視界(ゲーム窓)の選択 | `settings-drawer.mjs:886-962` |
| 頭脳・会話 | 頭脳の選択 + Set、会話指示の編集(同じダイアログ内で切替)、圧縮を始める大きさ、Codex の fast | `settings-drawer.mjs:964-1043` |
| 記憶 | `今日を記録` ボタンと「最後に記録: HH:MM:SS」 | `settings-drawer.mjs:1045-1055`、`AG/src/cockpit/view-logic/settings.mjs:205-209` |
| 運転 | 自発・かぶり・口数・話し始め・忙しい間のコメント、手動の発火 `🎤 Fire` / `🖼 Fire+視覚`(旧運転バー) | `settings-drawer.mjs:1057-1059`、`AG/src/cockpit/ui/control-bar.mjs:84-85,96-191,376-388` |
| ログ | 一目の健康(HealthLine)+ 観測フィード | `settings-drawer.mjs:1061-1062`、`app.mjs:369-371` |

### 4.3 操縦席サーバの API(ブラウザ → 魂)

`AG/src/cockpit/cockpit-server.mjs:1636-2076` に GET/POST の分岐が並ぶ: `/api/state`・`/api/events`(SSE)・`/api/ears/start|stop`・`/api/fire`・`/api/vision-fire`・`/api/kill`・`/api/channel`・`/api/brain`・`/api/memory-record` ほか。ホットキー(AutoHotkey)も同じ HTTP を叩く(`AG/scripts/fire-hotkey.ahk:5-7,34-45,50-65`: Ctrl+Alt+F 発火 / Ctrl+Alt+G 視覚発火 / Ctrl+Alt+K KILL)。

---

## 5. 操縦席 → 器 の頼みの経路

### 5.1 経路

1. 器の Channel ページで `Open Channel`(起動時は Closed `RP/main/runtime-player-main.ts:496-501`)→ `Copy Channel URL`。
2. 操縦席の「接続」タブに URL を貼って `Set` → `POST /api/channel`(`cockpit-server.mjs:1968-1982`)→ `onSetChannelUrl`(URL を設定ファイルに記憶)(`AG/scripts/cockpit.mjs:2108-2119`)。
3. 実際の WebSocket 接続は **最初の発火のときに張る lazy 接続**(`createLazyChannel` `cockpit.mjs:200`、方針の注記 `cockpit.mjs:39-44`)。
4. 魂側クライアント `connectChannel` が `server.hello` を待ち、`supportedKinds` に必須 kind があるか照合(`AG/src/channel/channel-client.mjs:1-16,81,180-190`)。
5. 器側: `ws://127.0.0.1:<port>/channel?token=…`(`RP/main/control-channel/channel-url.ts`)→ `channel-server.ts` → `dispatchControlChannelRequest`(`RP/main/control-channel/channel-request-dispatch.ts:111-157`)→ overlay store へ書き込み(`channel-server.ts:320-360`)。

- 操縦席サーバ(`cockpit-server.mjs`)自身はチャネルの中身を知らず、チャネルを使うのは発火の orchestrator(`cockpit-server.mjs:1976-1978` の注記、`cockpit.mjs:17-19`)。

### 5.2 契約の形(intent.*)

- 封筒: 要求 `{ v:1, id, kind, payload }` → 応答 `{ v:1, replyTo, result: "accepted" }` または `{ …, result: "rejected", error:{ code, message } }`(`RP/main/control-channel/contract/channel-protocol-contract.ts:68-102`)。**応答に結果データ(パス・画像など)を載せる欄は無い。**
- 今の kind: `intent.set` / `intent.envelope` / `intent.speech` / `intent.speechStream`(`channel-protocol-contract.ts:35-40`)。拒否コードは 6 種で固定列挙(`:56-63`)。
- 足し方の既存の形(各 kind のコメントに「ADDITIVELY」とある `:13-18,28-33`):
  - 器: `supportedKinds` に追加 → JSON の正本(`contract/channel-*-payload-schema.json`、`channel-exchange-examples.json`)を足す → TS 型を `channel-protocol-contract.test.ts` でバイト同期 → `channel-request-dispatch.ts` に分岐を足す。
  - 魂: `channel-client.mjs` に送信メソッドを足す(参照ドライバ `apps/soul/reference-driver/reference-driver.mjs` から写経する流儀 `channel-client.mjs:18-41`)。必須 kind に入れるかは kind ごとに判断されてきた(`intent.set` は入れていない `channel-client.mjs:30-31`)。
- 今の dispatch は **同期**で、結果は overlay store への書き込みだけ(`ControlChannelRequestDispatch` 型 `channel-request-dispatch.ts:80-89`、`#handleClientMessage` `channel-server.ts:320-336`)。チャネルサーバのオプションに窓への参照は無い(`channel-server.ts:99-114`)。
- 器の中で Control → main の頼みは別系統(preload の bridge → `ipcMain.handle`)。Stage まわりのチャネル名一覧 `RP/preload/stage-view-bridge-channels.ts:1-28`、ハンドラ `RP/main/stage-view-bridge-handlers.ts:127-176`。

---

## 6. 操縦席のファイル入出力の体験

保存先はすべて **リポジトリ内 `apps/soul/agent/` 直下**(userData のような OS 側の場所ではない)。

| 保存物 | 場所 | 根拠 | 画面での見せ方 |
|---|---|---|---|
| 設定(マイク・Channel URL・頭脳・各トグル等) | `cockpit-settings.local.json` | `AG/src/cockpit/cockpit-settings-store.mjs:115-116` | 各タブの選択肢の初期値として復元されるだけ。パスの表示なし |
| 記憶 | `memories/`(別の git) | `AG/src/memory/memory-store.mjs:25-29,40` | 記憶タブの「最後に記録: 時刻」だけ |
| 発火の診断 | `fire-diagnostics/fire-<時刻>-<連番>.jsonl` | `AG/src/mind/fire-diagnostics.mjs:9,126` | 画面表示なし |
| セッションの使用量 | `session-usage/` | `AG/src/mind/session-usage-log.mjs:25` | 画面表示なし(ログのタブに usage の文言) |
| Codex の記録の台帳 | `codex-rollouts.local.json` | `AG/src/mind/codex-session.mjs:84`、起動時の掃除 `cockpit.mjs:1540-1546` | 画面表示なし |

- 操縦席の UI(ブラウザ)にはダウンロード・`Blob`・`createObjectURL`・クリップボードのコードは無い(`AG/src/cockpit/ui`・`view-logic` を grep して該当なし)。ファイル選択ダイアログ・「フォルダを開く」も無い。
- 標準出力に 1 行ログを出す流儀がある(例: `formatReplyLatencyLine` `cockpit.mjs:1506-1517`、channel set の行 `:2116-2118`)。

---

## 7. 撮る機能に関係しそうな既存の部品(事実のみ)

- **`capturePage` / `toDataURL` / `toBlob` / `readPixels` / `preserveDrawingBuffer` / `nativeImage` からの画像書き出し / `showSaveDialog` は、`apps/` と `packages/` のどこにも使われていない**(grep で該当なし。`nativeImage` はトレイアイコン生成のみ `RP/main/window-management/runtime-player-tray-menu.ts:159`)。
- Stage Window は main 側から `BrowserWindow` として参照できる(`windows.stageWindow`、`RP/main/runtime-player-main.ts:200-205`)。Control からの頼みを main で Stage 窓に対して実行する前例: `Copy Window Title`(`stage-view-bridge-handlers.ts:561-568`)、Focus / Click-through / Always-on-top(`:175-176` ほか)。
- canvas の読み出しについて今の設定から言えること:
  - `preserveDrawingBuffer` 未指定(false)なので、WebGL の仕様上、合成後に描画バッファの中身は保証されない。【推測】描画と同じタスク内(`renderCurrent` の直後)で読むか、読む直前に描き直す必要がある。描画は変化時の rAF 駆動(2.2)。
  - `premultipliedAlpha: true`・透明クリア・premultiplied ブレンド(2.2)。【推測】`toBlob`/`toDataURL` は un-premultiply して PNG にするので、半透明の縁は保たれる見込み。
  - canvas のピクセル数 = 窓の CSS サイズ × DPR(2.1)。
- `capturePage` について:
  - Electron は `^42.4.1`(`apps/runtime-player/package.json:41`)。【未確認】この版・Windows・`transparent: true` の窓で `capturePage()` の結果がアルファを保つかは実機未確認。
  - Arrange 中はオーバーレイ(枠線・ハンドル)が canvas の上に乗る(`global.css:52-96`)。canvas の読み出しには入らず、窓のキャプチャには入る【推測】。
  - Browser Source 接続中は Stage Window の live 描画が止まる(2.3)ので、そのとき Stage Window は「その瞬間」の姿でない可能性がある【推測】。
- 魂側の既存の「撮る」部品: 視界(ゲーム窓)の撮影は PowerShell 常駐 + `PrintWindow(hwnd, hdc, 2)` → 長辺 1024 に縮小 → **JPEG 75** → base64(メモリ上、ファイル保存なし)(`AG/src/eyes/resident-capture.mjs:6-17,71-123`)。JPEG なのでアルファは持たない。
- Browser Source ページ(OBS 内)からは、器へ送れるメッセージが 3 種の診断系だけ(2.3)。

---

## 8. 文書と実装のずれ(`discussion/runtime-player/screens/`)

- ナビのページ数: `_map.md` と `control-window-screen-structure.md`(§3 Navigation)は 7 ページ(Overview / Live Controller / Input / Mapping / Dynamics Tune / Stage / Performance Diagnostics)。実装は **Physiology と Channel を加えた 9 ページ**(`control-window-shell.tsx:45-58`)。この 2 ページの画面文書は `screens/` には無く、`discussion/ai-cohost/implementation/` 側にある(例: `screens/c4-channel-diagnostics.md`、`waves/c3/domain-c-physiology-page-profile.md`)。
- ロールのバッジ(Tracking Host / Autonomous Host)と、Autonomous Host での Input / Mapping の空状態「No tracking input on this host」は `screens/` の文書に記述が無い(`input-page.tsx:95`、`mapping-page.tsx:69`)。
- `control-window-screen-structure.md` 冒頭の要約は「Wave8 で Capture Target checklist を追加」と書くが、今のコードに `Capture Target` という表示名は無い。対応する行は `Local Preview / Fallback` パネルにある(`stage-page.tsx:176-244`)。
- Live Controller: 文書の責務表は「Stage Motion On/Off」、実装のパネル名は `Motion Safety`(Physiology 駆動時は「Driven by Physiology」)(`live-controller-page.tsx:127-140`)。`live-controller-page.md:112` の図には `Motion Safety` がある。
- ヘッダの将来操作 `Hide Control` / `Settings`(文書 §2)は未実装のまま。
- 一致している点: ヘッダの 3 ボタン、Stage ページの Stage Window / View / Stage Motion / Browser Source Output / Local Preview / Auto Save / Startup の構成、Window State の保存先表記。

---

## 9. 未確認のこと

1. `transparent: true` の Stage Window に対する `webContents.capturePage()` が、Electron 42 / Windows 11 でアルファ付きの画像を返すか(実機で未検証)。
2. 窓が最小化・隠れている・他の窓に覆われているときの `capturePage` の結果。
3. DPI 拡大が 100% でない環境で、Stage ページの `Size` 表示と canvas の実ピクセル数がどう違うか(2.1 の【推測】)。
4. 開発起動時の userData の実パス(アプリ名が何になるか)。
5. Browser Source 接続中に Stage Window の canvas が「最後の姿で止まる」のか、別の状態になるのか(2.3 の【推測】)。
6. チャッピーが普段どちらの出力(器の Stage Window を OBS のウィンドウキャプチャで / Browser Source で)で配信に載っているか。コードからは決まらない。
7. 魂の視界の窓一覧(`AG/src/eyes/window-list.mjs`)に器の Stage Window が出るか(未読)。
