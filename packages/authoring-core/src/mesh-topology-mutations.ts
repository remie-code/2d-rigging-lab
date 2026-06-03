import type {
  MeshId,
  MeshTopologyRevisionDto,
  TriangleId,
  Vec2Dto,
  VertexId
} from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getMeshById } from "./drawable-selectors.js";

type MeshTriangle = MeshDto["triangles"][number];

export interface MeshTopologyMutationBaseInput {
  readonly meshId: MeshId;
  readonly expectedTopologyRevision?: MeshTopologyRevisionDto;
}

export interface AddMeshVertexInput extends MeshTopologyMutationBaseInput {
  readonly vertexId: VertexId;
  readonly position: Vec2Dto;
  readonly uv: Vec2Dto;
  readonly insertIndex?: number;
}

export interface RemoveMeshVertexInput extends MeshTopologyMutationBaseInput {
  readonly vertexId: VertexId;
}

export interface AddMeshTriangleInput extends MeshTopologyMutationBaseInput {
  readonly triangleId: TriangleId;
  readonly vertexIds: readonly [VertexId, VertexId, VertexId];
  readonly insertIndex?: number;
}

export interface RemoveMeshTriangleInput extends MeshTopologyMutationBaseInput {
  readonly triangleId: TriangleId;
}

export interface MeshUvDeltaInput {
  readonly vertexId: VertexId;
  readonly delta: Vec2Dto;
}

export interface MoveMeshUvPointsInput extends MeshTopologyMutationBaseInput {
  readonly uvDeltas: readonly MeshUvDeltaInput[];
}

export interface AddMeshVertexMutationResult {
  readonly session: AuthoringSession;
  readonly meshBefore: MeshDto;
  readonly meshAfter: MeshDto;
  readonly vertexId: VertexId;
  readonly vertexIndex: number;
  readonly authoringRevision: AuthoringRevision;
}

export interface RemoveMeshVertexMutationResult {
  readonly session: AuthoringSession;
  readonly meshBefore: MeshDto;
  readonly meshAfter: MeshDto;
  readonly vertexId: VertexId;
  readonly vertexIndex: number;
  readonly authoringRevision: AuthoringRevision;
}

export interface AddMeshTriangleMutationResult {
  readonly session: AuthoringSession;
  readonly meshBefore: MeshDto;
  readonly meshAfter: MeshDto;
  readonly triangleId: TriangleId;
  readonly triangleIndex: number;
  readonly vertexIds: readonly [VertexId, VertexId, VertexId];
  readonly authoringRevision: AuthoringRevision;
}

export interface RemoveMeshTriangleMutationResult {
  readonly session: AuthoringSession;
  readonly meshBefore: MeshDto;
  readonly meshAfter: MeshDto;
  readonly triangleId: TriangleId;
  readonly triangleIndex: number;
  readonly authoringRevision: AuthoringRevision;
}

export interface MeshUvPointChange {
  readonly vertexId: VertexId;
  readonly vertexIndex: number;
  readonly before: Vec2Dto;
  readonly after: Vec2Dto;
  readonly delta: Vec2Dto;
}

export interface MoveMeshUvPointsMutationResult {
  readonly session: AuthoringSession;
  readonly meshBefore: MeshDto;
  readonly meshAfter: MeshDto;
  readonly uvChanges: readonly MeshUvPointChange[];
  readonly authoringRevision: AuthoringRevision;
}

export const addMeshVertex = (
  session: AuthoringSession,
  input: AddMeshVertexInput
): AddMeshVertexMutationResult => {
  const mesh = getEditableMesh(session, input);
  const insertIndex = input.insertIndex ?? mesh.vertices.length;

  if (!isValidInsertIndex(insertIndex, mesh.vertices.length)) {
    throw new AuthoringMutationError(
      "invalid_vertex_insert_index",
      `Vertex insert index ${insertIndex} is outside mesh ${input.meshId}.`
    );
  }

  if (createVertexIndexById(mesh).has(input.vertexId)) {
    throw new AuthoringMutationError(
      "duplicate_vertex",
      `Mesh ${input.meshId} already contains vertex ${input.vertexId}.`
    );
  }

  const meshBefore = structuredClone(mesh);
  mesh.vertices = insertAt(mesh.vertices.map(cloneVec2), insertIndex, cloneVec2(input.position));
  mesh.uvs = insertAt(mesh.uvs.map(cloneVec2), insertIndex, cloneVec2(input.uv));
  mesh.vertexStableIds = insertAt([...mesh.vertexStableIds], insertIndex, input.vertexId);
  mesh.triangles = mesh.triangles.map((triangle) =>
    triangle.map((vertexIndex) => (vertexIndex >= insertIndex ? vertexIndex + 1 : vertexIndex)) as MeshTriangle
  );
  mesh.bounds = computeBoundsFromVertices(mesh.vertices);
  mesh.topologyRevision = getNextTopologyRevision(meshBefore);

  return finishTopologyMutation(session, mesh, meshBefore, {
    vertexId: input.vertexId,
    vertexIndex: insertIndex
  });
};

