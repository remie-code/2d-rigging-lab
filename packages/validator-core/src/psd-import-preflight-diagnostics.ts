import type {
  CheckStatus,
  PackageId,
  Severity,
  ValidationProfile
} from "@private-2d-rigging-lab/contracts";

import { buildValidationReport } from "./report-builder.js";
import type {
  ValidationCheckResultDto,
  ValidationReportDto
} from "./validation-report.js";
import { ValidationCheckResultSchema } from "./validation-report.js";

export type BrowserPsdImportPreflightStatus = "parsed" | "rejected" | "failed";
export type BrowserPsdImportPreflightFailureKind =
  | "sizeLimitExceeded"
  | "parserFailure"
  | "materializationFailure";

export interface BrowserPsdImportPreflightSourceEvidenceInput {
  readonly evidenceKind?: "browser-psd-source-evidence-v1";
  readonly sourceAssetId: string;
  readonly fileName: string;
  readonly intakeKind?: "explicitFile" | "explicitArrayBuffer";
  readonly declaredMediaType?: string;
  readonly byteLength: number;
  readonly sizeCapBytes: number;
}

export interface BrowserPsdImportPreflightParserEvidenceInput {
  readonly evidenceKind?: "psd-parser-evidence-v1";
  readonly parserName: string;
  readonly parserPackageName?: string;
  readonly parserVersion?: string;
  readonly adapterName?: string;
  readonly adapterVersion?: string;
  readonly runtime?: "node" | "browser" | "unknown";
  readonly privateShapePolicy?: "parser-private-shape-excluded-v1";
}

export interface BrowserPsdImportPreflightLayerTreeEvidenceInput {
  readonly evidenceKind?: "psd-layer-tree-evidence-v1";
  readonly evidenceId: string;
  readonly intakeKind: "parserFreeAdapterResult" | "realPsdParseResult";
  readonly groupCount: number;
  readonly layerCount: number;
  readonly maxDepth?: number;
  readonly parser?: BrowserPsdImportPreflightParserEvidenceInput;
  readonly privateShapePolicy?: "parser-private-shape-excluded-v1";
}

export interface BrowserPsdImportPreflightFeatureSupportEvidenceInput {
  readonly evidenceKind?: "psd-feature-support-evidence-v1";
  readonly featureId: string;
  readonly status: "unsupported" | "notEvaluated";
  readonly scope?: string;
  readonly severity?: Exclude<Severity, "blocking">;
  readonly message: string;
  readonly evidenceRefs?: readonly string[];
}

export interface BrowserPsdImportPreflightMaterializationEvidenceInput {
  readonly evidenceKind?: "psd-layer-materialization-evidence-v1";
  readonly materializationId: string;
  readonly sourceLayerRef: {
    readonly sourceAssetId: string;
    readonly sourceLayerId: string;
    readonly sourceLayerPath?: readonly string[];
  };
  readonly mediaType: string;
  readonly byteLength: number;
  readonly digest: {
    readonly algorithm: "sha256";
    readonly hex: string;
  };
  readonly textureId?: string;
}

export interface BrowserPsdImportPreflightDiagnosticInput {
  readonly checkId: string;
  readonly severity?: Exclude<Severity, "blocking">;
  readonly message: string;
  readonly evidence?: readonly string[];
}

export interface BrowserPsdImportPreflightErrorEvidenceInput {
  readonly errorId?: string;
  readonly failureKind: BrowserPsdImportPreflightFailureKind;
  readonly severity?: "warning" | "error";
  readonly message: string;
}

export interface BrowserPsdImportPreflightByteAvailabilityInput {
  readonly currentSessionBytes: "available" | "missing";
  readonly requiresReupload?: boolean;
  readonly reason?: string;
}

export interface BrowserPsdImportPreflightSelectedMaterializationInput {
  readonly status: "available" | "missing" | "notRequested";
  readonly sourceLayerId?: string;
  readonly reason?: string;
}

