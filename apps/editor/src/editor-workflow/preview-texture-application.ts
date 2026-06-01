import {
  applyEditorPreviewTextureAssets
} from "../editor-preview/texture-preview-resolution.js";
import type { PartId } from "@private-2d-rigging-lab/contracts";
import type {
  EditorPreviewPartDto,
  EditorPreviewProjectionDto
} from "../editor-preview/preview-dto.js";
import type { EditorSemanticState } from "../editor-state/index.js";

export const applyWorkflowPreviewTextureAssets = (
  preview: EditorPreviewProjectionDto | null,
  state: EditorSemanticState
): EditorPreviewProjectionDto | null =>
  applyEditorPreviewTextureAssets({
    preview: applyWorkflowPartEvidence(preview, state),
    ...(state.textureAtlas === null ? {} : { textureAtlas: state.textureAtlas }),
    drawableTextures: createDrawableTextureReferences(state)
  });

const applyWorkflowPartEvidence = (
  preview: EditorPreviewProjectionDto | null,
  state: EditorSemanticState
): EditorPreviewProjectionDto | null => {
  if (preview === null) {
    return null;
  }

  if (state.parts.length === 0) {
    return preview;
  }

  return {
    ...preview,
    parts: projectWorkflowPreviewParts(state)
  };
};

const projectWorkflowPreviewParts = (
  state: EditorSemanticState
): readonly EditorPreviewPartDto[] => {
  const partsById = new Map(state.parts.map((part) => [part.partId, part]));
  const visited = new Set<string>();
  const roots = state.parts.filter(
    (part) => part.parentPartId === undefined || !partsById.has(part.parentPartId)
  );
  const ordered: EditorPreviewPartDto[] = [];

  for (const root of roots.length === 0 ? state.parts : roots) {
    visitPart(root.partId, [], visited, ordered, state, partsById);
  }

  for (const part of state.parts) {
    visitPart(part.partId, [], visited, ordered, state, partsById);
  }

  return ordered;
};

const visitPart = (
  partId: PartId | string,
  ancestors: readonly PartId[],
  visited: Set<string>,
  ordered: EditorPreviewPartDto[],
  state: EditorSemanticState,
  partsById: ReadonlyMap<string, EditorSemanticState["parts"][number]>
): void => {
  if (visited.has(partId)) {
    return;
  }

  const part = partsById.get(partId);
  if (part === undefined) {
    return;
  }
  if (ancestors.includes(part.partId)) {
    return;
  }

  const hierarchyPath = [...ancestors, part.partId];
  visited.add(part.partId);
  ordered.push({
    partId: part.partId,
    displayName: part.displayName,
    ...(part.parentPartId === undefined ? {} : { parentPartId: part.parentPartId }),
    childPartIds: [...part.childPartIds],
    drawableIds: [...part.drawableIds],
    hierarchyPath,
    depth: ancestors.length,
    layerState: {
      editorHidden: state.layerTreeDraft.editorHiddenIds.includes(part.partId),
      locked: state.layerTreeDraft.lockedIds.includes(part.partId),
      selected: state.layerTreeDraft.selection.includes(part.partId)
    }
  });

  for (const childPartId of collectChildPartIds(part, state.parts)) {
    visitPart(childPartId, hierarchyPath, visited, ordered, state, partsById);
  }
};

const collectChildPartIds = (
  part: EditorSemanticState["parts"][number],
  parts: EditorSemanticState["parts"]
): readonly PartId[] => {
  const childPartIds = new Set(part.childPartIds);
  const orderedChildPartIds = [...part.childPartIds];

  for (const candidate of parts) {
    if (candidate.parentPartId === part.partId && !childPartIds.has(candidate.partId)) {
      orderedChildPartIds.push(candidate.partId);
      childPartIds.add(candidate.partId);
    }
  }

  return orderedChildPartIds;
};

const createDrawableTextureReferences = (
  state: EditorSemanticState
): readonly {
  readonly drawableId: string;
  readonly textureId?: string;
  readonly sourceAssetId?: string;
  readonly sourceLayerId?: string;
}[] => {
  const sourceLayerIdsByDrawableId = new Map<string, string>();
  for (const sourceAsset of state.sourceAssets) {
    for (const sourceLayer of sourceAsset.layers) {
      for (const drawableId of sourceLayer.mappedDrawableIds) {
        sourceLayerIdsByDrawableId.set(drawableId, sourceLayer.sourceLayerId);
      }
    }
  }

  return state.drawables.map((drawable) => {
    const sourceLayerId = sourceLayerIdsByDrawableId.get(drawable.drawableId);

    return {
      drawableId: drawable.drawableId,
      ...(drawable.textureId.trim().length === 0 ? {} : { textureId: drawable.textureId }),
      ...(drawable.sourceAssetId.trim().length === 0 ? {} : { sourceAssetId: drawable.sourceAssetId }),
      ...(sourceLayerId === undefined ? {} : { sourceLayerId })
    };
  });
};
