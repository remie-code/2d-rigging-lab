import {
  getPartOrderedChildren,
  type AuthoringSession,
  type VariantActiveSelectionEntry
} from "@private-2d-rigging-lab/authoring-core";
import type { DrawableId, PartId } from "@private-2d-rigging-lab/contracts";

import { createInitialCollapsedPartIds } from "../../editor-session/model/part-tree-collapse-state";

type VariantGroup = NonNullable<AuthoringSession["graph"]["variantGroups"]>[number];
type Variant = VariantGroup["variants"][number];
type VariantGroupId = VariantGroup["variantGroupId"];
type VariantId = Variant["variantId"];
type VariantActiveSelection = VariantActiveSelectionEntry["activeSelection"];

export type VariantManagerCheckSeverity = "info" | "warning" | "error";

export interface VariantManagerCheck {
  readonly id: string;
  readonly severity: VariantManagerCheckSeverity;
  readonly message: string;
}

export interface VariantGroupRow {
  readonly variantGroupId: VariantGroupId;
  readonly displayName: string;
  readonly mode: VariantGroup["mode"];
  readonly modeLabel: string;
  readonly variantCount: number;
  readonly targetDrawableCount: number;
  readonly selected: boolean;
}

export interface VariantTargetRow {
  readonly drawableId: DrawableId;
  readonly displayName: string;
  readonly partLabel: string;
  readonly missing: boolean;
  readonly memberships: readonly {
    readonly variantId: VariantId;
    readonly member: boolean;
  }[];
}

export interface VariantManagerProjection {
  readonly variantGroups: readonly VariantGroup[];
  readonly groupRows: readonly VariantGroupRow[];
  readonly selectedGroupId: VariantGroupId | null;
  readonly selectedGroup: VariantGroup | null;
  readonly targetRows: readonly VariantTargetRow[];
  readonly checks: readonly VariantManagerCheck[];
  readonly errorCount: number;
  readonly warningCount: number;
}

export type VariantDrawablePickerEligibility =
  | "eligible"
  | "notBound"
  | "alreadyInOtherGroup"
  | "alreadyInThisGroup";

export type VariantDrawablePickerRow =
  | {
      readonly kind: "part";
      readonly partId: PartId;
      readonly displayName: string;
      readonly depth: number;
      readonly collapsed: boolean;
      readonly canCollapse: boolean;
      readonly eligibleCount: number;
      readonly totalCount: number;
    }
  | {
      readonly kind: "drawable";
      readonly drawableId: DrawableId;
      readonly displayName: string;
      readonly depth: number;
      readonly eligibility: VariantDrawablePickerEligibility;
      readonly eligibilityLabel: string;
      readonly selectable: boolean;
      readonly checked: boolean;
      readonly selected: boolean;
      readonly ownerGroupName?: string;
    };

export interface VariantDrawablePickerProjection {
  readonly rows: readonly VariantDrawablePickerRow[];
  readonly eligibleCount: number;
  readonly totalDrawableCount: number;
  readonly selectedEligibleCount: number;
}

export function createVariantManagerProjection(
  session: AuthoringSession,
  options: {
    readonly selectedGroupId?: VariantGroupId | null;
  } = {}
): VariantManagerProjection {
  const variantGroups = session.graph.variantGroups ?? [];
  const selectedGroup =
    variantGroups.find((group) => group.variantGroupId === options.selectedGroupId) ??
    variantGroups[0] ??
    null;
  const selectedGroupId = selectedGroup?.variantGroupId ?? null;
  const drawableById = new Map(
    session.graph.drawables.map((drawable) => [drawable.drawableId, drawable])
  );
  const partById = new Map(session.graph.parts.map((part) => [part.partId, part]));
  const groupRows = variantGroups.map((group) => ({
    variantGroupId: group.variantGroupId,
    displayName: group.displayName,
    mode: group.mode,
    modeLabel: formatVariantGroupMode(group.mode),
    variantCount: group.variants.length,
    targetDrawableCount: group.targetDrawableIds.length,
    selected: group.variantGroupId === selectedGroupId
  }));
  const targetRows = selectedGroup === null
    ? []
    : selectedGroup.targetDrawableIds.map((drawableId) => {
        const drawable = drawableById.get(drawableId);
        const membership = selectedGroup.memberships.find((candidate) =>
          candidate.drawableId === drawableId
        );

        return {
          drawableId,
          displayName: drawable?.displayName ?? drawableId,
          partLabel: drawable === undefined
            ? "Missing part"
            : partById.get(drawable.partId)?.displayName ?? "Missing part",
          missing: drawable === undefined,
          memberships: selectedGroup.variants.map((variant) => ({
            variantId: variant.variantId,
            member: membership?.variantIds.includes(variant.variantId) ?? false
          }))
        };
      });
  const checks = createVariantManagerChecks(session);

  return {
    variantGroups,
    groupRows,
    selectedGroupId,
    selectedGroup,
    targetRows,
    checks,
    errorCount: checks.filter((check) => check.severity === "error").length,
    warningCount: checks.filter((check) => check.severity === "warning").length
  };
}

