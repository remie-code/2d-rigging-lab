import {
  orderRenderDrawablesBackToFront,
  recordLive2dPerformanceCounter,
  type RenderDrawable,
  type RendererBackend,
  type RenderRgba8TextureSource,
  type RenderScene,
  type RenderViewport
} from "@private-2d-rigging-lab/render-core";

import type {
  WebGl2Buffer,
  WebGl2CanvasSurface,
  WebGl2Framebuffer,
  WebGl2Like,
  WebGl2Texture
} from "./webgl2-context.js";
import { createWebGl2MeshUpload } from "./webgl2-mesh.js";
import { createWebGl2ProgramInfo, type WebGl2ProgramInfo } from "./webgl2-shaders.js";
import { WebGl2TextureCache } from "./webgl2-textures.js";

interface WebGl2MaskTarget {
  readonly width: number;
  readonly height: number;
  readonly framebuffer: WebGl2Framebuffer;
  readonly texture: WebGl2Texture;
}

export class WebGl2Renderer implements RendererBackend {
  private readonly textureCache: WebGl2TextureCache;
  private readonly vertexBuffer: WebGl2Buffer;
  private readonly indexBuffer: WebGl2Buffer;
  private readonly programInfo: WebGl2ProgramInfo;
  private maskTarget: WebGl2MaskTarget | undefined;
  private disposed = false;

  constructor(private readonly gl: WebGl2Like) {
    this.programInfo = createWebGl2ProgramInfo(gl);
    this.textureCache = new WebGl2TextureCache(gl);
    const vertexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    if (vertexBuffer === null || indexBuffer === null) {
      throw new Error("WebGL2 buffer creation failed.");
    }

    this.vertexBuffer = vertexBuffer;
    this.indexBuffer = indexBuffer;
  }

  render(scene: RenderScene, viewport: RenderViewport): void {
    if (this.disposed) {
      throw new Error("Cannot render with a disposed WebGl2Renderer.");
    }

    const safeViewport = normalizeViewport(viewport);
    const textureSourcesById = new Map(
      scene.textureSources
        .filter((source): source is RenderRgba8TextureSource => source.kind === "rgba8")
        .map((source) => [source.textureId, source])
    );
    const orderedDrawables = orderRenderDrawablesBackToFront(scene.drawables);
    const drawableById = new Map(orderedDrawables.map((drawable) => [drawable.drawableId, drawable]));

    this.prepareFrame(safeViewport);
    for (const drawable of orderedDrawables) {
      const source = textureSourcesById.get(drawable.textureRef.textureId);
      if (!isDrawableRenderable(drawable) || source === undefined) {
        continue;
      }

      const clipping = drawable.clipping;
      if (clipping === undefined || clipping.maskDrawableIds.length === 0) {
        this.drawDrawable(drawable, source, safeViewport, undefined);
        continue;
      }

      const maskDrawables = clipping.maskDrawableIds
        .map((drawableId) => drawableById.get(drawableId))
        .filter((mask): mask is RenderDrawable =>
          mask !== undefined &&
          isDrawableRenderable(mask) &&
          textureSourcesById.has(mask.textureRef.textureId)
        );
      if (maskDrawables.length === 0) {
        continue;
      }

      const maskTexture = this.renderMaskTexture(maskDrawables, textureSourcesById, safeViewport);
      this.drawDrawable(drawable, source, safeViewport, maskTexture);
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.textureCache.dispose();
    if (this.maskTarget !== undefined) {
      this.gl.deleteFramebuffer(this.maskTarget.framebuffer);
      this.gl.deleteTexture(this.maskTarget.texture);
      this.maskTarget = undefined;
    }

    this.gl.deleteBuffer(this.vertexBuffer);
    this.gl.deleteBuffer(this.indexBuffer);
    this.gl.deleteProgram(this.programInfo.program);
    this.disposed = true;
  }

  private prepareFrame(viewport: RenderViewport): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.viewport(0, 0, viewport.width, viewport.height);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
  }

