import { describe, expect, it } from "vitest";

import {
  RuntimeDiffSchema,
  WARP_LATTICE_2D_CONTROL_POINT_ORDER,
  WARP_LATTICE_2D_OUTSIDE_DOMAIN_POLICY,
  WarpLattice2dControlPointOffsetsSchema,
  WarpLattice2dDomainBoundsSchema,
  createWarpLattice2dControlPointSlots,
  getWarpLattice2dControlPointCount,
  hasWarpLattice2dControlPointCardinality
} from "./index.js";

describe("warpLattice2d v0 shared contract footing", () => {
  it("defines control points as row-major by y then x from the domain minimum", () => {
    expect(WARP_LATTICE_2D_CONTROL_POINT_ORDER).toBe("rowMajorYThenXFromDomainMinV1");
    expect(getWarpLattice2dControlPointCount({ latticeColumns: 3, latticeRows: 2 })).toBe(6);
    expect(hasWarpLattice2dControlPointCardinality({ latticeColumns: 3, latticeRows: 2 }, 6)).toBe(true);
    expect(hasWarpLattice2dControlPointCardinality({ latticeColumns: 3, latticeRows: 2 }, 5)).toBe(false);
    expect(createWarpLattice2dControlPointSlots({ latticeColumns: 3, latticeRows: 2 })).toEqual([
      { controlPointIndex: 0, row: 0, column: 0 },
      { controlPointIndex: 1, row: 0, column: 1 },
      { controlPointIndex: 2, row: 0, column: 2 },
      { controlPointIndex: 3, row: 1, column: 0 },
      { controlPointIndex: 4, row: 1, column: 1 },
      { controlPointIndex: 5, row: 1, column: 2 }
    ]);
  });

  it("requires explicit positive domain bounds for warp lattice package/evidence footing", () => {
    expect(WarpLattice2dDomainBoundsSchema.parse({ x: 0, y: 0, width: 100, height: 50 })).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 50
    });
    expect(WarpLattice2dDomainBoundsSchema.safeParse({ x: 0, y: 0, width: 0, height: 50 }).success).toBe(false);
    expect(WarpLattice2dDomainBoundsSchema.safeParse({ x: 0, y: 0, width: 100, height: 0 }).success).toBe(false);
  });

  it("keeps controlPointOffsets as a Vec2 array with minimum 2x2 lattice cardinality", () => {
    expect(
      WarpLattice2dControlPointOffsetsSchema.parse([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 }
      ])
    ).toHaveLength(4);
    expect(
      WarpLattice2dControlPointOffsetsSchema.safeParse([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ]).success
    ).toBe(false);
  });

  it("parses warp lattice runtime diff evidence shape without evaluating runtime output", () => {
    expect(
      RuntimeDiffSchema.parse({
        schemaVersion: "runtime-diff-v1",
        beforeSnapshotId: "snap_before",
        afterSnapshotId: "snap_after",
        rigControlChanges: [
          {
            kind: "warpLattice2d",
            rigControlId: "rig_faceWarp",
            evaluationStatus: "evaluated",
            bindSpace: "rigControlLocalRest",
            domainBounds: { x: 0, y: 0, width: 100, height: 80 },
            interpolationMethod: "bilinear-grid-v1",
            controlPointOrder: WARP_LATTICE_2D_CONTROL_POINT_ORDER,
            controlPointOffsetCount: 4,
            outsideDomainPolicy: WARP_LATTICE_2D_OUTSIDE_DOMAIN_POLICY,
            affectedDrawableIds: ["draw_face"],
            boundsChanged: true,
            vertexHashBefore: "hash_before",
            vertexHashAfter: "hash_after"
          }
        ]
      }).rigControlChanges
    ).toEqual([
      {
        kind: "warpLattice2d",
        rigControlId: "rig_faceWarp",
        evaluationStatus: "evaluated",
        bindSpace: "rigControlLocalRest",
        domainBounds: { x: 0, y: 0, width: 100, height: 80 },
        interpolationMethod: "bilinear-grid-v1",
        controlPointOrder: WARP_LATTICE_2D_CONTROL_POINT_ORDER,
        controlPointOffsetCount: 4,
        outsideDomainPolicy: WARP_LATTICE_2D_OUTSIDE_DOMAIN_POLICY,
        affectedDrawableIds: ["draw_face"],
        boundsChanged: true,
        vertexHashBefore: "hash_before",
        vertexHashAfter: "hash_after"
      }
    ]);
  });
});
