import type {
  BinaryAssetDigestDto,
  BinaryAssetReferenceDto,
  DrawableDto,
  LayeredCharacterPsdProfileDto,
  PackageDocumentDto,
  PsdLayerMaterializationEvidenceDto,
  SourceAssetDto,
  SourceLayerDto,
  TextureAtlasEntryDto
} from "@private-2d-rigging-lab/package-format";
import type {
  CheckStatus,
  Severity
} from "@private-2d-rigging-lab/contracts";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

const WAVE46_RAW_RGBA_MEDIA_TYPE =
  "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";

export const validatePsdMaterializedAssetDiagnostics = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const indexes = createMaterializedAssetIndexes(packageDocument);
  const checks: ValidationCheckResultDto[] = [];

  packageDocument.assets.sourceManifest.sourceAssets.forEach((sourceAsset, sourceAssetIndex) => {
    const profile = sourceAsset.psdProfile;
    if (profile === undefined) {
      return;
    }

    (profile.materializationEvidence ?? []).forEach((materialization, materializationIndex) => {
      if (!isWave46SelectedLayerMaterialization(materialization)) {
        return;
      }

      const context: MaterializedAssetContext = {
        sourceAsset,
        sourceAssetIndex,
        profile,
        materialization,
        materializationIndex,
        targetPath:
          `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}` +
          `/psdProfile/materializationEvidence/${materializationIndex}`,
        indexes
      };
      const issueChecks = [
        ...validateMaterializedByteReference(context),
        ...validateSourcePsdProvenance(context),
        ...validateParserExtractionAndLayerRef(context),
        ...validatePrivateLocalProvenance(context),
        ...validateDestinationMapping(context)
      ];
      const hasBlockingOrNotEvaluatedIssue = issueChecks.some((check) =>
        check.status === "fail" || check.status === "needs_review"
      );

      checks.push(...issueChecks);
      if (!hasBlockingOrNotEvaluatedIssue) {
        checks.push(createMaterializedAssetAvailableCheck(context));
      }
    });
  });

  return checks;
};

interface MaterializedAssetIndexes {
  readonly textureEntriesById: ReadonlyMap<string, TextureAtlasEntryWithIndex>;
  readonly drawablesByTextureId: ReadonlyMap<string, readonly DrawableWithIndex[]>;
  readonly partsById: ReadonlyMap<string, PartWithIndex>;
}

interface TextureAtlasEntryWithIndex {
  readonly entry: TextureAtlasEntryDto;
  readonly index: number;
}

interface DrawableWithIndex {
  readonly drawable: DrawableDto;
  readonly index: number;
}

interface PartWithIndex {
  readonly partId: string;
  readonly drawableIds: readonly string[];
  readonly index: number;
}

interface MaterializedAssetContext {
  readonly sourceAsset: SourceAssetDto;
  readonly sourceAssetIndex: number;
  readonly profile: LayeredCharacterPsdProfileDto;
  readonly materialization: PsdLayerMaterializationEvidenceDto;
  readonly materializationIndex: number;
  readonly targetPath: string;
  readonly indexes: MaterializedAssetIndexes;
}

const createMaterializedAssetIndexes = (
  packageDocument: PackageDocumentDto
): MaterializedAssetIndexes => {
  const drawablesByTextureId = new Map<string, DrawableWithIndex[]>();
  packageDocument.model.drawables.drawables.forEach((drawable, index) => {
    const existing = drawablesByTextureId.get(drawable.textureId) ?? [];
    existing.push({ drawable, index });
    drawablesByTextureId.set(drawable.textureId, existing);
  });

  return {
    textureEntriesById: new Map(
      packageDocument.assets.textureAtlas?.textures.map((entry, index) => [
        entry.textureId,
        { entry, index }
      ]) ?? []
    ),
    drawablesByTextureId,
    partsById: new Map(
      packageDocument.model.graph.parts.map((part, index) => [
        part.partId,
        {
          partId: part.partId,
          drawableIds: part.drawableIds,
          index
        }
      ])
    )
  };
};

