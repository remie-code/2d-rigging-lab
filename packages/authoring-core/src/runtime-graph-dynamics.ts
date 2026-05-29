import type {
  NormalizedDynamicsSettings,
  NormalizedRuntimeGraph
} from "@private-2d-rigging-lab/runtime-core";
import type { DynamicsGroupDto } from "@private-2d-rigging-lab/package-format";

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
        solverKind: group.solverKind,
        drivers: group.drivers.map((driver) => ({
          driverId: driver.driverId,
          sourceParameterId: driver.sourceParameterId,
          inputScale: driver.inputScale,
          inputOffset: driver.inputOffset,
          invert: driver.invert
        })),
        output: {
          outputId: group.output.outputId,
          targetParameterId: group.output.targetParameterId,
          outputScale: group.output.outputScale,
          outputOffset: group.output.outputOffset,
          min: group.output.min,
          max: group.output.max,
          clampPolicy: group.output.clampPolicy
        },
        settings: cloneDefinedSettings(group.settings),
        resetPolicy: group.resetPolicy
      }
    ])
  );

const cloneDefinedSettings = (settings: DynamicsGroupDto["settings"]): NormalizedDynamicsSettings => {
  const cloned: NormalizedDynamicsSettings = {
    stiffness: settings.stiffness,
    damping: settings.damping
  };

  if (settings.maxVelocity !== undefined) {
    return settings.maxAmplitude === undefined
      ? { ...cloned, maxVelocity: settings.maxVelocity }
      : { ...cloned, maxVelocity: settings.maxVelocity, maxAmplitude: settings.maxAmplitude };
  }

  return settings.maxAmplitude === undefined ? cloned : { ...cloned, maxAmplitude: settings.maxAmplitude };
};
