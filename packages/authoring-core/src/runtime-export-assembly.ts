import type { DrawableId } from "@private-2d-rigging-lab/contracts";
import {
  RUNTIME_EXPORT_PIXEL_FORMAT,
  RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE,
  assertRuntimeExportTexturePagePath,
  assertRuntimeExportV0SinglePageArtifacts,
  createRuntimeExportBinaryTextureFileEntry,
  createRuntimeExportFileSet,
  readPackageBinaryFileEntry,
  serializeRuntimeExportArtifactsToTextFileSet,
  verifyPackageBinaryAssetBytes,
  type BinaryAssetReferenceDto,
  type PackageBinaryAssetVerificationIssueCode,
  type RuntimeExportArtifactsDto,
  type RuntimeExportFileSet,
  type RuntimeExportTexturePageMetadataDto,
  type RuntimeExportTexturePagePathDto,
  type TextureAtlasEntryDto,
  type TextureAtlasLayoutSummaryDto,
  type TextureAtlasPageDto,
  type TextureAtlasPlacementDto
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringSession } from "./authoring-session.js";
import { getDrawableById, getMeshById } from "./drawable-selectors.js";
import {
  RuntimeExportMaterializationError,
  createRuntimeExportArtifacts,
  type RuntimeExportAtlasContext
} from "./runtime-export-materialization.js";
import { getTextureAtlasEntryById } from "./texture-asset-selectors.js";
import { deriveContentSubRectUv } from "./texture-atlas-content-rect.js";
import {
  createTextureAtlasSourceSignature,
  sameTextureAtlasSourceSignature
} from "./texture-atlas-source-signature.js";
import {
  selectTextureAtlasTargets,
  type TextureAtlasTargetSelectionResult
} from "./texture-atlas-targets.js";

export type RuntimeExportBlockerCode =
  | "runtimeExport.noCommittedAtlas"
  | "runtimeExport.missingSourceSignature"
  | "runtimeExport.staleAtlas"
  | "runtimeExport.missingAtlasPage"
  | "runtimeExport.missingAtlasTextureEntry"
  | "runtimeExport.missingAtlasBinaryRef"
  | "runtimeExport.missingAtlasBytes"
  | "runtimeExport.atlasDimensionsMismatch"
  | "runtimeExport.atlasByteLengthMismatch"
  | "runtimeExport.atlasMediaTypeMismatch"
  | "runtimeExport.atlasDigestMismatch"
  | "runtimeExport.invalidPlacementData"
  | "runtimeExport.uncoveredRuntimeTarget"
  | "runtimeExport.runtimeGraphMaterializationFailed"
  | "runtimeExport.requiredBinaryUnavailable"
  | "runtimeExport.unsupportedMaskReference";

export type RuntimeExportWarningCode = "runtimeExport.validateWarningsPresent";

export interface RuntimeExportPreflightBlocker {
  readonly code: RuntimeExportBlockerCode;
  readonly message: string;
  readonly targetPath: string;
  readonly details: readonly string[];
}

export interface RuntimeExportPreflightWarning {
  readonly code: RuntimeExportWarningCode;
  readonly message: string;
  readonly targetPath: string;
  readonly details: readonly string[];
}

export interface RuntimeExportTargetSummary {
  readonly includedDrawableIds: readonly DrawableId[];
  readonly excludedUnboundDrawableIds: readonly DrawableId[];
  readonly includedDrawableCount: number;
  readonly excludedUnboundDrawableCount: number;
  readonly atlasPageCount: number;
  readonly texturePageCount: number;
  readonly validateWarningCount: number;
}

export type RuntimeExportPreflightResult =
  | {
      readonly status: "ready";
      readonly blockers: readonly [];
      readonly warnings: readonly RuntimeExportPreflightWarning[];
      readonly targetSummary: RuntimeExportTargetSummary;
    }
  | {
      readonly status: "blocked";
      readonly blockers: readonly RuntimeExportPreflightBlocker[];
      readonly warnings: readonly RuntimeExportPreflightWarning[];
      readonly targetSummary: RuntimeExportTargetSummary;
    };

