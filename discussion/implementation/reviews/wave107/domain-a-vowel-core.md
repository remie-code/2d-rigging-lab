# wave107 Domain A（母音リップシンク: 推定器コア）レビュー

- レビュー担当: Review-Sylph
- 呼び出し元: Orch-Sylph（wave107 Domain A `wave107-vowel-core`）
- 日付: 2026-07-06
- 設計オラクル: `discussion/design/vowel-lipsync-mapping.md`
- Gnome 報告: `discussion/implementation/waves/wave107/domain-a-gnome-report.md`

## 判定: 合格

設計 §2 / §3 / §3.2 のすべての観点で適合を裏取りできた。Required test 7 項目は非 vacuous に実装され green。typecheck green、母音関連テスト 35 件 green、write scope 遵守。要修正なし。

---

## 設計適合

### §2 方式（推定器コア）— 適合

`apps/runtime-player/src/main/live-mapping/vowel-lipsync-estimator.ts` を精読。

- **特徴 8 次元（§2.1）**: `VowelFeatureVector` が `jawOpen / mouthFunnel / mouthPucker / mouthClose / mouthSmile / mouthStretch / mouthLowerDown / mouthUpperUp` で完全一致。L/R は `averageShape` で平均化（§2.1「L/R 平均」に一致）。`extractVowelFeatureVector` が正しく各 blendshape を読み、欠損は 0（ARKit 非送出チャネルの扱いとして妥当）。
- **中立差分 Δ（§2.1）**: `scoreVowels` で `delta = subtract(features, references.neutral)`、各母音も `subtract(references.X, references.neutral)` で中立差分同士を比較。設計どおり。
- **重み付き距離の最近傍（§2.2、cos 類似不可）**: `weightedDistance` は重み付きユークリッド距離（`sqrt(Σ (Δ_a − Δ_b)² × weight²)`）。**方向 + 大きさ両方を見る距離であり cos 類似ではない**。設計 §2.2 の「え = あの縮小版を分離するため距離で分類」に正しく対応。Gnome の「0.5×a / 0.25×a が e に落ちる」検証（報告 §定数導出）は距離ベースの正しさの追認として妥当。argmax は `scoreVowels` 内のループで最小距離を勝者に。
- **強度 w（§2.3）**: `computeIntensity` = `activity / (activity + winnerDistance)`（`activity = d(Δ, neutral)`、`winnerDistance = d(Δ, 最近傍母音)`）を 0..1 clamp。設計式 `w = d(Δ,中立)/(d(Δ,中立)+d(Δ,最近傍母音))` と完全一致。母音 mean で w≈1（テストで >0.99 を確認）、中立で 0。
- **ゲート（§2.3）**: `scores.activity < vowelGateActivityThreshold (0.15)` で全母音抑制 + state クリア。設計の「活動量閾値未満で全母音 0」に一致。
- **ヒステリシス（§2.3）**: `updateConfirmedWinner` が「マージン付き優位（`currentWinnerDistance − challengerDistance >= margin 0.05`）+ 連続 N フレーム（`candidateStreak >= 3`）」を要求。state に `confirmedWinner`/`candidate`/`candidateStreak` を保持。設計 §2.3 の意図（現勝者・持続カウンタ、bodyFollowState と同型）に完全一致。ゲート下での confirmedWinner クリア（口を閉じたら再確定要求）は「口閉じ時 母音ゼロ」の意図に沿う妥当な裁量。

### §3 スロット設計 — 適合

- **5 独立 weight スロット**: `semantic-slot-definitions.ts` に `mouth-vowel-a/i/u/e/o` を group=mouth・targetAliases=`mouth.vowel.*`・sourceKind=`mouth-vowel`・vowelLabel 付きで追加。既存 mouth-open/smile と同型。
- **共有推定器のフレーム 1 回メモ化（§3 核）**: `runtime-parameter-frame.ts` の `readVowelEstimate` クロージャが `vowelEstimate === null` の時だけ `state.estimate` を実行し、以降はメモ結果を返す。5 スロットがこの 1 関数を共有。**スロットごとに推定器を回していないことを確認**。per-frame 状態 `vowelLipsyncState` は `bodyFollowState` と同様に `CreateRuntimeParameterFrameInput` へ注入・保持。
- **1:1 契約の不変**: `slot.target` は単数のまま、`parameterValues[slot.target.parameterId] = 値` の単一代入も不変。`createVowelValue` は「勝者が自分なら w を `createWeightValue` 経由、他は null（不発行）」を読むだけで、各スロットは独立評価の形式を維持。相互排他は上流 argmax（`estimate.winner !== vowelLabel → null`）で構造的に担保。リグ契約「単一 Vowel 非ゼロ」が構造で出る。
- **strength 経路（§3）**: `createVowelValue` は `createWeightValue({ slot, activation: estimate.weight })` を通す。母音 preset は default=0 なので `0 + (w−0)×strength = w×strength`。既存 strength 意味論をそのまま利用。

