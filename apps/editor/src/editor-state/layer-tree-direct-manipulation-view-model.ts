import type {
  ModelPartDto,
  TextureAtlasEntryDto,
  TextureAtlasFileDto
} from "@private-2d-rigging-lab/package-format";

import type { DrawableListItemState } from "./drawable-list-state.js";
import {
  countLayerTreeDirectManipulationDrafts,
  createEmptyLayerTreeDirectManipulationDraftState
} from "./layer-tree-direct-manipulation-draft-state.js";
import type { LayerTreeDraftState } from "./layer-tree-draft-state.js";

export interface LayerTreePartParentOptionViewModel {
  readonly value: string;
  readonly partId: string | null;
  readonly label: string;
  readonly disabled: boolean;
}

export interface LayerTreeDrawablePartOptionViewModel {
  readonly value: string;
  readonly partId: string;
  readonly label: string;
  readonly disabled: boolean;
}

export interface LayerTreeDrawableTextureOptionViewModel {
  readonly value: string;
  readonly textureId: string;
  readonly label: string;
  readonly disabled: boolean;
}

export interface LayerTreePartDirectManipulationViewModel {
  readonly partId: string;
  readonly currentDisplayName: string;
  readonly renameValue: string;
  readonly renameDrafted: boolean;
  readonly canDraftRename: boolean;
  readonly renameDisabledMessage: string | null;
  readonly currentParentPartId: string | null;
  readonly parentPartId: string | null;
  readonly parentOptionValue: string;
  readonly parentOptions: readonly LayerTreePartParentOptionViewModel[];
  readonly reparentDrafted: boolean;
  readonly canDraftReparent: boolean;
  readonly reparentDisabledMessage: string | null;
  readonly emptyLeafDeleteDrafted: boolean;
  readonly canDraftEmptyLeafDelete: boolean;
  readonly emptyLeafDeleteDisabledMessage: string | null;
  readonly statusLabel: string;
}

export interface LayerTreeDrawableDirectManipulationViewModel {
  readonly drawableId: string;
  readonly currentPartId: string;
  readonly partId: string;
  readonly partOptionValue: string;
  readonly partOptions: readonly LayerTreeDrawablePartOptionViewModel[];
  readonly partAssignmentDrafted: boolean;
  readonly canDraftPartAssignment: boolean;
  readonly partAssignmentDisabledMessage: string | null;
  readonly currentTextureId: string;
  readonly textureId: string;
  readonly textureOptionValue: string;
  readonly textureOptions: readonly LayerTreeDrawableTextureOptionViewModel[];
  readonly textureAssignmentDrafted: boolean;
  readonly canDraftTextureAssignment: boolean;
  readonly textureAssignmentDisabledMessage: string | null;
  readonly statusLabel: string;
}

export interface LayerTreeDirectManipulationViewModel {
  readonly partDraftsByPartId: ReadonlyMap<string, LayerTreePartDirectManipulationViewModel>;
  readonly drawableDraftsByDrawableId: ReadonlyMap<string, LayerTreeDrawableDirectManipulationViewModel>;
  readonly draftCount: number;
  readonly draftCountLabel: string;
  readonly summaryLabel: string;
}

