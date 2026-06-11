import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { DrawableId, PartId } from "@private-2d-rigging-lab/contracts";

import type { EditorSelection } from "./editor-selection";
import { ROOT_PART_ID } from "./empty-authoring-session";

interface StructureTreeRowBase {
  readonly depth: number;
  readonly name: string;
  readonly detail: string;
  readonly tone: "amber" | "neutral" | "teal";
  readonly selected: boolean;
  readonly hidden: boolean;
  readonly effectiveHidden: boolean;
  readonly canToggleVisibility: boolean;
  readonly draggable: boolean;
}

export type StructureTreeRow =
  | (StructureTreeRowBase & {
      readonly id: PartId;
      readonly kind: "part";
      readonly collapsed: boolean;
      readonly canCollapse: boolean;
      readonly editorHidden: boolean;
    })
  | (StructureTreeRowBase & {
      readonly id: DrawableId;
      readonly kind: "drawable";
      readonly runtimeVisible: boolean;
      readonly order: number;
    });

export type InspectorProjection =
  | ProjectInspectorProjection
  | PartInspectorProjection
  | DrawableInspectorProjection;

export interface ProjectInspectorProjection {
  readonly title: string;
  readonly kind: "Project";
  readonly rows: readonly {
    readonly label: string;
    readonly value: string;
  }[];
}

export interface PartInspectorProjection {
  readonly title: string;
  readonly kind: "Part";
  readonly partId: PartId;
  readonly displayName: string;
  readonly parentLabel: string;
  readonly editorHidden: boolean;
  readonly effectiveHidden: boolean;
  readonly canToggleVisibility: boolean;
}

export interface DrawableInspectorProjection {
  readonly title: string;
  readonly kind: "Drawable";
  readonly drawableId: DrawableId;
  readonly displayName: string;
  readonly runtimeVisible: boolean;
  readonly effectiveVisible: boolean;
  readonly hiddenByPart: boolean;
  readonly defaultOpacity: number;
  readonly partLabel: string;
  readonly sourceSummary: string;
  readonly textureSummary: string;
  readonly meshSummary: string;
  readonly maskSourceDrawableId?: DrawableId;
  readonly clippingOptions: readonly {
    readonly drawableId: DrawableId;
    readonly displayName: string;
  }[];
}

export interface EditorProjectionState {
  readonly collapsedPartIds?: ReadonlySet<PartId>;
  readonly editorHiddenPartIds?: ReadonlySet<PartId>;
}

export interface DrawableReorderEntry {
  readonly drawableId: DrawableId;
  readonly baseDrawOrder: number;
}

export type DrawableDropPlacement = "before" | "after";

type ModelPart = AuthoringSession["graph"]["parts"][number];
type Drawable = AuthoringSession["graph"]["drawables"][number];

