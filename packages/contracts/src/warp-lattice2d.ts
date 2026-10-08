import { z } from "zod";

import { RectSchema, Vec2Schema } from "./primitives.js";

// Row 0 / column 0 is domainBounds.x/y; indices then advance across columns before rows.
export const WARP_LATTICE_2D_CONTROL_POINT_ORDER = "rowMajorYThenXFromDomainMinV1";
export const WARP_LATTICE_2D_CONTROL_POINT_OFFSETS_PROPERTY = "controlPointOffsets";
// Runtime evaluators bind/sampling through rest-space domainBounds; rest-outside vertices pass through.
export const WARP_LATTICE_2D_OUTSIDE_DOMAIN_POLICY = "passThroughOutsideDomainV1";

export const WarpLattice2dControlPointOrderSchema = z.literal(WARP_LATTICE_2D_CONTROL_POINT_ORDER);
export type WarpLattice2dControlPointOrder = z.infer<typeof WarpLattice2dControlPointOrderSchema>;

export const WarpLattice2dControlPointOffsetsPropertySchema = z.literal(
  WARP_LATTICE_2D_CONTROL_POINT_OFFSETS_PROPERTY
);
export type WarpLattice2dControlPointOffsetsProperty = z.infer<
  typeof WarpLattice2dControlPointOffsetsPropertySchema
>;

export const WarpLattice2dOutsideDomainPolicySchema = z.literal(WARP_LATTICE_2D_OUTSIDE_DOMAIN_POLICY);
export type WarpLattice2dOutsideDomainPolicy = z.infer<typeof WarpLattice2dOutsideDomainPolicySchema>;

export const WarpLattice2dBindSpaceSchema = z.literal("rigControlLocalRest");
export type WarpLattice2dBindSpace = z.infer<typeof WarpLattice2dBindSpaceSchema>;

export const WarpLattice2dInterpolationMethodSchema = z.literal("bilinear-grid-v1");
export type WarpLattice2dInterpolationMethod = z.infer<typeof WarpLattice2dInterpolationMethodSchema>;

export const WarpLattice2dLatticeColumnsSchema = z.number().int().min(2);
export const WarpLattice2dLatticeRowsSchema = z.number().int().min(2);

export const WarpLattice2dDomainBoundsSchema = RectSchema.superRefine((bounds, context) => {
  if (bounds.width <= 0) {
    context.addIssue({
      code: "custom",
      path: ["width"],
      message: "warpLattice2d domainBounds.width must be greater than 0."
    });
  }

  if (bounds.height <= 0) {
    context.addIssue({
      code: "custom",
      path: ["height"],
      message: "warpLattice2d domainBounds.height must be greater than 0."
    });
  }
});
export type WarpLattice2dDomainBounds = z.infer<typeof WarpLattice2dDomainBoundsSchema>;

export const WarpLattice2dControlPointOffsetsSchema = z.array(Vec2Schema).min(4);
export type WarpLattice2dControlPointOffsets = z.infer<typeof WarpLattice2dControlPointOffsetsSchema>;

export interface WarpLattice2dControlPointGridSize {
  readonly latticeColumns: number;
  readonly latticeRows: number;
}

export interface WarpLattice2dControlPointSlot {
  readonly controlPointIndex: number;
  readonly row: number;
  readonly column: number;
}

export const getWarpLattice2dControlPointCount = (grid: WarpLattice2dControlPointGridSize): number =>
  grid.latticeColumns * grid.latticeRows;

export const hasWarpLattice2dControlPointCardinality = (
  grid: WarpLattice2dControlPointGridSize,
  controlPointCount: number
): boolean => controlPointCount === getWarpLattice2dControlPointCount(grid);

export const createWarpLattice2dControlPointSlots = (
  grid: WarpLattice2dControlPointGridSize
): readonly WarpLattice2dControlPointSlot[] => {
  const slots: WarpLattice2dControlPointSlot[] = [];

  for (let row = 0; row < grid.latticeRows; row += 1) {
    for (let column = 0; column < grid.latticeColumns; column += 1) {
      slots.push({
        controlPointIndex: row * grid.latticeColumns + column,
        row,
        column
      });
    }
  }

  return slots;
};

export const isWarpLattice2dControlPointOffsetsTarget = (target: {
  readonly kind: string;
  readonly property: string;
}): boolean =>
  target.kind === "rigControl" && target.property === WARP_LATTICE_2D_CONTROL_POINT_OFFSETS_PROPERTY;
