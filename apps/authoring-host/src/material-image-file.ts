import { readFile } from "node:fs/promises";
import type { MaterialImageFileRef, MaterialNormalizedImage } from "@private-2d-rigging-lab/contracts";
import { HostError } from "./host-error.js";
import { decodeMaterialImage } from "./material-image-decode.js";

/**
 * Reads the PNG a MaterialImageFileRef names, validates it, normalizes it to straight-alpha RGBA8 and checks every
 * fact the reference declares: zero content inset (padding is not supported yet), decoded width/height, and the
 * SHA-256 of the normalized RGBA bytes (computed synchronously here). Rejections are HostError.
 */
export const readMaterialImageFile = async (ref: MaterialImageFileRef): Promise<MaterialNormalizedImage> => {
  const inset = ref.contentInset;
  if (inset.left !== 0 || inset.top !== 0 || inset.right !== 0 || inset.bottom !== 0) {
    throw new HostError("content-inset-unsupported", "Image contentInset must be all zero; padded material images are not supported.");
  }
  let bytes: Buffer;
  try {
    bytes = await readFile(ref.imagePath);
  } catch (error) {
    throw new HostError("image-unreadable", `Cannot read image ${ref.imagePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const image = decodeMaterialImage({ bytes });
  const { width, height, rgbaSha256 } = image.descriptor;
  if (width !== ref.width || height !== ref.height) {
    throw new HostError("image-dimensions-mismatch", `Decoded image is ${width}x${height}; the payload declares ${ref.width}x${ref.height}.`);
  }
  if (rgbaSha256 !== ref.rgbaSha256) {
    throw new HostError("image-digest-mismatch", `Normalized RGBA SHA-256 is ${rgbaSha256}; the payload declares ${ref.rgbaSha256}.`);
  }
  return image;
};
