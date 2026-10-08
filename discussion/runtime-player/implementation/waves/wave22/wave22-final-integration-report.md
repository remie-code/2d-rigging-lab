# Wave22 Final Integration Report — Vowel Lipsync Mouth-Open Coupling v0

> Orchestrator: Orch-Sylph（呼び出し元: Undine）／ Clean final review: Review-Sylph（別コンテキスト・独立検証）
> 判定: **統合合格（clean）** — Domain A 3レーン合格 + final clean integration review 欠陥ゼロ
> Basis: [player-wave22-plan.md](../../orchestration/player-wave22-plan.md)（§6/§7/§8/§9）、[runtime-player-wave-planning-conventions.md](../../orchestration/runtime-player-wave-planning-conventions.md)、[vowel-lipsync-mouth-open-coupling.md](../../../../design/vowel-lipsync-mouth-open-coupling.md)
> 参照: [Domain A report](wave22-domain-a-mouth-open-vowel-coupling-report.md)、[Domain A review](../../reviews/wave22/wave22-domain-a-mouth-open-vowel-coupling-review.md)、[final clean integration review](../../reviews/wave22/wave22-final-clean-integration-review.md)

## 1. スコープと結果

Wave22 は「母音リップシンク有効時に `param_mouth_open` を生 jawOpen 正規化ではなく勝者母音の強度 w（`VowelEstimate.weight`）で駆動し、『開き切り前提』で描かれた母音の形が成立する箱を用意する」第一増分（最小構成）。無効/非対応時は現行 jawOpen 駆動を温存。

- Batch 1（Domain A: mouth-open の w 駆動 + トグル分岐 + focused tests）: **合格**（3レーン全合格・1ループ収束）。
- Batch 2（Final Integration）: 本レポート。clean final review 合格 + docs/maps alignment 実施。

## 2. 統合結果（実装事実）

変更面は Runtime Player 内の 2 ファイルのみ:

- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`（本体・+17/-1 相当）
  - 条件付きスプレッド拡張: `readVowelEstimate` を渡す条件を `mouth-vowel || (mouth-open && vowelLipsyncEnabled)` に広げた。
  - mouth-open case を分岐: `readVowelEstimate !== undefined`（=有効+supported）のとき `createWeightValue({ slot, activation: estimate.winner === null ? 0 : estimate.weight })`、それ以外は現行 `readRangeActivation(jawOpen, …)` フォールバック。
- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts`（新規6ケース + ヘルパ `readVowelJawOpenMean`）

参照のみ・無変更（柵遵守）: `vowel-lipsync-estimator.ts`、`semantic-slot-definitions.ts`、`live-mapping-state.ts`、`model-mapping-bridge-handlers.ts`（いずれも diff 空）。

## 3. Clean Final Integration Review 判定

独立の Review-Sylph（読み取り専任・別コンテキスト）が Gnome / Domain A レポートの主張を鵜呑みにせず、差分・basis・テストを独立に読み、typecheck / Vitest を再実行して判定した。

**判定: 合格（clean）— 欠陥ゼロ・要修正なし。** 7つの柵すべてを basis 起点で独立確認:

1. 推定器 `vowel-lipsync-estimator.ts` 内部を変更していない（diff 空）。
2. 平滑化・jawOpen 味付け（second term）・カーブ整形が無い（§3.4 / §12 遵守）。
3. リグ契約「単一 Vowel 非ゼロ」（cp17）不変。
4. 無効・非対応で jawOpen フォールバック維持（変更前と byte 同一）。
5. 有効時は勝者 w 駆動（winner=null で activation 0）。
6. ゲート閉で 0（neutral で `toBe(0)` を pin）。
7. 母音分類・トグル・body follow・mouth-vowel スロットへの回帰なし。

詳細: [wave22-final-clean-integration-review.md](../../reviews/wave22/wave22-final-clean-integration-review.md)。

## 4. 検証結果（Review-Sylph 独立再実行）

- typecheck: `apps/runtime-player` で `npx tsc --noEmit -p tsconfig.json` → exit 0（エラーなし）。
- focused Vitest（`src/main/live-mapping` 配下）: exit 0 / **4 files・34 tests 全緑**。
  - 内訳: `runtime-export-auto-mapping.test.ts` 3 / `vowel-lipsync-estimator.test.ts` 7 / **`runtime-parameter-frame.test.ts` 18**（既存12 + Wave22 新規6）/ `live-mapping-state.test.ts` 6。
- `pnpm install` 未実行（既存 node_modules 使用）。editor / packages のソース未参照・未変更。

## 5. Docs / Maps Alignment 実施内容

規約 §3 Non-Goal（未合意の新設計を勝手に決めない）を守り、実装事実と食い違う箇所のみを更新した:

- `discussion/design/vowel-lipsync-mouth-open-coupling.md`: Status を Draft → **Implemented（wave22 / source・tests complete / clean review pass。第一増分＝最小構成。実機ユーザー gate 待ち）**。実装レポート / Domain A レポート / クリーンレビューへのパスを追記。
- `discussion/design/vowel-lipsync-mapping.md`: mouth-open 駆動が wave22 で jawOpen → w へ後続更新された旨の最小逆リンクを追記（本文の設計判断は不変）。
- `discussion/design/_map.md`: coupling 行の Status を Draft → Implemented（wave22 / 実機 gate 待ち）へ更新。
- `discussion/runtime-player/implementation/_map.md`: wave22 orchestration 行 Status を「Ready to launch」→「Domain A pass / final integration complete (clean review pass); 実機ユーザー gate 待ち」へ更新。wave22 domain report / final integration report / domain review / clean integration review の行を追加。§4 Current Implementation State に wave22 実装事実を追記。
- `discussion/runtime-player/_map.md`: §4 に母音リップシンクの mouth-open 挙動に関する矛盾記述が無いため未変更（規約どおり触らない）。

## 6. 残課題 / 次の関門

- **実機ユーザー gate が次の関門**（計画 §7 手動 gate / 設計 §5 検証1）。実機 iFacialMocap + 実モデルで、(a) 閉じ母音の過剰閉じ・母音切替の断絶が改善するか、(b) 平滑化なしで w 段差が認知的に許容範囲か、をユーザー目視。→ 後続波（B: 平滑化 / a: jawOpen 味付け）の要否判断材料。本レビュー範囲外・ユーザー判断として残置。
- 未コミット残置（本波スコープ外・source 欠陥ではない・判定に影響なし）: `.claude/skills/context-check/`（harness 由来リネーム + DESIGN.md）。commit 分離はユーザー判断。
- 本波はコミットしていない（コミットはユーザー判断）。

## 7. Out of Scope（本波で入れていない）

- 母音切替 w 段差の時間平滑化（後続波候補 B）。
- jawOpen「余分な開き」second term / 味付け（後続波候補 a）。
- mouth_open への w のカーブ整形。
- 推定器の次元重み / ゲート閾値 / ヒステリシス再調整、キャリブレーション経路、母音参照の変更。
- editor 側 / packages 側の変更。
