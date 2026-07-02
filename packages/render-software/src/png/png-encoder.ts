import { deflateSync, constants as zlibConstants } from "node:zlib";

import { crc32 } from "./crc32.js";

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Fixed deflate settings for deterministic PNG bytes. Level and strategy are
 * pinned so identical input always yields identical compressed output. memLevel
 * is pinned as well because it can influence the emitted stream.
 */
const DEFLATE_OPTIONS = {
  level: 9,
  memLevel: 8,
  strategy: zlibConstants.Z_DEFAULT_STRATEGY
} as const;

function writeUint32BigEndian(target: Uint8Array, offset: number, value: number): void {
  target[offset] = (value >>> 24) & 0xff;
  target[offset + 1] = (value >>> 16) & 0xff;
  target[offset + 2] = (value >>> 8) & 0xff;
  target[offset + 3] = value & 0xff;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array(4);
  for (let index = 0; index < 4; index += 1) {
    typeBytes[index] = type.charCodeAt(index);
  }

  const out = new Uint8Array(12 + data.length);
  writeUint32BigEndian(out, 0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);

  const crcInput = new Uint8Array(4 + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, 4);
  writeUint32BigEndian(out, 8 + data.length, crc32(crcInput));
  return out;
}

/**
 * Build the raw (pre-compression) IDAT payload: each scanline is prefixed with
 * a single filter-type byte. We use filter type 0 (None) on every row, which is
 * a fixed, deterministic choice independent of pixel content.
 */
function buildRawImageData(
  rgba8: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const rowBytes = width * 4;
  const raw = new Uint8Array(height * (rowBytes + 1));
  for (let y = 0; y < height; y += 1) {
    const rawRowStart = y * (rowBytes + 1);
    raw[rawRowStart] = 0; // filter type: None
    const sourceRowStart = y * rowBytes;
    raw.set(rgba8.subarray(sourceRowStart, sourceRowStart + rowBytes), rawRowStart + 1);
  }
  return raw;
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) {
    total += part.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * Encode an RGBA8 buffer (row-major, top-left origin, straight alpha, 4 bytes
 * per pixel) as PNG bytes.
 *
 * Deterministic: 8-bit color type 6 (RGBA), filter 0 (None) on every row, fixed
 * deflate level/strategy/memLevel. Identical (rgba8, width, height) input always
 * yields byte-identical PNG output. No external PNG dependency is used;
 * compression is node:zlib deflateSync.
 */
export const encodeRgba8ToPng = (
  rgba8: Uint8Array,
  width: number,
  height: number
): Uint8Array => {
  if (width <= 0 || height <= 0) {
    throw new Error(`PNG dimensions must be positive; got ${width}x${height}.`);
  }
  const expectedLength = width * height * 4;
  if (rgba8.length !== expectedLength) {
    throw new Error(
      `RGBA8 buffer length ${rgba8.length} does not match ${width}x${height} (expected ${expectedLength}).`
    );
  }

  const ihdrData = new Uint8Array(13);
  writeUint32BigEndian(ihdrData, 0, width);
  writeUint32BigEndian(ihdrData, 4, height);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression method: deflate
  ihdrData[11] = 0; // filter method: adaptive (only filter 0 used)
  ihdrData[12] = 0; // interlace: none

  const raw = buildRawImageData(rgba8, width, height);
  const compressed = new Uint8Array(deflateSync(raw, DEFLATE_OPTIONS));

  return concatBytes([
    PNG_SIGNATURE,
    chunk("IHDR", ihdrData),
    chunk("IDAT", compressed),
    chunk("IEND", new Uint8Array(0))
  ]);
};
