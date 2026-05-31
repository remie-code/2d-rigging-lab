import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthoringSessionFromPackageDocument,
  toPackageDocument,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type {
  AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type {
  ModelDiffDto,
  TargetRefDto,
  ValidationDiffDto
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
import { buildRuntimeEvidence } from "../../runtime-core/src/index.js";
import type { RuntimeEvidenceResult } from "../../runtime-core/src/index.js";
import {
  buildValidationDiff,
  validatePackageRuntime,
  ValidationReportSchema
} from "../../validator-core/src/index.js";
import type { ValidationReportDto } from "../../validator-core/src/index.js";

const CREATED_AT = "2026-05-31T00:00:00.000Z";
const PACKAGE_HASH = "sha256:minimum-open-dynamics-v1-evidence";
const ARTIFACT_LABEL = "minimum-open-dynamics-v1-evidence";
const DRIVER_PARAMETER_ID = "param_face_yaw";
const OUTPUT_PARAMETER_ID = "param_hair_sway";

describe("minimum-open-dynamics-v1-evidence operation contract fixture", () => {
  it("parses fixture createDynamicsGroup requests through operation-core DTOs", () => {
    const dryRunRequest = OperationRequestSchema.parse(
      loadFixtureJson("request/create-dynamics-group-dry-run.request.json")
    );
    const commitRequest = OperationRequestSchema.parse(
      loadFixtureJson("request/create-dynamics-group-commit.request.json")
    );

    expect(dryRunRequest).toMatchObject({
      operationType: "createDynamicsGroup",
      dryRun: true,
      payload: {
        dynamicsGroupId: "dyn_hair_sway",
        solverKind: "scalarDampedFollowV1",
        drivers: [
          {
            sourceParameterId: DRIVER_PARAMETER_ID
          }
        ],
        output: {
          targetParameterId: OUTPUT_PARAMETER_ID,
          clampPolicy: "clamp-to-output-range"
        }
      }
    });
    expect(commitRequest).toMatchObject({
      operationType: "createDynamicsGroup",
      dryRun: false,
      payload: dryRunRequest.payload
    });
  });

  it("keeps dry-run immutable while attaching deterministic runtime and validation evidence", () => {
    const session = createFixtureSession();
    const artifacts: FixtureEvidenceArtifacts[] = [];
    const core = createOperationCore({
      evidenceProvider: (input) => collectFixtureEvidence(input, artifacts)
    });

    const result = core.dryRunOperation(
      session,
      loadFixtureJson("request/create-dynamics-group-dry-run.request.json")
    );

    expect(result.status).toBe("dry_run");
    expect(artifacts).toHaveLength(1);
    expect(summarizeOperationResultEvidence(result, session, core.operationLog.entries.length)).toEqual(
      loadFixtureJson("expected/operation-result-evidence-summary.json").dryRun
    );
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
  });

  it("commits the fixture mutation, appends operation log evidence, and carries expected IDs", () => {
    const session = createFixtureSession();
    const artifacts: FixtureEvidenceArtifacts[] = [];
    const core = createOperationCore({
      now: () => new Date(CREATED_AT),
      evidenceProvider: (input) => collectFixtureEvidence(input, artifacts)
    });

    const outcome = core.commitOperation(
      session,
      loadFixtureJson("request/create-dynamics-group-commit.request.json")
    );

    expect(outcome.result.status).toBe("committed");
    expect(artifacts).toHaveLength(1);
    expect({
      ...summarizeOperationResultEvidence(outcome.result, session, outcome.operationLogLength),
      logEntry: {
        operationId: outcome.logEntry?.operationId,
        operationType: outcome.logEntry?.operationType,
        targetIds: outcome.logEntry?.targetIds,
        runtimeSnapshotIds: outcome.logEntry?.runtimeSnapshotIds,
        validationReportIds: outcome.logEntry?.validationReportIds
      }
    }).toEqual(loadFixtureJson("expected/operation-result-evidence-summary.json").commit);
  });
});

type PackageDocumentInput = Parameters<typeof createAuthoringSessionFromPackageDocument>[0];

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
  if (input.request.operationType !== "createDynamicsGroup") {
    throw new Error(`Unsupported fixture operation: ${input.request.operationType}`);
  }

  const runtimeEvidence = buildRuntimeEvidence({
    baselineGraph: toRuntimeGraph(input.baselineSession, { packageHash: PACKAGE_HASH }),
    candidateGraph: toRuntimeGraph(input.candidateSession, { packageHash: PACKAGE_HASH }),
    baseline: createEvaluationInput(0),
    candidate: createEvaluationInput(1),
    options: {
      schemaVersion: "runtime-evaluation-options-v1",
      snapshotDetail: "full"
    },
    context: {
      source: { surface: "validator", operationId: input.result.operationId },
      policy: { strictness: "strict" }
    },
    artifactLabel: ARTIFACT_LABEL
  });
  const baselineReport = withReportEvidence(
    validatePackageRuntime({
      packageDocument: toPackageDocument(input.baselineSession, loadBaselinePackageDocument(), {
        updatedAt: CREATED_AT
      }),
      runtimeSnapshot: runtimeEvidence.baselineSnapshot,
      createdAt: CREATED_AT
    }),
    {
      reportId: `val_minimum_open_dynamics_v1_${input.lifecycle}_baseline`,
      operationLogPresent: false
    }
  );
  const candidateReport = withReportEvidence(
    validatePackageRuntime({
      packageDocument: toPackageDocument(input.candidateSession, loadBaselinePackageDocument(), {
        updatedAt: CREATED_AT
      }),
      runtimeSnapshot: runtimeEvidence.candidateSnapshot,
      createdAt: CREATED_AT
    }),
    {
      reportId: `val_minimum_open_dynamics_v1_${input.lifecycle}_candidate`,
      operationLogPresent: input.lifecycle === "commit",
      ...(input.lifecycle === "commit" ? { operationLogPath: "operations/log.jsonl" } : {})
    }
  );
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

const createEvaluationInput = (frameIndex: number) => ({
  frame: {
    frameIndex,
    deltaTimeMs: 16.6666667,
    authoredParameterValues: {
      [DRIVER_PARAMETER_ID]: 1
    },
    targetIds: [OUTPUT_PARAMETER_ID, "draw_hair", "mesh_hair"]
  }
});

const withReportEvidence = (
  report: ValidationReportDto,
  evidence: {
    readonly reportId: string;
    readonly operationLogPresent: boolean;
    readonly operationLogPath?: string;
  }
): ValidationReportDto =>
  ValidationReportSchema.parse({
    ...report,
    reportId: evidence.reportId,
    evidence: {
      ...report.evidence,
      operationLogPresent: evidence.operationLogPresent,
      ...(evidence.operationLogPath === undefined ? {} : { operationLogPath: evidence.operationLogPath })
    }
  });

const summarizeOperationResultEvidence = (
  result: OperationResultDto,
  session: AuthoringSession,
  operationLogLength: number
) => ({
  operationId: result.operationId,
  status: result.status,
  preconditionOk: result.precondition.ok,
  reversible: result.reversible,
  modelDiff: summarizeModelDiff(result.modelDiff),
  generatedRuntimeSnapshotIds: result.generatedRuntimeSnapshotIds,
  generatedRuntimeStateRefs: result.generatedRuntimeStateRefs,
  generatedRuntimeStateSequenceRefs: result.generatedRuntimeStateSequenceRefs,
  finalRuntimeStateRef: result.finalRuntimeStateRef,
  generatedValidationReportIds: result.generatedValidationReportIds,
  validationDiff: summarizeValidationDiff(result.validationDiff),
  operationLogLength,
  ...(result.status === "dry_run"
    ? {
        originalPackageRevisionAfter: session.packageRevision,
        originalAuthoringRevisionAfter: session.authoringRevision,
        originalDirtyAfter: session.dirty
      }
    : {
        packageRevisionAfter: session.packageRevision,
        authoringRevisionAfter: session.authoringRevision,
        dirtyAfter: session.dirty
      })
});

const summarizeModelDiff = (modelDiff: ModelDiffDto | undefined) => {
  if (modelDiff === undefined) {
    throw new Error("Expected modelDiff evidence.");
  }

  return {
    baseRevision: modelDiff.baseRevision,
    candidateRevision: modelDiff.candidateRevision,
    added: modelDiff.added.map(toTargetRefKey),
    changedTargets: modelDiff.changed.map((change) => toTargetRefKey(change.target))
  };
};

const summarizeValidationDiff = (validationDiff: ValidationDiffDto | undefined) => {
  if (validationDiff === undefined) {
    throw new Error("Expected validationDiff evidence.");
  }

  return {
    newFailureCount: validationDiff.newFailures.length,
    resolvedFailureCount: validationDiff.resolvedFailures.length,
    severityChangeCount: validationDiff.severityChanges.length
  };
};

const toTargetRefKey = (target: Pick<TargetRefDto, "kind" | "id" | "path">) =>
  `${target.kind}:${target.id}${target.path === undefined ? "" : `:${target.path}`}`;

const createFixtureSession = (): AuthoringSession =>
  createAuthoringSessionFromPackageDocument(loadBaselinePackageDocument());

const loadBaselinePackageDocument = (): PackageDocumentInput =>
  loadFixtureJson("baseline-package.json") as PackageDocumentInput;

const loadFixtureJson = (relativePath: string): any =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/minimum-open-dynamics-v1-evidence"
);
