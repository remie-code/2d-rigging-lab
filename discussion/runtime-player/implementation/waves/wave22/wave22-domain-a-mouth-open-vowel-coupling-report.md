# Wave22 Domain A 完了報告 — Mouth-Open Vowel Coupling

> Orchestrator: Orch-Sylph（呼び出し元: Undine）／ 実装: Gnome（別コンテキスト）／ レビュー: Review-Sylph（別コンテキスト）
> 判定: **合格**（3レーン全合格・1ループ収束）
> Basis: [player-wave22-plan.md](../../orchestration/player-wave22-plan.md)、[vowel-lipsync-mouth-open-coupling.md](../../../../design/vowel-lipsync-mouth-open-coupling.md)
> レビュー: [wave22-domain-a-mouth-open-vowel-coupling-review.md](../../reviews/wave22/wave22-domain-a-mouth-open-vowel-coupling-review.md)

## スコープ

リップシンク有効時、`param_mouth_open` スロットの activation を生 jawOpen 正規化から勝者母音の強度 w（`VowelEstimate.weight`）へ差し替える。無効/非対応時は現行の jawOpen 正規化を温存。第一増分（最小構成）—— 平滑化・jawOpen 味付け・カーブは本波 Out of Scope。

## 変更ファイル

1. `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`（本体・+17/-1 相当）
   - 条件付きスプレッド拡張: `readVowelEstimate` を渡す条件を `sourceKind === "mouth-vowel"` に加え `sourceKind === "mouth-open" && vowelLipsyncEnabled` にも広げた。mouth-open case 内では `readVowelEstimate !== undefined` が「有効+supported」判定信号になる。
   - `mouth-open` case を分岐: `readVowelEstimate !== undefined` のとき `createWeightValue({ slot, activation: estimate.winner === null ? 0 : estimate.weight })`、それ以外は現行 `readRangeActivation(jawOpen, …)` フォールバック。
2. `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.test.ts`（テスト追加・6ケース + ヘルパ `readVowelJawOpenMean`）

参照のみ・無変更（柵遵守）: `vowel-lipsync-estimator.ts`、`semantic-slot-definitions.ts`。

## 追加テスト（6件）

1. `drives mouth-open from the winning vowel intensity when vowel lipsync is enabled` — 有効時「a」「い」で `param_mouth_open` > 0.9。
2. `opens the mouth-open box for the closed vowel 'i' far beyond the jawOpen fallback` — enabled「い」(>0.5) vs disabled「い」(=jawOpenMean/jawOpenMax, <0.2) の gap を pin。本波の主眼。
3. `falls back to jawOpen normalization for mouth-open when vowel lipsync is disabled` — jawOpen 0.4/0.8=0.5 の回帰。
4. `closes the mouth-open box (activation 0) when enabled but the vowel gate is closed` — neutral で `toBe(0)`。
5. `follows the new winner's intensity after a hysteresis-confirmed vowel switch` — "i"→"a"、`vowelHysteresisFrames=3` を跨いで追従。
6. `emits mouth-open and the winning vowel together without disturbing each other` — mouth-open と勝者 vowel 共存、他母音 undefined。

## テスト結果

- typecheck: `tsc --noEmit -p tsconfig.json` → exit 0（Gnome + Review-Sylph 双方が独立実行）。
- Vitest: `runtime-parameter-frame.test.ts` 18 tests 全緑（既存12 + 新規6）。`live-mapping` 配下も巻き添えなし（Gnome 実行時 4 files / 34 tests 緑）。
- `pnpm install` 未実行。既存 node_modules 使用。

## レビュー判定（3レーン）

- spec compliance: 合格
- design / development compliance: 合格
- test adequacy: 合格

要修正なし。Review-Sylph は Gnome の報告に依存せず、差分・basis・テストコードの独立読解 + typecheck/Vitest 再実行で判定。

## 裁量判断

- ゲート閉ケースで `param_mouth_open` は value=0 を emit（キーが存在し 0）と確定。mouth-open case は null 返却経路ではなく `createWeightValue(activation:0)` → finite 0 を返すため。テストで `toBe(0)` として pin。
- 有効+supported の判定を、追加の supported フラグではなく `readVowelEstimate` の有無（= `vowelLipsyncEnabled` のときだけ mouth-open に配線）で表現。既存 conditional-spread パターンと整合し、単一フラグ `vowelLipsyncEnabled`（呼び出し元で「有効 AND supported」を内包）と対になる。
- テスト閾値は実データ `test_data/iFaceMocap/vowels/vowel-captures.json` から導出（capture mean = default reference → w≈1）。魔法数を実データ参照に置換。

## 注意事項 / Undine への申し送り

- **working tree に Domain A スコープ外の未コミット変更あり**: `discussion/design/_map.md`（vowel-lipsync-mouth-open-coupling.md の index 行追加）、`discussion/runtime-player/implementation/_map.md`（player-wave22-plan.md の index 行追加）、`.claude/skills/context-check/SKILL.md`。これらは計画フェーズ/harness 由来で Domain A の実装差分ではない。計画§6 の docs/maps alignment（Batch 2 Final Integration）で整合を取る想定。Orch-Sylph は本スコープ外のため未着手。
- 設計文書 `vowel-lipsync-mouth-open-coupling.md` の Status（現 Draft/未実装）更新、`vowel-lipsync-mapping.md` への逆リンク追記、runtime-player/design マップの該当行更新は Batch 2（Undine）で実施。
- 本波は第一増分。実機ユーザー gate（閉じ母音の過剰閉じ改善・母音切替断絶・平滑化なしの w 段差の認知評価）は後続波（B/a）要否の判断材料。
