import type {
  RuntimeExportDrawableDto,
  RuntimeExportModelDto,
  RuntimeExportVariantsDto,
  VariantDefaultActiveSelectionDto,
  VariantGroupDto,
  VariantGroupIdDto,
  VariantIdDto
} from "@private-2d-rigging-lab/package-format";

import {
  runtimePlayerActiveVariantSelectionSchemaVersion,
  runtimePlayerVariantControllerStatusSchemaVersion,
  type RuntimePlayerActiveVariantSelectionEntry,
  type RuntimePlayerActiveVariantSelectionState,
  type RuntimePlayerVariantControllerStatus
} from "../preload/runtime-variant-bridge-contract";

export function createRuntimeVariantControllerStatus(input: {
  readonly model: RuntimeExportModelDto | null;
  readonly activeSelections?: readonly RuntimePlayerActiveVariantSelectionEntry[];
  readonly nowIso: string;
}): RuntimePlayerVariantControllerStatus {
  if (input.model === null) {
    return createDisabledStatus({
      state: "no-model",
      statusLabel: "No model loaded",
      guidance: "Open a Runtime Export before switching Variants.",
      groups: [],
      defaultActiveSelections: [],
      nowIso: input.nowIso
    });
  }

  const variants = input.model.variants;
  const groups = variants?.variantGroups ?? [];
  const defaultActiveSelections = createDefaultActiveVariantSelections(variants);

  if (groups.length === 0 || variants === undefined) {
    return createDisabledStatus({
      state: "no-variants",
      statusLabel: "No Variants in Runtime Export",
      guidance: "This model does not include Variant Groups.",
      groups: [],
      defaultActiveSelections,
      nowIso: input.nowIso
    });
  }

  const activeSelections = normalizeActiveSelections({
    groups,
    selections: input.activeSelections ?? defaultActiveSelections
  });

  if (!hasCompleteBaseVisibility(input.model)) {
    return {
      schemaVersion: runtimePlayerVariantControllerStatusSchemaVersion,
      state: "legacy-export",
      statusLabel: "Re-export required for Variant switching",
      guidance:
        "This Runtime Export is missing base visibility data. Re-export the model from the current Editor to enable live Variant switching.",
      controlsEnabled: false,
      groups: createVariantControlGroups({
        groups,
        activeSelections
      }),
      activeVariantSelection: createActiveVariantSelectionState({
        state: "disabled",
        activeSelections: [],
        nowIso: input.nowIso
      }),
      defaultActiveSelections,
      updatedAtIso: input.nowIso
    };
  }

  return {
    schemaVersion: runtimePlayerVariantControllerStatusSchemaVersion,
    state: "ready",
    statusLabel: "Variant switching ready",
    guidance: null,
    controlsEnabled: true,
    groups: createVariantControlGroups({
      groups,
      activeSelections
    }),
    activeVariantSelection: createActiveVariantSelectionState({
      state: "ready",
      activeSelections,
      nowIso: input.nowIso
    }),
    defaultActiveSelections,
    updatedAtIso: input.nowIso
  };
}

export function createDefaultActiveVariantSelections(
  variants: RuntimeExportVariantsDto | undefined
): readonly RuntimePlayerActiveVariantSelectionEntry[] {
  if (variants === undefined) {
    return [];
  }

  const selectionsByGroupId = new Map(
    variants.defaultActiveSelections.map((selection) => [
      selection.variantGroupId,
      selection.activeSelection
    ])
  );

  return variants.variantGroups.map((group) => ({
    variantGroupId: group.variantGroupId,
    activeSelection: cloneActiveSelection(
      selectionsByGroupId.get(group.variantGroupId) ?? group.defaultActive
    )
  }));
}

