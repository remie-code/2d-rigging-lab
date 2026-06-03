import {
  createDrawableWithMesh,
  createDryRunAuthoringSession,
  createManualEmptyMesh,
  createNextDrawOrderEntry,
  getDrawableById,
  getPartById,
  getSourceAssetById,
  hasMesh
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { TextureIdSchema } from "@private-2d-rigging-lab/contracts";
import type {
  DiagnosticDto,
  ModelDiffDto,
  OperationId,
  ProvenanceId,
  RectDto,
  SourceAssetId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import {
  createDrawableIdFromDisplayName,
  createMeshIdFromDrawableId,
  createProvenanceId,
  createTextureIdFromDrawableId
} from "../operation-ids.js";
import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";
import { toModelDiffJsonValue } from "./model-diff-json-value.js";

export const createDrawableOperationHandler: OperationHandler = {
  operationType: "createDrawable",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyCreateDrawable(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyCreateDrawable(session, request, operationId, "committed");
  }
};

const applyCreateDrawable = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "createDrawable") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.createDrawable.unsupportedPayload",
            message: `createDrawable handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const drawableId = createDrawableIdFromDisplayName(request.payload.displayName);
  const meshId = createMeshIdFromDrawableId(drawableId);
  const textureId = TextureIdSchema.parse(
    request.payload.textureId ?? createTextureIdFromDrawableId(drawableId)
  );
  const sourceProvenanceId = createProvenanceId(operationId);
  const targetIds = [drawableId, meshId, request.payload.partId, request.payload.sourceAssetId];
  const preconditionDiagnostics = evaluateCreateDrawablePreconditions({
    session,
    request,
    drawableId,
    meshId
  });

  if (preconditionDiagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: preconditionDiagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const sourceAsset = getRequiredSourceAsset(session, request.payload.sourceAssetId);
  const bounds = resolveInitialBounds(session, request);
  const drawOrderEntry = createNextDrawOrderEntry(session.graph, drawableId);
  const baseRevision = session.authoringRevision;
  const drawable = {
    drawableId,
    displayName: request.payload.displayName,
    partId: request.payload.partId,
    sourceAssetId: request.payload.sourceAssetId,
    textureId,
    meshId,
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: drawOrderEntry.baseDrawOrder,
    sourceProvenanceId
  };
  const mesh = createManualEmptyMesh({
    meshId,
    drawableId,
    bounds,
    provenanceId: sourceProvenanceId
  });
  const provenanceRecord = createDrawableProvenanceRecord({
    operationId,
    provenanceId: sourceProvenanceId,
    sourceAsset,
    actor: request.actor
  });
  const mutation = createDrawableWithMesh(session, {
    drawable,
    mesh,
    ...(request.payload.sourceLayerId === undefined ? {} : { sourceLayerId: request.payload.sourceLayerId }),
    sourceProvenanceRecord: provenanceRecord,
    meshProvenanceRecord: provenanceRecord
  });

  return {
    result: createCreateDrawableResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: mutation.authoringRevision,
      packageId: session.packageIdentity.packageId,
      drawable: mutation.drawable,
      mesh: mutation.mesh
    }),
    targetIds,
    candidateSession: session
  };
};

const evaluateCreateDrawablePreconditions = (input: {
  readonly session: AuthoringSession;
  readonly request: Extract<OperationRequestDto, { operationType: "createDrawable" }>;
  readonly drawableId: ReturnType<typeof createDrawableIdFromDisplayName>;
  readonly meshId: ReturnType<typeof createMeshIdFromDrawableId>;
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];

  if (getDrawableById(input.session.graph, input.drawableId) !== undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.createDrawable.duplicateDrawable",
        message: `Drawable already exists: ${input.drawableId}.`,
        target: { kind: "drawable", id: input.drawableId }
      })
    );
  }

  if (hasMesh(input.session.graph, input.meshId)) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.createDrawable.duplicateMesh",
        message: `Mesh already exists: ${input.meshId}.`,
        target: { kind: "mesh", id: input.meshId }
      })
    );
  }

  if (getPartById(input.session.graph, input.request.payload.partId) === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.createDrawable.missingPart",
        message: `Part does not exist: ${input.request.payload.partId}.`,
        target: { kind: "part", id: input.request.payload.partId }
      })
    );
  }

  const sourceAsset = getSourceAssetById(input.session.graph, input.request.payload.sourceAssetId);
  if (sourceAsset === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.createDrawable.missingSourceAsset",
        message: `Source asset does not exist: ${input.request.payload.sourceAssetId}.`,
        target: { kind: "sourceAsset", id: input.request.payload.sourceAssetId }
      })
    );
  } else if (
    input.request.payload.sourceLayerId !== undefined &&
    !sourceAsset.layers.some((layer) => layer.sourceLayerId === input.request.payload.sourceLayerId)
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.createDrawable.missingSourceLayer",
        message: `Source layer does not exist: ${input.request.payload.sourceLayerId}.`,
        target: {
          kind: "sourceAsset",
          id: input.request.payload.sourceAssetId,
          path: `/layers/${input.request.payload.sourceLayerId}`
        }
      })
    );
  }

  return diagnostics;
};

const resolveInitialBounds = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "createDrawable" }>
): RectDto => {
  if (request.payload.initialBounds !== undefined) {
    return structuredClone(request.payload.initialBounds);
  }

  const sourceAsset = getSourceAssetById(session.graph, request.payload.sourceAssetId);
  const sourceLayer =
    request.payload.sourceLayerId === undefined
      ? sourceAsset?.layers[0]
      : sourceAsset?.layers.find((layer) => layer.sourceLayerId === request.payload.sourceLayerId);

  return structuredClone(
    sourceLayer?.bounds ?? {
      x: 0,
      y: 0,
      width: Math.min(32, session.graph.canvasSize.width),
      height: Math.min(32, session.graph.canvasSize.height)
    }
  );
};

const getRequiredSourceAsset = (
  session: AuthoringSession,
  sourceAssetId: SourceAssetId
): SourceAsset => {
  const sourceAsset = getSourceAssetById(session.graph, sourceAssetId);
  if (sourceAsset === undefined) {
    throw new Error(`Expected createDrawable preconditions to reject missing source asset ${sourceAssetId}.`);
  }

  return sourceAsset;
};

const createDrawableProvenanceRecord = (input: {
  readonly operationId: OperationId;
  readonly provenanceId: ProvenanceId;
  readonly sourceAsset: SourceAsset;
  readonly actor: string;
}): ProvenanceRecord => ({
  provenanceId: input.provenanceId,
  assetId: input.sourceAsset.sourceAssetId,
  assetKind: input.sourceAsset.kind === "generated-fixture-v1" ? "generatedFixture" : "source",
  filePath: input.sourceAsset.filePath,
  contentHash: input.sourceAsset.contentHash,
  creator: input.actor,
  license: "internal-authoring-generated",
  redistributionAllowed: false,
  aiUsed: input.actor === "ai",
  transformHistory: ["createDrawable:manual-empty-mesh"],
  relatedOperationIds: [input.operationId]
});

type SourceAsset = AuthoringSession["graph"]["sourceAssets"][number];
type ProvenanceRecord = AuthoringSession["graph"]["provenanceRecords"][number];

const createCreateDrawableResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly drawable: Parameters<typeof createDrawableWithMesh>[1]["drawable"];
  readonly mesh: Parameters<typeof createDrawableWithMesh>[1]["mesh"];
}): OperationResultDto => {
  const drawableTarget: TargetRefDto = { kind: "drawable", id: input.drawable.drawableId };
  const meshTarget: TargetRefDto = { kind: "mesh", id: input.mesh.meshId };
  const partTarget: TargetRefDto = { kind: "part", id: input.drawable.partId };
  const sourceTarget: TargetRefDto = { kind: "sourceAsset", id: input.drawable.sourceAssetId };
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [drawableTarget, meshTarget],
    removed: [],
    changed: [
      {
        target: { kind: "package", id: input.packageId },
        fields: [
          {
            path: "/model/drawables/drawables",
            before: null,
            after: input.drawable.drawableId
          },
          {
            path: "/model/meshes/meshes",
            before: null,
            after: input.mesh.meshId
          },
          {
            path: "/model/drawOrder/entries",
            before: null,
            after: input.drawable.drawableId
          },
          {
            path: "/model/graph/stableOrder",
            before: null,
            after: input.drawable.drawableId
          }
        ]
      },
      {
        target: drawableTarget,
        fields: [{ path: `/model/drawables/${input.drawable.drawableId}`, before: null, after: input.drawable }]
      },
      {
        target: meshTarget,
        fields: [{ path: `/model/meshes/${input.mesh.meshId}`, before: null, after: toModelDiffJsonValue(input.mesh) }]
      },
      {
        target: partTarget,
        fields: [{ path: "/model/graph/parts/drawableIds", before: null, after: input.drawable.drawableId }]
      },
      {
        target: sourceTarget,
        fields: [{ path: "/assets/sourceManifest/sourceAssets", before: null, after: input.drawable.drawableId }]
      }
    ],
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], [drawableTarget, meshTarget, partTarget, sourceTarget]),
    modelDiff,
    runtimeDiff: undefined,
    validationDiff: undefined,
    diagnostics: [],
    generatedRuntimeSnapshotIds: [],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    reversible: true
  });
};
