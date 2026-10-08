# Wave23 Final Integration Report — Vowel Shape Blend

> 目的: 母音リップシンクを単一勝者(argmax) → 合計≈1 の正規化凸ブレンドへ拡張し、母音切替の"形"のパチつきを解消（cp17 解除）。Wave22 の `mouth_open = 勝者 w` を `mouth_open = ブレンド強度 s` へ一般化。
> ステータス: **Final Integration 完了（clean review pass）**。source・tests・3レーンレビュー・clean final review・任意改善2点取込すべて完了。**実機ユーザー gate が次の関門**（未実施）。
> オーケストレーション: Orch-Sylph（L1）/ 実装: Gnome / レビュー: Review-Sylph（分離コンテキスト）。

## 1. 統合結果

Domain A（推定器の正規化凸ブレンド化 + 写像層のブレンド配分・strength 前段集約・mouth_open=s）は 3レーンレビュー pass 済み。本 Final Integration で以下を確定した。

- **Clean final integration review**: 独立の Review-Sylph が Domain A 報告に依存せず、basis（計画 §7 AC / §3.2 invariant / §9 柵・設計 §2）・差分・テストを独立に読み、typecheck / focused Vitest を再実行して統合結果を検証。**総合 pass**（blocking なし・要エスカレーションなし）。レビュー文書: `../../reviews/wave23/wave23-final-clean-integration-review.md`。
- **任意改善2点を取込**（clean review が「価値あり・trivial」と判定、別コンテキストの Gnome に小修正委譲・test + comment のみでソースロジック不変）。
- **docs / maps alignment** を実装事実に合わせて実施。

## 2. Clean Final Integration Review 判定

**総合 pass。** 独立検証で確認した要点:

- cp17 解除: 有効・ゲート開で5母音が `s × 正規化重み`（Σ=s）で同時発行。
- strength は正規化前段（`raw_v × strength_v`）で一度だけ適用。写像層は末端乗算 `createWeightValue` を迂回し**二重適用なし**（`strength_v=0` で当該母音除外）。二重適用 pin は非トートロジー（末端再乗算なら Σ≠s で fail する形）。
- `s` の分母＝生 argmax 最近傍 `d_min`（ヒステリシス勝者距離ではない）。
- τ = 0.30 × median(母音間 Δ 距離) を参照確定時1回キャッシュ（毎フレーム再計算なし）。テストが median を独立再計算し帯域 0.12〜0.18 を pin。
- ヒステリシス撤去・ゲート（activity<0.15 で s=0 口閉じ）維持。小 τ で単一勝者 + mouth_open=w に収束（後方互換）。
- 本波禁止項目（時間平滑化 / 鋭さ τ ユーザーツマミ / jawOpen 味付け second term / top-k / 次元重み手術 / え ゲート / カーブ整形）いずれも未混入。`vowelDimensionWeights` 全1のまま。
- 母音分類・トグル・body follow・mouth-vowel / mouth-open・キャリブレーション経路に回帰なし。jawOpen フォールバック（無効/非対応）維持。

## 3. 任意改善2点の取込

clean review が挙げた minor 2点を Gnome に委譲（ソースロジック不変・test + comment のみ）。両検証緑を Orch が独立再確認済み。

- **(a) ゲート閉での母音5本 finite-0 発行を mapping 層で直接 pin**: `runtime-parameter-frame.test.ts` のゲート閉テスト（"closes the mouth-open box … when enabled but the vowel gate is closed"）に母音5スロットを追加し、`param_mouth_vowel_a/i/u/e/o` が**キー存在（`in`）かつ値 0**であることを assert。旧「敗者 undefined」→「全母音 finite 0 発行」への出力契約変化を統合シームで pin。実出力5本とも 0 を確認。
- **(b) `createVowelValue` の default ピボット非採用コメント**: 同関数が `createWeightValue` の `target.default` 起点ピボットを敢えて使わず `target.min + activation×(max−min)` を直接返す旨（default≠0 の母音 target が将来入っても min..max 線形写像で意図どおりになる）を既存コメントに1行追記。

residual なし（両点とも trivial に取込完了）。

## 4. 検証結果

Orch が独立再実行して緑を確認:

| 項目 | コマンド | 結果 |
|---|---|---|
| typecheck | `pnpm --filter @private-2d-rigging-lab/runtime-player run typecheck` | exit 0（エラー0） |
| focused Vitest | `pnpm --filter …/runtime-player exec vitest run -c vitest.config.ts src/main/live-mapping` | 4 files / **38 passed** / 0 failed（estimator 10・runtime-parameter-frame 19・auto-mapping 3・live-mapping-state 6） |

