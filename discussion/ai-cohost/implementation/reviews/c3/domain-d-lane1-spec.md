# C3 Domain D レビュー: `cohost-c3-stage-presence` — レーン1 spec compliance

> レビュー: Review-Sylph(opus)、2026-07-11。委任元: Orch-Sylph。対象: `apps/runtime-player`。
> レーンの問い: 実装が Stage Motion 裁定(設計§5)・裁定6・裁定8・wave plan §4.4/§6 Domain D の責務境界に忠実か。
> basis: `c3-gaze-head-posture.md` §5 / `c3-wave-plan.md` §4.4·§6·§3·§8·§9·§10·裁定6·裁定8 / `stage-motion-for-autonomous-idle.md`(候補c)。
> 検証方法: 対象ファイル・git diff・テスト実体・純計算器シグネチャ・config デフォルトを直接確認(Gnome 報告は鵜呑みにせず突合)。

## 判定: **合格**

spec レーンの blocking 観点 9 点すべて充足。要修正なし。非blockingの申し送り 1 点(Domain C 向けの確認)を末尾に記載。

---

## blocking 観点ごとの検証

### 1. 姿勢連動のみ(§5-3) — ✓
`autonomous-frame-heart.ts` tick で、生成器 `sample()` 直後・resolver 前に `activations[BODY_X_SLOT_ID]`→horizontal / `activations[BODY_Z_SLOT_ID]`→depth をスナップショット(diff +227〜+236)。この activations オブジェクトはそのまま `resolveSemanticSlotParameterValues` に渡り body.angle を駆動する。つまり **Stage 供給信号と body 基線が同一 activation** で、視線連動でも専用ゆらぎでもない。結合は「同じ配列を読む」という構造で保証されている。`BODY_X_SLOT_ID="body-x"`/`BODY_Z_SLOT_ID="body-z"`(`posture-behavior.ts:35-36`)、posture behavior の出力スロットと一致。

### 2. 既存 stageMotion.settings 非接触(裁定6/§5-2) — ✓
`stage-presence-drive.ts` の import は `RuntimePlayerStageMotionSettings` 型と `PhysiologyStagePresenceConfig` 型のみ。window-state を読み書きしない。`deriveStagePresenceStageMotionSettings` は `stagePresence.{enabled,strength}` から**別意味論の設定**を導出(strength→px/scale 線形、独自 deadZone/reaction)。`stage-motion-runtime.ts` の drive 経路(`updateFromDrive`)は `drive.settings` のみ使い `input.settings`(=window-state settings)を無視。テスト "uses the drive settings, never the window-state settings"(:136)が window 側 1000px でも drive の 30px が出ることを固定。※`runtime-player-main.ts` は既存どおり `settings: windowState.getStageMotionSettings()` を update に渡すが、これは tracking 経路用の既存読み取りであり drive 経路では未使用。Stage Presence のための stageMotion.settings 読み書きは皆無。

### 3. 既定 Off(裁定6) — ✓
`DEFAULT_PHYSIOLOGY_CONFIG` / `DEFAULT_FULL_PHYSIOLOGY_CONFIG` いずれも `stagePresence` フィールドを**含まない**(`physiology-config.ts:88-106`)。→ `getStageMotionDrive()` が null(`input-subsystem.ts` autonomous 経路: `stagePresence === undefined` で null)→ drive なし→ update は tracking 経路 reset→ base。off が base に戻ることを二重に保証: (a) 供給不在→drive null→reset→base、(b) `{enabled:false}` 供給→`updateFromDrive`→純計算器 enabled=false 経路→base + native null。テスト "returns the base transform when the Stage Presence drive is disabled"(:109)固定。

### 4. 裁定8 非接触 — ✓
Stage Motion UI 系ファイル(Live Controller "Motion Safety" / Stage ページ Enabled)に変更なし(`git status` に該当なし)。Domain D の変更ファイルは presence/ + heart + input-subsystem + stage-motion-runtime + runtime-player-main のみで、いずれも UI ではない。

