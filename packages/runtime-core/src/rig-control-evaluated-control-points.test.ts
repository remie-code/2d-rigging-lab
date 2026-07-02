import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  ParameterIdSchema,
  RigControlIdSchema,
  RuntimeEvaluationContextSchema
} from "@private-2d-rigging-lab/contracts";
import type { RectDto, Vec2Dto } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createInitialRuntimeState } from "./initial-state.js";
import type {
  NormalizedRuntimeGraph,
  NormalizedWarpLattice2dRigControl
} from "./normalized-runtime-graph.js";
import { evaluateRuntimeFrame } from "./runtime-core.js";
import { RuntimeEvaluationInputSchema } from "./runtime-input.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";

/**
 * Wave104 Domain C — the narrow additive export of evaluated warp lattice
 * control points on `EvaluatedRigControlDto.evaluatedControlPoints`.
 *
 * The expectations here are computed INDEPENDENTLY of the evaluator: the rest
 * control points are the four corners of the domain rect, and the keyform drives
 * a `replace` control-point-offset patch to `param=1`, so the evaluated absolute
 * points must equal `rest[i] + offset[i]` for each corner. Each corner has a
 * DISTINCT offset so the test also pins the index order.
 */

const PARAMETER_ID = ParameterIdSchema.parse("param_warp_drive");
const DRAWABLE_ID = DrawableIdSchema.parse("draw_warp_subject");
const MESH_ID = MeshIdSchema.parse("mesh_warp_subject");
const WARP_RIG_ID = RigControlIdSchema.parse("rig_measured_warp");

// Domain rect => rest control points are its four corners (row-major:
// lowerLeft, lowerRight, upperLeft, upperRight):
//   (0,0) (10,0) (0,20) (10,20)
const DOMAIN_BOUNDS: RectDto = { x: 0, y: 0, width: 10, height: 20 };
const REST_CONTROL_POINTS: readonly Vec2Dto[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 0, y: 20 },
  { x: 10, y: 20 }
];
// Distinct offsets per corner so the index mapping is verified, not just the sum.
const KEYFORM_OFFSETS: readonly Vec2Dto[] = [
  { x: 1, y: 2 },
  { x: -3, y: 4 },
  { x: 5, y: -6 },
  { x: 7, y: 8 }
];

describe("evaluated warp lattice control points export (Wave104 §3.3)", () => {
  it("returns rest control points when there are no keyform offsets (rest pose)", () => {
    const snapshot = evaluateWarpFrame(createWarpGraph(), { [PARAMETER_ID]: 0 });
    const warp = requireWarp(snapshot);

    expect(warp.evaluationStatus).toBe("evaluated");
    // At param=0 the keyform samples zero offsets, so evaluated == rest exactly.
    expect(warp.evaluatedControlPoints).toEqual(REST_CONTROL_POINTS);
  });

  it("returns rest + evaluated offsets (evaluated != rest) when keyform offsets are non-zero", () => {
    const snapshot = evaluateWarpFrame(createWarpGraph(), { [PARAMETER_ID]: 1 });
    const warp = requireWarp(snapshot);

    const expected = REST_CONTROL_POINTS.map((rest, index) => {
      const offset = KEYFORM_OFFSETS[index] ?? { x: 0, y: 0 };
      return { x: rest.x + offset.x, y: rest.y + offset.y };
    });
    // Independently: (1,2) (7,4) (5,14) (17,28)
    expect(expected).toEqual([
      { x: 1, y: 2 },
      { x: 7, y: 4 },
      { x: 5, y: 14 },
      { x: 17, y: 28 }
    ]);
    expect(warp.evaluatedControlPoints).toEqual(expected);
    // And it is genuinely NOT the rest set.
    expect(warp.evaluatedControlPoints).not.toEqual(REST_CONTROL_POINTS);
  });

  it("returns half the offsets at the keyform midpoint (linear interpolation)", () => {
    const snapshot = evaluateWarpFrame(createWarpGraph(), { [PARAMETER_ID]: 0.5 });
    const warp = requireWarp(snapshot);

    const expected = REST_CONTROL_POINTS.map((rest, index) => {
      const offset = KEYFORM_OFFSETS[index] ?? { x: 0, y: 0 };
      return { x: rest.x + offset.x * 0.5, y: rest.y + offset.y * 0.5 };
    });
    expect(warp.evaluatedControlPoints).toEqual(expected);
  });
});

