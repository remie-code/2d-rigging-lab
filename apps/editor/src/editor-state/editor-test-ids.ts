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
  rigControlDiagnostics: "rigControl.diagnostics"
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

export const createLayerTreePartGroupTestId = (partId: string): string =>
  `layerTree.part.${partId}`;

export const createLayerTreeDrawableRowTestId = (drawableId: string): string =>
  `layerTree.drawable.${drawableId}`;

export const createLayerTreeSelectDrawableTestId = (drawableId: string): string =>
  `layerTree.select.${drawableId}`;

export const createLayerTreeToggleLockTestId = (drawableId: string): string =>
  `layerTree.lock.${drawableId}`;

export const createLayerTreeToggleEditorHiddenTestId = (drawableId: string): string =>
  `layerTree.editorHidden.${drawableId}`;

export const createMeshVertexRowTestId = (meshId: string, vertexId: string): string =>
  `meshVertex.row.${meshId}.${vertexId}`;

export const createMeshVertexNudgeButtonTestId = (
  meshId: string,
  vertexId: string,
  direction: "left" | "right" | "up" | "down"
): string => `meshVertex.nudge.${meshId}.${vertexId}.${direction}`;

export const createMeshCanvasVertexTestId = (meshId: string, vertexId: string): string =>
  `meshCanvas.vertex.${meshId}.${vertexId}`;

export const createMeshCanvasNudgeButtonTestId = (
  direction: "left" | "right" | "up" | "down"
): string => `meshCanvas.nudge.${direction}`;

export const createSourceIntakeLayerRowTestId = (sourceLayerId: string): string =>
  `sourceIntake.layer.${sourceLayerId}`;

export const createImportedSourceAssetRowTestId = (sourceAssetId: string): string =>
  `sourceIntake.imported.${sourceAssetId}`;

export const createPreviewParameterControlTestId = (parameterId: string): string =>
  `preview.parameter.${parameterId}`;

export const createViewerParameterControlTestId = (parameterId: string): string =>
  `viewer.parameter.${parameterId}`;

export const createViewerRuntimeMeshEvidenceRowTestId = (drawableId: string): string =>
  `viewerRuntime.meshEvidence.${drawableId}`;

export const createDynamicsGroupUpdateTestId = (dynamicsGroupId: string): string =>
  `dynamics.update.${dynamicsGroupId}`;

export const createRigControlRowTestId = (rigControlId: string): string =>
  `rigControl.row.${rigControlId}`;
