import type {
  NormalizedDrawable,
  NormalizedDrawOrderEntry
} from "@private-2d-rigging-lab/runtime-core";

import type { AuthoringGraph } from "./authoring-graph.js";

export const createRuntimeDrawableMap = (
  graph: AuthoringGraph
): ReadonlyMap<NormalizedDrawable["drawableId"], NormalizedDrawable> => {
  const meshesById = new Map(graph.meshes.map((mesh) => [mesh.meshId, mesh]));

  return new Map(
    graph.drawables.map((drawable) => {
      const mesh = meshesById.get(drawable.meshId);
      if (mesh === undefined) {
        throw new Error(`Drawable ${drawable.drawableId} references missing mesh ${drawable.meshId}.`);
      }

      return [
        drawable.drawableId,
        {
          drawableId: drawable.drawableId,
          meshId: drawable.meshId,
          visible: drawable.runtimeVisibility,
          opacity: drawable.defaultOpacity,
          baseDrawOrder: drawable.baseDrawOrder,
          bounds: structuredClone(mesh.bounds),
          vertices: structuredClone(mesh.vertices),
          vertexCount: mesh.vertices.length
        }
      ];
    })
  );
};

export const createRuntimeDrawOrder = (graph: AuthoringGraph): readonly NormalizedDrawOrderEntry[] =>
  graph.drawOrder.map((entry) => ({
    drawableId: entry.drawableId,
    drawOrder: entry.stableOrder
  }));
