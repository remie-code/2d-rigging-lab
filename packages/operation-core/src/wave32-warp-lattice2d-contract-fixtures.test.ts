import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthoringSessionFromPackageDocument,
  toPackageDocument,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  ModelDiffDto,
  RuntimeDiffDto,
  TargetRefDto,
  ValidationReportId
} from "@private-2d-rigging-lab/contracts";
import {
  PackageDocumentSchema,
  type PackageDocumentDto
} from "../../package-format/src/index.js";
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
  validatePackageRuntime,
  ValidationReportSchema
} from "../../validator-core/src/index.js";
import type { ValidationReportDto } from "../../validator-core/src/index.js";
import { describe, expect, it } from "vitest";

import {
  createOperationCore,
  OperationRequestSchema
} from "./index.js";
import type {
  CommitOperationOutcome,
  OperationRequestDto
} from "./index.js";

const FIXTURE_ID = "wave32-warp-lattice2d-contract-fixtures";
const CREATED_AT = "2026-06-02T00:01:00.000Z";
const PACKAGE_HASH = "sha256:wave32-warp-lattice2d-contract-fixtures-v1";
const RIG_CONTROL_ID = "rig_wave32_body_warp_lattice";
const DRAWABLE_ID = "draw_wave32_body";
const PARAMETER_ID = "param_wave32_warp_x";
const KEYFORM_SET_ID =
  "keyset_rigcontrol_rig_wave32_body_warp_lattice_controlpointoffsets_wave32_warp_x_1";

describe("wave32 warpLattice2d contract fixture", () => {
  it("parses rights-clean semantic fixture requests through operation-core DTOs", () => {
    const requests = loadOperationRequests();

    expect(loadFixtureJson("fixture-manifest.json")).toMatchObject({
      schemaVersion: "contract-fixture-manifest-v1",
      fixtureId: FIXTURE_ID,
      semanticBoundary: {
        rightsCleanJsonOnly: true,
        realImageBytes: false,
        parserOracle: false,
        rendererOracle: false,
        pixelOracle: false,
        cubismCompatibilityOracle: false,
        externalDependency: false
      }
    });
    expect(PackageDocumentSchema.parse(loadFixtureJson("baseline-package.json")).manifest).toMatchObject({
      packageId: "pkg_wave32_warp_lattice2d_contract",
      rightsSummary: { status: "cleared" }
    });
    expect(requests.map((request) => request.operationType)).toEqual([
      "createWarpLattice2dRigControl",
      "bindRigControlChild",
      "addKeyform"
    ]);
    expect(requests[2]?.payload).toMatchObject({
      target: {
        kind: "rigControl",
        id: RIG_CONTROL_ID
      },
      targetProperty: "controlPointOffsets",
      parameterId: PARAMETER_ID,
      compositionMode: "replace"
    });
  });

  it("pins create, bind, keyform, runtime, viewer, validator, and reload evidence", () => {
    const baselineSession = createFixtureSession();
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date(CREATED_AT)
    });
    const outcomes = loadOperationRequests().map((request) => core.commitOperation(session, request));
    const materializedPackage = toPackageDocument(session, loadBaselinePackageDocument(), {
      updatedAt: CREATED_AT
    });
    const reloadedSession = createAuthoringSessionFromPackageDocument(materializedPackage);
    const runtimeEvidence = buildWarpRuntimeEvidence(baselineSession, session);
    const viewerResult = evaluateWarpViewerEvidence(session);
    const validationReport = pinReportId(
      validatePackageRuntime({
        packageDocument: materializedPackage,
        runtimeSnapshot: viewerResult.snapshot,
        viewerEvidence: viewerResult.evidence,
        profile: "viewer",
        createdAt: CREATED_AT
      }),
      "val_wave32_warp_lattice2d_contract_final"
    );

    expect(summarizeOperationChain(outcomes, session)).toEqual(
      loadFixtureJson("expected/operation-chain-summary.json")
    );
    expect(summarizePackageMaterialization(materializedPackage, reloadedSession)).toEqual(
      loadFixtureJson("expected/package-materialization-summary.json")
    );
    expect(summarizeRuntimeViewerEvidence(runtimeEvidence, viewerResult)).toEqual(
      loadFixtureJson("expected/runtime-viewer-evidence-summary.json")
    );
    expect(summarizeValidationReport(validationReport)).toEqual(
      loadFixtureJson("expected/validation-report-summary.json")
    );
    expect(loadFixtureJson("expected/editor-persistence-reinspection-summary.json")).toMatchObject({
      saveLoadContract: {
        operationTypes: [
          "createWarpLattice2dRigControl",
          "bindRigControlChild",
          "addKeyform"
        ],
        persistedRigControlId: RIG_CONTROL_ID,
        persistedDrawableBinding: DRAWABLE_ID,
        persistedKeyformSetId: KEYFORM_SET_ID,
        reinspectPreviewEvidence: true,
        reinspectViewerEvidence: true
      }
    });
  });
});

