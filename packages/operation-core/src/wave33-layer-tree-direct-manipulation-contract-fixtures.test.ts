import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthoringSessionFromPackageDocument,
  toPackageDocument,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  ModelDiffDto,
  RuntimeDiffDto,
  TargetRefDto,
  ValidationReportId
} from "@private-2d-rigging-lab/contracts";
import {
  PackageDocumentSchema,
  type PackageDocumentDto
} from "../../package-format/src/index.js";
import {
  buildRuntimeEvidence,
  evaluateViewerRuntimeSnapshot
} from "../../runtime-core/src/index.js";
import type {
  NormalizedRuntimeGraph,
  RuntimeEvidenceResult,
  RuntimeSnapshotDto,
  ViewerRuntimeEvaluationResult
} from "../../runtime-core/src/index.js";
import {
  validatePackageRuntime,
  ValidationReportSchema
} from "../../validator-core/src/index.js";
import type { ValidationReportDto } from "../../validator-core/src/index.js";
import { describe, expect, it } from "vitest";

import {
  createOperationCore,
  OperationRequestSchema
} from "./index.js";
import type {
  CommitOperationOutcome,
  OperationRequestDto
} from "./index.js";

const FIXTURE_ID = "wave33-layer-tree-direct-manipulation-contract-fixtures";
const CREATED_AT = "2026-06-02T00:01:00.000Z";
const PACKAGE_HASH = "sha256:wave33-layer-tree-direct-manipulation-contract-fixtures-v1";
const PACKAGE_ID = "pkg_wave33_layer_tree_direct_manipulation";
const ROOT_PART_ID = "part_root";
const PARENT_PART_ID = "part_wave33_parent";
const HEAD_PART_ID = "part_wave33_head";
const EMPTY_PART_ID = "part_wave33_empty";
const DRAWABLE_ID = "draw_body";
const TEXTURE_ID = "tex_wave33";
const TARGET_IDS = [DRAWABLE_ID, PARENT_PART_ID, HEAD_PART_ID] as const;

