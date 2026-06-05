import type {
  CheckStatus,
  Severity
} from "@private-2d-rigging-lab/contracts";
import type {
  BinaryAssetDigestDto,
  LayeredCharacterPsdProfileDto,
  PsdFeatureSupportEvidenceDto,
  PsdLayerMaterializationEvidenceDto,
  PsdLayerTreeEvidenceDto,
  PsdParserEvidenceDto,
  SourceAssetDto
} from "@private-2d-rigging-lab/package-format";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

export const validatePsdSourceEvidenceDiagnostics = (
  sourceAsset: SourceAssetDto,
  sourceAssetIndex: number,
  profile: LayeredCharacterPsdProfileDto
): readonly ValidationCheckResultDto[] => [
  ...validateParserEvidence(sourceAsset, sourceAssetIndex, profile),
  ...validateLayerTreeEvidence(sourceAsset, sourceAssetIndex, profile),
  ...validateFeatureSupportEvidence(sourceAsset, sourceAssetIndex, profile),
  ...validateMaterializationEvidence(sourceAsset, sourceAssetIndex, profile)
];

const validateParserEvidence = (
  sourceAsset: SourceAssetDto,
  sourceAssetIndex: number,
  profile: LayeredCharacterPsdProfileDto
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const parserEntries = collectParserEvidenceEntries(sourceAssetIndex, profile);

  parserEntries.forEach((entry) => {
    checks.push(createParserEvidenceCheck({
      sourceAsset,
      profile,
      parser: entry.parser,
      targetPath: entry.targetPath,
      evidenceScope: entry.evidenceScope,
      ...(entry.evidenceIndex === undefined ? {} : { evidenceIndex: entry.evidenceIndex })
    }));
  });

  if (isRealPsdParseProfile(profile) && parserEntries.length === 0) {
    checks.push(createParserEvidenceUnavailableCheck({
      sourceAsset,
      sourceAssetIndex,
      profile,
      reason: "real-psd-parse-result-missing-parser-evidence"
    }));
  }

  return checks;
};

const validateLayerTreeEvidence = (
  sourceAsset: SourceAssetDto,
  sourceAssetIndex: number,
  profile: LayeredCharacterPsdProfileDto
): readonly ValidationCheckResultDto[] => {
  if (profile.layerTreeEvidence === undefined) {
    return isRealPsdParseProfile(profile)
      ? [
        createLayerTreeEvidenceMissingCheck({
          sourceAsset,
          sourceAssetIndex,
          profile,
          reason: "real-psd-parse-result-missing-layer-tree-evidence"
        })
      ]
      : [];
  }

  const targetPath = `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}/psdProfile/layerTreeEvidence`;
  return [
    createLayerTreeEvidenceCheck(sourceAsset, profile, profile.layerTreeEvidence, targetPath),
    ...validateLayerTreeEvidenceConsistency(sourceAsset, profile, profile.layerTreeEvidence, targetPath)
  ];
};

const validateFeatureSupportEvidence = (
  sourceAsset: SourceAssetDto,
  sourceAssetIndex: number,
  profile: LayeredCharacterPsdProfileDto
): readonly ValidationCheckResultDto[] => [
  ...(profile.featureSupportEvidence ?? []).map((featureEvidence, featureIndex) =>
    createFeatureSupportEvidenceCheck({
      sourceAsset,
      profile,
      featureEvidence,
      targetPath:
        `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}` +
        `/psdProfile/featureSupportEvidence/${featureIndex}`,
      sourceEvidence: ["profileEntry=document"],
      featureIndex
    })
  ),
  ...profile.sourceGroups.flatMap((sourceGroup, sourceGroupIndex) =>
    (sourceGroup.featureSupportEvidence ?? []).map((featureEvidence, featureIndex) =>
      createFeatureSupportEvidenceCheck({
        sourceAsset,
        profile,
        featureEvidence,
        targetPath:
          `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}` +
          `/psdProfile/sourceGroups/${sourceGroupIndex}/featureSupportEvidence/${featureIndex}`,
        sourceEvidence: [
          "profileEntry=sourceGroup",
          `sourceGroupId=${sourceGroup.sourceGroupId}`,
          `groupPath=${sourceGroup.groupPath.join("/") || "root"}`
        ],
        featureIndex
      })
    )
  ),
  ...profile.sourceLayers.flatMap((sourceLayer, sourceLayerIndex) =>
    (sourceLayer.featureSupportEvidence ?? []).map((featureEvidence, featureIndex) =>
      createFeatureSupportEvidenceCheck({
        sourceAsset,
        profile,
        featureEvidence,
        targetPath:
          `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}` +
          `/psdProfile/sourceLayers/${sourceLayerIndex}/featureSupportEvidence/${featureIndex}`,
        sourceEvidence: [
          "profileEntry=sourceLayer",
          `sourceLayerId=${sourceLayer.sourceLayerId}`,
          `groupPath=${sourceLayer.groupPath.join("/") || "root"}`
        ],
        featureIndex
      })
    )
  )
];

