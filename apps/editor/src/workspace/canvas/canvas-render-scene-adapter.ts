import {
  DEFAULT_RENDER_BLEND_MODE,
  DEFAULT_RENDER_MESH_COORDINATE_SPACE,
  DEFAULT_RENDER_UV_SPACE,
  createRenderScene,
  createRgba8TextureContentSignature,
  type RenderDrawable,
  type RenderRgba8TextureSource,
  type RenderScene
} from "@private-2d-rigging-lab/render-core";

import {
  hasIsolatableCanvasSelection,
  isRenderableDrawable,
  type CanvasRenderableDrawable,
  type CanvasRenderableDrawableWithBytes,
  type CanvasRenderProjection
} from "./canvas-projection";

export interface CanvasRenderSceneAdapterOptions {
  readonly isolateSelected?: boolean;
}

export function createRenderSceneFromCanvasProjection(
  projection: CanvasRenderProjection,
  options: CanvasRenderSceneAdapterOptions = {}
): RenderScene {
  const hasSelection = hasIsolatableCanvasSelection(projection);
  const textureSourcesById = new Map<string, RenderRgba8TextureSource>();
  const drawables = projection.drawables
    .map((drawable, stableIndex): RenderDrawable | undefined => {
      if (!drawable.visible || !isRenderableDrawable(drawable)) {
        return undefined;
      }

      textureSourcesById.set(drawable.textureId, createTextureSource(drawable));

      return {
        drawableId: drawable.drawableId,
        textureRef: {
          textureId: drawable.textureId
        },
        mesh: {
          coordinateSpace: DEFAULT_RENDER_MESH_COORDINATE_SPACE,
          uvSpace: DEFAULT_RENDER_UV_SPACE,
          vertices: drawable.evaluatedMesh.vertices.map(clonePoint),
          uvs: drawable.evaluatedMesh.uvs.map(clonePoint),
          triangles: drawable.evaluatedMesh.triangles.map(
            (triangle): readonly [number, number, number] => [
              triangle[0],
              triangle[1],
              triangle[2]
            ]
          )
        },
        opacity: resolveDrawableOpacity(drawable, options, hasSelection),
        drawOrder: drawable.frontOrder,
        stableIndex,
        visible: true,
        blendMode: DEFAULT_RENDER_BLEND_MODE,
        ...(drawable.meshPreview || drawable.maskSourceDrawableIds.length === 0
          ? {}
          : {
              clipping: {
                mode: "drawable-alpha-mask-v0",
                maskDrawableIds: [...drawable.maskSourceDrawableIds]
              }
            })
      };
    })
    .filter((drawable): drawable is RenderDrawable => drawable !== undefined);

  return createRenderScene({
    textureSources: [...textureSourcesById.values()],
    drawables
  });
}

function createTextureSource(drawable: CanvasRenderableDrawableWithBytes): RenderRgba8TextureSource {
  const source = {
    ...(drawable.sourceLayerId === undefined ? {} : { sourceLayerId: drawable.sourceLayerId }),
    ...(drawable.binaryAssetId === undefined ? {} : { binaryAssetId: drawable.binaryAssetId }),
    ...(drawable.binaryAssetPath === undefined ? {} : { binaryAssetPath: drawable.binaryAssetPath })
  };

  return {
    kind: "rgba8",
    textureId: drawable.textureId,
    width: drawable.renderWidth,
    height: drawable.renderHeight,
    bytes: drawable.renderBytes,
    alphaMode: "straight",
    contentSignature: createRgba8TextureContentSignature({
      textureId: drawable.textureId,
      width: drawable.renderWidth,
      height: drawable.renderHeight,
      bytes: drawable.renderBytes
    }),
    ...(Object.keys(source).length === 0 ? {} : { source })
  };
}

function resolveDrawableOpacity(
  drawable: CanvasRenderableDrawable,
  options: CanvasRenderSceneAdapterOptions,
  hasSelection: boolean
): number {
  const isolateDim =
    options.isolateSelected === true &&
    hasSelection &&
    !drawable.selected &&
    !drawable.selectedBySubtree
      ? 0.22
      : 1;

  return drawable.opacity * isolateDim;
}

function clonePoint(point: { readonly x: number; readonly y: number }): {
  readonly x: number;
  readonly y: number;
} {
  return {
    x: point.x,
    y: point.y
  };
}
