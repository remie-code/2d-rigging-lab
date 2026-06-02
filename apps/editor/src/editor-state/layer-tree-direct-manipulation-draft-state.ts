export interface LayerTreePartRenameDraftCommand {
  readonly partId: string;
  readonly displayName: string;
}

export interface LayerTreePartReparentDraftCommand {
  readonly partId: string;
  readonly parentPartId: string | null;
}

export interface LayerTreeEmptyLeafPartDeleteDraftCommand {
  readonly partId: string;
}

export interface LayerTreeDrawablePartAssignmentDraftCommand {
  readonly drawableId: string;
  readonly partId: string;
}

export interface LayerTreeDrawableTextureAssignmentDraftCommand {
  readonly drawableId: string;
  readonly textureId: string;
}

export interface LayerTreePartRenameDraft extends LayerTreePartRenameDraftCommand {
  readonly draftKind: "partRename";
}

export interface LayerTreePartReparentDraft extends LayerTreePartReparentDraftCommand {
  readonly draftKind: "partReparent";
}

export interface LayerTreeEmptyLeafPartDeleteDraft extends LayerTreeEmptyLeafPartDeleteDraftCommand {
  readonly draftKind: "emptyLeafPartDelete";
}

export interface LayerTreeDrawablePartAssignmentDraft extends LayerTreeDrawablePartAssignmentDraftCommand {
  readonly draftKind: "drawablePartAssignment";
}

export interface LayerTreeDrawableTextureAssignmentDraft extends LayerTreeDrawableTextureAssignmentDraftCommand {
  readonly draftKind: "drawableTextureAssignment";
}

export interface LayerTreeDirectManipulationDraftState {
  readonly partRenames: readonly LayerTreePartRenameDraft[];
  readonly partReparents: readonly LayerTreePartReparentDraft[];
  readonly emptyLeafPartDeletes: readonly LayerTreeEmptyLeafPartDeleteDraft[];
  readonly drawablePartAssignments: readonly LayerTreeDrawablePartAssignmentDraft[];
  readonly drawableTextureAssignments: readonly LayerTreeDrawableTextureAssignmentDraft[];
}

export const createEmptyLayerTreeDirectManipulationDraftState =
  (): LayerTreeDirectManipulationDraftState => ({
    partRenames: [],
    partReparents: [],
    emptyLeafPartDeletes: [],
    drawablePartAssignments: [],
    drawableTextureAssignments: []
  });

export const hasLayerTreeDirectManipulationDraft = (
  draft: LayerTreeDirectManipulationDraftState
): boolean =>
  draft.partRenames.length > 0 ||
  draft.partReparents.length > 0 ||
  draft.emptyLeafPartDeletes.length > 0 ||
  draft.drawablePartAssignments.length > 0 ||
  draft.drawableTextureAssignments.length > 0;

export const countLayerTreeDirectManipulationDrafts = (
  draft: LayerTreeDirectManipulationDraftState
): number =>
  draft.partRenames.length +
  draft.partReparents.length +
  draft.emptyLeafPartDeletes.length +
  draft.drawablePartAssignments.length +
  draft.drawableTextureAssignments.length;

export const draftPartRenameInDirectManipulationState = (
  draft: LayerTreeDirectManipulationDraftState,
  command: LayerTreePartRenameDraftCommand
): LayerTreeDirectManipulationDraftState => {
  const partId = normalizeTargetId(command.partId);
  const displayName = command.displayName.trim();
  if (partId.length === 0 || displayName.length === 0) {
    return draft;
  }

  return {
    ...draft,
    partRenames: upsertByTargetId(
      draft.partRenames,
      { draftKind: "partRename", partId, displayName },
      "partId"
    )
  };
};

export const draftPartReparentInDirectManipulationState = (
  draft: LayerTreeDirectManipulationDraftState,
  command: LayerTreePartReparentDraftCommand
): LayerTreeDirectManipulationDraftState => {
  const partId = normalizeTargetId(command.partId);
  if (partId.length === 0) {
    return draft;
  }

  return {
    ...draft,
    partReparents: upsertByTargetId(
      draft.partReparents,
      {
        draftKind: "partReparent",
        partId,
        parentPartId: normalizeNullableTargetId(command.parentPartId)
      },
      "partId"
    )
  };
};

export const draftEmptyLeafPartDeleteInDirectManipulationState = (
  draft: LayerTreeDirectManipulationDraftState,
  command: LayerTreeEmptyLeafPartDeleteDraftCommand
): LayerTreeDirectManipulationDraftState => {
  const partId = normalizeTargetId(command.partId);
  if (partId.length === 0) {
    return draft;
  }

  return {
    ...draft,
    emptyLeafPartDeletes: upsertByTargetId(
      draft.emptyLeafPartDeletes,
      { draftKind: "emptyLeafPartDelete", partId },
      "partId"
    )
  };
};

export const draftDrawablePartAssignmentInDirectManipulationState = (
  draft: LayerTreeDirectManipulationDraftState,
  command: LayerTreeDrawablePartAssignmentDraftCommand
): LayerTreeDirectManipulationDraftState => {
  const drawableId = normalizeTargetId(command.drawableId);
  const partId = normalizeTargetId(command.partId);
  if (drawableId.length === 0 || partId.length === 0) {
    return draft;
  }

  return {
    ...draft,
    drawablePartAssignments: upsertByTargetId(
      draft.drawablePartAssignments,
      { draftKind: "drawablePartAssignment", drawableId, partId },
      "drawableId"
    )
  };
};

export const draftDrawableTextureAssignmentInDirectManipulationState = (
  draft: LayerTreeDirectManipulationDraftState,
  command: LayerTreeDrawableTextureAssignmentDraftCommand
): LayerTreeDirectManipulationDraftState => {
  const drawableId = normalizeTargetId(command.drawableId);
  const textureId = normalizeTargetId(command.textureId);
  if (drawableId.length === 0 || textureId.length === 0) {
    return draft;
  }

  return {
    ...draft,
    drawableTextureAssignments: upsertByTargetId(
      draft.drawableTextureAssignments,
      { draftKind: "drawableTextureAssignment", drawableId, textureId },
      "drawableId"
    )
  };
};

const upsertByTargetId = <
  Item extends Readonly<Record<TargetKey, string>>,
  TargetKey extends keyof Item
>(
  items: readonly Item[],
  nextItem: Item,
  targetKey: TargetKey
): readonly Item[] => {
  const nextItems = new Map(items.map((item) => [item[targetKey], item]));
  nextItems.set(nextItem[targetKey], nextItem);

  return [...nextItems.values()].sort((left, right) =>
    left[targetKey].localeCompare(right[targetKey])
  );
};

const normalizeTargetId = (targetId: string): string => targetId.trim();

const normalizeNullableTargetId = (targetId: string | null): string | null => {
  const normalizedTargetId = targetId?.trim() ?? "";

  return normalizedTargetId.length === 0 ? null : normalizedTargetId;
};
