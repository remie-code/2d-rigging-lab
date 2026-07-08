# Wave22 Domain A レビュー — Mouth-Open Vowel Coupling（3レーン）

> Reviewer: Review-Sylph（読み取り専任・別コンテキスト）／ Orchestrator: Orch-Sylph
> 判定: **合格**（3レーン全合格・要修正なし・1ループ収束）
> Basis: [player-wave22-plan.md](../../orchestration/player-wave22-plan.md)（§3/§5/§9/§12）、[vowel-lipsync-mouth-open-coupling.md](../../../../design/vowel-lipsync-mouth-open-coupling.md)（§2/§3/§3.4）

## レビュー対象

- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`（本体・18行）
- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts`（テスト追加・6ケース + ヘルパ `readVowelJawOpenMean`）

対象外（Domain A スコープ外・計画/harness 由来。Batch 2 Final Integration で扱う）: `discussion/design/_map.md`、`discussion/runtime-player/implementation/_map.md`、`.claude/skills/context-check/SKILL.md`。

## 独立検証

Review-Sylph が Gnome の報告を鵜呑みにせず独立再実行:

- typecheck `tsc --noEmit -p tsconfig.json` → exit 0
- Vitest `runtime-parameter-frame.test.ts` → 18 tests passed（既存12 + 新規6）
- 参照ファイル無変更を diff で確認（`vowel-lipsync-estimator.ts` / `semantic-slot-definitions.ts` は diff 空）

## レーン1: spec compliance — 合格

計画§5 Required Behavior / §3.2 の4項目を実装が満たす。

- 有効+supported = 勝者 `weight`: 配線（条件付きスプレッド）が `mouth-vowel || (mouth-open && vowelLipsyncEnabled)` のとき `readVowelEstimate` を渡し、mouth-open case は `readVowelEstimate !== undefined` を「有効+supported」判定信号に使う。`vowelLipsyncEnabled` は呼び出し元 `model-mapping-bridge-handlers.ts:117` の `isVowelLipsyncEnabled()`（非対応なら false）を内包する。
- 無効/非対応 = jawOpen フォールバック: 変更前と完全同一の `readRangeActivation(jawOpen, sessionNeutral?.jawOpen ?? jawOpenMin, jawOpenMax)` 経路。
- ゲート閉/winner=null = 0: `estimate.winner === null ? 0 : estimate.weight`。`emptyEstimate = { winner: null, weight: 0 }` により winner=null で weight=0 が保証され、三項は冗長だが意味的に正しく意図が明示的。
- strength/clamp 維持: `createWeightValue`（invert・strength 適用）+ 呼び出し元の `clamp(value, target.min, target.max)`。mouth-vowel と同一経路。

## レーン2: design / development compliance — 合格

- 推定器 `vowel-lipsync-estimator.ts`・`semantic-slot-definitions.ts` 無変更（diff 空）。§3.3/§9 の柵遵守。
- 平滑化 / jawOpen second term（味付け）/ カーブ整形いずれも不在。mouth-open case は `estimate.weight` を素の activation として渡すのみ。設計§3.4・計画§12 Out of Scope 遵守。
- リグ契約「単一 Vowel 非ゼロ」不変（`createVowelValue` 無変更、argmax 構造維持）。母音分類・ヒステリシス・ゲート・キャリブレーション経路無変更。
- 最小変更（条件付きスプレッド1箇所拡張 + case内分岐のみ）。既存パターンに整合、巻き添えなし。
- コメントは設計§2.2/§3.2 を正しく述べ、誤誘導なし。

## レーン3: test adequacy — 合格

計画§5 Tests / §8 Verification Matrix の5観点を実テストで担保。

- 各母音追従 / 「い」低 jawOpen（`drives mouth-open …` / `opens the mouth-open box for the closed vowel 'i' …`）: capture mean が default reference と一致 → winnerDistance≈0 → w≈1。`>0.9` / `>0.5` は妥当。
- 無効フォールバック回帰（`falls back to jawOpen …` / 「い」enabled vs disabled gap）: jawOpen 0.4/0.8=0.5 を厳密 pin。disabled「い」= `jawOpenMean/jawOpenMax`（`<0.2`）と enabled（`>0.5`）の gap を pin し Wave22 の主眼を担保。
- ゲート閉 activation=0（`closes the mouth-open box …`）: neutral capture で `toBe(0)`。
- 勝者交代（`follows the new winner's intensity …`）: "i" 確定 → "a" を4フレーム投入で `vowelHysteresisFrames=3` を確実に跨ぐ。
- mouth-vowel/body 共存回帰（`emits mouth-open and the winning vowel together …` + 既存テスト緑）。
- 期待値は実データ `test_data/iFaceMocap/vowels/vowel-captures.json` と estimator 実挙動から導出、魔法数の裏付けあり。

### 任意観察（修正不要）

1. 非対応（supported=false）の直接テストは無いが、単一フラグ設計により disabled ケースが非対応を代表する。関数境界ユニットとして妥当、本波スコープで追加不要。
2. strength を効かせた mouth-open の専用テストは無いが、mouth-vowel case の既存 strength テストと同一 `createWeightValue` 経路のため実質カバー。
3. 勝者交代テストは switch 前後とも w≈1 のため mouth-open 値そのものの変化は弁別しないが、winner=a 確定は mouth-vowel 側で pin 済みで要求は満たす。

## 総合判定

**Domain A 合格。** 3レーン全合格、要修正なし。typecheck exit 0・Vitest 緑を独立再実行で確認。
