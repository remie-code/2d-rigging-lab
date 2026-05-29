export type EditorDiagnosticSeverity = "info" | "warning" | "error" | "blocking";

export interface EditorDiagnosticSummary {
  readonly checkId: string;
  readonly severity: EditorDiagnosticSeverity;
  readonly message: string;
  readonly phase?: string;
}

export interface DiagnosticSummaryInput {
  readonly checkId: string;
  readonly severity: string;
  readonly message: string;
  readonly phase?: string;
}

export const projectDiagnosticSummary = (diagnostic: DiagnosticSummaryInput): EditorDiagnosticSummary => {
  const summary = {
    checkId: diagnostic.checkId,
    severity: toEditorDiagnosticSeverity(diagnostic.severity),
    message: diagnostic.message
  };

  if (diagnostic.phase === undefined) {
    return summary;
  }

  return {
    ...summary,
    phase: diagnostic.phase
  };
};

const toEditorDiagnosticSeverity = (severity: string): EditorDiagnosticSeverity => {
  if (
    severity === "info" ||
    severity === "warning" ||
    severity === "error" ||
    severity === "blocking"
  ) {
    return severity;
  }

  return "warning";
};
