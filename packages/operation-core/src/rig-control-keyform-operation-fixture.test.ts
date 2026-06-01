import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthoringSessionFromPackageDocument,
  getKeyformSetById,
  toPackageDocument,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { KeyformSetIdSchema } from "@private-2d-rigging-lab/contracts";
import type {
  DiagnosticDto,
  ModelDiffDto,
  RuntimeDiffDto,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  PackageDocumentSchema,
  parsePackageDocumentFromFileSet,
  serializePackageDocumentToFileSet
} from "../../package-format/src/index.js";
import type {
  KeyformSetDto,
  PackageDocumentDto,
  PackageTextFileEntry
} from "../../package-format/src/index.js";
import {
  buildRuntimeEvidence,
  materializeRuntimeEvidenceArtifacts
} from "../../runtime-core/src/index.js";
import type {
  RuntimeEvidenceArtifact,
  RuntimeEvidenceArtifactsResult
} from "../../runtime-core/src/index.js";
import {
  createOperationCore,
  OperationEvidenceResultSchema,
  OperationRequestSchema,
  parseOperationLogEntriesFromJsonl,
  serializeOperationLogEntriesToJsonl
} from "./index.js";
import type {
  OperationEvidenceProviderInput,
  OperationEvidenceResultDto,
  OperationLogEntryDto,
  OperationResultDto
} from "./index.js";

const FIXTURE_ID = "rig-control-keyform-angle-operation";
const PACKAGE_HASH = "sha256:rig-control-keyform-angle-operation-v1";
const CREATED_AT = "2026-06-01T00:00:00.000Z";
const UPDATED_AT = "2026-06-01T00:01:00.000Z";
const KEYFORM_SET_ID = KeyformSetIdSchema.parse(
  "keyset_rigcontrol_rig_body_rotation_angledegrees_face_yaw_1"
);
const RIG_CONTROL_ID = "rig_body_rotation";
const PARAMETER_ID = "param_face_yaw";
const DRAWABLE_ID = "draw_body";

describe("rig-control-keyform-angle-operation contract fixture", () => {
  it("parses fixture requests through operation-core DTOs", () => {
    expect(
      [
        "request/add-angle-keyform-dry-run.request.json",
        "request/add-angle-keyform-commit.request.json",
        "request/add-angle-keyform-missing-rig-control.request.json",
        "request/add-angle-keyform-unsupported-property.request.json"
      ].map((path) => {
        const request = OperationRequestSchema.parse(loadFixtureJson(path));
        return {
          operationId: request.operationId,
          operationType: request.operationType,
          dryRun: request.dryRun,
          target: request.operationType === "addKeyform" ? request.payload.target : undefined,
          targetProperty: request.operationType === "addKeyform" ? request.payload.targetProperty : undefined
        };
      })
    ).toEqual([
      {
        operationId: "op_fixture_dry_run_add_body_rotation_angle",
        operationType: "addKeyform",
        dryRun: true,
        target: { kind: "rigControl", id: RIG_CONTROL_ID },
        targetProperty: "angleDegrees"
      },
      {
        operationId: "op_fixture_add_body_rotation_angle",
        operationType: "addKeyform",
        dryRun: false,
        target: { kind: "rigControl", id: RIG_CONTROL_ID },
        targetProperty: "angleDegrees"
      },
      {
        operationId: "op_fixture_add_missing_body_rotation_angle",
        operationType: "addKeyform",
        dryRun: false,
        target: { kind: "rigControl", id: "rig_missing_rotation" },
        targetProperty: "angleDegrees"
      },
      {
        operationId: "op_fixture_add_body_rotation_opacity",
        operationType: "addKeyform",
        dryRun: false,
        target: { kind: "rigControl", id: RIG_CONTROL_ID },
        targetProperty: "opacity"
      }
    ]);
  });

  it("keeps dry-run immutable and pins rig control angle runtime evidence refs", () => {
    const baseDocument = loadBaselinePackageDocument();
    const session = createAuthoringSessionFromPackageDocument(baseDocument);
    const capturedEvidence: RuntimeEvidenceArtifactsResult[] = [];
    const core = createOperationCore({
      evidenceProvider: collectRigControlKeyformEvidence(capturedEvidence)
    });

    const result = core.dryRunOperation(session, loadFixtureJson("request/add-angle-keyform-dry-run.request.json"));

    expect(summarizeDryRunResult(result, session, capturedEvidence)).toEqual(
      loadFixtureJson("expected/operation-result-evidence-summary.json")
    );
  });

  it("commits, logs, and materializes rigControl angle keyform evidence", () => {
    const baseDocument = loadBaselinePackageDocument();
    const session = createAuthoringSessionFromPackageDocument(baseDocument);
    const capturedEvidence: RuntimeEvidenceArtifactsResult[] = [];
    const core = createOperationCore({
      now: () => new Date(CREATED_AT),
      evidenceProvider: collectRigControlKeyformEvidence(capturedEvidence)
    });

    const outcome = core.commitOperation(session, loadFixtureJson("request/add-angle-keyform-commit.request.json"));
    const evidence = expectSingleRuntimeEvidence(capturedEvidence);
    const operationLogText = serializeOperationLogEntriesToJsonl(core.operationLog.entries);
    const parsedLogEntries = parseOperationLogEntriesFromJsonl(operationLogText);
    const savedDocument = toPackageDocument(session, baseDocument, { updatedAt: UPDATED_AT });
    const generatedArtifacts = toPackageFileEntries(evidence.artifacts);
    const fileSet = serializePackageDocumentToFileSet(savedDocument, {
      operationLogText,
      generatedArtifacts
    });
    const reloadedDocument = parsePackageDocumentFromFileSet(fileSet);

    expect(summarizePackageMaterialization({
      outcome,
      session,
      operationLogText,
      parsedLogEntries,
      savedDocument,
      reloadedDocument,
      fileSet,
      runtimeArtifacts: evidence.artifacts
    })).toEqual(loadFixtureJson("expected/package-materialization-summary.json"));
  });

  it("pins missing rig-control and unsupported property diagnostics", () => {
    expect(
      [
        "request/add-angle-keyform-missing-rig-control.request.json",
        "request/add-angle-keyform-unsupported-property.request.json"
      ].map((requestPath) => {
        const session = createAuthoringSessionFromPackageDocument(loadBaselinePackageDocument());
        const core = createOperationCore();
        const outcome = core.commitOperation(session, loadFixtureJson(requestPath));

        return summarizeRejectedOutcome(requestPath, outcome.result, session, core.operationLog.entries.length);
      })
    ).toEqual(loadFixtureJson("expected/negative-diagnostics-summary.json"));
  });
});

