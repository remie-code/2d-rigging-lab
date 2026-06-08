# UI Reset Inventory: State / Operation Contracts

> Status: Inventory / 2026-06-08  
> Owner: UI Reset Inventory B Sylph  
> Scope: 新Primary Human UI Shellへつなぎ直すべき state / callback / operation / workflow 境界の棚卸。実装方針・画面仕様・API拡張の決定ではない。

## 1. 調査前提

### 1.1 受け入れ済み判断

- 既存Human UIは、画面設計の正解として扱わない。
- 既存panelが通常UIから見えなくなることは歓迎されている。
- ただし workflow / state / operation / callback / authoring logic は壊さない。
- 「表示を残す必要」と「callback/stateを保持する必要」は分ける。
- Editor/repoは提案生成、semantic認識、auto-rig、auto-fix、外部transportを勝手に追加しない。既存の `packages/ai-interface` / operation API / in-process command host が現在の統合面である（`discussion/design/codex-friendly-automation-policy.md`）。

### 1.2 主な根拠

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/authoring-workspace-v0-shell.ts`
- `apps/editor/src/ui/app-shell/workspace-context-surfaces.ts`
- `apps/editor/src/ui/app-shell/parts-tree-surface.ts`
- `apps/editor/src/ui/app-shell/task-shell.ts`
- `apps/editor/src/editor-state/editor-semantic-state.ts`
- `apps/editor/src/editor-state/editor-view-model.ts`
- `apps/editor/src/editor-state/explicit-psd-import-state.ts`
- `apps/editor/src/editor-state/explicit-psd-import-view-model.ts`
- `apps/editor/src/editor-state/explicit-psd-import-task-observation.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`
- `apps/editor/src/editor-workflow/explicit-psd-import-workflow.ts`
- `apps/editor/src/editor-workflow/explicit-psd-import-plan-workflow.ts`
- `apps/editor/src/editor-workflow/explicit-psd-structural-scaffold-workflow.ts`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
- `packages/ai-interface/src/ai-command-name.ts`
- `packages/ai-interface/src/ai-psd-import-plan-command.ts`
- `packages/operation-core/src/operation-type.ts`
- `packages/operation-core/src/operation-registry.ts`
- `discussion/design/screen-design/screens/authoring-workspace.md`
- `discussion/design/screen-design/screens/psd-import-task.md`
- `discussion/implementation/current-capability-map.md`
- `discussion/implementation/remaining-work-backlog.md`

### 1.3 調査範囲外

- source / test / script / package / fixture / generated asset の変更。
- UI修正の実装。
- operation API拡張、HTTP / WebSocket / MCPなど外部transport追加の決定。
- 既存E2Eの全面監査。既存inventoryと対象sourceから必要範囲だけ確認した。

## 2. 結論

新Primary Human UI Shellは、既存panelのDOMや文言を保存する必要はない。一方、次の境界は必ず保持・再接続する必要がある。

1. `EditorSemanticState` と `EditorWorkflowViewModel` の投影境界。
2. `EditorWorkflowController` の callback / method 境界。
3. Authoring Workspace v0 の region 契約: Toolbox、Parts Tree、Canvas / Preview、Inspector、Parameter Bar、Diagnostics Strip。
4. PSD Import Task の parse -> preview -> approval -> commit workflow と structured observation。
5. operation-core の deterministic operation / dry-run / commit 境界。
6. ai-interface / EditorAiCommandHost の deterministic read / inspect / validate / dry-run / approval / commit / PSD import-plan command 境界。
7. Product Preflight、operation log、generated evidence、reload、AI transcript は通常UIから隠してよいが、Diagnostics / Evidence / Codex-facing / test-facing surface へ移す必要がある。

表示としては、通常workspaceに raw refs、digests、operation IDs、evidence paths、parser payload、package file set を常時出す必要はない。必要なのは、人間が次に何をすべきか判断できる summary、selection state、blocked/warning count、commit readiness である。

## 3. 必ず接続すべき State / Callback / Operation

### 3.1 App Shell / Session / Project

| 契約 | 現在の所在 | 新Shellで保持する理由 | 人間UIに出す最小情報 | 通常UIに出さない内部情報 |
|---|---|---|---|---|
| `EditorSemanticState.loadedPackage`, `revision` | `editor-semantic-state.ts` | project loaded / empty / revision は全画面の前提。 | project名、package loaded有無、revision/save状態の短い表示。 | package file set全文、generated artifact paths、raw reload detail。 |
| `EditorWorkflowViewModel.packageTitle`, `packageRevisionLabel`, `isPackageLoaded` | `editor-view-model.ts`, `package-status.ts` | Human UI向けの整形済み状態。 | package title、revision label、未ロード状態。 | package ID全文を常時主表示する必要は薄い。 |
| `activeTask` (`psdImport` / `diagnosticsEvidence` / `codexAutomation` / `null`) | `app-shell.ts` | Task Window route維持に必要。 | どのtask/viewが開いているか、Back/Close。 | routing実装の内部IDはtest-facing metadataへ寄せる。 |
| `onOpenPsdImportTask`, `onOpenDiagnosticsEvidenceView`, `onOpenCodexAutomationView`, `onCloseActiveTask` | `app-shell.ts`, `editor-app.ts` | 旧panelを隔離しても task / evidence / Codex view 到達性を保つ。 | Toolbox上の明確な入口と開閉状態。 | skeleton routeの内部metadata。 |
| `onSaveProject`, `onLoadProject`, `onResetProject`, `onExportPortableBundle`, `onImportPortableBundleText` | `EditorAppShellOptions`, `WorkflowController` | project durabilityとportable bundleは壊せない。 | Save / Load / Reset / Export / Import の状態と失敗summary。 | storage key、persistent byte restore detail、portable payload internals、file paths全文。 |

### 3.2 Primary Authoring State

| 契約 | 現在の所在 | 新Shellで保持する理由 | 人間UIに出す最小情報 | 通常UIに出さない内部情報 |
|---|---|---|---|---|
| `viewModel.layerTree` | `layer-tree-view-model.ts`, `authoring-workspace-v0-shell.ts` | Parts Tree / Inspector / selection の主入力。 | part group、drawable rows、selected/locked/editor-hidden/missing texture summary。 | generated IDs全文、direct draft detail全文、missing target diagnostic refs全文。 |
| `state.parts`, `state.drawables`, `state.layerTreeDraft` | `editor-semantic-state.ts` | selection、visibility、lock、draft operations の実体。 | row label、visibility、lock、selected、draw order、texture missing。 | raw sourceAssetId、textureId、meshIdは通常rowでは省略可。詳細はInspector/Evidenceへ。 |
| `previewProjection` | `app-shell.ts`, `preview-panel/*` | Canvas / Preview の描画・semantic DOM oracle。 | drawableの実視覚、visible/hidden、bounds/texture fallback summary。 | runtime snapshot IDs、state sequence paths、validation report paths。 |
| `viewModel.previewControls` / `state.previewParameters` | `preview-parameter-state.ts`, `workspace-context-surfaces.ts` | Parameter Bar と preview slider の実体。 | active parameter、range、default/current、disabled reason、reset。 | computed dynamics/debug source detailの長文。 |
| `state.productPreflight` | `product-preflight-state.ts`, `authoring-workspace-v0-shell.ts` | Diagnostics Strip の blocking/warning summary。 | blocking count、warning count、上位3件程度、Details入口。 | report ID、diagnostic refs、evidence refs、unsupported/not-evaluated全文。 |

### 3.3 Primary Authoring Callbacks

| 契約 | 現在の callback | 最小接続 | 表示要否 |
|---|---|---|---|
| Part作成・更新 | `onCommitCreatePart`, `onCommitUpdatePart` | Parts Tree / Inspector / tool detail から呼べること。 | 常時form表示は不要。 |
| Drawable part/texture assignment | `onCommitSetDrawablePart`, `onCommitSetDrawableTexture` | Parts Tree / Inspectorの選択対象操作として保持。 | raw select formは隔離可。 |
| Layer tree direct drafts | `onDraftLayerTreePartRename`, `onDraftLayerTreePartReparent`, `onDraftLayerTreeEmptyLeafPartDelete`, `onDraftLayerTreeDrawablePartAssignment`, `onDraftLayerTreeDrawableTextureAssignment`, `onCommitLayerTreeDirectManipulationDrafts`, `onClearLayerTreeDirectManipulationDrafts` | Draft stateとcommit/clearを壊さない。 | 通常rowでは draft count / dirty marker / apply-clear だけでよい。 |
| Drawable selection / lock / editor hidden | `onSelectDrawableLayer`, `onToggleDrawableLayerLock`, `onToggleDrawableEditorHidden` | Parts Tree と Canvas の selection契約。 | row上に必須。 |
| Runtime visibility / draw order | `onToggleDrawableRuntimeVisibility`, `onMoveDrawableLayer` | Parts Tree / draw order操作として保持。 | rowまたはcompact controlsに必要。 |
| Mesh edit | `onSelectMeshCanvasVertex`, `onNudgeMeshCanvasSelection`, `onDragMeshCanvasSelection`, `onAddMeshVertex`, `onRemoveSelectedMeshVertex`, `onAddMeshTriangle`, `onRemoveMeshTriangle`, `onNudgeMeshUv`, `onNudgeMeshVertex` | Canvas / Mesh tool の既存authoring logic。 | 最初のPSD sliceでは常時表示不要。後続Mesh toolで接続。 |
| Rig / Composition / Dynamics | rig callbacks、composition callbacks、dynamics callbacks | operation/workflowは保持。 | 最初のPSD sliceでは通常UIから隠してよい。Toolbox / Inspector detailへ後続接続。 |
| Preview parameter | `onSetPreviewParameterValue`, `onResetPreviewParameterValues` | Parameter Barに必須。 | 常時表示候補。 |

### 3.4 PSD Import Task

| 契約 | 現在の所在 | 新Shellで保持する理由 | 人間UIに出す最小情報 | 通常UIに出さない内部情報 |
|---|---|---|---|---|
| `state.explicitPsdImport` | `editor-semantic-state.ts`, `explicit-psd-import-state.ts` | PSD source/session/tree/plan/result状態の根。 | parse state、source summary、tree counts、selected scope、warning count、commit readiness。 | raw parser object、raw PSD bytes、source refs全文、digests全文、materialized bytes detail。 |
| `viewModel.explicitPsdImport` | `explicit-psd-import-view-model.ts` | Human-readable summaryと候補rowの既存投影。 | source facts、document/tree summary、candidate/node labels、approved count。 | materializationLabels、digest、batch entries全文はEvidence向け。 |
| `projectExplicitPsdImportTaskObservation` | `explicit-psd-import-task-observation.ts` | Human summary / test-facing / evidence boundaryを分ける既存投影。 | `humanSummary.text`, warning count, ready flags, detail route。 | `rawDetailRefsIncluded` は false のまま維持。 |
| parse workflow | `runEditorExplicitPsdImportWorkflow`, `onParseExplicitPsdImportFile` | File選択とbrowser parser session。 | filename、size、parse status、group/layer/hidden count。 | parser payload、private object shape、raw bytes persistence details。 |
| import-plan preview / approved leaf commit | `runEditorExplicitPsdImportPlanPreviewWorkflow`, `commitExplicitPsdImportPlanApprovedBatchIntake` | explicit leaf approval path。 | scope、eligible/approved count、blocked/warning summary、commit enabled。 | candidatePlanDigest、approval context digest、generated refs全文。 |
| structural scaffold preview / commit | `runEditorExplicitPsdStructuralScaffoldPreviewWorkflow`, `commitEditorExplicitPsdStructuralScaffoldWorkflow` | PSD group -> part container、leaf -> drawable/texture/mesh scaffold のvertical slice本命。 | approved groups/leaves、generated part/drawable counts、hidden/runtime-hidden count、destination parent、commit enabled。 | structuralPlanDigest、approval ID/digest、source order refs、operation evidence refs、raw diagnostics。 |
| optional selected-layer / selected-leaf batch intake | `commitEditorSelectedPsdLayerIntakeWorkflow`, `commitEditorSelectedPsdLayerBatchIntakeWorkflow` | 既存workflow互換。 | 初期sliceではAdvancedへ隔離可。 | result entries、materialization evidence、persistent byte details。 |

### 3.5 Diagnostics / Evidence / Codex Surfaces

| 契約 | 現在の所在 | 新Shellで保持する理由 | 人間UIに出す最小情報 | 通常UIに出さない内部情報 |
|---|---|---|---|---|
| Product Preflight run/read state | `product-preflight-state.ts`, `product-preflight-workflow.ts` | validation状態とblocking理由。 | strip summary、Run action、top blockers、Details。 | report ID、category refs、diagnostic/evidence refs全文、comparison raw detail。 |
| Operation log / Generated evidence / Package file set / Reload summary | `app-shell.ts` support region、evidence/package panels | E2E/Codex/evidence oracleとして残る。 | 通常UIでは最新operation status程度。 | operation ID/type sequence、artifact paths、file set、reload pathsはEvidence viewへ。 |
| Codex Proposal Review / AI Approval / AI Transcript | `app-shell.ts`, `codexProposalReview`, `aiApproval` | deterministic approval workflowとtranscript。 | 通常UIではCodex/Automation viewへの入口と安全状態。 | proposal JSON、validation/diff detail、command IDs、transcript full entries。 |
| `aiCommandHost` | `workflow-controller.ts`, `editor-ai-command-host.ts` | DOMに依存しない deterministic command surface。 | 通常UI表示不要。 | command payload/responseはCodex/test/evidence surface。 |

### 3.6 Operation / API

| 契約 | 現在の所在 | 保持する理由 |
|---|---|---|
| `OperationCore.dryRunOperation`, `commitOperation` | `packages/operation-core/src/operation-core.ts` | UI表示から独立した deterministic mutation boundary。 |
| operation registry | `packages/operation-core/src/operation-type.ts`, `operation-registry.ts` | PSD, part, drawable, mesh, parameter, dynamics, rig, visibility, draw order など既存operationを壊さない。 |
| `AiCommandNameSchema` | `packages/ai-interface/src/ai-command-name.ts` | `getEditorState`, `inspectModel`, `inspectTarget`, `validatePackage`, `getOperationLog`, `dryRunOperation`, `commitOperation`, PSD import-plan commands の既存契約。 |
| PSD import-plan command result | `packages/ai-interface/src/ai-psd-import-plan-command.ts` | import-plan / structural scaffold read projection、latest result refs、approval context digest の既存契約。 |

## 4. Human UIに出す情報 / 出してはいけない内部情報

### 4.1 通常workspaceに出す候補

- Project title、loaded / revision / unsaved相当の短い状態。
- Toolbox: Select、Import PSD、Viewer、Diagnostics、Codex view入口。未実装toolはdisabled理由を短く出す。
- Parts Tree: part container、drawable row、selected、locked、editor hidden、runtime visible、draw order、missing texture。
- Canvas / Preview: drawableの視覚確認、selection overlay、texture fallback summary。
- Inspector: project summary、selection summary、part/drawable/source summary、contextual action entry。
- Parameter Bar: active parameter、current value、range、default、reset。
- Diagnostics Strip: blocking / warning count、短い上位summary、Details入口。
- PSD Import Task: source summary、rights/provenance確認状態、PSD tree summary、scope、approval counts、scaffold preview counts、hidden/runtime-hidden counts、commit readiness、warning summary、cancel/back。

### 4.2 通常workspaceに出してはいけない / 出さない方がよい情報

- operation ID、approval ID、plan digest、candidate digest、approval selection digest。
- generated part/drawable/texture/mesh refs全文。
- PSD node ref全文、source ref全文、source order refs全文。
- materialized bytes詳細、raw parser payload、parser private object shape。
- evidence path、runtime state path、state sequence path、validation report path。
- package file set全文、generated artifact paths、reload path list。
- AI command payload / response全文、transcript full entries。
- Product Preflight report raw refs、diagnostic/evidence refs全文。

これらは消してよいという意味ではない。Diagnostics / Evidence、Codex-facing structured surface、test-facing structured stateへ移す情報である。

## 5. 既存UI componentを破棄・隔離しても保持すべきロジック境界

| 境界 | 保持理由 | 破棄・隔離してよいもの |
|---|---|---|
| `EditorWorkflowController` | 全callbackの集約点。state更新、adapter commit、current PSD session保持、AI host再生成を担う。 | 旧panelの見た目、panelの常時mount。 |
| `EditorSemanticState` + projection functions | Raw package/session stateとHuman UI用view modelを分離する既存境界。 | raw stateをそのまま通常UIに出す表示。 |
| `EditorWorkflowViewModel` | Human-readable label / count / disabled reason の既存投影。 | 旧巨大panelのtext layout。 |
| PSD browser parser bridge / import plan service / structural scaffold plan service | PSD vertical sliceのworkflow logic。 | 旧Advanced Workflow Controlsの常時表示。 |
| `ExplicitPsdImportTaskObservationState` | Human summary、test-facing status、evidence boundaryを分ける準備済み投影。 | evidence/debug textをPSD Task内へ大量表示すること。 |
| operation-core handlers | deterministic mutationとevidence生成。 | UIごとの ad hoc mutation。 |
| ai-interface / EditorAiCommandHost | DOM非依存のCodex-facing surface。 | CodexがHuman UI textを読む前提。 |
| Product Preflight workflow/state | validation / diagnostics summary。 | report detailの常時workspace表示。 |
| Preview projection / semantic SVG attrs | Canvasと既存E2E oracle。 | 旧Preview panelのsummary/evidence全文。 |
| Layer Tree direct manipulation drafts | rename/reparent/delete/assignment draft workflow。 | 旧form配置と全draft detailの常時表示。 |
| Task Shell / shell surface metadata | workspace-scoped task window、Back/Close/Escape、surface IDs。 | final visual chromeは変更可。 |

## 6. PSD Importを最初の Vertical Slice にする場合の最小セット

### 6.1 最小 state

- `state.explicitPsdImport.status`
- `state.explicitPsdImport.source`
- `state.explicitPsdImport.treeSummary`
- `state.explicitPsdImport.treeRows`
- `state.explicitPsdImport.importPlan`
- `state.explicitPsdImport.structuralScaffoldPlan`
- `state.explicitPsdImport.selectedLayerBatchIntake`
- `state.explicitPsdImport.structuralScaffoldIntake`
- `state.explicitPsdImport.diagnostics`
- `viewModel.explicitPsdImport`
- `projectExplicitPsdImportTaskObservation(state.explicitPsdImport)`
- `state.parts` から destination parent candidates
- `activeTask === "psdImport"`

### 6.2 最小 callbacks

- `onOpenPsdImportTask`
- `onCloseActiveTask`
- `onParseExplicitPsdImportFile`
- `onGenerateExplicitPsdImportPlanPreview`
- `onIntakeApprovedExplicitPsdImportPlan`
- `onGenerateExplicitPsdStructuralScaffoldPreview`
- `onCommitExplicitPsdStructuralScaffold`

初期sliceでは、`onIntakeExplicitPsdLayer` と `onIntakeExplicitPsdLayerBatch` はAdvanced互換として保持するが、Primary Human UIの最短導線に出す必要はない。

### 6.3 最小 Human UI flow

1. PSD file選択 / Parse。
2. Source summaryとtree summary確認。
3. Scope選択またはroot scope。
4. Import-planまたはstructural scaffold preview。
5. Eligible candidates / structural nodes の承認。
6. Warning summary確認。
7. Approved import / structural scaffold commit。
8. Workspaceへ戻り、Parts Tree / Canvas / Inspectorで結果確認。

### 6.4 最小 test-facing / evidence-facing state

- `sourceLoaded`
- `parseStatus`
- `selectedScope`
- `importPlan.previewStatus`
- `importPlan.approvalStatus`
- `importPlan.candidateCount`
- `importPlan.approvedCount`
- `importPlan.readyToSubmitApprovedBatch`
- `structuralScaffold.previewStatus`
- `structuralScaffold.approvalStatus`
- `structuralScaffold.approvedGroupCount`
- `structuralScaffold.approvedLeafCount`
- `structuralScaffold.runtimeHiddenDrawableCount`
- `structuralScaffold.readyToCommitStructuralScaffold`
- `humanSummary.warningCount`
- `evidenceBoundary.detailStatus`

## 7. Parts Tree / Canvas / Inspector / Parameter Bar の最低契約

### 7.1 Parts Tree

最低state:

- `viewModel.layerTree.partGroups`
- `viewModel.layerTree.selectedDrawableIds`
- `viewModel.layerTree.lockedDrawableIds`
- `viewModel.layerTree.editorHiddenDrawableIds`
- `viewModel.layerTree.missingTextureDrawableIds`
- `viewModel.layerTree.directManipulationDraftCount`
- draw order / runtime visibility用 `viewModel.drawableLayers`

最低callbacks:

- `onSelectDrawableLayer`
- `onToggleDrawableLayerLock`
- `onToggleDrawableEditorHidden`
- `onToggleDrawableRuntimeVisibility`
- `onMoveDrawableLayer`
- direct draft callbacks一式
- part/drawable assignment callbacks

最小表示:

- part container / drawable hierarchy
- selected / locked / editor-hidden / runtime-visible
- draw order
- texture missing
- draft dirty count and Apply / Clear

出さない:

- sourceAssetId / textureId / meshId の全文
- generated refs全文
- evidence path

### 7.2 Canvas / Preview

最低state:

- `previewProjection`
- texture references from `createDrawableTextureReferences(state)`
- selection state from layer tree / mesh canvas state
- preview parameter values

最低callbacks:

- selection callback: `onSelectDrawableLayer` または mesh selection callback
- parameter update: `onSetPreviewParameterValue`
- mesh edit callbacksはMesh tool有効時に接続

最小表示:

- model/drawable visual
- selected target highlight
- runtime visible/hidden indication
- texture fallback state

出さない:

- runtime snapshot refs
- validation report path
- texture binary refs/digests

### 7.3 Inspector

最低state:

- project summary: package title/revision/counts
- selection summary: selected part/drawable/source
- active tool summary
- selected drawable facts: part, draw order, texture status

最低callbacks:

- reveal selection in Parts Tree
- focus selection in Canvas
- open tool details
- contextual edit callbacksは対象toolへ委譲

最小表示:

- selected target name/status
- 重要な editable facts
- blocked/disabled reason

出さない:

- raw DTO
- refs/digests/evidence detail
- operation log

### 7.4 Parameter Bar

最低state:

- first/active parameter summary
- min/max/default/current/recommended step
- disabled reason
- key marker summary

最低callbacks:

- `onSetPreviewParameterValue`
- `onResetPreviewParameterValues`
- future: add/update keyform, previous/next keyform, quick create, parameter manager

最小表示:

- active parameter display name/id
- slider/input
- current value
- default marker
- reset

出さない:

- full parameter manager table
- all keyform/evidence details
- computed dynamics internals

## 8. 実装時のリスク

### 8.1 Componentとlogicの密結合

- `EditorAppShellOptions` が非常に大きく、旧support panel群への callbackを一括で抱えている。新Shellでpropsを削ると workflow method を落としやすい。
- `app-shell.ts` は primary layout と legacy support region を同時に組み立てる。DOMを消すだけだと、Project Storage、Product Preflight、Codex/AI、Evidence系の入口やcallbackが消える危険がある。
- PSD panelはWave51後に local approval binding へ改善済みだが、approval textarea / checkbox / submit disabled の同期は依然としてcomponent-local UI stateに閉じている。表示再編時に「previewを更新しないままcommitできない」ガードを失わないこと。

### 8.2 Callbackがpanel内に閉じている

- Parts Tree direct manipulation、PSD approval、mesh canvas操作、rig/composition/dynamics formは、現component内で command組み立てを行う。
- 新Shellで見た目だけ作り直す場合、command DTO作成ロジックを再利用するか、workflow boundaryへ近づけるかを決めないと、同じvalidationを再実装しがち。

### 8.3 Test oracleが可視UI text / DOM属性に依存

- 既存inventory上、E2E/UI testsは `data-testid`、`textContent`、`aria-label`、`dt/dd` fact、form `.value` / `.checked` / `.disabled`、SVG/data attrsを広く読む。
- Debug/evidenceを通常UIから隠すこと自体より、同等の test-facing structured surface を先に用意しないことが破壊要因。
- `check:testids` は standard `check` に入っているが、dynamic selectorや間接aliasのblind spotは残る。

### 8.4 Evidence / Codex surfaceの移動リスク

- Operation log、Generated evidence、Package file set、Reload summaryは人間向けprimary情報ではないが、E2Eと手動調査のoracleである。
- Product Preflight current report/comparisonは UI state と panel表示に寄っている部分があり、Editor command hostからのDOM非依存 current read が十分かは未決。
- PSD structural scaffoldは read projectionがあるが、structural-specific Codex execute/stale command parityは未実装扱い。UI resetのついでに勝手にAPI拡張しない。

### 8.5 Current-session PSD source

- PSD import-plan / structural scaffold preview/commit は current browser session の `File` と parsed bridge resultに依存する。
- stateだけ復元しても source bytes は復元されない。load後やstale fileでは re-parse required をHuman UIに明示する必要がある。

### 8.6 UX wording / policy risk

- `Suggest rig`, `Auto classify`, `Recommended deformers`, `Auto repair`, `Generate proposal` 相当のUIは policy上禁止。
- PSD group/leaf の structural expansion は explicit approval に限って許可される。semantic recognitionやauto-rigと見える文言にしない。

## 9. User-decision needed

1. Diagnostics / Evidence full view を先に整備してから旧evidence panelsを通常UIから外すか、旧support regionを一時的に隔離表示として残すか。
2. Product Preflight current report/comparison をDOM非依存に読むsurfaceを次waveで必要とするか。
3. PSD Import Task のfinal surface policy: workspace-scoped task windowを継続するか、dedicated view / modal / drawerへ変えるか。
4. Structural scaffoldのCodex-facing parityを、UI reset waveでは境界記録だけに留めるか、別waveでAPI設計判断を行うか。
5. Parameter Manager / Mesh / Rig / Dynamics / Variant / Atlas の次接続順。PSD Import vertical slice後にどれをPrimary Shellへ昇格するか。

## 10. 次wave計画への示唆

- 最初のimplementation waveは、PSD Import Taskをvertical sliceにし、`ExplicitPsdImportTaskObservationState` を主契約にして Human summary / test-facing status / evidence route を分けるのが最も安全。
- Parts Tree / Canvas / Inspector / Parameter Bar は、既存 v0 shell surface の propsを維持しながら見た目を差し替える。特に Parts Tree direct draft callbacksを落とさない。
- 旧support panelsは削除ではなく隔離から始める。Diagnostics / Evidence / Codex / Automation の full migrationが済むまで、operation/evidence/test oracleを失うリスクが高い。
- `EditorAppShellOptions` は新Shell側で小さな adapter contractへ分割する価値があるが、source実装時の話であり、本棚卸では決定しない。
- 画面から raw refs/digestsを消す前に、同等の test-facing structured state または Diagnostics / Evidence routeを決める。

## 11. 未確認事項

- 実ブラウザでの視覚確認、mobile/desktop screenshot確認はしていない。
- UI unit / E2E 全ファイルの行単位監査はしていない。
- 外部Codex運用が可視DOM textを実際に読むかは未確認。
- Wave54 final integration / Domain J は未完了として扱った。Wave54 A-H verified worktree evidenceは参照したが、final implementation-proven baseline は docs上 Wave53 のままである。