const validateMaterializationEvidence = (
  sourceAsset: SourceAssetDto,
  sourceAssetIndex: number,
  profile: LayeredCharacterPsdProfileDto
): readonly ValidationCheckResultDto[] => {
  const materializationEvidence = profile.materializationEvidence ?? [];
  const checks = materializationEvidence.flatMap((materialization, materializationIndex) => {
    const targetPath =
      `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}` +
      `/psdProfile/materializationEvidence/${materializationIndex}`;

    return [
      createMaterializationEvidenceCheck(sourceAsset, profile, materialization, targetPath),
      ...validateMaterializationEvidenceConsistency(sourceAsset, profile, materialization, targetPath)
    ];
  });

  if (isRealPsdParseProfile(profile) && materializationEvidence.length === 0) {
    return [
      ...checks,
      createMaterializationEvidenceMissingCheck({
        sourceAsset,
        sourceAssetIndex,
        profile,
        reason: "real-psd-parse-result-missing-selected-layer-raster-evidence"
      })
    ];
  }

  return checks;
};

interface ParserEvidenceEntry {
  readonly parser: PsdParserEvidenceDto;
  readonly targetPath: string;
  readonly evidenceScope: string;
  readonly evidenceIndex?: number;
}

const collectParserEvidenceEntries = (
  sourceAssetIndex: number,
  profile: LayeredCharacterPsdProfileDto
): readonly ParserEvidenceEntry[] => [
  ...(profile.adapter.parser === undefined
    ? []
    : [{
      parser: profile.adapter.parser,
      targetPath:
        `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}` +
        "/psdProfile/adapter/parser",
      evidenceScope: "profile.adapter.parser"
    }]),
  ...(profile.layerTreeEvidence?.parser === undefined
    ? []
    : [{
      parser: profile.layerTreeEvidence.parser,
      targetPath:
        `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}` +
        "/psdProfile/layerTreeEvidence/parser",
      evidenceScope: "profile.layerTreeEvidence.parser"
    }]),
  ...(profile.materializationEvidence ?? []).flatMap((materialization, materializationIndex) =>
    materialization.parser === undefined
      ? []
      : [{
        parser: materialization.parser,
        targetPath:
          `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}` +
          `/psdProfile/materializationEvidence/${materializationIndex}/parser`,
        evidenceScope: "profile.materializationEvidence.parser",
        evidenceIndex: materializationIndex
      }]
  )
];

const validateLayerTreeEvidenceConsistency = (
  sourceAsset: SourceAssetDto,
  profile: LayeredCharacterPsdProfileDto,
  layerTreeEvidence: PsdLayerTreeEvidenceDto,
  targetPath: string
): readonly ValidationCheckResultDto[] => {
  const expectedIntakeKind = expectedIntakeKindForProfile(profile);
  const mismatchReasons = [
    ...(layerTreeEvidence.intakeKind !== expectedIntakeKind
      ? [`intake-kind-mismatch:${layerTreeEvidence.intakeKind}->${expectedIntakeKind}`]
      : []),
    ...(layerTreeEvidence.groupCount !== profile.sourceGroups.length
      ? [`group-count-mismatch:${layerTreeEvidence.groupCount}->${profile.sourceGroups.length}`]
      : []),
    ...(layerTreeEvidence.layerCount !== profile.sourceLayers.length
      ? [`layer-count-mismatch:${layerTreeEvidence.layerCount}->${profile.sourceLayers.length}`]
      : [])
  ];

  return mismatchReasons.length === 0
    ? []
    : [
      createEvidenceMismatchCheck({
        sourceAsset,
        profile,
        checkId: "asset.psd.layerTreeEvidenceMismatch",
        targetPath,
        message:
          `PSD layer tree evidence ${layerTreeEvidence.evidenceId} does not match ` +
          "the structured PSD profile summary.",
        evidence: [
          `layerTreeEvidenceId=${layerTreeEvidence.evidenceId}`,
          `layerTreeIntakeKind=${layerTreeEvidence.intakeKind}`,
          `expectedIntakeKind=${expectedIntakeKind}`,
          `layerTreeGroupCount=${layerTreeEvidence.groupCount}`,
          `structuredGroupCount=${profile.sourceGroups.length}`,
          `layerTreeLayerCount=${layerTreeEvidence.layerCount}`,
          `structuredLayerCount=${profile.sourceLayers.length}`,
          `reasons=${mismatchReasons.join(",")}`
        ],
        impact:
          "The validator cannot treat inconsistent PSD layer tree counts or intake kind " +
          "as reliable parser evidence."
      })
    ];
};