const collectRigControlKeyformEvidence = (
  artifacts: RuntimeEvidenceArtifactsResult[]
) => (input: OperationEvidenceProviderInput): OperationEvidenceResultDto => {
  if (
    input.request.operationType !== "addKeyform" ||
    input.request.payload.target.kind !== "rigControl" ||
    input.request.payload.targetProperty !== "angleDegrees"
  ) {
    return OperationEvidenceResultSchema.parse({});
  }

  const runtimeEvidence = materializeRuntimeEvidenceArtifacts(
    buildRuntimeEvidence({
      baselineGraph: toRuntimeGraph(input.baselineSession, { packageHash: PACKAGE_HASH }),
      candidateGraph: toRuntimeGraph(input.candidateSession, { packageHash: PACKAGE_HASH }),
      baseline: {
        frame: createEvaluationFrame(0)
      },
      candidate: {
        frame: createEvaluationFrame(1)
      },
      options: {
        schemaVersion: "runtime-evaluation-options-v1",
        snapshotDetail: "full"
      },
      context: {
        source: { surface: "validator", operationId: input.result.operationId },
        policy: { strictness: input.lifecycle === "dry_run" ? "interactive" : "strict" }
      },
      artifactLabel: FIXTURE_ID
    })
  );

  artifacts.push(runtimeEvidence);

  return OperationEvidenceResultSchema.parse({
    runtimeDiff: runtimeEvidence.evidence.runtimeDiff,
    generatedRuntimeSnapshotIds: runtimeEvidence.evidence.generatedRuntimeSnapshotIds,
    generatedRuntimeStateRefs: runtimeEvidence.evidence.generatedRuntimeStateRefs,
    generatedRuntimeStateSequenceRefs: runtimeEvidence.evidence.generatedRuntimeStateSequenceRefs,
    finalRuntimeState: runtimeEvidence.evidence.finalRuntimeState,
    finalRuntimeStateRef: runtimeEvidence.evidence.finalRuntimeStateRef
  });
};

const createEvaluationFrame = (frameIndex: number) => ({
  frameIndex,
  deltaTimeMs: 0,
  authoredParameterValues: {
    [PARAMETER_ID]: 1
  },
  targetIds: [
    RIG_CONTROL_ID,
    DRAWABLE_ID
  ]
});

