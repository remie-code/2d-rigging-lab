# C1 planning gate inventory: 「二体が同居できる」コード接地棚卸し

> Status: 調査完了(Sylph、2026-07-10)。読み取りのみ・ソース無変更。
> 対象: `apps/runtime-player`(Electron, pnpm monorepo)。
> basis: [closed-problem-decomposition.md](../closed-problem-decomposition.md) / [screens/c1-role-skeleton.md](../screens/c1-role-skeleton.md) / [architecture/runtime-player-model-host-roles.md](../../architecture/runtime-player-model-host-roles.md)
> Verdict: **needs_design**(§末尾。政策決定4件がwave計画をブロック。実装基盤自体は ready)

事実と推測を区別する。行番号は調査時点。「推測:」を付けたもの以外はコード上の事実。

---

## 観点1: 二重起動の可否(単一インスタンス制御)

**リポジトリ事実**
- `app.requestSingleInstanceLock()` / `second-instance` / `makeSingleInstance` は**リポジトリ全体に存在しない**(`Grep` 全域ヒット0)。
- mainエントリは `apps/runtime-player/src/main/main.ts:1-3` → `startRuntimePlayerMain()` を即時呼ぶだけ。
- 合成は `apps/runtime-player/src/main/runtime-player-main.ts:59` `startRuntimePlayerMain()` の `app.whenReady().then(async () => {...})`(65行〜)一箇所に集中。
- 起動抑止の機構が無いため、**現状でも同一アプリの二重起動は物理的に可能**。ただし全インスタンスが同じ `app.getPath("userData")` とデフォルトポートを共有する。

**現状二重起動で起きる衝突点(すべて同一userData/固定ポート共有に起因)**
- window-state ファイル `window-state/runtime-player.json`(単一固定名。観点2)を両者が読み書き→窓位置が相互汚染。
- Browser Source: 両者が同じ preferredPort 17308 と**同じ token**(単一config file共有)を使う。二番目は EADDRINUSE→揮発ポートへ降格(観点4)。
- 各種profile(model-mapping / dynamics-tuning / input-profile / startup-state)を同一ディレクトリで同時書き込み→ last-writer-wins の破壊。

**含意**: C1は「単一インスタンスロックを追加する」問題ではなく、**ロックを置かないまま状態空間を分離する**問題。ロック不在は C1(二体同居)と招待の木(N体)の前提と整合的。ただし「意図的に置かない」ことの追認が要る(観点は§Verdict-4)。

---

## 観点2: userData の現状棚卸し

**リポジトリ事実**: `app.getPath("userData")` は `runtime-player-main.ts` の6箇所(67, 81, 272, 276, 279, 303行)でのみ取得され、各storeにDI経由で渡る。`app.setPath('userData', ...)` の呼び出しは**存在しない**。

userData配下に保存される全成果物(store→相対パス):

| 成果物 | Store(合成行) | userData配下パス | 参照ファイル:行 |
|---|---|---|---|
| window-state | `RuntimePlayerWindowStateStore`(66) | `window-state/runtime-player.json`(**単一固定名**) | `window-state/window-state-store.ts:43` / test `.test.ts:22` |
| Browser Source config(token+preferredPort) | `RuntimePlayerBrowserSourceConfigStore`(80) | `browser-source/browser-source-config.json` | `broadcast-source/browser-source-config-store.ts:45-49` |
| model-mapping profiles | `ModelMappingProfileStore`(271) | profiles root(userData配下) | `model-mapping-profiles/model-mapping-profile-store.ts:41-48` |
| dynamics-tuning profiles | `DynamicsTuningProfileStore`(275) | profiles root(userData配下) | `dynamics-tuning-profiles/dynamics-tuning-profile-store.ts:43-50` |
| input profiles(calibration含む) | `InputProfileStore`(via inputProfileBridge, 303) | 単一ファイル(userData配下) | `input-profiles/input-profile-store.ts:37-42` |
| startup-state(最後のRuntime Export復元用) | `RuntimePlayerStartupStateStore`(278) | 単一ファイル(userData配下) | `startup-state/runtime-player-startup-state-store.ts:37-44` |