export const projectLayerTreeDirectManipulationViewModel = (input: {
  readonly parts: readonly ModelPartDto[];
  readonly drawables: readonly DrawableListItemState[];
  readonly textureAtlas: TextureAtlasFileDto | null;
  readonly layerTreeDraft: LayerTreeDraftState;
}): LayerTreeDirectManipulationViewModel => {
  const directDraft =
    input.layerTreeDraft.directManipulation ?? createEmptyLayerTreeDirectManipulationDraftState();
  const lockedIds = new Set(input.layerTreeDraft.lockedIds);
  const partsById = new Map(input.parts.map((part) => [part.partId, part]));
  const partOptions = input.parts.map(projectResolvedPartOption);
  const textureEntriesById = new Map(
    (input.textureAtlas?.textures ?? []).map((texture) => [texture.textureId, texture])
  );
  const textureOptions = (input.textureAtlas?.textures ?? []).map(projectResolvedTextureOption);
  const childPartIdsByPartId = collectChildPartIdsByPartId(input.parts);
  const drawableCountByPartId = countDrawablesByPartId(input.drawables);
  const partRenamesById = new Map(
    directDraft.partRenames.map((draft) => [draft.partId, draft])
  );
  const partReparentsById = new Map(
    directDraft.partReparents.map((draft) => [draft.partId, draft])
  );
  const emptyLeafPartDeletesById = new Set(
    directDraft.emptyLeafPartDeletes.map((draft) => draft.partId)
  );
  const drawablePartAssignmentsById = new Map(
    directDraft.drawablePartAssignments.map((draft) => [draft.drawableId, draft])
  );
  const drawableTextureAssignmentsById = new Map(
    directDraft.drawableTextureAssignments.map((draft) => [draft.drawableId, draft])
  );
  const partDraftsByPartId = new Map<string, LayerTreePartDirectManipulationViewModel>();

  for (const part of input.parts) {
    partDraftsByPartId.set(
      part.partId,
      projectPartDirectManipulation({
        part,
        partsById,
        partOptions,
        childPartIdsByPartId,
        drawableCountByPartId,
        lockedIds,
        pendingDeletePartIds: emptyLeafPartDeletesById,
        renameDraft: partRenamesById.get(part.partId),
        reparentDraft: partReparentsById.get(part.partId),
        emptyLeafDeleteDrafted: emptyLeafPartDeletesById.has(part.partId)
      })
    );
  }

  for (const missingPartId of collectMissingPartIds(input.drawables, partsById)) {
    partDraftsByPartId.set(missingPartId, createUnavailablePartDirectManipulation(missingPartId));
  }

  const drawableDraftsByDrawableId = new Map(
    input.drawables.map((drawable) => [
      drawable.drawableId,
      projectDrawableDirectManipulation({
        drawable,
        partsById,
        partOptions,
        textureEntriesById,
        textureOptions,
        lockedIds,
        pendingDeletePartIds: emptyLeafPartDeletesById,
        partAssignmentDraft: drawablePartAssignmentsById.get(drawable.drawableId),
        textureAssignmentDraft: drawableTextureAssignmentsById.get(drawable.drawableId)
      })
    ])
  );
  const draftCount = countLayerTreeDirectManipulationDrafts(directDraft);

  return {
    partDraftsByPartId,
    drawableDraftsByDrawableId,
    draftCount,
    draftCountLabel: formatCount(draftCount, "direct draft"),
    summaryLabel: draftCount === 0 ? "No direct manipulation drafts" : formatCount(draftCount, "direct draft")
  };
};

export const createUnavailablePartDirectManipulation = (
  partId: string
): LayerTreePartDirectManipulationViewModel => ({
  partId,
  currentDisplayName: `Missing part ${partId}`,
  renameValue: `Missing part ${partId}`,
  renameDrafted: false,
  canDraftRename: false,
  renameDisabledMessage: "Missing part cannot be renamed",
  currentParentPartId: null,
  parentPartId: null,
  parentOptionValue: "",
  parentOptions: [{ value: "", partId: null, label: "No parent", disabled: true }],
  reparentDrafted: false,
  canDraftReparent: false,
  reparentDisabledMessage: "Missing part cannot be reparented",
  emptyLeafDeleteDrafted: false,
  canDraftEmptyLeafDelete: false,
  emptyLeafDeleteDisabledMessage: "Missing part cannot be requested",
  statusLabel: "Missing part row"
});

