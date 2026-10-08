# C1 Domain B レビュー — レーン2: design/development compliance

> レビュアー: Review-Sylph(Orch-Sylph からのサブエージェント委任、design/development compliance 専任)。日付: 2026-07-10。
> 対象: `apps/runtime-player`。Gnome 実装レポート [domain-b-role-composition-identity.md](../../waves/c1/domain-b-role-composition-identity.md) の検証。
> 判定基準: [c1-wave-plan.md](../../orchestration/c1-wave-plan.md) §4.3/§10/§11、[c1-role-skeleton.md](../../screens/c1-role-skeleton.md) §1/§5、[c1-planning-inventory.md](../../orchestration/c1-planning-inventory.md) 観点3/5/6。
> レーン境界: 合成一点規律・既存アーキテクチャ整合を検証。spec 突合(レーン1)と test adequacy(レーン3)は対象外。

## 判定: **合格(条件付き = blocking なし / non-blocking 指摘あり)**

design/development compliance の観点で **blocking は 0 件**。合成一点規律・実行時 role 分岐の不在・既存アーキテクチャ整合・Subagent Contract 遵守をいずれも自分で確認し、満たしていると判断する。non-blocking 指摘(主に autonomous host の未処理 rejection ノイズと将来のドリフト予防)を下記に列挙する。

---

## 観点ごとの評価

### 1. 実行時 role 分岐の不在(BLOCKING 観点) — **合格**

`apps/runtime-player/src` 全域を grep(`role ===` / `=== trackingHost|autonomousHost` / `role !==` / `switch(...role)`)。役割**値**(trackingHost / autonomousHost)で挙動を分岐する箇所は main / renderer いずれにも**存在しない**。ヒットは以下のみ:

- `role === null` の**存在判定**(表示するか否か): `control-window-shell.tsx:96`、`window-title.ts:32,76`、`role-selection-stub.ts:43`(cancel 判定)。いずれも「役割が有るか無いか」であって「どの役割か」ではない。
- `launch.kind === "error" / "role-resolved"`(`runtime-player-main.ts:102,109,133`)= **起動フェーズの弁別**(§4.3 が許容。role 値の分岐ではない)。
- `launch.adoptsLegacyDefaults`(`:151`)= Domain A のデータフラグ(スロット名由来)。role 値分岐ではない。
- `slot-lock.ts:110,134` の `record.role`/`options.role` = Domain A のロック記録の有無判定。
- 残りは全てコメント(`// no if (role === ...)`)。

役割差は composer の data lookup **一点**(`runtimePlayerInputSubsystemComposers[role]`、`input-subsystem.ts:173-185`)と、身元表示の table lookup(`runtimePlayerHostRoleLabels[role]`、`roleBadgeAccentClassName[role.id]`)に閉じている。renderer は role を**表示専用**に使い挙動分岐しない: `control-window-app.tsx:585` は `role={startupStatus?.role ?? null}` を shell へ渡すだけ、`control-window-shell.tsx` はバッジの文字(`role.label`)と静的 className(`roleBadgeAccentClassName[role.id]`)にのみ使用。**合格**。

### 2. 合成一点規律 — **合格**

- 入力サブシステム抽象化(`RuntimePlayerInputSubsystem` seam、`input-subsystem.ts:24-39`)が composition root 一点でのレジストラ集合選択になっている。`composeRuntimePlayerInputSubsystem(launch.role, {...deps})` を `runtime-player-main.ts:418` で**一行**引き、以降は `inputSubsystem.*` に均一配線。
- **trackingHost 合成の等価移設を逐語照合した**。旧 `runtime-player-main.ts` の入力3レジストラ組み立て(`registerInputBridgeHandlers`/`registerInputProfileBridgeHandlers`/`registerModelMappingBridgeHandlers`)と circular seam(`let publishLatestParameterFrame` / `let clearLiveParameterFrame` の後付け late-binding、`onTrackingFrame → publishLatestParameterFrame`)が `composeTrackingHostInputSubsystem`(`:70-140`)に等価移設されている。副作用も一致:
  - `onInputReset`: bodyFollow.reset / vowel.reset / **resetStageMotion(=旧 stageMotionRuntime.reset)** / clearLiveParameterFrame。旧同様 **republish は呼ばない**。一致。
  - `onProfileChanged`: bodyFollow.reset / vowel.reset / resetStageMotion / **requestStageMotionRepublish(=旧 `void publishLatestStageMotionDisplayState({notify:"immediate"})`)** / `return publishLatestParameterFrame()`。一致。
  - stageMotion 副作用は `deps.resetStageMotion` / `deps.requestStageMotionRepublish` の注入で外出しされ、main 側でクロージャに再結線(`:426-434`)。移設漏れなし。
