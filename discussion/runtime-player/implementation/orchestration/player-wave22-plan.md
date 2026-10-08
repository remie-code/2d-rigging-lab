# Runtime Player Wave 22 Plan: Vowel Lipsync Mouth-Open Coupling v0

> Objective: 母音リップシンク有効時、`param_mouth_open` を生 jawOpen ではなく発話強度 w で駆動し、「開き切り前提」で描かれた母音の形が成立する箱を用意する。無効/非対応時は jawOpen 駆動を温存。第一増分として平滑化・jawOpen 味付け・カーブは入れず、最小構成で実機観測に載せる。

## 1. Status

- Status: Ready to launch（設計合意 2026-07-08 / 棚卸し完了）。
- Planning gate: inventory then plan（実施済み。文脈健全・設計前提をコード接地済み）。
- Inventory result: source blocker none。推定器 `weight`（勝者 w）は既存返り値。差し込み口は同一スコープで配線可能。
- Source of truth（実装前に読む）:
  - 設計: [vowel-lipsync-mouth-open-coupling.md](../../../design/vowel-lipsync-mouth-open-coupling.md)
  - 前身設計: [vowel-lipsync-mapping.md](../../../design/vowel-lipsync-mapping.md)（Implemented, wave107）
  - 実測一次データ: `test_data/iFaceMocap/vowels/vowel-captures.json`

## 2. Product Goal

現状、リップシンク有効でも `param_mouth_open` は生 jawOpen だけで駆動され、母音の形（開き切り前提）とは無相関に動く。「い」（jawOpen≈.11）で箱が閉じたまま母音の形をフル適用するため、閉じ母音で過剰に閉じ、母音切替（特に「あ」への出入り）で強い断絶が出る。

Wave22 は、リップシンク有効時に**箱の開きを母音の作り込み（w）に結合**し、この断絶の構造要因を取り除く。第一増分は最小構成に留め、残差・平滑化・カーブといった上乗せは実機観測後に判断する。

## 3. Accepted Decisions

設計文書 [vowel-lipsync-mouth-open-coupling.md](../../../design/vowel-lipsync-mouth-open-coupling.md) の合意をそのまま実装契約とする。

### 3.1 mouth_open の意味の再定義

`param_mouth_open` は「見た目の開き量」ではなく「**母音の形が成立する箱の開き**」。閉じ母音でも箱は開け、母音の形がそれを絞り戻す。

### 3.2 駆動信号の差し替え（リップシンク有効時）

- **有効かつ supported**: mouth-open スロットの activation = **勝者母音の強度 w**（`VowelEstimate.weight`）。
- **無効 / 非対応**: 現行どおり `readRangeActivation(jawOpen, …)`（フォールバック温存）。
- 有効かつゲート閉/勝者なし（`weight = 0` / `winner = null`）: activation = 0（箱は閉じる。自然挙動）。
- per-slot strength は従来どおり効く（`createWeightValue`）。

### 3.3 不変条件

- **推定器本体（`vowel-lipsync-estimator.ts`）は変更しない**。`weight` は既存返り値をそのまま読むだけ。
- **リグ契約「単一 Vowel 非ゼロ」（cp17）は不変**。母音出力は勝者のみ非ゼロの離散のまま。mouth-open に流すのも同じ勝者 w。

### 3.4 本波では入れない（設計判断による留保）

- 母音切替時の w 段差に対する**時間平滑化（B）**。
- jawOpen を「基準より余分に開けた分」として足す**second term / 味付け（a）**。
- mouth_open へ w を入れる際の**カーブ整形**。

これらは実機観測（§9 手動 gate）の結果を見てから、必要なら後続波で設計する。

## 4. Wave Strategy

変更面が極小（実質 mouth-open スロット評価 1 箇所 + 配線）のため、**単一実装ドメイン + 締め**とする。wave8 型の A/B/C 並列は用いない。

