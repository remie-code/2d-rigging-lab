import type {
  DrawableDto,
  VariantDefaultActiveSelectionDto,
  VariantGroupDto,
  VariantGroupIdDto,
  VariantGroupModeDto,
  VariantIdDto
} from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getDrawableById } from "./drawable-selectors.js";
import {
  getVariantGroupById,
  getVariantGroupForDrawable,
  getVariantGroups
} from "./variant-selectors.js";

export interface VariantGroupsMutationResult {
  readonly session: AuthoringSession;
  readonly variantGroupsBefore: readonly VariantGroupDto[];
  readonly variantGroupsAfter: readonly VariantGroupDto[];
  readonly authoringRevision: AuthoringRevision;
}

export const createVariantGroup = (
  session: AuthoringSession,
  input: {
    readonly group: VariantGroupDto;
  }
): VariantGroupsMutationResult => {
  const groups = getVariantGroups(session.graph);
  assertValidVariantGroupDisplayName(input.group.displayName);
  assertUniqueGroupId(groups, input.group.variantGroupId);
  assertUniqueVariantIds(session, input.group.variants.map((variant) => variant.variantId));
  assertVariantGroupInvariants(session, input.group, undefined);

  const before = cloneVariantGroups(groups);
  groups.push(structuredClone(input.group));

  return finishVariantMutation(session, before);
};

export const updateVariantGroup = (
  session: AuthoringSession,
  input: {
    readonly variantGroupId: VariantGroupIdDto;
    readonly displayName?: string;
    readonly mode?: VariantGroupModeDto;
  }
): VariantGroupsMutationResult => {
  const groups = getVariantGroups(session.graph);
  const group = getRequiredVariantGroup(session, input.variantGroupId);
  const nextMode = input.mode ?? group.mode;

  if (input.displayName !== undefined) {
    assertValidVariantGroupDisplayName(input.displayName);
  }

  const displayNameChanged =
    input.displayName !== undefined && input.displayName !== group.displayName;
  const modeChanged = input.mode !== undefined && input.mode !== group.mode;

  if (!displayNameChanged && !modeChanged) {
    throw new AuthoringMutationError(
      "no_op_variant_group_update",
      `Variant Group ${input.variantGroupId} is already up to date.`
    );
  }

  const before = cloneVariantGroups(groups);

  if (input.displayName !== undefined) {
    group.displayName = input.displayName;
  }

  if (modeChanged) {
    group.mode = nextMode;
    group.defaultActive = convertDefaultActiveForMode(group, nextMode);
  }

  assertVariantGroupInvariants(session, group, input.variantGroupId);

  return finishVariantMutation(session, before);
};

export const deleteVariantGroup = (
  session: AuthoringSession,
  input: {
    readonly variantGroupId: VariantGroupIdDto;
  }
): VariantGroupsMutationResult => {
  const groups = getVariantGroups(session.graph);
  getRequiredVariantGroup(session, input.variantGroupId);

  const before = cloneVariantGroups(groups);
  session.graph.variantGroups = groups.filter(
    (group) => group.variantGroupId !== input.variantGroupId
  );

  return finishVariantMutation(session, before);
};

export const createVariant = (
  session: AuthoringSession,
  input: {
    readonly variantGroupId: VariantGroupIdDto;
    readonly variantId: VariantIdDto;
    readonly displayName: string;
  }
): VariantGroupsMutationResult => {
  const groups = getVariantGroups(session.graph);
  const group = getRequiredVariantGroup(session, input.variantGroupId);
  assertValidVariantDisplayName(input.displayName);
  assertUniqueVariantIds(session, [input.variantId]);

  const before = cloneVariantGroups(groups);
  group.variants.push({
    variantId: input.variantId,
    displayName: input.displayName
  });

  return finishVariantMutation(session, before);
};

export const updateVariant = (
  session: AuthoringSession,
  input: {
    readonly variantGroupId: VariantGroupIdDto;
    readonly variantId: VariantIdDto;
    readonly displayName: string;
  }
): VariantGroupsMutationResult => {
  const groups = getVariantGroups(session.graph);
  const variant = getRequiredVariantInGroup(session, input.variantGroupId, input.variantId);
  assertValidVariantDisplayName(input.displayName);

  if (variant.displayName === input.displayName) {
    throw new AuthoringMutationError(
      "no_op_variant_group_update",
      `Variant ${input.variantId} is already up to date.`
    );
  }

  const before = cloneVariantGroups(groups);
  variant.displayName = input.displayName;

  return finishVariantMutation(session, before);
};

