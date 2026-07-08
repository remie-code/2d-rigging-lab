# 母音リップシンク時の口開き結合 — mouth-open を jawOpen 駆動から w 駆動へ

> Status: **Implemented**（wave22 / source・tests complete / clean review pass。第一増分＝最小構成。実機ユーザー gate 待ち → §5 検証1）。2026-07-08 ユーザーとの往復で方針合意。実装レポート: `../runtime-player/implementation/waves/wave22/wave22-final-integration-report.md` / Domain A レポート: `../runtime-player/implementation/waves/wave22/wave22-domain-a-mouth-open-vowel-coupling-report.md` / クリーンレビュー: `../runtime-player/implementation/reviews/wave22/wave22-final-clean-integration-review.md`
> 関係: [vowel-lipsync-mapping.md](vowel-lipsync-mapping.md)（Implemented, wave107）の後続。既存の §3.2 トグルと §2.3 強度 w を再利用し、`param_mouth_open` の駆動元だけを変える。リグ契約「単一 Vowel 非ゼロ」（cp17）は不変。
> 後続（mouth_open=s へ一般化）: wave23 で母音出力が単一勝者 → 正規化凸ブレンド化（cp17 解除）されたのに伴い、本設計の `mouth_open = 勝者 w` は **`mouth_open = ブレンド強度 s`** へ一般化された（τ→0 で s→w に収束し本設計と後方互換）。後続設計と実装事実は [vowel-lipsync-shape-blend.md](vowel-lipsync-shape-blend.md)（Implemented, wave23）を参照。本設計の「箱の開きを発話強度で駆動する」判断は不変。
> 実測一次データ: `test_data/iFaceMocap/vowels/vowel-captures.json`（母音別 jawOpen 平均: あ=.61 / い=.11 / う=.15 / え=.24 / お=.27 / neutral=.04）。

## 1. 問題（病巣）

母音リップシンク有効時、母音の切り替わり（特に「あ」への出入り）で口形に**強い断絶**が出る。「い・う・え・お」で口が過剰に閉じる／歪む。

### 1.1 リグの実際の作り（ユーザー authoring 事実）

- `param_mouth_open` は**口全体の開き**を動かす。**0 = ほぼ閉じ、1 = 「あ」の形**。
- 母音パラメータのポリシー = **「口を開き切った状態でその発音をしたときの形」**。ゆえに `param_mouth_vowel_a` は「開き切った＝あ」そのものなので**事実上何もしない**。`param_mouth_vowel_i` は「開き切った"い"が"あ"からどうズレるか」の差分（縦に狭める成分を含む）。
- 合成は**親子関係のデフォーマの重ね合わせ**（掛け算に近い像）。子（母音の形）は**親（mouth_open）が開いている前提**で描かれており、親が閉じていると子の変形が正しく成立しない。

### 1.2 現行の駆動（リポジトリ事実）

- `param_mouth_open` ← `readRangeActivation(jawOpen, …)`（`apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts` の `sourceKind:"mouth-open"` case, L156-164）。**jawOpen だけ**を見ており母音推定を一切参照しない。
- 母音パラメータ ← 勝者の強度 w（同ファイルの `mouth-vowel` case）。
- jawOpen は物理的に「あ」で最大（.61）・閉じ母音で小（い=.11）。よって現行 `param_mouth_open` は実質**「あ度メーター」**。

### 1.3 断絶の正体

母音の形は「開き切り前提」で定義されているのに、`mouth_open` は**別信号（生 jawOpen）**で駆動され、両者が食い違う。「い」を発話すると、分類は「い」→ vowel_i の形をフル適用する一方、jawOpen が .11 なので `mouth_open` は低い（箱が閉じ）。**「開き切り前提の形」を「開いていない箱」に貼るため歪む**。単純な"二重に閉じる"ではなく、**"形"と"開き"という噛み合うべき2チャンネルが、無相関な信号で駆動される不整合**が病巣。

（補足: 当初は「mouth_open を母音別基準 jawOpen からの残差にする」案を検討したが、**破棄**。この rig では開きは母音の形に入っておらず `mouth_open` が担うため、残差＝定常で mouth_open→0 は「あ」で口が閉じたままになり全壊する。§4 の設計判断で置換。）

## 2. 設計判断（採用方針）

### 2.1 `mouth_open` の意味の再定義

