# C1 Domain B: 役割合成と身元表示 — 実装レポート

> 実装者: Gnome(サブエージェント委任、Orch-Sylph 経由)。日付: 2026-07-10。
> Source of truth: [c1-wave-plan.md](../../orchestration/c1-wave-plan.md) §3/§4.3/§7/§10/§11、[c1-role-skeleton.md](../../screens/c1-role-skeleton.md) §1/§2/§6/§7、[c1-planning-inventory.md](../../orchestration/c1-planning-inventory.md) 観点3/5/6。
> 前提: Domain A(スロット基盤)完了済み。その `launch` 契約([domain-a-slot-foundation.md](domain-a-slot-foundation.md))を再パースせず、そのまま読んで積んだ。

## 判定: **completed**

役割別レジストラ合成(合成一点のレジストラ集合選択)/ 自律ホストの入力系不在 / startup status への role 伝搬 / 動的タイトル(役割+モデル名)/ Header 役割バッジ / トレイツールチップ / 引数なしの最小役割選択スタブ をすべて実装。focused test 20 件追加(全 pass)。typecheck 通過。全体スイートの失敗 2 件は **Domain A が報告した既存 baseline 失敗(`effectiveDynamicsTuning` / Wave21 系)そのもの**で、私の変更で新規失敗は増えていない。escalate 該当なし(判断点は下記「escalate 評価」に明記)。

---

## 作成 / 変更ファイル(Domain B スコープのみ)

### 新規

| ファイル | 役割 | 純粋性 |
|---|---|---|
| `apps/runtime-player/src/main/role-composition/input-subsystem.ts` | 役割→入力サブシステム合成の一点(tracking=フル / autonomous=inert)。role→composer の data lookup | 純粋(登録関数は注入可) |
| `apps/runtime-player/src/main/role-composition/input-subsystem.test.ts` | 上記テスト(autonomous に入力レジストラ不在を検証) | — |
| `apps/runtime-player/src/main/role-composition/role-selection-stub.ts` | 引数なし=最小役割選択スタブ(素のダイアログ+relaunch)。記憶なし・暗黙束縛なし | 純オーケストレーション+Electron IO |
| `apps/runtime-player/src/main/role-composition/role-selection-stub.test.ts` | 上記テスト | — |
| `apps/runtime-player/src/main/window-management/window-title.ts` | タイトル/トレイツールチップ合成(役割ラベル+モデル名)の純関数 | 純粋 |
| `apps/runtime-player/src/main/window-management/window-title.test.ts` | 上記テスト | — |
| `apps/runtime-player/src/control/control-window-shell.test.ts` | Header 役割バッジの render テスト(role 別アクセント色) | — |

### 変更(既存)

