import type { RuntimeDiffDto } from "@private-2d-rigging-lab/contracts";
import { RuntimeDiffSchema } from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import type { EvaluatedDrawableDto, RuntimeSnapshotDto } from "./snapshot.js";

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
  const beforeDrawablesById = new Map(before.drawables.map((drawable) => [drawable.drawableId, drawable]));
  const beforeDynamicsById = new Map(before.dynamics.map((dynamics) => [dynamics.dynamicsGroupId, dynamics]));
  const afterDynamicsById = new Map(after.dynamics.map((dynamics) => [dynamics.dynamicsGroupId, dynamics]));
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
  const dynamicsChanges = [
    ...after.dynamics.flatMap((afterDynamics) => {
      const beforeDynamics = beforeDynamicsById.get(afterDynamics.dynamicsGroupId);
      if (beforeDynamics === undefined) {
        return [
          {
            dynamicsGroupId: afterDynamics.dynamicsGroupId,
            outputParameterId: afterDynamics.outputParameterId,
            stateChanged: true,
            outputChanged: true,
            positionAfter: afterDynamics.stateSummary.position,
            velocityAfter: afterDynamics.stateSummary.velocity,
            tickAfter: afterDynamics.tick,
            resetCounterAfter: afterDynamics.resetCounter
          }
        ];
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
    }),
    ...before.dynamics.flatMap((beforeDynamics) => {
      if (afterDynamicsById.has(beforeDynamics.dynamicsGroupId)) {
        return [];
      }

      return [
        {
          dynamicsGroupId: beforeDynamics.dynamicsGroupId,
          outputParameterId: beforeDynamics.outputParameterId,
          stateChanged: true,
          outputChanged: true,
          positionBefore: beforeDynamics.stateSummary.position,
          velocityBefore: beforeDynamics.stateSummary.velocity,
          tickBefore: beforeDynamics.tick,
          resetCounterBefore: beforeDynamics.resetCounter
        }
      ];
    })
  ];
  const drawableChanges = after.drawables.flatMap((afterDrawable) => {
    const beforeDrawable = beforeDrawablesById.get(afterDrawable.drawableId);
    const boundsChanged =
      beforeDrawable !== undefined &&
      (Math.abs(beforeDrawable.bounds.x - afterDrawable.bounds.x) > policy.boundsEpsilon ||
        Math.abs(beforeDrawable.bounds.y - afterDrawable.bounds.y) > policy.boundsEpsilon ||
        Math.abs(beforeDrawable.bounds.width - afterDrawable.bounds.width) > policy.boundsEpsilon ||
        Math.abs(beforeDrawable.bounds.height - afterDrawable.bounds.height) > policy.boundsEpsilon);
    const runtimeStateChanged =
      beforeDrawable !== undefined && drawableRuntimeStateChanged(beforeDrawable, afterDrawable, policy);
    if (beforeDrawable === undefined) {
      return [
        {
          drawableId: afterDrawable.drawableId,
          boundsChanged: false,
          vertexHashAfter: afterDrawable.vertexHash
        }
      ];
    }

    if (beforeDrawable.vertexHash === afterDrawable.vertexHash && !boundsChanged && !runtimeStateChanged) {
      return [];
    }

    return [
      {
        drawableId: afterDrawable.drawableId,
        boundsChanged,
        vertexHashBefore: beforeDrawable.vertexHash,
        vertexHashAfter: afterDrawable.vertexHash
      }
    ];
  });
  const drawableRuntimeStateChanges = after.drawables.flatMap((afterDrawable) => {
    const beforeDrawable = beforeDrawablesById.get(afterDrawable.drawableId);
    if (beforeDrawable === undefined || !drawableRuntimeStateChanged(beforeDrawable, afterDrawable, policy)) {
      return [];
    }

    return [
      {
        drawableId: afterDrawable.drawableId,
        opacityBefore: beforeDrawable.opacity,
        opacityAfter: afterDrawable.opacity,
        visibleBefore: beforeDrawable.visible,
        visibleAfter: afterDrawable.visible,
        baseDrawOrderBefore: beforeDrawable.baseDrawOrder,
        baseDrawOrderAfter: afterDrawable.baseDrawOrder,
        evaluatedDrawOrderBefore: beforeDrawable.evaluatedDrawOrder,
        evaluatedDrawOrderAfter: afterDrawable.evaluatedDrawOrder
      }
    ];
  });
  const drawListChanges = createDrawListChanges(before.drawList, after.drawList);
  const drawListParameterChanges = drawListChanges.map((change) => ({
    path: "/drawList",
    before: change.before,
    after: change.after
  }));
  const diff = RuntimeDiffSchema.parse({
    schemaVersion: "runtime-diff-v1",
    beforeSnapshotId: before.snapshotId,
    afterSnapshotId: after.snapshotId,
    parameterChanges: [...parameterChanges, ...drawListParameterChanges],
    dynamicsChanges,
    drawableChanges,
    drawableRuntimeStateChanges,
    drawListChanges,
    diagnosticDelta: after.diagnostics
  });

  return {
    equivalent:
      diff.parameterChanges.length === 0 &&
      diff.dynamicsChanges.length === 0 &&
      diff.drawableChanges.length === 0 &&
      diff.drawableRuntimeStateChanges.length === 0 &&
      diff.drawListChanges.length === 0 &&
      diff.diagnosticDelta.length === 0,
    diff
  };
};

