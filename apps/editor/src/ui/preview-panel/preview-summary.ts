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
    createFact("Parts", createPartLabel(preview)),
    createFact("Layer State", createLayerStateLabel(preview)),
    createFact("Samples", `${preview.keyformSamples.totalCount} keyform sample${preview.keyformSamples.totalCount === 1 ? "" : "s"}`),
    createFact("Textures", createTextureRenderingLabel(preview)),
    createFact("Diagnostics", createDiagnosticLabel(preview)),
    createFact("Diff", createDiffLabel(preview))
  );

  return summary;
};

const createPartLabel = (preview: EditorPreviewProjectionDto): string => {
  const parts = preview.parts ?? [];
  if (parts.length === 0) {
    return "0 part groups";
  }

  const drawableMembershipCount = parts.reduce((count, part) => count + part.drawableIds.length, 0);
  return `${parts.length} part group${parts.length === 1 ? "" : "s"} / ${drawableMembershipCount} drawable memberships`;
};

const createLayerStateLabel = (preview: EditorPreviewProjectionDto): string => {
  const states = preview.drawables.flatMap((drawable) =>
    drawable.layerState === undefined ? [] : [drawable.layerState]
  );
  const selectedCount = states.filter((state) => state.selected).length;
  const lockedCount = states.filter((state) => state.locked).length;
  const editorHiddenCount = states.filter((state) => state.editorHidden).length;
  const textureUnresolvedCount = states.filter((state) => state.textureUnresolved).length;
  const textureBackedCount = states.filter((state) => state.textureBacked).length;

  return `${selectedCount} selected / ${lockedCount} locked / ${editorHiddenCount} editor-hidden / ${textureUnresolvedCount} texture unresolved / ${textureBackedCount} texture-backed`;
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

const createTextureRenderingLabel = (preview: EditorPreviewProjectionDto): string => {
  const textureDrawables = preview.drawables.filter(
    (drawable) => drawable.visible && isTextureDrawable(drawable)
  );
  if (textureDrawables.length === 0) {
    return "0 texture refs";
  }

  const patternCount = textureDrawables.filter((drawable) =>
    isBrowserRenderableTextureReference(drawable)
  ).length;
  const packageLocalUnavailableCount = textureDrawables.filter(
    (drawable) => drawable.texture.previewReference?.referenceKind === "package-local-file-v1"
  ).length;
  const missingCount = textureDrawables.filter((drawable) => drawable.texture.status === "missing").length;
  const notMaterializedCount = textureDrawables.filter(
    (drawable) =>
      drawable.texture.status === "not_materialized" &&
      drawable.texture.previewReference === undefined
  ).length;
  const previewMissingCount = textureDrawables.filter(
    (drawable) =>
      drawable.texture.status === "resolved" &&
      drawable.texture.previewReference === undefined
  ).length;
  const fallbackReasons = [
    packageLocalUnavailableCount === 0 ? null : `${packageLocalUnavailableCount} package-local unavailable`,
    missingCount === 0 ? null : `${missingCount} missing`,
    notMaterializedCount === 0 ? null : `${notMaterializedCount} not materialized`,
    previewMissingCount === 0 ? null : `${previewMissingCount} no preview ref`
  ].filter((reason): reason is string => reason !== null);
  const fallbackCount = textureDrawables.length - patternCount;
  const reasonLabel = fallbackReasons.length === 0 ? "" : ` (${fallbackReasons.join(" / ")})`;

  return `${patternCount} pattern / ${fallbackCount} fallback${reasonLabel}`;
};

const isTextureDrawable = (
  drawable: EditorPreviewProjectionDto["drawables"][number]
): boolean =>
  drawable.texture.textureId !== undefined ||
  drawable.texture.previewReference !== undefined ||
  drawable.texture.status === "resolved" ||
  drawable.texture.status === "missing";

const isBrowserRenderableTextureReference = (
  drawable: EditorPreviewProjectionDto["drawables"][number]
): boolean => drawable.texture.previewReference?.referenceKind === "deterministic-data-url-v1";

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