export const removeMeshVertex = (
  session: AuthoringSession,
  input: RemoveMeshVertexInput
): RemoveMeshVertexMutationResult => {
  const mesh = getEditableMesh(session, input);
  const vertexIndex = createVertexIndexById(mesh).get(input.vertexId);

  if (vertexIndex === undefined) {
    throw new AuthoringMutationError(
      "missing_vertex",
      `Mesh ${input.meshId} does not contain vertex ${input.vertexId}.`
    );
  }

  if (mesh.triangles.some((triangle) => triangle.includes(vertexIndex))) {
    throw new AuthoringMutationError(
      "referenced_vertex",
      `Mesh ${input.meshId} cannot remove referenced vertex ${input.vertexId}.`
    );
  }

  const meshBefore = structuredClone(mesh);
  mesh.vertices = removeAt(mesh.vertices.map(cloneVec2), vertexIndex);
  mesh.uvs = removeAt(mesh.uvs.map(cloneVec2), vertexIndex);
  mesh.vertexStableIds = removeAt([...mesh.vertexStableIds], vertexIndex);
  mesh.triangles = mesh.triangles.map((triangle) =>
    triangle.map((candidateIndex) => (candidateIndex > vertexIndex ? candidateIndex - 1 : candidateIndex)) as MeshTriangle
  );
  mesh.bounds = computeBoundsFromVertices(mesh.vertices);
  mesh.topologyRevision = getNextTopologyRevision(meshBefore);

  return finishTopologyMutation(session, mesh, meshBefore, {
    vertexId: input.vertexId,
    vertexIndex
  });
};

export const addMeshTriangle = (
  session: AuthoringSession,
  input: AddMeshTriangleInput
): AddMeshTriangleMutationResult => {
  const mesh = getEditableMesh(session, input);
  const insertIndex = input.insertIndex ?? mesh.triangles.length;

  if (!isValidInsertIndex(insertIndex, mesh.triangles.length)) {
    throw new AuthoringMutationError(
      "invalid_triangle_insert_index",
      `Triangle insert index ${insertIndex} is outside mesh ${input.meshId}.`
    );
  }

  if (new Set(input.vertexIds).size !== input.vertexIds.length) {
    throw new AuthoringMutationError(
      "duplicate_triangle_vertex",
      `Triangle ${input.triangleId} must reference three distinct vertices.`
    );
  }

  const vertexIndexById = createVertexIndexById(mesh);
  const vertexIndices = input.vertexIds.map((vertexId) => vertexIndexById.get(vertexId));
  const missingVertex = input.vertexIds.find((_, index) => vertexIndices[index] === undefined);
  if (missingVertex !== undefined) {
    throw new AuthoringMutationError(
      "missing_triangle_vertex",
      `Mesh ${input.meshId} does not contain triangle vertex ${missingVertex}.`
    );
  }

  const triangle: MeshTriangle = vertexIndices as MeshTriangle;
  const triangleStableIds = getTriangleStableIdsForMutation(mesh);
  if (triangleStableIds.includes(input.triangleId)) {
    throw new AuthoringMutationError(
      "duplicate_triangle",
      `Mesh ${input.meshId} already contains triangle ${input.triangleId}.`
    );
  }

  const triangleKey = createTriangleKey(triangle);
  if (new Set(mesh.triangles.map(createTriangleKey)).has(triangleKey)) {
    throw new AuthoringMutationError(
      "duplicate_triangle",
      `Mesh ${input.meshId} already contains a triangle with vertices ${input.vertexIds.join(",")}.`
    );
  }

  const meshBefore = structuredClone(mesh);
  mesh.triangles = insertAt(mesh.triangles.map(cloneTriangle), insertIndex, cloneTriangle(triangle));
  mesh.triangleStableIds = insertAt(triangleStableIds, insertIndex, input.triangleId);
  mesh.topologyRevision = getNextTopologyRevision(meshBefore);

  return finishTopologyMutation(session, mesh, meshBefore, {
    triangleId: input.triangleId,
    triangleIndex: insertIndex,
    vertexIds: input.vertexIds
  });
};

