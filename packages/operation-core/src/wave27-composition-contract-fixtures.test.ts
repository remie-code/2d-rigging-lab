import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthoringSessionFromPackageDocument,
  toPackageDocument,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MaskRelationIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  ModelDiffDto,
  RuntimeDiffDto,
  RuntimeSnapshotId,
  TargetRefDto,
  ValidationDiffDto,
  ValidationReportId
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  createOperationCore,
  OperationEvidenceResultSchema,
  OperationRequestSchema
} from "./index.js";
import type {
  OperationEvidenceProviderInput,
  OperationEvidenceResultDto,
  OperationResultDto
} from "./index.js";
import {
  buildRuntimeEvidence,
  evaluateViewerRuntimeSnapshot
} from "../../runtime-core/src/index.js";
import type {
  RuntimeEvidenceResult,
  RuntimeSnapshotDto,
  ViewerRuntimeEvaluationResult
} from "../../runtime-core/src/index.js";
import {
  buildValidationDiff,
  validatePackageRuntime,
  ValidationReportSchema
} from "../../validator-core/src/index.js";
import type { ValidationReportDto } from "../../validator-core/src/index.js";

const CREATED_AT = "2026-06-01T00:00:00.000Z";
const PACKAGE_HASH = "sha256:wave27-composition-contract-fixtures-v1";
const MASK_RELATION_ID = "maskrel_wave27_body_clip";
const OPERATION_ID = "op_wave27_set_mask_relation";

describe("wave27-composition-contract-fixtures", () => {
  it("parses setMaskRelation fixture requests through operation-core DTOs", () => {
    const dryRunRequest = OperationRequestSchema.parse(
      loadFixtureJson("request/set-mask-relation-dry-run.request.json")
    );
    const commitRequest = OperationRequestSchema.parse(
      loadFixtureJson("request/set-mask-relation-commit.request.json")
    );

    expect(dryRunRequest).toMatchObject({
      operationType: "setMaskRelation",
      dryRun: true,
      payload: {
        maskRelationId: MASK_RELATION_ID,
        maskDrawableIds: ["draw_wave27_mask"],
        targetDrawableIds: ["draw_wave27_body"],
        enabled: true
      }
    });
    expect(commitRequest).toMatchObject({
      operationType: "setMaskRelation",
      dryRun: false,
      payload: dryRunRequest.payload
    });
  });

  it("pins dry-run operation result evidence without mutating the baseline session", () => {
    const session = createFixtureSession();
    const artifacts: FixtureEvidenceArtifacts[] = [];
    const core = createOperationCore({
      evidenceProvider: (input) => collectFixtureEvidence(input, artifacts)
    });

    const result = core.dryRunOperation(
      session,
      loadFixtureJson("request/set-mask-relation-dry-run.request.json")
    );
    const artifact = expectSingleArtifact(artifacts, "dry_run");

    expect(summarizeOperationResult(result, session, core.operationLog.entries.length)).toEqual(
      loadOperationResultEvidenceSummary().dryRun
    );
    expect(summarizeValidationEvidence(artifact)).toEqual(loadValidationReportSummary().dryRun);
    expect(session.graph.masks).toEqual([]);
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
  });

  it("commits setMaskRelation and fixes package, runtime, validator, and viewer evidence", () => {
    const session = createFixtureSession();
    const artifacts: FixtureEvidenceArtifacts[] = [];
    const core = createOperationCore({
      now: () => new Date(CREATED_AT),
      evidenceProvider: (input) => collectFixtureEvidence(input, artifacts)
    });

    const outcome = core.commitOperation(
      session,
      loadFixtureJson("request/set-mask-relation-commit.request.json")
    );
    const artifact = expectSingleArtifact(artifacts, "commit");
    const viewerResult = evaluateViewerRuntimeSnapshot(toRuntimeGraph(session, { packageHash: PACKAGE_HASH }), {
      baselineFrameIndex: 20,
      frameIndex: 21,
      operationId: OPERATION_ID,
      targetIds: ["draw_wave27_body"]
    });

    expect(summarizeOperationResult(outcome.result, session, outcome.operationLogLength, outcome.logEntry)).toEqual(
      loadOperationResultEvidenceSummary().commit
    );
    expect(summarizePackageMaterialization(artifact.materializedPackage)).toEqual(
      loadPackageMaterializationSummary()
    );
    expect(summarizeRuntimeSnapshots(artifact.runtimeEvidence)).toEqual(
      loadRuntimeSnapshotSummary()
    );
    expect(summarizeRuntimeDiff(outcome.result.runtimeDiff)).toEqual(
      loadRuntimeDiffSummary().runtimeDiff
    );
    expect(summarizeValidationEvidence(artifact)).toEqual(loadValidationReportSummary().commit);
    expect(summarizeViewerEvidence(viewerResult)).toEqual(loadViewerFacingEvidenceSummary());
  });

  it("pins an invalid mask relation validator diagnostic in the same fixture family", () => {
    const invalidReport = pinReportId(
      validatePackageRuntime({
        packageDocument: createInvalidMissingTargetPackage(),
        profile: "strict",
        createdAt: CREATED_AT
      }),
      "val_wave27_composition_invalid_missing_target"
    );

    expect(summarizeInvalidValidationReport(invalidReport)).toEqual(
      loadValidationReportSummary().invalidMissingTarget
    );
  });
});

