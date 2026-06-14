import {
  DEFAULT_RENDER_BLEND_MODE,
  DEFAULT_RENDER_MESH_COORDINATE_SPACE,
  DEFAULT_RENDER_UV_SPACE,
  createRenderScene,
  createRgba8TextureContentSignature,
  type RenderDrawable,
  type RenderMesh,
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
        mesh: createRenderMeshForDrawable(drawable),
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

function createRenderMeshForDrawable(drawable: CanvasRenderableDrawable): RenderMesh {
  if (!hasDrawableMeshTriangles(drawable)) {
    return createBoundsQuadRenderMesh(drawable);
  }

  return {
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
  };
}

function hasDrawableMeshTriangles(drawable: CanvasRenderableDrawable): boolean {
  const mesh = drawable.evaluatedMesh;
  const vertexCount = Math.min(mesh.vertices.length, mesh.uvs.length);
  if (vertexCount === 0 || mesh.triangles.length === 0) {
    return false;
  }

  return mesh.triangles.some((triangle) => {
    const [aIndex, bIndex, cIndex] = triangle;
    if (
      aIndex < 0 ||
      bIndex < 0 ||
      cIndex < 0 ||
      aIndex >= vertexCount ||
      bIndex >= vertexCount ||
      cIndex >= vertexCount
    ) {
      return false;
    }

    const destination = [
      mesh.vertices[aIndex],
      mesh.vertices[bIndex],
      mesh.vertices[cIndex]
    ] as const;
    const source = [mesh.uvs[aIndex], mesh.uvs[bIndex], mesh.uvs[cIndex]] as const;

    return triangleHasArea(destination) && triangleHasArea(source);
  });
}

function createBoundsQuadRenderMesh(drawable: CanvasRenderableDrawable): RenderMesh {
  const { x, y, width, height } = drawable.bounds;
  const right = x + width;
  const bottom = y + height;

  return {
    coordinateSpace: DEFAULT_RENDER_MESH_COORDINATE_SPACE,
    uvSpace: DEFAULT_RENDER_UV_SPACE,
    vertices: [
      { x, y },
      { x: right, y },
      { x: right, y: bottom },
      { x, y: bottom }
    ],
    uvs: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ],
    triangles: [
      [0, 1, 2],
      [0, 2, 3]
    ]
  };
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

function triangleHasArea(
  points: readonly [
    { readonly x: number; readonly y: number },
    { readonly x: number; readonly y: number },
    { readonly x: number; readonly y: number }
  ]
): boolean {
  const [a, b, c] = points;
  const area = ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
  return Number.isFinite(area) && Math.abs(area) >= 1e-9;
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
