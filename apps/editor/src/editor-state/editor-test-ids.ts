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

export const createPreviewParameterControlTestId = (parameterId: string): string =>
  `preview.parameter.${parameterId}`;
