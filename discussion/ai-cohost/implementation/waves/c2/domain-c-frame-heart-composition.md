# C2 Domain C 完了報告: フレーム心臓と役割合成統合

> 実装: Gnome(opus)。委任元: Orch-Sylph。日付: 2026-07-10。ブランチ: feature/2d-rigging-eco-system。対象アプリ: apps/runtime-player。

## 判定

**completed**

Escalate 条件(publish 経路がフレーム源の差し替えを想定しない構造で広い改修が要る)には該当しなかった。既存 `liveParameters.publishFrame` 経路(Stage IPC + Browser Source WS + Stage Motion display state)はソース非依存で、心臓は tracking 経路と同じ seam にそのまま乗れた。役割合成は C1 の data-lookup テーブルを一切変えず、autonomousHost composer の中身(inert → 生成器駆動)を差し替えるだけで済んだ(実行時 role 分岐ゼロを維持)。

## 作成/変更ファイル(絶対パス)

### 新規

- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\autonomous-frame-heart.ts`
  - フレーム心臓本体。60Hz 周期タイマー、壁時計→論理時刻変換、生成器→頭無しリゾルバ→`publishFrame` の配線、単調 sequence / timestamp 供給、start/stop ライフサイクル。`deriveAutonomousSessionSeed(payload)`(session seed 導出、ユーザー非露出)も同居。physiology/ の**外**(role-composition/ 配下・main)なので壁時計 OK(裁定2 の帰結を遵守)。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\autonomous-frame-heart.test.ts`
  - 心臓の focused テスト(11 件)。fake timer / 注入クロック・スケジューラで 60Hz・論理時刻変換・単調性・identity stamp・sanitization・沈黙・リーク無し・多重ロードを固定。

### 変更

- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\input-subsystem.ts`
  - `composeStaticInputSubsystem`(autonomousHost composer)を inert → 生成器駆動へ差し替え。composer は心臓を1つ生成し、`setRuntimeExportPayload(payload)` で `heart.start({ payload, slots: createAutoMappingSlots(payload), seed: deriveAutonomousSessionSeed(payload) })`、`clearRuntimeExport()` / `disconnect()` で `heart.stop()`。共有 deps に**任意注入 seam** `createAutonomousFrameHeart?`(既存の `registerInputBridgeHandlers?` 等と同じテスト注入パターン、既定=実心臓)を追加。`composeTrackingHostInputSubsystem` と `runtimePlayerInputSubsystemComposers` テーブルは**無変更**。
  - import 追加: `createAutoMappingSlots`(auto-mapping)、`createAutonomousFrameHeart` / `deriveAutonomousSessionSeed`(心臓)。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\input-subsystem.test.ts`
  - fake heart 注入ハーネスを追加。trackingHost に心臓・生成器が構築されないこと、autonomousHost の心臓 start/stop ライフサイクル(ロード開始・アンロード/quit 停止・多重ロード)を追加検証(既存テストは意味を保って維持)。

**`runtime-player-main.ts` は無変更。** 心臓のライフサイクル結線点(`onRuntimeExportLoaded` → `setRuntimeExportPayload`、`onRuntimeExportChanging`/`onRuntimeExportCleared` → `clearRuntimeExport`、`quitController.disconnectInput` → `disconnect`)は**既存 seam の中に閉じており**、main 側は既に `inputSubsystem` の各メソッドを呼んでいるため配線コード変更が不要だった(seam の意味を差し替えるだけで心臓が結線される。これが C1 の合成型の狙いどおり)。

作業ツリーの Domain A/B 成果(`runtime-parameter-frame.ts`, `headless-slot-resolver*`, `physiology/`)および discussion 配下の既存ファイルには一切触れていない(`git status` で確認済み)。

## 心臓の設計

### タイマー方式

- main プロセスの `setInterval(tick, 1000/60≈16.67ms)` = 60Hz。`setIntervalFn`/`clearIntervalFn` を注入可能にし(既定=グローバル、fake timer 互換)、`frameIntervalMs` も注入可能。
- 心臓は**単一インスタンス**を composer 生成時に作り、start/stop で beat(payload/slots/generator/epoch)を差し替える。

### 壁時計→論理時刻変換

- `start()` で `epochMs = now()`(ロード完了 = t=0 epoch, 裁定3)。
- 各 tick: `logicalTimeMs = max(0, now() - epochMs)`(壁時計後退ガードで負値回避)→ `generator.sample(logicalTimeMs)`。**論理時刻の算出は心臓が担い、生成器は壁時計を触らない**(physiology/ の純度を汚さない)。
- `now` は注入可能(既定 `Date.now`)。壁時計は決定性境界の外(裁定3/7)。

### seed の出所