- `apps/runtime-player/src/main/runtime-player-main.ts` — 合成一点の役割別合成、no-role スタブ経路、タイトル/トレイ身元の配線。詳細下記。
- `apps/runtime-player/src/preload/runtime-player-bridge-contract.ts` — `RuntimePlayerStartupStatus` に `role: RuntimePlayerHostRoleIdentity | null` を追加(`{ id, label }`。renderer は表示のみに使う)。
- `apps/runtime-player/src/main/placeholder-action-state.ts` — `createStartupStatus(role?)` が role を乗せる。
- `apps/runtime-player/src/main/placeholder-action-state.test.ts` — role フィールドのテストを追加。
- `apps/runtime-player/src/main/placeholder-bridge-handlers.ts` — `role` を受けて `createStartupStatus` に渡す(既存 `getStartupStatus` pull に相乗り。新チャネル無し)。
- `apps/runtime-player/src/main/window-management/browser-window-options.ts` — Control/Stage の options に任意 `title` を追加(未指定は従来定数。挙動不変)。
- `apps/runtime-player/src/main/window-management/runtime-player-windows.ts` — `controlWindowTitle` / `stageWindowTitle` を受けて創建・再創建(Stage reopen)に伝搬。
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.ts` — 任意 `getToolTip` を受け、初期化と `refresh()` の両方で `setToolTip` する(未指定は "Runtime Player"。挙動不変)。
- `apps/runtime-player/src/main/window-management/runtime-player-tray-menu.test.ts` — tooltip 適用・refresh 再読取のテストを追加。
- `apps/runtime-player/src/main/stage-view-bridge-handlers.ts` — Copy Window Title が **実 OS タイトル**(`stageWindow.getTitle()`、破棄時は従来定数へフォールバック)を配るように変更。
- `apps/runtime-player/src/control/control-window-shell.tsx` — Header 先頭に役割バッジ(`ControlWindowRoleBadge`)。文字+アクセント色の二重。
- `apps/runtime-player/src/control/control-window-app.tsx` — `role={startupStatus?.role ?? null}` を shell に渡すのみ(renderer は挙動分岐しない)。

> **非 Domain B**: git status に出る `broadcast-source/browser-source-config-store.ts(.test.ts)` と `profile-slots/` は **Domain A の成果物**(未コミット)。私は一切触れていない(Subagent Contract: Domain A ファイル非破壊)。

---

## 各要件の実装と設計判断

### 1. 役割別レジストラ組み立て(合成一点)= **実行時 role 分岐なしの表現**

「入力サブシステム」を一つの seam(`RuntimePlayerInputSubsystem` インターフェース)に抽象化し、**役割 → composer の data lookup 表**で選択する:

```ts
export const runtimePlayerInputSubsystemComposers: Record<
  RuntimePlayerHostRole, RuntimePlayerInputSubsystemComposer
