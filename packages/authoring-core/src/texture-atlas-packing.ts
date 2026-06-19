import { TextureIdSchema, type TextureId } from "@private-2d-rigging-lab/contracts";
import {
  TextureAtlasLayoutSettingsSchema,
  TextureAtlasLayoutSummarySchema,
  type TextureAtlasLayoutSettingsDto,
  type TextureAtlasLayoutSummaryDto,
  type TextureAtlasRectPixelsDto,
  TextureAtlasSourceSignatureSchema,
  type TextureAtlasSourceSignatureDto
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringSession } from "./authoring-session.js";
import { createTextureAtlasSourceSignature } from "./texture-atlas-source-signature.js";
import {
  selectTextureAtlasTargets,
  type TextureAtlasPackableTarget,
  type TextureAtlasTargetSelectionOptions,
  type TextureAtlasTargetSelectionResult,
  type TextureAtlasWarning
} from "./texture-atlas-targets.js";

export const DEFAULT_TEXTURE_ATLAS_ID = TextureIdSchema.parse("tex_generated_atlas_page_0");
export const DEFAULT_TEXTURE_ATLAS_PAGE_ID = "atlas_page_0";
export const DEFAULT_TEXTURE_ATLAS_LAYOUT_ID = "atlas_layout_single_page_v1";

export {
  TextureAtlasLayoutSettingsSchema,
  TextureAtlasLayoutSummarySchema,
  TextureAtlasSourceSignatureSchema
};
export type {
  TextureAtlasLayoutSettingsDto,
  TextureAtlasLayoutSummaryDto,
  TextureAtlasSourceSignatureDto
};

export interface TextureAtlasPreviewSettingsInput {
  readonly pageWidth?: number;
  readonly pageHeight?: number;
  readonly paddingPixels?: number;
  readonly edgeExtrusionEnabled?: boolean;
  readonly edgeExtrusionPixels?: number;
  readonly atlasTextureId?: TextureId;
}

export interface TextureAtlasPackingUsage {
  readonly usedContentPixels: number;
  readonly totalPagePixels: number;
  readonly ratio: number;
}

export type TextureAtlasPreview =
  | {
      readonly status: "ready";
      readonly settings: TextureAtlasLayoutSettingsDto;
      readonly atlasTextureId: TextureId;
      readonly targetSelection: TextureAtlasTargetSelectionResult;
      readonly layoutSummary: TextureAtlasLayoutSummaryDto;
      readonly packableTargets: readonly TextureAtlasPackableTarget[];
      readonly warnings: readonly TextureAtlasWarning[];
      readonly usage: TextureAtlasPackingUsage;
    }
  | {
      readonly status: "failed";
      readonly settings: TextureAtlasLayoutSettingsDto;
      readonly atlasTextureId: TextureId;
      readonly targetSelection: TextureAtlasTargetSelectionResult;
      readonly packableTargets: readonly TextureAtlasPackableTarget[];
      readonly warnings: readonly TextureAtlasWarning[];
      readonly usage: TextureAtlasPackingUsage;
    };

export const createTextureAtlasPreview = (
  session: AuthoringSession,
  input: TextureAtlasPreviewSettingsInput & TextureAtlasTargetSelectionOptions = {}
): TextureAtlasPreview => {
  const settings = resolveTextureAtlasSettings(input);
  const atlasTextureId = input.atlasTextureId ?? DEFAULT_TEXTURE_ATLAS_ID;
  const targetSelection = selectTextureAtlasTargets(session, input);
  const selectionWarnings = [...targetSelection.warnings];
  const emptyUsage = createUsage([], settings);

  if (selectionWarnings.some((warning) => warning.severity === "error")) {
    return {
      status: "failed",
      settings,
      atlasTextureId,
      targetSelection,
      packableTargets: targetSelection.packableTargets,
      warnings: selectionWarnings,
      usage: emptyUsage
    };
  }

  const packed = packTextureAtlasTargets({
    targets: targetSelection.packableTargets,
    settings,
    atlasTextureId,
    sourceSignature: createTextureAtlasSourceSignature({
      settings,
      targetSelection,
      packableTargets: targetSelection.packableTargets
    })
  });

  if (packed.status === "failed") {
    return {
      status: "failed",
      settings,
      atlasTextureId,
      targetSelection,
      packableTargets: targetSelection.packableTargets,
      warnings: [...selectionWarnings, ...packed.warnings],
      usage: emptyUsage
    };
  }

  return {
    status: "ready",
    settings,
    atlasTextureId,
    targetSelection,
    layoutSummary: packed.layoutSummary,
    packableTargets: targetSelection.packableTargets,
    warnings: selectionWarnings,
    usage: createUsage(packed.layoutSummary.pages[0]?.placements ?? [], settings)
  };
};

const resolveTextureAtlasSettings = (
  input: TextureAtlasPreviewSettingsInput
): TextureAtlasLayoutSettingsDto => {
  const edgeExtrusionEnabled = input.edgeExtrusionEnabled ?? true;
  const edgeExtrusionPixels = input.edgeExtrusionPixels ?? (edgeExtrusionEnabled ? 1 : 0);

  return {
    algorithmId: "single-page-shelf-v1",
    pageWidth: input.pageWidth ?? 2048,
    pageHeight: input.pageHeight ?? 2048,
    paddingPixels: input.paddingPixels ?? 4,
    edgeExtrusion: {
      enabled: edgeExtrusionEnabled,
      pixels: edgeExtrusionPixels
    }
  };
};

