import type { NormalizedParameter } from "@private-2d-rigging-lab/runtime-core";

import type { AuthoringGraph } from "./authoring-graph.js";

export const createRuntimeParameterMap = (
  graph: AuthoringGraph
): ReadonlyMap<NormalizedParameter["id"], NormalizedParameter> =>
  new Map(
    graph.parameters.map((parameter) => [
      parameter.parameterId,
      {
        id: parameter.parameterId,
        displayName: parameter.displayName,
        ...(parameter.semanticRole === undefined ? {} : { semanticRole: parameter.semanticRole }),
        ...(parameter.projectPresetAlias === undefined ? {} : { projectPresetAlias: parameter.projectPresetAlias }),
        valueSource: parameter.valueSource,
        min: parameter.min,
        max: parameter.max,
        default: parameter.default
      }
    ])
  );
