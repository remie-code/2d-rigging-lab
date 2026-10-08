import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { MaterialNormalizedImageSchema, type MaterialNormalizedImage } from "@private-2d-rigging-lab/contracts";
import { MaterialHostError } from "./material-host-error.js";
import { validateMaterialPng } from "./material-png-validation.js";

const png = createRequire(import.meta.url)("pngjs") as {
  PNG: { sync: { read(bytes: Buffer, options: { checkCRC: boolean }): { width: number; height: number; data: Buffer } } };
};
export const materialSha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
export const verifyMaterialImage = (image: MaterialNormalizedImage): void => {
  MaterialNormalizedImageSchema.parse(image);
  if (materialSha256(image.rgbaBytes) !== image.descriptor.rgbaSha256) throw new MaterialHostError("rgba-hash-mismatch", "Normalized RGBA SHA-256 does not match its descriptor.");
};

/** PNG inputs without a color profile are interpreted as sRGB. Non-sRGB profiles are rejected, never silently relabeled. */
export const decodeMaterialImage = (input: { bytes: Uint8Array; expectedOriginalFileSha256?: string }): MaterialNormalizedImage => {
  const bytes = Buffer.from(input.bytes);
  const originalFileSha256 = materialSha256(bytes);
  if (input.expectedOriginalFileSha256 !== undefined && input.expectedOriginalFileSha256 !== originalFileSha256) throw new MaterialHostError("original-hash-mismatch", "Original PNG SHA-256 mismatch.");
  validateMaterialPng(bytes);
  let decoded: { width: number; height: number; data: Buffer };
  try { decoded = png.PNG.sync.read(bytes, { checkCRC: true }); }
  catch (error) { throw new MaterialHostError("invalid-png", String(error)); }
  const { width, height } = decoded, rgbaBytes = new Uint8Array(decoded.data);
  let count = 0, translucent = 0, minX = width, minY = height, maxX = -1, maxY = -1;
  for (let i = 3; i < rgbaBytes.length; i += 4) {
    const alpha = rgbaBytes[i]!;
    if (alpha === 0) continue;
    count++; if (alpha < 255) translucent++;
    const x = ((i - 3) / 4) % width, y = Math.floor((i - 3) / 4 / width);
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (count === 0) throw new MaterialHostError("empty-alpha", "Fully transparent PNG cannot create a drawable material.");
  return MaterialNormalizedImageSchema.parse({ descriptor: {
    schemaVersion: "material-image-v1", originalFileSha256, rgbaSha256: materialSha256(rgbaBytes), width, height,
    byteLength: rgbaBytes.length, pixelFormat: "rgba8", alphaMode: "straight-alpha-v1", rowOrder: "top-to-bottom", colorSpace: "srgb",
    alpha: { nonTransparentPixelCount: count, translucentPixelCount: translucent,
      bounds: { space: "source-image-pixel-edge-v1", x: minX, y: minY, width: maxX-minX+1, height: maxY-minY+1 } },
    contentInset: { left: 0, top: 0, right: 0, bottom: 0 }
  }, rgbaBytes });
};


