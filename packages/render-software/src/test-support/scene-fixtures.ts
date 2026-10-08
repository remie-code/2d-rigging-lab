import {
  DEFAULT_RENDER_BLEND_MODE,
  DEFAULT_RENDER_COORDINATE_SYSTEM,
  DEFAULT_RENDER_MESH_COORDINATE_SPACE,
  DEFAULT_RENDER_SCENE_SCHEMA_VERSION,
  DEFAULT_RENDER_UV_SPACE,
  type RenderDrawable,
  type RenderPoint,
  type RenderRgba8TextureSource,
  type RenderScene,
  type RenderTextureAlphaMode,
  type RenderTriangle
} from "@private-2d-rigging-lab/render-core";

/**
 * Rights-clean synthetic fixtures for render-software tests. Everything here is
 * generated in code (no external assets, no ref/ models).
 */

export interface SolidTextureOptions {
  readonly textureId: string;
  readonly width: number;
  readonly height: number;
  readonly rgba: readonly [number, number, number, number];
  readonly alphaMode?: RenderTextureAlphaMode;
}

/**
 * A single-texel or uniformly filled texture of one solid RGBA color.
 */
export const createSolidTexture = (
  options: SolidTextureOptions
): RenderRgba8TextureSource => {
  const bytes = new Uint8Array(options.width * options.height * 4);
  for (let pixel = 0; pixel < options.width * options.height; pixel += 1) {
    const base = pixel * 4;
    bytes[base] = options.rgba[0];
    bytes[base + 1] = options.rgba[1];
    bytes[base + 2] = options.rgba[2];
    bytes[base + 3] = options.rgba[3];
  }
  return {
    kind: "rgba8",
    textureId: options.textureId,
    width: options.width,
    height: options.height,
    bytes,
    alphaMode: options.alphaMode ?? "straight",
    contentSignature: `solid-${options.textureId}`
  };
};

/**
 * A 2x2 checkerboard texture with four distinct opaque colors, useful for
 * exercising LINEAR texel interpolation and UV mapping. Texel layout (top-left
 * origin):
 *   (0,0) red    (1,0) green
 *   (0,1) blue   (1,1) white
 */
export const createFourColorTexture = (
  textureId: string
): RenderRgba8TextureSource => {
  const bytes = new Uint8Array([
    255, 0, 0, 255, // (0,0) red
    0, 255, 0, 255, // (1,0) green
    0, 0, 255, 255, // (0,1) blue
    255, 255, 255, 255 // (1,1) white
  ]);
  return {
    kind: "rgba8",
    textureId,
    width: 2,
    height: 2,
    bytes,
    alphaMode: "straight",
    contentSignature: `fourColor-${textureId}`
  };
};

export interface QuadDrawableOptions {
  readonly drawableId: string;
  readonly textureId: string;
  /** Stage-space rectangle corners: top-left and bottom-right (Y down). */
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly opacity?: number;
  readonly drawOrder?: number;
  readonly stableIndex?: number;
  readonly visible?: boolean;
  readonly maskDrawableIds?: readonly string[];
  /** UV rectangle; defaults to full [0,1]x[0,1]. */
  readonly uvMinX?: number;
  readonly uvMinY?: number;
  readonly uvMaxX?: number;
  readonly uvMaxY?: number;
}

/**
 * A rectangular drawable made of two triangles, spanning a stage-space rect,
 * with UVs mapped over a (default full) UV rect. Winding is consistent
 * top-left -> triangles: (tl, bl, br) and (tl, br, tr).
 */
export const createQuadDrawable = (
  options: QuadDrawableOptions
): RenderDrawable => {
  const tl: RenderPoint = { x: options.minX, y: options.minY };
  const tr: RenderPoint = { x: options.maxX, y: options.minY };
  const bl: RenderPoint = { x: options.minX, y: options.maxY };
  const br: RenderPoint = { x: options.maxX, y: options.maxY };

  const uvMinX = options.uvMinX ?? 0;
  const uvMinY = options.uvMinY ?? 0;
  const uvMaxX = options.uvMaxX ?? 1;
  const uvMaxY = options.uvMaxY ?? 1;
  const uvTl: RenderPoint = { x: uvMinX, y: uvMinY };
  const uvTr: RenderPoint = { x: uvMaxX, y: uvMinY };
  const uvBl: RenderPoint = { x: uvMinX, y: uvMaxY };
  const uvBr: RenderPoint = { x: uvMaxX, y: uvMaxY };

  const triangles: readonly RenderTriangle[] = [
    [0, 2, 3],
    [0, 3, 1]
  ];

  return {
    drawableId: options.drawableId,
    textureRef: { textureId: options.textureId },
    mesh: {
      coordinateSpace: DEFAULT_RENDER_MESH_COORDINATE_SPACE,
      uvSpace: DEFAULT_RENDER_UV_SPACE,
      vertices: [tl, tr, bl, br],
      uvs: [uvTl, uvTr, uvBl, uvBr],
      triangles
    },
    opacity: options.opacity ?? 1,
    drawOrder: options.drawOrder ?? 0,
    stableIndex: options.stableIndex ?? 0,
    visible: options.visible ?? true,
    blendMode: DEFAULT_RENDER_BLEND_MODE,
    ...(options.maskDrawableIds !== undefined
      ? {
          clipping: {
            mode: "drawable-alpha-mask-v0" as const,
            maskDrawableIds: options.maskDrawableIds
          }
        }
      : {})
  };
};

export interface SceneOptions {
  readonly textureSources: readonly RenderRgba8TextureSource[];
  readonly drawables: readonly RenderDrawable[];
}

export const createScene = (options: SceneOptions): RenderScene => ({
  schemaVersion: DEFAULT_RENDER_SCENE_SCHEMA_VERSION,
  coordinateSystem: DEFAULT_RENDER_COORDINATE_SYSTEM,
  textureSources: options.textureSources,
  drawables: options.drawables
});