**分離の差し込み点**
- 全store が `{ userDataPath }` をコンストラクタ引数で受ける**統一DIパターン**。userData基点を1つ差し替えるだけで全成果物が連動して移る(store側の改修不要)。
- 最も自然な差し込み点は2択:
  1. `runtime-player-main.ts` の `app.getPath("userData")` を「解決済みインスタンス別basePath」を返す関数に置換(6箇所)。
  2. `startRuntimePlayerMain()` 冒頭(whenReady前)で `app.setPath("userData", <instance-path>)` を一度呼び、既存の `app.getPath("userData")` はそのまま活かす。
- **推測(Electron制約)**: `app.setPath("userData", ...)` は `app` ready 前に呼ぶのが安全(ready後の変更は既に確定したパスに追随しない可能性)。現コードの `getPath` は `whenReady().then` 内(65行以降)なので、setPath方式を採るなら `startRuntimePlayerMain()` の同期先頭(60行付近、whenReady登録より前)に置くのが素直。この配置は現構造に無理なく載る。

**含意**: userData分離は「store改修ゼロ・合成ルート1点差し替え」で機械的に済む。**主コストはここではなく、何を基点キーにするか(観点=Verdict-1)の政策判断側にある。**

---

## 観点3: 起動引数と合成ルート

**リポジトリ事実**
- コマンドライン引数(`process.argv` / `app.commandLine` / `argv`)を読む箇所は**src配下に存在しない**(Grepヒット0)。現状アプリは引数を一切解釈しない。
- 合成の単一ルートは `startRuntimePlayerMain()`(`runtime-player-main.ts:59-454`)。`app.whenReady().then` の中で全サブシステム(window / browser-source server / stage-motion / live-mapping / input / model-mapping / dynamics-tuning / runtime-export / quit controller / tray)を**手続き的に順に組み立てる**。ファクトリ/レジストラ関数(`registerXxxBridgeHandlers`、`createRuntimePlayerWindows` 等)への引数で依存を注入する形で、DIコンテナや `if(role)` 分岐は無い。
- 役割差し替えの候補注入点(すべて既存の関数境界):
  - 入力系: `registerInputBridgeHandlers`(286)、`registerInputProfileBridgeHandlers`(300)、`registerModelMappingBridgeHandlers`(316)。自律ホストではこの3つを**組み立てないことで**トラッキング経路を合成から外せる(下記観点5)。
  - Browser Source: `RuntimePlayerBrowserSourceServer`(85)へ渡す `{ port, token }` を差し替え。
  - userData: 観点2の1点。

**含意**: 「役割=起動時合成」の背骨(architecture §4)は**現構造と非常に相性が良い**。合成が既に一箇所の手続きで、各サブシステムが独立レジストラに切れているため、役割による「組み立てる/組み立てない」の差し替えは自然に載る。ただしC1のゲートは起動引数のみ成立で、自律ホスト側の駆動源(生成器)はC2の成果物。**推測: C1時点では役割差は「ラベル+profile名前空間+入力系を合成するか否か」に留まり、真の合成分岐(生成器の注入)はC2で厚くなる。** よってC1の合成ルート改修は「引数を読んで userData基点/port/token/入力系有無を選ぶ薄い分岐」で足りる。

**引数スキーマは未設計**(観点=Verdict-2)。C1実装ゲートと c1-role-skeleton §6 は「将来の玄関・扉2・扉3が呼ぶ引数と食い違わない形」を要求するため、引数の切り方は先に決める必要がある。

---

## 観点4: Browser Source loopbackサーバ

**リポジトリ事実**
- バインド先: `127.0.0.1` 固定(`broadcast-source/browser-source-url.ts:3`)。
- デフォルトport: `17308`(`browser-source-url.ts:6`)。config file から `preferredPort` を読む(`browser-source-config-store.ts:101,144` / 合成 `runtime-player-main.ts:85-88`)。
- **ポート衝突時の挙動**: `listenOnLoopback(server, this.#port)` が EADDRINUSE を投げたら **`listenOnLoopback(server, 0)`(揮発ポート)へ自動降格**(`browser-source-server.ts:156-163`)。実際に採用したportは `server.address().port` から読み `markRunning({ port, preferredPort })`(170-175)。**→ 二インスタンス起動でもサーバ自体はクラッシュせず、二番目は自動で別ポートに逃げる。**
- token生成: `createBrowserSourceToken()`(`browser-source-server.ts:95`、options.token 未指定時)。だが合成ルートでは config store が生成・**永続化した token**(`browser-source-config.json`)を渡す(`runtime-player-main.ts:87`)。
- URL表示: token をクエリ `?token=` に載せて `/stage` URL・WS URL を組む(`browser-source-url.ts:16-18,27-29`)。stage HTMLは `X-Runtime-Player-Stage-Url` ヘッダ経由でURL露出(`browser-source-server.ts:712`)。

