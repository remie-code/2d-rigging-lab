# C2 Domain A レビュー(Review-Sylph / レーン②: design/development compliance)

> レビュー担当: Review-Sylph。委任元: Orch-Sylph。日付: 2026-07-10。対象ブランチ: feature/2d-rigging-eco-system。
> レーン: **design/development compliance**(コード品質・リポジトリ流儀・非破壊リファクタの健全性・退行リスク)。
> spec compliance / test adequacy は別レーン担当。

## 判定

**合格(要修正なし / blocking ゼロ)**

非破壊抽出は、差分の意味等価の手作業検証と、独立実行した等価性テスト群の両面で健全と確認した。公開シグネチャ・呼び出し側・純度・変更範囲いずれも契約適合。1 件のみ理論上の挙動差(重複 slotId 時の body-z)を裁量注記として記す(Gnome 完了報告で開示済み・実運用非該当・非 blocking)。

## 検証の足場(自分で確認したもの)

- 差分: `git diff HEAD -- apps/runtime-player/src/main/live-mapping/runtime-parameter-frame.ts`(111 挿入 / 240 削除)。変換段 5 関数(`createCenteredTargetValue` / `createWeightValue` / `createVowelValue` / `createBodyXValue` / `createBodyZValue` / `applyBodySmoothing`)の削除と、リゾルバ側への移設を全行照合。
- リゾルバ本体 `headless-slot-resolver.ts` を全読。
- 独立テスト実行(report の主張を鵜呑みにせず自分で走らせた):
  - `runtime-parameter-frame-equivalence.test.ts` → 20/20 pass(golden への真の `toEqual` assert パス。`UPDATE_RESOLVER_GOLDEN` 未設定で assert 専用と確認)
  - `runtime-parameter-frame.test.ts`(既存・無変更)→ 19/19 pass(独立等価アンカー)
  - `headless-slot-resolver.test.ts` → 11/11 pass
  - 計 50/50 pass
- 呼び出し側 `model-mapping-bridge-handlers.ts:109` を確認。無変更・入力形不変。

## 非破壊性の検証結果(レーン最重要・観点1)

差分を関数単位で突き合わせ、二段化(Stage1 活性度計算 / Stage2 resolve)前後で変換ロジックが**意味的に同一**であることを確認した。

### 1a. body smoothing のステートフル性 — 保存されている

- 元コード: `createBodyXValue` / `createBodyZValue` は `rotation===undefined`(body-x)/両成分 null(body-z)/`normalized===null` の各早期 return で **`applyBodySmoothing` を呼ばずに** null を返す(state 不触)。
- リゾルバ: body-x/body-z は常に `applyBodySmoothing(slot, createCenteredTargetValue(...), state)` を通すが、`createCenteredTargetValue` が上記条件で null を返し、`applyBodySmoothing` は `targetValue===null` で **`apply` を呼ばず即 null 返却**(headless-slot-resolver.ts:208-210)。
- 結論: `state.apply` の**呼び出し回数・引数(slotId/targetValue/smoothing)・非呼び出し分岐が完全一致**。`slot.smoothing ?? 0` は Stage2 で実 slot から読むため hoist されず不変。
- 呼び出し**順序**: Stage1 は state に一切触れず、Stage2 リゾルバが `input.slots` を元の単一ループと同一順序で反復。body slot 間の相対 apply 順が保存され、平滑化メモリの時間発展が不変。フレーム跨ぎ lag は golden シナリオ `body-smoothing-lag-across-frames`(2 フレーム連続・同一 state)で機械的に固定され、pass。
- apply が非有限を返す場合も、元・新とも apply が null/finite チェックより前に実行済み。state 更新タイミング一致。

### 1b. vowel の convex-blend / 二重適用回避(§3.2 C) — 保持

- activation 段(`computeVowelActivation`): `estimate.s × estimate.weightByVowel[label]`。元 `createVowelValue` の activation 行と字面一致。per-vowel strength は `collectVowelStrengths` → estimator の pre-normalization bias として**一度だけ**適用(diff で `collectVowelStrengths` は無改変)。
- target 写像(`createVowelTargetValue`): `invert ? 1-a : a` → `target.min + a×(max-min)`。**strength 末尾再乗算なし・target.default ピボットなし**。元 `createVowelValue` の tail と厳密一致し、strength 二重適用は発生しない。
- 元 `createVowelValue` にあった `slot.target === null` ガードは、Stage1 ループ先頭ガード(`slot.target === null → continue`)+ リゾルバ側 `createVowelTargetValue` の同ガード + ループ先頭ガードで等価に温存。
- golden `vowel-blend-enabled-i-with-strength-boost`(strength:3 / strength:0 混在)が pass = 二重適用も脱落も起きていない機械的証拠。

