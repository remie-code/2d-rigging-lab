# Wave106 Domain B (apps/editor) — Spec Compliance レビュー（レーン1: design/dev 観点含む）

- レビュア: Review-Sylph（opus）
- 判定: **合格**（要修正の差分なし）
- 対象: apps/editor の dynamics-file-v3 全面対応（Gnome 報告 `wave106-domain-b-gnome-report.md`）
- 正: `discussion/design/dynamics-world-frame-chain.md`（§3/§4/§5/§7/§8/§9）+ `wave106-plan.md` §7
- 検証方法: 対象ファイル実読 + grep + tsc 内訳 + dynamics テスト独立実行。Gnome 説明はすべて実物で照合済み。

---

## 観点1: UI フィールドと §4 スキーマの一致 — 適合

§4 の DynamicsInput / Chain / Output スキーマと editor UI・draft 型・payload 変換が一致。

- **スキーマの正の裏取り**: `packages/operation-core/src/payloads/dynamics.ts:15-64` を実読。`DynamicsInputPayloadSchema{parameterId,kind,scale}` / `DynamicsChainPayloadSchema{rootOffset,segmentLengths(min1,positive),damping(nonneg),gravityScale(nonneg)}` / `DynamicsOutputPayloadSchema{parameterId,segmentIndex(int≥1,既定1),scale,limit(nonneg)}` が §4 と厳密一致。Create/Update payload も `{dynamicsGroupId?, displayName, enabled, presetId?, inputs[], chain, outputs[]}`。
- **draft 型**: `dynamics-tool-state.ts:56-64` の `DynamicsToolDraft` が payload DTO を直接再利用（`DynamicsInputPayloadDto` / `DynamicsChainPayloadDto` / `DynamicsOutputPayloadDto`）。型の乖離余地なし。
- **payload 変換**: `createDynamicsGroupCreatePayloadFromDraft`（187-198）/ `createDynamicsGroupUpdatePayloadFromDraft`（200-211）が v3 payload 形状で構築。clone 系（`cloneDynamicsInput/Chain/Output` 972-990）も全フィールド網羅。
- **UI**:
  - Chain: `ChainEditor`（inspector 1023-1114）に rootOffset x/y（NumberField 2列）、segmentLengths リスト編集（行ごと NumberField + 削除 IconPanelButton、Add Segment ボタン、最小1本ガード `length<=1` で削除無効化）、damping、gravityScale。
  - Input 行（1199-1258）: Driver（parameter select）+ Kind（angle/positionX/positionY select）+ scale（NumberField、ラベルが kind で "deg/unit"/"cm/unit" 切替 = §4 単位規約に整合）。
  - Output（1264-1299）: parameter select + segmentIndex（NumberField、`Math.max(1,round())` で ≥1 強制）+ scale（"unit/deg"）+ limit（min0）。

## 観点2: プリセット値 §8 一致 — 適合

`DYNAMICS_TOOL_PRESETS`（`dynamics-tool-state.ts:116-137`）を §8 表と照合:

| preset | segmentLengths | damping | gravityScale | 判定 |
|---|---|---|---|---|
| hair | [14] | 2.5 | 1.0 | ✓ |
| ribbon | [10] | 1.2 | 0.8 | ✓ |
| softCloth | [18] | 4.0 | 1.0 | ✓ |
| rigidAccessory | [6] | 8.0 | 1.0 | ✓ |

- rootOffset 既定 `{x:0,y:0}` 全プリセット ✓。
- output 既定 scale: `DEFAULT_OUTPUT_SCALE_PER_DEG = 1/30`（45行）→ `normalizePreviewNumber`（6桁）で 0.033333。§8 脚注「パラメータ 1.0 = 30°」起点と一致 ✓。`dynamics-tool-state.test.ts` の "§8 preset chain values" で固定。

## 観点3: settled 実装と §3.7 の照合 — 適合（症状再発温床なし）

`isViewerRuntimePlaybackStateSettled`（`viewer-runtime-playback.ts:211-260`）:

