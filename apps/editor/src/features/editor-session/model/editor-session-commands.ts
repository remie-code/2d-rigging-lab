import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { StructureOrderDrop, StructureOrderItem } from "@private-2d-rigging-lab/authoring-core";
import type { DiagnosticDto, DrawableId, PartId, RigControlId } from "@private-2d-rigging-lab/contracts";
import {
  createOperationCore,
  createRigControlIdFromDisplayName,
  OperationRequestSchema,
  type CreateWarpDeformerPayloadDto,
  type GenerateMeshPayloadDto,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";

import {
  createDrawableReorderEntries,
  createDrawableTreeOrderEntries,
  type DrawableDropPlacement
} from "./session-tree";

export interface EditorSessionCommandResult {
  readonly committed: boolean;
  readonly session: AuthoringSession;
  readonly diagnostics: readonly DiagnosticDto[];
}

export interface CreateWarpDeformerCommandResult extends EditorSessionCommandResult {
  readonly rigControlId?: RigControlId;
}

type OperationDraft = {
  readonly operationType: OperationRequestDto["operationType"];
  readonly payload: unknown;
};

export function commitPartNameEdit(
  session: AuthoringSession,
  partId: PartId,
  displayName: string
): EditorSessionCommandResult {
  const part = session.graph.parts.find((candidate) => candidate.partId === partId);
  const nextName = displayName.trim();
  if (part === undefined || nextName.length === 0 || part.displayName === nextName) {
    return noOp(session);
  }

  return commitSingleOperation(session, {
    operationType: "updatePart",
    payload: {
      partId,
      displayName: nextName,
      lockedTargetIds: []
    }
  });
}

export function commitDrawableNameEdit(
  session: AuthoringSession,
  drawableId: DrawableId,
  displayName: string
): EditorSessionCommandResult {
  const drawable = session.graph.drawables.find((candidate) => candidate.drawableId === drawableId);
  const nextName = displayName.trim();
  if (drawable === undefined || nextName.length === 0 || drawable.displayName === nextName) {
    return noOp(session);
  }

  return commitSingleOperation(session, {
    operationType: "updateDrawable",
    payload: {
      drawableId,
      displayName: nextName,
      lockedTargetIds: []
    }
  });
}

export function commitDrawableOpacityEdit(
  session: AuthoringSession,
  drawableId: DrawableId,
  defaultOpacity: number
): EditorSessionCommandResult {
  const drawable = session.graph.drawables.find((candidate) => candidate.drawableId === drawableId);
  const nextOpacity = clamp(defaultOpacity, 0, 1);
  if (drawable === undefined || drawable.defaultOpacity === nextOpacity) {
    return noOp(session);
  }

  return commitSingleOperation(session, {
    operationType: "updateDrawable",
    payload: {
      drawableId,
      defaultOpacity: nextOpacity,
      lockedTargetIds: []
    }
  });
}

export function commitDrawableRuntimeVisibility(
  session: AuthoringSession,
  drawableId: DrawableId,
  runtimeVisibility: boolean
): EditorSessionCommandResult {
  const drawable = session.graph.drawables.find((candidate) => candidate.drawableId === drawableId);
  if (drawable === undefined || drawable.runtimeVisibility === runtimeVisibility) {
    return noOp(session);
  }

  return commitSingleOperation(session, {
    operationType: "setRuntimeVisibility",
    payload: {
      target: { kind: "drawable", id: drawableId },
      runtimeVisibility
    }
  });
}

export function commitDrawableMaskSourceEdit(
  session: AuthoringSession,
  targetDrawableId: DrawableId,
  maskDrawableId: DrawableId | null
): EditorSessionCommandResult {
  if (maskDrawableId === targetDrawableId) {
    return noOp(session);
  }

  const targetDrawable = session.graph.drawables.find(
    (drawable) => drawable.drawableId === targetDrawableId
  );
  const maskDrawable =
    maskDrawableId === null
      ? undefined
      : session.graph.drawables.find((drawable) => drawable.drawableId === maskDrawableId);
  if (targetDrawable === undefined || (maskDrawableId !== null && maskDrawable === undefined)) {
    return noOp(session);
  }

  const existingRelation = session.graph.masks.find(
    (relation) => relation.enabled && relation.targetDrawableIds.includes(targetDrawableId)
  );
  if (maskDrawableId === null) {
    if (existingRelation === undefined) {
      return noOp(session);
    }

    return commitMaskRelationTargetRemoval(session, existingRelation, targetDrawableId);
  }

  if (
    existingRelation !== undefined &&
    existingRelation.targetDrawableIds.length === 1 &&
    existingRelation.maskDrawableIds.length === 1 &&
    existingRelation.maskDrawableIds[0] === maskDrawableId
  ) {
    return noOp(session);
  }

  const nextSession = structuredClone(session);
  if (existingRelation !== undefined && existingRelation.targetDrawableIds.length > 1) {
    const removal = commitMaskRelationTargetRemovalOnSession(
      nextSession,
      existingRelation,
      targetDrawableId
    );
    if (!removal.committed) {
      return {
        ...removal,
        session
      };
    }
  }

  const update = commitOperationInPlace(nextSession, {
    operationType: "setMaskRelation",
    payload: {
      ...(existingRelation === undefined || existingRelation.targetDrawableIds.length > 1
        ? {}
        : { maskRelationId: existingRelation.maskRelationId }),
      maskDrawableIds: [maskDrawableId],
      targetDrawableIds: [targetDrawableId],
      enabled: true
    }
  });

  return update.committed ? { ...update, session: nextSession } : { ...update, session };
}

export function commitDrawableReorder(
  session: AuthoringSession,
  draggedDrawableId: DrawableId,
  targetDrawableId: DrawableId,
  placement: DrawableDropPlacement
): EditorSessionCommandResult {
  const draggedDrawable = session.graph.drawables.find(
    (candidate) => candidate.drawableId === draggedDrawableId
  );
  const targetDrawable = session.graph.drawables.find(
    (candidate) => candidate.drawableId === targetDrawableId
  );
  if (
    draggedDrawable === undefined ||
    targetDrawable === undefined ||
    draggedDrawableId === targetDrawableId
  ) {
    return noOp(session);
  }

  const nextSession = structuredClone(session);
  const priorDiagnostics: DiagnosticDto[] = [];
  let hasCommitted = false;
  if (draggedDrawable.partId !== targetDrawable.partId) {
    const reparentResult = commitOperationInPlace(nextSession, {
      operationType: "setDrawablePart",
      payload: {
        drawableId: draggedDrawableId,
        partId: targetDrawable.partId,
        lockedTargetIds: []
      }
    });
    priorDiagnostics.push(...reparentResult.diagnostics);
    if (!reparentResult.committed) {
      return { ...reparentResult, session };
    }

    hasCommitted = true;
  }

  const entries = createDrawableReorderEntries(
    nextSession,
    draggedDrawableId,
    targetDrawableId,
    placement
  );
  if (entries === undefined) {
    return hasCommitted
      ? { committed: true, session: nextSession, diagnostics: priorDiagnostics }
      : noOp(session);
  }

  const orderResult = commitOperationInPlace(nextSession, {
    operationType: "setDrawOrder",
    payload: { entries }
  });
  const diagnostics = [...priorDiagnostics, ...orderResult.diagnostics];
  return orderResult.committed
    ? { committed: true, session: nextSession, diagnostics }
    : { committed: false, session, diagnostics };
}

export function commitStructureMove(
  session: AuthoringSession,
  moved: StructureOrderItem,
  drop: StructureOrderDrop
): EditorSessionCommandResult {
  return commitSingleOperation(session, {
    operationType: "moveStructureChild",
    payload: {
      moved,
      drop,
      lockedTargetIds: []
    }
  });
}

export function commitGenerateMesh(
  session: AuthoringSession,
  drawableId: DrawableId,
  densityHint: GenerateMeshPayloadDto["densityHint"],
  previewMesh?: AuthoringSession["graph"]["meshes"][number],
  method: GenerateMeshPayloadDto["method"] = "auto-outline-v1"
): EditorSessionCommandResult {
  return commitSingleOperation(session, {
    operationType: "generateMesh",
    payload: {
      drawableId,
      method,
      ...(densityHint === undefined ? {} : { densityHint }),
      ...(previewMesh === undefined ? {} : { previewMesh })
    }
  });
}

export function commitCreateWarpDeformer(
  session: AuthoringSession,
  payload: CreateWarpDeformerPayloadDto
): CreateWarpDeformerCommandResult {
  const rigControlId = createRigControlIdFromDisplayName(payload.displayName);
  const result = commitSingleOperation(session, {
    operationType: "createWarpDeformer",
    payload
  });

  return result.committed ? { ...result, rigControlId } : result;
}

export function commitDrawableReparent(
  session: AuthoringSession,
  drawableId: DrawableId,
  partId: PartId
): EditorSessionCommandResult {
  const drawable = session.graph.drawables.find((candidate) => candidate.drawableId === drawableId);
  if (drawable === undefined || drawable.partId === partId) {
    return noOp(session);
  }

  return commitStructureMove(session, {
    kind: "drawable",
    drawableId
  }, {
    placement: "inside",
    parentPartId: partId
  });
}

export function commitPartReparent(
  session: AuthoringSession,
  partId: PartId,
  parentPartId: PartId
): EditorSessionCommandResult {
  const part = session.graph.parts.find((candidate) => candidate.partId === partId);
  if (part === undefined || part.parentPartId === parentPartId) {
    return noOp(session);
  }

  return commitStructureMove(session, {
    kind: "part",
    partId
  }, {
    placement: "inside",
    parentPartId
  });
}

function commitTreeDrawOrderSync(
  originalSession: AuthoringSession,
  nextSession: AuthoringSession,
  priorResult: EditorSessionCommandResult
): EditorSessionCommandResult {
  if (!priorResult.committed) {
    return { ...priorResult, session: originalSession };
  }

  const entries = createDrawableTreeOrderEntries(nextSession);
  if (entries === undefined) {
    return { ...priorResult, session: nextSession };
  }

  const orderResult = commitOperationInPlace(nextSession, {
    operationType: "setDrawOrder",
    payload: { entries }
  });
  const diagnostics = [...priorResult.diagnostics, ...orderResult.diagnostics];
  return orderResult.committed
    ? { committed: true, session: nextSession, diagnostics }
    : { committed: false, session: originalSession, diagnostics };
}

function commitMaskRelationTargetRemoval(
  session: AuthoringSession,
  relation: AuthoringSession["graph"]["masks"][number],
  targetDrawableId: DrawableId
): EditorSessionCommandResult {
  const nextSession = structuredClone(session);
  const result = commitMaskRelationTargetRemovalOnSession(nextSession, relation, targetDrawableId);
  return result.committed ? { ...result, session: nextSession } : { ...result, session };
}

function commitMaskRelationTargetRemovalOnSession(
  session: AuthoringSession,
  relation: AuthoringSession["graph"]["masks"][number],
  targetDrawableId: DrawableId
): EditorSessionCommandResult {
  const remainingTargets = relation.targetDrawableIds.filter(
    (candidate) => candidate !== targetDrawableId
  );

  return commitOperationInPlace(session, {
    operationType: "setMaskRelation",
    payload: {
      maskRelationId: relation.maskRelationId,
      maskDrawableIds: relation.maskDrawableIds,
      targetDrawableIds: remainingTargets.length > 0 ? remainingTargets : [targetDrawableId],
      enabled: remainingTargets.length > 0
    }
  });
}

function commitSingleOperation(
  session: AuthoringSession,
  draft: OperationDraft
): EditorSessionCommandResult {
  const nextSession = structuredClone(session);
  const result = commitOperationInPlace(nextSession, draft);
  return result.committed ? { ...result, session: nextSession } : { ...result, session };
}

function commitOperationInPlace(
  session: AuthoringSession,
  draft: OperationDraft
): EditorSessionCommandResult {
  const operationCore = createOperationCore();
  const request = OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision: session.packageRevision,
    operationType: draft.operationType,
    payload: draft.payload
  });
  const outcome = operationCore.commitOperation(session, request);

  return {
    committed: outcome.result.status === "committed",
    session,
    diagnostics: outcome.result.diagnostics
  };
}

function noOp(session: AuthoringSession): EditorSessionCommandResult {
  return {
    committed: false,
    session,
    diagnostics: []
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
