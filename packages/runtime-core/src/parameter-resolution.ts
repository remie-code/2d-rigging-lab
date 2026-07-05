import type {
  ParameterId,
  RuntimeStateDto
} from "@private-2d-rigging-lab/contracts";

import type {
  NormalizedDynamicsGroup,
  NormalizedParameter,
  NormalizedRuntimeGraph
} from "./normalized-runtime-graph.js";
import { getDynamicsOutputOffsetForParameter } from "./dynamics-evaluation.js";

export type ResolvedParameterSource =
  | "default"
  | "viewerOverride"
  | "editorPreviewOverride"
  | "operationDryRun"
  | "dynamicsAdditive"
  | "debugOverride";

export interface ResolvedParameterValue {
  readonly parameterId: ParameterId;
  readonly valueSource: NormalizedParameter["valueSource"];
  readonly authoredValue?: number;
  readonly baseValue: number;
  readonly dynamicsOffset?: number;
  readonly effectiveValue: number;
  readonly clamped: boolean;
  readonly source: ResolvedParameterSource;
}

export interface EffectiveParameterResolution {
  readonly values: readonly ResolvedParameterValue[];
  readonly effectiveParameterValues: ReadonlyMap<ParameterId, number>;
}

export const resolveEffectiveParameterValues = (input: {
  readonly graph: NormalizedRuntimeGraph;
  readonly authoredParameterValues: Readonly<Record<string, number>>;
  readonly state: RuntimeStateDto;
}): EffectiveParameterResolution => {
  const enabledDynamicsByOutputParameterId = createEnabledDynamicsByOutputParameterId(input.graph);
  const values = [...input.graph.parameters.values()].map((parameter): ResolvedParameterValue => {
    const authoredValue = input.authoredParameterValues[parameter.id];
    const authoredOrDefault = authoredValue ?? parameter.default;
    const baseValue = clamp(authoredOrDefault, parameter.min, parameter.max);
    const dynamicsGroup = enabledDynamicsByOutputParameterId.get(parameter.id);
    const outputOffset = dynamicsGroup === undefined
      ? undefined
      : getDynamicsOutputOffsetForParameter(
        input.graph,
        dynamicsGroup,
        input.state.dynamicsGroups[dynamicsGroup.dynamicsGroupId],
        input.authoredParameterValues,
        parameter.id
      );
    const rawEffectiveValue = baseValue + (outputOffset?.offset ?? 0);
    const effectiveValue = clamp(rawEffectiveValue, parameter.min, parameter.max);

    return {
      parameterId: parameter.id,
      valueSource: parameter.valueSource,
      ...(authoredValue === undefined ? {} : { authoredValue }),
      baseValue,
      ...(outputOffset === undefined ? {} : { dynamicsOffset: outputOffset.offset }),
      effectiveValue,
      clamped: authoredOrDefault !== baseValue || rawEffectiveValue !== effectiveValue || outputOffset?.outputClamped === true,
      source:
        outputOffset !== undefined
          ? "dynamicsAdditive"
          : authoredValue === undefined
            ? "default"
            : "viewerOverride"
    };
  });

  return {
    values,
    effectiveParameterValues: new Map(values.map((value) => [value.parameterId, value.effectiveValue]))
  };
};

// Routes each output parameter to the dynamics group that drives it. dynamics-file-v3 allows
// multiple outputs per group (§4, segmentIndex-keyed), so every output is indexed (not just the
// first). A parameter driven by more than one enabled output — across or within groups — is treated
// as ambiguous and dropped (the additive-composition arithmetic downstream is unchanged).
const createEnabledDynamicsByOutputParameterId = (
  graph: NormalizedRuntimeGraph
): ReadonlyMap<ParameterId, NormalizedDynamicsGroup> => {
  const groupsByParameterId = new Map<ParameterId, NormalizedDynamicsGroup>();
  const duplicateParameterIds = new Set<ParameterId>();

  for (const group of graph.dynamicsGroups.values()) {
    if (!group.enabled) {
      continue;
    }

    for (const output of group.outputs) {
      if (duplicateParameterIds.has(output.parameterId)) {
        continue;
      }

      if (groupsByParameterId.has(output.parameterId)) {
        groupsByParameterId.delete(output.parameterId);
        duplicateParameterIds.add(output.parameterId);
        continue;
      }

      groupsByParameterId.set(output.parameterId, group);
    }
  }

  return groupsByParameterId;
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