**二インスタンス同時起動時の実態(事実+推測)**
- 事実: 両者とも**同一の永続config**(同一token・同一preferredPort 17308)を読む。一番目が17308を占有、二番目はEADDRINUSE→揮発ポート。→ ポート番号は結果的に分かれるが**tokenは共有**され、**どちらが17308を取るかは起動順依存で非決定的**。
- 含意: C1不変条件「ポートが混ざらない」は**サーバ側の自動降格で偶発的には満たされる**が、(1)token共有により loopback上で相手のフレームを取得し得る(同一token・別portでも token検査は通る)、(2)preferredPort共有で表示URLが起動ごとに変わる、という**設計上の不整合が残る**。インスタンス別に token/port を明示採番する方針が要る(観点=Verdict-3)。
- 変更点は小さい: 合成ルート(85-88)で `{ port, token }` を「インスタンス別に解決した値」に差し替えるだけ。config store をインスタンス別ファイルにするか、起動時採番+表示にするかは政策判断。

---

## 観点5: iFacialMocap UDP受信

**リポジトリ事実**
- 受信ポート: デフォルト `IFACIALMOCAP_DEFAULT_UDP_PORT = 49983`(`ifacialmocap-udp-start-request.ts:1`)。connect要求 `config.receivePort` で上書き可(`input-bridge-handlers.ts:156` / receiverは `receivePort: input.config.receivePort` を使用)。startup既定表示も 49983(`placeholder-action-state.ts:38`)。
- ソケット生成: `createSocket({ type: "udp4", reuseAddr: true })`(`ifacialmocap-udp-receiver.ts:54`)。**`reuseAddr: true`** に注意。
- **リスナーの生成/開始タイミング**: 合成ルートで `registerInputBridgeHandlers`(`runtime-player-main.ts:286`)を呼ぶが、この時点では**受信は始まらない**。UDPソケットの `bind` は IPC `connect` ハンドラ(`input-bridge-handlers.ts:81-121`、レンダラからの明示操作)で初めて `createReceiver(...).start()` される。つまり**受信は手動開放**(architecture §6「操縦チャネルは手動開放」と整合。ただしこれは操縦チャネルではなくトラッキング入力)。
- `createReceiver` は差し替え可能(`RegisterInputBridgeHandlersInput.createReceiver`、63行の既定 `createIFacialMocapUdpReceiver`)。テスト注入点として既に開いている。

**自律ホストでUDPを合成から外せるか(事実+推測)**
- 事実: 入力系は `registerInputBridgeHandlers`(286)/ `registerInputProfileBridgeHandlers`(300)/ `registerModelMappingBridgeHandlers`(316)の3レジストラで構成され、`modelMappingBridge` は `inputBridge.state` に依存(318行)。
- **推測**: 自律ホスト合成では入力3レジストラを組み立てないことで UDP経路を素直に外せる(`if(role)` 実行時分岐ではなく合成の有無)。ただし現状 `modelMappingBridge` が `inputBridge.state` を要求するため、自律ホストの駆動源(生成器=C2成果物)が無いC1では「入力を外した自律ホストが何を描くか」が空白になる。**C1の自律ホストは実質「入力未接続の二番目のインスタンス+役割ラベル」で足りる**(生成器はC2)可能性が高い。この切り分けは合成分岐の厚みを左右する設計判断で、C1では薄く留める余地がある。
- 二トラッキングホスト同時稼働時: `reuseAddr:true` で両者が49983にbind可能だが、**推測: Windows では SO_REUSEADDR 複数bind時の受信は非決定的(片方のみ受信/最後のbind優先)**。C1のゲートは「二体=通常トラッキング1+自律1」で、自律はUDPを持たないため実害は出にくいが、二トラッキングhost構成では受信衝突が起こり得る点は記録に残す。

---

## 観点6: ウインドウタイトルとトレイ・役割バッジの受け口

