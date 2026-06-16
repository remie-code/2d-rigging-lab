import type { DrawableId, PartId, RigControlId } from "@private-2d-rigging-lab/contracts";

export type EditorSelection =
  | {
      readonly kind: "part";
      readonly id: PartId;
    }
  | {
      readonly kind: "drawable";
      readonly id: DrawableId;
    }
  | {
      readonly kind: "drawableSet";
      readonly ids: readonly DrawableId[];
    }
  | {
      readonly kind: "rigControl";
      readonly id: RigControlId;
    }
  | {
      readonly kind: "deformerTreeSet";
      readonly targets: readonly DeformerTreeSelectionTarget[];
    };

export type DrawableSelectionMode = "replace" | "toggle" | "range";

export type DeformerTreeSelectionTarget =
  | {
      readonly kind: "rigControl";
      readonly rigControlId: RigControlId;
    }
  | {
      readonly kind: "boundDrawable";
      readonly drawableId: DrawableId;
      readonly parentRigControlId: RigControlId;
    }
  | {
      readonly kind: "poolDrawable";
      readonly drawableId: DrawableId;
    };

export type DeformerTreeSelectionMode = "replace" | "toggle" | "range";

export interface DrawableSelectionTransitionInput {
  readonly currentSelection: EditorSelection | null;
  readonly anchorDrawableId: DrawableId | null;
  readonly clickedDrawableId: DrawableId;
  readonly visibleDrawableIds: readonly DrawableId[];
  readonly mode: DrawableSelectionMode;
}

export interface DrawableSelectionTransitionResult {
  readonly selection: EditorSelection | null;
  readonly anchorDrawableId: DrawableId;
}

export interface DeformerTreeSelectionTransitionInput {
  readonly currentSelection: EditorSelection | null;
  readonly anchorTarget: DeformerTreeSelectionTarget | null;
  readonly clickedTarget: DeformerTreeSelectionTarget;
  readonly visibleTargets: readonly DeformerTreeSelectionTarget[];
  readonly mode: DeformerTreeSelectionMode;
}

export interface DeformerTreeSelectionTransitionResult {
  readonly selection: EditorSelection | null;
  readonly anchorTarget: DeformerTreeSelectionTarget;
}

export function getSelectedDrawableIds(
  selection: EditorSelection | null
): readonly DrawableId[] {
  if (selection?.kind === "drawable") {
    return [selection.id];
  }

  if (selection?.kind === "drawableSet") {
    return selection.ids;
  }

  return [];
}

export function getSingleSelectedDrawableId(
  selection: EditorSelection | null
): DrawableId | undefined {
  const drawableIds = getSelectedDrawableIds(selection);

  return drawableIds.length === 1 ? drawableIds[0] : undefined;
}

export function isDrawableSelected(
  selection: EditorSelection | null,
  drawableId: DrawableId
): boolean {
  return getSelectedDrawableIds(selection).includes(drawableId);
}

export function createDrawableSelection(
  drawableIds: readonly DrawableId[]
): EditorSelection | null {
  const ids = dedupeDrawableIds(drawableIds);
  if (ids.length === 0) {
    return null;
  }

  if (ids.length === 1) {
    return {
      kind: "drawable",
      id: ids[0]!
    };
  }

  return {
    kind: "drawableSet",
    ids
  };
}

export function getSelectedDeformerTreeTargets(
  selection: EditorSelection | null
): readonly DeformerTreeSelectionTarget[] {
  return selection?.kind === "deformerTreeSet" ? selection.targets : [];
}

export function isDeformerTreeTargetSelected(
  selection: EditorSelection | null,
  target: DeformerTreeSelectionTarget
): boolean {
  if (selection?.kind === "rigControl" && target.kind === "rigControl") {
    return selection.id === target.rigControlId;
  }

  if (selection?.kind === "drawable" && target.kind !== "rigControl") {
    return selection.id === target.drawableId;
  }

  if (selection?.kind !== "deformerTreeSet") {
    return false;
  }

  const targetKey = createDeformerTreeTargetKey(target);
  return selection.targets.some((selectedTarget) =>
    createDeformerTreeTargetKey(selectedTarget) === targetKey
  );
}

