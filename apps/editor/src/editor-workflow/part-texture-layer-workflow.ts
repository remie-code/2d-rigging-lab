import type {
  EditorCreatePartCommand,
  EditorSessionAdapter,
  EditorSessionPersistenceResult,
  EditorSetDrawablePartCommand,
  EditorSetDrawableTextureCommand,
  EditorUpdatePartCommand
} from "../editor-session/index.js";
import {
  selectDrawableLayerInEditorState,
  toggleDrawableEditorHiddenInEditorState,
  toggleDrawableLayerLockInEditorState,
  type EditorSemanticState
} from "../editor-state/index.js";
import { applyEditorWorkflowCommitResult } from "./workflow-state-projection.js";

export type EditorDrawableLayerMoveDirection = "up" | "down";

export interface EditorWorkflowLayerActionNotFoundResult {
  readonly status: "not_found";
  readonly drawableId: string;
}

export interface EditorWorkflowLayerMoveNotMovableResult {
  readonly status: "not_movable";
  readonly drawableId: string;
  readonly direction: EditorDrawableLayerMoveDirection;
}

export interface EditorWorkflowLayerLockedResult {
  readonly status: "locked";
  readonly drawableId: string;
  readonly lockedDrawableIds: readonly string[];
}

export interface EditorWorkflowLayerActionCommitResult {
  readonly status: "committed" | "rejected";
  readonly result: EditorSessionPersistenceResult;
}

export interface EditorWorkflowLayerDraftActionResult {
  readonly status: "updated";
  readonly drawableId: string;
}

export type EditorWorkflowLayerDraftResult =
  | EditorWorkflowLayerActionNotFoundResult
  | EditorWorkflowLayerDraftActionResult;

export type EditorWorkflowPartTextureCommitResult = EditorWorkflowLayerActionCommitResult;

export type EditorWorkflowLayerVisibilityResult =
  | EditorWorkflowLayerActionNotFoundResult
  | EditorWorkflowLayerLockedResult
  | EditorWorkflowLayerActionCommitResult;

export type EditorWorkflowLayerMoveResult =
  | EditorWorkflowLayerActionNotFoundResult
  | EditorWorkflowLayerMoveNotMovableResult
  | EditorWorkflowLayerLockedResult
  | EditorWorkflowLayerActionCommitResult;

export interface EditorWorkflowPartTextureCommitOutcome {
  readonly result: EditorWorkflowPartTextureCommitResult;
  readonly state: EditorSemanticState;
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult;
}

export interface EditorWorkflowLayerDraftOutcome {
  readonly result: EditorWorkflowLayerDraftResult;
  readonly state: EditorSemanticState;
}

export interface EditorWorkflowLayerCommitOutcome<T> {
  readonly result: T;
  readonly state: EditorSemanticState;
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult | null;
}

export const commitWorkflowCreatePart = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorCreatePartCommand;
}): EditorWorkflowPartTextureCommitOutcome => {
  const result = input.adapter.commitCreatePart({
    ...input.command,
    operationId:
      input.command.operationId ??
      createPartTextureOperationId(
        "create_part",
        input.command.partId ?? input.command.displayName,
        input.adapter.authoringSession.packageRevision
      ),
    lockedTargetIds: input.state.layerTreeDraft.lockedIds
  });

  return projectPartTextureCommitOutcome(input.state, input.adapter, result);
};

export const commitWorkflowUpdatePart = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorUpdatePartCommand;
}): EditorWorkflowPartTextureCommitOutcome => {
  const result = input.adapter.commitUpdatePart({
    ...input.command,
    operationId:
      input.command.operationId ??
      createPartTextureOperationId(
        "update_part",
        input.command.partId,
        input.adapter.authoringSession.packageRevision
      ),
    lockedTargetIds: input.state.layerTreeDraft.lockedIds
  });

  return projectPartTextureCommitOutcome(input.state, input.adapter, result);
};

export const commitWorkflowSetDrawablePart = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorSetDrawablePartCommand;
}): EditorWorkflowPartTextureCommitOutcome => {
  const result = input.adapter.commitSetDrawablePart({
    ...input.command,
    operationId:
      input.command.operationId ??
      createPartTextureOperationId(
        "set_drawable_part",
        input.command.drawableId,
        input.adapter.authoringSession.packageRevision
      ),
    lockedTargetIds: input.state.layerTreeDraft.lockedIds
  });

  return projectPartTextureCommitOutcome(input.state, input.adapter, result);
};

