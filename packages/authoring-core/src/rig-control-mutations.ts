import {
  DrawableIdSchema,
  RigControlIdSchema,
  WarpLattice2dBindSpaceSchema,
  createWarpLattice2dControlPointSlots,
  getWarpLattice2dControlPointCount,
  WarpLattice2dDomainBoundsSchema,
  WarpLattice2dInterpolationMethodSchema,
  hasWarpLattice2dControlPointCardinality
} from "@private-2d-rigging-lab/contracts";
import type {
  DrawableId,
  RectDto,
  RigControlId,
  TargetRefDto,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import {
  createWarpDeformerMetadata,
  getWarpDeformerBezierControlPointCount,
  hasWarpDeformerBezierSurfaceCardinality,
  type RigControlDto
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";
import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getDrawableById } from "./drawable-selectors.js";
import { getRigControlById, hasRigControl } from "./rig-control-selectors.js";
import { addStableOrderId } from "./stable-order-mutations.js";

export type Rotation2dRigControlDto = Extract<RigControlDto, { readonly kind: "rotation2d" }>;
export type WarpLattice2dRigControlDto = Extract<RigControlDto, { readonly kind: "warpLattice2d" }>;

export interface RigControlMutationChange {
  readonly before: RigControlDto;
  readonly after: RigControlDto;
}

export interface CreateRotation2dRigControlMutationResult {
  readonly session: AuthoringSession;
  readonly rigControl: Rotation2dRigControlDto;
  readonly childRigControlChanges: readonly RigControlMutationChange[];
  readonly rigControlRootIdsBefore: readonly RigControlId[];
  readonly rigControlRootIdsAfter: readonly RigControlId[];
  readonly authoringRevision: AuthoringRevision;
}

export interface CreateWarpLattice2dRigControlMutationResult {
  readonly session: AuthoringSession;
  readonly rigControl: WarpLattice2dRigControlDto;
  readonly childRigControlChanges: readonly RigControlMutationChange[];
  readonly rigControlRootIdsBefore: readonly RigControlId[];
  readonly rigControlRootIdsAfter: readonly RigControlId[];
  readonly authoringRevision: AuthoringRevision;
}

export interface BindRigControlChildInput {
  readonly parentRigControlId: RigControlId;
  readonly child: TargetRefDto;
}

export interface BindRigControlChildMutationResult {
  readonly session: AuthoringSession;
  readonly parentRigControlBefore: RigControlDto;
  readonly parentRigControlAfter: RigControlDto;
  readonly childRigControlChange?: RigControlMutationChange;
  readonly child: TargetRefDto;
  readonly rigControlRootIdsBefore: readonly RigControlId[];
  readonly rigControlRootIdsAfter: readonly RigControlId[];
  readonly authoringRevision: AuthoringRevision;
}

export interface MoveDrawableRigControlBindingInput {
  readonly drawableId: DrawableId;
  readonly targetRigControlId: RigControlId;
}

export interface MoveDrawableRigControlBindingMutationResult {
  readonly session: AuthoringSession;
  readonly drawableId: DrawableId;
  readonly sourceRigControlBefore: RigControlDto;
  readonly sourceRigControlAfter: RigControlDto;
  readonly targetRigControlBefore: RigControlDto;
  readonly targetRigControlAfter: RigControlDto;
  readonly authoringRevision: AuthoringRevision;
}

export interface ReparentRigControlInput {
  readonly childRigControlId: RigControlId;
  readonly parentRigControlId?: RigControlId | null;
}

export interface ReparentRigControlMutationResult {
  readonly session: AuthoringSession;
  readonly childRigControlBefore: RigControlDto;
  readonly childRigControlAfter: RigControlDto;
  readonly previousParentRigControlChange?: RigControlMutationChange;
  readonly newParentRigControlChange?: RigControlMutationChange;
  readonly rigControlRootIdsBefore: readonly RigControlId[];
  readonly rigControlRootIdsAfter: readonly RigControlId[];
  readonly authoringRevision: AuthoringRevision;
}

export interface InsertRigControlBetweenParentAndChildInput {
  readonly parentRigControlId: RigControlId;
  readonly child: TargetRefDto;
}

export interface InsertRigControlBetweenParentAndChildMutationResult {
  readonly session: AuthoringSession;
  readonly rigControl: RigControlDto;
  readonly parentRigControlBefore: RigControlDto;
  readonly parentRigControlAfter: RigControlDto;
  readonly childRigControlChange?: RigControlMutationChange;
  readonly child: TargetRefDto;
  readonly rigControlRootIdsBefore: readonly RigControlId[];
  readonly rigControlRootIdsAfter: readonly RigControlId[];
  readonly authoringRevision: AuthoringRevision;
}

export type RigControlWrapChildTarget =
  | {
      readonly kind: "drawable";
      readonly id: DrawableId;
    }
  | {
      readonly kind: "rigControl";
      readonly id: RigControlId;
    };

export interface WrapRigControlChildrenInput {
  readonly wrapChildren: readonly RigControlWrapChildTarget[];
  readonly parentRigControlId?: RigControlId;
}

export interface WrapRigControlChildrenMutationResult {
  readonly session: AuthoringSession;
  readonly rigControl: RigControlDto;
  readonly parentRigControlBefore?: RigControlDto;
  readonly parentRigControlAfter?: RigControlDto;
  readonly childRigControlChanges: readonly RigControlMutationChange[];
  readonly wrapChildren: readonly RigControlWrapChildTarget[];
  readonly rigControlRootIdsBefore: readonly RigControlId[];
  readonly rigControlRootIdsAfter: readonly RigControlId[];
  readonly authoringRevision: AuthoringRevision;
}

export interface UpdateRigControlInput {
  readonly rigControlId: RigControlId;
  readonly displayName?: string;
  readonly pivot?: Vec2Dto;
  readonly restAngleDegrees?: number;
  readonly restTranslation?: Vec2Dto;
  readonly domainBounds?: RectDto;
  readonly transformColumns?: number;
  readonly transformRows?: number;
  readonly bezierColumns?: number;
  readonly bezierRows?: number;
  readonly opacityMultiplier?: number;
}

export interface UpdateRigControlMutationResult {
  readonly session: AuthoringSession;
  readonly rigControlBefore: RigControlDto;
  readonly rigControlAfter: RigControlDto;
  readonly authoringRevision: AuthoringRevision;
}

interface WarpLattice2dRigControlFieldUpdate {
  readonly domainBounds: RectDto;
  readonly latticeColumns: number;
  readonly latticeRows: number;
  readonly restControlPoints: Vec2Dto[];
  readonly warpDeformer: WarpLattice2dRigControlDto["warpDeformer"];
}

interface WrapRigControlChildrenPlan {
  readonly parentRigControl?: RigControlDto;
  readonly selectedDrawableIds: readonly DrawableId[];
  readonly selectedRigControlIds: readonly RigControlId[];
  readonly selectedRootRigControlIds: readonly RigControlId[];
}

export const createRotation2dRigControl = (
  session: AuthoringSession,
  rigControl: Rotation2dRigControlDto
): CreateRotation2dRigControlMutationResult => {
  assertUniqueRigControlId(session, rigControl.rigControlId);
  assertRigControlOpacityMultiplier(rigControl.opacityMultiplier);
  assertUniqueChildIds(rigControl.childDrawableIds, "drawable");
  assertUniqueChildIds(rigControl.childRigControlIds, "rigControl");
  assertChildDrawablesCanBind(session, rigControl.childDrawableIds);
  assertChildRigControlsCanBind(session.graph, rigControl.rigControlId, rigControl.childRigControlIds);

  const rigControlRootIdsBefore = cloneDto(session.graph.rigControlRootIds);
  const storedRigControl = withDefaultOpacityMultiplier(rigControl);
  session.graph.rigControls.push(storedRigControl);
  addStableOrderId(session.graph, storedRigControl.rigControlId);
  addRigControlRootId(session.graph, storedRigControl.rigControlId);

  const childRigControlChanges = storedRigControl.childRigControlIds.map((childRigControlId) =>
    setChildRigControlParent(session.graph, childRigControlId, storedRigControl.rigControlId)
  );
  const rigControlRootIdsAfter = cloneDto(session.graph.rigControlRootIds);

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    rigControl: storedRigControl,
    childRigControlChanges,
    rigControlRootIdsBefore,
    rigControlRootIdsAfter,
    authoringRevision: session.authoringRevision
  };
};