- **§3.7 質点速度項**: `max_i |x_i − x̂_i| / dt`（239-244行）。`Math.hypot(x-px, y-py)` を全質点で最大化し `/ dtSeconds`。dt = `VIEWER_RUNTIME_FIXED_STEP_MS/1000`（230行）= 設計指定どおり ✓。
- **§3.7 出力オフセット変化項**: `computeMaxOutputOffsetDelta`（264-299行）。前フレーム particles を px,py で再構成し、現・前の両 state を `computeDynamicsOutputOffsetsFromGraph` に通して offset 差分の最大値を取る（追加状態なしで output 変化を捕捉）。
- **anchor（φ）の正しい使用（重点確認）**: 出力角の算出経路を runtime-core まで追跡。`computeDynamicsOutputOffsetsFromGraph`（`packages/runtime-core/src/dynamics-evaluation.ts:405-413`）は authored パラメータから `computeDynamicsSourceSample` で anchor を再導出し `computeDynamicsOutputOffsetsWithAnchor` へ委譲。同関数（378-398行）は `thetaLocalDeg = thetaWorldDeg − anchor.phiDeg`（385行）で **§3.5 の θ_local=θ_world−φ を厳守**。pin（x_0）も anchor から供給（384行）。**anchor 無しで particles だけから角を出す経路は editor 側に存在しない**（症状再発温床なし）。preview 側も同様に anchor 経路（下記）。
- **旧判定の撤去**: `.angle`/`angularVelocity`/`previousSourceVelocity` ベースの epsilon は撤去済み（grep でゼロ、観点4参照）。定数コメント（32-39行）が旧 epsilon 撤去を明記。
- **閾値の意味（検算）**:
  - `PARTICLE_SPEED_EPSILON = 1.0` cm/s。dt≈0.01667s で 1 フレーム変位 ≈ 0.0167cm。segmentLengths が 6〜18cm オーダーゆえ約 0.1〜0.3% の変位 = サブピクセル運動相当。恣意的でなく意味を持つ ✓。
  - `OUTPUT_OFFSET_DELTA_EPSILON = 0.001` パラメータ単位。可視スライダ精度（recommendedUiStep 0.01〜0.1）以下 ✓。
- **テストの実効性**: `viewer-runtime-playback.test.ts`（4件）は静止（x==px,y==py→速度0）/ 揺動中（|x−px| 大）/ driver変化直後の横揺れ / 最小フレーム未満、の物理的遷移を固定。生の閾値定数のオウム返しではない ✓。統合（`viewer-runtime-screen.test.ts` の settled-loop / restart-from-idle）も green。

## 観点4: 廃止フィールド・旧診断の editor 実装コード残置ゼロ — 適合

grep（`apps/editor/src --include=*.ts --include=*.tsx`）で自分で確認。**実装コードの残置ゼロ**。

- スキーマ（`pendulums`/`pendulum`/`influencePercent`/`normalization`/`reactionSpeed`/`convergenceSpeed`/`.strength`/`.sway`/`invert`）: 実装ヒットなし。`pendulum*` / `normalizationInvalid` のヒットは `dynamics-tool-state.test.ts:128-137` の **負アサーション用リテラル**（「旧診断が出ないこと」を検証する配列、`expect(codes).not.toContain(code)`）のみ。除外可 ✓。
- 状態（`.angle`(dynamics)/`angularVelocity`/`previousSource`/`previousSourceVelocity`）: dynamics 文脈のヒットゼロ。`.angle*` のヒットは全て rotation-deformer / canvas 系（`angleDegrees`/`angleEditMode`/`angleEditable`/`angleLockReason`/`angleTolerancePx`）で dynamics state と無関係 ✓。
- 旧診断 code（8種）: `dynamics-tool-state.test.ts` の負アサーションリテラルのみ。実装ゼロ ✓。
- 廃止 runtime-core API（`computeDynamicsSource\b`/`computeDynamicsOutputOffsets\b`）: editor 内ヒットゼロ。使用は `computeDynamicsOutputOffsetsWithAnchor`（preview）と `computeDynamicsOutputOffsetsFromGraph`（settled）のみ = 許可された anchor/graph 版 ✓。
- **Domain A 引き継ぎの旧診断2件**: `normalizationInvalid` / `outputStrengthZero` は validator（313-438行）に存在せず、新診断（chainSegmentsInvalid/outputSegmentIndexOutOfRange/zeroInputScale/outputScaleZero）へ置換済み。負アサーションでも「出ないこと」を固定。**確実に置換済み** ✓。

## 観点5: validator 語彙 §7 整合 — 適合

`validateDynamicsToolDraft`（`dynamics-tool-state.ts:313-438`）を §7 と照合:

- **新設**: `chainSegmentsInvalid`（356行、`segmentCount<1 || some(!(L>0))`、blocking/error）/ `outputSegmentIndexOutOfRange`（393行、`segmentIndex<1||>segmentCount`、error）/ `zeroInputScale`（342行、`input.scale===0`、warning）/ `outputScaleZero`（418行、`output.scale===0`、warning）✓。
- **改定 unstableSettings**（367-380行）: `damping>60 || segmentLengths.some(L<0.1) || segmentCount>16 || gravityScale>10`、warning。§7 の改定基準と厳密一致 ✓。
- **維持**（editor draft 責務のもの）: nameMissing / inputMissing / inputParameterMissing / outputParameterMissing / outputOwnershipDuplicate / outputLimitTooSmall ✓。（§7 の driverMissing/runtimeEvidenceMismatch は package validator 側の責務で editor draft validator の対象外。整合。）