describe("wave33 layer tree direct manipulation contract fixture", () => {
  it("parses rights-clean semantic fixture requests through operation-core DTOs", () => {
    const requests = loadOperationRequests();
    const rejectedRequest = loadRejectedDeleteRequest();

    expect(loadFixtureJson("fixture-manifest.json")).toMatchObject({
      schemaVersion: "contract-fixture-manifest-v1",
      fixtureId: FIXTURE_ID,
      semanticBoundary: {
        rightsCleanJsonOnly: true,
        realImageBytes: false,
        parserOracle: false,
        rendererOracle: false,
        pixelOracle: false,
        cubismCompatibilityOracle: false,
        externalDependency: false
      }
    });
    expect(PackageDocumentSchema.parse(loadFixtureJson("baseline-package.json")).manifest).toMatchObject({
      packageId: PACKAGE_ID,
      rightsSummary: { status: "cleared" }
    });
    expect(requests.map((request) => ({
      operationId: request.operationId,
      operationType: request.operationType,
      basePackageRevision: request.basePackageRevision,
      dryRun: request.dryRun
    }))).toEqual([
      {
        operationId: "op_wave33_direct_update_head",
        operationType: "updatePart",
        basePackageRevision: 0,
        dryRun: false
      },
      {
        operationId: "op_wave33_direct_set_drawable_part",
        operationType: "setDrawablePart",
        basePackageRevision: 1,
        dryRun: false
      },
      {
        operationId: "op_wave33_direct_set_drawable_texture",
        operationType: "setDrawableTexture",
        basePackageRevision: 2,
        dryRun: false
      },
      {
        operationId: "op_wave33_direct_delete_empty_leaf",
        operationType: "deletePart",
        basePackageRevision: 3,
        dryRun: false
      }
    ]);
    expect(requests[0]?.payload).toMatchObject({
      partId: HEAD_PART_ID,
      displayName: "Wave 33 Head Renamed",
      parentPartId: PARENT_PART_ID
    });
    expect(requests[1]?.payload).toMatchObject({
      drawableId: DRAWABLE_ID,
      partId: HEAD_PART_ID
    });
    expect(requests[2]?.payload).toMatchObject({
      drawableId: DRAWABLE_ID,
      textureId: TEXTURE_ID
    });
    expect(requests[3]?.payload).toMatchObject({
      partId: EMPTY_PART_ID
    });
    expect(rejectedRequest).toMatchObject({
      operationId: "op_wave33_direct_delete_non_empty_parent",
      operationType: "deletePart",
      basePackageRevision: 4,
      payload: { partId: PARENT_PART_ID }
    });
  });

  it("pins direct manipulation operation, runtime, viewer, validator, reload, and preflight evidence", () => {
    const baselineSession = createFixtureSession();
    const baselinePackage = loadBaselinePackageDocument();
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date(CREATED_AT)
    });
    const applied = loadOperationRequests().map((request) => {
      const outcome = core.commitOperation(session, request);

      return {
        request,
        outcome,
        packageRevisionAfter: session.packageRevision,
        authoringRevisionAfter: session.authoringRevision
      };
    });
    const rejectedNonEmptyDelete = core.commitOperation(session, loadRejectedDeleteRequest());
    const materializedPackage = toPackageDocument(session, baselinePackage, {
      updatedAt: CREATED_AT
    });
    const reloadedSession = createAuthoringSessionFromPackageDocument(materializedPackage);
    const runtimeEvidence = buildLayerTreeRuntimeEvidence({
      baselineSession,
      baselinePackage,
      candidateSession: session,
      candidatePackage: materializedPackage
    });
    const viewerResult = evaluateLayerTreeViewerEvidence(session, materializedPackage);
    const validationReport = pinReportId(
      validatePackageRuntime({
        packageDocument: materializedPackage,
        runtimeSnapshot: viewerResult.snapshot,
        viewerEvidence: viewerResult.evidence,
        profile: "viewer",
        createdAt: CREATED_AT
      }),
      "val_wave33_layer_tree_direct_manipulation_final"
    );

    expect(summarizeOperationChain(applied, rejectedNonEmptyDelete, session)).toEqual(
      loadFixtureJson("expected/operation-chain-summary.json")
    );
    expect(summarizePackageMaterialization(materializedPackage, reloadedSession)).toEqual(
      loadFixtureJson("expected/package-materialization-summary.json")
    );
    expect(summarizeRuntimeViewerEvidence(runtimeEvidence, viewerResult)).toEqual(
      loadFixtureJson("expected/runtime-viewer-evidence-summary.json")
    );
    expect(summarizeValidationReport(validationReport)).toEqual(
      loadFixtureJson("expected/validation-report-summary.json")
    );
    expect(loadFixtureJson("expected/editor-persistence-reinspection-summary.json")).toMatchObject({
      saveLoadContract: {
        operationTypes: [
          "updatePart",
          "setDrawablePart",
          "setDrawableTexture",
          "deletePart"
        ],
        renamedPartId: HEAD_PART_ID,
        reparentedParentPartId: PARENT_PART_ID,
        deletedPartId: EMPTY_PART_ID,
        reassignedDrawableId: DRAWABLE_ID,
        assignedTextureId: TEXTURE_ID,
        reinspectPreviewEvidence: true,
        reinspectViewerEvidence: true,
        reinspectValidationEvidence: true
      }
    });
    expect(loadFixtureJson("expected/editor-pending-delete-preflight-summary.json")).toMatchObject({
      preflightContract: {
        productionPath: "layer tree direct manipulation batch commit",
        expectedStatus: "rejected",
        committedCount: 0,
        expectedCheckIds: [
          "editor.layerTreeDirectDraft.drawablePartToPendingDelete"
        ],
        latestSessionPersistenceResult: null,
        operationLogMutationAllowed: false,
        packageGraphMutationAllowed: false,
        draftStatePreserved: true
      },
      semanticBoundary: {
        nativeDragAndDropDependency: false,
        recursiveDelete: false,
        deleteWithReassign: false,
        multiSelectBulkOperation: false
      }
    });
  });
});

