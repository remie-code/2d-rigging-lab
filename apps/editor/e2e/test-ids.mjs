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
  meshVertexControls: "meshVertex.controls",
  meshVertexStatus: "meshVertex.status",
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

export const createMeshVertexRowTestId = (meshId, vertexId) =>
  `meshVertex.row.${meshId}.${vertexId}`;

export const createMeshVertexNudgeButtonTestId = (meshId, vertexId, direction) =>
  `meshVertex.nudge.${meshId}.${vertexId}.${direction}`;

export const createSourceIntakeLayerRowTestId = (sourceLayerId) =>
  `sourceIntake.layer.${sourceLayerId}`;

export const createImportedSourceAssetRowTestId = (sourceAssetId) =>
  `sourceIntake.imported.${sourceAssetId}`;

export const createPreviewParameterControlTestId = (parameterId) =>
  `preview.parameter.${parameterId}`;
