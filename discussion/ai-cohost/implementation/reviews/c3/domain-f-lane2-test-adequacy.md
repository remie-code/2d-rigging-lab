# C3 追撃 Domain F レビュー (Lane 2: test adequacy)

> レビュー担当: Review-Sylph (Lane 2 = test adequacy) / 委任元: Orch-Sylph。
> 対象 wave: `cohost-c3-followup-captions-presence`。根拠: [c3-wave-plan.md](../../orchestration/c3-wave-plan.md) §12 / 実装報告 [domain-f-followup.md](../../waves/c3/domain-f-followup.md)。
> 判定: **合格 (PASS)**。要修正なし。blocking なし。
> 実施日: 2026-07-11。読み取り専任(コード無改変)。

---

## 判定サマリ

2 作業(①スライダー常時キャプション ②Stage Presence ゲイン写像 線形→凸2乗・MAX拡大)の追加テストは、§12 が要求する検証を **十分に固定** している。テスト実行(59 passed)・typecheck・golden無変更・本体`.ts`無変更をすべて自分で再現確認した。非 blocking の観察 2 点(下記 E)を申し送るが、いずれも合格を妨げない。

---

## A. キャプションのテスト十分性 — 適合

対象: `apps/runtime-player/src/control/physiology-page.test.ts`

- **12キャプションの逐語検証(適合)**: 新規テスト `renders the always-on one-line caption for every slider (UX §3.1 verbatim)`(L73-96)が 12 文言を配列で保持し、`renderPhysiologyMarkup()` の出力全体に対し各文言を `toContain` で照合。UX §3.1(`discussion/ai-cohost/implementation/screens/c3-physiology-profile.md` の表)と 1 文字単位で突合した結果 **12/12 完全一致**(大文字小文字・句読点・スペース・`Right =` の等号両側スペースまで一致)。実装 `physiology-page.tsx` の `caption` 文言も同表と 12/12 一致。
- **apostrophe エスケープ処理(適合)**: `renderToStaticMarkup` は `body's` を `&#x27;` にエスケープする。テストは照合前に markup 全体で `.replace(/&#x27;/g, "'")` を実行(L76)してから比較しており、UX §3.1 の標準 apostrophe `'` との逐語比較が正しく成立している。Posture Drift の `Slow sway of the body's center. Right = larger.` が実際に一致することを確認。
- **数字非露出テストの有効性(適合)**: 既存 `never exposes engineering numbers (ms / Hz / probability)`(L98-112)はキャプション追加後も **無改変で現存し、キャプションを含む全 markup に対して pass**。12 キャプションはいずれも数字を含まないため、規律違反を導入していないことをこのテストが引き続き担保する。
- **既存テスト無破壊(適合)**: 空状態2種(tracking-host / Runtime-Export-required)・全セクション描画・Reset有効/無効・トーンスライダー結線・Stage Presence toggle 反映——既存 7 テストは無改変で pass。physiology-page.test.ts は 8 tests(7 既存 + 1 新規)全 pass。

## B. ゲイン写像のテスト十分性(§12 の3性質)— 適合

対象: `apps/runtime-player/src/main/presence/stage-presence-drive.test.ts`

- **既定 0.3 の控えめさ(適合・二重固定)**:
  - `scales BOTH ...`(L49-62)が `def.horizontal.strengthPx ≈ MAX×0.09`(=18px)/ `def.scale.strength ≈ MAX_SCALE×0.09`(=0.0135)を `toBeCloseTo(...,10)` で固定。
  - スナップショットテスト `pins the full derived settings incl. deadZone/reaction`(L129-155)が `strengthPx: MAX×(0.3×0.3)` を **実装と同一式**で `toEqual`(float完全一致)固定。実装 `gain = strength*strength`(drive.ts L86)とビット一致する式を採用しており、裁量2(浮動小数の一致)は妥当。
- **右端 1.0 の明確な大きさ(適合)**: `scales BOTH ...`(L44-47)が `full.horizontal.strengthPx === STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX`(200)/ `full.scale.strength === STAGE_PRESENCE_MAX_SCALE_STRENGTH`(0.15)を固定。旧値(60/0.05)からの拡大検知は、後述「控えめ vs camera-follow」テストの `full > camera-follow(80px)` 側で担保(60px では fail する)。詳細は E-1。
- **単調性(適合)**: `increases strength monotonically`(L65-81)が strength `[0, 0.25, 0.5, 0.75, 1]` に対し px・scale 双方の **狭義単調増加** を assert。凸2乗写像の単調性を十分な標本点で固定している。
- **「conservative vs camera-follow」の書き換え(適合・正しい方向)**: `keeps the DEFAULT strength 0.3 conservative vs the camera-follow defaults`(L100-127)は、(a)`def < camera-follow default`(控えめ維持)を assert しつつ、(b)`full > camera-follow default`(右端は明確に大きい)を **意図された挙動として** assert(コメントに「not a regression」明記, L118-119)。full が camera-follow を超えることを退行扱いしていない。§12「右端で on/off 差が明確」への正しい再定式化。
- **deadZone(0.02)/ reaction(6) の固定(適合)**: スナップショットテスト(L152-153)が `deadZone: 0.02` / `reaction: 6` を `toEqual` で固定。上限ゲインのみ変更・下流定数は不変、という §12 の不変条件を担保。
- **clamp(NaN/範囲外)の維持(適合)**: `clamps a non-finite / out-of-range strength into [0,1]`(L157-168)が NaN→0、strength 5→MAX を固定。維持されている。

