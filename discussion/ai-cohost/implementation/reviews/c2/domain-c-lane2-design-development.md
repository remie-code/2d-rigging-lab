# C2 Domain C レビュー(Review-Sylph): レーン② design/development compliance

> レビュー: Review-Sylph。委任元: Orch-Sylph。日付: 2026-07-11。ブランチ: feature/2d-rigging-eco-system。レーン: コード品質・合成型の健全性・ライフサイクル配線・退行リスク。読み取り専任。

## 判定

**合格(要修正なし / blocking なし)**

design/development の全観点で健全。合成型は C1 の seam を崩さず、ライフサイクル配線は全停止経路で clearInterval に到達し多重タイマー化を原理的に防止。frame identity は下流 `canApplyLiveParameterFrame` の3フィールドガードと厳密一致。physiology 純度は保持。trackingHost composer は完全無変更で退行リスクなし。裁量注記のみ(非 blocking)。

## 検証した根拠(自分で読んだもの)

- 新規 `apps/runtime-player/src/main/role-composition/autonomous-frame-heart.ts`(全文)
- `git diff HEAD` — `input-subsystem.ts`(composer 差し替え + 注入 seam 追加)
- 結線点 `apps/runtime-player/src/main/runtime-player-main.ts` 449-508(無変更を確認)
- frame 契約 `apps/runtime-player/src/preload/live-parameter-bridge-contract.ts`
- 下流 identity ガード `apps/runtime-player/src/stage/stage-renderer/stage-live-parameter-frame-match.ts`
- 下流 delta 処理 `apps/runtime-player/src/stage/stage-renderer/static-stage-canvas-renderer.ts` 588-626
- 利用 API シグネチャ `runtime-export-auto-mapping.ts`(`createAutoMappingSlots`)、`headless-slot-resolver.ts`(`resolveSemanticSlotParameterValues`)
- 型チェック `npx tsc --noEmit` → **exit 0**(自分で再実行)

## 1. 合成型の健全性(最重要) — 健全

- `composeStaticInputSubsystem` の返却は元の `RuntimePlayerInputSubsystem` 全メソッド(usesTrackingInput / getLatestTrackingFrame / getSessionNeutral / getActiveInputProfile / publishLatestParameterFrame / publishMappingStatus / clearLiveParameterFrame / setRuntimeExportPayload / clearRuntimeExport / flushPendingProfileSave / disconnect)を維持。C1 の seam 型は無変更で崩れていない。tsc exit 0 が合成型の一様性を裏付ける。
- 心臓は別モジュール化し composer から `heart.start`/`heart.stop` で駆動。分割は妥当(テスト容易性・main 内の壁時計許容域に閉じる)。
- 注入 seam `createAutonomousFrameHeart?` は共有 `RuntimePlayerInputSubsystemDependencies` に optional で追加され既定=実心臓。既存の `registerInputBridgeHandlers?` 等と同一の注入流儀。trackingHost composer はこのフィールドを一切参照しないため trackingHost に影響なし(diff で composer 本体無変更を確認)。
- 心臓は composer 生成時に**単一インスタンス**を作り(`createHeart({ liveParameters })`)、生成時点では timer 未起動(副作用なし)。start まで setInterval は走らない。

## 2. ライフサイクル配線の正しさ(最重要 blocking 観点) — 正しい

結線点(runtime-player-main.ts、無変更):

- **開始**: `onRuntimeExportLoaded` → `await inputSubsystem.setRuntimeExportPayload(payload)`(:465)→ `heart.start`。
- **停止(アンロード)**: `onRuntimeExportChanging`(:454)/ `onRuntimeExportCleared`(:485)→ `clearRuntimeExport()` → `heart.stop`。
- **停止(quit)**: `quitController.disconnectInput = () => inputSubsystem.disconnect()`(:498)→ `heart.stop`。

blocking チェック(すべて合格):

- **多重タイマー化なし**: `start()` は先頭で `stop()` を呼び旧タイマーを clear してから setInterval。加えて reload 経路は main 側で先に `clearRuntimeExport`(changing)が走るため二重防御。二重タイマー不可能。
- **停止の冪等性**: `stop()` は `timer !== null` ガード後 clear→null、heartbeat=null。2度目の stop は clearInterval を呼ばず throw もしない。
- **停止後 publish しない**: `tick()` 冒頭 `if (heartbeat === null) return`。stop で heartbeat=null。仮に残 fire があっても publish されない。加えて clearInterval で残 fire 自体を除去。
- **タイマーリーク皆無**: 全停止経路(clearRuntimeExport / disconnect / start 内 stop)が clearInterval に到達。quit 経路は `disconnect` が同期的に `heart.stop` を呼ぶだけで await ブロックなし → quit 阻害なし。
- **clearLiveParameterFrame(:469)との順序ハザード回避**: `heart.start` は初回フレームを同期発火せず初回 interval tick に委ねる(start 戻り後の非同期)。`setRuntimeExportPayload` await 復帰後に同期実行される `clearLiveParameterFrame()`(:469)が先、初回フレーム(≈16ms 後)が後。順序保証あり。onRuntimeExportChanging も stop(:454)→ clear(:457)の順で整合。

