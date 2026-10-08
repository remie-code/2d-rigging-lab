# C1 wave直後「起動したら真っ暗」容疑箇所調査

- 調査者: Sylph（Undine L0 からのサブエージェント委任、調査のみ・無変更）
- 日付: 2026-07-10
- 対象コミット: working tree（未コミット, `git diff HEAD -- apps/runtime-player/` = C1 実装差分）。直前コミット `4c4348a` は docs のみ。
- 前提: 起動方法（dev / packaged portable exe、引数有無、どの窓）は未確定。全ケースを想定した容疑リスト。

---

## 0. 最重要の前提確認（先にこれを潰すこと）

**C1 で「引数なし起動」の意味が根本的に変わった。** 引数なし（`--role` なし）で起動すると、**メインウインドウは一切作られず、役割選択ダイアログ（`dialog.showMessageBox`）だけが出る**のが設計どおりの新挙動。

- 根拠: `runtime-player-main.ts:136-145`
  ```ts
  app.whenReady().then(async () => {
    if (launch.kind !== "role-resolved") {
      await presentRuntimePlayerRoleSelectionStub(
        createRuntimePlayerRoleSelectionStubIo()
      );
      return;   // ← ここで return。windows は作られない
    }
    ...（ここから下で初めて createRuntimePlayerWindows）
  ```
- `parseRuntimePlayerRoleArguments`（`role-launch-resolution.ts:66-75`）は `--role` が無ければ `{ kind: "no-role" }` を返す。
- dev の起動スクリプトは `"dev": "electron-vite dev --watch"`（`package.json:8`）で **`--role` を渡していない**。packaged portable exe を素で叩いても引数なし。→ **どちらの通常起動も no-role パスに入る。**
- C1 設計ドキュメント自身が「手動ゲートは packaged（portable exe）で実施。dev は二重起動が dev server / userData を共有するため無効」と明記（`discussion/ai-cohost/implementation/waves/c1/domain-c-final-integration.md:178`）。想定フロー: 起動→役割ピッカー→役割選択で `--role=<選択>` に **relaunch**→役割確定インスタンスが窓を作る（同 246 行）。

**→ 「真っ暗」がどの状態かをまず切り分ける必要がある:**
- (α) 窓が一切出ず、役割選択ダイアログすら見えない/見落とした → no-role パスの挙動そのもの。「黒いウインドウ」ではなく「窓が無い」。
- (β) 役割を選んだ後に relaunch した先の**役割確定インスタンスの窓が黒い** → 下の容疑 #2〜#4。
- (γ) dev で `--role` を手で付けて起動した窓が黒い → 容疑 #2〜#4。

ユーザーの「ウインドウが真っ暗」という表現は (β)/(γ)（=窓は出たが描画されない）を示唆するが、確証がない。**最終質問参照。**

---

## 1. 容疑リスト（可能性の高い順）

### 容疑 #1 — no-role 起動でメインウインドウが生成されない（設計どおりの新挙動の見落とし）
- 発症条件: dev（`electron-vite dev`）または packaged exe を **引数なし**で起動した全ケース。
- 症状: 役割選択ダイアログのみ表示。ダイアログを閉じる/見落とすと「何も出ない＝真っ黒/空」に見える。従来（C1 前）は素起動で即 Control/Stage 窓が出ていたので、体感上の重大な退行。
- 根拠: `runtime-player-main.ts:136-145`、`role-launch-resolution.ts:66-75`、`role-selection-stub.ts:38-50`。
- 確認方法: 起動時に「Choose how to launch Runtime Player」というダイアログが出ているか。出ていれば no-role パス確定。出ていて役割を選ぶと relaunch する。
- 位置付け: これは**バグではなく設計挙動**。だが「真っ暗」の第一容疑として最初に切り分けるべき。ここが原因なら「起動の仕方（`--role=trackingHost` を付ける／ダイアログで選ぶ）」の周知で解決し、以下の容疑は無関係になる。

