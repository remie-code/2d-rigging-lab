import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  ProductPreflightReportDtoSchema,
  PackageIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  PackageId,
  ProductPreflightActionIdDto,
  ProductPreflightArtifactKindDto,
  ProductPreflightBlockingReasonCodeDto,
  ProductPreflightBlockingReasonDto,
  ProductPreflightCategoryDto,
  ProductPreflightCategoryResultDto,
  ProductPreflightDiagnosticRefDto,
  ProductPreflightEvidenceRefDto,
  ProductPreflightReportDto,
  ProductPreflightReportIdDto,
  ProductPreflightRecommendedActionDto,
  ProductPreflightStatusCountsDto,
  ProductPreflightStatusDto,
  ProductPreflightUnsupportedClaimDto,
  ProductPreflightNotEvaluatedClaimDto,
  Severity
} from "@private-2d-rigging-lab/contracts";

import { VALIDATOR_CORE_VERSION } from "./report-builder.js";
import type {
  ValidationCheckResultDto,
  ValidationReportDto
} from "./validation-report.js";

export type ProductPreflightCategoryEvidenceRefsInput = Partial<{
  readonly [TCategory in ProductPreflightCategoryDto]: readonly ProductPreflightEvidenceRefDto[];
}>;

export interface ProductPreflightReportBuildInput {
  readonly reportId?: ProductPreflightReportIdDto | string;
  readonly createdAt?: string;
  readonly packageId?: PackageId | string;
  readonly packageRevision?: number;
  readonly packageHash?: string;
  readonly validatorVersion?: string;
  readonly validationReports?: readonly ValidationReportDto[];
  readonly categoryEvidenceRefs?: ProductPreflightCategoryEvidenceRefsInput;
}

interface SourceDiagnostic {
  readonly report: ValidationReportDto;
  readonly diagnosticIndex: number;
  readonly check: ValidationCheckResultDto;
  readonly diagnosticRef: ProductPreflightDiagnosticRefDto;
  readonly category: ProductPreflightCategoryDto;
}

interface ProductPreflightBuildContext {
  readonly packageId: PackageId;
  readonly validationReports: readonly ValidationReportDto[];
  readonly diagnostics: readonly SourceDiagnostic[];
  readonly categoryEvidenceRefs: ProductPreflightCategoryEvidenceRefsInput;
}

const SEVERITY_ORDER: readonly Severity[] = ["info", "warning", "error", "blocking"];
const PRODUCT_PREFLIGHT_PACKAGE_HASH_PATTERN = /^[A-Za-z0-9_-]+$/;

const VALIDATION_REPORT_EVALUATED_CATEGORIES = new Set<ProductPreflightCategoryDto>([
  "modelStructure",
  "meshTopologyUv",
  "composition",
  "rigControlDynamics"
]);

const TUTORIAL_RELATED_SCENARIO_IDS = new Set([
  "SC-MVP-003",
  "SC-MVP-004",
  "SC-MVP-006"
]);

const REQUIRED_EVIDENCE_KINDS: Readonly<Record<ProductPreflightCategoryDto, readonly ProductPreflightArtifactKindDto[]>> = {
  modelStructure: ["packageManifest", "modelGraph", "validationReport"],
  authoringWorkflowEvidence: ["operationLog", "guiEvidence"],
  runtimeViewerEvidence: ["runtimeSnapshot"],
  meshTopologyUv: ["validationReport"],
  composition: ["validationReport"],
  rigControlDynamics: ["validationReport"],
  assetBytes: ["byteAvailability", "sourceMaterialization"],
  persistenceTransport: ["transportCapability"],
  tutorialDemoReadiness: ["tutorialReadiness"],
  unsupportedClaims: ["validationReport"]
};

const CATEGORY_LABELS: Readonly<Record<ProductPreflightCategoryDto, string>> = {
  modelStructure: "Model structure",
  authoringWorkflowEvidence: "Authoring workflow evidence",
  runtimeViewerEvidence: "Runtime/viewer evidence",
  meshTopologyUv: "Mesh topology and UV evidence",
  composition: "Composition evidence",
  rigControlDynamics: "Rig-control and dynamics evidence",
  assetBytes: "Asset byte evidence",
  persistenceTransport: "Persistence and transport evidence",
  tutorialDemoReadiness: "Tutorial/demo readiness",
  unsupportedClaims: "Unsupported product claims"
};

