import type { RuntimeExportParameterDto } from "@private-2d-rigging-lab/package-format";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingTarget
} from "../../preload/model-mapping-bridge-contract";
import { semanticSlotDefinitions } from "./semantic-slot-definitions";

export function createAutoMappingSlots(
  payload: RuntimeExportLoadedPayload
): readonly RuntimePlayerMappingSlot[] {
  const directTargets = createDirectTargetCandidates(payload);

  return semanticSlotDefinitions.map((definition) => {
    const target = findTargetForDefinition(directTargets, {
      alias: definition.targetAlias,
      displayName: definition.targetDisplayName
    });

    return {
      slotId: definition.slotId,
      label: definition.label,
      group: definition.group,
      target,
      enabled: target !== null,
      invert: definition.defaultInvert,
      strength: 1,
      status: target === null ? "missing-target" : "mapped",
      warningMessages: target === null
        ? [`Missing external-input target for ${definition.targetDisplayName}.`]
        : []
    };
  });
}

function createDirectTargetCandidates(
  payload: RuntimeExportLoadedPayload
): readonly RuntimePlayerMappingTarget[] {
  const manifest = payload.artifacts.model.inputManifest;
  const externalIds = new Set(manifest.externalInputParameterIds);
  const computedIds = new Set(manifest.computedDynamicsOutputParameterIds);
  const hiddenIds = new Set(manifest.hiddenDirectControlParameterIds);

  return payload.artifacts.model.parameters
    .filter((parameter) =>
      isDirectExternalInputParameter(parameter, {
        externalIds,
        computedIds,
        hiddenIds
      })
    )
    .map(toMappingTarget);
}

function isDirectExternalInputParameter(
  parameter: RuntimeExportParameterDto,
  input: {
    readonly externalIds: ReadonlySet<string>;
    readonly computedIds: ReadonlySet<string>;
    readonly hiddenIds: ReadonlySet<string>;
  }
): boolean {
  return (
    parameter.runtimeRole === "external-input" &&
    parameter.externalInput &&
    !parameter.readOnly &&
    parameter.valueSource === "authoredInput" &&
    input.externalIds.has(parameter.parameterId) &&
    !input.computedIds.has(parameter.parameterId) &&
    !input.hiddenIds.has(parameter.parameterId)
  );
}

function toMappingTarget(
  parameter: RuntimeExportParameterDto
): RuntimePlayerMappingTarget {
  return {
    parameterId: parameter.parameterId,
    displayName: parameter.displayName,
    ...(parameter.projectPresetAlias === undefined
      ? {}
      : { projectPresetAlias: parameter.projectPresetAlias }),
    min: parameter.min,
    max: parameter.max,
    default: parameter.default
  };
}

function findTargetForDefinition(
  targets: readonly RuntimePlayerMappingTarget[],
  input: {
    readonly alias: string;
    readonly displayName: string;
  }
): RuntimePlayerMappingTarget | null {
  const aliasMatch = targets.find((target) =>
    target.projectPresetAlias === input.alias
  );

  if (aliasMatch !== undefined) {
    return aliasMatch;
  }

  const normalizedDisplayName = normalizeDisplayName(input.displayName);
  return targets.find((target) =>
    normalizeDisplayName(target.displayName) === normalizedDisplayName
  ) ?? null;
}

function normalizeDisplayName(value: string): string {
  return value.trim().toLocaleLowerCase();
}
