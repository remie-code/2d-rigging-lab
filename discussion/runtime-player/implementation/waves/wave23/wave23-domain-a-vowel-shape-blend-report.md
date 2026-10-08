# Wave23 Domain A — Vowel Shape Blend 完了報告

> 目的: 母音リップシンクを単一勝者(argmax) → 合計≈1 の正規化凸ブレンドへ拡張し、母音切替の"形"のパチつきを解消。cp17「単一 Vowel 非ゼロ」を意図的に解除、Wave22 の `mouth_open=勝者 w` を `mouth_open=ブレンド強度 s` へ一般化。
> ステータス: **実装 + テスト + 3レーンレビュー pass**（ループ 1 回）。実機ユーザー gate は未実施（Undine 後続 / 計画 §7）。
> 実装: Gnome / レビュー: Review-Sylph / オーケストレーション: Orch-Sylph。

## パイプライン（実装済み）

```
距離 d_v →[softmax raw_v = exp(−(d_v − d_min)/τ)]→[× max(0,strength_v)]→[÷ Σ_j(raw_j × strength_j)]→ 正規化重み_v →[× s]→ param_mouth_vowel_v ,  mouth_open = s
```

- `s = activity / (activity + d_min)`、`d_min` = 生 argmax 最近傍距離（`scoreVowels` の winnerDistance）。
- τ = `0.30 × median(母音間 Δ ペアワイズ weightedDistance)`。参照確定時1回計算しキャッシュ。
- softmax の `−d_min` 減算は正規化不変（共通因子 `exp(d_min/τ)` が分子分母で相殺）な数値安定化。設計未記載だが数学的に等価で後方互換を壊さない。

## 変更ファイル

- `apps/runtime-player/src/main/live-mapping/vowel-lipsync-estimator.ts`
  - `VowelEstimate` を `{ winner, weight }` → `{ s: number; weightByVowel: Readonly<Record<VowelLabel, number>> }` へ拡張（winner/weight は撤去・併存させず）。
  - ヒステリシス一式撤去: `updateConfirmedWinner`・状態フィールド `confirmedWinner/candidate/candidateStreak`・定数 `vowelHysteresisMargin`/`vowelHysteresisFrames`。
  - `RuntimePlayerVowelLipsyncState` は τ キャッシュ保持（`cachedReferences`/`cachedTemperature`）に転用。クラスと `reset()` は存置（呼び出し側が `new` するため）。
  - 新規 export: `vowelBlendTemperatureFactor = 0.3`、`computeVowelBlendTemperature(references)`、`computeVowelBlend(distanceByVowel, strengthByVowel, tau)`（softmax→strength前段→正規化の純関数）。
  - `computeIntensity` の第2引数を生 argmax 最近傍距離 `d_min` に読み替え。
- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`
  - `collectVowelStrengths(slots)` 新設: 5母音スロットの `slot.strength` を正規化前段用ベクトルに束ね `estimate()` に `strengthByVowel` として渡す（ループ前に一度）。
  - `createVowelValue`: argmax 単一勝者 → 全母音 `s × weightByVowel[v]` 出力。**末端 strength 乗算（`createWeightValue`）を迂回**し `target.min + activation×(max−min)`（invert 対応）を直接返す。
  - mouth-open case を `estimate.s` 駆動に差し替え。jawOpen フォールバック枝は無改修。
- テスト: `vowel-lipsync-estimator.test.ts`（全面書き換え・10 tests）、`runtime-parameter-frame.test.ts`（母音関連ブロック回帰更新・19 tests）。

## invariant 充足

| invariant | 充足機構 |
|---|---|
| strength 二重適用禁止 | strength は `computeVowelBlend` 内で `raw_v×strength_v` として1回だけ適用。写像層は末端乗算 `createWeightValue` を通さず素の target マッピング。pin テスト: 非一様 strength(i=3) で Σ(母音出力)≈mouth_open(=s) を assert（末端再乗算なら fail）。 |
| s の分母 = 生 argmax 最近傍 | `computeIntensity(scores.activity, scores.winnerDistance)`。strength・ヒステリシス非依存。 |
| τ 参照確定時1回・キャッシュ | 保持点 `RuntimePlayerVowelLipsyncState.cachedTemperature`。再計算トリガは参照の恒等短絡＋48値内容比較。較正参照は毎フレーム新規でも内容一致で median 再計算スキップ。`reset()` でキャッシュ無効化。 |
| ヒステリシス撤去・クラス存置 | 上記の通り撤去、クラスは τ キャッシュに転用。 |
| ゲート短絡維持 | `activity < 0.15` で s=0・weightByVowel 全0 を返す。 |
| jawOpen フォールバック維持 | mouth-open の `readVowelEstimate === undefined` 枝無改修。 |
| 小 τ 後方互換 | `computeVowelBlend(…, 1e-4)` で argmax + s=w 収束。テストで pin。 |

## テスト結果

| 項目 | コマンド | 結果 |
|---|---|---|
| typecheck | `pnpm --filter @private-2d-rigging-lab/runtime-player run typecheck` | 0 エラー |
| focused Vitest | `pnpm --filter …/runtime-player exec vitest run -c vitest.config.ts src/main/live-mapping` | 38 passed / 0 failed |

全体 test:unit は 479 pass / 2 fail。2 fail は browser-source ドメイン（`broadcast-source/browser-source-server.test.ts`・`stage/browser-source/browser-source-server-message.test.ts`）で live-mapping 無関係の **pre-existing**（本 Wave 差分は live-mapping 4 ファイルのみ・Review-Sylph が `git diff --stat` で裏取り）。

## レビュー判定

3レーン（spec / design-development / test adequacy）**全 pass**、blocking なし、エスカレーション不要。詳細: `discussion/runtime-player/implementation/reviews/wave23/wave23-domain-a-vowel-shape-blend-review.md`。

## 裁量判断

- 配線: strength ベクトルを estimator に渡し正規化を estimator に集約（`collectVowelStrengths` → `estimate(strengthByVowel)` → `computeVowelBlend`）。写像層で正規化する案は不採用（単一箇所集約・mouth-open は s のみ読むため摩擦小）。
- winner/weight は撤去（`{ s, weightByVowel }` に一本化。分類 argmax はテスト側で weightByVowel から導出）。
- softmax で d_min 減算（数値安定化・正規化不変・設計未記載）。

## 注意事項 / Undine への申し送り

- **未マップ母音スロットの strength 既定=1**: `collectVowelStrengths` は enabled かつ target を持つ母音スロットの strength を採り、存在しない母音は strength=1。設計は「supported ⇒ 5母音すべて解決」前提で部分マップを規定せず、この既定は Gnome 解釈。実運用（vowelLipsyncSupported=true）は全5スロット存在のため runtime 差ゼロ。Review でも minor（前提下で無害）判定。
- **publish 挙動変化**: 旧 argmax は敗者 null（parameterId 未発行）。cp17 解除で有効・ゲート開時は5母音すべて毎フレーム発行（softmax は厳密に非0）、ゲート閉時は全母音を有限値0で発行。設計 §2.6 の意図通り。disabled 経路は従来どおり未発行。
- **任意改善（minor・Final Integration 候補）**: (a) ゲート閉で全母音0発行される契約変化を mapping 層テストで直接 pin。(b) `createVowelValue` が `target.default` を無視し min..max 線形写像する旨を1行コメントで固定（default≠0 の母音 target 運用が将来入る場合の安全策）。母音 target は慣習 default=0 のため現状実害なし。
- **docs / maps alignment（Final Integration で Undine 対応・計画 §6）**:
  - `discussion/design/vowel-lipsync-shape-blend.md`: Status Draft → Implemented（wave23）。
  - `discussion/design/vowel-lipsync-mapping.md`: cp17 が wave23 で解除された旨の最小追記。
  - `discussion/design/vowel-lipsync-mouth-open-coupling.md`: mouth_open=s 一般化の逆リンク。
  - design/_map・runtime-player 実装マップ更新。
- **既存の未コミット modified**: `discussion/design/_map.md` と `discussion/runtime-player/implementation/_map.md` は本 Wave 実装前から未コミット modified（Domain A 変更ではない・Gnome/Review とも未改変・未 revert）。