const summarizeDryRunResult = (
  result: OperationResultDto,
  session: AuthoringSession,
  capturedEvidence: readonly RuntimeEvidenceArtifactsResult[]
) => ({
  schemaVersion: "rig-control-keyform-angle-operation-result-summary-v1",
  operationId: result.operationId,
  status: result.status,
  preconditionOk: result.precondition.ok,
  checkedTargetRefs: result.precondition.checkedTargetRefs.map(toTargetRefKey),
  modelDiff: summarizeModelDiff(result.modelDiff),
  runtimeDiff: summarizeRuntimeDiff(result.runtimeDiff),
  generatedRuntimeSnapshotIds: result.generatedRuntimeSnapshotIds,
  generatedRuntimeStateRefs: result.generatedRuntimeStateRefs,
  generatedRuntimeStateSequenceRefs: result.generatedRuntimeStateSequenceRefs,
  finalRuntimeStateRef: result.finalRuntimeStateRef,
  capturedRuntimeArtifactCount: capturedEvidence.flatMap((evidence) => evidence.artifacts).length,
  originalPackageRevisionAfter: session.packageRevision,
  originalAuthoringRevisionAfter: session.authoringRevision,
  originalDirtyAfter: session.dirty
});

const summarizePackageMaterialization = (input: {
  readonly outcome: ReturnType<ReturnType<typeof createOperationCore>["commitOperation"]>;
  readonly session: AuthoringSession;
  readonly operationLogText: string;
  readonly parsedLogEntries: readonly OperationLogEntryDto[];
  readonly savedDocument: PackageDocumentDto;
  readonly reloadedDocument: PackageDocumentDto;
  readonly fileSet: readonly PackageTextFileEntry[];
  readonly runtimeArtifacts: readonly RuntimeEvidenceArtifact[];
}) => {
  const logEntry = input.outcome.logEntry;
  if (logEntry === undefined) {
    throw new Error("Committed rig control keyform fixture requires an operation log entry.");
  }

  const keyformSet = getKeyformSetById(input.session.graph, KEYFORM_SET_ID);
  const materializedKeyforms = readPackageFile(input.fileSet, "model/keyforms.json") as {
    readonly keyformSets: readonly KeyformSetDto[];
  };

  return {
    schemaVersion: "rig-control-keyform-angle-package-materialization-summary-v1",
    operationId: input.outcome.result.operationId,
    status: input.outcome.result.status,
    operationLogLength: input.parsedLogEntries.length,
    packageRevisionAfter: input.session.packageRevision,
    authoringRevisionAfter: input.session.authoringRevision,
    committedKeyformSet: summarizeKeyformSet(expectKeyformSet(keyformSet)),
    modelDiff: summarizeModelDiff(input.outcome.result.modelDiff),
    logEntry: {
      operationType: logEntry.operationType,
      targetIds: logEntry.targetIds,
      checkedTargetRefs: logEntry.precondition.checkedTargetRefs.map(toTargetRefKey),
      payloadTarget: logEntry.payload.operationType === "addKeyform"
        ? {
            ...logEntry.payload.payload.target,
            targetProperty: logEntry.payload.payload.targetProperty
          }
        : undefined,
      resultRuntimeDiff: summarizeRuntimeDiff(logEntry.result.runtimeDiff),
      runtimeSnapshotIds: logEntry.runtimeSnapshotIds,
      validationReportIds: logEntry.validationReportIds
    },
    materializedPackage: {
      packageRevision: input.savedDocument.manifest.packageRevision,
      updatedAt: input.savedDocument.manifest.updatedAt,
      reloadedPackageRevision: input.reloadedDocument.manifest.packageRevision,
      keyformsFilePath: input.savedDocument.manifest.modelFiles.keyforms,
      operationLogPath: input.savedDocument.manifest.operationLog,
      operationLogTrailingNewline: input.operationLogText.endsWith("\n"),
      operationLogEntryPresent: input.fileSet.some((entry) => entry.path === input.savedDocument.manifest.operationLog),
      fileSetEntryCount: input.fileSet.length,
      generatedArtifactPaths: input.runtimeArtifacts.map((artifact) => artifact.path),
      materializedKeyformSet: summarizeKeyformSet(expectKeyformSet(materializedKeyforms.keyformSets[0])),
      reloadedKeyformSet: summarizeKeyformSet(expectKeyformSet(input.reloadedDocument.model.keyforms.keyformSets[0]))
    }
  };
};

const summarizeRejectedOutcome = (
  requestPath: string,
  result: OperationResultDto,
  session: AuthoringSession,
  operationLogLength: number
) => ({
  requestPath,
  status: result.status,
  preconditionOk: result.precondition.ok,
  diagnostics: result.diagnostics.map(summarizeDiagnostic),
  operationLogLength,
  packageRevisionAfter: session.packageRevision,
  authoringRevisionAfter: session.authoringRevision,
  keyformSetCountAfter: session.graph.keyformSets.length
});