- `deriveAutonomousSessionSeed(payload) = hashStringToSeed("packageId:packageRevision:loadedAtIso")`(physiology の `hashStringToSeed` を再利用)。ユーザー非露出(C2 §5)、payload identity から決定論的に導出。同一ロード→同一 blink、`loadedAtIso` が進む各ロード→固有のリズム(生きている感)。Math.random 非使用ゆえ composer/心臓ともテスト決定論を保つ。**seed は frame に載らない**(sanitization、後述)。

### frame 組み立て

各 tick で `RuntimePlayerLiveParameterFrame` を組み立て `deps.liveParameters.publishFrame(frame)` へ:
- `schemaVersion`: `"runtime-player-live-parameter-frame-v1"`(不変)。
- `runtimeExport`: ロード payload の `summary.packageId` / `summary.packageRevision` / `loadedAtIso`(下流 `canApplyLiveParameterFrame` の identity ガードに一致)。
- `sequence`: 心臓寿命を通じ never-reset の単調増加カウンタ(ロード→ロードでもリセットせず、下流が sequence 逆行を見ない)。
- `sourceFrameTimestampMs`: `now()`(壁時計 ms)。下流 dynamics の delta は `sourceFrameTimestampMs` 差分で前進(≈16.67ms/frame の実時間前進)。renderer は model ロード/clear/unload で `lastLiveSourceTimestampMs=null` にリセットし `max(0, diff)` でクランプするため、リロード跨ぎでも安全。
- `producedAtIso`: `new Date(now()).toISOString()`。
- `parameterValues`: `resolveSemanticSlotParameterValues({ slots, activations })` の出力(parameterId キー)。

### 開始/停止のライフサイクル結線点

- **開始**: `onRuntimeExportLoaded(payload)` → `inputSubsystem.setRuntimeExportPayload(payload)`(:465)→ composer が `heart.start(...)`。
- **停止(アンロード)**: `onRuntimeExportChanging` / `onRuntimeExportCleared` → `inputSubsystem.clearRuntimeExport()`(:454/:485)→ `heart.stop()`。
- **停止(quit)**: `quitController.disconnectInput` → `inputSubsystem.disconnect()`(:498)→ `heart.stop()`。タイマー dispose、リーク無し・quit 阻害無し。
- **多重ロード**: `start()` は先頭で `stop()` を呼び、旧タイマーを clear してから新規開始(二重タイマー化を防止)。

## 役割合成の差し替え方(role 分岐ゼロ・trackingHost 無変更)

- 差し替えは `composeStaticInputSubsystem`(autonomousHost の composer)の**中身のみ**。`runtimePlayerInputSubsystemComposers`(`role → composer` の data lookup)は無変更で、`composeRuntimePlayerInputSubsystem(role, deps)` も無変更。**実行時 `if (role === ...)` を一切書いていない**。役割差は依然としてテーブル一点で表現。
- `composeTrackingHostInputSubsystem` は**完全無変更**(生成器・心臓を構築しない)。テストで「trackingHost 合成が `createAutonomousFrameHeart` を一度も呼ばない/ロードしても heartbeat を開始しない」ことを明示的に固定(下記)。
- 心臓は別モジュール(`autonomous-frame-heart.ts`)に切り、composer から起動/停止する形(テスト容易性)。composer への注入 seam(`createAutonomousFrameHeart?`)は autonomousHost 専用で trackingHost は無視する(既存の registrar 注入 seam と同じ流儀)。
- `publishLatestParameterFrame` は autonomousHost では**no-op のまま**維持。心臓が唯一のフレーム源であり、ロード直後 `void inputSubsystem.publishLatestParameterFrame()`(:477)が心臓 tick と競合しない。初回フレームは初回 interval tick(`start()` 戻り後の非同期)で到着するため、`clearLiveParameterFrame()`(:469)より**後**に来る(順序ハザード回避)。

## テスト一覧と実行結果

### `autonomous-frame-heart.test.ts`(11 件、全 pass)

注入クロック + 手動スケジューラ(明示 fire)でフレーム内容・単調性・沈黙を決定論的に、fake timer で実タイマーのリークを検証:

