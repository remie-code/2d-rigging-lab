# Wave106 Domain B (apps/editor) — Gnome 実装報告

## 判定: completed

apps/editor の dynamics ツールを dynamics-file-v3（世界系 Verlet チェーン）へ全面対応。B 起因の tsc エラーはゼロ（残存 22 件はすべて着手前から存在する非 dynamics の pre-existing）。editor 全体テスト 431/435 pass（残 4 failed はすべて pre-existing の `diagnostics-jump-actions.test.ts`、着手前 HEAD で同一に失敗を確認済み）。

## 変更/作成ファイル一覧（すべて apps/editor/src と設計ドキュメント注記。Forbidden 未接触）

### 実装（source）
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.ts` — 全面改修（v0→v3）
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.tsx` — UI 改修（Chain セクション新設、Quick Tune player v2 語彙化、Inputs/Outputs v3 化）
- `apps/editor/src/workspace/viewer/viewer-runtime-playback.ts` — settled 判定 §3.7 再設計
- `apps/editor/src/features/editor-session/model/parameter-manager-projection.ts` — dynamics 出力の detailLabel を `output.kind`（撤去）→ `segment ${segmentIndex}` へ

### テスト（新規）
- `apps/editor/src/workspace/viewer/viewer-runtime-playback.test.ts` — settled 新判定の単体テスト（新規作成）

### テスト（書換・値差し替え）
- `apps/editor/src/features/editor-session/model/dynamics-tool-state.test.ts` — 全面書換（particles/chain/scale/segmentIndex・新診断・新プレビュー型・§8 プリセット）
- `apps/editor/src/workspace/panels/dynamics-tool-inspector.test.ts` — 全面書換（サブエージェント委任、5/5 pass）
- `apps/editor/src/workspace/viewer/viewer-runtime-screen.test.ts` — fixture v3 化・settled/idle 挙動追従・hand-crafted state を particles 化
- `apps/editor/src/workspace/canvas/canvas-projection.test.ts` — dynamics preview state を particles 化、offset=5 を θ_world=35°/φ=30° で再構成
- `apps/editor/src/features/editor-session/editor-session-context-history.test.ts` — v3 payload 化、undo/redo は output.limit で検証
- `apps/editor/src/features/editor-session/model/editor-diagnostics-state.test.ts` — group リテラル v3 化
- `apps/editor/src/features/editor-session/model/parameter-definition-commands.test.ts` — group リテラル v3 化
- `apps/editor/src/features/editor-session/model/parameter-manager-projection.test.ts` — group リテラル v3 化、detailLabel 期待値を `Output 1 / segment 1` へ
- `apps/editor/src/workspace/app-bar.test.ts` — group リテラル v3 化
- `apps/editor/src/workspace/diagnostics/diagnostics-screen.test.ts` — group リテラル v3 化（2 群）
- `apps/editor/src/workspace/toolbox/workspace-toolbox.test.ts` — group リテラル v3 化
- `apps/editor/src/workspace/parameter-manager/parameter-manager-screen.test.ts` — group リテラル v3 化
- `apps/editor/src/workspace/viewer/viewer-render-source.test.ts` — dynamics group リテラル v3 化

### 設計ドキュメント注記
- `discussion/design/screen-design/components/dynamics-tool.md` — §3.2 / §5.2.2 / §9 / §12 に「Superseded by design/dynamics-world-frame-chain.md（dynamics-file-v3）」注記 + 新ノブ（chain/scale/segmentIndex、Quick Tune player v2 語彙）の最小整合記述を追加

## tsc 結果
- `npx tsc --noEmit -p apps/editor/tsconfig.json` → **22 errors（exit 1）**
- **B 起因は 0 件**。着手前ベースライン（自分の dynamics 変更を git stash して取得、packages は Domain A 版のまま）と file:line で厳密比較し、22 件すべてが着手前から存在することを確認。
  - `viewer-render-source.test.ts(618-620)` はベースラインの `(628-630)` と同一の mesh createMesh（triangleStableIds/topologyRevision）エラーが、私の v0→v3 変換で当該群が 10 行短くなったため行番号だけシフトしたもの。dynamics 由来ではない。
  - 私はこのファイルの dynamics エラー（ベースライン 396/416）を**消した**。
- 残存 22 件の内訳（すべて非 dynamics・非スコープ、Domain A/variant 由来の working-tree 状態）:
  - `editor-diagnostics-state.ts`（DrawableId/RigControlId branding、references.deformerParentCycle の exactOptional）×3
  - `viewer-render-source.ts` / `viewer-runtime-screen.tsx` / `runtime-controls.tsx` / `variant-manager-screen.tsx`（variant selection 系 exactOptionalPropertyTypes）
  - `viewer-render-source.test.ts` / `viewer-variant-selection.test.ts` / `mesh-*.test.ts` / `session-tree.test.ts` / `editor-project-storage.test.ts` / `parameter-bar.test.ts` / `editor-session-history.test.ts`（mesh/variant/session の pre-existing 型エラー）
