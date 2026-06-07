# Editor UX 現行機能群ID付き棚卸と分類候補

> 状態: Inventory。画面仕様・優先順位・実装方針の決定ではない。

## 1. 調査目的

Editor UX画面仕様discussionに向けて、現在のEditorに存在する機能群を `UX-FEAT-001` からの安定ID付きで列挙する。

この文書は、画面仕様、優先順位、実装順、テスト更新方針、Codex-facing structural command parity の実装計画を決めない。後続の議論で参照しやすいよう、現行機能を事実ベースで棚卸しし、その後に分類候補を付ける。

Wave52後の読み方: production `data-testid` coupling に関する記述は Wave51 前の棚卸事実として扱う。Wave51 Domain Bで UX-FEAT-018/019 の対象 coupling は除去済みで、Wave52 final integration report/review により PSD Import は Empty / Authoring Workspace から Task Shell task として到達可能になり、default always-visible workspace panel ではなくなった。Wave52 Domain Eで production `data-testid` guard は standard `check` の `check:testids` に統合済みだが、`check:testids:fixtures` は standard `check` には含めない。final Toolbox placement、modal/task-window/dedicated-view policy、DOM/text oracle migration、Diagnostics / Evidence View、Codex / Automation View、full visual redesign は未完了である。

## 2. 調査したファイル / 根拠

Basis documents:

- `discussion/_conventions.md`
- `discussion/design/_map.md`
- `discussion/design/screen-design/scope-and-principles.md`
- `discussion/design/screen-design/inventories/current-ui.md`
- `discussion/design/screen-design/inventories/codex-test-evidence-dependency.md`
- `discussion/design/codex-friendly-automation-policy.md`

Editor UI / workflow:

- `apps/editor/src/app/editor-app.ts`
- `apps/editor/src/ui/app-shell/app-shell.ts`
- `apps/editor/src/ui/app-shell/package-status.ts`
- `apps/editor/src/ui/parameter-operation/*`
- `apps/editor/src/ui/preview-panel/*`
- `apps/editor/src/ui/layer-tree/layer-tree-panel.ts`
- `apps/editor/src/ui/drawable-authoring/*`
- `apps/editor/src/ui/source-assets/*`
- `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`
- `apps/editor/src/ui/composition-panel/composition-panel.ts`
- `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts`
- `apps/editor/src/ui/dynamics-panel/dynamics-panel.ts`
- `apps/editor/src/ui/viewer-runtime/*`
- `apps/editor/src/ui/project-persistence/*`
- `apps/editor/src/ui/product-preflight/*`
- `apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.ts`
- `apps/editor/src/ui/ai-approval/*`
- `apps/editor/src/ui/ai-transcript/*`
- `apps/editor/src/ui/evidence-panel/*`
- `apps/editor/src/ui/package-file-set/*`
- `apps/editor/src/ui/tutorial-workflow/tutorial-workflow-panel.ts`
- `apps/editor/src/editor-workflow/workflow-controller.ts`

Test / Codex / evidence surface:

- `apps/editor/src/editor-state/editor-test-ids.ts`
- `apps/editor/e2e/test-ids.mjs`
- `apps/editor/e2e/*.mjs` の `data-testid`、`textContent`、`aria-label`、`dt/dd`、DOM属性参照の静的確認
- `apps/editor/src/ai-command-host/editor-ai-command-host.ts`
- `packages/ai-interface/src/ai-command-name.ts`
- `packages/ai-interface/src/ai-command-request.ts`
- `packages/ai-interface/src/ai-read-command.ts`
- `packages/ai-interface/src/ai-psd-import-plan-command.ts`
- `packages/ai-interface/src/ai-product-preflight-command.ts`

補助根拠:

- 既存の現状UI棚卸とCodex/test/evidence依存棚卸で参照済みの Wave48-Wave50 reports/reviews。ただし本調査では、実装ファイルと既存棚卸で足りる範囲に絞り、全reportの再監査はしていない。

## 3. ID付与方針と粒度

IDは `UX-FEAT-001` から連番にした。粒度は、ボタン単位ではなく、ユーザーが認識する機能、または画面仕様上どこに配置するかを決める必要がある機能単位にした。

同じpanel内でも、画面仕様上分けて扱う可能性が高いものは別IDにした。たとえば `PSD Import` panelは parse、selected layer intake、import-plan approval、structural scaffold を別IDに分けた。逆に、単独のbuttonや細かなform fieldは独立IDにしていない。

分類は事実ではなく候補である。分類の採否は後続のユーザーとUndineの議論で決める。

## 4. 現行機能群一覧

