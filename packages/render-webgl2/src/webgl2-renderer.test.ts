import {
  DEFAULT_RENDER_BLEND_MODE,
  DEFAULT_RENDER_MESH_COORDINATE_SPACE,
  DEFAULT_RENDER_UV_SPACE,
  createRenderScene,
  type RenderDrawable,
  type RenderRgba8TextureSource
} from "@private-2d-rigging-lab/render-core";
import { describe, expect, it } from "vitest";

import { WebGl2Renderer } from "./webgl2-renderer.js";
import type {
  WebGl2Buffer,
  WebGl2Framebuffer,
  WebGl2Like,
  WebGl2Program,
  WebGl2Shader,
  WebGl2Texture,
  WebGl2UniformLocation
} from "./webgl2-context.js";

interface RecordedGlCall {
  readonly name: string;
  readonly args: readonly unknown[];
}

interface FeedbackLoopViolation {
  readonly framebuffer: WebGl2Framebuffer;
  readonly attachedTexture: WebGl2Texture;
  readonly textureUnits: readonly number[];
}

describe("WebGl2Renderer", () => {
  it("renders a textured mesh with premultiplied-alpha-friendly blending", () => {
    const gl = new FakeWebGl2Context();
    const renderer = new WebGl2Renderer(gl);

    renderer.render(createRenderScene({
      textureSources: [createTextureSource("tex_main")],
      drawables: [createDrawable("draw_main", "tex_main")]
    }), createViewport());

    expect(gl.calls.some((call) => call.name === "blendFunc" && call.args[0] === gl.ONE && call.args[1] === gl.ONE_MINUS_SRC_ALPHA)).toBe(true);
    expect(gl.calls.some((call) => call.name === "texImage2D")).toBe(true);
    expect(gl.calls.some((call) => call.name === "drawElements" && call.args[1] === 3)).toBe(true);
    expect(gl.calls.some((call) => call.name === "bufferData" && call.args[1] instanceof Float32Array)).toBe(true);
  });

  it("uploads layer source textures with NEAREST min/mag filtering and CLAMP_TO_EDGE wrap", () => {
    const gl = new FakeWebGl2Context();
    const renderer = new WebGl2Renderer(gl);

    // No masks: the only texParameteri filter calls come from the layer source
    // texture upload path (webgl2-textures.ts).
    renderer.render(createRenderScene({
      textureSources: [createTextureSource("tex_main")],
      drawables: [createDrawable("draw_main", "tex_main")]
    }), createViewport());

    const filterCalls = gl.calls.filter(
      (call) =>
        call.name === "texParameteri" &&
        (call.args[1] === gl.TEXTURE_MIN_FILTER || call.args[1] === gl.TEXTURE_MAG_FILTER)
    );
    expect(filterCalls.length).toBeGreaterThan(0);
    expect(
      filterCalls.some((call) => call.args[1] === gl.TEXTURE_MIN_FILTER && call.args[2] === gl.NEAREST)
    ).toBe(true);
    expect(
      filterCalls.some((call) => call.args[1] === gl.TEXTURE_MAG_FILTER && call.args[2] === gl.NEAREST)
    ).toBe(true);
    // No layer source texture is sampled with LINEAR.
    expect(filterCalls.every((call) => call.args[2] === gl.NEAREST)).toBe(true);
    // Wrap stays CLAMP_TO_EDGE.
    expect(
      gl.calls.some(
        (call) =>
          call.name === "texParameteri" &&
          call.args[1] === gl.TEXTURE_WRAP_S &&
          call.args[2] === gl.CLAMP_TO_EDGE
      )
    ).toBe(true);
    expect(
      gl.calls.some(
        (call) =>
          call.name === "texParameteri" &&
          call.args[1] === gl.TEXTURE_WRAP_T &&
          call.args[2] === gl.CLAMP_TO_EDGE
      )
    ).toBe(true);
  });

  it("reuses cached textures for an unchanged signature", () => {
    const gl = new FakeWebGl2Context();
    const renderer = new WebGl2Renderer(gl);
    const scene = createRenderScene({
      textureSources: [createTextureSource("tex_main")],
      drawables: [createDrawable("draw_main", "tex_main")]
    });

    renderer.render(scene, createViewport());
    renderer.render(scene, createViewport());

    expect(gl.calls.filter((call) => call.name === "texImage2D")).toHaveLength(1);
  });

  it("renders drawable alpha masks through a WebGL framebuffer path", () => {
    const gl = new FakeWebGl2Context();
    const renderer = new WebGl2Renderer(gl);
    const scene = createRenderScene({
      textureSources: [
        createTextureSource("tex_mask"),
        createTextureSource("tex_target")
      ],
      drawables: [
        createDrawable("draw_mask", "tex_mask", { drawOrder: 1 }),
        createDrawable("draw_target", "tex_target", {
          drawOrder: 0,
          clippingMaskIds: ["draw_mask"]
        })
      ]
    });

    renderer.render(scene, createViewport());

    expect(gl.calls.some((call) => call.name === "createFramebuffer")).toBe(true);
    expect(
      gl.calls.some(
        (call) => call.name === "bindFramebuffer" && call.args[1] !== null
      )
    ).toBe(true);
    expect(
      gl.calls.some(
        (call) =>
          call.name === "uniform1i" &&
          isUniformLocation(call.args[0], "u_useMask") &&
          call.args[1] === 1
      )
    ).toBe(true);
    expect(gl.calls.filter((call) => call.name === "drawElements")).toHaveLength(3);
    expect(gl.feedbackLoopViolations).toEqual([]);
  });

  it("does not bind the newly-created mask target while drawing the first mask pass", () => {
    const gl = new FakeWebGl2Context();
    const renderer = new WebGl2Renderer(gl);
    const scene = createRenderScene({
      textureSources: [
        createTextureSource("tex_mask"),
        createTextureSource("tex_target")
      ],
      drawables: [
        createDrawable("draw_mask", "tex_mask", { drawOrder: 1 }),
        createDrawable("draw_target", "tex_target", {
          drawOrder: 0,
          clippingMaskIds: ["draw_mask"]
        })
      ]
    });

    renderer.render(scene, createViewport());

    expect(gl.feedbackLoopViolations).toEqual([]);
    expect(gl.calls.filter((call) => call.name === "createFramebuffer")).toHaveLength(1);
    expect(gl.calls.filter((call) => call.name === "drawElements")).toHaveLength(3);
  });

  it("does not bind a reused mask target while drawing repeated mask passes", () => {
    const gl = new FakeWebGl2Context();
    const renderer = new WebGl2Renderer(gl);
    const scene = createRenderScene({
      textureSources: [
        createTextureSource("tex_mask"),
        createTextureSource("tex_target_a"),
        createTextureSource("tex_target_b")
      ],
      drawables: [
        createDrawable("draw_mask", "tex_mask", { drawOrder: 2 }),
        createDrawable("draw_target_a", "tex_target_a", {
          drawOrder: 1,
          clippingMaskIds: ["draw_mask"]
        }),
        createDrawable("draw_target_b", "tex_target_b", {
          drawOrder: 0,
          clippingMaskIds: ["draw_mask"]
        })
      ]
    });

    renderer.render(scene, createViewport());

    expect(gl.feedbackLoopViolations).toEqual([]);
    expect(gl.calls.filter((call) => call.name === "createFramebuffer")).toHaveLength(1);
    expect(gl.calls.filter((call) => call.name === "drawElements")).toHaveLength(5);
  });

  it("skips clipped drawables when all mask sources are missing or unrenderable", () => {
    const gl = new FakeWebGl2Context();
    const renderer = new WebGl2Renderer(gl);
    const scene = createRenderScene({
      textureSources: [
        createTextureSource("tex_background"),
        createTextureSource("tex_invisible_mask"),
        createTextureSource("tex_target")
      ],
      drawables: [
        createDrawable("draw_invisible_mask", "tex_invisible_mask", {
          drawOrder: 2,
          visible: false
        }),
        createDrawable("draw_mask_without_texture", "tex_missing_mask", { drawOrder: 1 }),
        createDrawable("draw_target", "tex_target", {
          drawOrder: 0,
          clippingMaskIds: [
            "draw_missing_mask",
            "draw_invisible_mask",
            "draw_mask_without_texture"
          ]
        }),
        createDrawable("draw_background", "tex_background", { drawOrder: -1 })
      ]
    });

    renderer.render(scene, createViewport());

    expect(gl.calls.filter((call) => call.name === "drawElements")).toHaveLength(1);
    expect(gl.calls.some((call) => call.name === "createFramebuffer")).toBe(false);
    expect(
      gl.calls.some(
        (call) =>
          call.name === "uniform1i" &&
          isUniformLocation(call.args[0], "u_useMask") &&
          call.args[1] === 1
      )
    ).toBe(false);
    expect(gl.feedbackLoopViolations).toEqual([]);
  });
});