export const buildProductPreflightReport = (
  input: ProductPreflightReportBuildInput
): ProductPreflightReportDto => {
  const validationReports = input.validationReports ?? [];
  const primaryReport = validationReports[0];
  const packageId = PackageIdSchema.parse(
    input.packageId ?? primaryReport?.packageId ?? "pkg_productPreflight"
  );
  const packageRevision = input.packageRevision ?? primaryReport?.packageRevision ?? 0;
  const packageHash = parseProductPreflightPackageHash(
    input.packageHash ?? primaryReport?.packageHash
  );
  const context: ProductPreflightBuildContext = {
    packageId,
    validationReports,
    diagnostics: collectSourceDiagnostics(validationReports),
    categoryEvidenceRefs: input.categoryEvidenceRefs ?? {}
  };
  const categories = PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.map((category) =>
    buildCategoryResult(category, context)
  );
  const recommendedNextActions = dedupeActions(
    categories.flatMap((category) => category.recommendedNextActions)
  );

  return ProductPreflightReportDtoSchema.parse({
    schemaVersion: "product-preflight-report-v0",
    reportId: input.reportId ?? createProductPreflightReportId(packageId),
    createdAt: input.createdAt ?? new Date().toISOString(),
    packageId,
    packageRevision,
    ...(packageHash === undefined ? {} : { packageHash }),
    validatorVersion: input.validatorVersion ?? VALIDATOR_CORE_VERSION,
    sourceValidationReportIds: validationReports.map((report) => report.reportId),
    summary: createProductSummary(categories),
    categories,
    recommendedNextActions
  });
};

const collectSourceDiagnostics = (
  validationReports: readonly ValidationReportDto[]
): readonly SourceDiagnostic[] =>
  validationReports.flatMap((report) =>
    report.checks.map((check, diagnosticIndex) => ({
      report,
      diagnosticIndex,
      check,
      diagnosticRef: createDiagnosticRef(report, check, diagnosticIndex),
      category: mapDiagnosticToCategory(check)
    }))
  );

const buildCategoryResult = (
  category: ProductPreflightCategoryDto,
  context: ProductPreflightBuildContext
): ProductPreflightCategoryResultDto => {
  const diagnostics = context.diagnostics.filter((diagnostic) => diagnostic.category === category);
  const evidenceRefs = collectCategoryEvidenceRefs(category, context, diagnostics);
  const failingDiagnostics = diagnostics.filter((diagnostic) => isFailingDiagnostic(diagnostic.check));
  if (failingDiagnostics.length > 0) {
    return createFailCategory(category, failingDiagnostics, diagnostics, evidenceRefs);
  }

  const unsupportedDiagnostics = diagnostics.filter((diagnostic) =>
    isTruthfullyUnsupportedDiagnostic(diagnostic.check)
  );
  if (unsupportedDiagnostics.length > 0) {
    return createUnsupportedCategory(category, unsupportedDiagnostics, diagnostics, evidenceRefs);
  }

  const notEvaluatedDiagnostics = diagnostics.filter((diagnostic) =>
    isTruthfullyNotEvaluatedDiagnostic(diagnostic.check)
  );
  if (notEvaluatedDiagnostics.length > 0) {
    return createDiagnosticNotEvaluatedCategory(
      category,
      notEvaluatedDiagnostics,
      diagnostics,
      evidenceRefs
    );
  }

  if (!isCategoryEvaluated(category, context, diagnostics, evidenceRefs)) {
    return createNotEvaluatedCategory(category, evidenceRefs);
  }

  const warningDiagnostics = diagnostics.filter((diagnostic) => isWarningDiagnostic(diagnostic.check));
  if (warningDiagnostics.length > 0) {
    return createWarnCategory(category, warningDiagnostics, evidenceRefs);
  }

  return {
    category,
    status: "pass",
    severity: "info",
    summary: `${CATEGORY_LABELS[category]} has no blocking or warning diagnostics in supplied validator evidence.`,
    evidenceRefs: [...evidenceRefs],
    diagnosticRefs: [],
    blockingReasons: [],
    unsupportedClaims: [],
    notEvaluatedClaims: [],
    recommendedNextActions: []
  };
};

