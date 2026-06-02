import type {
  ModelPartDto,
  TextureAtlasEntryDto,
  TextureAtlasFileDto
} from "@private-2d-rigging-lab/package-format";

import type { DrawableListItemState } from "./drawable-list-state.js";
import {
  createUnavailableDrawableDirectManipulation,
  createUnavailablePartDirectManipulation,
  projectLayerTreeDirectManipulationViewModel,
  type LayerTreeDirectManipulationViewModel,
  type LayerTreeDrawableDirectManipulationViewModel,
  type LayerTreePartDirectManipulationViewModel
} from "./layer-tree-direct-manipulation-view-model.js";
import type { LayerTreeDraftState } from "./layer-tree-draft-state.js";

export type LayerTreePartStatus = "resolved" | "missing";
export type LayerTreeTextureStatus = "resolved" | "missing" | "unassigned";

export interface LayerTreeDrawableViewModel {
  readonly drawableId: string;
  readonly displayName: string;
  readonly partId: string;
  readonly partStatus: LayerTreePartStatus;
  readonly textureId: string;
  readonly textureStatus: LayerTreeTextureStatus;
  readonly textureFilePath: string | null;
  readonly textureLabel: string;
  readonly textureStatusLabel: string;
  readonly runtimeVisible: boolean;
  readonly runtimeVisibilityLabel: string;
  readonly editorHidden: boolean;
  readonly editorVisibilityLabel: string;
  readonly locked: boolean;
  readonly lockedLabel: string;
  readonly selected: boolean;
  readonly selectedLabel: string;
  readonly orderLabel: string;
  readonly stateLabel: string;
  readonly directManipulation: LayerTreeDrawableDirectManipulationViewModel;
}

export interface LayerTreePartGroupViewModel {
  readonly partId: string;
  readonly displayName: string;
  readonly parentPartId: string | null;
  readonly depth: number;
  readonly partStatus: LayerTreePartStatus;
  readonly partLabel: string;
  readonly drawableCount: number;
  readonly drawableCountLabel: string;
  readonly directManipulation: LayerTreePartDirectManipulationViewModel;
  readonly drawables: readonly LayerTreeDrawableViewModel[];
}

export interface LayerTreeViewModel {
  readonly partGroups: readonly LayerTreePartGroupViewModel[];
  readonly hasParts: boolean;
  readonly hasDrawables: boolean;
  readonly drawableCount: number;
  readonly selectedDrawableIds: readonly string[];
  readonly lockedDrawableIds: readonly string[];
  readonly editorHiddenDrawableIds: readonly string[];
  readonly missingTextureDrawableIds: readonly string[];
  readonly directManipulationDraftCount: number;
  readonly partCountLabel: string;
  readonly drawableCountLabel: string;
  readonly selectedCountLabel: string;
  readonly lockedCountLabel: string;
  readonly editorHiddenCountLabel: string;
  readonly missingTextureCountLabel: string;
  readonly directManipulationDraftCountLabel: string;
  readonly directManipulationSummaryLabel: string;
  readonly summaryLabel: string;
}

export interface LayerTreeViewModelInput {
  readonly parts: readonly ModelPartDto[];
  readonly drawables: readonly DrawableListItemState[];
  readonly textureAtlas: TextureAtlasFileDto | null;
  readonly layerTreeDraft: LayerTreeDraftState;
}

interface LayerTreePartProjection {
  readonly partId: string;
  readonly displayName: string;
  readonly parentPartId?: string | undefined;
  readonly childPartIds: readonly string[];
  readonly drawableIds: readonly string[];
}

