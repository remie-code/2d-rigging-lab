import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  RenderDrawable,
  RenderDrawableClipping,
  RenderMesh,
  RenderScene
} from "@private-2d-rigging-lab/render-core";
import { createRenderScene } from "@private-2d-rigging-lab/render-core";
import type {
  NormalizedRuntimeGraph,
  RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";

import { resolveRenderTextureSources } from "./texture-resolution.js";

/**
 * RenderScene adapter (Wave104 Domain A).
 *
 * Assembles a render-core {@link RenderScene} from an evaluated snapshot using a
 * hybrid of sources:
 *  - evaluated vertices / opacity / visible / evaluatedDrawOrder: from the
 *    `full`-detail {@link RuntimeSnapshotDto} (the deformed geometry).
 *  - uvs / triangles: from the {@link NormalizedRuntimeGraph} drawables (the
 *    snapshot does not carry UV/triangles).
 *  - textureRef + RGBA8 texture sources: resolved from the AuthoringGraph
 *    (drawable.textureId -> texture entry bytes/dimensions), with §3.4 byteLength
 *    validation.
 *  - clipping: derived from `snapshot.masks` (each target drawable is clipped by
 *    its mask relation's source drawables).
 *
 * draw order / opacity / visibility semantics match the runtime-export stage
 * scene builder so the software render is Player-equivalent.
 */

export interface RenderSceneAdapterInput {
  readonly session: AuthoringSession;
  readonly graph: NormalizedRuntimeGraph;
  readonly snapshot: RuntimeSnapshotDto;
}

export class RenderSceneAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderSceneAdapterError";
  }
}

export const createPerceptionRenderScene = (
  input: RenderSceneAdapterInput
): RenderScene => {
  const { session, graph, snapshot } = input;

  const textureIdByDrawableId = new Map<string, string>(
    session.graph.drawables.map((drawable) => [drawable.drawableId, drawable.textureId])
  );

  // Mesh Wave 1.3 G: content-UV remap geometry per texture. The atlas entry
  // carries the padded raster `dimensions` and the `contentInset` (four-sided,
  // source pixels) describing where the tightly-cropped content sits inside that
  // padded raster. Both are read directly from the SAME
  // `session.graph.textureAtlas.textures` object `texture-resolution.ts` reads
  // (§3.4). Where editor grows `contentInset`/`rasterDimensions` onto the
  // projection drawable, the perception adapter instead resolves them per
  // texture and applies them to the drawable via its textureId.
  const contentGeometryByTextureId = new Map<string, TextureContentGeometry>(
    (session.graph.textureAtlas?.textures ?? []).map((entry) => [
      entry.textureId,
      {
        ...(entry.contentInset === undefined ? {} : { contentInset: entry.contentInset }),
        ...(entry.dimensions === undefined ? {} : { dimensions: entry.dimensions })
      }
    ])
  );

  // Map each target drawable to the set of mask (source) drawables that clip it.
  const maskDrawableIdsByTargetDrawableId = new Map<string, string[]>();
  for (const mask of snapshot.masks) {
    if (!mask.resolved) {
      continue;
    }
    for (const targetDrawableId of mask.targetDrawableIds) {
      const existing = maskDrawableIdsByTargetDrawableId.get(targetDrawableId) ?? [];
      for (const sourceDrawableId of mask.sourceDrawableIds) {
        if (!existing.includes(sourceDrawableId)) {
          existing.push(sourceDrawableId);
        }
      }
      maskDrawableIdsByTargetDrawableId.set(targetDrawableId, existing);
    }
  }

  const usedTextureIds = new Set<string>();
  const drawables: RenderDrawable[] = snapshot.drawables.map((drawable) => {
    if (drawable.vertices === undefined) {
      throw new RenderSceneAdapterError(
        `Evaluated drawable "${drawable.drawableId}" is missing full-detail vertices; evaluation must use snapshotDetail="full".`
      );
    }

    const graphDrawable = graph.drawables.get(drawable.drawableId);
    if (graphDrawable === undefined) {
      throw new RenderSceneAdapterError(
        `Evaluated drawable "${drawable.drawableId}" is missing from the runtime graph.`
      );
    }
    if (graphDrawable.uvs === undefined || graphDrawable.triangles === undefined) {
      throw new RenderSceneAdapterError(
        `Runtime graph drawable "${drawable.drawableId}" is missing uvs/triangles.`
      );
    }

    const textureId = textureIdByDrawableId.get(drawable.drawableId);
    if (textureId === undefined) {
      throw new RenderSceneAdapterError(
        `Drawable "${drawable.drawableId}" has no textureId in the authoring graph.`
      );
    }
    usedTextureIds.add(textureId);

    const geometry = contentGeometryByTextureId.get(textureId);
    const contentUvRemap = resolveContentUvRemap(
      geometry?.contentInset,
      geometry?.dimensions
    );

    const mesh: RenderMesh = {
      coordinateSpace: "stage",
      uvSpace: "layer-local-top-left-0-1-v1",
      vertices: drawable.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y })),
      uvs: graphDrawable.uvs.map((uv) => applyContentUvRemap(uv, contentUvRemap)),
      triangles: graphDrawable.triangles.map(
        (triangle): readonly [number, number, number] => [
          triangle[0],
          triangle[1],
          triangle[2]
        ]
      )
    };

    const maskDrawableIds = maskDrawableIdsByTargetDrawableId.get(drawable.drawableId);
    const clipping: RenderDrawableClipping | undefined =
      maskDrawableIds === undefined || maskDrawableIds.length === 0
        ? undefined
        : {
            mode: "drawable-alpha-mask-v0",
            maskDrawableIds: [...maskDrawableIds]
          };

    return {
      drawableId: drawable.drawableId,
      textureRef: { textureId },
      mesh,
      opacity: drawable.opacity,
      drawOrder: drawable.evaluatedDrawOrder,
      stableIndex: drawable.baseDrawOrder,
      visible: drawable.visible,
      blendMode: "normal-premultiplied-alpha-v0",
      ...(clipping === undefined ? {} : { clipping })
    };
  });

  const textureSources = resolveRenderTextureSources({
    session,
    textureIds: [...usedTextureIds]
  });

  return createRenderScene({
    textureSources,
    drawables
  });
};