const drawableRuntimeStateChanged = (
  beforeDrawable: EvaluatedDrawableDto,
  afterDrawable: EvaluatedDrawableDto,
  policy: SnapshotComparisonPolicy
): boolean =>
  Math.abs(beforeDrawable.opacity - afterDrawable.opacity) > policy.opacityEpsilon ||
  beforeDrawable.visible !== afterDrawable.visible ||
  beforeDrawable.baseDrawOrder !== afterDrawable.baseDrawOrder ||
  beforeDrawable.evaluatedDrawOrder !== afterDrawable.evaluatedDrawOrder;

const createDrawListChanges = (
  beforeDrawList: RuntimeSnapshotDto["drawList"],
  afterDrawList: RuntimeSnapshotDto["drawList"]
) => {
  if (sameDrawList(beforeDrawList, afterDrawList)) {
    return [];
  }

  return [
    {
      before: beforeDrawList,
      after: afterDrawList,
      membershipChanged: drawListMembershipChanged(beforeDrawList, afterDrawList),
      orderChanged: retainedDrawListOrderChanged(beforeDrawList, afterDrawList),
      positionChanges: createDrawListPositionChanges(beforeDrawList, afterDrawList)
    }
  ];
};

const sameDrawList = (
  beforeDrawList: RuntimeSnapshotDto["drawList"],
  afterDrawList: RuntimeSnapshotDto["drawList"]
): boolean =>
  beforeDrawList.length === afterDrawList.length &&
  beforeDrawList.every((drawableId, index) => drawableId === afterDrawList[index]);

const drawListMembershipChanged = (
  beforeDrawList: RuntimeSnapshotDto["drawList"],
  afterDrawList: RuntimeSnapshotDto["drawList"]
): boolean => {
  const beforeDrawableIds = new Set(beforeDrawList);
  const afterDrawableIds = new Set(afterDrawList);
  return (
    beforeDrawableIds.size !== afterDrawableIds.size ||
    beforeDrawList.some((drawableId) => !afterDrawableIds.has(drawableId)) ||
    afterDrawList.some((drawableId) => !beforeDrawableIds.has(drawableId))
  );
};

const retainedDrawListOrderChanged = (
  beforeDrawList: RuntimeSnapshotDto["drawList"],
  afterDrawList: RuntimeSnapshotDto["drawList"]
): boolean => {
  const beforeDrawableIds = new Set(beforeDrawList);
  const afterDrawableIds = new Set(afterDrawList);
  const retainedBefore = beforeDrawList.filter((drawableId) => afterDrawableIds.has(drawableId));
  const retainedAfter = afterDrawList.filter((drawableId) => beforeDrawableIds.has(drawableId));
  return !sameDrawList(retainedBefore, retainedAfter);
};

const createDrawListPositionChanges = (
  beforeDrawList: RuntimeSnapshotDto["drawList"],
  afterDrawList: RuntimeSnapshotDto["drawList"]
) => {
  const beforeIndexes = new Map(beforeDrawList.map((drawableId, index) => [drawableId, index]));
  const afterIndexes = new Map(afterDrawList.map((drawableId, index) => [drawableId, index]));
  const orderedDrawableIds = uniqueInOrder([...beforeDrawList, ...afterDrawList]);

  return orderedDrawableIds.flatMap((drawableId) => {
    const beforeIndex = beforeIndexes.get(drawableId);
    const afterIndex = afterIndexes.get(drawableId);
    if (beforeIndex === afterIndex) {
      return [];
    }

    return [
      {
        drawableId,
        ...(beforeIndex === undefined ? {} : { beforeIndex }),
        ...(afterIndex === undefined ? {} : { afterIndex })
      }
    ];
  });
};

const uniqueInOrder = <T>(values: readonly T[]): T[] => {
  const seen = new Set<T>();
  return values.filter((value) => {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};