| Batch | Domain | Work | Notes |
|---|---|---|---|
| 1 | Domain A | mouth-open の w 駆動 + トグル分岐 + focused tests | 単一 Orch-Sylph。実装は Gnome、レビューは Review-Sylph（3レーン） |
| 2 | Final Integration | 回帰確認 + docs/maps alignment + clean review | Domain A pass 後。設計文書 Status 更新・逆リンク・runtime-player マップ更新・wave22 report/review 出力 |

## 5. Domain A: Mouth-Open Vowel Coupling

推奨サブエージェント名:

```text
runtime-player-wave22-vowel-lipsync-mouth-open-coupling
```

### Scope

リップシンク有効時、mouth-open スロットの activation を勝者 w に切り替える。無効/非対応時は現行 jawOpen 駆動を保つ。

### Primary Files / Areas（棚卸し事実に基づく）

- `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`
  - mouth-open 評価: `sourceKind:"mouth-open"` case（L156-164 付近）。
  - 母音推定メモ化クロージャ `readVowelEstimate`（L53-68 付近）。
  - `readVowelEstimate` を渡す条件（現状 `mouth-vowel` のみ、L92-94 付近の条件付きスプレッド）を mouth-open にも広げる。
  - `createSlotParameterValue` は既に `readVowelEstimate?` を optional で受ける（L124-132 付近）。
  - リップシンク有効フラグ（`isVowelLipsyncEnabled()`）は `createRuntimeParameterFrame` に既に渡っている。
- `apps/runtime-player/src/main/live-mapping/vowel-lipsync-estimator.ts` — **参照のみ。変更しない**（`weight` を読む）。
- focused tests: `apps/runtime-player/src/main/live-mapping/**`

### Required Behavior

- リップシンク有効 + supported のとき、mouth-open の activation = メモ化した母音推定の勝者 `weight`。
- 無効 / 非対応のとき、mouth-open の activation = `readRangeActivation(jawOpen, …)`（現行）。
- 有効 + ゲート閉 / `winner=null` のとき、activation = 0。
- per-slot strength・clamp（target.min/max）は従来経路を維持。
- 平滑化・jawOpen 味付け・カーブは**加えない**（§3.4）。
- リグ契約・母音分類・トグル挙動・body 系スロットに回帰を出さない。

### Tests（最低限）

- 有効時: 各母音で mouth-open activation が勝者 w に追従する。特に「い」（低 jawOpen）でも w により箱が開くこと。
- 無効 / 非対応時: mouth-open が jawOpen 正規化にフォールバックする（回帰）。
- 有効 + 中立/ゲート閉: mouth-open activation = 0。
- 勝者交代: mouth-open が新勝者の w に追従する。
- mouth-vowel スロット・body 系スロットの既存挙動に影響がない。
- `pnpm install` を実行しない。

## 6. Final Integration + Docs Alignment

Domain A pass 後に実施。

- 共有ファイル `runtime-parameter-frame.ts` の変更を最終確認し、母音分類・トグル・body follow に回帰がないこと。
- Runtime Player typecheck + focused Vitest + source-organization / dependency guard。
- Docs/maps alignment（実装事実と食い違う箇所のみ）:
  - [vowel-lipsync-mouth-open-coupling.md](../../../design/vowel-lipsync-mouth-open-coupling.md) の Status を実装事実へ更新（未実装 → 実装済み / 実機ユーザー gate 待ち）。
  - [vowel-lipsync-mapping.md](../../../design/vowel-lipsync-mapping.md) に mouth-open 駆動の後続を示す逆リンクを追記（Implemented 文書への最小追記）。
  - runtime-player 実装マップ・design マップの該当行更新。
  - wave22 report / review を出力:
    - `discussion/runtime-player/implementation/waves/wave22/`
    - `discussion/runtime-player/implementation/reviews/wave22/`