type PackTextureAtlasTargetsResult =
  | {
      readonly status: "ready";
      readonly layoutSummary: TextureAtlasLayoutSummaryDto;
    }
  | {
      readonly status: "failed";
      readonly warnings: readonly TextureAtlasWarning[];
    };

const packTextureAtlasTargets = (input: {
  readonly targets: readonly TextureAtlasPackableTarget[];
  readonly settings: TextureAtlasLayoutSettingsDto;
  readonly atlasTextureId: TextureId;
  readonly sourceSignature: TextureAtlasSourceSignatureDto;
}): PackTextureAtlasTargetsResult => {
  const placements: TextureAtlasLayoutSummaryDto["pages"][number]["placements"] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const target of input.targets) {
    const paddedWidth = target.textureSize.width + input.settings.paddingPixels * 2;
    const paddedHeight = target.textureSize.height + input.settings.paddingPixels * 2;

    if (
      paddedWidth > input.settings.pageWidth ||
      paddedHeight > input.settings.pageHeight
    ) {
      return {
        status: "failed",
        warnings: [createCannotFitWarning(target, input.settings, paddedWidth, paddedHeight)]
      };
    }

    if (cursorX + paddedWidth > input.settings.pageWidth) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }

    if (cursorY + paddedHeight > input.settings.pageHeight) {
      return {
        status: "failed",
        warnings: [createCannotFitWarning(target, input.settings, paddedWidth, paddedHeight)]
      };
    }

    const paddedRect: TextureAtlasRectPixelsDto = {
      x: cursorX,
      y: cursorY,
      width: paddedWidth,
      height: paddedHeight
    };
    const contentRect: TextureAtlasRectPixelsDto = {
      x: cursorX + input.settings.paddingPixels,
      y: cursorY + input.settings.paddingPixels,
      width: target.textureSize.width,
      height: target.textureSize.height
    };

    placements.push({
      placementId: `atlas_place_${target.drawable.drawableId}`,
      pageId: DEFAULT_TEXTURE_ATLAS_PAGE_ID,
      drawableId: target.drawable.drawableId,
      meshId: target.mesh.meshId,
      originalTextureId: target.drawable.textureId,
      atlasTextureId: input.atlasTextureId,
      sourceTextureSize: {
        width: target.textureSize.width,
        height: target.textureSize.height
      },
      sourceRectPixels: {
        x: 0,
        y: 0,
        width: target.textureSize.width,
        height: target.textureSize.height
      },
      contentRectPixels: contentRect,
      paddedRectPixels: paddedRect,
      uvRect: {
        topLeft: {
          x: contentRect.x / input.settings.pageWidth,
          y: contentRect.y / input.settings.pageHeight
        },
        bottomRight: {
          x: (contentRect.x + contentRect.width) / input.settings.pageWidth,
          y: (contentRect.y + contentRect.height) / input.settings.pageHeight
        }
      },
      hiddenAtApply: target.currentlyHidden,
      hiddenReasons: [...target.hiddenReasons]
    });

    cursorX += paddedWidth;
    rowHeight = Math.max(rowHeight, paddedHeight);
  }

  const layoutSummary = TextureAtlasLayoutSummarySchema.parse({
    schemaVersion: "texture-atlas-layout-v1",
    layoutId: DEFAULT_TEXTURE_ATLAS_LAYOUT_ID,
    atlasTextureId: input.atlasTextureId,
    sourceTexturePolicy: "retain-source-textures-v1",
    sourceSignature: input.sourceSignature,
    settings: input.settings,
    pages: [
      {
        pageId: DEFAULT_TEXTURE_ATLAS_PAGE_ID,
        textureId: input.atlasTextureId,
        width: input.settings.pageWidth,
        height: input.settings.pageHeight,
        pixelFormat: "rgba8",
        placements
      }
    ]
  });

  return {
    status: "ready",
    layoutSummary
  };
};

const createCannotFitWarning = (
  target: TextureAtlasPackableTarget,
  settings: TextureAtlasLayoutSettingsDto,
  paddedWidth: number,
  paddedHeight: number
): TextureAtlasWarning => ({
  code: "atlas.pack.cannotFit",
  severity: "error",
  targetPath: `/model/drawables/${target.drawable.drawableId}`,
  drawableId: target.drawable.drawableId,
  meshId: target.mesh.meshId,
  textureId: target.drawable.textureId,
  message: `Drawable ${target.drawable.drawableId} cannot fit on the selected single atlas page.`,
  details: [
    `pageWidth=${settings.pageWidth}`,
    `pageHeight=${settings.pageHeight}`,
    `paddedWidth=${paddedWidth}`,
    `paddedHeight=${paddedHeight}`
  ]
});

const createUsage = (
  placements: readonly TextureAtlasLayoutSummaryDto["pages"][number]["placements"][number][],
  settings: TextureAtlasLayoutSettingsDto
): TextureAtlasPackingUsage => {
  const usedContentPixels = placements.reduce(
    (sum, placement) =>
      sum + placement.contentRectPixels.width * placement.contentRectPixels.height,
    0
  );
  const totalPagePixels = settings.pageWidth * settings.pageHeight;

  return {
    usedContentPixels,
    totalPagePixels,
    ratio: totalPagePixels === 0 ? 0 : usedContentPixels / totalPagePixels
  };
};