const validateMaterializationEvidenceConsistency = (
  sourceAsset: SourceAssetDto,
  profile: LayeredCharacterPsdProfileDto,
  materialization: PsdLayerMaterializationEvidenceDto,
  targetPath: string
): readonly ValidationCheckResultDto[] => {
  const structuredLayerIds = new Set(profile.sourceLayers.map((sourceLayer) => sourceLayer.sourceLayerId));
  const flattenedLayerIds = new Set(sourceAsset.layers.map((sourceLayer) => sourceLayer.sourceLayerId));
  const mismatchReasons = [
    ...(materialization.sourceLayerRef.sourceAssetId !== sourceAsset.sourceAssetId
      ? ["source-asset-id-mismatch"]
      : []),
    ...(structuredLayerIds.has(materialization.sourceLayerRef.sourceLayerId)
      ? []
      : ["source-layer-missing-from-structured-profile"]),
    ...(flattenedLayerIds.has(materialization.sourceLayerRef.sourceLayerId)
      ? []
      : ["source-layer-missing-from-flattened-layers"]),
    ...(materialization.provenance.publicDistribution === "notPublicDistributable"
      ? []
      : ["public-distribution-policy-mismatch"])
  ];

  return mismatchReasons.length === 0
    ? []
    : [
      createEvidenceMismatchCheck({
        sourceAsset,
        profile,
        checkId: "asset.psd.materializationEvidenceMismatch",
        targetPath,
        message:
          `PSD materialization evidence ${materialization.materializationId} does not match ` +
          "the structured source layer/provenance boundary.",
        evidence: [
          `materializationId=${materialization.materializationId}`,
          `materializedSourceAssetId=${materialization.sourceLayerRef.sourceAssetId}`,
          `expectedSourceAssetId=${sourceAsset.sourceAssetId}`,
          `sourceLayerId=${materialization.sourceLayerRef.sourceLayerId}`,
          `structuredLayerMatch=${structuredLayerIds.has(materialization.sourceLayerRef.sourceLayerId)}`,
          `flattenedLayerMatch=${flattenedLayerIds.has(materialization.sourceLayerRef.sourceLayerId)}`,
          `publicDistribution=${materialization.provenance.publicDistribution}`,
          `reasons=${mismatchReasons.join(",")}`
        ],
        impact:
          "The validator cannot connect this selected layer raster evidence to a known PSD source layer."
      })
    ];
};

const createParserEvidenceCheck = (input: {
  readonly sourceAsset: SourceAssetDto;
  readonly profile: LayeredCharacterPsdProfileDto;
  readonly parser: PsdParserEvidenceDto;
  readonly targetPath: string;
  readonly evidenceScope: string;
  readonly evidenceIndex?: number;
}): ValidationCheckResultDto =>
  createEvidenceCheck({
    sourceAsset: input.sourceAsset,
    profile: input.profile,
    checkId: "asset.psd.parserEvidence",
    status: "pass",
    severity: "info",
    targetPath: input.targetPath,
    message:
      `PSD parser evidence records ${input.parser.parserName}` +
      `${input.parser.parserVersion === undefined ? "" : `@${input.parser.parserVersion}`}.`,
    evidence: [
      `parserEvidenceKind=${input.parser.evidenceKind}`,
      `parserName=${input.parser.parserName}`,
      `parserPackageName=${input.parser.parserPackageName ?? "missing"}`,
      `parserVersion=${input.parser.parserVersion ?? "missing"}`,
      `adapterName=${input.parser.adapterName ?? "missing"}`,
      `adapterVersion=${input.parser.adapterVersion ?? "missing"}`,
      `parserRuntime=${input.parser.runtime ?? "unknown"}`,
      `privateShapePolicy=${input.parser.privateShapePolicy}`,
      `parserEvidenceScope=${input.evidenceScope}`,
      ...(input.evidenceIndex === undefined ? [] : [`parserEvidenceIndex=${input.evidenceIndex}`])
    ],
    impact:
      "The validator records parser provenance only; it does not re-run the parser or prove Photoshop compositing correctness."
  });

