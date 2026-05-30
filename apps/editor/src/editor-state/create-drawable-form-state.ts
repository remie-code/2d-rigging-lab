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

export const projectCreateDrawableDefaultsForSourceSelection = (
  input: CreateDrawableDefaultsInput & {
    readonly preferredSourceAssetId: string;
    readonly preferredSourceLayerId?: string;
  }
): CreateDrawableFormState => {
  const sourceAsset = input.sourceAssets?.find(
    (candidate) => candidate.sourceAssetId === input.preferredSourceAssetId
  );
  const sourceLayer =
    input.preferredSourceLayerId === undefined
      ? sourceAsset?.layers.find((layer) => layer.role === "editableLayer") ?? sourceAsset?.layers[0]
      : sourceAsset?.layers.find((layer) => layer.sourceLayerId === input.preferredSourceLayerId);
  const part = input.parts?.[0];
  const layerDisplayName = sourceLayer?.normalizedName ?? sourceLayer?.originalName;

  return {
    ...projectCreateDrawableDefaults(input),
    displayName: layerDisplayName === undefined ? "Imported Drawable" : `Imported ${toTitleLabel(layerDisplayName)}`,
    sourceAssetId: sourceAsset?.sourceAssetId ?? input.preferredSourceAssetId,
    sourceLayerId: sourceLayer?.sourceLayerId ?? input.preferredSourceLayerId ?? null,
    partId: part?.partId ?? "",
    initialBounds: structuredClone(
      sourceLayer?.bounds ?? {
        x: 0,
        y: 0,
        width: Math.min(32, input.canvasSize?.width ?? 32),
        height: Math.min(32, input.canvasSize?.height ?? 32)
      }
    ),
    status: "idle",
    diagnostics: []
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

const toTitleLabel = (value: string): string =>
  value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter((part) => part.length > 0)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