**リポジトリ事実**
- Control Window: `title: "Runtime Player"` **固定**(`window-management/browser-window-options.ts:30`)。`show:false`+`ready-to-show` で表示。
- Stage Window: `title: runtimePlayerStageWindowTitle`(定数 `"Runtime Player Stage"` 固定、`preload/runtime-player-bridge-contract.ts:18` / options `browser-window-options.ts:54`)。
- 「Copy Window Title」: `stage-view-bridge-handlers.ts:560` が `clipboard.writeText(runtimePlayerStageWindowTitle)`(同じ固定文字列)。UI導線は `control/stage-page.tsx:232`→`control-window-app.tsx:950`→preload `runtime-player-bridge.ts:233`。
- **→ 現状タイトルは両窓とも役割/インスタンス非依存の固定文字列。** c1-role-skeleton §7.2「ウインドウタイトルに役割名を含める」を満たすには、この2定数を「役割・モデル名を織り込んだ動的タイトル」に変える必要がある(現状は静的定数のため受け口が無い)。
- トレイ: `runtime-player-tray-menu.ts`。アイコンは**埋め込みPNG data URL 固定**(47-49行、16x16単色)。`tray.setToolTip("Runtime Player")` 固定(75行)。メニューは `createRuntimePlayerTrayMenuTemplate`(91)= Show Control / Focus Stage / Disable Click-through / Quit。役割色ドット・役割別ツールチップ(§7.4)の供給点はこのファイルで、`registerRuntimePlayerTrayMenu` の options を役割・モデル名で拡張する形。
- **Control Window への状態伝搬パターン(役割バッジの受け口)**: 既存は「preload `contextBridge` + `ipcMain.handle`(pull)+ `webContents.send`(push)」の統一形。役割バッジのpull口として最有力は `placeholderBridgeChannels.getStartupStatus`→`createStartupStatus()`(`placeholder-action-state.ts:27`、`RuntimePlayerStartupStatus` を返す)。ここに `role` フィールドを足せば、既存の startup pull に相乗りしてHeaderへ届く(新チャネル不要)。Header描画は `control/control-window-app.tsx`。

**含意**: 身元表示(§7.2/§7.4)は**UX surface**で、C1実装ゲート(起動引数のみで二体同居)には必須でない。ただしタイトルが固定定数である点は、役割注入時に「定数→合成で解決した動的値」への小改修を要する。バッジ受け口は既存 startup status に自然に載る。

---

## 観点7: ライフサイクル(Wave20: Control close=quit / Stage close=復旧可能)

**リポジトリ事実**
- Control close = quit: `attachRuntimePlayerControlWindowRecovery`(`control-window-recovery.ts:80-94`)。Control Windowの `close` で、明示quit中でなければ `requestQuit()` + `closeStageWindow()`。合成は `runtime-player-main.ts:400-409`。
- Stage close = 非退場・復旧可能: `createStageWindowLifecycle`(`runtime-player-windows.ts:126-198`)の `reopenStageWindow`。Focus Stage(tray/操作)で再生成。Stage単独closeはappを終わらせない。
- quit手続き: `RuntimePlayerQuitController`(`control-window-recovery.ts:25-78`)。`before-quit` を横取り(`runtime-player-main.ts:397`)→ `handleBeforeQuit` が入力切断・profile flush・window-state flush を待ってから `app.quit()`(72-77行)。`window-all-closed` は非darwinで `requestRuntimePlayerQuit()`(`runtime-player-main.ts:449-453`)。
- クリーンアップ: `will-quit`(438-446)で tray dispose・browser-source server stop 等。

**招待ツリー終了シグナル(将来)の自然な差し込み点**
- **推測**: 閉扉ダイアログ→子プロセスへの終了伝播(c1-role-skeleton §4、後続wave)は、`RuntimePlayerQuitController.requestQuit()` / `handleBeforeQuit` の**quit確定の直前**が自然な差し込み点。ここで「自分が招いた子プロセスハンドル」へシグナルを送ってから自分を畳む。招いた子の記憶(親のプロセスハンドル集合)を持つ器はまだ存在しない(spawn機構自体がC1後続)。C1実装ゲートには不要。

**含意**: ライフサイクルの土台(quit直列化・flush・Stage復旧)は既に堅牢で、招待ツリー伝播の受け口(quit直前フック)も既存構造に開いている。C1のkill耐性ゲートはプロセス独立性の問題であり、このライフサイクル層とは直交(観点8)。

---

## 観点8: テスト流儀とC1ゲートの機械検証