| ID | 機能名 | 現在の主な所在 / UI領域 | 主なユーザー行為 | 主な表示情報 | 関連するtest id / command / evidence surface | 根拠ファイル |
|---|---|---|---|---|---|---|
| UX-FEAT-001 | App shell / package status | App bar、単一 `editor-workspace` | Editor状態とpackage状態を確認する。Viewer / Runtimeを開閉する。 | `2D Rigging Editor`、workflow status、package title、package ID、revision、Viewer / Runtime開閉状態。 | `editor.shell`、`editor.packageStatus`、`editor.packageRevision`、`viewerRuntime.open`。 | `apps/editor/src/ui/app-shell/app-shell.ts`、`apps/editor/src/ui/app-shell/package-status.ts` |
| UX-FEAT-002 | Parameter list | Parameters panel | parameter一覧を確認する。 | name、ID、range、default、step、parameter count。 | `parameter.list`、`parameter.row.*`。E2E/UI testsがtextを読む。 | `apps/editor/src/ui/parameter-operation/parameter-list.ts`、`apps/editor/src/editor-state/editor-test-ids.ts` |
| UX-FEAT-003 | Parameter creation / operation status | Create Parameter panel | parameterを作成し、直近operation状態を確認する。 | form fields、commit可否、last operation、operation log/reload label、diagnostics。 | `parameter.create.form`、`parameter.create`、`operation.status`。AI Approvalのdry-run sampleもcreate parameterに寄っている。 | `apps/editor/src/ui/parameter-operation/create-parameter-form.ts`、`apps/editor/src/ui/parameter-operation/operation-status-panel.ts`、`apps/editor/src/editor-workflow/workflow-controller.ts` |
| UX-FEAT-004 | Authoring preview visual / summary | Preview panel | 現在のruntime previewを目視確認する。 | SVG preview、snapshot、visible/total drawables、parts、layer state、mesh evidence、texture rendering、diagnostics、diff。 | `preview.panel`、`preview.visual`、`preview.summary`。E2EはSVG `data-drawable-id`、`points`、texture/data attrsも読む。 | `apps/editor/src/ui/preview-panel/preview-panel.ts`、`preview-visual.ts`、`preview-summary.ts` |
| UX-FEAT-005 | Preview parameter controls | Preview panel | parameter sliderを動かし、preview parameter値をresetする。 | parameter controls、authored input count、empty state、reset可否。 | `preview.parameter.*`、`preview.reset`、`preview.empty`。 | `apps/editor/src/ui/preview-panel/preview-panel.ts`、`preview-parameter-controls.ts` |
| UX-FEAT-006 | Tutorial guided workflow | Tutorial Workflow panel | tutorial mini modelを作る、小編集を適用する、evidence targetを選ぶ。 | recipe/readiness、steps、selected evidence target、non-goals、missing evidence。 | `tutorialWorkflow.panel`、`tutorialWorkflow.create`、`tutorialWorkflow.smallEdit`、`tutorialWorkflow.targetSelect`、`tutorialWorkflow.steps`、`tutorialWorkflow.nonGoals`。 | `apps/editor/src/ui/tutorial-workflow/tutorial-workflow-panel.ts`、`apps/editor/src/editor-workflow/workflow-controller.ts` |
| UX-FEAT-007 | Viewer / Runtime surface | App bar toggle + Viewer / Runtime panel | viewer/runtimeを開閉し、viewer parameterを操作する。 | package state、runtime snapshot、runtime diff、validation diagnostics、parameter values、rig/mask/part/drawable/mesh/dynamics evidence。 | `viewerRuntime.open`、`viewerRuntime.panel`、`viewerRuntime.close`、`viewerRuntime.snapshotSummary`、`viewerRuntime.diff`、`viewerRuntime.diagnostics`、`viewer.parameter.*`。 | `apps/editor/src/ui/viewer-runtime/viewer-runtime-panel.ts`、`viewer-runtime-summary.ts` |
| UX-FEAT-008 | Part / layer tree overview and part management | Layer Tree panel | partを作成・更新し、part/drawable階層を確認する。 | tree summary、part group、drawable count、drawable membership、texture status。 | `layerTree.panel`、`layerTree.summary`、`layerTree.part.create.form`、`layerTree.part.update.form`、`layerTree.part.*`、`layerTree.drawable.*`。 | `apps/editor/src/ui/layer-tree/layer-tree-panel.ts` |
| UX-FEAT-009 | Layer tree direct manipulation | Layer Tree panel内のDirect Draftsと各row操作 | part rename/reparent、empty leaf delete、drawable part/texture assignmentのdraft、select/lock/editor-hiddenを操作する。 | direct draft count、draft status、selected/locked/editor-hidden state、commit/clear draft状態。 | `layerTree.directDraft.commit`、`layerTree.directDraft.clear`、`layerTree.part.rename.*`、`layerTree.part.reparent.*`、`layerTree.drawable.partDraft.*`、`layerTree.drawable.textureDraft.*`、`layerTree.select.*`、`layerTree.lock.*`、`layerTree.editorHidden.*`。 | `apps/editor/src/ui/layer-tree/layer-tree-panel.ts`、`apps/editor/src/editor-workflow/workflow-controller.ts` |
| UX-FEAT-010 | Drawable creation / drawable list / layer order | Drawable Authoring panel | drawable presetを作成し、drawable一覧、runtime visibility、layer orderを操作する。 | source/part/bounds/mesh default summary、result、drawable table、visibility、move up/down。 | `drawableAuthoring.panel`、`drawable.create.form`、`drawable.create`、`drawable.result`、`drawable.list`、`drawable.visibility.*`、`drawable.moveUp.*`、`drawable.moveDown.*`。 | `apps/editor/src/ui/drawable-authoring/drawable-authoring-panel.ts`、`drawable-list.ts` |
| UX-FEAT-011 | Mesh canvas vertex selection / direct mesh edit | Drawable Authoring panel内 Mesh Canvas | mesh vertexをcanvas上で選択し、nudge/dragする。 | selected mesh、selected vertex count、hit target count、editability、SVG vertex targets、selection state。 | `meshCanvas.editor`、`meshCanvas.surface`、`meshCanvas.status`、`meshCanvas.vertex.*`、`meshCanvas.nudge.*`。E2Eはgeometry、aria、`data-selected`、`data-editable`も読む。 | `apps/editor/src/ui/drawable-authoring/mesh-canvas-editor.ts` |
| UX-FEAT-012 | Mesh topology / UV controls | Drawable Authoring panel内 Mesh Topology / UV、Mesh Vertex Controls | vertex/triangleを追加・削除し、UVや個別vertexをnudgeする。 | topology revision、triangle count、selected vertex count、stable triangle status、vertex table、position、last result。 | `meshTopology.controls`、`meshTopology.status`、`meshTopology.action.*`、`meshTopology.triangle.remove.*`、`meshVertex.controls`、`meshVertex.status`、`meshVertex.row.*`、`meshVertex.nudge.*`。 | `apps/editor/src/ui/drawable-authoring/mesh-topology-controls.ts`、`mesh-vertex-controls.ts` |
| UX-FEAT-013 | Source intake draft / rights / byte intake | Source Intake panel | source modeを選び、file/layer/placement/rights/provenanceを入力してsource draftをconfirmする。 | status、mode、reference、file selection、byte length、storage truth、profile、placement、rights、provenance、layer rows、diagnostics。 | `sourceIntake.panel`、`sourceIntake.form`、`sourceIntake.fileInput`、`sourceIntake.selectedFile`、`sourceIntake.confirm`、`sourceIntake.summary`、`sourceIntake.layerRows`、`sourceIntake.diagnostics`。 | `apps/editor/src/ui/source-assets/source-intake-panel.ts`、`source-intake-form.ts` |
| UX-FEAT-014 | Imported source / structured profile evidence | Source Intake panel内 Imported Sources | imported source assetとlayer/profile evidenceを確認する。 | imported source count、file path、profile evidence、binary asset refs、PSD profile metadata、unsupported feature evidence、adapter diagnostics、layer mapping。 | `sourceIntake.importedSources`、`sourceIntake.imported.*`、`sourceIntake.layer.*`。E2Eがtextを読む。 | `apps/editor/src/ui/source-assets/source-intake-panel.ts` |
| UX-FEAT-015 | PSD parse / parser session / parsed layer tree | PSD Import panel | PSD fileをparseし、parsed documentとlayer treeを確認・選択する。 | parser status、source file facts、document facts、unsupported/not evaluated、selected layer、selected leaf batch、parsed PSD layer tree。 | `explicitPsdImport.panel`、`explicitPsdImport.form`、`explicitPsdImport.fileInput`、`explicitPsdImport.status`、`explicitPsdImport.source`、`explicitPsdImport.document`、`explicitPsdImport.layerTree`。 | `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts` |
| UX-FEAT-016 | PSD selected layer intake | PSD Import panel | selected PSD leaf layerを既存partまたは新規partへ追加する。 | destination kind、existing/new part、drawable name、selected layer intake result、diagnostics。 | `explicitPsdImport.layerIntake.form`、`explicitPsdImport.layerIntake.submit`、`explicitPsdImport.layerIntake.result`、`explicitPsdImport.layerIntake.diagnostics`。 | `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`、`apps/editor/src/editor-workflow/workflow-controller.ts` |
| UX-FEAT-017 | PSD selected leaf batch intake | PSD Import panel | 明示選択したPSD leaf setをpreflightしてbatch追加する。 | selected leaf refs、destination parent part、batch result、entries、diagnostics。 | `explicitPsdImport.batch.layerRefs`、`explicitPsdImport.batchIntake.form`、`explicitPsdImport.batchIntake.submit`、`explicitPsdImport.batchIntake.result`、`explicitPsdImport.batchIntake.entries`。 | `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts` |
| UX-FEAT-018 | PSD import-plan preview / approval / approved batch execution | PSD Import panel + AI PSD import-plan command surface | scope refとapproved leaf refsを指定し、import-plan previewを作り、候補承認後にapproved batchを追加する。 | plan status、candidate digest、candidate list、approved refs、approval blocked reasons、diagnostics、latest batch generated refs/evidence refs。 | UI: `explicitPsdImport.importPlan.*`。Command: `getPsdImportPlanState`、`setPsdImportPlanApproval`、`preflightPsdImportPlanIntake`、`executePsdImportPlanIntake`。Wave51前はproduction UIが`data-testid` selectorでapproved refsとsubmit disabledを同期していたが、Wave51 Domain Bで対象箇所は local approval binding へ置き換え済み。 | `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`、`apps/editor/src/ai-command-host/editor-ai-command-host.ts`、`packages/ai-interface/src/ai-psd-import-plan-command.ts` |
| UX-FEAT-019 | PSD structural scaffold preview / approval / commit | PSD Import panel + structural read projection | scope refとapproved PSD group/leaf refsを指定し、part/drawable/texture/mesh scaffold previewを作りcommitする。 | structural plan/digest、approval ID/digest/status、approved nodes、generated group/leaf refs、hidden/runtime visibility、result entries、diagnostics、evidence refs。 | UI: `explicitPsdImport.structuralScaffold.*`。Command surfaceは `getPsdImportPlanState` projectionに `structuralScaffold` / `latestStructuralScaffold` を含むが、structural-specific execute/stale commandは未実装。Wave51前はproduction UIが`data-testid` selectorでapproved refsとsubmit disabledを同期していたが、Wave51 Domain Bで対象箇所は local approval binding へ置き換え済み。 | `apps/editor/src/ui/explicit-psd-import/explicit-psd-import-panel.ts`、`packages/ai-interface/src/ai-psd-import-plan-command.ts`、既存依存棚卸 |
| UX-FEAT-020 | Composition mask relation authoring | Composition / Mask / Opacity panel | semantic mask relationを作成・更新する。 | relation form、mask/target drawables、enabled state、mask relation list、preview/viewer evidence、operation diagnostics。 | `composition.panel`、`composition.maskRelation.form`、`composition.maskRelation.commit`、`composition.maskRelation.list`、`composition.evidence`、`composition.diagnostics`。 | `apps/editor/src/ui/composition-panel/composition-panel.ts` |
| UX-FEAT-021 | Drawable opacity keyforms | Composition / Mask / Opacity panel | parameterに対するdrawable opacity keyformを追加する。 | input parameter、drawable、key value、opacity、keyform list、preview/viewer opacity evidence、diagnostics。 | `composition.opacityKeyform.form`、`composition.opacityKeyform.commit`、`composition.opacityKeyform.list`、`composition.evidence`。 | `apps/editor/src/ui/composition-panel/composition-panel.ts` |
| UX-FEAT-022 | Rotation2d rig control authoring | Project-defined Rig Controls panel | rotation2d controlを作成し、child bindし、angle keyformを追加する。 | control count、create form、bind form、angle keyform form、control list、keyform list、runtime evidence、operation diagnostics。 | `rigControl.panel`、`rigControl.create.form`、`rigControl.bind.form`、`rigControl.keyform.form`、`rigControl.list`、`rigControl.keyform.list`、`rigControl.evidence`、`rigControl.diagnostics`。 | `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts` |
| UX-FEAT-023 | Warp lattice draft rig controls | Project-defined Rig Controls panel | 2x2 warpLattice2dをstageし、child bind draftとcontrolPointOffsets keyform draftを作る。 | draft control ID、domain bounds、fixed lattice/interpolation info、warp target、patch mode、control point offsets、draft keyform list、runtime evidence。 | `rigControl.warpLattice.createDraft.*`、`rigControl.warpLattice.bindDraft.*`、`rigControl.warpLattice.keyformDraft.*`、`rigControl.warpLattice.keyform.list`。E2Eがvisible text、button state、geometryを読む。 | `apps/editor/src/ui/rig-control-panel/rig-control-panel.ts`、`apps/editor/e2e/warp-lattice-persistence-smoke.mjs` |
| UX-FEAT-024 | Dynamics group authoring / update | Dynamics panel | dynamics groupを作成し、既存groupのdisplay/enabled/reset policyを更新する。 | group count、driver/output settings、stiffness/damping/max velocity/amplitude、group list、settings summary。 | `dynamics.panel`、`dynamics.create.form`、`dynamics.create`、`dynamics.update.*`。 | `apps/editor/src/ui/dynamics-panel/dynamics-panel.ts` |
| UX-FEAT-025 | Dynamics preview / computed output / diagnostics | Dynamics panel | dynamics previewをrun/resetし、computed outputとvalidator diagnosticsを見る。 | preview status、frame count、computed output、runtime evidence、snapshot/diff/validation、validator diagnostics。 | `dynamics.preview.run`、`dynamics.preview.reset`、`dynamics.preview.outputs`、`dynamics.preview.evidence`、`dynamics.validator.diagnostics`。 | `apps/editor/src/ui/dynamics-panel/dynamics-panel.ts` |
| UX-FEAT-026 | Project storage save/load/reset | Project Storage panel | current projectをsave/load/resetする。 | storage action status、saved/loaded/reset/failed detail、storage key、package summary、persistent byte restore detail。 | `projectPersistence.panel`、`projectPersistence.save`、`projectPersistence.load`、`projectPersistence.reset`、`projectPersistence.status`、`projectPersistence.summary`。E2Eがstatus textを読む。 | `apps/editor/src/ui/project-persistence/project-persistence-panel.ts` |
| UX-FEAT-027 | Portable JSON export/import and transport capabilities | Project Storage panel | portable JSONをexport/importし、transport capabilityを確認する。 | export/import status、binary payload count、persistent bytes、transport capability list/unavailable action。 | `projectPersistence.portableExport`、`projectPersistence.portableImportInput`、`projectPersistence.transportCapability.list`、`projectPersistence.transportCapability.row.*`。 | `apps/editor/src/ui/project-persistence/project-persistence-panel.ts`、`project-transport-capability-section.ts` |
| UX-FEAT-028 | Product Preflight report | Product Preflight panel | Product Preflightを実行し、reportを確認する。 | overall status、highest severity、report/package/revision、category counts、blocking issues、warnings、not supported、not evaluated、evidence/diagnostic refs。 | `productPreflight.panel`、`productPreflight.run`、`productPreflight.status`、`productPreflight.summary`、`productPreflight.categorySummary`、`productPreflight.blockingIssues`、`productPreflight.warnings`、`productPreflight.unsupportedClaims`、`productPreflight.notEvaluated`。 | `apps/editor/src/ui/product-preflight/product-preflight-panel.ts` |
| UX-FEAT-029 | Product Preflight comparison / rerun affordance display | Product Preflight panel内 comparison section | preflight report差分とrerun affordanceを確認する。 | comparison summary、transitions、refs、rerun status/required input/blockers。 | `productPreflight.comparison`、`productPreflight.comparison.summary`、`productPreflight.comparison.transitions`、`productPreflight.comparison.refs`、`productPreflight.comparison.rerun`。AI interfaceには `readProductPreflightReport` / `diffProductPreflightReports` / `getProductPreflightRerunAffordance` 型があるが、現Editor command host統合は未確認。 | `apps/editor/src/ui/product-preflight/product-preflight-comparison-section.ts`、`packages/ai-interface/src/ai-product-preflight-command.ts`、既存依存棚卸 |
| UX-FEAT-030 | Codex Proposal Review | Codex Proposal Review panel | pasted proposal JSONをreviewし、validation/diff/rerun/preflight/approval/commit pathを確認・実行する。 | proposal facts、operations、validation issues、diff preview、rerun validation/Product Preflight、approval and commit path、commit safety。 | `codexProposalReview.panel`、`codexProposalReview.input`、`codexProposalReview.validation`、`codexProposalReview.diff`、`codexProposalReview.rerunValidation`、`codexProposalReview.approval`、`codexProposalReview.commit`。 | `apps/editor/src/ui/codex-proposal-review/codex-proposal-review-panel.ts`、`packages/ai-interface/src/ai-codex-proposal-*` |
| UX-FEAT-031 | AI Approval workflow | AI Approval panel | deterministic AI dry-runを実行し、approve/reject/commitする。 | approval status、dry-run result、command ID、operation ID、latest AI event、evidence count。 | `aiApproval.panel`、`aiApproval.status`、`aiApproval.resultSummary`、`aiApproval.dryRun`、`aiApproval.approve`、`aiApproval.reject`、`aiApproval.commit`。Command host uses `dryRunOperation` / `commitOperation`。 | `apps/editor/src/ui/ai-approval/*`、`apps/editor/src/ai-command-host/editor-ai-command-host.ts` |
| UX-FEAT-032 | AI Transcript | AI Transcript panel | AI command/approval transcriptを確認する。 | transcript event list、command/status、operation、approval status、evidence count、empty state。 | `aiTranscript.panel`、`aiTranscript.empty`、`aiTranscript.events`、`aiTranscript.event.*`。 | `apps/editor/src/ui/ai-transcript/*`、`packages/ai-interface/src/ai-command-transcript.ts` |
| UX-FEAT-033 | Operation log summary | Operation persistence evidence grid | committed operation logを確認する。 | entry count、operation types、latest operation ID/type/surface/timestamp、target IDs。 | `operationLog.summary`。Codex command `getOperationLog`。E2Eは`Entries`の`dt/dd`やoperation type sequenceを読む。 | `apps/editor/src/ui/evidence-panel/operation-log-summary-panel.ts`、`packages/ai-interface/src/ai-read-command.ts` |
| UX-FEAT-034 | Generated evidence summary | Operation persistence evidence grid | runtime snapshot/state/sequence、validation report evidenceを確認する。 | runtime snapshot IDs、runtime state paths、sequence paths、validation report IDs/paths。 | `evidence.generated.summary`。多くのoperation E2Eでtext oracle。 | `apps/editor/src/ui/evidence-panel/generated-evidence-summary-panel.ts` |
| UX-FEAT-035 | Package file set | Operation persistence evidence grid | serialized package file pathsを確認する。 | file count、authored/log/generated count、operation log path、generated badge、paths。 | `package.fileSet.paths`。 | `apps/editor/src/ui/package-file-set/package-file-set-panel.ts` |
| UX-FEAT-036 | Reload summary | Operation persistence evidence grid | reload結果を確認する。 | reload status、package revision、parameters after reload、files observed、committed parameter IDs、reloaded paths。 | `package.reload.summary`。 | `apps/editor/src/ui/package-file-set/reload-summary-panel.ts` |
| UX-FEAT-037 | Codex-facing structured command host | DOM外のEditor command host / `packages/ai-interface` | 外部Codex/LLMまたはテストが、Editor stateを読む、targetをinspectする、validateする、operation dry-run/commitする、PSD import-planを操作する。 | structured responses、DTO/schema、operation log entries、validation report、PSD import-plan/structural projection、transcript。 | Command names: `getEditorState`、`inspectModel`、`inspectTarget`、`validatePackage`、`getOperationLog`、`dryRunOperation`、`commitOperation`、`getPsdImportPlanState`、`setPsdImportPlanApproval`、`preflightPsdImportPlanIntake`、`executePsdImportPlanIntake`。 | `apps/editor/src/ai-command-host/editor-ai-command-host.ts`、`packages/ai-interface/src/*`、`apps/editor/src/editor-workflow/workflow-controller.ts` |

