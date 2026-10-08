import { MaterialHostError } from "./material-host-error.js";

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const srgbChromaticities = [31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000];
const colorChunks = new Set(["sRGB", "gAMA", "cHRM", "iCCP", "cICP"]);
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
const invalid = (message: string): never => { throw new MaterialHostError("invalid-png", message); };

/**
 * pngjs skips unknown ancillary chunks, including their CRCs. Validate every
 * chunk before any color declaration can authorize unconverted sRGB intake.
 * Raster/filter/bit-depth validation remains the decoder's responsibility.
 */
export const validateMaterialPng = (bytes: Buffer): void => {
  if (!bytes.subarray(0, 8).equals(signature)) invalid("Expected a PNG image.");
  const seen = new Set<string>();
  let idatEnded = false;
  for (let offset = 8; offset < bytes.length;) {
    if (offset + 12 > bytes.length) invalid("Truncated PNG chunk.");
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    const end = offset + length + 12;
    if (length > 0x7fffffff || end > bytes.length) invalid("Invalid or truncated PNG chunk length.");
    if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type)) invalid("Invalid PNG chunk type.");
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) invalid(`PNG ${type} CRC mismatch.`);
    if (offset === 8 && type !== "IHDR") invalid("IHDR must be the first PNG chunk.");
    if (type === "IHDR" && (seen.has(type) || length !== 13)) invalid("PNG requires one 13-byte IHDR chunk.");
    if (colorChunks.has(type)) {
      if (seen.has(type)) invalid(`Duplicate PNG ${type} color declaration.`);
      if (seen.has("PLTE") || seen.has("IDAT")) invalid(`PNG ${type} must precede PLTE and IDAT.`);
      validateColorChunk(type, bytes.subarray(offset + 8, end - 4));
    }
    if (type === "PLTE" && (seen.has(type) || seen.has("IDAT") || length === 0 || length > 768 || length % 3 !== 0)) invalid("Invalid or misplaced PNG palette.");
    if (type === "IDAT") {
      if (idatEnded) invalid("PNG IDAT chunks must be consecutive.");
    } else if (seen.has("IDAT")) {
      idatEnded = true;
    }
    if (type === "acTL") throw new MaterialHostError("animated-png", "Animated PNG is not a single rest material.");
    if (type === "IEND") {
      if (length !== 0 || !seen.has("IDAT")) invalid("PNG IEND must be empty and follow image data.");
      if (end !== bytes.length) invalid("Trailing PNG data.");
    }
    seen.add(type);
    offset = end;
  }
  if (!seen.has("IHDR") || !seen.has("IDAT") || !seen.has("IEND")) invalid("PNG requires IHDR, IDAT and final IEND chunks.");
};

const validateColorChunk = (type: string, data: Buffer): void => {
  if (type === "sRGB") {
    if (data.length !== 1 || data[0]! > 3) invalid("PNG sRGB requires one rendering intent byte in 0..3.");
    return;
  }
  if (type === "gAMA") {
    if (data.length !== 4 || data.readUInt32BE(0) === 0) invalid("PNG gAMA requires one positive uint32 gamma.");
    // Reject contradictory gAMA even with a valid sRGB chunk: never let one
    // declaration mask an unsupported transfer curve in another declaration.
    if (data.readUInt32BE(0) !== 45455) throw new MaterialHostError("unsupported-color-profile", "PNG gamma is not sRGB.");
    return;
  }
  if (type === "cHRM") {
    if (data.length !== 32) invalid("PNG cHRM requires eight uint32 chromaticities.");
    if (srgbChromaticities.some((value, index) => data.readUInt32BE(index * 4) !== value)) throw new MaterialHostError("unsupported-color-profile", "PNG chromaticities are not sRGB.");
    return;
  }
  throw new MaterialHostError("unsupported-color-profile", `PNG ${type} color metadata requires color conversion before intake.`);
};