const requireWarp = (snapshot: ReturnType<typeof evaluateWarpFrame>) => {
  const warp = snapshot.rigControls.find(
    (rigControl) => rigControl.rigControlId === WARP_RIG_ID
  );
  if (warp === undefined) {
    throw new Error("Expected warp rig control in snapshot.");
  }
  return warp;
};

const evaluateWarpFrame = (
  graph: NormalizedRuntimeGraph,
  authoredParameterValues: Record<string, number>
) => {
  const input = RuntimeEvaluationInputSchema.parse({
    schemaVersion: "runtime-evaluation-input-v1",
    frameIndex: 1,
    deltaTimeMs: 0,
    resetReasons: [],
    authoredParameterValues,
    targetIds: [WARP_RIG_ID, DRAWABLE_ID]
  });
  const state = createInitialRuntimeState(graph, {
    packageId: graph.packageId,
    packageRevision: graph.packageRevision,
    frameIndex: 0,
    authoredParameterValues,
    resetReasons: ["packageLoad"]
  });

  return evaluateRuntimeFrame(
    graph,
    input,
    state,
    {
      ...defaultRuntimeEvaluationOptions(),
      snapshotDetail: "full"
    },
    RuntimeEvaluationContextSchema.parse({
      source: { surface: "preview" },
      policy: { strictness: "interactive" }
    })
  ).snapshot;
};

const createWarpGraph = (): NormalizedRuntimeGraph => ({
  packageId: "pkg_wave104_measurement_warp",
  packageRevision: 1,
  coordinateSystem: "canvas-y-down-v1",
  parameters: new Map([
    [
      PARAMETER_ID,
      {
        id: PARAMETER_ID,
        displayName: "Warp Drive",
        valueSource: "authoredInput" as const,
        min: 0,
        max: 1,
        default: 0
      }
    ]
  ]),
  dynamicsGroups: new Map(),
  drawables: new Map([
    [
      DRAWABLE_ID,
      {
        drawableId: DRAWABLE_ID,
        meshId: MESH_ID,
        visible: true,
        opacity: 1,
        baseDrawOrder: 0,
        bounds: { x: 5, y: 10, width: 0, height: 0 },
        vertices: [{ x: 5, y: 10 }],
        vertexCount: 1
      }
    ]
  ]),
  rigControls: new Map([[WARP_RIG_ID, createWarpRigControl()]]),
  keyformBindings: [
    {
      evaluator: "linear-1d-v1",
      keyformSetId: KeyformSetIdSchema.parse("keyset_measured_warp_offsets"),
      targetId: WARP_RIG_ID,
      targetKind: "rigControl",
      targetProperty: "controlPointOffsets",
      parameterId: PARAMETER_ID,
      keys: [
        {
          value: 0,
          statePatch: [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 0, y: 0 }
          ]
        },
        { value: 1, statePatch: KEYFORM_OFFSETS }
      ],
      compositionMode: "replace",
      compositionOrder: 0
    }
  ],
  masks: [],
  drawOrder: [{ drawableId: DRAWABLE_ID, drawOrder: 0 }],
  disabledFutureLayers: []
});

const createWarpRigControl = (): NormalizedWarpLattice2dRigControl => ({
  kind: "warpLattice2d",
  rigControlId: WARP_RIG_ID,
  childDrawableIds: [DRAWABLE_ID],
  childRigControlIds: [],
  bindSpace: "rigControlLocalRest",
  domainBounds: DOMAIN_BOUNDS,
  latticeColumns: 2,
  latticeRows: 2,
  restControlPoints: REST_CONTROL_POINTS,
  interpolationMethod: "bilinear-grid-v1",
  enabled: true
});
