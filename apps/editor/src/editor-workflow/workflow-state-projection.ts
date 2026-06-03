import type { OperationLogEntryDto } from "@private-2d-rigging-lab/operation-core";
import type { PackageDocumentDto, PackageFileSet } from "@private-2d-rigging-lab/package-format";

import type {
  EditorSessionAdapter,
  EditorSessionPersistenceResult
} from "../editor-session/index.js";
import {
  applyCommittedOperationSummary,
  projectGeneratedEvidenceSummary,
  projectLoadedPackageState,
  projectOperationLogSummary,
  projectReloadSummary,
  projectTutorialGuidedWorkflowState,
  type EditorSemanticState,
  type ProjectEditorBinaryByteIntakeStateInput
} from "../editor-state/index.js";
import {
  projectTutorialReadinessPreflightFromActiveSession,
  projectTutorialReadinessPreflightFromPackageDocument
} from "./tutorial-readiness-preflight-workflow.js";

export const createEditorWorkflowState = (
  adapter: EditorSessionAdapter,
  options: {
    readonly now?: () => Date;
  } = {}
): EditorSemanticState => {
  const tutorialReadinessPreflight = projectTutorialReadinessPreflightFromActiveSession({
    adapter,
    packageDocument: adapter.baseDocument,
    ...(options.now === undefined ? {} : { now: options.now })
  });

  return projectLoadedPackageState({
    identity: adapter.baseDocument.manifest,
    revision: {
      packageRevision: adapter.authoringSession.packageRevision,
      authoringRevision: adapter.authoringSession.authoringRevision
    },
    parameters: adapter.baseDocument.model.parameters.parameters,
    dynamicsGroups: adapter.baseDocument.model.dynamics.dynamicsGroups,
    rigControls: adapter.baseDocument.model.rigControls.rigControls,
    keyformSets: adapter.baseDocument.model.keyforms.keyformSets,
    masks: adapter.baseDocument.model.masks.masks,
    drawables: adapter.baseDocument.model.drawables.drawables,
    drawOrderEntries: adapter.baseDocument.model.drawOrder.entries,
    meshes: adapter.baseDocument.model.meshes.meshes,
    parts: adapter.baseDocument.model.graph.parts,
    ...(adapter.baseDocument.model.editorState === undefined
      ? {}
      : { editorState: adapter.baseDocument.model.editorState }),
    sourceAssets: adapter.baseDocument.assets.sourceManifest.sourceAssets,
    ...(adapter.baseDocument.assets.textureAtlas === undefined
      ? {}
      : { textureAtlas: adapter.baseDocument.assets.textureAtlas }),
    canvasSize: adapter.baseDocument.model.graph.canvasSize,
    tutorialReadinessPreflight
  });
};

export const applyEditorWorkflowCommitResult = (
  state: EditorSemanticState,
  adapter: EditorSessionAdapter,
  result: EditorSessionPersistenceResult,
  options: {
    readonly now?: () => Date;
    readonly importedSourceSelection?: {
      readonly sourceAssetId: string;
      readonly sourceLayerId?: string;
      readonly textureId?: string;
      readonly partId?: string;
    };
  } = {}
): EditorSemanticState => {
  const tutorialReadinessPreflight = projectTutorialReadinessPreflightFromActiveSession({
    adapter,
    packageDocument: result.reloadedDocument,
    ...(options.now === undefined ? {} : { now: options.now })
  });

  return applyCommittedOperationSummary(state, {
    result: {
      ...result.operationResult,
      operationType: result.operationType
    },
    operationLogEntries: result.operationLogEntries,
    generatedEvidence: {
      runtimeSnapshotIds: result.operationResult.generatedRuntimeSnapshotIds,
      runtimeStateArtifactPaths: result.evidence.generatedRuntimeStateRefs,
      runtimeStateSequenceArtifactPaths: result.evidence.generatedRuntimeStateSequenceRefs,
      validationReportIds: result.evidence.generatedValidationReportIds,
      validationReportArtifactPaths: result.evidence.validationArtifactPaths
    },
    revision: {
      packageRevision: result.packageRevisionAfterCommit,
      authoringRevision: adapter.authoringSession.authoringRevision
    },
    parameters: result.reloadedDocument.model.parameters.parameters,
    dynamicsGroups: result.reloadedDocument.model.dynamics.dynamicsGroups,
    rigControls: result.reloadedDocument.model.rigControls.rigControls,
    keyformSets: result.reloadedDocument.model.keyforms.keyformSets,
    masks: result.reloadedDocument.model.masks.masks,
    drawables: result.reloadedDocument.model.drawables.drawables,
    drawOrderEntries: result.reloadedDocument.model.drawOrder.entries,
    meshes: result.reloadedDocument.model.meshes.meshes,
    sourceAssets: result.reloadedDocument.assets.sourceManifest.sourceAssets,
    ...(result.reloadedDocument.assets.textureAtlas === undefined
      ? {}
      : { textureAtlas: result.reloadedDocument.assets.textureAtlas }),
    binaryByteIntake: {
      sourceAssets: result.reloadedDocument.assets.sourceManifest.sourceAssets,
      ...(result.reloadedDocument.assets.textureAtlas === undefined
        ? {}
        : { textureAtlas: result.reloadedDocument.assets.textureAtlas }),
      byteIntakeSummaries: result.binaryByteEvidence.byteIntakeSummaries,
      packageLocalBinaryFilePaths: result.binaryByteEvidence.packageLocalBinaryFilePaths,
      reloadSource: "operationCommit"
    },
    parts: result.reloadedDocument.model.graph.parts,
    ...(result.reloadedDocument.model.editorState === undefined
      ? {}
      : { editorState: result.reloadedDocument.model.editorState }),
    canvasSize: result.reloadedDocument.model.graph.canvasSize,
    ...(options.importedSourceSelection === undefined
      ? {}
      : { importedSourceSelection: options.importedSourceSelection }),
    tutorialReadinessPreflight,
    reload: {
      status: result.operationResult.status === "committed" ? "reloaded" : "failed",
      source: "operationCommit",
      packageRevision: result.reloadedPackageRevision,
      parameterIds: result.parameterIdsAfterReload,
      drawableIds: result.drawableIdsAfterReload,
      filePaths: result.packageFilePaths
    }
  });
};