機能数: 37。

Wave51-Wave52実装状況メモ:

- UX-FEAT-018/019 の targeted production `data-testid` behavior coupling は除去済み。
- UX-FEAT-001 周辺には minimal shell surface metadata が追加されたが、workspace layoutやfinal visual hierarchyは未変更。
- UX-FEAT-018/019 向けの structured observation projector は、Wave52で Task Shell status、compact diagnostics summary、test-facing `data-*` summary へ狭く消費された。Codex-facing read API、最終test-facing surface、Diagnostics / Evidence final viewへの接続は未完了。
- PSD Import は Wave52 で Task Shell task として到達可能になり、default always-visible workspace panel ではなくなった。ただし final Toolbox placement、modal/task-window/dedicated-view policy、full visual redesign は未完了。
- production `data-testid` guard は Wave52 で standard `check` の `check:testids` に統合済み。`check:testids:fixtures` は利用可能だが standard `check` には含めない。
- UX-FEAT-028〜036 の Diagnostics / Evidence View分離と UX-FEAT-030〜032 の Codex / Automation View分離は未実装。
- Mesh / Texture Atlas / Parameter Manager / Variant Manager のUI進捗はWave51-Wave52ではない。

## 5. 体験カテゴリ別分類候補

| 体験カテゴリ | 候補ID | 理由 / 注意 |
|---|---|---|
| `primary-authoring` | UX-FEAT-001, UX-FEAT-002, UX-FEAT-003, UX-FEAT-004, UX-FEAT-005, UX-FEAT-008, UX-FEAT-009, UX-FEAT-010, UX-FEAT-011, UX-FEAT-012, UX-FEAT-020, UX-FEAT-021, UX-FEAT-022, UX-FEAT-023, UX-FEAT-024 | 通常のauthoringで直接触る可能性が高い。ただし rig/composition/dynamics は常時表示かtool起動時表示かは未決。 |
| `import-workflow` | UX-FEAT-013, UX-FEAT-014, UX-FEAT-015, UX-FEAT-016, UX-FEAT-017, UX-FEAT-018, UX-FEAT-019 | source intake、PSD parse、leaf intake、import-plan、structural scaffold は素材取り込み系。 |
| `inspection-preview` | UX-FEAT-004, UX-FEAT-005, UX-FEAT-007, UX-FEAT-020, UX-FEAT-021, UX-FEAT-022, UX-FEAT-023, UX-FEAT-025 | preview、viewer/runtime、composition/rig/dynamics evidence はruntime確認を含む。 |
| `diagnostics-validation` | UX-FEAT-003, UX-FEAT-014, UX-FEAT-015, UX-FEAT-016, UX-FEAT-017, UX-FEAT-018, UX-FEAT-019, UX-FEAT-025, UX-FEAT-028, UX-FEAT-029, UX-FEAT-030, UX-FEAT-037 | diagnostics/check/reportを表示または返す。Product PreflightとCodex proposal reviewは特に中心。 |
| `operation-evidence` | UX-FEAT-003, UX-FEAT-007, UX-FEAT-014, UX-FEAT-018, UX-FEAT-019, UX-FEAT-025, UX-FEAT-026, UX-FEAT-027, UX-FEAT-029, UX-FEAT-030, UX-FEAT-031, UX-FEAT-032, UX-FEAT-033, UX-FEAT-034, UX-FEAT-035, UX-FEAT-036, UX-FEAT-037 | operation log、evidence refs、artifact paths、transcript、reload/package file setを含む。通常UIに残す範囲は未決。 |
| `codex-ai-control` | UX-FEAT-018, UX-FEAT-019, UX-FEAT-030, UX-FEAT-031, UX-FEAT-032, UX-FEAT-037 | proposal/approval/transcript/command host、PSD import-plan command surface。UX-FEAT-019はread projectionあり、structural execute parityは未確認。 |
| `project-storage` | UX-FEAT-001, UX-FEAT-026, UX-FEAT-027, UX-FEAT-035, UX-FEAT-036 | package status、save/load/reset、portable bundle、file set、reload。 |
| `tutorial-sample` | UX-FEAT-006, UX-FEAT-026 | tutorial mini modelとsample reset。UX-FEAT-026はproject storageでもある。 |