export interface RuntimeExportAssemblyOptions {
  readonly createdAt?: string;
  readonly packageHash?: string;
  readonly validateWarningCount?: number;
}

export type RuntimeExportAssemblyResult =
  | {
      readonly status: "ready";
      readonly preflight: Extract<RuntimeExportPreflightResult, { readonly status: "ready" }>;
      readonly artifacts: RuntimeExportArtifactsDto;
      readonly fileSet: RuntimeExportFileSet;
      readonly texturePageBytes: readonly RuntimeExportTexturePageBytes[];
    }
  | {
      readonly status: "blocked";
      readonly preflight: Extract<RuntimeExportPreflightResult, { readonly status: "blocked" }>;
    };

export interface RuntimeExportTexturePageBytes {
  readonly pageId: string;
  readonly path: RuntimeExportTexturePagePathDto;
  readonly bytes: Uint8Array;
  readonly mediaType: typeof RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE;
}

interface RuntimeExportPreparedContext {
  readonly preflight: RuntimeExportPreflightResult;
  readonly artifacts?: RuntimeExportArtifactsDto;
  readonly texturePageBytes?: readonly RuntimeExportTexturePageBytes[];
}

export const preflightRuntimeExport = async (
  session: AuthoringSession,
  options: RuntimeExportAssemblyOptions = {}
): Promise<RuntimeExportPreflightResult> => {
  const prepared = await prepareRuntimeExport(session, options);

  return prepared.preflight;
};

export const assembleRuntimeExport = async (
  session: AuthoringSession,
  options: RuntimeExportAssemblyOptions = {}
): Promise<RuntimeExportAssemblyResult> => {
  const prepared = await prepareRuntimeExport(session, options);

  if (prepared.preflight.status === "blocked") {
    return {
      status: "blocked",
      preflight: prepared.preflight
    };
  }

  if (prepared.artifacts === undefined || prepared.texturePageBytes === undefined) {
    throw new Error("Ready Runtime Export preflight did not produce artifacts.");
  }

  const textEntries = serializeRuntimeExportArtifactsToTextFileSet(prepared.artifacts);
  const binaryEntries = prepared.texturePageBytes.map((page) =>
    createRuntimeExportBinaryTextureFileEntry({
      path: page.path,
      bytes: page.bytes,
      mediaType: page.mediaType
    })
  );

  return {
    status: "ready",
    preflight: prepared.preflight,
    artifacts: prepared.artifacts,
    fileSet: createRuntimeExportFileSet([...textEntries, ...binaryEntries]),
    texturePageBytes: prepared.texturePageBytes
  };
};

