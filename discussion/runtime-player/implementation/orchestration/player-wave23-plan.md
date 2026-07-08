# Runtime Player Wave 23 Plan: Vowel Lipsync Shape Blend v0

> Objective: 母音リップシンクを単一勝者(argmax)から「合計≈1 の正規化凸ブレンド」へ拡張し、母音切替時の"形"のパチつきを解消する。cp17「単一 Vowel 非ゼロ」を意図的に解除。Wave22 の `mouth_open = 勝者 w` を `mouth_open = ブレンド強度 s` へ一般化。第一増分は固定 τ・素の softmax（平滑化・鋭さツマミ・jawOpen 味付けは Out of Scope）。

## 1. Status

- Status: Ready to launch（設計合意 2026-07-08 / 棚卸し完了）。
- Planning gate: inventory then plan（実施済み。推定器・写像層をコード接地）。
- Inventory result（要点）: **B（正規化ベクトルを各スロットが読む）は既存メモ化経路に素直に載る。C（strength を正規化前段へ集約）が現構造と非整合で本波の主コスト。A（推定器）は局所。D（mouth-open）は一点差し替え。**
- Source of truth（実装前に読む）:
  - 設計: [vowel-lipsync-shape-blend.md](../../../design/vowel-lipsync-shape-blend.md)
  - 前身: [vowel-lipsync-mouth-open-coupling.md](../../../design/vowel-lipsync-mouth-open-coupling.md)（Wave22）/ [vowel-lipsync-mapping.md](../../../design/vowel-lipsync-mapping.md)（cp17 の出所）
  - 本 Wave の棚卸し（このプランの §3/§5 に反映済み）
  - 実測データ: `test_data/iFaceMocap/vowels/vowel-captures.json`

## 2. Product Goal

Wave22 で口の開きが直り、隠れていた"形"のパチつきが可視化された。その正体は cp17（単一勝者では形の連続受け渡しが構造的に不可能）。ユーザーがリグの重ね合わせ耐性を実機確認済み（合計≈1 の凸ブレンドで破綻しない）。

Wave23 は cp17 を解除し、母音を正規化凸ブレンドで同時出力して、切替を連続化する。第一増分は最小構成（固定 τ・素の softmax）で実機観測に載せ、平滑化・鋭さツマミ等は観測後に判断する。

## 3. Accepted Decisions

設計文書 [vowel-lipsync-shape-blend.md](../../../design/vowel-lipsync-shape-blend.md) をそのまま実装契約とする。パイプライン:

```
距離 d_v →[softmax raw_v=exp(−d_v/τ)]→[×strength_v]→[÷Σ_j(raw_j×strength_j)]→ 正規化重み_v →[×s]→ param_mouth_vowel_v ,  mouth_open = s
```

### 3.1 中核の設計判断

- **cp17 解除**: 母音は「勝者のみ非ゼロ」→「各母音に `s × 正規化重み`」。
- **① softmax**: `raw_v = exp(−d_v/τ)`。`d_v` = `weightedDistance`（現状次元重み全1）。
- **τ**: `k × (較正済み参照の母音間距離 中央値)`、**k = 0.30**（レンジ 0.25〜0.35、実値≈0.13〜0.18）。素の softmax（top-k・次元重み手術・え ゲートは入れない。え寄生は目視 benign 確定）。
- **② strength = 正規化前段の per-母音 bias**: `raw_v × strength_v` を Σ で割る。`strength_v=0` でその母音を外す。
- **④ 強度 s**: `s = activity / (activity + d_min)`。`d_min` = **生 argmax 最近傍距離**。`mouth_open = s`、各母音 = `s × 正規化重み`。
- **ヒステリシス撤去**（連続ブレンドで離散勝者が消え役目喪失）。**ゲート（`activity < vowelGateActivityThreshold=0.15`）は維持** → s=0 で口閉じ。
- **後方互換**: τ→0 で argmax + `s=w` となり Wave22（単一勝者 + mouth_open=w）に一致。

### 3.2 棚卸し由来の不変条件（invariant・実装が守ること）

- **【C の核心】strength を二重適用しない**: strength は正規化前段（`raw_v×strength_v`）で一度だけ掛ける。現状の末端適用（`createWeightValue` の `slot.strength` 乗算, `runtime-parameter-frame.ts:344`）を**母音スロットに対しては迂回/無効化**し、二重適用を避ける。機構（末端乗算の迂回 vs 母音用の値生成関数を新設）は実装裁量。
- **【s の分母】`d_min` = 生 argmax 最近傍距離**（`scoreVowels` が既に算出、estimator :247 の `winnerDistance`）。ヒステリシス勝者距離ではない（現 `computeIntensity` に渡す第2引数を差し替える）。
- **【τ は毎フレーム再計算しない】** 母音間距離中央値は参照ベクトル（`defaultVowelReferenceVectors` / 較正参照）から `weightedDistance`・`subtract` で導出可能。**参照が確定/変更された時点で1回計算しキャッシュ**する。保持点（estimator の状態フィールド `RuntimePlayerVowelLipsyncState` を、撤去したヒステリシス状態の代わりに τ キャッシュ保持に転用する等）は実装裁量。
- **正規化ベクトルはフレーム1回**: 既存 `readVowelEstimate` メモ化（`runtime-parameter-frame.ts:53-68`）を型拡張し、各母音スロットが自分の分を読む（配線新設不要）。