## 観点6: Quick Tune の player v2 語彙整合（§9） — 適合

- **フィールド**: `QUICK_TUNE_FIELDS`（inspector 704-710）= `[outputScale, limit, damping, gravityScale, lengthScale]` = §9 の5語と完全一致 ✓。
- **乗数/直接値の適用**（`applyQuickTuneDraftToGroup` 832-864）:
  - `outputScale`（乗数）: `output.scale * draft.outputScale`（859行）✓。
  - `lengthScale`（乗数）: `segmentLengths.map(L => L * draft.lengthScale)`（847行）✓。
  - `limit`/`damping`/`gravityScale`（直接値）: そのまま代入（849/850/861行）✓。
- **live-delta セマンティクス**: `createQuickTuneDraftFromGroup`（805-816）は乗数を常に 1.0 で返し、直接値は committed group をミラー。commit 後に base 更新→倍率リセット。裁量として妥当。
- commit payload は `{dynamicsGroupId, chain, outputs}`（旧 pendulums なし、inspector 521-525）✓。label/description（890-918）も v2 語彙に整合（Output x / Length x 等）。

## 観点7: packages 無変更（B 由来） — 適合

- `git status --porcelain apps/editor` の変更は報告済み B スコープファイルと一致（実装4 + テスト多数 + 新規 viewer-runtime-playback.test.ts）。
- packages / runtime-player の working-tree 変更は Domain A / Domain C の領分であり、B の変更ではない。
- **authoring-host**: `git status --porcelain apps/authoring-host` は空（B の dynamics 変更なし）。冒頭 snapshot の authoring-host M 群は perception/ref 系の別作業で dynamics 無関係。
- `apps/runtime-player` の実体は Domain C。B の変更混入なし。

## tsc / テスト（独立検証）

- **tsc**: `npx tsc --noEmit -p apps/editor/tsconfig.json` = 22 errors。dynamics キーワード grep で唯一ヒットした `viewer-runtime-screen.tsx(431,444)` の2件を精査 → **当該 .tsx 実装本体は working-tree 未変更**（`git status`/`git diff --stat` 空、B が変更したのは同名 .test.ts のみ）。エラーは exactOptionalPropertyTypes による `state?` 受け渡しの構造問題で、メッセージ中の `dynamicsGroups: Record<...>` は `RuntimeStateDto` 型の展開表示にすぎず dynamics スキーマ変更由来ではない。残 21 も variant/mesh/session の pre-existing exactOptional/branding。**残 22 は dynamics 無関係を独立確認** ✓。
- **dynamics テスト**: `dynamics-tool-state.test.ts`(14) / `dynamics-tool-inspector.test.ts`(5) / `viewer-runtime-playback.test.ts`(4) / `viewer-runtime-screen.test.ts`(27) = **50 passed / 0 failed**（自分で実行）✓。

## 裁量判断の妥当性評価

| 裁量 | 内容 | 評価 |
|---|---|---|
| input scale 既定 1.0 | `DEFAULT_INPUT_ANGLE_SCALE=1`、kind=angle。§10 FaceZ例に整合。パラメータ種別から scale を推測する材料がないため保守的既定 | 妥当。設計 §10 と矛盾なし |
| output scale 1/30 | §8 脚注「1.0=30°」起点。6桁正規化 | 妥当。設計脚注どおり |
| output limit half-range | `(max−min)/2`。§8 が UI 較正前提で具体値未定のため合理的既定 | 妥当。設計は具体値を未定としており裁量の範囲内 |
| Quick Tune フィールド選定 | §9 の5語すべて。乗数2 + 直接値3 | 妥当。§9 語彙と完全一致 |
| preview 型再設計（source→anchor） | 旧スカラー `{source,rawSource}` を撤去し `anchor: DynamicsAnchorPose`（§3.2）へ。出力は `computeDynamicsOutputOffsetsWithAnchor` で θ_local=θ_world−φ を保つ | 妥当。世界系にスカラー source は存在せず設計原理に忠実。症状再発温床を作らない |
| settled 閾値 | particle 1.0 cm/s（≈0.017cm/frame=サブピクセル）/ offset 0.001（スライダ精度以下） | 妥当。§3.7 の意図に沿い、恣意的でない |

いずれも設計に反しない。

## 質問 / 申し送り

- なし（要修正差分なし）。以下は次レーン/次ドメインへの参考共有:
  - `viewer-runtime-screen.tsx` の exactOptional 2件は Domain B スコープ外の pre-existing（本体未変更）。Domain D の apps tsc exit0 ゲートで variant/mesh 系の pre-existing 分類として扱われる想定。B の合否には無関係。
