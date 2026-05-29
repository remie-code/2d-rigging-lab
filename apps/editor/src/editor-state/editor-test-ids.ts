export const editorTestIds = {
  shell: "editor.shell",
  packageStatus: "editor.packageStatus",
  packageRevision: "editor.packageRevision",
  parameterList: "parameter.list",
  parameterCreateForm: "parameter.create.form",
  parameterCreateSubmit: "parameter.create",
  operationStatus: "operation.status",
  operationLogSummary: "operationLog.summary",
  generatedEvidenceSummary: "evidence.generated.summary",
  reloadSummary: "package.reload.summary"
} as const;

export const fixedEditorTestIds = Object.values(editorTestIds);

export const createParameterRowTestId = (parameterId: string): string => `parameter.row.${parameterId}`;