interface AppliedOperation {
  readonly request: OperationRequestDto;
  readonly outcome: CommitOperationOutcome;
  readonly packageRevisionAfter: AuthoringSession["packageRevision"];
  readonly authoringRevisionAfter: AuthoringSession["authoringRevision"];
}

const summarizeOperationChain = (
  applied: readonly AppliedOperation[],
  rejectedNonEmptyDelete: CommitOperationOutcome,
  session: AuthoringSession
) => ({
  schemaVersion: "wave33-layer-tree-direct-manipulation-operation-chain-summary-v1",
  fixtureId: FIXTURE_ID,
  packageRevisionAfter: session.packageRevision,
  authoringRevisionAfter: session.authoringRevision,
  operationLogTypes: applied.map(({ outcome }) => requireLogEntry(outcome).operationType),
  operations: applied.map(({ request, outcome, packageRevisionAfter, authoringRevisionAfter }) => {
    const modelDiff = requireModelDiff(outcome);
    const logEntry = requireLogEntry(outcome);

    return {
      operationId: outcome.result.operationId,
      operationType: request.operationType,
      status: outcome.result.status,
      targetIds: logEntry.targetIds,
      changedTargets: summarizeChangedTargets(modelDiff),
      removedTargets: summarizeTargets(modelDiff.removed),
      changedFieldPaths: summarizeChangedFieldPaths(modelDiff),
      packageRevisionAfter,
      authoringRevisionAfter
    };
  }),
  rejectedNonEmptyDelete: {
    operationId: rejectedNonEmptyDelete.result.operationId,
    operationType: loadRejectedDeleteRequest().operationType,
    status: rejectedNonEmptyDelete.result.status,
    operationLogLengthAfter: rejectedNonEmptyDelete.operationLogLength,
    diagnostics: rejectedNonEmptyDelete.result.precondition.diagnostics.map((diagnostic) => ({
      checkId: diagnostic.checkId,
      severity: diagnostic.severity,
      target: diagnostic.target
    }))
  }
});

const summarizePackageMaterialization = (
  packageDocument: PackageDocumentDto,
  reloadedSession: AuthoringSession
) => ({
  schemaVersion: "wave33-layer-tree-direct-manipulation-package-materialization-summary-v1",
  packageId: packageDocument.manifest.packageId,
  packageRevision: packageDocument.manifest.packageRevision,
  updatedAt: packageDocument.manifest.updatedAt,
  parts: packageDocument.model.graph.parts.map((part) => ({
    partId: part.partId,
    displayName: part.displayName,
    parentPartId: part.parentPartId ?? null,
    childPartIds: part.childPartIds,
    drawableIds: part.drawableIds
  })),
  deletedPartAbsent: !packageDocument.model.graph.parts.some((part) => part.partId === EMPTY_PART_ID),
  stableOrder: packageDocument.model.graph.stableOrder,
  drawables: packageDocument.model.drawables.drawables.map((drawable) => ({
    drawableId: drawable.drawableId,
    partId: drawable.partId,
    textureId: drawable.textureId,
    runtimeVisibility: drawable.runtimeVisibility
  })),
  textureAtlasIds: packageDocument.assets.textureAtlas?.textures.map((texture) => texture.textureId) ?? [],
  editorState: {
    selection: packageDocument.model.editorState?.selection ?? [],
    lockedIds: packageDocument.model.editorState?.lockedIds ?? [],
    editorHiddenIds: packageDocument.model.editorState?.editorHiddenIds ?? [],
    activeTool: packageDocument.model.editorState?.activeTool ?? null
  },
  reloadedPackageRevision: reloadedSession.packageRevision,
  reloadedPartIds: reloadedSession.graph.parts.map((part) => part.partId),
  rightsClean: {
    realImageBytes: false,
    imageDecode: false,
    externalDependency: false
  }
});