const summarizeDiagnostic = (diagnostic: DiagnosticDto) => ({
  checkId: diagnostic.checkId,
  target: toTargetRefKey(diagnostic.target),
  message: diagnostic.message
});

const summarizeModelDiff = (modelDiff: ModelDiffDto | undefined) => {
  if (modelDiff === undefined) {
    throw new Error("Expected modelDiff evidence.");
  }

  return {
    baseRevision: modelDiff.baseRevision,
    candidateRevision: modelDiff.candidateRevision,
    added: modelDiff.added.map(toTargetRefKey),
    removed: modelDiff.removed.map(toTargetRefKey),
    changedTargets: modelDiff.changed.map((change) => toTargetRefKey(change.target)),
    targetFieldAfter: modelDiff.changed
      .flatMap((change) => change.fields)
      .find((field) => field.path.endsWith("/target"))?.after,
    operationIds: modelDiff.operationIds
  };
};

const summarizeRuntimeDiff = (runtimeDiff: RuntimeDiffDto | undefined) => {
  if (runtimeDiff === undefined) {
    throw new Error("Expected runtimeDiff evidence.");
  }

  const angleChange = runtimeDiff.parameterChanges.find(
    (change) => change.path === `/rigControls/${RIG_CONTROL_ID}/localTransform/angleDegrees`
  );
  const worldAngleChange = runtimeDiff.parameterChanges.find(
    (change) => change.path === `/rigControls/${RIG_CONTROL_ID}/worldTransform/angleDegrees`
  );

  return {
    beforeSnapshotId: runtimeDiff.beforeSnapshotId,
    afterSnapshotId: runtimeDiff.afterSnapshotId,
    parameterChangePaths: runtimeDiff.parameterChanges.map((change) => change.path),
    angleChange: angleChange === undefined
      ? undefined
      : {
          before: angleChange.before,
          after: angleChange.after
        },
    worldAngleChange: worldAngleChange === undefined
      ? undefined
      : {
          before: worldAngleChange.before,
          after: worldAngleChange.after
        },
    drawableChanges: runtimeDiff.drawableChanges.map((change) => ({
      drawableId: change.drawableId,
      boundsChanged: change.boundsChanged,
      vertexHashBefore: change.vertexHashBefore,
      vertexHashAfter: change.vertexHashAfter
    })),
    diagnosticDeltaCheckIds: runtimeDiff.diagnosticDelta.map((diagnostic) => diagnostic.checkId)
  };
};

const summarizeKeyformSet = (keyformSet: KeyformSetDto) => {
  if (keyformSet.evaluator !== "linear-1d-v1") {
    throw new Error(`Expected linear rig control keyform set, got ${keyformSet.evaluator}.`);
  }

  return {
    keyformSetId: keyformSet.keyformSetId,
    target: keyformSet.target,
    parameterId: keyformSet.parameterId,
    evaluator: keyformSet.evaluator,
    interpolation: keyformSet.interpolation,
    compositionMode: keyformSet.compositionMode,
    keys: keyformSet.keys
  };
};

const toPackageFileEntries = (
  artifacts: readonly RuntimeEvidenceArtifact[]
): readonly PackageTextFileEntry[] =>
  artifacts.map((artifact) => ({
    path: artifact.path,
    text: artifact.content
  }));

const readPackageFile = (
  fileSet: readonly PackageTextFileEntry[],
  path: string
): unknown => {
  const entry = fileSet.find((candidate) => candidate.path === path);
  if (entry === undefined) {
    throw new Error(`Expected materialized package file ${path}.`);
  }

  return JSON.parse(entry.text) as unknown;
};

const expectSingleRuntimeEvidence = (
  artifacts: readonly RuntimeEvidenceArtifactsResult[]
): RuntimeEvidenceArtifactsResult => {
  expect(artifacts).toHaveLength(1);
  const artifact = artifacts[0];
  if (artifact === undefined) {
    throw new Error("Expected one runtime evidence artifact set.");
  }

  return artifact;
};

const expectKeyformSet = (keyformSet: KeyformSetDto | undefined): KeyformSetDto => {
  if (keyformSet === undefined) {
    throw new Error("Expected rig control keyform set evidence.");
  }

  return keyformSet;
};

const toTargetRefKey = (target: Pick<TargetRefDto, "kind" | "id" | "path">) =>
  `${target.kind}:${target.id}${target.path === undefined ? "" : `:${target.path}`}`;

const loadBaselinePackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse(loadFixtureJson("baseline-package.json"));

const loadFixtureJson = (relativePath: string): any =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/rig-control-keyform-angle-operation"
);
