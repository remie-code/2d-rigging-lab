import { z } from "zod";
import { FiniteNumberSchema, RectDtoSchema, Vec2DtoSchema } from "./primitives.js";

export const MaterialPixelPointSchema = Vec2DtoSchema.extend({ space: z.literal("source-image-pixel-edge-v1") }).strict();
export const MaterialStagePointSchema = Vec2DtoSchema.extend({ space: z.literal("rest-stage-canvas-y-down-v1") }).strict();
export const MaterialPixelRectSchema = RectDtoSchema.extend({
  space: z.literal("source-image-pixel-edge-v1"),
  x: FiniteNumberSchema.int().nonnegative(), y: FiniteNumberSchema.int().nonnegative(),
  width: FiniteNumberSchema.int().positive(), height: FiniteNumberSchema.int().positive()
}).strict();
export const MaterialStageRectSchema = RectDtoSchema.extend({
  space: z.literal("rest-stage-canvas-y-down-v1"),
  width: FiniteNumberSchema.positive(), height: FiniteNumberSchema.positive()
}).strict();
/** xStage = scale * xPixel + translation.x; yStage = scale * yPixel + translation.y. */
export const MaterialPlacementSchema = z.object({
  from: z.literal("source-image-pixel-edge-v1"),
  to: z.literal("rest-stage-canvas-y-down-v1"),
  scale: FiniteNumberSchema.positive(),
  translation: Vec2DtoSchema.strict()
}).strict();
export const MaterialCorrespondenceSchema = z.object({
  pixel: MaterialPixelPointSchema, stage: MaterialStagePointSchema
}).strict();
export const MaterialFitEvidenceSchema = z.object({
  placement: MaterialPlacementSchema,
  residualsStage: z.array(FiniteNumberSchema.nonnegative()).min(2),
  rmsErrorStage: FiniteNumberSchema.nonnegative(),
  maxErrorStage: FiniteNumberSchema.nonnegative()
}).strict();
export type MaterialPixelPoint = z.infer<typeof MaterialPixelPointSchema>;
export type MaterialStagePoint = z.infer<typeof MaterialStagePointSchema>;
export type MaterialPlacement = z.infer<typeof MaterialPlacementSchema>;
export type MaterialCorrespondence = z.infer<typeof MaterialCorrespondenceSchema>;

