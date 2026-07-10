# C2 Domain C レビュー — レーン① spec compliance

> レビュー: Review-Sylph(opus)。委任元: Orch-Sylph。日付: 2026-07-10。レーン: spec compliance(wave plan + c2 設計討議への突合)のみ。読み取り専任。
> 対象ブランチ: feature/2d-rigging-eco-system。対象: `apps/runtime-player/src/main/role-composition/`(新規 `autonomous-frame-heart.ts`/`.test.ts`、変更 `input-subsystem.ts`/`.test.ts`)。

## 判定

**合格(要修正なし)。blocking 観点は 5 つとも適合。**

Gnome 完了報告の主張は、対象ファイル・差分・依存モジュール(headless-slot-resolver / physiology / live-parameter-bridge-handlers / runtime-player-main)を自分で読んで裏取りした結果、spec compliance レーンの観点では正確だった。

---

## spec 適合状況(裁定・§ごと)

### 裁定3(60Hz 心臓・壁時計→論理時刻) — 適合

- `autonomous-frame-heart.ts:39,158` main プロセスの `setInterval(tick, 1000/60≈16.67ms)` = 60Hz。心臓は `role-composition/`(= physiology/ の**外**)に居り、壁時計 `now()`(既定 `Date.now`)を触るのはこのモジュールのみ。裁定2 の「生成器は package-ready 純度=壁時計を持ち込まない」を心臓が肩代わりする配置になっている。
- `:153` `start()` で `epochMs = now()`(ロード完了 = t=0 epoch)。`:112` 各 tick で `logicalTimeMs = max(0, now() - epochMs)`(壁時計後退ガード付き)を算出し `:113` `generator.sample(logicalTimeMs)` へ渡す。**生成器へ渡るのは論理時刻のみ**。`physiology-generator.ts:41,68` の `sample(logicalTimeMs)` 署名でも壁時計非依存が構造的に固定されている(生成器は壁時計・Math.random 非依存)。
- `:102,119,127` `sequence` は心臓寿命を通じ never-reset の単調増加。`:129` `sourceFrameTimestampMs` は壁時計 `now()` で session 内単調。両者とも「単調供給」の spec 要件を満たす。

### §4.3 / §8 Required Behavior(配線とホスト限定) — 適合

- 配線 生成器→リゾルバ→publish: `:113→:114 resolveSemanticSlotParameterValues({slots, activations})`(Domain A の頭無しリゾルバ)→`:133 deps.liveParameters.publishFrame(frame)`。
- **autonomousHost のみに心臓+生成器**: 差し替えは `input-subsystem.ts` の `composeStaticInputSubsystem`(autonomousHost composer)の中身のみ。`composeTrackingHostInputSubsystem` は差分上完全無変更。`input-subsystem.test.ts` に「trackingHost が `createAutonomousFrameHeart` を一度も呼ばない/ロードしても heartbeat を開始しない」検証が追加され、テストで固定されている(報告どおり)。
- ライフサイクル(ロード開始・アンロード/quit 停止・リークなし): composer が `setRuntimeExportPayload→heart.start`、`clearRuntimeExport→heart.stop`、`disconnect→heart.stop` を配線。`runtime-player-main.ts` の既存 seam(:465 loaded、:454/:485 changing/cleared、:498 quit disconnect)が**無変更**でこれらを叩く(git diff に main は現れない)。`start()` は先頭で `stop()` を呼び旧タイマーを clear(`:147`)、`stop()` は `clearIntervalFn` 後 `timer=null`(`:136-142`)。二重タイマー化・リークなし。

### 実行時 role 分岐ゼロ(最重要 blocking) — 適合

- `grep "role ===" src/main/role-composition/` の実ヒットはコメント2件(input-subsystem.ts:26,157「分岐しない」旨の注釈)と `role-selection-stub.ts:43` の既存 `if (role === null)`(ホスト役割分岐ではなく null チェック、無変更)のみ。**新規の `if (role === host)` 分岐は導入されていない**。
- `runtimePlayerInputSubsystemComposers`(`:204-210` role→composer の data lookup)と `composeRuntimePlayerInputSubsystem`(`:212-217`)は差分上無変更。役割差はテーブル一点のまま。差し替えは composer 本体に閉じている。

### sanitization 境界の維持(最重要 blocking) — 適合