const createFailCategory = (
  category: ProductPreflightCategoryDto,
  failingDiagnostics: readonly SourceDiagnostic[],
  allDiagnostics: readonly SourceDiagnostic[],
  evidenceRefs: readonly ProductPreflightEvidenceRefDto[]
): ProductPreflightCategoryResultDto => {
  const blockingReasons = failingDiagnostics.map((diagnostic, index) =>
    createBlockingReason(category, diagnostic, index)
  );
  const nonFailingDiagnosticRefs = allDiagnostics
    .filter((diagnostic) => !isFailingDiagnostic(diagnostic.check))
    .map((diagnostic) => diagnostic.diagnosticRef);

  return {
    category,
    status: "fail",
    severity: deriveHighestSeverity([
      ...failingDiagnostics.map((diagnostic) => diagnostic.check.severity),
      ...blockingReasons.map((reason) => reason.severity),
      ...nonFailingDiagnosticRefs.flatMap((diagnosticRef) =>
        diagnosticRef.severity === undefined ? [] : [diagnosticRef.severity]
      )
    ]),
    summary: `${CATEGORY_LABELS[category]} has ${failingDiagnostics.length} failing diagnostic(s).`,
    evidenceRefs: [...evidenceRefs],
    diagnosticRefs: nonFailingDiagnosticRefs,
    blockingReasons,
    unsupportedClaims: [],
    notEvaluatedClaims: [],
    recommendedNextActions: dedupeActions([
      ...blockingReasons.flatMap((reason) => reason.recommendedNextActions),
      ...nonFailingDiagnosticRefs.map((diagnosticRef, index) =>
        createInspectDiagnosticAction(category, diagnosticRef, index)
      )
    ])
  };
};

const createWarnCategory = (
  category: ProductPreflightCategoryDto,
  warningDiagnostics: readonly SourceDiagnostic[],
  evidenceRefs: readonly ProductPreflightEvidenceRefDto[]
): ProductPreflightCategoryResultDto => {
  const diagnosticRefs = warningDiagnostics.map((diagnostic) => diagnostic.diagnosticRef);

  return {
    category,
    status: "warn",
    severity: "warning",
    summary: `${CATEGORY_LABELS[category]} has ${warningDiagnostics.length} warning diagnostic(s).`,
    evidenceRefs: [...evidenceRefs],
    diagnosticRefs,
    blockingReasons: [],
    unsupportedClaims: [],
    notEvaluatedClaims: [],
    recommendedNextActions: dedupeActions(
      diagnosticRefs.map((diagnosticRef, index) =>
        createInspectDiagnosticAction(category, diagnosticRef, index)
      )
    )
  };
};

const createUnsupportedCategory = (
  category: ProductPreflightCategoryDto,
  unsupportedDiagnostics: readonly SourceDiagnostic[],
  allDiagnostics: readonly SourceDiagnostic[],
  evidenceRefs: readonly ProductPreflightEvidenceRefDto[]
): ProductPreflightCategoryResultDto => {
  const unsupportedClaims = unsupportedDiagnostics.map((diagnostic, index) =>
    createUnsupportedClaim(category, diagnostic, index)
  );
  const diagnosticRefs = allDiagnostics
    .filter((diagnostic) => !isTruthfullyUnsupportedDiagnostic(diagnostic.check))
    .map((diagnostic) => diagnostic.diagnosticRef);

  return {
    category,
    status: "not_supported",
    severity: "warning",
    summary: `${CATEGORY_LABELS[category]} has ${unsupportedClaims.length} unsupported capability claim(s) recorded by validator diagnostics.`,
    evidenceRefs: [...evidenceRefs],
    diagnosticRefs,
    blockingReasons: [],
    unsupportedClaims,
    notEvaluatedClaims: [],
    recommendedNextActions: dedupeActions([
      ...unsupportedClaims.flatMap((claim) => claim.recommendedNextActions),
      ...diagnosticRefs.map((diagnosticRef, index) =>
        createInspectDiagnosticAction(category, diagnosticRef, index)
      )
    ])
  };
};

const createDiagnosticNotEvaluatedCategory = (
  category: ProductPreflightCategoryDto,
  notEvaluatedDiagnostics: readonly SourceDiagnostic[],
  allDiagnostics: readonly SourceDiagnostic[],
  evidenceRefs: readonly ProductPreflightEvidenceRefDto[]
): ProductPreflightCategoryResultDto => {
  const notEvaluatedClaims = notEvaluatedDiagnostics.map((diagnostic, index) =>
    createDiagnosticNotEvaluatedClaim(category, diagnostic, index)
  );
  const diagnosticRefs = allDiagnostics
    .filter((diagnostic) => !isTruthfullyNotEvaluatedDiagnostic(diagnostic.check))
    .map((diagnostic) => diagnostic.diagnosticRef);

  return {
    category,
    status: "not_evaluated",
    severity: "warning",
    summary: `${CATEGORY_LABELS[category]} has ${notEvaluatedClaims.length} not-evaluated diagnostic claim(s).`,
    evidenceRefs: [...evidenceRefs],
    diagnosticRefs,
    blockingReasons: [],
    unsupportedClaims: [],
    notEvaluatedClaims,
    recommendedNextActions: dedupeActions([
      ...notEvaluatedClaims.flatMap((claim) => claim.recommendedNextActions),
      ...diagnosticRefs.map((diagnosticRef, index) =>
        createInspectDiagnosticAction(category, diagnosticRef, index)
      )
    ])
  };
};