export interface BrowserPsdImportPreflightAdapterResultInput {
  readonly parser?: BrowserPsdImportPreflightParserEvidenceInput;
  readonly layerTreeEvidence?: BrowserPsdImportPreflightLayerTreeEvidenceInput;
  readonly featureSupportEvidence?: readonly BrowserPsdImportPreflightFeatureSupportEvidenceInput[];
  readonly sourceGroups?: readonly {
    readonly featureSupportEvidence?: readonly BrowserPsdImportPreflightFeatureSupportEvidenceInput[];
  }[];
  readonly sourceLayers?: readonly {
    readonly featureSupportEvidence?: readonly BrowserPsdImportPreflightFeatureSupportEvidenceInput[];
  }[];
  readonly materializationEvidence?: readonly BrowserPsdImportPreflightMaterializationEvidenceInput[];
  readonly diagnostics?: readonly BrowserPsdImportPreflightDiagnosticInput[];
}

export interface BrowserPsdImportPreflightEvidenceInput {
  readonly status: BrowserPsdImportPreflightStatus;
  readonly failureKind?: BrowserPsdImportPreflightFailureKind;
  readonly source: BrowserPsdImportPreflightSourceEvidenceInput;
  readonly parser?: BrowserPsdImportPreflightParserEvidenceInput;
  readonly layerTreeEvidence?: BrowserPsdImportPreflightLayerTreeEvidenceInput;
  readonly featureSupportEvidence?: readonly BrowserPsdImportPreflightFeatureSupportEvidenceInput[];
  readonly materializationEvidence?: readonly BrowserPsdImportPreflightMaterializationEvidenceInput[];
  readonly selectedMaterialization?: BrowserPsdImportPreflightSelectedMaterializationInput;
  readonly byteAvailability?: BrowserPsdImportPreflightByteAvailabilityInput;
  readonly diagnostics?: readonly BrowserPsdImportPreflightDiagnosticInput[];
  readonly errorEvidence?: readonly BrowserPsdImportPreflightErrorEvidenceInput[];
  readonly adapterResult?: BrowserPsdImportPreflightAdapterResultInput;
}

export interface BrowserPsdImportPreflightValidationReportInput {
  readonly reportId?: string;
  readonly createdAt?: string;
  readonly packageId: PackageId | string;
  readonly packageRevision: number;
  readonly packageHash?: string;
  readonly validatorVersion?: string;
  readonly profile?: ValidationProfile | string;
  readonly psdImportEvidence: readonly BrowserPsdImportPreflightEvidenceInput[];
}

export const buildBrowserPsdImportPreflightValidationReport = (
  input: BrowserPsdImportPreflightValidationReportInput
): ValidationReportDto =>
  buildValidationReport({
    ...(input.reportId === undefined ? {} : { reportId: input.reportId }),
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
    packageId: input.packageId,
    packageRevision: input.packageRevision,
    ...(input.packageHash === undefined ? {} : { packageHash: input.packageHash }),
    ...(input.validatorVersion === undefined ? {} : { validatorVersion: input.validatorVersion }),
    ...(input.profile === undefined ? {} : { profile: input.profile }),
    relatedScenarios: ["SC-IN-003", "SC-VERIFY-001"],
    checks: input.psdImportEvidence.flatMap((evidence, evidenceIndex) =>
      createBrowserPsdImportPreflightChecks(evidence, evidenceIndex)
    )
  });

export const createBrowserPsdImportPreflightChecks = (
  input: BrowserPsdImportPreflightEvidenceInput,
  evidenceIndex = 0
): readonly ValidationCheckResultDto[] => [
  ...createByteAvailabilityChecks(input, evidenceIndex),
  ...(input.status === "parsed"
    ? createParsedImportChecks(input, evidenceIndex)
    : [createFailureAdapterDiagnosticCheck(input, evidenceIndex)])
];

