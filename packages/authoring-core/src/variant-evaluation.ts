import type { DrawableId } from "@private-2d-rigging-lab/contracts";
import type {
  VariantDefaultActiveSelectionDto,
  VariantGroupDto,
  VariantGroupIdDto,
  VariantIdDto
} from "@private-2d-rigging-lab/package-format";

export interface VariantActiveSelectionEntry {
  readonly variantGroupId: VariantGroupIdDto;
  readonly activeSelection: VariantDefaultActiveSelectionDto;
}

export type VariantVisibilityPredicate = (drawableId: DrawableId | string) => boolean;

export const resolveDefaultVariantActiveSelections = (
  variantGroups: readonly VariantGroupDto[] | undefined
): readonly VariantActiveSelectionEntry[] =>
  (variantGroups ?? []).map((group) => ({
    variantGroupId: group.variantGroupId,
    activeSelection: structuredClone(group.defaultActive)
  }));

export const createVariantVisibilityPredicate = (input: {
  readonly variantGroups?: readonly VariantGroupDto[];
  readonly activeSelections?: readonly VariantActiveSelectionEntry[];
}): VariantVisibilityPredicate => {
  const variantGroups = input.variantGroups ?? [];
  const activeSelections = input.activeSelections ??
    resolveDefaultVariantActiveSelections(variantGroups);

  if (variantGroups.length === 0) {
    return () => true;
  }

  return (drawableId) => resolveVariantVisibilityForDrawable({
    variantGroups,
    activeSelections,
    drawableId
  });
};

export const resolveVariantVisibilityForDrawable = (input: {
  readonly variantGroups?: readonly VariantGroupDto[];
  readonly activeSelections?: readonly VariantActiveSelectionEntry[];
  readonly drawableId: DrawableId | string;
}): boolean => {
  const variantGroups = input.variantGroups ?? [];
  if (variantGroups.length === 0) {
    return true;
  }

  const group = findVariantGroupForDrawable(variantGroups, input.drawableId);
  if (group === undefined) {
    return true;
  }

  const membership = group.memberships.find((candidate) =>
    candidate.drawableId === input.drawableId
  );
  if (membership === undefined) {
    return false;
  }

  const activeSelection =
    createActiveSelectionMap(input.activeSelections).get(group.variantGroupId) ??
    group.defaultActive;
  const activeVariantIds = getActiveVariantIds(group, activeSelection);

  return membership.variantIds.some((variantId) => activeVariantIds.has(variantId));
};

const findVariantGroupForDrawable = (
  variantGroups: readonly VariantGroupDto[],
  drawableId: DrawableId | string
): VariantGroupDto | undefined =>
  variantGroups.find((group) =>
    group.targetDrawableIds.some((targetDrawableId) => targetDrawableId === drawableId)
  );

const createActiveSelectionMap = (
  activeSelections: readonly VariantActiveSelectionEntry[] | undefined
): ReadonlyMap<VariantGroupIdDto, VariantDefaultActiveSelectionDto> =>
  new Map(
    (activeSelections ?? []).map((selection) => [
      selection.variantGroupId,
      selection.activeSelection
    ])
  );

const getActiveVariantIds = (
  group: VariantGroupDto,
  activeSelection: VariantDefaultActiveSelectionDto
): ReadonlySet<VariantIdDto> => {
  if (activeSelection.kind !== group.mode) {
    return new Set();
  }

  if (activeSelection.kind === "singleSelect") {
    return new Set([activeSelection.variantId]);
  }

  return new Set(activeSelection.variantIds);
};