### 容疑 #2 — relaunch 先（役割確定インスタンス）で renderer がロードできず黒画面（packaged 経路・C1 が初めて踏む）
- 発症条件: (β) 役割選択→relaunch 後、または (γ) `--role` 明示起動。**packaged で特に疑わしい。**
- 症状: Control 窓（`backgroundColor:#101214` = ほぼ黒）または Stage 窓が出るが中身が描画されない＝黒。
- 機序:
  - renderer ロードは dev=`loadURL(ELECTRON_RENDERER_URL)`, packaged=`loadFile(../renderer/<entry>/index.html)`（`runtime-player-windows.ts:110-122`, `renderer-entry-url.ts:16-31`）。
  - packaged で `out/renderer/<entry>/index.html` かそのアセット相対パスが壊れていると `loadFile` 失敗→白紙/黒。
  - **重要**: この loadFile 経路・preload 相対パス（`renderer-entry-url.ts:8-14`, `../preload/preload.mjs`）は **C1 で未変更**。つまり本容疑が真因なら **C1 のロジックではなく既存の packaged 化の未検証問題**（Wave20「packaged smoke pending」）が、C1 で packaged 起動が必須経路になったことで初めて露見した、という筋。→ 第2章で詳述。
- 補足（Control 窓の挙動）: Control は `show:false` で `ready-to-show` 時に `show()`（`runtime-player-windows.ts:74-75`, `browser-window-options.ts:34`）。ロード完全失敗なら `ready-to-show` が発火せず**窓は出ない（黒ではなく不在）**。逆に「黒い窓が出る」なら、ロードは一部成功し初回ペイントまで到達＝ **renderer JS が実行途中で描画に至っていない**（React 未マウント/例外、または preload 不在で bridge 呼びが即失敗）を示唆。
- 確認方法: 第3章の `--enable-logging` でメインプロセスの `did-fail-load` / preload ロードエラーを確認。`out/renderer/control/index.html` と `out/preload/preload.mjs` が dist（asar 展開 or portable 展開先）に実在するか。

### 容疑 #3 — Stage 窓の透明化 + GPU 由来の黒画面（Windows 既知パターン）
- 発症条件: (β)/(γ) で Stage 窓が対象の場合。GPU/コンポジション不調時に顕著。
- 症状: Stage 窓は `transparent:true, frame:false, backgroundColor:"#00000000"`（`browser-window-options.ts:59-64`）。Windows では透明ウインドウ＋GPU 合成失敗で**全面真っ黒**になる既知バグがある。モデル未ロード時は本来「透明で何も見えない」状態が正しく、GPU 不調だと黒面になりやすい。
- C1 との関係: Stage の透明設定は **C1 で未変更**（既存）。ただし C1 の userData 差し替え（容疑 #4）で GPUCache の場所が初回変わるため、キャッシュ再生成タイミングと重なると誘発され得る。
- 確認方法: どちらの窓が黒いか（枠なし＝Stage、枠あり＝Control）。`--disable-gpu` で起動して黒が消えるか。

### 容疑 #4 — app ready 前 `app.setPath("userData", slot)` の副作用（GPU/セッションキャッシュ）
- 発症条件: 全ての role-resolved 起動。packaged 初回。
- 機序:
  - `runtime-player-main.ts:120` で ready 前に `app.setPath("userData", launch.slotUserDataPath)`。slot パス = `<defaultUserData>/slots/<slotName>`（`slot-paths.ts`, 例 `.../slots/tracking-default`）。
  - Electron は `sessionData`/`cache`/GPUCache を userData から派生させる（個別 setPath していない限り）。差し替え自体は Electron 公式手順（ready 前実行）に沿い正しい。ディレクトリは slot-lock の `mkdirSync(slotUserDataPath,{recursive:true})`（`slot-lock.ts:130`）が **setPath より前**に作るので不在ディレクトリ問題は回避されている。
  - 残リスク: 初回の GPUCache 再生成・権限・パス長（Windows MAX_PATH。`.../AppData/Roaming/Runtime Player/slots/tracking-default/GPUCache/...` は深いが通常上限内）。破損/共有 GPUCache による黒画面の典型に**該当する強い証拠はない**が、初回 packaged で唯一パスが変わる箇所なので容疑 #3 と併発時の増幅要因として記載。
- 確認方法: slot ディレクトリ配下に GPUCache が生成されるか、`--disable-gpu-shader-disk-cache` / `--disable-gpu` で改善するか。

### 容疑 #5（低）— portable exe の relaunch 契約
- 発症条件: packaged portable で役割選択→relaunch。
- 機序: `app.relaunch({ args: process.argv.slice(1).concat([`--role=${role}`]) })`（`role-selection-stub.ts:83-87`）。portable exe は起動時に %TEMP% に自己展開し、`process.execPath` は展開先の一時 exe を指す。`app.relaunch` は既定で `process.execPath` を再実行するため、**元の portable ランチャーではなく一時展開 exe を再起動**する。展開先が掃除されるタイミング次第で relaunch 失敗、あるいは二重展開になる可能性。relaunch 自体が失敗すると「役割を選んだのに何も再表示されない＝黒/無」に見え得る。
  - なお `argv.slice(1)` は packaged では引数群（通常空）で、role 付与により **relaunch 先は必ず role-resolved**＝ダイアログ無限ループにはならない（`--role` が付くため no-role に戻らない）。dev では `argv.slice(1)` に main エントリパスが残り再実行される。
