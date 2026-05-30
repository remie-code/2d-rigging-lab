import type { DrawableId, RuntimeDiffDto } from "@private-2d-rigging-lab/contracts";

import type { EditorPreviewRuntimeDiffSummaryDto } from "./preview-dto.js";

export const summarizePreviewRuntimeDiff = (diff: RuntimeDiffDto): EditorPreviewRuntimeDiffSummaryDto => ({
  beforeSnapshotId: diff.beforeSnapshotId,
  afterSnapshotId: diff.afterSnapshotId,
  parameterChangeCount: diff.parameterChanges.length,
  dynamicsChangeCount: diff.dynamicsChanges.length,
  drawableGeometryChangeCount: diff.drawableChanges.length,
  drawableRuntimeStateChangeCount: diff.drawableRuntimeStateChanges.length,
  drawListChangeCount: diff.drawListChanges.length,
  diagnosticDeltaCount: diff.diagnosticDelta.length,
  affectedDrawableIds: collectAffectedDrawableIds(diff)
});

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
  return [...ids].sort((left, right) => left.localeCompare(right));
};
