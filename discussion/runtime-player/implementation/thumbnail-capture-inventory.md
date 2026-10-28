# Capture PNG 実装前の棚卸し(サムネ用の透過スクショ)

> Status: 調査メモ(2026-10-28、master `8450062a` + 作業ツリー時点)。
> Sylph による調査。設計判断ではない。どの値・経路・置き場を選ぶかは書かない。事実には `path:line` を付け、推測は【推測】と書く。
> 前提: [../screens/current-screens-inventory-2026-10.md](../screens/current-screens-inventory-2026-10.md)(画面の棚卸し)と [../screens/thumbnail-capture.md](../screens/thumbnail-capture.md)(合意)。そこに書いてあることは繰り返さない。

パス略記: `RP/` = `apps/runtime-player/src/`。

---

## 1. モデルの名前

### 1.1 読み込んだ Runtime Export から取れる名前の候補

| 候補 | 中身の出どころ | どこで持っているか |
|---|---|---|
| `summary.modelDisplayName` | manifest の `sourcePackage.packageDisplayName`(`RP/main/runtime-export-loader/runtime-export-directory-loader.ts:333`)。schema は `z.string().min(1)` だけで、文字の制限なし(`packages/package-format/src/runtime-export.ts:109-114`) | main・Control・Stage(下記) |
| `summary.packageId` | manifest の `sourcePackage.packageId`(`runtime-export-directory-loader.ts:334`)。形式は `pkg_<token>`(`packages/contracts/src/ids.ts:26-29`) | 同上 |
| フォルダのパス `directoryPath` | 開いた Runtime Export のフォルダ。`RuntimeExportLoadedStatus.directoryPath`(`RP/preload/runtime-export-bridge-contract.ts:82-90`) | main の `RuntimeExportSessionState`(`RP/main/runtime-export-loader/runtime-export-session-state.ts:11-90`)と Control。**Stage が受け取る `RuntimeExportLoadedPayload` には入っていない**(`runtime-export-bridge-contract.ts:49-61`) |

- 既存の「ファイル名に安全な形へ直す」関数: `createSafePackageId`(`[^A-Za-z0-9._-]` を `_` にし、元と違えば sha256 の 12 桁を付ける)(`RP/main/model-mapping-profiles/model-mapping-export-identity.ts:53-64`)。Profile の保存先フォルダ名に使われている(棚卸し §3.2)。表示名用のものは無い。

### 1.2 main と Control が持っているもの

- **main**: `loadedModelName`(= `payload.summary.modelDisplayName`)を変数で持つ(`RP/main/runtime-player-main.ts:187,206-210,596`)。読み込み切り替え中・解除時は `null`(`:573,615`)。窓のタイトルとトレイのツールチップに使う(`:189-205,668-672`、`RP/main/window-management/window-title.ts:25-42,71-84`)。
  - Stage の窓タイトルは `Runtime Player Stage — <ロール> — <モデル名>`(区切りは全角ではなく em dash + 空白 `window-title.ts:15`)。
  - `registerRuntimeExportBridgeHandlers(...)` の戻り値(session)は main で変数に受けていない(`runtime-player-main.ts:550`)。
  - Stage 系のハンドラ登録(`registerStageViewBridgeHandlers`)は `:350`、Runtime Export 系は `:550` で、Stage 系の入力にモデル名・Runtime Export の状態は渡っていない(`RP/main/stage-view-bridge-handlers.ts:33-42`)。
- **Control**: `runtimeExportStatus`(loaded のとき `summary` と `directoryPath` を持つ)を state で持つ。
  - **ヘッダの Model ピルは名前を出さない**。`Model Loaded` / `Model Loading` / `Model Error` / `Model No` のどれか(`RP/control/control-window-shell.tsx:109-111`、`RP/control/control-window-formatters.ts:167-183`)。
  - 名前(`modelDisplayName`)を出している所: Overview の Model 行(`RP/control/overview-page.tsx:277-280`)、Mapping / Dynamics Tune / Physiology の Model 行(`mapping-page.tsx:82`、`dynamics-tune-page.tsx:100`、`physiology-page.tsx:165`)、Live Controller の Browser Source 行(`<状態>: <名前>` `browser-source-output-panel.tsx:336-339` を経由)、読み込み時の feedback `Runtime Export loaded: <名前>`(`control-window-app.tsx:1336,1359`)。
  - Mapping ページは `packageId` も出す(`mapping-page.tsx:90`)。Overview は `Directory` 行にフォルダのパスを出す(`overview-page.tsx:272-274`)。
  - Live Controller の Status / Model 行と Stage ページ Local Preview の Runtime Export 行は「Loaded」等の状態だけで名前は出さない(`live-controller-page.tsx:87-90,315-331`、`stage-page.tsx:182-184,314-334`)。