全体 `test:unit` の 2 fail は browser-source ドメイン（`broadcast-source/browser-source-server.test.ts`・`stage/browser-source/browser-source-server-message.test.ts`）で **pre-existing**（本 Wave 前から存在・live-mapping 無関係）。`git diff --stat` で本 Wave 差分が live-mapping 4 ファイルのみであることを裏取り済み。`pnpm install` は未実行。

変更スコープ: `apps/runtime-player/src/main/live-mapping/` の4ファイル（`vowel-lipsync-estimator.ts` + test, `runtime-parameter-frame.ts` + test）のみ。editor / packages 不変。

## 5. publish 挙動変化の記録

cp17 解除に伴う出力契約変化（設計 §2.6 の意図通り）:

- **リップシンク有効・ゲート開**: 5母音 `param_mouth_vowel_*` を**毎フレーム発行**（softmax は厳密に非0）。mouth_open = s。
- **リップシンク有効・ゲート閉/中立**: s=0 で全母音を**有限値0**で発行（旧 argmax の敗者 null＝未発行から変化）。mouth_open = 0（口閉じ）。
- **リップシンク無効/非対応**: 従来どおり母音 parameterId 未発行、mouth_open は jawOpen フォールバック駆動。

VowelEstimate は `{ winner, weight }` → `{ s, weightByVowel }` へ拡張。正規化（softmax → per-母音 strength 前段 bias → 正規化）は estimator に集約され、写像層は `weightByVowel[v]` を読み `s × 重み` を出すのみ。

## 6. docs / maps alignment 実施内容

実装事実と食い違う箇所のみ更新（規約 §3 Non-Goal: 未合意の新設計は決めない）:

- `discussion/design/vowel-lipsync-shape-blend.md`: Status **Draft → Implemented**（wave23 / source・tests complete / clean review pass。実機ユーザー gate 待ち）。実装レポート/Domain A レポート/クリーンレビューのパス追記。実装確定事実（`VowelEstimate={s, weightByVowel}`・正規化を estimator に集約・publish 挙動）を反映。
- `discussion/design/vowel-lipsync-mapping.md`: cp17 が wave23 で解除された旨の最小追記（shape-blend への後続リンク付き）。
- `discussion/design/vowel-lipsync-mouth-open-coupling.md`: mouth_open が w → s へ一般化された旨の最小逆リンク。
- `discussion/design/_map.md`: shape-blend 行 Status を Implemented / 実機 gate 待ちへ。
- `discussion/runtime-player/implementation/_map.md`: wave23 orchestration 行 Status 更新（Domain A pass / final integration complete (clean review pass); 実機ユーザー gate 待ち）+ waves/reviews に domain report・final report・domain review・clean review の4行追加 + §4 Current Implementation State に wave23 事実（cp17 解除・正規化集約・strength 一度・publish 挙動・検証・実機 gate）を追記。
- `discussion/runtime-player/_map.md`: 母音リップシンク挙動の記述なし → 矛盾なし → 未変更。

## 7. 残課題 / 次の関門

- **実機ユーザー gate が次の関門**（設計 §5 検証2 / 計画 §7 手動ユーザー gate）。実機で (a) 母音切替のパチつき解消・滑らかな接続、(b) え寄生が実発話でも benign、(c) う のジッタで口が暴れないか（→ 後続波候補(B)時間平滑化の要否）をユーザー目視。
- 保留（Out of Scope・実機観測後に判断）: (B) 時間平滑化、(B') 鋭さ τ ユーザーツマミ、(a) jawOpen 味付け second term、え寄生対策（top-k / 次元重み / ゲート）、s・重みのカーブ整形。
- コミットは未実施（ユーザー判断）。working tree の既存未コミット変更（`_map.md` 群等）はそのまま。

## 8. 申し送り（軽微・実機前提下で無害）

- **未マップ母音スロットの strength 既定=1**: `collectVowelStrengths` は enabled かつ target を持つ母音スロットの strength を採り、存在しない母音は strength=1。設計は「supported ⇒ 5母音すべて解決」前提で、実運用（vowelLipsyncSupported=true）は全5スロット存在のため runtime 差ゼロ。部分マップは非対応構成であり benign（clean review も minor 判定・要エスカレーションなし）。