export const commitWorkflowSetDrawableTexture = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorSetDrawableTextureCommand;
}): EditorWorkflowPartTextureCommitOutcome => {
  const result = input.adapter.commitSetDrawableTexture({
    ...input.command,
    operationId:
      input.command.operationId ??
      createPartTextureOperationId(
        "set_drawable_texture",
        input.command.drawableId,
        input.adapter.authoringSession.packageRevision
      ),
    lockedTargetIds: input.state.layerTreeDraft.lockedIds
  });

  return projectPartTextureCommitOutcome(input.state, input.adapter, result);
};

export const selectWorkflowDrawableLayer = (input: {
  readonly state: EditorSemanticState;
  readonly drawableId: string;
}): EditorWorkflowLayerDraftOutcome => {
  if (!hasDrawable(input.state, input.drawableId)) {
    return {
      state: input.state,
      result: {
        status: "not_found",
        drawableId: input.drawableId
      }
    };
  }

  return {
    state: selectDrawableLayerInEditorState(input.state, input.drawableId),
    result: {
      status: "updated",
      drawableId: input.drawableId
    }
  };
};

export const toggleWorkflowDrawableLayerLock = (input: {
  readonly state: EditorSemanticState;
  readonly drawableId: string;
}): EditorWorkflowLayerDraftOutcome => {
  if (!hasDrawable(input.state, input.drawableId)) {
    return {
      state: input.state,
      result: {
        status: "not_found",
        drawableId: input.drawableId
      }
    };
  }

  return {
    state: toggleDrawableLayerLockInEditorState(input.state, input.drawableId),
    result: {
      status: "updated",
      drawableId: input.drawableId
    }
  };
};

export const toggleWorkflowDrawableEditorHidden = (input: {
  readonly state: EditorSemanticState;
  readonly drawableId: string;
}): EditorWorkflowLayerDraftOutcome => {
  if (!hasDrawable(input.state, input.drawableId)) {
    return {
      state: input.state,
      result: {
        status: "not_found",
        drawableId: input.drawableId
      }
    };
  }

  return {
    state: toggleDrawableEditorHiddenInEditorState(input.state, input.drawableId),
    result: {
      status: "updated",
      drawableId: input.drawableId
    }
  };
};

export const commitWorkflowSetDrawableRuntimeVisibility = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly drawableId: string;
  readonly runtimeVisibility: boolean;
}): EditorWorkflowLayerCommitOutcome<EditorWorkflowLayerVisibilityResult> => {
  if (!hasDrawable(input.state, input.drawableId)) {
    return {
      state: input.state,
      latestSessionPersistenceResult: null,
      result: {
        status: "not_found",
        drawableId: input.drawableId
      }
    };
  }

  if (isDrawableLocked(input.state, input.drawableId)) {
    return {
      state: input.state,
      latestSessionPersistenceResult: null,
      result: createLockedLayerResult([input.drawableId])
    };
  }

  const result = input.adapter.commitSetDrawableRuntimeVisibility({
    operationId: createLayerOperationId(
      "set_runtime_visibility",
      input.drawableId,
      input.runtimeVisibility ? "show" : "hide",
      input.adapter.authoringSession.packageRevision
    ),
    drawableId: input.drawableId,
    runtimeVisibility: input.runtimeVisibility
  });

  return projectLayerCommitOutcome(input.state, input.adapter, result);
};

export const commitWorkflowToggleDrawableRuntimeVisibility = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly drawableId: string;
}): EditorWorkflowLayerCommitOutcome<EditorWorkflowLayerVisibilityResult> => {
  const drawable = input.state.drawables.find((candidate) => candidate.drawableId === input.drawableId);
  if (drawable === undefined) {
    return {
      state: input.state,
      latestSessionPersistenceResult: null,
      result: {
        status: "not_found",
        drawableId: input.drawableId
      }
    };
  }

  return commitWorkflowSetDrawableRuntimeVisibility({
    adapter: input.adapter,
    state: input.state,
    drawableId: input.drawableId,
    runtimeVisibility: !drawable.visible
  });
};

