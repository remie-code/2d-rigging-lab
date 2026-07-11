# C3 追撃 Domain F レビュー (Lane 1: spec / UX 突合)

> Reviewer: Review-Sylph (Lane 1 = spec/UX 突合)。委任元: Orch-Sylph。
> 対象: `apps/runtime-player`。読み取り専任。日付: 2026-07-11。
> 判定基準: c3-wave-plan.md §12 / c3-physiology-profile.md §3・§3.1 / 実装報告 domain-f-followup.md。
> 判定: **合格**。blocking なし。要修正なし。

## 判定サマリ

| 観点 | 結果 |
|---|---|
| A. キャプション逐語一致 | 合格 (12/12 完全一致) |
| B. 数字非露出の規律 | 合格 |
| C. Stage Presence ゲイン写像の意図適合 | 合格 |
| D. スコープ規律 | 合格 |

---

## A. キャプション逐語一致 (最重要 blocking) — 合格

UX §3.1 の表 12 行と `physiology-page.tsx` のキャプション文字列を**機械的に**照合(正規表現抽出→集合突合、目視ミス排除)。**12/12 完全一致**。差分ゼロ:

- 大文字小文字・句読点・スペース・`=` 前後の空白まで一致。
- apostrophe を含む `Slow sway of the body's center. Right = larger.` も一致(実装ソースは生の `'`。report の裁量3 = テスト側で `renderToStaticMarkup` の `&#x27;` を戻して照合、は妥当)。
- 過不足なし: spec にあって impl にない文言 = 0、impl にあって spec にない文言 = 0。

配置(section と field の取り違えなし)も確認:

- Blink 4 (frequency / calmness / crispness / quirk)、Gaze 3 (cameraFocus / restlessness / dwell)、Head 2 (sway / follow)、Posture 2 (drift / restlessness) は `physiologySectionSpecs` の各 slider spec に付与され `ToneSlider` が描画。
- **Stage Presence: Strength は `StagePresenceCard` 内インライン** (`slider={{ field:"strength", label:"Strength", caption:"How far the stage position follows posture. Right = farther." }}`, physiology-page.tsx L340-345)。section spec を通らない経路の付け忘れがない点を重点確認し、付与済みを確認。合計 12。

方式要件(UX §3.1「常時表示・一行・小さく淡色」):

- `ToneSlider` (L367-390) はラベル `<span>{slider.label}</span>` の直下に `<span className="text-[11px] font-normal leading-snug text-neutral-400">{slider.caption}</span>` を**無条件描画**。条件付きレンダリング/info アイコン/ツールチップは不在。方式要件を満たす。
- 淡色・小サイズ: ラベルが `text-xs font-semibold text-neutral-200`(12px/太/明)に対しキャプションは `text-[11px] font-normal text-neutral-400`(一段小・通常太さ・淡色)。UX の「小さく淡色」に適合。

## B. 数字非露出の規律 (blocking) — 合格

キャプション 12 文言に ms / Hz / 確率 / 内部スキーマ数値の混入なし。逐語一致(観点A)であるため §3.1 の数字非含有設計が自動的に担保されている。逐語から逸脱して数字を足した箇所もなし。質感語のまま(§3「質感語のまま説明する」)。Posture Restlessness には UX §3.1 の要求どおり観察時間軸注記 `Takes minutes to observe.` が逐語で含まれる。

## C. Stage Presence ゲイン写像の意図適合 (blocking 観点) — 合格

`stage-presence-drive.ts` の diff を確認。変更は「上限側のゲイン写像のみ」に限局:

- 写像: 線形 `MAX × strength` → **凸(2乗)** `MAX × strength²`(`const gain = strength * strength`, L86)。
- MAX 定数: `MAX_HORIZONTAL 60→200`, `MAX_SCALE 0.05→0.15`。

§12 要件との突合(数値を実際に計算して確認):