## 6. 表示優先度別分類候補

| 表示優先度候補 | 候補ID | 理由 / 注意 |
|---|---|---|
| `always-visible-candidate` | UX-FEAT-001, UX-FEAT-002, UX-FEAT-004, UX-FEAT-005, UX-FEAT-008 | 通常workspaceで常に状態把握したい可能性が高い。parameter listは下部/side/inspector化も候補なので確定ではない。 |
| `contextual-panel-candidate` | UX-FEAT-003, UX-FEAT-009, UX-FEAT-010, UX-FEAT-011, UX-FEAT-012, UX-FEAT-020, UX-FEAT-021, UX-FEAT-022, UX-FEAT-023, UX-FEAT-024, UX-FEAT-025 | 選択中part/drawable/mesh/toolに応じて見えればよい可能性がある。rig/composition/dynamicsはprimary authoringかtool panelか判断待ち。 |
| `modal-task-candidate` | UX-FEAT-006, UX-FEAT-013, UX-FEAT-015, UX-FEAT-016, UX-FEAT-017, UX-FEAT-018, UX-FEAT-019, UX-FEAT-026, UX-FEAT-027, UX-FEAT-028, UX-FEAT-029, UX-FEAT-030 | 独立taskとして開始・確認・完了する性質が強い。特にPSD ImportとProduct Preflight/Codex Proposalは巨大panel化している。 |
| `drawer-debug-candidate` | UX-FEAT-007, UX-FEAT-014, UX-FEAT-025, UX-FEAT-028, UX-FEAT-029, UX-FEAT-030, UX-FEAT-032, UX-FEAT-033, UX-FEAT-034, UX-FEAT-035, UX-FEAT-036 | evidence、diagnostics、artifact path、operation refsを多く含む。通常authoring UIから分離する候補。 |
| `machine-only-candidate` | UX-FEAT-018, UX-FEAT-019, UX-FEAT-029, UX-FEAT-033, UX-FEAT-034, UX-FEAT-035, UX-FEAT-036, UX-FEAT-037 | 機械可読surfaceへ寄せられる部分がある。UX-FEAT-033〜036は人間のdebug確認もあり、完全machine-onlyかは要判断。 |
| `needs-user-decision` | UX-FEAT-006, UX-FEAT-013, UX-FEAT-014, UX-FEAT-018, UX-FEAT-019, UX-FEAT-020, UX-FEAT-021, UX-FEAT-022, UX-FEAT-023, UX-FEAT-024, UX-FEAT-025, UX-FEAT-028, UX-FEAT-029, UX-FEAT-030, UX-FEAT-031, UX-FEAT-032, UX-FEAT-033, UX-FEAT-034, UX-FEAT-035, UX-FEAT-036 | 常時表示・tool/modal・drawer・machine-onlyの境界が現時点で未決。 |

