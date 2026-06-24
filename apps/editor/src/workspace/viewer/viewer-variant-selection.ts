import type {
  AuthoringSession,
  VariantActiveSelectionEntry
} from "@private-2d-rigging-lab/authoring-core";

import {
  reconcileVariantPreviewActiveSelections,
  resolveVariantPreviewActiveSelection,
  upsertVariantPreviewActiveSelection
} from "../../features/variants/model/variant-preview-state";

export type ViewerVariantGroup = NonNullable<
  AuthoringSession["graph"]["variantGroups"]
>[number];

export type ViewerVariantActiveSelection =
  VariantActiveSelectionEntry["activeSelection"];

export interface ViewerVariantSummaryItem {
  readonly variantGroupId: ViewerVariantGroup["variantGroupId"];
  readonly groupName: string;
  readonly activeLabel: string;
}

export const EMPTY_VIEWER_VARIANT_GROUPS: readonly ViewerVariantGroup[] = [];

export function getViewerVariantGroups(
  session: AuthoringSession
): readonly ViewerVariantGroup[] {
  return session.graph.variantGroups ?? EMPTY_VIEWER_VARIANT_GROUPS;
}

export function createInitialViewerVariantActiveSelections(
  variantGroups: readonly ViewerVariantGroup[] | undefined
): readonly VariantActiveSelectionEntry[] {
  return reconcileVariantPreviewActiveSelections(variantGroups, undefined);
}

export function reconcileViewerVariantActiveSelections(
  variantGroups: readonly ViewerVariantGroup[] | undefined,
  activeSelections: readonly VariantActiveSelectionEntry[] | undefined
): readonly VariantActiveSelectionEntry[] {
  return reconcileVariantPreviewActiveSelections(variantGroups, activeSelections);
}

export function setViewerVariantSingleSelect(
  variantGroups: readonly ViewerVariantGroup[] | undefined,
  activeSelections: readonly VariantActiveSelectionEntry[],
  group: ViewerVariantGroup,
  variantId: ViewerVariantGroup["variants"][number]["variantId"]
): readonly VariantActiveSelectionEntry[] {
  return upsertVariantPreviewActiveSelection(variantGroups, activeSelections, {
    variantGroupId: group.variantGroupId,
    activeSelection: {
      kind: "singleSelect",
      variantId
    }
  });
}

export function toggleViewerVariantMultiToggle(
  variantGroups: readonly ViewerVariantGroup[] | undefined,
  activeSelections: readonly VariantActiveSelectionEntry[],
  group: ViewerVariantGroup,
  variantId: ViewerVariantGroup["variants"][number]["variantId"]
): readonly VariantActiveSelectionEntry[] {
  const currentSelection = resolveViewerVariantActiveSelection(
    variantGroups,
    activeSelections,
    group
  );
  const nextVariantIds = new Set(
    currentSelection.kind === "multiToggle" ? currentSelection.variantIds : []
  );

  if (nextVariantIds.has(variantId)) {
    nextVariantIds.delete(variantId);
  } else {
    nextVariantIds.add(variantId);
  }

  return upsertVariantPreviewActiveSelection(variantGroups, activeSelections, {
    variantGroupId: group.variantGroupId,
    activeSelection: {
      kind: "multiToggle",
      variantIds: group.variants
        .map((variant) => variant.variantId)
        .filter((candidateId) => nextVariantIds.has(candidateId))
    }
  });
}

export function resolveViewerVariantActiveSelection(
  variantGroups: readonly ViewerVariantGroup[] | undefined,
  activeSelections: readonly VariantActiveSelectionEntry[],
  group: ViewerVariantGroup
): ViewerVariantActiveSelection {
  return (
    resolveVariantPreviewActiveSelection(
      variantGroups,
      activeSelections,
      group.variantGroupId
    ) ?? group.defaultActive
  );
}

export function createViewerVariantSummaryItems(
  variantGroups: readonly ViewerVariantGroup[] | undefined,
  activeSelections: readonly VariantActiveSelectionEntry[]
): readonly ViewerVariantSummaryItem[] {
  return (variantGroups ?? []).map((group) => ({
    variantGroupId: group.variantGroupId,
    groupName: group.displayName,
    activeLabel: formatViewerVariantActiveSelection(
      group,
      resolveViewerVariantActiveSelection(variantGroups, activeSelections, group)
    )
  }));
}

export function formatViewerVariantSummary(
  variantGroups: readonly ViewerVariantGroup[] | undefined,
  activeSelections: readonly VariantActiveSelectionEntry[]
): string {
  const items = createViewerVariantSummaryItems(variantGroups, activeSelections);

  if (items.length === 0) {
    return "No variants";
  }

  return items.map((item) => `${item.groupName}: ${item.activeLabel}`).join("; ");
}

export function hasViewerVariantActiveSelectionChanges(
  variantGroups: readonly ViewerVariantGroup[] | undefined,
  activeSelections: readonly VariantActiveSelectionEntry[]
): boolean {
  const defaults = createInitialViewerVariantActiveSelections(variantGroups);

  return !sameViewerVariantActiveSelections(
    reconcileViewerVariantActiveSelections(variantGroups, activeSelections),
    defaults
  );
}

export function sameViewerVariantActiveSelections(
  left: readonly VariantActiveSelectionEntry[],
  right: readonly VariantActiveSelectionEntry[]
): boolean {
  return createViewerVariantActiveSelectionSignature(left) ===
    createViewerVariantActiveSelectionSignature(right);
}

export function createViewerVariantGroupsSignature(
  variantGroups: readonly ViewerVariantGroup[] | undefined
): string {
  return JSON.stringify(variantGroups ?? []);
}

function formatViewerVariantActiveSelection(
  group: ViewerVariantGroup,
  selection: ViewerVariantActiveSelection
): string {
  if (selection.kind === "singleSelect") {
    return group.variants.find((variant) => variant.variantId === selection.variantId)
      ?.displayName ?? "Missing variant";
  }

  const activeVariantIds = new Set(selection.variantIds);
  const activeVariantNames = group.variants
    .filter((variant) => activeVariantIds.has(variant.variantId))
    .map((variant) => variant.displayName);

  return activeVariantNames.length === 0 ? "None" : activeVariantNames.join(" / ");
}

function createViewerVariantActiveSelectionSignature(
  activeSelections: readonly VariantActiveSelectionEntry[]
): string {
  return JSON.stringify(activeSelections);
}
