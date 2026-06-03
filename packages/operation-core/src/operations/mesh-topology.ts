import {
  AuthoringMutationError,
  addMeshTriangle,
  addMeshVertex,
  createDryRunAuthoringSession,
  getDrawableById,
  getMeshById,
  moveMeshUvPoints,
  removeMeshTriangle,
  removeMeshVertex
} from "@private-2d-rigging-lab/authoring-core";
import type {
  AddMeshTriangleMutationResult,
  AddMeshVertexMutationResult,
  AuthoringSession,
  MoveMeshUvPointsMutationResult,
  RemoveMeshTriangleMutationResult,
  RemoveMeshVertexMutationResult
} from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  DrawableId,
  MeshId,
  ModelDiffDto,
  OperationId,
  PartId,
  TargetRefDto,
  TriangleId,
  VertexId
} from "@private-2d-rigging-lab/contracts";

import type { MeshTopologyOperationEvidenceDto } from "../mesh-topology-evidence.js";
import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import type { OperationType } from "../operation-type.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";
import { createLockedTargetDiagnostics } from "./locked-targets.js";
import { toModelDiffJsonValue } from "./model-diff-json-value.js";

type MeshTopologyOperationType =
  | "addMeshVertex"
  | "removeMeshVertex"
  | "addMeshTriangle"
  | "removeMeshTriangle"
  | "moveMeshUvPoint";

type MeshTopologyOperationRequest = Extract<
  OperationRequestDto,
  { operationType: MeshTopologyOperationType }
>;

type MeshTopologyMutation =
  | AddMeshVertexMutationResult
  | RemoveMeshVertexMutationResult
  | AddMeshTriangleMutationResult
  | RemoveMeshTriangleMutationResult
  | MoveMeshUvPointsMutationResult;
type MeshDto = MeshTopologyMutation["meshBefore"];

export const addMeshVertexOperationHandler: OperationHandler = createMeshTopologyOperationHandler("addMeshVertex");
export const removeMeshVertexOperationHandler: OperationHandler = createMeshTopologyOperationHandler("removeMeshVertex");
export const addMeshTriangleOperationHandler: OperationHandler = createMeshTopologyOperationHandler("addMeshTriangle");
export const removeMeshTriangleOperationHandler: OperationHandler = createMeshTopologyOperationHandler("removeMeshTriangle");
export const moveMeshUvPointOperationHandler: OperationHandler = createMeshTopologyOperationHandler("moveMeshUvPoint");

function createMeshTopologyOperationHandler(
  operationType: MeshTopologyOperationType
): OperationHandler {
  return {
    operationType,

    dryRun(session, request, operationId) {
      const dryRunSession = createDryRunAuthoringSession(session);
      return applyMeshTopologyOperation(dryRunSession, request, operationId, "dry_run", operationType);
    },

    commit(session, request, operationId) {
      return applyMeshTopologyOperation(session, request, operationId, "committed", operationType);
    }
  };
}