> = {
  trackingHost: composeTrackingHostInputSubsystem,  // 現行フル入力3レジストラ
  autonomousHost: composeStaticInputSubsystem       // レジストラ0(inert)
};
```

合成ルート(`runtime-player-main.ts`)では **一行**でこれを引く:

```ts
const inputSubsystem = composeRuntimePlayerInputSubsystem(launch.role, { …deps });
```

- **trackingHost = 現行フル合成(挙動等価)**: `composeTrackingHostInputSubsystem` は旧 `runtime-player-main.ts` の入力3レジストラ組み立て(`registerInputBridgeHandlers` / `registerInputProfileBridgeHandlers` / `registerModelMappingBridgeHandlers`)と circular seam(onTrackingFrame → publishLatestParameterFrame の後付け)を**逐語移設**した。onInputReset / onProfileChanged の副作用(bodyFollow/vowel/stageMotion reset、republish)も同一。**退行ゼロ**。
- **autonomousHost = 入力系レジストラを一切組み立てない合成**: `composeStaticInputSubsystem` は登録関数を呼ばず、全 seam を inert(null / no-op / resolve)で返す。**UDP 受信器も入力 IPC ハンドラも生成されない**(receiver factory 自体に到達しない)。Runtime Export 復元・静止表示・Browser Source・window-state・dynamics-tuning は入力サブシステムの外側にあり両役割で動く。
- **`if (role===...)` 実行時分岐は書いていない**。役割差は上記 data lookup 一点のみ。renderer 側も role を表示専用に受け、挙動分岐しない(§下記 3/5)。

#### modelMappingBridge 下流依存(棚卸し観点5)の構造整理

旧合成では runtime export ハンドラと quit controller が `modelMappingBridge` / `inputBridge` を**直接クロージャ参照**していた(自律ホストで入力系を外すと下流参照が壊れる箇所)。これを **`inputSubsystem` インターフェース経由の均一参照**に整理した:

- stage-motion 入力 seam(`getLatestTrackingFrame` / `getSessionNeutral` / `getActiveInputProfile`)は既存の `let` seam に `inputSubsystem.*` を代入(早期定義クロージャの構造は維持)。
- runtime export ハンドラの `setRuntimeExportPayload` / `clearRuntimeExport` / `flushPendingProfileSave` / `clearLiveParameterFrame` / `publishMappingStatus` / `publishLatestParameterFrame` を `inputSubsystem.*` に置換。
- quit controller の `disconnectInput` / `flushModelMappingProfile`(model mapping 分)を `inputSubsystem.disconnect` / `inputSubsystem.flushPendingProfileSave` に置換(dynamics-tuning flush は入力系外なので別途保持)。

自律ホストではこれらが inert なので**下流参照は壊れず**、実行時分岐も不要になった。`clearLiveParameterFrame` の inert 実装は従来の pre-mapping 既定と同じく `liveParameters.clear()` を呼び、stale フレームが残らないようにした。

### 2. startup status への role 伝搬

`RuntimePlayerStartupStatus` に `role: { id, label } | null` を追加。`createStartupStatus(role?)` が乗せ、`registerPlaceholderBridgeHandlers({ windows, role: roleIdentity })` が渡す(**既存 `getStartupStatus` pull に相乗り、新チャネル無し**)。renderer は `{ id, label }` をそのまま受け、**label を表示、id を色クラス lookup にのみ**使う(role→label 変換も role 分岐も renderer に持ち込まない)。

### 3. 身元表示

- **動的タイトルの受け口設計**: `window-title.ts` に純関数 `composeRuntimePlayerControl/StageWindowTitle({ role, modelName })` を置き、窓創建 options に初期タイトル(役割名込み、モデル未ロード)を渡す。合成ルートに **title controller**(`loadedModelName` + `applyWindowTitles()` + `setLoadedModelName()`)を置き、Runtime Export loaded で `payload.summary.modelDisplayName` を、changing/cleared で `null` を渡して `setTitle()` で織り込む。Stage reopen(`onStageWindowReopened`)では新窓に `applyWindowTitles()` を再適用(役割のみに戻った新窓へモデル名を再付与)。
  - 例: `Runtime Player — Tracking Host` → ロード後 `Runtime Player — Tracking Host — <model>`。Stage は `Runtime Player Stage — <役割> — <model>`。
- **Copy Window Title**: `copyStageWindowTitle` が **実 OS タイトル**(`stageWindow.getTitle()`)を配るよう変更。これで役割・モデル込みの区別可能なタイトルがそのままクリップボードに乗る(破棄時は従来定数へフォールバック)。**contract の `windowTitle` リテラル型は据え置き**(広範囲の型変更を避けた。表示用の base ラベルであり、配布は実タイトルが担う)。
- **Header 役割バッジ**: `ControlWindowRoleBadge` を Header 先頭(Monitor アイコンの前)に配置。文字=`role.label`、アクセント色=`role.id` 別(tracking=teal / autonomous=violet)。**文字+色の二重**(§7.2)。モデル名表示(既存の `Model <status>` ピル)は変えていない(実質インスタンス識別を既存表示に相乗り)。
- **トレイツールチップ**: `composeRuntimePlayerTrayTooltip({ role, modelName })` = `Runtime Player — <役割> / <モデル名>`。tray menu registration に `getToolTip` を渡し、初期化+`refresh()` で適用。モデル名変更時は `setLoadedModelName` が `trayMenu.refresh()` を呼ぶ(seam 経由で順序依存を回避)。**役割色ドットは本 wave スコープ外**(ツールチップのみ。skeleton §7.4)。

### 4. 引数なし = 最小役割選択スタブ

`no-role` 経路を **whenReady 冒頭で早期リターン**し、`presentRuntimePlayerRoleSelectionStub` を起動(役割解決経路の合成には一切入らない)。

- **スタブ本体**は純オーケストレーション: `chooseRole()` を聞き、選ばれれば `relaunchWithRole(role)`、cancel なら `quit()`。**状態を持たず、ディスクに何も書かない**(「記憶なし・暗黙束縛なし」を構造で担保)。
- **既定 IO**: `dialog.showMessageBox`(ボタン=役割ラベル表由来 + Cancel、`noLink`)。ボタン index → 役割は**順序表 lookup**(role 分岐にしない)。「次回から/今後表示しない」チェックは**置いていない**(skeleton §2 恒久禁止)。
- **選択後の起動方式(設計判断)**: `app.relaunch({ args: process.argv.slice(1).concat(['--role=<chosen>']) })` + `app.quit()`。理由: 自プロセスを役割付きで**再起動**することで、Domain A の同期先頭スロット解決(`app.setPath('userData')` の **ready 前**呼び出し不変条件)がそのまま再走する。ダイアログ表示は app ready 後になるため、同一プロセス内で `setPath` を後追いする方式は不変条件と衝突する(Domain A Q1)。relaunch は「自分を役割で起動し直す」だけで、扉2 の子プロセス spawn(スコープ外)とは別物。玄関の完全版(カードUI / Create shortcut / Autonomous only)は本 wave スコープ外(skeleton §7.6)。

---

## 実行時 role 分岐を書かずに役割差を表現した方法(合成一点の具体)

1. **入力サブシステム = 役割選択の唯一点**: `runtimePlayerInputSubsystemComposers[role]`(`Record<role, composer>` の data lookup)。tracking は3レジストラを組み立て、autonomous は組み立てない。合成ルートは `inputSubsystem.*` に均一に配線し、実行時に role を再判定する箇所は無い。
2. **身元表示 = data lookup**: タイトル/トレイ/バッジは `runtimePlayerHostRoleLabels[role]`(Domain A のラベル表を読取再利用)と color-class map(renderer 表示専用)で解決。`if (role===...)` は無い。
3. **供給フェーズの弁別のみ許容**: 分岐は `launch.kind`(role-resolved / no-role / error = 起動フェーズの弁別)と `launch.adoptsLegacyDefaults`(Domain A のデータフラグ)だけ。trackingHost と autonomousHost が**実行時に挙動分岐する箇所は存在しない**。

---

## escalate 評価(該当なし。判断の根拠)

- **Control shell の入力系ページ欠如**: 自律ホストでは input/mapping/inputProfile の IPC ハンドラが登録されないため、Control renderer がそれらを呼ぶと reject する(未処理 rejection、`.catch` の無い pull は "Checking" 表示のまま)。だが **Control shell は crash せず生存**する(React ツリーは startup status ベースで描画済み。rejection は tree を落とさない)。escalate 条件は「Control shell が**ページ欠如を許容できない**構造」だが、**許容できている**(生存・degraded 表示)。加えて wave plan §3.2 は「**自律ホスト版 Overview の画面設計は C4**」と明示しており、自律 Control の見栄えは本 wave の対象外。よって**実行時分岐で凌がず、かつ escalate もせず**、合成一点でレジストラを外す faithful な形を採った。→ **Domain C / C4 への申し送り**として下記に記載。
- **静止表示のための生理層先取り**: 不要。自律ホストは runtime export loaded で `browserSourceServer.publishRuntimeExportLoaded` により**既定ポーズで静止表示**される(live parameter frame を産まないだけ)。呼吸等(C2)は実装していない。
- **`pnpm install`**: 不要(新規モジュールは既存 import のみ)。
- **役割差の実行時分岐回避**: 上記のとおり data lookup 一点で表現でき、分岐を発明する必要は生じなかった。

---

## テスト実行(証拠)

コマンド(ワークスペース既存流儀。`pnpm install` 不実施):

```
cd apps/runtime-player
npx tsc --noEmit -p tsconfig.json          # typecheck
npx vitest run -c vitest.config.ts <paths> # focused
npx vitest run -c vitest.config.ts         # full suite
```

### typecheck: PASS(出力なし・exit 0)

### focused(Domain B 対象 + 影響テスト):

```
✓ src/main/placeholder-action-state.test.ts (6 tests)
✓ src/main/window-management/runtime-player-tray-menu.test.ts (6 tests)
✓ src/main/window-management/browser-window-options.test.ts (5 tests)
✓ src/main/window-management/window-title.test.ts (5 tests)
✓ src/main/role-composition/role-selection-stub.test.ts (3 tests)
✓ src/main/stage-view-bridge-handlers.test.ts (25 tests)
✓ src/control/control-window-shell.test.ts (2 tests)
✓ src/main/role-composition/input-subsystem.test.ts (4 tests)