const buildLayerTreeRuntimeEvidence = (input: {
  readonly baselineSession: AuthoringSession;
  readonly baselinePackage: PackageDocumentDto;
  readonly candidateSession: AuthoringSession;
  readonly candidatePackage: PackageDocumentDto;
}): RuntimeEvidenceResult =>
  buildRuntimeEvidence({
    baselineGraph: toLayerTreeRuntimeGraph(input.baselineSession, input.baselinePackage),
    candidateGraph: toLayerTreeRuntimeGraph(input.candidateSession, input.candidatePackage),
    baseline: { frame: createEvaluationFrame(0) },
    candidate: { frame: createEvaluationFrame(1) },
    options: {
      schemaVersion: "runtime-evaluation-options-v1",
      snapshotDetail: "full"
    },
    context: {
      source: { surface: "validator", operationId: "op_wave33_direct_delete_empty_leaf" },
      policy: { strictness: "strict" }
    },
    artifactLabel: FIXTURE_ID
  });

const evaluateLayerTreeViewerEvidence = (
  session: AuthoringSession,
  packageDocument: PackageDocumentDto
): ViewerRuntimeEvaluationResult =>
  evaluateViewerRuntimeSnapshot(toLayerTreeRuntimeGraph(session, packageDocument), {
    baselineFrameIndex: 20,
    frameIndex: 21,
    operationId: "op_wave33_viewer_layer_tree_direct_manipulation_evidence",
    strictness: "strict",
    targetIds: [...TARGET_IDS],
    options: {
      schemaVersion: "runtime-evaluation-options-v1",
      snapshotDetail: "full"
    }
  });

const toLayerTreeRuntimeGraph = (
  session: AuthoringSession,
  packageDocument: PackageDocumentDto
): NormalizedRuntimeGraph => {
  const baseGraph = toRuntimeGraph(session, { packageHash: PACKAGE_HASH });
  const packagePartsById = new Map(
    packageDocument.model.graph.parts.map((part) => [part.partId, part])
  );
  const packageDrawablesById = new Map(
    packageDocument.model.drawables.drawables.map((drawable) => [drawable.drawableId, drawable])
  );
  const meshesById = new Map(packageDocument.model.meshes.meshes.map((mesh) => [mesh.meshId, mesh]));
  const textureAtlasById = new Map(
    (packageDocument.assets.textureAtlas?.textures ?? []).map((texture) => [texture.textureId, texture])
  );

  return {
    ...baseGraph,
    parts: new Map(
      session.graph.parts.map((part) => {
        const packagePart = packagePartsById.get(part.partId) ?? part;

        return [
          part.partId,
          {
            partId: part.partId,
            displayName: packagePart.displayName,
            ...(packagePart.parentPartId === undefined
              ? {}
              : { parentPartId: packagePart.parentPartId }),
            childPartIds: packagePart.childPartIds,
            drawableIds: packagePart.drawableIds
          }
        ];
      })
    ),
    drawables: new Map(
      [...baseGraph.drawables].map(([drawableId, drawable]) => {
        const packageDrawable = packageDrawablesById.get(drawableId);
        const mesh = packageDrawable === undefined ? undefined : meshesById.get(packageDrawable.meshId);
        const texture =
          packageDrawable?.textureId === undefined
            ? undefined
            : textureAtlasById.get(packageDrawable.textureId);

        return [
          drawableId,
          {
            ...drawable,
            ...(packageDrawable?.partId === undefined ? {} : { partId: packageDrawable.partId }),
            ...(mesh?.uvs === undefined ? {} : { uvs: mesh.uvs }),
            ...(mesh?.triangles === undefined ? {} : { triangles: mesh.triangles }),
            ...(mesh?.vertexStableIds === undefined
              ? {}
              : { vertexStableIds: mesh.vertexStableIds }),
            ...(packageDrawable?.textureId === undefined
              ? {}
              : {
                  texture: {
                    status: "resolved",
                    textureId: packageDrawable.textureId,
                    ...(texture?.sourceAssetId === undefined
                      ? {}
                      : { sourceAssetId: texture.sourceAssetId }),
                    ...(texture?.sourceLayerId === undefined
                      ? {}
                      : { sourceLayerId: texture.sourceLayerId }),
                    ...(mesh?.uvs === undefined
                      ? { projection: { kind: "bounds_fit" } }
                      : { projection: { kind: "uv", uvs: mesh.uvs } })
                  }
                })
          }
        ];
      })
    )
  };
};

