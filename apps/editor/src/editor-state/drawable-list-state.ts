import type { RectDto } from "@private-2d-rigging-lab/contracts";
import type {
  DrawableDto,
  DrawOrderEntryDto,
  MeshDto
} from "@private-2d-rigging-lab/package-format";

export interface DrawableListItemState {
  readonly drawableId: string;
  readonly displayName: string;
  readonly meshId: string;
  readonly partId: string;
  readonly sourceAssetId: string;
  readonly visible: boolean;
  readonly baseDrawOrder: number;
  readonly stableOrder: number;
  readonly orderIndex: number;
  readonly canMoveLayerUp: boolean;
  readonly canMoveLayerDown: boolean;
  readonly bounds: RectDto;
  readonly vertexCount: number;
  readonly triangleCount: number;
}

export const projectDrawableList = (
  drawables: readonly DrawableDto[] = [],
  meshes: readonly MeshDto[] = [],
  drawOrderEntries: readonly DrawOrderEntryDto[] = []
): readonly DrawableListItemState[] => {
  const meshesById = new Map(meshes.map((mesh) => [mesh.meshId, mesh]));
  const drawOrderByDrawableId = new Map(
    drawOrderEntries.map((entry, index) => [
      entry.drawableId,
      {
        baseDrawOrder: entry.baseDrawOrder,
        stableOrder: entry.stableOrder ?? index
      }
    ])
  );

  const projected = drawables.map((drawable, fallbackIndex) => {
    const mesh = meshesById.get(drawable.meshId);
    const drawOrder = drawOrderByDrawableId.get(drawable.drawableId);

    return {
      drawableId: drawable.drawableId,
      displayName: drawable.displayName,
      meshId: drawable.meshId,
      partId: drawable.partId,
      sourceAssetId: drawable.sourceAssetId,
      visible: drawable.runtimeVisibility,
      baseDrawOrder: drawOrder?.baseDrawOrder ?? drawable.baseDrawOrder,
      stableOrder: drawOrder?.stableOrder ?? fallbackIndex,
      orderIndex: 0,
      canMoveLayerUp: false,
      canMoveLayerDown: false,
      bounds: structuredClone(mesh?.bounds ?? { x: 0, y: 0, width: 0, height: 0 }),
      vertexCount: mesh?.vertices.length ?? 0,
      triangleCount: mesh?.triangles.length ?? 0
    };
  });

  const ordered = projected.sort(compareDrawableLayerItems);

  return ordered.map((drawable, orderIndex) => ({
    ...drawable,
    orderIndex,
    canMoveLayerDown: orderIndex > 0,
    canMoveLayerUp: orderIndex < ordered.length - 1
  }));
};

const compareDrawableLayerItems = (
  left: Omit<DrawableListItemState, "orderIndex" | "canMoveLayerUp" | "canMoveLayerDown">,
  right: Omit<DrawableListItemState, "orderIndex" | "canMoveLayerUp" | "canMoveLayerDown">
): number => {
  const baseOrderDelta = left.baseDrawOrder - right.baseDrawOrder;
  if (baseOrderDelta !== 0) {
    return baseOrderDelta;
  }

  const stableOrderDelta = left.stableOrder - right.stableOrder;
  if (stableOrderDelta !== 0) {
    return stableOrderDelta;
  }

  return left.drawableId.localeCompare(right.drawableId);
};