export const createUnavailableDrawableDirectManipulation = (
  drawableId: string
): LayerTreeDrawableDirectManipulationViewModel => ({
  drawableId,
  currentPartId: "",
  partId: "",
  partOptionValue: "",
  partOptions: [],
  partAssignmentDrafted: false,
  canDraftPartAssignment: false,
  partAssignmentDisabledMessage: "Drawable unavailable",
  currentTextureId: "",
  textureId: "",
  textureOptionValue: "",
  textureOptions: [],
  textureAssignmentDrafted: false,
  canDraftTextureAssignment: false,
  textureAssignmentDisabledMessage: "Drawable unavailable",
  statusLabel: "Drawable unavailable"
});

const projectPartDirectManipulation = (input: {
  readonly part: ModelPartDto;
  readonly partsById: ReadonlyMap<string, ModelPartDto>;
  readonly partOptions: readonly ResolvedPartOption[];
  readonly childPartIdsByPartId: ReadonlyMap<string, ReadonlySet<string>>;
  readonly drawableCountByPartId: ReadonlyMap<string, number>;
  readonly lockedIds: ReadonlySet<string>;
  readonly pendingDeletePartIds: ReadonlySet<string>;
  readonly renameDraft?: { readonly displayName: string } | undefined;
  readonly reparentDraft?: { readonly parentPartId: string | null } | undefined;
  readonly emptyLeafDeleteDrafted: boolean;
}): LayerTreePartDirectManipulationViewModel => {
  const partLocked = input.lockedIds.has(input.part.partId);
  const currentParentPartId = input.part.parentPartId ?? null;
  const parentPartId =
    input.reparentDraft === undefined ? currentParentPartId : input.reparentDraft.parentPartId;
  const childPartCount = input.childPartIdsByPartId.get(input.part.partId)?.size ?? 0;
  const drawableCount = input.drawableCountByPartId.get(input.part.partId) ?? 0;
  const parentOptions = ensureSelectedParentOption(
    [
      { value: "", partId: null, label: "No parent", disabled: false },
      ...input.partOptions
        .filter((option) => canUseAsParentOption(input.part.partId, option.partId, input.childPartIdsByPartId))
        .map((option): LayerTreePartParentOptionViewModel => ({
          value: option.partId,
          partId: option.partId,
          label: option.label,
          disabled: input.lockedIds.has(option.partId) || input.pendingDeletePartIds.has(option.partId)
        }))
    ],
    parentPartId,
    input.partsById
  );
  const hasReparentAlternative = parentOptions.some(
    (option) => !option.disabled && option.value !== (currentParentPartId ?? "")
  );
  const canDraftRename = !partLocked;
  const canDraftReparent = !partLocked && hasReparentAlternative;
  const emptyLeafDeleteDisabledMessage = projectEmptyLeafDeleteDisabledMessage({
    partLocked,
    childPartCount,
    drawableCount
  });
  const canDraftEmptyLeafDelete = emptyLeafDeleteDisabledMessage === null;
  const renameValue = input.renameDraft?.displayName ?? input.part.displayName;
  const reparentDrafted = input.reparentDraft !== undefined;
  const renameDrafted = input.renameDraft !== undefined;
  const statusLabel = formatPartDirectManipulationStatus({
    renameDrafted,
    renameValue,
    reparentDrafted,
    parentLabel: findParentLabel(parentOptions, parentPartId),
    emptyLeafDeleteDrafted: input.emptyLeafDeleteDrafted
  });

  return {
    partId: input.part.partId,
    currentDisplayName: input.part.displayName,
    renameValue,
    renameDrafted,
    canDraftRename,
    renameDisabledMessage: partLocked ? "Part is locked" : null,
    currentParentPartId,
    parentPartId,
    parentOptionValue: parentPartId ?? "",
    parentOptions,
    reparentDrafted,
    canDraftReparent,
    reparentDisabledMessage: partLocked
      ? "Part is locked"
      : hasReparentAlternative
        ? null
        : "No other parent available",
    emptyLeafDeleteDrafted: input.emptyLeafDeleteDrafted,
    canDraftEmptyLeafDelete,
    emptyLeafDeleteDisabledMessage,
    statusLabel
  };
};