export const deleteVariant = (
  session: AuthoringSession,
  input: {
    readonly variantGroupId: VariantGroupIdDto;
    readonly variantId: VariantIdDto;
  }
): VariantGroupsMutationResult => {
  const groups = getVariantGroups(session.graph);
  const group = getRequiredVariantGroup(session, input.variantGroupId);
  getRequiredVariantInGroup(session, input.variantGroupId, input.variantId);

  if (group.mode === "singleSelect" && group.variants.length <= 1) {
    throw new AuthoringMutationError(
      "last_variant_delete",
      `Cannot delete the last Variant in singleSelect group ${input.variantGroupId}.`
    );
  }

  const before = cloneVariantGroups(groups);
  group.variants = group.variants.filter((variant) => variant.variantId !== input.variantId);
  group.memberships = group.memberships.map((membership) => ({
    ...membership,
    variantIds: membership.variantIds.filter((variantId) => variantId !== input.variantId)
  }));
  group.defaultActive = removeVariantFromDefaultActive(group, input.variantId);

  return finishVariantMutation(session, before);
};

export const addVariantTargetDrawable = (
  session: AuthoringSession,
  input: {
    readonly variantGroupId: VariantGroupIdDto;
    readonly drawableId: DrawableDto["drawableId"];
  }
): VariantGroupsMutationResult => {
  const groups = getVariantGroups(session.graph);
  const group = getRequiredVariantGroup(session, input.variantGroupId);
  assertDrawableExists(session, input.drawableId);

  const owner = getVariantGroupForDrawable(session.graph, input.drawableId);
  if (owner?.variantGroupId === input.variantGroupId) {
    throw new AuthoringMutationError(
      "duplicate_variant_target_drawable",
      `Drawable ${input.drawableId} is already a target of Variant Group ${input.variantGroupId}.`
    );
  }

  if (owner !== undefined) {
    throw new AuthoringMutationError(
      "variant_target_drawable_already_owned",
      `Drawable ${input.drawableId} already belongs to Variant Group ${owner.variantGroupId}.`
    );
  }

  const before = cloneVariantGroups(groups);
  group.targetDrawableIds.push(input.drawableId);
  group.memberships.push({
    drawableId: input.drawableId,
    variantIds: []
  });

  return finishVariantMutation(session, before);
};

export const removeVariantTargetDrawable = (
  session: AuthoringSession,
  input: {
    readonly variantGroupId: VariantGroupIdDto;
    readonly drawableId: DrawableDto["drawableId"];
  }
): VariantGroupsMutationResult => {
  const groups = getVariantGroups(session.graph);
  const group = getRequiredVariantGroup(session, input.variantGroupId);

  if (!group.targetDrawableIds.includes(input.drawableId)) {
    throw new AuthoringMutationError(
      "missing_variant_target_drawable",
      `Drawable ${input.drawableId} is not a target of Variant Group ${input.variantGroupId}.`
    );
  }

  const before = cloneVariantGroups(groups);
  group.targetDrawableIds = group.targetDrawableIds.filter((drawableId) => drawableId !== input.drawableId);
  group.memberships = group.memberships.filter((membership) => membership.drawableId !== input.drawableId);

  return finishVariantMutation(session, before);
};

export const setVariantMembership = (
  session: AuthoringSession,
  input: {
    readonly variantGroupId: VariantGroupIdDto;
    readonly drawableId: DrawableDto["drawableId"];
    readonly variantId: VariantIdDto;
    readonly member: boolean;
  }
): VariantGroupsMutationResult => {
  const groups = getVariantGroups(session.graph);
  const group = getRequiredVariantGroup(session, input.variantGroupId);
  getRequiredVariantInGroup(session, input.variantGroupId, input.variantId);
  const membership = group.memberships.find((candidate) => candidate.drawableId === input.drawableId);

  if (membership === undefined || !group.targetDrawableIds.includes(input.drawableId)) {
    throw new AuthoringMutationError(
      "missing_variant_membership",
      `Drawable ${input.drawableId} is not a target of Variant Group ${input.variantGroupId}.`
    );
  }

  const isMember = membership.variantIds.includes(input.variantId);
  if (isMember === input.member) {
    throw new AuthoringMutationError(
      "no_op_variant_membership_update",
      `Variant membership is already ${input.member} for ${input.drawableId}/${input.variantId}.`
    );
  }

  const before = cloneVariantGroups(groups);
  membership.variantIds = input.member
    ? [...membership.variantIds, input.variantId]
    : membership.variantIds.filter((variantId) => variantId !== input.variantId);

  return finishVariantMutation(session, before);
};