## C. runtime テストの更新妥当性 — 適合

- **ゲイン由来ハードコードの更新(適合)**: `stage-motion-runtime.test.ts` の旧リテラル(60/30/-60/+60)は消滅し、すべて `STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX` または `deriveStagePresenceStageMotionSettings(...)` から算出した値を参照(L99-103, L169-171, L199-201, L221-223, L235-238)。§12 推奨「将来の脆さを減らす」に沿った裁量1 として妥当。
- **runtime 本体 `.ts` 無変更(適合)**: `git diff --name-only` に `stage-motion-runtime.ts` は **出現せず**(変更は同 `.test.ts` のみ)。`git diff --stat -- stage-motion-runtime.ts stage-presence-drive.ts` で本体側は `stage-presence-drive.ts`(25+/13-, ゲイン写像)のみ差分、`stage-motion-runtime.ts` は差分ゼロを確認。
- **input-subsystem.test.ts の自己整合性(適合)**: 当ファイルは git diff に出現せず **無改変**。`Autonomous Host supplies a Stage Presence drive ...`(L317-342)が `drive.settings` を `deriveStagePresenceStageMotionSettings({enabled:true, strength:1})` の出力と `toEqual` 比較しており、ゲイン写像の変更に自動追従。無改変のまま 13 tests 全 pass。

## D. テスト実行の再現 — 適合

対象4スイート:
```
pnpm --filter @private-2d-rigging-lab/runtime-player exec vitest run \
  src/control/physiology-page.test.ts src/main/presence src/main/stage-motion src/main/role-composition
```
→ **8 files / 59 tests passed**(報告値と一致)。内訳: physiology-page(8)、stage-presence-drive(7)、stage-motion-runtime(7)、input-subsystem(13)、autonomous-frame-heart(15)、stage-motion-transform(4)、stage-motion-transport(2)、role-selection-stub(3)。

typecheck:
```
pnpm --filter @private-2d-rigging-lab/runtime-player run typecheck
```
→ **pass**(tsc --noEmit エラーゼロ)。

golden 無変更:
```
git diff --name-only | grep -i golden
```
→ **空**(NO golden diffs)。working tree の変更は当該5コードファイル + discussion 2 ファイル(c3-wave-plan.md / c3-physiology-profile.md)のみ。

`pnpm install` は未実行(既存 node_modules で完走)。

## E. 非 blocking の観察(申し送り・修正不要)

1. **右端の絶対量(200/0.15)はリテラルでなく定数シンボルで固定**: 各テストは `STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX` / `_MAX_SCALE_STRENGTH` を import 参照して assert するため、定数値そのものを別値(例: 旧60/0.05)へ書き換えた場合、`full === 定数` 系テストは素通りする。ただし **horizontal 側は** `keeps the DEFAULT ... conservative` の `full > camera-follow(80px)`(L124-126)が下限ガードとなり、旧 60px への revert は fail で検知される。**scale 側**は同種の下限ガードが無く(assert は `def < camera-follow scale` のみ)、旧 0.05 への revert を捕捉できない。とはいえ 200/0.15 は報告が明示するとおり **ユーザー手動再ゲートの calibration ターゲット** であり、定数を single source of truth として参照する設計は §12「脆さを減らす」意図と整合的。強化するなら `expect(STAGE_PRESENCE_MAX_SCALE_STRENGTH).toBeGreaterThan(runtimePlayerDefaultStageMotionSettings.scale.strength)` の一行追加で scale 側にも拡大下限を固定できる。**任意**。
2. **数字非露出テストは denylist 方式**: `never exposes engineering numbers` は特定トークン(Hz / probability / /min / blinks / 列挙数値)の非存在を確認する denylist で、「任意の新規数字」を捕捉する no-digit チェックではない。ただしキャプション文言は逐語テスト(A)で 1 文字単位に固定されるため、キャプション経由の数字混入は逐語テスト側で必ず fail する。二重で塞がれており実害なし。**修正不要**(既存設計由来)。

補足: 全体スイート(報告値 730 passed / 2 failed = browser-source-server 既知 baseline)は本追撃の対象4スイート外であり、変更5ファイルは broadcast-source に一切触れないため、当該2失敗は本 wave と無関係。全体スイートの独立再実行は本レビュー範囲外として未実施。

## 不足テスト・blocking

**なし。**

## 判定

**合格 (PASS)。** §12 の要件(キャプション逐語表示・数字非露出維持 / 新ゲイン写像の3性質=既定控えめ・右端明確大・単調 / deadZone・reaction・clamp の不変 / 既存本体無変更)はすべてテストで固定され、実行・typecheck・golden・本体無変更を再現確認済み。E の2点は非 blocking の申し送りであり、要修正差分はない。