const isWave46SelectedLayerMaterialization = (
  materialization: PsdLayerMaterializationEvidenceDto
): boolean =>
  materialization.mediaType === WAVE46_RAW_RGBA_MEDIA_TYPE ||
  materialization.binaryAssetRef?.mediaType === WAVE46_RAW_RGBA_MEDIA_TYPE ||
  materialization.provenance.publicDemoAsset !== undefined;

const validateMaterializedByteReference = (
  context: MaterializedAssetContext
): readonly ValidationCheckResultDto[] => {
  const materialization = context.materialization;
  const binaryAssetRef = materialization.binaryAssetRef;
  if (binaryAssetRef === undefined) {
    return [
      createIssueCheck({
        context,
        checkId: "asset.psd.materializedBytesMissing",
        status: "fail",
        severity: "error",
        phase: "reference",
        targetPath: `${context.targetPath}/binaryAssetRef`,
        message:
          `PSD materialization ${materialization.materializationId} has no package-local ` +
          "materialized binary asset reference.",
        evidence: [
          "materializedBytesAvailability=missing",
          "reason=missing-materialized-binary-asset-ref",
          "requiredRecovery=re-materialize-or-reupload-or-reselect"
        ],
        impact:
          "Product Preflight cannot treat selected-layer texture bytes as current without a package-local binary asset reference."
      })
    ];
  }

  const checks: ValidationCheckResultDto[] = [];
  if (binaryAssetRef.storageStatus !== "stored-package-local-v1") {
    checks.push(createIssueCheck({
      context,
      checkId: "asset.psd.materializedBytesMissing",
      status: "fail",
      severity: "error",
      phase: "reference",
      targetPath: `${context.targetPath}/binaryAssetRef/storageStatus`,
      message:
        `PSD materialization ${materialization.materializationId} binary bytes are ` +
        `${binaryAssetRef.storageStatus}.`,
      evidence: [
        ...createBinaryAssetRefEvidence(binaryAssetRef),
        "materializedBytesAvailability=missing",
        `reason=storageStatus:${binaryAssetRef.storageStatus}`,
        "requiredRecovery=re-materialize-or-reupload-or-reselect"
      ],
      impact:
        "The materialized selected-layer bytes are not available as current package-local bytes."
    }));
  }

  const mismatchReasons = [
    ...(binaryAssetRef.packageRelativePath.startsWith("assets/textures/")
      ? []
      : ["package-relative-path-not-texture-local"]),
    ...(materialization.mediaType === WAVE46_RAW_RGBA_MEDIA_TYPE
      ? []
      : ["materialized-media-type-not-wave46-raw-rgba"]),
    ...(binaryAssetRef.mediaType === WAVE46_RAW_RGBA_MEDIA_TYPE
      ? []
      : ["binary-media-type-not-wave46-raw-rgba"]),
    ...(sameDigest(binaryAssetRef.digest, materialization.digest)
      ? []
      : ["materialized-digest-mismatch"]),
    ...(binaryAssetRef.byteLength === materialization.byteLength
      ? []
      : ["materialized-byte-length-mismatch"]),
    ...(binaryAssetRef.mediaType === materialization.mediaType
      ? []
      : ["materialized-media-type-mismatch"]),
    ...(materialization.width !== undefined &&
    materialization.height !== undefined &&
    materialization.byteLength !== materialization.width * materialization.height * 4
      ? ["raw-rgba-byte-length-mismatch"]
      : [])
  ];

  if (mismatchReasons.length > 0) {
    checks.push(createIssueCheck({
      context,
      checkId: "asset.psd.materializedAssetMismatch",
      status: "fail",
      severity: "error",
      phase: "reference",
      targetPath: `${context.targetPath}/binaryAssetRef`,
      message:
        `PSD materialization ${materialization.materializationId} binary asset metadata ` +
        "does not match selected-layer materialization evidence.",
      evidence: [
        ...createBinaryAssetRefEvidence(binaryAssetRef),
        `materializationDigest=${formatDigest(materialization.digest)}`,
        `materializationByteLength=${materialization.byteLength}`,
        `materializationMediaType=${materialization.mediaType}`,
        `materializationWidth=${materialization.width ?? "missing"}`,
        `materializationHeight=${materialization.height ?? "missing"}`,
        `reasons=${mismatchReasons.join(",")}`
      ],
      impact:
        "The validator cannot trust stale or mismatched materialized texture metadata."
    }));
  }

  return checks;
};

