import { z } from "zod";

import {
  RectSchema,
  Vec2Schema
} from "@private-2d-rigging-lab/contracts";
import type {
  RectDto,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";

export const WARP_DEFORMER_CONTRACT_VERSION = "warp-deformer-foundation-v0";
export const WARP_DEFORMER_USER_FACING_KIND = "warpDeformer";
export const WARP_DEFORMER_STORAGE_KIND = "warpLattice2d";
export const WARP_DEFORMER_TRANSFORM_POINT_SEMANTICS = "controlPointCount";
export const WARP_DEFORMER_BEZIER_EDIT_TYPE = "cubicBezierSurfaceV1";
export const WARP_DEFORMER_BEZIER_POINT_ORDER = "rowMajorYThenXFromDomainMinV1";
export const WARP_DEFORMER_BEZIER_GENERATION_KIND = "domainBoundsGridV1";
export const WARP_DEFORMER_BEZIER_HANDLE_POLICY = "zeroTangentsV1";
export const WARP_DEFORMER_BEZIER_EVALUATION_BOUNDARY = "storedNotEvaluatedV0";
export const WARP_DEFORMER_RUNTIME_EVALUATION = "bilinearGridV1";

const WarpDeformerDivisionCountSchema = z.number().int().min(2);

export const WarpDeformerTransformGridSchema = z.object({
  columns: WarpDeformerDivisionCountSchema,
  rows: WarpDeformerDivisionCountSchema,
  pointCountSemantics: z.literal(WARP_DEFORMER_TRANSFORM_POINT_SEMANTICS)
}).strict();
export type WarpDeformerTransformGridDto = z.infer<typeof WarpDeformerTransformGridSchema>;

export const WarpDeformerBezierEditTypeSchema = z.literal(WARP_DEFORMER_BEZIER_EDIT_TYPE);
export type WarpDeformerBezierEditTypeDto = z.infer<typeof WarpDeformerBezierEditTypeSchema>;

export const WarpDeformerBezierHandleSchema = z.object({
  inTangent: Vec2Schema,
  outTangent: Vec2Schema
}).strict();
export type WarpDeformerBezierHandleDto = z.infer<typeof WarpDeformerBezierHandleSchema>;

export const WarpDeformerBezierRestSurfaceGenerationSchema = z.object({
  kind: z.literal(WARP_DEFORMER_BEZIER_GENERATION_KIND),
  sourceDomainBounds: RectSchema,
  columns: WarpDeformerDivisionCountSchema,
  rows: WarpDeformerDivisionCountSchema,
  pointOrder: z.literal(WARP_DEFORMER_BEZIER_POINT_ORDER),
  handlePolicy: z.literal(WARP_DEFORMER_BEZIER_HANDLE_POLICY)
}).strict();
export type WarpDeformerBezierRestSurfaceGenerationDto = z.infer<
  typeof WarpDeformerBezierRestSurfaceGenerationSchema
>;

const WarpDeformerBezierEditSurfaceBaseSchema = z.object({
  columns: WarpDeformerDivisionCountSchema,
  rows: WarpDeformerDivisionCountSchema,
  editType: WarpDeformerBezierEditTypeSchema,
  pointOrder: z.literal(WARP_DEFORMER_BEZIER_POINT_ORDER),
  restControlPoints: z.array(Vec2Schema),
  handles: z.array(WarpDeformerBezierHandleSchema),
  restSurfaceGeneration: WarpDeformerBezierRestSurfaceGenerationSchema
}).strict();

export const WarpDeformerBezierEditSurfaceSchema = WarpDeformerBezierEditSurfaceBaseSchema.superRefine(
  (surface, context) => {
    const expectedCount = getWarpDeformerBezierControlPointCount(surface);

    if (surface.restControlPoints.length !== expectedCount) {
      context.addIssue({
        code: "custom",
        path: ["restControlPoints"],
        message:
          `warpDeformer bezierEditSurface restControlPoints length must equal columns * rows (${expectedCount}).`
      });
    }

    if (surface.handles.length !== expectedCount) {
      context.addIssue({
        code: "custom",
        path: ["handles"],
        message:
          `warpDeformer bezierEditSurface handles length must equal columns * rows (${expectedCount}).`
      });
    }

    if (
      surface.restSurfaceGeneration.columns !== surface.columns ||
      surface.restSurfaceGeneration.rows !== surface.rows
    ) {
      context.addIssue({
        code: "custom",
        path: ["restSurfaceGeneration"],
        message: "warpDeformer bezierEditSurface generation columns/rows must match the surface columns/rows."
      });
    }
  }
);
export type WarpDeformerBezierEditSurfaceDto = z.infer<typeof WarpDeformerBezierEditSurfaceSchema>;

export const WarpDeformerCompatibilitySchema = z.object({
  storageKind: z.literal(WARP_DEFORMER_STORAGE_KIND),
  transformStorage: z.literal("latticeColumnsRows"),
  restControlPointStorage: z.literal("restControlPoints"),
  runtimeEvaluation: z.literal(WARP_DEFORMER_RUNTIME_EVALUATION),
  bezierEvaluation: z.literal(WARP_DEFORMER_BEZIER_EVALUATION_BOUNDARY)
}).strict();
export type WarpDeformerCompatibilityDto = z.infer<typeof WarpDeformerCompatibilitySchema>;

const WarpDeformerMetadataBaseSchema = z.object({
  schemaVersion: z.literal(WARP_DEFORMER_CONTRACT_VERSION),
  userFacingKind: z.literal(WARP_DEFORMER_USER_FACING_KIND),
  transformGrid: WarpDeformerTransformGridSchema,
  bezierEditSurface: WarpDeformerBezierEditSurfaceSchema,
  compatibility: WarpDeformerCompatibilitySchema
}).strict();

export const WarpDeformerMetadataSchema = WarpDeformerMetadataBaseSchema.superRefine((metadata, context) => {
  const surface = metadata.bezierEditSurface;
  if (
    surface.restSurfaceGeneration.sourceDomainBounds.width <= 0 ||
    surface.restSurfaceGeneration.sourceDomainBounds.height <= 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["bezierEditSurface", "restSurfaceGeneration", "sourceDomainBounds"],
      message: "warpDeformer bezierEditSurface generation sourceDomainBounds must be positive."
    });
  }
});
export type WarpDeformerMetadataDto = z.infer<typeof WarpDeformerMetadataSchema>;

