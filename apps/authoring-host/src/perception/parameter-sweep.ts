import type { NormalizedRuntimeGraph } from "@private-2d-rigging-lab/runtime-core";

/**
 * Parameter sweep sampling (Wave104 Domain A, §3.2).
 *
 * Produces the deterministic sequence of swept parameter values from a
 * parameter's declared [min, max] range. `steps` samples are evenly spaced and
 * include both endpoints (steps>=2 enforced by the payload schema).
 */

export class ParameterSweepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParameterSweepError";
  }
}

export interface SweptParameterValue {
  readonly index: number;
  readonly value: number;
}

export const computeSweptParameterValues = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly parameterId: string;
  readonly steps: number;
}): readonly SweptParameterValue[] => {
  const parameter = [...input.graph.parameters.values()].find(
    (entry) => entry.id === input.parameterId
  );
  if (parameter === undefined) {
    throw new ParameterSweepError(
      `Cannot sweep parameter "${input.parameterId}": it is not defined in the model.`
    );
  }

  const { min, max } = parameter;
  const span = max - min;

  return Array.from({ length: input.steps }, (_unused, index) => ({
    index,
    // steps>=2 so the divisor is >=1; endpoints are exact min and max.
    value: min + (span * index) / (input.steps - 1)
  }));
};