- 心臓が組む `frame` は型 `RuntimePlayerLiveParameterFrame`(`live-parameter-bridge-contract.ts:1-12`)そのもので、許可フィールドは `schemaVersion / runtimeExport{packageId,packageRevision,loadedAtIso} / sequence / producedAtIso / sourceFrameTimestampMs / parameterValues` のみ。TypeScript のオブジェクトリテラル過剰プロパティ検査により**seed・raw スロット活性度(slotId キー)は frame に載せられない**。`seed` は composer→`heart.start` 経由で generator 生成にのみ使われ心臓のクロージャ内に留まる(`:152`)。frame に書かれない。
- `parameterValues` はリゾルバ出力=`slot.target.parameterId` キー(`headless-slot-resolver.ts:74`)。slotId キーではない。
- **新経路を作らず既存 `liveParameters.publishFrame` seam に乗せている**。この seam は `runtime-player-main.ts:377-385` で Stage IPC(`stageLiveParameters.publishFrame`)+ Browser Source WS(`browserSourceServer.publishLiveParameterFrame`)+ Stage Motion display state へファンアウトする、tracking 経路(`model-mapping-bridge-handlers.ts:126` が同じ `publishFrame` を叩く)と共有の一点。境界は不変。

### 失敗も沈黙(§4) — 適合

- 未写像モデルでは `resolveSemanticSlotParameterValues` が無効/disabled/target=null スロットを黙って落とし(`headless-slot-resolver.ts:54-79`)、空/部分 `parameterValues` を返す。心臓は throw せず・ログを出さず、空 frame を publish し続ける(= 静止のまま)。エラーダイアログ・ログ洪水なし。報告のテスト7(slots 空→`{}`・throw 無し)と整合。

### §2 Product Goal — 適合

- Native Stage / Browser Source 両方に**同じ frame** が届く構造(上記 `:377-385` のファンアウト)。心臓は 60Hz で同一 seam を叩くだけで両表示に到達。
- 設定ゼロ: composer は payload から `createAutoMappingSlots(payload)` と `deriveAutonomousSessionSeed(payload)` を導出し自動起動。ツマミ・UI・シード露出は frame にも composer 面にも無い(seed はユーザー非露出、C2 §5)。

### §11 Subagent Contract — 適合

- `git status` の footprint: Domain C の変更は `role-composition/` 配下 4 ファイル(`input-subsystem.ts`/`.test.ts` 変更 + `autonomous-frame-heart.ts`/`.test.ts` 新規)に収まる。`git diff --stat` の対象範囲一致。
- 作業ツリーには `runtime-parameter-frame.ts`(M)、`headless-slot-resolver*`(??)、`physiology/`(??)、`runtime-parameter-frame-equivalence*`(??)も在るが、これらは **Domain A/B の成果**であり Domain C は import して使うのみ(差分は Domain C のファイルに現れない)。Domain C は当該ファイルに不接触。
- `pnpm install` 未実施、lockfile/`pnpm-workspace.yaml`/Editor/package-format/Runtime Export schema 無変更、新規外部依存なし(import は全て内部モジュール)。無関係 revert なし。

---

## blocking 差分

なし。

---

## 裁量注記(非 blocking)

1. **`sourceFrameTimestampMs` = 壁時計 `now()`(論理時刻でなく)**。裁定3 の「壁時計→論理時刻」は生成器へ渡る時刻入力を律するもので、生成器には論理時刻のみが渡ることを確認済み(適合)。frame の送信タイムスタンプは下流 dynamics の delta 前進(§4.3「`sourceFrameTimestampMs` 差分」)のための transport 事項で、tracking 経路の壁時計 timestamp と同性質。決定性境界外(裁定3/7 の「送信タイムスタンプは壁時計 OK」)に沿う裁量として妥当。Gnome も Domain D へ申し送り済み(logical time へ切替可能な注入 `now` 経由)。ユーザーが「送信タイムスタンプも決定論固定」を望む場合のみ Domain D で再訪。
2. **`publishLatestParameterFrame` は autonomousHost で no-op 維持**、心臓が唯一のフレーム源として `publishFrame` を直接叩く。spec §4.3 の「`publishLatestParameterFrame` 経路への接続」はフレーム publish 経路一般を指し、実体の sanitization seam(`publishFrame`)は tracking と共有の同一点。ロード直後 `:469 clearLiveParameterFrame()` の後に初回 tick が来る順序ハザードも、初回フレームを `start()` 内で同期発火しない設計(`autonomous-frame-heart.ts:156-158`)で回避。合理的実装。
3. **composer への注入 seam `createAutonomousFrameHeart?` を共有 `RuntimePlayerInputSubsystemDependencies` に追加**(既定=実心臓)。共有型に autonomousHost 専用 optional フィールドが1つ増えるが、既存の `registerInputBridgeHandlers?` 等と同じテスト注入流儀で、role→composer テーブルの一様性は崩れていない。trackingHost composer は無視。非 blocking。

---

## 質問(Orch-Sylph / L0 へ)

- なし(spec compliance レーンとして blocking・要確認事項なし)。
- 申し送り: 裁量注記1(`sourceFrameTimestampMs` の壁時計採用)はユーザー美的ゲート/Domain D 統合時にユーザー裁定の余地があるが、本レーンの spec 基準(裁定3 は生成器時刻入力を律する)では適合。他レーン(test adequacy)がテスト実効性を、design/development レーンが physiology 純度・型設計を別途検証する前提。