1. 壁時計→論理時刻変換(loadedAt=epoch、`sample` に `[16,32,48]` = wall-epoch が渡り raw wall clock でない)。
2. 単調 sequence(1,2,3,4,5)+ 単調 `sourceFrameTimestampMs`(=壁時計)+ `producedAtIso` = 壁時計。
3. 多重ロードで sequence never-reset(ロード→ロードで 1,2 → 3 と継続、epoch は論理時刻側でリセット)。
4. identity stamp(`runtimeExport` = payload identity)+ activation→parameterValues 解決(invert:true, activation 1=閉 → target.min)。
5. **実生成器**で t=0 は目開き(activation 0 → target.max、default-pose 等価)。
6. **sanitization**: frame のキーは許可 6 種のみ、`parameterValues` は parameterId キー(slotId でない)、シリアライズに seed(99)が出現しない。
7. **沈黙**: 未写像(slots 空)で `parameterValues={}`、throw 無し、publish は継続。
8. 多重ロードで旧タイマーを1度だけ clear・新タイマー1本(setInterval 2 回 / clearInterval 1 回)、2つ目の generator 出力のみ反映。
9. stop でタイマー dispose・冪等(2度目 stop で再 clear せず throw せず)、停止後の残 fire は publish しない。
10. seed 導出の安定性(同一 payload→同値、`loadedAtIso` 差→異値、有限)。
11. 実タイマーライフサイクル(`vi.useFakeTimers` + `vi.getTimerCount()`): start で 1 本・100ms で ≥5 frame・stop で 0 本(リーク無し)・停止後は時間経過で publish されない。

### `input-subsystem.test.ts`(7 件、全 pass。既存 4 + 追加 3)

- (既存)role ごとに composer が丁度1つ / trackingHost が3レジストラ組立 / autonomousHost が入力レジストラ非組立 / autonomousHost の静的 seam。
- (追加)**trackingHost に心臓・生成器不在**: `createAutonomousFrameHeart` が一度も呼ばれず、ロード/アンロード/disconnect しても heartbeat 開始しない。
- (追加)**autonomousHost の心臓ライフサイクル**: composition で心臓1つ構築(`{ liveParameters }` で配線)、ロードで `heart.start`(slots=16=全意味スロット・seed=number・payload identity)、アンロードで `heart.stop`、quit(disconnect)で `heart.stop`。
- (追加)**多重ロード**: 心臓は1インスタンスのまま `heart.start` が2回(内部で旧タイマー dispose)。

### コマンドと件数

app ディレクトリ `apps/runtime-player` にて:

- focused: `npx vitest run src/main/role-composition/autonomous-frame-heart.test.ts src/main/role-composition/input-subsystem.test.ts` → **18/18 pass**(11 + 7)。
- typecheck: `npx tsc --noEmit -p tsconfig.json` → **exit 0(エラーゼロ)**。
- app 全体回帰: `npx vitest run` → **606 pass / 2 fail**(608 中)。fail 2 件は既知 baseline(`src/main/broadcast-source/browser-source-server.test.ts` の "serves current Runtime Export payload..." と `src/stage/browser-source/browser-source-server-message.test.ts` の "accepts the not-loaded response shape"、いずれも `effectiveDynamicsTuning: null` = Wave21 Dynamics Tune 由来のフィクスチャドリフト)。**当方の変更(role-composition/ のみ)とは無関係・不接触**。
  - 注記: 最初の1回だけ集計が "605 pass / 3 fail" と出たが、再実行3回すべて "606 pass / 2 fail" で安定。3件目は当方変更外の timing 依存テストの一過性フレークで、以降のランで一貫して pass(当方の心臓テストは全ランで pass)。

## sanitization 境界の維持(blocking 観点)

- renderer(Stage IPC / Browser Source WS)へは既存 `liveParameters.publishFrame(frame)` 経由で `RuntimePlayerLiveParameterFrame` のみが渡る。心臓は新しい送信経路を作らず既存 seam に乗せることで境界を維持。
- frame に載るのは `schemaVersion` / `runtimeExport{packageId,packageRevision,loadedAtIso}` / `sequence` / `producedAtIso` / `sourceFrameTimestampMs` / `parameterValues`(= parameterId キー)のみ。**seed・raw スロット活性度(slotId キー)・私的情報は frame に載らない**。テスト6でキー集合・parameterId キー・seed 非出現を機械的に固定。既存 "sanitizes live parameter frames to the render-only frame shape" テスト(browser-source-server-message)は無変更で pass。

## 失敗も沈黙の確認(§4)

- まぶたに写像できないモデル(auto-map で eye-blink スロットが target=null / disabled / 活性度未供給)では、頭無しリゾルバが黙って空/部分 `parameterValues` を返す(Domain A の沈黙契約)。心臓はエラーを投げず・ログを出さず、空 `parameterValues` の frame を publish し続ける(= 静止のまま)。テスト7(slots 空 → `{}`、throw 無し)で固定。エラーダイアログ・ログ洪水なし。

## 裁量判断

