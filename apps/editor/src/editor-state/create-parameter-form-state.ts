import type { EditorDiagnosticSummary } from "./diagnostic-summary.js";

export type CreateParameterFormStatus = "idle" | "ready" | "submitting" | "rejected" | "committed";

export interface CreateParameterFormState {
  readonly displayName: string;
  readonly min: number;
  readonly max: number;
  readonly defaultValue: number;
  readonly recommendedUiStep: number;
  readonly status: CreateParameterFormStatus;
  readonly diagnostics: readonly EditorDiagnosticSummary[];
}

export const createEmptyParameterFormState = (): CreateParameterFormState => ({
  displayName: "",
  min: -1,
  max: 1,
  defaultValue: 0,
  recommendedUiStep: 0.01,
  status: "idle",
  diagnostics: []
});
