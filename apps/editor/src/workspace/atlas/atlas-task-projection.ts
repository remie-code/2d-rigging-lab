import type {
  AuthoringSession,
  TextureAtlasExcludedReason,
  TextureAtlasHiddenReason,
  TextureAtlasPreview,
  TextureAtlasTargetSelectionResult,
  TextureAtlasWarning,
  TextureAtlasWarningCode
} from "@private-2d-rigging-lab/authoring-core";
import {
  DEFAULT_TEXTURE_ATLAS_PACKING_ALGORITHM_ID,
  createTextureAtlasPageRgbaBytes,
  createTextureAtlasPreview,
  selectTextureAtlasTargets
} from "@private-2d-rigging-lab/authoring-core";
import type { DrawableId, PartId } from "@private-2d-rigging-lab/contracts";

export interface TextureAtlasTaskSettings {
  readonly pageSize: number;
  readonly paddingPixels: number;
  readonly edgeExtrusionEnabled: boolean;
}

export interface TextureAtlasTaskPreviewState {
  readonly preview: TextureAtlasPreview;
  readonly previewPage: TextureAtlasPreviewPage | null;
  readonly signature: string;
}

export interface TextureAtlasTaskProjection {
  readonly settings: TextureAtlasTaskSettings;
  readonly targetSelection: TextureAtlasTargetSelectionResult;
  readonly signature: string;
  readonly preview: TextureAtlasPreview | null;
  readonly previewStatus: "missing" | "ready" | "failed" | "stale";
  readonly canApply: boolean;
  readonly summary: {
    readonly includedCount: number;
    readonly excludedCount: number;
    readonly warningCount: number;
    readonly blockingIssueCount: number;
    readonly pageSizeLabel: string;
    readonly usageLabel: string;
    readonly paddingLabel: string;
    readonly edgeExtrusionLabel: string;
  };
  readonly includedRows: readonly TextureAtlasIncludedRow[];
  readonly excludedRows: readonly TextureAtlasExcludedRow[];
  readonly warningRows: readonly TextureAtlasWarningRow[];
  readonly blockingIssues: readonly TextureAtlasBlockingIssueRow[];
  readonly previewPage: TextureAtlasPreviewPage | null;
}

export interface TextureAtlasIncludedRow {
  readonly drawableId: DrawableId;
  readonly displayName: string;
  readonly partPathLabel: string;
  readonly textureSourceLabel: string;
  readonly currentlyHidden: boolean;
  readonly hiddenReasonLabel: string;
  readonly packable: boolean;
}

export interface TextureAtlasExcludedRow {
  readonly drawableId: DrawableId;
  readonly displayName: string;
  readonly reason: TextureAtlasExcludedReason;
  readonly reasonLabel: string;
  readonly targetPath: string;
}

export interface TextureAtlasWarningRow {
  readonly id: string;
  readonly code: TextureAtlasWarningCode;
  readonly label: string;
  readonly message: string;
  readonly severity: TextureAtlasWarning["severity"];
  readonly targetPath: string;
  readonly drawableId?: DrawableId;
  readonly details: readonly string[];
}

export interface TextureAtlasBlockingIssueRow {
  readonly id: string;
  readonly code: TextureAtlasWarningCode;
  readonly title: string;
  readonly message: string;
  readonly targetLabel: string;
  readonly contextLabel: string;
  readonly sourceRef: string;
}

export interface TextureAtlasPreviewPage {
  readonly width: number;
  readonly height: number;
  readonly image: TextureAtlasPreviewImage;
  readonly placements: readonly TextureAtlasPreviewPlacement[];
}

export interface TextureAtlasPreviewImage {
  readonly width: number;
  readonly height: number;
  readonly rgbaBytes: Uint8Array;
  readonly byteLength: number;
  readonly signature: string;
}