**リポジトリ事実(既存パターン)**
- store系: `mkdtemp` で一時userDataを作り `new XxxStore({ userDataPath })` を注入する形が全store testで統一(例 `window-state-store.test.ts:16-22`、`model-mapping-profile-store.test.ts`、`browser-source-config-store.test.ts:18-28`、`startup-state-store.test.ts:14-22`)。
- bridge系: レジストラに fake windows / adapter を注入。入力は `createReceiver` 差し替え(`input-bridge-handlers.ts:63`)、時刻は `nowMs`、タイマは `timers` 注入(`browser-source-server.ts:71,116`)。ipcMain を実際に叩くテスト(`*-bridge-handlers.test.ts`)。
- サーバ: `RuntimePlayerBrowserSourceServer` は port/token/timers 全て注入可能でユニットtestあり。EADDRINUSE降格ロジック(156-163)も test対象化しやすい構造。

**C1ゲートがどの層に書けるか**
- 「profile非混在」: **ユニット層で機械検証可能**。二つの `userDataPath`(=二インスタンス相当)に対して各store が独立ファイルに書くことを、既存の store test 流儀そのままで確認できる。合成ルートの「userData基点解決関数」を純関数として切り出せば、引数→basePath の対応も純粋にtest可能。
- 「ポート非混在」: サーバ層で、同一preferredPortに対する二番目起動が別ポートに降格することはユニットで、token/port採番方針を入れた後はその純粋な採番関数をtestできる。
- 「片方killでもう片方が止まらない」: これは**プロセス独立性=OSレベルの性質**で、ユニット層では表現できない。**推測: E2E/手動ゲート(パッケージ版を二重起動→一方のプロセスをkill→他方のBrowser Sourceフレームが継続)でのみ真に検証できる。** リポジトリに既存のElectron E2Eハーネスは見当たらない(要確認=リスク欄)。closed-problem §2は機械ゲート志向だが、この不変条件だけは人間/OS観測に落ちる可能性が高い。
- **注意(dev環境)**: `electron.vite.config.ts` は単一 renderer dev server(`ELECTRON_RENDERER_URL`)を前提。dev(`electron-vite dev`)での二重起動はrenderer dev server共有・userData共有になるため、C1の手動ゲートは**パッケージ版(portable exe)**での検証が素直。

---

## C1計画への含意(ドメイン分割の示唆・主コスト)

**推奨ドメイン分割(すべて合成ルート中心、store改修は最小)**
1. **D-A: インスタンス分離基盤(主コスト・最初)** — 起動引数パーサ(新規)+ userData基点のインスタンス別解決 + 合成ルートへの注入。観点2/3。ここが背骨で、他ドメインはこの引数契約に乗る。
2. **D-B: ポート/token分離** — Browser Source の port/token をインスタンス別に採番・表示。観点4。D-Aの引数契約に依存。
3. **D-C: 役割合成の薄い骨組み** — 引数の役割で「入力系を合成するか」「profile名前空間」を選ぶ最小分岐。観点3/5。C1では薄く(生成器はC2)。
4. **D-D: 身元表示(UX surface)** — 動的ウインドウタイトル + tray tooltip/色 + Control Header 役割バッジ(startup status相乗り)。観点6。C1ゲート必須ではないが c1-role-skeleton §7 がAcceptedなので同wave群で拾う。
5. **D-E: kill耐性ゲートの検証手段** — 手動/E2Eゲートの用意。観点8。

**主コストの所在**
- 機械的な配線(userData差し替え・port/token注入)は**軽い**(全store が既にDI化済み、合成が一点集中)。
- 重いのは**政策判断**(下記Verdict)と、**プロセス独立性ゲートの検証手段**(既存E2Eハーネス不在の可能性)。
- 素直に載る部分: userData分離、合成ルートへの引数注入、役割による入力系の合成有無、role badge の startup status 相乗り、招待ツリー伝播の quit 直前フック。
- 構造と非整合な部分: (a)ウインドウタイトルが固定定数で役割を織り込む受け口が無い、(b)Browser Source token/preferredPort が単一config file共有で二インスタンスが同一tokenを持つ、(c)「片方kill耐性」がユニット層に落ちない。

---

## ドキュメント間の不整合(黙って上書きしない指摘)

