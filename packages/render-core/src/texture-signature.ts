import type { RenderRgba8TextureSource } from "./render-scene.js";

const FNV_1A_OFFSET = 0x811c9dc5;
const FNV_1A_PRIME = 0x01000193;

export interface Rgba8TextureSignatureInput {
  readonly textureId: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array;
}

export const createRgba8TextureContentSignature = (
  input: Rgba8TextureSignatureInput
): string => {
  let hash = FNV_1A_OFFSET;
  hash = mixString(hash, input.textureId);
  hash = mixNumber(hash, input.width);
  hash = mixNumber(hash, input.height);
  hash = mixNumber(hash, input.bytes.byteLength);

  for (const byte of input.bytes) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_1A_PRIME) >>> 0;
  }

  return `rgba8-fnv1a32:${hash.toString(16).padStart(8, "0")}`;
};

export const createRenderTextureCacheKey = (source: RenderRgba8TextureSource): string =>
  [
    source.kind,
    source.textureId,
    `${source.width}x${source.height}`,
    source.alphaMode,
    source.contentSignature
  ].join(":");

function mixString(hash: number, value: string): number {
  let next = hash;
  for (let index = 0; index < value.length; index += 1) {
    next ^= value.charCodeAt(index) & 0xff;
    next = Math.imul(next, FNV_1A_PRIME) >>> 0;
  }

  return next;
}

function mixNumber(hash: number, value: number): number {
  let next = hash;
  const normalized = Math.max(0, Math.floor(value));
  for (let shift = 0; shift < 32; shift += 8) {
    next ^= (normalized >>> shift) & 0xff;
    next = Math.imul(next, FNV_1A_PRIME) >>> 0;
  }

  return next;
}