export function selectSingleVariant(input: {
  readonly status: RuntimePlayerVariantControllerStatus;
  readonly variantGroupId: VariantGroupIdDto;
  readonly variantId: VariantIdDto;
  readonly nowIso: string;
}): RuntimePlayerVariantControllerStatus {
  assertReadyStatus(input.status);
  const group = getRequiredGroup(input.status, input.variantGroupId);
  if (group.mode !== "singleSelect") {
    throw new Error(`${group.displayName} is not a single-select Variant Group.`);
  }
  if (!group.variants.some((variant) => variant.variantId === input.variantId)) {
    throw new Error(`Variant does not exist in ${group.displayName}.`);
  }

  return updateActiveSelections(input.status, input.nowIso, (entry) =>
    entry.variantGroupId === input.variantGroupId
      ? {
          variantGroupId: entry.variantGroupId,
          activeSelection: {
            kind: "singleSelect",
            variantId: input.variantId
          }
        }
      : entry
  );
}

export function toggleMultiVariant(input: {
  readonly status: RuntimePlayerVariantControllerStatus;
  readonly variantGroupId: VariantGroupIdDto;
  readonly variantId: VariantIdDto;
  readonly active?: boolean;
  readonly nowIso: string;
}): RuntimePlayerVariantControllerStatus {
  assertReadyStatus(input.status);
  const group = getRequiredGroup(input.status, input.variantGroupId);
  if (group.mode !== "multiToggle") {
    throw new Error(`${group.displayName} is not a multi-toggle Variant Group.`);
  }
  if (!group.variants.some((variant) => variant.variantId === input.variantId)) {
    throw new Error(`Variant does not exist in ${group.displayName}.`);
  }

  return updateActiveSelections(input.status, input.nowIso, (entry) => {
    if (entry.variantGroupId !== input.variantGroupId) {
      return entry;
    }

    const currentIds = entry.activeSelection.kind === "multiToggle"
      ? entry.activeSelection.variantIds
      : [];
    const isActive = currentIds.includes(input.variantId);
    const nextActive = input.active ?? !isActive;
    const nextIds = nextActive
      ? [...currentIds, input.variantId]
      : currentIds.filter((variantId) => variantId !== input.variantId);

    return {
      variantGroupId: entry.variantGroupId,
      activeSelection: {
        kind: "multiToggle",
        variantIds: [...new Set(nextIds)]
      }
    };
  });
}

export function resetVariantSelectionToDefault(input: {
  readonly status: RuntimePlayerVariantControllerStatus;
  readonly nowIso: string;
}): RuntimePlayerVariantControllerStatus {
  assertReadyStatus(input.status);

  return updateStatusSelections({
    status: input.status,
    activeSelections: input.status.defaultActiveSelections,
    nowIso: input.nowIso
  });
}

export function resolveRuntimeVariantDrawableVisible(input: {
  readonly model: RuntimeExportModelDto;
  readonly drawable: RuntimeExportDrawableDto;
  readonly activeVariantSelection?: RuntimePlayerActiveVariantSelectionState | null;
}): boolean {
  const selection = input.activeVariantSelection;
  if (
    selection?.state !== "ready" ||
    input.model.variants === undefined ||
    !hasCompleteBaseVisibility(input.model)
  ) {
    return input.drawable.visible;
  }

  return Boolean(input.drawable.baseVisible) &&
    isDrawableVisibleForActiveSelection({
      groups: input.model.variants.variantGroups,
      activeSelections: selection.activeSelections,
      drawableId: input.drawable.drawableId
    });
}

export function hasCompleteBaseVisibility(
  model: RuntimeExportModelDto
): boolean {
  return model.drawables.every((drawable) =>
    typeof drawable.baseVisible === "boolean"
  );
}

export function cloneActiveVariantSelectionState(
  state: RuntimePlayerActiveVariantSelectionState | null
): RuntimePlayerActiveVariantSelectionState | null {
  if (state === null) {
    return null;
  }

  return {
    schemaVersion: state.schemaVersion,
    state: state.state,
    activeSelections: cloneActiveSelectionEntries(state.activeSelections),
    updatedAtIso: state.updatedAtIso
  };
}