export const createWarpLattice2dRigControl = (
  session: AuthoringSession,
  rigControl: WarpLattice2dRigControlDto
): CreateWarpLattice2dRigControlMutationResult => {
  assertWarpLattice2dRigControlShape(rigControl);
  assertUniqueRigControlId(session, rigControl.rigControlId);
  assertRigControlOpacityMultiplier(rigControl.opacityMultiplier);
  assertUniqueChildIds(rigControl.childDrawableIds, "drawable");
  assertUniqueChildIds(rigControl.childRigControlIds, "rigControl");
  assertChildDrawablesCanBind(session, rigControl.childDrawableIds);
  assertChildRigControlsCanBind(session.graph, rigControl.rigControlId, rigControl.childRigControlIds);

  const rigControlRootIdsBefore = cloneDto(session.graph.rigControlRootIds);
  const storedRigControl = withDefaultOpacityMultiplier(rigControl);
  session.graph.rigControls.push(storedRigControl);
  addStableOrderId(session.graph, storedRigControl.rigControlId);
  addRigControlRootId(session.graph, storedRigControl.rigControlId);

  const childRigControlChanges = storedRigControl.childRigControlIds.map((childRigControlId) =>
    setChildRigControlParent(session.graph, childRigControlId, storedRigControl.rigControlId)
  );
  const rigControlRootIdsAfter = cloneDto(session.graph.rigControlRootIds);

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    rigControl: storedRigControl,
    childRigControlChanges,
    rigControlRootIdsBefore,
    rigControlRootIdsAfter,
    authoringRevision: session.authoringRevision
  };
};

export const bindRigControlChild = (
  session: AuthoringSession,
  input: BindRigControlChildInput
): BindRigControlChildMutationResult => {
  const parentRigControl = getRigControlById(session.graph, input.parentRigControlId);
  if (parentRigControl === undefined) {
    throw new AuthoringMutationError(
      "missing_rig_control",
      `Parent rig control does not exist: ${input.parentRigControlId}`
    );
  }

  const rigControlRootIdsBefore = cloneDto(session.graph.rigControlRootIds);
  const parentRigControlBefore = structuredClone(parentRigControl);
  let childRigControlChange: RigControlMutationChange | undefined;

  if (input.child.kind === "drawable") {
    const childDrawableId = parseDrawableChildId(input.child);
    bindDrawableChild(session.graph, parentRigControl, childDrawableId);
  } else if (input.child.kind === "rigControl") {
    const childRigControlId = parseRigControlChildId(input.child);
    bindRigControlChildNode(session.graph, parentRigControl, childRigControlId);
    childRigControlChange = setChildRigControlParent(
      session.graph,
      childRigControlId,
      parentRigControl.rigControlId
    );
  } else {
    throw new AuthoringMutationError(
      "invalid_rig_control_child_kind",
      `Rig control children must be drawable or rigControl targets: ${input.child.kind}`
    );
  }

  const parentRigControlAfter = structuredClone(parentRigControl);
  const rigControlRootIdsAfter = cloneDto(session.graph.rigControlRootIds);

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    parentRigControlBefore,
    parentRigControlAfter,
    ...(childRigControlChange === undefined ? {} : { childRigControlChange }),
    child: input.child,
    rigControlRootIdsBefore,
    rigControlRootIdsAfter,
    authoringRevision: session.authoringRevision
  };
};

export const moveDrawableRigControlBinding = (
  session: AuthoringSession,
  input: MoveDrawableRigControlBindingInput
): MoveDrawableRigControlBindingMutationResult => {
  if (getDrawableById(session.graph, input.drawableId) === undefined) {
    throw new AuthoringMutationError(
      "missing_drawable",
      `Rig control child drawable does not exist: ${input.drawableId}`
    );
  }

  const targetRigControl = getRigControlById(session.graph, input.targetRigControlId);
  if (targetRigControl === undefined) {
    throw new AuthoringMutationError(
      "missing_rig_control",
      `Target rig control does not exist: ${input.targetRigControlId}`
    );
  }

  const sourceParents = findRigControlsWithDrawableChild(session.graph, input.drawableId);
  if (sourceParents.length === 0) {
    throw new AuthoringMutationError(
      "missing_rig_control_child_binding",
      `Drawable ${input.drawableId} is not bound to a rig control`
    );
  }
  if (sourceParents.length > 1) {
    throw new AuthoringMutationError(
      "duplicate_rig_control_child_binding",
      `Drawable ${input.drawableId} is bound under multiple rig controls`
    );
  }

  const sourceRigControl = sourceParents[0];
  if (sourceRigControl === undefined) {
    throw new Error("Expected one drawable source rig control after length check.");
  }
  if (sourceRigControl.rigControlId === targetRigControl.rigControlId) {
    throw new AuthoringMutationError(
      "no_op_rig_control_child_binding",
      `Drawable ${input.drawableId} is already bound to rig control ${targetRigControl.rigControlId}`
    );
  }
  if (targetRigControl.childDrawableIds.includes(input.drawableId)) {
    throw new AuthoringMutationError(
      "duplicate_rig_control_child_binding",
      `Target rig control ${targetRigControl.rigControlId} already lists drawable ${input.drawableId}`
    );
  }

  const sourceRigControlBefore = structuredClone(sourceRigControl);
  const targetRigControlBefore = structuredClone(targetRigControl);
  sourceRigControl.childDrawableIds = sourceRigControl.childDrawableIds.filter(
    (childDrawableId) => childDrawableId !== input.drawableId
  );
  targetRigControl.childDrawableIds.push(input.drawableId);
  const sourceRigControlAfter = structuredClone(sourceRigControl);
  const targetRigControlAfter = structuredClone(targetRigControl);

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    drawableId: input.drawableId,
    sourceRigControlBefore,
    sourceRigControlAfter,
    targetRigControlBefore,
    targetRigControlAfter,
    authoringRevision: session.authoringRevision
  };
};