const prepareRuntimeExport = async (
  session: AuthoringSession,
  options: RuntimeExportAssemblyOptions
): Promise<RuntimeExportPreparedContext> => {
  const warnings = createRuntimeExportWarnings(options);
  const targetSelection = selectTextureAtlasTargets(session);
  const blockers: RuntimeExportPreflightBlocker[] = [];
  const layoutSummary = session.graph.textureAtlas?.layoutSummary;

  if (layoutSummary === undefined) {
    const preflight = createBlockedPreflight({
      blockers: [
        createBlocker({
          code: "runtimeExport.noCommittedAtlas",
          targetPath: "/assets/textureAtlas/layoutSummary",
          message: "Runtime Export requires a committed Texture Atlas.",
          details: []
        })
      ],
      warnings,
      targetSelection,
      includedDrawableIds: []
    });

    return { preflight };
  }

  const page = layoutSummary.pages[0];
  if (page === undefined) {
    blockers.push(createBlocker({
      code: "runtimeExport.missingAtlasPage",
      targetPath: "/assets/textureAtlas/layoutSummary/pages/0",
      message: "Committed Texture Atlas is missing its atlas page.",
      details: []
    }));
  }

  if (layoutSummary.sourceSignature === undefined) {
    blockers.push(createBlocker({
      code: "runtimeExport.missingSourceSignature",
      targetPath: "/assets/textureAtlas/layoutSummary/sourceSignature",
      message: "Committed Texture Atlas is missing its source signature.",
      details: []
    }));
  } else {
    const currentSourceSignature = createTextureAtlasSourceSignature({
      settings: layoutSummary.settings,
      targetSelection,
      packableTargets: targetSelection.packableTargets
    });

    if (!sameTextureAtlasSourceSignature(currentSourceSignature, layoutSummary.sourceSignature)) {
      blockers.push(createBlocker({
        code: "runtimeExport.staleAtlas",
        targetPath: "/assets/textureAtlas/layoutSummary/sourceSignature",
        message: "Texture Atlas is out of date for the current runtime texture targets.",
        details: [
          `expectedDigest=${layoutSummary.sourceSignature.digest}`,
          `currentDigest=${currentSourceSignature.digest}`
        ]
      }));
    }
  }

  if (page === undefined) {
    const preflight = createBlockedPreflight({
      blockers,
      warnings,
      targetSelection,
      includedDrawableIds: []
    });

    return { preflight };
  }

  const atlasContext = await createRuntimeExportAtlasContext({
    session,
    layoutSummary,
    page,
    targetSelection,
    blockers
  });
  blockers.push(...validateRuntimeExportPlacements({
    session,
    page,
    targetSelection,
    placementsByDrawableId: atlasContext?.placementsByDrawableId ?? new Map()
  }));

  if (blockers.length > 0 || atlasContext === undefined) {
    return {
      preflight: createBlockedPreflight({
        blockers,
        warnings,
        targetSelection,
        includedDrawableIds: getCoveredPackableDrawableIds(
          targetSelection,
          atlasContext?.placementsByDrawableId ?? new Map()
        )
      })
    };
  }

  try {
    const artifacts = createRuntimeExportArtifacts({
      session,
      atlasContext,
      options
    });
    const texturePageBytes = [{
      pageId: atlasContext.page.pageId,
      path: atlasContext.runtimeTexturePagePath,
      bytes: new Uint8Array(atlasContext.pageBytes),
      mediaType: RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE
    }] satisfies readonly RuntimeExportTexturePageBytes[];
    const parsedArtifacts = assertRuntimeExportV0SinglePageArtifacts(artifacts);

    return {
      preflight: createReadyPreflight({
        warnings,
        targetSelection,
        includedDrawableIds: parsedArtifacts.model.drawables.map((drawable) => drawable.drawableId),
        atlasPageCount: parsedArtifacts.atlas.pages.length,
        texturePageCount: parsedArtifacts.manifest.texturePages.length
      }),
      artifacts: parsedArtifacts,
      texturePageBytes
    };
  } catch (error) {
    const blocker = error instanceof RuntimeExportMaterializationError
      ? error.blocker
      : createBlocker({
          code: "runtimeExport.runtimeGraphMaterializationFailed",
          targetPath: "/runtime/model.json",
          message: "Runtime graph could not be materialized for Runtime Export.",
          details: [formatError(error)]
        });

    return {
      preflight: createBlockedPreflight({
        blockers: [blocker],
        warnings,
        targetSelection,
        includedDrawableIds: getCoveredPackableDrawableIds(
          targetSelection,
          atlasContext.placementsByDrawableId
        )
      })
    };
  }
};