### §3.2 トグル — 適合

- **OFF 意味論（不発行 + 短絡）**: `runtime-parameter-frame.ts` L75 で `sourceKind === "mouth-vowel" && !vowelLipsyncEnabled` の時 `continue`。母音 parameterId は parameterValues に **載らない**（0 でなく不発行）。`continue` により `readVowelEstimate` に到達せず推定器も短絡。設計 §3.2 に完全一致。
- **既定 ON 判定**: `live-mapping-state.ts` の `isVowelLipsyncEnabled` は supported かつ override が null なら true（既定 ON）。`isVowelLipsyncSupported` は「mouth-vowel スロットのいずれかに target あり」で判定。設計 §3.2「母音ターゲット解決時 ON」に一致。
- **optional 永続化 + 旧プロファイル互換**: `ModelMappingProfileDocument.vowelLipsyncEnabled?` は optional、schemaVersion 据え置き（v1）。parser は `readOptionalBoolean` で欠損許容、欠損時は書かない。`createModelMappingProfileDocument`/`createMappingProfileSnapshot` は override が null の時 profile に書かない（クリーンさ維持）。復元時欠損は override=null（既定 ON）へ解決。旧プロファイルは無改変で読める。
- **IPC 配線**: 新チャネル `setVowelLipsyncEnabled` + ハンドラ + `readMappingVowelLipsyncUpdateRequest`（enabled boolean 検証）+ preload bridge + contract の別型 `RuntimePlayerMappingVowelLipsyncUpdateRequest`。未対応モデルは `unavailable` 返却、対応時は override 保存 + `vowelLipsyncState.reset()` + save schedule。`runtime-player-main.ts` で state 生成・注入、bodyFollowState.reset() 併設 5 箇所で `vowelLipsyncState.reset()` を追加（input reset / profile change / export clear × 3）。UI は Mouth グループ先頭に `VowelLipsyncToggle`（supported 時のみ表示）、control-window-app 経由で配線。

### 定数（named constant + 出自コメント）— 適合

`vowel-lipsync-estimator.ts` に全定数を named constant + 実測由来コメントで焼き込み（実行時 JSON 読取りなし）:
- `defaultVowelReferenceVectors`: JSON mean を 8 次元縮約してハードコード、出自コメント付き
- `vowelDimensionWeights` 全 1.0 / `vowelGateActivityThreshold` 0.15 / `vowelHysteresisMargin` 0.05 / `vowelHysteresisFrames` 3 — いずれもマジックナンバーでなく named constant、実測導出コメント付き

マジックナンバーは見当たらない。

---

## テスト適合（Required test 7 項目）

自分でファイルを精読し、vacuous でないことを確認した。

1. **キャプチャ再生（核）**— 適合。`vowel-lipsync-estimator.test.ts`「classifies each captured vowel mean...」が JSON を import し a→a/i→i/u→u/e→e/o→o、neutral→null を assert。決定論的。
2. **う角点ヒステリシス**— 適合。funnel 0.31/0.71 × pucker 0.25/0.61 の 4 角点で、う確定後に N+2 フレーム角点を食わせても winner が "u" に留まることを assert。低 funnel/低 pucker 角点（生 argmax が o に 0.017 差で反転）を margin 0.05 が吸収するケースを実際にカバー。
3. **中立ゲート**— 適合。neutral 点で winner=null / weight=0。
4. **単一 Vowel 非ゼロ**— 適合。`runtime-parameter-frame.test.ts`「emits only the winning vowel...」が非ゼロキーが `["param_mouth_vowel_a"]` のみ、他 4 母音は `undefined`（不発行）を assert。**ON 時に winner が 0.99 超で実際に出ることを検証しているため、OFF テストとあわせて非 vacuous。**
5. **トグル OFF 不発行**— 適合。`vowelLipsyncEnabled: false` で 5 母音 parameterId すべて `undefined`（存在しない）を assert。同一フィクスチャが ON では winner を出すため、この不発行は意味を持つ。
6. **strength 経路**— 適合。strength=0.5 で emitted 値が full×0.5 に半減（`toBeCloseTo`）。default=0 → w×strength を実証。
7. **既存無傷**— 適合。既存 11 スロット系テストは無改変で green。`runtime-export-auto-mapping.test.ts` の 11→16 / 非body 9→14 更新は 5 スロット自動列挙に伴う正当なアサーション更新（vowel ターゲット無しモデルでは unmapped で列挙）で、設計 §3 の自動列挙意図に合致。

