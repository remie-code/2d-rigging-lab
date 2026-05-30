import {
  createInitialEditorSemanticState,
  type EditorSemanticState
} from "./editor-semantic-state.js";
import {
  applyCreateDrawableDraftResult,
  projectCreateDrawableDefaults
} from "./create-drawable-form-state.js";
import { projectDrawableList } from "./drawable-list-state.js";
import {
  projectGeneratedEvidenceSummary,
  type GeneratedEvidenceSummaryInput
} from "./generated-evidence-summary.js";
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
  readonly reload?: ReloadSummaryInput;
}

export const projectLoadedPackageState = (
  input: LoadedPackageSummaryInput
): EditorSemanticState => ({
  ...createInitialEditorSemanticState(),
  loadedPackage: projectLoadedPackageIdentity(input.identity),
  revision: projectPackageRevision(input.revision),
  parameters: projectParameterList(input.parameters ?? []),
  drawables: projectDrawableList(input.drawables ?? [], input.meshes ?? [], input.drawOrderEntries ?? []),
  pendingCreateDrawable: projectCreateDrawableDefaults({
    ...(input.sourceAssets === undefined ? {} : { sourceAssets: input.sourceAssets }),
    ...(input.parts === undefined ? {} : { parts: input.parts }),
    ...(input.canvasSize === undefined ? {} : { canvasSize: input.canvasSize })
  }),
  previewParameters: projectPreviewParameterValues(input.parameters ?? [])
});

export const applyCommittedOperationSummary = (
  state: EditorSemanticState,
  input: CommittedOperationSummaryInput
): EditorSemanticState => ({
  ...state,
  revision: input.revision === undefined ? state.revision : projectPackageRevision(input.revision),
  parameters: input.parameters === undefined ? state.parameters : projectParameterList(input.parameters),
  drawables:
    input.drawables === undefined
      ? state.drawables
      : projectDrawableList(input.drawables, input.meshes ?? [], input.drawOrderEntries ?? []),
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
  pendingCreateDrawable:
    input.result.operationType === "createDrawable" || input.result.operationType === "generateMesh"
      ? applyCreateDrawableDraftResult(state.pendingCreateDrawable, {
          status: input.result.status === "committed" ? "committed" : "rejected",
          ...(input.result.diagnostics === undefined ? {} : { diagnostics: input.result.diagnostics })
        })
      : state.pendingCreateDrawable,
  lastOperationResult: projectOperationResultSummary(input.result),
  operationLog: projectOperationLogSummary(input.operationLogEntries),
  generatedEvidence: projectGeneratedEvidenceSummary(input.generatedEvidence ?? {}),
  reload: input.reload === undefined ? state.reload : projectReloadSummary(input.reload)
});
