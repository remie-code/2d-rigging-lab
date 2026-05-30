import type { RectDto } from "@private-2d-rigging-lab/contracts";
import type {
  ModelPartDto,
  SourceAssetDto
} from "@private-2d-rigging-lab/package-format";

import {
  projectDiagnosticSummary,
  type DiagnosticSummaryInput,
  type EditorDiagnosticSummary
} from "./diagnostic-summary.js";

export type CreateDrawableDraftStatus = "idle" | "submitting" | "committed" | "rejected";

export interface CreateDrawableFormState {
  readonly status: CreateDrawableDraftStatus;
  readonly displayName: string;
  readonly sourceAssetId: string;
  readonly sourceLayerId: string | null;
  readonly partId: string;
  readonly initialBounds: RectDto;
  readonly meshMethod: "auto-grid-v1";
  readonly densityHint: "medium";
  readonly diagnostics: readonly EditorDiagnosticSummary[];
}

export interface CreateDrawableDefaultsInput {
  readonly sourceAssets?: readonly SourceAssetDto[];
  readonly parts?: readonly ModelPartDto[];
  readonly canvasSize?: {
    readonly width: number;
    readonly height: number;
  };
}

export const createEmptyDrawableFormState = (): CreateDrawableFormState => ({
  status: "idle",
  displayName: "Generated Drawable",
  sourceAssetId: "",
  sourceLayerId: null,
  partId: "",
  initialBounds: { x: 0, y: 0, width: 32, height: 32 },
  meshMethod: "auto-grid-v1",
  densityHint: "medium",
  diagnostics: []
});

export const projectCreateDrawableDefaults = (
  input: CreateDrawableDefaultsInput = {}
): CreateDrawableFormState => {
  const sourceAsset = input.sourceAssets?.[0];
  const sourceLayer = sourceAsset?.layers[0];
  const part = input.parts?.[0];

  return {
    ...createEmptyDrawableFormState(),
    sourceAssetId: sourceAsset?.sourceAssetId ?? "",
    sourceLayerId: sourceLayer?.sourceLayerId ?? null,
    partId: part?.partId ?? "",
    initialBounds: structuredClone(
      sourceLayer?.bounds ?? {
        x: 0,
        y: 0,
        width: Math.min(32, input.canvasSize?.width ?? 32),
        height: Math.min(32, input.canvasSize?.height ?? 32)
      }
    )
  };
};

export const applyCreateDrawableDraftResult = (
  state: CreateDrawableFormState,
  input: {
    readonly status: Exclude<CreateDrawableDraftStatus, "idle" | "submitting">;
    readonly diagnostics?: readonly DiagnosticSummaryInput[];
  }
): CreateDrawableFormState => ({
  ...state,
  status: input.status,
  diagnostics: (input.diagnostics ?? []).map(projectDiagnosticSummary)
});
