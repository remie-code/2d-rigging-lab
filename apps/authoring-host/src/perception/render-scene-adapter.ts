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

    const mesh: RenderMesh = {
      coordinateSpace: "stage",
      uvSpace: "layer-local-top-left-0-1-v1",
      vertices: drawable.vertices.map((vertex) => ({ x: vertex.x, y: vertex.y })),
      uvs: graphDrawable.uvs.map((uv) => ({ x: uv.x, y: uv.y })),
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
