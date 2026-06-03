import type { Vec2Dto } from "@private-2d-rigging-lab/contracts";

import type {
  EditableMeshTriangleState,
  EditableMeshVertexState,
  MeshCanvasEditDisabledReason,
  MeshEditState
} from "./mesh-edit-state.js";

export const defaultMeshUvNudgeStep = 0.05;

export type MeshUvNudgeDirection = "left" | "right" | "up" | "down";

export type MeshTopologyDraftBlockedReason =
  | MeshCanvasEditDisabledReason
  | "noSelectedVertices"
  | "requiresOneSelectedVertex"
  | "requiresThreeSelectedVertices"
  | "selectedVertexReferenced"
  | "triangleAlreadyExists"
  | "missingTriangleStableId"
  | "invalidDelta";

export interface MeshTopologyAddVertexDraftCommand {
  readonly operationType: "addMeshVertex";
  readonly meshId: string;
  readonly vertexId: string;
  readonly position: Vec2Dto;
  readonly uv: Vec2Dto;
  readonly expectedTopologyRevision: number;
  readonly intent: string;
}

export interface MeshTopologyRemoveVertexDraftCommand {
  readonly operationType: "removeMeshVertex";
  readonly meshId: string;
  readonly vertexId: string;
  readonly expectedTopologyRevision: number;
  readonly intent: string;
}

export interface MeshTopologyAddTriangleDraftCommand {
  readonly operationType: "addMeshTriangle";
  readonly meshId: string;
  readonly triangleId: string;
  readonly vertexIds: readonly [string, string, string];
  readonly expectedTopologyRevision: number;
  readonly intent: string;
}

export interface MeshTopologyRemoveTriangleDraftCommand {
  readonly operationType: "removeMeshTriangle";
  readonly meshId: string;
  readonly triangleId: string;
  readonly expectedTopologyRevision: number;
  readonly intent: string;
}

export interface MeshUvNudgeDraftCommand {
  readonly operationType: "moveMeshUvPoint";
  readonly meshId: string;
  readonly uvDeltas: readonly {
    readonly vertexId: string;
    readonly delta: Vec2Dto;
  }[];
  readonly selectedVertexIds: readonly string[];
  readonly expectedTopologyRevision: number;
  readonly intent: string;
}

export type MeshTopologyDraftCommand =
  | MeshTopologyAddVertexDraftCommand
  | MeshTopologyRemoveVertexDraftCommand
  | MeshTopologyAddTriangleDraftCommand
  | MeshTopologyRemoveTriangleDraftCommand
  | MeshUvNudgeDraftCommand;

export interface MeshTopologyDraft<TCommand extends MeshTopologyDraftCommand> {
  readonly status: "ready" | "blocked";
  readonly command: TCommand | null;
  readonly blockedReason: MeshTopologyDraftBlockedReason | null;
}

export const createMeshAddVertexDraftCommand = (
  state: MeshEditState
): MeshTopologyDraft<MeshTopologyAddVertexDraftCommand> => {
  const blockedReason = resolveMeshTopologyEditBlockedReason(state);
  if (blockedReason !== null || state.selectedMesh === null) {
    return createBlockedDraft(blockedReason ?? "noMesh");
  }

  const defaults = createAddVertexDefaults(state);
  const vertexId = createGeneratedVertexId(state);

  return {
    status: "ready",
    command: {
      operationType: "addMeshVertex",
      meshId: state.selectedMesh.meshId,
      vertexId,
      position: defaults.position,
      uv: defaults.uv,
      expectedTopologyRevision: state.selectedMesh.topologyRevision,
      intent: `Add mesh vertex ${vertexId} at ${formatNumberToken(defaults.position.x)}, ${formatNumberToken(defaults.position.y)}`
    },
    blockedReason: null
  };
};