type PackageDocumentInput = Parameters<typeof createAuthoringSessionFromPackageDocument>[0];

interface FixtureEvidenceArtifacts {
  readonly lifecycle: OperationEvidenceProviderInput["lifecycle"];
  readonly materializedPackage: PackageDocumentInput;
  readonly runtimeEvidence: RuntimeEvidenceResult;
  readonly baselineReport: ValidationReportDto;
  readonly candidateReport: ValidationReportDto;
  readonly validationDiff: ValidationDiffDto;
}

interface OperationResultEvidenceSummaryFixture {
  readonly dryRun: OperationResultEvidenceSummary;
  readonly commit: OperationResultEvidenceSummary & {
    readonly logEntry: {
      readonly runtimeSnapshotIds: readonly RuntimeSnapshotId[];
      readonly validationReportIds: readonly ValidationReportId[];
    };
  };
}

interface OperationResultEvidenceSummary {
  readonly operationId: string;
  readonly status: string;
  readonly preconditionOk: boolean;
  readonly checkedTargets: readonly string[];
  readonly modelDiff: ModelDiffSummary;
  readonly generatedRuntimeSnapshotIds: readonly RuntimeSnapshotId[];
  readonly generatedRuntimeStateRefs: readonly string[];
  readonly generatedRuntimeStateSequenceRefs: readonly string[];
  readonly finalRuntimeStateRef: string;
  readonly generatedValidationReportIds: readonly ValidationReportId[];
  readonly operationLogLength: number;
  readonly packageRevisionAfter: number;
  readonly authoringRevisionAfter: number;
  readonly dirtyAfter: boolean;
}

interface ModelDiffSummary {
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly addedTargets: readonly string[];
  readonly changedTargets: readonly string[];
  readonly changedFields: readonly {
    readonly path: string;
    readonly before: unknown;
    readonly after: unknown;
  }[];
}

interface RuntimeSnapshotSummaryFixture {
  readonly schemaVersion: "wave27-composition-runtime-snapshot-summary-v1";
  readonly baselineSnapshot: SnapshotSummary;
  readonly candidateSnapshot: SnapshotSummary;
  readonly generatedRuntimeSnapshotIds: readonly RuntimeSnapshotId[];
  readonly generatedRuntimeStateRefs: readonly string[];
  readonly generatedRuntimeStateSequenceRefs: readonly string[];
  readonly finalRuntimeState: {
    readonly packageId: string;
    readonly packageRevision: number;
    readonly frameIndex: number;
  };
}