function createViewport() {
  return {
    width: 64,
    height: 64,
    stageToViewport: {
      scale: 1,
      translate: { x: 0, y: 0 }
    }
  };
}

function createTextureSource(textureId: string): RenderRgba8TextureSource {
  return {
    kind: "rgba8",
    textureId,
    width: 1,
    height: 1,
    bytes: new Uint8Array([255, 128, 0, 128]),
    alphaMode: "straight",
    contentSignature: `sig:${textureId}`
  };
}

function createDrawable(
  drawableId: string,
  textureId: string,
  options: {
    readonly drawOrder?: number;
    readonly clippingMaskIds?: readonly string[];
    readonly opacity?: number;
    readonly visible?: boolean;
  } = {}
): RenderDrawable {
  return {
    drawableId,
    textureRef: { textureId },
    mesh: {
      coordinateSpace: DEFAULT_RENDER_MESH_COORDINATE_SPACE,
      uvSpace: DEFAULT_RENDER_UV_SPACE,
      vertices: [
        { x: 0, y: 0 },
        { x: 32, y: 0 },
        { x: 0, y: 32 }
      ],
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ],
      triangles: [[0, 1, 2]]
    },
    opacity: options.opacity ?? 0.5,
    drawOrder: options.drawOrder ?? 0,
    stableIndex: 0,
    visible: options.visible ?? true,
    blendMode: DEFAULT_RENDER_BLEND_MODE,
    ...(options.clippingMaskIds === undefined
      ? {}
      : {
          clipping: {
            mode: "drawable-alpha-mask-v0",
            maskDrawableIds: options.clippingMaskIds
          }
        })
  };
}

