import { cloneAuthoringSession, toRuntimeGraph, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { evaluateViewerRuntimeSnapshot } from "@private-2d-rigging-lab/runtime-core";
/** Reuse runtime hierarchy/disabled-control opacity semantics without adopting evaluated geometry. */
export const materialRestOpacities = (session: AuthoringSession): ReadonlyMap<string, number> => {
  const rest = cloneAuthoringSession(session);
  rest.graph.keyformSets = [];
  rest.graph.dynamicsGroups = [];
  const result = evaluateViewerRuntimeSnapshot(toRuntimeGraph(rest), {
    parameterOverrides: {},
    options: { schemaVersion: "runtime-evaluation-options-v1", snapshotDetail: "full" }
  });
  return new Map(result.snapshot.drawables.map(drawable => [drawable.drawableId, drawable.opacity]));
};
