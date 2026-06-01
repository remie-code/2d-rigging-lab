import {
  DrawableIdSchema,
  PartIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { DrawableId, PartId, RuntimeDiffDto } from "@private-2d-rigging-lab/contracts";

import type { EditorPreviewRuntimeDiffSummaryDto } from "./preview-dto.js";

export const summarizePreviewRuntimeDiff = (diff: RuntimeDiffDto): EditorPreviewRuntimeDiffSummaryDto => {
  const partChangeCount = countPathChanges(diff, isPartChangePath);
  const drawableTextureChangeCount = countPathChanges(diff, isDrawableTextureChangePath);
  const affectedPartIds = collectAffectedPartIds(diff);

  return {
    beforeSnapshotId: diff.beforeSnapshotId,
    afterSnapshotId: diff.afterSnapshotId,
    parameterChangeCount: diff.parameterChanges.length,
    ...(partChangeCount === 0 ? {} : { partChangeCount }),
    ...(drawableTextureChangeCount === 0 ? {} : { drawableTextureChangeCount }),
    dynamicsChangeCount: diff.dynamicsChanges.length,
    drawableGeometryChangeCount: diff.drawableChanges.length,
    drawableRuntimeStateChangeCount: diff.drawableRuntimeStateChanges.length,
    drawListChangeCount: diff.drawListChanges.length,
    diagnosticDeltaCount: diff.diagnosticDelta.length,
    affectedDrawableIds: collectAffectedDrawableIds(diff),
    ...(affectedPartIds.length === 0 ? {} : { affectedPartIds })
  };
};

const collectAffectedDrawableIds = (diff: RuntimeDiffDto): readonly DrawableId[] => {
  const ids = new Set<DrawableId>();
  for (const change of diff.drawableChanges) {
    ids.add(change.drawableId);
  }
  for (const change of diff.drawableRuntimeStateChanges) {
    ids.add(change.drawableId);
  }
  for (const change of diff.drawListChanges) {
    for (const positionChange of change.positionChanges) {
      ids.add(positionChange.drawableId);
    }
  }
  for (const change of diff.parameterChanges) {
    const drawableId = parseDrawableIdFromPath(change.path);
    if (drawableId !== undefined) {
      ids.add(drawableId);
    }
  }
  return [...ids].sort((left, right) => left.localeCompare(right));
};

const collectAffectedPartIds = (diff: RuntimeDiffDto): readonly PartId[] => {
  const ids = new Set<PartId>();
  for (const change of diff.parameterChanges) {
    const partId = parsePartIdFromPath(change.path);
    if (partId !== undefined) {
      ids.add(partId);
    }
    if (/^\/drawables\/[^/]+\/partId$/.test(change.path)) {
      addPartIdValue(ids, change.before);
      addPartIdValue(ids, change.after);
    }
  }
  return [...ids].sort((left, right) => left.localeCompare(right));
};

const countPathChanges = (
  diff: RuntimeDiffDto,
  predicate: (path: string) => boolean
): number => diff.parameterChanges.filter((change) => predicate(change.path)).length;

const isPartChangePath = (path: string): boolean =>
  parsePartIdFromPath(path) !== undefined || /^\/drawables\/[^/]+\/partId$/.test(path);

const isDrawableTextureChangePath = (path: string): boolean => /^\/drawables\/[^/]+\/texture(\/|$)/.test(path);

const parseDrawableIdFromPath = (path: string): DrawableId | undefined => {
  const [, collection, id] = path.split("/");
  if (collection !== "drawables") {
    return undefined;
  }

  const result = DrawableIdSchema.safeParse(id);
  return result.success ? result.data : undefined;
};

const parsePartIdFromPath = (path: string): PartId | undefined => {
  const [, collection, id] = path.split("/");
  if (collection !== "parts") {
    return undefined;
  }

  const result = PartIdSchema.safeParse(id);
  return result.success ? result.data : undefined;
};

const addPartIdValue = (
  ids: Set<PartId>,
  value: unknown
): void => {
  const result = PartIdSchema.safeParse(value);
  if (result.success) {
    ids.add(result.data);
  }
};