export function createStructureTreeRows(
  session: AuthoringSession,
  selection: EditorSelection | null,
  state: EditorProjectionState = {}
): readonly StructureTreeRow[] {
  const partsById = new Map(session.graph.parts.map((part) => [part.partId, part]));
  const drawablesById = new Map(
    session.graph.drawables.map((drawable) => [drawable.drawableId, drawable])
  );
  const drawOrderByDrawableId = createDrawOrderIndex(session);
  const collapsedPartIds = state.collapsedPartIds ?? new Set<PartId>();
  const editorHiddenPartIds = state.editorHiddenPartIds ?? new Set<PartId>();
  const roots = session.graph.parts.filter((part) => part.parentPartId === undefined);
  const rootParts = roots.length > 0 ? roots : [partsById.get(ROOT_PART_ID)].filter(isDefined);
  const rows: StructureTreeRow[] = [];
  const visitedParts = new Set<string>();

  const appendPart = (part: ModelPart, depth: number, ancestorHidden: boolean) => {
    if (visitedParts.has(part.partId)) {
      return;
    }

    visitedParts.add(part.partId);
    const editorHidden = editorHiddenPartIds.has(part.partId);
    const effectiveHidden = ancestorHidden || editorHidden;
    const canToggleVisibility = part.partId !== ROOT_PART_ID;
    const collapsed = collapsedPartIds.has(part.partId);
    const canCollapse = part.childPartIds.length > 0 || part.drawableIds.length > 0;
    rows.push({
      id: part.partId,
      kind: "part",
      depth,
      name: part.displayName,
      detail:
        part.partId === ROOT_PART_ID
          ? "Project root"
          : effectiveHidden
            ? "Hidden Part Container"
            : "Part Container",
      tone: part.partId === ROOT_PART_ID ? "neutral" : "teal",
      selected: selection?.kind === "part" && selection.id === part.partId,
      hidden: editorHidden,
      effectiveHidden,
      canToggleVisibility,
      draggable: part.partId !== ROOT_PART_ID,
      collapsed,
      canCollapse,
      editorHidden
    });

    if (collapsed) {
      return;
    }

    for (const childPartId of part.childPartIds) {
      const childPart = partsById.get(childPartId);
      if (childPart !== undefined) {
        appendPart(childPart, depth + 1, effectiveHidden);
      }
    }

    const drawableIds = [...part.drawableIds].sort(
      (left, right) =>
        (drawOrderByDrawableId.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (drawOrderByDrawableId.get(right) ?? Number.MAX_SAFE_INTEGER)
    );
    for (const drawableId of drawableIds) {
      const drawable = drawablesById.get(drawableId);
      if (drawable !== undefined) {
        appendDrawable(drawable, depth + 1, effectiveHidden);
      }
    }
  };

  const appendDrawable = (drawable: Drawable, depth: number, hiddenByPart: boolean) => {
    const effectiveHidden = hiddenByPart || !drawable.runtimeVisibility;
    rows.push({
      id: drawable.drawableId,
      kind: "drawable",
      depth,
      name: drawable.displayName,
      detail:
        hiddenByPart && drawable.runtimeVisibility
          ? "Hidden by Part Container"
          : drawable.runtimeVisibility
            ? "Drawable"
            : "Hidden Drawable",
      tone: effectiveHidden ? "neutral" : "amber",
      selected: selection?.kind === "drawable" && selection.id === drawable.drawableId,
      hidden: !drawable.runtimeVisibility,
      effectiveHidden,
      canToggleVisibility: true,
      draggable: true,
      runtimeVisible: drawable.runtimeVisibility,
      order: drawOrderByDrawableId.get(drawable.drawableId) ?? Number.MAX_SAFE_INTEGER
    });
  };

  for (const rootPart of rootParts) {
    appendPart(rootPart, 0, false);
  }

  return rows;
}

export function createInspectorProjection(
  session: AuthoringSession,
  selection: EditorSelection | null,
  state: EditorProjectionState = {}
): InspectorProjection {
  const editorHiddenPartIds = state.editorHiddenPartIds ?? new Set<PartId>();
  if (selection?.kind === "part") {
    const part = findPart(session, selection.id);
    if (part !== undefined) {
      return {
        title: part.displayName,
        kind: "Part",
        partId: part.partId,
        displayName: part.displayName,
        parentLabel: resolveParentLabel(session, part),
        editorHidden: editorHiddenPartIds.has(part.partId),
        effectiveHidden: isPartEffectivelyHidden(session, part.partId, editorHiddenPartIds),
        canToggleVisibility: part.partId !== ROOT_PART_ID
      };
    }
  }

  if (selection?.kind === "drawable") {
    const drawable = findDrawable(session, selection.id);
    if (drawable !== undefined) {
      const hiddenByPart = isPartEffectivelyHidden(session, drawable.partId, editorHiddenPartIds);
      const sourceLayer = findSourceLayerForDrawable(session, drawable.drawableId);
      const maskSourceDrawableId = findMaskSourceDrawableId(session, drawable.drawableId);
      return {
        title: drawable.displayName,
        kind: "Drawable",
        drawableId: drawable.drawableId,
        displayName: drawable.displayName,
        runtimeVisible: drawable.runtimeVisibility,
        effectiveVisible: drawable.runtimeVisibility && !hiddenByPart,
        hiddenByPart,
        defaultOpacity: drawable.defaultOpacity,
        partLabel: findPart(session, drawable.partId)?.displayName ?? "Missing part",
        sourceSummary: sourceLayer?.originalName ?? sourceLayer?.normalizedName ?? "PSD layer",
        textureSummary: session.graph.textureAtlas?.textures.some(
          (texture) => texture.textureId === drawable.textureId
        )
          ? "Texture linked"
          : "Texture pending",
        meshSummary: session.graph.meshes.some((mesh) => mesh.meshId === drawable.meshId)
          ? "Mesh scaffold"
          : "Mesh pending",
        ...(maskSourceDrawableId === undefined ? {} : { maskSourceDrawableId }),
        clippingOptions: createClippingOptions(session, drawable.drawableId)
      };
    }
  }

  return {
    title: session.packageIdentity.packageDisplayName,
    kind: "Project",
    rows: [
      { label: "Target", value: "Project" },
      { label: "Parts", value: String(session.graph.parts.length) },
      { label: "Drawables", value: String(session.graph.drawables.length) },
      { label: "Revision", value: String(session.packageRevision) }
    ]
  };
}

export function createDrawableReorderEntries(
  session: AuthoringSession,
  draggedDrawableId: DrawableId,
  targetDrawableId: DrawableId,
  placement: DrawableDropPlacement
): readonly DrawableReorderEntry[] | undefined {
  if (draggedDrawableId === targetDrawableId) {
    return undefined;
  }

  const orderedDrawableIds = getDrawableIdsByProjectedTreeOrder(session);
  const draggedIndex = orderedDrawableIds.indexOf(draggedDrawableId);
  const targetIndex = orderedDrawableIds.indexOf(targetDrawableId);
  if (draggedIndex === -1 || targetIndex === -1) {
    return undefined;
  }

  const next = [...orderedDrawableIds];
  next.splice(draggedIndex, 1);
  const adjustedTargetIndex = next.indexOf(targetDrawableId);
  const insertIndex = placement === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1;
  next.splice(insertIndex, 0, draggedDrawableId);

  if (next.every((drawableId, index) => orderedDrawableIds[index] === drawableId)) {
    return undefined;
  }

  return next.map((drawableId, index) => ({
    drawableId,
    baseDrawOrder: index
  }));
}

export function createDrawableTreeOrderEntries(
  session: AuthoringSession
): readonly DrawableReorderEntry[] | undefined {
  const treeOrder = getDrawableIdsByProjectedTreeOrder(session);
  const drawOrder = getDrawableIdsByGlobalDrawOrder(session);

  if (treeOrder.every((drawableId, index) => drawOrder[index] === drawableId)) {
    return undefined;
  }

  return treeOrder.map((drawableId, index) => ({
    drawableId,
    baseDrawOrder: index
  }));
}

export function canReparentPart(
  session: AuthoringSession,
  partId: PartId,
  parentPartId: PartId
): boolean {
  if (partId === ROOT_PART_ID || partId === parentPartId) {
    return false;
  }

  const part = findPart(session, partId);
  const parentPart = findPart(session, parentPartId);
  if (part === undefined || parentPart === undefined || part.parentPartId === parentPartId) {
    return false;
  }

  return !isDescendantPart(session, partId, parentPartId);
}

export function resolveDestinationPart(
  session: AuthoringSession,
  selection: EditorSelection | null
): ModelPart {
  if (selection?.kind === "part") {
    const selectedPart = findPart(session, selection.id);
    if (selectedPart !== undefined) {
      return selectedPart;
    }
  }

  if (selection?.kind === "drawable") {
    const drawable = findDrawable(session, selection.id);
    const parentPart = drawable === undefined ? undefined : findPart(session, drawable.partId);
    if (parentPart !== undefined) {
      return parentPart;
    }
  }

  return findPart(session, ROOT_PART_ID) ?? session.graph.parts[0]!;
}

export function findPart(session: AuthoringSession, partId: PartId): ModelPart | undefined {
  return session.graph.parts.find((part) => part.partId === partId);
}

export function findDrawable(
  session: AuthoringSession,
  drawableId: DrawableId
): Drawable | undefined {
  return session.graph.drawables.find((drawable) => drawable.drawableId === drawableId);
}

function resolveParentLabel(session: AuthoringSession, part: ModelPart): string {
  if (part.parentPartId === undefined) {
    return "None";
  }

  return findPart(session, part.parentPartId)?.displayName ?? "Missing part";
}

function createDrawOrderIndex(session: AuthoringSession): ReadonlyMap<DrawableId, number> {
  return new Map(session.graph.drawOrder.map((entry) => [entry.drawableId, entry.stableOrder]));
}

function getDrawableIdsByProjectedTreeOrder(session: AuthoringSession): DrawableId[] {
  const projectedDrawableIds = createStructureTreeRows(session, null)
    .filter((row): row is Extract<StructureTreeRow, { readonly kind: "drawable" }> => row.kind === "drawable")
    .map((row) => row.id);
  const seen = new Set(projectedDrawableIds);
  const fallbackDrawableIds = getDrawableIdsByGlobalDrawOrder(session).filter(
    (drawableId) => !seen.has(drawableId)
  );

  return [...projectedDrawableIds, ...fallbackDrawableIds];
}

function getDrawableIdsByGlobalDrawOrder(session: AuthoringSession): DrawableId[] {
  const drawOrderByDrawableId = createDrawOrderIndex(session);

  return session.graph.drawables
    .map((drawable) => drawable.drawableId)
    .sort(
      (left, right) =>
        (drawOrderByDrawableId.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (drawOrderByDrawableId.get(right) ?? Number.MAX_SAFE_INTEGER)
    );
}

function isPartEffectivelyHidden(
  session: AuthoringSession,
  partId: PartId,
  editorHiddenPartIds: ReadonlySet<PartId>
): boolean {
  const partsById = new Map(session.graph.parts.map((part) => [part.partId, part]));
  let current = partsById.get(partId);

  while (current !== undefined) {
    if (editorHiddenPartIds.has(current.partId)) {
      return true;
    }

    current = current.parentPartId === undefined ? undefined : partsById.get(current.parentPartId);
  }

  return false;
}

function findSourceLayerForDrawable(session: AuthoringSession, drawableId: DrawableId) {
  for (const sourceAsset of session.graph.sourceAssets) {
    for (const layer of sourceAsset.layers) {
      if (layer.mappedDrawableIds.includes(drawableId)) {
        return layer;
      }
    }
  }

  return undefined;
}

function findMaskSourceDrawableId(
  session: AuthoringSession,
  targetDrawableId: DrawableId
): DrawableId | undefined {
  const relation = session.graph.masks.find(
    (candidate) => candidate.enabled && candidate.targetDrawableIds.includes(targetDrawableId)
  );

  return relation?.maskDrawableIds[0];
}

function createClippingOptions(
  session: AuthoringSession,
  selectedDrawableId: DrawableId
): DrawableInspectorProjection["clippingOptions"] {
  const drawOrderByDrawableId = createDrawOrderIndex(session);

  return session.graph.drawables
    .filter((drawable) => drawable.drawableId !== selectedDrawableId)
    .sort(
      (left, right) =>
        (drawOrderByDrawableId.get(left.drawableId) ?? Number.MAX_SAFE_INTEGER) -
        (drawOrderByDrawableId.get(right.drawableId) ?? Number.MAX_SAFE_INTEGER)
    )
    .map((drawable) => ({
      drawableId: drawable.drawableId,
      displayName: drawable.displayName
    }));
}

function isDescendantPart(
  session: AuthoringSession,
  ancestorPartId: PartId,
  candidatePartId: PartId
): boolean {
  const stack = [...(findPart(session, ancestorPartId)?.childPartIds ?? [])];
  const seen = new Set<string>();

  while (stack.length > 0) {
    const partId = stack.pop();
    if (partId === undefined || seen.has(partId)) {
      continue;
    }

    if (partId === candidatePartId) {
      return true;
    }

    seen.add(partId);
    stack.push(...(findPart(session, partId)?.childPartIds ?? []));
  }

  return false;
}

function isDefined<TValue>(value: TValue | undefined): value is TValue {
  return value !== undefined;
}