const createNotEvaluatedCategory = (
  category: ProductPreflightCategoryDto,
  evidenceRefs: readonly ProductPreflightEvidenceRefDto[]
): ProductPreflightCategoryResultDto => {
  const notEvaluatedClaim = createNotEvaluatedClaim(category);

  return {
    category,
    status: "not_evaluated",
    severity: "warning",
    summary: `${CATEGORY_LABELS[category]} was not evaluated because required evidence is missing.`,
    evidenceRefs: [...evidenceRefs],
    diagnosticRefs: [],
    blockingReasons: [],
    unsupportedClaims: [],
    notEvaluatedClaims: [notEvaluatedClaim],
    recommendedNextActions: [...notEvaluatedClaim.recommendedNextActions]
  };
};

const createBlockingReason = (
  category: ProductPreflightCategoryDto,
  diagnostic: SourceDiagnostic,
  index: number
): ProductPreflightBlockingReasonDto => ({
  reasonId: `block_${sanitizeToken(category)}_${index}`,
  reasonCode: mapBlockingReasonCode(diagnostic.check),
  severity: diagnostic.check.severity === "blocking" ? "blocking" : "error",
  message: diagnostic.check.message,
  evidenceRefs: [],
  diagnosticRefs: [diagnostic.diagnosticRef],
  recommendedNextActions: [
    createInspectDiagnosticAction(category, diagnostic.diagnosticRef, index)
  ]
});

const createUnsupportedClaim = (
  category: ProductPreflightCategoryDto,
  diagnostic: SourceDiagnostic,
  index: number
): ProductPreflightUnsupportedClaimDto => ({
  claimId: `claim_${sanitizeToken(diagnostic.check.checkId)}_${diagnostic.diagnosticIndex}`,
  status: "not_supported",
  claimKind: "otherUnsupportedCapability",
  capabilityLabel: createUnsupportedCapabilityLabel(diagnostic.check),
  explanation: diagnostic.check.message,
  severity: "warning",
  evidenceRefs: [],
  diagnosticRefs: [diagnostic.diagnosticRef],
  recommendedNextActions: [
    {
      actionId: `action_${sanitizeToken(category)}_recordUnsupported_${index}`,
      actionKind: "recordUnsupportedBoundary",
      summary: "Keep this validator-recorded unsupported boundary explicit in product preflight output.",
      targetCategory: category
    }
  ]
});

const createDiagnosticNotEvaluatedClaim = (
  category: ProductPreflightCategoryDto,
  diagnostic: SourceDiagnostic,
  index: number
): ProductPreflightNotEvaluatedClaimDto => {
  const evidenceKind = evidenceKindForNotEvaluatedDiagnostic(diagnostic.check.checkId);

  return {
    claimId: `claim_${sanitizeToken(diagnostic.check.checkId)}_${diagnostic.diagnosticIndex}`,
    status: "not_evaluated",
    category,
    evidenceKind,
    reason: diagnostic.check.message,
    severity: diagnostic.check.severity === "info" ? "warning" : diagnostic.check.severity,
    requiredEvidenceKinds: [evidenceKind],
    evidenceRefs: [],
    diagnosticRefs: [diagnostic.diagnosticRef],
    recommendedNextActions: [
      {
        actionId: `action_${sanitizeToken(category)}_provideNotEvaluatedEvidence_${index}`,
        actionKind: "provideEvidence",
        summary: `Provide evidence for validator diagnostic ${diagnostic.check.checkId} and rerun product preflight.`,
        targetCategory: category
      }
    ]
  };
};

const createNotEvaluatedClaim = (
  category: ProductPreflightCategoryDto
): ProductPreflightNotEvaluatedClaimDto => {
  const requiredEvidenceKinds = REQUIRED_EVIDENCE_KINDS[category];
  const evidenceKind = requiredEvidenceKinds[0] ?? "validationReport";

  return {
    claimId: `claim_${sanitizeToken(category)}_notEvaluated`,
    status: "not_evaluated",
    category,
    evidenceKind,
    reason: `No ${formatEvidenceKindList(requiredEvidenceKinds)} evidence was supplied for ${CATEGORY_LABELS[category]}.`,
    severity: "warning",
    requiredEvidenceKinds: [...requiredEvidenceKinds],
    evidenceRefs: [],
    diagnosticRefs: [],
    recommendedNextActions: [
      {
        actionId: `action_${sanitizeToken(category)}_provideEvidence`,
        actionKind: "provideEvidence",
        summary: `Provide ${formatEvidenceKindList(requiredEvidenceKinds)} evidence and rerun product preflight.`,
        targetCategory: category
      }
    ]
  };
};