interface OperationChainSummary {
  readonly schemaVersion: "wave32-warp-lattice2d-operation-chain-summary-v1";
  readonly fixtureId: typeof FIXTURE_ID;
  readonly packageRevisionAfter: number;
  readonly authoringRevisionAfter: number;
  readonly operationLogTypes: readonly string[];
  readonly operations: readonly OperationSummary[];
}

interface OperationSummary {
  readonly operationId: string;
  readonly operationType: string;
  readonly status: string;
  readonly targetIds: readonly string[];
  readonly addedTargets: readonly string[];
  readonly changedTargets: readonly string[];
}

const summarizeOperationChain = (
  outcomes: readonly CommitOperationOutcome[],
  session: AuthoringSession
): OperationChainSummary => ({
  schemaVersion: "wave32-warp-lattice2d-operation-chain-summary-v1",
  fixtureId: FIXTURE_ID,
  packageRevisionAfter: session.packageRevision,
  authoringRevisionAfter: session.authoringRevision,
  operationLogTypes: outcomes.map((outcome) => requireLogEntry(outcome).operationType),
  operations: outcomes.map((outcome) => {
    const logEntry = requireLogEntry(outcome);

    return {
      operationId: outcome.result.operationId,
      operationType: logEntry.operationType,
      status: outcome.result.status,
      targetIds: logEntry.targetIds,
      addedTargets: summarizeTargets(outcome.result.modelDiff?.added),
      changedTargets: summarizeChangedTargets(outcome.result.modelDiff)
    };
  })
});

const requireLogEntry = (outcome: CommitOperationOutcome) => {
  if (outcome.logEntry === undefined) {
    throw new Error(`Expected committed operation ${outcome.result.operationId} to have a log entry.`);
  }

  return outcome.logEntry;
};

const summarizePackageMaterialization = (
  packageDocument: PackageDocumentDto,
  reloadedSession: AuthoringSession
) => {
  const rigControl = packageDocument.model.rigControls.rigControls.find(
    (candidate) => candidate.rigControlId === RIG_CONTROL_ID
  );
  const keyformSet = packageDocument.model.keyforms.keyformSets.find(
    (candidate) => candidate.keyformSetId === KEYFORM_SET_ID
  );

  if (rigControl === undefined || keyformSet === undefined) {
    throw new Error("Wave32 warp lattice materialization fixture lost rig control or keyform.");
  }

  return {
    schemaVersion: "wave32-warp-lattice2d-package-materialization-summary-v1",
    packageId: packageDocument.manifest.packageId,
    packageRevision: packageDocument.manifest.packageRevision,
    updatedAt: packageDocument.manifest.updatedAt,
    rigControl: {
      ...rigControl,
      parentId: rigControl.parentId ?? null
    },
    keyformSet,
    reloadedPackageRevision: reloadedSession.packageRevision,
    reloadedRigControlId:
      reloadedSession.graph.rigControls.find((candidate) => candidate.rigControlId === RIG_CONTROL_ID)
        ?.rigControlId ?? null,
    reloadedKeyformSetId:
      reloadedSession.graph.keyformSets.find((candidate) => candidate.keyformSetId === KEYFORM_SET_ID)
        ?.keyformSetId ?? null,
    rightsCleanJsonOnly: packageDocument.assets.rights.records.every(
      (record) => record.rightsStatus === "cleared"
    )
  };
};

