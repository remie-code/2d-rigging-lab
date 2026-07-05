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

  // dynamics-world-frame-chain.md §9 tuning profile v2 semantics.
  // "Scale"-suffixed knobs (outputScale, lengthScale) are multipliers on the
  // exported values; the rest (limit, damping, gravityScale, enabled) replace.
  const lengthScale = override.lengthScale ?? 1;
  const outputScale = override.outputScale ?? 1;

  return {
    ...group,
    enabled: override.enabled ?? group.enabled,
    inputs: group.inputs.map((input) => ({ ...input })),
    chain: {
      ...group.chain,
      rootOffset: { ...group.chain.rootOffset },
      segmentLengths: group.chain.segmentLengths.map(
        (segmentLength) => segmentLength * lengthScale
      ),
      damping: override.damping ?? group.chain.damping,
      gravityScale: override.gravityScale ?? group.chain.gravityScale
    },
    outputs: group.outputs.map((output) => ({
      ...output,
      scale: output.scale * outputScale,
      limit: override.limit ?? output.limit
    }))
  };
}

function cloneDynamicsGroup(
  group: RuntimeExportDynamicsGroupDto
): RuntimeExportDynamicsGroupDto {
  return {
    ...group,
    inputs: group.inputs.map((input) => ({ ...input })),
    chain: {
      ...group.chain,
      rootOffset: { ...group.chain.rootOffset },
      segmentLengths: [...group.chain.segmentLengths]
    },
    outputs: group.outputs.map((output) => ({ ...output }))
  };
}
