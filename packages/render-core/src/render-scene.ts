export type RenderSceneSchemaVersion = "render-scene-v0";
export type RenderCoordinateSystem = "stage-y-down-v1";
export type RenderMeshCoordinateSpace = "stage";
export type RenderUvSpace = "layer-local-top-left-0-1-v1";
export type RenderTextureSourceKind = "rgba8";
export type RenderTextureAlphaMode = "straight" | "premultiplied";
export type RenderBlendMode = "normal-premultiplied-alpha-v0";
export type RenderClippingMode = "drawable-alpha-mask-v0";

export interface RenderPoint {
  readonly x: number;
  readonly y: number;
}

export type RenderTriangle = readonly [number, number, number];

export interface RenderMesh {
  readonly coordinateSpace: RenderMeshCoordinateSpace;
  readonly uvSpace: RenderUvSpace;
  readonly vertices: readonly RenderPoint[];
  readonly uvs: readonly RenderPoint[];
  readonly triangles: readonly RenderTriangle[];
}

export interface RenderTextureRef {
  readonly textureId: string;
}

export interface RenderTextureSourceMetadata {
  readonly sourceLayerId?: string;
  readonly binaryAssetId?: string;
  readonly binaryAssetPath?: string;
}

export interface RenderRgba8TextureSource {
  readonly kind: RenderTextureSourceKind;
  readonly textureId: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: Uint8Array;
  readonly alphaMode: RenderTextureAlphaMode;
  readonly contentSignature: string;
  readonly source?: RenderTextureSourceMetadata;
}

export type RenderTextureSource = RenderRgba8TextureSource;

export interface RenderDrawableClipping {
  readonly mode: RenderClippingMode;
  readonly maskDrawableIds: readonly string[];
}

export interface RenderDrawable {
  readonly drawableId: string;
  readonly textureRef: RenderTextureRef;
  readonly mesh: RenderMesh;
  readonly opacity: number;
  readonly drawOrder: number;
  readonly stableIndex: number;
  readonly visible: boolean;
  readonly blendMode: RenderBlendMode;
  readonly clipping?: RenderDrawableClipping;
}

export interface RenderScene {
  readonly schemaVersion: RenderSceneSchemaVersion;
  readonly coordinateSystem: RenderCoordinateSystem;
  readonly textureSources: readonly RenderTextureSource[];
  readonly drawables: readonly RenderDrawable[];
}

export const DEFAULT_RENDER_SCENE_SCHEMA_VERSION: RenderSceneSchemaVersion = "render-scene-v0";
export const DEFAULT_RENDER_COORDINATE_SYSTEM: RenderCoordinateSystem = "stage-y-down-v1";
export const DEFAULT_RENDER_BLEND_MODE: RenderBlendMode = "normal-premultiplied-alpha-v0";
export const DEFAULT_RENDER_MESH_COORDINATE_SPACE: RenderMeshCoordinateSpace = "stage";
export const DEFAULT_RENDER_UV_SPACE: RenderUvSpace = "layer-local-top-left-0-1-v1";

export interface CreateRenderSceneInput {
  readonly coordinateSystem?: RenderCoordinateSystem;
  readonly textureSources: readonly RenderTextureSource[];
  readonly drawables: readonly RenderDrawable[];
}
