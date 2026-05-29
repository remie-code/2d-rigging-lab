import type { EditorDiagnosticSummary } from "./diagnostic-summary.js";
import { projectDiagnosticSummary, type DiagnosticSummaryInput } from "./diagnostic-summary.js";

export type OperationResultStatus = "accepted" | "rejected" | "dry_run" | "committed" | "rolled_back";

export interface OperationResultSummaryState {
  readonly operationId: string;
  readonly operationType: string;
  readonly status: OperationResultStatus;
  readonly preconditionOk: boolean;
  readonly reversible: boolean;
  readonly diagnosticCount: number;
  readonly diagnostics: readonly EditorDiagnosticSummary[];
}

export interface OperationResultSummaryInput {
  readonly operationId: string;
  readonly operationType: string;
  readonly status: OperationResultStatus;
  readonly precondition: {
    readonly ok: boolean;
  };
  readonly reversible: boolean;
  readonly diagnostics?: readonly DiagnosticSummaryInput[];
}

export const projectOperationResultSummary = (
  input: OperationResultSummaryInput
): OperationResultSummaryState => {
  const diagnostics = (input.diagnostics ?? []).map(projectDiagnosticSummary);

  return {
    operationId: input.operationId,
    operationType: input.operationType,
    status: input.status,
    preconditionOk: input.precondition.ok,
    reversible: input.reversible,
    diagnosticCount: diagnostics.length,
    diagnostics
  };
};