class FakeWebGl2Context implements WebGl2Like {
  readonly calls: RecordedGlCall[] = [];
  readonly feedbackLoopViolations: FeedbackLoopViolation[] = [];
  readonly VERTEX_SHADER = 1;
  readonly FRAGMENT_SHADER = 2;
  readonly COMPILE_STATUS = 3;
  readonly LINK_STATUS = 4;
  readonly ARRAY_BUFFER = 5;
  readonly ELEMENT_ARRAY_BUFFER = 6;
  readonly DYNAMIC_DRAW = 7;
  readonly STATIC_DRAW = 8;
  readonly FLOAT = 9;
  readonly TRIANGLES = 10;
  readonly UNSIGNED_SHORT = 11;
  readonly UNSIGNED_INT = 12;
  readonly TEXTURE_2D = 13;
  readonly TEXTURE0 = 14;
  readonly TEXTURE1 = 15;
  readonly RGBA = 16;
  readonly UNSIGNED_BYTE = 17;
  readonly UNPACK_ALIGNMENT = 18;
  readonly TEXTURE_WRAP_S = 19;
  readonly TEXTURE_WRAP_T = 20;
  readonly CLAMP_TO_EDGE = 21;
  readonly TEXTURE_MIN_FILTER = 22;
  readonly TEXTURE_MAG_FILTER = 23;
  readonly LINEAR = 24;
  readonly NEAREST = 241;
  readonly BLEND = 25;
  readonly ONE = 26;
  readonly ONE_MINUS_SRC_ALPHA = 27;
  readonly COLOR_BUFFER_BIT = 28;
  readonly FRAMEBUFFER = 29;
  readonly COLOR_ATTACHMENT0 = 30;
  readonly FRAMEBUFFER_COMPLETE = 31;