- **心臓のモジュール分割**: `autonomous-frame-heart.ts` に分離し composer から起動/停止(テスト容易性)。心臓は `now`/`setIntervalFn`/`clearIntervalFn`/`frameIntervalMs`/`createGenerator` を注入可能にし、fake timer と注入クロック両方でテスト可能。
- **seed 決定場所**: composer(`composeStaticInputSubsystem`)が `deriveAutonomousSessionSeed(payload)` で決定し `heart.start` に渡す(タスク文言「composer 内で決める」に準拠)。心臓は seed から generator を作るだけ。導出は payload identity ベースの決定論(Math.random 非使用)で、composer/心臓のテスト決定論を保つ。
- **`sourceFrameTimestampMs` = 壁時計 `now()`(logical time でなく)**: 下流 dynamics の delta が実時間で前進し、session 内で単調。renderer が model ロード/clear/unload で `lastLiveSourceTimestampMs=null` にリセットし `max(0, diff)` でクランプするため、リロード跨ぎの大ジャンプも安全(tracking 経路の壁時計 timestamp と同じ性質)。決定性境界外なので壁時計 OK(裁定3/7)。
- **`sequence` = never-reset 単調カウンタ**: ロード→ロードでもリセットせず、下流が sequence 逆行を絶対に見ない。
- **`clearLiveParameterFrame` との順序制御**: 初回フレームを `start()` 内で**同期発火しない**(初回 interval tick に委ねる)ことで、ロード直後 `clearLiveParameterFrame()`(:469)の後に初回フレームが来る順序を保証(タスク指摘のハザード回避)。`publishLatestParameterFrame` を no-op のまま維持し :477 との競合も回避。t=0 は blink activation 0 = 目開き = default pose 等価のため、初回 tick(≈16ms 後)まで視覚的不連続なし。
- **composer 注入 seam の追加場所**: 共有 `RuntimePlayerInputSubsystemDependencies` に `createAutonomousFrameHeart?`(optional)を追加。既存の registrar 注入 seam と同一流儀で、trackingHost composer は無視。共有型に autonomousHost 専用フィールドが増えるが、テスト注入のための最小・既定=実装で、C1 の型の一様性(role→composer テーブル)を崩さない。

## 質問

- なし(ブロッカーなし)。Domain D への申し送り2点:
  1. **手動美的ゲート(C2 wave-plan §9 Manual Check Notes)は未実施**(source 実装のみ担当。Native Stage / Browser Source での実機瞬き確認、30秒「死体に見えないか」判定は Domain D / ユーザーの領分)。心臓は 60Hz で `publishFrame` を叩き、Stage IPC + Browser Source WS 両方に既存経路で乗るため、両表示に同じ frame が届く構造。
  2. **`sourceFrameTimestampMs` に壁時計を採用**した(logical time でなく)。理由は上記裁量判断参照。決定論 fixture は Domain B の意味スロット列が担保しており、送信タイムスタンプは決定性境界外。もし Domain D の統合ゲートで「送信タイムスタンプも決定論固定したい」要望が出た場合は、`sourceFrameTimestampMs` を logical time に切替可能(注入 `now` で吸収)。現状は裁定3/7 の「送信タイムスタンプは壁時計 OK」に沿う。

## Subagent Contract 遵守確認

- **`pnpm install` 未実施**。回避工作なし。lockfile・`pnpm-workspace.yaml`・新規依存いずれも無変更。
- **Editor ソース / package-format / Runtime Export schema 無変更**。変更は `apps/runtime-player/src/main/role-composition/` 配下のみ(+ 本完了報告)。
- **実行時 `if (role === ...)` 分岐ゼロ**(役割差は合成テーブル一点。テストで trackingHost に心臓不在を固定)。
- **trackingHost の挙動を一切変えていない**(`composeTrackingHostInputSubsystem` 無変更、既存 tracking テスト全 pass)。
- Domain A(headless-slot-resolver / runtime-parameter-frame)/ Domain B(physiology/)の成果を**退行させず、import して使うだけ**(それらのファイルに不接触)。physiology/ の純度制約は心臓側(main・壁時計 OK 域)には及ばず、生成器へは論理時刻を引数で渡すのみ。
- C1 成果・Browser Source primary path・Wave10/11/12/17/18/19/20/21・Wave22/23 vowel lip sync を退行させない(既存経路 `publishFrame` にそのまま乗せ、frame 型・sanitization 不変。全体回帰の pass は Domain B 時点 592 → 606 に本ドメイン分増、既知 fail は同一2件)。
- **無関係変更の revert なし**。作業ツリーの既存 M ファイル(discussion 配下、Domain A の runtime-parameter-frame.ts 等)に不接触(`git status` で footprint 確認)。
- **ドメイン想定外の共有ファイルに触れていない**。`input-subsystem.ts` への注入 seam 追加は本ドメインの中心(composer 差し替え)の一部であり、理由は上記のとおり。