- **onInputReset / onProfileChanged の副作用移設漏れは無い**。退行の温床(順序入替・副作用欠落)を確認したが見当たらない。**合格**。

### 3. modelMappingBridge 下流依存の整理 — **合格**

- 旧来 runtime export ハンドラ/quit controller が `modelMappingBridge`/`inputBridge` を直接クロージャ参照していた箇所を `inputSubsystem.*` 均一参照へ整理(`runtime-player-main.ts` の runtime-export handlers `:447-497`、quit controller `:501-510`)。設計として健全。
- autonomousHost の inert 実装(`composeStaticInputSubsystem`、`:150-166`)が下流を壊さない: `setRuntimeExportPayload`/`clearRuntimeExport`/`publishMappingStatus`/`flushPendingProfileSave`/`disconnect` は no-op/resolve、`getLatestTrackingFrame`/`getSessionNeutral`/`getActiveInputProfile` は null。runtime export loaded 時の静止表示は `browserSourceServer.publishRuntimeExportLoaded`(inputSubsystem の**外側**)が担うため、autonomous でもモデルは既定ポーズで表示される。
- **`clearLiveParameterFrame` の inert 実装が stale フレームを残さない**: static 版も `deps.liveParameters.clear()` を呼ぶ(`:159-161`)。共有 live-parameter registration(`registerLiveParameterBridgeHandlers`、両役割で main 側に存続)を確実にクリアするため、pre-mapping 既定と等価で stale は残らない。**確認済み**。
- quit controller の flush 分離が正しい: `flushModelMappingProfile` は `inputSubsystem.flushPendingProfileSave()`(model mapping 分、autonomous では no-op)+ `dynamicsTuningBridge.flushPendingProfileSave()`(dynamics-tuning、入力系外なので別途保持)の二段。旧挙動と等価。**合格**。

### 4. 既存アーキテクチャ整合 — **合格**

- **startup status への role 追加が既存 pull チャネル相乗り**: 新チャネル増設なし。`createStartupStatus(role?)`(`placeholder-action-state.ts:28`)が `role` を乗せ、`registerPlaceholderBridgeHandlers({role})` が既存 `getStartupStatus` handler(`placeholder-bridge-handlers.ts:24`)で配る。preload の `placeholderBridgeChannels` は無変更。
- **preload contract 変更は後方互換**: `RuntimePlayerStartupStatus` に `role: RuntimePlayerHostRoleIdentity | null` を追加(`runtime-player-bridge-contract.ts`)。`role: null` を許容し、no-role/legacy 経路と整合。renderer 側 `role?` は省略可(shell の default = null)。
- **動的タイトルの受け口**: `browser-window-options.ts` の任意 `title`(未指定は従来定数 → 挙動不変)、`runtime-player-windows.ts` の `controlWindowTitle`/`stageWindowTitle` 伝搬(創建・Stage 再創建の両経路に `...(x === undefined ? {} : {title:x})` で opt-in)、`onStageWindowReopened` での `applyWindowTitles()` 再適用(`runtime-player-main.ts:324`)。既存窓ライフサイクルを壊さず opt-in で追従。
- **tray refresh の setToolTip 適用**: `runtime-player-tray-menu.ts` が任意 `getToolTip` を受け、初期化と `refresh()` の両方で `setToolTip(resolveToolTip())`(未指定は "Runtime Player")。既存 tray 構造(setContextMenu/setApplicationMenu)に相乗り。モデル名変更時は `setLoadedModelName → refreshTrayIdentity → trayMenu.refresh()`(`:203`)で seam 経由に順序依存を回避。**合格**。

補足(TDZ 検証): `applyWindowTitles`/`setLoadedModelName` は `windows` const 宣言より前に**定義**されるが、いずれもクロージャで、初回**呼出**は runtime-export handlers / `onStageWindowReopened`(いずれも `windows` 初期化後)。`refreshTrayIdentity` も初回呼出時には実体へ再代入済み(未代入でも no-op stub で安全)。TDZ 問題なし。

### 5. 役割選択スタブの relaunch 方式 — **合格(設計判断として健全)**

`app.relaunch({args: process.argv.slice(1).concat(['--role=<chosen>'])}) + app.quit()`(`role-selection-stub.ts:83-88`)。

- Domain A の不変条件「`app.setPath('userData')` は app ready **前**」と整合させるため、同一プロセス内で dialog(ready 後)→ setPath 後追いを避け、**再起動で先頭からスロット解決を再走**させる設計は妥当。`startRuntimePlayerMain` 冒頭の同期スロット解決(`runtime-player-main.ts:88-125`)が fresh プロセスで pre-ready に走るため、不変条件を破らない。
- スタブが**状態を持たない**ことが構造で担保: `presentRuntimePlayerRoleSelectionStub`(`:38-50`)は純オーケストレーション(ask → relaunch or quit)、ディスク書込なし、記憶なし。「次回から/今後表示しない」affordance を置いていない(§2 恒久禁止に準拠)。ボタン index → role は順序表 lookup(`:59-82`)で role 分岐にしていない。**合格**。

