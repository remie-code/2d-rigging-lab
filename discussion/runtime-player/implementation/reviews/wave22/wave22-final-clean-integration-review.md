# Wave22 Final Integration — Clean Review（独立再検証）

> Reviewer: Review-Sylph（読み取り専任・別コンテキスト・独立検証）／ 呼び出し元: Sylph
> 判定: **合格（clean）** — 欠陥ゼロ・要修正なし
> Basis: [player-wave22-plan.md](../../orchestration/player-wave22-plan.md)（§7 Acceptance Criteria / §9 Subagent Contract / §12 Out of Scope）、[vowel-lipsync-mouth-open-coupling.md](../../../../design/vowel-lipsync-mouth-open-coupling.md)（§2/§3/§3.4）、[vowel-lipsync-mapping.md](../../../../design/vowel-lipsync-mapping.md)
> Domain A 成果: [report](../../waves/wave22/wave22-domain-a-mouth-open-vowel-coupling-report.md)、[review](wave22-domain-a-mouth-open-vowel-coupling-review.md)（3レーン合格済み）

Gnome / Domain A レポートの主張は鵜呑みにせず、差分・basis・テストを自分で読み、typecheck / Vitest を独立に再実行して判定した。

## 独立再実行の生結果

- **typecheck**: `apps/runtime-player` で `npx tsc --noEmit -p tsconfig.json` → `TSC_EXIT=0`（エラーなし）。
- **Vitest（focused, `src/main/live-mapping` 配下）**: `VITEST_EXIT=0`。
  - Test Files: **4 passed (4)**
  - Tests: **34 passed (34)**
  - 内訳: `runtime-export-auto-mapping.test.ts` 3 / `vowel-lipsync-estimator.test.ts` 7 / **`runtime-parameter-frame.test.ts` 18**（既存12 + Wave22新規6）/ `live-mapping-state.test.ts` 6。
- `pnpm install` は未実行（既存 node_modules 使用）。editor / packages のソースは未参照・未変更。

## 変更面（独立に diff 確認）

`git status` 上の source 変更は 2 ファイルのみ:

- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`（+17/-1 相当）
- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts`（新規6ケース + ヘルパ `readVowelJawOpenMean`）

`vowel-lipsync-estimator.ts` / `semantic-slot-definitions.ts` / `live-mapping-state.ts` / `model-mapping-bridge-handlers.ts` は git status に現れず = **diff 空（無変更）**。

## 各柵の合否（basis 起点で独立確認）

| # | 柵（AC / Subagent Contract） | 合否 | 根拠 |
|---|---|---|---|
| 1 | 推定器 `vowel-lipsync-estimator.ts` の内部を変更していない | 合格 | git status に無し（diff 空）。実装は `readVowelEstimate()` の返り値 `weight`/`winner` を読むのみ。 |
| 2 | 平滑化・jawOpen 味付け（second term）・カーブ整形が無い | 合格 | mouth-open case は `estimate.weight` を素の activation として `createWeightValue` に渡すだけ。加算・時間項・非線形変換いずれも不在（§3.4 / §12 遵守）。 |
| 3 | リグ契約「単一 Vowel 非ゼロ」不変 | 合格 | `createVowelValue` / argmax 構造は無変更。mouth-open に流すのも同じ勝者 w で、母音出力は離散のまま。テスト `emits mouth-open and the winning vowel together …` で他母音 undefined を pin。 |
| 4 | 無効・非対応で jawOpen フォールバック維持 | 合格 | `readVowelEstimate === undefined` 分岐で変更前と**byte 同一**の `readRangeActivation(jawOpen, sessionNeutral?.jawOpen ?? jawOpenMin, jawOpenMax)`。呼び出し元 `model-mapping-bridge-handlers.ts:117` は `isVowelLipsyncEnabled()`（`live-mapping-state.ts:71-78`、非対応なら false を返し「有効 AND supported」を内包）を渡す。非対応時は mouth-open に `readVowelEstimate` が配線されず fallback。 |
| 5 | 有効時は勝者 w 駆動（winner=null で activation 0） | 合格 | `estimate.winner === null ? 0 : estimate.weight`。推定器は gate 下で `emptyEstimate = { winner: null, weight: 0 }` を返す（`vowel-lipsync-estimator.ts` §292-293/307/313）ため意味的に安全。テスト `drives mouth-open …`（>0.9）/ 「い」箱開き（enabled>0.5 vs disabled<0.2）で担保。 |
| 6 | ゲート閉で 0 | 合格 | neutral capture で `toBe(0)` を pin（`closes the mouth-open box …`）。mouth-open case は null 返却経路ではなく `createWeightValue(activation:0)` → finite 0 を emit。 |
| 7 | 母音分類・トグル・body follow・mouth-vowel スロットへの回帰なし | 合格 | 変更は (a) 条件付きスプレッドを `mouth-vowel \|\| (mouth-open && vowelLipsyncEnabled)` に拡張、(b) mouth-open case に分岐追加、の2点のみ。トグル短絡（L79、mouth-vowel 無効時 continue）・mouth-vowel case・body follow・head/gaze/blink case はいずれも無変更。他 sourceKind には `readVowelEstimate` が渡らない（スプレッド条件が mouth-vowel / mouth-open&enabled に限定）ため副作用なし。`live-mapping-state.test.ts` 6 / `vowel-lipsync-estimator.test.ts` 7 / `runtime-export-auto-mapping.test.ts` 3 が全緑で回帰なしを裏付け。 |

## AC 対応（§7）

- リップシンク有効時 `param_mouth_open` が勝者 w で駆動される: 実装 + テストで確認。
- 「い」の過剰閉じ解消（enabled>0.5 vs disabled fallback<0.2 の gap を pin）: 確認。
- 「あ」は w↑で箱が開く: `>0.9` で確認。
- 無効/非対応で従来 jawOpen 駆動: fallback 経路 byte 同一 + 回帰テスト（jawOpen 0.4/[0,0.8]=0.5）で確認。
- 平滑化・味付け・カーブ追加なし / リグ契約不変 / 推定器無変更: 柵2/3/1 参照。
- typecheck / focused Vitest パス: 独立再実行で exit 0 / 34 passed。
- 手動ユーザー gate（実機 iFacialMocap 目視）: 本レビュー範囲外。ユーザー判断として残置（設計どおり）。

## 総合判定

**合格（clean）。** 各柵すべて合格、欠陥ゼロ、要修正なし。独立再実行で typecheck exit 0・Vitest 34 passed（うち runtime-parameter-frame 18）を確認。Domain A 3レーン合格の統合結果は basis の全ての柵を満たす。

### 申し送り（本波スコープ外・判定に影響なし）

working tree に Domain A / Final Integration 実装差分以外の未コミット変更が残る: `.claude/skills/context-check/`（planning-gate からのリネーム + DESIGN.md、harness 由来）、`discussion/design/_map.md`・`discussion/runtime-player/implementation/_map.md`（Wave22 文書の index 行）。これらは計画 §6 docs/maps alignment の範疇で、source 実装の欠陥ではない。