interface SnapshotSummary {
  readonly snapshotId: RuntimeSnapshotId;
  readonly packageId: string;
  readonly packageRevision: number;
  readonly maskRelationEvidence: readonly RuntimeSnapshotDto["masks"][number][];
  readonly drawableOpacityEvidence: readonly DrawableOpacityEvidence[];
  readonly drawList: readonly string[];
}

interface DrawableOpacityEvidence {
  readonly drawableId: string;
  readonly opacity: number;
  readonly visible: boolean;
}

interface RuntimeDiffSummaryFixture {
  readonly runtimeDiff: {
    readonly schemaVersion: "runtime-diff-v1";
    readonly beforeSnapshotId: RuntimeSnapshotId;
    readonly afterSnapshotId: RuntimeSnapshotId;
    readonly maskChanges: readonly RuntimeDiffDto["parameterChanges"][number][];
    readonly parameterChangeCount: number;
    readonly drawableRuntimeStateChangeCount: number;
    readonly diagnosticDeltaCount: number;
  };
}

interface ValidationReportSummaryFixture {
  readonly dryRun: ValidationEvidenceSummary;
  readonly commit: ValidationEvidenceSummary;
  readonly invalidMissingTarget: InvalidValidationSummary;
}

interface ValidationEvidenceSummary {
  readonly baselineReportId: ValidationReportId;
  readonly candidateReportId: ValidationReportId;
  readonly candidateStatus: string;
  readonly candidateHighestSeverity: string;
  readonly candidateCheckIds: readonly string[];
  readonly candidateRuntimeSnapshotIds: readonly RuntimeSnapshotId[];
  readonly validationDiff: ValidationDiffSummary;
}

interface ValidationDiffSummary {
  readonly schemaVersion: "validation-diff-v1";
  readonly beforeReportId: ValidationReportId;
  readonly afterReportId: ValidationReportId;
  readonly newFailureCount: number;
  readonly resolvedFailureCount: number;
  readonly severityChangeCount: number;
}

interface InvalidValidationSummary {
  readonly reportId: ValidationReportId;
  readonly status: string;
  readonly highestSeverity: string;
  readonly checks: readonly {
    readonly checkId: string;
    readonly severity: string;
    readonly targetPath?: string;
    readonly evidence: readonly string[];
  }[];
}

const collectFixtureEvidence = (
  input: OperationEvidenceProviderInput,
  artifacts: FixtureEvidenceArtifacts[]
): OperationEvidenceResultDto => {
  if (input.request.operationType !== "setMaskRelation") {
    throw new Error(`Unsupported fixture operation: ${input.request.operationType}`);
  }

  const materializedPackage = materializePackage(input.candidateSession);
  const runtimeEvidence = buildRuntimeEvidence({
    baselineGraph: toRuntimeGraph(input.baselineSession, { packageHash: PACKAGE_HASH }),
    candidateGraph: toRuntimeGraph(input.candidateSession, { packageHash: PACKAGE_HASH }),
    baseline: {
      frame: {
        frameIndex: 10
      }
    },
    candidate: {
      frame: {
        frameIndex: 11,
        targetIds: [...input.targetIds]
      }
    },
    context: {
      source: { surface: "validator", operationId: input.result.operationId },
      policy: { strictness: "strict" }
    },
    artifactLabel: "wave27-composition"
  });
  const baselineReport = pinReportId(
    validatePackageRuntime({
      packageDocument: loadBaselinePackageDocument(),
      runtimeSnapshot: runtimeEvidence.baselineSnapshot,
      profile: "strict",
      createdAt: CREATED_AT
    }),
    `val_wave27_composition_${input.lifecycle}_baseline`
  );
  const candidateReport = pinReportId(
    validatePackageRuntime({
      packageDocument: materializedPackage,
      runtimeSnapshot: runtimeEvidence.candidateSnapshot,
      profile: "strict",
      createdAt: CREATED_AT
    }),
    `val_wave27_composition_${input.lifecycle}_candidate`
  );
  const validationDiff = buildValidationDiff({
    baseline: baselineReport,
    candidate: candidateReport
  });

  artifacts.push({
    lifecycle: input.lifecycle,
    materializedPackage,
    runtimeEvidence,
    baselineReport,
    candidateReport,
    validationDiff
  });

  return OperationEvidenceResultSchema.parse({
    runtimeDiff: runtimeEvidence.runtimeDiff,
    validationDiff,
    generatedRuntimeSnapshotIds: runtimeEvidence.generatedRuntimeSnapshotIds,
    generatedRuntimeStateRefs: runtimeEvidence.generatedRuntimeStateRefs,
    generatedRuntimeStateSequenceRefs: runtimeEvidence.generatedRuntimeStateSequenceRefs,
    finalRuntimeState: runtimeEvidence.finalRuntimeState,
    finalRuntimeStateRef: runtimeEvidence.finalRuntimeStateRef,
    generatedValidationReportIds: [
      baselineReport.reportId,
      candidateReport.reportId
    ]
  });
};