const validateSourcePsdProvenance = (
  context: MaterializedAssetContext
): readonly ValidationCheckResultDto[] => {
  const materialization = context.materialization;
  const provenance = materialization.provenance;
  const checks: ValidationCheckResultDto[] = [];
  const expectedSourceDigest =
    context.sourceAsset.binaryAssetRef?.digest ??
    parseSourceAssetSha256ContentHash(context.sourceAsset.contentHash);

  if (provenance.sourceDigest === undefined || provenance.sourceByteLength === undefined) {
    checks.push(createIssueCheck({
      context,
      checkId: "asset.psd.materializedSourceStale",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${context.targetPath}/provenance`,
      message:
        `PSD materialization ${materialization.materializationId} is missing source PSD ` +
        "digest or byteLength provenance.",
      evidence: [
        `sourceDigest=${formatDigest(provenance.sourceDigest)}`,
        `sourceByteLength=${provenance.sourceByteLength ?? "missing"}`,
        "reason=source-psd-digest-or-byte-length-missing"
      ],
      impact:
        "Selected-layer materialized bytes must be traceable to the source PSD identity that produced them."
    }));
  }

  const staleReasons = [
    ...(provenance.sourceDigest !== undefined &&
    expectedSourceDigest !== undefined &&
    !sameDigest(provenance.sourceDigest, expectedSourceDigest)
      ? ["source-psd-digest-mismatch"]
      : []),
    ...(provenance.sourceByteLength !== undefined &&
    context.sourceAsset.binaryAssetRef !== undefined &&
    context.sourceAsset.binaryAssetRef.byteLength !== provenance.sourceByteLength
      ? ["source-psd-byte-length-mismatch"]
      : [])
  ];
  if (staleReasons.length > 0) {
    checks.push(createIssueCheck({
      context,
      checkId: "asset.psd.materializedSourceStale",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${context.targetPath}/provenance`,
      message:
        `PSD materialization ${materialization.materializationId} was produced from a stale ` +
        "source PSD identity.",
      evidence: [
        `materializationSourceDigest=${formatDigest(provenance.sourceDigest)}`,
        `expectedSourceDigest=${formatDigest(expectedSourceDigest)}`,
        `materializationSourceByteLength=${provenance.sourceByteLength ?? "missing"}`,
        `expectedSourceByteLength=${context.sourceAsset.binaryAssetRef?.byteLength ?? "unavailable"}`,
        `sourceContentHash=${context.sourceAsset.contentHash}`,
        `reasons=${staleReasons.join(",")}`
      ],
      impact:
        "The selected-layer materialized asset must be regenerated from the current source PSD bytes."
    }));
  }

  if (
    context.sourceAsset.binaryAssetRef === undefined ||
    context.sourceAsset.binaryAssetRef.storageStatus !== "stored-package-local-v1"
  ) {
    checks.push(createIssueCheck({
      context,
      checkId: "asset.psd.materializedSourceCurrentBytesMissing",
      status: "warning",
      severity: "warning",
      phase: "source_import",
      targetPath:
        `/assets/sourceManifest/sourceAssets/${context.sourceAssetIndex}/binaryAssetRef`,
      message:
        `PSD source ${context.sourceAsset.sourceAssetId} has no current package-local ` +
        "source bytes for re-materialization.",
      evidence: [
        `sourceBinaryAssetRef=${context.sourceAsset.binaryAssetRef?.binaryAssetId ?? "missing"}`,
        `sourceBinaryStorageStatus=${context.sourceAsset.binaryAssetRef?.storageStatus ?? "missing"}`,
        "sourcePsdBytePersistence=metadataOnlyNoRawBytes",
        "reMaterializationRequiresReupload=true"
      ],
      impact:
        "The existing materialized bytes may still be usable, but re-materialization requires the user to reupload or reselect the source PSD."
    }));
  }

  return checks;
};