export interface WarpDeformerBezierGridSize {
  readonly columns: number;
  readonly rows: number;
}

export interface CreateDefaultWarpDeformerBezierSurfaceInput extends WarpDeformerBezierGridSize {
  readonly domainBounds: RectDto;
  readonly editType?: WarpDeformerBezierEditTypeDto;
}

export const getWarpDeformerBezierControlPointCount = (
  grid: WarpDeformerBezierGridSize
): number => grid.columns * grid.rows;

export const hasWarpDeformerBezierSurfaceCardinality = (
  surface: Pick<WarpDeformerBezierEditSurfaceDto, "columns" | "rows" | "restControlPoints" | "handles">
): boolean => {
  const expectedCount = getWarpDeformerBezierControlPointCount(surface);
  return surface.restControlPoints.length === expectedCount && surface.handles.length === expectedCount;
};

export const createDefaultWarpDeformerBezierEditSurface = (
  input: CreateDefaultWarpDeformerBezierSurfaceInput
): WarpDeformerBezierEditSurfaceDto => {
  const restControlPoints = createGridPoints({
    domainBounds: input.domainBounds,
    columns: input.columns,
    rows: input.rows
  });
  const handles = restControlPoints.map(() => createZeroHandle());

  return WarpDeformerBezierEditSurfaceSchema.parse({
    columns: input.columns,
    rows: input.rows,
    editType: input.editType ?? WARP_DEFORMER_BEZIER_EDIT_TYPE,
    pointOrder: WARP_DEFORMER_BEZIER_POINT_ORDER,
    restControlPoints,
    handles,
    restSurfaceGeneration: {
      kind: WARP_DEFORMER_BEZIER_GENERATION_KIND,
      sourceDomainBounds: input.domainBounds,
      columns: input.columns,
      rows: input.rows,
      pointOrder: WARP_DEFORMER_BEZIER_POINT_ORDER,
      handlePolicy: WARP_DEFORMER_BEZIER_HANDLE_POLICY
    }
  });
};

export const createWarpDeformerMetadata = (input: {
  readonly domainBounds: RectDto;
  readonly transformColumns: number;
  readonly transformRows: number;
  readonly bezierColumns: number;
  readonly bezierRows: number;
  readonly bezierEditType?: WarpDeformerBezierEditTypeDto;
}): WarpDeformerMetadataDto =>
  WarpDeformerMetadataSchema.parse({
    schemaVersion: WARP_DEFORMER_CONTRACT_VERSION,
    userFacingKind: WARP_DEFORMER_USER_FACING_KIND,
    transformGrid: {
      columns: input.transformColumns,
      rows: input.transformRows,
      pointCountSemantics: WARP_DEFORMER_TRANSFORM_POINT_SEMANTICS
    },
    bezierEditSurface: createDefaultWarpDeformerBezierEditSurface({
      domainBounds: input.domainBounds,
      columns: input.bezierColumns,
      rows: input.bezierRows,
      ...(input.bezierEditType === undefined ? {} : { editType: input.bezierEditType })
    }),
    compatibility: {
      storageKind: WARP_DEFORMER_STORAGE_KIND,
      transformStorage: "latticeColumnsRows",
      restControlPointStorage: "restControlPoints",
      runtimeEvaluation: WARP_DEFORMER_RUNTIME_EVALUATION,
      bezierEvaluation: WARP_DEFORMER_BEZIER_EVALUATION_BOUNDARY
    }
  });

const createGridPoints = (input: {
  readonly domainBounds: RectDto;
  readonly columns: number;
  readonly rows: number;
}): Vec2Dto[] => {
  const points: Vec2Dto[] = [];

  for (let row = 0; row < input.rows; row += 1) {
    for (let column = 0; column < input.columns; column += 1) {
      points.push({
        x: input.domainBounds.x + input.domainBounds.width * toUnitGridPosition(column, input.columns),
        y: input.domainBounds.y + input.domainBounds.height * toUnitGridPosition(row, input.rows)
      });
    }
  }

  return points;
};

const createZeroHandle = (): WarpDeformerBezierHandleDto => ({
  inTangent: { x: 0, y: 0 },
  outTangent: { x: 0, y: 0 }
});

const toUnitGridPosition = (index: number, size: number): number =>
  size <= 1 ? 0 : index / (size - 1);