const collectCategoryEvidenceRefs = (
  category: ProductPreflightCategoryDto,
  context: ProductPreflightBuildContext,
  diagnostics: readonly SourceDiagnostic[]
): ProductPreflightEvidenceRefDto[] => {
  const explicitEvidenceRefs = context.categoryEvidenceRefs[category] ?? [];
  const reportEvidenceRefs = shouldAttachValidationReportEvidence(category, context, diagnostics)
    ? context.validationReports.map((report) => createValidationReportEvidenceRef(report, category))
    : [];

  return dedupeEvidenceRefs([
    ...explicitEvidenceRefs,
    ...reportEvidenceRefs,
    ...createOperationLogEvidenceRefs(category, context),
    ...createRuntimeSnapshotEvidenceRefs(category, context)
  ]).filter((evidenceRef) => isAllowedCategoryEvidenceRef(category, evidenceRef));
};

const shouldAttachValidationReportEvidence = (
  category: ProductPreflightCategoryDto,
  context: ProductPreflightBuildContext,
  diagnostics: readonly SourceDiagnostic[]
): boolean => {
  if (context.validationReports.length === 0) {
    return false;
  }
  if (diagnostics.length > 0) {
    return true;
  }
  if (VALIDATION_REPORT_EVALUATED_CATEGORIES.has(category)) {
    return true;
  }
  if (category === "tutorialDemoReadiness") {
    return hasTutorialReadinessReport(context.validationReports);
  }
  if (category === "unsupportedClaims") {
    return true;
  }

  return false;
};

const createOperationLogEvidenceRefs = (
  category: ProductPreflightCategoryDto,
  context: ProductPreflightBuildContext
): ProductPreflightEvidenceRefDto[] => {
  if (category !== "authoringWorkflowEvidence") {
    return [];
  }

  return context.validationReports
    .filter((report) => report.evidence.operationLogPresent)
    .map((report) => ({
      evidenceId: `evidence_${sanitizeToken(report.reportId)}_operationLog`,
      artifactRef: {
        artifactKind: "operationLog",
        path: "operations/log.jsonl"
      },
      target: {
        kind: "package",
        id: report.packageId
      },
      summary: `Validation report ${report.reportId} records operation log evidence.`,
      producer: "validatorCore"
    }));
};

const createRuntimeSnapshotEvidenceRefs = (
  category: ProductPreflightCategoryDto,
  context: ProductPreflightBuildContext
): ProductPreflightEvidenceRefDto[] => {
  if (category !== "runtimeViewerEvidence") {
    return [];
  }

  return context.validationReports.flatMap((report) =>
    report.evidence.runtimeSnapshotIds.map((snapshotId) => ({
      evidenceId: `evidence_${sanitizeToken(report.reportId)}_${sanitizeToken(snapshotId)}`,
      artifactRef: {
        artifactKind: "runtimeSnapshot",
        path: `runtime/snapshots/${snapshotId}.runtime-snapshot.json`,
        snapshotId
      },
      target: {
        kind: "runtimeSnapshot",
        id: snapshotId
      },
      summary: `Validation report ${report.reportId} records runtime snapshot ${snapshotId}.`,
      producer: "validatorCore"
    }))
  );
};

const createValidationReportEvidenceRef = (
  report: ValidationReportDto,
  category: ProductPreflightCategoryDto
): ProductPreflightEvidenceRefDto => ({
  evidenceId: `evidence_${sanitizeToken(report.reportId)}_${sanitizeToken(category)}`,
  artifactRef: {
    artifactKind: "validationReport",
    path: `validation/reports/${report.reportId}.validation.json`,
    reportId: report.reportId
  },
  target: {
    kind: "validationReport",
    id: report.reportId
  },
  summary: `Validation report ${report.reportId} contributes ${CATEGORY_LABELS[category]} diagnostics.`,
  producer: "validatorCore"
});

