import type { MeshId, Vec2Dto, VertexId } from "@private-2d-rigging-lab/contracts";
import type { MeshDto, ProvenanceRecordDto } from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getDrawableById, getMeshById } from "./drawable-selectors.js";

export interface ReplaceDrawableMeshMutationResult {
  readonly session: AuthoringSession;
  readonly mesh: MeshDto;
  readonly authoringRevision: AuthoringRevision;
}

export interface MeshVertexDeltaInput {
  readonly vertexId: VertexId;
  readonly delta: Vec2Dto;
}

export interface MeshVertexChange {
  readonly vertexId: VertexId;
  readonly vertexIndex: number;
  readonly before: Vec2Dto;
  readonly after: Vec2Dto;
  readonly delta: Vec2Dto;
}

export interface MoveMeshVerticesMutationResult {
  readonly session: AuthoringSession;
  readonly meshBefore: MeshDto;
  readonly meshAfter: MeshDto;
  readonly vertexChanges: readonly MeshVertexChange[];
  readonly authoringRevision: AuthoringRevision;
}

export const replaceDrawableMesh = (
  session: AuthoringSession,
  mesh: MeshDto,
  provenanceRecord?: ProvenanceRecordDto
): ReplaceDrawableMeshMutationResult => {
  const drawable = getDrawableById(session.graph, mesh.drawableId);
  if (drawable === undefined) {
    throw new AuthoringMutationError(
      "missing_drawable",
      `Drawable does not exist: ${mesh.drawableId}`
    );
  }

  if (drawable.meshId !== mesh.meshId || getMeshById(session.graph, drawable.meshId) === undefined) {
    throw new AuthoringMutationError(
      "missing_mesh",
      `Drawable ${drawable.drawableId} references missing mesh ${drawable.meshId}.`
    );
  }

  const storedMesh = structuredClone(mesh);
  const meshIndex = session.graph.meshes.findIndex((candidate) => candidate.meshId === storedMesh.meshId);
  session.graph.meshes.splice(meshIndex, 1, storedMesh);

  if (provenanceRecord !== undefined) {
    upsertProvenanceRecord(session, provenanceRecord);
  }

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    mesh: storedMesh,
    authoringRevision: session.authoringRevision
  };
};

export const moveMeshVertices = (
  session: AuthoringSession,
  input: {
    readonly meshId: MeshId;
    readonly vertexDeltas: readonly MeshVertexDeltaInput[];
  }
): MoveMeshVerticesMutationResult => {
  if (input.vertexDeltas.length === 0) {
    throw new AuthoringMutationError(
      "empty_vertex_delta",
      `Mesh vertex move requires at least one vertex delta: ${input.meshId}.`
    );
  }

  const mesh = getMeshById(session.graph, input.meshId);
  if (mesh === undefined) {
    throw new AuthoringMutationError("missing_mesh", `Mesh does not exist: ${input.meshId}.`);
  }

  const vertexIndexById = createVertexIndexById(mesh);
  const seenVertexIds = new Set<VertexId>();
  const resolvedDeltas: {
    readonly vertexId: VertexId;
    readonly vertexIndex: number;
    readonly delta: Vec2Dto;
  }[] = [];

  for (const vertexDelta of input.vertexDeltas) {
    if (seenVertexIds.has(vertexDelta.vertexId)) {
      throw new AuthoringMutationError(
        "duplicate_vertex_delta",
        `Vertex appears more than once in mesh vertex deltas: ${vertexDelta.vertexId}.`
      );
    }

    seenVertexIds.add(vertexDelta.vertexId);
    const vertexIndex = vertexIndexById.get(vertexDelta.vertexId);
    if (vertexIndex === undefined) {
      throw new AuthoringMutationError(
        "missing_vertex",
        `Mesh ${input.meshId} does not contain vertex ${vertexDelta.vertexId}.`
      );
    }

    resolvedDeltas.push({
      vertexId: vertexDelta.vertexId,
      vertexIndex,
      delta: cloneVec2(vertexDelta.delta)
    });
  }

  const meshBefore = structuredClone(mesh);
  const verticesAfter = mesh.vertices.map(cloneVec2);
  const vertexChanges: MeshVertexChange[] = [];

  for (const resolvedDelta of resolvedDeltas) {
    const before = verticesAfter[resolvedDelta.vertexIndex];
    if (before === undefined) {
      throw new Error(`Expected resolved vertex index ${resolvedDelta.vertexIndex} for ${resolvedDelta.vertexId}.`);
    }

    const after = {
      x: normalizeZero(before.x + resolvedDelta.delta.x),
      y: normalizeZero(before.y + resolvedDelta.delta.y)
    };

    verticesAfter[resolvedDelta.vertexIndex] = after;

    if (!vec2Equal(before, after)) {
      vertexChanges.push({
        vertexId: resolvedDelta.vertexId,
        vertexIndex: resolvedDelta.vertexIndex,
        before: cloneVec2(before),
        after: cloneVec2(after),
        delta: cloneVec2(resolvedDelta.delta)
      });
    }
  }

  if (vertexChanges.length === 0) {
    throw new AuthoringMutationError(
      "no_op_mesh_vertex_update",
      `Mesh vertex move does not change any vertex positions: ${input.meshId}.`
    );
  }

  mesh.vertices = verticesAfter;
  mesh.bounds = computeBoundsFromVertices(verticesAfter);
  const meshAfter = structuredClone(mesh);

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    meshBefore,
    meshAfter,
    vertexChanges,
    authoringRevision: session.authoringRevision
  };
};

export const upsertProvenanceRecord = (
  session: AuthoringSession,
  provenanceRecord: ProvenanceRecordDto
): void => {
  const storedRecord = structuredClone(provenanceRecord);
  const existingIndex = session.graph.provenanceRecords.findIndex(
    (candidate) => candidate.provenanceId === storedRecord.provenanceId
  );

  if (existingIndex === -1) {
    session.graph.provenanceRecords.push(storedRecord);
    return;
  }

  session.graph.provenanceRecords.splice(existingIndex, 1, storedRecord);
};

const createVertexIndexById = (mesh: MeshDto): ReadonlyMap<VertexId, number> => {
  const vertexIndexById = new Map<VertexId, number>();

  mesh.vertexStableIds.forEach((vertexId, vertexIndex) => {
    vertexIndexById.set(vertexId as VertexId, vertexIndex);
  });

  return vertexIndexById;
};

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

const cloneVec2 = (value: Vec2Dto): Vec2Dto => ({
  x: value.x,
  y: value.y
});

const vec2Equal = (left: Vec2Dto, right: Vec2Dto): boolean =>
  left.x === right.x && left.y === right.y;

const normalizeZero = (value: number): number => (Object.is(value, -0) ? 0 : value);
