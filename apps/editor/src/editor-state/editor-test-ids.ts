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
  previewEmpty: "preview.empty"
} as const;

export const fixedEditorTestIds = Object.values(editorTestIds);

export const createParameterRowTestId = (parameterId: string): string => `parameter.row.${parameterId}`;

export const createDrawableRowTestId = (drawableId: string): string => `drawable.row.${drawableId}`;

export const createDrawableVisibilityToggleTestId = (drawableId: string): string =>
  `drawable.visibility.${drawableId}`;

export const createDrawableMoveUpTestId = (drawableId: string): string =>
  `drawable.moveUp.${drawableId}`;

export const createDrawableMoveDownTestId = (drawableId: string): string =>
  `drawable.moveDown.${drawableId}`;

export const createMeshVertexRowTestId = (meshId: string, vertexId: string): string =>
  `meshVertex.row.${meshId}.${vertexId}`;

export const createMeshVertexNudgeButtonTestId = (
  meshId: string,
  vertexId: string,
  direction: "left" | "right" | "up" | "down"
): string => `meshVertex.nudge.${meshId}.${vertexId}.${direction}`;

export const createSourceIntakeLayerRowTestId = (sourceLayerId: string): string =>
  `sourceIntake.layer.${sourceLayerId}`;

export const createImportedSourceAssetRowTestId = (sourceAssetId: string): string =>
  `sourceIntake.imported.${sourceAssetId}`;

export const createPreviewParameterControlTestId = (parameterId: string): string =>
  `preview.parameter.${parameterId}`;

export const createDynamicsGroupUpdateTestId = (dynamicsGroupId: string): string =>
  `dynamics.update.${dynamicsGroupId}`;