const isCategoryEvaluated = (
  category: ProductPreflightCategoryDto,
  context: ProductPreflightBuildContext,
  diagnostics: readonly SourceDiagnostic[],
  evidenceRefs: readonly ProductPreflightEvidenceRefDto[]
): boolean => {
  if (diagnostics.length > 0 || hasRequiredCategoryEvidence(category, evidenceRefs)) {
    return true;
  }
  if (VALIDATION_REPORT_EVALUATED_CATEGORIES.has(category)) {
    return hasRequiredCategoryEvidence(category, collectCategoryEvidenceRefs(
      category,
      context,
      diagnostics
    ));
  }
  if (category === "unsupportedClaims") {
    return hasRequiredCategoryEvidence(category, collectCategoryEvidenceRefs(
      category,
      context,
      diagnostics
    ));
  }

  return false;
};

const hasRequiredCategoryEvidence = (
  category: ProductPreflightCategoryDto,
  evidenceRefs: readonly ProductPreflightEvidenceRefDto[]
): boolean =>
  evidenceRefs.some((evidenceRef) => isAllowedCategoryEvidenceRef(category, evidenceRef));

const isAllowedCategoryEvidenceRef = (
  category: ProductPreflightCategoryDto,
  evidenceRef: ProductPreflightEvidenceRefDto
): boolean =>
  REQUIRED_EVIDENCE_KINDS[category].includes(evidenceRef.artifactRef.artifactKind);

const hasTutorialReadinessReport = (
  validationReports: readonly ValidationReportDto[]
): boolean =>
  validationReports.some((report) =>
    report.reportId.includes("tutorialReadiness") ||
    report.checks.some((check) => check.checkId.startsWith("tutorial.")) ||
    report.relatedScenarios.some((scenarioId) => TUTORIAL_RELATED_SCENARIO_IDS.has(scenarioId))
  );

const createDiagnosticRef = (
  report: ValidationReportDto,
  check: ValidationCheckResultDto,
  diagnosticIndex: number
): ProductPreflightDiagnosticRefDto => ({
  checkId: check.checkId,
  reportId: report.reportId,
  diagnosticIndex,
  status: check.status,
  severity: check.severity,
  target: check.target,
  message: check.message
});

const mapDiagnosticToCategory = (
  check: ValidationCheckResultDto
): ProductPreflightCategoryDto => {
  const checkId = check.checkId;
  if (
    checkId === "byteIntake.unsupportedClaim" ||
    checkId === "tutorial.unsupportedClaim" ||
    checkId === "demo.unsafeDependencyClaim"
  ) {
    return "unsupportedClaims";
  }
  if (checkId.startsWith("pkg.schema.")) {
    return "modelStructure";
  }
  if (
    checkId.startsWith("binary.") ||
    checkId.startsWith("byteAvailability.") ||
    checkId.startsWith("persistentByteStorage.") ||
    checkId.startsWith("rights.") ||
    checkId.startsWith("asset.")
  ) {
    return "assetBytes";
  }
  if (
    checkId.startsWith("transportCapability.") ||
    checkId.startsWith("portableBundle.")
  ) {
    return "persistenceTransport";
  }
  if (checkId.startsWith("mesh.")) {
    return "meshTopologyUv";
  }
  if (
    checkId.startsWith("mask.") ||
    checkId.startsWith("part.") ||
    checkId.startsWith("ref.") ||
    checkId.startsWith("editorState.")
  ) {
    return "composition";
  }
  if (
    checkId.startsWith("rigControl.") ||
    checkId.startsWith("dynamics.") ||
    checkId.startsWith("keyform.") ||
    checkId.startsWith("runtime.state") ||
    checkId.startsWith("runtime.timestep")
  ) {
    return "rigControlDynamics";
  }
  if (
    checkId.startsWith("viewer.") ||
    checkId.startsWith("runtime.load") ||
    checkId.startsWith("runtime.draw")
  ) {
    return "runtimeViewerEvidence";
  }
  if (checkId.startsWith("evidence.")) {
    return "authoringWorkflowEvidence";
  }
  if (checkId.startsWith("tutorial.") || checkId.startsWith("demo.")) {
    return "tutorialDemoReadiness";
  }

  switch (check.phase) {
    case "package_schema":
      return "modelStructure";
    case "source_import":
      return "assetBytes";
    case "rights":
      return "assetBytes";
    case "reference":
      return "composition";
    case "mesh_semantic":
      return "meshTopologyUv";
    case "mask_resolution":
      return "composition";
    case "rigControl_semantic":
    case "rigControl_evaluation":
    case "dynamics_semantic":
    case "dynamics_evaluation":
    case "runtime_state":
      return "rigControlDynamics";
    case "runtime_load":
    case "representative_evaluation":
      return "runtimeViewerEvidence";
    case "acceptance_evidence":
      return "authoringWorkflowEvidence";
    case "tutorial_readiness":
    case "demo_preflight":
      return "tutorialDemoReadiness";
    default:
      return "modelStructure";
  }
};