## 3. frame 組み立ての正しさ — 下流と厳密整合

- `runtimeExport` = `payload.summary.packageId` / `payload.summary.packageRevision` / `payload.loadedAtIso`。下流 `canApplyLiveParameterFrame` が照合する3フィールドと**完全一致**。identity ガード通過。
- `sequence` = 心臓寿命を通じ never-reset の単調増加(closure スコープ、start/stop でリセットしない)。下流は `frameIndex` として使用。逆行を見ない。
- `sourceFrameTimestampMs` = 壁時計 `now()`。session 内単調。下流 delta は `Math.max(0, diff)` かつ load/clear/unload で `lastLiveSourceTimestampMs=null` リセット(:219/307/361/522)のため、リロード跨ぎの大ジャンプは 0 にクランプされ安全。
- `producedAtIso` = `new Date(wallNowMs).toISOString()`、`schemaVersion` = 固定 v1。
- `parameterValues` = `resolveSemanticSlotParameterValues` 出力(`slot.target.parameterId` キー)。下流 `authoredParameterValues` に一致。slotId や seed は載らない。
- 単調性の多重ロード跨ぎ堅牢性: sequence は closure スコープで継続、timestamp は壁時計で継続。両者ともロード跨ぎで逆行しない。

## 4. physiology 純度 — 非汚染

- 生成器へは論理時刻 `logicalTimeMs`(number)を `generator.sample()` 引数で渡すのみ。壁時計→論理時刻変換は心臓側(`Math.max(0, now()-epochMs)`)が担当。
- seed は `createGenerator({ seed })` に渡すだけ。Electron/壁時計を physiology/ に持ち込んでいない。心臓側の壁時計使用は role-composition/(main)域なので許容(裁定3/7)。

## 5. 退行リスク — 低

- `composeTrackingHostInputSubsystem` および `runtimePlayerInputSubsystemComposers` テーブルは**完全無変更**(diff で確認、変更は composeStaticInputSubsystem のみ)。
- 実行時 role 分岐ゼロ(`role ===` のヒットはコメントのみ、コードには無し)。
- 既存経路 `publishFrame`・frame 型・sanitization 境界は不変(新送信経路を作らず既存 seam に乗せる)。
- runtime-player-main.ts の publishFrame 経路・ライフサイクル(449-508)は無変更。Wave17 fast path / Wave20 lifecycle / Wave21 dynamics への差分接触なし。
- 型チェック exit 0(自分で再実行)。

## 6. リポジトリ流儀適合 — 適合

- 命名(`createAutonomousFrameHeart` / `deriveAutonomousSessionSeed`)、optional 注入 seam、純度分離、型定義いずれも既存流儀に沿う。心臓の deps は `now`/`setIntervalFn`/`clearIntervalFn`/`frameIntervalMs`/`createGenerator` を注入可能にし fake-timer 互換。

## 7. Subagent Contract — 遵守

- Domain C の footprint: `autonomous-frame-heart.ts`(+ .test)、`input-subsystem.ts`、`input-subsystem.test.ts`。すべて role-composition/ 配下(+ 完了報告 / 本レビュー)。
- lockfile / pnpm-workspace / package-format / Runtime Export schema 無変更。
- `input-subsystem.ts` への注入 seam 追加は本ドメイン中心(composer 差し替え)の一部で正当。
- 注記: `git status` に `runtime-parameter-frame.ts` が modified で出るが、これは **Domain A の作業ツリー変更**であり Domain C の diff footprint 外(Domain C は不接触)。契約違反ではない。

## 退行リスク評価 まとめ

原理的なタイマーリーク・多重タイマー・停止後 publish・quit 阻害・順序ハザードのいずれも配線上回避されている。合成型・frame 型・sanitization 不変により Browser Source primary path / Stage IPC 経路への退行リスクは低い。

## blocking 差分

なし。

## 裁量注記(非 blocking)

- `sourceFrameTimestampMs` に壁時計を採用(logical time でなく)。決定性境界外(裁定3/7)で妥当。下流 delta クランプが跨ぎジャンプを吸収するため安全。Domain D の統合ゲートで「送信タイムスタンプも決定論固定」要望が出れば注入 `now` で logical time へ切替可能、という申し送りは合理的。
- seed 決定を composer(`deriveAutonomousSessionSeed`)が担い心臓へ渡す分担は妥当。Math.random 非使用でテスト決定論を保つ。
- 心臓の別モジュール分割・注入 seam 群は妥当なテスト容易性設計。

## 質問(呼び出し元 Orch-Sylph へ)

- なし。本レーン(design/development)では未解決点なし。
- 参考: 手動美的ゲート(実機瞬き確認・「死体に見えない」判定)は本レーンの検証対象外(Domain D / spec・test lane の領分)。本レビューは配線・型・退行の静的健全性に限定して合格判定している。
