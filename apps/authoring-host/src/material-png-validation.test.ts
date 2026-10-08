import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { encodeRgba8ToPng } from "@private-2d-rigging-lab/render-software";
import { decodeMaterialImage } from "./material-image-decode.js";

// Test chunks use pngjs's independent CRC implementation, not the production preflight.
const checksum = createRequire(import.meta.url)("pngjs/lib/crc.js") as { crc32(data: Buffer): number };
const chunk = (type: string, data: Uint8Array, corruptCrc = false): Buffer => {
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  output.write(type, 4, "ascii");
  output.set(data, 8);
  output.writeUInt32BE(corruptCrc ? 0 : checksum.crc32(output.subarray(4, -4)) >>> 0, output.length - 4);
  return output;
};
const integers = (...values: number[]): Buffer => {
  const bytes = Buffer.alloc(values.length * 4);
  values.forEach((value, index) => bytes.writeUInt32BE(value, index * 4));
  return bytes;
};
const pixels = new Uint8Array([200, 100, 50, 128]);
const original = Buffer.from(encodeRgba8ToPng(pixels, 1, 1));
const srgb = (intent = 0): Buffer => chunk("sRGB", new Uint8Array([intent]));
const gamma = (value = 45455): Buffer => chunk("gAMA", integers(value));
const chromaticities = (): Buffer => chunk("cHRM", integers(31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000));
const withColor = (...chunks: Buffer[]): Buffer => Buffer.concat([original.subarray(0, 33), ...chunks, original.subarray(33)]);
const beforeEnd = (...chunks: Buffer[]): Buffer => Buffer.concat([original.subarray(0, -12), ...chunks, original.subarray(-12)]);

describe("material PNG color metadata preflight (R1)", () => {
  it.each([0, 1, 2, 3])("accepts valid sRGB intent %i with consistent gamma/chromaticities and unchanged straight RGB", intent => {
    const image = decodeMaterialImage({ bytes: withColor(gamma(), chromaticities(), srgb(intent)) });
    expect(image.rgbaBytes).toEqual(pixels);
    expect(image.descriptor.colorSpace).toBe("srgb");
  });
  it.each([
    ["no metadata", original],
    ["sRGB only", withColor(srgb())],
    ["gamma only", withColor(gamma())],
    ["chromaticities only", withColor(chromaticities())],
    ["sRGB before gamma", withColor(srgb(), gamma())]
  ])("accepts %s", (_name, bytes) => {
    expect(decodeMaterialImage({ bytes: bytes as Buffer }).rgbaBytes).toEqual(pixels);
  });
  it.each([
    ["sRGB zero CRC", withColor(chunk("sRGB", new Uint8Array([0]), true))],
    ["sRGB zero length", withColor(chunk("sRGB", new Uint8Array()))],
    ["sRGB excess length", withColor(chunk("sRGB", new Uint8Array([0, 0])))],
    ["sRGB invalid intent", withColor(srgb(4))],
    ["non-sRGB gamma alone", withColor(gamma(100000))],
    ["non-sRGB gamma plus corrupt sRGB", withColor(gamma(100000), chunk("sRGB", new Uint8Array([0]), true))],
    ["corrupt sRGB preceding non-sRGB gamma", withColor(chunk("sRGB", new Uint8Array([0]), true), gamma(100000))],
    ["non-sRGB gamma plus valid sRGB", withColor(gamma(100000), srgb())],
    ["gAMA truncated payload", withColor(chunk("gAMA", new Uint8Array([0, 1, 2])))],
    ["gAMA zero value", withColor(gamma(0))],
    ["gAMA bad CRC", withColor(chunk("gAMA", integers(45455), true))],
    ["cHRM truncated payload", withColor(chunk("cHRM", integers(31270)))],
    ["cHRM bad values", withColor(chunk("cHRM", integers(0, 0, 0, 0, 0, 0, 0, 0)))],
    ["cHRM bad CRC", withColor(chunk("cHRM", integers(31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000), true))],
    ["duplicate sRGB", withColor(srgb(), srgb())],
    ["duplicate gAMA", withColor(gamma(), gamma())],
    ["duplicate cHRM", withColor(chromaticities(), chromaticities())],
    ["sRGB after IDAT", beforeEnd(srgb())],
    ["gAMA after IDAT", beforeEnd(gamma())],
    ["cHRM after IDAT", beforeEnd(chromaticities())],
    ["sRGB after PLTE", withColor(chunk("PLTE", new Uint8Array([0, 0, 0])), srgb())],
    ["gAMA after PLTE", withColor(chunk("PLTE", new Uint8Array([0, 0, 0])), gamma())],
    ["cHRM after PLTE", withColor(chunk("PLTE", new Uint8Array([0, 0, 0])), chromaticities())],
    ["color before IHDR", Buffer.concat([original.subarray(0, 8), srgb(), original.subarray(8)])],
    ["unknown ancillary corrupt CRC", withColor(chunk("teSt", new Uint8Array([1]), true))],
    ["truncated chunk framing", withColor(srgb().subarray(0, -2))],
    ["missing IEND", original.subarray(0, -12)],
    ["trailing bytes", Buffer.concat([original, Buffer.from([0])])]
  ])("rejects %s", (_name, bytes) => {
    expect(() => decodeMaterialImage({ bytes: bytes as Buffer })).toThrow();
  });
});