const projectDrawableDirectManipulation = (input: {
  readonly drawable: DrawableListItemState;
  readonly partsById: ReadonlyMap<string, ModelPartDto>;
  readonly partOptions: readonly ResolvedPartOption[];
  readonly textureEntriesById: ReadonlyMap<string, TextureAtlasEntryDto>;
  readonly textureOptions: readonly LayerTreeDrawableTextureOptionViewModel[];
  readonly lockedIds: ReadonlySet<string>;
  readonly pendingDeletePartIds: ReadonlySet<string>;
  readonly partAssignmentDraft?: { readonly partId: string } | undefined;
  readonly textureAssignmentDraft?: { readonly textureId: string } | undefined;
}): LayerTreeDrawableDirectManipulationViewModel => {
  const drawableLocked = input.lockedIds.has(input.drawable.drawableId);
  const partId = input.partAssignmentDraft?.partId ?? input.drawable.partId;
  const textureId = input.textureAssignmentDraft?.textureId ?? input.drawable.textureId;
  const partOptions = ensureSelectedDrawablePartOption(
    input.partOptions.map((option): LayerTreeDrawablePartOptionViewModel => ({
      value: option.partId,
      partId: option.partId,
      label: option.label,
      disabled: input.lockedIds.has(option.partId) || input.pendingDeletePartIds.has(option.partId)
    })),
    partId,
    input.partsById
  );
  const textureOptions = ensureSelectedTextureOption(
    input.textureOptions,
    textureId,
    input.textureEntriesById
  );
  const hasPartAlternative = partOptions.some(
    (option) => !option.disabled && option.partId !== input.drawable.partId
  );
  const hasTextureAlternative = textureOptions.some(
    (option) => !option.disabled && option.textureId !== input.drawable.textureId
  );
  const partAssignmentDisabledMessage = projectDrawableDraftDisabledMessage({
    locked: drawableLocked,
    optionCount: partOptions.length,
    hasAlternative: hasPartAlternative,
    emptyMessage: "No part available",
    noAlternativeMessage: "No other part available"
  });
  const textureAssignmentDisabledMessage = projectDrawableDraftDisabledMessage({
    locked: drawableLocked,
    optionCount: input.textureOptions.length,
    hasAlternative: hasTextureAlternative,
    emptyMessage: "No texture atlas entries",
    noAlternativeMessage: "No other texture atlas entry"
  });
  const partAssignmentDrafted = input.partAssignmentDraft !== undefined;
  const textureAssignmentDrafted = input.textureAssignmentDraft !== undefined;

  return {
    drawableId: input.drawable.drawableId,
    currentPartId: input.drawable.partId,
    partId,
    partOptionValue: partId,
    partOptions,
    partAssignmentDrafted,
    canDraftPartAssignment: partAssignmentDisabledMessage === null,
    partAssignmentDisabledMessage,
    currentTextureId: input.drawable.textureId,
    textureId,
    textureOptionValue: textureId,
    textureOptions,
    textureAssignmentDrafted,
    canDraftTextureAssignment: textureAssignmentDisabledMessage === null,
    textureAssignmentDisabledMessage,
    statusLabel: formatDrawableDirectManipulationStatus({
      partAssignmentDrafted,
      partLabel: findDrawablePartLabel(partOptions, partId),
      textureAssignmentDrafted,
      textureLabel: findTextureLabel(textureOptions, textureId)
    })
  };
};

interface ResolvedPartOption {
  readonly partId: string;
  readonly label: string;
}

const projectResolvedPartOption = (part: ModelPartDto): ResolvedPartOption => ({
  partId: part.partId,
  label: `${part.displayName} / ${part.partId}`
});

