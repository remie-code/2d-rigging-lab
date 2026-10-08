import {
  DEFAULT_RENDER_BLEND_MODE,
  DEFAULT_RENDER_MESH_COORDINATE_SPACE,
  DEFAULT_RENDER_UV_SPACE,
  createRenderScene,
  createRgba8TextureContentSignature,
  recordLive2dPerformanceCounter,
  recordLive2dPerformanceTiming,
  startLive2dPerformanceTiming,
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
  const timingStart = startLive2dPerformanceTiming();
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

  const scene = createRenderScene({
    textureSources: [...textureSourcesById.values()],
    drawables
  });
  recordLive2dPerformanceCounter("canvas.renderScene.textureSources", scene.textureSources.length);
  recordLive2dPerformanceTiming("canvas.renderSceneAdapter.ms", timingStart);
  return scene;
}

function createRenderMeshForDrawable(drawable: CanvasRenderableDrawable): RenderMesh {
  if (!hasDrawableMeshTriangles(drawable)) {
    return createBoundsQuadRenderMesh(drawable);
  }

  const contentUvRemap = resolveContentUvRemap(drawable);

  return {
    coordinateSpace: DEFAULT_RENDER_MESH_COORDINATE_SPACE,
    uvSpace: DEFAULT_RENDER_UV_SPACE,
    vertices: drawable.evaluatedMesh.vertices.map(clonePoint),
    uvs: drawable.evaluatedMesh.uvs.map((uv) => applyContentUvRemap(uv, contentUvRemap)),
    triangles: drawable.evaluatedMesh.triangles.map(
      (triangle): readonly [number, number, number] => [
        triangle[0],
        triangle[1],
        triangle[2]
      ]
    )
  };
}

/**
 * Wave 1.2 F: affine remap of content-space UV 0..1 onto the content sub-rect of the padded
 * raster. Same form as the atlas placement `contentUvRect`
 * (`packages/authoring-core/src/texture-atlas-packing.ts` `createTextureAtlasPlacement`):
 *
 *   u' = (insetLeft + u * contentW) / paddedW,  contentW = paddedW - insetLeft - insetRight
 *   v' = (insetTop  + v * contentH) / paddedH,  contentH = paddedH - insetTop  - insetBottom
 *
 * The `original` render path samples the padded per-texture raster directly, so without this remap
 * the content-space UV 0..1 maps to the full padded raster and the artwork appears inset by the
 * padding P (`import-position-mismatch-investigation.md` H1). The remap is a pure affine map with
 * no clamping: covering-margin overshoot (content UV outside [0,1]) lands in the raster's own
 * transparent padding band, preserving the A1 boundary-transparent-margin design.
 */
interface ContentUvRemap {
  readonly insetLeft: number;
  readonly insetTop: number;
  readonly contentWidth: number;
  readonly contentHeight: number;
  readonly paddedWidth: number;
  readonly paddedHeight: number;
}

function resolveContentUvRemap(drawable: CanvasRenderableDrawable): ContentUvRemap | undefined {
  const inset = drawable.contentInset;
  const raster = drawable.rasterDimensions;
  if (inset === undefined || raster === undefined) {
    // Legacy / non-PSD entry (raster ≡ content): keep content UV 0..1 unchanged.
    return undefined;
  }

  if (inset.left === 0 && inset.top === 0 && inset.right === 0 && inset.bottom === 0) {
    // Zero inset on every side: remap is the identity, so skip it.
    return undefined;
  }

  const paddedWidth = raster.width;
  const paddedHeight = raster.height;
  const contentWidth = paddedWidth - inset.left - inset.right;
  const contentHeight = paddedHeight - inset.top - inset.bottom;
  if (
    paddedWidth <= 0 ||
    paddedHeight <= 0 ||
    contentWidth <= 0 ||
    contentHeight <= 0
  ) {
    // Defensive: malformed inset/dimensions — keep the legacy content UVs rather than
    // producing NaN/negative sub-rects.
    return undefined;
  }

  return {
    insetLeft: inset.left,
    insetTop: inset.top,
    contentWidth,
    contentHeight,
    paddedWidth,
    paddedHeight
  };
}

function applyContentUvRemap(
  uv: { readonly x: number; readonly y: number },
  remap: ContentUvRemap | undefined
): { readonly x: number; readonly y: number } {
  if (remap === undefined) {
    return { x: uv.x, y: uv.y };
  }

  return {
    x: (remap.insetLeft + uv.x * remap.contentWidth) / remap.paddedWidth,
    y: (remap.insetTop + uv.y * remap.contentHeight) / remap.paddedHeight
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

    const destinationA = mesh.vertices[aIndex];
    const destinationB = mesh.vertices[bIndex];
    const destinationC = mesh.vertices[cIndex];
    const sourceA = mesh.uvs[aIndex];
    const sourceB = mesh.uvs[bIndex];
    const sourceC = mesh.uvs[cIndex];
    if (
      destinationA === undefined ||
      destinationB === undefined ||
      destinationC === undefined ||
      sourceA === undefined ||
      sourceB === undefined ||
      sourceC === undefined
    ) {
      return false;
    }

    const destination = [destinationA, destinationB, destinationC] as const;
    const source = [sourceA, sourceB, sourceC] as const;

    return triangleHasArea(destination) && triangleHasArea(source);
  });
}

function createBoundsQuadRenderMesh(drawable: CanvasRenderableDrawable): RenderMesh {
  const { x, y, width, height } = drawable.bounds;
  const right = x + width;
  const bottom = y + height;
  const contentUvRemap = resolveContentUvRemap(drawable);

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
      applyContentUvRemap({ x: 0, y: 0 }, contentUvRemap),
      applyContentUvRemap({ x: 1, y: 0 }, contentUvRemap),
      applyContentUvRemap({ x: 1, y: 1 }, contentUvRemap),
      applyContentUvRemap({ x: 0, y: 1 }, contentUvRemap)
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