### 5. Browser Source parity(裁定6) — ✓
`updateFromDrive` は `browserSourceTransform: result.transform`(sanitized composed transform)を返すのみ。drive の raw 入力(horizontalInput/depthInput/timestampMs)・シード・スロットは main プロセス内に留まり frame に書かれない。transport(`stage-motion-transport.ts`)は git-clean(無改変)。テスト "drives … WITHOUT a tracking frame"(:72)が `Object.keys(browserSourceTransform)` = `["coordinateSpace","pan","zoomScale"]` の 3 key のみを固定(raw 非流出)。

### 6. 偽 TrackingFrame/偽キャリブレーション不使用(候補c) — ✓
純計算器 `composeRuntimePlayerStageMotionTransform` は `horizontalInput/depthInput: number | null` を受ける(`stage-motion-transform.ts:31-32`)。drive 経路は `trackingFrame:null` / `inputProfile:null` のまま純計算器へ姿勢信号を直接供給(テスト :82-84 が null を明示)。偽装入力の生成なし。posture 不在(blink-only)は信号 null→offset 0 で安全。

### 7. 二重適用手当て(§5-4) — ✓
`STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX=60` / `STAGE_PRESENCE_MAX_SCALE_STRENGTH=0.05`(strength=1 到達最大)は camera-follow window 既定 80px/0.06 より明確に小さい。既定 strength 0.3 で 18px/0.015 の控えめな微動。テスト "stays conservative vs the camera-follow window-state defaults"(:97)が「window 既定より小」を数値固定。strength は `clampUnit` で [0,1] に拘束、limit=到達最大固定で `|input|≤1` は clip しない(:80 テスト)。

### 8. 責務境界/純度/sanitization(§9) — ✓
- blink golden 2本(`blink-default.golden.json` / `blink-alt-config.golden.json`)git-clean(不変)。
- `headless-slot-resolver.ts` / `body-follow-state.ts` / `stage-motion-transform.ts`(純計算器) / `stage-motion-transport.ts` すべて git-clean(無変更)。
- lockfile / schema / packages/ / Editor 変更なし。新規依存・`pnpm install` の痕跡なし。
- `body-follow-state` 非経由: heart は生成器の閉形式出力(activations)を直接スナップショット。EMA 経路を通らない(裁定2)。
- 実行時 role 分岐なし: 役割差は `getStageMotionDrive` seam(tracking=`()=>null` / autonomous=drive 導出)+ `providesPhysiology` data marker の一点のみ。diff 中に新規 `if (role ===` は無い。供給有無は data/seam で表現。
- physiology/ 純度不変: heart は physiology/ の外、壁時計は元から heart 責務。presence/ は Electron import なし。

### 9. Domain 境界 — ✓
Physiology ページの Stage Presence セクション UI(Domain C 設置済み)を作り直していない。Domain D は駆動(信号供給+設定導出+publish 配線)のみ。config carrier `PhysiologyStagePresenceConfig` を消費するだけで UI/store は非関与。

---

## 配置判断の spec 妥当性
`main/presence/` 新設は boundary guard(`../stage…` 前方一致誤検出)回避のための中立 leaf。責務境界上、drive 型+導出関数を stage-motion/ と role-composition/ の両方から下方向依存できる位置に置くのは妥当で、スコープ逸脱ではない(既存共有ファイルの意味論を変えていない)。

## 非blocking の申し送り(質問 / 要確認 — レーン外)
- **off の表現が二系統ある**: 既定は `stagePresence` フィールド**不在**(→drive null→base)、UI トグル操作後は `{enabled:false, strength:X}`(→drive 供給・settings.enabled=false→base)。どちらも base に帰結し spec 上は問題ないが、**Domain C の UI が toggle-off 時に `{enabled:false, strength:保持値}` を書き strength を永続化しているか**はレーン2/3 または Domain C レビューで確認されたい(Domain D の責務外だが、on/off 比較の人間ゲートで strength が保持される前提に関わる)。これは Domain D 実装の欠陥ではない。

## 判定根拠まとめ
設計§5(候補c・既定Off・姿勢連動のみ・stageMotion.settings 非相乗り・二重適用手当て)、裁定6、裁定8、wave plan §4.4/§6/§3.2/§8/§9/§10 のすべてに忠実。要修正なし。**合格**。
