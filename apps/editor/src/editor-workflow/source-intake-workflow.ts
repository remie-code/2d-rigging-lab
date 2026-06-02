import type {
  EditorImportPsdSourceAssetCommand,
  EditorImportPsdSourceAssetWithBinaryBytesCommand,
  EditorImportSplitPngSourceAssetCommand,
  EditorSessionAdapter,
  EditorSessionPersistenceResult
} from "../editor-session/index.js";
import {
  createImportPsdSourceAssetOperationRequest,
  createImportSplitPngSourceAssetOperationRequest
} from "../editor-session/index.js";
import {
  projectCreateDrawableDefaultsForSourceSelection,
  type EditorSemanticState,
  type SourceIntakeDraftState,
  type SourceIntakeSelectedFileBytes
} from "../editor-state/index.js";
import {
  PartIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { OperationRequestDto } from "@private-2d-rigging-lab/operation-core";
import { applyEditorWorkflowCommitResult } from "./workflow-state-projection.js";

export interface EditorWorkflowSourceImportCommitResult {
  readonly status: "committed" | "rejected";
  readonly result: EditorSessionPersistenceResult;
}

export interface EditorWorkflowSourceIntakeStateProjection {
  readonly state: EditorSemanticState;
  readonly result: EditorWorkflowSourceImportCommitResult;
}

export type EditorSourceIntakeImportCommand =
  | EditorImportSplitPngSourceAssetCommand
  | EditorImportPsdSourceAssetCommand;

export const createSourceIntakeImportCommand = (
  draft: SourceIntakeDraftState,
  packageRevision: number
): EditorSourceIntakeImportCommand =>
  draft.intakeMode === "psdAdapterProfile"
    ? createPsdSourceIntakeImportCommand(draft, packageRevision)
    : createSplitPngSourceIntakeImportCommand(draft, packageRevision);

export const createSourceIntakeImportOperationRequest = (
  draft: SourceIntakeDraftState,
  packageRevision: number
): OperationRequestDto =>
  draft.intakeMode === "psdAdapterProfile"
    ? createImportPsdSourceAssetOperationRequest(
        createPsdSourceIntakeImportCommand(draft, packageRevision),
        packageRevision
      )
    : createImportSplitPngSourceAssetOperationRequest(
        createSplitPngSourceIntakeImportCommand(draft, packageRevision),
        packageRevision
      );

export const createSourceIntakePsdImportCommandWithBinaryBytes = (
  draft: SourceIntakeDraftState,
  packageRevision: number,
  selectedFileBytes: SourceIntakeSelectedFileBytes
): EditorImportPsdSourceAssetWithBinaryBytesCommand => {
  if (draft.intakeMode !== "psdAdapterProfile") {
    throw new Error("Selected file byte registration is only supported for PSD adapter/profile source intake.");
  }

  const command = createPsdSourceIntakeImportCommand(draft, packageRevision);

  return {
    operationId: command.operationId ?? createSourceImportOperationId(draft, packageRevision),
    sourceAssetId: command.sourceAssetId ?? draft.sourceAssetId,
    fileRef: {
      packageRelativePath: draft.manifestPath
    },
    ...(command.requestedLayerRoles === undefined
      ? {}
      : { requestedLayerRoles: command.requestedLayerRoles }),
    adapterResult: command.adapterResult,
    rights: command.rights,
    selectedFile: {
      fileName: selectedFileBytes.fileName,
      bytes: selectedFileBytes.bytes,
      declaredMediaType: selectedFileBytes.declaredMediaType
    }
  };
};

export const applySelectedFileBytesToSourceIntakeDraft = (
  draft: SourceIntakeDraftState,
  selectedFileBytes: SourceIntakeSelectedFileBytes
): SourceIntakeDraftState => ({
  ...draft,
  selectedFile: {
    fileName: selectedFileBytes.fileName.trim(),
    byteLength: selectedFileBytes.bytes.byteLength,
    declaredMediaType: selectedFileBytes.declaredMediaType.trim(),
    storageStatus: "ephemeral-browser-memory-v1",
    availabilityStatus: "selected-in-current-browser-session-v1",
    commitStatus: "not-committed-v1"
  }
});

export const projectWorkflowSourceIntakeCommitResult = (input: {
  readonly state: EditorSemanticState;
  readonly adapter: EditorSessionAdapter;
  readonly draft: SourceIntakeDraftState;
  readonly result: EditorSessionPersistenceResult;
}): EditorWorkflowSourceIntakeStateProjection => {
  const committedState = applyEditorWorkflowCommitResult(input.state, input.adapter, input.result);
  const importedSourceSelection = projectImportedSourceSelection(input.draft);
  const sourceIntakeDraft = applySourceImportResultToDraft(input.draft, input.result);
  const nextPendingCreateDrawable =
    input.result.operationResult.status !== "committed"
      ? committedState.pendingCreateDrawable
      : projectCreateDrawableDefaultsForSourceSelection({
          sourceAssets: committedState.sourceAssets,
          parts: input.result.reloadedDocument.model.graph.parts,
          drawables: input.result.reloadedDocument.model.drawables.drawables,
          canvasSize: input.result.reloadedDocument.model.graph.canvasSize,
          preferredSourceAssetId: importedSourceSelection.sourceAssetId,
          ...(importedSourceSelection.sourceLayerId === undefined
            ? {}
            : { preferredSourceLayerId: importedSourceSelection.sourceLayerId }),
          ...(importedSourceSelection.textureId === undefined
            ? {}
            : { preferredTextureId: importedSourceSelection.textureId }),
          ...(importedSourceSelection.partId === undefined
            ? {}
            : { preferredPartId: importedSourceSelection.partId })
        });

  return {
    state: {
      ...committedState,
      pendingCreateDrawable: nextPendingCreateDrawable,
      sourceIntakeDraft
    },
    result: {
      status: input.result.operationResult.status === "committed" ? "committed" : "rejected",
      result: input.result
    }
  };
};

const createSplitPngSourceIntakeImportCommand = (
  draft: SourceIntakeDraftState,
  packageRevision: number
): EditorImportSplitPngSourceAssetCommand => ({
  operationId: createSourceImportOperationId(draft, packageRevision),
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
    unsupportedFeatures: [...layer.unsupportedFeatures],
    ...(layer.texturePreviewReference === undefined || layer.texturePreviewReference.trim().length === 0
      ? {}
      : { texturePreviewReference: layer.texturePreviewReference.trim() }),
    ...(layer.textureId === undefined || layer.textureId.trim().length === 0
      ? {}
      : { textureId: layer.textureId.trim() }),
    ...(layer.targetPartId === undefined || layer.targetPartId.trim().length === 0
      ? {}
      : { targetPartId: layer.targetPartId.trim() })
  })),
  rights: {
    rightsStatus: draft.rights.rightsStatus,
    license: draft.rights.license,
    redistributionAllowed: draft.rights.redistributionAllowed
  },
  provenance: createSourceIntakeProvenanceMetadata(draft)
});

