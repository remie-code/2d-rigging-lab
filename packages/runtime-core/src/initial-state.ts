import type { DynamicsGroupId, RuntimeStateDto } from "@private-2d-rigging-lab/contracts";
import { RuntimeStateDtoSchema } from "@private-2d-rigging-lab/contracts";

import type { NormalizedDynamicsGroup, NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import type { RuntimeInitialStateRequestInput } from "./runtime-input.js";
import { RuntimeInitialStateRequestSchema } from "./runtime-input.js";

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

export const computeDynamicsTarget = (
  graph: NormalizedRuntimeGraph,
  group: NormalizedDynamicsGroup,
  authoredParameterValues: Readonly<Record<string, number>>
): number => {
  const targetInput = group.drivers.reduce((sum, driver) => {
    const sourceParameter = graph.parameters.get(driver.sourceParameterId);
    const defaultValue = sourceParameter?.default ?? 0;
    const authoredValue = authoredParameterValues[driver.sourceParameterId] ?? defaultValue;
    const signedValue = driver.invert ? -authoredValue : authoredValue;
    return sum + signedValue * driver.inputScale + driver.inputOffset;
  }, 0);

  const rawTarget = targetInput * group.output.outputScale + group.output.outputOffset;
  return clamp(rawTarget, group.output.min, group.output.max);
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
