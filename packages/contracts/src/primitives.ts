import { z } from "zod";

export const FiniteNumberSchema = z.number().finite();

export const Vec2DtoSchema = z.object({
  x: FiniteNumberSchema,
  y: FiniteNumberSchema
});
export type Vec2Dto = z.infer<typeof Vec2DtoSchema>;

export const RectDtoSchema = z.object({
  x: FiniteNumberSchema,
  y: FiniteNumberSchema,
  width: FiniteNumberSchema.nonnegative(),
  height: FiniteNumberSchema.nonnegative()
});
export type RectDto = z.infer<typeof RectDtoSchema>;

export const Transform2DDtoSchema = z.object({
  translation: Vec2DtoSchema,
  rotationDegrees: FiniteNumberSchema,
  scale: Vec2DtoSchema
});
export type Transform2DDto = z.infer<typeof Transform2DDtoSchema>;

export const Vec2Schema = Vec2DtoSchema;
export const RectSchema = RectDtoSchema;
export const Transform2DSchema = Transform2DDtoSchema;

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Bounds2D {
  readonly min: Vec2;
  readonly max: Vec2;
}