const applyMeshTopologyOperation = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed",
  expectedOperationType: MeshTopologyOperationType
): OperationApplyOutcome => {
  if (request.operationType !== expectedOperationType) {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: `operation.${expectedOperationType}.unsupportedPayload`,
            message: `${expectedOperationType} handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const topologyRequest = request as MeshTopologyOperationRequest;
  const targetIds = createTargetIds(topologyRequest);
  const checkedTargets = createCheckedTargets(session, topologyRequest);
  const preconditionDiagnostics = evaluateMeshTopologyPreconditions(session, topologyRequest, checkedTargets);

  if (preconditionDiagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: preconditionDiagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;

  try {
    const mutation = applyAuthoringMutation(session, topologyRequest);

    return {
      result: createMeshTopologyOperationResult({
        operationId,
        status,
        operationType: topologyRequest.operationType,
        baseRevision,
        candidateRevision: mutation.authoringRevision,
        mutation,
        checkedTargets
      }),
      targetIds,
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [createMeshTopologyMutationDiagnostic(error, topologyRequest, operationId)]
      }),
      targetIds,
      candidateSession: session
    };
  }
};

const applyAuthoringMutation = (
  session: AuthoringSession,
  request: MeshTopologyOperationRequest
): MeshTopologyMutation => {
  switch (request.operationType) {
    case "addMeshVertex":
      return addMeshVertex(session, {
        meshId: request.payload.meshId,
        vertexId: request.payload.vertexId,
        position: request.payload.position,
        uv: request.payload.uv,
        ...(request.payload.insertIndex === undefined ? {} : { insertIndex: request.payload.insertIndex }),
        ...(request.payload.expectedTopologyRevision === undefined
          ? {}
          : { expectedTopologyRevision: request.payload.expectedTopologyRevision })
      });
    case "removeMeshVertex":
      return removeMeshVertex(session, {
        meshId: request.payload.meshId,
        vertexId: request.payload.vertexId,
        ...(request.payload.expectedTopologyRevision === undefined
          ? {}
          : { expectedTopologyRevision: request.payload.expectedTopologyRevision })
      });
    case "addMeshTriangle":
      return addMeshTriangle(session, {
        meshId: request.payload.meshId,
        triangleId: request.payload.triangleId,
        vertexIds: request.payload.vertexIds,
        ...(request.payload.insertIndex === undefined ? {} : { insertIndex: request.payload.insertIndex }),
        ...(request.payload.expectedTopologyRevision === undefined
          ? {}
          : { expectedTopologyRevision: request.payload.expectedTopologyRevision })
      });
    case "removeMeshTriangle":
      return removeMeshTriangle(session, {
        meshId: request.payload.meshId,
        triangleId: request.payload.triangleId,
        ...(request.payload.expectedTopologyRevision === undefined
          ? {}
          : { expectedTopologyRevision: request.payload.expectedTopologyRevision })
      });
    case "moveMeshUvPoint":
      return moveMeshUvPoints(session, {
        meshId: request.payload.meshId,
        uvDeltas: request.payload.uvDeltas,
        ...(request.payload.expectedTopologyRevision === undefined
          ? {}
          : { expectedTopologyRevision: request.payload.expectedTopologyRevision })
      });
  }
};

const evaluateMeshTopologyPreconditions = (
  session: AuthoringSession,
  request: MeshTopologyOperationRequest,
  checkedTargets: readonly TargetRefDto[]
): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [
    ...createLockedTargetDiagnostics({
      operationType: request.operationType,
      lockedTargetIds: request.payload.lockedTargetIds,
      targets: checkedTargets
    })
  ];
  const mesh = getMeshById(session.graph, request.payload.meshId);

  if (mesh === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: `operation.${request.operationType}.missingMesh`,
        message: `Mesh does not exist: ${request.payload.meshId}.`,
        target: createMeshTarget(request.payload.meshId)
      })
    );
    return diagnostics;
  }

  const expectedTopologyRevision = request.payload.expectedTopologyRevision;
  if (expectedTopologyRevision !== undefined && (mesh.topologyRevision ?? 0) !== expectedTopologyRevision) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: `operation.${request.operationType}.topologyRevisionMismatch`,
        message:
          `Mesh ${request.payload.meshId} topology revision ${mesh.topologyRevision ?? 0} ` +
          `does not match expected ${expectedTopologyRevision}.`,
        target: { kind: "mesh", id: request.payload.meshId, path: "/topologyRevision" }
      })
    );
  }

  return diagnostics;
};

const createMeshTopologyOperationResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly operationType: MeshTopologyOperationType;
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly mutation: MeshTopologyMutation;
  readonly checkedTargets: readonly TargetRefDto[];
}): OperationResultDto => {
  const modelDiff = createMeshTopologyModelDiff({
    operationId: input.operationId,
    operationType: input.operationType,
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    mutation: input.mutation
  });

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], input.checkedTargets),
    modelDiff,
    runtimeDiff: undefined,
    validationDiff: undefined,
    diagnostics: [],
    generatedRuntimeSnapshotIds: [],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    meshTopologyEvidence: [
      createMeshTopologyOperationEvidence(input.operationType, input.mutation)
    ],
    reversible: true
  });
};

const createMeshTopologyModelDiff = (input: {
  readonly operationId: OperationId;
  readonly operationType: MeshTopologyOperationType;
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly mutation: MeshTopologyMutation;
}): ModelDiffDto => {
  const meshTarget = createMeshTarget(input.mutation.meshAfter.meshId);
  const elementTarget = createElementTarget(input.operationType, input.mutation);
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: isAddOperation(input.operationType) ? [elementTarget] : [],
    removed: isRemoveOperation(input.operationType) ? [elementTarget] : [],
    changed: [
      {
        target: meshTarget,
        fields: createMeshChangeFields(input.operationType, input.mutation)
      }
    ],
    operationIds: [input.operationId]
  };

  if (input.operationType === "moveMeshUvPoint") {
    const mutation = input.mutation as MoveMeshUvPointsMutationResult;
    modelDiff.changed.push(
      ...mutation.uvChanges.map((change) => ({
        target: createVertexTarget({
          meshId: mutation.meshAfter.meshId,
          vertexId: change.vertexId,
          path: `/model/meshes/${mutation.meshAfter.meshId}/uvs/${change.vertexIndex}`
        }),
        fields: [
          createFieldChange({
            path: `/model/meshes/${mutation.meshAfter.meshId}/uvs/${change.vertexIndex}`,
            before: change.before,
            after: change.after
          })
        ]
      }))
    );
  }

  return modelDiff;
};

const createMeshChangeFields = (
  operationType: MeshTopologyOperationType,
  mutation: MeshTopologyMutation
): ModelDiffDto["changed"][number]["fields"] => {
  const meshId = mutation.meshAfter.meshId;
  const fields: ModelDiffDto["changed"][number]["fields"] = [
    createFieldChange({
      path: `/model/meshes/${meshId}/topologyRevision`,
      before: mutation.meshBefore.topologyRevision ?? null,
      after: mutation.meshAfter.topologyRevision ?? null
    })
  ];

  if (operationType === "addMeshVertex" || operationType === "removeMeshVertex") {
    fields.push(
      createFieldChange({
        path: `/model/meshes/${meshId}/vertices`,
        before: mutation.meshBefore.vertices,
        after: mutation.meshAfter.vertices
      }),
      createFieldChange({
        path: `/model/meshes/${meshId}/uvs`,
        before: mutation.meshBefore.uvs,
        after: mutation.meshAfter.uvs
      }),
      createFieldChange({
        path: `/model/meshes/${meshId}/vertexStableIds`,
        before: mutation.meshBefore.vertexStableIds,
        after: mutation.meshAfter.vertexStableIds
      }),
      createFieldChange({
        path: `/model/meshes/${meshId}/triangles`,
        before: mutation.meshBefore.triangles,
        after: mutation.meshAfter.triangles
      }),
      createFieldChange({
        path: `/model/meshes/${meshId}/bounds`,
        before: mutation.meshBefore.bounds,
        after: mutation.meshAfter.bounds
      })
    );
  }

  if (operationType === "addMeshTriangle" || operationType === "removeMeshTriangle") {
    fields.push(
      createFieldChange({
        path: `/model/meshes/${meshId}/triangles`,
        before: mutation.meshBefore.triangles,
        after: mutation.meshAfter.triangles
      }),
      createFieldChange({
        path: `/model/meshes/${meshId}/triangleStableIds`,
        before: mutation.meshBefore.triangleStableIds ?? null,
        after: mutation.meshAfter.triangleStableIds ?? null
      })
    );
  }

  if (operationType === "moveMeshUvPoint") {
    fields.push(
      createFieldChange({
        path: `/model/meshes/${meshId}/uvs`,
        before: mutation.meshBefore.uvs,
        after: mutation.meshAfter.uvs
      })
    );
  }

  return fields;
};

const createMeshTopologyOperationEvidence = (
  operationType: MeshTopologyOperationType,
  mutation: MeshTopologyMutation
): MeshTopologyOperationEvidenceDto => ({
  schemaVersion: "mesh-topology-operation-evidence-v1",
  operationType,
  meshId: mutation.meshAfter.meshId,
  topologyRevisionBefore: mutation.meshBefore.topologyRevision ?? 0,
  topologyRevisionAfter: mutation.meshAfter.topologyRevision ?? 0,
  vertexCountBefore: mutation.meshBefore.vertices.length,
  vertexCountAfter: mutation.meshAfter.vertices.length,
  triangleCountBefore: mutation.meshBefore.triangles.length,
  triangleCountAfter: mutation.meshAfter.triangles.length,
  changes: createMeshTopologyEvidenceChanges(operationType, mutation),
  rendererCorrectnessClaim: "none",
  textureSamplingCorrectnessClaim: "none"
});

const createMeshTopologyEvidenceChanges = (
  operationType: MeshTopologyOperationType,
  mutation: MeshTopologyMutation
): MeshTopologyOperationEvidenceDto["changes"] => {
  switch (operationType) {
    case "addMeshVertex": {
      const addVertexMutation = mutation as AddMeshVertexMutationResult;
      return [
        {
          kind: "vertexAdded",
          vertexId: addVertexMutation.vertexId,
          vertexIndex: addVertexMutation.vertexIndex,
          position: addVertexMutation.meshAfter.vertices[addVertexMutation.vertexIndex] ?? { x: 0, y: 0 },
          uv: addVertexMutation.meshAfter.uvs[addVertexMutation.vertexIndex] ?? { x: 0, y: 0 }
        }
      ];
    }
    case "removeMeshVertex": {
      const removeVertexMutation = mutation as RemoveMeshVertexMutationResult;
      return [
        {
          kind: "vertexRemoved",
          vertexId: removeVertexMutation.vertexId,
          vertexIndex: removeVertexMutation.vertexIndex
        }
      ];
    }
    case "addMeshTriangle": {
      const addTriangleMutation = mutation as AddMeshTriangleMutationResult;
      return [
        {
          kind: "triangleAdded",
          triangleId: addTriangleMutation.triangleId,
          triangleIndex: addTriangleMutation.triangleIndex,
          vertexIds: [...addTriangleMutation.vertexIds] as [VertexId, VertexId, VertexId]
        }
      ];
    }
    case "removeMeshTriangle": {
      const removeTriangleMutation = mutation as RemoveMeshTriangleMutationResult;
      return [
        {
          kind: "triangleRemoved",
          triangleId: removeTriangleMutation.triangleId,
          triangleIndex: removeTriangleMutation.triangleIndex
        }
      ];
    }
    case "moveMeshUvPoint": {
      const uvMutation = mutation as MoveMeshUvPointsMutationResult;
      return uvMutation.uvChanges.map((change) => ({
        kind: "uvMoved",
        vertexId: change.vertexId,
        vertexIndex: change.vertexIndex,
        before: change.before,
        after: change.after
      }));
    }
  }
};

const createMeshTopologyMutationDiagnostic = (
  error: AuthoringMutationError,
  request: MeshTopologyOperationRequest,
  operationId: OperationId
): DiagnosticDto => {
  const checkIdByCode: Partial<Record<AuthoringMutationError["code"], string>> = {
    missing_mesh: `operation.${request.operationType}.missingMesh`,
    missing_vertex: `operation.${request.operationType}.missingVertex`,
    duplicate_vertex: "operation.addMeshVertex.duplicateVertex",
    invalid_vertex_insert_index: "operation.addMeshVertex.invalidInsertIndex",
    referenced_vertex: "operation.removeMeshVertex.referencedVertex",
    mesh_vertex_cardinality_mismatch: `operation.${request.operationType}.meshVertexCardinalityMismatch`,
    mesh_triangle_stable_id_count_mismatch: `operation.${request.operationType}.triangleStableIdCountMismatch`,
    invalid_triangle_reference: `operation.${request.operationType}.invalidTriangleReference`,
    degenerate_triangle: `operation.${request.operationType}.degenerateTriangle`,
    missing_triangle: "operation.removeMeshTriangle.missingTriangle",
    duplicate_triangle: "operation.addMeshTriangle.duplicateTriangle",
    duplicate_triangle_vertex: "operation.addMeshTriangle.duplicateTriangleVertex",
    missing_triangle_vertex: "operation.addMeshTriangle.missingTriangleVertex",
    invalid_triangle_insert_index: "operation.addMeshTriangle.invalidInsertIndex",
    topology_revision_mismatch: `operation.${request.operationType}.topologyRevisionMismatch`,
    empty_uv_delta: "operation.moveMeshUvPoint.emptyDelta",
    duplicate_uv_delta: "operation.moveMeshUvPoint.duplicateDelta",
    no_op_mesh_uv_update: "operation.moveMeshUvPoint.noOp"
  };

  return createOperationDiagnostic({
    checkId: checkIdByCode[error.code] ?? `operation.${request.operationType}.authoringMutationFailed`,
    message: error.message,
    target: { kind: "operation", id: operationId },
    severity: error.code === "no_op_mesh_uv_update" ? "warning" : "error"
  });
};

const createTargetIds = (request: MeshTopologyOperationRequest): readonly string[] => {
  switch (request.operationType) {
    case "addMeshVertex":
    case "removeMeshVertex":
      return uniqueStrings([request.payload.meshId, request.payload.vertexId]);
    case "addMeshTriangle":
      return uniqueStrings([request.payload.meshId, request.payload.triangleId, ...request.payload.vertexIds]);
    case "removeMeshTriangle":
      return uniqueStrings([request.payload.meshId, request.payload.triangleId]);
    case "moveMeshUvPoint":
      return uniqueStrings([
        request.payload.meshId,
        ...request.payload.uvDeltas.map((uvDelta) => uvDelta.vertexId)
      ]);
  }
};

const createCheckedTargets = (
  session: AuthoringSession,
  request: MeshTopologyOperationRequest
): readonly TargetRefDto[] => {
  const mesh = getMeshById(session.graph, request.payload.meshId);
  const refs: TargetRefDto[] = [createMeshTarget(request.payload.meshId)];

  if (mesh !== undefined) {
    refs.push(createDrawableTarget(mesh.drawableId));
    const drawable = getDrawableById(session.graph, mesh.drawableId);
    if (drawable !== undefined) {
      refs.push(createPartTarget(drawable.partId));
    }
  }

  refs.push(...createElementCheckedTargets(mesh, request));
  return uniqueTargetRefs(refs);
};

const createElementCheckedTargets = (
  mesh: MeshDto | undefined,
  request: MeshTopologyOperationRequest
): readonly TargetRefDto[] => {
  switch (request.operationType) {
    case "addMeshVertex":
      return [
        createVertexTarget({
          meshId: request.payload.meshId,
          vertexId: request.payload.vertexId,
          path: createIndexedPath(
            `/model/meshes/${request.payload.meshId}/vertices`,
            request.payload.insertIndex
          )
        })
      ];
    case "removeMeshVertex":
      return [
        createVertexTarget({
          meshId: request.payload.meshId,
          vertexId: request.payload.vertexId,
          path: createVertexPath(mesh, request.payload.meshId, request.payload.vertexId, "vertices")
        })
      ];
    case "addMeshTriangle":
      return [
        createTriangleTarget({
          meshId: request.payload.meshId,
          triangleId: request.payload.triangleId,
          path: createIndexedPath(
            `/model/meshes/${request.payload.meshId}/triangles`,
            request.payload.insertIndex
          )
        }),
        ...request.payload.vertexIds.map((vertexId) =>
          createVertexTarget({
            meshId: request.payload.meshId,
            vertexId,
            path: createVertexPath(mesh, request.payload.meshId, vertexId, "vertexStableIds")
          })
        )
      ];
    case "removeMeshTriangle":
      return [
        createTriangleTarget({
          meshId: request.payload.meshId,
          triangleId: request.payload.triangleId,
          path: createTrianglePath(mesh, request.payload.meshId, request.payload.triangleId)
        })
      ];
    case "moveMeshUvPoint":
      return request.payload.uvDeltas.map((uvDelta) =>
        createVertexTarget({
          meshId: request.payload.meshId,
          vertexId: uvDelta.vertexId,
          path: createVertexPath(mesh, request.payload.meshId, uvDelta.vertexId, "uvs")
        })
      );
  }
};

const createElementTarget = (
  operationType: MeshTopologyOperationType,
  mutation: MeshTopologyMutation
): TargetRefDto => {
  switch (operationType) {
    case "addMeshVertex":
    case "removeMeshVertex": {
      const vertexMutation = mutation as AddMeshVertexMutationResult | RemoveMeshVertexMutationResult;
      return createVertexTarget({
        meshId: vertexMutation.meshAfter.meshId,
        vertexId: vertexMutation.vertexId,
        path: `/model/meshes/${vertexMutation.meshAfter.meshId}/vertices/${vertexMutation.vertexIndex}`
      });
    }
    case "addMeshTriangle":
    case "removeMeshTriangle": {
      const triangleMutation = mutation as AddMeshTriangleMutationResult | RemoveMeshTriangleMutationResult;
      return createTriangleTarget({
        meshId: triangleMutation.meshAfter.meshId,
        triangleId: triangleMutation.triangleId,
        path: `/model/meshes/${triangleMutation.meshAfter.meshId}/triangles/${triangleMutation.triangleIndex}`
      });
    }
    case "moveMeshUvPoint":
      return createMeshTarget(mutation.meshAfter.meshId);
  }
};

const createFieldChange = (input: {
  readonly path: string;
  readonly before: unknown;
  readonly after: unknown;
}): ModelDiffDto["changed"][number]["fields"][number] => ({
  path: input.path,
  before: toModelDiffJsonValue(input.before),
  after: toModelDiffJsonValue(input.after)
});

const createVertexPath = (
  mesh: MeshDto | undefined,
  meshId: MeshId | string,
  vertexId: VertexId | string,
  field: "vertices" | "uvs" | "vertexStableIds"
): string => {
  const vertexIndex = mesh?.vertexStableIds.indexOf(vertexId);
  return vertexIndex === undefined || vertexIndex === -1
    ? `/model/meshes/${meshId}/vertexStableIds`
    : `/model/meshes/${meshId}/${field}/${vertexIndex}`;
};

const createTrianglePath = (
  mesh: MeshDto | undefined,
  meshId: MeshId | string,
  triangleId: TriangleId | string
): string => {
  const triangleIndex = mesh?.triangleStableIds?.indexOf(triangleId as TriangleId);
  return triangleIndex === undefined || triangleIndex === -1
    ? `/model/meshes/${meshId}/triangleStableIds`
    : `/model/meshes/${meshId}/triangles/${triangleIndex}`;
};

const createIndexedPath = (basePath: string, index: number | undefined): string =>
  index === undefined ? basePath : `${basePath}/${index}`;

const createMeshTarget = (meshId: MeshId | string): TargetRefDto => ({
  kind: "mesh",
  id: meshId
});

const createDrawableTarget = (drawableId: DrawableId | string): TargetRefDto => ({
  kind: "drawable",
  id: drawableId
});

const createPartTarget = (partId: PartId | string): TargetRefDto => ({
  kind: "part",
  id: partId
});

const createVertexTarget = (input: {
  readonly meshId: MeshId | string;
  readonly vertexId: VertexId | string;
  readonly path: string;
}): TargetRefDto => ({
  kind: "vertex",
  id: input.vertexId,
  path: input.path
});

const createTriangleTarget = (input: {
  readonly meshId: MeshId | string;
  readonly triangleId: TriangleId | string;
  readonly path: string;
}): TargetRefDto => ({
  kind: "triangle",
  id: input.triangleId,
  path: input.path
});

const isAddOperation = (operationType: OperationType): boolean =>
  operationType === "addMeshVertex" || operationType === "addMeshTriangle";

const isRemoveOperation = (operationType: OperationType): boolean =>
  operationType === "removeMeshVertex" || operationType === "removeMeshTriangle";

const uniqueStrings = <TValue extends string>(values: readonly TValue[]): readonly TValue[] => {
  const seen = new Set<TValue>();
  const unique: TValue[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
};

const uniqueTargetRefs = (targetRefs: readonly TargetRefDto[]): readonly TargetRefDto[] => {
  const seen = new Set<string>();
  const unique: TargetRefDto[] = [];

  for (const targetRef of targetRefs) {
    const key = `${targetRef.kind}:${targetRef.id}:${targetRef.path ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(targetRef);
  }

  return unique;
};
