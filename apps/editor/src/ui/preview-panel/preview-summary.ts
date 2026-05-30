import type { EditorPreviewProjectionDto } from "../../editor-preview/preview-dto.js";
import { editorTestIds } from "../../editor-state/index.js";

export const createPreviewSummary = (
  preview: EditorPreviewProjectionDto | null
): HTMLElement => {
  const summary = document.createElement("div");
  summary.className = "preview-summary";
  summary.dataset.testid = editorTestIds.previewSummary;

  if (preview === null) {
    summary.append(createFact("Snapshot", "No preview snapshot"));
    summary.append(createFact("Runtime", "Waiting for projection"));
    return summary;
  }

  summary.append(
    createFact("Snapshot", preview.sourceSnapshotId),
    createFact("Drawables", `${preview.visibleDrawableCount} visible / ${preview.drawableCount} total`),
    createFact("Samples", `${preview.keyformSamples.totalCount} keyform sample${preview.keyformSamples.totalCount === 1 ? "" : "s"}`),
    createFact("Diagnostics", createDiagnosticLabel(preview)),
    createFact("Diff", createDiffLabel(preview))
  );

  return summary;
};

const createFact = (termText: string, detailText: string): HTMLElement => {
  const item = document.createElement("div");
  item.className = "preview-summary__fact";

  const term = document.createElement("dt");
  term.textContent = termText;

  const detail = document.createElement("dd");
  detail.textContent = detailText;

  item.append(term, detail);
  return item;
};

const createDiagnosticLabel = (preview: EditorPreviewProjectionDto): string => {
  if (preview.diagnostics.totalCount === 0) {
    return "0 issues";
  }

  return `${preview.diagnostics.totalCount} total / ${preview.diagnostics.errorCount} error / ${preview.diagnostics.warningCount} warning`;
};

const createDiffLabel = (preview: EditorPreviewProjectionDto): string => {
  if (preview.diff === undefined) {
    return "No diff";
  }

  const changed =
    preview.diff.parameterChangeCount +
    preview.diff.dynamicsChangeCount +
    preview.diff.drawableGeometryChangeCount +
    preview.diff.drawableRuntimeStateChangeCount +
    preview.diff.drawListChangeCount;

  return `${changed} changes / ${preview.diff.affectedDrawableIds.length} drawable${preview.diff.affectedDrawableIds.length === 1 ? "" : "s"}`;
};