- Non-Goal: 未合意の新 UX / 新設計をここで決めない（[runtime-player-wave-planning-conventions.md](runtime-player-wave-planning-conventions.md) §3）。

## 7. Acceptance Criteria

- リップシンク有効時、`param_mouth_open` が勝者 w で駆動される。
- 「い・う・え」で、生 jawOpen の低さに由来する過剰な閉じが解消し、母音の形が箱と噛み合う。
- 「あ」は w↑で箱が開く（vowel_a が無効でも破綻しない）。
- リップシンク無効 / 非対応モデルで、mouth-open が従来どおり jawOpen 駆動で動く。
- 平滑化・jawOpen 味付け・カーブは追加されていない。
- リグ契約「単一 Vowel 非ゼロ」が保たれている。
- 推定器本体に変更がない。
- Runtime Player typecheck / focused Vitest / guard 群がパスする。
- **手動ユーザー gate**: 実機 iFacialMocap + 実モデルで、(a) 閉じ母音の過剰閉じ / 母音切替の断絶が改善するか、(b) 平滑化なしで w 段差が認知的に許容範囲か、をユーザー目視。→ 後続波（B/a）の要否判断材料。

## 8. Verification Matrix

| Area | Verification |
|---|---|
| Enabled w-driving | mouth-open スロット単体テスト（各母音 / い の低 jawOpen ケース）。 |
| Disabled fallback | 無効/非対応で jawOpen 正規化に戻る回帰テスト。 |
| Gate closed | 中立/ゲート閉で mouth-open 0 のテスト。 |
| Winner switch | 勝者交代で mouth-open が追従するテスト。 |
| No regression | 母音分類・トグル・body follow の既存テスト維持。typecheck / guard。 |
| Manual | 実機 iFacialMocap + 実モデルで断絶改善と w 段差の認知評価（ユーザー gate）。 |

## 9. Subagent Contract

- `pnpm install` を実行しない（インストールはユーザーが行う）。
- 実装は Runtime Player 内にスコープする。
- **推定器 `vowel-lipsync-estimator.ts` の内部ロジックを変更しない**（`weight` を読むのみ）。
- **平滑化 / jawOpen second term / カーブ整形を実装しない**（本波 Out of Scope）。
- **リグ契約「単一 Vowel 非ゼロ」を変えない**。母音出力は離散のまま。
- 母音分類・ヒステリシス・ゲート・キャリブレーション経路を変更しない。
- 共有ファイルに触れる場合は最小変更に留め、domain report に記録する。
- 無関係・並行の変更を revert しない。
- 決定論的挙動に focused test を付ける。

## 10. Review Policy

各実装ドメインに通常の3レーン:

- spec compliance
- design / development compliance
- test adequacy

Final Integration で clean final review を行う（Domain A 完了後）。

## 11. Orchestration Policy

Implementation Orchestration skill に従う。

Root / Undine:

- wave plan・ユーザー判断・依存グラフ・最終判定を保持する。
- Wave22 の source 変更を自分で実装しない。
- 起動した全 subagent を待つ。wait timeout は polling として扱う。実行中の子を close しない。

Orch-Sylph:

- 単一ドメインループを保持する。
- bounded な現状確認から始める。
- 実装は Gnome、レビューは Review-Sylph に委譲する（自身は実装しない。分離できなければ escalate / blocked）。
- Gnome と全 Review-Sylph を待つ。完了した子を close する。
- ドメイン判定と証跡を報告する。

親は、子が未完・実行中・未解決の間は wave gate を通さない。

## 12. Out of Scope

- 母音切替 w 段差の時間平滑化（後続波候補 B）。
- jawOpen「余分な開き」second term（後続波候補 a）。
- mouth_open への w のカーブ整形。
- 推定器の次元重み / ゲート閾値 / ヒステリシスの再調整。
- キャリブレーション経路・母音参照の変更。
- editor 側 / packages 側の変更。
