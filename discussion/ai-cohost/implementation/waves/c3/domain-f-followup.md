# C3 追撃 Domain F 実装報告: キャプション + Stage Presence 知覚性

> Wave: AI Cohost C3 追撃 (`cohost-c3-followup-captions-presence`) / 根拠 = [c3-wave-plan.md](../../orchestration/c3-wave-plan.md) §12。手動ゲート 7 項目中 6 合格・残 2 件(①スライダーキャプション ②Stage Presence 知覚性不合格)を回収。実装 = Gnome(別コンテキスト)。

## 1. 要約

2 作業を実装した。

1. **キャプション**: Physiology ページ(`physiology-page.tsx`)の全 12 スライダーに、ラベル直下・常時表示・小さく淡色の一行キャプションを追加した。文言は UX §3.1 の表を逐語(verbatim)で使用。info アイコン / ツールチップ方式は不採用。数字非露出の規律(ms/Hz/確率/内部数値を出さない)を維持。
2. **Stage Presence 知覚性**: `stage-presence-drive.ts` の strength → ゲイン写像を **線形から凸(2 乗 `strength²`)写像へ拡張**し、MAX を `60px / 0.05` → **`200px / 0.15`** に引き上げた。既定 strength 0.3 の出力は従来同等の控えめ(18px / 0.0135)を維持しつつ、右端 strength 1.0 は明確に大きい(200px / 0.15)。deadZone(0.02)・reaction(6)・invert(false)は不変。純計算器・トラッキング経路・window-state `stageMotion.settings` は無変更。

## 2. 変更 / 新規ファイル一覧(絶対パス)

変更(既存ファイルのみ。新規ファイルなし):

- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\control\physiology-page.tsx` — `PhysiologySliderSpec` に `caption` 追加、全スライダーに逐語文言、`ToneSlider` にキャプション描画。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\control\physiology-page.test.ts` — 12 キャプション逐語表示のテスト 1 本追加(既存 8 テストは無改変)。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\presence\stage-presence-drive.ts` — MAX 定数の引き上げ + 凸 2 乗ゲイン写像。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\presence\stage-presence-drive.test.ts` — 線形→2 乗写像へ期待値更新、「控えめ vs camera-follow」テストを既定 0.3 の控えめさ主張に書き換え、スナップショット更新。
- `C:\workspace\remie\code\ai-native-live2d-editor\apps\runtime-player\src\main\stage-motion\stage-motion-runtime.test.ts` — ゲイン由来ハードコード期待値(60/30/-60/+60)を新ゲインに更新。**runtime 本体 `.ts` は無変更(テストのみ)。**

## 3. 採用したゲイン数値と接地

| 項目 | 旧(線形) | 新(凸 2 乗) |
|---|---|---|
| 曲線形状 | `MAX × strength` | `MAX × strength²`(単調増加・原点通過・[0,1] で凸) |
| MAX_HORIZONTAL | 60px | **200px** |
| MAX_SCALE | 0.05 | **0.15** |
| 既定 strength 0.3 の出力 | 18px / 0.015 | **18px / 0.0135**(gain = 0.3² = 0.09 → 200×0.09 / 0.15×0.09) |
| 右端 strength 1.0 の出力 | 60px / 0.05 | **200px / 0.15**(gain = 1) |

**選定根拠(posture 振幅への接地)**: Stage 実効変位 = posture 入力 × strengthPx。posture 信号振幅は `posture-behavior.ts` の drift 0.35/軸 + baseline reseat で通常 ±0.2〜0.35。凸写像により低域(既定 0.3 付近)は寝かせて従来の控えめさを保ち、高域(右端)を持ち上げる。右端では typical posture 入力 ±0.2〜0.35 × 200px = **40〜70px** の実変位となり、camera-follow 参照(80px)相当の知覚性に届く。線形のまま MAX を上げると既定 0.3 も比例拡大し「控えめ維持」に反するため 2 乗を採用した。MAX_HORIZONTAL 200 / MAX_SCALE 0.15 は §12 が接地した候補値で、**この数値はユーザーが手動再ゲートで最終確認する calibration ターゲット**である。3 性質(既定控えめ / 右端明確大 / 単調)はテストで固定済み。

## 4. キャプション 12 個の設置箇所と逐語一致の自己確認

- 11 個 = `physiologySectionSpecs`(blink 4 / gaze 3 / head 2 / posture 2)の各 slider spec に `caption` を付与し、`ToneSlider` が描画。
- 1 個 = **Stage Presence: Strength は `StagePresenceCard` 内インライン**の `slider={{ field:"strength", label:"Strength", caption:"…" }}` に付与(section spec 経由ではないため個別に付けた)。

逐語一致(UX §3.1 と大文字小文字・句読点・スペース完全一致、12/12):

