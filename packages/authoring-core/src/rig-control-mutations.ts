import {
  DrawableIdSchema,
  RigControlIdSchema,
  WarpLattice2dBindSpaceSchema,
  WarpLattice2dDomainBoundsSchema,
  WarpLattice2dInterpolationMethodSchema,
  hasWarpLattice2dControlPointCardinality
} from "@private-2d-rigging-lab/contracts";
import type {
  DrawableId,
  RigControlId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";
import type { RigControlDto } from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";
import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getDrawableById, getPartById } from "./drawable-selectors.js";
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

export const createRotation2dRigControl = (
  session: AuthoringSession,
  rigControl: Rotation2dRigControlDto
): CreateRotation2dRigControlMutationResult => {
  assertUniqueRigControlId(session, rigControl.rigControlId);
  assertPartExists(session, rigControl);
  assertUniqueChildIds(rigControl.childDrawableIds, "drawable");
  assertUniqueChildIds(rigControl.childRigControlIds, "rigControl");
  assertChildDrawablesCanBind(session, rigControl.childDrawableIds);
  assertChildRigControlsCanBind(session.graph, rigControl.rigControlId, rigControl.childRigControlIds);

  const rigControlRootIdsBefore = cloneDto(session.graph.rigControlRootIds);
  const storedRigControl = structuredClone(rigControl);
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
  assertPartExists(session, rigControl);
  assertUniqueChildIds(rigControl.childDrawableIds, "drawable");
  assertUniqueChildIds(rigControl.childRigControlIds, "rigControl");
  assertChildDrawablesCanBind(session, rigControl.childDrawableIds);
  assertChildRigControlsCanBind(session.graph, rigControl.rigControlId, rigControl.childRigControlIds);

  const rigControlRootIdsBefore = cloneDto(session.graph.rigControlRootIds);
  const storedRigControl = structuredClone(rigControl);
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
};

const assertPartExists = (
  session: AuthoringSession,
  rigControl: Pick<RigControlDto, "partId" | "rigControlId">
): void => {
  if (getPartById(session.graph, rigControl.partId) === undefined) {
    throw new AuthoringMutationError(
      "missing_part",
      `Rig control part does not exist: ${rigControl.partId}`
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

const cloneDto = <TValue>(value: TValue): TValue => structuredClone(value);