export interface TextureAtlasPreviewPlacement {
  readonly placementId: string;
  readonly drawableId: DrawableId;
  readonly displayName: string;
  readonly hidden: boolean;
  readonly leftPercent: number;
  readonly topPercent: number;
  readonly widthPercent: number;
  readonly heightPercent: number;
}

export const DEFAULT_TEXTURE_ATLAS_TASK_SETTINGS: TextureAtlasTaskSettings = {
  pageSize: 2048,
  paddingPixels: 4,
  edgeExtrusionEnabled: true
};

export const TEXTURE_ATLAS_PAGE_SIZE_OPTIONS = [512, 1024, 2048, 4096] as const;
export const TEXTURE_ATLAS_PADDING_OPTIONS = [0, 2, 4, 8, 16] as const;

export function createTextureAtlasTaskProjection(input: {
  readonly session: AuthoringSession;
  readonly editorHiddenPartIds?: Iterable<PartId>;
  readonly settings: TextureAtlasTaskSettings;
  readonly previewState?: TextureAtlasTaskPreviewState | null;
}): TextureAtlasTaskProjection {
  const targetSelection = selectTextureAtlasTargets(
    input.session,
    createTargetSelectionOptions(input.editorHiddenPartIds)
  );
  const signature = createTextureAtlasTaskInputSignature({
    session: input.session,
    ...createEditorHiddenInput(input.editorHiddenPartIds),
    settings: input.settings,
    targetSelection
  });
  const preview = input.previewState?.preview ?? null;
  const stale = input.previewState !== undefined &&
    input.previewState !== null &&
    input.previewState.signature !== signature;
  const previewStatus = resolvePreviewStatus(preview, stale);
  const warningSource =
    preview !== null && !stale ? preview.warnings : targetSelection.warnings;
  const warningRows = createWarningRows(
    stale ? [...warningSource, createStaleTaskWarning()] : warningSource
  );
  const blockingIssues = createBlockingIssueRows({
    warnings: warningRows,
    includedTargets: targetSelection.included,
    pageSizeLabel: `${input.settings.pageSize} x ${input.settings.pageSize}`,
    paddingLabel: `${input.settings.paddingPixels}px`,
    edgeExtrusionLabel: input.settings.edgeExtrusionEnabled ? "On" : "Off"
  });
  const previewPage = input.previewState?.previewPage ?? null;
  const readyPlacementCount = preview?.status === "ready"
    ? preview.layoutSummary.pages[0]?.placements.length ?? 0
    : 0;

  return {
    settings: input.settings,
    targetSelection,
    signature,
    preview,
    previewStatus,
    canApply: preview?.status === "ready" && !stale && readyPlacementCount > 0,
    summary: {
      includedCount: targetSelection.included.length,
      excludedCount: targetSelection.excluded.length,
      warningCount: warningRows.length,
      blockingIssueCount: blockingIssues.length,
      pageSizeLabel: `${input.settings.pageSize} x ${input.settings.pageSize}`,
      usageLabel: formatUsage(preview),
      paddingLabel: `${input.settings.paddingPixels}px`,
      edgeExtrusionLabel: input.settings.edgeExtrusionEnabled ? "On" : "Off"
    },
    includedRows: targetSelection.included.map((target) => ({
      drawableId: target.drawableId,
      displayName: target.displayName,
      partPathLabel: resolveDrawablePartPathLabel(input.session, target.drawableId),
      textureSourceLabel: `${target.textureId} / ${target.meshId}`,
      currentlyHidden: target.currentlyHidden,
      hiddenReasonLabel: formatHiddenReasons(target.hiddenReasons),
      packable: target.packable
    })),
    excludedRows: targetSelection.excluded.map((target) => ({
      drawableId: target.drawableId,
      displayName: target.displayName,
      reason: target.reason,
      reasonLabel: formatExcludedReason(target.reason),
      targetPath: target.targetPath
    })),
    warningRows,
    blockingIssues,
    previewPage
  };
}