## 7. Codex/test/evidence依存リスク別分類候補

| リスク | 候補ID | 根拠 / 注意 |
|---|---|---|
| `low` | UX-FEAT-037 | DOM外のstructured command host / DTO/schema中心。UI移動そのものには比較的強い。ただしcommand schema変更は別リスク。 |
| `medium` | UX-FEAT-001, UX-FEAT-002, UX-FEAT-003, UX-FEAT-005, UX-FEAT-006, UX-FEAT-010, UX-FEAT-020, UX-FEAT-021, UX-FEAT-024, UX-FEAT-026, UX-FEAT-027, UX-FEAT-031, UX-FEAT-032 | `data-testid`、visible text、aria label、disabled/value確認がある。構造化surfaceやtest idを維持すれば移動可能そうだが、visible text依存の更新は必要になり得る。 |
| `high` | UX-FEAT-004, UX-FEAT-007, UX-FEAT-008, UX-FEAT-009, UX-FEAT-011, UX-FEAT-012, UX-FEAT-013, UX-FEAT-014, UX-FEAT-015, UX-FEAT-016, UX-FEAT-017, UX-FEAT-018, UX-FEAT-019, UX-FEAT-022, UX-FEAT-023, UX-FEAT-025, UX-FEAT-028, UX-FEAT-029, UX-FEAT-030, UX-FEAT-033, UX-FEAT-034, UX-FEAT-035, UX-FEAT-036 | E2E oracleがDOM text、`dt/dd` facts、SVG/data attrs、geometry、aria label、artifact refsに強く依存する。UX-FEAT-018/019のtargeted production `data-testid` behavior couplingはWave51で除去済みだが、visible DOM/text oracleと未移行UIのリスクは残る。 |
| `unknown` | なし | 今回確認した範囲では全IDに最低限の根拠を付けた。ただし網羅監査ではないため、細部の未確認は第9章に記録する。 |

