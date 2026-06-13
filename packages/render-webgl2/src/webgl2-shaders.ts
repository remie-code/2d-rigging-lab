import type { WebGl2Like, WebGl2Program, WebGl2Shader } from "./webgl2-context.js";

export interface WebGl2ProgramInfo {
  readonly program: WebGl2Program;
  readonly attributes: {
    readonly position: number;
    readonly uv: number;
  };
  readonly uniforms: {
    readonly texture: object | null;
    readonly maskTexture: object | null;
    readonly opacity: object | null;
    readonly useMask: object | null;
    readonly stageToClip: object | null;
    readonly viewportSize: object | null;
  };
}

const VERTEX_SHADER_SOURCE = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
uniform vec4 u_stageToClip;
out vec2 v_uv;

void main() {
  vec2 clipPosition = a_position * u_stageToClip.xy + u_stageToClip.zw;
  gl_Position = vec4(clipPosition, 0.0, 1.0);
  v_uv = a_uv;
}
`;

const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;

uniform sampler2D u_texture;
uniform sampler2D u_maskTexture;
uniform float u_opacity;
uniform bool u_useMask;
uniform vec2 u_viewportSize;

in vec2 v_uv;
out vec4 outColor;

void main() {
  vec4 color = texture(u_texture, v_uv);
  float maskAlpha = 1.0;
  if (u_useMask) {
    vec2 maskUv = gl_FragCoord.xy / u_viewportSize;
    maskAlpha = texture(u_maskTexture, maskUv).a;
  }
  outColor = color * (u_opacity * maskAlpha);
}
`;

export const createWebGl2ProgramInfo = (gl: WebGl2Like): WebGl2ProgramInfo => {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  const program = gl.createProgram();
  if (program === null) {
    throw new Error("WebGL2 program creation failed.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? "unknown program link error";
    gl.deleteProgram(program);
    throw new Error(`WebGL2 program link failed: ${info}`);
  }

  return {
    program,
    attributes: {
      position: gl.getAttribLocation(program, "a_position"),
      uv: gl.getAttribLocation(program, "a_uv")
    },
    uniforms: {
      texture: gl.getUniformLocation(program, "u_texture"),
      maskTexture: gl.getUniformLocation(program, "u_maskTexture"),
      opacity: gl.getUniformLocation(program, "u_opacity"),
      useMask: gl.getUniformLocation(program, "u_useMask"),
      stageToClip: gl.getUniformLocation(program, "u_stageToClip"),
      viewportSize: gl.getUniformLocation(program, "u_viewportSize")
    }
  };
};

function compileShader(
  gl: WebGl2Like,
  shaderType: number,
  source: string
): WebGl2Shader {
  const shader = gl.createShader(shaderType);
  if (shader === null) {
    throw new Error("WebGL2 shader creation failed.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? "unknown shader compile error";
    gl.deleteShader(shader);
    throw new Error(`WebGL2 shader compile failed: ${info}`);
  }

  return shader;
}
