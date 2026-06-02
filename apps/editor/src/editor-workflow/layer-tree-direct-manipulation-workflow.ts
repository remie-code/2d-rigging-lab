import type {
  EditorDeletePartCommand,
  EditorSessionAdapter,
  EditorSessionPersistenceResult,
  EditorSetDrawablePartCommand,
  EditorSetDrawableTextureCommand,
  EditorUpdatePartCommand
} from "../editor-session/index.js";
import {
  clearLayerTreeDirectManipulationDraft,
  draftLayerTreeDrawablePartAssignmentInEditorState,
  draftLayerTreeDrawableTextureAssignmentInEditorState,
  draftLayerTreeEmptyLeafPartDeleteInEditorState,
  draftLayerTreePartRenameInEditorState,
  draftLayerTreePartReparentInEditorState,
  reprojectMeshEditState,
  type EditorSemanticState,
  type LayerTreeDrawablePartAssignmentDraftCommand,
  type LayerTreeDrawableTextureAssignmentDraftCommand,
  type LayerTreeEmptyLeafPartDeleteDraftCommand,
  type LayerTreePartRenameDraftCommand,
  type LayerTreePartReparentDraftCommand
} from "../editor-state/index.js";
import {
  commitWorkflowDeletePart,
  commitWorkflowSetDrawablePart,
  commitWorkflowSetDrawableTexture,
  commitWorkflowUpdatePart,
  type EditorWorkflowPartTextureCommitOutcome,
  type EditorWorkflowPartTextureCommitResult
} from "./part-texture-layer-workflow.js";

export interface EditorWorkflowLayerTreeDirectDraftNotFoundResult {
  readonly status: "not_found";
  readonly targetKind: "part" | "drawable";
  readonly targetId: string;
}

export interface EditorWorkflowLayerTreeDirectDraftUpdatedResult {
  readonly status: "updated";
  readonly targetKind: "part" | "drawable";
  readonly targetId: string;
}

export type EditorWorkflowLayerTreeDirectDraftResult =
  | EditorWorkflowLayerTreeDirectDraftNotFoundResult
  | EditorWorkflowLayerTreeDirectDraftUpdatedResult;

export interface EditorWorkflowLayerTreeDirectDraftOutcome {
  readonly result: EditorWorkflowLayerTreeDirectDraftResult;
  readonly state: EditorSemanticState;
}

export interface EditorWorkflowLayerTreeDirectManipulationSkippedDraft {
  readonly draftKind:
    | "partUpdate"
    | "emptyLeafPartDelete"
    | "drawablePartAssignment"
    | "drawableTextureAssignment";
  readonly targetId: string;
  readonly reason: "target_missing" | "no_change" | "superseded_by_delete";
}

export interface EditorWorkflowLayerTreeDirectManipulationBatchIssue {
  readonly checkId:
    | "editor.layerTreeDirectDraft.reparentToPendingDelete"
    | "editor.layerTreeDirectDraft.drawablePartToPendingDelete";
  readonly targetKind: "part" | "drawable";
  readonly targetId: string;
  readonly pendingDeletePartId: string;
  readonly message: string;
}

export interface EditorWorkflowLayerTreeDirectManipulationCommitResult {
  readonly status: "committed" | "rejected" | "no_changes";
  readonly committedCount: number;
  readonly skippedDrafts: readonly EditorWorkflowLayerTreeDirectManipulationSkippedDraft[];
  readonly batchIssues: readonly EditorWorkflowLayerTreeDirectManipulationBatchIssue[];
  readonly results: readonly EditorWorkflowPartTextureCommitResult[];
  readonly latestResult: EditorWorkflowPartTextureCommitResult | null;
}

export interface EditorWorkflowLayerTreeDirectManipulationCommitOutcome {
  readonly result: EditorWorkflowLayerTreeDirectManipulationCommitResult;
  readonly state: EditorSemanticState;
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult | null;
}

type LayerTreeDirectManipulationCommitOperation =
  | {
      readonly operationKind: "updatePart";
      readonly command: EditorUpdatePartCommand;
    }
  | {
      readonly operationKind: "setDrawablePart";
      readonly command: EditorSetDrawablePartCommand;
    }
  | {
      readonly operationKind: "setDrawableTexture";
      readonly command: EditorSetDrawableTextureCommand;
    }
  | {
      readonly operationKind: "deletePart";
      readonly command: EditorDeletePartCommand;
    };

export const draftWorkflowLayerTreePartRename = (input: {
  readonly state: EditorSemanticState;
  readonly command: LayerTreePartRenameDraftCommand;
}): EditorWorkflowLayerTreeDirectDraftOutcome => {
  if (!hasPart(input.state, input.command.partId)) {
    return createLayerTreeDirectDraftNotFoundOutcome(input.state, "part", input.command.partId);
  }

  return {
    state: reprojectLayerDraftMeshEdit(
      draftLayerTreePartRenameInEditorState(input.state, input.command)
    ),
    result: {
      status: "updated",
      targetKind: "part",
      targetId: input.command.partId
    }
  };
};