  private nextObjectId = 1;
  private activeTextureUnit = this.TEXTURE0;
  private currentFramebuffer: WebGl2Framebuffer | null = null;
  private readonly textureBindingsByUnit = new Map<number, WebGl2Texture | null>();
  private readonly colorAttachmentByFramebuffer = new Map<WebGl2Framebuffer, WebGl2Texture | null>();

  createShader(type: number): WebGl2Shader {
    this.record("createShader", [type]);
    return this.createObject("shader");
  }

  shaderSource(shader: WebGl2Shader, source: string): void {
    this.record("shaderSource", [shader, source]);
  }

  compileShader(shader: WebGl2Shader): void {
    this.record("compileShader", [shader]);
  }

  getShaderParameter(shader: WebGl2Shader, parameter: number): unknown {
    this.record("getShaderParameter", [shader, parameter]);
    return true;
  }

  getShaderInfoLog(shader: WebGl2Shader): string | null {
    this.record("getShaderInfoLog", [shader]);
    return null;
  }

  deleteShader(shader: WebGl2Shader): void {
    this.record("deleteShader", [shader]);
  }

  createProgram(): WebGl2Program {
    this.record("createProgram", []);
    return this.createObject("program");
  }

  attachShader(program: WebGl2Program, shader: WebGl2Shader): void {
    this.record("attachShader", [program, shader]);
  }

  linkProgram(program: WebGl2Program): void {
    this.record("linkProgram", [program]);
  }

  getProgramParameter(program: WebGl2Program, parameter: number): unknown {
    this.record("getProgramParameter", [program, parameter]);
    return true;
  }

  getProgramInfoLog(program: WebGl2Program): string | null {
    this.record("getProgramInfoLog", [program]);
    return null;
  }

  deleteProgram(program: WebGl2Program): void {
    this.record("deleteProgram", [program]);
  }

  useProgram(program: WebGl2Program | null): void {
    this.record("useProgram", [program]);
  }

  getAttribLocation(program: WebGl2Program, name: string): number {
    this.record("getAttribLocation", [program, name]);
    return name === "a_position" ? 0 : 1;
  }

  getUniformLocation(program: WebGl2Program, name: string): WebGl2UniformLocation {
    this.record("getUniformLocation", [program, name]);
    return { name };
  }

  createBuffer(): WebGl2Buffer {
    this.record("createBuffer", []);
    return this.createObject("buffer");
  }

  bindBuffer(target: number, buffer: WebGl2Buffer | null): void {
    this.record("bindBuffer", [target, buffer]);
  }

  bufferData(target: number, data: ArrayBufferView, usage: number): void {
    this.record("bufferData", [target, data, usage]);
  }

  deleteBuffer(buffer: WebGl2Buffer): void {
    this.record("deleteBuffer", [buffer]);
  }

  enableVertexAttribArray(index: number): void {
    this.record("enableVertexAttribArray", [index]);
  }

  vertexAttribPointer(
    index: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number
  ): void {
    this.record("vertexAttribPointer", [index, size, type, normalized, stride, offset]);
  }

  createTexture(): WebGl2Texture {
    this.record("createTexture", []);
    return this.createObject("texture");
  }

  activeTexture(texture: number): void {
    this.record("activeTexture", [texture]);
    this.activeTextureUnit = texture;
  }

  bindTexture(target: number, texture: WebGl2Texture | null): void {
    this.record("bindTexture", [target, texture]);
    if (target === this.TEXTURE_2D) {
      this.textureBindingsByUnit.set(this.activeTextureUnit, texture);
    }
  }

  texParameteri(target: number, parameter: number, value: number): void {
    this.record("texParameteri", [target, parameter, value]);
  }

  pixelStorei(parameter: number, value: number): void {
    this.record("pixelStorei", [parameter, value]);
  }

  texImage2D(...args: readonly unknown[]): void {
    this.record("texImage2D", args);
  }