const createEvaluationFrame = (frameIndex: number) => ({
  frameIndex,
  deltaTimeMs: 0,
  authoredParameterValues: {},
  targetIds: [...TARGET_IDS]
});

const summarizeRuntimeViewerEvidence = (
  runtimeEvidence: RuntimeEvidenceResult,
  viewerResult: ViewerRuntimeEvaluationResult
) => ({
  schemaVersion: "wave33-layer-tree-direct-manipulation-runtime-viewer-evidence-summary-v1",
  runtimeEvidence: {
    baselineSnapshotId: runtimeEvidence.baselineSnapshot.snapshotId,
    candidateSnapshotId: runtimeEvidence.candidateSnapshot.snapshotId,
    generatedRuntimeSnapshotIds: runtimeEvidence.generatedRuntimeSnapshotIds,
    candidateParts: summarizeParts(runtimeEvidence.candidateSnapshot),
    candidateDrawableLayers: summarizeDrawableLayers(runtimeEvidence.candidateSnapshot),
    drawList: runtimeEvidence.candidateSnapshot.drawList,
    runtimeDiff: summarizeRuntimeDiff(runtimeEvidence.runtimeDiff)
  },
  viewerEvidence: {
    surface: viewerResult.evidence.surface,
    baselineSnapshotId: viewerResult.evidence.baselineSnapshotId,
    snapshotId: viewerResult.evidence.snapshotId,
    targetIds: viewerResult.evidence.targetIds,
    partHierarchyEvidence: viewerResult.evidence.partHierarchyEvidence,
    drawableLayerEvidence: viewerResult.evidence.drawableLayerEvidence.map((drawable) => ({
      drawableId: drawable.drawableId,
      partId: drawable.partId ?? null,
      runtimeVisible: drawable.runtimeVisible,
      textureStatus: drawable.textureStatus,
      textureId: drawable.textureId ?? null
    })),
    runtimeDiffEquivalent: viewerResult.evidence.runtimeDiffEquivalent
  },
  semanticBoundary: {
    rendererOracle: false,
    pixelOracle: false,
    cubismCompatibilityOracle: false
  }
});

const summarizeParts = (snapshot: RuntimeSnapshotDto) =>
  snapshot.parts?.map((part) => ({
    partId: part.partId,
    displayName: part.displayName,
    parentPartId: part.parentPartId ?? null,
    childPartIds: part.childPartIds,
    drawableIds: part.drawableIds,
    hierarchyPath: part.hierarchyPath,
    depth: part.depth,
    drawableCount: part.drawableCount,
    runtimeVisibleDrawableCount: part.runtimeVisibleDrawableCount
  })) ?? [];

const summarizeDrawableLayers = (snapshot: RuntimeSnapshotDto) =>
  snapshot.drawables.map((drawable) => ({
    drawableId: drawable.drawableId,
    partId: drawable.partId ?? null,
    runtimeVisible: drawable.visible,
    textureStatus: drawable.texture?.status ?? "missing",
    textureId: drawable.texture?.textureId ?? null,
    sourceLayerId: drawable.texture?.sourceLayerId ?? null
  }));