const createRuntimeExportAtlasContext = async (input: {
  readonly session: AuthoringSession;
  readonly layoutSummary: TextureAtlasLayoutSummaryDto;
  readonly page: TextureAtlasPageDto;
  readonly targetSelection: TextureAtlasTargetSelectionResult;
  readonly blockers: RuntimeExportPreflightBlocker[];
}): Promise<RuntimeExportAtlasContext | undefined> => {
  const textureEntry = input.session.graph.textureAtlas?.textures.find((entry) =>
    entry.textureId === input.page.textureId
  );

  if (textureEntry === undefined) {
    input.blockers.push(createBlocker({
      code: "runtimeExport.missingAtlasTextureEntry",
      targetPath: `/assets/textureAtlas/textures/${input.page.textureId}`,
      message: "Committed Texture Atlas page references a missing texture entry.",
      details: [`textureId=${input.page.textureId}`]
    }));

    return undefined;
  }

  const binaryAssetRef = textureEntry.binaryAssetRef;
  if (binaryAssetRef === undefined) {
    input.blockers.push(createBlocker({
      code: "runtimeExport.missingAtlasBinaryRef",
      targetPath: `/assets/textureAtlas/textures/${textureEntry.textureId}/binaryAssetRef`,
      message: "Committed Texture Atlas texture entry is missing its binary reference.",
      details: [`textureId=${textureEntry.textureId}`]
    }));

    return undefined;
  }

  validateRuntimeExportAtlasPageMetadata({
    page: input.page,
    textureEntry,
    binaryAssetRef,
    blockers: input.blockers
  });

  const binaryEntry = readPackageBinaryFileEntry(
    input.session.binaryAssets?.fileEntries ?? [],
    binaryAssetRef
  );

  if (binaryEntry === undefined) {
    input.blockers.push(createBlocker({
      code: "runtimeExport.missingAtlasBytes",
      targetPath: `/binaryAssets/${binaryAssetRef.packageRelativePath}`,
      message: "Committed Texture Atlas raw RGBA bytes are not loaded in the authoring session.",
      details: [
        `binaryAssetId=${binaryAssetRef.binaryAssetId}`,
        `packageRelativePath=${binaryAssetRef.packageRelativePath}`
      ]
    }));

    return undefined;
  }

  const verification = await verifyPackageBinaryAssetBytes(
    input.session.binaryAssets?.fileEntries ?? [],
    binaryAssetRef
  );

  for (const issue of verification.issues) {
    input.blockers.push(mapBinaryVerificationIssue(issue.code, {
      targetPath: `/binaryAssets/${issue.path}`,
      details: [
        `binaryAssetId=${issue.binaryAssetId}`,
        `expected=${issue.expected}`,
        `actual=${issue.actual}`
      ]
    }));
  }

  if (binaryAssetRef.storageStatus !== "stored-package-local-v1") {
    input.blockers.push(createBlocker({
      code: "runtimeExport.requiredBinaryUnavailable",
      targetPath: `/binaryAssets/${binaryAssetRef.packageRelativePath}`,
      message: "Committed Texture Atlas binary is not marked as package-local stored bytes.",
      details: [
        `binaryAssetId=${binaryAssetRef.binaryAssetId}`,
        `storageStatus=${binaryAssetRef.storageStatus}`
      ]
    }));
  }

  const runtimeTexturePagePath = assertRuntimeExportTexturePagePath(
    `assets/textures/${input.page.pageId}.raw-rgba`
  );
  const texturePageMetadata: RuntimeExportTexturePageMetadataDto = {
    pageId: input.page.pageId,
    path: runtimeTexturePagePath,
    textureId: input.page.textureId,
    width: input.page.width,
    height: input.page.height,
    pixelFormat: RUNTIME_EXPORT_PIXEL_FORMAT,
    mediaType: RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE,
    byteLength: binaryAssetRef.byteLength,
    digest: structuredClone(binaryAssetRef.digest),
    binaryAssetId: binaryAssetRef.binaryAssetId
  };

  return {
    layoutSummary: input.layoutSummary,
    page: input.page,
    textureEntry,
    binaryAssetRef,
    pageBytes: new Uint8Array(binaryEntry.bytes),
    runtimeTexturePagePath,
    texturePageMetadata,
    placementsByDrawableId: new Map(
      input.page.placements.map((placement) => [placement.drawableId, placement])
    ),
    targetSelection: input.targetSelection
  };
};

