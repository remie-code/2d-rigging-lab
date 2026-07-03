import type {
  AuthoringSession,
  VariantActiveSelectionEntry
} from "@private-2d-rigging-lab/authoring-core";
import {
  createVariantVisibilityPredicate,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type {
  NormalizedRuntimeGraph,
  RuntimeSnapshotDto,
  ViewerParameterOverrideInput
} from "@private-2d-rigging-lab/runtime-core";
import { evaluateViewerRuntimeSnapshot } from "@private-2d-rigging-lab/runtime-core";

/**
 * Perception evaluation adapter (Wave104 Domain A; Wave105 Domain A adds the
 * Variant visibility gate).
 *
 * Bridges a live AuthoringSession to a runtime-core evaluated snapshot WITHOUT
 * going through Runtime Export (forbidden as a perception middle stage): the
 * session is converted to a NormalizedRuntimeGraph via authoring-core's
 * Export-free `toRuntimeGraph`, then evaluated by runtime-core.
 *
 * The runtime-core evaluator is the perception oracle (L0 decision 3.1-1): the
 * Fable eye sees "what the model is at runtime" (Player semantics), not the
 * editor canvas.
 *
 * Wave105 §3.1: runtime-core is Variant-unaware by design. This adapter applies
 * the two-layer visibility composition `base visible AND
 * variantVisibilityPredicate(activeSelections)` at the SNAPSHOT level, so the
 * eye (render), the tape measure (measurement) and the framing (drawableFocus /
 * modelBounds bbox) all consume the SAME gated visibility world. The gate builds
 * a NEW snapshot (drawables re-mapped, drawList re-derived) and never mutates
 * the runtime-core result in place — the runtime snapshot may be a frozen /
 * shared object. The predicate is authoring-core's pure function, consumed only
 * (never re-implemented). An empty / absent `variantGroups` makes the predicate
 * identity, so a package with no Variant Groups renders byte-identically to the
 * pre-gate behaviour.
 */

export interface EvaluatedPerceptionSnapshot {
  readonly graph: NormalizedRuntimeGraph;
  readonly snapshot: RuntimeSnapshotDto;
}

export interface EvaluatePerceptionSnapshotOptions {
  readonly parameterOverrides?: ViewerParameterOverrideInput;
  /**
   * The RESOLVED active Variant selection (authoring-core form) to gate with.
   * Omitted → the package `defaultActive` is auto-derived by the pure predicate.
   * Callers that accept a payload `variantSelections` resolve + validate it
   * first (see `variant-selection-resolution.ts`) and pass the resolved form
   * here.
   */
  readonly variantSelections?: readonly VariantActiveSelectionEntry[];
}

/**
 * Evaluate the session at rest pose (or with the given parameter overrides) and
 * return the runtime graph plus a `full`-detail snapshot with the Variant
 * visibility gate applied. `full` detail is required so evaluated per-drawable
 * `vertices` are present for RenderScene construction (summary/targeted omit
 * them).
 */
export const evaluatePerceptionSnapshot = (
  session: AuthoringSession,
  options: EvaluatePerceptionSnapshotOptions = {}
): EvaluatedPerceptionSnapshot => {
  const graph = toRuntimeGraph(session);
  const result = evaluateViewerRuntimeSnapshot(graph, {
    parameterOverrides: options.parameterOverrides ?? {},
    options: {
      schemaVersion: "runtime-evaluation-options-v1",
      snapshotDetail: "full"
    }
  });

  return {
    graph,
    snapshot: applyVariantVisibilityGate({
      session,
      snapshot: result.snapshot,
      ...(options.variantSelections === undefined
        ? {}
        : { variantSelections: options.variantSelections })
    })
  };
};

/**
 * Returns a NEW snapshot whose every drawable's `visible` is
 * `base visible AND predicate(drawableId)`, with `drawList` re-derived to the
 * gated-visible drawables (in the same base draw order). When the package has no
 * Variant Groups the predicate is identity, so the returned snapshot is
 * value-equal to the input (same visibility, same drawList) — a no-op for
 * gate-free packages.
 */
const applyVariantVisibilityGate = (input: {
  readonly session: AuthoringSession;
  readonly snapshot: RuntimeSnapshotDto;
  readonly variantSelections?: readonly VariantActiveSelectionEntry[];
}): RuntimeSnapshotDto => {
  const variantGroups = input.session.graph.variantGroups ?? [];
  if (variantGroups.length === 0) {
    // Identity gate: nothing to compose. Return the snapshot unchanged so the
    // empty case is provably byte-identical to the pre-gate behaviour.
    return input.snapshot;
  }

  const predicate = createVariantVisibilityPredicate({
    variantGroups,
    ...(input.variantSelections === undefined
      ? {}
      : { activeSelections: input.variantSelections })
  });

  const gatedDrawables = input.snapshot.drawables.map((drawable) => ({
    ...drawable,
    visible: drawable.visible && predicate(drawable.drawableId)
  }));

  const visibleDrawableIds = new Set(
    gatedDrawables.filter((drawable) => drawable.visible).map((drawable) => drawable.drawableId)
  );
  const gatedDrawList = input.snapshot.drawList.filter((drawableId) =>
    visibleDrawableIds.has(drawableId)
  );

  return {
    ...input.snapshot,
    drawables: gatedDrawables,
    drawList: gatedDrawList
  };
};