### 自分で再実行した結果

作業ディレクトリ `apps/runtime-player`:

- 母音関連 5 スイート一括: `npx vitest run -c vitest.config.ts src/main/live-mapping/vowel-lipsync-estimator.test.ts src/main/live-mapping/runtime-parameter-frame.test.ts src/main/live-mapping/runtime-export-auto-mapping.test.ts src/main/live-mapping/live-mapping-state.test.ts src/main/model-mapping-profiles/model-mapping-profile-store.test.ts` → **35 passed（5 files）**
- `pnpm run typecheck`（`tsc --noEmit -p tsconfig.json`）→ **green（エラー 0）**
- 既存の browser-source 2 件失敗（`effectiveDynamicsTuning`）は本 Domain 無関係で、母音関連スイートには含まれない（本判定から除外して妥当。Orch-Sylph が stash で pre-existing を独立確認済み）。

---

## 裁量判断の妥当性評価

- **次元重み = 全 1.0**: 妥当。実測で 6 ラベルが健全マージン（最小 i/e = 0.167）で分離するため単位重みで十分。`vowelDimensionWeights` を named constant として残し将来調整可能にしてあり、設計 §7「決め打ちにせず調整可能な定数」を満たす。
- **N=3 フレーム**: 妥当。単フレームスパイク棄却と体感遅延（~50ms@60fps）のバランス。う角点テストで margin+N が実際に反転を吸収することを実証済み。
- **トグル新 IPC チャネル/ハンドラ**: 妥当。トグルは document レベルであり per-slot の `updateSlot`（slotId 必須）とは粒度が合わない。5 スロットに enabled を配るのは argmax 相互排他構造と噛み合わない。document 単位が設計 §3.2「モデル単位 mapping プロファイルへ optional 永続化」に自然に対応。追加は Domain A スコープ内に収まる。
- **ゲート下 state クリア**: 妥当（設計「口閉じ時 母音ゼロ」に沿う）。
- **`InputProfileVowelCalibration` を 8 次元縮約 `references` で型定義（型のみ）**: Domain A としては推定器入力型に閉じており妥当。ただし Domain B の採取粒度とのシームは要確認（下記 質問参照。Gnome も escalate 済み）。

---

## write scope 遵守 — 適合

`git status` / `git diff --stat` で確認。コード変更はすべて `apps/runtime-player/**` 配下のみ。`packages/**`・editor・authoring-host・その他 tools への変更なし。

- 新規 `apps/runtime-player/tools/capture-vowel-frames.ts` と `test_data/iFaceMocap/vowels/`（untracked）は設計 §5/§6 で採取ツール・一次データとして明記されており、Domain A のキャプチャ再生テストのフィクスチャ出所。本 Domain のランタイムコード経路には乗らない開発用スクリプト/データで、scope 内かつリスクなし。

---

## 差分・残課題

なし（本 Domain のスコープ内では要修正箇所を検出せず）。

参考（Domain A スコープ外・後続 Domain の課題として記録）:
- `InputProfileVowelCalibration` は型のみ。採取フロー・パーサ・ウィザードは Domain B。8 次元縮約 vs 全 blendshape 保持の最終決定は Domain B の採取実装に依存（型シーム調整の可能性あり）。

---

## 質問（判断に迷った点）

1. **test_data JSON の直接 import**: Domain A テストは `../../../../../test_data/iFaceMocap/vowels/vowel-captures.json` をプロジェクト外相対パスで import している（resolveJsonModule + vitest で解決確認済み・green）。設計 Required test #1 の「JSON を import」に忠実だが、プロジェクト外パス import を避ける方針が別途あれば test-support への転記が要る。現状は問題なしと判断。Orch-Sylph 側の方針確認を委ねる。
2. **`tools/` と `test_data/` の commit 対象範囲**: 両者は untracked。設計で言及済みのため Domain A 成果として commit すべきと考えるが、wave のコミット単位方針（tools を別コミットにするか等）は Orch-Sylph の裁量。
3. **`InputProfileVowelCalibration` の粒度シーム**: Gnome も escalate 済み。Domain A は 8 次元縮約で型が閉じているが、Domain B の採取設計次第で型変更余地あり。Domain 間シーム整合の確認を Orch-Sylph に委ねる（本 Domain の合格判定には影響しない）。