export const projectLoadedEditorWorkflowState = (input: {
  readonly document: PackageDocumentDto;
  readonly packageFileSet: PackageFileSet;
  readonly operationLogEntries: readonly OperationLogEntryDto[];
  readonly generatedArtifactPaths: readonly string[];
  readonly binaryByteIntake?: ProjectEditorBinaryByteIntakeStateInput;
  readonly now?: () => Date;
}): EditorSemanticState => {
  const tutorialReadinessPreflight = projectTutorialReadinessPreflightFromPackageDocument({
    packageDocument: input.document,
    ...(input.now === undefined ? {} : { now: input.now })
  });
  const loadedState = projectLoadedPackageState({
    identity: input.document.manifest,
    revision: {
      packageRevision: input.document.manifest.packageRevision,
      authoringRevision: 0
    },
    parameters: input.document.model.parameters.parameters,
    dynamicsGroups: input.document.model.dynamics.dynamicsGroups,
    rigControls: input.document.model.rigControls.rigControls,
    keyformSets: input.document.model.keyforms.keyformSets,
    masks: input.document.model.masks.masks,
    drawables: input.document.model.drawables.drawables,
    drawOrderEntries: input.document.model.drawOrder.entries,
    meshes: input.document.model.meshes.meshes,
    parts: input.document.model.graph.parts,
    ...(input.document.model.editorState === undefined
      ? {}
      : { editorState: input.document.model.editorState }),
    sourceAssets: input.document.assets.sourceManifest.sourceAssets,
    ...(input.document.assets.textureAtlas === undefined
      ? {}
      : { textureAtlas: input.document.assets.textureAtlas }),
    binaryByteIntake: input.binaryByteIntake ?? {
      sourceAssets: input.document.assets.sourceManifest.sourceAssets,
      ...(input.document.assets.textureAtlas === undefined
        ? {}
        : { textureAtlas: input.document.assets.textureAtlas }),
      packageLocalBinaryFilePaths: [],
      reloadSource: "browserLocalLoad"
    },
    canvasSize: input.document.model.graph.canvasSize,
    tutorialReadinessPreflight
  });
  const evidence = projectLoadedEvidenceSummary({
    operationLogEntries: input.operationLogEntries,
    generatedArtifactPaths: input.generatedArtifactPaths
  });
  const operationLog = projectOperationLogSummary(input.operationLogEntries);
  const generatedEvidence = projectGeneratedEvidenceSummary(evidence);
  const reload = projectReloadSummary({
    status: "reloaded",
    source: "browserLocalLoad",
    packageRevision: input.document.manifest.packageRevision,
    parameterIds: input.document.model.parameters.parameters.map(
      (parameter) => parameter.parameterId
    ),
    drawableIds: input.document.model.drawables.drawables.map((drawable) => drawable.drawableId),
    filePaths: input.packageFileSet.map((entry) => entry.path)
  });

  return {
    ...loadedState,
    operationLog,
    generatedEvidence,
    reload,
    tutorialReadinessPreflight,
    tutorialGuidedWorkflow: projectTutorialGuidedWorkflowState(
      {
        loadedPackage: loadedState.loadedPackage,
        parts: loadedState.parts,
        drawables: loadedState.drawables,
        layerTreeDraft: loadedState.layerTreeDraft,
        meshEdit: loadedState.meshEdit,
        textureAtlas: loadedState.textureAtlas,
        maskRelations: loadedState.maskRelations,
        drawableOpacityKeyforms: loadedState.drawableOpacityKeyforms,
        rigControls: loadedState.rigControls,
        rigControlAngleKeyforms: loadedState.rigControlAngleKeyforms,
        dynamicsGroups: loadedState.dynamicsGroups,
        generatedEvidence,
        tutorialReadinessPreflight,
        viewerRuntime: loadedState.viewerRuntime,
        reload
      },
      loadedState.tutorialGuidedWorkflow
    )
  };
};

const projectLoadedEvidenceSummary = (input: {
  readonly operationLogEntries: readonly OperationLogEntryDto[];
  readonly generatedArtifactPaths: readonly string[];
}) => ({
  runtimeSnapshotIds: [
    ...new Set(input.operationLogEntries.flatMap((entry) => entry.runtimeSnapshotIds))
  ],
  runtimeStateArtifactPaths: input.generatedArtifactPaths.filter((path) =>
    path.startsWith("runtime/states/")
  ),
  runtimeStateSequenceArtifactPaths: input.generatedArtifactPaths.filter((path) =>
    path.startsWith("runtime/state-sequences/")
  ),
  validationReportIds: [
    ...new Set(input.operationLogEntries.flatMap((entry) => entry.validationReportIds))
  ],
  validationReportArtifactPaths: input.generatedArtifactPaths.filter((path) =>
    path.startsWith("validation/reports/")
  )
});
