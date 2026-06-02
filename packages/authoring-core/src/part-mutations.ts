import type { PartId } from "@private-2d-rigging-lab/contracts";
import type { ModelPartDto } from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getPartById } from "./drawable-selectors.js";
import { addStableOrderId } from "./stable-order-mutations.js";

export interface CreatePartMutationResult {
  readonly session: AuthoringSession;
  readonly part: ModelPartDto;
  readonly parentBefore?: ModelPartDto;
  readonly parentAfter?: ModelPartDto;
  readonly authoringRevision: AuthoringRevision;
}

export interface UpdatePartMutationResult {
  readonly session: AuthoringSession;
  readonly partBefore: ModelPartDto;
  readonly partAfter: ModelPartDto;
  readonly oldParentBefore?: ModelPartDto;
  readonly oldParentAfter?: ModelPartDto;
  readonly newParentBefore?: ModelPartDto;
  readonly newParentAfter?: ModelPartDto;
  readonly authoringRevision: AuthoringRevision;
}

export interface DeletePartMutationResult {
  readonly session: AuthoringSession;
  readonly partBefore: ModelPartDto;
  readonly parentBefore?: ModelPartDto;
  readonly parentAfter?: ModelPartDto;
  readonly stableOrderBefore: readonly string[];
  readonly stableOrderAfter: readonly string[];
  readonly authoringRevision: AuthoringRevision;
}

export const createPart = (
  session: AuthoringSession,
  input: {
    readonly part: ModelPartDto;
  }
): CreatePartMutationResult => {
  assertCanCreatePart(session, input.part);

  const storedPart = structuredClone(input.part);
  const parent =
    storedPart.parentPartId === undefined ? undefined : getPartById(session.graph, storedPart.parentPartId);
  const parentBefore = parent === undefined ? undefined : structuredClone(parent);

  session.graph.parts.push(storedPart);
  addStableOrderId(session.graph, storedPart.partId);

  if (parent !== undefined) {
    parent.childPartIds.push(storedPart.partId);
  }

  const parentAfter = parent === undefined ? undefined : structuredClone(parent);
  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    part: storedPart,
    ...(parentBefore === undefined ? {} : { parentBefore }),
    ...(parentAfter === undefined ? {} : { parentAfter }),
    authoringRevision: session.authoringRevision
  };
};

export const deletePart = (
  session: AuthoringSession,
  input: {
    readonly partId: PartId;
  }
): DeletePartMutationResult => {
  const part = getPartById(session.graph, input.partId);
  if (part === undefined) {
    throw new AuthoringMutationError("missing_part", `Part does not exist: ${input.partId}.`);
  }

  assertCanDeletePart(session, part);

  const parent =
    part.parentPartId === undefined ? undefined : getPartById(session.graph, part.parentPartId);
  const partBefore = structuredClone(part);
  const parentBefore = parent === undefined ? undefined : structuredClone(parent);
  const stableOrderBefore = [...session.graph.stableOrder];

  if (parent !== undefined) {
    parent.childPartIds = parent.childPartIds.filter((childPartId) => childPartId !== part.partId);
  }

  session.graph.parts = session.graph.parts.filter((candidate) => candidate.partId !== part.partId);
  session.graph.stableOrder = session.graph.stableOrder.filter((stableId) => stableId !== part.partId);

  const parentAfter = parent === undefined ? undefined : structuredClone(parent);
  const stableOrderAfter = [...session.graph.stableOrder];
  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    partBefore,
    ...(parentBefore === undefined ? {} : { parentBefore }),
    ...(parentAfter === undefined ? {} : { parentAfter }),
    stableOrderBefore,
    stableOrderAfter,
    authoringRevision: session.authoringRevision
  };
};

export const updatePart = (
  session: AuthoringSession,
  input: {
    readonly partId: PartId;
    readonly displayName?: string;
    readonly parentPartId?: PartId | null;
  }
): UpdatePartMutationResult => {
  const part = getPartById(session.graph, input.partId);
  if (part === undefined) {
    throw new AuthoringMutationError("missing_part", `Part does not exist: ${input.partId}.`);
  }

  const updatesParent = Object.prototype.hasOwnProperty.call(input, "parentPartId");
  const nextParentPartId = updatesParent ? input.parentPartId ?? undefined : part.parentPartId;
  assertCanUpdatePart(session, part, nextParentPartId);

  const displayNameChanged = input.displayName !== undefined && input.displayName !== part.displayName;
  const parentChanged = updatesParent && nextParentPartId !== part.parentPartId;
  if (!displayNameChanged && !parentChanged) {
    throw new AuthoringMutationError("no_op_part_update", `Part ${input.partId} is already up to date.`);
  }

  const oldParent =
    part.parentPartId === undefined ? undefined : getPartById(session.graph, part.parentPartId);
  const newParent = nextParentPartId === undefined ? undefined : getPartById(session.graph, nextParentPartId);
  const partBefore = structuredClone(part);
  const oldParentBefore = oldParent === undefined ? undefined : structuredClone(oldParent);
  const newParentBefore =
    newParent === undefined || newParent.partId === oldParent?.partId
      ? undefined
      : structuredClone(newParent);

  if (input.displayName !== undefined) {
    part.displayName = input.displayName;
  }

  if (parentChanged) {
    if (oldParent !== undefined) {
      oldParent.childPartIds = oldParent.childPartIds.filter((childPartId) => childPartId !== part.partId);
    }

    if (newParent !== undefined && !newParent.childPartIds.includes(part.partId)) {
      newParent.childPartIds.push(part.partId);
    }

    if (nextParentPartId === undefined) {
      delete part.parentPartId;
    } else {
      part.parentPartId = nextParentPartId;
    }
  }

  const partAfter = structuredClone(part);
  const oldParentAfter = oldParent === undefined ? undefined : structuredClone(oldParent);
  const newParentAfter =
    newParent === undefined || newParent.partId === oldParent?.partId
      ? undefined
      : structuredClone(newParent);

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    partBefore,
    partAfter,
    ...(oldParentBefore === undefined ? {} : { oldParentBefore }),
    ...(oldParentAfter === undefined ? {} : { oldParentAfter }),
    ...(newParentBefore === undefined ? {} : { newParentBefore }),
    ...(newParentAfter === undefined ? {} : { newParentAfter }),
    authoringRevision: session.authoringRevision
  };
};