export function createTextureAtlasTaskPreviewState(input: {
  readonly session: AuthoringSession;
  readonly editorHiddenPartIds?: Iterable<PartId>;
  readonly settings: TextureAtlasTaskSettings;
}): TextureAtlasTaskPreviewState {
  const preview = createTextureAtlasPreview(input.session, {
    ...createTargetSelectionOptions(input.editorHiddenPartIds),
    pageWidth: input.settings.pageSize,
    pageHeight: input.settings.pageSize,
    paddingPixels: input.settings.paddingPixels,
    edgeExtrusionEnabled: input.settings.edgeExtrusionEnabled
  });

  return {
    preview,
    previewPage: createPreviewPage(preview),
    signature: createTextureAtlasTaskInputSignature({
      session: input.session,
      ...createEditorHiddenInput(input.editorHiddenPartIds),
      settings: input.settings,
      targetSelection: preview.targetSelection
    })
  };
}

export function createTextureAtlasTaskInputSignature(input: {
  readonly session: AuthoringSession;
  readonly editorHiddenPartIds?: Iterable<PartId>;
  readonly settings: TextureAtlasTaskSettings;
  readonly targetSelection?: TextureAtlasTargetSelectionResult;
}): string {
  const targetSelection = input.targetSelection ??
    selectTextureAtlasTargets(input.session, createTargetSelectionOptions(input.editorHiddenPartIds));
  const editorHiddenPartIds = [...(input.editorHiddenPartIds ?? [])]
    .map(String)
    .sort();

  return JSON.stringify({
    authoringRevision: input.session.authoringRevision,
    packageRevision: input.session.packageRevision,
    editorHiddenPartIds,
    packingAlgorithmId: DEFAULT_TEXTURE_ATLAS_PACKING_ALGORITHM_ID,
    settings: normalizeSettings(input.settings),
    included: targetSelection.included.map((target) => ({
      drawableId: target.drawableId,
      textureId: target.textureId,
      meshId: target.meshId,
      currentlyHidden: target.currentlyHidden,
      hiddenReasons: target.hiddenReasons,
      packable: target.packable
    })),
    excluded: targetSelection.excluded.map((target) => ({
      drawableId: target.drawableId,
      reason: target.reason
    })),
    warnings: targetSelection.warnings.map((warning) => ({
      code: warning.code,
      targetPath: warning.targetPath,
      drawableId: warning.drawableId,
      meshId: warning.meshId,
      textureId: warning.textureId
    })),
    packableTargets: targetSelection.packableTargets.map((target) => ({
      drawableId: target.drawable.drawableId,
      textureId: target.drawable.textureId,
      meshId: target.mesh.meshId,
      textureSize: target.textureSize,
      uvs: target.mesh.uvs,
      textureBytes: summarizeBytes(target.textureBytes)
    }))
  });
}

export function formatExcludedReason(reason: TextureAtlasExcludedReason): string {
  switch (reason) {
    case "unboundDrawablePool":
      return "Unbound drawable in Drawable Pool";
  }
}

export function formatHiddenReasons(reasons: readonly TextureAtlasHiddenReason[]): string {
  if (reasons.length === 0) {
    return "";
  }

  return "Currently hidden";
}

export function formatWarningCode(code: TextureAtlasWarningCode): string {
  switch (code) {
    case "atlas.target.alreadyAtlasApplied":
      return "Atlas already applied";
    case "atlas.target.emptyMeshUvs":
      return "Missing mesh UVs";
    case "atlas.target.invalidMeshUvCardinality":
      return "Invalid mesh UV count";
    case "atlas.target.invalidRgbaByteLength":
      return "Invalid texture byte length";
    case "atlas.target.invalidTextureBounds":
      return "Invalid texture bounds";
    case "atlas.target.missingMesh":
      return "Missing mesh";
    case "atlas.target.missingTextureBinaryRef":
      return "Missing texture binary reference";
    case "atlas.target.missingTextureBytes":
      return "Missing texture bytes";
    case "atlas.target.missingTextureEntry":
      return "Missing texture entry";
    case "atlas.pack.cannotFit":
      return "Cannot fit in selected page size";
    case "atlas.apply.generatedBinaryDigestUnavailable":
      return "Generated atlas digest unavailable";
    case "atlas.apply.previewNotReady":
      return "Atlas preview is not ready";
    case "atlas.apply.stalePreview":
      return "Atlas preview is stale";
  }
}