const createParsedImportChecks = (
  input: BrowserPsdImportPreflightEvidenceInput,
  evidenceIndex: number
): readonly ValidationCheckResultDto[] => {
  const parser = input.parser ?? input.adapterResult?.parser;
  const layerTreeEvidence = input.layerTreeEvidence ?? input.adapterResult?.layerTreeEvidence;
  const featureSupportEvidence = collectFeatureSupportEvidence(input);
  const materializationEvidence = collectMaterializationEvidence(input);

  return [
    ...(parser === undefined
      ? [createParserEvidenceUnavailableCheck(input, evidenceIndex)]
      : [createParserEvidenceCheck(input, evidenceIndex, parser)]),
    ...(layerTreeEvidence === undefined
      ? [createLayerTreeEvidenceMissingCheck(input, evidenceIndex)]
      : [createLayerTreeEvidenceCheck(input, evidenceIndex, layerTreeEvidence)]),
    ...featureSupportEvidence.map((featureEvidence, featureIndex) =>
      createFeatureSupportEvidenceCheck(input, evidenceIndex, featureEvidence, featureIndex)
    ),
    ...materializationEvidence.map((materialization, materializationIndex) =>
      createMaterializationEvidenceCheck(input, evidenceIndex, materialization, materializationIndex)
    ),
    ...(shouldReportSelectedMaterializationMissing(input, materializationEvidence)
      ? [createMaterializationEvidenceMissingCheck(input, evidenceIndex)]
      : [])
  ];
};

const createByteAvailabilityChecks = (
  input: BrowserPsdImportPreflightEvidenceInput,
  evidenceIndex: number
): readonly ValidationCheckResultDto[] => {
  const byteAvailability = input.byteAvailability;
  if (byteAvailability === undefined) {
    return [];
  }

  return [
    ...(byteAvailability.currentSessionBytes === "missing"
      ? [createByteAvailabilityCheck(
        input,
        evidenceIndex,
        "byteAvailability.currentSessionBytes.missing",
        "Browser PSD import evidence has no current-session bytes available."
      )]
      : []),
    ...(byteAvailability.requiresReupload === true
      ? [createByteAvailabilityCheck(
        input,
        evidenceIndex,
        "byteAvailability.requiresReupload",
        "Browser PSD import evidence requires a user reupload before it can be reparsed."
      )]
      : [])
  ];
};

const createByteAvailabilityCheck = (
  input: BrowserPsdImportPreflightEvidenceInput,
  evidenceIndex: number,
  checkId: "byteAvailability.currentSessionBytes.missing" | "byteAvailability.requiresReupload",
  message: string
): ValidationCheckResultDto =>
  createCheck({
    input,
    evidenceIndex,
    checkId,
    status: "fail",
    severity: "error",
    phase: "reference",
    targetPath: createTargetPath(evidenceIndex, "/byteAvailability"),
    message,
    evidence: [
      ...createSourceEvidence(input, evidenceIndex),
      `currentSessionBytes=${input.byteAvailability?.currentSessionBytes ?? "missing"}`,
      `requiresReupload=${input.byteAvailability?.requiresReupload ?? false}`,
      `availabilityReason=${input.byteAvailability?.reason ?? "missing"}`
    ],
    impact:
      "Product Preflight cannot treat a prior browser PSD parse as currently reproducible " +
      "without matching selected bytes or an approved byte-restore path."
  });

