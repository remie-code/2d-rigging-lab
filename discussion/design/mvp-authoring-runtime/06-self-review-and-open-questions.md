# Self Review and Open Questions

> 状態: Draft
> 目的: MVP設計文書がAC、scenario、過去調査・リスク確認レポートの知見を満たしているかを自己レビューし、実装前に決めるべき未決事項とPost-MVPでよい未決事項を分ける。

## 1. レビュー根拠

### 1.1 読んだリポジトリ文書

- `discussion/_conventions.md`
- `discussion/design/_map.md`
- `discussion/design/initial-design-decisions-and-open-questions.md`
- `discussion/design/ai-agent-connection-and-technology-stack.md`
- `discussion/acceptance-criteria/03_MVP_Acceptance_Criteria.md`
- `discussion/scenarios/03_MVP_Acceptance_Criteria.md`
- `discussion/reports/deformer-structure-technology/_map.md`
- `discussion/reports/viewer-preview-reference/_map.md`
- `discussion/reports/runtime-evaluation-semantics-reference/_map.md`

### 1.2 追加で反映した参照レポート

- `discussion/reports/deformer-structure-technology/cubism-observable-deformer-semantics.md`
- `discussion/reports/deformer-structure-technology/open-deformation-algorithm-candidates.md`
- `discussion/reports/deformer-structure-technology/mvp-deformer-design-recommendation.md`
- `discussion/reports/viewer-preview-reference/open-stack-viewer-preview-design-implications.md`
- `discussion/reports/runtime-evaluation-semantics-reference/open-stack-runtime-evaluation-semantics-implications.md`

These reports are private research archive and not implementation source of truth. Active implementation source is the project-defined `rotation2d` / `warpLattice2d` rigControl contract and Minimum Open Dynamics v1 contract.

## 2. AC Coverage Review

| AC | 設計での対応 | Evidence |
|---|---|---|
| AC-MVP-001 | GUI Editorを必須入口とし、AI/CLI/JSONのみをMVP達成にしない | `00`, `02`, `04`, `05` |
| AC-MVP-002 | rights / provenance metadata、AI編集結果の記録をpackage設計へ入れた | `01`, `04`, `05` |
| AC-MVP-003 | import / asset panel、受け入れ警告、保持/喪失情報の表示を定義した | `02` |
| AC-MVP-004 | drawable / texture / part のstable ID、source、texture、opacity、draw order、part所属を定義した | `01`, `02`, `04` |
| AC-MVP-005 | mesh構造とmesh validation checksを定義した | `01`, `02`, `03`, `04` |
| AC-MVP-006 | lock / hide / selectをEditor-only、draw orderをruntime-visibleとして分離した | `02`, `03` |
| AC-MVP-007 | mask relation、mask UI、mask resolution、mask diagnosticsを定義した | `01`, `02`, `03`, `04` |
| AC-MVP-008 | parameter、範囲、keyform、`linear-1d-v1`、`parameter-grid-2d-v1`、out-of-range扱いを定義した | `01`, `02`, `03` |
| AC-MVP-009 | `rotation2d` / `warpLattice2d`、rig control hierarchy、parameter接続、rig control validationを定義した | `00`, `01`, `02`, `03`, `04` |
| AC-MVP-010 | 基本制作能力の初心者導線と project-defined parameter を定義した | `02`, `03` |
| AC-MVP-011 | Editor preview、保存、再読み込み、dirty graph adapterを定義した | `00`, `01`, `02`, `03` |
| AC-MVP-012 | Viewer、Shared Runtime core、parameter操作、runtime snapshotを定義した | `00`, `03`, `04` |
| AC-MVP-013 | Validator report、check set、runtime load test、代表parameter評価を定義した | `04` |
| AC-MVP-014 | File / GUI / Structured API 3層、dry-run、diff、repair、provenance、再検証を定義した | `05` |
| AC-MVP-015 | Demo-safe captureの分離、表示不可情報、capture前検証を定義した | `04`, `05` |
| AC-MVP-016 | Cubism非依存、Cubism関連資料は過去調査・リスク確認扱い、unsupported diagnosticsを定義した | `00`, `03`, `04` |

## 3. Scenario Coverage Review

| Scenario | 設計での対応 | 残リスク |
|---|---|---|
| SC-MVP-001 | Import、parts/drawables、mesh、lock/hide/select、draw order、mask導線を定義 | PSD primary / split PNG fallbackは確定済み。fixture素材作成方法のみ実装時判断 |
| SC-MVP-002 | project-defined parameter、keyform、rig control、`parameter-grid-2d-v1`、Minimum Open Dynamics v1導線を定義 | grid UIとDynamics preview/reset fixture粒度は実装時に詰める |
| SC-MVP-003 | package保存、再読み込み、Viewer load、runtime snapshotを定義 | preview/viewer snapshot一致の比較方法が未決 |
| SC-MVP-004 | Validator report、AI dry-run、diff、repair candidate、revalidationを定義 | structured API transportと承認UIが未決 |
| SC-MVP-005 | GUI authoring evidenceとAcceptance Runnerで誤判定防止を定義 | GUI evidenceの具体収集形式が未決 |

## 4. 参照レポート知見の反映確認

### 4.1 RigControl Structure Technology

反映済み:

- `rotation2d` を pivot付き2D affine transform として扱う。
- `warpLattice2d` を2D control lattice deformation nodeとして扱う。
- `bilinear-grid-v1` をMVP既定のwarp evaluatorにする。
- `rig controlLocalRest` bindをMVP既定にする。
- RigControl hierarchyはparent-before-childで評価し、cycleをblockingにする。
- CubismのBezier / conversion divisionsをそのままPrivate Prototypeの正にしない。
- final vertexだけでなくrig control nodeをruntime-visible graphとして保存する。

### 4.2 Viewer / Preview Reference

反映済み:

- Editor preview と Viewerを同一アプリ内の別機能とする。
- Shared Runtime evaluation coreを共有する。
- Editor-only stateとruntime-visible stateを分離する。
- Previewはdirty authoring graphをadapter経由で評価する。
- Viewerは保存済みpackageのruntime inspection surfaceとする。
- Diagnostics vocabularyをEditor warning、Viewer diagnostics、Validator report、AI diffで共有する。

### 4.3 Runtime Evaluation Semantics Reference

反映済み:

- ordered evaluation pipelineを固定した。
- snapshotを `summary`, `targeted`, `full` に分けた。
- severityを `info`, `warning`, `error`, `blocking` に分けた。
- statusをseverityから分けた。
- parameter範囲外値はUIでは作らせず、API/file入力はclamp warning、strictではfail候補とした。
- motion / expression / full physics / poseをMVP外future layerとしてunsupported diagnosticsへ入れた。
- Minimum Open Dynamics v1はMVPへ復帰し、computed output parameter、fixed timestep、reset policy、dynamics snapshotとして扱う。

## 5. 実装前に決めるべき未決事項

| 項目 | なぜ実装前に必要か | 推奨解決 |
|---|---|---|
| `parameter-grid-2d-v1` のGUI編集最小UI | SC-MVP-002がmanual authored parameter gridを要求し、runtimeとpreviewの一致に影響する | MVP採用は確定済み。実装時は `manual-face-grid-2d` fixtureで編集導線と期待snapshotを固定する |
| `compositionMode` 初期セット | 同一target propertyの複数writerが未定義だとruntime結果が不安定になる | MVPは `replace` と `additiveDelta`、opacity用 `multiplyOpacity` までに絞る候補 |
| Dynamics preview/reset fixture | Minimum Open Dynamics v1のdeterminism検証に必要 | `minimal-dynamics-hairSway` と `dynamics-reset-determinism` でfixed timestep、reset policy、snapshot sequenceを固定する |
| 初期warp lattice解像度 | 初心者導線とruntime evaluatorのfixtureに影響する | 2x2 baseline、顔/髪fixtureで不足なら3x3標準を検討 |
| snapshot一致判定 | Editor previewとViewerの共有core検証に必要 | `full`ではfull vertex、通常はvertex hash + bounds + diagnosticsで比較する候補 |
| GUI authoring evidence | SC-MVP-005の誤判定防止に必要 | operation logを必須、Playwright trace / session metadataを補助証拠にする候補 |
| structured API transport | AI dry-runの実装入口に影響する | MVPはin-process command busから始め、HTTP/MCPは後でtransport追加する候補 |
| mask source opacity 0の扱い | mask評価とViewer表示差に影響する | visibility falseとは分け、opacity 0はwarningまたはprofile別errorにする候補 |
| missing textureのseverity | Viewer部分表示を許すかMVP failかに影響する | visible drawableのmissing textureはMVP review fail候補。Previewは対象単位errorで継続可能にする候補 |

## 6. Post-MVPでよい未決事項

- Electron / Tauri / browser-only の最終desktop shell選択。
- zip package、registry、package signing。
- 第三者形式対応可否確認（MVP外・権利確認前提）。
- motion / expression asset / full physics / pose の制作・再生。
- direct vertex physics / direct rigControl physics output / cloth simulation / collision / IK / timeline bake。
- advanced warp evaluator: Bezier、bicubic、MLS、cage。
- AI automatic repair apply、複数repair案ランキング、権限モデル。
- CI batch validator、marketplace certification。
- commercial model quality metrics。

## 7. 矛盾・注意事項

### 7.1 明示的な矛盾

現時点で、必読文書と今回設計の間に明示的な矛盾は見つけていない。

### 7.2 注意すべき差分

- 既存 `design/_map.md` では runtime pipeline と snapshot粒度がユーザー判断待ちだった。今回の設計では、MVP実装に進めるためのDraft判断として `summary / targeted / full` と severity体系を提案した。最終確定前にユーザー確認または小fixture検証が望ましい。
- 既存文書では AI Agent Interface の具体API方式が未決だった。今回の設計ではtransportを固定せず、operation schemaを正とする方針にした。
- Cubism関連の過去調査資料にあるmotion / expression / physics / poseは、MVP外としてunsupported diagnosticsへ分離した。これはACのMVP外項目と整合する。

## 8. 自己レビュー結論

今回追加した設計文書は、MVP ACとscenarioが要求する設計対象を一通り覆っている。

実装前の最大リスクは、face yaw / pitch の斜め方向、keyform composition、GUI authoring evidence、snapshot一致判定である。これらはMVP実装開始前に短い設計確認または小fixtureで確定する必要がある。

Post-MVP項目は、第三者形式対応の是非確認、高度runtime layer、高品質rig control、desktop shell最終選定、AI自動修復などへ分離したため、MVPのAuthoring-to-Runtime一周を不必要に広げない構造になっている。