const validateRuntimeExportAtlasPageMetadata = (input: {
  readonly page: TextureAtlasPageDto;
  readonly textureEntry: TextureAtlasEntryDto;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly blockers: RuntimeExportPreflightBlocker[];
}): void => {
  if (
    input.textureEntry.dimensions === undefined ||
    input.textureEntry.dimensions.width !== input.page.width ||
    input.textureEntry.dimensions.height !== input.page.height ||
    input.textureEntry.dimensions.pixelFormat !== RUNTIME_EXPORT_PIXEL_FORMAT
  ) {
    input.blockers.push(createBlocker({
      code: "runtimeExport.atlasDimensionsMismatch",
      targetPath: `/assets/textureAtlas/textures/${input.textureEntry.textureId}/dimensions`,
      message: "Committed Texture Atlas texture dimensions do not match the layout page.",
      details: [
        `page=${input.page.width}x${input.page.height}/${input.page.pixelFormat}`,
        `texture=${formatTextureDimensions(input.textureEntry.dimensions)}`
      ]
    }));
  }

  const expectedByteLength = input.page.width * input.page.height * 4;
  if (input.binaryAssetRef.byteLength !== expectedByteLength) {
    input.blockers.push(createBlocker({
      code: "runtimeExport.atlasByteLengthMismatch",
      targetPath: `/assets/textureAtlas/textures/${input.textureEntry.textureId}/binaryAssetRef/byteLength`,
      message: "Committed Texture Atlas binary byte length does not match page dimensions.",
      details: [
        `expectedByteLength=${expectedByteLength}`,
        `actualByteLength=${input.binaryAssetRef.byteLength}`
      ]
    }));
  }

  if (input.binaryAssetRef.mediaType !== RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE) {
    input.blockers.push(createBlocker({
      code: "runtimeExport.atlasMediaTypeMismatch",
      targetPath: `/assets/textureAtlas/textures/${input.textureEntry.textureId}/binaryAssetRef/mediaType`,
      message: "Committed Texture Atlas binary media type is not raw RGBA8.",
      details: [
        `expected=${RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE}`,
        `actual=${input.binaryAssetRef.mediaType}`
      ]
    }));
  }

  const expectedContentHash = `sha256:${input.binaryAssetRef.digest.hex}`;
  if (
    input.textureEntry.contentHash !== undefined &&
    input.textureEntry.contentHash !== expectedContentHash
  ) {
    input.blockers.push(createBlocker({
      code: "runtimeExport.atlasDigestMismatch",
      targetPath: `/assets/textureAtlas/textures/${input.textureEntry.textureId}/contentHash`,
      message: "Committed Texture Atlas texture content hash does not match its binary digest.",
      details: [
        `expected=${expectedContentHash}`,
        `actual=${input.textureEntry.contentHash}`
      ]
    }));
  }
};

