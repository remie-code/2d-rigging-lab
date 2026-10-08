# C3 Domain D 実装報告: `cohost-c3-stage-presence`

> 実装: Gnome(opus)、2026-07-11。委任元: Orch-Sylph。対象: `apps/runtime-player`。
> source of truth: [c3-wave-plan.md](../../orchestration/c3-wave-plan.md) §4.4/§6 Domain D/§3 責務境界/§9 Contract/裁定6・裁定8、[c3-gaze-head-posture.md](../../../architecture/c3-gaze-head-posture.md) §5(Stage Motion 裁定)、[stage-motion-for-autonomous-idle.md](../../../research/stage-motion-for-autonomous-idle.md)(候補c §3 推奨形)、[c3-planning-inventory.md](../../orchestration/c3-planning-inventory.md) §2.6、Domain C 報告 §6 申し送り(`PhysiologyConfig.stagePresence: {enabled, strength}`)。
> Status: 実装完了・対象テスト/typecheck パス・blink golden 2本不変・Domain A/B/C 不変・既存 stage motion / boundary 無退行。escalate なし。質問なし。

---

## 1. 要約

姿勢信号(posture の `body-x`/`body-z`, -1..1 centered)を head-less 純計算器 `composeRuntimePlayerStageMotionTransform` に**無改変で**供給し、composed transform を既存の Stage transport 経路に載せた(候補c)。役割差は **subsystem seam `getStageMotionDrive()`** で表現(autonomousHost=drive を返す / trackingHost=null)。実行時 `if(role===)` 分岐ゼロ。設定は Physiology の `stagePresence.{enabled, strength}` から**別意味論の `RuntimePlayerStageMotionSettings` を導出**(既存 window-state `stageMotion.settings` は非接触)。既定 Off・strength 既定 0.3・二重適用手当てのため強度上限を控えめに。Browser Source parity は既存 transport(composed transform のみ)を保つことで構造的に維持。偽 TrackingFrame/偽キャリブレーション不要(escalate 条件に該当せず)。

## 2. 設計判断

### 2.1 姿勢信号の取り出し方(heart getter)
`autonomous-frame-heart.ts` に `getLatestStageMotionSignal(): { horizontal: number|null; depth: number|null; timestampMs: number }` を追加(research §3 推奨「最新値 getter 露出」)。毎 tick、生成器 `sample()` 直後に activations から `body-x`→horizontal / `body-z`→depth を **resolver 前に**スナップショット(下流 body.angle を駆動するのと**同一の centered -1..1 信号**なので姿勢連動が構造保証)。timestamp は sampling wall clock。posture 不在(blink-only)なら null。`start()`/`stop()` で信号をクリア(停止/再ロードで stale offset を漏らさない)。**physiology/ 純度は不変**(heart は physiology/ の外・壁時計は元から heart 責務)。`body-follow-state` 非経由(裁定2、生成器の閉形式出力を使用)。

### 2.2 settings 導出(別フィールド・別意味論、裁定6/§5-2)
新規 `main/presence/stage-presence-drive.ts` の純関数 `deriveStagePresenceStageMotionSettings(stagePresence)`:
- `enabled = stagePresence.enabled`(既定 false)。
- `strength [0,1]` → `horizontal.strengthPx = 60·strength` / `scale.strength = 0.05·strength`(線形)。limit は到達最大(60px / 0.05)固定なので `|input|≤1` で決して clip しない。deadZone 0.02(微小 jitter のみ抑制、遅い drift は残す)/ reaction 6 / invert false。
- **既存 window-state `stageMotion.settings`(カメラ/キャリブレーション前提)は一切読まない・書かない**。Stage Presence は独立の意味論・独立のフィールド。
- **二重適用手当て(§5-4/リスク5)**: 同一姿勢信号が body.angle リグ変形(body-z: rotation 0.25/position 0.4、body-x: strength 0.35)を既に駆動するため、Stage オフセットは camera-follow の window 既定(80px/0.06)より**明確に小さい**上限に設定(60px/0.05)。既定 strength 0.3 では 18px/0.015 の控えめな微動。テストで「window 既定より小」を数値固定。

### 2.3 供給の有無を表す data marker(供給シーム)
subsystem interface に **`getStageMotionDrive: () => RuntimePlayerStageMotionDrive | null`** を追加(`getLatestTrackingFrame` と同列の seam)。
- trackingHost composer: `() => null`(既存 head-position Stage Motion 経路を一切変更しない)。
- autonomousHost composer: `deps.physiologyConfigProvider?.().stagePresence` を読み、undefined なら null(provider 無しの合成は Domain D 前と同じく inert)。存在すれば `{ settings: derive(stagePresence), horizontalInput/depthInput = heart 最新信号, timestampMs }` を返す。
- **役割差はこの seam の一点のみ**(合成テーブルの data lookup)。実行時 `if(role===)` を増やさない。off(enabled=false)でも autonomousHost は drive を返し、off は `settings.enabled=false` で表現(純計算器の enabled=false 経路 → base)。

