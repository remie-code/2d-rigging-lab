import type {
  AuthoringSession,
  VariantActiveSelectionEntry
} from "@private-2d-rigging-lab/authoring-core";

type VariantGroup = NonNullable<AuthoringSession["graph"]["variantGroups"]>[number];
type VariantActiveSelection = VariantActiveSelectionEntry["activeSelection"];

export function reconcileVariantPreviewActiveSelections(
  variantGroups: readonly VariantGroup[] | undefined,
  activeSelections: readonly VariantActiveSelectionEntry[] | undefined
): readonly VariantActiveSelectionEntry[] {
  const selectionByGroupId = new Map(
    (activeSelections ?? []).map((entry) => [entry.variantGroupId, entry.activeSelection])
  );

  return (variantGroups ?? []).map((group) => ({
    variantGroupId: group.variantGroupId,
    activeSelection: sanitizeVariantActiveSelection(
      group,
      selectionByGroupId.get(group.variantGroupId) ?? group.defaultActive
    )
  }));
}

export function upsertVariantPreviewActiveSelection(
  variantGroups: readonly VariantGroup[] | undefined,
  activeSelections: readonly VariantActiveSelectionEntry[],
  entry: VariantActiveSelectionEntry
): readonly VariantActiveSelectionEntry[] {
  return reconcileVariantPreviewActiveSelections(variantGroups, [
    ...activeSelections.filter((candidate) => candidate.variantGroupId !== entry.variantGroupId),
    entry
  ]);
}

export function resolveVariantPreviewActiveSelection(
  variantGroups: readonly VariantGroup[] | undefined,
  activeSelections: readonly VariantActiveSelectionEntry[],
  variantGroupId: VariantGroup["variantGroupId"]
): VariantActiveSelection | null {
  const group = (variantGroups ?? []).find((candidate) =>
    candidate.variantGroupId === variantGroupId
  );
  if (group === undefined) {
    return null;
  }

  return activeSelections.find((entry) => entry.variantGroupId === variantGroupId)
    ?.activeSelection ?? group.defaultActive;
}

function sanitizeVariantActiveSelection(
  group: VariantGroup,
  selection: VariantActiveSelection
): VariantActiveSelection {
  const variantIds = new Set(group.variants.map((variant) => variant.variantId));

  if (group.mode === "singleSelect") {
    const requestedId = selection.kind === "singleSelect"
      ? selection.variantId
      : selection.variantIds.find((variantId) => variantIds.has(variantId));
    const fallbackId = group.defaultActive.kind === "singleSelect"
      ? group.defaultActive.variantId
      : group.defaultActive.variantIds.find((variantId) => variantIds.has(variantId));
    const variantId =
      [requestedId, fallbackId, group.variants[0]?.variantId].find((candidate) =>
        candidate !== undefined && variantIds.has(candidate)
      ) ?? requestedId ?? fallbackId ?? group.variants[0]?.variantId;

    return {
      kind: "singleSelect",
      variantId: variantId as Extract<VariantActiveSelection, { readonly kind: "singleSelect" }>["variantId"]
    };
  }

  const requestedIds = selection.kind === "multiToggle"
    ? selection.variantIds
    : [selection.variantId];
  return {
    kind: "multiToggle",
    variantIds: uniqueStrings(requestedIds.filter((variantId) => variantIds.has(variantId))) as Extract<
      VariantActiveSelection,
      { readonly kind: "multiToggle" }
    >["variantIds"]
  };
}

function uniqueStrings<TValue extends string>(values: readonly TValue[]): readonly TValue[] {
  return [...new Set(values)];
}
