import type { NormalizedRuntimeGraph } from "@private-2d-rigging-lab/runtime-core";

import type { AuthoringGraph } from "./authoring-graph.js";

// dynamics-file-v3 world-frame chain. DTO → Normalized projection (see
// discussion/design/dynamics-world-frame-chain.md §4). The mapping is a straight structural copy:
// inputs carry a single signed `scale`, the chain replaces the old pendulums array, and outputs
// read one chain segment (`segmentIndex`) with a signed `scale` and clamp `limit`.
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
          scale: input.scale
        })),
        chain: {
          rootOffset: { x: group.chain.rootOffset.x, y: group.chain.rootOffset.y },
          segmentLengths: [...group.chain.segmentLengths],
          damping: group.chain.damping,
          gravityScale: group.chain.gravityScale
        },
        outputs: group.outputs.map((output) => ({
          parameterId: output.parameterId,
          segmentIndex: output.segmentIndex,
          scale: output.scale,
          limit: output.limit
        }))
      }
    ])
  );