export const setVariantDefaultActiveSelection = (
  session: AuthoringSession,
  input: {
    readonly variantGroupId: VariantGroupIdDto;
    readonly defaultActive: VariantDefaultActiveSelectionDto;
  }
): VariantGroupsMutationResult => {
  const groups = getVariantGroups(session.graph);
  const group = getRequiredVariantGroup(session, input.variantGroupId);
  assertDefaultActiveSelection(group, input.defaultActive);

  if (JSON.stringify(group.defaultActive) === JSON.stringify(input.defaultActive)) {
    throw new AuthoringMutationError(
      "invalid_variant_default_active",
      `Variant Group ${input.variantGroupId} already has the requested default active selection.`
    );
  }

  const before = cloneVariantGroups(groups);
  group.defaultActive = structuredClone(input.defaultActive);

  return finishVariantMutation(session, before);
};

const finishVariantMutation = (
  session: AuthoringSession,
  variantGroupsBefore: readonly VariantGroupDto[]
): VariantGroupsMutationResult => {
  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    variantGroupsBefore,
    variantGroupsAfter: cloneVariantGroups(getVariantGroups(session.graph)),
    authoringRevision: session.authoringRevision
  };
};

const getRequiredVariantGroup = (
  session: AuthoringSession,
  variantGroupId: VariantGroupIdDto
): VariantGroupDto => {
  const group = getVariantGroupById(session.graph, variantGroupId);
  if (group === undefined) {
    throw new AuthoringMutationError(
      "missing_variant_group",
      `Variant Group does not exist: ${variantGroupId}.`
    );
  }

  return group;
};

const getRequiredVariantInGroup = (
  session: AuthoringSession,
  variantGroupId: VariantGroupIdDto,
  variantId: VariantIdDto
): VariantGroupDto["variants"][number] => {
  const group = getRequiredVariantGroup(session, variantGroupId);
  const variant = group.variants.find((candidate) => candidate.variantId === variantId);

  if (variant === undefined) {
    throw new AuthoringMutationError(
      "missing_variant",
      `Variant ${variantId} does not exist in Variant Group ${variantGroupId}.`
    );
  }

  return variant;
};

const assertValidVariantGroupDisplayName = (displayName: string): void => {
  if (displayName.trim().length === 0) {
    throw new AuthoringMutationError(
      "invalid_variant_group_display_name",
      "Variant Group displayName must not be blank."
    );
  }
};

const assertValidVariantDisplayName = (displayName: string): void => {
  if (displayName.trim().length === 0) {
    throw new AuthoringMutationError(
      "invalid_variant_display_name",
      "Variant displayName must not be blank."
    );
  }
};

const assertUniqueGroupId = (
  groups: readonly VariantGroupDto[],
  variantGroupId: VariantGroupIdDto
): void => {
  if (groups.some((group) => group.variantGroupId === variantGroupId)) {
    throw new AuthoringMutationError(
      "duplicate_variant_group",
      `Variant Group already exists: ${variantGroupId}.`
    );
  }
};

const assertUniqueVariantIds = (
  session: AuthoringSession,
  variantIds: readonly VariantIdDto[]
): void => {
  const existingVariantIds = new Set(
    getVariantGroups(session.graph).flatMap((group) =>
      group.variants.map((variant) => variant.variantId)
    )
  );
  const newVariantIds = new Set<VariantIdDto>();

  for (const variantId of variantIds) {
    if (existingVariantIds.has(variantId) || newVariantIds.has(variantId)) {
      throw new AuthoringMutationError(
        "duplicate_variant",
        `Variant already exists: ${variantId}.`
      );
    }

    newVariantIds.add(variantId);
  }
};

const assertDrawableExists = (
  session: AuthoringSession,
  drawableId: DrawableDto["drawableId"]
): void => {
  if (getDrawableById(session.graph, drawableId) === undefined) {
    throw new AuthoringMutationError(
      "missing_drawable",
      `Drawable does not exist: ${drawableId}.`
    );
  }
};