### 1c. 共有 vowel 推定器の memoize — 不変

- `readVowelEstimate` は `createRuntimeParameterFrame` 内で定義・memoize。推定器の呼び出しは **Stage1 のみ**(リゾルバは推定器に非依存)。実行回数(memoize で最大 1)・入力(`extractVowelFeatureVector` / references / `strengthByVowel`)いずれも二段化で不変。
- mouth-open の gate 分岐(`readVowelEstimate` 配線時 `estimate.s`、非配線時 jawOpen 正規化)と配線条件(`mouth-open && vowelLipsyncEnabled`)も無改変。

### 1d. slot 反復順序 — 保存

- Stage1 / Stage2 とも `input.slots` を元と同一順序で反復。`parameterValues` は parameterId キーの Record で、同一 parameterId への複数書き込みの last-wins 順が保存される(反復順一致のため)。
- 沈黙契約(`enabled===false` / `target===null` / activation null|非有限)は Stage1・Stage2 双方のループ先頭ガード + リゾルバ末尾 `null || !Number.isFinite` チェックで温存。vowel-off(`mouth-vowel && !vowelLipsyncEnabled`)は Stage1 で activation 未設定 → Stage2 で `?? null` → `createVowelTargetValue` が null → 脱落、と元の「parameterId 非公開」を再現。

## 観点2: 公開シグネチャ不変 — 適合

- `CreateRuntimeParameterFrameInput` / 戻り値 `RuntimePlayerLiveParameterFrame` は diff 上 無改変。
- 呼び出し側 `model-mapping-bridge-handlers.ts`(git status で M 非該当)無変更。同一入力形で呼び続けている(:109-123)。

## 観点3: リポジトリ流儀 / 純度 — 適合

- リゾルバ import は `RuntimePlayerMappingSlot`(type)/`RuntimePlayerBodyFollowState`(`import type`)/`findSemanticSlotDefinition`+`SemanticSlotDefinition`(純ルックアップ)のみ。**Electron import ゼロ、TrackingFrame/InputProfile/calibration 非依存**を import 文で実確認。
- 推移的依存も純粋: `semantic-slot-definitions.ts` は `import type` 3 本のみ、`body-follow-state.ts` も `import type` のみ。副作用モジュールを引き込まない。
- 命名(`resolveSemanticSlotParameterValues` / `computeSlotActivation` / `compute*Normalized`)・純関数スタイル・`readonly` 型定義・`clamp` ヘルパは既存 live-mapping 流儀に整合。二段命名(compute=活性度 / resolve=写像)は責務境界を明快に表現。

## 観点4: 退行リスク — 認めず

- Wave22/23 vowel lip sync ロジックは境界を跨がず activation 段に残置(gate/estimator/pre-normalization bias いずれも無改変)。既存 vowel テスト + golden vowel 4 シナリオ pass。
- Wave21 body/dynamics 周辺は body smoothing の state 遷移不変(1a)により影響なし。
- 無関係箇所の巻き添え変更・不要な reformatting なし(diff は変換段の移設と二段化に限定)。作業ツリーの既存 M ファイル(discussion 配下)に不接触を git status で確認。

## 観点5: Subagent Contract — 適合

- 変更は `apps/runtime-player/src/main/live-mapping/` 配下のみ(+ reviews/waves の doc)。lockfile / `pnpm-workspace.yaml` / schema / package-format 無改変(git status で確認)。新規依存なし。

## 裁量注記(非 blocking)

- **重複 slotId 時の body-z 挙動差**: activation は slotId キーの Record に格納される。大半の sourceKind の活性度は slot 固有フィールドに非依存だが、**body-z のみ** `bodyRotationInvert/Strength`・`bodyPositionInvert/Strength` に依存する(`readBodyZRotationComponent`/`readBodyZPositionComponent`)。同一 slotId(`body-z`)が body 成分パラメータ違いで**重複**した場合、Stage1 で activation が後勝ちで上書きされ、Stage2 で両 slot が同一 activation を読むため、元(各 slot が自前で inline 計算)と結果が乖離しうる。ただし slotId は semantic-slot-definitions / auto-mapping により一意に構成されるため実運用では発生しない。Gnome 完了報告でも開示済み。設計変更ではなく既存不変条件への依存であり、非 blocking。将来 body-z を複数 slot 化する拡張が入るなら、activations を slotId ではなく slot インスタンス単位のキーにする再設計が必要になる点だけ申し送る。

## 質問(上位判断が必要な曖昧点)

- なし。レーン②観点での blocking はゼロ。上記裁量注記の body-z 重複キーの扱いは「slotId は一意」という既存前提の再確認のみで、本 Wave のスコープでは対処不要と判断。
