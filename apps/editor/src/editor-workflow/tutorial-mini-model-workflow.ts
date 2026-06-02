import { TUTORIAL_MINI_MODEL_IDS } from "@private-2d-rigging-lab/authoring-core";
import {
  createTutorialMiniModelOperationRequests,
  TUTORIAL_MINI_MODEL_RECIPE_ID,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";

import {
  createEditorTutorialMiniModelSeedAdapter,
  type EditorSessionAdapter,
  type EditorSessionPersistenceResult
} from "../editor-session/index.js";
import type { EditorSemanticState } from "../editor-state/index.js";
import { applyEditorWorkflowCommitResult, createEditorWorkflowState } from "./workflow-state-projection.js";
import { selectWorkflowDrawableLayer } from "./part-texture-layer-workflow.js";

export interface EditorWorkflowTutorialCreateOutcome {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult | null;
  readonly result: EditorWorkflowTutorialCreateResult;
}

export type EditorWorkflowTutorialCreateResult =
  | {
      readonly status: "created";
      readonly recipeId: typeof TUTORIAL_MINI_MODEL_RECIPE_ID;
      readonly operationCount: number;
      readonly packageRevision: number;
    }
  | {
      readonly status: "rejected";
      readonly recipeId: typeof TUTORIAL_MINI_MODEL_RECIPE_ID;
      readonly rejectedOperationId: string;
      readonly operationCount: number;
      readonly latestSessionPersistenceResult: EditorSessionPersistenceResult;
    };

export interface EditorWorkflowTutorialSmallEditOutcome {
  readonly state: EditorSemanticState;
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult | null;
  readonly result: EditorWorkflowTutorialSmallEditResult;
}

export type EditorWorkflowTutorialSmallEditResult =
  | {
      readonly status: "not_found";
      readonly reason:
        | "front_hair_drawable_missing"
        | "front_hair_mesh_missing"
        | "editable_vertex_missing";
      readonly targetId: string;
    }
  | {
      readonly status: "committed" | "rejected";
      readonly meshId: string;
      readonly vertexId: string;
      readonly result: EditorSessionPersistenceResult;
    };

export const createWorkflowTutorialMiniModel = (input: {
  readonly now?: () => Date;
} = {}): EditorWorkflowTutorialCreateOutcome => {
  const adapter = createEditorTutorialMiniModelSeedAdapter({
    ...(input.now === undefined ? {} : { now: input.now })
  });
  let state = createEditorWorkflowState(adapter, {
    ...(input.now === undefined ? {} : { now: input.now })
  });
  let latestSessionPersistenceResult: EditorSessionPersistenceResult | null = null;
  let operationCount = 0;

  for (const request of createEditorTutorialMiniModelOperationRequests()) {
    const result = adapter.commitOperation(request);
    latestSessionPersistenceResult = result;
    operationCount += 1;
    state = applyEditorWorkflowCommitResult(state, adapter, result, {
      ...(input.now === undefined ? {} : { now: input.now })
    });

    if (result.operationResult.status !== "committed") {
      return {
        adapter,
        state,
        latestSessionPersistenceResult,
        result: {
          status: "rejected",
          recipeId: TUTORIAL_MINI_MODEL_RECIPE_ID,
          rejectedOperationId: request.operationId ?? request.operationType,
          operationCount,
          latestSessionPersistenceResult: result
        }
      };
    }
  }

  return {
    adapter,
    state,
    latestSessionPersistenceResult,
    result: {
      status: "created",
      recipeId: TUTORIAL_MINI_MODEL_RECIPE_ID,
      operationCount,
      packageRevision: adapter.authoringSession.packageRevision
    }
  };
};

export const commitWorkflowTutorialSmallMeshEdit = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
}): EditorWorkflowTutorialSmallEditOutcome => {
  const selectedLayer = selectWorkflowDrawableLayer({
    state: input.state,
    drawableId: TUTORIAL_MINI_MODEL_IDS.drawables.frontHair
  });
  if (selectedLayer.result.status === "not_found") {
    return {
      state: input.state,
      latestSessionPersistenceResult: null,
      result: {
        status: "not_found",
        reason: "front_hair_drawable_missing",
        targetId: TUTORIAL_MINI_MODEL_IDS.drawables.frontHair
      }
    };
  }

  const selectedMesh = selectedLayer.state.meshEdit.selectedMesh;
  if (
    selectedMesh === null ||
    selectedMesh.meshId !== TUTORIAL_MINI_MODEL_IDS.meshes.frontHair
  ) {
    return {
      state: selectedLayer.state,
      latestSessionPersistenceResult: null,
      result: {
        status: "not_found",
        reason: "front_hair_mesh_missing",
        targetId: TUTORIAL_MINI_MODEL_IDS.meshes.frontHair
      }
    };
  }

  const vertex =
    selectedLayer.state.meshEdit.editableVertices.find(
      (candidate) => candidate.vertexId === "vtx_tutorial_front_hair_0_1"
    ) ?? selectedLayer.state.meshEdit.editableVertices[0];
  if (vertex === undefined) {
    return {
      state: selectedLayer.state,
      latestSessionPersistenceResult: null,
      result: {
        status: "not_found",
        reason: "editable_vertex_missing",
        targetId: selectedMesh.meshId
      }
    };
  }

  const result = input.adapter.commitMoveMeshVertex({
    operationId: createTutorialSmallEditOperationId(
      selectedMesh.meshId,
      vertex.vertexId,
      input.adapter.authoringSession.packageRevision
    ),
    meshId: selectedMesh.meshId,
    vertexDeltas: [
      {
        vertexId: vertex.vertexId,
        delta: { x: 1, y: -1 }
      }
    ],
    lockedTargetIds: selectedLayer.state.layerTreeDraft.lockedIds,
    intent: "Apply a small existing mesh vertex nudge to the synthetic tutorial front hair."
  });

  return {
    state: applyEditorWorkflowCommitResult(selectedLayer.state, input.adapter, result),
    latestSessionPersistenceResult: result,
    result: {
      status: result.operationResult.status === "committed" ? "committed" : "rejected",
      meshId: selectedMesh.meshId,
      vertexId: vertex.vertexId,
      result
    }
  };
};

const createEditorTutorialMiniModelOperationRequests = (): readonly OperationRequestDto[] =>
  createTutorialMiniModelOperationRequests().map((request) => ({
    ...request,
    actor: "human",
    surface: "gui"
  }));

const createTutorialSmallEditOperationId = (
  meshId: string,
  vertexId: string,
  packageRevision: number
): string =>
  `op_editor_tutorial_small_mesh_nudge_${sanitizeOperationIdToken(meshId)}_${sanitizeOperationIdToken(vertexId)}_r${packageRevision}`;

const sanitizeOperationIdToken = (text: string): string =>
  text.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "target";
