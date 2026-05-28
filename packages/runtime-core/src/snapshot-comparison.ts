import type { RuntimeDiffDto } from "@private-2d-rigging-lab/contracts";
import { RuntimeDiffSchema } from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import type { RuntimeSnapshotDto } from "./snapshot.js";

export const SnapshotComparisonPolicySchema = z.object({
  vertexPositionEpsilon: z.number().positive().default(0.0001),
  boundsEpsilon: z.number().positive().default(0.0001),
  opacityEpsilon: z.number().positive().default(0.000001)
});
export type SnapshotComparisonPolicyInput = z.input<typeof SnapshotComparisonPolicySchema>;
export type SnapshotComparisonPolicy = z.infer<typeof SnapshotComparisonPolicySchema>;

export interface RuntimeComparisonResult {
  readonly equivalent: boolean;
  readonly diff: RuntimeDiffDto;
}

export const compareRuntimeSnapshots = (
  before: RuntimeSnapshotDto,
  after: RuntimeSnapshotDto,
  policyInput: SnapshotComparisonPolicyInput = {}
): RuntimeComparisonResult => {
  const policy = SnapshotComparisonPolicySchema.parse(policyInput);
  const parameterChanges = after.parameters.flatMap((afterParameter) => {
    const beforeParameter = before.parameters.find((parameter) => parameter.parameterId === afterParameter.parameterId);
    if (beforeParameter === undefined || Math.abs(beforeParameter.effectiveValue - afterParameter.effectiveValue) <= policy.opacityEpsilon) {
      return [];
    }

    return [
      {
        path: `/parameters/${afterParameter.parameterId}/effectiveValue`,
        before: beforeParameter.effectiveValue,
        after: afterParameter.effectiveValue
      }
    ];
  });
  const dynamicsChanges = after.dynamics.flatMap((afterDynamics) => {
    const beforeDynamics = before.dynamics.find((dynamics) => dynamics.dynamicsGroupId === afterDynamics.dynamicsGroupId);
    if (beforeDynamics === undefined) {
      return [];
    }

    const stateChanged =
      beforeDynamics.stateSummary.position !== afterDynamics.stateSummary.position ||
      beforeDynamics.stateSummary.velocity !== afterDynamics.stateSummary.velocity ||
      beforeDynamics.tick !== afterDynamics.tick ||
      beforeDynamics.resetCounter !== afterDynamics.resetCounter;
    const outputChanged = beforeDynamics.outputValue !== afterDynamics.outputValue;

    if (!stateChanged && !outputChanged) {
      return [];
    }

    return [
      {
        dynamicsGroupId: afterDynamics.dynamicsGroupId,
        outputParameterId: afterDynamics.outputParameterId,
        stateChanged,
        outputChanged,
        positionBefore: beforeDynamics.stateSummary.position,
        positionAfter: afterDynamics.stateSummary.position,
        velocityBefore: beforeDynamics.stateSummary.velocity,
        velocityAfter: afterDynamics.stateSummary.velocity,
        tickBefore: beforeDynamics.tick,
        tickAfter: afterDynamics.tick,
        resetCounterBefore: beforeDynamics.resetCounter,
        resetCounterAfter: afterDynamics.resetCounter
      }
    ];
  });
  const drawableChanges = after.drawables.flatMap((afterDrawable) => {
    const beforeDrawable = before.drawables.find((drawable) => drawable.drawableId === afterDrawable.drawableId);
    if (
      beforeDrawable === undefined ||
      (beforeDrawable.vertexHash === afterDrawable.vertexHash &&
        Math.abs(beforeDrawable.bounds.x - afterDrawable.bounds.x) <= policy.boundsEpsilon &&
        Math.abs(beforeDrawable.bounds.y - afterDrawable.bounds.y) <= policy.boundsEpsilon &&
        Math.abs(beforeDrawable.bounds.width - afterDrawable.bounds.width) <= policy.boundsEpsilon &&
        Math.abs(beforeDrawable.bounds.height - afterDrawable.bounds.height) <= policy.boundsEpsilon)
    ) {
      return [];
    }

    return [
      {
        drawableId: afterDrawable.drawableId,
        boundsChanged: true,
        vertexHashBefore: beforeDrawable.vertexHash,
        vertexHashAfter: afterDrawable.vertexHash
      }
    ];
  });
  const diff = RuntimeDiffSchema.parse({
    schemaVersion: "runtime-diff-v1",
    beforeSnapshotId: before.snapshotId,
    afterSnapshotId: after.snapshotId,
    parameterChanges,
    dynamicsChanges,
    drawableChanges,
    diagnosticDelta: after.diagnostics
  });

  return {
    equivalent:
      diff.parameterChanges.length === 0 &&
      diff.dynamicsChanges.length === 0 &&
      diff.drawableChanges.length === 0 &&
      diff.diagnosticDelta.length === 0,
    diff
  };
};
