# C3 Domain D レビュー: `cohost-c3-stage-presence` — レーン2 design / development

> Review-Sylph(design/development レーン)、2026-07-11。委任元: Orch-Sylph。対象: `apps/runtime-player`。
> 判定基準: Gnome 実装報告 §2/§5(鵜呑みにせず検証)、research `stage-motion-for-autonomous-idle.md`(候補c)、c3-planning-inventory §2.6、c3-wave-plan §4.4/§6/§9。
> 検証方法: 対象ファイル全読 + git status(無改変確認)+ Domain D 対象 vitest(5 files / 46 passed)+ typecheck(エラーなし)を自分で実行。

## 判定: **合格**

供給シーム・settings 導出・純計算器再利用・smoothing・publish 経路はいずれも堅牢で、既存(stage motion / boundary / Domain A/B/C)を汚さず、role 分岐を漏らさない。must-fix なし。裁量判断(強度上限・off の drive 返却)は合理的で、テストで数値固定されている。

---

## 観点別所見(design レーン 8 点)

### 1. 供給シームの正しさ(核) — 合格
- `getStageMotionDrive: () => RuntimePlayerStageMotionDrive | null` は `getLatestTrackingFrame` と同列の data seam として interface に定義(`input-subsystem.ts:59`)。trackingHost=`() => null`(`:172`)/ autonomousHost=drive 導出(`:229-241`)。role 差は合成テーブル `runtimePlayerInputSubsystemComposers`(`:269-275`)の一点のみ。実行時 `if (role===)` はゼロ。
- `runtime-player-main.ts` は composed subsystem から `getStageMotionDriveForStageMotion = inputSubsystem.getStageMotionDrive`(`:473`)と DATA で確定し、`stageMotionRuntime.update({..., drive: getStageMotionDriveForStageMotion()})`(`:294-304`)へ 1 行供給。tracking host は null を返すので既存経路は不変。
- **off / absent の一貫性を検証済み**: stagePresence が config に**存在**すれば off でも drive を返し `settings.enabled=false` で表現(`input-subsystem.test.ts:344-361`)。**不在**(既定 config)なら null を返す(`:363-374`)。両者とも最終的に base transform に落ちる — null drive は tracking 分岐へ→autonomous では trackingFrame=null→`reset()`→base、disabled drive は `updateFromDrive`→純計算器 enabled=false 経路→base + native override null。**outcome 一貫**。data marker として健全。

### 2. 姿勢信号の取り出し — 合格
- `getLatestStageMotionSignal`(`autonomous-frame-heart.ts:249`)は tick 内で `sample()` 直後・`resolveSemanticSlotParameterValues` 前に `activations[BODY_X_SLOT_ID]`/`[BODY_Z_SLOT_ID]` をスナップショット(`:179-192`)。下流 body.angle を駆動するのと**同一の centered activation**(resolver 前の生値)で、Stage オフセットの姿勢連動が構造保証されている。
- start/stop で stale クリア: `stop()` が `latestStageMotionSignal = EMPTY_STAGE_MOTION_SIGNAL`(`:217`)、`start()` は冒頭で `stop()` を呼ぶ(`:224`)。停止/再ロードで前の offset を漏らさない(`autonomous-frame-heart.test.ts:505-511` が固定)。
- physiology/ 純度は不変(heart は physiology/ の外、壁時計は元から heart 責務)。`body-follow-state.ts` は git 無改変(非経由を確認)。blink-only config → null(`:514-532`)。`readSignedActivation` が非有限/不在を null にガード(`:260-262`)。

### 3. settings 導出の分離 — 合格
- `deriveStagePresenceStageMotionSettings`(`stage-presence-drive.ts:71-90`)は `PhysiologyStagePresenceConfig` のみを読み、window-state `stageMotion.settings` を import すらしない。線形マップ `strengthPx = 60·strength` / `scale.strength = 0.05·strength`、limit は到達最大固定なので `|input|≤1` で決して clip しない(`stage-presence-drive.test.ts:80-95` が構造固定)。
- `clampUnit`(`:56-61`)が NaN/範囲外を [0,1] にガード(`test:113-124`)。純データ変換(Electron/時計/乱数なし)。「drive settings が window-state に勝つ」は `stage-motion-runtime.test.ts:136-163`(window 側 1000px でも drive の 30px が出る)で固定。

### 4. 純計算器の無改変再利用 — 合格
- `stage-motion-transform.ts` は **git 無改変**(`git status` 空)を確認。`updateFromDrive`(`stage-motion-runtime.ts:120-143`)が `composeRuntimePlayerStageMotionTransform` を drive.settings + drive 入力で正しく呼ぶ。
- smoothing の elapsed は `drive.timestampMs - previousFrameTimestampMs`(`:124-126`)= フレームレート非依存。tracking 経路が `trackingFrame.timestampMs` を使う(`:90-93`)のと対称。`stage-motion-runtime.test.ts:192-223` が「初回 snap → 2 フレーム目で 0<x<60 に ease」を固定。

