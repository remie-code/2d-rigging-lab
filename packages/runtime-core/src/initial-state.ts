import type { DynamicsGroupId, RuntimeStateDto } from "@private-2d-rigging-lab/contracts";
import { RuntimeStateDtoSchema } from "@private-2d-rigging-lab/contracts";

import { computeDynamicsTarget } from "./dynamics-evaluation.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import type { RuntimeInitialStateRequestInput } from "./runtime-input.js";
import { RuntimeInitialStateRequestSchema } from "./runtime-input.js";

export { computeDynamicsTarget } from "./dynamics-evaluation.js";

export const createInitialRuntimeState = (
  graph: NormalizedRuntimeGraph,
  requestInput: RuntimeInitialStateRequestInput
): RuntimeStateDto => {
  const request = RuntimeInitialStateRequestSchema.parse(requestInput);
  const dynamicsGroups: Record<string, RuntimeStateDto["dynamicsGroups"][DynamicsGroupId]> = {};

  for (const group of graph.dynamicsGroups.values()) {
    if (!group.enabled) {
      continue;
    }

    const currentTarget = computeDynamicsTarget(graph, group, request.authoredParameterValues);
    dynamicsGroups[group.dynamicsGroupId] = {
      position: currentTarget,
      velocity: 0,
      tick: 0,
      resetCounter: 1
    };
  }

  return RuntimeStateDtoSchema.parse({
    schemaVersion: "runtime-state-v1",
    packageId: request.packageId,
    packageRevision: request.packageRevision,
    ...(request.packageHash === undefined ? {} : { packageHash: request.packageHash }),
    frameIndex: request.frameIndex,
    fixedStepMs: request.fixedStepMs,
    accumulatorMs: 0,
    dynamicsGroups
  });
};