const validateParserExtractionAndLayerRef = (
  context: MaterializedAssetContext
): readonly ValidationCheckResultDto[] => {
  const materialization = context.materialization;
  const sourceLayer = findStructuredSourceLayer(context.profile, materialization.sourceLayerRef.sourceLayerId);
  const flattenedLayer = findFlattenedSourceLayer(context.sourceAsset, materialization.sourceLayerRef.sourceLayerId);
  const parser = materialization.parser;
  const sourceParser = context.profile.adapter.parser;
  const extraction = materialization.extraction;
  const mismatchReasons = [
    ...(materialization.sourceLayerRef.sourceAssetId === context.sourceAsset.sourceAssetId
      ? []
      : ["source-asset-id-mismatch"]),
    ...(sourceLayer === undefined ? ["source-layer-missing-from-structured-profile"] : []),
    ...(flattenedLayer === undefined ? ["source-layer-missing-from-flattened-layers"] : []),
    ...createSourceLayerNameMismatchReasons(materialization, sourceLayer, flattenedLayer),
    ...createSourceLayerPathMismatchReasons(materialization, sourceLayer, flattenedLayer),
    ...(parser === undefined || parser.parserVersion === undefined
      ? ["parser-version-missing"]
      : []),
    ...(parser !== undefined &&
    sourceParser !== undefined &&
    (parser.parserName !== sourceParser.parserName || parser.parserVersion !== sourceParser.parserVersion)
      ? ["parser-evidence-mismatch"]
      : []),
    ...(extraction === undefined ? ["extraction-evidence-missing"] : []),
    ...(extraction !== undefined && extraction.extractionKind !== "selectedLayerRasterV1"
      ? ["extraction-kind-mismatch"]
      : []),
    ...(extraction !== undefined &&
    extraction.optionsSchemaVersion !== "psd-layer-extraction-options-v1"
      ? ["extraction-options-schema-mismatch"]
      : []),
    ...createExtractionOptionMismatchReasons(extraction, materialization.sourceLayerRef.sourceLayerId)
  ];

  if (mismatchReasons.length === 0) {
    return [];
  }

  return [
    createIssueCheck({
      context,
      checkId: "asset.psd.materializedParserExtractionMismatch",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: `${context.targetPath}/sourceLayerRef`,
      message:
        `PSD materialization ${materialization.materializationId} parser, extraction, ` +
        "or source layer evidence is inconsistent.",
      evidence: [
        `materializedSourceAssetId=${materialization.sourceLayerRef.sourceAssetId}`,
        `expectedSourceAssetId=${context.sourceAsset.sourceAssetId}`,
        `sourceLayerId=${materialization.sourceLayerRef.sourceLayerId}`,
        `sourceLayerName=${materialization.sourceLayerRef.sourceLayerName ?? "missing"}`,
        `sourceLayerPath=${materialization.sourceLayerRef.sourceLayerPath?.join("/") ?? "missing"}`,
        `structuredLayerMatch=${sourceLayer !== undefined}`,
        `flattenedLayerMatch=${flattenedLayer !== undefined}`,
        `materializationParser=${parser?.parserName ?? "missing"}@${parser?.parserVersion ?? "missing"}`,
        `sourceParser=${sourceParser?.parserName ?? "missing"}@${sourceParser?.parserVersion ?? "missing"}`,
        `extractionKind=${extraction?.extractionKind ?? "missing"}`,
        `optionsSchemaVersion=${extraction?.optionsSchemaVersion ?? "missing"}`,
        `reasons=${mismatchReasons.join(",")}`
      ],
      impact:
        "The validator cannot connect this materialized asset to a known selected PSD layer and canonical extraction path."
    })
  ];
};