const createPsdSourceIntakeImportCommand = (
  draft: SourceIntakeDraftState,
  packageRevision: number
): EditorImportPsdSourceAssetCommand => ({
  operationId: createSourceImportOperationId(draft, packageRevision),
  sourceAssetId: draft.sourceAssetId,
  fileRef: {
    packageRelativePath: draft.manifestPath,
    ...(draft.contentHash.length === 0 ? {} : { contentHash: draft.contentHash })
  },
  requestedLayerRoles: createPsdRequestedLayerRoles(draft),
  adapterResult: createPsdAdapterResultFromDraft(draft),
  rights: {
    creator: draft.rights.creator,
    license: draft.rights.license,
    redistributionAllowed: draft.rights.redistributionAllowed,
    aiUsed: draft.rights.aiUsed
  }
});

export const projectImportedSourceSelection = (
  draft: SourceIntakeDraftState
): {
  readonly sourceAssetId: string;
  readonly sourceLayerId?: string;
  readonly textureId?: string;
  readonly partId?: string;
} => {
  const layer = draft.layers.find((candidate) => candidate.role === "editableLayer") ?? draft.layers[0];
  const textureId = layer?.textureId?.trim();
  const partId = resolveLayerTargetPartId(draft, layer);

  return {
    sourceAssetId: draft.sourceAssetId,
    ...(layer === undefined ? {} : { sourceLayerId: layer.sourceLayerId }),
    ...(textureId === undefined || textureId.length === 0
      ? {}
      : { textureId }),
    ...(partId === undefined
      ? {}
      : { partId })
  };
};