### 6. 退行なし — **合格**

- トラッキングホスト合成は §2 のとおり逐語等価。Browser Source primary path・Wave10-23 系(input3レジストラ・model-mapping・dynamics-tuning・variant・vowel lipsync)は inputSubsystem seam の裏に移っただけで挙動不変。EADDRINUSE/browser-source-server は Domain B 非接触。
- **Copy Window Title の変更**(`stage-view-bridge-handlers.ts:557-573`): 配布内容を固定定数 `runtimePlayerStageWindowTitle` から**実 OS タイトル** `stageWindow.getTitle()`(破棄時は従来定数フォールバック)へ変更。既存導線(Stage view action → clipboard)そのものは不変で、配布**値**が役割+モデル込みの実タイトルになるだけ。二体識別という C1 の意図に沿い、既存フローを壊さない。**退行なし**。

### 7. 不変条件の維持(§5) — **合格**

実行時の相互関与は role 合成に一切現れない。role による挙動分岐が renderer/main に染みていないことは観点1で確認済み。フレーム/ポート/userData/生死の相互非関与は Domain A のスロット分離が担保し、Domain B は role を identity(表示)と composer 選択(起動時合成)にのみ使う。

### 8. Subagent Contract(§10) — **合格**

`git diff --name-only` / `--stat` で確認:

- **新規依存ゼロ / lockfile 無変更 / package.json 無変更**: `grep -iE 'lock|package.json'` ヒットなし。新規モジュールは既存 import のみ。
- **runtime-player/src 外の変更ゼロ**: 変更は全て `apps/runtime-player/src/` 配下。Editor・package-format・Runtime Export schema に非接触(`RuntimePlayerStartupStatus` は内部 IPC contract であり Runtime Export/package-format schema ではない)。
- **無関係 revert なし**。
- **Domain A ファイル非破壊**(条件付き確認 → 下記「質問」参照): `profile-slots/`・`role-composition/` は新規、`host-role.ts` は読取再利用のみ(diff なし)。`browser-source-config-store.ts` の変更は Domain A の port seam(`createPreferredPort`)であり、Domain B main は `createPreferredPortFactory(launch.preferredPort)` を渡して**消費**するのみ。作業ツリー上は Domain A/B が未コミットで混在するため git だけでは著者分離を厳密検証できないが、変更内容は Domain A の契約と整合する。

### 9. renderer 秘匿漏れ — **合格**

startup status 拡張は `role: {id, label}` のみ追加。`id` は役割リテラル、`label` は英語表示語彙。token/私的パス/raw トラッキングは新たに renderer へ流れていない(`createStartupStatus` の他フィールドは既存の placeholder であり、`input.receivePort: 49983` は固定 placeholder で実 browser-source port/token ではない)。sanitization 境界は破られていない。**合格**。

### 10. degraded Control ページの design 評価 — **design 上健全(non-blocking の観測を伴う)**

自律ホストでは input/inputProfile/modelMapping の IPC handler が登録されない(3レジストラを組まないため)。renderer(`control-window-app.tsx:190-215`)の pull は `window.runtimePlayer.input.getStatus().then(...)` 等で、**`.catch` を持たない**。autonomous host ではこれらのチャネルにハンドラが無いため `ipcRenderer.invoke` が `Error: No handler registered for '...'` で reject し、**未処理 promise rejection が renderer 側で 4 件発生**する(input.getStatus / input.getDiagnostics / inputProfile.getStatus / modelMapping.getStatus)。

design 評価:

- **クラッシュ経路を生まない**: Chromium renderer の未処理 rejection はプロセスも React ツリーも落とさない。shell は startup status ベースで描画済みで生存する(Gnome の「shell 生存で escalate 不要」判断は**正しい**)。§4.3 の escalate 条件「Control shell がページ欠如を**許容できない**構造」は成立していない(許容できている)。
- **主プロセスのログファイル汚染は生じない**: rejection は renderer の devtools console に出るのみで、packaged build では devtools 非表示時はユーザー不可視。main プロセスの log には出ない。
- **実行時 role 分岐を避けた代償として degraded は妥当**: 代替(role 値で input ページを畳む)は §1/§4.3 で**禁止**されている実行時 role 分岐そのもの。真の解(role を**表示専用**に使った display-only のページ折り畳み)は wave plan §3.2 が明示的に **C4 スコープ**(自律ホスト版 Overview/Control UX)と定めている。したがって本 wave で degraded を残し escalate しない判断は design 上健全。