補足:

- `high` は「移動すべきでない」という意味ではない。現行E2E / UI tests / production DOM coupling / visible evidence oracleへの影響が大きい候補という意味である。
- `low` は「仕様変更が安全」という意味ではない。DOMレイアウト変更からの独立性が比較的高い候補という意味である。

## 8. 分類に迷う機能 / ユーザー判断が必要な機能

| ID | 迷う点 / 判断が必要な理由 |
|---|---|
| UX-FEAT-006 | tutorialを通常workspaceに残すか、sample/tutorial起動時だけのmodal/taskにするか。通常authoring中の常時表示としては優先度が低そうだが、初回導線としては重要な可能性がある。 |
| UX-FEAT-013, UX-FEAT-014 | Source Intakeはimport workflowだが、source rights/provenanceはproject状態の重要情報でもある。入力formとimported source evidenceを同じ領域に置くべきか分けるべきか要判断。 |
| UX-FEAT-018, UX-FEAT-019 | PSD import-plan / structural scaffoldは人間向け承認UI、Codex-facing command/read surface、E2E oracle、production DOM couplingが重なっている。専用import taskに分離する候補だが、test/Codex surfaceを先にどう守るか要判断。 |
| UX-FEAT-020〜UX-FEAT-025 | Composition / Rig / Dynamicsは通常authoringの中心にもなり得るが、現状はevidence/diagnosticsも厚い。常時表示するtoolか、選択時inspectorか、toolbox起動panelか要判断。 |
| UX-FEAT-028, UX-FEAT-029 | Product Preflightは人間が実行・確認するvalidation機能だが、詳細はdebug/evidence寄り。summaryだけ常時/近接表示し、詳細をdrawer化するか要判断。 |
| UX-FEAT-030〜UX-FEAT-032 | Codex Proposal Review / AI Approval / AI Transcriptは現在可視UIだが、Codex-friendly policy上はrepo/Editorが提案生成をしない境界の安全装置である。通常Editor UIの主導線に置くか、Codex/evidence viewに寄せるか要判断。 |
| UX-FEAT-033〜UX-FEAT-036 | Operation/evidence/package/reloadは現在workspace内に常時表示されるが、人間向けauthoring UIとしてはdebug色が強い。完全に隠すとE2E oracleや手動調査が不便になるため、drawer/debug viewまたはmachine-readable surface化の境界判断が必要。 |
| UX-FEAT-037 | DOM外surfaceとしてはUI整理から独立しやすい。ただし、UX整理で「人間向けUIから外す情報」を増やす場合、このsurfaceへ追加すべき情報があるかは別途判断が必要。 |

