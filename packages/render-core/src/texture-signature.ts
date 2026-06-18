import type { RenderRgba8TextureSource } from "./render-scene.js";
import { recordLive2dPerformanceCounter } from "./performance-instrumentation.js";

const FNV_1A_OFFSET = 0x811c9dc5;
const FNV_1A_PRIME = 0x01000193;
let signatureCacheByBytes = new WeakMap<Uint8Array, Map<string, string>>();

export interface Rgba8TextureSignatureInput {
  readonly textureId: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array;
}

export const createRgba8TextureContentSignature = (
  input: Rgba8TextureSignatureInput
): string => {
  const cacheKey = createRgba8TextureSignatureCacheKey(input);
  const cachedSignatures = signatureCacheByBytes.get(input.bytes);
  const cachedSignature = cachedSignatures?.get(cacheKey);
  if (cachedSignature !== undefined) {
    recordLive2dPerformanceCounter("textureSignature.cacheHits");
    return cachedSignature;
  }

  recordLive2dPerformanceCounter("textureSignature.cacheMisses");
  recordLive2dPerformanceCounter("textureSignature.bytesHashed", input.bytes.byteLength);
  let hash = FNV_1A_OFFSET;
  hash = mixString(hash, input.textureId);
  hash = mixNumber(hash, input.width);
  hash = mixNumber(hash, input.height);
  hash = mixNumber(hash, input.bytes.byteLength);

  for (const byte of input.bytes) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_1A_PRIME) >>> 0;
  }

  const signature = `rgba8-fnv1a32:${hash.toString(16).padStart(8, "0")}`;
  const nextSignatures = cachedSignatures ?? new Map<string, string>();
  nextSignatures.set(cacheKey, signature);
  if (cachedSignatures === undefined) {
    signatureCacheByBytes.set(input.bytes, nextSignatures);
  }

  return signature;
};

export const createRenderTextureCacheKey = (source: RenderRgba8TextureSource): string =>
  [
    source.kind,
    source.textureId,
    `${source.width}x${source.height}`,
    source.alphaMode,
    source.contentSignature
  ].join(":");

export const clearRgba8TextureContentSignatureCache = (): void => {
  signatureCacheByBytes = new WeakMap<Uint8Array, Map<string, string>>();
};

function createRgba8TextureSignatureCacheKey(input: Rgba8TextureSignatureInput): string {
  return [
    input.textureId,
    input.width,
    input.height,
    input.bytes.byteLength
  ].join(":");
}

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