const validatePrivateLocalProvenance = (
  context: MaterializedAssetContext
): readonly ValidationCheckResultDto[] => {
  const provenance = context.materialization.provenance;
  const reasons = [
    ...(["packageLocalAsset", "privateLocalFixture"].includes(provenance.privacyLabel)
      ? []
      : ["private-local-privacy-label-missing"]),
    ...(provenance.publicDistribution === "notPublicDistributable"
      ? []
      : ["public-distribution-policy-mismatch"]),
    ...(provenance.publicDemoAsset === false
      ? []
      : [provenance.publicDemoAsset === undefined
          ? "public-demo-asset-flag-missing"
          : "public-demo-asset-true"])
  ];

  if (reasons.length === 0) {
    return [];
  }

  return [
    createIssueCheck({
      context,
      checkId: "asset.psd.materializedProvenanceBlocked",
      status: "fail",
      severity: reasons.includes("public-demo-asset-true") ? "blocking" : "error",
      phase: "rights",
      targetPath: `${context.targetPath}/provenance`,
      message:
        `PSD materialization ${context.materialization.materializationId} lacks ` +
        "private/local provenance required for selected-layer asset intake.",
      evidence: [
        `privacyLabel=${provenance.privacyLabel}`,
        `publicDistribution=${provenance.publicDistribution}`,
        `publicDemoAsset=${provenance.publicDemoAsset ?? "missing"}`,
        `sourceFilePath=${provenance.sourceFilePath}`,
        `reasons=${reasons.join(",")}`
      ],
      impact:
        "Product Preflight must not treat selected PSD layer bytes as a usable private/local asset without explicit non-public provenance."
    })
  ];
};

const validateDestinationMapping = (
  context: MaterializedAssetContext
): readonly ValidationCheckResultDto[] => {
  const textureId = context.materialization.textureId;
  if (textureId === undefined) {
    return [
      createIssueCheck({
        context,
        checkId: "asset.psd.materializedDestinationMappingMissing",
        status: "needs_review",
        severity: "warning",
        phase: "reference",
        targetPath: `${context.targetPath}/textureId`,
        message:
          `PSD materialization ${context.materialization.materializationId} has no ` +
          "destination texture, drawable, or part mapping evidence.",
        evidence: [
          "destinationTextureId=missing",
          "destinationDrawableId=missing",
          "destinationPartId=missing",
          "mappingAvailability=not_evaluated"
        ],
        impact:
          "The selected-layer bytes are materialized, but Product Preflight cannot claim rigging destination availability yet."
      })
    ];
  }

  const textureEntry = context.indexes.textureEntriesById.get(textureId);
  const sourceLayer = findFlattenedSourceLayer(
    context.sourceAsset,
    context.materialization.sourceLayerRef.sourceLayerId
  );
  const mappedDrawables = (context.indexes.drawablesByTextureId.get(textureId) ?? [])
    .filter(({ drawable }) =>
      drawable.sourceAssetId === context.sourceAsset.sourceAssetId &&
      drawable.textureId === textureId
    );
  const mappedDrawable = mappedDrawables.find(({ drawable }) =>
    sourceLayer?.mappedDrawableIds.includes(drawable.drawableId) === true
  ) ?? mappedDrawables[0];
  const mappedPart = mappedDrawable === undefined
    ? undefined
    : context.indexes.partsById.get(mappedDrawable.drawable.partId);
  const mismatchReasons = [
    ...(textureEntry === undefined ? ["texture-entry-missing"] : []),
    ...(textureEntry !== undefined && textureEntry.entry.sourceAssetId !== context.sourceAsset.sourceAssetId
      ? ["texture-source-asset-mismatch"]
      : []),
    ...(textureEntry !== undefined &&
    textureEntry.entry.sourceLayerId !== context.materialization.sourceLayerRef.sourceLayerId
      ? ["texture-source-layer-mismatch"]
      : []),
    ...createTextureMaterializedBinaryMismatchReasons(textureEntry?.entry, context.materialization),
    ...(mappedDrawable === undefined ? ["drawable-mapping-missing"] : []),
    ...(mappedPart === undefined ? ["part-mapping-missing"] : []),
    ...(mappedDrawable !== undefined &&
    mappedPart !== undefined &&
    !mappedPart.drawableIds.includes(mappedDrawable.drawable.drawableId)
      ? ["part-drawable-membership-mismatch"]
      : [])
  ];

  if (mismatchReasons.length > 0) {
    return [
      createIssueCheck({
        context,
        checkId: "asset.psd.materializedDestinationMappingMissing",
        status: "fail",
        severity: "error",
        phase: "reference",
        targetPath: `${context.targetPath}/textureId`,
        message:
          `PSD materialization ${context.materialization.materializationId} destination ` +
          "texture, drawable, or part mapping is unavailable.",
        evidence: [
          `destinationTextureId=${textureId}`,
          `textureEntryMatch=${textureEntry === undefined ? "missing" : "present"}`,
          `textureSourceAssetId=${textureEntry?.entry.sourceAssetId ?? "missing"}`,
          `textureSourceLayerId=${textureEntry?.entry.sourceLayerId ?? "missing"}`,
          `textureFilePath=${textureEntry?.entry.filePath ?? "missing"}`,
          `textureContentHash=${textureEntry?.entry.contentHash ?? "missing"}`,
          `textureProvenanceId=${textureEntry?.entry.provenanceId ?? "missing"}`,
          `textureBinaryAssetId=${textureEntry?.entry.binaryAssetRef?.binaryAssetId ?? "missing"}`,
          `textureBinaryPath=${textureEntry?.entry.binaryAssetRef?.packageRelativePath ?? "missing"}`,
          `textureBinaryDigest=${formatDigest(textureEntry?.entry.binaryAssetRef?.digest)}`,
          `materializedBinaryPath=${context.materialization.binaryAssetRef?.packageRelativePath ?? "missing"}`,
          `materializedBinaryProvenanceId=${context.materialization.binaryAssetRef?.provenanceId ?? "missing"}`,
          `destinationDrawableId=${mappedDrawable?.drawable.drawableId ?? "missing"}`,
          `destinationDrawableIndex=${mappedDrawable?.index ?? "missing"}`,
          `destinationPartId=${mappedDrawable?.drawable.partId ?? "missing"}`,
          `destinationPartIndex=${mappedPart?.index ?? "missing"}`,
          `sourceLayerMappedDrawableIds=${sourceLayer?.mappedDrawableIds.join(",") ?? "missing"}`,
          `reasons=${mismatchReasons.join(",")}`
        ],
        impact:
          "The materialized selected layer cannot be treated as connected to a rigging destination until texture, drawable, and part evidence agree."
      })
    ];
  }

  return [];
};

