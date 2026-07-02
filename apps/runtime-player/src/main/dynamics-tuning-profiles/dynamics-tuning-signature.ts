import { createHash } from "node:crypto";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";

export function createDynamicsTuningSignatureHash(
  payload: RuntimeExportLoadedPayload
): string {
  const model = payload.artifacts.model;
  const signature = {
    solver: {
      solverVersion: model.dynamicsSolver.solverVersion,
      fixedStepMs: model.dynamicsSolver.fixedStepMs,
      resetPolicy: model.dynamicsSolver.resetPolicy
    },
    groups: model.dynamicsGroups
      .map((group) => ({
        dynamicsGroupId: group.dynamicsGroupId,
        inputs: group.inputs
          .map((input) => ({
            parameterId: input.parameterId,
            kind: input.kind,
            influencePercent: input.influencePercent,
            invert: input.invert,
            normalization: {
              min: input.normalization.min,
              max: input.normalization.max,
              center: input.normalization.center
            }
          }))
          .sort((left, right) =>
            left.parameterId.localeCompare(right.parameterId) ||
            left.kind.localeCompare(right.kind)
          ),
        pendulumCount: group.pendulums.length,
        outputs: group.outputs
          .map((output) => ({
            parameterId: output.parameterId,
            kind: output.kind,
            invert: output.invert
          }))
          .sort((left, right) =>
            left.parameterId.localeCompare(right.parameterId) ||
            left.kind.localeCompare(right.kind)
          )
      }))
      .sort((left, right) =>
        left.dynamicsGroupId.localeCompare(right.dynamicsGroupId)
      )
  };

  return `sha256:${sha256Hex(JSON.stringify(signature))}`;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
