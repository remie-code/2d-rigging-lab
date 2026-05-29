import type { KeyformBinding } from "@private-2d-rigging-lab/runtime-core";
import type { KeyformTargetDto } from "@private-2d-rigging-lab/package-format";

import type { AuthoringGraph } from "./authoring-graph.js";

export const createRuntimeKeyformBindings = (graph: AuthoringGraph): readonly KeyformBinding[] =>
  graph.keyformSets.map((keyformSet) => {
    const target = toRuntimeTarget(keyformSet.target);

    if (keyformSet.evaluator === "linear-1d-v1") {
      return {
        evaluator: "linear-1d-v1",
        targetId: target.targetId,
        targetKind: target.targetKind,
        targetProperty: target.targetProperty,
        parameterId: keyformSet.parameterId,
        keys: keyformSet.keys.map((key) => ({
          value: key.value,
          statePatch: structuredClone(key.statePatch)
        })),
        compositionMode: keyformSet.compositionMode,
        compositionOrder: keyformSet.compositionOrder
      };
    }

    return {
      evaluator: "parameter-grid-2d-v1",
      targetId: target.targetId,
      targetKind: target.targetKind,
      targetProperty: target.targetProperty,
      parameterX: keyformSet.parameterX,
      parameterY: keyformSet.parameterY,
      interpolation: keyformSet.interpolation,
      clampPolicy: keyformSet.clampPolicy,
      missingKeyPolicy: keyformSet.missingKeyPolicy,
      keys: keyformSet.keys.map((key) => ({
        x: key.x,
        y: key.y,
        statePatch: structuredClone(key.statePatch)
      })),
      compositionMode: keyformSet.compositionMode,
      compositionOrder: keyformSet.compositionOrder
    };
  });

const toRuntimeTarget = (
  target: KeyformTargetDto
): Pick<KeyformBinding, "targetId" | "targetKind" | "targetProperty"> => ({
  targetId: target.id,
  targetKind: target.kind === "mesh" || target.kind === "rigControl" ? target.kind : "drawable",
  targetProperty: target.property
});
