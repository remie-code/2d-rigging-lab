import {
  createDryRunAuthoringSession,
  createGeneratedMeshForDrawable,
  getDrawableById,
  getMeshById,
  replaceDrawableMesh
} from "@private-2d-rigging-lab/authoring-core";
import type {
  AuthoringSession,
  MeshGenerationFallbackStep,
  MeshGenerationQualityMetrics
} from "@private-2d-rigging-lab/authoring-core";
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
import { toModelDiffJsonValue } from "./model-diff-json-value.js";

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
  if (drawable !== undefined && existingMesh !== undefined) {
    preconditionDiagnostics.push(
      ...evaluatePreviewMeshPreconditions({
        previewMesh: request.payload.previewMesh,
        drawableId: drawable.drawableId,
        meshId: existingMesh.meshId,
        method: request.payload.method
      })
    );
  }

  if (preconditionDiagnostics.length > 0 || drawable === undefined || existingMesh === undefined) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: preconditionDiagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const provenanceId = createProvenanceId(operationId);
  let mesh: Parameters<typeof replaceDrawableMesh>[1];
  let generatedSource: string | undefined;
  let fallbackReason: string | undefined;
  let fallbackSteps: readonly MeshGenerationFallbackStep[] | undefined;
  let qualityMetrics: MeshGenerationQualityMetrics | undefined;
  if (request.payload.previewMesh !== undefined) {
    mesh = {
      ...structuredClone(request.payload.previewMesh),
      generationProvenanceId: provenanceId
    };
    generatedSource = "previewMesh";
  } else {
    const generated = createGeneratedMeshForDrawable({
      session,
      drawableId: drawable.drawableId,
      provenanceId,
      method: request.payload.method,
      ...(request.payload.densityHint === undefined ? {} : { densityHint: request.payload.densityHint })
    });
    if (generated === undefined) {
      return {
        result: createRejectedOperationResult({
          operationId,
          diagnostics: [
            createOperationDiagnostic({
              checkId: "operation.generateMesh.missingMesh",
              message: `Drawable ${request.payload.drawableId} references a missing mesh.`,
              target: { kind: "drawable", id: request.payload.drawableId, path: "/meshId" }
            })
          ]
        }),
        targetIds,
        candidateSession: session
      };
    }

    mesh = generated.mesh;
    generatedSource = generated.source;
    fallbackReason = generated.fallbackReason;
    fallbackSteps = generated.fallbackSteps;
    qualityMetrics = generated.qualityMetrics;
  }

  const provenanceRecord = createMeshProvenanceRecord({
    operationId,
    provenanceId,
    meshId: mesh.meshId,
    actor: request.actor,
    method: request.payload.method,
    ...(generatedSource === undefined ? {} : { generatedSource }),
    ...(fallbackReason === undefined ? {} : { fallbackReason }),
    ...(fallbackSteps === undefined ? {} : { fallbackSteps }),
    ...(qualityMetrics === undefined ? {} : { qualityMetrics })
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

  return diagnostics;
};

const evaluatePreviewMeshPreconditions = (input: {
  readonly previewMesh: Extract<OperationRequestDto, { operationType: "generateMesh" }>["payload"]["previewMesh"];
  readonly drawableId: string;
  readonly meshId: string;
  readonly method: Extract<OperationRequestDto, { operationType: "generateMesh" }>["payload"]["method"];
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];

  if (input.previewMesh === undefined) {
    return diagnostics;
  }
  const previewMesh = input.previewMesh;

  if (
    input.method !== "auto-grid-v1" &&
    input.method !== "auto-outline-v1" &&
    input.method !== "auto-outline-v2"
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.generateMesh.previewMeshUnsupportedMethod",
        message: "previewMesh commits are only supported for generated mesh drafts.",
        target: { kind: "drawable", id: input.drawableId, path: "/payload/method" }
      })
    );
  }

  if (previewMesh.drawableId !== input.drawableId) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.generateMesh.previewMeshDrawableMismatch",
        message: `Preview mesh drawable ${previewMesh.drawableId} does not match target drawable ${input.drawableId}.`,
        target: { kind: "drawable", id: previewMesh.drawableId, path: "/payload/previewMesh/drawableId" }
      })
    );
  }

  if (previewMesh.meshId !== input.meshId) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.generateMesh.previewMeshIdMismatch",
        message: `Preview mesh ${previewMesh.meshId} does not match target mesh ${input.meshId}.`,
        target: { kind: "mesh", id: previewMesh.meshId, path: "/payload/previewMesh/meshId" }
      })
    );
  }

  if (
    previewMesh.vertices.length !== previewMesh.uvs.length ||
    previewMesh.vertices.length !== previewMesh.vertexStableIds.length
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.generateMesh.previewMeshVertexCardinalityMismatch",
        message: "Preview mesh vertices, uvs, and vertexStableIds must have matching lengths.",
        target: { kind: "mesh", id: previewMesh.meshId, path: "/payload/previewMesh" }
      })
    );
  }

  if (
    previewMesh.triangleStableIds !== undefined &&
    previewMesh.triangleStableIds.length !== previewMesh.triangles.length
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.generateMesh.previewMeshTriangleCardinalityMismatch",
        message: "Preview mesh triangles and triangleStableIds must have matching lengths.",
        target: { kind: "mesh", id: previewMesh.meshId, path: "/payload/previewMesh" }
      })
    );
  }

  previewMesh.triangles.forEach((triangle, triangleIndex) => {
    const [a, b, c] = triangle;
    const path = `/payload/previewMesh/triangles/${triangleIndex}`;

    if (
      a >= previewMesh.vertices.length ||
      b >= previewMesh.vertices.length ||
      c >= previewMesh.vertices.length
    ) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.generateMesh.previewMeshTriangleIndexOutOfRange",
          message: `Preview mesh triangle ${triangleIndex} references a vertex outside the vertex array.`,
          target: { kind: "mesh", id: previewMesh.meshId, path }
        })
      );
    }

    if (a === b || a === c || b === c) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.generateMesh.previewMeshDegenerateTriangle",
          message: `Preview mesh triangle ${triangleIndex} repeats a vertex index.`,
          target: { kind: "mesh", id: previewMesh.meshId, path }
        })
      );
    }
  });

  return diagnostics;
};

