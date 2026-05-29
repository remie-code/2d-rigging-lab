import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthoringSessionFromPackageDocument,
  getParameterById,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  RuntimeDiffDto,
  RuntimeSnapshotId,
  ValidationDiffDto,
  ValidationReportId
} from "@private-2d-rigging-lab/contracts";
import { ParameterIdSchema } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  createOperationCore,
  OperationEvidenceResultSchema,
  OperationRequestSchema
} from "./index.js";
import type {
  OperationEvidenceProviderInput,
  OperationEvidenceResultDto
} from "./index.js";
import { buildRuntimeEvidence } from "../../runtime-core/src/index.js";
import type { RuntimeEvidenceResult } from "../../runtime-core/src/index.js";
import {
  buildRuntimeEvidenceReport,
  buildValidationDiff
} from "../../validator-core/src/index.js";
import type { ValidationReportDto } from "../../validator-core/src/index.js";

describe("minimal-operation-runtime-evidence contract fixture", () => {
  it("parses fixture createParameter requests through operation-core DTOs", () => {
    const dryRunRequest = OperationRequestSchema.parse(
      loadFixtureJson("request/create-parameter-dry-run.request.json")
    );
    const commitRequest = OperationRequestSchema.parse(
      loadFixtureJson("request/create-parameter-commit.request.json")
    );

    expect(dryRunRequest).toMatchObject({
      operationType: "createParameter",
      dryRun: true,
      payload: {
        parameterId: "param_fixture_smile"
      }
    });
    expect(commitRequest).toMatchObject({
      operationType: "createParameter",
      dryRun: false,
      payload: {
        parameterId: "param_fixture_smile"
      }
    });
    expect(commitRequest.payload).toEqual(dryRunRequest.payload);
  });

  it("wires authoring, runtime, validator, and operation evidence helpers for dry-run evidence", () => {
    const session = createFixtureSession();
    const artifacts: FixtureEvidenceArtifacts[] = [];
    const core = createOperationCore({
      evidenceProvider: (input) => collectFixtureEvidence(input, artifacts)
    });
    const targetParameterId = ParameterIdSchema.parse("param_fixture_smile");
    const before = summarizeSession(session, targetParameterId);
    const candidatePackageRevision = session.packageRevision + 1;

    const result = core.dryRunOperation(
      session,
      loadFixtureJson("request/create-parameter-dry-run.request.json")
    );
    const artifact = expectSingleArtifact(artifacts, "dry_run");
    const expectedRuntimeSummary = withCandidatePackageRevision(
      loadRuntimeSnapshotSummary(),
      candidatePackageRevision
    );
    const expectedOperationResultEvidence = withRuntimeArtifactRevision(
      loadOperationResultEvidenceSummary(),
      candidatePackageRevision
    );

    expect(result.status).toBe("dry_run");
    expect(result.generatedRuntimeSnapshotIds).toEqual(
      expectedRuntimeSummary.generatedRuntimeSnapshotIds
    );
    expect(result.generatedValidationReportIds).toEqual(
      expectedOperationResultEvidence.dryRun.generatedValidationReportIds
    );
    expect(result.runtimeDiff).toBeDefined();
    expect(result.validationDiff).toBeDefined();
    expect(summarizeRuntimeSnapshots(artifact.runtimeEvidence)).toEqual(
      expectedRuntimeSummary
    );
    expect(summarizeRuntimeDiff(result.runtimeDiff)).toEqual(
      loadRuntimeDiffSummary().runtimeDiff
    );
    expect(summarizeValidationReport("dryRun", artifact)).toEqual(
      loadValidationReportSummary().dryRun
    );
    expect(summarizeValidationDiff(result.validationDiff)).toEqual(
      loadValidationDiffSummary().dryRun
    );
    expect(summarizeOperationResultEvidence(result, core.operationLog.entries.length)).toEqual(
      expectedOperationResultEvidence.dryRun
    );
    expect(summarizeSession(session, targetParameterId)).toEqual(before);
    expect(getParameterById(session.graph, targetParameterId)).toBeUndefined();
  });

  it("commits fixture mutation, appends log entry, and carries expected evidence summaries", () => {
    const session = createFixtureSession();
    const artifacts: FixtureEvidenceArtifacts[] = [];
    const core = createOperationCore({
      now: () => new Date("2026-05-29T00:00:00.000Z"),
      evidenceProvider: (input) => collectFixtureEvidence(input, artifacts)
    });
    const targetParameterId = ParameterIdSchema.parse("param_fixture_smile");
    const candidatePackageRevision = session.packageRevision + 1;

    const outcome = core.commitOperation(
      session,
      loadFixtureJson("request/create-parameter-commit.request.json")
    );
    const artifact = expectSingleArtifact(artifacts, "commit");
    const expectedRuntimeSummary = withCandidatePackageRevision(
      loadRuntimeSnapshotSummary(),
      candidatePackageRevision
    );
    const expectedOperationResultEvidence = withRuntimeArtifactRevision(
      loadOperationResultEvidenceSummary(),
      candidatePackageRevision
    );

    expect(outcome.result.status).toBe("committed");
    expect(getParameterById(session.graph, targetParameterId)).toBeDefined();
    expect(session.packageRevision).toBe(candidatePackageRevision);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
    expect(outcome.operationLogLength).toBe(1);
    expect(core.operationLog.entries).toHaveLength(1);
    expect(outcome.result.generatedRuntimeSnapshotIds).toEqual(
      expectedRuntimeSummary.generatedRuntimeSnapshotIds
    );
    expect(outcome.result.generatedValidationReportIds).toEqual(
      expectedOperationResultEvidence.commit.generatedValidationReportIds
    );
    expect(summarizeRuntimeSnapshots(artifact.runtimeEvidence)).toEqual(
      expectedRuntimeSummary
    );
    expect(summarizeRuntimeDiff(outcome.result.runtimeDiff)).toEqual(
      loadRuntimeDiffSummary().runtimeDiff
    );
    expect(summarizeValidationReport("commit", artifact)).toEqual(
      loadValidationReportSummary().commit
    );
    expect(summarizeValidationDiff(outcome.result.validationDiff)).toEqual(
      loadValidationDiffSummary().commit
    );
    expect({
      ...summarizeOperationResultEvidence(outcome.result, outcome.operationLogLength),
      logEntry: {
        runtimeSnapshotIds: outcome.logEntry?.runtimeSnapshotIds,
        validationReportIds: outcome.logEntry?.validationReportIds
      }
    }).toEqual(expectedOperationResultEvidence.commit);
  });
});

