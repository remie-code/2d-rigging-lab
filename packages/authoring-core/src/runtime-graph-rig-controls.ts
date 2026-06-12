import type {
  NormalizedRigControlNode,
  NormalizedRuntimeGraph
} from "@private-2d-rigging-lab/runtime-core";

import type { AuthoringGraph } from "./authoring-graph.js";

export const createRuntimeRigControlMap = (
  graph: AuthoringGraph
): NormalizedRuntimeGraph["rigControls"] =>
  new Map(
    graph.rigControls.map((rigControl): [NormalizedRigControlNode["rigControlId"], NormalizedRigControlNode] => {
      if (rigControl.kind === "rotation2d") {
        return [
          rigControl.rigControlId,
          {
            kind: "rotation2d",
            rigControlId: rigControl.rigControlId,
            ...(rigControl.parentId === undefined ? {} : { parentId: rigControl.parentId }),
            childDrawableIds: [...rigControl.childDrawableIds],
            childRigControlIds: [...rigControl.childRigControlIds],
            opacityMultiplier: rigControl.opacityMultiplier ?? 1,
            pivot: structuredClone(rigControl.pivot),
            restAngleDegrees: rigControl.restAngleDegrees,
            restTranslation: structuredClone(rigControl.restTranslation),
            restScale: structuredClone(rigControl.restScale),
            enabled: rigControl.enabled
          }
        ];
      }

      return [
        rigControl.rigControlId,
        {
          kind: "warpLattice2d",
          rigControlId: rigControl.rigControlId,
          ...(rigControl.parentId === undefined ? {} : { parentId: rigControl.parentId }),
          childDrawableIds: [...rigControl.childDrawableIds],
          childRigControlIds: [...rigControl.childRigControlIds],
          opacityMultiplier: rigControl.opacityMultiplier ?? 1,
          bindSpace: rigControl.bindSpace,
          domainBounds: structuredClone(rigControl.domainBounds),
          latticeColumns: rigControl.latticeColumns,
          latticeRows: rigControl.latticeRows,
          restControlPoints: structuredClone(rigControl.restControlPoints),
          interpolationMethod: rigControl.interpolationMethod,
          enabled: rigControl.enabled
        }
      ];
    })
  );