### 2.4 publish 経路(既存 Stage transport 再利用、Browser Source parity)
`stage-motion-runtime.ts` の `update()` に optional `drive` を追加し、**data 分岐**「drive 非 null なら `updateFromDrive`、null なら既存 tracking 経路」。`updateFromDrive` は `composeRuntimePlayerStageMotionTransform`(head-less 純計算器を無改変)を drive.settings + drive 入力で呼ぶ。smoothing は drive.timestampMs で elapsed を算出(フレームレート非依存、tracking 経路が trackingFrame.timestampMs を使うのと対称)。off 時は base + native override クリア(null)で tracking の disabled ケースに一致。
`runtime-player-main.ts` は composed 後の subsystem から `getStageMotionDrive` を確定し、`publishLatestStageMotionDisplayState` の `stageMotionRuntime.update({..., drive: getStageMotionDriveForStageMotion()})` に 1 行供給。**transport(`publishRuntimePlayerStageMotionDisplayState`)は無改変** → Browser Source へ渡るのは既存どおり **sanitized composed transform(`stageView.transform`)のみ**。シード・raw スロット・私的情報は境界を越えない(seam/getter は main プロセス内で完結、frame にも書かない)。

### 2.5 配置(process boundary guard 回避)
drive 型 + 導出関数は `main/stage-motion/` ではなく中立の **`main/presence/`** に置いた。理由: `runtime-player-boundary.test.ts` の main→renderer 遮断規則が `from "../stage…"` を renderer(`src/stage`)import と見なすため、`role-composition/` から `../stage-motion/…` を import すると **`../stage-motion` が `../stage` に前方一致して誤検出**する(初回実装で検出→修正)。`../presence/…` なら誤検出せず、role-composition と stage-motion の両方が下方向に依存できる。

## 3. 作成/変更ファイル(絶対パス)

### 新規作成
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\presence\stage-presence-drive.ts`(drive 型 + settings 導出・純データ変換)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\presence\stage-presence-drive.test.ts`(6: enabled 透過・strength 0/既定/大の線形スケール・単調性・limit 非clip・二重適用手当ての控えめさ・clamp)

### 変更(既存)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\autonomous-frame-heart.ts`(`AutonomousStageMotionSignal` 型 + `getLatestStageMotionSignal` getter、tick で最新 body-x/body-z スナップショット、start/stop でクリア)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\autonomous-frame-heart.test.ts`(+2: 姿勢信号 getter・blink-only で null)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\input-subsystem.ts`(interface に `getStageMotionDrive` seam、tracking=null / autonomous=drive 導出)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\role-composition\input-subsystem.test.ts`(fake heart に getter 追加 +4: tracking null・autonomous drive 供給・off でも drive・provider 無しで null)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\stage-motion\stage-motion-runtime.ts`(`update` に optional `drive` + `updateFromDrive` private、data 分岐)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\stage-motion\stage-motion-runtime.test.ts`(+5: drive 供給で transform 変化・off で base+native null・drive settings が window-state に勝つ・tracking frame 併存でも drive 優先・timestamp smoothing・sanitized transform key のみ)
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\runtime-player-main.ts`(drive seam holder + update への 1 行供給 + import)

**触れていない**(スコープ厳守): 純計算器 `stage-motion-transform.ts`・transport `stage-motion-transport.ts`・window-state `stageMotion.settings`/ウインドウ状態・`headless-slot-resolver.ts`・`body-follow-state.ts`・`semantic-slot-definitions.ts`・自律ホストの既存 Stage Motion UI(Live Controller "Motion Safety" / Stage ページ Enabled、裁定8)・Physiology ページの Stage Presence セクション UI(Domain C 設置済み、駆動のみ実装)・browser-source-server・Editor / package-format / Runtime Export schema / lockfile。`pnpm install` 未実行、新規依存なし。

## 4. テスト結果

### 対象テスト(明示実行)
```
pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run \
  src/main/presence src/main/stage-motion src/main/role-composition src/runtime-player-boundary.test.ts