Test Files  8 passed (8)
     Tests  56 passed (56)
```

検証対応:
- **引数→合成の対応(autonomousHost に UDP/入力レジストラ不在)**: `input-subsystem.test.ts` — autonomousHost 合成で注入した3レジストラ spy が **1回も呼ばれない**こと、`usesTrackingInput===false`、inert seam(null / resolve / liveParameters.clear)を検証。trackingHost では3レジストラが各1回呼ばれることを検証。
- **startup status に role が乗る**: `placeholder-action-state.test.ts` — 既定 null / 指定時 `{id,label}`。
- **タイトル文字列が役割を含む**: `window-title.test.ts` — Control/Stage が役割名を含む、モデル名を後置、空白モデル名の除外、role=null で従来 base。
- **トレイツールチップ**: `window-title.test.ts`(compose) + `runtime-player-tray-menu.test.ts`(getToolTip 適用・refresh 再読取)。
- **Header バッジの render(role 別)**: `control-window-shell.test.ts` — tracking=teal / autonomous=violet、色が共有されないこと。
- **引数なし経路がスタブに到達(暗黙束縛なし)**: `role-selection-stub.test.ts` — 選択で relaunch、cancel で quit、選ぶまで一切 role に束縛しない。

### 全体スイート:

```
Test Files  2 failed | 100 passed (102)
     Tests   2 failed | 534 passed (536)