function createDisabledStatus(input: {
  readonly state: RuntimePlayerVariantControllerStatus["state"];
  readonly statusLabel: string;
  readonly guidance: string;
  readonly groups: readonly VariantGroupDto[];
  readonly defaultActiveSelections: readonly RuntimePlayerActiveVariantSelectionEntry[];
  readonly nowIso: string;
}): RuntimePlayerVariantControllerStatus {
  return {
    schemaVersion: runtimePlayerVariantControllerStatusSchemaVersion,
    state: input.state,
    statusLabel: input.statusLabel,
    guidance: input.guidance,
    controlsEnabled: false,
    groups: createVariantControlGroups({
      groups: input.groups,
      activeSelections: input.defaultActiveSelections
    }),
    activeVariantSelection: createActiveVariantSelectionState({
      state: "disabled",
      activeSelections: [],
      nowIso: input.nowIso
    }),
    defaultActiveSelections: input.defaultActiveSelections,
    updatedAtIso: input.nowIso
  };
}

function createActiveVariantSelectionState(input: {
  readonly state: RuntimePlayerActiveVariantSelectionState["state"];
  readonly activeSelections: readonly RuntimePlayerActiveVariantSelectionEntry[];
  readonly nowIso: string;
}): RuntimePlayerActiveVariantSelectionState {
  return {
    schemaVersion: runtimePlayerActiveVariantSelectionSchemaVersion,
    state: input.state,
    activeSelections: cloneActiveSelectionEntries(input.activeSelections),
    updatedAtIso: input.nowIso
  };
}

function createVariantControlGroups(input: {
  readonly groups: readonly VariantGroupDto[];
  readonly activeSelections: readonly RuntimePlayerActiveVariantSelectionEntry[];
}): RuntimePlayerVariantControllerStatus["groups"] {
  const selectionByGroupId = new Map(
    input.activeSelections.map((entry) => [
      entry.variantGroupId,
      entry.activeSelection
    ])
  );

  return input.groups.map((group) => {
    const activeVariantIds = getActiveVariantIds(
      group,
      selectionByGroupId.get(group.variantGroupId) ?? group.defaultActive
    );

    return {
      variantGroupId: group.variantGroupId,
      displayName: group.displayName,
      mode: group.mode,
      variants: group.variants.map((variant) => ({
        variantId: variant.variantId,
        displayName: variant.displayName,
        active: activeVariantIds.has(variant.variantId)
      }))
    };
  });
}

function normalizeActiveSelections(input: {
  readonly groups: readonly VariantGroupDto[];
  readonly selections: readonly RuntimePlayerActiveVariantSelectionEntry[];
}): readonly RuntimePlayerActiveVariantSelectionEntry[] {
  const selectionsByGroupId = new Map(
    input.selections.map((entry) => [
      entry.variantGroupId,
      entry.activeSelection
    ])
  );

  return input.groups.map((group) => ({
    variantGroupId: group.variantGroupId,
    activeSelection: normalizeActiveSelection({
      group,
      selection: selectionsByGroupId.get(group.variantGroupId) ??
        group.defaultActive
    })
  }));
}

function normalizeActiveSelection(input: {
  readonly group: VariantGroupDto;
  readonly selection: VariantDefaultActiveSelectionDto;
}): VariantDefaultActiveSelectionDto {
  const variantIds = new Set(
    input.group.variants.map((variant) => variant.variantId)
  );

  if (input.group.mode === "singleSelect") {
    const fallbackVariantId = input.group.variants[0]?.variantId;
    if (fallbackVariantId === undefined) {
      throw new Error(
        `singleSelect Variant Group ${input.group.variantGroupId} requires at least one Variant.`
      );
    }
    const variantId = input.selection.kind === "singleSelect" &&
      variantIds.has(input.selection.variantId)
      ? input.selection.variantId
      : fallbackVariantId;

    return {
      kind: "singleSelect",
      variantId
    };
  }

  return {
    kind: "multiToggle",
    variantIds: input.selection.kind === "multiToggle"
      ? input.selection.variantIds.filter((variantId) =>
          variantIds.has(variantId)
        )
      : []
  };
}

function updateActiveSelections(
  status: RuntimePlayerVariantControllerStatus,
  nowIso: string,
  updater: (
    entry: RuntimePlayerActiveVariantSelectionEntry
  ) => RuntimePlayerActiveVariantSelectionEntry
): RuntimePlayerVariantControllerStatus {
  return updateStatusSelections({
    status,
    activeSelections: status.activeVariantSelection.activeSelections.map(updater),
    nowIso
  });
}

