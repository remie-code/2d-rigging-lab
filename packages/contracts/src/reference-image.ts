import { z } from "zod";

export const REFERENCE_IMAGE_MAX_DIMENSION = 8192;
export const REFERENCE_IMAGE_MAX_PIXELS = 16_777_216;
export const REFERENCE_IMAGE_MAX_BYTES = 64 * 1024 * 1024;

const PointSchema = z.strictObject({ x: z.number(), y: z.number() });

export const ReferenceImageModeSchema = z.enum(["model", "reference", "overlay"]);
export type ReferenceImageMode = z.infer<typeof ReferenceImageModeSchema>;

export const ReferenceImageSourceSchema = z.strictObject({
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  width: z.number().int().positive().max(REFERENCE_IMAGE_MAX_DIMENSION),
  height: z.number().int().positive().max(REFERENCE_IMAGE_MAX_DIMENSION),
  byteLength: z.number().int().positive().max(REFERENCE_IMAGE_MAX_BYTES)
}).refine(({ width, height }) => width * height <= REFERENCE_IMAGE_MAX_PIXELS, "Reference PNG exceeds the pixel limit.");
export type ReferenceImageSource = z.infer<typeof ReferenceImageSourceSchema>;

const ScaleSchema = z.number().positive();
const OpacitySchema = z.number().min(0).max(1);

export const ReferenceImageTransformSchema = z.strictObject({
  origin: PointSchema,
  pivot: PointSchema,
  scale: ScaleSchema,
  rotationDegrees: z.number().min(-180).lt(180)
});
export type ReferenceImageTransform = z.infer<typeof ReferenceImageTransformSchema>;

export const ReferenceImageStateSchema = z.strictObject({
  image: ReferenceImageSourceSchema,
  displayMode: ReferenceImageModeSchema,
  opacity: OpacitySchema,
  transform: ReferenceImageTransformSchema
}).superRefine(({ image, transform }, context) => {
  const { origin, pivot, scale } = transform;
  const radius = Math.hypot(image.width, image.height) * scale;
  if (!Number.isFinite(Math.max(Math.abs(origin.x), Math.abs(origin.y)) + radius)) {
    context.addIssue({ code: "custom", path: ["transform"], message: "Reference transform exceeds the numeric model-coordinate range." });
  }
  if (pivot.x < 0 || pivot.y < 0 || pivot.x > image.width || pivot.y > image.height) {
    context.addIssue({ code: "custom", path: ["transform", "pivot"], message: "Reference pivot must be within the image pixel edges." });
  }
});
export type ReferenceImageState = z.infer<typeof ReferenceImageStateSchema>;

export const ReferenceImageUpdateSchema = z.strictObject({
  displayMode: ReferenceImageModeSchema.optional(),
  opacity: OpacitySchema.optional(),
  pivot: PointSchema.optional(),
  scale: ScaleSchema.optional(),
  rotationDegrees: z.number().optional(),
  translation: PointSchema.optional()
});
export type ReferenceImageUpdate = z.infer<typeof ReferenceImageUpdateSchema>;