const createParserEvidenceCheck = (
  input: BrowserPsdImportPreflightEvidenceInput,
  evidenceIndex: number,
  parser: BrowserPsdImportPreflightParserEvidenceInput
): ValidationCheckResultDto =>
  createCheck({
    input,
    evidenceIndex,
    checkId: "asset.psd.parserEvidence",
    status: "pass",
    severity: "info",
    phase: "source_import",
    targetPath: createTargetPath(evidenceIndex, "/parser"),
    message:
      `Browser PSD import evidence records parser ${parser.parserName}` +
      `${parser.parserVersion === undefined ? "" : `@${parser.parserVersion}`}.`,
    evidence: [
      ...createSourceEvidence(input, evidenceIndex),
      "parserEvidenceKind=psd-parser-evidence-v1",
      `parserName=${parser.parserName}`,
      `parserPackageName=${parser.parserPackageName ?? "missing"}`,
      `parserVersion=${parser.parserVersion ?? "missing"}`,
      `adapterName=${parser.adapterName ?? "missing"}`,
      `adapterVersion=${parser.adapterVersion ?? "missing"}`,
      `parserRuntime=${parser.runtime ?? "unknown"}`,
      `privateShapePolicy=${parser.privateShapePolicy ?? "parser-private-shape-excluded-v1"}`
    ],
    impact:
      "The validator records browser parser provenance only; it does not import or execute the PSD parser."
  });

const createParserEvidenceUnavailableCheck = (
  input: BrowserPsdImportPreflightEvidenceInput,
  evidenceIndex: number
): ValidationCheckResultDto =>
  createCheck({
    input,
    evidenceIndex,
    checkId: "asset.psd.parserEvidenceUnavailable",
    status: "fail",
    severity: "error",
    phase: "source_import",
    targetPath: createTargetPath(evidenceIndex, "/parser"),
    message: "Browser PSD import evidence is parsed but has no parser provenance evidence.",
    evidence: [
      ...createSourceEvidence(input, evidenceIndex),
      "reason=browser-psd-import-missing-parser-evidence"
    ],
    impact:
      "The validator cannot trust parsed PSD metadata without parser-free provenance evidence."
  });

const createLayerTreeEvidenceCheck = (
  input: BrowserPsdImportPreflightEvidenceInput,
  evidenceIndex: number,
  layerTreeEvidence: BrowserPsdImportPreflightLayerTreeEvidenceInput
): ValidationCheckResultDto =>
  createCheck({
    input,
    evidenceIndex,
    checkId: "asset.psd.layerTreeEvidence",
    status: "pass",
    severity: "info",
    phase: "source_import",
    targetPath: createTargetPath(evidenceIndex, "/layerTreeEvidence"),
    message:
      `Browser PSD layer tree evidence ${layerTreeEvidence.evidenceId} records ` +
      `${layerTreeEvidence.groupCount} group(s) and ${layerTreeEvidence.layerCount} layer(s).`,
    evidence: [
      ...createSourceEvidence(input, evidenceIndex),
      "layerTreeEvidenceKind=psd-layer-tree-evidence-v1",
      `layerTreeEvidenceId=${layerTreeEvidence.evidenceId}`,
      `layerTreeIntakeKind=${layerTreeEvidence.intakeKind}`,
      `groupCount=${layerTreeEvidence.groupCount}`,
      `layerCount=${layerTreeEvidence.layerCount}`,
      `maxDepth=${layerTreeEvidence.maxDepth ?? "missing"}`,
      `parserEvidencePresent=${layerTreeEvidence.parser !== undefined}`,
      `privateShapePolicy=${layerTreeEvidence.privateShapePolicy ?? "parser-private-shape-excluded-v1"}`
    ],
    impact:
      "The validator records parser-derived PSD layer tree metadata only; no full compositing or pixel correctness is claimed."
  });

const createLayerTreeEvidenceMissingCheck = (
  input: BrowserPsdImportPreflightEvidenceInput,
  evidenceIndex: number
): ValidationCheckResultDto =>
  createCheck({
    input,
    evidenceIndex,
    checkId: "asset.psd.layerTreeEvidenceMissing",
    status: "fail",
    severity: "error",
    phase: "source_import",
    targetPath: createTargetPath(evidenceIndex, "/layerTreeEvidence"),
    message: "Browser PSD import parsed, but parser-free layer tree evidence is missing.",
    evidence: [
      ...createSourceEvidence(input, evidenceIndex),
      "reason=browser-psd-import-missing-layer-tree-evidence"
    ],
    impact:
      "Product Preflight cannot expose a trustworthy PSD layer tree without parser-free layer tree evidence."
  });

