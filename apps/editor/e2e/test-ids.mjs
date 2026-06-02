export const editorTestIds = {
  shell: "editor.shell",
  packageStatus: "editor.packageStatus",
  packageRevision: "editor.packageRevision",
  parameterList: "parameter.list",
  parameterCreateForm: "parameter.create.form",
  parameterCreateSubmit: "parameter.create",
  drawableAuthoringPanel: "drawableAuthoring.panel",
  drawableCreateForm: "drawable.create.form",
  drawableCreateSubmit: "drawable.create",
  drawableList: "drawable.list",
  drawableLayerStatus: "drawable.layer.status",
  layerTreePanel: "layerTree.panel",
  layerTreeSummary: "layerTree.summary",
  layerTreeCreatePartForm: "layerTree.part.create.form",
  layerTreeCreatePartSubmit: "layerTree.part.create",
  layerTreeUpdatePartForm: "layerTree.part.update.form",
  layerTreeUpdatePartSubmit: "layerTree.part.update",
  layerTreeAssignPartForm: "layerTree.drawable.part.form",
  layerTreeAssignPartSubmit: "layerTree.drawable.part",
  layerTreeAssignTextureForm: "layerTree.drawable.texture.form",
  layerTreeAssignTextureSubmit: "layerTree.drawable.texture",
  meshVertexControls: "meshVertex.controls",
  meshVertexStatus: "meshVertex.status",
  meshCanvasEditor: "meshCanvas.editor",
  meshCanvasSurface: "meshCanvas.surface",
  meshCanvasStatus: "meshCanvas.status",
  sourceIntakePanel: "sourceIntake.panel",
  sourceIntakeForm: "sourceIntake.form",
  sourceIntakeSubmit: "sourceIntake.confirm",
  sourceIntakeSummary: "sourceIntake.summary",
  sourceIntakeImportedSources: "sourceIntake.importedSources",
  sourceIntakeDiagnostics: "sourceIntake.diagnostics",
  sourceIntakeLayerRows: "sourceIntake.layerRows",
  sourceIntakeAddLayer: "sourceIntake.addLayer",
  sourceIntakeManifestPath: "sourceIntake.manifestPath",
  sourceIntakePlacementPolicy: "sourceIntake.placementPolicy",
  sourceIntakeRightsStatus: "sourceIntake.rightsStatus",
  dynamicsPanel: "dynamics.panel",
  dynamicsCreateForm: "dynamics.create.form",
  dynamicsCreateSubmit: "dynamics.create",
  dynamicsPreviewRun: "dynamics.preview.run",
  dynamicsPreviewReset: "dynamics.preview.reset",
  dynamicsPreviewEvidence: "dynamics.preview.evidence",
  dynamicsPreviewOutputs: "dynamics.preview.outputs",
  dynamicsValidatorDiagnostics: "dynamics.validator.diagnostics",
  drawableResult: "drawable.result",
  operationStatus: "operation.status",
  projectPersistencePanel: "projectPersistence.panel",
  projectPersistenceSave: "projectPersistence.save",
  projectPersistenceLoad: "projectPersistence.load",
  projectPersistenceReset: "projectPersistence.reset",
  projectPersistenceStatus: "projectPersistence.status",
  projectPersistenceSummary: "projectPersistence.summary",
  operationLogSummary: "operationLog.summary",
  generatedEvidenceSummary: "evidence.generated.summary",
  reloadSummary: "package.reload.summary",
  previewPanel: "preview.panel",
  previewVisual: "preview.visual",
  previewSummary: "preview.summary",
  previewReset: "preview.reset",
  previewEmpty: "preview.empty",
  viewerRuntimeOpen: "viewerRuntime.open",
  viewerRuntimePanel: "viewerRuntime.panel",
  viewerRuntimeClose: "viewerRuntime.close",
  viewerRuntimeReset: "viewerRuntime.reset",
  viewerRuntimeSnapshotSummary: "viewerRuntime.snapshotSummary",
  viewerRuntimeDiff: "viewerRuntime.diff",
  viewerRuntimeDiagnostics: "viewerRuntime.diagnostics",
  viewerRuntimePackageState: "viewerRuntime.packageState",
  tutorialWorkflowPanel: "tutorialWorkflow.panel",
  tutorialWorkflowCreate: "tutorialWorkflow.create",
  tutorialWorkflowSmallEdit: "tutorialWorkflow.smallEdit",
  tutorialWorkflowTargetSelect: "tutorialWorkflow.targetSelect",
  tutorialWorkflowSteps: "tutorialWorkflow.steps",
  tutorialWorkflowNonGoals: "tutorialWorkflow.nonGoals",
  compositionPanel: "composition.panel",
  compositionMaskRelationForm: "composition.maskRelation.form",
  compositionMaskRelationSubmit: "composition.maskRelation.commit",
  compositionMaskRelationList: "composition.maskRelation.list",
  compositionOpacityKeyformForm: "composition.opacityKeyform.form",
  compositionOpacityKeyformSubmit: "composition.opacityKeyform.commit",
  compositionOpacityKeyformList: "composition.opacityKeyform.list",
  compositionEvidence: "composition.evidence",
  compositionDiagnostics: "composition.diagnostics",
  rigControlPanel: "rigControl.panel",
  rigControlCreateForm: "rigControl.create.form",
  rigControlCreateSubmit: "rigControl.create",
  rigControlBindForm: "rigControl.bind.form",
  rigControlBindSubmit: "rigControl.bind",
  rigControlKeyformForm: "rigControl.keyform.form",
  rigControlKeyformSubmit: "rigControl.keyform",
  rigControlList: "rigControl.list",
  rigControlKeyformList: "rigControl.keyform.list",
  rigControlEvidence: "rigControl.evidence",
  rigControlDiagnostics: "rigControl.diagnostics",
  aiApprovalPanel: "aiApproval.panel",
  aiApprovalStatus: "aiApproval.status",
  aiApprovalResultSummary: "aiApproval.resultSummary",
  aiApprovalLatestTranscriptEntry: "aiApproval.latestTranscriptEntry",
  aiApprovalDryRun: "aiApproval.dryRun",
  aiApprovalApprove: "aiApproval.approve",
  aiApprovalReject: "aiApproval.reject",
  aiApprovalCommit: "aiApproval.commit",
  aiTranscriptPanel: "aiTranscript.panel",
  aiTranscriptEmpty: "aiTranscript.empty",
  aiTranscriptEvents: "aiTranscript.events"
};

