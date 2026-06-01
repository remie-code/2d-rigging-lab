import type { Vec2Dto } from "@private-2d-rigging-lab/contracts";

import {
  createMeshEditStateWithSelectedVertices,
  type MeshCanvasEditDisabledReason,
  type MeshCanvasVertexHitTargetState,
  type MeshEditState
} from "./mesh-edit-state.js";

export type MeshCanvasVertexSelectionMode = "replace" | "add" | "toggle" | "remove";

export type MeshCanvasMoveDraftSource = "canvasDrag" | "canvasNudge";

export type MeshCanvasMoveDraftBlockedReason =
  | MeshCanvasEditDisabledReason
  | "noSelectedVertices"
  | "invalidDelta";

export interface MeshCanvasPointInput {
  readonly x: number;
  readonly y: number;
}

export interface MeshCanvasHitTestOptions {
  readonly includeDisabledTargets?: boolean;
}

export interface MeshCanvasVertexSelectionCommand {
  readonly vertexId: string;
  readonly mode?: MeshCanvasVertexSelectionMode;
}

export interface MeshCanvasHitSelectionCommand {
  readonly point: MeshCanvasPointInput;
  readonly mode?: MeshCanvasVertexSelectionMode;
  readonly includeDisabledTargets?: boolean;
}

export interface MeshCanvasMoveDraftCommand {
  readonly operationType: "moveMeshVertex";
  readonly meshId: string;
  readonly vertexDeltas: readonly {
    readonly vertexId: string;
    readonly delta: Vec2Dto;
  }[];
  readonly selectedVertexIds: readonly string[];
  readonly source: MeshCanvasMoveDraftSource;
  readonly intent: string;
}

export interface MeshCanvasMoveDraft {
  readonly status: "ready" | "blocked";
  readonly command: MeshCanvasMoveDraftCommand | null;
  readonly blockedReason: MeshCanvasMoveDraftBlockedReason | null;
}

export const clearMeshCanvasVertexSelection = (state: MeshEditState): MeshEditState =>
  createMeshEditStateWithSelectedVertices(state, []);

export const selectMeshCanvasVertex = (
  state: MeshEditState,
  command: MeshCanvasVertexSelectionCommand
): MeshEditState => {
  if (!canSelectMeshCanvasVertices(state)) {
    return state;
  }

  const vertexId = command.vertexId.trim();
  const mode = command.mode ?? "replace";
  const hasTarget = state.editableVertices.some((vertex) => vertex.vertexId === vertexId);
  if (!hasTarget) {
    return mode === "replace" ? clearMeshCanvasVertexSelection(state) : state;
  }

  switch (mode) {
    case "replace":
      return createMeshEditStateWithSelectedVertices(state, [vertexId]);
    case "add":
      return createMeshEditStateWithSelectedVertices(state, [
        ...state.selectedVertexIds,
        vertexId
      ]);
    case "remove":
      return createMeshEditStateWithSelectedVertices(
        state,
        state.selectedVertexIds.filter((selectedVertexId) => selectedVertexId !== vertexId)
      );
    case "toggle":
      return state.selectedVertexIds.includes(vertexId)
        ? selectMeshCanvasVertex(state, { vertexId, mode: "remove" })
        : selectMeshCanvasVertex(state, { vertexId, mode: "add" });
  }
};

export const selectMeshCanvasHitTarget = (
  state: MeshEditState,
  command: MeshCanvasHitSelectionCommand
): MeshEditState => {
  const hitTarget = hitTestMeshCanvasVertices(
    state,
    command.point,
    command.includeDisabledTargets === undefined
      ? {}
      : { includeDisabledTargets: command.includeDisabledTargets }
  );

  if (hitTarget === null) {
    return (command.mode ?? "replace") === "replace"
      ? clearMeshCanvasVertexSelection(state)
      : state;
  }

  return selectMeshCanvasVertex(state, {
    vertexId: hitTarget.vertexId,
    ...(command.mode === undefined ? {} : { mode: command.mode })
  });
};