```

**失敗 2 件は Domain A が報告した既存 baseline 失敗そのもの**(私の触れていないファイル):
- `src/main/broadcast-source/browser-source-server.test.ts` > "serves current Runtime Export payload to authorized Browser Source clients"
- `src/stage/browser-source/browser-source-server-message.test.ts` > "accepts the not-loaded response shape"

いずれも Runtime Export 応答の **`effectiveDynamicsTuning` フィールド**(Wave21 Dynamics Tune 系)の差分。**区別の根拠**: (a) 両失敗は Domain A レポート §テスト実行の baseline 2 件と**テスト名まで一致**、(b) 変更ファイル一覧に `browser-source-server*` は含まれない、(c) 件数の整合 — Domain A 時点 519 tests に対し本 wave で focused 17 件 + 影響テスト内の増分を加えて 536 tests、失敗は 2 件のまま**据え置き**(新規失敗ゼロ)。よって Domain B は**回帰ゼロ**。

---

## Domain C への引き継ぎ事項

1. **パッケージ版手動ゲート(§8)で検証すべき Domain B 固有点**:
   - 扉1(`--role=trackingHost`)= 従来等価(legacy 復元後、全機能が退行なし)。
   - 自律ホスト(`--role=autonomousHost`)= 別モデルを**静止表示**、Browser Source 動作、window-state 分離。**UDP 受信が存在しない**(iFacialMocap を送っても受けない)。
   - **引数なし → 役割選択スタブが出る**。役割を選ぶと `--role=<選択>` で**relaunch** され、その役割の合成で立ち上がる(relaunch が role-resolved インスタンスを実際に生むことを packaged で確認。dev の relaunch は electron-vite 前提で不確実 — packaged で確認するのが素直)。cancel で無起動終了。
   - Control Window Header に役割バッジ(色付き)、タイトルに役割+モデル名、トレイツールチップに `Runtime Player — <役割> / <モデル名>`。Copy Window Title が役割込みタイトルを配る(二体で異なる)。
2. **自律ホスト Control window の degraded 入力/Mapping ページ**: 自律ホストは input/mapping IPC ハンドラを持たないため、Control の Input/Mapping ページは pending/error 表示になる(shell は生存)。**これは C1 の想定内**(wave plan §3.2 で自律 Overview/Control UX は C4)。C4 の自律ホスト UX 設計時に、role を**表示専用**に使って該当ページを畳む/差し替える(実行時 role 分岐にならない形で)方針を決めること。docs 更新時にこの事実を注記されたい。
3. **docs 更新に要る事実**: 引数なし= 玄関スタブ(relaunch 方式)、身元表示語彙(`Tracking Host` / `Autonomous Host`)、タイトル/トレイ/バッジの実装事実、Copy Window Title が実タイトルを配る点。対象は c1-role-skeleton §7(実装反映)/ _map 群。
4. **既存 baseline 2 件(Wave21 `effectiveDynamicsTuning`)** はモノレポ検証で baseline として明示すること(Domain A/B と無関係)。

## 裁量判断・質問(ユーザー/上位判断が必要な曖昧さ。実装で埋めなかったもの)

1. **バッジ・タイトルのアクセント色の具体値**: skeleton §7.2 は「役割ごとのアクセント色/文字+色の二重」を指定するが**具体色は未定義**。tracking=teal(既存テーマ色に整合)/ autonomous=violet を採用。色の最終確定は UX 磨き wave / ユーザー確認の余地。**質問**: この2色でよいか、ブランド上の指定色があるか。
2. **relaunch の args 構成**: `process.argv.slice(1).concat(['--role=<role>'])` を採用。packaged portable exe では素直に効くが、既存 argv に無関係なフラグが載る運用(将来)では重複の可能性。C1 では単純形で足りると判断。**質問**: 玄関完全版(後続 wave)で `--profile` も選ばせる際、この relaunch 契約を拡張する前提でよいか。
3. **タイトルのモデル名区切り**: タイトルは em dash(` — `)、トレイのモデル名は skeleton §7.4 の記法どおり ` / `。整合意図で使い分けた(タイトル=階層、トレイ=役割/モデルの並置)。異論あれば統一可。
4. **busy ダイアログ文言(Domain A 申し送り)**: Domain A の `This profile is already in use by a running ${runtimePlayerHostRoleLabels[launch.role]}.` は**既に身元表示語彙(Tracking Host / Autonomous Host)と整合**しているため、変更不要と判断(触れていない)。
5. **contract `windowTitle` リテラル型**: capture state の `windowTitle`(表示用 base ラベル)は据え置き、配布は実 OS タイトルが担う二層にした。完全一貫(表示も動的)にするなら型を `string` に widen する小改修が要る(本 wave では最小変更を優先)。**質問**: 表示側も動的タイトルに揃えるべきか(C4 の自律 UX と併せて判断可)。

---

## Subagent Contract 遵守の自己確認

- **`pnpm install` 未実施**。回避工作なし(新規モジュールは既存 import のみ。新規依存ゼロ、lockfile 無変更)。
- **Editor ソース / package-format schema / Runtime Export schema 無変更**。触れたのは `apps/runtime-player/src` 配下のみ。`RuntimePlayerStartupStatus` は内部 IPC contract(preload)であり Runtime Export/package-format schema ではない。Runtime Export immutability に該当コード未接触。
- **実行時 `if(role===...)` 分岐なし**。役割差は composer の data lookup 一点。renderer は role を表示専用に受ける。
- **Domain A ファイル非破壊**: `profile-slots/` と `browser-source-config-store.ts(.test.ts)` に一切触れていない。`host-role.ts` のラベル表・役割型は**読取再利用**のみ(改変なし)。Domain A の `launch` 契約は再パースせずそのまま消費。
- **トラッキングホスト合成は現行と挙動等価**: 入力3レジストラ組み立てと副作用を逐語移設。既存の全挙動(Browser Source primary path、Wave10/11/12/17/18/19/20/21/22/23 系)に未接触。no-role の挙動変更(→ スタブ)は wave plan/skeleton が明示要求した Domain B の意図的変更(旧 full-app-on-no-role は Domain A が Domain B の seam として残したもの)。
- **無関係/並行変更の revert なし**(Domain A の未コミット変更・`discussion/` 変更に触れていない)。
- **決定論的箇所に focused test**(20 件追加、全 pass)。
- **ドメイン想定外の共有ファイル**: `stage-view-bridge-handlers.ts`(Copy Window Title)/ `browser-window-options.ts` / `runtime-player-tray-menu.ts` / `runtime-player-windows.ts` は window-management 配下で Domain B スコープ(タイトル・トレイ・スタブ)に含まれる。`preload/runtime-player-bridge-contract.ts` の startup status 拡張は wave plan §4.3/§7 が明示要求(role 伝搬)。いずれも後方互換(既定挙動不変)で本レポートに明示。
