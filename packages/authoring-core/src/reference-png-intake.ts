import {
  REFERENCE_IMAGE_MAX_BYTES,
  REFERENCE_IMAGE_MAX_DIMENSION,
  REFERENCE_IMAGE_MAX_PIXELS
} from "@private-2d-rigging-lab/contracts";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/** Shared intake preflight. A browser or Host decoder must still decode the complete raster before registration. */
export const readReferencePngDimensions = (bytes: Uint8Array): { width: number; height: number } => {
  if (bytes.byteLength < 45 || bytes.byteLength > REFERENCE_IMAGE_MAX_BYTES ||
      !PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
    throw new Error("Expected a complete PNG image up to 64 MiB.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) {
    throw new Error("Reference PNG must start with a valid IHDR chunk.");
  }
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width === 0 || height === 0 ||
      Math.max(width, height) > REFERENCE_IMAGE_MAX_DIMENSION ||
      width * height > REFERENCE_IMAGE_MAX_PIXELS) {
    throw new Error(`Unsupported PNG dimensions ${width}×${height}.`);
  }

  let hasImageData = false;
  for (let offset = 8; offset + 12 <= bytes.byteLength;) {
    const size = view.getUint32(offset);
    const kind = view.getUint32(offset + 4);
    const next = offset + size + 12;
    if (next > bytes.byteLength) break;
    if (kind === 0x6163544c) throw new Error("Animated PNG is unsupported for a reference image.");
    if (kind === 0x49444154) hasImageData = true;
    if (kind === 0x49454e44) {
      if (hasImageData && size === 0 && next === bytes.byteLength && view.getUint32(offset + 8) === 0xae426082) {
        return { width, height };
      }
      break;
    }
    offset = next;
  }
  throw new Error("Reference PNG is missing complete image data or a final IEND chunk.");
};