- 確認方法: 役割選択後にプロセスが本当に立ち上がり直すか（タスクマネージャで exe が再生成されるか）。
- 位置付け: 「黒画面」より「relaunch 不発」の線。優先度低だが packaged 特有なので記載。

### 容疑 #6（低）— preload / bridge contract の新値による throw
- 結論: **黒画面の主因である可能性は低い**。理由:
  - bridge contract の変更は `RuntimePlayerStartupStatus` に `role: RuntimePlayerHostRoleIdentity | null` を追加しただけ（`runtime-player-bridge-contract.ts:40-52`）。preload 側に role 値を検証して throw する経路は**追加されていない**（preload は素通し）。
  - renderer は `startupStatus?.role ?? null`（`control-window-app.tsx:585`）、shell は `role === null ? null : <Badge>`（`control-window-shell.tsx:96`）で **null 安全**。RoleBadge の `roleBadgeAccentClassName[role.id]`（同 24-27, 44）は未知 id でも className が undefined になるだけで **throw しない**。
  - よって role 起因の renderer クラッシュ→黒、の線は薄い。ただし「自律ホスト Control の IPC reject 4件 unhandled rejection」は既知の degraded 表示であり、React 全体を巻き込んで白紙化する証拠は現差分に見当たらない（degraded はページ単位）。

---

## 2. C1 と無関係な「既存 packaged 経路問題」の可能性評価

**可能性: 中〜高（特に (β)/(γ) の packaged 黒画面なら本命候補）。**

証拠:
1. ビルドターゲットは **portable exe のみ**（`package.json:60-70`）。`files: ["out/**","package.json"]`, asar 明示なし（既定 asar=true）。
2. C1 設計ドキュメントが手動ゲートを **packaged 前提**とし、dev は無効と明言（`domain-c-final-integration.md:178`）。かつ Wave20 申し送りで「packaged smoke pending」。→ **packaged 版が C1 以前に正常起動した証拠はリポジトリ内に見当たらない。**
3. renderer/preload のロードパス（`renderer-entry-url.ts`, `runtime-player-windows.ts:110-122`）は **C1 で未変更**。asar 内 `loadFile` の相対パス・preload `.mjs` 解決・アセット参照が packaged で壊れていれば、それは C1 とは独立の未検証問題。

**含意**: もし黒画面が「役割確定後の窓が描画されない」なら、C1 のロジック（slot/role/title）はおそらく無罪で、**C1 が初めて packaged 起動を必須経路にしたことで既存の packaged 化バグが顕在化しただけ**の可能性が高い。この切り分けは修正方針（C1 差分を疑うか、packaging を疑うか）を左右するため最優先。

反証の余地: dev で `--role=trackingHost` を付けた起動でも黒くなるなら、packaged 固有ではなく C1 差分側（またはGPU/透明窓）に原因が寄る。→ 診断手順 D2 で切り分け可能。

---

## 3. 次に採るべき診断手順（具体コマンド）

PowerShell 前提。**これらは調査者は実行していない（無変更ポリシー）。L0/ユーザーが実施。**

### D1. まず切り分け: 何が黒いのか / ダイアログは出るか
- 素起動して「Choose how to launch Runtime Player」ダイアログが出るか目視。
  - 出る → 容疑 #1 が主因。役割を選んで先に進む。
  - 出ない → no-role パスが動いていない可能性。ログ採取（D3）へ。
- 黒い窓に枠があるか（枠あり=Control / 枠なし=Stage）。→ Control なら #2、Stage なら #3。

### D2. dev で役割明示起動（packaged 固有か C1 差分かの切り分け）
```powershell
# renderer dev server 経由で role 確定起動できるか
cd C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player
# electron-vite dev に引数を渡す（-- 以降が electron に渡る）
pnpm exec electron-vite dev -- --role=trackingHost
```
- ここで正常に窓が描画される → 黒画面は **packaged 固有**（容疑 #2/#5/packaging）。
- dev でも黒 → C1 差分 or GPU/透明窓（容疑 #3/#4）側。
- 注: 引数受け渡し方が効かない場合は、`out/` をビルド後に `pnpm exec electron out/main/main.js --role=trackingHost`（dev server URL 無し=loadFile 経路）でも試す。