ただし未処理 rejection は「console ノイズ」という形の実在する design debt であり、下記 non-blocking N1 として C4 への申し送りと軽微な予防策を推奨する。

---

## blocking 一覧

**なし。**

---

## non-blocking 指摘

- **N1(degraded pull の未処理 rejection / design debt)**: `control-window-app.tsx:190,198,203,211` の入力系 pull は `.catch` を持たず、autonomous host で 4 件の未処理 rejection を毎起動発生させる。クラッシュ/秘匿漏れ/main ログ汚染はないため本 wave では非 blocking。**推奨**: (a) C4 の自律 Control UX で role を表示専用に使いページを畳む際に解消する(wave plan §3.2 の正規解)、または (b) それまでの暫定として役割非依存の防御的 `.catch`(no-handler を握り潰し pending 表示維持)を検討。ただし (b) は Domain B の最小スコープ外で renderer pull 配線に触れるため、C4 まで据え置くのが素直。**Domain C の docs 更新でこの degraded 挙動を明記されたい**(Gnome 引き継ぎ2 と一致)。

- **N2(preload の role リテラルドリフト予防)**: `RuntimePlayerHostRoleIdentity.id` は `"trackingHost" | "autonomousHost"` を preload contract に**インライン**定義(`runtime-player-bridge-contract.ts`)。preload → main/profile-slots の import はレイヤ逆流になるため、`RuntimePlayerHostRole` を import せずインライン化した判断は**レイヤリング上正しい**。第3役割追加時にこの union が自動追従しないドリフトリスクはあるが、main 側 `roleIdentity: RuntimePlayerHostRoleIdentity = { id: launch.role, ... }`(`runtime-player-main.ts:146-149`、`launch.role: RuntimePlayerHostRole`)の代入で **tsc がドリフトを検出**する(union が狭まれば型エラー)。よって安全。指摘は将来の可読性メモに留める。

- **N3(relaunch args の dev 不確実性)**: `process.argv.slice(1)` は packaged portable exe で素直に効くが、dev(electron-vite)では argv 構成が異なり relaunch の確実性が落ちる。Gnome も packaged での手動ゲート確認を申し送っている(引き継ぎ1)。design 判断としては単純形で C1 に十分。**Domain C のパッケージ版手動ゲートで実 relaunch を確認する項目**として残すこと。

---

## degraded ページの design 評価(まとめ)

- **健全**。escalate 条件(§4.3)は成立せず(shell 生存で許容できている)、実行時 role 分岐を避けた faithful な合成一点の帰結として degraded を残す判断は design と整合する。真の UX 解は wave plan が C4 と定めたスコープ。
- 唯一の実在コストは renderer console の未処理 rejection ノイズ(N1)。クラッシュ経路・秘匿漏れ・main ログ汚染のいずれも無く、本 wave の blocking にはあたらない。

## 裁量判断の妥当性(design 観点)

- **合成一点の表現(composer table)**: 妥当。role 差を data lookup に閉じる §4.3 の要求を最も素直に満たす。
- **stageMotion 副作用の注入外出し(resetStageMotion/requestStageMotionRepublish)**: 妥当。circular seam を composer 内に閉じつつ、stageMotion ランタイムへの依存を main 側クロージャに残す構造で、逐語等価と分離を両立している。
- **Copy Window Title を実 OS タイトル配布へ変更 + contract の `windowTitle` リテラル型据え置き**: 妥当。二層(表示 base=静的リテラル / 配布=動的実タイトル)は最小変更で二体識別を達成する。完全一貫(表示も動的)は C4 の自律 UX と併せ判断可という Gnome の整理に同意。
- **relaunch 方式**: 観点5 のとおり妥当。

## 質問(Orch-Sylph への申し送り)

1. **Domain A ファイル著者分離の検証限界**: 作業ツリー上 Domain A/B が未コミットで混在するため、`browser-source-config-store.ts`(+`.test.ts`)の変更が Domain A 由来であることを git だけでは厳密に確認できなかった。変更内容は Domain A の port seam と整合し Domain B main が消費するのみで design 上問題は無いが、**Domain A レビュー(レーン担当)側で当該ファイルの著者・非破壊性を確定**しておくことを推奨する。本レーンは Domain B の design 整合として「Domain B は Domain A ファイルを改変していない(読取消費のみ)」と判断した。
2. **N1 の暫定 `.catch` を C1 で入れるか、C4 まで据え置くか**: design 上は据え置きで問題ないが、autonomous host を C1 手動ゲートで動かす際に console ノイズがゲート判断の妨げにならないか、上位で軽く確認されたい。