export const reparentRigControl = (
  session: AuthoringSession,
  input: ReparentRigControlInput
): ReparentRigControlMutationResult => {
  const childRigControl = getRigControlById(session.graph, input.childRigControlId);
  if (childRigControl === undefined) {
    throw new AuthoringMutationError(
      "missing_rig_control",
      `Child rig control does not exist: ${input.childRigControlId}`
    );
  }

  const newParentRigControl =
    input.parentRigControlId === undefined || input.parentRigControlId === null
      ? undefined
      : getRigControlById(session.graph, input.parentRigControlId);
  if (
    input.parentRigControlId !== undefined &&
    input.parentRigControlId !== null &&
    newParentRigControl === undefined
  ) {
    throw new AuthoringMutationError(
      "missing_rig_control",
      `Target parent rig control does not exist: ${input.parentRigControlId}`
    );
  }
  if (input.parentRigControlId === input.childRigControlId) {
    throw new AuthoringMutationError(
      "rig_control_self_child",
      `Rig control cannot be its own parent: ${input.childRigControlId}`
    );
  }
  if (
    input.parentRigControlId !== undefined &&
    input.parentRigControlId !== null &&
    isRigControlDescendant(session.graph, input.childRigControlId, input.parentRigControlId)
  ) {
    throw new AuthoringMutationError(
      "rig_control_cycle",
      `Reparenting ${input.childRigControlId} under ${input.parentRigControlId} would create a rig control cycle`
    );
  }

  assertCoherentRigControlParentState(session.graph, childRigControl);

  const currentParentRigControl =
    childRigControl.parentId === undefined
      ? undefined
      : getRigControlById(session.graph, childRigControl.parentId);
  if (
    childRigControl.parentId === (input.parentRigControlId ?? undefined) &&
    coherentRootMembership(session.graph, childRigControl)
  ) {
    throw new AuthoringMutationError(
      "no_op_rig_control_child_binding",
      `Rig control ${input.childRigControlId} already has the requested parent`
    );
  }
  if (
    newParentRigControl !== undefined &&
    newParentRigControl.childRigControlIds.includes(input.childRigControlId)
  ) {
    throw new AuthoringMutationError(
      "duplicate_rig_control_child_binding",
      `Target parent ${newParentRigControl.rigControlId} already lists child rig control ${input.childRigControlId}`
    );
  }

  const rigControlRootIdsBefore = cloneDto(session.graph.rigControlRootIds);
  const childRigControlBefore = structuredClone(childRigControl);
  const previousParentRigControlBefore =
    currentParentRigControl === undefined ? undefined : structuredClone(currentParentRigControl);
  const newParentRigControlBefore =
    newParentRigControl === undefined ? undefined : structuredClone(newParentRigControl);

  if (currentParentRigControl !== undefined) {
    currentParentRigControl.childRigControlIds = currentParentRigControl.childRigControlIds.filter(
      (childRigControlId) => childRigControlId !== input.childRigControlId
    );
  }

  if (newParentRigControl === undefined) {
    delete childRigControl.parentId;
    addRigControlRootId(session.graph, childRigControl.rigControlId);
  } else {
    childRigControl.parentId = newParentRigControl.rigControlId;
    newParentRigControl.childRigControlIds.push(childRigControl.rigControlId);
    removeRigControlRootId(session.graph, childRigControl.rigControlId);
  }

  const previousParentRigControlChange =
    currentParentRigControl === undefined || previousParentRigControlBefore === undefined
      ? undefined
      : {
          before: previousParentRigControlBefore,
          after: structuredClone(currentParentRigControl)
        };
  const newParentRigControlChange =
    newParentRigControl === undefined || newParentRigControlBefore === undefined
      ? undefined
      : {
          before: newParentRigControlBefore,
          after: structuredClone(newParentRigControl)
        };
  const rigControlRootIdsAfter = cloneDto(session.graph.rigControlRootIds);

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    childRigControlBefore,
    childRigControlAfter: structuredClone(childRigControl),
    ...(previousParentRigControlChange === undefined ? {} : { previousParentRigControlChange }),
    ...(newParentRigControlChange === undefined ? {} : { newParentRigControlChange }),
    rigControlRootIdsBefore,
    rigControlRootIdsAfter,
    authoringRevision: session.authoringRevision
  };
};

export const insertRigControlBetweenParentAndChild = (
  session: AuthoringSession,
  rigControl: RigControlDto,
  input: InsertRigControlBetweenParentAndChildInput
): InsertRigControlBetweenParentAndChildMutationResult => {
  if (rigControl.kind === "warpLattice2d") {
    assertWarpLattice2dRigControlShape(rigControl);
  }
  assertUniqueRigControlId(session, rigControl.rigControlId);
  assertRigControlOpacityMultiplier(rigControl.opacityMultiplier);
  assertInsertionPayloadChildren(rigControl, input.child);

  const parentRigControl = getRigControlById(session.graph, input.parentRigControlId);
  if (parentRigControl === undefined) {
    throw new AuthoringMutationError(
      "missing_rig_control",
      `Parent rig control does not exist: ${input.parentRigControlId}`
    );
  }

  const rigControlRootIdsBefore = cloneDto(session.graph.rigControlRootIds);
  const parentRigControlBefore = structuredClone(parentRigControl);
  let childRigControlChange: RigControlMutationChange | undefined;
  const storedRigControl = withDefaultOpacityMultiplier({
    ...rigControl,
    parentId: parentRigControl.rigControlId
  } as RigControlDto);

  if (input.child.kind === "drawable") {
    const childDrawableId = parseDrawableChildId(input.child);
    assertDrawableInsertionSource(session.graph, parentRigControl, childDrawableId);
    parentRigControl.childDrawableIds = parentRigControl.childDrawableIds.filter(
      (candidate) => candidate !== childDrawableId
    );
    parentRigControl.childRigControlIds.push(storedRigControl.rigControlId);
  } else if (input.child.kind === "rigControl") {
    const childRigControlId = parseRigControlChildId(input.child);
    const childRigControl = assertRigControlInsertionSource(
      session.graph,
      parentRigControl,
      childRigControlId
    );
    const childRigControlBefore = structuredClone(childRigControl);
    parentRigControl.childRigControlIds = parentRigControl.childRigControlIds.map(
      (candidate) => candidate === childRigControlId ? storedRigControl.rigControlId : candidate
    );
    childRigControl.parentId = storedRigControl.rigControlId;
    childRigControlChange = {
      before: childRigControlBefore,
      after: structuredClone(childRigControl)
    };
  } else {
    throw new AuthoringMutationError(
      "invalid_rig_control_child_kind",
      `Rig control insertion child must be drawable or rigControl: ${input.child.kind}`
    );
  }

  session.graph.rigControls.push(storedRigControl);
  addStableOrderId(session.graph, storedRigControl.rigControlId);
  const parentRigControlAfter = structuredClone(parentRigControl);
  const rigControlRootIdsAfter = cloneDto(session.graph.rigControlRootIds);

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    rigControl: storedRigControl,
    parentRigControlBefore,
    parentRigControlAfter,
    ...(childRigControlChange === undefined ? {} : { childRigControlChange }),
    child: input.child,
    rigControlRootIdsBefore,
    rigControlRootIdsAfter,
    authoringRevision: session.authoringRevision
  };
};

export const wrapRigControlChildren = (
  session: AuthoringSession,
  rigControl: RigControlDto,
  input: WrapRigControlChildrenInput
): WrapRigControlChildrenMutationResult => {
  if (rigControl.kind === "warpLattice2d") {
    assertWarpLattice2dRigControlShape(rigControl);
  }
  assertUniqueRigControlId(session, rigControl.rigControlId);
  assertRigControlOpacityMultiplier(rigControl.opacityMultiplier);
  assertUniqueWrapChildren(input.wrapChildren);
  assertWrapPayloadChildren(rigControl, input.wrapChildren);

  const plan = createWrapRigControlChildrenPlan(session.graph, rigControl.rigControlId, input);
  const rigControlRootIdsBefore = cloneDto(session.graph.rigControlRootIds);
  const parentRigControlBefore =
    plan.parentRigControl === undefined ? undefined : structuredClone(plan.parentRigControl);
  const storedRigControl = withDefaultOpacityMultiplier({
    ...rigControl,
    ...(plan.parentRigControl === undefined ? {} : { parentId: plan.parentRigControl.rigControlId })
  } as RigControlDto);
  const selectedRigControlIds = new Set(plan.selectedRigControlIds);
  const selectedDrawableIds = new Set(plan.selectedDrawableIds);

  if (plan.parentRigControl === undefined) {
    session.graph.rigControlRootIds = replaceSelectedIdsWithWrapper(
      session.graph.rigControlRootIds,
      new Set(plan.selectedRootRigControlIds),
      storedRigControl.rigControlId
    );
  } else {
    plan.parentRigControl.childDrawableIds = plan.parentRigControl.childDrawableIds.filter(
      (childDrawableId) => !selectedDrawableIds.has(childDrawableId)
    );
    plan.parentRigControl.childRigControlIds = replaceSelectedIdsWithWrapper(
      plan.parentRigControl.childRigControlIds,
      selectedRigControlIds,
      storedRigControl.rigControlId
    );
  }

  const childRigControlChanges = plan.selectedRigControlIds.map((childRigControlId) =>
    setChildRigControlParent(session.graph, childRigControlId, storedRigControl.rigControlId)
  );

  session.graph.rigControls.push(storedRigControl);
  addStableOrderId(session.graph, storedRigControl.rigControlId);
  const parentRigControlAfter =
    plan.parentRigControl === undefined ? undefined : structuredClone(plan.parentRigControl);
  const rigControlRootIdsAfter = cloneDto(session.graph.rigControlRootIds);

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    rigControl: storedRigControl,
    ...(parentRigControlBefore === undefined ? {} : { parentRigControlBefore }),
    ...(parentRigControlAfter === undefined ? {} : { parentRigControlAfter }),
    childRigControlChanges,
    wrapChildren: cloneDto(input.wrapChildren),
    rigControlRootIdsBefore,
    rigControlRootIdsAfter,
    authoringRevision: session.authoringRevision
  };
};