const assertCanCreatePart = (session: AuthoringSession, part: ModelPartDto): void => {
  if (getPartById(session.graph, part.partId) !== undefined) {
    throw new AuthoringMutationError("duplicate_part", `Part already exists: ${part.partId}.`);
  }

  if (part.parentPartId === part.partId) {
    throw new AuthoringMutationError("part_cycle", `Part ${part.partId} cannot parent itself.`);
  }

  if (hasDuplicateStrings(part.childPartIds)) {
    throw new AuthoringMutationError(
      "duplicate_child_part",
      `Part ${part.partId} has duplicate child part references.`
    );
  }

  if (part.parentPartId !== undefined) {
    const parent = getPartById(session.graph, part.parentPartId);
    if (parent === undefined) {
      throw new AuthoringMutationError(
        "missing_parent_part",
        `Parent part does not exist: ${part.parentPartId}.`
      );
    }

    if (parent.childPartIds.includes(part.partId)) {
      throw new AuthoringMutationError(
        "duplicate_child_part",
        `Parent part ${parent.partId} already contains child ${part.partId}.`
      );
    }
  }
};

const assertCanDeletePart = (session: AuthoringSession, part: ModelPartDto): void => {
  if (part.parentPartId === part.partId) {
    throw new AuthoringMutationError("part_cycle", `Part ${part.partId} cannot parent itself.`);
  }

  if (part.parentPartId !== undefined && getPartById(session.graph, part.parentPartId) === undefined) {
    throw new AuthoringMutationError(
      "missing_parent_part",
      `Parent part does not exist: ${part.parentPartId}.`
    );
  }

  const childPartIds = getDirectChildPartIds(session, part.partId);
  if (childPartIds.length > 0) {
    throw new AuthoringMutationError(
      "part_has_child_parts",
      `Part ${part.partId} cannot be deleted because it has child parts: ${childPartIds.join(", ")}.`
    );
  }

  const drawableIds = getPartDrawableIds(session, part);
  if (drawableIds.length > 0) {
    throw new AuthoringMutationError(
      "part_has_drawables",
      `Part ${part.partId} cannot be deleted because it owns drawables: ${drawableIds.join(", ")}.`
    );
  }

  const rigControlIds = session.graph.rigControls
    .filter((rigControl) => rigControl.partId === part.partId)
    .map((rigControl) => rigControl.rigControlId);
  if (rigControlIds.length > 0) {
    throw new AuthoringMutationError(
      "part_has_rig_controls",
      `Part ${part.partId} cannot be deleted because rig controls reference it: ${rigControlIds.join(", ")}.`
    );
  }
};

const assertCanUpdatePart = (
  session: AuthoringSession,
  part: ModelPartDto,
  nextParentPartId: PartId | undefined
): void => {
  if (nextParentPartId !== undefined) {
    const nextParent = getPartById(session.graph, nextParentPartId);
    if (nextParent === undefined) {
      throw new AuthoringMutationError(
        "missing_parent_part",
        `Parent part does not exist: ${nextParentPartId}.`
      );
    }

    if (nextParentPartId === part.partId || isDescendantPart(session, part.partId, nextParentPartId)) {
      throw new AuthoringMutationError(
        "part_cycle",
        `Part ${part.partId} cannot be parented by descendant ${nextParentPartId}.`
      );
    }
  }

  for (const candidate of session.graph.parts) {
    if (hasDuplicateStrings(candidate.childPartIds)) {
      throw new AuthoringMutationError(
        "duplicate_child_part",
        `Part ${candidate.partId} has duplicate child part references.`
      );
    }
  }
};

const isDescendantPart = (
  session: AuthoringSession,
  ancestorPartId: PartId,
  candidatePartId: PartId
): boolean => {
  const stack = [...(getPartById(session.graph, ancestorPartId)?.childPartIds ?? [])];
  const seen = new Set<string>();

  while (stack.length > 0) {
    const partId = stack.pop();
    if (partId === undefined || seen.has(partId)) {
      continue;
    }

    if (partId === candidatePartId) {
      return true;
    }

    seen.add(partId);
    stack.push(...(getPartById(session.graph, partId)?.childPartIds ?? []));
  }

  return false;
};

const hasDuplicateStrings = (values: readonly string[]): boolean => new Set(values).size !== values.length;

const getDirectChildPartIds = (session: AuthoringSession, partId: PartId): readonly PartId[] => {
  const childPartIds = new Set<PartId>(getPartById(session.graph, partId)?.childPartIds ?? []);

  for (const candidate of session.graph.parts) {
    if (candidate.parentPartId === partId) {
      childPartIds.add(candidate.partId);
    }
  }

  return [...childPartIds];
};

const getPartDrawableIds = (session: AuthoringSession, part: ModelPartDto): readonly string[] => {
  const drawableIds = new Set<string>(part.drawableIds);

  for (const drawable of session.graph.drawables) {
    if (drawable.partId === part.partId) {
      drawableIds.add(drawable.drawableId);
    }
  }

  return [...drawableIds];
};
