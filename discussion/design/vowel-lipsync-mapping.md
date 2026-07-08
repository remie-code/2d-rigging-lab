# 母音リップシンク設計 — 写像層の nearest-reference 推定スロット

> Status: **Implemented**（wave107 final complete / clean review pass。実機ユーザー gate 待ち → §5 検証2）。2026-07-06 ユーザー承認「dynamicsと同じ流れだ」。承認時の追加要件 = リップシンクの ON/OFF トグル → §3.2。細部の初期値は実装 wave で実測から導出。実装レポート: `../implementation/waves/wave107/wave107-final-integration-report.md` / クリーンレビュー: `../implementation/reviews/wave107/final-clean-review.md`
> 後続（mouth-open 駆動）: `param_mouth_open` の駆動元は wave22 で生 jawOpen → 発話強度 w へ差し替えられた（リップシンク有効時のみ。無効/非対応は本文どおり jawOpen 駆動を温存）。後続設計と実装事実は [vowel-lipsync-mouth-open-coupling.md](vowel-lipsync-mouth-open-coupling.md)（Implemented, wave22）を参照。本文の設計判断は不変。
> 調査事実: [research/player-ifacialmocap-survey.md](../model-authoring/research/player-ifacialmocap-survey.md) / [player-calibration-survey.md](../model-authoring/research/player-calibration-survey.md) / [player-mapping-strength-survey.md](../model-authoring/research/player-mapping-strength-survey.md)
> 実測一次データ: `test_data/iFaceMocap/vowels/vowel-captures.json`（2026-07-06、ユーザー本人の発音を各ラベル約90フレーム窓平均。採取ツール: `apps/runtime-player/tools/capture-vowel-frames.ts`）

## 1. 問題

エクスポート済みモデルは `param_mouth_vowel_a/i/u/e/o`（リグ契約: **単一の Vowel が非ゼロ**、cp17）を持つが、player のライブトラッキングで母音変形が動かない。

- iFacialMocap は ARKit 52 blendshape の生値のみを送る。**母音フィールドは規格上も実測上も存在しない**
- 断絶点は**写像層ただ一箇所**: `semanticSlotDefinitions`（11 スロット固定）に母音スロットが無い。評価系は parameterId→値 の辞書を汎用適用するため、写像層が母音 parameterId を出しさえすれば下流は全部通る

## 2. 方式原理: 分類と強度の2段分解

母音推定は次の2段に分解する。

1. **分類**（どの母音か）: 離散判定。参照ベクトルへの**最近傍**（argmax）
2. **強度**（どれだけ深く出すか）: 連続スカラー w ∈ 0..1

この分解が既存機構と噛み合う: 分類は strength の調整対象ではなく（「い」を半分「う」にする操作は無意味）、強度は純粋な1次元で、既存の per-slot strength（0..2、`default + (target−default)×strength`）がそのまま「各母音の効き幅」として掛かる。

### 2.1 特徴ベクトル

口系 blendshape ~8次元の**中立参照との差分** Δ:

`jawOpen / mouthFunnel / mouthPucker / mouthClose / mouthSmile(L/R平均) / mouthStretch(L/R平均) / mouthLowerDown(L/R平均) / mouthUpperUp(L/R平均)`

### 2.2 分類 = 重み付き距離の最近傍（cos 類似は不可）

実測（2026-07-06 キャプチャ）が方式を確定させた:

- **「え」は「あ」の縮小版**——差分ベクトルの向きがほぼ同一で、大きさだけが違う。向きのみ（cos 類似）の分類は原理的に不可能。**参照点への距離**（方向+大きさ）で分類する
- 参照点 = 中立 + 5母音の6ベクトル（キャリブレーション由来。無ければ既定値 = 上記実測 JSON をバンドル）
- 実測の母音署名: あ=大開口（jawOpen +.56）/ い=smile 正+すぼめゼロ / う=funnel +.45・pucker +.36 / え=あの縮小 / お=中開口+丸め（mouthClose +.17）

### 2.3 強度・ゲート・ヒステリシス

- 強度: `w = d(Δ, 中立) / (d(Δ, 中立) + d(Δ, 最近傍母音))` を 0..1 へリマップ。中立近傍で 0、参照近傍で 1 に漸近——リグ側の weight 0..1 と遷移の滑らかさに一致
- ゲート: 活動量が閾値未満（口がほぼ中立）なら全母音 0
- ヒステリシス: 勝者の交代には「マージン付き優位 + 連続 N フレーム」を要求。**実測根拠**: 「う」の保持中に mouthFunnel が窓内 0.40 幅で暴れた——ARKit は う の口形で pucker/funnel 間を揺れる。生 argmax はちらつく
- 推定器の状態（現勝者・持続カウンタ）は body 系スムージング（bodyFollowState）と同じ per-frame 状態の先例に倣って保持

## 3. スロット設計: 5独立スロット + 上流の共有推定器（1:1 機構を変えない）

調査事実: 現行機構は**厳密に 1 スロット = 1 parameterId**（型・評価ループとも）。「1推定器→5パラメータ」の複数ターゲット機構を新設するのは 1:1 前提の作り替えになる。

採用案: **5つの独立 weight スロット** `mouth-vowel-a/i/u/e/o`（group=mouth、mouth-open と同型）。

