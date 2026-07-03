import type { VariantActiveSelectionEntry } from "@private-2d-rigging-lab/authoring-core";
import { resolveDefaultVariantActiveSelections } from "@private-2d-rigging-lab/authoring-core";
import type {
  ResolvedVariantSelectionEntry,
  VariantSelectionsPayload
} from "@private-2d-rigging-lab/ai-interface";
import type { VariantGroupDto } from "@private-2d-rigging-lab/package-format";

/**
 * Variant selection resolution + validation (Wave105 Domain A, §3.1).
 *
 * The pure predicate (`createVariantVisibilityPredicate`) tolerates malformed
 * input by silently falling back to identity behaviour. That is wrong for a
 * command surface: an unknown group / variant reference, or a mode mismatch,
 * must be rejected DETERMINISTICALLY so a caller cannot ask for an outfit that
 * does not exist and quietly get the default one. This module is that explicit
 * validation layer.
 *
 * It takes the session's Variant Groups and the optional payload selections and:
 *  - undefined payload → the package `defaultActive` for every group (via
 *    authoring-core's `resolveDefaultVariantActiveSelections`; consumption only,
 *    never re-implemented).
 *  - present payload → validates every entry (group exists, kind matches the
 *    group's mode, every referenced variant exists) then merges it over the
 *    defaults, so groups not named still resolve to their default.
 *
 * The returned `activeSelections` feed the pure predicate; the `resolved` echo
 * is recorded in the sidecar / measurement result. Both are sorted by
 * `variantGroupId` so serialization is byte-deterministic.
 */

export class VariantSelectionResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VariantSelectionResolutionError";
  }
}

export interface ResolvedVariantSelections {
  /** For the pure `createVariantVisibilityPredicate` (authoring-core form). */
  readonly activeSelections: readonly VariantActiveSelectionEntry[];
  /** For the sidecar / measurement result echo (ai-interface form). */
  readonly resolved: readonly ResolvedVariantSelectionEntry[];
}

export const resolveVariantSelections = (input: {
  readonly variantGroups: readonly VariantGroupDto[] | undefined;
  readonly variantSelections: VariantSelectionsPayload;
}): ResolvedVariantSelections => {
  const variantGroups = input.variantGroups ?? [];

  // Defaults first: one entry per group, deep-cloned by authoring-core.
  const defaults = resolveDefaultVariantActiveSelections(variantGroups);
  const activeByGroupId = new Map<string, VariantActiveSelectionEntry>(
    defaults.map((entry) => [entry.variantGroupId, entry])
  );

  // Reject any payload entry naming a group that isn't present (even when the
  // package has zero groups: asking for a variant selection there is a mistake
  // worth surfacing, not silently ignoring).
  const groupById = new Map<string, VariantGroupDto>(
    variantGroups.map((group) => [group.variantGroupId, group])
  );

  for (const selection of input.variantSelections ?? []) {
    const group = groupById.get(selection.variantGroupId);
    if (group === undefined) {
      throw new VariantSelectionResolutionError(
        `Unknown Variant Group referenced in variantSelections: ${selection.variantGroupId}.`
      );
    }

    if (selection.kind !== group.mode) {
      throw new VariantSelectionResolutionError(
        `Variant selection kind "${selection.kind}" does not match Variant Group ` +
          `${selection.variantGroupId} mode "${group.mode}".`
      );
    }

    const knownVariantIds = new Set(group.variants.map((variant) => variant.variantId));

    if (selection.kind === "singleSelect") {
      if (!knownVariantIds.has(selection.variantId)) {
        throw new VariantSelectionResolutionError(
          `Unknown Variant "${selection.variantId}" for Variant Group ` +
            `${selection.variantGroupId}.`
        );
      }
      activeByGroupId.set(selection.variantGroupId, {
        variantGroupId: selection.variantGroupId,
        activeSelection: { kind: "singleSelect", variantId: selection.variantId }
      });
      continue;
    }

    const seen = new Set<string>();
    for (const variantId of selection.variantIds) {
      if (!knownVariantIds.has(variantId)) {
        throw new VariantSelectionResolutionError(
          `Unknown Variant "${variantId}" for Variant Group ` +
            `${selection.variantGroupId}.`
        );
      }
      if (seen.has(variantId)) {
        throw new VariantSelectionResolutionError(
          `Duplicate Variant "${variantId}" in variantSelections for Variant Group ` +
            `${selection.variantGroupId}.`
        );
      }
      seen.add(variantId);
    }
    activeByGroupId.set(selection.variantGroupId, {
      variantGroupId: selection.variantGroupId,
      activeSelection: {
        kind: "multiToggle",
        variantIds: [...selection.variantIds]
      }
    });
  }

  // Deterministic order: sort by variantGroupId for both outputs.
  const orderedGroupIds = [...activeByGroupId.keys()].sort((left, right) =>
    left.localeCompare(right)
  );

  const activeSelections = orderedGroupIds.map(
    (groupId) => activeByGroupId.get(groupId)!
  );

  const resolved: ResolvedVariantSelectionEntry[] = activeSelections.map((entry) =>
    entry.activeSelection.kind === "singleSelect"
      ? {
          kind: "singleSelect",
          variantGroupId: entry.variantGroupId,
          variantId: entry.activeSelection.variantId
        }
      : {
          kind: "multiToggle",
          variantGroupId: entry.variantGroupId,
          variantIds: [...entry.activeSelection.variantIds]
        }
  );

  return { activeSelections, resolved };
};