## 9. 未確認・不確実な点

事実:

- 現行Editorは `createEditorAppShell` が単一workspaceへ多数panelをappendする構造である。
- Viewer / Runtime以外の多くのpanelは、確認範囲では常時workspaceに並ぶ。
- `editor-test-ids.ts` と `apps/editor/e2e/test-ids.mjs` は広範なtest id mirrorを持つ。
- E2Eは `data-testid`、`textContent`、`aria-label`、`dt/dd`、form value/disabled、SVG/data attrs、geometryを広く読む。
- Wave51前のPSD Import import-plan/structural scaffold承認UIは、production code内で `data-testid` selectorを使ってapproved refs textareaとsubmit disabled状態を同期していた。Wave51 Domain Bで対象箇所は local approval binding へ置き換え済み。
- Editor command hostはDOMとは別にstructured command surfaceを持つ。

推測:

- 現在の「巨大1ページ」感は、機能数だけでなく、人間向け操作、debug/evidence、diagnostics、machine/test-facing refsが同じ可視workspaceへ同時に並ぶことが主因の一つと思われる。
- operation/evidence系の可視textは、人間向け表示であると同時にE2E oracleとしての役割が強い可能性が高い。

未確認:

- 実ブラウザでの見た目、スクリーンショット、viewport別視認性は今回確認していない。
- すべてのunit tests / E2Eを行単位で完全監査したわけではない。
- 外部Codex運用が可視DOM textを直接読むかは未確認。
- Product Preflight command型は `packages/ai-interface` に存在するが、現Editorの `EditorAiCommandHost` command unionには含まれていない。UI整理前に必要なDOM非依存surfaceが足りているかは未決。
- UX-FEAT-019のstructural scaffoldはread projectionがあるが、structural-specific execute/stale command parityは未実装扱いである。