const summarizeOperationResult = (
  result: OperationResultDto,
  session: AuthoringSession,
  operationLogLength: number,
  logEntry?: { readonly runtimeSnapshotIds: readonly RuntimeSnapshotId[]; readonly validationReportIds: readonly ValidationReportId[] }
): OperationResultEvidenceSummary => ({
  operationId: result.operationId,
  status: result.status,
  preconditionOk: result.precondition.ok,
  checkedTargets: result.precondition.checkedTargetRefs.map(toTargetRefKey),
  modelDiff: summarizeModelDiff(result.modelDiff),
  generatedRuntimeSnapshotIds: result.generatedRuntimeSnapshotIds,
  generatedRuntimeStateRefs: result.generatedRuntimeStateRefs,
  generatedRuntimeStateSequenceRefs: result.generatedRuntimeStateSequenceRefs,
  finalRuntimeStateRef: result.finalRuntimeStateRef ?? "",
  generatedValidationReportIds: result.generatedValidationReportIds,
  operationLogLength,
  packageRevisionAfter: session.packageRevision,
  authoringRevisionAfter: session.authoringRevision,
  dirtyAfter: session.dirty,
  ...(logEntry === undefined
    ? {}
    : {
        logEntry: {
          runtimeSnapshotIds: logEntry.runtimeSnapshotIds,
          validationReportIds: logEntry.validationReportIds
        }
      })
});

const summarizeModelDiff = (modelDiff: ModelDiffDto | undefined): ModelDiffSummary => {
  if (modelDiff === undefined) {
    throw new Error("Expected model diff evidence.");
  }

  return {
    baseRevision: modelDiff.baseRevision,
    candidateRevision: modelDiff.candidateRevision,
    addedTargets: modelDiff.added.map(toTargetRefKey),
    changedTargets: modelDiff.changed.map((change) => toTargetRefKey(change.target)),
    changedFields: modelDiff.changed.flatMap((change) =>
      change.fields.map((field) => ({
        path: field.path,
        before: field.before,
        after: field.after
      }))
    )
  };
};

const summarizePackageMaterialization = (packageDocument: PackageDocumentInput) => {
  const session = createAuthoringSessionFromPackageDocument(packageDocument);

  return {
    schemaVersion: "wave27-composition-package-materialization-summary-v1",
    packageId: packageDocument.manifest.packageId,
    packageRevision: packageDocument.manifest.packageRevision,
    updatedAt: packageDocument.manifest.updatedAt,
    masksFile: packageDocument.model.masks,
    runtimeMasks: toRuntimeGraph(session, { packageHash: PACKAGE_HASH }).masks,
    drawableOpacityDefaults: packageDocument.model.drawables.drawables
      .map((drawable) => ({
        drawableId: drawable.drawableId,
        defaultOpacity: drawable.defaultOpacity,
        runtimeVisibility: drawable.runtimeVisibility
      }))
      .sort((left, right) => left.drawableId.localeCompare(right.drawableId))
  };
};