const buildWarpRuntimeEvidence = (
  baselineSession: AuthoringSession,
  candidateSession: AuthoringSession
): RuntimeEvidenceResult =>
  buildRuntimeEvidence({
    baselineGraph: toRuntimeGraph(baselineSession, { packageHash: PACKAGE_HASH }),
    candidateGraph: toRuntimeGraph(candidateSession, { packageHash: PACKAGE_HASH }),
    baseline: {
      frame: createWarpEvaluationFrame(0)
    },
    candidate: {
      frame: createWarpEvaluationFrame(1)
    },
    options: {
      schemaVersion: "runtime-evaluation-options-v1",
      snapshotDetail: "full"
    },
    context: {
      source: { surface: "validator", operationId: "op_wave32_add_control_point_offsets_keyform" },
      policy: { strictness: "strict" }
    },
    artifactLabel: FIXTURE_ID
  });

const evaluateWarpViewerEvidence = (
  session: AuthoringSession
): ViewerRuntimeEvaluationResult =>
  evaluateViewerRuntimeSnapshot(toRuntimeGraph(session, { packageHash: PACKAGE_HASH }), {
    baselineFrameIndex: 20,
    frameIndex: 21,
    operationId: "op_wave32_viewer_warp_lattice2d_evidence",
    strictness: "strict",
    baselineParameterOverrides: {},
    parameterOverrides: {
      [PARAMETER_ID]: 1
    },
    targetIds: [
      DRAWABLE_ID,
      RIG_CONTROL_ID,
      KEYFORM_SET_ID
    ],
    options: {
      schemaVersion: "runtime-evaluation-options-v1",
      snapshotDetail: "full"
    }
  });

const createWarpEvaluationFrame = (frameIndex: number) => ({
  frameIndex,
  deltaTimeMs: 0,
  authoredParameterValues: {
    [PARAMETER_ID]: 1
  },
  targetIds: [
    DRAWABLE_ID,
    RIG_CONTROL_ID,
    KEYFORM_SET_ID
  ]
});

const summarizeRuntimeViewerEvidence = (
  runtimeEvidence: RuntimeEvidenceResult,
  viewerResult: ViewerRuntimeEvaluationResult
) => ({
  schemaVersion: "wave32-warp-lattice2d-runtime-viewer-evidence-summary-v1",
  runtimeEvidence: {
    baselineSnapshotId: runtimeEvidence.baselineSnapshot.snapshotId,
    candidateSnapshotId: runtimeEvidence.candidateSnapshot.snapshotId,
    generatedRuntimeSnapshotIds: runtimeEvidence.generatedRuntimeSnapshotIds,
    candidateRigControl: summarizeRigControl(runtimeEvidence.candidateSnapshot, RIG_CONTROL_ID),
    keyformSample: summarizeKeyformSample(runtimeEvidence.candidateSnapshot),
    runtimeDiff: summarizeRuntimeDiff(runtimeEvidence.runtimeDiff)
  },
  viewerEvidence: {
    surface: viewerResult.evidence.surface,
    baselineSnapshotId: viewerResult.evidence.baselineSnapshotId,
    snapshotId: viewerResult.evidence.snapshotId,
    targetIds: viewerResult.evidence.targetIds,
    parameterOverrides: viewerResult.evidence.parameterOverrides,
    rigControl: summarizeRigControl(viewerResult.snapshot, RIG_CONTROL_ID),
    runtimeDiffEquivalent: viewerResult.evidence.runtimeDiffEquivalent
  },
  semanticBoundary: {
    rendererOracle: false,
    pixelOracle: false,
    cubismCompatibilityOracle: false
  }
});