export const updateRigControl = (
  session: AuthoringSession,
  input: UpdateRigControlInput
): UpdateRigControlMutationResult => {
  const rigControl = getRigControlById(session.graph, input.rigControlId);
  if (rigControl === undefined) {
    throw new AuthoringMutationError(
      "missing_rig_control",
      `Rig control does not exist: ${input.rigControlId}`
    );
  }
  if (input.displayName !== undefined && input.displayName.trim().length === 0) {
    throw new AuthoringMutationError(
      "invalid_rig_control_display_name",
      `Rig control displayName must not be empty: ${input.rigControlId}`
    );
  }
  assertRigControlOpacityMultiplier(input.opacityMultiplier);

  const rigControlBefore = structuredClone(rigControl);
  const warpFieldsWereProvided =
    input.domainBounds !== undefined ||
    input.transformColumns !== undefined ||
    input.transformRows !== undefined ||
    input.bezierColumns !== undefined ||
    input.bezierRows !== undefined;
  const rotationFieldsWereProvided =
    input.pivot !== undefined ||
    input.restAngleDegrees !== undefined ||
    input.restTranslation !== undefined;
  if (warpFieldsWereProvided) {
    if (rigControl.kind !== "warpLattice2d") {
      throw new AuthoringMutationError(
        "unsupported_rig_control_update_field",
        `Only warpLattice2d rig controls can update domain bounds or division fields: ${input.rigControlId}`
      );
    }
  }
  if (rotationFieldsWereProvided) {
    if (rigControl.kind !== "rotation2d") {
      throw new AuthoringMutationError(
        "unsupported_rig_control_update_field",
        `Only rotation2d rig controls can update pivot, rest angle, or rest translation fields: ${input.rigControlId}`
      );
    }
    assertRotation2dPivot(input.pivot);
    assertRotation2dRestAngle(input.restAngleDegrees);
    assertRotation2dRestTranslation(input.restTranslation);
  }

  const warpFieldUpdate =
    warpFieldsWereProvided && rigControl.kind === "warpLattice2d"
      ? createWarpLattice2dRigControlFieldUpdate(session.graph, rigControl, input)
      : undefined;
  const previewRigControlAfter = structuredClone(rigControl);
  if (input.displayName !== undefined) {
    previewRigControlAfter.displayName = input.displayName;
  }
  if (input.opacityMultiplier !== undefined) {
    previewRigControlAfter.opacityMultiplier = input.opacityMultiplier;
  }
  if (rotationFieldsWereProvided) {
    if (previewRigControlAfter.kind !== "rotation2d") {
      throw new Error("Expected rotation2d preview after update precondition.");
    }
    if (input.pivot !== undefined) {
      previewRigControlAfter.pivot = structuredClone(input.pivot);
    }
    if (input.restAngleDegrees !== undefined) {
      previewRigControlAfter.restAngleDegrees = input.restAngleDegrees;
    }
    if (input.restTranslation !== undefined) {
      previewRigControlAfter.restTranslation = structuredClone(input.restTranslation);
    }
  }
  if (warpFieldUpdate !== undefined) {
    if (previewRigControlAfter.kind !== "warpLattice2d") {
      throw new Error("Expected warpLattice2d preview after update precondition.");
    }
    applyWarpLattice2dRigControlFieldUpdate(previewRigControlAfter, warpFieldUpdate);
  }

  if (JSON.stringify(rigControlBefore) === JSON.stringify(previewRigControlAfter)) {
    throw new AuthoringMutationError(
      "no_op_rig_control_update",
      `Rig control ${input.rigControlId} is already up to date`
    );
  }

  Object.assign(rigControl, structuredClone(previewRigControlAfter));
  const rigControlAfter = structuredClone(rigControl);

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    rigControlBefore,
    rigControlAfter,
    authoringRevision: session.authoringRevision
  };
};

const assertUniqueRigControlId = (
  session: AuthoringSession,
  rigControlId: RigControlId
): void => {
  if (hasRigControl(session.graph, rigControlId)) {
    throw new AuthoringMutationError(
      "duplicate_rig_control",
      `Rig control already exists: ${rigControlId}`
    );
  }
};

const assertWarpLattice2dRigControlShape = (rigControl: WarpLattice2dRigControlDto): void => {
  if (!WarpLattice2dBindSpaceSchema.safeParse(rigControl.bindSpace).success) {
    throw new AuthoringMutationError(
      "invalid_warp_lattice_bind_space",
      `warpLattice2d bindSpace is not supported: ${rigControl.bindSpace}`
    );
  }

  if (!WarpLattice2dDomainBoundsSchema.safeParse(rigControl.domainBounds).success) {
    throw new AuthoringMutationError(
      "invalid_warp_lattice_domain_bounds",
      `warpLattice2d domainBounds must have positive width and height: ${JSON.stringify(rigControl.domainBounds)}`
    );
  }

  if (
    !Number.isInteger(rigControl.latticeColumns) ||
    !Number.isInteger(rigControl.latticeRows) ||
    rigControl.latticeColumns < 2 ||
    rigControl.latticeRows < 2
  ) {
    throw new AuthoringMutationError(
      "invalid_warp_lattice_grid",
      `warpLattice2d lattice size must be at least 2x2: ${rigControl.latticeColumns}x${rigControl.latticeRows}`
    );
  }

  if (!hasWarpLattice2dControlPointCardinality(rigControl, rigControl.restControlPoints.length)) {
    throw new AuthoringMutationError(
      "invalid_warp_lattice_rest_control_points",
      `warpLattice2d restControlPoints length must equal latticeColumns * latticeRows for ${rigControl.rigControlId}`
    );
  }

  if (
    rigControl.restControlPoints.some(
      (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y)
    )
  ) {
    throw new AuthoringMutationError(
      "invalid_warp_lattice_rest_control_points",
      `warpLattice2d restControlPoints must contain finite Vec2 values for ${rigControl.rigControlId}`
    );
  }

  if (!WarpLattice2dInterpolationMethodSchema.safeParse(rigControl.interpolationMethod).success) {
    throw new AuthoringMutationError(
      "invalid_warp_lattice_interpolation",
      `warpLattice2d interpolationMethod is not supported: ${rigControl.interpolationMethod}`
    );
  }

  assertWarpDeformerShape(rigControl);
};

const assertWarpDeformerShape = (rigControl: WarpLattice2dRigControlDto): void => {
  const metadata = rigControl.warpDeformer;
  if (metadata === undefined) {
    return;
  }

  if (
    metadata.transformGrid.columns !== rigControl.latticeColumns ||
    metadata.transformGrid.rows !== rigControl.latticeRows
  ) {
    throw new AuthoringMutationError(
      "invalid_warp_deformer_transform_grid",
      `warpDeformer transformGrid must match latticeColumns/latticeRows for ${rigControl.rigControlId}`
    );
  }

  const expectedBezierCount = getWarpDeformerBezierControlPointCount(metadata.bezierEditSurface);
  if (!hasWarpDeformerBezierSurfaceCardinality(metadata.bezierEditSurface)) {
    throw new AuthoringMutationError(
      "invalid_warp_deformer_bezier_surface",
      `warpDeformer bezierEditSurface must contain ${expectedBezierCount} rest control points and handles for ${rigControl.rigControlId}`
    );
  }

  if (
    metadata.bezierEditSurface.restControlPoints.some(
      (point) => !Number.isFinite(point.x) || !Number.isFinite(point.y)
    ) ||
    metadata.bezierEditSurface.handles.some(
      (handle) =>
        !Number.isFinite(handle.inTangent.x) ||
        !Number.isFinite(handle.inTangent.y) ||
        !Number.isFinite(handle.outTangent.x) ||
        !Number.isFinite(handle.outTangent.y)
    )
  ) {
    throw new AuthoringMutationError(
      "invalid_warp_deformer_bezier_surface",
      `warpDeformer bezierEditSurface must contain finite Vec2 values for ${rigControl.rigControlId}`
    );
  }
};