- 既存経路にそのまま乗る: strength スライダ・モデル単位 mapping プロファイル保存・Semantic Slots パネルへの**自動列挙**（定義表に足せば UI に出る。group=mouth は既存4グループ内）
- **相互排他は上流で担保**: `createRuntimeParameterFrame` がフレームごとに推定器を**1回だけ**実行してメモ化し、各母音スロットの評価 case は「勝者が自分なら w、他は 0」を読むだけ。スロット独立評価の形式を保ったまま、リグ契約「単一 Vowel 非ゼロ」が構造で出る
- strength 意味論: 母音 preset は default=0 なので `0 + (w−0)×strength = w×strength`。ユーザーは母音ごとに効き幅を調整（0 でその母音を無効化）できる

### 3.2 リップシンクの ON/OFF トグル（2026-07-06 ユーザー要件）

- Player 上で「口の開閉のみ」⇄「開閉 + 母音リップシンク」を**単一トグル**で切替できること（母音まで rigging されたモデルは一般的でないため、機能として明示的に有効/無効を選べるのが望ましい——ユーザー要件の原文旨）
- OFF の意味論: 母音スロットは parameterValues に母音 parameterId を**載せない**（0 を出すのではなく不発行——authored 既定値 0 と等価で、mouth-open のみの世界へ完全に戻る）。推定器も短絡してコストゼロ
- 既定値: モデルが母音ターゲットを解決できた場合は ON（rigging 済みモデルは箱出しで動く）。設定は**モデル単位 mapping プロファイル**へ optional フィールドで永続化
- 置き場: Mapping ページ mouth グループ近傍（最終位置は実装 wave で判断）

## 4. キャリブレーション統合

母音参照は**ユーザーの顔の属性**（モデルの属性ではない）→ 入力ソース単位の `InputProfile.calibration`（`input-profiles/ifacialmocap/profiles.json`）に新セクションを足すのが正しい置き場。モデル単位の mapping プロファイル（strength の置き場）とは粒度が違う点に注意。

- スキーマ: `calibration.vowels` には**生の blendshape 平均ベクトル（全次元）+ 採取メタ（フレーム数。時間窓長は optional——player 本体の採取は Record 押下ベースのフレーム数窓であり時間窓ではない: wave107 Domain B 実装形）**を保存する（wave107 Domain A→B シーム裁定 2026-07-06: 実測一次データを残せば、推定器の次元選定・重みを将来変えても再較正不要）。推定器が消費する8次元縮約 `references`（Domain A 確定型）への変換は、キャリブレーションが写像層へ渡る**境界のアダプタ**が担う——live-mapping 側の型・参照解決は変えない（追随1行まで可）。**optional 追加を優先し可能なら schemaVersion 据え置き**（現 "v1"、多版マイグレーション未実装のため追加的変更が安全。据え置き不能な変更が要るなら前進手順込みで設計）
- 採取フロー: 既存の prompt 駆動ウィザードに**母音セクション**を追加（中立→あ→い→う→え→お）。ただし現ウィザードに**窓平均採取が無い**（単一フレーム/手動サンプルのみ）——`capture-vowel-frames.ts` の `summarizeSamples`（窓収集+平均+min/max）を player 本体へ移植する
- 既定参照値: 実測 JSON をバンドルし、較正未実施ユーザーのフォールバックにする
- キャプチャツールの位置付け: 本機能実装までの暫定手段 + 開発時の参照データ採取手段として維持

## 5. 検証

1. **オフライン再生テスト**: キャプチャ済み各ラベルの mean 点（+min/max の角点）を推定器に食わせ、ラベル一致を assert する決定論テスト。う の窓内揺れの端点が う に分類され続けることをヒステリシス込みで確認
2. **実機 gate**: player ライブで母音発話——切替の追従・ちらつき無し・口閉じ時の母音ゼロ・strength スライダの効きをユーザー目視

## 6. 実装範囲（調査済みの変更面）

| 層 | ファイル | 変更 |
|---|---|---|
| スロット定義 | `apps/runtime-player/src/main/live-mapping/semantic-slot-definitions.ts` | mouth-vowel-a..o の5定義追加（targetAliases = mouth.vowel.*） |
| 評価 | `apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts` | 共有推定器（メモ化+状態）+ sourceKind case 5本 |
| 推定器本体 | 新規（live-mapping 配下） | 特徴抽出・重み付き距離・argmax・ヒステリシス・ゲート。純関数+状態オブジェクトで単体テスト可能に |
| キャリブレーション | `input-profile-document.ts`・ウィザード・関連 UI/IPC | vowels セクション・窓平均採取・schemaVersion 前進 |
| 既定参照 | 同梱データ | 実測 JSON 由来の既定参照ベクトル |
| トグル | mapping プロファイル（optional フィールド）+ Mapping ページ UI | リップシンク ON/OFF（§3.2） |

## 7. 未決（実装 wave で裁定）

- 距離の次元重み・ゲート閾値・ヒステリシスのマージン/フレーム数の初期値（実測 JSON から導出し、決め打ちにせず調整可能な定数に）
- sessionNeutral（Look Forward）が母音推定の中立参照を差し替えるか（既存口系は sessionNeutral が min を差し替える規則。既定は「較正の中立を使用」とし、整合は実装時に判断）
- オフライン検証の解像度を上げる場合、キャプチャツールに全フレームダンプ（`--dump-frames`）を足して再採取