const createFeatureSupportEvidenceCheck = (
  input: BrowserPsdImportPreflightEvidenceInput,
  evidenceIndex: number,
  featureEvidence: BrowserPsdImportPreflightFeatureSupportEvidenceInput,
  featureIndex: number
): ValidationCheckResultDto => {
  const unsupported = featureEvidence.status === "unsupported";
  const severity = featureEvidence.severity ?? "warning";

  return createCheck({
    input,
    evidenceIndex,
    checkId: unsupported ? "asset.psd.featureUnsupported" : "asset.psd.featureNotEvaluated",
    status: unsupported ? "not_applicable" : statusForPsdSeverity(severity),
    severity,
    phase: "source_import",
    targetPath: createTargetPath(evidenceIndex, `/featureSupportEvidence/${featureIndex}`),
    message:
      `Browser PSD import evidence records ${featureEvidence.featureId} as ` +
      `${featureEvidence.status}: ${featureEvidence.message}`,
    evidence: [
      ...createSourceEvidence(input, evidenceIndex),
      "featureSupportEvidenceKind=psd-feature-support-evidence-v1",
      `featureId=${featureEvidence.featureId}`,
      `featureStatus=${featureEvidence.status}`,
      `featureScope=${featureEvidence.scope ?? "unknown"}`,
      `featureSeverity=${severity}`,
      `featureIndex=${featureIndex}`,
      ...(featureEvidence.evidenceRefs ?? []).map((evidenceRef, evidenceRefIndex) =>
        `featureEvidenceRef[${evidenceRefIndex}]=${evidenceRef}`
      )
    ],
    impact: unsupported
      ? "The browser PSD import evidence keeps this Photoshop feature outside implemented scope."
      : "The browser PSD import evidence marks this Photoshop feature as not evaluated; support must not be inferred."
  });
};

const createMaterializationEvidenceCheck = (
  input: BrowserPsdImportPreflightEvidenceInput,
  evidenceIndex: number,
  materialization: BrowserPsdImportPreflightMaterializationEvidenceInput,
  materializationIndex: number
): ValidationCheckResultDto =>
  createCheck({
    input,
    evidenceIndex,
    checkId: "asset.psd.materializationEvidence",
    status: "pass",
    severity: "info",
    phase: "source_import",
    targetPath: createTargetPath(evidenceIndex, `/materializationEvidence/${materializationIndex}`),
    message:
      `Browser PSD import evidence records selected layer materialization ` +
      `${materialization.materializationId}.`,
    evidence: [
      ...createSourceEvidence(input, evidenceIndex),
      "materializationEvidenceKind=psd-layer-materialization-evidence-v1",
      `materializationId=${materialization.materializationId}`,
      `sourceLayerAssetId=${materialization.sourceLayerRef.sourceAssetId}`,
      `sourceLayerId=${materialization.sourceLayerRef.sourceLayerId}`,
      `sourceLayerPath=${materialization.sourceLayerRef.sourceLayerPath?.join("/") ?? "missing"}`,
      `mediaType=${materialization.mediaType}`,
      `byteLength=${materialization.byteLength}`,
      `digest=${materialization.digest.algorithm}:${materialization.digest.hex}`,
      `textureId=${materialization.textureId ?? "missing"}`,
      "rawMaterializedBytes=notPersisted",
      "publicDistribution=notClaimed"
    ],
    impact:
      "The validator records selected materialization digest metadata only; it does not validate rendered pixels."
  });