const assertUniqueChildIds = (
  childIds: readonly string[],
  childKind: "drawable" | "rigControl"
): void => {
  const seen = new Set<string>();

  for (const childId of childIds) {
    if (seen.has(childId)) {
      throw new AuthoringMutationError(
        "duplicate_rig_control_child",
        `Rig control ${childKind} child is duplicated: ${childId}`
      );
    }

    seen.add(childId);
  }
};

const assertRigControlOpacityMultiplier = (opacityMultiplier: number | undefined): void => {
  if (opacityMultiplier === undefined) {
    return;
  }

  if (!Number.isFinite(opacityMultiplier) || opacityMultiplier < 0 || opacityMultiplier > 1) {
    throw new AuthoringMutationError(
      "invalid_rig_control_opacity_multiplier",
      `Rig control opacityMultiplier must be between 0 and 1: ${opacityMultiplier}`
    );
  }
};

const assertRotation2dPivot = (pivot: Vec2Dto | undefined): void => {
  if (pivot === undefined) {
    return;
  }

  if (!Number.isFinite(pivot.x) || !Number.isFinite(pivot.y)) {
    throw new AuthoringMutationError(
      "invalid_rotation_pivot",
      `rotation2d pivot must contain finite x/y values: ${JSON.stringify(pivot)}`
    );
  }
};

const assertRotation2dRestAngle = (restAngleDegrees: number | undefined): void => {
  if (restAngleDegrees === undefined) {
    return;
  }

  if (!Number.isFinite(restAngleDegrees)) {
    throw new AuthoringMutationError(
      "invalid_rotation_rest_angle",
      `rotation2d restAngleDegrees must be finite: ${restAngleDegrees}`
    );
  }
};

const assertRotation2dRestTranslation = (restTranslation: Vec2Dto | undefined): void => {
  if (restTranslation === undefined) {
    return;
  }

  if (!Number.isFinite(restTranslation.x) || !Number.isFinite(restTranslation.y)) {
    throw new AuthoringMutationError(
      "invalid_rotation_rest_translation",
      `rotation2d restTranslation must contain finite x/y values: ${JSON.stringify(restTranslation)}`
    );
  }
};

const assertInsertionPayloadChildren = (
  rigControl: RigControlDto,
  child: TargetRefDto
): void => {
  const childDrawableIds = rigControl.childDrawableIds;
  const childRigControlIds = rigControl.childRigControlIds;

  if (child.kind === "drawable") {
    const childDrawableId = parseDrawableChildId(child);
    if (
      childDrawableIds.length !== 1 ||
      childDrawableIds[0] !== childDrawableId ||
      childRigControlIds.length !== 0
    ) {
      throw new AuthoringMutationError(
        "rig_control_parent_child_mismatch",
        "Insertion create requires exactly the inserted drawable as the new rig control child"
      );
    }
    return;
  }

  if (child.kind === "rigControl") {
    const childRigControlId = parseRigControlChildId(child);
    if (
      childRigControlIds.length !== 1 ||
      childRigControlIds[0] !== childRigControlId ||
      childDrawableIds.length !== 0
    ) {
      throw new AuthoringMutationError(
        "rig_control_parent_child_mismatch",
        "Insertion create requires exactly the inserted rig control as the new rig control child"
      );
    }
    return;
  }

  throw new AuthoringMutationError(
    "invalid_rig_control_child_kind",
    `Rig control insertion child must be drawable or rigControl: ${child.kind}`
  );
};

const assertUniqueWrapChildren = (
  wrapChildren: readonly RigControlWrapChildTarget[]
): void => {
  if (wrapChildren.length === 0) {
    throw new AuthoringMutationError(
      "rig_control_parent_child_mismatch",
      "Wrap create requires at least one selected child target"
    );
  }

  const seen = new Set<string>();
  for (const child of wrapChildren) {
    const childKind = (child as { readonly kind: string }).kind;
    if (childKind !== "drawable" && childKind !== "rigControl") {
      throw new AuthoringMutationError(
        "invalid_rig_control_child_kind",
        `Rig control wrap child must be drawable or rigControl: ${childKind}`
      );
    }

    const key = `${child.kind}:${child.id}`;
    if (seen.has(key)) {
      throw new AuthoringMutationError(
        "duplicate_rig_control_child",
        `Rig control wrap child is duplicated: ${child.id}`
      );
    }
    seen.add(key);
  }
};

const assertWrapPayloadChildren = (
  rigControl: RigControlDto,
  wrapChildren: readonly RigControlWrapChildTarget[]
): void => {
  const expectedDrawableIds = wrapChildren
    .filter((child): child is Extract<RigControlWrapChildTarget, { readonly kind: "drawable" }> =>
      child.kind === "drawable"
    )
    .map((child) => parseDrawableChildId(child));
  const expectedRigControlIds = wrapChildren
    .filter((child): child is Extract<RigControlWrapChildTarget, { readonly kind: "rigControl" }> =>
      child.kind === "rigControl"
    )
    .map((child) => parseRigControlChildId(child));

  if (
    !sameOrderedIds(rigControl.childDrawableIds, expectedDrawableIds) ||
    !sameOrderedIds(rigControl.childRigControlIds, expectedRigControlIds)
  ) {
    throw new AuthoringMutationError(
      "rig_control_parent_child_mismatch",
      "Wrap create requires the new rig control child lists to match wrapChildren"
    );
  }
};

const createWrapRigControlChildrenPlan = (
  graph: AuthoringGraph,
  newRigControlId: RigControlId,
  input: WrapRigControlChildrenInput
): WrapRigControlChildrenPlan => {
  const selectedDrawableIds: DrawableId[] = [];
  const selectedRigControlIds: RigControlId[] = [];
  const selectedRootRigControlIds: RigControlId[] = [];
  const parentedParentIds: RigControlId[] = [];

  for (const child of input.wrapChildren) {
    if (child.kind === "drawable") {
      const drawableId = parseDrawableChildId(child);
      assertDrawableWrapTargetSource(graph, drawableId, parentedParentIds);
      selectedDrawableIds.push(drawableId);
      continue;
    }

    if (child.kind === "rigControl") {
      const childRigControlId = parseRigControlChildId(child);
      const childRigControl = assertRigControlWrapTargetSource(
        graph,
        newRigControlId,
        childRigControlId
      );
      selectedRigControlIds.push(childRigControlId);
      if (childRigControl.parentId === undefined) {
        selectedRootRigControlIds.push(childRigControlId);
      } else {
        parentedParentIds.push(childRigControl.parentId);
      }
      continue;
    }

    throw new AuthoringMutationError(
      "invalid_rig_control_child_kind",
      `Rig control wrap child must be drawable or rigControl: ${(child as { readonly kind: string }).kind}`
    );
  }

  assertNoAncestorDescendantWrapSelection(graph, selectedRigControlIds, selectedDrawableIds);

  const uniqueParentedParentIds = uniqueIds(parentedParentIds);
  if (uniqueParentedParentIds.length > 1) {
    throw new AuthoringMutationError(
      "rig_control_parent_child_mismatch",
      "Parented wrap children must share one immediate parent rig control"
    );
  }
  if (uniqueParentedParentIds.length === 1 && selectedRootRigControlIds.length > 0) {
    throw new AuthoringMutationError(
      "rig_control_parent_child_mismatch",
      "Wrap children cannot mix root rig controls with parented children"
    );
  }

  const parentRigControlId = uniqueParentedParentIds[0];
  if (parentRigControlId === undefined) {
    if (input.parentRigControlId !== undefined) {
      throw new AuthoringMutationError(
        "rig_control_parent_child_mismatch",
        `Wrap parent ${input.parentRigControlId} does not match a root selected group`
      );
    }

    return {
      selectedDrawableIds,
      selectedRigControlIds,
      selectedRootRigControlIds
    };
  }

  if (input.parentRigControlId !== undefined && input.parentRigControlId !== parentRigControlId) {
    throw new AuthoringMutationError(
      "rig_control_parent_child_mismatch",
      `Wrap parent ${input.parentRigControlId} does not match child parent ${parentRigControlId}`
    );
  }

  const parentRigControl = getRigControlById(graph, parentRigControlId);
  if (parentRigControl === undefined) {
    throw new AuthoringMutationError(
      "missing_rig_control",
      `Parent rig control does not exist: ${parentRigControlId}`
    );
  }

  return {
    parentRigControl,
    selectedDrawableIds,
    selectedRigControlIds,
    selectedRootRigControlIds
  };
};