const summarizeRigControl = (snapshot: RuntimeSnapshotDto, rigControlId: string) => {
  const rigControl = snapshot.rigControls.find((candidate) => candidate.rigControlId === rigControlId);
  if (rigControl === undefined) {
    throw new Error(`Missing rig control evidence for ${rigControlId}.`);
  }

  return {
    rigControlId: rigControl.rigControlId,
    kind: rigControl.kind,
    evaluationStatus: rigControl.evaluationStatus,
    hierarchyIndex: rigControl.hierarchyIndex,
    affectedDrawableIds: rigControl.affectedDrawableIds,
    affectedRigControlIds: rigControl.affectedRigControlIds
  };
};

const summarizeKeyformSample = (snapshot: RuntimeSnapshotDto) => {
  const sample = snapshot.keyformSamples.find(
    (candidate) => candidate.keyformSetId === KEYFORM_SET_ID
  );
  if (sample === undefined) {
    throw new Error(`Missing keyform sample for ${KEYFORM_SET_ID}.`);
  }

  return {
    target: sample.target,
    samplingStatus: sample.samplingStatus,
    statePatch: sample.statePatch
  };
};

const summarizeRuntimeDiff = (runtimeDiff: RuntimeDiffDto) => ({
  schemaVersion: runtimeDiff.schemaVersion,
  beforeSnapshotId: runtimeDiff.beforeSnapshotId,
  afterSnapshotId: runtimeDiff.afterSnapshotId,
  drawableChangeCount: runtimeDiff.drawableChanges.length,
  rigControlChangePaths: runtimeDiff.parameterChanges
    .map((change) => change.path)
    .filter((path) => path.startsWith(`/rigControls/${RIG_CONTROL_ID}`)),
  diagnosticDeltaCount: runtimeDiff.diagnosticDelta.length
});

const summarizeValidationReport = (report: ValidationReportDto) => ({
  schemaVersion: "wave32-warp-lattice2d-validation-report-summary-v1",
  reportId: report.reportId,
  status: report.summary.status,
  highestSeverity: report.summary.highestSeverity,
  counts: report.summary.counts,
  checkIds: report.checks.map((check) => check.checkId),
  runtimeSnapshotIds: report.evidence.runtimeSnapshotIds,
  viewerEvidenceSnapshotId: null,
  operationLogPresent: true,
  operationLogPath: "operations/log.jsonl"
});

const pinReportId = (
  report: ValidationReportDto,
  reportId: ValidationReportId | string
): ValidationReportDto =>
  ValidationReportSchema.parse({
    ...report,
    reportId,
    evidence: {
      ...report.evidence,
      operationLogPresent: true,
      operationLogPath: "operations/log.jsonl"
    }
  });

const summarizeTargets = (targets: readonly TargetRefDto[] | undefined): readonly string[] =>
  (targets ?? []).map(toTargetRefKey);

const summarizeChangedTargets = (modelDiff: ModelDiffDto | undefined): readonly string[] =>
  [...new Set((modelDiff?.changed ?? []).map((change) => toTargetRefKey(change.target)))];

const toTargetRefKey = (target: Pick<TargetRefDto, "kind" | "id" | "path">) =>
  `${target.kind}:${target.id}${target.path === undefined ? "" : `:${target.path}`}`;

const createFixtureSession = (): AuthoringSession =>
  createAuthoringSessionFromPackageDocument(loadBaselinePackageDocument());

const loadBaselinePackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse(loadFixtureJson("baseline-package.json"));

const loadOperationRequests = (): readonly OperationRequestDto[] => [
  OperationRequestSchema.parse(loadFixtureJson("request/create-warp-lattice2d-commit.request.json")),
  OperationRequestSchema.parse(loadFixtureJson("request/bind-warp-lattice2d-drawable-commit.request.json")),
  OperationRequestSchema.parse(loadFixtureJson("request/add-control-point-offsets-keyform-commit.request.json"))
];

const loadFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave32-warp-lattice2d-contract-fixtures"
);