1. **「インスタンスごと」vs「役割別サブディレクトリ」の粒度矛盾**: c1-role-skeleton §5.5 は「userData/ポート分離は役割ごとではなく**インスタンスごと**」と断定。一方 architecture §8 未決事項は「役割ごとのuserData分離の具体方式(起動引数 or **役割別サブディレクトリ**)」と、役割別を選択肢に残す。**両者は同じ粒度を指していない**。さらに「インスタンスごと(揮発)」を厳格に採ると、トラッキングホストの永続profile(calibration/mapping)が起動ごとに失われる問題が生じる。→ Verdict-1で要決。
2. **Browser Source の token/preferredPort 共有**: architecture §3.2「サーバはインスタンスごとに別ポート」に対し、現実装は単一 `browser-source-config.json` で token・preferredPort を共有。EADDRINUSE降格でポートは偶発的に分かれるが token は共有され、§不変条件1「ポート/userData は互いに触れない」と食い違う。→ Verdict-3で要決。

いずれも既存ドキュメントの本文は変更していない。矛盾の解消は設計者(Undine/Salamander)の判断領域。

---

## リスクと未知(調査で確定できなかったこと)

- **E2E/Electron起動テストの有無**: 「片方kill耐性」を機械検証するElectron E2Eハーネスがリポジトリにあるか未確認(store/bridgeのユニットtestは豊富だがプロセス起動testは見当たらず)。無ければC1の当該ゲートは手動ゲート化する。
- **`app.setPath("userData")` の正確なタイミング制約**: Electronバージョン(electron ^42)での ready前/後の挙動差は実機確認していない(推測ベース)。
- **`reuseAddr:true` の二トラッキングhost同時受信挙動**(Windows): 実機未検証(推測)。C1の主要構成(トラッキング1+自律1)では自律がUDPを持たないため実害は出にくい。
- **自律ホストがC1で描くもの**: 生成器(C2)不在のC1で自律ホスト側が何を表示するか(空/静止モデル/入力未接続)は closed-problem/skeleton から一意に読めない。合成分岐の厚みに影響。

---

## Verdict: **needs_design**

実装基盤(合成ルートの一点集中・全store のuserDataPath DI・アダプタ注入・quit直列化)は **ready** であり、配線コストは軽い。しかし以下の**政策決定4件がwave計画に先行して必要**(いずれも架空の設計ではなく、既存ドキュメントが未決/矛盾として明示している事項):

1. **userData分離の粒度と永続性モデル**: 「インスタンス毎=揮発」と「役割/スロット毎=永続」の切り分け。トラッキングホストの永続profile(calibration/mapping/input)をどのキーで永続させ、window-state/portをどの単位で分けるか。skeleton §5.5 と architecture §8 の粒度矛盾(上記不整合1)を解消する必要がある。
2. **起動引数スキーマ**: 役割 + userData/profileスロットキー + ポート方針を、将来の玄関/扉2(spawn)/扉3(一括)がそのまま呼べる形で確定(skeleton §6 の要求)。引数を読む機構が現状ゼロなので、契約を先に固定しないと D-A が着地しない。
3. **Browser Source の port/token 採番方針**: 現状の単一config共有(token共有・preferredPort共有・EADDRINUSE降格)を、インスタンス別token+ポート採番(固定+fallback / 起動時割当+表示のどちら)に改める方針。不整合2の解消。
4. **単一インスタンスロックを「置かない」ことの追認**: 現状ロック不在=二重起動可はC1/招待の木と整合的だが、「意図的に置かない(引数なし=玄関、役割付き=別プロセス)」という判断を明示追認する(skeleton §2 の禁止事項と併せて)。

これら4件が決まれば、ドメイン D-A〜D-E は上記の素直な差し込み点に沿って直ちにwave化できる(実装難度は低〜中)。

---

## 質問(ユーザー/上位判断が必要な点)

- **Q1(粒度)**: userData分離は「インスタンス毎に揮発」でよいか、それともトラッキングホストの永続profileは「役割/named-shortcutスロット毎に永続」させ、window-state/portだけをライブインスタンス毎に分ける二層構成にするか。skeleton §5.5 の「インスタンスごと」を厳格採用するとcalibrationが毎起動で消える懸念がある。
- **Q2(引数)**: 起動引数の第一義キーは「役割」か「プロファイルスロット名(役割は属性)」か。玄関が作るショートカットがどちらを埋め込むかで D-A の契約が変わる。
- **Q3(kill耐性ゲート)**: 「片方kill耐性」をパッケージ版の手動ゲート(人間観測)で閉じてよいか、それともElectron E2Eハーネスを新設して機械ゲート化するか(後者はC1のスコープを広げる)。
- **Q4(C1の自律ホスト)**: 生成器不在のC1で自律ホストは「入力未接続の静止モデル表示+役割ラベル」で足りるという理解でよいか(呼吸はC2)。