const summarizeRuntimeSnapshots = (
  evidence: RuntimeEvidenceResult
): RuntimeSnapshotSummaryFixture => ({
  schemaVersion: "wave27-composition-runtime-snapshot-summary-v1",
  baselineSnapshot: summarizeSnapshot(evidence.baselineSnapshot),
  candidateSnapshot: summarizeSnapshot(evidence.candidateSnapshot),
  generatedRuntimeSnapshotIds: evidence.generatedRuntimeSnapshotIds,
  generatedRuntimeStateRefs: evidence.generatedRuntimeStateRefs,
  generatedRuntimeStateSequenceRefs: evidence.generatedRuntimeStateSequenceRefs,
  finalRuntimeState: {
    packageId: evidence.finalRuntimeState.packageId,
    packageRevision: evidence.finalRuntimeState.packageRevision,
    frameIndex: evidence.finalRuntimeState.frameIndex
  }
});

const summarizeSnapshot = (snapshot: RuntimeSnapshotDto): SnapshotSummary => ({
  snapshotId: snapshot.snapshotId,
  packageId: snapshot.packageId,
  packageRevision: snapshot.packageRevision,
  maskRelationEvidence: snapshot.masks,
  drawableOpacityEvidence: snapshot.drawables.map((drawable) => ({
    drawableId: drawable.drawableId,
    opacity: drawable.opacity,
    visible: drawable.visible
  })),
  drawList: snapshot.drawList
});

const summarizeRuntimeDiff = (
  runtimeDiff: RuntimeDiffDto | undefined
): RuntimeDiffSummaryFixture["runtimeDiff"] => {
  if (runtimeDiff === undefined) {
    throw new Error("Expected runtime diff evidence.");
  }

  return {
    schemaVersion: runtimeDiff.schemaVersion,
    beforeSnapshotId: runtimeDiff.beforeSnapshotId,
    afterSnapshotId: runtimeDiff.afterSnapshotId,
    maskChanges: runtimeDiff.parameterChanges.filter((change) => change.path.startsWith("/masks/")),
    parameterChangeCount: runtimeDiff.parameterChanges.length,
    drawableRuntimeStateChangeCount: runtimeDiff.drawableRuntimeStateChanges.length,
    diagnosticDeltaCount: runtimeDiff.diagnosticDelta.length
  };
};

const summarizeValidationEvidence = (
  artifact: FixtureEvidenceArtifacts
): ValidationEvidenceSummary => ({
  baselineReportId: artifact.baselineReport.reportId,
  candidateReportId: artifact.candidateReport.reportId,
  candidateStatus: artifact.candidateReport.summary.status,
  candidateHighestSeverity: artifact.candidateReport.summary.highestSeverity,
  candidateCheckIds: artifact.candidateReport.checks.map((check) => check.checkId),
  candidateRuntimeSnapshotIds: artifact.candidateReport.evidence.runtimeSnapshotIds,
  validationDiff: summarizeValidationDiff(artifact.validationDiff)
});

const summarizeValidationDiff = (validationDiff: ValidationDiffDto): ValidationDiffSummary => ({
  schemaVersion: validationDiff.schemaVersion,
  beforeReportId: validationDiff.beforeReportId,
  afterReportId: validationDiff.afterReportId,
  newFailureCount: validationDiff.newFailures.length,
  resolvedFailureCount: validationDiff.resolvedFailures.length,
  severityChangeCount: validationDiff.severityChanges.length
});

const summarizeInvalidValidationReport = (
  report: ValidationReportDto
): InvalidValidationSummary => ({
  reportId: report.reportId,
  status: report.summary.status,
  highestSeverity: report.summary.highestSeverity,
  checks: report.checks.map((check) => ({
    checkId: check.checkId,
    severity: check.severity,
    ...(check.targetPath === undefined ? {} : { targetPath: check.targetPath }),
    evidence: check.evidence
  }))
});