`param_mouth_open` は「見た目の開き量」ではなく、**「母音の形が成立する箱の開き」**として扱う。「い」を出すときも箱は開ける（親を開く）→ vowel_i がそれを「い」の形に絞り戻す。「い」の閉じた見た目は、低い mouth_open からではなく、**開いた箱に母音の形をかけて**作る。

### 2.2 駆動信号を jawOpen → 発話強度 w に差し替える

- 有効時、`param_mouth_open` の activation を**勝者母音の強度 w** で駆動する。箱と形が同じ w で噛み合う。
- w は既存 `VowelEstimate.weight`（`vowel-lipsync-estimator.ts` の `computeIntensity`, `w = activity / (activity + winnerDistance)`）。**推定器の返り値をそのまま使う**。
- w は**各母音の自前の参照点を基準に**正規化された「その母音をどれだけ作り込んだか」。完全な「い」は jawOpen .11 でも w≈1 になる。よって「い は顎が上がらない」問題を**推定器が既に吸収**しており、母音別基準の残差機構は不要。

### 2.3 トグルによる二択（既存 §3.2 の再利用）

母音リグを持つモデルは一般的でない（[vowel-lipsync-mapping.md](vowel-lipsync-mapping.md) §3.2）。既存の ON/OFF トグル（`isVowelLipsyncEnabled()` / `isVowelLipsyncSupported()`, `live-mapping-state.ts`）を再利用し、駆動を綺麗に二分する:

- **リップシンク有効** → `param_mouth_open` は **w 駆動**（本設計）。
- **無効／非対応** → `param_mouth_open` は **jawOpen 駆動のまま**（現行挙動をフォールバックとして温存。母音リグを持たないモデルは今までどおり口が動く）。

## 3. 第一増分（最小実装・実機観測用）

**仕様:** mouth-open スロット評価で、リップシンク有効時は勝者 w を activation にする。無効/非対応時は現行 `readRangeActivation(jawOpen, …)` のまま。**平滑化・残差・連続重みベクトルは入れない。**

- 変更面（リポジトリ事実に基づく見立て）:
  - `runtime-parameter-frame.ts`: `mouth-open` case に母音推定 `readVowelEstimate` を渡す（現状 `mouth-vowel` case にしか渡していない条件付きスプレッドを mouth-open にも広げる。両者は同一スコープでメモ化済み）。case 内で有効/無効の分岐。
  - **推定器本体（`vowel-lipsync-estimator.ts`）は変更不要**。`weight` は既存の返り値。
- リグ契約は不変: 母音出力は勝者のみ非ゼロの離散のまま。w は勝者の強度であり、mouth-open にも同じ w を流すだけ。

## 4. 実測で判断すること（未決 / 設計判断の留保）

- **(B) 平滑化**: w を mouth_open に流すと、母音切替時の w の段差を mouth_open も受ける。人間の認知にどれだけ障るかは**実機で見てから**判断し、必要になったら平滑化を足す（先行実装しない）。(A) 開き結合と (B) 平滑化は地続き（切替時の連続性という同じ根）である点に留意。
- **(a) jawOpen の味付け**: 有効時は w のみで十分という現判断。ただし w は「声の大きさ・顎の余分な開き」といった物理的強弱を落とす。物理的オーバー表現（力んで大きく開ける等）を残したくなったら、jawOpen を「基準より余分に開けた分」として箱に足す second term を再検討する。
- **カーブ**: `param_mouth_open` に w をそのまま入れるか、カーブさせて入れるか（箱を形より速く開ける等）はチューニング。第一増分では素直に w 直結。
- **w の生い立ち**: 現行 w はヒステリシス確定勝者に対して計算される（多少ラッチ入り）。連続量として mouth_open を駆動する際の癖として意識する。

## 5. 検証観点

1. **実機 gate**: リップシンク有効で「い・う・え・お」を発話し、(a) 過剰な閉じ／歪みが解消するか、(b) 「あ」への出入りの断絶が許容範囲に収まるか、(c) 平滑化なしで w の段差が認知的に障るか、をユーザー目視。
2. **フォールバック確認**: リップシンク無効／非対応モデルで、`param_mouth_open` が従来どおり jawOpen 駆動で動くこと。
3. 既存の母音分類・strength スライダ・トグルの挙動に回帰が無いこと（[vowel-lipsync-mapping.md](vowel-lipsync-mapping.md) §5 の資産を維持）。
