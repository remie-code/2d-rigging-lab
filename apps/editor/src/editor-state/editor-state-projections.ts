import {
  createInitialEditorSemanticState,
  type EditorSemanticState
} from "./editor-semantic-state.js";
import {
  applyCreateDrawableDraftResult,
  projectCreateDrawableDefaults,
  projectCreateDrawableDefaultsForSourceSelection
} from "./create-drawable-form-state.js";
import { projectDrawableList } from "./drawable-list-state.js";
import {
  projectGeneratedEvidenceSummary,
  type GeneratedEvidenceSummaryInput
} from "./generated-evidence-summary.js";
import { projectMeshEditState } from "./mesh-edit-state.js";
import {
  projectOperationLogSummary,
  type OperationLogEntryProjectionInput
} from "./operation-log-summary.js";
import {
  projectOperationResultSummary,
  type OperationResultSummaryInput
} from "./operation-result-summary.js";
import {
  projectLoadedPackageIdentity,
  type LoadedPackageIdentityInput
} from "./package-identity-state.js";
import { projectPackageRevision, type PackageRevisionInput } from "./package-revision-state.js";
import { projectParameterList, type ParameterProjectionInput } from "./parameter-list-state.js";
import { projectPreviewParameterValues } from "./preview-parameter-state.js";
import { projectReloadSummary, type ReloadSummaryInput } from "./reload-summary.js";
import { createEmptySourceIntakeDraftState } from "./source-intake-draft-state.js";
import type {
  DrawableDto,
  DrawOrderEntryDto,
  MeshDto,
  ModelPartDto,
  SourceAssetDto
} from "@private-2d-rigging-lab/package-format";

export interface LoadedPackageSummaryInput {
  readonly identity: LoadedPackageIdentityInput;
  readonly revision: PackageRevisionInput;
  readonly parameters?: readonly ParameterProjectionInput[];
  readonly drawables?: readonly DrawableDto[];
  readonly drawOrderEntries?: readonly DrawOrderEntryDto[];
  readonly meshes?: readonly MeshDto[];
  readonly parts?: readonly ModelPartDto[];
  readonly sourceAssets?: readonly SourceAssetDto[];
  readonly canvasSize?: {
    readonly width: number;
    readonly height: number;
  };
}

export interface CommittedOperationSummaryInput {
  readonly result: OperationResultSummaryInput;
  readonly operationLogEntries: readonly OperationLogEntryProjectionInput[];
  readonly generatedEvidence?: GeneratedEvidenceSummaryInput;
  readonly revision?: PackageRevisionInput;
  readonly parameters?: readonly ParameterProjectionInput[];
  readonly drawables?: readonly DrawableDto[];
  readonly drawOrderEntries?: readonly DrawOrderEntryDto[];
  readonly meshes?: readonly MeshDto[];
  readonly sourceAssets?: readonly SourceAssetDto[];
  readonly parts?: readonly ModelPartDto[];
  readonly canvasSize?: {
    readonly width: number;
    readonly height: number;
  };
  readonly importedSourceSelection?: {
    readonly sourceAssetId: string;
    readonly sourceLayerId?: string;
    readonly textureId?: string;
    readonly partId?: string;
  };
  readonly reload?: ReloadSummaryInput;
}

export const projectLoadedPackageState = (
  input: LoadedPackageSummaryInput
): EditorSemanticState => {
  const drawables = projectDrawableList(
    input.drawables ?? [],
    input.meshes ?? [],
    input.drawOrderEntries ?? []
  );

  return {
    ...createInitialEditorSemanticState(),
    loadedPackage: projectLoadedPackageIdentity(input.identity),
    revision: projectPackageRevision(input.revision),
    parameters: projectParameterList(input.parameters ?? []),
    drawables,
    meshEdit: projectMeshEditState(drawables, input.meshes ?? []),
    pendingCreateDrawable: projectCreateDrawableDefaults({
      ...(input.sourceAssets === undefined ? {} : { sourceAssets: input.sourceAssets }),
      ...(input.drawables === undefined ? {} : { drawables: input.drawables }),
      ...(input.parts === undefined ? {} : { parts: input.parts }),
      ...(input.canvasSize === undefined ? {} : { canvasSize: input.canvasSize })
    }),
    sourceIntakeDraft: createEmptySourceIntakeDraftState({
      defaultPartId: input.parts?.[0]?.partId ?? ""
    }),
    sourceAssets: input.sourceAssets ?? [],
    previewParameters: projectPreviewParameterValues(input.parameters ?? [])
  };
};

