import type {
  ParameterId,
  RuntimeStateDto
} from "@private-2d-rigging-lab/contracts";

import type {
  NormalizedDynamicsGroup,
  NormalizedParameter,
  NormalizedRuntimeGraph
} from "./normalized-runtime-graph.js";

export type ResolvedParameterSource =
  | "default"
  | "viewerOverride"
  | "editorPreviewOverride"
  | "operationDryRun"
  | "dynamicsComputed"
  | "debugOverride";

export interface ResolvedParameterValue {
  readonly parameterId: ParameterId;
  readonly valueSource: NormalizedParameter["valueSource"];
  readonly authoredValue?: number;
  readonly computedValue?: number;
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
    const clampedAuthored = clamp(authoredOrDefault, parameter.min, parameter.max);
    const dynamicsGroup = enabledDynamicsByOutputParameterId.get(parameter.id);
    const computedValue =
      dynamicsGroup === undefined ? undefined : input.state.dynamicsGroups[dynamicsGroup.dynamicsGroupId]?.position;
    const effectiveValue = parameter.valueSource === "computedDynamics" ? computedValue ?? parameter.default : clampedAuthored;

    return {
      parameterId: parameter.id,
      valueSource: parameter.valueSource,
      ...(authoredValue === undefined ? {} : { authoredValue }),
      ...(computedValue === undefined ? {} : { computedValue }),
      effectiveValue,
      clamped: authoredOrDefault !== clampedAuthored,
      source:
        parameter.valueSource === "computedDynamics"
          ? "dynamicsComputed"
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

const createEnabledDynamicsByOutputParameterId = (
  graph: NormalizedRuntimeGraph
): ReadonlyMap<ParameterId, NormalizedDynamicsGroup> => {
  const groupsByParameterId = new Map<ParameterId, NormalizedDynamicsGroup>();

  for (const group of graph.dynamicsGroups.values()) {
    if (!group.enabled || groupsByParameterId.has(group.output.targetParameterId)) {
      continue;
    }

    groupsByParameterId.set(group.output.targetParameterId, group);
  }

  return groupsByParameterId;
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