export const createMeshRemoveSelectedVertexDraftCommand = (
  state: MeshEditState
): MeshTopologyDraft<MeshTopologyRemoveVertexDraftCommand> => {
  const blockedReason = resolveMeshTopologyEditBlockedReason(state);
  if (blockedReason !== null || state.selectedMesh === null) {
    return createBlockedDraft(blockedReason ?? "noMesh");
  }

  if (state.selectedVertexIds.length !== 1) {
    return createBlockedDraft("requiresOneSelectedVertex");
  }

  const vertexId = state.selectedVertexIds[0];
  if (vertexId === undefined || isVertexReferenced(state.editableTriangles, vertexId)) {
    return createBlockedDraft("selectedVertexReferenced");
  }

  return {
    status: "ready",
    command: {
      operationType: "removeMeshVertex",
      meshId: state.selectedMesh.meshId,
      vertexId,
      expectedTopologyRevision: state.selectedMesh.topologyRevision,
      intent: `Remove unreferenced mesh vertex ${vertexId}`
    },
    blockedReason: null
  };
};

export const createMeshAddTriangleDraftCommand = (
  state: MeshEditState
): MeshTopologyDraft<MeshTopologyAddTriangleDraftCommand> => {
  const blockedReason = resolveMeshTopologyEditBlockedReason(state);
  if (blockedReason !== null || state.selectedMesh === null) {
    return createBlockedDraft(blockedReason ?? "noMesh");
  }

  if (state.selectedVertexIds.length !== 3) {
    return createBlockedDraft("requiresThreeSelectedVertices");
  }

  const vertexIds = [
    state.selectedVertexIds[0],
    state.selectedVertexIds[1],
    state.selectedVertexIds[2]
  ] as readonly [string, string, string];
  if (hasTriangleWithVertexIds(state.editableTriangles, vertexIds)) {
    return createBlockedDraft("triangleAlreadyExists");
  }

  const triangleId = createGeneratedTriangleId(state);

  return {
    status: "ready",
    command: {
      operationType: "addMeshTriangle",
      meshId: state.selectedMesh.meshId,
      triangleId,
      vertexIds,
      expectedTopologyRevision: state.selectedMesh.topologyRevision,
      intent: `Add mesh triangle ${triangleId} from ${vertexIds.join(", ")}`
    },
    blockedReason: null
  };
};

export const createMeshRemoveTriangleDraftCommand = (
  state: MeshEditState,
  triangleId: string
): MeshTopologyDraft<MeshTopologyRemoveTriangleDraftCommand> => {
  const blockedReason = resolveMeshTopologyEditBlockedReason(state);
  if (blockedReason !== null || state.selectedMesh === null) {
    return createBlockedDraft(blockedReason ?? "noMesh");
  }

  const triangle = state.editableTriangles.find((candidate) => candidate.triangleId === triangleId);
  if (triangle === undefined || !triangle.removable || triangle.triangleId === null) {
    return createBlockedDraft("missingTriangleStableId");
  }

  return {
    status: "ready",
    command: {
      operationType: "removeMeshTriangle",
      meshId: state.selectedMesh.meshId,
      triangleId: triangle.triangleId,
      expectedTopologyRevision: state.selectedMesh.topologyRevision,
      intent: `Remove mesh triangle ${triangle.triangleId}`
    },
    blockedReason: null
  };
};

export const createMeshUvNudgeDraftCommand = (
  state: MeshEditState,
  delta: Vec2Dto
): MeshTopologyDraft<MeshUvNudgeDraftCommand> => {
  const blockedReason = resolveMeshTopologyEditBlockedReason(state);
  if (blockedReason !== null || state.selectedMesh === null) {
    return createBlockedDraft(blockedReason ?? "noMesh");
  }

  if (state.selectedVertexIds.length === 0) {
    return createBlockedDraft("noSelectedVertices");
  }

  if (!isValidDelta(delta)) {
    return createBlockedDraft("invalidDelta");
  }

  return {
    status: "ready",
    command: {
      operationType: "moveMeshUvPoint",
      meshId: state.selectedMesh.meshId,
      uvDeltas: state.selectedVertexIds.map((vertexId) => ({
        vertexId,
        delta: cloneVec2(delta)
      })),
      selectedVertexIds: state.selectedVertexIds,
      expectedTopologyRevision: state.selectedMesh.topologyRevision,
      intent: `Nudge UV for ${state.selectedVertexIds.join(", ")} by ${formatNumberToken(delta.x)}, ${formatNumberToken(delta.y)}`
    },
    blockedReason: null
  };
};

