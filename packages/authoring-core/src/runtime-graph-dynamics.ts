import type { NormalizedRuntimeGraph } from "@private-2d-rigging-lab/runtime-core";

import type { AuthoringGraph } from "./authoring-graph.js";

export const createRuntimeDynamicsGroupMap = (
  graph: AuthoringGraph
): NormalizedRuntimeGraph["dynamicsGroups"] =>
  new Map(
    graph.dynamicsGroups.map((group) => [
      group.dynamicsGroupId,
      {
        dynamicsGroupId: group.dynamicsGroupId,
        displayName: group.displayName,
        enabled: group.enabled,
        ...(group.presetId === undefined ? {} : { presetId: group.presetId }),
        inputs: group.inputs.map((input) => ({
          parameterId: input.parameterId,
          kind: input.kind,
          influencePercent: input.influencePercent,
          invert: input.invert,
          normalization: {
            min: input.normalization.min,
            center: input.normalization.center,
            max: input.normalization.max
          }
        })),
        pendulums: group.pendulums.map((pendulum) => ({
          length: pendulum.length,
          sway: pendulum.sway,
          reactionSpeed: pendulum.reactionSpeed,
          convergenceSpeed: pendulum.convergenceSpeed
        })),
        outputs: group.outputs.map((output) => ({
          parameterId: output.parameterId,
          kind: output.kind,
          strength: output.strength,
          invert: output.invert,
          limit: output.limit
        }))
      }
    ])
  );
