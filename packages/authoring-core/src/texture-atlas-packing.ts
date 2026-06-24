import { TextureIdSchema, type TextureId } from "@private-2d-rigging-lab/contracts";
import {
  TextureAtlasLayoutSettingsSchema,
  TextureAtlasLayoutSummarySchema,
  type TextureAtlasPackingAlgorithmIdDto,
  type TextureAtlasPlacementDto,
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
export const TEXTURE_ATLAS_SHELF_ALGORITHM_ID = "single-page-shelf-v1";
export const TEXTURE_ATLAS_SKYLINE_ALGORITHM_ID = "single-page-skyline-v1";
export const DEFAULT_TEXTURE_ATLAS_PACKING_ALGORITHM_ID =
  TEXTURE_ATLAS_SKYLINE_ALGORITHM_ID;

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
  readonly algorithmId?: TextureAtlasPackingAlgorithmIdDto;
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
    algorithmId: input.algorithmId ?? DEFAULT_TEXTURE_ATLAS_PACKING_ALGORITHM_ID,
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
  if (input.settings.algorithmId === TEXTURE_ATLAS_SHELF_ALGORITHM_ID) {
    return packTextureAtlasTargetsWithShelf(input);
  }

  return packTextureAtlasTargetsWithSkyline(input);
};

const packTextureAtlasTargetsWithShelf = (input: {
  readonly targets: readonly TextureAtlasPackableTarget[];
  readonly settings: TextureAtlasLayoutSettingsDto;
  readonly atlasTextureId: TextureId;
  readonly sourceSignature: TextureAtlasSourceSignatureDto;
}): PackTextureAtlasTargetsResult => {
  const placements: TextureAtlasPlacementDto[] = [];
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
    placements.push(createTextureAtlasPlacement({
      target,
      atlasTextureId: input.atlasTextureId,
      settings: input.settings,
      paddedRect
    }));

    cursorX += paddedWidth;
    rowHeight = Math.max(rowHeight, paddedHeight);
  }

  return createReadyPackingResult({
    atlasTextureId: input.atlasTextureId,
    settings: input.settings,
    sourceSignature: input.sourceSignature,
    placements
  });
};

