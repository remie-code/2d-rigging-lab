import { WARP_LATTICE_2D_CONTROL_POINT_ORDER } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { KeyformSetSchema, RigControlSchema } from "./index.js";

describe("warpLattice2d package-format contract", () => {
  it("parses a 2x2 warp lattice with explicit positive domain bounds and row-major control points", () => {
    const rigControl = RigControlSchema.parse(createWarpLatticeRigControl());

    expect(WARP_LATTICE_2D_CONTROL_POINT_ORDER).toBe("rowMajorYThenXFromDomainMinV1");
    expect(rigControl).toMatchObject({
      kind: "warpLattice2d",
      bindSpace: "rigControlLocalRest",
      domainBounds: { x: 10, y: 20, width: 100, height: 80 },
      latticeColumns: 2,
      latticeRows: 2,
      interpolationMethod: "bilinear-grid-v1"
    });
    if (rigControl.kind !== "warpLattice2d") {
      throw new Error("Expected warpLattice2d rig control.");
    }
    expect(rigControl.restControlPoints).toEqual([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 10, y: 100 },
      { x: 110, y: 100 }
    ]);
  });

  it("rejects rest control point cardinality that differs from latticeColumns * latticeRows", () => {
    expect(
      RigControlSchema.safeParse({
        ...createWarpLatticeRigControl(),
        latticeColumns: 3,
        latticeRows: 2,
        restControlPoints: [
          { x: 10, y: 20 },
          { x: 60, y: 20 },
          { x: 110, y: 20 },
          { x: 10, y: 100 },
          { x: 60, y: 100 }
        ]
      }).success
    ).toBe(false);
  });

  it("rejects non-positive warp lattice domain bounds without changing common Rect behavior", () => {
    expect(
      RigControlSchema.safeParse({
        ...createWarpLatticeRigControl(),
        domainBounds: { x: 10, y: 20, width: 0, height: 80 }
      }).success
    ).toBe(false);
    expect(
      RigControlSchema.safeParse({
        ...createWarpLatticeRigControl(),
        domainBounds: { x: 10, y: 20, width: 100, height: 0 }
      }).success
    ).toBe(false);
  });

  it("accepts controlPointOffsets keyform patches only as control-point-ordered Vec2 arrays", () => {
    const keyformSet = KeyformSetSchema.parse({
      keyformSetId: "keyset_faceWarp_offsets",
      target: {
        kind: "rigControl",
        id: "rig_faceWarp",
        property: "controlPointOffsets"
      },
      parameterId: "param_faceWarp",
      evaluator: "linear-1d-v1",
      interpolation: "linear-1d-v1",
      compositionMode: "additiveDelta",
      compositionOrder: 0,
      keys: [
        {
          value: 1,
          statePatch: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 }
          ]
        }
      ]
    });

    expect(keyformSet.keys[0]?.statePatch).toHaveLength(4);
  });

  it("rejects controlPointOffsets scalar patches and multiplyOpacity composition", () => {
    expect(
      KeyformSetSchema.safeParse({
        keyformSetId: "keyset_faceWarp_offsets_scalar",
        target: {
          kind: "rigControl",
          id: "rig_faceWarp",
          property: "controlPointOffsets"
        },
        parameterId: "param_faceWarp",
        evaluator: "linear-1d-v1",
        interpolation: "linear-1d-v1",
        compositionMode: "replace",
        compositionOrder: 0,
        keys: [{ value: 1, statePatch: 1 }]
      }).success
    ).toBe(false);

    expect(
      KeyformSetSchema.safeParse({
        keyformSetId: "keyset_faceWarp_offsets_multiply",
        target: {
          kind: "rigControl",
          id: "rig_faceWarp",
          property: "controlPointOffsets"
        },
        parameterId: "param_faceWarp",
        evaluator: "linear-1d-v1",
        interpolation: "linear-1d-v1",
        compositionMode: "multiplyOpacity",
        compositionOrder: 0,
        keys: [
          {
            value: 1,
            statePatch: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 },
              { x: 1, y: 1 }
            ]
          }
        ]
      }).success
    ).toBe(false);
  });
});

const createWarpLatticeRigControl = () => ({
  kind: "warpLattice2d",
  rigControlId: "rig_faceWarp",
  displayName: "Face Warp",
  partId: "part_face",
  childDrawableIds: ["draw_face"],
  childRigControlIds: [],
  bindSpace: "rigControlLocalRest",
  domainBounds: { x: 10, y: 20, width: 100, height: 80 },
  latticeColumns: 2,
  latticeRows: 2,
  restControlPoints: [
    { x: 10, y: 20 },
    { x: 110, y: 20 },
    { x: 10, y: 100 },
    { x: 110, y: 100 }
  ],
  interpolationMethod: "bilinear-grid-v1",
  enabled: true
});
