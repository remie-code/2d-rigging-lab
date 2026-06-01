import type { EditorStateFileDto } from "@private-2d-rigging-lab/package-format";

export interface LayerTreeDraftState {
  readonly selection: readonly string[];
  readonly lockedIds: readonly string[];
  readonly editorHiddenIds: readonly string[];
}

export interface LayerTreeDraftOwner {
  readonly layerTreeDraft: LayerTreeDraftState;
}

export const createEmptyLayerTreeDraftState = (
  input: Partial<Pick<EditorStateFileDto, "selection" | "lockedIds" | "editorHiddenIds" | "activeTool">> = {}
): LayerTreeDraftState => ({
  selection: input.activeTool === "meshEdit" ? [] : normalizeUniqueTargetIds(input.selection ?? []),
  lockedIds: sortTargetIds(normalizeUniqueTargetIds(input.lockedIds ?? [])),
  editorHiddenIds: sortTargetIds(normalizeUniqueTargetIds(input.editorHiddenIds ?? []))
});

export const projectLayerTreeDraftState = (
  editorState: Pick<EditorStateFileDto, "selection" | "lockedIds" | "editorHiddenIds" | "activeTool"> | undefined
): LayerTreeDraftState => createEmptyLayerTreeDraftState(editorState);

export const createEditorStateFileFromLayerTreeDraft = (
  draft: LayerTreeDraftState
): EditorStateFileDto => ({
  schemaVersion: "editor-state-v1",
  selection: [...draft.selection],
  lockedIds: [...draft.lockedIds],
  editorHiddenIds: [...draft.editorHiddenIds]
});

export const selectDrawableLayer = (
  draft: LayerTreeDraftState,
  drawableId: string
): LayerTreeDraftState => {
  const targetId = normalizeTargetId(drawableId);

  return {
    ...draft,
    selection: targetId.length === 0 ? [] : [targetId]
  };
};

export const clearLayerTreeSelection = (
  draft: LayerTreeDraftState
): LayerTreeDraftState => ({
  ...draft,
  selection: []
});

export const setDrawableLayerLocked = (
  draft: LayerTreeDraftState,
  drawableId: string,
  locked: boolean
): LayerTreeDraftState => ({
  ...draft,
  lockedIds: updateTargetIdSet(draft.lockedIds, drawableId, locked)
});

export const toggleDrawableLayerLock = (
  draft: LayerTreeDraftState,
  drawableId: string
): LayerTreeDraftState => {
  const targetId = normalizeTargetId(drawableId);

  return targetId.length === 0
    ? draft
    : setDrawableLayerLocked(draft, targetId, !draft.lockedIds.includes(targetId));
};

export const setDrawableEditorHidden = (
  draft: LayerTreeDraftState,
  drawableId: string,
  editorHidden: boolean
): LayerTreeDraftState => ({
  ...draft,
  editorHiddenIds: updateTargetIdSet(draft.editorHiddenIds, drawableId, editorHidden)
});

export const toggleDrawableEditorHidden = (
  draft: LayerTreeDraftState,
  drawableId: string
): LayerTreeDraftState => {
  const targetId = normalizeTargetId(drawableId);

  return targetId.length === 0
    ? draft
    : setDrawableEditorHidden(draft, targetId, !draft.editorHiddenIds.includes(targetId));
};

export const selectDrawableLayerInEditorState = <State extends LayerTreeDraftOwner>(
  state: State,
  drawableId: string
): State => ({
  ...state,
  layerTreeDraft: selectDrawableLayer(state.layerTreeDraft, drawableId)
});

export const clearLayerTreeSelectionInEditorState = <State extends LayerTreeDraftOwner>(
  state: State
): State => ({
  ...state,
  layerTreeDraft: clearLayerTreeSelection(state.layerTreeDraft)
});

export const setDrawableLayerLockedInEditorState = <State extends LayerTreeDraftOwner>(
  state: State,
  drawableId: string,
  locked: boolean
): State => ({
  ...state,
  layerTreeDraft: setDrawableLayerLocked(state.layerTreeDraft, drawableId, locked)
});

export const toggleDrawableLayerLockInEditorState = <State extends LayerTreeDraftOwner>(
  state: State,
  drawableId: string
): State => ({
  ...state,
  layerTreeDraft: toggleDrawableLayerLock(state.layerTreeDraft, drawableId)
});

export const setDrawableEditorHiddenInEditorState = <State extends LayerTreeDraftOwner>(
  state: State,
  drawableId: string,
  editorHidden: boolean
): State => ({
  ...state,
  layerTreeDraft: setDrawableEditorHidden(state.layerTreeDraft, drawableId, editorHidden)
});

export const toggleDrawableEditorHiddenInEditorState = <State extends LayerTreeDraftOwner>(
  state: State,
  drawableId: string
): State => ({
  ...state,
  layerTreeDraft: toggleDrawableEditorHidden(state.layerTreeDraft, drawableId)
});

const updateTargetIdSet = (
  targetIds: readonly string[],
  drawableId: string,
  include: boolean
): readonly string[] => {
  const targetId = normalizeTargetId(drawableId);
  if (targetId.length === 0) {
    return targetIds;
  }

  const nextIds = new Set(normalizeUniqueTargetIds(targetIds));
  if (include) {
    nextIds.add(targetId);
  } else {
    nextIds.delete(targetId);
  }

  return sortTargetIds([...nextIds]);
};

const normalizeUniqueTargetIds = (targetIds: readonly string[]): readonly string[] => {
  const normalizedIds: string[] = [];
  const seen = new Set<string>();

  for (const targetId of targetIds) {
    const normalizedTargetId = normalizeTargetId(targetId);
    if (normalizedTargetId.length === 0 || seen.has(normalizedTargetId)) {
      continue;
    }

    normalizedIds.push(normalizedTargetId);
    seen.add(normalizedTargetId);
  }

  return normalizedIds;
};

const normalizeTargetId = (targetId: string): string => targetId.trim();

const sortTargetIds = (targetIds: readonly string[]): readonly string[] =>
  [...targetIds].sort((left, right) => left.localeCompare(right));