export const hitTestMeshCanvasVertices = (
  state: MeshEditState,
  point: MeshCanvasPointInput,
  options: MeshCanvasHitTestOptions = {}
): MeshCanvasVertexHitTargetState | null => {
  const hits = state.canvasHitTargets
    .filter((target) => options.includeDisabledTargets === true || target.selectable)
    .map((target) => ({
      target,
      distanceSquared: square(point.x - target.canvasPosition.x) +
        square(point.y - target.canvasPosition.y)
    }))
    .filter((hit) => hit.distanceSquared <= square(hit.target.hitRadius))
    .sort(compareHitTargets);

  return hits[0]?.target ?? null;
};

export const createMeshCanvasDragDraftCommand = (
  state: MeshEditState,
  delta: Vec2Dto
): MeshCanvasMoveDraft => createMeshCanvasMoveDraftCommand(state, delta, "canvasDrag");

export const createMeshCanvasNudgeDraftCommand = (
  state: MeshEditState,
  delta: Vec2Dto
): MeshCanvasMoveDraft => createMeshCanvasMoveDraftCommand(state, delta, "canvasNudge");

const createMeshCanvasMoveDraftCommand = (
  state: MeshEditState,
  delta: Vec2Dto,
  source: MeshCanvasMoveDraftSource
): MeshCanvasMoveDraft => {
  const blockedReason = resolveMoveDraftBlockedReason(state, delta);
  if (blockedReason !== null || state.selectedMesh === null) {
    return {
      status: "blocked",
      command: null,
      blockedReason: blockedReason ?? "noMesh"
    };
  }

  const selectedVertexIds = state.selectedVertexIds;
  const vertexDeltas = selectedVertexIds.map((vertexId) => ({
    vertexId,
    delta: {
      x: delta.x,
      y: delta.y
    }
  }));

  return {
    status: "ready",
    command: {
      operationType: "moveMeshVertex",
      meshId: state.selectedMesh.meshId,
      vertexDeltas,
      selectedVertexIds,
      source,
      intent: `${source} ${selectedVertexIds.join(", ")} by ${formatNumberToken(delta.x)}, ${formatNumberToken(delta.y)}`
    },
    blockedReason: null
  };
};

const canSelectMeshCanvasVertices = (state: MeshEditState): boolean =>
  state.editDisabledReason === null;

const resolveMoveDraftBlockedReason = (
  state: MeshEditState,
  delta: Vec2Dto
): MeshCanvasMoveDraftBlockedReason | null => {
  if (state.editDisabledReason !== null) {
    return state.editDisabledReason;
  }

  if (state.selectedVertexIds.length === 0) {
    return "noSelectedVertices";
  }

  if (!isValidMoveDelta(delta)) {
    return "invalidDelta";
  }

  return null;
};

const isValidMoveDelta = (delta: Vec2Dto): boolean =>
  Number.isFinite(delta.x) &&
  Number.isFinite(delta.y) &&
  (delta.x !== 0 || delta.y !== 0);

const compareHitTargets = (
  left: {
    readonly target: MeshCanvasVertexHitTargetState;
    readonly distanceSquared: number;
  },
  right: {
    readonly target: MeshCanvasVertexHitTargetState;
    readonly distanceSquared: number;
  }
): number => {
  const distanceDelta = left.distanceSquared - right.distanceSquared;
  if (distanceDelta !== 0) {
    return distanceDelta;
  }

  const indexDelta = left.target.vertexIndex - right.target.vertexIndex;
  if (indexDelta !== 0) {
    return indexDelta;
  }

  return left.target.vertexId.localeCompare(right.target.vertexId);
};

const square = (value: number): number => value * value;

const formatNumberToken = (value: number): string =>
  Number.isInteger(value) ? `${value}` : Number.parseFloat(value.toFixed(4)).toString();
