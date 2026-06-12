import { WARP_LATTICE_2D_CONTROL_POINT_ORDER } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  KeyformSetSchema,
  RigControlSchema,
  createWarpDeformerMetadata,
  projectWarpDeformerReadModel
} from "./index.js";

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

  it("parses Warp Deformer metadata with transform and Bezier edit divisions", () => {
    const rigControl = RigControlSchema.parse({
      ...createWarpLatticeRigControl(),
      latticeColumns: 5,
      latticeRows: 4,
      restControlPoints: createGridPoints({ columns: 5, rows: 4 }),
      warpDeformer: createWarpDeformerMetadata({
        domainBounds: { x: 10, y: 20, width: 100, height: 80 },
        transformColumns: 5,
        transformRows: 4,
        bezierColumns: 3,
        bezierRows: 2
      })
    });

    if (rigControl.kind !== "warpLattice2d") {
      throw new Error("Expected warpLattice2d storage for Warp Deformer.");
    }

    const projection = projectWarpDeformerReadModel(rigControl);
    expect(projection).toMatchObject({
      kind: "warpDeformer",
      storageKind: "warpLattice2d",
      transformGrid: {
        columns: 5,
        rows: 4,
        pointCountSemantics: "controlPointCount"
      },
      bezierSurfaceStatus: "stored",
      evaluationBoundary: {
        transformEvaluation: "bilinearGridV1",
        bezierEvaluation: "storedNotEvaluatedV0"
      }
    });
    expect(projection.bezierEditSurface).toMatchObject({
      columns: 3,
      rows: 2,
      editType: "cubicBezierSurfaceV1"
    });
    expect(projection.bezierEditSurface.restControlPoints).toHaveLength(6);
    expect(projection.bezierEditSurface.handles).toHaveLength(6);
  });

  it("projects legacy warpLattice2d storage as a defaulted Warp Deformer read model", () => {
    const rigControl = RigControlSchema.parse(createWarpLatticeRigControl());
    if (rigControl.kind !== "warpLattice2d") {
      throw new Error("Expected warpLattice2d rig control.");
    }

    const projection = projectWarpDeformerReadModel(rigControl);

    expect(projection.bezierSurfaceStatus).toBe("legacyDefaulted");
    expect(projection.transformGrid).toMatchObject({
      columns: 2,
      rows: 2
    });
    expect(projection.bezierEditSurface.restControlPoints).toEqual(rigControl.restControlPoints);
  });

  it("rejects Warp Deformer transform mismatch and malformed Bezier surface cardinality", () => {
    const metadata = createWarpDeformerMetadata({
      domainBounds: { x: 10, y: 20, width: 100, height: 80 },
      transformColumns: 3,
      transformRows: 2,
      bezierColumns: 3,
      bezierRows: 2
    });

    expect(
      RigControlSchema.safeParse({
        ...createWarpLatticeRigControl(),
        latticeColumns: 2,
        latticeRows: 2,
        warpDeformer: metadata
      }).success
    ).toBe(false);

    expect(
      RigControlSchema.safeParse({
        ...createWarpLatticeRigControl(),
        warpDeformer: {
          ...createWarpDeformerMetadata({
            domainBounds: { x: 10, y: 20, width: 100, height: 80 },
            transformColumns: 2,
            transformRows: 2,
            bezierColumns: 3,
            bezierRows: 2
          }),
          bezierEditSurface: {
            ...metadata.bezierEditSurface,
            columns: 3,
            rows: 2,
            handles: metadata.bezierEditSurface.handles.slice(0, 5)
          }
        }
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

const createGridPoints = (input: {
  readonly columns: number;
  readonly rows: number;
}) => {
  const points: { readonly x: number; readonly y: number }[] = [];
  for (let row = 0; row < input.rows; row += 1) {
    for (let column = 0; column < input.columns; column += 1) {
      points.push({
        x: 10 + 100 * (input.columns <= 1 ? 0 : column / (input.columns - 1)),
        y: 20 + 80 * (input.rows <= 1 ? 0 : row / (input.rows - 1))
      });
    }
  }
  return points;
};
