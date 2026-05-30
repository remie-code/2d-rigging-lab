import {
  createDryRunAuthoringSession,
  createGeneratedMesh,
  getDrawableById,
  getMeshById,
  replaceDrawableMesh
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  ModelDiffDto,
  OperationId,
  ProvenanceId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import { createProvenanceId } from "../operation-ids.js";
import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";

export const generateMeshOperationHandler: OperationHandler = {
  operationType: "generateMesh",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyGenerateMesh(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyGenerateMesh(session, request, operationId, "committed");
  }
};

const applyGenerateMesh = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "generateMesh") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.generateMesh.unsupportedPayload",
            message: `generateMesh handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const drawable = getDrawableById(session.graph, request.payload.drawableId);
  const existingMesh = drawable === undefined ? undefined : getMeshById(session.graph, drawable.meshId);
  const targetIds = [request.payload.drawableId, drawable?.meshId ?? request.payload.drawableId];
  const preconditionDiagnostics = evaluateGenerateMeshPreconditions({
    request,
    drawableMissing: drawable === undefined,
    meshMissing: drawable !== undefined && existingMesh === undefined
  });

  if (preconditionDiagnostics.length > 0 || drawable === undefined || existingMesh === undefined) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: preconditionDiagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const provenanceId = createProvenanceId(operationId);
  const mesh = createGeneratedMesh({
    meshId: existingMesh.meshId,
    drawableId: drawable.drawableId,
    bounds: existingMesh.bounds,
    provenanceId,
    method: request.payload.method === "manual-empty" ? "manual-empty" : "auto-grid-v1",
    ...(request.payload.densityHint === undefined ? {} : { densityHint: request.payload.densityHint })
  });
  const provenanceRecord = createMeshProvenanceRecord({
    operationId,
    provenanceId,
    meshId: mesh.meshId,
    actor: request.actor,
    method: request.payload.method
  });
  const mutation = replaceDrawableMesh(session, mesh, provenanceRecord);

  return {
    result: createGenerateMeshResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: mutation.authoringRevision,
      meshBefore: existingMesh,
      meshAfter: mutation.mesh
    }),
    targetIds,
    candidateSession: session
  };
};

const evaluateGenerateMeshPreconditions = (input: {
  readonly request: Extract<OperationRequestDto, { operationType: "generateMesh" }>;
  readonly drawableMissing: boolean;
  readonly meshMissing: boolean;
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];

  if (input.drawableMissing) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.generateMesh.missingDrawable",
        message: `Drawable does not exist: ${input.request.payload.drawableId}.`,
        target: { kind: "drawable", id: input.request.payload.drawableId }
      })
    );
  }

  if (input.meshMissing) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.generateMesh.missingMesh",
        message: `Drawable ${input.request.payload.drawableId} references a missing mesh.`,
        target: { kind: "drawable", id: input.request.payload.drawableId, path: "/meshId" }
      })
    );
  }

  if (input.request.payload.method === "auto-outline-v1") {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.generateMesh.unsupportedMethod",
        message: "auto-outline-v1 requires an outline extraction pipeline and is outside the Wave 15 foundation.",
        target: { kind: "drawable", id: input.request.payload.drawableId, path: "/payload/method" }
      })
    );
  }

  return diagnostics;
};

const createMeshProvenanceRecord = (input: {
  readonly operationId: OperationId;
  readonly provenanceId: ProvenanceId;
  readonly meshId: string;
  readonly actor: string;
  readonly method: string;
}): ProvenanceRecord => ({
  provenanceId: input.provenanceId,
  assetId: input.meshId,
  assetKind: "generatedFixture",
  filePath: `model/meshes/${input.meshId}.generated.json`,
  creator: input.actor,
  license: "internal-authoring-generated",
  redistributionAllowed: false,
  aiUsed: input.actor === "ai",
  transformHistory: [`generateMesh:${input.method}`],
  relatedOperationIds: [input.operationId]
});

type ProvenanceRecord = AuthoringSession["graph"]["provenanceRecords"][number];

const createGenerateMeshResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly meshBefore: Parameters<typeof replaceDrawableMesh>[1];
  readonly meshAfter: Parameters<typeof replaceDrawableMesh>[1];
}): OperationResultDto => {
  const drawableTarget: TargetRefDto = { kind: "drawable", id: input.meshAfter.drawableId };
  const meshTarget: TargetRefDto = { kind: "mesh", id: input.meshAfter.meshId };
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed: [
      {
        target: meshTarget,
        fields: [
          {
            path: `/model/meshes/${input.meshAfter.meshId}`,
            before: input.meshBefore,
            after: input.meshAfter
          },
          {
            path: `/model/meshes/${input.meshAfter.meshId}/vertices`,
            before: input.meshBefore.vertices,
            after: input.meshAfter.vertices
          },
          {
            path: `/model/meshes/${input.meshAfter.meshId}/triangles`,
            before: input.meshBefore.triangles,
            after: input.meshAfter.triangles
          }
        ]
      },
      {
        target: drawableTarget,
        fields: [
          {
            path: "/meshId",
            before: input.meshBefore.meshId,
            after: input.meshAfter.meshId
          }
        ]
      }
    ],
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], [drawableTarget, meshTarget]),
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
