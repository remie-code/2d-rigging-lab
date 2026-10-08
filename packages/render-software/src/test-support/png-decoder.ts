import { inflateSync } from "node:zlib";

/**
 * Minimal PNG decoder for tests only. Supports exactly the subset render-software
 * emits: 8-bit, color type 6 (RGBA), no interlace, filter type 0 (None) rows.
 * Pure TS + node:zlib inflateSync; no external dependency.
 */
export interface DecodedPng {
  readonly width: number;
  readonly height: number;
  /** Straight-alpha RGBA8, row-major, top-left origin. */
  readonly rgba8: Uint8Array;
}

function readUint32BigEndian(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export const decodePng = (png: Uint8Array): DecodedPng => {
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (png[index] !== PNG_SIGNATURE[index]) {
      throw new Error("Not a PNG: signature mismatch.");
    }
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatParts: Uint8Array[] = [];

  while (offset < png.length) {
    const length = readUint32BigEndian(png, offset);
    const type = String.fromCharCode(
      png[offset + 4] ?? 0,
      png[offset + 5] ?? 0,
      png[offset + 6] ?? 0,
      png[offset + 7] ?? 0
    );
    const dataStart = offset + 8;
    const data = png.subarray(dataStart, dataStart + length);

    if (type === "IHDR") {
      width = readUint32BigEndian(data, 0);
      height = readUint32BigEndian(data, 4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      interlace = data[12] ?? 0;
    } else if (type === "IDAT") {
      idatParts.push(new Uint8Array(data));
    } else if (type === "IEND") {
      break;
    }

    offset = dataStart + length + 4; // skip data + CRC
  }

  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(
      `Unsupported PNG format for test decoder: bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}.`
    );
  }

  let idatTotal = 0;
  for (const part of idatParts) {
    idatTotal += part.length;
  }
  const idat = new Uint8Array(idatTotal);
  let idatOffset = 0;
  for (const part of idatParts) {
    idat.set(part, idatOffset);
    idatOffset += part.length;
  }

  const raw = new Uint8Array(inflateSync(idat));
  const rowBytes = width * 4;
  const rgba8 = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const rawRowStart = y * (rowBytes + 1);
    const filterType = raw[rawRowStart] ?? 0;
    if (filterType !== 0) {
      throw new Error(
        `Test decoder only supports filter type 0 (None); got ${filterType} on row ${y}.`
      );
    }
    const destRowStart = y * rowBytes;
    rgba8.set(
      raw.subarray(rawRowStart + 1, rawRowStart + 1 + rowBytes),
      destRowStart
    );
  }

  return { width, height, rgba8 };
};