export const applyCommittedOperationSummary = (
  state: EditorSemanticState,
  input: CommittedOperationSummaryInput
): EditorSemanticState => {
  const drawables =
    input.drawables === undefined
      ? state.drawables
      : projectDrawableList(input.drawables, input.meshes ?? [], input.drawOrderEntries ?? []);
  const meshEdit =
      input.drawables === undefined && input.meshes === undefined
      ? state.meshEdit
      : projectMeshEditState(drawables, input.meshes ?? []);
  const sourceAssets = input.sourceAssets ?? state.sourceAssets;
  const pendingCreateDrawable = projectCommittedCreateDrawableDraft(state, input, sourceAssets);

  return {
    ...state,
    revision: input.revision === undefined ? state.revision : projectPackageRevision(input.revision),
    parameters: input.parameters === undefined ? state.parameters : projectParameterList(input.parameters),
    drawables,
    meshEdit,
    previewParameters:
      input.parameters === undefined
        ? state.previewParameters
        : projectPreviewParameterValues(input.parameters),
    pendingCreateParameter:
      input.result.operationType === "createParameter"
        ? {
            ...state.pendingCreateParameter,
            status: input.result.status === "committed" ? "committed" : "rejected",
            diagnostics: (input.result.diagnostics ?? []).map((diagnostic) => ({
              checkId: diagnostic.checkId,
              severity:
                diagnostic.severity === "info" ||
                diagnostic.severity === "warning" ||
                diagnostic.severity === "error" ||
                diagnostic.severity === "blocking"
                  ? diagnostic.severity
                  : "warning",
              message: diagnostic.message,
              ...(diagnostic.phase === undefined ? {} : { phase: diagnostic.phase })
            }))
          }
        : state.pendingCreateParameter,
    pendingCreateDrawable,
    sourceAssets,
    lastOperationResult: projectOperationResultSummary(input.result),
    operationLog: projectOperationLogSummary(input.operationLogEntries),
    generatedEvidence: projectGeneratedEvidenceSummary(input.generatedEvidence ?? {}),
    reload: input.reload === undefined ? state.reload : projectReloadSummary(input.reload)
  };
};

const projectCommittedCreateDrawableDraft = (
  state: EditorSemanticState,
  input: CommittedOperationSummaryInput,
  sourceAssets: readonly SourceAssetDto[]
) => {
  if (
    input.result.operationType === "importSplitPngSourceAsset" &&
    input.result.status === "committed" &&
    input.importedSourceSelection !== undefined
  ) {
    return projectCreateDrawableDefaultsForSourceSelection({
      sourceAssets,
      parts: input.parts ?? [],
      drawables: input.drawables ?? [],
      ...(input.canvasSize === undefined ? {} : { canvasSize: input.canvasSize }),
      preferredSourceAssetId: input.importedSourceSelection.sourceAssetId,
      ...(input.importedSourceSelection.sourceLayerId === undefined
        ? {}
        : { preferredSourceLayerId: input.importedSourceSelection.sourceLayerId }),
      ...(input.importedSourceSelection.textureId === undefined
        ? {}
        : { preferredTextureId: input.importedSourceSelection.textureId }),
      ...(input.importedSourceSelection.partId === undefined
        ? {}
        : { preferredPartId: input.importedSourceSelection.partId })
    });
  }

  if (input.result.operationType === "createDrawable" || input.result.operationType === "generateMesh") {
    return applyCreateDrawableDraftResult(state.pendingCreateDrawable, {
      status: input.result.status === "committed" ? "committed" : "rejected",
      ...(input.result.diagnostics === undefined ? {} : { diagnostics: input.result.diagnostics })
    });
  }

  return state.pendingCreateDrawable;
};