  private renderMaskTexture(
    maskDrawables: readonly RenderDrawable[],
    textureSourcesById: ReadonlyMap<string, RenderRgba8TextureSource>,
    viewport: RenderViewport
  ): WebGl2Texture {
    const maskTarget = this.ensureMaskTarget(viewport);
    this.unbindRendererSamplerTextures();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, maskTarget.framebuffer);
    this.gl.viewport(0, 0, viewport.width, viewport.height);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);

    for (const drawable of orderRenderDrawablesBackToFront(maskDrawables)) {
      const source = textureSourcesById.get(drawable.textureRef.textureId);
      if (source !== undefined) {
        this.drawDrawable(drawable, source, viewport, undefined);
      }
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.viewport(0, 0, viewport.width, viewport.height);
    return maskTarget.texture;
  }

  private ensureMaskTarget(viewport: RenderViewport): WebGl2MaskTarget {
    if (
      this.maskTarget !== undefined &&
      this.maskTarget.width === viewport.width &&
      this.maskTarget.height === viewport.height
    ) {
      return this.maskTarget;
    }

    if (this.maskTarget !== undefined) {
      this.gl.deleteFramebuffer(this.maskTarget.framebuffer);
      this.gl.deleteTexture(this.maskTarget.texture);
    }

    const texture = this.gl.createTexture();
    const framebuffer = this.gl.createFramebuffer();
    if (texture === null || framebuffer === null) {
      throw new Error("WebGL2 mask target creation failed.");
    }

    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      viewport.width,
      viewport.height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      null
    );
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      texture,
      0
    );
    if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !== this.gl.FRAMEBUFFER_COMPLETE) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.gl.deleteFramebuffer(framebuffer);
      this.gl.deleteTexture(texture);
      throw new Error("WebGL2 mask framebuffer is incomplete.");
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    this.maskTarget = {
      width: viewport.width,
      height: viewport.height,
      framebuffer,
      texture
    };
    return this.maskTarget;
  }

  private unbindRendererSamplerTextures(): void {
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }

  private drawDrawable(
    drawable: RenderDrawable,
    textureSource: RenderRgba8TextureSource,
    viewport: RenderViewport,
    maskTexture: WebGl2Texture | undefined
  ): void {
    const upload = createWebGl2MeshUpload(drawable.mesh);
    if (upload === undefined) {
      return;
    }

    recordLive2dPerformanceCounter("webgl2.meshUploads");
    recordLive2dPerformanceCounter(
      "webgl2.meshUploadVertexBytes",
      upload.vertices.byteLength
    );
    recordLive2dPerformanceCounter(
      "webgl2.meshUploadIndexBytes",
      upload.indices.byteLength
    );
    const texture = this.textureCache.getTexture(textureSource);
    const stageToClip = createStageToClipUniform(viewport);
    this.gl.useProgram(this.programInfo.program);
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.uniform1i(this.programInfo.uniforms.texture, 0);
    if (maskTexture === undefined) {
      this.gl.uniform1i(this.programInfo.uniforms.useMask, 0);
      this.gl.uniform1i(this.programInfo.uniforms.maskTexture, 1);
    } else {
      this.gl.activeTexture(this.gl.TEXTURE1);
      this.gl.bindTexture(this.gl.TEXTURE_2D, maskTexture);
      this.gl.uniform1i(this.programInfo.uniforms.maskTexture, 1);
      this.gl.uniform1i(this.programInfo.uniforms.useMask, 1);
    }

    this.gl.uniform1f(this.programInfo.uniforms.opacity, clamp01(drawable.opacity));
    this.gl.uniform2f(this.programInfo.uniforms.viewportSize, viewport.width, viewport.height);
    this.gl.uniform4f(
      this.programInfo.uniforms.stageToClip,
      stageToClip.xScale,
      stageToClip.yScale,
      stageToClip.xTranslate,
      stageToClip.yTranslate
    );

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    recordLive2dPerformanceCounter("webgl2.bufferDataCalls");
    this.gl.bufferData(this.gl.ARRAY_BUFFER, upload.vertices, this.gl.DYNAMIC_DRAW);
    this.gl.enableVertexAttribArray(this.programInfo.attributes.position);
    this.gl.vertexAttribPointer(this.programInfo.attributes.position, 2, this.gl.FLOAT, false, 16, 0);
    this.gl.enableVertexAttribArray(this.programInfo.attributes.uv);
    this.gl.vertexAttribPointer(this.programInfo.attributes.uv, 2, this.gl.FLOAT, false, 16, 8);

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    recordLive2dPerformanceCounter("webgl2.bufferDataCalls");
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, upload.indices, this.gl.DYNAMIC_DRAW);
    this.gl.drawElements(
      this.gl.TRIANGLES,
      upload.indices.length,
      upload.indexElementType === "uint32" ? this.gl.UNSIGNED_INT : this.gl.UNSIGNED_SHORT,
      0
    );
  }
}

export const createWebGl2RendererFromCanvas = (
  canvas: WebGl2CanvasSurface,
  attributes: object = {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    stencil: false
  }
): WebGl2Renderer | undefined => {
  const gl = canvas.getContext("webgl2", attributes);
  return gl === null ? undefined : new WebGl2Renderer(gl);
};

function normalizeViewport(viewport: RenderViewport): RenderViewport {
  return {
    width: Math.max(1, Math.floor(viewport.width)),
    height: Math.max(1, Math.floor(viewport.height)),
    stageToViewport: {
      scale: Number.isFinite(viewport.stageToViewport.scale)
        ? viewport.stageToViewport.scale
        : 1,
      translate: {
        x: Number.isFinite(viewport.stageToViewport.translate.x)
          ? viewport.stageToViewport.translate.x
          : 0,
        y: Number.isFinite(viewport.stageToViewport.translate.y)
          ? viewport.stageToViewport.translate.y
          : 0
      }
    }
  };
}

function isDrawableRenderable(drawable: RenderDrawable): boolean {
  return drawable.visible && drawable.opacity > 0;
}

function createStageToClipUniform(viewport: RenderViewport): {
  readonly xScale: number;
  readonly yScale: number;
  readonly xTranslate: number;
  readonly yTranslate: number;
} {
  const scale = viewport.stageToViewport.scale;
  const translate = viewport.stageToViewport.translate;

  return {
    xScale: (scale * 2) / viewport.width,
    yScale: (-scale * 2) / viewport.height,
    xTranslate: (translate.x * 2) / viewport.width - 1,
    yTranslate: 1 - (translate.y * 2) / viewport.height
  };
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