const createTextureMaterializedBinaryMismatchReasons = (
  textureEntry: TextureAtlasEntryDto | undefined,
  materialization: PsdLayerMaterializationEvidenceDto
): readonly string[] => {
  if (textureEntry === undefined || materialization.binaryAssetRef === undefined) {
    return [];
  }

  const textureBinaryAssetRef = textureEntry.binaryAssetRef;
  const expectedContentHash = formatDigest(materialization.digest);
  const materializedBinaryAssetRef = materialization.binaryAssetRef;

  return [
    ...(textureBinaryAssetRef === undefined ? ["texture-binary-asset-ref-missing"] : []),
    ...(textureEntry.filePath === materializedBinaryAssetRef.packageRelativePath
      ? []
      : ["texture-file-path-mismatch"]),
    ...(textureEntry.contentHash === undefined || textureEntry.contentHash === expectedContentHash
      ? []
      : ["texture-content-hash-mismatch"]),
    ...(textureEntry.provenanceId === materializedBinaryAssetRef.provenanceId
      ? []
      : ["texture-provenance-id-mismatch"]),
    ...(textureBinaryAssetRef === undefined
      ? []
      : [
          ...(textureBinaryAssetRef.binaryAssetId === materializedBinaryAssetRef.binaryAssetId
            ? []
            : ["texture-binary-asset-id-mismatch"]),
          ...(textureBinaryAssetRef.packageRelativePath === materializedBinaryAssetRef.packageRelativePath
            ? []
            : ["texture-binary-path-mismatch"]),
          ...(sameDigest(textureBinaryAssetRef.digest, materializedBinaryAssetRef.digest)
            ? []
            : ["texture-binary-digest-mismatch"]),
          ...(textureBinaryAssetRef.byteLength === materializedBinaryAssetRef.byteLength
            ? []
            : ["texture-binary-byte-length-mismatch"]),
          ...(textureBinaryAssetRef.mediaType === materializedBinaryAssetRef.mediaType
            ? []
            : ["texture-binary-media-type-mismatch"]),
          ...(textureBinaryAssetRef.storageStatus === materializedBinaryAssetRef.storageStatus
            ? []
            : ["texture-binary-storage-status-mismatch"]),
          ...(textureBinaryAssetRef.provenanceId === materializedBinaryAssetRef.provenanceId
            ? []
            : ["texture-binary-provenance-id-mismatch"]),
          ...(textureBinaryAssetRef.rightsAssetId === materializedBinaryAssetRef.rightsAssetId
            ? []
            : ["texture-binary-rights-asset-id-mismatch"])
        ])
  ];
};