const summarizeRuntimeDiff = (runtimeDiff: RuntimeDiffDto) => ({
  schemaVersion: runtimeDiff.schemaVersion,
  beforeSnapshotId: runtimeDiff.beforeSnapshotId,
  afterSnapshotId: runtimeDiff.afterSnapshotId,
  parameterChangeCount: runtimeDiff.parameterChanges.length,
  drawableChangeCount: runtimeDiff.drawableChanges.length,
  drawableRuntimeStateChangeCount: runtimeDiff.drawableRuntimeStateChanges.length,
  diagnosticDeltaCount: runtimeDiff.diagnosticDelta.length
});

const summarizeValidationReport = (report: ValidationReportDto) => ({
  schemaVersion: "wave33-layer-tree-direct-manipulation-validation-report-summary-v1",
  reportId: report.reportId,
  status: report.summary.status,
  highestSeverity: report.summary.highestSeverity,
  counts: report.summary.counts,
  checkIds: report.checks.map((check) => check.checkId),
  runtimeSnapshotIds: report.evidence.runtimeSnapshotIds,
  operationLogPresent: report.evidence.operationLogPresent,
  operationLogPath: report.evidence.operationLogPath ?? null
});

const pinReportId = (
  report: ValidationReportDto,
  reportId: ValidationReportId | string
): ValidationReportDto =>
  ValidationReportSchema.parse({
    ...report,
    reportId,
    evidence: {
      ...report.evidence,
      operationLogPresent: true,
      operationLogPath: "operations/log.jsonl"
    }
  });

const requireLogEntry = (outcome: CommitOperationOutcome) => {
  if (outcome.logEntry === undefined) {
    throw new Error(`Expected committed operation ${outcome.result.operationId} to have a log entry.`);
  }

  return outcome.logEntry;
};

const requireModelDiff = (outcome: CommitOperationOutcome): ModelDiffDto => {
  if (outcome.result.modelDiff === undefined) {
    throw new Error(`Expected model diff for operation ${outcome.result.operationId}.`);
  }

  return outcome.result.modelDiff;
};

const summarizeTargets = (targets: readonly TargetRefDto[] | undefined): readonly string[] =>
  (targets ?? []).map(toTargetRefKey);

const summarizeChangedTargets = (modelDiff: ModelDiffDto): readonly string[] =>
  [...new Set(modelDiff.changed.map((change) => toTargetRefKey(change.target)))];

const summarizeChangedFieldPaths = (modelDiff: ModelDiffDto): readonly string[] =>
  modelDiff.changed.flatMap((change) => change.fields.map((field) => field.path));

const toTargetRefKey = (target: Pick<TargetRefDto, "kind" | "id" | "path">) =>
  `${target.kind}:${target.id}${target.path === undefined ? "" : `:${target.path}`}`;

const createFixtureSession = (): AuthoringSession =>
  createAuthoringSessionFromPackageDocument(loadBaselinePackageDocument());

const loadBaselinePackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse(loadFixtureJson("baseline-package.json"));

const loadOperationRequests = (): readonly OperationRequestDto[] => [
  OperationRequestSchema.parse(loadFixtureJson("request/update-part-rename-reparent-commit.request.json")),
  OperationRequestSchema.parse(loadFixtureJson("request/set-drawable-part-commit.request.json")),
  OperationRequestSchema.parse(loadFixtureJson("request/set-drawable-texture-commit.request.json")),
  OperationRequestSchema.parse(loadFixtureJson("request/delete-empty-leaf-commit.request.json"))
];

const loadRejectedDeleteRequest = (): OperationRequestDto =>
  OperationRequestSchema.parse(loadFixtureJson("request/delete-non-empty-rejected.request.json"));

const loadFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave33-layer-tree-direct-manipulation-contract-fixtures"
);
