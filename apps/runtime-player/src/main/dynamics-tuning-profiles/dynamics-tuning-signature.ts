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
            scale: input.scale
          }))
          .sort((left, right) =>
            left.parameterId.localeCompare(right.parameterId) ||
            left.kind.localeCompare(right.kind)
          ),
        chain: {
          rootOffset: {
            x: group.chain.rootOffset.x,
            y: group.chain.rootOffset.y
          },
          segmentLengths: [...group.chain.segmentLengths],
          damping: group.chain.damping,
          gravityScale: group.chain.gravityScale
        },
        outputs: group.outputs
          .map((output) => ({
            parameterId: output.parameterId,
            segmentIndex: output.segmentIndex,
            scale: output.scale,
            limit: output.limit
          }))
          .sort((left, right) =>
            left.parameterId.localeCompare(right.parameterId) ||
            left.segmentIndex - right.segmentIndex
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