export const draftWorkflowLayerTreePartReparent = (input: {
  readonly state: EditorSemanticState;
  readonly command: LayerTreePartReparentDraftCommand;
}): EditorWorkflowLayerTreeDirectDraftOutcome => {
  if (!hasPart(input.state, input.command.partId)) {
    return createLayerTreeDirectDraftNotFoundOutcome(input.state, "part", input.command.partId);
  }

  return {
    state: reprojectLayerDraftMeshEdit(
      draftLayerTreePartReparentInEditorState(input.state, input.command)
    ),
    result: {
      status: "updated",
      targetKind: "part",
      targetId: input.command.partId
    }
  };
};

export const draftWorkflowLayerTreeEmptyLeafPartDelete = (input: {
  readonly state: EditorSemanticState;
  readonly command: LayerTreeEmptyLeafPartDeleteDraftCommand;
}): EditorWorkflowLayerTreeDirectDraftOutcome => {
  if (!hasPart(input.state, input.command.partId)) {
    return createLayerTreeDirectDraftNotFoundOutcome(input.state, "part", input.command.partId);
  }

  return {
    state: reprojectLayerDraftMeshEdit(
      draftLayerTreeEmptyLeafPartDeleteInEditorState(input.state, input.command)
    ),
    result: {
      status: "updated",
      targetKind: "part",
      targetId: input.command.partId
    }
  };
};

export const draftWorkflowLayerTreeDrawablePartAssignment = (input: {
  readonly state: EditorSemanticState;
  readonly command: LayerTreeDrawablePartAssignmentDraftCommand;
}): EditorWorkflowLayerTreeDirectDraftOutcome => {
  if (!hasDrawable(input.state, input.command.drawableId)) {
    return createLayerTreeDirectDraftNotFoundOutcome(input.state, "drawable", input.command.drawableId);
  }

  return {
    state: reprojectLayerDraftMeshEdit(
      draftLayerTreeDrawablePartAssignmentInEditorState(input.state, input.command)
    ),
    result: {
      status: "updated",
      targetKind: "drawable",
      targetId: input.command.drawableId
    }
  };
};

export const draftWorkflowLayerTreeDrawableTextureAssignment = (input: {
  readonly state: EditorSemanticState;
  readonly command: LayerTreeDrawableTextureAssignmentDraftCommand;
}): EditorWorkflowLayerTreeDirectDraftOutcome => {
  if (!hasDrawable(input.state, input.command.drawableId)) {
    return createLayerTreeDirectDraftNotFoundOutcome(input.state, "drawable", input.command.drawableId);
  }

  return {
    state: reprojectLayerDraftMeshEdit(
      draftLayerTreeDrawableTextureAssignmentInEditorState(input.state, input.command)
    ),
    result: {
      status: "updated",
      targetKind: "drawable",
      targetId: input.command.drawableId
    }
  };
};

export const clearWorkflowLayerTreeDirectManipulationDraft = (
  state: EditorSemanticState
): EditorSemanticState =>
  reprojectLayerDraftMeshEdit({
    ...state,
    layerTreeDraft: clearLayerTreeDirectManipulationDraft(state.layerTreeDraft)
  });

export const commitWorkflowLayerTreeDirectManipulationDrafts = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
}): EditorWorkflowLayerTreeDirectManipulationCommitOutcome => {
  const plan = createLayerTreeDirectManipulationCommitPlan(input.state);
  if (plan.batchIssues.length > 0) {
    return {
      latestSessionPersistenceResult: null,
      state: input.state,
      result: {
        status: "rejected",
        committedCount: 0,
        skippedDrafts: plan.skippedDrafts,
        batchIssues: plan.batchIssues,
        results: [],
        latestResult: null
      }
    };
  }

  if (plan.operations.length === 0) {
    return {
      latestSessionPersistenceResult: null,
      state:
        plan.skippedDrafts.length === 0
          ? input.state
          : clearWorkflowLayerTreeDirectManipulationDraft(input.state),
      result: {
        status: "no_changes",
        committedCount: 0,
        skippedDrafts: plan.skippedDrafts,
        batchIssues: plan.batchIssues,
        results: [],
        latestResult: null
      }
    };
  }

  let state = input.state;
  let latestSessionPersistenceResult: EditorSessionPersistenceResult | null = null;
  const results: EditorWorkflowPartTextureCommitResult[] = [];

  for (const operation of plan.operations) {
    const outcome = commitLayerTreeDirectManipulationOperation({
      adapter: input.adapter,
      state,
      operation
    });
    state = outcome.state;
    latestSessionPersistenceResult = outcome.latestSessionPersistenceResult;
    results.push(outcome.result);

    if (outcome.result.status !== "committed") {
      return {
        latestSessionPersistenceResult,
        state,
        result: {
          status: "rejected",
          committedCount: results.filter((result) => result.status === "committed").length,
          skippedDrafts: plan.skippedDrafts,
          batchIssues: plan.batchIssues,
          results,
          latestResult: outcome.result
        }
      };
    }
  }

  return {
    latestSessionPersistenceResult,
    state: clearWorkflowLayerTreeDirectManipulationDraft(state),
    result: {
      status: "committed",
      committedCount: results.length,
      skippedDrafts: plan.skippedDrafts,
      batchIssues: plan.batchIssues,
      results,
      latestResult: results.at(-1) ?? null
    }
  };
};