1. Blink Frequency: `How often the blink comes. Right = more often.`
2. Blink Calmness: `Evenness of the blink rhythm. Right = steadier.`
3. Blink Crispness: `Speed of close and open. Right = snappier.`
4. Blink Quirk: `Chance of a quick double blink. Right = more often.`
5. Gaze Camera Focus: `How strongly the gaze returns to the camera. Right = more eye contact.`
6. Gaze Restlessness: `How often and how far the eyes wander. Right = busier.`
7. Gaze Dwell: `How long the gaze rests in one place. Right = longer.`
8. Head Sway: `Size of the idle head motion. Right = larger.`
9. Head Follow: `How deeply the head follows big gaze jumps. Right = deeper.`
10. Posture Drift: `Slow sway of the body's center. Right = larger.`
11. Posture Restlessness: `How often the body re-seats. Right = more often. Takes minutes to observe.`
12. Stage Presence Strength: `How far the stage position follows posture. Right = farther.`

描画スタイル: ラベル(`text-xs font-semibold text-neutral-200`)の直下に `text-[11px] font-normal leading-snug text-neutral-400`(一段小さく淡く)。数字非露出維持(質感語のみ、ms/Hz/確率/内部数値なし)。

## 5. テスト結果

### 対象テスト
```
pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run \
  src/control/physiology-page.test.ts src/main/presence src/main/stage-motion src/main/role-composition
```
→ **8 files / 59 tests all passed**。内訳: physiology-page(8, +1 キャプション)、stage-presence-drive(7)、stage-motion-runtime(7)、input-subsystem(13)、autonomous-frame-heart(15)ほか。

### typecheck
```
pnpm --filter @private-2d-rigging-lab/runtime-player run typecheck
```
→ **パス**(tsc --noEmit エラーゼロ)。

### golden 無変更確認
`git diff --stat | grep golden` → **NO golden changes**。blink 2 本 + full-generator-snapshot + resolver 等価 golden いずれも差分なし(ゲイン変更は生成器に触れないため予期どおり)。

### 全体テスト
```
pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run
```
→ **730 passed / 2 failed(732)**。2 失敗は **既知 baseline**: `src/main/broadcast-source/browser-source-server.test.ts` + `src/stage/browser-source/browser-source-server-message.test.ts`(Wave21 由来 `effectiveDynamicsTuning: null` の 1 キー shape、live HTTP server 群の flaky)。physiology / stage-presence / role-composition / stage-motion 系の失敗はゼロ。**それ以外の失敗ゼロを確認。**

## 6. 無変更ファイルの明示

以下は一切触れていない(絶対条件):

- 純計算器 `stage-motion-transform.ts`(本体・test とも無変更)
- トラッキング経路 = `stage-motion-runtime.ts` 本体(tracking 分岐コード無変更。更新したのは同 test のハードコード期待値のみ)
- window-state `stageMotion.settings`(`window-state-stage-motion-settings.ts` 無変更)
- `headless-slot-resolver.ts` / `body-follow-state.ts`
- physiology 生成器 golden 全 3 本(blink-default / blink-alt-config / full-generator-snapshot)
- bridge 契約・プロファイル永続化・自律ホスト既存 Stage Motion UI(裁定 8)
- deadZone(0.02) / reaction(6) / invert(false) の drive 定数(不変を snapshot テストで固定)
- `input-subsystem.test.ts` の `deriveStagePresenceStageMotionSettings(...)` 参照比較は自己整合的なので無改変

実行時 role 分岐はゼロのまま(データ分岐維持)。`pnpm install` 未実行、新規依存なし、lockfile / Editor / package-format / Runtime Export schema 無変更。全差分は `apps/runtime-player/` + `discussion/` に限局。

## 7. 裁量判断 / 質問 / escalate

- **裁量 1(テスト脆さ低減)**: `stage-motion-runtime.test.ts` のゲイン由来値は、数値直書きではなく可能な箇所で `settings.horizontal.strengthPx` / `STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX` から算出する形に更新した(§12 の推奨「将来の脆さを減らす」に沿う)。runtime 本体は無変更。
- **裁量 2(浮動小数の一致)**: drive スナップショットの `toEqual`(bit 完全一致)で実装の `strength * strength` と期待値がずれないよう、期待値も `MAX * (0.3 * 0.3)` と同式で表現した。
- **裁量 3(caption test の apostrophe)**: `renderToStaticMarkup` が `body's` を `&#x27;` にエスケープするため、キャプション照合前に `&#x27;` → `'` へデコードして UX §3.1 逐語と比較している。
- **質問 / escalate / blocked**: なし。3 性質(既定控えめ / 右端明確大 / 単調)はテスト固定済み。MAX 数値(200 / 0.15)は §12 が接地した候補で、**ユーザーの手動再ゲートで最終確認**(「右端で on/off 差が明確に見えるか」)を要する calibration ターゲットである点のみ申し送る。もし右端がまだ弱いと判断されれば MAX_HORIZONTAL のみの引き上げで対応可能(3 性質は保たれる)。