- **既定 strength 0.3 の控えめ維持**: gain = 0.3² = 0.09 → horizontal 200×0.09 = **18px**、scale 0.15×0.09 = **0.0135**。旧値は 60×0.3 = 18px / 0.05×0.3 = 0.015。horizontal は**完全同一(18px)**、scale はむしろ僅かに控えめ(0.0135 < 0.015)。控えめさ維持 ✓。
- **右端 strength 1.0 が明確に大きい**: gain = 1 → horizontal **200px** / scale **0.15**。旧 60px/0.05 から horizontal 3.3倍・scale 3倍に拡大。camera-follow 既定(80px)を上回る(drive.test の `toBeGreaterThan(...horizontal.strengthPx)` で固定)。明確に大 ✓。
- **単調増加**: `strength²` は [0,1] で単調増加・原点通過(strength 0 ⇒ 0)。単調性 ✓。
- **deadZone / reaction / invert 不変**: diff 上 `STAGE_PRESENCE_DEAD_ZONE = 0.02` / `STAGE_PRESENCE_REACTION = 6` / `invert: false` はいずれも無変更。「変えるのは上限側のゲインだけ」を満たす ✓。
- **接地論理**: report の posture 接地(typical posture ±0.2..0.35 × 200px = 40..70px @ full)は破綻なし。凸写像で低域を寝かせ高域を持ち上げる設計は §12「既定は控えめ・右端は明確」に整合。MAX(200/0.15)そのものの妥当性は手動再ゲートの calibration ターゲットのため blocking にしない(§12 明記どおり)。

無変更確認(git diff --name-only で該当ファイルが差分に**出ないこと**を検証):

- 純計算器 `stage-motion-transform.ts` — 差分なし ✓
- トラッキング経路本体 `stage-motion-runtime.ts`(.ts 本体)— 差分なし ✓(差分に出るのは同 `.test.ts` のみ)
- window-state `window-state-stage-motion-settings.ts` — 差分なし ✓
- `headless-slot-resolver.ts` / `body-follow-state.ts` — 差分なし ✓
- physiology 生成器 golden(blink 2 本 + full-generator-snapshot ほか)— `git status` に golden 変更ゼロ ✓

## D. スコープ規律 — 合格

- 追撃全体の変更ファイルは **7 件のみ**: `physiology-page.tsx` / `physiology-page.test.ts` / `stage-presence-drive.ts` / `stage-presence-drive.test.ts` / `stage-motion-runtime.test.ts`(以上 apps)+ `c3-wave-plan.md` / `c3-physiology-profile.md`(discussion)。禁止ファイル群(前掲)は一切含まれない。
- `stage-motion-runtime.test.ts` は期待値更新のみ(本体 .ts 無変更を stat で確認)。
- 実行時 role 分岐の増加なし(drive はデータ導出のみ、`if (role)` 追加なし)。新規依存・lockfile・Editor・package-format・Runtime Export schema 無変更(差分がすべて上記 7 ファイルに限局していることから確認)。
- Out of scope(自律ホスト既存 Stage Motion UI 等)への波及なし。

## 裁量判断の妥当性

- report の裁量1(test のゲイン由来値を定数/`strengthPx` から算出化)・裁量2(`0.3*0.3` を式のまま書き float 完全一致)・裁量3(`&#x27;`→`'` デコードして逐語照合)はいずれも妥当。特に裁量3 は `renderToStaticMarkup` のエスケープ仕様に対する正当な対処で、逐語判定を歪めない。

## 差分 / blocking

なし。

## 質問 / 申し送り

- blocking なし。Lane 1 観点では合格。
- 申し送り(裁定事項ではない): MAX_HORIZONTAL 200 / MAX_SCALE 0.15 は §12 が接地した候補で、**右端の on/off 差の知覚性はユーザー手動再ゲートで最終確認**する calibration。もし右端がまだ弱ければ MAX_HORIZONTAL のみの引き上げで対応可能(3性質は保たれる)——この経路の妥当性も確認済み。
- test adequacy(テスト期待値の網羅・脆さ)の精査は Lane 2 の担当範囲。本レビューは spec/UX 突合に限定。

## 判定: 合格