export const projectLayerTreeViewModel = (
  input: LayerTreeViewModelInput
): LayerTreeViewModel => {
  const partsById = new Map(input.parts.map((part) => [part.partId, part]));
  const drawablesByPartId = groupDrawablesByPartId(input.drawables);
  const textureEntriesById = new Map(
    (input.textureAtlas?.textures ?? []).map((textureEntry) => [textureEntry.textureId, textureEntry])
  );
  const selectedIds = new Set(input.layerTreeDraft.selection);
  const lockedIds = new Set(input.layerTreeDraft.lockedIds);
  const editorHiddenIds = new Set(input.layerTreeDraft.editorHiddenIds);
  const directManipulation = projectLayerTreeDirectManipulationViewModel(input);

  const partGroups = [
    ...orderPartsByHierarchy(input.parts).map(({ part, depth }) =>
      projectPartGroup({
        part,
        depth,
        partStatus: "resolved",
        drawables: drawablesByPartId.get(part.partId) ?? [],
        textureEntriesById,
        selectedIds,
        lockedIds,
        editorHiddenIds,
        directManipulation
      })
    ),
    ...projectMissingPartGroups({
      partsById,
      drawablesByPartId,
      textureEntriesById,
      selectedIds,
      lockedIds,
      editorHiddenIds,
      directManipulation
    })
  ];
  const drawableItems = partGroups.flatMap((group) => group.drawables);
  const selectedDrawableIds = drawableItems
    .filter((drawable) => drawable.selected)
    .map((drawable) => drawable.drawableId);
  const lockedDrawableIds = drawableItems
    .filter((drawable) => drawable.locked)
    .map((drawable) => drawable.drawableId);
  const editorHiddenDrawableIds = drawableItems
    .filter((drawable) => drawable.editorHidden)
    .map((drawable) => drawable.drawableId);
  const missingTextureDrawableIds = drawableItems
    .filter((drawable) => drawable.textureStatus === "missing")
    .map((drawable) => drawable.drawableId);

  return {
    partGroups,
    hasParts: partGroups.length > 0,
    hasDrawables: input.drawables.length > 0,
    drawableCount: input.drawables.length,
    selectedDrawableIds,
    lockedDrawableIds,
    editorHiddenDrawableIds,
    missingTextureDrawableIds,
    directManipulationDraftCount: directManipulation.draftCount,
    partCountLabel: formatCount(partGroups.length, "part group"),
    drawableCountLabel: formatCount(input.drawables.length, "drawable"),
    selectedCountLabel: formatCount(selectedDrawableIds.length, "selected drawable"),
    lockedCountLabel: formatCount(lockedDrawableIds.length, "locked drawable"),
    editorHiddenCountLabel: formatCount(editorHiddenDrawableIds.length, "editor-hidden drawable"),
    missingTextureCountLabel: formatCount(missingTextureDrawableIds.length, "missing texture"),
    directManipulationDraftCountLabel: directManipulation.draftCountLabel,
    directManipulationSummaryLabel: directManipulation.summaryLabel,
    summaryLabel: [
      formatCount(partGroups.length, "part group"),
      formatCount(input.drawables.length, "drawable"),
      formatCount(selectedDrawableIds.length, "selected"),
      formatCount(lockedDrawableIds.length, "locked"),
      formatCount(editorHiddenDrawableIds.length, "editor-hidden"),
      formatCount(missingTextureDrawableIds.length, "missing texture")
    ].join(" / ")
  };
};

const groupDrawablesByPartId = (
  drawables: readonly DrawableListItemState[]
): Map<string, readonly DrawableListItemState[]> => {
  const groups = new Map<string, DrawableListItemState[]>();

  for (const drawable of drawables) {
    groups.set(drawable.partId, [...(groups.get(drawable.partId) ?? []), drawable]);
  }

  return groups;
};

