import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthoringSessionFromPackageDocument
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  ModelDiffDto,
  TargetRefDto,
  ValidationDiffDto
} from "@private-2d-rigging-lab/contracts";
import {
  RuntimeDiffSchema,
  ValidationDiffSchema
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

const CREATED_AT = "2026-06-01T00:00:00.000Z";
const BASELINE_SNAPSHOT_ID = "snap_parent_child_rigcontrol_diagonal_0";
const CANDIDATE_SNAPSHOT_ID = "snap_parent_child_rigcontrol_diagonal_1";
const CANDIDATE_REPORT_ID = "val_parent_child_rigcontrol_diagonal_candidate";

describe("parent-child-rigControl-diagonal operation contract fixture", () => {
  it("parses the fixture rig control operation requests through operation-core DTOs", () => {
    expect(OperationRequestSchema.parse(loadFixtureJson("request/create-parent-dry-run.request.json"))).toMatchObject({
      operationType: "createRotation2dRigControl",
      dryRun: true,
      payload: {
        displayName: "Body Rotation",
        restAngleDegrees: 30
      }
    });
    expect(loadCommitRequests().map((request) => OperationRequestSchema.parse(request).operationType)).toEqual([
      "createRotation2dRigControl",
      "createRotation2dRigControl",
      "bindRigControlChild",
      "bindRigControlChild"
    ]);
  });

  it("keeps dry-run immutable and pins the create result evidence", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      evidenceProvider: collectFixtureEvidence
    });

    const result = core.dryRunOperation(session, loadFixtureJson("request/create-parent-dry-run.request.json"));

    expect(summarizeDryRunResult(result, session)).toEqual(
      loadFixtureJson("expected/operation-result-evidence-summary.json").dryRun
    );
  });

  it("commits create/bind sequence and attaches final runtime and validator evidence refs", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date(CREATED_AT),
      evidenceProvider: collectFixtureEvidence
    });
    const outcomes = loadCommitRequests().map((request) => core.commitOperation(session, request));

    expect(summarizeCommitSequence(outcomes.map((outcome) => outcome.result), session, core.operationLog.entries.length)).toEqual(
      loadFixtureJson("expected/operation-result-evidence-summary.json").commitSequence
    );
  });
});

type PackageDocumentInput = Parameters<typeof createAuthoringSessionFromPackageDocument>[0];

const collectFixtureEvidence = (
  input: OperationEvidenceProviderInput
): OperationEvidenceResultDto => {
  if (
    input.lifecycle !== "commit" ||
    input.request.operationType !== "bindRigControlChild" ||
    input.request.payload.child.kind !== "drawable"
  ) {
    return OperationEvidenceResultSchema.parse({});
  }

  return OperationEvidenceResultSchema.parse({
    runtimeDiff: createFixtureRuntimeDiff(),
    validationDiff: createFixtureValidationDiff(),
    generatedRuntimeSnapshotIds: [
      BASELINE_SNAPSHOT_ID,
      CANDIDATE_SNAPSHOT_ID
    ],
    generatedValidationReportIds: [
      CANDIDATE_REPORT_ID
    ]
  });
};

const createFixtureRuntimeDiff = () =>
  RuntimeDiffSchema.parse({
    schemaVersion: "runtime-diff-v1",
    beforeSnapshotId: BASELINE_SNAPSHOT_ID,
    afterSnapshotId: CANDIDATE_SNAPSHOT_ID,
    parameterChanges: [],
    dynamicsChanges: [],
    drawableChanges: [
      {
        drawableId: "draw_arm",
        boundsChanged: true,
        vertexHashBefore: "vhash_568d1cfb_3",
        vertexHashAfter: "vhash_f495d7e4_3"
      }
    ],
    drawableRuntimeStateChanges: [],
    drawListChanges: [],
    diagnosticDelta: []
  });

const createFixtureValidationDiff = (): ValidationDiffDto =>
  ValidationDiffSchema.parse({
    schemaVersion: "validation-diff-v1",
    beforeReportId: "val_parent_child_rigcontrol_diagonal_baseline",
    afterReportId: CANDIDATE_REPORT_ID,
    newFailures: [],
    resolvedFailures: [],
    severityChanges: []
  });

const summarizeDryRunResult = (
  result: OperationResultDto,
  session: AuthoringSession
) => ({
  operationId: result.operationId,
  status: result.status,
  preconditionOk: result.precondition.ok,
  added: summarizeModelDiff(result.modelDiff).added,
  changedTargets: summarizeModelDiff(result.modelDiff).changedTargets,
  generatedRuntimeSnapshotIds: result.generatedRuntimeSnapshotIds,
  generatedValidationReportIds: result.generatedValidationReportIds,
  originalPackageRevisionAfter: session.packageRevision,
  originalAuthoringRevisionAfter: session.authoringRevision,
  originalDirtyAfter: session.dirty
});

const summarizeCommitSequence = (
  results: readonly OperationResultDto[],
  session: AuthoringSession,
  operationLogLength: number
) => {
  const finalResult = results.at(-1);
  if (finalResult === undefined) {
    throw new Error("Expected at least one committed operation result.");
  }

  return {
    operationIds: results.map((result) => result.operationId),
    statuses: results.map((result) => result.status),
    operationLogLength,
    packageRevisionAfter: session.packageRevision,
    authoringRevisionAfter: session.authoringRevision,
    rigControlRootIds: session.graph.rigControlRootIds,
    finalRigControls: session.graph.rigControls.map((rigControl) => ({
      rigControlId: rigControl.rigControlId,
      parentId: rigControl.parentId ?? null,
      childRigControlIds: rigControl.childRigControlIds,
      childDrawableIds: rigControl.childDrawableIds,
      restAngleDegrees: rigControl.kind === "rotation2d" ? rigControl.restAngleDegrees : null
    })),
    finalOperationEvidence: {
      operationId: finalResult.operationId,
      generatedRuntimeSnapshotIds: finalResult.generatedRuntimeSnapshotIds,
      generatedValidationReportIds: finalResult.generatedValidationReportIds,
      runtimeDiffDrawableChanges: finalResult.runtimeDiff?.drawableChanges ?? [],
      validationDiffNewFailureCount: finalResult.validationDiff?.newFailures.length ?? 0
    }
  };
};

const summarizeModelDiff = (modelDiff: ModelDiffDto | undefined) => {
  if (modelDiff === undefined) {
    throw new Error("Expected modelDiff evidence.");
  }

  return {
    added: modelDiff.added.map(toTargetRefKey),
    changedTargets: modelDiff.changed.map((change) => toTargetRefKey(change.target))
  };
};

const toTargetRefKey = (target: Pick<TargetRefDto, "kind" | "id" | "path">) =>
  `${target.kind}:${target.id}${target.path === undefined ? "" : `:${target.path}`}`;

const createFixtureSession = (): AuthoringSession =>
  createAuthoringSessionFromPackageDocument(loadBaselinePackageDocument());

const loadBaselinePackageDocument = (): PackageDocumentInput =>
  loadFixtureJson("baseline-package.json") as PackageDocumentInput;

const loadCommitRequests = (): readonly unknown[] => [
  loadFixtureJson("request/create-parent-commit.request.json"),
  loadFixtureJson("request/create-child-commit.request.json"),
  loadFixtureJson("request/bind-child-rig-commit.request.json"),
  loadFixtureJson("request/bind-child-drawable-commit.request.json")
];

const loadFixtureJson = (relativePath: string): any =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/parent-child-rigControl-diagonal"
);