- なお `dynamics-tool-inspector.tsx` にあった TS2375（`summary?:` / props の exactOptional、HEAD にも存在）2 件は自ファイル内・dynamics 診断 props なので私が `| undefined` を付けて解消した。

## テスト結果
- editor 全体 focused run: `npx vitest run apps/editor` → **435 tests: 431 passed / 4 failed**
- 失敗 4 件はすべて `apps/editor/src/workspace/diagnostics/diagnostics-jump-actions.test.ts`（mesh/rig/dynamics jump が `setActiveEntry("import")` を期待するが `"workspace"` が渡る = working-tree の entry 名リネーム由来）。
  - **切り分け**: 私の apps/editor 変更をすべて git stash した着手前状態でも同一の 4 failed を確認。**B 起因ではない**（mesh/rig を含む横断的失敗で dynamics スキーマとは無関係）。
- dynamics 関連の新規/書換テストはすべて green:
  - `dynamics-tool-state.test.ts` 14/14
  - `dynamics-tool-inspector.test.ts` 5/5
  - `viewer-runtime-playback.test.ts` 4/4（settled 新判定）
  - `viewer-runtime-screen.test.ts` 27/27（settled loop / restart-from-idle 統合含む）
  - `canvas-projection.test.ts` / `parameter-manager-projection.test.ts` 他 green

## 裁量判断

### input scale 既定値
`createDefaultDynamicsInput` は `{ kind:"angle", scale: 1 }`（`DEFAULT_INPUT_ANGLE_SCALE = 1`）。設計 §10 の FaceZ→scale 1.0 を保守的既定に採用。angle は deg/unit なので、±10/±30 の deg 値パラメータがそのまま頭回転 φ にマップされる。パラメータ種別から scale を推測する材料がないため 1.0 固定とした。

### output scale/limit 既定
- scale = `1/30`（`DEFAULT_OUTPUT_SCALE_PER_DEG`、正規化 6 桁 = 0.033333）。§8 脚注「パラメータ 1.0 = 30°」を起点に採用。
- limit = パラメータ range の半分（`(max−min)/2`）。§8 は limit 具体値を UI 較正前提として未定としているため、「default から片側エッジまで offset が到達でき、かつ通常運動を過剰クランプしない」合理的既定として half-range を選定。例: レンジ 40 → limit 20。

### Quick Tune のフィールド選定と乗数/直接値
player v2 語彙（§9）の 5 語をすべて出す:
- `outputScale`（乗数）= 出力 scale への倍率、`lengthScale`（乗数）= 全 segmentLengths への倍率。既定 1.0。committed base に対する係数として扱い、`createQuickTuneDraftFromGroup` は常に 1.0 を返す（commit 後に base が更新され倍率がリセットされる live-delta セマンティクス）。
- `limit` / `damping` / `gravityScale`（直接値）= group.chain / output の値をそのまま編集。
- `applyQuickTuneDraftToGroup` は `output.scale * outputScale`、`segmentLengths.map(L => L * lengthScale)` を適用。commit payload は `{ dynamicsGroupId, chain, outputs }`（旧 pendulums は無い）。

### preview 型の再設計
`DynamicsToolPreviewEvaluation` の旧スカラー `{ source, rawSource }` を撤去し、`anchor: DynamicsAnchorPose`（§3.2 の φ_deg + world pin）へ置換。世界系チェーンにスカラー "source" は存在せず、駆動信号はアンカー姿勢、出力は頭フレーム角（§3.5）で読むため。`DynamicsToolPreviewOutputSummary` に `segmentIndex` / `thetaLocalDeg` を追加（診断可視性）。preview の出力 offset は必ず `computeDynamicsOutputOffsetsWithAnchor(group, state, sampled.source.anchor)` で算出し、§3.5 の θ_local=θ_world−φ を壊さない（anchor 無しで particles だけから角を出す経路は使っていない）。preview のステップは stepDynamics に `parameterDefaults`（`listEditorParameters` の default から構築）を渡す。