const assertDrawableWrapTargetSource = (
  graph: AuthoringGraph,
  childDrawableId: DrawableId,
  parentedParentIds: RigControlId[]
): void => {
  if (getDrawableById(graph, childDrawableId) === undefined) {
    throw new AuthoringMutationError(
      "missing_drawable",
      `Rig control child drawable does not exist: ${childDrawableId}`
    );
  }

  const existingParents = findRigControlsWithDrawableChild(graph, childDrawableId);
  if (existingParents.length > 1) {
    throw new AuthoringMutationError(
      "duplicate_rig_control_child_binding",
      `Drawable ${childDrawableId} is bound under multiple rig controls`
    );
  }

  const parentRigControl = existingParents[0];
  if (parentRigControl === undefined) {
    return;
  }

  const parentChildCount = countOccurrences(parentRigControl.childDrawableIds, childDrawableId);
  if (parentChildCount !== 1) {
    throw new AuthoringMutationError(
      "duplicate_rig_control_child_binding",
      `Parent rig control ${parentRigControl.rigControlId} lists drawable ${childDrawableId} more than once`
    );
  }
  parentedParentIds.push(parentRigControl.rigControlId);
};

const assertRigControlWrapTargetSource = (
  graph: AuthoringGraph,
  newRigControlId: RigControlId,
  childRigControlId: RigControlId
): RigControlDto => {
  if (childRigControlId === newRigControlId) {
    throw new AuthoringMutationError(
      "rig_control_self_child",
      `Rig control cannot wrap itself as a child: ${newRigControlId}`
    );
  }

  const childRigControl = getRigControlById(graph, childRigControlId);
  if (childRigControl === undefined) {
    throw new AuthoringMutationError(
      "missing_rig_control",
      `Child rig control does not exist: ${childRigControlId}`
    );
  }

  assertCoherentRigControlParentState(graph, childRigControl);
  return childRigControl;
};

const assertNoAncestorDescendantWrapSelection = (
  graph: AuthoringGraph,
  selectedRigControlIds: readonly RigControlId[],
  selectedDrawableIds: readonly DrawableId[]
): void => {
  for (const ancestorCandidateId of selectedRigControlIds) {
    for (const descendantCandidateId of selectedRigControlIds) {
      if (ancestorCandidateId === descendantCandidateId) {
        continue;
      }
      if (isRigControlDescendant(graph, ancestorCandidateId, descendantCandidateId)) {
        throw new AuthoringMutationError(
          "rig_control_cycle",
          `Wrap children cannot include both ancestor ${ancestorCandidateId} and descendant ${descendantCandidateId}`
        );
      }
    }

    for (const drawableId of selectedDrawableIds) {
      if (rigControlSubtreeContainsDrawable(graph, ancestorCandidateId, drawableId)) {
        throw new AuthoringMutationError(
          "rig_control_cycle",
          `Wrap children cannot include rig control ${ancestorCandidateId} and descendant drawable ${drawableId}`
        );
      }
    }
  }
};

const assertChildDrawablesCanBind = (
  session: AuthoringSession,
  childDrawableIds: readonly DrawableId[]
): void => {
  for (const childDrawableId of childDrawableIds) {
    if (getDrawableById(session.graph, childDrawableId) === undefined) {
      throw new AuthoringMutationError(
        "missing_drawable",
        `Rig control child drawable does not exist: ${childDrawableId}`
      );
    }

    const existingParent = findRigControlWithDrawableChild(session.graph, childDrawableId);
    if (existingParent !== undefined) {
      throw new AuthoringMutationError(
        "rig_control_child_already_parented",
        `Drawable ${childDrawableId} is already bound to rig control ${existingParent.rigControlId}`
      );
    }
  }
};

const assertDrawableInsertionSource = (
  graph: AuthoringGraph,
  parentRigControl: RigControlDto,
  childDrawableId: DrawableId
): void => {
  if (getDrawableById(graph, childDrawableId) === undefined) {
    throw new AuthoringMutationError(
      "missing_drawable",
      `Rig control child drawable does not exist: ${childDrawableId}`
    );
  }

  const parentChildCount = countOccurrences(parentRigControl.childDrawableIds, childDrawableId);
  if (parentChildCount === 0) {
    throw new AuthoringMutationError(
      "missing_rig_control_child_binding",
      `Parent rig control ${parentRigControl.rigControlId} does not list drawable ${childDrawableId}`
    );
  }
  if (parentChildCount > 1) {
    throw new AuthoringMutationError(
      "duplicate_rig_control_child_binding",
      `Parent rig control ${parentRigControl.rigControlId} lists drawable ${childDrawableId} more than once`
    );
  }

  const existingParents = findRigControlsWithDrawableChild(graph, childDrawableId);
  if (existingParents.length > 1) {
    throw new AuthoringMutationError(
      "duplicate_rig_control_child_binding",
      `Drawable ${childDrawableId} is bound under multiple rig controls`
    );
  }
  if (existingParents[0]?.rigControlId !== parentRigControl.rigControlId) {
    throw new AuthoringMutationError(
      "rig_control_parent_child_mismatch",
      `Drawable ${childDrawableId} is not bound under parent ${parentRigControl.rigControlId}`
    );
  }
};

const assertRigControlInsertionSource = (
  graph: AuthoringGraph,
  parentRigControl: RigControlDto,
  childRigControlId: RigControlId
): RigControlDto => {
  const childRigControl = getRigControlById(graph, childRigControlId);
  if (childRigControl === undefined) {
    throw new AuthoringMutationError(
      "missing_rig_control",
      `Child rig control does not exist: ${childRigControlId}`
    );
  }

  const parentChildCount = countOccurrences(parentRigControl.childRigControlIds, childRigControlId);
  if (parentChildCount === 0) {
    throw new AuthoringMutationError(
      "missing_rig_control_child_binding",
      `Parent rig control ${parentRigControl.rigControlId} does not list child rig control ${childRigControlId}`
    );
  }
  if (parentChildCount > 1) {
    throw new AuthoringMutationError(
      "duplicate_rig_control_child_binding",
      `Parent rig control ${parentRigControl.rigControlId} lists child rig control ${childRigControlId} more than once`
    );
  }

  const existingParents = findRigControlsWithRigControlChild(graph, childRigControlId);
  if (existingParents.length > 1) {
    throw new AuthoringMutationError(
      "duplicate_rig_control_child_binding",
      `Rig control ${childRigControlId} is listed under multiple parent rig controls`
    );
  }
  if (
    childRigControl.parentId !== parentRigControl.rigControlId ||
    existingParents[0]?.rigControlId !== parentRigControl.rigControlId
  ) {
    throw new AuthoringMutationError(
      "rig_control_parent_child_mismatch",
      `Rig control ${childRigControlId} is not coherently bound under parent ${parentRigControl.rigControlId}`
    );
  }

  return childRigControl;
};