### 5. publish 経路 / Browser Source parity — 合格
- transport `stage-motion-transport.ts` は **git 無改変**。境界を越えるのは composed transform(`stageView.transform`)のみ。`stage-motion-runtime.test.ts:101-106` が browserSourceTransform の key を `coordinateSpace/pan/zoomScale` の 3 つに固定(raw 信号/seed 非流出)。
- `update` の drive/tracking 分岐(`:53-55`)は data branch。drive 未供給時(tracking host は常に null)は tracking 経路がバイト等価で走る。

### 6. 既存退行 — 合格
- **`main/presence/` 移設の妥当性を独立検証**: boundary test の規則は `expect(source).not.toMatch(/\bfrom\s+["']\.\.\/stage/)`(`runtime-player-boundary.test.ts:97`、main 全 production ファイル対象 `:89-98`)。この正規表現は `stage` の後ろに境界が無く、`from "../stage-motion/…"` が `../stage` 前方一致で**実際に誤検出する**。よって role-composition から `../stage-motion/…` を import できず、中立 leaf `main/presence/` は**正当な回避**であってデッドな複雑化ではない。boundary test 5 passed。
- 既存 stage-motion(head-position 合成・input 欠落 reset)テストは不変。`window-state-stage-motion-settings.ts` / `body-follow-state.ts` は git 無改変。Domain A/B/C 系は本レーンの対象外だが、共有 seam(heart / input-subsystem)への追加は additive で既存契約を破っていない(既存テスト全 pass)。

### 7. 二重適用手当て — 合格(合理的裁量)
- 上限 60px/0.05 は window 既定 80px/0.06(`window-state-stage-motion-settings.ts:8,13` で確認)より小。既定 strength 0.3 で 18px/0.015 の控えめな微動。`stage-presence-drive.test.ts:97-111` が「full strength でも camera-follow 既定より小」を数値固定。body.angle リグ変形(同信号)と Stage オフセットの重畳を抑える手当てとして数値判断は妥当。設計文書未定義の具体値だが research §4 / 設計§5-4 の意図に沿う合理的裁量。

### 8. 拡張性・単純化 — 合格
- seam(`getStageMotionDrive`)/ getter(`getLatestStageMotionSignal`)/ drive 型の責務が明快に分離。デッドコード・重複なし。drive 型 + 導出は独立モジュール `stage-presence-drive.ts` に凝集。

---

## 注記(must-fix でない観察)

- **[obs1] フレーム毎に config を 2 回読む**: heart が tick で `getPhysiologyConfig()`、`getStageMotionDrive` が `physiologyConfigProvider?.()` を別途読む。ただし posture 信号(body-x/z activation)は `stagePresence.strength` に依存せず、strength は導出 settings にのみ効くため、フレーム内で config が変わっても **coherence バグにならない**(むしろ strength 変更が即反映され応答的)。冪等 read の軽微な冗長性のみ。修正不要。
- **[obs2] `update` の `drive?` optional + `!== undefined && !== null` 二段ガード**(`stage-motion-runtime.ts:53`): 呼び出し側は常に `Drive | null` を渡す(`runtime-player-main.ts:303`)ため `undefined` 分岐は既存テスト後方互換のための防御。過剰ではなく妥当。
- **[obs3] disabled-drive 経路で `previousFrameTimestampMs` を null リセットしない**(tracking disabled は `reset()` で null 化): `updateFromDrive` は disabled 時 runtimeState を reset(initialized=false)にするので、再有効化の最初のフレームは initialized=false で target に snap し、残存 timestamp は使われない。tracking 経路と observable な差は無い。修正不要。

---

## 検証ログ

```
vitest run src/main/presence src/main/stage-motion/stage-motion-runtime.test.ts \
  src/main/role-composition/autonomous-frame-heart.test.ts \
  src/main/role-composition/input-subsystem.test.ts src/runtime-player-boundary.test.ts
→ 5 files / 46 passed

tsc --noEmit -p tsconfig.json → エラーなし(exactOptionalPropertyTypes 準拠)

git status（無改変確認、いずれも空）:
  stage-motion-transform.ts / stage-motion-transport.ts /
  window-state-stage-motion-settings.ts / body-follow-state.ts
```

## 質問 / 未解決
- なし。設計未定義の具体値(強度上限 60px/0.05・deadZone 0.02・reaction 6)は research/設計の意図に沿う合理的裁量として受容。実機ゲート(Domain E §7-4)で過剰なら strength スライダー/Off 運用で調整する申し送りも report 付録にあり妥当。