type PackageDocumentInput = Parameters<typeof createAuthoringSessionFromPackageDocument>[0];

interface BaselineAuthoringInputFixture {
  readonly baselinePackage: {
    readonly rootRelativePath: string;
    readonly packageHash: string;
  };
}

interface RuntimeSnapshotSummaryFixture {
  readonly schemaVersion: "operation-runtime-snapshot-summary-v1";
  readonly baselineSnapshot: SnapshotSummary;
  readonly candidateSnapshot: SnapshotSummary & {
    readonly authoredParameterValues: Readonly<Record<string, number>>;
  };
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
  readonly parameterIds: readonly string[];
  readonly drawList: readonly string[];
}

interface RuntimeDiffSummaryFixture {
  readonly runtimeDiff: {
    readonly schemaVersion: "runtime-diff-v1";
    readonly beforeSnapshotId: RuntimeSnapshotId;
    readonly afterSnapshotId: RuntimeSnapshotId;
    readonly parameterChangeCount: number;
    readonly dynamicsChangeCount: number;
    readonly drawableChangeCount: number;
    readonly diagnosticDeltaCount: number;
  };
}

interface ValidationReportSummaryFixture {
  readonly dryRun: ValidationReportSummary;
  readonly commit: ValidationReportSummary;
}

interface ValidationReportSummary {
  readonly baselineReportId: ValidationReportId;
  readonly candidateReportId: ValidationReportId;
  readonly status: string;
  readonly highestSeverity: string;
  readonly operationLogPresent: boolean;
  readonly operationLogPath?: string;
  readonly runtimeSnapshotIds: readonly RuntimeSnapshotId[];
}