const isFailingDiagnostic = (check: ValidationCheckResultDto): boolean =>
  check.status === "fail" ||
  check.severity === "error" ||
  check.severity === "blocking";

const isWarningDiagnostic = (check: ValidationCheckResultDto): boolean =>
  check.status === "warning" ||
  check.status === "needs_review" ||
  check.severity === "warning";

const isTruthfullyUnsupportedDiagnostic = (check: ValidationCheckResultDto): boolean =>
  check.status === "not_applicable" &&
  (
    check.checkId === "byteIntake.unsupportedClaim" ||
    check.checkId === "tutorial.unsupportedClaim" ||
    check.checkId === "asset.psd.featureUnsupported"
  );

const isTruthfullyNotEvaluatedDiagnostic = (check: ValidationCheckResultDto): boolean =>
  check.status === "needs_review" &&
  (
    check.checkId === "asset.psd.featureNotEvaluated" ||
    check.checkId === "asset.psd.materializationEvidenceMissing" ||
    check.checkId === "asset.psd.materializedDestinationMappingMissing" ||
    check.checkId === "asset.psd.materializedBatchEvidenceMissing" ||
    check.checkId === "asset.psd.importPlanEvidenceMissing" ||
    check.checkId === "asset.psd.importPlanSourceCurrentBytesMissing"
  );

const evidenceKindForNotEvaluatedDiagnostic = (
  checkId: string
): ProductPreflightArtifactKindDto =>
  checkId === "asset.psd.materializationEvidenceMissing"
    ? "sourceMaterialization"
    : checkId === "asset.psd.materializedDestinationMappingMissing"
    ? "sourceMaterialization"
    : checkId === "asset.psd.materializedBatchEvidenceMissing"
    ? "sourceMaterialization"
    : checkId === "asset.psd.importPlanEvidenceMissing"
    ? "sourceMaterialization"
    : checkId === "asset.psd.importPlanSourceCurrentBytesMissing"
    ? "sourceMaterialization"
    : "validationReport";

const mapBlockingReasonCode = (
  check: ValidationCheckResultDto
): ProductPreflightBlockingReasonCodeDto => {
  if (check.checkId.includes("schemaInvalid")) {
    return "schemaInvalid";
  }
  if (check.checkId.startsWith("pkg.schema.")) {
    return "invalidPackageData";
  }
  if (check.checkId.startsWith("rights.")) {
    return "rightsOrProvenanceBlocked";
  }
  if (
    check.checkId.includes("EvidenceMissing") ||
    check.checkId.includes("evidenceMissing") ||
    check.checkId.startsWith("evidence.")
  ) {
    return "missingRequiredEvidence";
  }
  if (
    check.checkId.startsWith("transportCapability.unsupported") ||
    check.checkId.includes("futureGated") ||
    check.checkId.includes("dependencyGated")
  ) {
    return "unsupportedRequiredCapability";
  }
  if (
    check.checkId.includes("unsupported") ||
    check.checkId.includes("unsafeDependencyClaim")
  ) {
    return "unsafeUnsupportedClaim";
  }

  return "failingDiagnostic";
};

const createUnsupportedCapabilityLabel = (
  check: ValidationCheckResultDto
): string => {
  const claimEvidence = check.evidence.find((entry) =>
    entry.startsWith("claimKind=") ||
    entry.startsWith("claimId=") ||
    entry.startsWith("capabilityId=")
  );
  if (claimEvidence !== undefined) {
    return claimEvidence.replace("=", ": ");
  }

  return check.checkId;
};

const createInspectDiagnosticAction = (
  category: ProductPreflightCategoryDto,
  diagnosticRef: ProductPreflightDiagnosticRefDto,
  index: number
): ProductPreflightRecommendedActionDto => ({
  actionId: createActionId(category, diagnosticRef.checkId, index),
  actionKind: "inspectDiagnostic",
  summary: `Inspect validator diagnostic ${diagnosticRef.checkId} before rerunning product preflight.`,
  targetCategory: category
});

const createActionId = (
  category: ProductPreflightCategoryDto,
  checkId: string,
  index: number
): ProductPreflightActionIdDto =>
  `action_${sanitizeToken(category)}_${sanitizeToken(checkId)}_${index}`;

const createProductSummary = (
  categories: readonly ProductPreflightCategoryResultDto[]
) => ({
  status: deriveReportStatus(categories),
  highestSeverity: deriveHighestSeverity(categories.map((category) => category.severity)),
  categoryCounts: countCategoryStatuses(categories),
  blockingReasonCount: countBlockingReasons(categories),
  unsupportedClaimCount: countUnsupportedClaims(categories),
  notEvaluatedClaimCount: countNotEvaluatedClaims(categories),
  evidenceRefCount: countEvidenceRefs(categories),
  diagnosticRefCount: countDiagnosticRefs(categories)
});

