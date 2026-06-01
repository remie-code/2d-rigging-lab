import type { DrawableId, MaskRelationId } from "@private-2d-rigging-lab/contracts";
import type { MaskRelationDto } from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getDrawableById } from "./drawable-selectors.js";

export interface SetMaskRelationInput {
  readonly maskRelationId: MaskRelationId;
  readonly maskDrawableIds: readonly DrawableId[];
  readonly targetDrawableIds: readonly DrawableId[];
  readonly enabled: boolean;
}

export interface MaskRelationMutationResult {
  readonly session: AuthoringSession;
  readonly created: boolean;
  readonly relationBefore?: MaskRelationDto;
  readonly relationAfter: MaskRelationDto;
  readonly relationIndex: number;
  readonly authoringRevision: AuthoringRevision;
}

export const setMaskRelation = (
  session: AuthoringSession,
  input: SetMaskRelationInput
): MaskRelationMutationResult => {
  assertNonEmptyRelation(input);
  assertUniqueDrawableIds(input.maskDrawableIds, "duplicate_mask_drawable", "mask");
  assertUniqueDrawableIds(input.targetDrawableIds, "duplicate_mask_target_drawable", "target");
  assertDrawablesExist(session, input.maskDrawableIds, "missing_mask_drawable", "mask");
  assertDrawablesExist(session, input.targetDrawableIds, "missing_mask_target_drawable", "target");
  assertNoSelfMask(input);

  const relationIndex = session.graph.masks.findIndex(
    (relation) => relation.maskRelationId === input.maskRelationId
  );
  const relationBefore =
    relationIndex === -1 ? undefined : structuredClone(session.graph.masks[relationIndex]);
  const relationAfter = createUpdatedRelation(input, relationBefore);

  if (relationBefore !== undefined && maskRelationsEqual(relationBefore, relationAfter)) {
    throw new AuthoringMutationError(
      "no_op_mask_relation_update",
      `Mask relation ${input.maskRelationId} is already applied.`
    );
  }

  if (relationIndex === -1) {
    session.graph.masks.push(relationAfter);
  } else {
    session.graph.masks[relationIndex] = relationAfter;
  }

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    created: relationBefore === undefined,
    ...(relationBefore === undefined ? {} : { relationBefore }),
    relationAfter: structuredClone(relationAfter),
    relationIndex: relationIndex === -1 ? session.graph.masks.length - 1 : relationIndex,
    authoringRevision: session.authoringRevision
  };
};

const assertNonEmptyRelation = (input: SetMaskRelationInput): void => {
  if (input.maskDrawableIds.length === 0 || input.targetDrawableIds.length === 0) {
    throw new AuthoringMutationError(
      "empty_mask_relation",
      "Mask relation requires at least one mask drawable and one target drawable."
    );
  }
};

const assertUniqueDrawableIds = (
  drawableIds: readonly DrawableId[],
  code: "duplicate_mask_drawable" | "duplicate_mask_target_drawable",
  role: "mask" | "target"
): void => {
  const seen = new Set<DrawableId>();

  for (const drawableId of drawableIds) {
    if (seen.has(drawableId)) {
      throw new AuthoringMutationError(
        code,
        `Drawable appears more than once in ${role} drawable IDs: ${drawableId}.`
      );
    }

    seen.add(drawableId);
  }
};

const assertDrawablesExist = (
  session: AuthoringSession,
  drawableIds: readonly DrawableId[],
  code: "missing_mask_drawable" | "missing_mask_target_drawable",
  role: "mask" | "target"
): void => {
  for (const drawableId of drawableIds) {
    if (getDrawableById(session.graph, drawableId) === undefined) {
      throw new AuthoringMutationError(
        code,
        `${role === "mask" ? "Mask" : "Target"} drawable does not exist: ${drawableId}.`
      );
    }
  }
};

const assertNoSelfMask = (input: SetMaskRelationInput): void => {
  const maskDrawableIds = new Set(input.maskDrawableIds);
  const overlappingDrawableId = input.targetDrawableIds.find((targetDrawableId) =>
    maskDrawableIds.has(targetDrawableId)
  );

  if (overlappingDrawableId !== undefined) {
    throw new AuthoringMutationError(
      "self_mask_relation",
      `Drawable cannot be both mask and target in the same mask relation: ${overlappingDrawableId}.`
    );
  }
};

const createUpdatedRelation = (
  input: SetMaskRelationInput,
  existingRelation: MaskRelationDto | undefined
): MaskRelationDto => ({
  maskRelationId: input.maskRelationId,
  maskDrawableIds: [...input.maskDrawableIds],
  targetDrawableIds: [...input.targetDrawableIds],
  ...(existingRelation?.maskGroupHint === undefined ? {} : { maskGroupHint: existingRelation.maskGroupHint }),
  enabled: input.enabled
});

const maskRelationsEqual = (left: MaskRelationDto, right: MaskRelationDto): boolean =>
  left.maskRelationId === right.maskRelationId &&
  stringArraysEqual(left.maskDrawableIds, right.maskDrawableIds) &&
  stringArraysEqual(left.targetDrawableIds, right.targetDrawableIds) &&
  left.maskGroupHint === right.maskGroupHint &&
  left.enabled === right.enabled;

const stringArraysEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => right[index] === value);
