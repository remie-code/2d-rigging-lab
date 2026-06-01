import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  getDrawableById,
  getMeshById,
  moveMeshVertices
} from "@private-2d-rigging-lab/authoring-core";
import type {
  AuthoringSession,
  MeshVertexDeltaInput,
  MoveMeshVerticesMutationResult
} from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  DrawableId,
  MeshId,
  ModelDiffDto,
  OperationId,
  PartId,
  TargetRefDto,
  VertexId
} from "@private-2d-rigging-lab/contracts";

import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";
import { createLockedTargetDiagnostics } from "./locked-targets.js";

type MoveMeshVertexRequest = Extract<OperationRequestDto, { operationType: "moveMeshVertex" }>;
type MeshDto = MoveMeshVerticesMutationResult["meshBefore"];

export const moveMeshVertexOperationHandler: OperationHandler = {
  operationType: "moveMeshVertex",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyMoveMeshVertex(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyMoveMeshVertex(session, request, operationId, "committed");
  }
};

const applyMoveMeshVertex = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "moveMeshVertex") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.moveMeshVertex.unsupportedPayload",
            message: `moveMeshVertex handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const targetIds = createTargetIds(request);
  const checkedTargets = createCheckedTargets(session, request);
  const preconditionDiagnostics = evaluateMoveMeshVertexPreconditions(session, request, checkedTargets);

  if (preconditionDiagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: preconditionDiagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;

  try {
    const mutation = moveMeshVertices(session, {
      meshId: request.payload.meshId,
      vertexDeltas: request.payload.vertexDeltas
    });

    return {
      result: createMoveMeshVertexResult({
        operationId,
        status,
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

    const diagnostic = createMoveMeshVertexMutationDiagnostic(error, operationId);
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: [diagnostic] }),
      targetIds,
      candidateSession: session
    };
  }
};

const evaluateMoveMeshVertexPreconditions = (
  session: AuthoringSession,
  request: MoveMeshVertexRequest,
  checkedTargets: readonly TargetRefDto[]
): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [
    ...createLockedTargetDiagnostics({
      operationType: "moveMeshVertex",
      lockedTargetIds: request.payload.lockedTargetIds,
      targets: checkedTargets
    })
  ];

  if (request.payload.keyformScope !== undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.moveMeshVertex.unsupportedKeyformScope",
        message: "keyform-scoped mesh vertex edits are outside the Wave 17 base mesh edit foundation.",
        target: {
          kind: "parameter",
          id: request.payload.keyformScope.parameterId,
          path: "/payload/keyformScope"
        }
      })
    );
  }

  if (request.payload.vertexDeltas.length === 0) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.moveMeshVertex.emptyDelta",
        message: "moveMeshVertex requires at least one vertex delta.",
        target: { kind: "mesh", id: request.payload.meshId, path: "/payload/vertexDeltas" }
      })
    );
  }

  const duplicateVertexIds = findDuplicateVertexDeltaIds(request.payload.vertexDeltas);
  diagnostics.push(
    ...duplicateVertexIds.map((vertexId) =>
      createOperationDiagnostic({
        checkId: "operation.moveMeshVertex.duplicateVertexDelta",
        message: `Vertex appears more than once in moveMeshVertex payload: ${vertexId}.`,
        target: { kind: "vertex", id: vertexId, path: "/payload/vertexDeltas" }
      })
    )
  );

  const mesh = getMeshById(session.graph, request.payload.meshId);
  if (mesh === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.moveMeshVertex.missingMesh",
        message: `Mesh does not exist: ${request.payload.meshId}.`,
        target: createMeshTarget(request.payload.meshId)
      })
    );
    return diagnostics;
  }

  const seenVertexIds = new Set<VertexId>();
  const vertexIndexById = createVertexIndexById(mesh);
  for (const vertexDelta of request.payload.vertexDeltas) {
    if (seenVertexIds.has(vertexDelta.vertexId)) {
      continue;
    }

    seenVertexIds.add(vertexDelta.vertexId);
    if (!vertexIndexById.has(vertexDelta.vertexId)) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.moveMeshVertex.missingVertex",
          message: `Mesh ${request.payload.meshId} does not contain vertex ${vertexDelta.vertexId}.`,
          target: {
            kind: "vertex",
            id: vertexDelta.vertexId,
            path: `/model/meshes/${request.payload.meshId}/vertexStableIds`
          }
        })
      );
    }
  }

  if (diagnostics.length === 0 && isMoveMeshVertexNoOp(mesh, request.payload.vertexDeltas)) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.moveMeshVertex.noOp",
        message: `Mesh vertex move does not change any vertex positions: ${request.payload.meshId}.`,
        target: { kind: "mesh", id: request.payload.meshId, path: `/model/meshes/${request.payload.meshId}/vertices` },
        severity: "warning"
      })
    );
  }

  return diagnostics;
};

const createMoveMeshVertexMutationDiagnostic = (
  error: AuthoringMutationError,
  operationId: OperationId
): DiagnosticDto => {
  const checkIdByCode: Partial<Record<AuthoringMutationError["code"], string>> = {
    missing_mesh: "operation.moveMeshVertex.missingMesh",
    missing_vertex: "operation.moveMeshVertex.missingVertex",
    empty_vertex_delta: "operation.moveMeshVertex.emptyDelta",
    duplicate_vertex_delta: "operation.moveMeshVertex.duplicateVertexDelta",
    no_op_mesh_vertex_update: "operation.moveMeshVertex.noOp"
  };

  return createOperationDiagnostic({
    checkId: checkIdByCode[error.code] ?? "operation.moveMeshVertex.authoringMutationFailed",
    message: error.message,
    target: { kind: "operation", id: operationId },
    severity: error.code === "no_op_mesh_vertex_update" ? "warning" : "error"
  });
};

const createMoveMeshVertexResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly mutation: MoveMeshVerticesMutationResult;
  readonly checkedTargets: readonly TargetRefDto[];
}): OperationResultDto => {
  const meshTarget = createMeshTarget(input.mutation.meshAfter.meshId);
  const fields: ModelDiffDto["changed"][number]["fields"] = [
    {
      path: `/model/meshes/${input.mutation.meshAfter.meshId}/vertices`,
      before: input.mutation.meshBefore.vertices,
      after: input.mutation.meshAfter.vertices
    },
    ...input.mutation.vertexChanges.map((change) => ({
      path: `/model/meshes/${input.mutation.meshAfter.meshId}/vertices/${change.vertexIndex}`,
      before: change.before,
      after: change.after
    }))
  ];

  if (!rectEqual(input.mutation.meshBefore.bounds, input.mutation.meshAfter.bounds)) {
    fields.push({
      path: `/model/meshes/${input.mutation.meshAfter.meshId}/bounds`,
      before: input.mutation.meshBefore.bounds,
      after: input.mutation.meshAfter.bounds
    });
  }

  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed: [
      {
        target: meshTarget,
        fields
      },
      ...input.mutation.vertexChanges.map((change) => ({
        target: {
          kind: "vertex" as const,
          id: change.vertexId,
          path: `/model/meshes/${input.mutation.meshAfter.meshId}/vertices/${change.vertexIndex}`
        },
        fields: [
          {
            path: `/model/meshes/${input.mutation.meshAfter.meshId}/vertices/${change.vertexIndex}`,
            before: change.before,
            after: change.after
          }
        ]
      }))
    ],
    operationIds: [input.operationId]
  };

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
    reversible: true
  });
};

const createTargetIds = (request: MoveMeshVertexRequest): readonly string[] =>
  uniqueStrings([
    request.payload.meshId,
    ...request.payload.vertexDeltas.map((vertexDelta) => vertexDelta.vertexId)
  ]);

const createCheckedTargets = (
  session: AuthoringSession,
  request: MoveMeshVertexRequest
): readonly TargetRefDto[] => {
  const mesh = getMeshById(session.graph, request.payload.meshId);
  const vertexIndexById = mesh === undefined ? undefined : createVertexIndexById(mesh);
  const refs: TargetRefDto[] = [createMeshTarget(request.payload.meshId)];

  if (mesh !== undefined) {
    refs.push(createDrawableTarget(mesh.drawableId));
    const drawable = getDrawableById(session.graph, mesh.drawableId);
    if (drawable !== undefined) {
      refs.push(createPartTarget(drawable.partId));
    }
  }

  refs.push(
    ...request.payload.vertexDeltas.map((vertexDelta) => {
      const vertexIndex = vertexIndexById?.get(vertexDelta.vertexId);

      return createVertexTarget({
        meshId: request.payload.meshId,
        vertexId: vertexDelta.vertexId,
        ...(vertexIndex === undefined ? {} : { vertexIndex })
      });
    })
  );

  return uniqueTargetRefs(refs);
};

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
  readonly vertexIndex?: number;
}): TargetRefDto => ({
  kind: "vertex",
  id: input.vertexId,
  path:
    input.vertexIndex === undefined
      ? `/model/meshes/${input.meshId}/vertexStableIds`
      : `/model/meshes/${input.meshId}/vertices/${input.vertexIndex}`
});

const createVertexIndexById = (mesh: MeshDto): ReadonlyMap<VertexId, number> => {
  const vertexIndexById = new Map<VertexId, number>();

  mesh.vertexStableIds.forEach((vertexId, vertexIndex) => {
    vertexIndexById.set(vertexId as VertexId, vertexIndex);
  });

  return vertexIndexById;
};

const findDuplicateVertexDeltaIds = (
  vertexDeltas: readonly MeshVertexDeltaInput[]
): readonly VertexId[] => {
  const seen = new Set<VertexId>();
  const duplicates: VertexId[] = [];

  for (const vertexDelta of vertexDeltas) {
    if (seen.has(vertexDelta.vertexId)) {
      duplicates.push(vertexDelta.vertexId);
      continue;
    }

    seen.add(vertexDelta.vertexId);
  }

  return uniqueStrings(duplicates) as readonly VertexId[];
};

const isMoveMeshVertexNoOp = (
  mesh: MeshDto,
  vertexDeltas: readonly MeshVertexDeltaInput[]
): boolean => {
  const vertexIndexById = createVertexIndexById(mesh);

  return vertexDeltas.every((vertexDelta) => {
    const vertexIndex = vertexIndexById.get(vertexDelta.vertexId);
    const vertex = vertexIndex === undefined ? undefined : mesh.vertices[vertexIndex];
    if (vertex === undefined) {
      return false;
    }

    return vertex.x + vertexDelta.delta.x === vertex.x && vertex.y + vertexDelta.delta.y === vertex.y;
  });
};

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

const rectEqual = (
  left: MeshDto["bounds"],
  right: MeshDto["bounds"]
): boolean =>
  left.x === right.x &&
  left.y === right.y &&
  left.width === right.width &&
  left.height === right.height;