const createLayerTreeEvidenceCheck = (
  sourceAsset: SourceAssetDto,
  profile: LayeredCharacterPsdProfileDto,
  layerTreeEvidence: PsdLayerTreeEvidenceDto,
  targetPath: string
): ValidationCheckResultDto =>
  createEvidenceCheck({
    sourceAsset,
    profile,
    checkId: "asset.psd.layerTreeEvidence",
    status: "pass",
    severity: "info",
    targetPath,
    message:
      `PSD layer tree evidence ${layerTreeEvidence.evidenceId} records ` +
      `${layerTreeEvidence.groupCount} group(s) and ${layerTreeEvidence.layerCount} layer(s).`,
    evidence: [
      `layerTreeEvidenceKind=${layerTreeEvidence.evidenceKind}`,
      `layerTreeEvidenceId=${layerTreeEvidence.evidenceId}`,
      `layerTreeIntakeKind=${layerTreeEvidence.intakeKind}`,
      `groupCount=${layerTreeEvidence.groupCount}`,
      `layerCount=${layerTreeEvidence.layerCount}`,
      `maxDepth=${layerTreeEvidence.maxDepth ?? "missing"}`,
      `privateShapePolicy=${layerTreeEvidence.privateShapePolicy}`,
      `parserEvidencePresent=${layerTreeEvidence.parser !== undefined}`
    ],
    impact:
      "The validator records parser-derived layer tree evidence as structured metadata only; it does not claim full Photoshop semantics."
  });

const createFeatureSupportEvidenceCheck = (input: {
  readonly sourceAsset: SourceAssetDto;
  readonly profile: LayeredCharacterPsdProfileDto;
  readonly featureEvidence: PsdFeatureSupportEvidenceDto;
  readonly targetPath: string;
  readonly sourceEvidence: readonly string[];
  readonly featureIndex: number;
}): ValidationCheckResultDto => {
  const unsupported = input.featureEvidence.status === "unsupported";
  return createEvidenceCheck({
    sourceAsset: input.sourceAsset,
    profile: input.profile,
    checkId: unsupported ? "asset.psd.featureUnsupported" : "asset.psd.featureNotEvaluated",
    status: unsupported ? "not_applicable" : statusForPsdSeverity(input.featureEvidence.severity),
    severity: input.featureEvidence.severity,
    targetPath: input.targetPath,
    message:
      `PSD feature ${input.featureEvidence.featureId} is ${input.featureEvidence.status}: ` +
      input.featureEvidence.message,
    evidence: [
      ...input.sourceEvidence,
      `featureSupportEvidenceKind=${input.featureEvidence.evidenceKind}`,
      `featureId=${input.featureEvidence.featureId}`,
      `featureStatus=${input.featureEvidence.status}`,
      `featureScope=${input.featureEvidence.scope}`,
      `featureSeverity=${input.featureEvidence.severity}`,
      `featureIndex=${input.featureIndex}`,
      `rasterizeCandidate=${input.featureEvidence.rasterizeCandidate ?? false}`,
      `manualConfirmationRequired=${input.featureEvidence.manualConfirmationRequired ?? false}`,
      ...createFeatureSourceEvidence(input.featureEvidence),
      ...(input.featureEvidence.evidenceRefs ?? []).map((evidenceRef, evidenceRefIndex) =>
        `featureEvidenceRef[${evidenceRefIndex}]=${evidenceRef}`
      )
    ],
    impact: unsupported
      ? "The PSD profile explicitly records this Photoshop feature as unsupported without treating it as implemented."
      : "The PSD profile records this Photoshop feature as not evaluated, so downstream consumers must not infer support."
  });
};