function resolvePreviewStatus(
  preview: TextureAtlasPreview | null,
  stale: boolean
): TextureAtlasTaskProjection["previewStatus"] {
  if (preview === null) {
    return "missing";
  }

  if (stale) {
    return "stale";
  }

  return preview.status;
}

function createTargetSelectionOptions(editorHiddenPartIds: Iterable<PartId> | undefined): {
  readonly editorHiddenPartIds?: Iterable<PartId>;
} {
  return editorHiddenPartIds === undefined ? {} : { editorHiddenPartIds };
}

function createEditorHiddenInput(editorHiddenPartIds: Iterable<PartId> | undefined): {
  readonly editorHiddenPartIds?: Iterable<PartId>;
} {
  return editorHiddenPartIds === undefined ? {} : { editorHiddenPartIds };
}

function createPreviewPage(preview: TextureAtlasPreview | null): TextureAtlasPreviewPage | null {
  if (preview?.status !== "ready") {
    return null;
  }

  const page = preview.layoutSummary.pages[0];
  if (page === undefined) {
    return null;
  }

  const includedById = new Map(
    preview.targetSelection.included.map((target) => [target.drawableId, target])
  );
  const rgbaBytes = createTextureAtlasPageRgbaBytes(preview);

  return {
    width: page.width,
    height: page.height,
    image: {
      width: page.width,
      height: page.height,
      rgbaBytes,
      byteLength: rgbaBytes.byteLength,
      signature: summarizeBytes(rgbaBytes)
    },
    placements: page.placements.map((placement) => {
      const included = includedById.get(placement.drawableId);

      return {
        placementId: placement.placementId,
        drawableId: placement.drawableId,
        displayName: included?.displayName ?? placement.drawableId,
        hidden: placement.hiddenAtApply || included?.currentlyHidden === true,
        leftPercent: toPercent(placement.contentRectPixels.x, page.width),
        topPercent: toPercent(placement.contentRectPixels.y, page.height),
        widthPercent: toPercent(placement.contentRectPixels.width, page.width),
        heightPercent: toPercent(placement.contentRectPixels.height, page.height)
      };
    })
  };
}

function createWarningRows(warnings: readonly TextureAtlasWarning[]): TextureAtlasWarningRow[] {
  return warnings.map((warning, index) => ({
    id: `${warning.code}:${warning.targetPath}:${index}`,
    code: warning.code,
    label: formatWarningCode(warning.code),
    message: warning.message,
    severity: warning.severity,
    targetPath: warning.targetPath,
    ...(warning.drawableId === undefined ? {} : { drawableId: warning.drawableId }),
    details: warning.details
  }));
}

function createBlockingIssueRows(input: {
  readonly warnings: readonly TextureAtlasWarningRow[];
  readonly includedTargets: readonly {
    readonly drawableId: DrawableId;
    readonly displayName: string;
  }[];
  readonly pageSizeLabel: string;
  readonly paddingLabel: string;
  readonly edgeExtrusionLabel: string;
}): TextureAtlasBlockingIssueRow[] {
  const includedByDrawableId = new Map(
    input.includedTargets.map((target) => [target.drawableId, target])
  );

  return input.warnings
    .filter((warning) => warning.severity === "error")
    .map((warning) => {
      const drawableId = getWarningDrawableId(warning);
      const displayName = drawableId === undefined
        ? getWarningDetailValue(warning, "displayName")
        : includedByDrawableId.get(drawableId)?.displayName ??
          getWarningDetailValue(warning, "displayName");
      const targetLabel = displayName !== undefined
        ? `Drawable ${displayName}`
        : drawableId !== undefined
          ? `Drawable ${drawableId}`
          : "Texture Atlas";

      return {
        id: `blocking:${warning.id}`,
        code: warning.code,
        title: warning.label,
        message: createBlockingIssueMessage({
          warning,
          targetLabel,
          pageSizeLabel: input.pageSizeLabel
        }),
        targetLabel,
        contextLabel: [
          `Page ${input.pageSizeLabel}`,
          `Padding ${input.paddingLabel}`,
          `Edge extrusion ${input.edgeExtrusionLabel}`
        ].join(" / "),
        sourceRef: warning.targetPath
      };
    });
}