### 1.3 ユーザーの実データ(userData とスロットの startup-state)

- 実際に使われている userData は `%APPDATA%\@private-2d-rigging-lab\runtime-player`(= `package.json` の `name`)。`Runtime Player`(productName)という名前のフォルダは `%APPDATA%` に無い。autonomous-default スロットは本日 07:33 に更新されている。→ 棚卸し §9-4 の「アプリ名がどちらか」は、この PC で使われている起動方法では `name` 側。【推測】パック版・開発起動のどちらで起動しているかまでは分からない。
- 各スロットの前回の Runtime Export(`startup-state/runtime-player-startup.json`):

| スロット | フォルダ | `packageDisplayName` | `packageId` | revision |
|---|---|---|---|---|
| `autonomous-default` | `C:\workspace\remie\rigging\astra-chan\exports\astra-chan-runtime` | `Untitled model` | `pkg_editor_workspace` | 335 |
| `tracking-default` | `C:\workspace\remie\rigging\second-rigging-6-sol\runtime-export` | `Untitled model` | `pkg_editor_workspace` | 2149 |
| (スロット化前の root) | `C:\workspace\remie\rigging\second-rigging-fable-export`(今は存在しない) | — | — | — |

- **両方のモデルとも表示名は `Untitled model`、packageId も同じ `pkg_editor_workspace`**。これは Editor の新規セッションの既定値(`apps/editor/src/features/editor-session/model/empty-authoring-session.ts:9-12`)。Editor のソースに `packageIdentity` を書き換える箇所は、新規作成とパッケージ読み込み(`packages/authoring-core/src/from-package-document.ts:17-19`)以外に見当たらない(grep)。【推測】今の Editor では表示名を変える UI が無く、どのモデルも `Untitled model` で書き出される。
- 「チャッピー」は魂側の頭脳の名前(`discussion/ai-cohost/implementation/orchestration/model-identity-wave-plan.md:41,50`)で、器の Runtime Export には `chappy` という値はどこにも無い。【推測】チャッピーの体は Autonomous Host(チャネルを持つ側)が読む `astra-chan-runtime`。
- そのまま使った場合の値:
  - `modelDisplayName` → `Untitled model-20261028-153012.png`(半角空白を含む。Windows の禁止文字 `<>:"/\|?*` と日本語は含まない)。
  - `packageId` → `pkg_editor_workspace-…`(2 体で同じ)。
  - フォルダ名 → `astra-chan-runtime`(自律)/ `runtime-export`(トラッキング)。1 つ上は `astra-chan` / `second-rigging-6-sol`。
- このPCのピクチャは `C:\Users\remie\Pictures`(`[Environment]::GetFolderPath('MyPictures')`、OneDrive への付け替えなし)。`Runtime Player` フォルダはまだ無い。

---

## 2. main → Stage Window の「頼んで結果を受け取る」経路

### 2.1 今ある形

- **main → Stage は `webContents.send` の一方通行だけ**。例: `sendToWindow`(`RP/main/stage-view-bridge-handlers.ts:279-294`)で `applyViewTransformRequested` / `arrangeStateChanged` 等を送る(`:75-81,216-247,254-260`)。
- **Stage → main は `ipcRenderer.invoke` → `ipcMain.handle`**。Stage が自分から報告する形(`reportStatus` / `reportViewTransform` / `reportRenderMetrics`、`RP/preload/runtime-player-stage-bridge.ts:72-88`、受け側 `stage-view-bridge-handlers.ts:138-167`)。
- **要求に id を付けて返事を待つ形(相関付きの往復)は器に無い**。`executeJavaScript`・`MessageChannelMain`・`ipcMain.on/once`・`ipcRenderer.send` は `RP/` の本番コードで使われていない(grep)。
  - 参考(リポジトリ外の一般事実): Electron で main から renderer の結果を受け取る手段には、`send` + renderer からの `invoke`(返事用チャネル)、`webContents.executeJavaScript`(Promise で値が返る)、`MessageChannelMain` がある。main から renderer へ `invoke` する逆向き API は Electron に無い。