const createMeshProvenanceRecord = (input: {
  readonly operationId: OperationId;
  readonly provenanceId: ProvenanceId;
  readonly meshId: string;
  readonly actor: string;
  readonly method: string;
  readonly generatedSource?: string;
  readonly fallbackReason?: string;
  readonly fallbackSteps?: readonly MeshGenerationFallbackStep[];
  readonly qualityMetrics?: MeshGenerationQualityMetrics;
}): ProvenanceRecord => ({
  provenanceId: input.provenanceId,
  assetId: input.meshId,
  assetKind: "generatedFixture",
  filePath: `model/meshes/${input.meshId}.generated.json`,
  creator: input.actor,
  license: "internal-authoring-generated",
  redistributionAllowed: false,
  aiUsed: input.actor === "ai",
  transformHistory: [
    `generateMesh:${input.method}`,
    ...(input.generatedSource === undefined ? [] : [`meshSource:${input.generatedSource}`]),
    ...(input.fallbackSteps === undefined
      ? input.fallbackReason === undefined
        ? []
        : [`fallback:${input.fallbackReason}`]
      : input.fallbackSteps.map((step) => `fallback:${step.method}:${step.reason}`)),
    ...formatQualityMetricsForTransformHistory(input.qualityMetrics)
  ],
  relatedOperationIds: [input.operationId]
});

type ProvenanceRecord = AuthoringSession["graph"]["provenanceRecords"][number];

const formatQualityMetricsForTransformHistory = (
  metrics: MeshGenerationQualityMetrics | undefined
): readonly string[] => {
  if (metrics === undefined) {
    return [];
  }

  return [
    `meshQuality:maxEdgeLength=${formatMetric(metrics.maxEdgeLength)}`,
    `meshQuality:maxTriangleArea=${formatMetric(metrics.maxTriangleArea)}`,
    `meshQuality:minAngleDegrees=${formatMetric(metrics.minAngleDegrees)}`,
    `meshQuality:maxVertexValence=${metrics.maxVertexValence}`,
    `meshQuality:refinementIterations=${metrics.refinementIterationCount}`,
    ...(metrics.triangulationMode === undefined
      ? []
      : [`meshQuality:triangulationMode=${metrics.triangulationMode}`])
  ];
};

const formatMetric = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");

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
            before: toModelDiffJsonValue(input.meshBefore),
            after: toModelDiffJsonValue(input.meshAfter)
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
