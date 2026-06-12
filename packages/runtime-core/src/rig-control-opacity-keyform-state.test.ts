import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  ParameterIdSchema,
  RigControlIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import { evaluateViewerRuntimeSnapshot } from "./viewer-evaluation.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";

describe("rig control opacityMultiplier keyform runtime evaluation", () => {
  it("evaluates keyformed rotation deformer opacity multipliers on descendant drawables", () => {
    const graph = createOpacityMultiplierGraph();

    const result = evaluateViewerRuntimeSnapshot(graph, {
      baselineParameterOverrides: { param_face_yaw: -30 },
      parameterOverrides: { param_face_yaw: 30 },
      targetIds: ["rig_head_rotation", "draw_face"],
      options: {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full"
      }
    });

    expect(result.snapshot.keyformSamples).toEqual([
      expect.objectContaining({
        keyformSetId: "keyset_rotation_opacity",
        target: "rigControl:rig_head_rotation.opacityMultiplier",
        statePatch: 0.25,
        samplingStatus: "exact"
      })
    ]);
    expect(result.baselineSnapshot.rigControls[0]).toMatchObject({
      rigControlId: "rig_head_rotation",
      opacityMultiplier: 1
    });
    expect(result.snapshot.rigControls[0]).toMatchObject({
      rigControlId: "rig_head_rotation",
      opacityMultiplier: 0.25
    });
    expect(result.baselineSnapshot.drawables[0]?.opacity).toBe(0.8);
    expect(result.snapshot.drawables[0]?.opacity).toBe(0.2);
    expect(result.snapshot.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  });

  it("evaluates keyformed warp deformer opacity multipliers on descendant drawables", () => {
    const graph = createWarpOpacityMultiplierGraph();

    const result = evaluateViewerRuntimeSnapshot(graph, {
      baselineParameterOverrides: { param_face_yaw: -30 },
      parameterOverrides: { param_face_yaw: 30 },
      targetIds: ["rig_head_warp", "draw_face"],
      options: {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full"
      }
    });

    expect(result.snapshot.keyformSamples).toEqual([
      expect.objectContaining({
        keyformSetId: "keyset_warp_opacity",
        target: "rigControl:rig_head_warp.opacityMultiplier",
        statePatch: 0.25,
        samplingStatus: "exact"
      })
    ]);
    expect(result.baselineSnapshot.rigControls[0]).toMatchObject({
      rigControlId: "rig_head_warp",
      opacityMultiplier: 0.6
    });
    expect(result.snapshot.rigControls[0]).toMatchObject({
      rigControlId: "rig_head_warp",
      opacityMultiplier: 0.15
    });
    expect(result.baselineSnapshot.drawables[0]?.opacity).toBe(0.48);
    expect(result.snapshot.drawables[0]?.opacity).toBe(0.12);
    expect(result.snapshot.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  });
});

const createOpacityMultiplierGraph = (): NormalizedRuntimeGraph => {
  const parameterId = ParameterIdSchema.parse("param_face_yaw");
  const drawableId = DrawableIdSchema.parse("draw_face");
  const meshId = MeshIdSchema.parse("mesh_face");
  const rigControlId = RigControlIdSchema.parse("rig_head_rotation");

  return {
    packageId: "pkg_opacity_multiplier_runtime_test",
    packageRevision: 0,
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map([
      [
        parameterId,
        {
          id: parameterId,
          displayName: "Face Yaw",
          valueSource: "authoredInput",
          min: -30,
          max: 30,
          default: 0
        }
      ]
    ]),
    dynamicsGroups: new Map(),
    drawables: new Map([
      [
        drawableId,
        {
          drawableId,
          meshId,
          visible: true,
          opacity: 0.8,
          baseDrawOrder: 0,
          bounds: { x: 0, y: 0, width: 10, height: 10 },
          vertexCount: 4
        }
      ]
    ]),
    rigControls: new Map([
      [
        rigControlId,
        {
          kind: "rotation2d",
          rigControlId,
          childDrawableIds: [drawableId],
          childRigControlIds: [],
          opacityMultiplier: 1,
          pivot: { x: 0, y: 0 },
          restAngleDegrees: 0,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        }
      ]
    ]),
    keyformBindings: [
      {
        evaluator: "linear-1d-v1",
        keyformSetId: KeyformSetIdSchema.parse("keyset_rotation_opacity"),
        targetId: rigControlId,
        targetKind: "rigControl",
        targetProperty: "opacityMultiplier",
        parameterId,
        compositionMode: "replace",
        compositionOrder: 0,
        keys: [
          { value: -30, statePatch: 1 },
          { value: 30, statePatch: 0.25 }
        ]
      }
    ],
    masks: [],
    drawOrder: [{ drawableId, drawOrder: 0 }],
    disabledFutureLayers: []
  };
};

const createWarpOpacityMultiplierGraph = (): NormalizedRuntimeGraph => {
  const parameterId = ParameterIdSchema.parse("param_face_yaw");
  const drawableId = DrawableIdSchema.parse("draw_face");
  const meshId = MeshIdSchema.parse("mesh_face");
  const rigControlId = RigControlIdSchema.parse("rig_head_warp");

  return {
    packageId: "pkg_warp_opacity_multiplier_runtime_test",
    packageRevision: 0,
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map([
      [
        parameterId,
        {
          id: parameterId,
          displayName: "Face Yaw",
          valueSource: "authoredInput",
          min: -30,
          max: 30,
          default: 0
        }
      ]
    ]),
    dynamicsGroups: new Map(),
    drawables: new Map([
      [
        drawableId,
        {
          drawableId,
          meshId,
          visible: true,
          opacity: 0.8,
          baseDrawOrder: 0,
          bounds: { x: 0, y: 0, width: 10, height: 10 },
          vertexCount: 4
        }
      ]
    ]),
    rigControls: new Map([
      [
        rigControlId,
        {
          kind: "warpLattice2d",
          rigControlId,
          childDrawableIds: [drawableId],
          childRigControlIds: [],
          opacityMultiplier: 0.6,
          bindSpace: "rigControlLocalRest",
          domainBounds: { x: 0, y: 0, width: 10, height: 10 },
          latticeColumns: 2,
          latticeRows: 2,
          restControlPoints: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 0, y: 10 },
            { x: 10, y: 10 }
          ],
          interpolationMethod: "bilinear-grid-v1",
          enabled: true
        }
      ]
    ]),
    keyformBindings: [
      {
        evaluator: "linear-1d-v1",
        keyformSetId: KeyformSetIdSchema.parse("keyset_warp_opacity"),
        targetId: rigControlId,
        targetKind: "rigControl",
        targetProperty: "opacityMultiplier",
        parameterId,
        compositionMode: "multiplyOpacity",
        compositionOrder: 0,
        keys: [
          { value: -30, statePatch: 1 },
          { value: 30, statePatch: 0.25 }
        ]
      }
    ],
    masks: [],
    drawOrder: [{ drawableId, drawOrder: 0 }],
    disabledFutureLayers: []
  };
};
