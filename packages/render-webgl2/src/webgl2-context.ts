export type WebGl2Shader = object;
export type WebGl2Program = object;
export type WebGl2Buffer = object;
export type WebGl2Texture = object;
export type WebGl2Framebuffer = object;
export type WebGl2UniformLocation = object;

export interface WebGl2Like {
  readonly VERTEX_SHADER: number;
  readonly FRAGMENT_SHADER: number;
  readonly COMPILE_STATUS: number;
  readonly LINK_STATUS: number;
  readonly ARRAY_BUFFER: number;
  readonly ELEMENT_ARRAY_BUFFER: number;
  readonly DYNAMIC_DRAW: number;
  readonly STATIC_DRAW: number;
  readonly FLOAT: number;
  readonly TRIANGLES: number;
  readonly UNSIGNED_SHORT: number;
  readonly UNSIGNED_INT: number;
  readonly TEXTURE_2D: number;
  readonly TEXTURE0: number;
  readonly TEXTURE1: number;
  readonly RGBA: number;
  readonly UNSIGNED_BYTE: number;
  readonly UNPACK_ALIGNMENT: number;
  readonly TEXTURE_WRAP_S: number;
  readonly TEXTURE_WRAP_T: number;
  readonly CLAMP_TO_EDGE: number;
  readonly TEXTURE_MIN_FILTER: number;
  readonly TEXTURE_MAG_FILTER: number;
  readonly LINEAR: number;
  readonly NEAREST: number;
  readonly BLEND: number;
  readonly ONE: number;
  readonly ONE_MINUS_SRC_ALPHA: number;
  readonly COLOR_BUFFER_BIT: number;
  readonly FRAMEBUFFER: number;
  readonly COLOR_ATTACHMENT0: number;
  readonly FRAMEBUFFER_COMPLETE: number;

  createShader(type: number): WebGl2Shader | null;
  shaderSource(shader: WebGl2Shader, source: string): void;
  compileShader(shader: WebGl2Shader): void;
  getShaderParameter(shader: WebGl2Shader, parameter: number): unknown;
  getShaderInfoLog(shader: WebGl2Shader): string | null;
  deleteShader(shader: WebGl2Shader): void;

  createProgram(): WebGl2Program | null;
  attachShader(program: WebGl2Program, shader: WebGl2Shader): void;
  linkProgram(program: WebGl2Program): void;
  getProgramParameter(program: WebGl2Program, parameter: number): unknown;
  getProgramInfoLog(program: WebGl2Program): string | null;
  deleteProgram(program: WebGl2Program): void;
  useProgram(program: WebGl2Program | null): void;
  getAttribLocation(program: WebGl2Program, name: string): number;
  getUniformLocation(program: WebGl2Program, name: string): WebGl2UniformLocation | null;

  createBuffer(): WebGl2Buffer | null;
  bindBuffer(target: number, buffer: WebGl2Buffer | null): void;
  bufferData(target: number, data: ArrayBufferView, usage: number): void;
  deleteBuffer(buffer: WebGl2Buffer): void;
  enableVertexAttribArray(index: number): void;
  vertexAttribPointer(
    index: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number
  ): void;

  createTexture(): WebGl2Texture | null;
  activeTexture(texture: number): void;
  bindTexture(target: number, texture: WebGl2Texture | null): void;
  texParameteri(target: number, parameter: number, value: number): void;
  pixelStorei(parameter: number, value: number): void;
  texImage2D(...args: readonly unknown[]): void;
  deleteTexture(texture: WebGl2Texture): void;

  createFramebuffer(): WebGl2Framebuffer | null;
  bindFramebuffer(target: number, framebuffer: WebGl2Framebuffer | null): void;
  framebufferTexture2D(
    target: number,
    attachment: number,
    textureTarget: number,
    texture: WebGl2Texture | null,
    level: number
  ): void;
  checkFramebufferStatus(target: number): number;
  deleteFramebuffer(framebuffer: WebGl2Framebuffer): void;

  viewport(x: number, y: number, width: number, height: number): void;
  clearColor(red: number, green: number, blue: number, alpha: number): void;
  clear(mask: number): void;
  enable(capability: number): void;
  blendFunc(sourceFactor: number, destinationFactor: number): void;
  uniform1i(location: WebGl2UniformLocation | null, value: number): void;
  uniform1f(location: WebGl2UniformLocation | null, value: number): void;
  uniform2f(location: WebGl2UniformLocation | null, x: number, y: number): void;
  uniform4f(
    location: WebGl2UniformLocation | null,
    x: number,
    y: number,
    z: number,
    w: number
  ): void;
  drawElements(mode: number, count: number, type: number, offset: number): void;
}

export interface WebGl2CanvasSurface {
  readonly width: number;
  readonly height: number;
  getContext(kind: "webgl2", attributes?: object): WebGl2Like | null;
}