const projectMissingPartGroups = (input: {
  readonly partsById: ReadonlyMap<string, ModelPartDto>;
  readonly drawablesByPartId: ReadonlyMap<string, readonly DrawableListItemState[]>;
  readonly textureEntriesById: ReadonlyMap<string, TextureAtlasEntryDto>;
  readonly selectedIds: ReadonlySet<string>;
  readonly lockedIds: ReadonlySet<string>;
  readonly editorHiddenIds: ReadonlySet<string>;
  readonly directManipulation: LayerTreeDirectManipulationViewModel;
}): readonly LayerTreePartGroupViewModel[] =>
  [...input.drawablesByPartId.keys()]
    .filter((partId) => !input.partsById.has(partId))
    .sort((left, right) => left.localeCompare(right))
    .map((partId) =>
      projectPartGroup({
        part: {
          partId,
          displayName: `Missing part ${partId}`,
          childPartIds: [],
          drawableIds: input.drawablesByPartId.get(partId)?.map((drawable) => drawable.drawableId) ?? []
        },
        depth: 0,
        partStatus: "missing",
        drawables: input.drawablesByPartId.get(partId) ?? [],
        textureEntriesById: input.textureEntriesById,
        selectedIds: input.selectedIds,
        lockedIds: input.lockedIds,
        editorHiddenIds: input.editorHiddenIds,
        directManipulation: input.directManipulation
      })
    );

const projectPartGroup = (input: {
  readonly part: LayerTreePartProjection;
  readonly depth: number;
  readonly partStatus: LayerTreePartStatus;
  readonly drawables: readonly DrawableListItemState[];
  readonly textureEntriesById: ReadonlyMap<string, TextureAtlasEntryDto>;
  readonly selectedIds: ReadonlySet<string>;
  readonly lockedIds: ReadonlySet<string>;
  readonly editorHiddenIds: ReadonlySet<string>;
  readonly directManipulation: LayerTreeDirectManipulationViewModel;
}): LayerTreePartGroupViewModel => ({
  partId: input.part.partId,
  displayName: input.part.displayName,
  parentPartId: input.part.parentPartId ?? null,
  depth: input.depth,
  partStatus: input.partStatus,
  partLabel:
    input.partStatus === "resolved"
      ? `${input.part.displayName} / ${input.part.partId}`
      : `Missing part ${input.part.partId}`,
  drawableCount: input.drawables.length,
  drawableCountLabel: formatCount(input.drawables.length, "drawable"),
  directManipulation:
    input.directManipulation.partDraftsByPartId.get(input.part.partId) ??
    createUnavailablePartDirectManipulation(input.part.partId),
  drawables: input.drawables.map((drawable) =>
    projectLayerTreeDrawable({
      drawable,
      partStatus: input.partStatus,
      textureEntriesById: input.textureEntriesById,
      selectedIds: input.selectedIds,
      lockedIds: input.lockedIds,
      editorHiddenIds: input.editorHiddenIds,
      directManipulation:
        input.directManipulation.drawableDraftsByDrawableId.get(drawable.drawableId) ??
        createUnavailableDrawableDirectManipulation(drawable.drawableId)
    })
  )
});

const projectLayerTreeDrawable = (input: {
  readonly drawable: DrawableListItemState;
  readonly partStatus: LayerTreePartStatus;
  readonly textureEntriesById: ReadonlyMap<string, TextureAtlasEntryDto>;
  readonly selectedIds: ReadonlySet<string>;
  readonly lockedIds: ReadonlySet<string>;
  readonly editorHiddenIds: ReadonlySet<string>;
  readonly directManipulation: LayerTreeDrawableDirectManipulationViewModel;
}): LayerTreeDrawableViewModel => {
  const texture = projectTextureState(input.drawable.textureId, input.textureEntriesById);
  const runtimeVisibilityLabel = input.drawable.visible ? "Runtime visible" : "Runtime hidden";
  const editorHidden = input.editorHiddenIds.has(input.drawable.drawableId);
  const locked = input.lockedIds.has(input.drawable.drawableId);
  const selected = input.selectedIds.has(input.drawable.drawableId);
  const editorVisibilityLabel = editorHidden ? "Editor hidden" : "Editor visible";
  const lockedLabel = locked ? "Locked" : "Unlocked";
  const selectedLabel = selected ? "Selected" : "Not selected";

  return {
    drawableId: input.drawable.drawableId,
    displayName: input.drawable.displayName,
    partId: input.drawable.partId,
    partStatus: input.partStatus,
    textureId: input.drawable.textureId,
    textureStatus: texture.status,
    textureFilePath: texture.filePath,
    textureLabel: texture.label,
    textureStatusLabel: texture.statusLabel,
    runtimeVisible: input.drawable.visible,
    runtimeVisibilityLabel,
    editorHidden,
    editorVisibilityLabel,
    locked,
    lockedLabel,
    selected,
    selectedLabel,
    orderLabel: `Layer ${input.drawable.orderIndex + 1} / draw order ${input.drawable.baseDrawOrder}`,
    stateLabel: [
      texture.statusLabel,
      runtimeVisibilityLabel,
      editorVisibilityLabel,
      lockedLabel,
      selectedLabel
    ].join(" / "),
    directManipulation: input.directManipulation
  };
};