export const applySourceImportResultToDraft = (
  draft: SourceIntakeDraftState,
  result: EditorSessionPersistenceResult
): SourceIntakeDraftState => ({
  ...draft,
  selectedFile: projectCommittedSelectedFileDraft(draft, result),
  status: result.operationResult.status === "committed" ? "confirmed" : "idle",
  diagnostics: collectSourceImportDiagnostics(result)
});

const projectCommittedSelectedFileDraft = (
  draft: SourceIntakeDraftState,
  result: EditorSessionPersistenceResult
): SourceIntakeDraftState["selectedFile"] => {
  if (
    draft.selectedFile === null ||
    result.operationResult.status !== "committed" ||
    !result.binaryByteEvidence.packageLocalBinaryFilePaths.includes(draft.manifestPath)
  ) {
    return draft.selectedFile;
  }

  return {
    ...draft.selectedFile,
    storageStatus: "package-local-current-session-memory-v1",
    availabilityStatus: "available-package-local-bytes-v1",
    commitStatus: "committed-to-package-binary-boundary-v1"
  };
};

const createSourceImportOperationId = (
  draft: SourceIntakeDraftState,
  packageRevision: number
): string =>
  `op_editor_import_${draft.intakeMode === "psdAdapterProfile" ? "psd_profile" : "split_png"}_source_${sanitizeOperationIdToken(draft.sourceAssetId)}_r${packageRevision}`;

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

const createSourceIntakeProvenanceMetadata = (
  draft: SourceIntakeDraftState
): EditorImportSplitPngSourceAssetCommand["provenance"] => ({
  creator: draft.rights.creator,
  ...(draft.rights.sourceUrl.length === 0 ? {} : { sourceUrl: draft.rights.sourceUrl }),
  license: draft.rights.license,
  redistributionAllowed: draft.rights.redistributionAllowed,
  aiUsed: draft.rights.aiUsed,
  transformHistory:
    draft.rights.notes.length === 0 ? [] : [`source-intake-note:${draft.rights.notes}`]
});

const createPsdAdapterResultFromDraft = (
  draft: SourceIntakeDraftState
): EditorImportPsdSourceAssetCommand["adapterResult"] => {
  const sourceGroups = createPsdAdapterSourceGroups(draft);
  const groupIdsByPath = new Map(sourceGroups.map((group) => [group.groupPath.join("/"), group.sourceGroupId]));

  return {
    schemaVersion: "psd-adapter-result-v1",
    sourceProfile: "layered-character-psd-profile-v1",
    adapterName: draft.psdProfile.adapterName,
    canvas: {
      width: draft.psdProfile.canvasWidth,
      height: draft.psdProfile.canvasHeight,
      bounds: {
        x: 0,
        y: 0,
        width: draft.psdProfile.canvasWidth,
        height: draft.psdProfile.canvasHeight
      }
    },
    sourceGroups,
    sourceLayers: draft.layers.map((layer, index) => {
      const groupKey = layer.groupPath.join("/");
      const parentGroupId = groupKey.length === 0 ? undefined : groupIdsByPath.get(groupKey);

      return {
        sourceLayerId: layer.sourceLayerId,
        originalName: layer.originalName,
        normalizedName: layer.normalizedName,
        ...(parentGroupId === undefined ? {} : { parentGroupId }),
        groupPath: [...layer.groupPath],
        sourceOrder: sourceGroups.length + index,
        bounds: structuredClone(layer.bounds),
        visibleInSource: layer.visibleInSource,
        opacityInSource: layer.opacityInSource,
        role: layer.role,
        unsupportedFeatures: layer.unsupportedFeatures.map((feature) =>
          createPsdLayerUnsupportedFeature(layer.sourceLayerId, feature)
        ),
        ...(layer.texturePreviewReference === undefined || layer.texturePreviewReference.trim().length === 0
          ? {}
          : { texturePreviewReference: layer.texturePreviewReference.trim() }),
        ...(layer.textureId === undefined || layer.textureId.trim().length === 0
          ? {}
          : { textureId: TextureIdSchema.parse(layer.textureId.trim()) }),
        ...(layer.targetPartId === undefined || layer.targetPartId.trim().length === 0
          ? {}
          : { targetPartId: PartIdSchema.parse(layer.targetPartId.trim()) })
      };
    }),
    unsupportedFeatures: [],
    diagnostics: [
      {
        checkId: "adapter.psd.manualProfileMetadata",
        severity: "info",
        message: "PSD adapter/profile metadata was entered manually in Source Intake; no PSD bytes were parsed by the editor.",
        source: { kind: "adapter", path: "/source-intake" },
        evidence: ["source-intake-mode:psdAdapterProfile"]
      }
    ]
  };
};