### D3. packaged にロギングを付けて起動（DevTools が無いため必須）
```powershell
# packaged exe（例）。--enable-logging で renderer/main のログを stderr/ファイルに出す
& "C:\path\to\Runtime Player <ver>.exe" --role=trackingHost --enable-logging=file --log-file="$env:TEMP\rp-log.txt" --v=1
# 併せて GPU を切って黒が消えるか
& "C:\path\to\Runtime Player <ver>.exe" --role=trackingHost --disable-gpu --enable-logging
```
- ログで `did-fail-load` / `Failed to load preload` / renderer console error を確認。
- `--disable-gpu` で黒が消える → 容疑 #3/#4（GPU/透明窓）。

### D4. DevTools を開く手段（現状 packaged に無い）
- **調査結果: packaged 版に DevTools を開くメニュー/アクセラレータは存在しない。**
  - webPreferences は `devTools:false` を指定していない（`browser-window-options.ts:36-41, 65-71`）ので DevTools 自体は無効化されていないが、
  - カスタムのアプリケーションメニュー/トレイメニュー（`runtime-player-tray-menu.ts`）に DevTools/Reload/Toggle の項目が無く、`setApplicationMenu` で既定メニュー（View→Toggle DevTools の Ctrl+Shift+I）が置き換わるため、**アクセラレータからも開けない**。
- 診断用の一時手段（要コード変更ゆえ L0 判断）: 起動時に `window.webContents.openDevTools({mode:"detach"})` を仕込む、または環境変数ガードで開く仕掛けを一時追加。→ 変更を伴うため本調査では実施せず提案のみ。
- 変更なしで使えるのは D3 の `--enable-logging` とメインプロセス側 `did-fail-load` 監視のみ。

### D5. userData / GPUCache の実体確認
```powershell
# slot 配下に artifacts と GPUCache ができているか
Get-ChildItem "$env:APPDATA\Runtime Player\slots" -Recurse -Depth 2 | Select-Object FullName
```
- slot ディレクトリすら無い → setPath 前の mkdir 到達前に例外の疑い（ログ D3 で確認）。

---

## 4. 質問（L0/ユーザーへ、最終報告に転記）

1. **決定的**: 「真っ暗」は (α) 窓が出ない/ダイアログのみ、(β) 役割選択後 relaunch した窓が黒い、(γ) `--role` 明示起動の窓が黒い、のどれか。起動時に「Choose how to launch Runtime Player」ダイアログは出たか。
2. 起動は **dev（`electron-vite dev`）か packaged（portable exe）か**。packaged なら exe のフルパスとバージョン。
3. 黒い窓に**枠があるか（Control）/ 無いか（Stage）**、両方か。
4. **C1 以前に packaged 版が正常起動した実績はあるか**（あれば C1 差分が濃厚、無ければ既存 packaging 未検証問題の顕在化が濃厚）。
5. 診断のため一時的に DevTools 自動オープン（`openDevTools`）や `--role` 明示のログ採取ビルドを作ってよいか（要ソース一時変更、無変更ポリシー外なので L0 承認が要る）。

---

## 付録: 参照ファイル（絶対パス）
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\runtime-player-main.ts`（合成順序・no-role 分岐・setPath）
- `...\apps\runtime-player\src\main\role-composition\role-selection-stub.ts`（役割ピッカー・relaunch）
- `...\apps\runtime-player\src\main\profile-slots\role-launch-resolution.ts`（argv 解析）
- `...\apps\runtime-player\src\main\profile-slots\slot-lock.ts`（ロック・mkdir）
- `...\apps\runtime-player\src\main\profile-slots\legacy-adoption.ts`（await 採用）
- `...\apps\runtime-player\src\main\window-management\browser-window-options.ts`（show/backgroundColor/transparent/preload）
- `...\apps\runtime-player\src\main\window-management\runtime-player-windows.ts`（loadURL/loadFile）
- `...\apps\runtime-player\src\main\window-management\renderer-entry-url.ts`（renderer/preload パス解決）
- `...\apps\runtime-player\src\main\window-management\runtime-player-tray-menu.ts`（DevTools 項目の不在）
- `...\apps\runtime-player\package.json`（dev スクリプト・portable target）
- `...\discussion\ai-cohost\implementation\waves\c1\domain-c-final-integration.md`（手動ゲート=packaged 前提, 178/246 行）