const createMaterializationEvidenceMissingCheck = (
  input: BrowserPsdImportPreflightEvidenceInput,
  evidenceIndex: number
): ValidationCheckResultDto =>
  createCheck({
    input,
    evidenceIndex,
    checkId: "asset.psd.materializationEvidenceMissing",
    status: "needs_review",
    severity: "warning",
    phase: "source_import",
    targetPath: createTargetPath(evidenceIndex, "/materializationEvidence"),
    message: "Browser PSD import evidence has no selected layer materialization evidence.",
    evidence: [
      ...createSourceEvidence(input, evidenceIndex),
      `selectedMaterializationStatus=${input.selectedMaterialization?.status ?? "missing"}`,
      `selectedLayerId=${input.selectedMaterialization?.sourceLayerId ?? "missing"}`,
      `reason=${input.selectedMaterialization?.reason ?? "missing-selected-materialization-evidence"}`,
      `materializationFailureEvidencePresent=${hasMaterializationFailureEvidence(input)}`,
      ...collectErrorEvidence(input)
    ],
    impact:
      "Product Preflight cannot claim selected layer materialization availability without digest evidence."
  });

const createFailureAdapterDiagnosticCheck = (
  input: BrowserPsdImportPreflightEvidenceInput,
  evidenceIndex: number
): ValidationCheckResultDto => {
  const failureKind = resolveFailureKind(input);
  const adapterDiagnostic = selectRelevantAdapterDiagnostic(input, failureKind);

  return createCheck({
    input,
    evidenceIndex,
    checkId: "asset.psd.adapterDiagnostic",
    status: "fail",
    severity: "error",
    phase: "source_import",
    targetPath: createTargetPath(evidenceIndex, "/diagnostics"),
    message: adapterDiagnostic?.message ?? createFailureMessage(input.status, failureKind),
    evidence: [
      ...createSourceEvidence(input, evidenceIndex),
      `failureKind=${failureKind}`,
      `adapterCheckId=${adapterDiagnostic?.checkId ?? adapterCheckIdForFailureKind(failureKind)}`,
      `adapterSeverity=${adapterDiagnostic?.severity ?? "error"}`,
      ...collectErrorEvidence(input),
      ...(adapterDiagnostic?.evidence ?? [])
    ],
    impact:
      "Product Preflight cannot treat this browser PSD import as parsed until the user supplies supported bytes and the parser bridge succeeds."
  });
};

const createCheck = (input: {
  readonly input: BrowserPsdImportPreflightEvidenceInput;
  readonly evidenceIndex: number;
  readonly checkId: string;
  readonly status: CheckStatus;
  readonly severity: Severity;
  readonly phase: "source_import" | "reference";
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
      id: input.input.source.sourceAssetId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: input.message,
    evidence: [
      ...input.evidence,
      "validatorBoundary=no-parser-execution",
      "photoshopCompositing=notClaimed",
      "rendererPixelOracle=notClaimed",
      "publicDemoAsset=notClaimed"
    ],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-003"],
    impact: input.impact
  });

const collectFeatureSupportEvidence = (
  input: BrowserPsdImportPreflightEvidenceInput
): readonly BrowserPsdImportPreflightFeatureSupportEvidenceInput[] => [
  ...(input.featureSupportEvidence ?? []),
  ...(input.adapterResult?.featureSupportEvidence ?? []),
  ...(input.adapterResult?.sourceGroups ?? []).flatMap((group) => group.featureSupportEvidence ?? []),
  ...(input.adapterResult?.sourceLayers ?? []).flatMap((layer) => layer.featureSupportEvidence ?? [])
];

const collectMaterializationEvidence = (
  input: BrowserPsdImportPreflightEvidenceInput
): readonly BrowserPsdImportPreflightMaterializationEvidenceInput[] => [
  ...(input.materializationEvidence ?? []),
  ...(input.adapterResult?.materializationEvidence ?? [])
];

const shouldReportSelectedMaterializationMissing = (
  input: BrowserPsdImportPreflightEvidenceInput,
  materializationEvidence: readonly BrowserPsdImportPreflightMaterializationEvidenceInput[]
): boolean =>
  hasMaterializationFailureEvidence(input) ||
  input.selectedMaterialization?.status === "missing" ||
  (input.selectedMaterialization?.status === "available" && materializationEvidence.length === 0);