## 4. Wave Strategy

母音推定器と写像層は `VowelEstimate` 型で密結合し、いずれも `live-mapping/` 内（2ソース + テスト）。分割すると硬い interface 依存で逐次化し統合摩擦が増すだけ。→ **単一実装ドメイン + 締め**とする。

| Batch | Domain | Work |
|---|---|---|
| 1 | Domain A | 推定器の重みベクトル/`s` 露出・ヒステリシス撤去・τ 導出 ＋ 写像層のブレンド配分・strength 前段集約・mouth-open=s。focused tests。 |
| 2 | Final Integration | 回帰確認 + docs/maps alignment + clean review。 |

## 5. Domain A: Vowel Shape Blend（estimator + mapping）

推奨サブエージェント名:

```text
runtime-player-wave23-vowel-shape-blend
```

### Primary Files / Areas（棚卸し事実）

- `apps/runtime-player/src/main/live-mapping/vowel-lipsync-estimator.ts`
  - `scoreVowels()`（:233-259）が `distanceByVowel`（:238-244）・`activity`（:256）・生 argmax `winnerDistance`（:247）を既に算出。`estimate()`（:298-320）はこれらを破棄している。
  - `VowelEstimate`（:48-51 `{winner, weight}`）を **`{ s, weightByVowel: Record<VowelLabel, number> }`（正規化済み）** へ拡張（winner/weight は不要化 or 併存は実装裁量）。
  - softmax（`exp(−d_v/τ)`）→ 正規化を追加。ただし strength を掛ける合流点は §3.2 参照（strength は写像層が持つため、estimator と写像層のどちらで正規化前段の strength 乗算を行うかは配線設計。二重適用回避が必須）。
  - `computeIntensity`（:265-272）を `s`（分母 `d_min`）へ流用。
  - ヒステリシス（`updateConfirmedWinner` :322-363、状態 :280-282、定数 :106/:114）撤去。`RuntimePlayerVowelLipsyncState` は τ キャッシュ等の per-frame 状態保持に転用可（クラス自体は呼び出し側が `new` するため残す）。
  - ゲート短絡（:303-308）の骨格維持（s=0 相当を返す）。
  - τ 用中央値: 参照 Δ（`subtract(references.v, references.neutral)`）間の `weightedDistance` の median。参照は `estimate()` に毎フレーム渡る（写像層 :55-64）。
- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`
  - `readVowelEstimate` メモ化（:53-68）を型拡張。
  - `createVowelValue`（:347-371）: 「勝者なら値・他 null」（:363-365）→「`weightByVowel[vowelLabel]` を読み `s × 重み` を出力」。
  - **strength 前段集約**（§3.2 C）: 母音5スロットの `slot.strength` を正規化計算点で束ねる配線。末端 strength 乗算（`createWeightValue` :344）の母音経路での二重適用回避。
  - mouth-open（:157-180）: `estimate.weight`（:170）→ `estimate.s`。無効/非対応の jawOpen フォールバック枝（:172-180）は無改修。
  - トグル配線（:79-81 母音スロット評価スキップ、:92-95 `readVowelEstimate` 注入条件）は維持。
- focused tests: `apps/runtime-player/src/main/live-mapping/**`

### Required Behavior

- リップシンク有効時、5母音が `s × 正規化重み`（合計 s）で同時出力される（cp17 解除）。
- 各母音参照点で自母音優勢、隣接中点で滑らかな2〜3母音配分（え寄生は許容）。
- `mouth_open = s`。ゲート閉/中立で s=0（口閉じ）。
- per-母音 strength が正規化前段 bias として一度だけ効く（二重適用なし・strength=0 で当該母音除外）。
- τ は参照確定時1回計算・キャッシュ（毎フレーム再計算しない）。
- 無効/非対応で jawOpen フォールバック維持。
- τ→0 相当（十分小さい τ）で単一勝者 + mouth_open=w に収束（後方互換）。

### Tests（最低限）

- 各母音の参照 Δ を入力 → その母音の正規化重みが優勢・全母音合計≈1。
- 隣接中点入力 → 2〜3母音に配分（設計 §6 の数値傾向と整合、え混入を許容）。
- 中立/ゲート閉 → s=0・全母音≈0。
- per-母音 strength: ある母音 strength を上げると相対配分が増え合計≈1 維持、strength=0 で当該母音0（二重適用でないこと＝末端で再乗算されないことを pin）。
- mouth-open = s（各母音入力での s と一致）。
- 無効/非対応 → jawOpen フォールバック（回帰）。
- 十分小さい τ で単一勝者に収束（後方互換の回帰）。
- `pnpm install` を実行しない。

## 6. Final Integration + Docs Alignment

Domain A pass 後。

- Runtime Player typecheck + focused Vitest + source-organization / dependency guard。母音分類・トグル・body follow・mouth-vowel/mouth-open 経路に回帰なし。
- Docs/maps alignment（実装事実と食い違う箇所のみ）:
  - [vowel-lipsync-shape-blend.md](../../../design/vowel-lipsync-shape-blend.md): Status Draft → Implemented（wave23 / clean review pass）/ 実機ユーザー gate 待ち。実装レポート・レビューパス追記。
  - [vowel-lipsync-mapping.md](../../../design/vowel-lipsync-mapping.md): cp17 が wave23 で解除された旨の最小追記。
  - [vowel-lipsync-mouth-open-coupling.md](../../../design/vowel-lipsync-mouth-open-coupling.md): mouth_open=s へ一般化された旨の最小逆リンク。
  - design/_map・runtime-player 実装マップ更新、wave23 report/review 出力（`waves/wave23/`・`reviews/wave23/`）。

## 7. Acceptance Criteria

- 有効時、母音がブレンド出力され切替が連続化（形のパチつき解消）。
- `mouth_open = s`、各母音 = `s × 正規化重み`、合計≈s。
- per-母音 strength が正規化前段 bias として一度だけ効く（二重適用なし）。
- τ は参照確定時1回・キャッシュ。
- ゲート閉で口閉じ。無効/非対応で jawOpen フォールバック。
- 小 τ で Wave22（単一勝者 + mouth_open=w）に収束。
- typecheck / focused Vitest / guard パス。
- **手動ユーザー gate**: 実機で (a) 切替のパチつき解消 (b) え寄生が実発話でも benign (c) う のジッタで暴れないか（→(B)平滑化の要否）を目視。

## 8. Verification Matrix

| Area | Verification |
|---|---|
| Blend 配分 | 参照点/中点入力での重み分布テスト（設計 §6 傾向と整合）。 |
| strength bias | strength 変更で配分変化・合計≈1・二重適用なしのテスト。 |
| Intensity s | 各母音での s と mouth-open 一致テスト。 |
| Gate/fallback | 中立 s=0、無効/非対応 jawOpen 回帰テスト。 |
| 後方互換 | 小 τ で単一勝者収束テスト。 |
| No regression | 母音分類・トグル・body follow・typecheck・guard。 |
| Manual | 実機で切替連続化・え benign・う ジッタをユーザー目視。 |

## 9. Subagent Contract

- `pnpm install` を実行しない。実装は `live-mapping/` にスコープ。editor / packages を触らない。
- **strength を二重適用しない**（正規化前段で一度だけ。末端乗算の母音経路迂回）。
- **τ を毎フレーム再計算しない**（参照確定時キャッシュ）。
- **s の分母は生 argmax 最近傍 `d_min`**（ヒステリシス勝者距離ではない）。
- **本波で入れない**: 時間平滑化 / 鋭さ τ のユーザーツマミ / jawOpen 味付け second term / top-k・次元重み・え ゲート / カーブ整形。
- 無効/非対応の jawOpen フォールバック・トグル挙動・キャリブレーション経路を壊さない。
- 共有ファイルの変更は最小に留め domain report に記録。無関係・並行の変更を revert しない。決定論的挙動に focused test を付ける。

## 10. Review Policy

3レーン（spec compliance / design-development compliance / test adequacy）。Final Integration で clean final review。

## 11. Orchestration Policy

Implementation Orchestration skill に従う。Root/Undine は wave plan・依存・最終判定を保持し Wave23 source を自分で実装しない。全 subagent を待ち、wait timeout は polling として扱い、実行中の子を close しない。Orch-Sylph は単一ドメインループを保持し、実装は Gnome・レビューは Review-Sylph に委譲（自身は実装しない。分離できねば escalate/blocked）。親は子が未完・実行中・未解決の間 wave gate を通さない。

## 12. Out of Scope

- 時間平滑化（後続波候補 B。う のジッタが実機で問題なら）。
- 鋭さ τ のユーザーツマミ（後続波候補 B'）。
- jawOpen「余分な開き」second term（後続波候補 a）。
- え寄生対策（top-k / 次元重み / ゲート）。目視 benign により本波不要、artifact 出現時の候補として保持。
- s / 重みのカーブ整形。
- キャリブレーション経路・母音参照の変更。次元重み `vowelDimensionWeights` の再調整。
- editor / packages 側の変更。