const assertChildRigControlsCanBind = (
  graph: AuthoringGraph,
  parentRigControlId: RigControlId,
  childRigControlIds: readonly RigControlId[]
): void => {
  for (const childRigControlId of childRigControlIds) {
    if (childRigControlId === parentRigControlId) {
      throw new AuthoringMutationError(
        "rig_control_self_child",
        `Rig control cannot be its own child: ${parentRigControlId}`
      );
    }

    const childRigControl = getRigControlById(graph, childRigControlId);
    if (childRigControl === undefined) {
      throw new AuthoringMutationError(
        "missing_rig_control",
        `Child rig control does not exist: ${childRigControlId}`
      );
    }

    if (childRigControl.parentId !== undefined) {
      throw new AuthoringMutationError(
        "rig_control_child_already_parented",
        `Rig control ${childRigControlId} already has parent ${childRigControl.parentId}`
      );
    }

    if (isRigControlDescendant(graph, childRigControlId, parentRigControlId)) {
      throw new AuthoringMutationError(
        "rig_control_cycle",
        `Binding ${childRigControlId} under ${parentRigControlId} would create a rig control cycle`
      );
    }
  }
};

const assertCoherentRigControlParentState = (
  graph: AuthoringGraph,
  childRigControl: RigControlDto
): void => {
  const listedParents = findRigControlsWithRigControlChild(graph, childRigControl.rigControlId);
  if (listedParents.length > 1) {
    throw new AuthoringMutationError(
      "duplicate_rig_control_child_binding",
      `Rig control ${childRigControl.rigControlId} is listed under multiple parent rig controls`
    );
  }

  const rootCount = countOccurrences(graph.rigControlRootIds, childRigControl.rigControlId);
  if (childRigControl.parentId === undefined) {
    if (listedParents.length > 0) {
      throw new AuthoringMutationError(
        "rig_control_parent_child_mismatch",
        `Root rig control ${childRigControl.rigControlId} is still listed under a parent rig control`
      );
    }
    if (rootCount !== 1) {
      throw new AuthoringMutationError(
        "illegal_rig_control_root_state",
        `Root rig control ${childRigControl.rigControlId} must appear exactly once in rigControlRootIds`
      );
    }
    return;
  }

  const parentRigControl = getRigControlById(graph, childRigControl.parentId);
  if (parentRigControl === undefined) {
    throw new AuthoringMutationError(
      "missing_rig_control",
      `Rig control parent does not exist: ${childRigControl.parentId}`
    );
  }
  if (
    listedParents.length !== 1 ||
    listedParents[0]?.rigControlId !== childRigControl.parentId ||
    countOccurrences(parentRigControl.childRigControlIds, childRigControl.rigControlId) !== 1
  ) {
    throw new AuthoringMutationError(
      "rig_control_parent_child_mismatch",
      `Rig control ${childRigControl.rigControlId} parentId and parent child list disagree`
    );
  }
  if (rootCount !== 0) {
    throw new AuthoringMutationError(
      "illegal_rig_control_root_state",
      `Child rig control ${childRigControl.rigControlId} must not appear in rigControlRootIds`
    );
  }
};

const coherentRootMembership = (
  graph: AuthoringGraph,
  childRigControl: RigControlDto
): boolean => {
  const rootCount = countOccurrences(graph.rigControlRootIds, childRigControl.rigControlId);
  return childRigControl.parentId === undefined ? rootCount === 1 : rootCount === 0;
};

const createWarpLattice2dRigControlFieldUpdate = (
  graph: AuthoringGraph,
  rigControl: WarpLattice2dRigControlDto,
  input: UpdateRigControlInput
): WarpLattice2dRigControlFieldUpdate => {
  const nextDomainBounds = input.domainBounds ?? rigControl.domainBounds;
  if (!WarpLattice2dDomainBoundsSchema.safeParse(nextDomainBounds).success) {
    throw new AuthoringMutationError(
      "invalid_warp_lattice_domain_bounds",
      `warpLattice2d domainBounds must have positive width and height: ${JSON.stringify(nextDomainBounds)}`
    );
  }

  const nextTransformColumns = input.transformColumns ?? rigControl.latticeColumns;
  const nextTransformRows = input.transformRows ?? rigControl.latticeRows;
  if (!isValidDivisionCount(nextTransformColumns) || !isValidDivisionCount(nextTransformRows)) {
    throw new AuthoringMutationError(
      "invalid_warp_lattice_grid",
      `warpLattice2d transform grid must be at least 2x2: ${nextTransformColumns}x${nextTransformRows}`
    );
  }

  const currentBezierSurface = rigControl.warpDeformer?.bezierEditSurface;
  const nextBezierColumns = input.bezierColumns ?? currentBezierSurface?.columns ?? rigControl.latticeColumns;
  const nextBezierRows = input.bezierRows ?? currentBezierSurface?.rows ?? rigControl.latticeRows;
  if (!isValidDivisionCount(nextBezierColumns) || !isValidDivisionCount(nextBezierRows)) {
    throw new AuthoringMutationError(
      "invalid_warp_deformer_bezier_surface",
      `warpDeformer Bezier divisions must be at least 2x2: ${nextBezierColumns}x${nextBezierRows}`
    );
  }

  const transformCardinalityChanged =
    getWarpLattice2dControlPointCount(rigControl) !==
    nextTransformColumns * nextTransformRows;
  const currentBezierCount = currentBezierSurface === undefined
    ? rigControl.latticeColumns * rigControl.latticeRows
    : getWarpDeformerBezierControlPointCount(currentBezierSurface);
  const bezierCardinalityChanged = currentBezierCount !== nextBezierColumns * nextBezierRows;
  if (
    (transformCardinalityChanged || bezierCardinalityChanged) &&
    graph.keyformSets.some((keyformSet) =>
      keyformSet.target.kind === "rigControl" &&
      keyformSet.target.id === rigControl.rigControlId
    )
  ) {
    throw new AuthoringMutationError(
      "rig_control_keyform_cardinality_conflict",
      `Rig control ${rigControl.rigControlId} has keyforms and cannot change transform or Bezier cardinality`
    );
  }

  return {
    domainBounds: structuredClone(nextDomainBounds),
    latticeColumns: nextTransformColumns,
    latticeRows: nextTransformRows,
    restControlPoints: createRestControlPoints({
      domainBounds: nextDomainBounds,
      latticeColumns: nextTransformColumns,
      latticeRows: nextTransformRows
    }),
    warpDeformer: createWarpDeformerMetadata({
      domainBounds: nextDomainBounds,
      transformColumns: nextTransformColumns,
      transformRows: nextTransformRows,
      bezierColumns: nextBezierColumns,
      bezierRows: nextBezierRows
    })
  };
};

const applyWarpLattice2dRigControlFieldUpdate = (
  rigControl: WarpLattice2dRigControlDto,
  update: WarpLattice2dRigControlFieldUpdate
): void => {
  rigControl.domainBounds = structuredClone(update.domainBounds);
  rigControl.latticeColumns = update.latticeColumns;
  rigControl.latticeRows = update.latticeRows;
  rigControl.restControlPoints = structuredClone(update.restControlPoints);
  rigControl.warpDeformer = structuredClone(update.warpDeformer);
};

const bindDrawableChild = (
  graph: AuthoringGraph,
  parentRigControl: RigControlDto,
  childDrawableId: DrawableId
): void => {
  if (getDrawableById(graph, childDrawableId) === undefined) {
    throw new AuthoringMutationError(
      "missing_drawable",
      `Rig control child drawable does not exist: ${childDrawableId}`
    );
  }

  if (parentRigControl.childDrawableIds.includes(childDrawableId)) {
    throw new AuthoringMutationError(
      "no_op_rig_control_child_binding",
      `Drawable ${childDrawableId} is already bound to rig control ${parentRigControl.rigControlId}`
    );
  }

  const existingParent = findRigControlWithDrawableChild(graph, childDrawableId);
  if (existingParent !== undefined) {
    throw new AuthoringMutationError(
      "rig_control_child_already_parented",
      `Drawable ${childDrawableId} is already bound to rig control ${existingParent.rigControlId}`
    );
  }

  parentRigControl.childDrawableIds.push(childDrawableId);
};