const deriveReportStatus = (
  categories: readonly ProductPreflightCategoryResultDto[]
): ProductPreflightStatusDto => {
  if (categories.some((category) => category.status === "fail")) {
    return "fail";
  }
  if (categories.some((category) => category.status === "not_supported")) {
    return "not_supported";
  }
  if (categories.some((category) => category.status === "not_evaluated")) {
    return "not_evaluated";
  }
  if (categories.some((category) => category.status === "warn")) {
    return "warn";
  }

  return "pass";
};

const deriveHighestSeverity = (severities: readonly Severity[]): Severity =>
  severities.reduce<Severity>((highest, severity) =>
    SEVERITY_ORDER.indexOf(severity) > SEVERITY_ORDER.indexOf(highest)
      ? severity
      : highest, "info");

const countCategoryStatuses = (
  categories: readonly ProductPreflightCategoryResultDto[]
): ProductPreflightStatusCountsDto => {
  const counts: ProductPreflightStatusCountsDto = {
    pass: 0,
    warn: 0,
    fail: 0,
    not_supported: 0,
    not_evaluated: 0
  };

  for (const category of categories) {
    counts[category.status] += 1;
  }

  return counts;
};

const countBlockingReasons = (
  categories: readonly ProductPreflightCategoryResultDto[]
): number =>
  categories.reduce((total, category) => total + category.blockingReasons.length, 0);

const countUnsupportedClaims = (
  categories: readonly ProductPreflightCategoryResultDto[]
): number =>
  categories.reduce((total, category) => total + category.unsupportedClaims.length, 0);

const countNotEvaluatedClaims = (
  categories: readonly ProductPreflightCategoryResultDto[]
): number =>
  categories.reduce((total, category) => total + category.notEvaluatedClaims.length, 0);

const countEvidenceRefs = (
  categories: readonly ProductPreflightCategoryResultDto[]
): number =>
  categories.reduce((total, category) =>
    total +
    category.evidenceRefs.length +
    category.blockingReasons.reduce(
      (reasonTotal, reason) => reasonTotal + reason.evidenceRefs.length,
      0
    ) +
    category.unsupportedClaims.reduce(
      (claimTotal, claim) => claimTotal + claim.evidenceRefs.length,
      0
    ) +
    category.notEvaluatedClaims.reduce(
      (claimTotal, claim) => claimTotal + claim.evidenceRefs.length,
      0
    ), 0);

const countDiagnosticRefs = (
  categories: readonly ProductPreflightCategoryResultDto[]
): number =>
  categories.reduce((total, category) =>
    total +
    category.diagnosticRefs.length +
    category.blockingReasons.reduce(
      (reasonTotal, reason) => reasonTotal + reason.diagnosticRefs.length,
      0
    ) +
    category.unsupportedClaims.reduce(
      (claimTotal, claim) => claimTotal + claim.diagnosticRefs.length,
      0
    ) +
    category.notEvaluatedClaims.reduce(
      (claimTotal, claim) => claimTotal + claim.diagnosticRefs.length,
      0
    ), 0);

const dedupeEvidenceRefs = (
  evidenceRefs: readonly ProductPreflightEvidenceRefDto[]
): ProductPreflightEvidenceRefDto[] => [
  ...new Map(evidenceRefs.map((evidenceRef) => [evidenceRef.evidenceId, evidenceRef])).values()
];

const dedupeActions = (
  actions: readonly ProductPreflightRecommendedActionDto[]
): ProductPreflightRecommendedActionDto[] => [
  ...new Map(actions.map((action) => [action.actionId, action])).values()
];

const createProductPreflightReportId = (packageId: PackageId): ProductPreflightReportIdDto =>
  `preflight_${sanitizeToken(packageId.replace(/^pkg_/, ""))}`;

const parseProductPreflightPackageHash = (
  packageHash: string | undefined
): string | undefined =>
  packageHash !== undefined && PRODUCT_PREFLIGHT_PACKAGE_HASH_PATTERN.test(packageHash)
    ? packageHash
    : undefined;

const formatEvidenceKindList = (
  evidenceKinds: readonly ProductPreflightArtifactKindDto[]
): string =>
  evidenceKinds.join(" or ");

const sanitizeToken = (value: string): string => {
  const sanitized = value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return sanitized.length > 0 ? sanitized : "item";
};