const createMaterializationEvidenceCheck = (
  sourceAsset: SourceAssetDto,
  profile: LayeredCharacterPsdProfileDto,
  materialization: PsdLayerMaterializationEvidenceDto,
  targetPath: string
): ValidationCheckResultDto =>
  createEvidenceCheck({
    sourceAsset,
    profile,
    checkId: "asset.psd.materializationEvidence",
    status: "pass",
    severity: "info",
    targetPath,
    message:
      `PSD materialization evidence ${materialization.materializationId} records selected ` +
      `layer raster bytes for ${materialization.sourceLayerRef.sourceLayerId}.`,
    evidence: [
      `materializationEvidenceKind=${materialization.evidenceKind}`,
      `materializationId=${materialization.materializationId}`,
      `sourceLayerAssetId=${materialization.sourceLayerRef.sourceAssetId}`,
      `sourceLayerId=${materialization.sourceLayerRef.sourceLayerId}`,
      `sourceLayerPath=${materialization.sourceLayerRef.sourceLayerPath?.join("/") ?? "missing"}`,
      `mediaType=${materialization.mediaType}`,
      `byteLength=${materialization.byteLength}`,
      `digest=${formatDigest(materialization.digest)}`,
      `binaryAssetId=${materialization.binaryAssetRef?.binaryAssetId ?? "missing"}`,
      `binaryAssetPath=${materialization.binaryAssetRef?.packageRelativePath ?? "missing"}`,
      `textureId=${materialization.textureId ?? "missing"}`,
      `privacyLabel=${materialization.provenance.privacyLabel}`,
      `publicDistribution=${materialization.provenance.publicDistribution}`,
      `sourceFilePath=${materialization.provenance.sourceFilePath}`,
      `sourceDigest=${formatDigest(materialization.provenance.sourceDigest)}`,
      `sourceByteLength=${materialization.provenance.sourceByteLength ?? "missing"}`,
      `sourceMediaType=${materialization.provenance.sourceMediaType ?? "missing"}`,
      `fixtureId=${materialization.provenance.fixtureId ?? "missing"}`,
      `derivedArtifactPath=${materialization.provenance.derivedArtifactPath ?? "missing"}`,
      `generatedBy=${materialization.provenance.generatedBy ?? "missing"}`,
      `parserEvidencePresent=${materialization.parser !== undefined}`,
      `extractionKind=${materialization.extraction?.extractionKind ?? "missing"}`
    ],
    impact:
      "The validator records selected layer raster materialization provenance and digest metadata only; it does not validate rendered pixel correctness."
  });

const createParserEvidenceUnavailableCheck = (input: {
  readonly sourceAsset: SourceAssetDto;
  readonly sourceAssetIndex: number;
  readonly profile: LayeredCharacterPsdProfileDto;
  readonly reason: string;
}): ValidationCheckResultDto =>
  createEvidenceCheck({
    sourceAsset: input.sourceAsset,
    profile: input.profile,
    checkId: "asset.psd.parserEvidenceUnavailable",
    status: "fail",
    severity: "error",
    targetPath:
      `/assets/sourceManifest/sourceAssets/${input.sourceAssetIndex}` +
      "/psdProfile/adapter/parser",
    message:
      `PSD profile ${input.sourceAsset.sourceAssetId} claims real PSD parse intake ` +
      "but has no parser evidence.",
    evidence: [
      `reason=${input.reason}`,
      `adapterEvidenceKind=${input.profile.adapter.evidenceKind}`,
      `adapterIntakeKind=${input.profile.adapter.intakeKind ?? "missing"}`,
      `layerTreeEvidencePresent=${input.profile.layerTreeEvidence !== undefined}`,
      `materializationEvidenceCount=${input.profile.materializationEvidence?.length ?? 0}`
    ],
    impact:
      "The validator cannot trace real PSD parse evidence to an approved parser boundary."
  });

const createLayerTreeEvidenceMissingCheck = (input: {
  readonly sourceAsset: SourceAssetDto;
  readonly sourceAssetIndex: number;
  readonly profile: LayeredCharacterPsdProfileDto;
  readonly reason: string;
}): ValidationCheckResultDto =>
  createEvidenceCheck({
    sourceAsset: input.sourceAsset,
    profile: input.profile,
    checkId: "asset.psd.layerTreeEvidenceMissing",
    status: "fail",
    severity: "error",
    targetPath:
      `/assets/sourceManifest/sourceAssets/${input.sourceAssetIndex}` +
      "/psdProfile/layerTreeEvidence",
    message:
      `PSD profile ${input.sourceAsset.sourceAssetId} claims real PSD parse intake ` +
      "but has no layer tree evidence.",
    evidence: [
      `reason=${input.reason}`,
      `adapterEvidenceKind=${input.profile.adapter.evidenceKind}`,
      `adapterIntakeKind=${input.profile.adapter.intakeKind ?? "missing"}`,
      `structuredGroupCount=${input.profile.sourceGroups.length}`,
      `structuredLayerCount=${input.profile.sourceLayers.length}`
    ],
    impact:
      "Real PSD parser intake must preserve structured layer tree evidence before validation can trust layer counts."
  });