interface ValidationDiffSummaryFixture {
  readonly dryRun: ValidationDiffSummary;
  readonly commit: ValidationDiffSummary;
}

interface ValidationDiffSummary {
  readonly schemaVersion: "validation-diff-v1";
  readonly beforeReportId: ValidationReportId;
  readonly afterReportId: ValidationReportId;
  readonly newFailureCount: number;
  readonly resolvedFailureCount: number;
  readonly severityChangeCount: number;
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
  readonly generatedRuntimeSnapshotIds: readonly RuntimeSnapshotId[];
  readonly generatedRuntimeStateRefs: readonly string[];
  readonly generatedRuntimeStateSequenceRefs: readonly string[];
  readonly finalRuntimeStateRef: string;
  readonly generatedValidationReportIds: readonly ValidationReportId[];
  readonly operationLogLength: number;
  readonly originalAuthoringRevisionAfter?: number;
  readonly originalDirtyAfter?: boolean;
  readonly authoringRevisionAfter?: number;
  readonly dirtyAfter?: boolean;
}

interface FixtureEvidenceArtifacts {
  readonly lifecycle: OperationEvidenceProviderInput["lifecycle"];
  readonly runtimeEvidence: RuntimeEvidenceResult;
  readonly baselineReport: ValidationReportDto;
  readonly candidateReport: ValidationReportDto;
  readonly validationDiff: ValidationDiffDto;
}