const projectTextureState = (
  textureId: string,
  textureEntriesById: ReadonlyMap<string, TextureAtlasEntryDto>
): {
  readonly status: LayerTreeTextureStatus;
  readonly label: string;
  readonly statusLabel: string;
  readonly filePath: string | null;
} => {
  const normalizedTextureId = textureId.trim();
  if (normalizedTextureId.length === 0) {
    return {
      status: "unassigned",
      label: "No texture assigned",
      statusLabel: "Texture unassigned",
      filePath: null
    };
  }

  const textureEntry = textureEntriesById.get(normalizedTextureId);
  if (textureEntry === undefined) {
    return {
      status: "missing",
      label: `Missing texture ${normalizedTextureId}`,
      statusLabel: "Texture missing",
      filePath: null
    };
  }

  return {
    status: "resolved",
    label: `${textureEntry.textureId} / ${textureEntry.filePath}`,
    statusLabel: "Texture resolved",
    filePath: textureEntry.filePath
  };
};

const orderPartsByHierarchy = (
  parts: readonly ModelPartDto[]
): ReadonlyArray<{ readonly part: ModelPartDto; readonly depth: number }> => {
  const partsById = new Map(parts.map((part) => [part.partId, part]));
  const orderedParts: Array<{ readonly part: ModelPartDto; readonly depth: number }> = [];
  const visited = new Set<string>();
  const roots = parts.filter(
    (part) => part.parentPartId === undefined || !partsById.has(part.parentPartId)
  );

  for (const root of roots.length === 0 ? parts : roots) {
    visitPart(root, 0, parts, partsById, visited, orderedParts, new Set());
  }

  for (const part of parts) {
    visitPart(part, 0, parts, partsById, visited, orderedParts, new Set());
  }

  return orderedParts;
};

const visitPart = (
  part: ModelPartDto,
  depth: number,
  allParts: readonly ModelPartDto[],
  partsById: ReadonlyMap<string, ModelPartDto>,
  visited: Set<string>,
  orderedParts: Array<{ readonly part: ModelPartDto; readonly depth: number }>,
  ancestorIds: ReadonlySet<string>
): void => {
  if (visited.has(part.partId)) {
    return;
  }

  visited.add(part.partId);
  orderedParts.push({ part, depth });

  const nextAncestorIds = new Set([...ancestorIds, part.partId]);
  for (const childPartId of collectChildPartIds(part, allParts)) {
    if (nextAncestorIds.has(childPartId)) {
      continue;
    }

    const childPart = partsById.get(childPartId);
    if (childPart !== undefined) {
      visitPart(childPart, depth + 1, allParts, partsById, visited, orderedParts, nextAncestorIds);
    }
  }
};

const collectChildPartIds = (
  part: ModelPartDto,
  allParts: readonly ModelPartDto[]
): readonly string[] => {
  const childPartIds = new Set(part.childPartIds);
  const orderedChildPartIds = [...part.childPartIds];

  for (const candidate of allParts) {
    if (candidate.parentPartId === part.partId && !childPartIds.has(candidate.partId)) {
      orderedChildPartIds.push(candidate.partId);
      childPartIds.add(candidate.partId);
    }
  }

  return orderedChildPartIds;
};

const formatCount = (count: number, singularLabel: string): string =>
  `${count} ${singularLabel}${count === 1 ? "" : "s"}`;