export function createVariantDrawablePickerProjection(
  session: AuthoringSession,
  input: {
    readonly variantGroupId: VariantGroupId;
    readonly collapsedPartIds?: ReadonlySet<PartId>;
    readonly selectedDrawableIds?: ReadonlySet<DrawableId>;
  }
): VariantDrawablePickerProjection {
  const variantGroups = session.graph.variantGroups ?? [];
  const currentGroup = variantGroups.find((group) =>
    group.variantGroupId === input.variantGroupId
  );
  const collapsedPartIds =
    input.collapsedPartIds ?? createInitialCollapsedPartIds(session);
  const selectedDrawableIds = input.selectedDrawableIds ?? new Set<DrawableId>();
  const partById = new Map(session.graph.parts.map((part) => [part.partId, part]));
  const drawableById = new Map(
    session.graph.drawables.map((drawable) => [drawable.drawableId, drawable])
  );
  const boundDrawableIds = createBoundDrawableIdSet(session);
  const ownerByDrawableId = createVariantDrawableOwnerMap(variantGroups);
  const roots = session.graph.parts.filter((part) => part.parentPartId === undefined);
  const rootParts = roots.length > 0 ? roots : session.graph.parts.slice(0, 1);
  const rows: VariantDrawablePickerRow[] = [];
  const globalCounts = rootParts.reduce(
    (current, part) => {
      const counts = countPickerDrawableEligibility({
        boundDrawableIds,
        currentGroup,
        drawableById,
        ownerByDrawableId,
        part,
        partById,
        session
      });
      return {
        eligible: current.eligible + counts.eligible,
        total: current.total + counts.total
      };
    },
    { eligible: 0, total: 0 }
  );
  const selectedEligibleCount = [...selectedDrawableIds].filter((drawableId) =>
    classifyDrawablePickerEligibility({
      boundDrawableIds,
      currentGroup,
      drawableId,
      ownerByDrawableId
    }) === "eligible"
  ).length;

  const appendPart = (part: AuthoringSession["graph"]["parts"][number], depth: number) => {
    const children = getPartOrderedChildren(session.graph, part);
    const counts = countPickerDrawableEligibility({
      boundDrawableIds,
      currentGroup,
      drawableById,
      ownerByDrawableId,
      part,
      partById,
      session
    });
    const collapsed = collapsedPartIds.has(part.partId);

    rows.push({
      kind: "part",
      partId: part.partId,
      displayName: part.displayName,
      depth,
      collapsed,
      canCollapse: children.length > 0,
      eligibleCount: counts.eligible,
      totalCount: counts.total
    });

    if (collapsed) {
      return;
    }

    for (const child of children) {
      if (child.kind === "part") {
        const childPart = partById.get(child.partId);
        if (childPart !== undefined) {
          appendPart(childPart, depth + 1);
        }
        continue;
      }

      const drawable = drawableById.get(child.drawableId);
      if (drawable === undefined) {
        continue;
      }

      const eligibility = classifyDrawablePickerEligibility({
        boundDrawableIds,
        currentGroup,
        drawableId: drawable.drawableId,
        ownerByDrawableId
      });
      const selectable = eligibility === "eligible";
      const selected = selectable && selectedDrawableIds.has(drawable.drawableId);
      const checked = selected || eligibility === "alreadyInThisGroup";

      rows.push({
        kind: "drawable",
        drawableId: drawable.drawableId,
        displayName: drawable.displayName,
        depth: depth + 1,
        eligibility,
        eligibilityLabel: formatPickerEligibility(eligibility),
        selectable,
        checked,
        selected,
        ...(ownerByDrawableId.get(drawable.drawableId)?.group.displayName === undefined
          ? {}
          : { ownerGroupName: ownerByDrawableId.get(drawable.drawableId)!.group.displayName })
      });
    }
  };

  for (const rootPart of rootParts) {
    appendPart(rootPart, 0);
  }

  return {
    rows,
    eligibleCount: globalCounts.eligible,
    totalDrawableCount: globalCounts.total,
    selectedEligibleCount
  };
}

export function createSuggestedVariantGroupId(
  session: AuthoringSession,
  displayName: string
): VariantGroupId {
  const existingIds = new Set((session.graph.variantGroups ?? []).map((group) => group.variantGroupId));
  const base = toIdToken(displayName, "group");
  return createUniqueVariantGroupId(existingIds, base);
}