function createBlockingIssueMessage(input: {
  readonly warning: TextureAtlasWarningRow;
  readonly targetLabel: string;
  readonly pageSizeLabel: string;
}): string {
  if (input.warning.code === "atlas.pack.cannotFit") {
    return `${input.targetLabel} cannot fit in ${input.pageSizeLabel}.`;
  }

  if (input.warning.code === "atlas.apply.stalePreview") {
    return "Generate Preview again before applying this atlas.";
  }

  return input.warning.message;
}

function createStaleTaskWarning(): TextureAtlasWarning {
  return {
    code: "atlas.apply.stalePreview",
    severity: "error",
    targetPath: "/assets/textureAtlas/layoutSummary",
    message: "Atlas preview is stale. Generate Preview again before applying.",
    details: ["reason=task-input-changed"]
  };
}

function getWarningDrawableId(warning: TextureAtlasWarningRow): DrawableId | undefined {
  if (warning.drawableId !== undefined) {
    return warning.drawableId;
  }

  const detailValue = getWarningDetailValue(warning, "drawableId");

  return detailValue === undefined ? undefined : (detailValue as DrawableId);
}

function getWarningDetailValue(
  warning: TextureAtlasWarningRow,
  key: string
): string | undefined {
  const prefix = `${key}=`;
  const detail = warning.details.find((candidate) => candidate.startsWith(prefix));

  return detail?.slice(prefix.length);
}

function resolveDrawablePartPathLabel(
  session: AuthoringSession,
  drawableId: DrawableId
): string {
  const drawable = session.graph.drawables.find((candidate) => candidate.drawableId === drawableId);
  if (drawable === undefined) {
    return "Unknown part";
  }

  const partsById = new Map(session.graph.parts.map((part) => [part.partId, part]));
  const names: string[] = [];
  let currentPart = partsById.get(drawable.partId);

  while (currentPart !== undefined) {
    names.unshift(currentPart.displayName);
    currentPart = currentPart.parentPartId === undefined
      ? undefined
      : partsById.get(currentPart.parentPartId);
  }

  return names.length === 0 ? "Unassigned part" : names.join(" / ");
}

function formatUsage(preview: TextureAtlasPreview | null): string {
  if (preview === null) {
    return "Not generated";
  }

  return `${Math.round(preview.usage.ratio * 100)}%`;
}

function normalizeSettings(settings: TextureAtlasTaskSettings): TextureAtlasTaskSettings {
  return {
    pageSize: Math.trunc(settings.pageSize),
    paddingPixels: Math.trunc(settings.paddingPixels),
    edgeExtrusionEnabled: settings.edgeExtrusionEnabled
  };
}

function summarizeBytes(bytes: Uint8Array): string {
  if (bytes.byteLength === 0) {
    return "0:0";
  }

  const sampleCount = Math.min(bytes.byteLength, 64);
  const step = Math.max(1, Math.floor(bytes.byteLength / sampleCount));
  let hash = 2166136261;

  for (let index = 0; index < bytes.byteLength; index += step) {
    hash ^= bytes[index] ?? 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return `${bytes.byteLength}:${hash.toString(16)}`;
}

function toPercent(value: number, total: number): number {
  return total <= 0 ? 0 : (value / total) * 100;
}