const createMaterializedAssetAvailableCheck = (
  context: MaterializedAssetContext
): ValidationCheckResultDto => {
  const mapping = resolveAvailableMapping(context);

  return createIssueCheck({
    context,
    checkId: "asset.psd.materializedAssetAvailable",
    status: "pass",
    severity: "info",
    phase: "source_import",
    targetPath: context.targetPath,
    message:
      `PSD materialization ${context.materialization.materializationId} has current ` +
      "private/local package materialized asset and destination mapping evidence.",
    evidence: [
      "materializedAssetAvailability=available",
      "materializedBytesAvailability=package-local-binary-ref",
      `destinationTextureId=${mapping.textureId}`,
      `destinationDrawableId=${mapping.drawableId}`,
      `destinationPartId=${mapping.partId}`,
      "textureMapping=available",
      "drawableMapping=available",
      "partMapping=available"
    ],
    impact:
      "Product Preflight can treat this selected PSD layer materialized asset as available metadata and package-local byte evidence, without parser execution or pixel oracle claims."
  });
};

const createIssueCheck = (input: {
  readonly context: MaterializedAssetContext;
  readonly checkId: string;
  readonly status: CheckStatus;
  readonly severity: Severity;
  readonly phase: "source_import" | "rights" | "reference";
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: input.checkId,
    status: input.status,
    severity: input.severity,
    phase: input.phase,
    target: {
      kind: "sourceAsset",
      id: input.context.sourceAsset.sourceAssetId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: input.message,
    evidence: [
      ...createCommonMaterializationEvidence(input.context),
      ...input.evidence,
      "validatorBoundary=no-parser-execution",
      "rawParserObject=notPersisted",
      "rawMaterializedBytes=notInlined",
      "photoshopCompositing=notClaimed",
      "rendererPixelOracle=notClaimed",
      "publicDemoAsset=falseRequired"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-IN-003"],
    impact: input.impact
  });

const createCommonMaterializationEvidence = (
  context: MaterializedAssetContext
): readonly string[] => [
  `sourceAssetId=${context.sourceAsset.sourceAssetId}`,
  `sourceAssetIndex=${context.sourceAssetIndex}`,
  `sourceKind=${context.sourceAsset.kind}`,
  `importProfile=${context.sourceAsset.importProfile}`,
  `materializationIndex=${context.materializationIndex}`,
  `materializationId=${context.materialization.materializationId}`,
  `sourceLayerId=${context.materialization.sourceLayerRef.sourceLayerId}`,
  `mediaType=${context.materialization.mediaType}`,
  `byteLength=${context.materialization.byteLength}`,
  `digest=${formatDigest(context.materialization.digest)}`,
  `binaryAssetId=${context.materialization.binaryAssetRef?.binaryAssetId ?? "missing"}`,
  `textureId=${context.materialization.textureId ?? "missing"}`,
  `privacyLabel=${context.materialization.provenance.privacyLabel}`,
  `publicDistribution=${context.materialization.provenance.publicDistribution}`,
  `publicDemoAsset=${context.materialization.provenance.publicDemoAsset ?? "missing"}`
];

const createBinaryAssetRefEvidence = (
  binaryAssetRef: BinaryAssetReferenceDto
): readonly string[] => [
  `binaryAssetId=${binaryAssetRef.binaryAssetId}`,
  `packageRelativePath=${binaryAssetRef.packageRelativePath}`,
  `binaryDigest=${formatDigest(binaryAssetRef.digest)}`,
  `binaryByteLength=${binaryAssetRef.byteLength}`,
  `binaryMediaType=${binaryAssetRef.mediaType}`,
  `storageStatus=${binaryAssetRef.storageStatus}`,
  `provenanceId=${binaryAssetRef.provenanceId}`,
  `rightsAssetId=${binaryAssetRef.rightsAssetId}`
];

const resolveAvailableMapping = (context: MaterializedAssetContext) => {
  const textureId = context.materialization.textureId ?? "missing";
  const drawable = (context.indexes.drawablesByTextureId.get(textureId) ?? [])[0]?.drawable;

  return {
    textureId,
    drawableId: drawable?.drawableId ?? "missing",
    partId: drawable?.partId ?? "missing"
  };
};

const createSourceLayerNameMismatchReasons = (
  materialization: PsdLayerMaterializationEvidenceDto,
  structuredLayer: SourceLayerLike | undefined,
  flattenedLayer: SourceLayerDto | undefined
): readonly string[] => {
  const name = materialization.sourceLayerRef.sourceLayerName;
  if (name === undefined) {
    return [];
  }

  const candidates = [
    structuredLayer?.originalName,
    structuredLayer?.normalizedName,
    flattenedLayer?.originalName,
    flattenedLayer?.normalizedName
  ].filter((value): value is string => value !== undefined);

  return candidates.includes(name) ? [] : ["source-layer-name-mismatch"];
};

const createSourceLayerPathMismatchReasons = (
  materialization: PsdLayerMaterializationEvidenceDto,
  structuredLayer: SourceLayerLike | undefined,
  flattenedLayer: SourceLayerDto | undefined
): readonly string[] => {
  const sourceLayerPath = materialization.sourceLayerRef.sourceLayerPath;
  if (sourceLayerPath === undefined || sourceLayerPath.length === 0) {
    return [];
  }

  const actualPath = sourceLayerPath.join("/");
  const expectedTails = [
    ...(structuredLayer === undefined ? [] : [createExpectedLayerPathTail(structuredLayer)]),
    ...(flattenedLayer === undefined ? [] : [createExpectedLayerPathTail(flattenedLayer)])
  ];

  return expectedTails.some((expectedTail) =>
    actualPath === expectedTail || actualPath.endsWith(`/${expectedTail}`)
  )
    ? []
    : ["source-layer-path-mismatch"];
};

const createExtractionOptionMismatchReasons = (
  extraction: PsdLayerMaterializationEvidenceDto["extraction"],
  sourceLayerId: string
): readonly string[] => {
  if (extraction === undefined) {
    return [];
  }

  const options = extraction.options ?? {};
  const expectedOptions: ReadonlyArray<readonly [string, string | boolean]> = [
    ["channelOrder", "rgba"],
    ["includeEffects", false],
    ["includeHiddenLayers", false],
    ["composeWithOtherLayers", false],
    ["layerSelection", sourceLayerId]
  ];

  return expectedOptions
    .filter(([optionName, expectedValue]) => options[optionName] !== expectedValue)
    .map(([optionName]) => `extraction-option-${optionName}-mismatch`);
};

type SourceLayerLike = LayeredCharacterPsdProfileDto["sourceLayers"][number];

const findStructuredSourceLayer = (
  profile: LayeredCharacterPsdProfileDto,
  sourceLayerId: string
): SourceLayerLike | undefined =>
  profile.sourceLayers.find((sourceLayer) => sourceLayer.sourceLayerId === sourceLayerId);

const findFlattenedSourceLayer = (
  sourceAsset: SourceAssetDto,
  sourceLayerId: string
): SourceLayerDto | undefined =>
  sourceAsset.layers.find((sourceLayer) => sourceLayer.sourceLayerId === sourceLayerId);

const createExpectedLayerPathTail = (
  sourceLayer: SourceLayerLike | SourceLayerDto
): string =>
  [...sourceLayer.groupPath, sourceLayer.originalName].join("/");

const parseSourceAssetSha256ContentHash = (
  contentHash: string
): BinaryAssetDigestDto | undefined => {
  const match = /^sha256:([a-f0-9]{64})$/.exec(contentHash);
  return match === null
    ? undefined
    : {
        algorithm: "sha256",
        hex: match[1]!
      };
};

const sameDigest = (
  left: BinaryAssetDigestDto | undefined,
  right: BinaryAssetDigestDto | undefined
): boolean =>
  left !== undefined &&
  right !== undefined &&
  left.algorithm === right.algorithm &&
  left.hex === right.hex;

const formatDigest = (digest: BinaryAssetDigestDto | undefined): string =>
  digest === undefined ? "missing" : `${digest.algorithm}:${digest.hex}`;
