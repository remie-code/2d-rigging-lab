import type {
  DrawableId,
  PartId
} from "@private-2d-rigging-lab/contracts";

import type {
  EditorPreviewDrawableDto,
  EditorPreviewDrawableLayerStateDto,
  EditorPreviewDrawableTextureDto,
  EditorPreviewPartLayerStateDto
} from "./preview-dto.js";

export interface EditorPreviewLayerStateInput {
  readonly selection?: readonly string[];
  readonly lockedIds?: readonly string[];
  readonly editorHiddenIds?: readonly string[];
}

export const createEditorPreviewPartLayerState = (
  partId: PartId,
  editorState: EditorPreviewLayerStateInput | undefined
): EditorPreviewPartLayerStateDto => ({
  editorHidden: hasId(editorState?.editorHiddenIds, partId),
  locked: hasId(editorState?.lockedIds, partId),
  selected: hasId(editorState?.selection, partId)
});

export const createEditorPreviewDrawableLayerState = (input: {
  readonly drawableId: DrawableId;
  readonly runtimeVisible: boolean;
  readonly texture: EditorPreviewDrawableTextureDto;
  readonly editorState?: EditorPreviewLayerStateInput | undefined;
}): EditorPreviewDrawableLayerStateDto => {
  const textureStatus = input.texture.status;

  return {
    runtimeVisible: input.runtimeVisible,
    editorHidden: hasId(input.editorState?.editorHiddenIds, input.drawableId),
    locked: hasId(input.editorState?.lockedIds, input.drawableId),
    selected: hasId(input.editorState?.selection, input.drawableId),
    textureStatus,
    textureBacked: textureStatus === "resolved",
    textureUnresolved: textureStatus !== "resolved"
  };
};

export const refreshEditorPreviewDrawableTextureLayerState = (
  drawable: EditorPreviewDrawableDto
): EditorPreviewDrawableDto => ({
  ...drawable,
  layerState: {
    runtimeVisible: drawable.visible,
    editorHidden: drawable.layerState?.editorHidden ?? false,
    locked: drawable.layerState?.locked ?? false,
    selected: drawable.layerState?.selected ?? false,
    textureStatus: drawable.texture.status,
    textureBacked: drawable.texture.status === "resolved",
    textureUnresolved: drawable.texture.status !== "resolved"
  }
});

const hasId = (
  ids: readonly string[] | undefined,
  id: string | undefined
): boolean => id !== undefined && ids?.includes(id) === true;