const validateRuntimeExportPlacements = (input: {
  readonly session: AuthoringSession;
  readonly page: TextureAtlasPageDto;
  readonly targetSelection: TextureAtlasTargetSelectionResult;
  readonly placementsByDrawableId: ReadonlyMap<DrawableId, TextureAtlasPlacementDto>;
}): readonly RuntimeExportPreflightBlocker[] => {
  const blockers: RuntimeExportPreflightBlocker[] = [];
  const seenPlacementIds = new Set<string>();
  const seenDrawableIds = new Set<DrawableId>();

  for (const placement of input.page.placements) {
    if (seenPlacementIds.has(placement.placementId) || seenDrawableIds.has(placement.drawableId)) {
      blockers.push(createInvalidPlacementBlocker(placement, "duplicate placement id or drawable id"));
      continue;
    }
    seenPlacementIds.add(placement.placementId);
    seenDrawableIds.add(placement.drawableId);

    const drawable = getDrawableById(input.session.graph, placement.drawableId);
    const mesh = getMeshById(input.session.graph, placement.meshId);

    if (placement.pageId !== input.page.pageId) {
      blockers.push(createInvalidPlacementBlocker(placement, "placement pageId does not match page"));
    }

    if (placement.atlasTextureId !== input.page.textureId) {
      blockers.push(createInvalidPlacementBlocker(placement, "placement atlasTextureId does not match page texture"));
    }

    if (drawable === undefined || mesh === undefined) {
      blockers.push(createInvalidPlacementBlocker(placement, "placement references missing drawable or mesh"));
      continue;
    }

    if (drawable.meshId !== placement.meshId) {
      blockers.push(createInvalidPlacementBlocker(placement, "placement meshId does not match drawable mesh"));
    }

    if (drawable.textureId !== placement.originalTextureId) {
      blockers.push(createInvalidPlacementBlocker(placement, "placement originalTextureId does not match drawable texture"));
    }

    if (!isRectInsidePage(placement.contentRectPixels, input.page)) {
      blockers.push(createInvalidPlacementBlocker(placement, "content rect is outside atlas page"));
    }

    if (!isRectInsidePage(placement.paddedRectPixels, input.page)) {
      blockers.push(createInvalidPlacementBlocker(placement, "padded rect is outside atlas page"));
    }

    if (!doesRectContain(placement.paddedRectPixels, placement.contentRectPixels)) {
      blockers.push(createInvalidPlacementBlocker(placement, "padded rect does not contain content rect"));
    }

    if (!isUvRectValid(placement.uvRect)) {
      blockers.push(createInvalidPlacementBlocker(placement, "uv rect is outside normalized atlas coordinates"));
    }

    if (!doesUvRectMatchContentRect(placement, input.page, input.session)) {
      blockers.push(createInvalidPlacementBlocker(placement, "uv rect does not match content rect"));
    }
  }

  for (const target of input.targetSelection.packableTargets) {
    if (!input.placementsByDrawableId.has(target.drawable.drawableId)) {
      blockers.push(createBlocker({
        code: "runtimeExport.uncoveredRuntimeTarget",
        targetPath: `/model/drawables/${target.drawable.drawableId}`,
        message: "Current packable runtime target is not covered by the committed atlas.",
        details: [
          `drawableId=${target.drawable.drawableId}`,
          `meshId=${target.mesh.meshId}`,
          `textureId=${target.drawable.textureId}`
        ]
      }));
    }
  }

  return blockers;
};

const createRuntimeExportWarnings = (
  options: RuntimeExportAssemblyOptions
): readonly RuntimeExportPreflightWarning[] => {
  const validateWarningCount = options.validateWarningCount ?? 0;

  if (validateWarningCount <= 0) {
    return [];
  }

  return [{
    code: "runtimeExport.validateWarningsPresent",
    targetPath: "/validate",
    message: "Validate has warnings. Open Validate to inspect them before exporting.",
    details: [`warningCount=${validateWarningCount}`]
  }];
};

const createReadyPreflight = (input: {
  readonly warnings: readonly RuntimeExportPreflightWarning[];
  readonly targetSelection: TextureAtlasTargetSelectionResult;
  readonly includedDrawableIds: readonly DrawableId[];
  readonly atlasPageCount: number;
  readonly texturePageCount: number;
}): Extract<RuntimeExportPreflightResult, { readonly status: "ready" }> => ({
  status: "ready",
  blockers: [],
  warnings: input.warnings,
  targetSummary: createTargetSummary({
    targetSelection: input.targetSelection,
    includedDrawableIds: input.includedDrawableIds,
    atlasPageCount: input.atlasPageCount,
    texturePageCount: input.texturePageCount,
    validateWarningCount: getValidateWarningCount(input.warnings)
  })
});

