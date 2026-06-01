import type {
  ModelPartDto,
  TextureAtlasFileDto
} from "@private-2d-rigging-lab/package-format";

import type { DrawableListItemState } from "./drawable-list-state.js";

export interface PartTextureWorkflowPartOptionViewModel {
  readonly partId: string;
  readonly displayName: string;
  readonly label: string;
}

export interface PartTextureWorkflowDrawableOptionViewModel {
  readonly drawableId: string;
  readonly displayName: string;
  readonly partId: string;
  readonly textureId: string;
  readonly label: string;
}

export interface PartTextureWorkflowTextureOptionViewModel {
  readonly textureId: string;
  readonly filePath: string;
  readonly label: string;
}

export interface PartTextureWorkflowViewModel {
  readonly partOptions: readonly PartTextureWorkflowPartOptionViewModel[];
  readonly drawableOptions: readonly PartTextureWorkflowDrawableOptionViewModel[];
  readonly textureOptions: readonly PartTextureWorkflowTextureOptionViewModel[];
  readonly canCreatePart: boolean;
  readonly canUpdatePart: boolean;
  readonly canAssignDrawablePart: boolean;
  readonly canAssignDrawableTexture: boolean;
  readonly defaultCreatePartName: string;
  readonly defaultUpdatePartName: string;
  readonly defaultParentPartId: string;
  readonly defaultUpdatePartId: string;
  readonly defaultDrawableId: string;
  readonly defaultTargetPartId: string;
  readonly defaultTextureId: string;
  readonly textureAssignmentStatusLabel: string;
  readonly partAssignmentStatusLabel: string;
}

export const projectPartTextureWorkflowViewModel = (input: {
  readonly loaded: boolean;
  readonly parts: readonly ModelPartDto[];
  readonly drawables: readonly DrawableListItemState[];
  readonly textureAtlas: TextureAtlasFileDto | null;
}): PartTextureWorkflowViewModel => {
  const partOptions = input.parts.map((part) => ({
    partId: part.partId,
    displayName: part.displayName,
    label: `${part.displayName} / ${part.partId}`
  }));
  const drawableOptions = input.drawables.map((drawable) => ({
    drawableId: drawable.drawableId,
    displayName: drawable.displayName,
    partId: drawable.partId,
    textureId: drawable.textureId,
    label: `${drawable.displayName} / ${drawable.drawableId}`
  }));
  const textureOptions = (input.textureAtlas?.textures ?? []).map((texture) => ({
    textureId: texture.textureId,
    filePath: texture.filePath,
    label: `${texture.textureId} / ${texture.filePath}`
  }));
  const firstPartId = partOptions[0]?.partId ?? "";
  const firstDrawableId = drawableOptions[0]?.drawableId ?? "";
  const firstTextureId = textureOptions[0]?.textureId ?? "";

  return {
    partOptions,
    drawableOptions,
    textureOptions,
    canCreatePart: input.loaded,
    canUpdatePart: input.loaded && partOptions.length > 0,
    canAssignDrawablePart: input.loaded && drawableOptions.length > 0 && partOptions.length > 0,
    canAssignDrawableTexture: input.loaded && drawableOptions.length > 0 && textureOptions.length > 0,
    defaultCreatePartName: "New Part",
    defaultUpdatePartName: partOptions[0]?.displayName ?? "",
    defaultParentPartId: firstPartId,
    defaultUpdatePartId: firstPartId,
    defaultDrawableId: firstDrawableId,
    defaultTargetPartId: firstPartId,
    defaultTextureId: firstTextureId,
    textureAssignmentStatusLabel:
      textureOptions.length === 0
        ? "No texture atlas entries available"
        : `${textureOptions.length} texture atlas entr${textureOptions.length === 1 ? "y" : "ies"}`,
    partAssignmentStatusLabel:
      partOptions.length === 0
        ? "No parts available"
        : `${partOptions.length} part${partOptions.length === 1 ? "" : "s"} / ${drawableOptions.length} drawable${drawableOptions.length === 1 ? "" : "s"}`
  };
};