const assertVariantGroupInvariants = (
  session: AuthoringSession,
  group: VariantGroupDto,
  updatingGroupId: VariantGroupIdDto | undefined
): void => {
  const variantIds = new Set(group.variants.map((variant) => variant.variantId));
  const targetDrawableIds = new Set(group.targetDrawableIds);
  const membershipDrawableIds = new Set(group.memberships.map((membership) => membership.drawableId));

  if (variantIds.size !== group.variants.length) {
    throw new AuthoringMutationError(
      "duplicate_variant",
      `Variant Group ${group.variantGroupId} contains duplicate Variant IDs.`
    );
  }

  if (targetDrawableIds.size !== group.targetDrawableIds.length) {
    throw new AuthoringMutationError(
      "duplicate_variant_target_drawable",
      `Variant Group ${group.variantGroupId} contains duplicate target drawable IDs.`
    );
  }

  if (membershipDrawableIds.size !== group.memberships.length) {
    throw new AuthoringMutationError(
      "duplicate_variant_target_drawable",
      `Variant Group ${group.variantGroupId} contains duplicate membership drawable IDs.`
    );
  }

  group.targetDrawableIds.forEach((drawableId) => assertDrawableExists(session, drawableId));

  for (const drawableId of group.targetDrawableIds) {
    const owner = getVariantGroupForDrawable(session.graph, drawableId);
    if (owner !== undefined && owner.variantGroupId !== updatingGroupId) {
      throw new AuthoringMutationError(
        "variant_target_drawable_already_owned",
        `Drawable ${drawableId} already belongs to Variant Group ${owner.variantGroupId}.`
      );
    }
  }

  for (const drawableId of group.targetDrawableIds) {
    if (!membershipDrawableIds.has(drawableId)) {
      throw new AuthoringMutationError(
        "missing_variant_membership",
        `Target drawable ${drawableId} must have a Variant membership row.`
      );
    }
  }

  for (const membership of group.memberships) {
    if (!targetDrawableIds.has(membership.drawableId)) {
      throw new AuthoringMutationError(
        "missing_variant_target_drawable",
        `Membership drawable ${membership.drawableId} is not a Variant target.`
      );
    }

    if (new Set(membership.variantIds).size !== membership.variantIds.length) {
      throw new AuthoringMutationError(
        "duplicate_variant",
        `Membership for drawable ${membership.drawableId} contains duplicate Variant IDs.`
      );
    }

    for (const variantId of membership.variantIds) {
      if (!variantIds.has(variantId)) {
        throw new AuthoringMutationError(
          "missing_variant",
          `Membership references missing Variant: ${variantId}.`
        );
      }
    }
  }

  assertDefaultActiveSelection(group, group.defaultActive);
};

const assertDefaultActiveSelection = (
  group: VariantGroupDto,
  defaultActive: VariantDefaultActiveSelectionDto
): void => {
  if (group.mode !== defaultActive.kind) {
    throw new AuthoringMutationError(
      "invalid_variant_default_active",
      `Default active selection kind ${defaultActive.kind} does not match group mode ${group.mode}.`
    );
  }

  const variantIds = new Set(group.variants.map((variant) => variant.variantId));

  if (defaultActive.kind === "singleSelect") {
    if (!variantIds.has(defaultActive.variantId)) {
      throw new AuthoringMutationError(
        "invalid_variant_default_active",
        `Default active Variant does not exist: ${defaultActive.variantId}.`
      );
    }
    return;
  }

  if (new Set(defaultActive.variantIds).size !== defaultActive.variantIds.length) {
    throw new AuthoringMutationError(
      "invalid_variant_default_active",
      `Default active selection for ${group.variantGroupId} contains duplicate Variant IDs.`
    );
  }

  for (const variantId of defaultActive.variantIds) {
    if (!variantIds.has(variantId)) {
      throw new AuthoringMutationError(
        "invalid_variant_default_active",
        `Default active Variant does not exist: ${variantId}.`
      );
    }
  }
};

const convertDefaultActiveForMode = (
  group: VariantGroupDto,
  mode: VariantGroupModeDto
): VariantDefaultActiveSelectionDto => {
  if (mode === "multiToggle") {
    return group.defaultActive.kind === "singleSelect"
      ? { kind: "multiToggle", variantIds: [group.defaultActive.variantId] }
      : structuredClone(group.defaultActive);
  }

  const currentIds = group.defaultActive.kind === "multiToggle"
    ? group.defaultActive.variantIds
    : [group.defaultActive.variantId];
  const variantId = currentIds.find((candidate) =>
    group.variants.some((variant) => variant.variantId === candidate)
  ) ?? group.variants[0]?.variantId;

  if (variantId === undefined) {
    throw new AuthoringMutationError(
      "invalid_variant_default_active",
      `singleSelect Variant Group ${group.variantGroupId} requires at least one Variant.`
    );
  }

  return { kind: "singleSelect", variantId };
};

const removeVariantFromDefaultActive = (
  group: VariantGroupDto,
  variantId: VariantIdDto
): VariantDefaultActiveSelectionDto => {
  if (group.defaultActive.kind === "multiToggle") {
    return {
      kind: "multiToggle",
      variantIds: group.defaultActive.variantIds.filter((candidate) => candidate !== variantId)
    };
  }

  if (group.defaultActive.variantId !== variantId) {
    return structuredClone(group.defaultActive);
  }

  const fallbackVariant =
    group.variants.find((variant) => variant.displayName === "Default") ??
    group.variants[0];
  if (fallbackVariant === undefined) {
    throw new AuthoringMutationError(
      "last_variant_delete",
      `Cannot delete the last Variant in singleSelect group ${group.variantGroupId}.`
    );
  }

  return {
    kind: "singleSelect",
    variantId: fallbackVariant.variantId
  };
};

const cloneVariantGroups = (
  groups: readonly VariantGroupDto[] | undefined
): readonly VariantGroupDto[] => structuredClone(groups ?? []);