const hasMaterializationFailureEvidence = (
  input: BrowserPsdImportPreflightEvidenceInput
): boolean =>
  input.failureKind === "materializationFailure" ||
  (input.errorEvidence ?? []).some((error) => error.failureKind === "materializationFailure") ||
  [
    ...(input.diagnostics ?? []),
    ...(input.adapterResult?.diagnostics ?? [])
  ].some((diagnostic) => diagnostic.checkId === "browserPsdParser.materialization.failed");

const resolveFailureKind = (
  input: BrowserPsdImportPreflightEvidenceInput
): BrowserPsdImportPreflightFailureKind =>
  input.failureKind ??
  input.errorEvidence?.[0]?.failureKind ??
  (input.status === "rejected" ? "sizeLimitExceeded" : "parserFailure");

const selectRelevantAdapterDiagnostic = (
  input: BrowserPsdImportPreflightEvidenceInput,
  failureKind: BrowserPsdImportPreflightFailureKind
): BrowserPsdImportPreflightDiagnosticInput | undefined => {
  const expectedCheckId = adapterCheckIdForFailureKind(failureKind);
  return [
    ...(input.diagnostics ?? []),
    ...(input.adapterResult?.diagnostics ?? [])
  ].find((diagnostic) => diagnostic.checkId === expectedCheckId);
};

const adapterCheckIdForFailureKind = (
  failureKind: BrowserPsdImportPreflightFailureKind
): string => {
  switch (failureKind) {
    case "sizeLimitExceeded":
      return "browserPsdParser.sizeCapExceeded";
    case "materializationFailure":
      return "browserPsdParser.materialization.failed";
    case "parserFailure":
      return "browserPsdParser.parse.failed";
  }
};

const createFailureMessage = (
  status: BrowserPsdImportPreflightStatus,
  failureKind: BrowserPsdImportPreflightFailureKind
): string => {
  if (failureKind === "sizeLimitExceeded") {
    return "Browser PSD import was rejected because selected bytes exceeded the parser size cap.";
  }
  if (failureKind === "materializationFailure") {
    return "Browser PSD import parsed but selected layer materialization failed.";
  }

  return status === "failed"
    ? "Browser PSD parser bridge failed to parse selected PSD bytes."
    : "Browser PSD parser bridge rejected selected PSD bytes.";
};

const collectErrorEvidence = (
  input: BrowserPsdImportPreflightEvidenceInput
): readonly string[] =>
  (input.errorEvidence ?? []).flatMap((error, errorIndex) => [
    `errorEvidence[${errorIndex}].failureKind=${error.failureKind}`,
    `errorEvidence[${errorIndex}].severity=${error.severity ?? "error"}`,
    `errorEvidence[${errorIndex}].message=${error.message}`,
    `errorEvidence[${errorIndex}].errorId=${error.errorId ?? "missing"}`
  ]);

const createSourceEvidence = (
  input: BrowserPsdImportPreflightEvidenceInput,
  evidenceIndex: number
): readonly string[] => [
  "browserPsdImportEvidence=explicitSelection",
  `browserPsdImportEvidenceIndex=${evidenceIndex}`,
  `sourceAssetId=${input.source.sourceAssetId}`,
  `sourceFileName=${input.source.fileName}`,
  `intakeKind=${input.source.intakeKind ?? "missing"}`,
  `declaredMediaType=${input.source.declaredMediaType ?? "missing"}`,
  `byteLength=${input.source.byteLength}`,
  `sizeCapBytes=${input.source.sizeCapBytes}`,
  `importStatus=${input.status}`
];

const createTargetPath = (
  evidenceIndex: number,
  suffix: string
): string => `/browserPsdImportEvidence/${evidenceIndex}${suffix}`;

const statusForPsdSeverity = (
  severity: Exclude<Severity, "blocking">
): CheckStatus => severity === "error" ? "fail" : severity === "warning" ? "needs_review" : "pass";