const createPsdAdapterSourceGroups = (
  draft: SourceIntakeDraftState
): EditorImportPsdSourceAssetCommand["adapterResult"]["sourceGroups"] => {
  const groups: EditorImportPsdSourceAssetCommand["adapterResult"]["sourceGroups"] = [];
  const groupIdsByPath = new Map<string, string>();

  for (const layer of draft.layers) {
    let parentGroupId: string | undefined;
    const pathParts: string[] = [];

    for (const groupName of layer.groupPath) {
      pathParts.push(groupName);
      const key = pathParts.join("/");
      const existingGroupId = groupIdsByPath.get(key);
      if (existingGroupId !== undefined) {
        parentGroupId = existingGroupId;
        continue;
      }

      const sourceGroupId = `group_${sanitizeOperationIdToken(key)}`;
      groupIdsByPath.set(key, sourceGroupId);
      groups.push({
        sourceGroupId,
        originalName: groupName,
        normalizedName: sanitizeOperationIdToken(groupName),
        ...(parentGroupId === undefined ? {} : { parentGroupId }),
        groupPath: [...pathParts],
        sourceOrder: groups.length,
        visibleInSource: true,
        opacityInSource: 1,
        unsupportedFeatures: []
      });
      parentGroupId = sourceGroupId;
    }
  }

  return groups;
};

const createPsdRequestedLayerRoles = (
  draft: SourceIntakeDraftState
): Readonly<Record<string, "editableLayer" | "guideImage" | "referenceOnly">> => {
  const roles: Record<string, "editableLayer" | "guideImage" | "referenceOnly"> = {};

  for (const layer of draft.layers) {
    if (layer.role === "unsupported") {
      continue;
    }

    roles[layer.sourceLayerId] = layer.role;
  }

  return roles;
};

const createPsdLayerUnsupportedFeature = (
  sourceLayerId: string,
  featureId: string
): EditorImportPsdSourceAssetCommand["adapterResult"]["sourceLayers"][number]["unsupportedFeatures"][number] => ({
  featureId,
  scope: "layer",
  severity: "warning",
  message: `${featureId} was declared in manual PSD adapter/profile metadata.`,
  source: { kind: "layer", id: sourceLayerId },
  rasterizeCandidate: false,
  manualConfirmationRequired: true
});

const resolveLayerTargetPartId = (
  draft: SourceIntakeDraftState,
  layer: SourceIntakeDraftState["layers"][number] | undefined
): string | undefined => {
  const targetPartId = layer?.targetPartId?.trim();
  if (targetPartId !== undefined && targetPartId.length > 0) {
    return targetPartId;
  }

  const defaultPartId = draft.defaultPartId.trim();
  return defaultPartId.length === 0 ? undefined : defaultPartId;
};