const bindRigControlChildNode = (
  graph: AuthoringGraph,
  parentRigControl: RigControlDto,
  childRigControlId: RigControlId
): void => {
  if (childRigControlId === parentRigControl.rigControlId) {
    throw new AuthoringMutationError(
      "rig_control_self_child",
      `Rig control cannot be its own child: ${parentRigControl.rigControlId}`
    );
  }

  const childRigControl = getRigControlById(graph, childRigControlId);
  if (childRigControl === undefined) {
    throw new AuthoringMutationError(
      "missing_rig_control",
      `Child rig control does not exist: ${childRigControlId}`
    );
  }

  if (
    childRigControl.parentId === parentRigControl.rigControlId &&
    parentRigControl.childRigControlIds.includes(childRigControlId)
  ) {
    throw new AuthoringMutationError(
      "no_op_rig_control_child_binding",
      `Rig control ${childRigControlId} is already bound to ${parentRigControl.rigControlId}`
    );
  }

  if (childRigControl.parentId !== undefined) {
    throw new AuthoringMutationError(
      "rig_control_child_already_parented",
      `Rig control ${childRigControlId} already has parent ${childRigControl.parentId}`
    );
  }

  if (parentRigControl.childRigControlIds.includes(childRigControlId)) {
    throw new AuthoringMutationError(
      "no_op_rig_control_child_binding",
      `Rig control ${childRigControlId} is already listed under ${parentRigControl.rigControlId}`
    );
  }

  if (isRigControlDescendant(graph, childRigControlId, parentRigControl.rigControlId)) {
    throw new AuthoringMutationError(
      "rig_control_cycle",
      `Binding ${childRigControlId} under ${parentRigControl.rigControlId} would create a rig control cycle`
    );
  }

  parentRigControl.childRigControlIds.push(childRigControlId);
};

const setChildRigControlParent = (
  graph: AuthoringGraph,
  childRigControlId: RigControlId,
  parentRigControlId: RigControlId
): RigControlMutationChange => {
  const childRigControl = getRigControlById(graph, childRigControlId);
  if (childRigControl === undefined) {
    throw new Error(`Expected child rig control after precondition check: ${childRigControlId}`);
  }

  const before = structuredClone(childRigControl);
  childRigControl.parentId = parentRigControlId;
  removeRigControlRootId(graph, childRigControlId);

  return {
    before,
    after: structuredClone(childRigControl)
  };
};

const parseDrawableChildId = (child: TargetRefDto): DrawableId => {
  const parsed = DrawableIdSchema.safeParse(child.id);
  if (!parsed.success) {
    throw new AuthoringMutationError(
      "invalid_rig_control_child_id",
      `Invalid drawable child ID for bindRigControlChild: ${child.id}`
    );
  }

  return parsed.data;
};

const parseRigControlChildId = (child: TargetRefDto): RigControlId => {
  const parsed = RigControlIdSchema.safeParse(child.id);
  if (!parsed.success) {
    throw new AuthoringMutationError(
      "invalid_rig_control_child_id",
      `Invalid rigControl child ID for bindRigControlChild: ${child.id}`
    );
  }

  return parsed.data;
};

const findRigControlWithDrawableChild = (
  graph: AuthoringGraph,
  drawableId: DrawableId
): RigControlDto | undefined =>
  graph.rigControls.find((rigControl) => rigControl.childDrawableIds.includes(drawableId));

const findRigControlsWithDrawableChild = (
  graph: AuthoringGraph,
  drawableId: DrawableId
): readonly RigControlDto[] =>
  graph.rigControls.filter((rigControl) => rigControl.childDrawableIds.includes(drawableId));

const findRigControlsWithRigControlChild = (
  graph: AuthoringGraph,
  childRigControlId: RigControlId
): readonly RigControlDto[] =>
  graph.rigControls.filter((rigControl) => rigControl.childRigControlIds.includes(childRigControlId));

const replaceSelectedIdsWithWrapper = (
  currentIds: readonly RigControlId[],
  selectedIds: ReadonlySet<RigControlId>,
  wrapperRigControlId: RigControlId
): RigControlId[] => {
  const nextIds: RigControlId[] = [];
  let wrapperWasInserted = false;

  for (const currentId of currentIds) {
    if (!selectedIds.has(currentId)) {
      nextIds.push(currentId);
      continue;
    }

    if (!wrapperWasInserted) {
      nextIds.push(wrapperRigControlId);
      wrapperWasInserted = true;
    }
  }

  if (!wrapperWasInserted) {
    nextIds.push(wrapperRigControlId);
  }

  return nextIds;
};

const rigControlSubtreeContainsDrawable = (
  graph: AuthoringGraph,
  startRigControlId: RigControlId,
  targetDrawableId: DrawableId
): boolean => {
  const visited = new Set<RigControlId>();
  const pending: RigControlId[] = [startRigControlId];

  while (pending.length > 0) {
    const currentRigControlId = pending.pop();
    if (currentRigControlId === undefined || visited.has(currentRigControlId)) {
      continue;
    }

    visited.add(currentRigControlId);
    const currentRigControl = getRigControlById(graph, currentRigControlId);
    if (currentRigControl === undefined) {
      continue;
    }
    if (currentRigControl.childDrawableIds.includes(targetDrawableId)) {
      return true;
    }
    pending.push(...currentRigControl.childRigControlIds);
  }

  return false;
};

const isRigControlDescendant = (
  graph: AuthoringGraph,
  startRigControlId: RigControlId,
  targetRigControlId: RigControlId
): boolean => {
  const visited = new Set<RigControlId>();
  const pending: RigControlId[] = [startRigControlId];

  while (pending.length > 0) {
    const currentRigControlId = pending.pop();
    if (currentRigControlId === undefined || visited.has(currentRigControlId)) {
      continue;
    }

    if (currentRigControlId === targetRigControlId) {
      return true;
    }

    visited.add(currentRigControlId);
    const currentRigControl = getRigControlById(graph, currentRigControlId);
    if (currentRigControl !== undefined) {
      pending.push(...currentRigControl.childRigControlIds);
    }
  }

  return false;
};

const addRigControlRootId = (graph: AuthoringGraph, rigControlId: RigControlId): void => {
  if (!graph.rigControlRootIds.includes(rigControlId)) {
    graph.rigControlRootIds.push(rigControlId);
  }
};

const removeRigControlRootId = (graph: AuthoringGraph, rigControlId: RigControlId): void => {
  graph.rigControlRootIds = graph.rigControlRootIds.filter((rootId) => rootId !== rigControlId);
};

const createRestControlPoints = (input: {
  readonly domainBounds: RectDto;
  readonly latticeColumns: number;
  readonly latticeRows: number;
}): Vec2Dto[] =>
  createWarpLattice2dControlPointSlots(input).map((slot) => ({
    x: input.domainBounds.x + input.domainBounds.width * toUnitGridPosition(slot.column, input.latticeColumns),
    y: input.domainBounds.y + input.domainBounds.height * toUnitGridPosition(slot.row, input.latticeRows)
  }));

const withDefaultOpacityMultiplier = <TRigControl extends RigControlDto>(
  rigControl: TRigControl
): TRigControl => {
  const storedRigControl = structuredClone(rigControl);
  storedRigControl.opacityMultiplier = storedRigControl.opacityMultiplier ?? 1;
  return storedRigControl;
};

const isValidDivisionCount = (value: number): boolean =>
  Number.isInteger(value) && value >= 2;

const countOccurrences = <TValue>(values: readonly TValue[], expected: TValue): number =>
  values.filter((value) => value === expected).length;

const sameOrderedIds = <TValue extends string>(
  left: readonly TValue[],
  right: readonly TValue[]
): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const uniqueIds = <TValue extends string>(values: readonly TValue[]): TValue[] => [
  ...new Set(values)
];

const toUnitGridPosition = (index: number, size: number): number =>
  size <= 1 ? 0 : index / (size - 1);

const cloneDto = <TValue>(value: TValue): TValue => structuredClone(value);