export const removeMeshTriangle = (
  session: AuthoringSession,
  input: RemoveMeshTriangleInput
): RemoveMeshTriangleMutationResult => {
  const mesh = getEditableMesh(session, input);
  const triangleStableIds = getTriangleStableIdsForMutation(mesh);
  const triangleIndex = triangleStableIds.indexOf(input.triangleId);

  if (triangleIndex === -1) {
    throw new AuthoringMutationError(
      "missing_triangle",
      `Mesh ${input.meshId} does not contain triangle ${input.triangleId}.`
    );
  }

  const meshBefore = structuredClone(mesh);
  mesh.triangles = removeAt(mesh.triangles.map(cloneTriangle), triangleIndex);
  mesh.triangleStableIds = removeAt(triangleStableIds, triangleIndex);
  mesh.topologyRevision = getNextTopologyRevision(meshBefore);

  return finishTopologyMutation(session, mesh, meshBefore, {
    triangleId: input.triangleId,
    triangleIndex
  });
};

export const moveMeshUvPoints = (
  session: AuthoringSession,
  input: MoveMeshUvPointsInput
): MoveMeshUvPointsMutationResult => {
  if (input.uvDeltas.length === 0) {
    throw new AuthoringMutationError(
      "empty_uv_delta",
      `Mesh UV edit requires at least one UV delta: ${input.meshId}.`
    );
  }

  const mesh = getEditableMesh(session, input);
  const vertexIndexById = createVertexIndexById(mesh);
  const seenVertexIds = new Set<VertexId>();
  const resolvedDeltas: {
    readonly vertexId: VertexId;
    readonly vertexIndex: number;
    readonly delta: Vec2Dto;
  }[] = [];

  for (const uvDelta of input.uvDeltas) {
    if (seenVertexIds.has(uvDelta.vertexId)) {
      throw new AuthoringMutationError(
        "duplicate_uv_delta",
        `Vertex appears more than once in mesh UV deltas: ${uvDelta.vertexId}.`
      );
    }

    seenVertexIds.add(uvDelta.vertexId);
    const vertexIndex = vertexIndexById.get(uvDelta.vertexId);
    if (vertexIndex === undefined) {
      throw new AuthoringMutationError(
        "missing_vertex",
        `Mesh ${input.meshId} does not contain vertex ${uvDelta.vertexId}.`
      );
    }

    resolvedDeltas.push({
      vertexId: uvDelta.vertexId,
      vertexIndex,
      delta: cloneVec2(uvDelta.delta)
    });
  }

  const meshBefore = structuredClone(mesh);
  const uvsAfter = mesh.uvs.map(cloneVec2);
  const uvChanges: MeshUvPointChange[] = [];

  for (const resolvedDelta of resolvedDeltas) {
    const before = uvsAfter[resolvedDelta.vertexIndex];
    if (before === undefined) {
      throw new Error(`Expected resolved UV index ${resolvedDelta.vertexIndex} for ${resolvedDelta.vertexId}.`);
    }

    const after = {
      x: normalizeZero(before.x + resolvedDelta.delta.x),
      y: normalizeZero(before.y + resolvedDelta.delta.y)
    };

    uvsAfter[resolvedDelta.vertexIndex] = after;

    if (!vec2Equal(before, after)) {
      uvChanges.push({
        vertexId: resolvedDelta.vertexId,
        vertexIndex: resolvedDelta.vertexIndex,
        before: cloneVec2(before),
        after: cloneVec2(after),
        delta: cloneVec2(resolvedDelta.delta)
      });
    }
  }

  if (uvChanges.length === 0) {
    throw new AuthoringMutationError(
      "no_op_mesh_uv_update",
      `Mesh UV edit does not change any UV coordinates: ${input.meshId}.`
    );
  }

  mesh.uvs = uvsAfter;
  mesh.topologyRevision = getNextTopologyRevision(meshBefore);

  return finishTopologyMutation(session, mesh, meshBefore, { uvChanges });
};

const getEditableMesh = (
  session: AuthoringSession,
  input: MeshTopologyMutationBaseInput
): MeshDto => {
  const mesh = getMeshById(session.graph, input.meshId);
  if (mesh === undefined) {
    throw new AuthoringMutationError("missing_mesh", `Mesh does not exist: ${input.meshId}.`);
  }

  assertExpectedTopologyRevision(mesh, input.expectedTopologyRevision);
  assertMeshTopologyEditable(mesh);
  return mesh;
};

const finishTopologyMutation = <TExtra extends Record<string, unknown>>(
  session: AuthoringSession,
  mesh: MeshDto,
  meshBefore: MeshDto,
  extra: TExtra
): TExtra & {
  readonly session: AuthoringSession;
  readonly meshBefore: MeshDto;
  readonly meshAfter: MeshDto;
  readonly authoringRevision: AuthoringRevision;
} => {
  const meshAfter = structuredClone(mesh);
  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    meshBefore,
    meshAfter,
    authoringRevision: session.authoringRevision,
    ...extra
  };
};

const assertExpectedTopologyRevision = (
  mesh: MeshDto,
  expectedTopologyRevision: MeshTopologyRevisionDto | undefined
): void => {
  if (expectedTopologyRevision === undefined) {
    return;
  }

  const actualRevision = getTopologyRevision(mesh);
  if (actualRevision !== expectedTopologyRevision) {
    throw new AuthoringMutationError(
      "topology_revision_mismatch",
      `Mesh ${mesh.meshId} topology revision ${actualRevision} does not match expected ${expectedTopologyRevision}.`
    );
  }
};

