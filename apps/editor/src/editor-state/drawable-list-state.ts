import type { RectDto } from "@private-2d-rigging-lab/contracts";
import type { DrawableDto, MeshDto } from "@private-2d-rigging-lab/package-format";

export interface DrawableListItemState {
  readonly drawableId: string;
  readonly displayName: string;
  readonly meshId: string;
  readonly partId: string;
  readonly sourceAssetId: string;
  readonly visible: boolean;
  readonly baseDrawOrder: number;
  readonly bounds: RectDto;
  readonly vertexCount: number;
  readonly triangleCount: number;
}

export const projectDrawableList = (
  drawables: readonly DrawableDto[] = [],
  meshes: readonly MeshDto[] = []
): readonly DrawableListItemState[] => {
  const meshesById = new Map(meshes.map((mesh) => [mesh.meshId, mesh]));

  return drawables.map((drawable) => {
    const mesh = meshesById.get(drawable.meshId);

    return {
      drawableId: drawable.drawableId,
      displayName: drawable.displayName,
      meshId: drawable.meshId,
      partId: drawable.partId,
      sourceAssetId: drawable.sourceAssetId,
      visible: drawable.runtimeVisibility,
      baseDrawOrder: drawable.baseDrawOrder,
      bounds: structuredClone(mesh?.bounds ?? { x: 0, y: 0, width: 0, height: 0 }),
      vertexCount: mesh?.vertices.length ?? 0,
      triangleCount: mesh?.triangles.length ?? 0
    };
  });
};