```
→ **8 files / 55 passed**(presence 6 / stage-motion-runtime 7 / stage-motion-transform 4 / stage-motion-transport 2 / autonomous-frame-heart 15 / input-subsystem 13 / role-selection-stub 3 / boundary 5)。

### 全体
```
pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run
```
→ **120 files / 730 tests → 728 passed / 2 failed**。
- 2 failed = **既知 baseline**(`src/main/broadcast-source/browser-source-server.test.ts` + `src/stage/browser-source/browser-source-server-message.test.ts`、いずれも Wave21 `effectiveDynamicsTuning: null` shape 由来。証拠: 差分は `+ "effectiveDynamicsTuning": null` の 1 キーのみ)。Domain A/B/C 報告が申し送った同一 2 件で、**私の変更対象外**(browser-source は git untouched)。他の失敗なし。
- **供給 on/off**: `stage-motion-runtime.test.ts` で drive 供給→transform 変化 / disabled→base 一致 + native null を固定。
- **既存 stageMotion.settings 非接触**: 「drive settings が window-state settings に勝つ」テスト(window 側 1000px でも drive の 30px が出る)+ derive 関数が window-state を import しないことを構造で担保。
- **Browser Source parity**: drive path の browserSourceTransform が transform 3 key のみ(`coordinateSpace`/`pan`/`zoomScale`)で raw 信号非流出を固定。transport 無改変。
- **供給シームが autonomousHost のみ**: input-subsystem テストで tracking=null / autonomous=drive を固定。tracking 経路の既存 stage-motion-runtime テスト(head-position 合成・input 欠落 reset)不変。
- **strength スケール妥当性**: strength 0→offset 0、既定 0.3→18px/0.015、1→60px/0.05、単調増加、window 既定(80/0.06)より小 を数値固定(二重適用の過剰回避)。

### 退行ゲート
- **blink golden 2本不変**: `blink-default.golden.json` + `blink-alt-config.golden.json`、`git diff --stat` 空。`blink-behavior-fixture.test.ts`(4)パス。resolver 等価 golden(`runtime-parameter-frame-equivalence.golden.json`)不変。
- **Domain A/B/C 不変**: physiology 系 190 tests パス(生成器/coupling/config-seam/tone-config/永続化/bridge/page)。role-composition・既存 Control ページ・Dynamics Tune(Wave21)不変。
- **boundary 無退行**: 初回実装で `../stage-motion` import が boundary 規則に前方一致誤検出 → `main/presence/` へ移設して解消、`runtime-player-boundary.test.ts`(5)パス。

### typecheck
```
pnpm --filter @private-2d-rigging-lab/runtime-player run typecheck   # tsc --noEmit
```
→ **パス(エラーなし)**。`exactOptionalPropertyTypes: true` 準拠(optional `drive` は条件付き、`physiologyConfigProvider?.()` の optional chain)。

## 5. 裁量判断
1. **強度上限 60px / 0.05**(window 既定 80/0.06 より控えめ)。二重適用リスク(body.angle 変形 + Stage オフセットの同信号重畳)への手当てとして、camera-follow より小さい上限を採用。実機ゲートで過剰なら strength スライダー(既定 0.3)を下げる/Off で運用。数値はテストで固定。
2. **off の表現**: autonomousHost は off でも drive を返し `settings.enabled=false`(純計算器の enabled=false 経路 → base)。「autonomousHost が Stage Presence を駆動する」という data marker を off でも保ちつつ、`updateFromDrive` は disabled 時に base + native override クリアで tracking の disabled ケースと一致させた。
3. **smoothing の elapsed**: drive に `timestampMs` を持たせ、heart の sample wall clock を供給。tracking 経路が trackingFrame.timestampMs を使うのと対称で、runtime に壁時計を持ち込まず純関数 `composeRuntimePlayerStageMotionTransform` にフレームレート非依存の elapsed を渡せる。
4. **配置 `main/presence/`**: process boundary guard の `../stage` 前方一致誤検出を避ける中立 leaf。stage-motion(純計算器 consumer)と role-composition(seam producer)の両方が下方向依存できる。
5. **posture 不在時の null**: blink-only config では body-x/body-z 不在 → 信号 null → offset 0(base 相当)。生成器 config が posture を含むかに依らず安全。

## 6. 質問 / escalate / blocked
- **質問なし**。
- **escalate なし**。純計算器の再利用は意味論的に成立(偽 TrackingFrame/偽キャリブレーション不要、既存 settings 経路の広い改修も不要)——§6 Domain D の escalate 条件に該当せず。
- **blocked なし**。
- **ドメイン想定外の共有ファイル**: なし。boundary guard 回避のため中立ディレクトリ `main/presence/` を新設したのみ(既存共有ファイルの意味論は変更せず)。`runtime-player-main.ts` は既存の subsystem→stage-motion 配線パターンに 1 seam holder + 1 供給行を足しただけ。

---

## 付録: Domain E への申し送り
- Stage Presence は既定 Off。人間ゲート(§7-4「onにして比較」)では Physiology ページ Stage Presence セクションのトグルを on にし、strength スライダーで調整。姿勢連動の画面微動(過剰・不気味なら Off 運用でも C3 合格)。
- OBS Browser Source でも同じ動き(§7-7):transport 無改変なので Stage Presence on 時の composed transform が Browser Source にも同経路で届く。
- 既知 baseline fail 2件(Wave21 `effectiveDynamicsTuning` shape)は Domain D でも未解消(スコープ外・browser-source 系)。Domain E の最終検証で「既知 baseline」として分類のこと。