const collectFixtureEvidence = (
  input: OperationEvidenceProviderInput,
  artifacts: FixtureEvidenceArtifacts[]
): OperationEvidenceResultDto => {
  if (input.request.operationType !== "createParameter") {
    throw new Error(`Unsupported fixture operation: ${input.request.operationType}`);
  }
  const parameterId = input.request.payload.parameterId;
  if (parameterId === undefined) {
    throw new Error("Runtime evidence fixture requires an explicit parameterId.");
  }

  const baseline = loadBaselineAuthoringInput();
  const runtimeEvidence = buildRuntimeEvidence({
    baselineGraph: toRuntimeGraph(input.baselineSession, {
      packageHash: baseline.baselinePackage.packageHash
    }),
    candidateGraph: toRuntimeGraph(input.candidateSession, {
      packageHash: baseline.baselinePackage.packageHash
    }),
    candidate: {
      frame: {
        authoredParameterValues: {
          [parameterId]: input.request.payload.max
        },
        targetIds: [parameterId]
      }
    },
    context: {
      source: { surface: "validator", operationId: input.result.operationId },
      policy: { strictness: "strict" }
    },
    artifactLabel: "create-parameter-evidence"
  });
  const baselineReport = buildRuntimeEvidenceReport({
    reportId: `val_fixture_${input.lifecycle}_baseline`,
    createdAt: "2026-05-29T00:00:00.000Z",
    packageId: runtimeEvidence.baselineSnapshot.packageId,
    packageRevision: runtimeEvidence.baselineSnapshot.packageRevision,
    packageHash: baseline.baselinePackage.packageHash,
    runtimeSnapshotIds: [runtimeEvidence.baselineSnapshot.snapshotId]
  });
  const candidateReport = buildRuntimeEvidenceReport({
    reportId: `val_fixture_${input.lifecycle}_candidate`,
    createdAt: "2026-05-29T00:00:00.000Z",
    packageId: runtimeEvidence.candidateSnapshot.packageId,
    packageRevision: runtimeEvidence.candidateSnapshot.packageRevision,
    packageHash: baseline.baselinePackage.packageHash,
    runtimeSnapshotIds: runtimeEvidence.generatedRuntimeSnapshotIds,
    operationLogPresent: input.lifecycle === "commit",
    ...(input.lifecycle === "commit" ? { operationLogPath: "operations/log.jsonl" } : {})
  });
  const validationDiff = buildValidationDiff({
    baseline: baselineReport,
    candidate: candidateReport
  });

  artifacts.push({
    lifecycle: input.lifecycle,
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

const summarizeRuntimeSnapshots = (
  evidence: RuntimeEvidenceResult
): RuntimeSnapshotSummaryFixture => ({
  schemaVersion: "operation-runtime-snapshot-summary-v1",
  baselineSnapshot: {
    snapshotId: evidence.baselineSnapshot.snapshotId,
    packageId: evidence.baselineSnapshot.packageId,
    packageRevision: evidence.baselineSnapshot.packageRevision,
    parameterIds: evidence.baselineSnapshot.parameters.map((parameter) => parameter.parameterId),
    drawList: evidence.baselineSnapshot.drawList
  },
  candidateSnapshot: {
    snapshotId: evidence.candidateSnapshot.snapshotId,
    packageId: evidence.candidateSnapshot.packageId,
    packageRevision: evidence.candidateSnapshot.packageRevision,
    parameterIds: evidence.candidateSnapshot.parameters.map((parameter) => parameter.parameterId),
    authoredParameterValues: Object.fromEntries(
      evidence.candidateSnapshot.parameters.flatMap((parameter) =>
        parameter.authoredValue === undefined
          ? []
          : [[parameter.parameterId, parameter.authoredValue]]
      )
    ),
    drawList: evidence.candidateSnapshot.drawList
  },
  generatedRuntimeSnapshotIds: evidence.generatedRuntimeSnapshotIds,
  generatedRuntimeStateRefs: evidence.generatedRuntimeStateRefs,
  generatedRuntimeStateSequenceRefs: evidence.generatedRuntimeStateSequenceRefs,
  finalRuntimeState: {
    packageId: evidence.finalRuntimeState.packageId,
    packageRevision: evidence.finalRuntimeState.packageRevision,
    frameIndex: evidence.finalRuntimeState.frameIndex
  }
});

const summarizeRuntimeDiff = (
  runtimeDiff: RuntimeDiffDto | undefined
): RuntimeDiffSummaryFixture["runtimeDiff"] => {
  if (runtimeDiff === undefined) {
    throw new Error("Expected runtimeDiff evidence.");
  }

  return {
    schemaVersion: runtimeDiff.schemaVersion,
    beforeSnapshotId: runtimeDiff.beforeSnapshotId,
    afterSnapshotId: runtimeDiff.afterSnapshotId,
    parameterChangeCount: runtimeDiff.parameterChanges.length,
    dynamicsChangeCount: runtimeDiff.dynamicsChanges.length,
    drawableChangeCount: runtimeDiff.drawableChanges.length,
    diagnosticDeltaCount: runtimeDiff.diagnosticDelta.length
  };
};

const summarizeValidationReport = (
  mode: "dryRun" | "commit",
  artifact: FixtureEvidenceArtifacts
): ValidationReportSummary => ({
  baselineReportId: artifact.baselineReport.reportId,
  candidateReportId: artifact.candidateReport.reportId,
  status: artifact.candidateReport.summary.status,
  highestSeverity: artifact.candidateReport.summary.highestSeverity,
  operationLogPresent: artifact.candidateReport.evidence.operationLogPresent,
  ...(artifact.candidateReport.evidence.operationLogPath === undefined
    ? {}
    : { operationLogPath: artifact.candidateReport.evidence.operationLogPath }),
  runtimeSnapshotIds:
    mode === "dryRun"
      ? artifact.candidateReport.evidence.runtimeSnapshotIds
      : artifact.candidateReport.evidence.runtimeSnapshotIds
});

const summarizeValidationDiff = (
  validationDiff: ValidationDiffDto | undefined
): ValidationDiffSummary => {
  if (validationDiff === undefined) {
    throw new Error("Expected validationDiff evidence.");
  }

  return {
    schemaVersion: validationDiff.schemaVersion,
    beforeReportId: validationDiff.beforeReportId,
    afterReportId: validationDiff.afterReportId,
    newFailureCount: validationDiff.newFailures.length,
    resolvedFailureCount: validationDiff.resolvedFailures.length,
    severityChangeCount: validationDiff.severityChanges.length
  };
};

const summarizeOperationResultEvidence = (
  result: OperationEvidenceResultDto & {
    readonly operationId: string;
    readonly status: string;
  },
  operationLogLength: number
): OperationResultEvidenceSummary => ({
  operationId: result.operationId,
  status: result.status,
  generatedRuntimeSnapshotIds: result.generatedRuntimeSnapshotIds,
  generatedRuntimeStateRefs: result.generatedRuntimeStateRefs,
  generatedRuntimeStateSequenceRefs: result.generatedRuntimeStateSequenceRefs,
  finalRuntimeStateRef: result.finalRuntimeStateRef ?? "",
  generatedValidationReportIds: result.generatedValidationReportIds,
  operationLogLength,
  ...(result.status === "dry_run"
    ? {
        originalAuthoringRevisionAfter: 0,
        originalDirtyAfter: false
      }
    : {
        authoringRevisionAfter: 1,
        dirtyAfter: true
      })
});

const withCandidatePackageRevision = (
  summary: RuntimeSnapshotSummaryFixture,
  candidatePackageRevision: number
): RuntimeSnapshotSummaryFixture => ({
  ...summary,
  candidateSnapshot: {
    ...summary.candidateSnapshot,
    packageRevision: candidatePackageRevision
  },
  generatedRuntimeStateRefs: reviseRuntimeArtifactRefs(
    summary.generatedRuntimeStateRefs,
    candidatePackageRevision
  ),
  generatedRuntimeStateSequenceRefs: reviseRuntimeArtifactRefs(
    summary.generatedRuntimeStateSequenceRefs,
    candidatePackageRevision
  ),
  finalRuntimeState: {
    ...summary.finalRuntimeState,
    packageRevision: candidatePackageRevision
  }
});

const withRuntimeArtifactRevision = (
  summary: OperationResultEvidenceSummaryFixture,
  candidatePackageRevision: number
): OperationResultEvidenceSummaryFixture => ({
  ...summary,
  dryRun: reviseOperationResultArtifactRefs(summary.dryRun, candidatePackageRevision),
  commit: {
    ...reviseOperationResultArtifactRefs(summary.commit, candidatePackageRevision),
    logEntry: summary.commit.logEntry
  }
});

const reviseOperationResultArtifactRefs = (
  summary: OperationResultEvidenceSummary,
  candidatePackageRevision: number
): OperationResultEvidenceSummary => ({
  ...summary,
  generatedRuntimeStateRefs: reviseRuntimeArtifactRefs(
    summary.generatedRuntimeStateRefs,
    candidatePackageRevision
  ),
  generatedRuntimeStateSequenceRefs: reviseRuntimeArtifactRefs(
    summary.generatedRuntimeStateSequenceRefs,
    candidatePackageRevision
  ),
  finalRuntimeStateRef: reviseRuntimeArtifactRef(
    summary.finalRuntimeStateRef,
    candidatePackageRevision
  )
});

const reviseRuntimeArtifactRefs = (
  refs: readonly string[],
  candidatePackageRevision: number
): readonly string[] =>
  refs.map((ref) => reviseRuntimeArtifactRef(ref, candidatePackageRevision));

const reviseRuntimeArtifactRef = (
  ref: string,
  candidatePackageRevision: number
): string => ref.replace(/-r\d+-/, `-r${candidatePackageRevision}-`);

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

const summarizeSession = (
  session: AuthoringSession,
  parameterId: ReturnType<typeof ParameterIdSchema.parse>
) => ({
  authoringRevision: session.authoringRevision,
  dirty: session.dirty,
  parameterIds: session.graph.parameters.map((parameter) => parameter.parameterId),
  targetParameter: getParameterById(session.graph, parameterId),
  stableOrder: session.graph.stableOrder
});

const createFixtureSession = (): AuthoringSession =>
  createAuthoringSessionFromPackageDocument(loadBaselinePackageDocument());

const loadBaselinePackageDocument = (): PackageDocumentInput => {
  const baseline = loadBaselineAuthoringInput();
  const fixtureDirectory = join(fixtureRootDirectory, baseline.baselinePackage.rootRelativePath);

  return {
    manifest: readJson(join(fixtureDirectory, "manifest.json")) as PackageDocumentInput["manifest"],
    model: {
      graph: readJson(join(fixtureDirectory, "model/graph.json")) as PackageDocumentInput["model"]["graph"],
      drawables: readJson(join(fixtureDirectory, "model/drawables.json")) as PackageDocumentInput["model"]["drawables"],
      meshes: readJson(join(fixtureDirectory, "model/meshes.json")) as PackageDocumentInput["model"]["meshes"],
      parameters: readJson(join(fixtureDirectory, "model/parameters.json")) as PackageDocumentInput["model"]["parameters"],
      keyforms: readJson(join(fixtureDirectory, "model/keyforms.json")) as PackageDocumentInput["model"]["keyforms"],
      rigControls: readJson(join(fixtureDirectory, "model/rig-controls.json")) as PackageDocumentInput["model"]["rigControls"],
      dynamics: readJson(join(fixtureDirectory, "model/dynamics.json")) as PackageDocumentInput["model"]["dynamics"],
      masks: readJson(join(fixtureDirectory, "model/masks.json")) as PackageDocumentInput["model"]["masks"],
      drawOrder: readJson(join(fixtureDirectory, "model/draw-order.json")) as PackageDocumentInput["model"]["drawOrder"]
    },
    assets: {
      sourceManifest: readJson(join(fixtureDirectory, "assets/sources/source-manifest.json")) as PackageDocumentInput["assets"]["sourceManifest"],
      provenance: readJson(join(fixtureDirectory, "assets/provenance.json")) as PackageDocumentInput["assets"]["provenance"],
      rights: readJson(join(fixtureDirectory, "assets/rights.json")) as PackageDocumentInput["assets"]["rights"]
    }
  };
};

const loadBaselineAuthoringInput = (): BaselineAuthoringInputFixture =>
  loadFixtureJson("baseline-authoring-input.json") as BaselineAuthoringInputFixture;

const loadRuntimeSnapshotSummary = (): RuntimeSnapshotSummaryFixture =>
  loadFixtureJson("expected/runtime-snapshot-summary.json") as RuntimeSnapshotSummaryFixture;

const loadRuntimeDiffSummary = (): RuntimeDiffSummaryFixture =>
  loadFixtureJson("expected/runtime-diff-summary.json") as RuntimeDiffSummaryFixture;

const loadValidationReportSummary = (): ValidationReportSummaryFixture =>
  loadFixtureJson("expected/validation-report-summary.json") as ValidationReportSummaryFixture;

const loadValidationDiffSummary = (): ValidationDiffSummaryFixture =>
  loadFixtureJson("expected/validation-diff-summary.json") as ValidationDiffSummaryFixture;

const loadOperationResultEvidenceSummary = (): OperationResultEvidenceSummaryFixture =>
  loadFixtureJson("expected/operation-result-evidence-summary.json") as OperationResultEvidenceSummaryFixture;

const loadFixtureJson = (relativePath: string): unknown =>
  readJson(join(fixtureRootDirectory, relativePath));

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/minimal-operation-runtime-evidence"
);