interface SkylineNode {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

interface SkylinePackItem {
  readonly target: TextureAtlasPackableTarget;
  readonly stableOrder: number;
  readonly packedWidth: number;
  readonly packedHeight: number;
  readonly packedArea: number;
}

interface SkylinePlacementCandidate {
  readonly x: number;
  readonly y: number;
  readonly topEdge: number;
  readonly horizontalWaste: number;
}

const packTextureAtlasTargetsWithSkyline = (input: {
  readonly targets: readonly TextureAtlasPackableTarget[];
  readonly settings: TextureAtlasLayoutSettingsDto;
  readonly atlasTextureId: TextureId;
  readonly sourceSignature: TextureAtlasSourceSignatureDto;
}): PackTextureAtlasTargetsResult => {
  let skyline: readonly SkylineNode[] = [
    { x: 0, y: 0, width: input.settings.pageWidth }
  ];
  const placements: TextureAtlasPlacementDto[] = [];
  const items = createSortedSkylinePackItems(input.targets, input.settings);

  for (const item of items) {
    if (
      item.packedWidth > input.settings.pageWidth ||
      item.packedHeight > input.settings.pageHeight
    ) {
      return {
        status: "failed",
        warnings: [
          createCannotFitWarning(
            item.target,
            input.settings,
            item.packedWidth,
            item.packedHeight
          )
        ]
      };
    }

    const candidate = chooseSkylinePlacementCandidate({
      skyline,
      item,
      pageWidth: input.settings.pageWidth,
      pageHeight: input.settings.pageHeight
    });
    if (candidate === undefined) {
      return {
        status: "failed",
        warnings: [
          createCannotFitWarning(
            item.target,
            input.settings,
            item.packedWidth,
            item.packedHeight
          )
        ]
      };
    }

    const paddedRect: TextureAtlasRectPixelsDto = {
      x: candidate.x,
      y: candidate.y,
      width: item.packedWidth,
      height: item.packedHeight
    };
    placements.push(createTextureAtlasPlacement({
      target: item.target,
      atlasTextureId: input.atlasTextureId,
      settings: input.settings,
      paddedRect
    }));
    skyline = updateSkylineAfterPlacement({
      skyline,
      rect: paddedRect
    });
  }

  return createReadyPackingResult({
    atlasTextureId: input.atlasTextureId,
    settings: input.settings,
    sourceSignature: input.sourceSignature,
    placements
  });
};

const createSortedSkylinePackItems = (
  targets: readonly TextureAtlasPackableTarget[],
  settings: TextureAtlasLayoutSettingsDto
): readonly SkylinePackItem[] =>
  targets
    .map((target, stableOrder) => {
      const packedWidth = target.textureSize.width + settings.paddingPixels * 2;
      const packedHeight = target.textureSize.height + settings.paddingPixels * 2;

      return {
        target,
        stableOrder,
        packedWidth,
        packedHeight,
        packedArea: packedWidth * packedHeight
      };
    })
    .sort((left, right) => {
      const leftMaxSide = Math.max(left.packedWidth, left.packedHeight);
      const rightMaxSide = Math.max(right.packedWidth, right.packedHeight);

      return (
        right.packedArea - left.packedArea ||
        rightMaxSide - leftMaxSide ||
        right.packedHeight - left.packedHeight ||
        right.packedWidth - left.packedWidth ||
        left.stableOrder - right.stableOrder ||
        left.target.drawable.drawableId.localeCompare(right.target.drawable.drawableId)
      );
    });

const chooseSkylinePlacementCandidate = (input: {
  readonly skyline: readonly SkylineNode[];
  readonly item: SkylinePackItem;
  readonly pageWidth: number;
  readonly pageHeight: number;
}): SkylinePlacementCandidate | undefined => {
  let best: SkylinePlacementCandidate | undefined;

  for (const node of input.skyline) {
    const candidate = createSkylinePlacementCandidate({
      skyline: input.skyline,
      candidateX: node.x,
      packedWidth: input.item.packedWidth,
      packedHeight: input.item.packedHeight,
      pageWidth: input.pageWidth,
      pageHeight: input.pageHeight
    });
    if (candidate === undefined) {
      continue;
    }

    if (
      best === undefined ||
      compareSkylinePlacementCandidate(candidate, best) < 0
    ) {
      best = candidate;
    }
  }

  return best;
};

const createSkylinePlacementCandidate = (input: {
  readonly skyline: readonly SkylineNode[];
  readonly candidateX: number;
  readonly packedWidth: number;
  readonly packedHeight: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
}): SkylinePlacementCandidate | undefined => {
  const right = input.candidateX + input.packedWidth;
  if (right > input.pageWidth) {
    return undefined;
  }

  let candidateY = 0;
  let coveredSpanRight = input.candidateX;

  for (const node of input.skyline) {
    const nodeRight = node.x + node.width;
    if (nodeRight <= input.candidateX || node.x >= right) {
      continue;
    }

    candidateY = Math.max(candidateY, node.y);
    coveredSpanRight = Math.max(coveredSpanRight, nodeRight);
  }

  const topEdge = candidateY + input.packedHeight;
  if (topEdge > input.pageHeight) {
    return undefined;
  }

  return {
    x: input.candidateX,
    y: candidateY,
    topEdge,
    horizontalWaste: Math.max(0, coveredSpanRight - right)
  };
};

const compareSkylinePlacementCandidate = (
  left: SkylinePlacementCandidate,
  right: SkylinePlacementCandidate
): number =>
  left.topEdge - right.topEdge ||
  left.y - right.y ||
  left.horizontalWaste - right.horizontalWaste ||
  left.x - right.x;

const updateSkylineAfterPlacement = (input: {
  readonly skyline: readonly SkylineNode[];
  readonly rect: TextureAtlasRectPixelsDto;
}): readonly SkylineNode[] => {
  const placedLeft = input.rect.x;
  const placedRight = input.rect.x + input.rect.width;
  const next: SkylineNode[] = [{
    x: input.rect.x,
    y: input.rect.y + input.rect.height,
    width: input.rect.width
  }];

  for (const node of input.skyline) {
    const nodeRight = node.x + node.width;
    if (nodeRight <= placedLeft || node.x >= placedRight) {
      next.push(node);
      continue;
    }

    if (node.x < placedLeft) {
      next.push({
        x: node.x,
        y: node.y,
        width: placedLeft - node.x
      });
    }

    if (nodeRight > placedRight) {
      next.push({
        x: placedRight,
        y: node.y,
        width: nodeRight - placedRight
      });
    }
  }

  return mergeAdjacentSkylineNodes(next
    .filter((node) => node.width > 0)
    .sort((left, right) => left.x - right.x));
};

const mergeAdjacentSkylineNodes = (
  nodes: readonly SkylineNode[]
): readonly SkylineNode[] => {
  const merged: SkylineNode[] = [];

  for (const node of nodes) {
    const previous = merged.at(-1);
    if (
      previous !== undefined &&
      previous.y === node.y &&
      previous.x + previous.width === node.x
    ) {
      merged[merged.length - 1] = {
        x: previous.x,
        y: previous.y,
        width: previous.width + node.width
      };
      continue;
    }

    merged.push(node);
  }

  return merged;
};

const createTextureAtlasPlacement = (input: {
  readonly target: TextureAtlasPackableTarget;
  readonly atlasTextureId: TextureId;
  readonly settings: TextureAtlasLayoutSettingsDto;
  readonly paddedRect: TextureAtlasRectPixelsDto;
}): TextureAtlasPlacementDto => {
  const contentRect: TextureAtlasRectPixelsDto = {
    x: input.paddedRect.x + input.settings.paddingPixels,
    y: input.paddedRect.y + input.settings.paddingPixels,
    width: input.target.textureSize.width,
    height: input.target.textureSize.height
  };

  return {
    placementId: `atlas_place_${input.target.drawable.drawableId}`,
    pageId: DEFAULT_TEXTURE_ATLAS_PAGE_ID,
    drawableId: input.target.drawable.drawableId,
    meshId: input.target.mesh.meshId,
    originalTextureId: input.target.drawable.textureId,
    atlasTextureId: input.atlasTextureId,
    sourceTextureSize: {
      width: input.target.textureSize.width,
      height: input.target.textureSize.height
    },
    sourceRectPixels: {
      x: 0,
      y: 0,
      width: input.target.textureSize.width,
      height: input.target.textureSize.height
    },
    contentRectPixels: contentRect,
    paddedRectPixels: input.paddedRect,
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
    hiddenAtApply: input.target.currentlyHidden,
    hiddenReasons: [...input.target.hiddenReasons]
  };
};

const createReadyPackingResult = (input: {
  readonly atlasTextureId: TextureId;
  readonly settings: TextureAtlasLayoutSettingsDto;
  readonly sourceSignature: TextureAtlasSourceSignatureDto;
  readonly placements: readonly TextureAtlasPlacementDto[];
}): Extract<PackTextureAtlasTargetsResult, { readonly status: "ready" }> => {
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
        placements: input.placements
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
    `algorithmId=${settings.algorithmId}`,
    `drawableId=${target.drawable.drawableId}`,
    `displayName=${target.drawable.displayName}`,
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