const projectResolvedTextureOption = (
  texture: TextureAtlasEntryDto
): LayerTreeDrawableTextureOptionViewModel => ({
  value: texture.textureId,
  textureId: texture.textureId,
  label: `${texture.textureId} / ${texture.filePath}`,
  disabled: false
});

const collectChildPartIdsByPartId = (
  parts: readonly ModelPartDto[]
): ReadonlyMap<string, ReadonlySet<string>> => {
  const childPartIdsByPartId = new Map<string, Set<string>>();
  for (const part of parts) {
    childPartIdsByPartId.set(part.partId, new Set(part.childPartIds));
  }

  for (const part of parts) {
    if (part.parentPartId === undefined) {
      continue;
    }

    const childPartIds = childPartIdsByPartId.get(part.parentPartId) ?? new Set<string>();
    childPartIds.add(part.partId);
    childPartIdsByPartId.set(part.parentPartId, childPartIds);
  }

  return childPartIdsByPartId;
};

const countDrawablesByPartId = (
  drawables: readonly DrawableListItemState[]
): ReadonlyMap<string, number> => {
  const countByPartId = new Map<string, number>();
  for (const drawable of drawables) {
    countByPartId.set(drawable.partId, (countByPartId.get(drawable.partId) ?? 0) + 1);
  }

  return countByPartId;
};

const collectMissingPartIds = (
  drawables: readonly DrawableListItemState[],
  partsById: ReadonlyMap<string, ModelPartDto>
): readonly string[] =>
  [...new Set(drawables.map((drawable) => drawable.partId))]
    .filter((partId) => !partsById.has(partId))
    .sort((left, right) => left.localeCompare(right));

const canUseAsParentOption = (
  partId: string,
  candidateParentPartId: string,
  childPartIdsByPartId: ReadonlyMap<string, ReadonlySet<string>>
): boolean =>
  candidateParentPartId !== partId &&
  !collectDescendantPartIds(partId, childPartIdsByPartId).has(candidateParentPartId);

const collectDescendantPartIds = (
  partId: string,
  childPartIdsByPartId: ReadonlyMap<string, ReadonlySet<string>>
): ReadonlySet<string> => {
  const descendantPartIds = new Set<string>();
  const pendingPartIds = [...(childPartIdsByPartId.get(partId) ?? [])];

  while (pendingPartIds.length > 0) {
    const candidatePartId = pendingPartIds.shift();
    if (candidatePartId === undefined || descendantPartIds.has(candidatePartId)) {
      continue;
    }

    descendantPartIds.add(candidatePartId);
    pendingPartIds.push(...(childPartIdsByPartId.get(candidatePartId) ?? []));
  }

  return descendantPartIds;
};

const ensureSelectedParentOption = (
  options: readonly LayerTreePartParentOptionViewModel[],
  selectedPartId: string | null,
  partsById: ReadonlyMap<string, ModelPartDto>
): readonly LayerTreePartParentOptionViewModel[] => {
  if (selectedPartId === null || options.some((option) => option.partId === selectedPartId)) {
    return options;
  }

  const selectedPart = partsById.get(selectedPartId);

  return [
    ...options,
    {
      value: selectedPartId,
      partId: selectedPartId,
      label:
        selectedPart === undefined
          ? `Unavailable parent ${selectedPartId}`
          : `${selectedPart.displayName} / ${selectedPart.partId}`,
      disabled: true
    }
  ];
};

const ensureSelectedDrawablePartOption = (
  options: readonly LayerTreeDrawablePartOptionViewModel[],
  selectedPartId: string,
  partsById: ReadonlyMap<string, ModelPartDto>
): readonly LayerTreeDrawablePartOptionViewModel[] => {
  if (options.some((option) => option.partId === selectedPartId)) {
    return options;
  }

  const selectedPart = partsById.get(selectedPartId);

  return [
    {
      value: selectedPartId,
      partId: selectedPartId,
      label:
        selectedPart === undefined
          ? `Missing part ${selectedPartId}`
          : `${selectedPart.displayName} / ${selectedPart.partId}`,
      disabled: true
    },
    ...options
  ];
};