export function isDeformerTreeAnchorActiveForSelection(
  selection: EditorSelection | null,
  anchorTarget: DeformerTreeSelectionTarget | null
): boolean {
  if (anchorTarget === null) {
    return true;
  }

  if (selection?.kind === "deformerTreeSet") {
    return true;
  }

  if (selection?.kind === "rigControl" && anchorTarget.kind === "rigControl") {
    return selection.id === anchorTarget.rigControlId;
  }

  return (
    selection?.kind === "drawable" &&
    anchorTarget.kind !== "rigControl" &&
    selection.id === anchorTarget.drawableId
  );
}

export function resolveDrawableSelectionTransition({
  anchorDrawableId,
  clickedDrawableId,
  currentSelection,
  mode,
  visibleDrawableIds
}: DrawableSelectionTransitionInput): DrawableSelectionTransitionResult {
  if (mode === "replace" || !isDrawableSelection(currentSelection)) {
    return createClickedOnlySelection(clickedDrawableId);
  }

  if (mode === "toggle") {
    const currentIds = getSelectedDrawableIds(currentSelection);
    const nextIds = currentIds.includes(clickedDrawableId)
      ? currentIds.filter((drawableId) => drawableId !== clickedDrawableId)
      : [...currentIds, clickedDrawableId];

    return {
      selection: createDrawableSelection(orderDrawableIdsByVisibleTree(nextIds, visibleDrawableIds)),
      anchorDrawableId: clickedDrawableId
    };
  }

  const rangeAnchorDrawableId = anchorDrawableId;
  if (rangeAnchorDrawableId === null) {
    return createClickedOnlySelection(clickedDrawableId);
  }

  const anchorIndex = visibleDrawableIds.indexOf(rangeAnchorDrawableId);
  const clickedIndex = visibleDrawableIds.indexOf(clickedDrawableId);
  if (anchorIndex === -1 || clickedIndex === -1) {
    return createClickedOnlySelection(clickedDrawableId);
  }

  const start = Math.min(anchorIndex, clickedIndex);
  const end = Math.max(anchorIndex, clickedIndex);

  return {
    selection: createDrawableSelection(visibleDrawableIds.slice(start, end + 1)),
    anchorDrawableId: rangeAnchorDrawableId
  };
}

export function resolveDeformerTreeSelectionTransition({
  anchorTarget,
  clickedTarget,
  currentSelection,
  mode,
  visibleTargets
}: DeformerTreeSelectionTransitionInput): DeformerTreeSelectionTransitionResult {
  if (mode === "replace") {
    return createClickedOnlyDeformerTreeSelection(clickedTarget);
  }

  const currentTargets = resolveCurrentDeformerTreeTargets(currentSelection, anchorTarget);
  if (currentTargets.length === 0) {
    return createClickedOnlyDeformerTreeSelection(clickedTarget);
  }

  if (mode === "toggle") {
    const clickedKey = createDeformerTreeTargetKey(clickedTarget);
    const nextTargets = currentTargets.some(
      (target) => createDeformerTreeTargetKey(target) === clickedKey
    )
      ? currentTargets.filter((target) => createDeformerTreeTargetKey(target) !== clickedKey)
      : [...currentTargets, clickedTarget];

    return {
      selection: createDeformerTreeSetSelection(
        orderDeformerTreeTargetsByVisibleTree(nextTargets, visibleTargets)
      ),
      anchorTarget: clickedTarget
    };
  }

  if (anchorTarget === null) {
    return createClickedOnlyDeformerTreeSelection(clickedTarget);
  }

  const anchorIndex = findDeformerTreeTargetIndex(visibleTargets, anchorTarget);
  const clickedIndex = findDeformerTreeTargetIndex(visibleTargets, clickedTarget);
  if (anchorIndex === -1 || clickedIndex === -1) {
    return createClickedOnlyDeformerTreeSelection(clickedTarget);
  }

  const start = Math.min(anchorIndex, clickedIndex);
  const end = Math.max(anchorIndex, clickedIndex);

  return {
    selection: createDeformerTreeSetSelection(visibleTargets.slice(start, end + 1)),
    anchorTarget
  };
}

function createClickedOnlySelection(
  clickedDrawableId: DrawableId
): DrawableSelectionTransitionResult {
  return {
    selection: {
      kind: "drawable",
      id: clickedDrawableId
    },
    anchorDrawableId: clickedDrawableId
  };
}

function createClickedOnlyDeformerTreeSelection(
  clickedTarget: DeformerTreeSelectionTarget
): DeformerTreeSelectionTransitionResult {
  return {
    selection: createLegacySelectionForDeformerTreeTarget(clickedTarget),
    anchorTarget: clickedTarget
  };
}

