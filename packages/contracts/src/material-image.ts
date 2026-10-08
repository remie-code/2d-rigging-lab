import { z } from "zod";
import { MaterialPixelRectSchema } from "./material-coordinates.js";

export const MaterialSha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const PixelCountSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const MaterialImageDescriptorSchema = z.object({
  schemaVersion: z.literal("material-image-v1"),
  originalFileSha256: MaterialSha256Schema,
  rgbaSha256: MaterialSha256Schema,
  width: PixelCountSchema.positive(), height: PixelCountSchema.positive(),
  byteLength: PixelCountSchema,
  pixelFormat: z.literal("rgba8"),
  alphaMode: z.literal("straight-alpha-v1"),
  rowOrder: z.literal("top-to-bottom"),
  colorSpace: z.literal("srgb"),
  alpha: z.object({
    nonTransparentPixelCount: PixelCountSchema,
    translucentPixelCount: PixelCountSchema,
    bounds: MaterialPixelRectSchema.nullable()
  }).strict(),
  /** Storage padding only, NOT the alpha bounding box. No padding => all zero. */
  contentInset: z.object({
    left: PixelCountSchema, top: PixelCountSchema, right: PixelCountSchema, bottom: PixelCountSchema
  }).strict()
}).strict().superRefine((image, context) => {
  const fail = (path: string[], message: string): void => context.addIssue({ code: "custom", path, message });
  const area = image.width * image.height;
  if (!Number.isSafeInteger(area * 4) || image.byteLength !== area * 4) fail(["byteLength"], "RGBA8 requires width * height * 4 bytes.");
  const inset = image.contentInset;
  if (inset.left + inset.right >= image.width || inset.top + inset.bottom >= image.height) fail(["contentInset"], "Storage content must have positive dimensions.");
  const alpha = image.alpha;
  if (alpha.nonTransparentPixelCount > area || alpha.translucentPixelCount > alpha.nonTransparentPixelCount) fail(["alpha"], "Alpha counts contradict image dimensions.");
  if ((alpha.bounds === null) !== (alpha.nonTransparentPixelCount === 0)) fail(["alpha", "bounds"], "Only fully transparent images have null alpha bounds.");
  if (alpha.bounds !== null) {
    const b = alpha.bounds;
    if (b.x < inset.left || b.y < inset.top || b.x + b.width > image.width - inset.right || b.y + b.height > image.height - inset.bottom) fail(["alpha", "bounds"], "Alpha bounds must lie inside storage content.");
    if (alpha.nonTransparentPixelCount > b.width * b.height) fail(["alpha"], "Alpha count exceeds its bounding rectangle.");
  }
});
export type MaterialImageDescriptor = z.infer<typeof MaterialImageDescriptorSchema>;
/** In-memory host/core bridge. Bytes are not persisted as JSON or exposed as a file handle. */
export const MaterialNormalizedImageSchema = z.object({
  descriptor: MaterialImageDescriptorSchema,
  rgbaBytes: z.instanceof(Uint8Array)
}).strict().superRefine((image, context) => {
  if (image.rgbaBytes.byteLength !== image.descriptor.byteLength) {
    context.addIssue({ code: "custom", path: ["rgbaBytes"], message: "Byte buffer length disagrees with descriptor." });
    return;
  }
  let count = 0, translucent = 0;
  let minX = image.descriptor.width, minY = image.descriptor.height, maxX = -1, maxY = -1;
  for (let offset = 3; offset < image.rgbaBytes.length; offset += 4) {
    const alpha = image.rgbaBytes[offset]!;
    if (alpha === 0) continue;
    count++;
    if (alpha < 255) translucent++;
    const pixel = (offset - 3) / 4;
    const x = pixel % image.descriptor.width, y = Math.floor(pixel / image.descriptor.width);
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  const a = image.descriptor.alpha, b = a.bounds;
  if (count !== a.nonTransparentPixelCount || translucent !== a.translucentPixelCount ||
    (count > 0 && (b === null || b.x !== minX || b.y !== minY || b.width !== maxX - minX + 1 || b.height !== maxY - minY + 1))) {
    context.addIssue({ code: "custom", path: ["descriptor", "alpha"], message: "Alpha metadata disagrees with RGBA bytes." });
  }
});
export type MaterialNormalizedImage = z.infer<typeof MaterialNormalizedImageSchema>;