export function createSuggestedVariantId(
  session: AuthoringSession,
  displayName: string
): VariantId {
  const existingIds = new Set(
    (session.graph.variantGroups ?? []).flatMap((group) =>
      group.variants.map((variant) => variant.variantId)
    )
  );
  const base = toIdToken(displayName, "variant");
  return createUniqueVariantId(existingIds, base);
}

export function createSuggestedVariantName(group: VariantGroup): string {
  const existingNames = new Set(group.variants.map((variant) => variant.displayName));
  for (let index = group.variants.length + 1; index < group.variants.length + 1000; index += 1) {
    const name = `Variant ${index}`;
    if (!existingNames.has(name)) {
      return name;
    }
  }

  return "Variant";
}

export function formatVariantGroupMode(mode: VariantGroup["mode"]): string {
  return mode === "singleSelect" ? "Single select" : "Multi toggle";
}

export function formatActiveSelectionLabel(
  group: VariantGroup,
  activeSelection: VariantActiveSelection
): string {
  if (activeSelection.kind === "singleSelect") {
    return group.variants.find((variant) => variant.variantId === activeSelection.variantId)
      ?.displayName ?? "Missing Variant";
  }

  const names = group.variants
    .filter((variant) => activeSelection.variantIds.includes(variant.variantId))
    .map((variant) => variant.displayName);
  return names.length === 0 ? "None" : names.join(", ");
}

function createVariantManagerChecks(session: AuthoringSession): readonly VariantManagerCheck[] {
  const variantGroups = session.graph.variantGroups ?? [];
  const checks: VariantManagerCheck[] = [];
  const drawableIds = new Set(session.graph.drawables.map((drawable) => drawable.drawableId));
  const ownedDrawableIds = new Map<DrawableId, VariantGroup>();

  if (variantGroups.length === 0) {
    checks.push({
      id: "variant.noGroups",
      severity: "info",
      message: "No Variant Groups."
    });
  }

  for (const group of variantGroups) {
    const variantIds = new Set(group.variants.map((variant) => variant.variantId));
    const targetDrawableIds = new Set(group.targetDrawableIds);

    for (const drawableId of group.targetDrawableIds) {
      if (!drawableIds.has(drawableId)) {
        checks.push({
          id: `variant.${group.variantGroupId}.${drawableId}.missingDrawable`,
          severity: "error",
          message: `${group.displayName} targets missing Drawable ${drawableId}.`
        });
      }

      const owner = ownedDrawableIds.get(drawableId);
      if (owner !== undefined) {
        checks.push({
          id: `variant.${group.variantGroupId}.${drawableId}.duplicateOwner`,
          severity: "error",
          message:
            `${drawableId} is owned by both ${owner.displayName} and ${group.displayName}.`
        });
      } else {
        ownedDrawableIds.set(drawableId, group);
      }
    }

    for (const membership of group.memberships) {
      if (!targetDrawableIds.has(membership.drawableId)) {
        checks.push({
          id: `variant.${group.variantGroupId}.${membership.drawableId}.orphanMembership`,
          severity: "error",
          message: `${group.displayName} has a membership row for non-target Drawable ${membership.drawableId}.`
        });
      }

      for (const variantId of membership.variantIds) {
        if (!variantIds.has(variantId)) {
          checks.push({
            id: `variant.${group.variantGroupId}.${membership.drawableId}.${variantId}.missingVariant`,
            severity: "error",
            message: `${group.displayName} membership references missing Variant ${variantId}.`
          });
        }
      }
    }

    for (const drawableId of group.targetDrawableIds) {
      if (!group.memberships.some((membership) => membership.drawableId === drawableId)) {
        checks.push({
          id: `variant.${group.variantGroupId}.${drawableId}.missingMembership`,
          severity: "error",
          message: `${group.displayName} target ${drawableId} has no membership row.`
        });
      }
    }

    if (group.defaultActive.kind !== group.mode) {
      checks.push({
        id: `variant.${group.variantGroupId}.defaultKind`,
        severity: "error",
        message: `${group.displayName} default active selection does not match the group mode.`
      });
    } else if (group.defaultActive.kind === "singleSelect") {
      if (!variantIds.has(group.defaultActive.variantId)) {
        checks.push({
          id: `variant.${group.variantGroupId}.defaultMissingVariant`,
          severity: "error",
          message: `${group.displayName} default active Variant is missing.`
        });
      }
    } else {
      for (const variantId of group.defaultActive.variantIds) {
        if (!variantIds.has(variantId)) {
          checks.push({
            id: `variant.${group.variantGroupId}.defaultMissingVariant.${variantId}`,
            severity: "error",
            message: `${group.displayName} default active selection references missing Variant ${variantId}.`
          });
        }
      }
    }
  }

  return checks;
}