const createBlockedPreflight = (input: {
  readonly blockers: readonly RuntimeExportPreflightBlocker[];
  readonly warnings: readonly RuntimeExportPreflightWarning[];
  readonly targetSelection: TextureAtlasTargetSelectionResult;
  readonly includedDrawableIds: readonly DrawableId[];
}): Extract<RuntimeExportPreflightResult, { readonly status: "blocked" }> => ({
  status: "blocked",
  blockers: input.blockers,
  warnings: input.warnings,
  targetSummary: createTargetSummary({
    targetSelection: input.targetSelection,
    includedDrawableIds: input.includedDrawableIds,
    atlasPageCount: 0,
    texturePageCount: 0,
    validateWarningCount: getValidateWarningCount(input.warnings)
  })
});

const createTargetSummary = (input: {
  readonly targetSelection: TextureAtlasTargetSelectionResult;
  readonly includedDrawableIds: readonly DrawableId[];
  readonly atlasPageCount: number;
  readonly texturePageCount: number;
  readonly validateWarningCount: number;
}): RuntimeExportTargetSummary => ({
  includedDrawableIds: [...input.includedDrawableIds],
  excludedUnboundDrawableIds: input.targetSelection.excluded.map((target) => target.drawableId),
  includedDrawableCount: input.includedDrawableIds.length,
  excludedUnboundDrawableCount: input.targetSelection.excluded.length,
  atlasPageCount: input.atlasPageCount,
  texturePageCount: input.texturePageCount,
  validateWarningCount: input.validateWarningCount
});

const getCoveredPackableDrawableIds = (
  targetSelection: TextureAtlasTargetSelectionResult,
  placementsByDrawableId: ReadonlyMap<DrawableId, TextureAtlasPlacementDto>
): readonly DrawableId[] =>
  targetSelection.packableTargets
    .filter((target) => placementsByDrawableId.has(target.drawable.drawableId))
    .map((target) => target.drawable.drawableId);

const getValidateWarningCount = (
  warnings: readonly RuntimeExportPreflightWarning[]
): number => {
  const validateWarning = warnings.find((warning) =>
    warning.code === "runtimeExport.validateWarningsPresent"
  );
  const detail = validateWarning?.details.find((candidate) =>
    candidate.startsWith("warningCount=")
  );

  return detail === undefined ? 0 : Number(detail.slice("warningCount=".length));
};

const mapBinaryVerificationIssue = (
  code: PackageBinaryAssetVerificationIssueCode,
  input: {
    readonly targetPath: string;
    readonly details: readonly string[];
  }
): RuntimeExportPreflightBlocker => {
  if (code === "binary.byteLength.mismatch") {
    return createBlocker({
      code: "runtimeExport.atlasByteLengthMismatch",
      targetPath: input.targetPath,
      message: "Committed Texture Atlas binary byte length does not match its reference.",
      details: input.details
    });
  }

  if (code === "binary.mediaType.mismatch") {
    return createBlocker({
      code: "runtimeExport.atlasMediaTypeMismatch",
      targetPath: input.targetPath,
      message: "Committed Texture Atlas binary media type does not match its reference.",
      details: input.details
    });
  }

  if (code === "binary.digest.mismatch") {
    return createBlocker({
      code: "runtimeExport.atlasDigestMismatch",
      targetPath: input.targetPath,
      message: "Committed Texture Atlas binary digest does not match its bytes.",
      details: input.details
    });
  }

  if (code === "binary.bytes.missing") {
    return createBlocker({
      code: "runtimeExport.missingAtlasBytes",
      targetPath: input.targetPath,
      message: "Committed Texture Atlas raw RGBA bytes are missing.",
      details: input.details
    });
  }

  return createBlocker({
    code: "runtimeExport.requiredBinaryUnavailable",
    targetPath: input.targetPath,
    message: "Committed Texture Atlas required binary is unavailable for Runtime Export.",
    details: [`verificationIssue=${code}`, ...input.details]
  });
};