- 返事の型の既存の形: Control への返事は `RuntimePlayerStageViewActionResult = { result: "ok"|"error", message, status, atIso }` 固定で、パスやバイト列の欄は無い(`RP/preload/runtime-player-bridge-contract.ts:173-178`)。
- バイト列を IPC で運んでいる前例: `RuntimeExportLoadedPayload.texturePage.bytes: Uint8Array` を main → Stage に `invoke` の戻り値と `send` の両方で渡している(`runtime-export-bridge-contract.ts:55-58`、`runtime-player-stage-bridge.ts:30-41`)。

### 2.2 Stage Window の preload / bridge の構成

| 役割 | ファイル |
|---|---|
| Stage 用 preload の入口 | `RP/preload/stage-preload.ts:1-3`(ビルド入口 `apps/runtime-player/electron.vite.config.ts:34`、読み込みパス `RP/main/window-management/renderer-entry-url.ts:12-13`) |
| `window.runtimePlayerStage` を作る | `RP/preload/runtime-player-stage-bridge.ts:27-108`(`contextBridge.exposeInMainWorld("runtimePlayerStage", …)` `:107`) |
| 型 | `RP/preload/runtime-player-stage-bridge-contract.ts:21-73`(`stageView` は `RuntimePlayerStageViewReporterApi` `:31-52`) |
| テスト | `RP/preload/runtime-player-stage-bridge.test.ts`、`runtime-player-stage-bridge.variants.test.ts` |
| Control 用(別物) | `RP/preload/preload.ts` → `runtime-player-bridge.ts`(`window.runtimePlayer`) |