const assertMeshTopologyEditable = (mesh: MeshDto): void => {
  if (
    mesh.vertices.length !== mesh.uvs.length ||
    mesh.vertices.length !== mesh.vertexStableIds.length
  ) {
    throw new AuthoringMutationError(
      "mesh_vertex_cardinality_mismatch",
      `Mesh ${mesh.meshId} must have aligned vertices, uvs, and vertexStableIds before topology edits.`
    );
  }

  if (
    mesh.triangleStableIds !== undefined &&
    mesh.triangleStableIds.length !== mesh.triangles.length
  ) {
    throw new AuthoringMutationError(
      "mesh_triangle_stable_id_count_mismatch",
      `Mesh ${mesh.meshId} triangleStableIds must align with triangles before topology edits.`
    );
  }

  const vertexCount = mesh.vertices.length;
  for (const triangle of mesh.triangles) {
    if (new Set(triangle).size !== triangle.length) {
      throw new AuthoringMutationError(
        "degenerate_triangle",
        `Mesh ${mesh.meshId} contains a degenerate triangle.`
      );
    }

    if (triangle.some((vertexIndex) => vertexIndex >= vertexCount)) {
      throw new AuthoringMutationError(
        "invalid_triangle_reference",
        `Mesh ${mesh.meshId} contains a triangle referencing a missing vertex.`
      );
    }
  }
};

const getTriangleStableIdsForMutation = (mesh: MeshDto): TriangleId[] => {
  if (mesh.triangleStableIds !== undefined) {
    return [...mesh.triangleStableIds] as TriangleId[];
  }

  const token = stripMeshPrefix(mesh.meshId);
  return mesh.triangles.map((_, triangleIndex) => `tri_${token}_existing_${triangleIndex}` as TriangleId);
};

const createVertexIndexById = (mesh: MeshDto): ReadonlyMap<VertexId, number> => {
  const vertexIndexById = new Map<VertexId, number>();

  mesh.vertexStableIds.forEach((vertexId, vertexIndex) => {
    vertexIndexById.set(vertexId as VertexId, vertexIndex);
  });

  return vertexIndexById;
};

const getTopologyRevision = (mesh: MeshDto): MeshTopologyRevisionDto =>
  (mesh.topologyRevision ?? 0) as MeshTopologyRevisionDto;

const getNextTopologyRevision = (meshBefore: MeshDto): MeshTopologyRevisionDto =>
  (getTopologyRevision(meshBefore) + 1) as MeshTopologyRevisionDto;

const computeBoundsFromVertices = (vertices: readonly Vec2Dto[]): MeshDto["bounds"] => {
  const first = vertices[0];
  if (first === undefined) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0
    };
  }

  let minX = first.x;
  let minY = first.y;
  let maxX = first.x;
  let maxY = first.y;

  for (const vertex of vertices.slice(1)) {
    minX = Math.min(minX, vertex.x);
    minY = Math.min(minY, vertex.y);
    maxX = Math.max(maxX, vertex.x);
    maxY = Math.max(maxY, vertex.y);
  }

  return {
    x: normalizeZero(minX),
    y: normalizeZero(minY),
    width: normalizeZero(maxX - minX),
    height: normalizeZero(maxY - minY)
  };
};

const insertAt = <TValue>(
  values: readonly TValue[],
  index: number,
  value: TValue
): TValue[] => [
  ...values.slice(0, index),
  value,
  ...values.slice(index)
];

const removeAt = <TValue>(
  values: readonly TValue[],
  index: number
): TValue[] => [
  ...values.slice(0, index),
  ...values.slice(index + 1)
];

const isValidInsertIndex = (
  index: number,
  maxInclusive: number
): boolean => Number.isInteger(index) && Number.isFinite(index) && index >= 0 && index <= maxInclusive;

const cloneVec2 = (value: Vec2Dto): Vec2Dto => ({
  x: value.x,
  y: value.y
});

const cloneTriangle = (triangle: MeshTriangle): MeshTriangle => [
  triangle[0],
  triangle[1],
  triangle[2]
];

const createTriangleKey = (triangle: MeshTriangle): string =>
  [...triangle].sort((left, right) => left - right).join(":");

const vec2Equal = (left: Vec2Dto, right: Vec2Dto): boolean =>
  left.x === right.x && left.y === right.y;

const normalizeZero = (value: number): number => (Object.is(value, -0) ? 0 : value);

const stripMeshPrefix = (meshId: string): string =>
  meshId.startsWith("mesh_") ? meshId.slice("mesh_".length) : meshId;