const createBlocker = (input: {
  readonly code: RuntimeExportBlockerCode;
  readonly message: string;
  readonly targetPath: string;
  readonly details: readonly string[];
}): RuntimeExportPreflightBlocker => ({
  code: input.code,
  message: input.message,
  targetPath: input.targetPath,
  details: [...input.details]
});

const createInvalidPlacementBlocker = (
  placement: TextureAtlasPlacementDto,
  reason: string
): RuntimeExportPreflightBlocker =>
  createBlocker({
    code: "runtimeExport.invalidPlacementData",
    targetPath: `/assets/textureAtlas/layoutSummary/pages/${placement.pageId}/placements/${placement.placementId}`,
    message: "Committed Texture Atlas placement data is invalid for Runtime Export.",
    details: [
      `reason=${reason}`,
      `drawableId=${placement.drawableId}`,
      `meshId=${placement.meshId}`
    ]
  });

const isRectInsidePage = (
  rect: TextureAtlasPlacementDto["contentRectPixels"],
  page: TextureAtlasPageDto
): boolean =>
  rect.x >= 0 &&
  rect.y >= 0 &&
  rect.x + rect.width <= page.width &&
  rect.y + rect.height <= page.height;

const doesRectContain = (
  outer: TextureAtlasPlacementDto["paddedRectPixels"],
  inner: TextureAtlasPlacementDto["contentRectPixels"]
): boolean =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height;

const isUvRectValid = (uvRect: TextureAtlasPlacementDto["uvRect"]): boolean =>
  isFiniteNormalizedNumber(uvRect.topLeft.x) &&
  isFiniteNormalizedNumber(uvRect.topLeft.y) &&
  isFiniteNormalizedNumber(uvRect.bottomRight.x) &&
  isFiniteNormalizedNumber(uvRect.bottomRight.y) &&
  uvRect.topLeft.x < uvRect.bottomRight.x &&
  uvRect.topLeft.y < uvRect.bottomRight.y;

// Since Wave108 the placement `uvRect` is the **content sub-rect** — the raster
// `contentRectPixels` inset by the source texture's `contentInset` — not the whole
// raster (boundary-transparent-margin-design.md §3.1/§4). The expected value is
// derived through `deriveContentSubRectUv`, the SAME helper the packing writer uses,
// so packing and this preflight validator cannot drift apart again (the re-drift that
// left this validator on the old `uvRect == contentRect` contract, falsely blocking
// every non-zero-inset placement, until Wave109). `contentInset` is not on the
// placement schema; it is resolved from the committed source texture entry
// (`placement.originalTextureId` → texture atlas entry). A missing entry is validated
// as a zero inset — the entry's absence is the responsibility of the other blocker
// families, not this UV-shape check.
const doesUvRectMatchContentRect = (
  placement: TextureAtlasPlacementDto,
  page: TextureAtlasPageDto,
  session: AuthoringSession
): boolean => {
  const textureEntry = getTextureAtlasEntryById(session.graph, placement.originalTextureId);
  const expected = deriveContentSubRectUv({
    contentRect: placement.contentRectPixels,
    contentInset: textureEntry?.contentInset,
    pageWidth: page.width,
    pageHeight: page.height
  });

  return nearlyEqual(placement.uvRect.topLeft.x, expected.topLeft.x) &&
    nearlyEqual(placement.uvRect.topLeft.y, expected.topLeft.y) &&
    nearlyEqual(placement.uvRect.bottomRight.x, expected.bottomRight.x) &&
    nearlyEqual(placement.uvRect.bottomRight.y, expected.bottomRight.y);
};

const isFiniteNormalizedNumber = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1;

const nearlyEqual = (left: number, right: number): boolean =>
  Math.abs(left - right) <= 1e-9;

const formatTextureDimensions = (
  dimensions: TextureAtlasEntryDto["dimensions"]
): string =>
  dimensions === undefined
    ? "missing"
    : `${dimensions.width}x${dimensions.height}/${dimensions.pixelFormat}`;

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
