import {
  createRenderTextureCacheKey,
  type RenderRgba8TextureSource
} from "@private-2d-rigging-lab/render-core";

import type { WebGl2Like, WebGl2Texture } from "./webgl2-context.js";

interface TextureCacheEntry {
  readonly key: string;
  readonly texture: WebGl2Texture;
}

export class WebGl2TextureCache {
  private readonly entriesByTextureId = new Map<string, TextureCacheEntry>();

  constructor(private readonly gl: WebGl2Like) {}

  getTexture(source: RenderRgba8TextureSource): WebGl2Texture {
    const key = createRenderTextureCacheKey(source);
    const cached = this.entriesByTextureId.get(source.textureId);
    if (cached?.key === key) {
      return cached.texture;
    }

    if (cached !== undefined) {
      this.gl.deleteTexture(cached.texture);
    }

    const texture = this.gl.createTexture();
    if (texture === null) {
      throw new Error(`WebGL2 texture creation failed for ${source.textureId}.`);
    }

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      source.width,
      source.height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      createUploadBytes(source)
    );

    this.entriesByTextureId.set(source.textureId, { key, texture });
    return texture;
  }

  dispose(): void {
    for (const entry of this.entriesByTextureId.values()) {
      this.gl.deleteTexture(entry.texture);
    }
    this.entriesByTextureId.clear();
  }
}

function createUploadBytes(source: RenderRgba8TextureSource): Uint8Array {
  if (source.alphaMode === "premultiplied") {
    return source.bytes;
  }

  const premultiplied = new Uint8Array(source.bytes);
  for (let offset = 0; offset < premultiplied.length; offset += 4) {
    const alpha = premultiplied[offset + 3] ?? 0;
    premultiplied[offset] = Math.round(((premultiplied[offset] ?? 0) * alpha) / 255);
    premultiplied[offset + 1] = Math.round(((premultiplied[offset + 1] ?? 0) * alpha) / 255);
    premultiplied[offset + 2] = Math.round(((premultiplied[offset + 2] ?? 0) * alpha) / 255);
  }

  return premultiplied;
}