export const createMeshUvNudgeDelta = (
  direction: MeshUvNudgeDirection,
  step: number = defaultMeshUvNudgeStep
): Vec2Dto => {
  switch (direction) {
    case "left":
      return { x: -step, y: 0 };
    case "right":
      return { x: step, y: 0 };
    case "up":
      return { x: 0, y: -step };
    case "down":
      return { x: 0, y: step };
  }
};

const createAddVertexDefaults = (
  state: MeshEditState
): {
  readonly position: Vec2Dto;
  readonly uv: Vec2Dto;
} => {
  const selectedVertices = state.editableVertices.filter((vertex) =>
    state.selectedVertexIds.includes(vertex.vertexId)
  );

  if (selectedVertices.length > 0) {
    return {
      position: averageVec2(selectedVertices.map((vertex) => vertex.position)),
      uv: averageVec2(selectedVertices.map((vertex) => vertex.uv))
    };
  }

  return {
    position:
      state.selectedMesh === null
        ? { x: 0, y: 0 }
        : {
            x: state.selectedMesh.bounds.x + state.selectedMesh.bounds.width / 2,
            y: state.selectedMesh.bounds.y + state.selectedMesh.bounds.height / 2
          },
    uv: { x: 0.5, y: 0.5 }
  };
};

const resolveMeshTopologyEditBlockedReason = (
  state: MeshEditState
): MeshCanvasEditDisabledReason | null => state.editDisabledReason;

const createGeneratedVertexId = (state: MeshEditState): string =>
  `vtx_${createMeshToken(state)}_editor_${state.selectedMesh?.topologyRevision ?? 0}_${state.editableVertices.length}`;

const createGeneratedTriangleId = (state: MeshEditState): string =>
  `tri_${createMeshToken(state)}_editor_${state.selectedMesh?.topologyRevision ?? 0}_${state.editableTriangles.length}`;

const createMeshToken = (state: MeshEditState): string => {
  const meshId = state.selectedMesh?.meshId ?? "mesh";
  const withoutPrefix = meshId.startsWith("mesh_") ? meshId.slice("mesh_".length) : meshId;
  const token = withoutPrefix.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return token.length > 0 ? token : "mesh";
};

const hasTriangleWithVertexIds = (
  triangles: readonly EditableMeshTriangleState[],
  vertexIds: readonly [string, string, string]
): boolean => {
  const key = createTriangleVertexKey(vertexIds);
  return triangles.some((triangle) => createTriangleVertexKey(triangle.vertexIds) === key);
};

const isVertexReferenced = (
  triangles: readonly EditableMeshTriangleState[],
  vertexId: string
): boolean => triangles.some((triangle) => triangle.vertexIds.includes(vertexId));

const createTriangleVertexKey = (
  vertexIds: readonly [string, string, string]
): string => [...vertexIds].sort().join(":");

const averageVec2 = (values: readonly Vec2Dto[]): Vec2Dto => ({
  x: normalizeZero(values.reduce((sum, value) => sum + value.x, 0) / values.length),
  y: normalizeZero(values.reduce((sum, value) => sum + value.y, 0) / values.length)
});

const isValidDelta = (delta: Vec2Dto): boolean =>
  Number.isFinite(delta.x) &&
  Number.isFinite(delta.y) &&
  (delta.x !== 0 || delta.y !== 0);

const cloneVec2 = (value: Vec2Dto): Vec2Dto => ({
  x: value.x,
  y: value.y
});

const normalizeZero = (value: number): number => (Object.is(value, -0) ? 0 : value);

const formatNumberToken = (value: number): string =>
  Number.isInteger(value) ? `${value}` : Number.parseFloat(value.toFixed(4)).toString();

const createBlockedDraft = <TCommand extends MeshTopologyDraftCommand>(
  blockedReason: MeshTopologyDraftBlockedReason
): MeshTopologyDraft<TCommand> => ({
  status: "blocked",
  command: null,
  blockedReason
});