const createMaterializationEvidenceMissingCheck = (input: {
  readonly sourceAsset: SourceAssetDto;
  readonly sourceAssetIndex: number;
  readonly profile: LayeredCharacterPsdProfileDto;
  readonly reason: string;
}): ValidationCheckResultDto =>
  createEvidenceCheck({
    sourceAsset: input.sourceAsset,
    profile: input.profile,
    checkId: "asset.psd.materializationEvidenceMissing",
    status: "needs_review",
    severity: "warning",
    targetPath:
      `/assets/sourceManifest/sourceAssets/${input.sourceAssetIndex}` +
      "/psdProfile/materializationEvidence",
    message:
      `PSD profile ${input.sourceAsset.sourceAssetId} has real parse evidence but no selected ` +
      "layer raster materialization evidence.",
    evidence: [
      `reason=${input.reason}`,
      `adapterEvidenceKind=${input.profile.adapter.evidenceKind}`,
      `adapterIntakeKind=${input.profile.adapter.intakeKind ?? "missing"}`,
      `structuredLayerCount=${input.profile.sourceLayers.length}`
    ],
    impact:
      "The source profile remains parseable, but selected layer raster bytes are unavailable or not yet evaluated."
  });

const createEvidenceMismatchCheck = (input: {
  readonly sourceAsset: SourceAssetDto;
  readonly profile: LayeredCharacterPsdProfileDto;
  readonly checkId:
    | "asset.psd.layerTreeEvidenceMismatch"
    | "asset.psd.materializationEvidenceMismatch";
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
}): ValidationCheckResultDto =>
  createEvidenceCheck({
    sourceAsset: input.sourceAsset,
    profile: input.profile,
    checkId: input.checkId,
    status: "fail",
    severity: "error",
    targetPath: input.targetPath,
    message: input.message,
    evidence: input.evidence,
    impact: input.impact
  });

const createEvidenceCheck = (input: {
  readonly sourceAsset: SourceAssetDto;
  readonly profile: LayeredCharacterPsdProfileDto;
  readonly checkId: string;
  readonly status: CheckStatus;
  readonly severity: Severity;
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: input.checkId,
    status: input.status,
    severity: input.severity,
    phase: "source_import",
    target: {
      kind: "sourceAsset",
      id: input.sourceAsset.sourceAssetId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: input.message,
    evidence: [
      `sourceAssetId=${input.sourceAsset.sourceAssetId}`,
      `sourceKind=${input.sourceAsset.kind}`,
      `importProfile=${input.sourceAsset.importProfile}`,
      `adapterName=${input.profile.adapter.adapterName}`,
      `adapterEvidenceKind=${input.profile.adapter.evidenceKind}`,
      `adapterIntakeKind=${input.profile.adapter.intakeKind ?? "missing"}`,
      "structuredProfile=psdProfile",
      "validatorBoundary=no-parser-execution",
      "photoshopCompositing=notClaimed",
      "rendererPixelOracle=notClaimed",
      ...input.evidence
    ],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-003"],
    impact: input.impact
  });

const createFeatureSourceEvidence = (
  featureEvidence: PsdFeatureSupportEvidenceDto
): readonly string[] =>
  featureEvidence.source === undefined
    ? ["featureSource=missing"]
    : [
      `featureSourceKind=${featureEvidence.source.kind}`,
      `featureSourceId=${featureEvidence.source.id ?? "missing"}`,
      `featureSourcePath=${featureEvidence.source.path ?? "missing"}`
    ];

const isRealPsdParseProfile = (profile: LayeredCharacterPsdProfileDto): boolean =>
  profile.adapter.evidenceKind === "real-psd-parse-result-v1" ||
  profile.adapter.intakeKind === "realPsdParseResult" ||
  profile.layerTreeEvidence?.intakeKind === "realPsdParseResult";

const expectedIntakeKindForProfile = (
  profile: LayeredCharacterPsdProfileDto
): "parserFreeAdapterResult" | "realPsdParseResult" =>
  isRealPsdParseProfile(profile) ? "realPsdParseResult" : "parserFreeAdapterResult";

const statusForPsdSeverity = (severity: Exclude<Severity, "blocking">): CheckStatus =>
  severity === "error" ? "fail" : severity === "warning" ? "needs_review" : "pass";

const formatDigest = (digest: BinaryAssetDigestDto | undefined): string =>
  digest === undefined ? "missing" : `${digest.algorithm}:${digest.hex}`;
