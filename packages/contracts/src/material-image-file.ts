import { z } from "zod";
import { MaterialAbsolutePathSchema } from "./material-artifacts.js";
import { MaterialSha256Schema } from "./material-image.js";

const PixelCountSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const MaterialContentInsetSchema = z.object({
  left: PixelCountSchema, top: PixelCountSchema, right: PixelCountSchema, bottom: PixelCountSchema
}).strict();

/**
 * An image named by an operation payload. The host reads `imagePath`, normalizes it to straight-alpha RGBA8,
 * checks `rgbaSha256` and registers the bytes in the session before dry-run/commit. The operation payload
 * carries only this path and hash, never the bytes. `contentInset` is storage padding (not the alpha box); default none.
 */
export const MaterialImageFileRefSchema = z.object({
  imagePath: MaterialAbsolutePathSchema,
  rgbaSha256: MaterialSha256Schema,
  width: PixelCountSchema.positive(),
  height: PixelCountSchema.positive(),
  contentInset: MaterialContentInsetSchema.default({ left: 0, top: 0, right: 0, bottom: 0 })
}).strict().superRefine((image, context) => {
  if (!Number.isSafeInteger(image.width * image.height * 4)) {
    context.addIssue({ code: "custom", path: ["width"], message: "RGBA8 byte length must be a safe integer." });
  }
  const inset = image.contentInset;
  if (inset.left + inset.right >= image.width || inset.top + inset.bottom >= image.height) {
    context.addIssue({ code: "custom", path: ["contentInset"], message: "Storage content must have positive dimensions." });
  }
});
export type MaterialContentInset = z.infer<typeof MaterialContentInsetSchema>;
export type MaterialImageFileRef = z.infer<typeof MaterialImageFileRefSchema>;