function createLegacySelectionForDeformerTreeTarget(
  target: DeformerTreeSelectionTarget
): EditorSelection {
  if (target.kind === "rigControl") {
    return {
      kind: "rigControl",
      id: target.rigControlId
    };
  }

  return {
    kind: "drawable",
    id: target.drawableId
  };
}

function createDeformerTreeSetSelection(
  targets: readonly DeformerTreeSelectionTarget[]
): EditorSelection | null {
  const dedupedTargets = dedupeDeformerTreeTargets(targets);
  if (dedupedTargets.length === 0) {
    return null;
  }

  return {
    kind: "deformerTreeSet",
    targets: dedupedTargets
  };
}

function resolveCurrentDeformerTreeTargets(
  selection: EditorSelection | null,
  anchorTarget: DeformerTreeSelectionTarget | null
): readonly DeformerTreeSelectionTarget[] {
  if (selection?.kind === "deformerTreeSet") {
    return selection.targets;
  }

  if (anchorTarget === null) {
    return [];
  }

  if (selection?.kind === "rigControl" && anchorTarget.kind === "rigControl") {
    return selection.id === anchorTarget.rigControlId ? [anchorTarget] : [];
  }

  if (selection?.kind === "drawable" && anchorTarget.kind !== "rigControl") {
    return selection.id === anchorTarget.drawableId ? [anchorTarget] : [];
  }

  return [];
}

function isDrawableSelection(
  selection: EditorSelection | null
): selection is
  | Extract<EditorSelection, { readonly kind: "drawable" }>
  | Extract<EditorSelection, { readonly kind: "drawableSet" }> {
  return selection?.kind === "drawable" || selection?.kind === "drawableSet";
}

function orderDrawableIdsByVisibleTree(
  drawableIds: readonly DrawableId[],
  visibleDrawableIds: readonly DrawableId[]
): readonly DrawableId[] {
  const selectedIds = new Set(dedupeDrawableIds(drawableIds));
  const ordered = visibleDrawableIds.filter((drawableId) => selectedIds.has(drawableId));

  for (const drawableId of selectedIds) {
    if (!visibleDrawableIds.includes(drawableId)) {
      ordered.push(drawableId);
    }
  }

  return ordered;
}

function orderDeformerTreeTargetsByVisibleTree(
  targets: readonly DeformerTreeSelectionTarget[],
  visibleTargets: readonly DeformerTreeSelectionTarget[]
): readonly DeformerTreeSelectionTarget[] {
  const selectedKeys = new Set(
    dedupeDeformerTreeTargets(targets).map((target) => createDeformerTreeTargetKey(target))
  );
  const ordered = visibleTargets.filter((target) =>
    selectedKeys.has(createDeformerTreeTargetKey(target))
  );
  const orderedKeys = new Set(ordered.map((target) => createDeformerTreeTargetKey(target)));

  for (const target of targets) {
    const targetKey = createDeformerTreeTargetKey(target);
    if (!orderedKeys.has(targetKey)) {
      ordered.push(target);
      orderedKeys.add(targetKey);
    }
  }

  return ordered;
}

function dedupeDrawableIds(drawableIds: readonly DrawableId[]): readonly DrawableId[] {
  const result: DrawableId[] = [];
  const seen = new Set<DrawableId>();

  for (const drawableId of drawableIds) {
    if (!seen.has(drawableId)) {
      seen.add(drawableId);
      result.push(drawableId);
    }
  }

  return result;
}

function dedupeDeformerTreeTargets(
  targets: readonly DeformerTreeSelectionTarget[]
): readonly DeformerTreeSelectionTarget[] {
  const result: DeformerTreeSelectionTarget[] = [];
  const seen = new Set<string>();

  for (const target of targets) {
    const key = createDeformerTreeTargetKey(target);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(target);
    }
  }

  return result;
}

function findDeformerTreeTargetIndex(
  targets: readonly DeformerTreeSelectionTarget[],
  target: DeformerTreeSelectionTarget
): number {
  const targetKey = createDeformerTreeTargetKey(target);
  return targets.findIndex((candidate) => createDeformerTreeTargetKey(candidate) === targetKey);
}

function createDeformerTreeTargetKey(target: DeformerTreeSelectionTarget): string {
  if (target.kind === "rigControl") {
    return `rigControl:${target.rigControlId}`;
  }

  if (target.kind === "boundDrawable") {
    return `boundDrawable:${target.parentRigControlId}:${target.drawableId}`;
  }

  return `poolDrawable:${target.drawableId}`;
}