const ensureSelectedTextureOption = (
  options: readonly LayerTreeDrawableTextureOptionViewModel[],
  selectedTextureId: string,
  textureEntriesById: ReadonlyMap<string, TextureAtlasEntryDto>
): readonly LayerTreeDrawableTextureOptionViewModel[] => {
  if (options.some((option) => option.textureId === selectedTextureId)) {
    return options;
  }

  const selectedTexture = textureEntriesById.get(selectedTextureId);

  return [
    {
      value: selectedTextureId,
      textureId: selectedTextureId,
      label:
        selectedTexture === undefined
          ? `Missing texture ${selectedTextureId}`
          : `${selectedTexture.textureId} / ${selectedTexture.filePath}`,
      disabled: true
    },
    ...options
  ];
};

const projectEmptyLeafDeleteDisabledMessage = (input: {
  readonly partLocked: boolean;
  readonly childPartCount: number;
  readonly drawableCount: number;
}): string | null => {
  if (input.partLocked) {
    return "Part is locked";
  }

  if (input.childPartCount > 0) {
    return "Part has child parts";
  }

  if (input.drawableCount > 0) {
    return "Part has drawables";
  }

  return null;
};

const projectDrawableDraftDisabledMessage = (input: {
  readonly locked: boolean;
  readonly optionCount: number;
  readonly hasAlternative: boolean;
  readonly emptyMessage: string;
  readonly noAlternativeMessage: string;
}): string | null => {
  if (input.locked) {
    return "Drawable is locked";
  }

  if (input.optionCount === 0) {
    return input.emptyMessage;
  }

  if (!input.hasAlternative) {
    return input.noAlternativeMessage;
  }

  return null;
};

const formatPartDirectManipulationStatus = (input: {
  readonly renameDrafted: boolean;
  readonly renameValue: string;
  readonly reparentDrafted: boolean;
  readonly parentLabel: string;
  readonly emptyLeafDeleteDrafted: boolean;
}): string => {
  const labels = [
    input.renameDrafted ? `Rename draft: ${input.renameValue}` : null,
    input.reparentDrafted ? `Parent draft: ${input.parentLabel}` : null,
    input.emptyLeafDeleteDrafted ? "Empty-leaf delete draft pending" : null
  ].filter((label): label is string => label !== null);

  return labels.length === 0 ? "No part direct draft" : labels.join(" / ");
};

const formatDrawableDirectManipulationStatus = (input: {
  readonly partAssignmentDrafted: boolean;
  readonly partLabel: string;
  readonly textureAssignmentDrafted: boolean;
  readonly textureLabel: string;
}): string => {
  const labels = [
    input.partAssignmentDrafted ? `Part draft: ${input.partLabel}` : null,
    input.textureAssignmentDrafted ? `Texture draft: ${input.textureLabel}` : null
  ].filter((label): label is string => label !== null);

  return labels.length === 0 ? "No drawable direct draft" : labels.join(" / ");
};

const findParentLabel = (
  options: readonly LayerTreePartParentOptionViewModel[],
  parentPartId: string | null
): string =>
  options.find((option) => option.partId === parentPartId)?.label ??
  (parentPartId === null ? "No parent" : parentPartId);

const findDrawablePartLabel = (
  options: readonly LayerTreeDrawablePartOptionViewModel[],
  partId: string
): string => options.find((option) => option.partId === partId)?.label ?? partId;

const findTextureLabel = (
  options: readonly LayerTreeDrawableTextureOptionViewModel[],
  textureId: string
): string => options.find((option) => option.textureId === textureId)?.label ?? textureId;

const formatCount = (count: number, singularLabel: string): string =>
  `${count} ${singularLabel}${count === 1 ? "" : "s"}`;