const summarizeViewerEvidence = (result: ViewerRuntimeEvaluationResult) => ({
  schemaVersion: "wave27-composition-viewer-facing-evidence-summary-v1",
  surface: result.evidence.surface,
  packageId: result.evidence.packageId,
  packageRevision: result.evidence.packageRevision,
  baselineSnapshotId: result.evidence.baselineSnapshotId,
  snapshotId: result.evidence.snapshotId,
  finalRuntimeStateRef: result.evidence.finalRuntimeStateRef,
  targetIds: result.evidence.targetIds,
  maskRelationEvidence: result.evidence.maskRelationEvidence,
  drawableOpacityEvidence: result.evidence.drawableOpacityEvidence,
  runtimeDiffEquivalent: result.evidence.runtimeDiffEquivalent,
  runtimeEvaluationContext: result.evidence.runtimeEvaluationContext
});

const materializePackage = (session: AuthoringSession): PackageDocumentInput =>
  toPackageDocument(session, loadBaselinePackageDocument(), {
    updatedAt: CREATED_AT
  });

const pinReportId = (
  report: ValidationReportDto,
  reportId: ValidationReportId | string
): ValidationReportDto =>
  ValidationReportSchema.parse({
    ...report,
    reportId
  });

const createInvalidMissingTargetPackage = (): PackageDocumentInput => {
  const packageDocument = structuredClone(loadBaselinePackageDocument());
  packageDocument.manifest.packageRevision = 1;
  packageDocument.manifest.updatedAt = CREATED_AT;
  packageDocument.model.masks = {
    schemaVersion: "masks-file-v1",
    masks: [
      {
        maskRelationId: MaskRelationIdSchema.parse("maskrel_wave27_missing_target"),
        maskDrawableIds: [DrawableIdSchema.parse("draw_wave27_mask")],
        targetDrawableIds: [DrawableIdSchema.parse("draw_wave27_missing_target")],
        enabled: true
      }
    ]
  };
  return packageDocument;
};

const expectSingleArtifact = (
  artifacts: readonly FixtureEvidenceArtifacts[],
  lifecycle: OperationEvidenceProviderInput["lifecycle"]
): FixtureEvidenceArtifacts => {
  expect(artifacts).toHaveLength(1);
  const artifact = artifacts[0];
  if (artifact === undefined || artifact.lifecycle !== lifecycle) {
    throw new Error(`Expected one ${lifecycle} fixture evidence artifact.`);
  }

  return artifact;
};

const toTargetRefKey = (target: Pick<TargetRefDto, "kind" | "id" | "path">) =>
  `${target.kind}:${target.id}${target.path === undefined ? "" : `:${target.path}`}`;

const createFixtureSession = (): AuthoringSession =>
  createAuthoringSessionFromPackageDocument(loadBaselinePackageDocument());

const loadBaselinePackageDocument = (): PackageDocumentInput =>
  loadFixtureJson("baseline-package.json") as PackageDocumentInput;

const loadOperationResultEvidenceSummary = (): OperationResultEvidenceSummaryFixture =>
  loadFixtureJson("expected/operation-result-evidence-summary.json") as OperationResultEvidenceSummaryFixture;

const loadPackageMaterializationSummary = (): ReturnType<typeof summarizePackageMaterialization> =>
  loadFixtureJson("expected/package-materialization-summary.json") as ReturnType<typeof summarizePackageMaterialization>;

const loadRuntimeSnapshotSummary = (): RuntimeSnapshotSummaryFixture =>
  loadFixtureJson("expected/runtime-snapshot-summary.json") as RuntimeSnapshotSummaryFixture;

const loadRuntimeDiffSummary = (): RuntimeDiffSummaryFixture =>
  loadFixtureJson("expected/runtime-diff-summary.json") as RuntimeDiffSummaryFixture;

const loadValidationReportSummary = (): ValidationReportSummaryFixture =>
  loadFixtureJson("expected/validation-report-summary.json") as ValidationReportSummaryFixture;

const loadViewerFacingEvidenceSummary = (): ReturnType<typeof summarizeViewerEvidence> =>
  loadFixtureJson("expected/viewer-facing-evidence-summary.json") as ReturnType<typeof summarizeViewerEvidence>;

const loadFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave27-composition-contract-fixtures"
);
