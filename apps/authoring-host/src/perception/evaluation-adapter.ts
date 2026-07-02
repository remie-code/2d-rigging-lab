import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { toRuntimeGraph } from "@private-2d-rigging-lab/authoring-core";
import type {
  NormalizedRuntimeGraph,
  RuntimeSnapshotDto,
  ViewerParameterOverrideInput
} from "@private-2d-rigging-lab/runtime-core";
import { evaluateViewerRuntimeSnapshot } from "@private-2d-rigging-lab/runtime-core";

/**
 * Perception evaluation adapter (Wave104 Domain A).
 *
 * Bridges a live AuthoringSession to a runtime-core evaluated snapshot WITHOUT
 * going through Runtime Export (forbidden as a perception middle stage): the
 * session is converted to a NormalizedRuntimeGraph via authoring-core's
 * Export-free `toRuntimeGraph`, then evaluated by runtime-core.
 *
 * The runtime-core evaluator is the perception oracle (L0 decision 3.1-1): the
 * Fable eye sees "what the model is at runtime" (Player semantics), not the
 * editor canvas.
 */

export interface EvaluatedPerceptionSnapshot {
  readonly graph: NormalizedRuntimeGraph;
  readonly snapshot: RuntimeSnapshotDto;
}

export interface EvaluatePerceptionSnapshotOptions {
  readonly parameterOverrides?: ViewerParameterOverrideInput;
}

/**
 * Evaluate the session at rest pose (or with the given parameter overrides) and
 * return the runtime graph plus a `full`-detail snapshot. `full` detail is
 * required so evaluated per-drawable `vertices` are present for RenderScene
 * construction (summary/targeted omit them).
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
    snapshot: result.snapshot
  };
};