/**
 * Mesh Wave 1.3 G: affine remap of content-space UV 0..1 onto the content
 * sub-rect of the padded per-texture raster. Same form as the editor
 * `resolveContentUvRemap` / `applyContentUvRemap`
 * (`apps/editor/src/workspace/canvas/canvas-render-scene-adapter.ts`, Wave 1.2 F)
 * and the atlas placement `contentUvRect`
 * (`packages/authoring-core/src/texture-atlas-packing.ts`):
 *
 *   u' = (insetLeft + u * contentW) / paddedW,  contentW = paddedW - insetLeft - insetRight
 *   v' = (insetTop  + v * contentH) / paddedH,  contentH = paddedH - insetTop  - insetBottom
 *
 * The perception software render (`renderSceneToPng`) samples the padded
 * per-texture raster directly, so without this remap the content-space UV 0..1
 * maps to the full padded raster and each part's artwork appears inset toward
 * its own bounds centre by the padding P
 * (`import-position-mismatch-investigation.md` H1). Unlike editor, which reads
 * the inset/raster dimensions from the projection drawable, the perception
 * adapter resolves them per texture from the atlas entry and applies them to
 * the drawable via its textureId. The remap is a pure affine map with NO
 * clamping: covering-margin overshoot (content UV outside [0,1]) lands in the
 * raster's own transparent padding band, preserving the A1
 * boundary-transparent-margin design.
 */
interface TextureContentGeometry {
  readonly contentInset?: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
  readonly dimensions?: {
    readonly width: number;
    readonly height: number;
  };
}

interface ContentUvRemap {
  readonly insetLeft: number;
  readonly insetTop: number;
  readonly contentWidth: number;
  readonly contentHeight: number;
  readonly paddedWidth: number;
  readonly paddedHeight: number;
}

const resolveContentUvRemap = (
  contentInset: TextureContentGeometry["contentInset"],
  dimensions: TextureContentGeometry["dimensions"]
): ContentUvRemap | undefined => {
  if (contentInset === undefined || dimensions === undefined) {
    // Legacy / non-PSD entry (raster ≡ content, or no inset declared): keep
    // content UV 0..1 unchanged.
    return undefined;
  }

  if (
    contentInset.left === 0 &&
    contentInset.top === 0 &&
    contentInset.right === 0 &&
    contentInset.bottom === 0
  ) {
    // Zero inset on every side: remap is the identity, so skip it.
    return undefined;
  }

  const paddedWidth = dimensions.width;
  const paddedHeight = dimensions.height;
  const contentWidth = paddedWidth - contentInset.left - contentInset.right;
  const contentHeight = paddedHeight - contentInset.top - contentInset.bottom;
  if (paddedWidth <= 0 || paddedHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) {
    // Defensive: malformed inset/dimensions — keep the legacy content UVs rather
    // than producing NaN/negative sub-rects.
    return undefined;
  }

  return {
    insetLeft: contentInset.left,
    insetTop: contentInset.top,
    contentWidth,
    contentHeight,
    paddedWidth,
    paddedHeight
  };
};

const applyContentUvRemap = (
  uv: { readonly x: number; readonly y: number },
  remap: ContentUvRemap | undefined
): { readonly x: number; readonly y: number } => {
  if (remap === undefined) {
    return { x: uv.x, y: uv.y };
  }

  return {
    x: (remap.insetLeft + uv.x * remap.contentWidth) / remap.paddedWidth,
    y: (remap.insetTop + uv.y * remap.contentHeight) / remap.paddedHeight
  };
};