function updateStatusSelections(input: {
  readonly status: RuntimePlayerVariantControllerStatus;
  readonly activeSelections: readonly RuntimePlayerActiveVariantSelectionEntry[];
  readonly nowIso: string;
}): RuntimePlayerVariantControllerStatus {
  const selectionByGroupId = new Map(
    input.activeSelections.map((entry) => [
      entry.variantGroupId,
      entry.activeSelection
    ])
  );

  return {
    ...input.status,
    groups: input.status.groups.map((group) => {
      const activeVariantIds = getActiveVariantIds(
        group,
        selectionByGroupId.get(group.variantGroupId) ??
          input.status.defaultActiveSelections.find((entry) =>
            entry.variantGroupId === group.variantGroupId
          )?.activeSelection ??
          input.activeSelections.find((entry) =>
            entry.variantGroupId === group.variantGroupId
          )?.activeSelection ??
          { kind: "multiToggle", variantIds: [] }
      );

      return {
        ...group,
        variants: group.variants.map((variant) => ({
          ...variant,
          active: activeVariantIds.has(variant.variantId)
        }))
      };
    }),
    activeVariantSelection: createActiveVariantSelectionState({
      state: "ready",
      activeSelections: input.activeSelections,
      nowIso: input.nowIso
    }),
    updatedAtIso: input.nowIso
  };
}

function isDrawableVisibleForActiveSelection(input: {
  readonly groups: readonly VariantGroupDto[];
  readonly activeSelections: readonly RuntimePlayerActiveVariantSelectionEntry[];
  readonly drawableId: RuntimeExportDrawableDto["drawableId"];
}): boolean {
  const group = input.groups.find((candidate) =>
    candidate.targetDrawableIds.includes(input.drawableId)
  );
  if (group === undefined) {
    return true;
  }

  const membership = group.memberships.find((candidate) =>
    candidate.drawableId === input.drawableId
  );
  if (membership === undefined) {
    return false;
  }

  const selection = input.activeSelections.find((entry) =>
    entry.variantGroupId === group.variantGroupId
  )?.activeSelection ?? group.defaultActive;
  const activeVariantIds = getActiveVariantIds(group, selection);

  return membership.variantIds.some((variantId) =>
    activeVariantIds.has(variantId)
  );
}

function getActiveVariantIds(
  group: Pick<VariantGroupDto, "mode">,
  selection: VariantDefaultActiveSelectionDto
): ReadonlySet<VariantIdDto> {
  if (selection.kind !== group.mode) {
    return new Set();
  }

  if (selection.kind === "singleSelect") {
    return new Set([selection.variantId]);
  }

  return new Set(selection.variantIds);
}

function assertReadyStatus(
  status: RuntimePlayerVariantControllerStatus
): void {
  if (!status.controlsEnabled || status.state !== "ready") {
    throw new Error(status.guidance ?? "Variant switching is not available.");
  }
}

function getRequiredGroup(
  status: RuntimePlayerVariantControllerStatus,
  variantGroupId: VariantGroupIdDto
): RuntimePlayerVariantControllerStatus["groups"][number] {
  const group = status.groups.find((candidate) =>
    candidate.variantGroupId === variantGroupId
  );
  if (group === undefined) {
    throw new Error("Variant Group does not exist.");
  }

  return group;
}

function cloneActiveSelectionEntries(
  entries: readonly RuntimePlayerActiveVariantSelectionEntry[]
): RuntimePlayerActiveVariantSelectionEntry[] {
  return entries.map((entry) => ({
    variantGroupId: entry.variantGroupId,
    activeSelection: cloneActiveSelection(entry.activeSelection)
  }));
}

function cloneActiveSelection(
  selection: VariantDefaultActiveSelectionDto
): VariantDefaultActiveSelectionDto {
  if (selection.kind === "singleSelect") {
    return {
      kind: "singleSelect",
      variantId: selection.variantId
    };
  }

  return {
    kind: "multiToggle",
    variantIds: [...selection.variantIds]
  };
}