## 10. 次にユーザーと議論すべき論点

1. 通常workspaceで常時表示したい最小セットは何か。候補は UX-FEAT-001, UX-FEAT-004, UX-FEAT-005, UX-FEAT-008 と、必要に応じて UX-FEAT-002。
2. toolbox / modal task / side panel / inspector / drawer のどれを、UX-FEAT-013〜019、UX-FEAT-028〜032、UX-FEAT-033〜036へ適用するか。
3. PSD Import系、特に UX-FEAT-018/019 は、Wave51でproduction `data-testid` couplingを外した前提で、task shellへの移動、human summary、test-facing structured surface、Diagnostics / Evidence導線をどう分けるか。
4. Operation/evidence詳細 UX-FEAT-033〜036 を通常UIから外す場合、E2E oracleをどのsurfaceに残すか。
5. Product Preflight UX-FEAT-028/029 は、人間向けsummaryとmachine/evidence向けdetailsを分けるか。
6. Codex Proposal Review / AI Approval / AI Transcript UX-FEAT-030〜032 は、通常authoring UIの機能として見せるか、Codex/evidence専用viewとして扱うか。
7. Rig/composition/dynamics UX-FEAT-020〜025 は常時authoring controlsか、選択中targetに応じるcontextual inspector/tool panelか。
8. Codex-facing structured command host UX-FEAT-037 に、UI整理で通常UIから外した情報を追加すべきかどうか。