- Stage 窓の webPreferences: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`, `backgroundThrottling: false`(`RP/main/window-management/browser-window-options.ts:65-71`)。
- Stage 窓は閉じられて作り直されることがある。`windows.stageWindow` は getter で、作り直し後の窓を返す(`RP/main/window-management/runtime-player-windows.ts:80-83,161-198`)。既存の操作は `isDestroyed()` なら `"Stage Window is not available."` を返す(`stage-view-bridge-handlers.ts:426-434,516-524`)。
- **境界テストの縛り**(`RP/runtime-player-boundary.test.ts`):
  - `control/`・`stage/` の本番ファイルは `electron` / `node:` を import しない、`ipcRenderer`・`BrowserWindow` の文字を含まない(`:10-23`)。
  - `stage/` の本番ファイルは `<button`・`Debug`・`Connect`・`Runtime Export` の文字を含まない(`:26-36`)。
  - Stage の bridge と契約は `RuntimePlayerApi`・`openDirectory`・`inputProfile` 等の文字を含まない(`:49-86`)。
  - `main/` は `../control`・`../stage` を import しない(`:89-103`)。

### 2.3 レンダラ側で「描いた直後に読む」ための入口

- canvas とレンダラの持ち主: `StageWindowApp` の `useEffect` 内のローカル変数 `renderer`(`RP/stage/stage-window-app.tsx:36-50`)。canvas は `canvasRef`(`:32,253-257`)。bridge のイベント購読もすべてこの effect の中(`:117-230`)、後始末 `:232-244`。
- レンダラの公開メソッドに「今すぐ描く」「画像を返す」は無い(`RP/stage/stage-renderer/static-stage-canvas-renderer.ts:53-78`)。
- `renderCurrentImmediate()` は **private**(`:639-641`)。呼ぶ公開メソッド: constructor(`:193`)、`setPayload`(`:222`)、`setActiveVariantSelection`(`:269,285`)、`setDynamicsTuning`(`:321,336`)、`clearLiveParameterFrame`(`:381`)、`clear`(`:526`)。`setViewTransform` / `setDisplayViewTransform` / `setLiveParameterFrame` は rAF 予約だけ(`:355,404,423`)。
- `renderCurrent`(`:643-691`)がすること: canvas のピクセル数を合わせる(`resizeCanvasToDisplaySize` `:892-911`)→ **保持している `this.renderInput` をそのまま描く**(評価をやり直さない。新しい live frame の反映は rAF 側 `renderScheduledFrame` `:575-586` だけ)→ metrics を報告。同期で終わる。
  - 【推測】したがって即時描画の直後(同じタスク内)に canvas を読めば、最後に描いた姿と同じ絵が得られる。物理・まばたき等の状態は進まない。Browser Source 接続中で live frame が止まっていても、`renderInput` は最後の値を持っている【推測】。
- `createWebGl2RendererFromCanvas(canvas, attributes)` はコンテキスト属性を引数で受け取れる(既定値は `alpha/antialias/premultipliedAlpha:true, stencil:false` `packages/render-webgl2/src/webgl2-renderer.ts:281-292`)。器と Browser Source はどちらも既定値で呼んでいる(棚卸し §2.2)。
- 描画 1 回の頭で `bindFramebuffer(null)` → 透明クリア(`webgl2-renderer.ts:111-118`)。

---

## 3. Control → main の頼みの既存の形

### 3.1 代表例: `Copy Window Title`

1. ボタン: Stage ページ Local Preview / Fallback パネル(`RP/control/stage-page.tsx:237-242`、props `:53,77`)
2. 配線: `onCopyWindowTitle={() => void input.runStageAction(() => window.runtimePlayer.stageView.copyWindowTitle())}`(`RP/control/control-window-app.tsx:1218-1222`)
3. 結果の受け方: `runStageAction` が `result.status` で `stageState` を更新し、`result.message` を feedback に出す。`result === "ok"` なら success、他は error。例外は error の feedback(`control-window-app.tsx:349-366`)。表示は `FeedbackNotice`(`:737-740`)
4. preload: `copyWindowTitle: () => ipcRenderer.invoke(stageViewBridgeChannels.copyWindowTitle)`(`RP/preload/runtime-player-bridge.ts:276-277`)
5. チャネル名: `copyWindowTitle: "runtime-player:stage-view:copy-window-title"`(`RP/preload/stage-view-bridge-channels.ts:14`)
6. handler: `ipcMain.handle(stageViewBridgeChannels.copyWindowTitle, () => copyStageWindowTitle(input, getState))`(`RP/main/stage-view-bridge-handlers.ts:213-215`)→ 本体 `:556-574` → 返事 `createStageViewActionResult`(`:610-621`)
7. 登録: `registerStageViewBridgeHandlers({ windows, windowState, ... })`(`RP/main/runtime-player-main.ts:350`)

- 非同期の例: `Focus Stage` は handler が `async`(窓の作り直しを `await`)(`stage-view-bridge-handlers.ts:168-175,356-414`)。ヘッダからは `window.runtimePlayer.focusStage()`(`control-window-app.tsx:718-720`、`runtime-player-bridge.ts:323`)。

### 3.2 新しいチャネルを Stage View 系に足すときに触る既存ファイル(今の形に倣う場合)

| 種類 | ファイル |
|---|---|
| チャネル名 | `RP/preload/stage-view-bridge-channels.ts:1-28` |
| チャネル名の契約テスト | `RP/preload/stage-view-bridge-channels.test.ts`(`toMatchObject` で列挙) |
| Control の型 | `RP/preload/runtime-player-bridge-contract.ts:192-233`(`RuntimePlayerStageViewApi`)、返事の型 `:173-178` |
| Control の preload | `RP/preload/runtime-player-bridge.ts:247-305` |
| Control preload のテスト | `RP/preload/runtime-player-bridge.stage-view.test.ts:40-`(invoke の N 番目の引数を順に検査。electron は `contextBridge`/`ipcRenderer` をモック `:3-19`) |
| main の handler | `RP/main/stage-view-bridge-handlers.ts`(入力型 `:33-42`) |
| main handler のテスト | `RP/main/stage-view-bridge-handlers.test.ts`(electron のモックは `clipboard.writeText` と `ipcMain.handle` だけ `:3-14`。`shell`・`app`・`dialog` は未モック) |
| main の配線 | `RP/main/runtime-player-main.ts:350-`(Stage 系の登録)、`:187-210`(モデル名) |
| Control の画面 | `RP/control/control-window-app.tsx`(`renderActivePage` `:646-687`、Live Controller `:983-`、Stage `:1167-1226`)、`stage-page.tsx`、`live-controller-page.tsx` |
| 画面のテスト | `RP/control/stage-page.browser-source.test.ts:149-154,190`、`stage-page.stage-motion.test.ts:174`、`live-controller-page.test.ts`(`renderToStaticMarkup`)。props を足すと、これらの呼び出し側(`onCopyWindowTitle: noop` のような列挙)も型で引っかかる【推測】 |
| Stage 側に往復を足す場合 | `RP/preload/runtime-player-stage-bridge-contract.ts`、`runtime-player-stage-bridge.ts`、`runtime-player-stage-bridge.test.ts`、`RP/stage/stage-window-app.tsx`、`stage-window-app.test.ts` |

- 別系統のチャネル束の例: Runtime Export は `runtime-export-bridge-channels.ts` + `runtime-export-bridge-handlers.ts`(`showOpenDialog` の親は Control 窓 `:79`)。

---

## 4. ゲート・作り直し・Electron の API

### 4.1 コマンド

`apps/runtime-player/package.json` の scripts:

| 目的 | コマンド(`apps/runtime-player` で) | 本日の結果 |
|---|---|---|
| 型検査 | `pnpm run typecheck`(`tsc --noEmit -p tsconfig.json`) | exit 0 |
| テスト | `pnpm run test`(= `test:unit` = `vitest run -c vitest.config.ts`、対象 `src/**/*.test.ts`) | 142 files / 981 tests 全 pass |
| ビルド | `pnpm run build`(typecheck + `electron-vite build` → `out/`) | 未実行 |
| パック(展開版) | `pnpm run pack`(build + `electron-builder --dir` → `dist/win-unpacked/`) | 未実行 |
| パック(portable exe) | `pnpm run dist:win`(build + `electron-builder --win --x64`、target portable → `dist/Runtime Player 0.0.0.exe`) | 未実行 |

- **lint のコマンドは無い**(runtime-player にもルートにも eslint 設定・script なし)。
- ルートの `pnpm run check` = typecheck(ルート)+ packages のテスト + `check:deps` + `check:source` + `check:soul-zone`(`package.json` ルート)。`check:source` の既定対象に `apps` を含む(`scripts/check-source-organization.mjs:5`)。
- 作り直しの手順が書いてある文書: `discussion/ai-cohost/implementation/waves/c1/domain-c-final-integration.md` §3.0(build → `dist:win`)・§3.1(`--role=trackingHost` / `--role=autonomousHost` を付けたショートカット)(`:180-206`)。注意書きとして electron-builder の初回ネットワーク DL と未署名 exe(`:197`)。`pack`(`--dir`)を使う手順の文書は見当たらない。
- 今の成果物の日付: `dist/win-unpacked/Runtime Player.exe` と `out/main/main.js` は 2026-10-18、`dist/Runtime Player 0.0.0.exe` は 2026-07-12。【推測】ユーザーが普段使っているのは win-unpacked 側(日付が新しい)。

### 4.2 `shell` / `app.getPath("pictures")`

- **器のどこにも `shell`(`openPath` / `showItemInFolder` / `openExternal`)は無い。`app.getPath` は `"userData"` だけ**(`RP/main/runtime-player-main.ts:113,213,233,437,441,444,457,466,517,520`)。`apps/` 全体でも `openPath` / `showItemInFolder` / `getPath("pictures")` は該当なし(grep)。
- 保存系のストアは `{ userDataPath }` を受け取る形(DI)で、テストで差し替えている(例 `runtime-player-main.ts:212-214`、棚卸し §3.2 の各ストア)。

---

## 5. ボタンを置くパネルの候補と、押せなくする条件の既存の書き方

### 5.1 パネル構成

- **Live Controller**(`RP/control/live-controller-page.tsx:83-170`): `Status`(Model / Input / Browser Source の 3 行、`:85-97`)→ `Variants`(`Reset to Model Default` `:99-114`)→ 3 列の並び(`xl:grid-cols-3`)に `Recenter`(`Look Forward`)・`Motion Safety`(Stage Motion トグル、Physiology 駆動時は案内)・`View Recovery`(`Center Model`)(`:116-169`)。props に `stageState`・`runtimeExportStatus`・`browserSourceStatus` が既に来ている(`:51-55`)。
- **Stage**(`RP/control/stage-page.tsx:91-310`): 3 列の並びに `Stage Window`(Status / Position / Size / Render、`Focus Stage`・`Arrange Stage` `:94-126`)・`View`(`:128-158`)・`Stage Motion`(`:161-168`)。その下に `Browser Source Output`・`Local Preview / Fallback`(`Background: Transparent` 行・`Copy Window Title` 等 `:176-244`)・`Auto Save`・`Startup`。
- ボタン部品は `IconTextButton`(`icon` / `label` / `onClick` / `variant` / `disabled`。`disabled` のとき `aria-busy` も立つ)(`RP/control/control-window-components.tsx:66-97`)。アイコンは `lucide-react`。

### 5.2 押せなくする条件の既存の書き方

| 条件 | 書き方 | file:line |
|---|---|---|
| Stage 窓が閉じている | `disabled={stageState?.stageWindow.windowState === "destroyed"}` | `stage-page.tsx:123,222,235`、`live-controller-page.tsx:166` |
| Stage の状態が未取得 | `disabled={stageState === null}` | `live-controller-page.tsx:142` |
| Runtime Export を読み込み中 | `disabled={runtimeExportStatus?.status === "loading"}` | `stage-page.tsx:306`、`overview-page.tsx:301,315`、ヘッダ `control-window-shell.tsx:124`(`runtimeExportBusy` `control-window-app.tsx:722`) |
| モデル依存の操作が使えない | `disabled={!variantStatus?.controlsEnabled}`(main 側が出す可否フラグ) | `live-controller-page.tsx:111` |
| 前提データが無い | `disabled={!lookForwardAvailable}` | `live-controller-page.tsx:123`、`control-window-shell.tsx:131` |
| 実行中は押せない(非同期の多重押し防止) | `inputBusy` を `useState` で持ち、`try/finally` で戻す | `control-window-app.tsx:134,397-417,422-439`、`overview-page.tsx:161` |
| 計測の状態 | `capture.status === "running"` 等 | `performance-diagnostics-page.tsx:223-290` |

- 「モデルが表示されているか」の既存の判定: Stage の描画状態 `renderStatus.status` は `"empty" | "ready" | "warning" | "error"`(`RP/preload/runtime-player-bridge-contract.ts:79-83`)。Stage ページの Model 行は `ready`/`warning` を `Visible` と表示(`stage-page.tsx:336-350`)。Runtime Export の読み込み状態は `runtimeExportStatus.status === "loaded"`。**この 2 つを `disabled` に使っているボタンは今は無い**(「モデル未ロード時に disabled」の直接の前例は無く、近いのは Variants の `controlsEnabled`)。

---

## 6. 未確認・質問になりうること

1. ファイル名の「モデルの名前」: 今のユーザーのデータでは `modelDisplayName` が 2 体とも `Untitled model`、`packageId` も同じ(§1.3)。合意の例 `chappy-…` と一致する値は Runtime Export の中に無い。どの値を使うか(またはモデル側の名前を直すか)は設計・ユーザー判断。
2. Stage 窓が最小化・非表示のときに rAF / 即時描画 / canvas の読み出しが期待どおり動くか(`backgroundThrottling: false` は設定済み)。実機未確認。
3. `preserveDrawingBuffer: false` のまま「即時描画 → 同じタスクで `toBlob`/`toDataURL`」で中身が取れるか、Electron 42 / Windows での実機確認はしていない(仕様上は描画と同じタスク内なら読める【推測】)。
4. ユーザーが普段どの exe(win-unpacked / portable / 開発起動)で器を起動しているか。作り直し後の確認手順に関わる。