export const commitWorkflowMoveDrawableLayer = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly drawableId: string;
  readonly direction: EditorDrawableLayerMoveDirection;
}): EditorWorkflowLayerCommitOutcome<EditorWorkflowLayerMoveResult> => {
  const move = createDrawableLayerMoveEntries(
    input.state.drawables,
    input.drawableId,
    input.direction
  );

  if (move.status !== "ready") {
    return {
      state: input.state,
      latestSessionPersistenceResult: null,
      result: move
    };
  }

  const lockedDrawableIds = move.affectedDrawableIds.filter((drawableId) =>
    isDrawableLocked(input.state, drawableId)
  );
  if (lockedDrawableIds.length > 0) {
    return {
      state: input.state,
      latestSessionPersistenceResult: null,
      result: createLockedLayerResult(lockedDrawableIds)
    };
  }

  const result = input.adapter.commitSetDrawableDrawOrder({
    operationId: createLayerOperationId(
      "set_draw_order",
      input.drawableId,
      input.direction,
      input.adapter.authoringSession.packageRevision
    ),
    entries: move.entries
  });

  return projectLayerCommitOutcome(input.state, input.adapter, result);
};

const projectPartTextureCommitOutcome = (
  state: EditorSemanticState,
  adapter: EditorSessionAdapter,
  result: EditorSessionPersistenceResult
): EditorWorkflowPartTextureCommitOutcome => ({
  latestSessionPersistenceResult: result,
  state: applyEditorWorkflowCommitResult(state, adapter, result),
  result: {
    status: result.operationResult.status === "committed" ? "committed" : "rejected",
    result
  }
});

const projectLayerCommitOutcome = (
  state: EditorSemanticState,
  adapter: EditorSessionAdapter,
  result: EditorSessionPersistenceResult
): EditorWorkflowLayerCommitOutcome<EditorWorkflowLayerActionCommitResult> => ({
  latestSessionPersistenceResult: result,
  state: applyEditorWorkflowCommitResult(state, adapter, result),
  result: {
    status: result.operationResult.status === "committed" ? "committed" : "rejected",
    result
  }
});

const createDrawableLayerMoveEntries = (
  drawables: EditorSemanticState["drawables"],
  drawableId: string,
  direction: EditorDrawableLayerMoveDirection
):
  | {
      readonly status: "ready";
      readonly affectedDrawableIds: readonly string[];
      readonly entries: readonly { readonly drawableId: string; readonly baseDrawOrder: number }[];
    }
  | EditorWorkflowLayerActionNotFoundResult
  | EditorWorkflowLayerMoveNotMovableResult => {
  const ordered = [...drawables].sort((left, right) => left.orderIndex - right.orderIndex);
  const index = ordered.findIndex((drawable) => drawable.drawableId === drawableId);
  if (index < 0) {
    return {
      status: "not_found",
      drawableId
    };
  }

  const targetIndex = direction === "up" ? index + 1 : index - 1;
  if (targetIndex < 0 || targetIndex >= ordered.length) {
    return {
      status: "not_movable",
      drawableId,
      direction
    };
  }

  const reordered = [...ordered];
  const selected = reordered[index];
  const target = reordered[targetIndex];
  if (selected === undefined || target === undefined) {
    return {
      status: "not_movable",
      drawableId,
      direction
    };
  }

  reordered[index] = target;
  reordered[targetIndex] = selected;

  return {
    status: "ready",
    affectedDrawableIds: [selected.drawableId, target.drawableId],
    entries: reordered.map((drawable, baseDrawOrder) => ({
      drawableId: drawable.drawableId,
      baseDrawOrder
    }))
  };
};

const hasDrawable = (state: EditorSemanticState, drawableId: string): boolean =>
  state.drawables.some((drawable) => drawable.drawableId === drawableId);

const isDrawableLocked = (state: EditorSemanticState, drawableId: string): boolean =>
  state.layerTreeDraft.lockedIds.includes(drawableId);

const createLockedLayerResult = (
  lockedDrawableIds: readonly string[]
): EditorWorkflowLayerLockedResult => ({
  status: "locked",
  drawableId: lockedDrawableIds[0] ?? "",
  lockedDrawableIds
});

const createLayerOperationId = (
  operation: string,
  drawableId: string,
  action: string,
  packageRevision: number
): string =>
  `op_editor_${operation}_${sanitizeLayerOperationIdToken(drawableId)}_${sanitizeLayerOperationIdToken(action)}_r${packageRevision}`;

const createPartTextureOperationId = (
  operation: string,
  targetId: string,
  packageRevision: number
): string =>
  `op_editor_${operation}_${sanitizeLayerOperationIdToken(targetId)}_r${packageRevision}`;

const sanitizeLayerOperationIdToken = (text: string): string =>
  text.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "target";