const createLayerTreeDirectManipulationCommitPlan = (
  state: EditorSemanticState
): {
  readonly operations: readonly LayerTreeDirectManipulationCommitOperation[];
  readonly skippedDrafts: readonly EditorWorkflowLayerTreeDirectManipulationSkippedDraft[];
  readonly batchIssues: readonly EditorWorkflowLayerTreeDirectManipulationBatchIssue[];
} => {
  const directDraft = state.layerTreeDraft.directManipulation;
  if (directDraft === undefined) {
    return {
      operations: [],
      skippedDrafts: [],
      batchIssues: []
    };
  }

  const operations: LayerTreeDirectManipulationCommitOperation[] = [];
  const skippedDrafts: EditorWorkflowLayerTreeDirectManipulationSkippedDraft[] = [];
  const batchIssues: EditorWorkflowLayerTreeDirectManipulationBatchIssue[] = [];
  const deletePartIds = new Set(directDraft.emptyLeafPartDeletes.map((draft) => draft.partId));
  const renameDraftsByPartId = new Map(
    directDraft.partRenames.map((draft) => [draft.partId, draft])
  );
  const reparentDraftsByPartId = new Map(
    directDraft.partReparents.map((draft) => [draft.partId, draft])
  );
  const partUpdateIds = sortTargetIds([
    ...new Set([...renameDraftsByPartId.keys(), ...reparentDraftsByPartId.keys()])
  ]);

  for (const partId of partUpdateIds) {
    const part = state.parts.find((candidate) => candidate.partId === partId);
    if (part === undefined) {
      skippedDrafts.push({ draftKind: "partUpdate", targetId: partId, reason: "target_missing" });
      continue;
    }

    if (deletePartIds.has(partId)) {
      skippedDrafts.push({
        draftKind: "partUpdate",
        targetId: partId,
        reason: "superseded_by_delete"
      });
      continue;
    }

    const renameDraft = renameDraftsByPartId.get(partId);
    const reparentDraft = reparentDraftsByPartId.get(partId);
    const displayNameChanged =
      renameDraft !== undefined && renameDraft.displayName !== part.displayName;
    const currentParentPartId = part.parentPartId ?? null;
    const parentChanged =
      reparentDraft !== undefined && reparentDraft.parentPartId !== currentParentPartId;

    if (
      reparentDraft !== undefined &&
      reparentDraft.parentPartId !== null &&
      deletePartIds.has(reparentDraft.parentPartId)
    ) {
      batchIssues.push({
        checkId: "editor.layerTreeDirectDraft.reparentToPendingDelete",
        targetKind: "part",
        targetId: partId,
        pendingDeletePartId: reparentDraft.parentPartId,
        message: `Part ${partId} cannot be reparented to pending-delete part ${reparentDraft.parentPartId}.`
      });
      continue;
    }

    if (!displayNameChanged && !parentChanged) {
      skippedDrafts.push({ draftKind: "partUpdate", targetId: partId, reason: "no_change" });
      continue;
    }

    operations.push({
      operationKind: "updatePart",
      command: {
        partId,
        ...(displayNameChanged && renameDraft !== undefined
          ? { displayName: renameDraft.displayName }
          : {}),
        ...(parentChanged && reparentDraft !== undefined
          ? { parentPartId: reparentDraft.parentPartId }
          : {})
      }
    });
  }

  for (const draft of directDraft.drawablePartAssignments) {
    const drawable = state.drawables.find((candidate) => candidate.drawableId === draft.drawableId);
    if (drawable === undefined) {
      skippedDrafts.push({
        draftKind: "drawablePartAssignment",
        targetId: draft.drawableId,
        reason: "target_missing"
      });
      continue;
    }

    if (drawable.partId === draft.partId) {
      skippedDrafts.push({
        draftKind: "drawablePartAssignment",
        targetId: draft.drawableId,
        reason: "no_change"
      });
      continue;
    }

    if (deletePartIds.has(draft.partId)) {
      batchIssues.push({
        checkId: "editor.layerTreeDirectDraft.drawablePartToPendingDelete",
        targetKind: "drawable",
        targetId: draft.drawableId,
        pendingDeletePartId: draft.partId,
        message: `Drawable ${draft.drawableId} cannot be assigned to pending-delete part ${draft.partId}.`
      });
      continue;
    }

    operations.push({
      operationKind: "setDrawablePart",
      command: {
        drawableId: draft.drawableId,
        partId: draft.partId
      }
    });
  }

  for (const draft of directDraft.drawableTextureAssignments) {
    const drawable = state.drawables.find((candidate) => candidate.drawableId === draft.drawableId);
    if (drawable === undefined) {
      skippedDrafts.push({
        draftKind: "drawableTextureAssignment",
        targetId: draft.drawableId,
        reason: "target_missing"
      });
      continue;
    }

    if (drawable.textureId === draft.textureId) {
      skippedDrafts.push({
        draftKind: "drawableTextureAssignment",
        targetId: draft.drawableId,
        reason: "no_change"
      });
      continue;
    }

    operations.push({
      operationKind: "setDrawableTexture",
      command: {
        drawableId: draft.drawableId,
        textureId: draft.textureId
      }
    });
  }

  for (const draft of directDraft.emptyLeafPartDeletes) {
    if (!hasPart(state, draft.partId)) {
      skippedDrafts.push({
        draftKind: "emptyLeafPartDelete",
        targetId: draft.partId,
        reason: "target_missing"
      });
      continue;
    }

    operations.push({
      operationKind: "deletePart",
      command: {
        partId: draft.partId
      }
    });
  }

  return {
    operations,
    skippedDrafts,
    batchIssues
  };
};