function countPickerDrawableEligibility(input: {
  readonly session: AuthoringSession;
  readonly part: AuthoringSession["graph"]["parts"][number];
  readonly partById: ReadonlyMap<PartId, AuthoringSession["graph"]["parts"][number]>;
  readonly drawableById: ReadonlyMap<DrawableId, AuthoringSession["graph"]["drawables"][number]>;
  readonly boundDrawableIds: ReadonlySet<DrawableId>;
  readonly ownerByDrawableId: ReadonlyMap<DrawableId, { readonly group: VariantGroup }>;
  readonly currentGroup: VariantGroup | undefined;
}): { readonly eligible: number; readonly total: number } {
  let eligible = 0;
  let total = 0;
  const visitPart = (part: AuthoringSession["graph"]["parts"][number]) => {
    for (const child of getPartOrderedChildren(input.session.graph, part)) {
      if (child.kind === "part") {
        const childPart = input.partById.get(child.partId);
        if (childPart !== undefined) {
          visitPart(childPart);
        }
        continue;
      }

      const drawable = input.drawableById.get(child.drawableId);
      if (drawable === undefined) {
        continue;
      }

      total += 1;
      if (
        classifyDrawablePickerEligibility({
          boundDrawableIds: input.boundDrawableIds,
          currentGroup: input.currentGroup,
          drawableId: drawable.drawableId,
          ownerByDrawableId: input.ownerByDrawableId
        }) === "eligible"
      ) {
        eligible += 1;
      }
    }
  };

  visitPart(input.part);
  return { eligible, total };
}

function classifyDrawablePickerEligibility(input: {
  readonly drawableId: DrawableId;
  readonly boundDrawableIds: ReadonlySet<DrawableId>;
  readonly ownerByDrawableId: ReadonlyMap<DrawableId, { readonly group: VariantGroup }>;
  readonly currentGroup: VariantGroup | undefined;
}): VariantDrawablePickerEligibility {
  const owner = input.ownerByDrawableId.get(input.drawableId);
  if (owner?.group.variantGroupId === input.currentGroup?.variantGroupId) {
    return "alreadyInThisGroup";
  }

  if (owner !== undefined) {
    return "alreadyInOtherGroup";
  }

  if (!input.boundDrawableIds.has(input.drawableId)) {
    return "notBound";
  }

  return "eligible";
}

function createBoundDrawableIdSet(session: AuthoringSession): ReadonlySet<DrawableId> {
  return new Set(
    session.graph.rigControls.flatMap((rigControl) => rigControl.childDrawableIds)
  );
}

function createVariantDrawableOwnerMap(
  variantGroups: readonly VariantGroup[]
): ReadonlyMap<DrawableId, { readonly group: VariantGroup }> {
  const result = new Map<DrawableId, { readonly group: VariantGroup }>();

  for (const group of variantGroups) {
    for (const drawableId of group.targetDrawableIds) {
      if (!result.has(drawableId)) {
        result.set(drawableId, { group });
      }
    }
  }

  return result;
}

function formatPickerEligibility(eligibility: VariantDrawablePickerEligibility): string {
  switch (eligibility) {
    case "eligible":
      return "eligible";
    case "notBound":
      return "not bound";
    case "alreadyInOtherGroup":
      return "already in other group";
    case "alreadyInThisGroup":
      return "already in this group";
  }
}

function createUniqueVariantGroupId(
  existingIds: ReadonlySet<VariantGroupId>,
  base: string
): VariantGroupId {
  for (let index = 1; index < 1000; index += 1) {
    const suffix = index === 1 ? "" : `_${index}`;
    const id = `vgrp_${base}${suffix}` as VariantGroupId;
    if (!existingIds.has(id)) {
      return id;
    }
  }

  return `vgrp_${base}_${Date.now()}` as VariantGroupId;
}

function createUniqueVariantId(
  existingIds: ReadonlySet<VariantId>,
  base: string
): VariantId {
  for (let index = 1; index < 1000; index += 1) {
    const suffix = index === 1 ? "" : `_${index}`;
    const id = `var_${base}${suffix}` as VariantId;
    if (!existingIds.has(id)) {
      return id;
    }
  }

  return `var_${base}_${Date.now()}` as VariantId;
}

function toIdToken(value: string, fallback: string): string {
  const token = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]+/g, "_")
    .replaceAll(/^_+|_+$/g, "")
    .slice(0, 48);

  return token.length === 0 ? fallback : token;
}
