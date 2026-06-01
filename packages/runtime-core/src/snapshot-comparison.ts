import type { RuntimeDiffDto } from "@private-2d-rigging-lab/contracts";
import { RuntimeDiffSchema } from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import {
  createMaskRelationChanges
} from "./mask-relation-evidence.js";
import {
  createDrawableLayerChanges,
  createPartHierarchyChanges
} from "./layer-tree-evidence.js";
import type { EvaluatedDrawableDto, RuntimeSnapshotDto } from "./snapshot.js";

type RuntimeFieldChange = {
  readonly path: string;
  readonly before: unknown;
  readonly after: unknown;
};

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
  const beforeRigControlsById = new Map(before.rigControls.map((rigControl) => [rigControl.rigControlId, rigControl]));
  const afterRigControlsById = new Map(after.rigControls.map((rigControl) => [rigControl.rigControlId, rigControl]));
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
  const maskRelationChanges = createMaskRelationChanges(before.masks, after.masks);
  const partHierarchyChanges = createPartHierarchyChanges(before.parts, after.parts);
  const drawableLayerChanges = createDrawableLayerChanges(before.drawables, after.drawables);
  const rigControlChanges: RuntimeFieldChange[] = [
    ...after.rigControls.flatMap((afterRigControl) => {
      const beforeRigControl = beforeRigControlsById.get(afterRigControl.rigControlId);
      if (beforeRigControl === undefined) {
        return [
          {
            path: `/rigControls/${afterRigControl.rigControlId}`,
            before: null,
            after: summarizeRigControlForDiff(afterRigControl)
          }
        ];
      }

      return createRigControlFieldChanges(beforeRigControl, afterRigControl);
    }),
    ...before.rigControls.flatMap((beforeRigControl) => {
      if (afterRigControlsById.has(beforeRigControl.rigControlId)) {
        return [];
      }

      return [
        {
          path: `/rigControls/${beforeRigControl.rigControlId}`,
          before: summarizeRigControlForDiff(beforeRigControl),
          after: null
        }
      ];
    })
  ];
  const diff = RuntimeDiffSchema.parse({
    schemaVersion: "runtime-diff-v1",
    beforeSnapshotId: before.snapshotId,
    afterSnapshotId: after.snapshotId,
    parameterChanges: [
      ...parameterChanges,
      ...maskRelationChanges,
      ...partHierarchyChanges,
      ...drawableLayerChanges,
      ...rigControlChanges,
      ...drawListParameterChanges
    ],
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

type ComparableRigControl = RuntimeSnapshotDto["rigControls"][number];

const createRigControlFieldChanges = (
  beforeRigControl: ComparableRigControl,
  afterRigControl: ComparableRigControl
): RuntimeFieldChange[] => {
  const changes: RuntimeFieldChange[] = [];

  if (beforeRigControl.evaluationStatus !== afterRigControl.evaluationStatus) {
    changes.push({
      path: `/rigControls/${afterRigControl.rigControlId}/evaluationStatus`,
      before: beforeRigControl.evaluationStatus,
      after: afterRigControl.evaluationStatus
    });
  }

  if (beforeRigControl.hierarchyIndex !== afterRigControl.hierarchyIndex) {
    changes.push({
      path: `/rigControls/${afterRigControl.rigControlId}/hierarchyIndex`,
      before: beforeRigControl.hierarchyIndex,
      after: afterRigControl.hierarchyIndex
    });
  }

  if (beforeRigControl.localTransform?.angleDegrees !== afterRigControl.localTransform?.angleDegrees) {
    changes.push({
      path: `/rigControls/${afterRigControl.rigControlId}/localTransform/angleDegrees`,
      before: beforeRigControl.localTransform?.angleDegrees ?? null,
      after: afterRigControl.localTransform?.angleDegrees ?? null
    });
  }

  if (!sameJsonValue(beforeRigControl.localTransform?.translation, afterRigControl.localTransform?.translation)) {
    changes.push({
      path: `/rigControls/${afterRigControl.rigControlId}/localTransform/translation`,
      before: beforeRigControl.localTransform?.translation ?? null,
      after: afterRigControl.localTransform?.translation ?? null
    });
  }

  if (!sameJsonValue(beforeRigControl.localTransform?.scale, afterRigControl.localTransform?.scale)) {
    changes.push({
      path: `/rigControls/${afterRigControl.rigControlId}/localTransform/scale`,
      before: beforeRigControl.localTransform?.scale ?? null,
      after: afterRigControl.localTransform?.scale ?? null
    });
  }

  if (!sameJsonValue(beforeRigControl.localTransform?.matrix, afterRigControl.localTransform?.matrix)) {
    changes.push({
      path: `/rigControls/${afterRigControl.rigControlId}/localTransform/matrix`,
      before: beforeRigControl.localTransform?.matrix ?? null,
      after: afterRigControl.localTransform?.matrix ?? null
    });
  }

  if (!sameJsonValue(beforeRigControl.worldTransform?.matrix, afterRigControl.worldTransform?.matrix)) {
    changes.push({
      path: `/rigControls/${afterRigControl.rigControlId}/worldTransform/matrix`,
      before: beforeRigControl.worldTransform?.matrix ?? null,
      after: afterRigControl.worldTransform?.matrix ?? null
    });
  }

  if (beforeRigControl.worldTransform?.angleDegrees !== afterRigControl.worldTransform?.angleDegrees) {
    changes.push({
      path: `/rigControls/${afterRigControl.rigControlId}/worldTransform/angleDegrees`,
      before: beforeRigControl.worldTransform?.angleDegrees ?? null,
      after: afterRigControl.worldTransform?.angleDegrees ?? null
    });
  }

  if (!sameJsonValue(beforeRigControl.worldTransform?.translation, afterRigControl.worldTransform?.translation)) {
    changes.push({
      path: `/rigControls/${afterRigControl.rigControlId}/worldTransform/translation`,
      before: beforeRigControl.worldTransform?.translation ?? null,
      after: afterRigControl.worldTransform?.translation ?? null
    });
  }

  if (!sameJsonValue(beforeRigControl.worldTransform?.scale, afterRigControl.worldTransform?.scale)) {
    changes.push({
      path: `/rigControls/${afterRigControl.rigControlId}/worldTransform/scale`,
      before: beforeRigControl.worldTransform?.scale ?? null,
      after: afterRigControl.worldTransform?.scale ?? null
    });
  }

  if (!sameStringList(beforeRigControl.affectedDrawableIds, afterRigControl.affectedDrawableIds)) {
    changes.push({
      path: `/rigControls/${afterRigControl.rigControlId}/affectedDrawableIds`,
      before: beforeRigControl.affectedDrawableIds,
      after: afterRigControl.affectedDrawableIds
    });
  }

  if (!sameStringList(beforeRigControl.affectedRigControlIds, afterRigControl.affectedRigControlIds)) {
    changes.push({
      path: `/rigControls/${afterRigControl.rigControlId}/affectedRigControlIds`,
      before: beforeRigControl.affectedRigControlIds,
      after: afterRigControl.affectedRigControlIds
    });
  }

  return changes;
};

const summarizeRigControlForDiff = (rigControl: ComparableRigControl) => ({
  rigControlId: rigControl.rigControlId,
  kind: rigControl.kind,
  enabled: rigControl.enabled,
  evaluationStatus: rigControl.evaluationStatus,
  hierarchyIndex: rigControl.hierarchyIndex,
  childDrawableIds: rigControl.childDrawableIds,
  childRigControlIds: rigControl.childRigControlIds,
  affectedDrawableIds: rigControl.affectedDrawableIds,
  affectedRigControlIds: rigControl.affectedRigControlIds,
  ...(rigControl.localTransform === undefined ? {} : { localTransform: rigControl.localTransform }),
  ...(rigControl.worldTransform === undefined ? {} : { worldTransform: rigControl.worldTransform }),
  ...(rigControl.bounds === undefined ? {} : { bounds: rigControl.bounds }),
  ...(rigControl.unsupportedReason === undefined ? {} : { unsupportedReason: rigControl.unsupportedReason })
});

const sameStringList = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const sameJsonValue = (left: unknown, right: unknown): boolean => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

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
