import type {
  RuntimeExportDynamicsGroupDto,
  RuntimeExportModelDto
} from "@private-2d-rigging-lab/package-format";

import type {
  RuntimePlayerDynamicsTuningGroupOverride,
  RuntimePlayerEffectiveDynamicsTuningProfile
} from "../../preload/dynamics-tuning-bridge-contract";

export function createEffectiveRuntimeExportDynamicsGroups(input: {
  readonly model: RuntimeExportModelDto;
  readonly effectiveDynamicsTuning?:
    RuntimePlayerEffectiveDynamicsTuningProfile | null;
}): readonly RuntimeExportDynamicsGroupDto[] {
  const tuning = input.effectiveDynamicsTuning;
  if (tuning === undefined || tuning === null) {
    return input.model.dynamicsGroups.map(cloneDynamicsGroup);
  }

  return input.model.dynamicsGroups.map((group) =>
    applyDynamicsTuningToGroup(group, tuning.groups[group.dynamicsGroupId])
  );
}

export function createEffectiveDynamicsTuningCacheKey(
  tuning: RuntimePlayerEffectiveDynamicsTuningProfile | null | undefined
): unknown {
  if (tuning === undefined || tuning === null) {
    return {
      state: "none"
    };
  }

  return {
    state: "ready",
    revision: tuning.revision,
    fingerprint: tuning.fingerprint,
    dynamicsSignatureHash: tuning.dynamicsSignatureHash
  };
}

function applyDynamicsTuningToGroup(
  group: RuntimeExportDynamicsGroupDto,
  override: RuntimePlayerDynamicsTuningGroupOverride | undefined
): RuntimeExportDynamicsGroupDto {
  if (override === undefined) {
    return cloneDynamicsGroup(group);
  }

  return {
    ...group,
    enabled: override.enabled ?? group.enabled,
    inputs: group.inputs.map((input) => ({
      ...input,
      normalization: { ...input.normalization }
    })),
    pendulums: group.pendulums.map((pendulum) => ({
      ...pendulum,
      length: override.length ?? pendulum.length,
      sway: override.sway ?? pendulum.sway,
      reactionSpeed: override.reactionSpeed ?? pendulum.reactionSpeed,
      convergenceSpeed:
        override.convergenceSpeed ?? pendulum.convergenceSpeed
    })),
    outputs: group.outputs.map((output) => ({
      ...output,
      strength: override.strength ?? output.strength,
      limit: override.limit ?? output.limit
    }))
  };
}

function cloneDynamicsGroup(
  group: RuntimeExportDynamicsGroupDto
): RuntimeExportDynamicsGroupDto {
  return {
    ...group,
    inputs: group.inputs.map((input) => ({
      ...input,
      normalization: { ...input.normalization }
    })),
    pendulums: group.pendulums.map((pendulum) => ({ ...pendulum })),
    outputs: group.outputs.map((output) => ({ ...output }))
  };
}