### settled 閾値の選定根拠（§3.7）
- 旧 `ANGULAR_VELOCITY / SOURCE_VELOCITY / ANGLE_TO_SOURCE` エプシロンを撤去。
- `VIEWER_RUNTIME_SETTLED_PARTICLE_SPEED_EPSILON = 1.0`（cm/s）: `max_i |x_i − x̂_i| / dt`。固定ステップ（dt≈0.01667s）で 1 フレームあたり約 0.017cm の変位に相当 = 仮想 dynamics 空間のサブピクセル運動。
- `VIEWER_RUNTIME_SETTLED_OUTPUT_OFFSET_DELTA_EPSILON = 0.001`（パラメータ単位）: フレーム間の実効出力 offset 変化。可視スライダ精度以下。offset 変化はセグメント角に px,py（前ステップ位置）を用いて再構成した「前フレームの offset」との差分で算出 — 追加状態なしで output 変化を捕捉。
- dt は指定どおり `VIEWER_RUNTIME_FIXED_STEP_MS / 1000` を使用。
- idle throttle 維持: settled=true で RAF 停止、driver/入力変化で `runtimeParameterSignature`（`listPlayableDynamicsGroups` の入出力 parameterId を走査）が変わり再起動。統合テスト（restart-from-idle）と単体テストで固定。
- `listPlayableDynamicsGroups` の判定を `group.chain.segmentLengths.length > 0` へ更新。

## 既存赤の切り分け結果
着手前 HEAD（自分の apps/editor 変更を git stash した working-tree 状態、packages は Domain A 版）と比較:
- **tsc**: 残 22 件はすべてベースラインに存在（file:line 厳密一致、shift 分は mesh エラーの行番号ずれとして説明済み）。B 起因 0。
- **テスト**: 残 4 失敗（`diagnostics-jump-actions.test.ts`）はベースラインでも同一に 4 failed。B 起因 0。原因は working-tree の entry 名 `"import"→"workspace"` リネーム（mesh/rig/dynamics 横断、dynamics スキーマ無関係）。

## Basis Coverage 自己申告
- **§4 スキーマ（UI が表示・編集する形）**: `DynamicsToolDraft` の `inputs{kind,scale}` / `chain{rootOffset,segmentLengths,damping,gravityScale}` / `outputs{segmentIndex,scale,limit}` → `dynamics-tool-state.ts`。UI は `dynamics-tool-inspector.tsx` の Inputs（kind+scale）/ Chain セクション（ChainEditor: rootOffset・segmentLengths リスト編集・damping・gravityScale）/ Outputs（segmentIndex+scale+limit）。
- **§7 validator ルール**: `validateDynamicsToolDraft`（`dynamics-tool-state.ts`）。維持: nameMissing/inputMissing/inputParameterMissing/outputParameterMissing/outputOwnershipDuplicate/outputLimitTooSmall。新設: chainSegmentsInvalid/outputSegmentIndexOutOfRange/zeroInputScale/outputScaleZero。改定: unstableSettings（`damping>60 || L<0.1 || N>16 || gravityScale>10`）。廃止コードは editor 実装から一掃（負のアサーション用の文字列リテラルのみ dynamics-tool-state.test.ts に残置）。
- **§8 プリセット**: `DYNAMICS_TOOL_PRESETS`（hair [14]/2.5/1.0, ribbon [10]/1.2/0.8, softCloth [18]/4.0/1.0, rigidAccessory [6]/8.0/1.0, rootOffset {0,0}）→ `dynamics-tool-state.ts`、`dynamics-tool-state.test.ts` の "§8 preset chain values" で固定。
- **§3.7 settled**: `isViewerRuntimePlaybackStateSettled` / `computeMaxOutputOffsetDelta` / 閾値定数 → `viewer-runtime-playback.ts`、`viewer-runtime-playback.test.ts`（rest→settled、swing→not-settled、pre-min-frames→not-settled）+ `viewer-runtime-screen.test.ts`（統合）。
- **§9 Quick Tune player v2 語彙**: `QuickTuneDraft` / `applyQuickTuneDraftToGroup` / `createQuickTuneDraftFromGroup` / bounds / label / description → `dynamics-tool-inspector.tsx`（outputScale/lengthScale 乗数、limit/damping/gravityScale 直接値）、`dynamics-tool-inspector.test.ts` で commit payload を検証。
- **§3.5 出力写像**: preview 出力は `computeDynamicsOutputOffsetsWithAnchor(group, state, anchor)` で θ_local=θ_world−φ を保って算出（`dynamics-tool-state.ts` の `createPreviewOutputSummary`）。settled の出力変化項も同経路。

## 質問
なし。設計 §3〜§9 で判断に迷う式・語彙はなく、裁量指定（scale/limit 既定、Quick Tune フィールド、settled 閾値）はすべて上記のとおり選定・報告済み。escalate 事項（packages 変更・install・既存部品で組めない編集項目）は発生せず。segmentLengths リスト編集は既存の NumberField + 追加/削除ボタン（IconPanelButton）で最小実装できた。