export const editorProjectStorageKey = "private-2d-rigging-lab.editor-project";

export const createAiTranscriptEventRowTestId = (index) => `aiTranscript.event.${index}`;

export const createDrawableRowTestId = (drawableId) => `drawable.row.${drawableId}`;

export const createDrawableVisibilityToggleTestId = (drawableId) =>
  `drawable.visibility.${drawableId}`;

export const createDrawableMoveUpTestId = (drawableId) =>
  `drawable.moveUp.${drawableId}`;

export const createDrawableMoveDownTestId = (drawableId) =>
  `drawable.moveDown.${drawableId}`;

export const createLayerTreePartGroupTestId = (partId) =>
  `layerTree.part.${partId}`;

export const createLayerTreeDrawableRowTestId = (drawableId) =>
  `layerTree.drawable.${drawableId}`;

export const createLayerTreeSelectDrawableTestId = (drawableId) =>
  `layerTree.select.${drawableId}`;

export const createLayerTreeToggleLockTestId = (drawableId) =>
  `layerTree.lock.${drawableId}`;

export const createLayerTreeToggleEditorHiddenTestId = (drawableId) =>
  `layerTree.editorHidden.${drawableId}`;

export const createMeshVertexRowTestId = (meshId, vertexId) =>
  `meshVertex.row.${meshId}.${vertexId}`;

export const createMeshVertexNudgeButtonTestId = (meshId, vertexId, direction) =>
  `meshVertex.nudge.${meshId}.${vertexId}.${direction}`;

export const createMeshCanvasVertexTestId = (meshId, vertexId) =>
  `meshCanvas.vertex.${meshId}.${vertexId}`;

export const createMeshCanvasNudgeButtonTestId = (direction) =>
  `meshCanvas.nudge.${direction}`;

export const createSourceIntakeLayerRowTestId = (sourceLayerId) =>
  `sourceIntake.layer.${sourceLayerId}`;

export const createImportedSourceAssetRowTestId = (sourceAssetId) =>
  `sourceIntake.imported.${sourceAssetId}`;

export const createPreviewParameterControlTestId = (parameterId) =>
  `preview.parameter.${parameterId}`;

export const createViewerParameterControlTestId = (parameterId) =>
  `viewer.parameter.${parameterId}`;

export const createViewerRuntimeMeshEvidenceRowTestId = (drawableId) =>
  `viewerRuntime.meshEvidence.${drawableId}`;

export const createDynamicsGroupUpdateTestId = (dynamicsGroupId) =>
  `dynamics.update.${dynamicsGroupId}`;

export const createRigControlRowTestId = (rigControlId) =>
  `rigControl.row.${rigControlId}`;