  deleteTexture(texture: WebGl2Texture): void {
    this.record("deleteTexture", [texture]);
    for (const [unit, boundTexture] of this.textureBindingsByUnit) {
      if (boundTexture === texture) {
        this.textureBindingsByUnit.set(unit, null);
      }
    }
    for (const [framebuffer, attachedTexture] of this.colorAttachmentByFramebuffer) {
      if (attachedTexture === texture) {
        this.colorAttachmentByFramebuffer.set(framebuffer, null);
      }
    }
  }

  createFramebuffer(): WebGl2Framebuffer {
    this.record("createFramebuffer", []);
    return this.createObject("framebuffer");
  }

  bindFramebuffer(target: number, framebuffer: WebGl2Framebuffer | null): void {
    this.record("bindFramebuffer", [target, framebuffer]);
    if (target === this.FRAMEBUFFER) {
      this.currentFramebuffer = framebuffer;
    }
  }

  framebufferTexture2D(
    target: number,
    attachment: number,
    textureTarget: number,
    texture: WebGl2Texture | null,
    level: number
  ): void {
    this.record("framebufferTexture2D", [target, attachment, textureTarget, texture, level]);
    if (
      target === this.FRAMEBUFFER &&
      attachment === this.COLOR_ATTACHMENT0 &&
      textureTarget === this.TEXTURE_2D &&
      this.currentFramebuffer !== null
    ) {
      this.colorAttachmentByFramebuffer.set(this.currentFramebuffer, texture);
    }
  }

  checkFramebufferStatus(target: number): number {
    this.record("checkFramebufferStatus", [target]);
    return this.FRAMEBUFFER_COMPLETE;
  }

  deleteFramebuffer(framebuffer: WebGl2Framebuffer): void {
    this.record("deleteFramebuffer", [framebuffer]);
    this.colorAttachmentByFramebuffer.delete(framebuffer);
    if (this.currentFramebuffer === framebuffer) {
      this.currentFramebuffer = null;
    }
  }

  viewport(x: number, y: number, width: number, height: number): void {
    this.record("viewport", [x, y, width, height]);
  }

  clearColor(red: number, green: number, blue: number, alpha: number): void {
    this.record("clearColor", [red, green, blue, alpha]);
  }

  clear(mask: number): void {
    this.record("clear", [mask]);
  }

  enable(capability: number): void {
    this.record("enable", [capability]);
  }

  blendFunc(sourceFactor: number, destinationFactor: number): void {
    this.record("blendFunc", [sourceFactor, destinationFactor]);
  }

  uniform1i(location: WebGl2UniformLocation | null, value: number): void {
    this.record("uniform1i", [location, value]);
  }

  uniform1f(location: WebGl2UniformLocation | null, value: number): void {
    this.record("uniform1f", [location, value]);
  }

  uniform2f(location: WebGl2UniformLocation | null, x: number, y: number): void {
    this.record("uniform2f", [location, x, y]);
  }

  uniform4f(
    location: WebGl2UniformLocation | null,
    x: number,
    y: number,
    z: number,
    w: number
  ): void {
    this.record("uniform4f", [location, x, y, z, w]);
  }

  drawElements(mode: number, count: number, type: number, offset: number): void {
    this.record("drawElements", [mode, count, type, offset]);
    this.detectFramebufferFeedbackLoop();
  }

  private createObject(kind: string): object {
    const object = {
      kind,
      id: this.nextObjectId
    };
    this.nextObjectId += 1;
    return object;
  }

  private record(name: string, args: readonly unknown[]): void {
    this.calls.push({ name, args });
  }

  private detectFramebufferFeedbackLoop(): void {
    if (this.currentFramebuffer === null) {
      return;
    }

    const attachedTexture = this.colorAttachmentByFramebuffer.get(this.currentFramebuffer);
    if (attachedTexture === undefined || attachedTexture === null) {
      return;
    }

    const textureUnits = [...this.textureBindingsByUnit]
      .filter(([, texture]) => texture === attachedTexture)
      .map(([unit]) => unit);
    if (textureUnits.length === 0) {
      return;
    }

    this.feedbackLoopViolations.push({
      framebuffer: this.currentFramebuffer,
      attachedTexture,
      textureUnits
    });
    throw new Error("WebGL framebuffer feedback loop detected.");
  }
}

function isUniformLocation(value: unknown, name: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    value.name === name
  );
}
