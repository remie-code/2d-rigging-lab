import type {
  EditorImportSplitPngSourceAssetCommand,
  EditorSessionPersistenceResult
} from "../editor-session/index.js";
import type { SourceIntakeDraftState } from "../editor-state/index.js";

export interface EditorWorkflowSourceImportCommitResult {
  readonly status: "committed" | "rejected";
  readonly result: EditorSessionPersistenceResult;
}

export const createSourceIntakeImportCommand = (
  draft: SourceIntakeDraftState,
  packageRevision: number
): EditorImportSplitPngSourceAssetCommand => ({
  operationId: createSourceImportOperationId(draft.sourceAssetId, packageRevision),
  sourceAssetId: draft.sourceAssetId,
  manifestPath: draft.manifestPath,
  ...(draft.contentHash.length === 0 ? {} : { contentHash: draft.contentHash }),
  ...(draft.defaultPartId.length === 0 ? {} : { defaultPartId: draft.defaultPartId }),
  placementPolicy: draft.placementPolicy,
  layers: draft.layers.map((layer) => ({
    sourceLayerId: layer.sourceLayerId,
    originalName: layer.originalName,
    normalizedName: layer.normalizedName,
    groupPath: [...layer.groupPath],
    bounds: structuredClone(layer.bounds),
    visibleInSource: layer.visibleInSource,
    opacityInSource: layer.opacityInSource,
    role: layer.role,
    unsupportedFeatures: [...layer.unsupportedFeatures]
  })),
  rights: {
    rightsStatus: draft.rights.rightsStatus,
    license: draft.rights.license,
    redistributionAllowed: draft.rights.redistributionAllowed
  },
  provenance: {
    creator: draft.rights.creator,
    ...(draft.rights.sourceUrl.length === 0 ? {} : { sourceUrl: draft.rights.sourceUrl }),
    license: draft.rights.license,
    redistributionAllowed: draft.rights.redistributionAllowed,
    aiUsed: draft.rights.aiUsed,
    transformHistory:
      draft.rights.notes.length === 0 ? [] : [`source-intake-note:${draft.rights.notes}`]
  }
});

export const projectImportedSourceSelection = (
  draft: SourceIntakeDraftState
): {
  readonly sourceAssetId: string;
  readonly sourceLayerId?: string;
} => {
  const layer = draft.layers.find((candidate) => candidate.role === "editableLayer") ?? draft.layers[0];

  return {
    sourceAssetId: draft.sourceAssetId,
    ...(layer === undefined ? {} : { sourceLayerId: layer.sourceLayerId })
  };
};

export const applySourceImportResultToDraft = (
  draft: SourceIntakeDraftState,
  result: EditorSessionPersistenceResult
): SourceIntakeDraftState => ({
  ...draft,
  status: result.operationResult.status === "committed" ? "confirmed" : "idle",
  diagnostics: collectSourceImportDiagnostics(result)
});

const createSourceImportOperationId = (
  sourceAssetId: string,
  packageRevision: number
): string =>
  `op_editor_import_split_png_source_${sanitizeOperationIdToken(sourceAssetId)}_r${packageRevision}`;

const collectSourceImportDiagnostics = (
  result: EditorSessionPersistenceResult
): readonly string[] => {
  const diagnostics = [
    ...result.operationResult.precondition.diagnostics,
    ...result.operationResult.diagnostics
  ];

  return [
    ...new Set(diagnostics.map((diagnostic) => `${diagnostic.checkId}: ${diagnostic.message}`))
  ];
};

const sanitizeOperationIdToken = (text: string): string =>
  text.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