const commitLayerTreeDirectManipulationOperation = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly operation: LayerTreeDirectManipulationCommitOperation;
}): EditorWorkflowPartTextureCommitOutcome => {
  switch (input.operation.operationKind) {
    case "updatePart":
      return commitWorkflowUpdatePart({
        adapter: input.adapter,
        state: input.state,
        command: {
          ...input.operation.command,
          operationId:
            input.operation.command.operationId ??
            createLayerTreeDirectOperationId(
              "direct_update_part",
              input.operation.command.partId,
              input.adapter.authoringSession.packageRevision
            )
        }
      });
    case "setDrawablePart":
      return commitWorkflowSetDrawablePart({
        adapter: input.adapter,
        state: input.state,
        command: {
          ...input.operation.command,
          operationId:
            input.operation.command.operationId ??
            createLayerTreeDirectOperationId(
              "direct_set_drawable_part",
              input.operation.command.drawableId,
              input.adapter.authoringSession.packageRevision
            )
        }
      });
    case "setDrawableTexture":
      return commitWorkflowSetDrawableTexture({
        adapter: input.adapter,
        state: input.state,
        command: {
          ...input.operation.command,
          operationId:
            input.operation.command.operationId ??
            createLayerTreeDirectOperationId(
              "direct_set_drawable_texture",
              input.operation.command.drawableId,
              input.adapter.authoringSession.packageRevision
            )
        }
      });
    case "deletePart":
      return commitWorkflowDeletePart({
        adapter: input.adapter,
        state: input.state,
        command: {
          ...input.operation.command,
          operationId:
            input.operation.command.operationId ??
            createLayerTreeDirectOperationId(
              "direct_delete_part",
              input.operation.command.partId,
              input.adapter.authoringSession.packageRevision
            )
        }
      });
  }
};

const createLayerTreeDirectDraftNotFoundOutcome = (
  state: EditorSemanticState,
  targetKind: "part" | "drawable",
  targetId: string
): EditorWorkflowLayerTreeDirectDraftOutcome => ({
  state,
  result: {
    status: "not_found",
    targetKind,
    targetId
  }
});

const reprojectLayerDraftMeshEdit = (state: EditorSemanticState): EditorSemanticState => ({
  ...state,
  meshEdit: reprojectMeshEditState(state.meshEdit, {
    layerTreeDraft: state.layerTreeDraft,
    selectedVertexIds: state.meshEdit.selectedVertexIds,
    drawables: state.drawables
  })
});

const hasDrawable = (state: EditorSemanticState, drawableId: string): boolean =>
  state.drawables.some((drawable) => drawable.drawableId === drawableId);

const hasPart = (state: EditorSemanticState, partId: string): boolean =>
  state.parts.some((part) => part.partId === partId);

const createLayerTreeDirectOperationId = (
  operation: string,
  targetId: string,
  packageRevision: number
): string =>
  `op_editor_${operation}_${sanitizeOperationIdToken(targetId)}_r${packageRevision}`;

const sanitizeOperationIdToken = (text: string): string =>
  text.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "target";

const sortTargetIds = (targetIds: readonly string[]): readonly string[] =>
  [...targetIds].sort((left, right) => left.localeCompare(right));
