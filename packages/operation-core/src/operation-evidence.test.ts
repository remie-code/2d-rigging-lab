import { createInitialAuthoringRevision, getParameterById } from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { PackageIdSchema, ParameterIdSchema } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "./index.js";
import { OperationEvidenceResultSchema } from "./index.js";
import type {
  OperationEvidenceProviderInput,
  OperationEvidenceResultDto
} from "./index.js";

describe("operation evidence provider hook", () => {
  it("adds dry-run runtime and validation evidence without mutating the original session", () => {
    const session = createFixtureSession();
    const calls: OperationEvidenceProviderInput[] = [];
    const targetParameterId = ParameterIdSchema.parse("param_smile");
    const core = createOperationCore({
      evidenceProvider: (input) => {
        calls.push(input);
        expect(input.lifecycle).toBe("dry_run");
        expect(input.result.status).toBe("dry_run");
        expect(input.targetIds).toEqual(["param_smile"]);
        expect(getParameterById(input.baselineSession.graph, targetParameterId)).toBeUndefined();
        expect(getParameterById(input.candidateSession.graph, targetParameterId)).toBeDefined();

        return createEvidence();
      }
    });

    const result = core.dryRunOperation(session, createParameterRequest({ dryRun: true }));

    expect(calls).toHaveLength(1);
    expect(result.runtimeDiff).toEqual(createEvidence().runtimeDiff);
    expect(result.validationDiff).toEqual(createEvidence().validationDiff);
    expect(result.generatedRuntimeSnapshotIds).toEqual(["snap_baseline", "snap_candidate"]);
    expect(result.generatedRuntimeStateRefs).toEqual([
      "runtime/states/candidate.runtime-state.json"
    ]);
    expect(result.generatedRuntimeStateSequenceRefs).toEqual([
      "runtime/state-sequences/candidate.runtime-state-sequence.json"
    ]);
    expect(result.finalRuntimeState).toEqual(createEvidence().finalRuntimeState);
    expect(result.finalRuntimeStateRef).toBe("runtime/states/candidate.runtime-state.json");
    expect(result.generatedValidationReportIds).toEqual(["val_baseline", "val_candidate"]);
    expect(getParameterById(session.graph, targetParameterId)).toBeUndefined();
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(core.operationLog.entries).toHaveLength(0);
  });

  it("adds commit evidence to the result and operation log entry", () => {
    const session = createFixtureSession();
    const calls: OperationEvidenceProviderInput[] = [];
    const targetParameterId = ParameterIdSchema.parse("param_smile");
    const core = createOperationCore({
      now: () => new Date("2026-05-29T00:00:00.000Z"),
      evidenceProvider: {
        collectOperationEvidence(input) {
          calls.push(input);
          expect(input.lifecycle).toBe("commit");
          expect(input.result.status).toBe("committed");
          expect(getParameterById(input.baselineSession.graph, targetParameterId)).toBeUndefined();
          expect(getParameterById(input.candidateSession.graph, targetParameterId)).toBeDefined();

          return {
            generatedRuntimeSnapshotIds: ["snap_candidate"],
            generatedValidationReportIds: ["val_candidate"]
          };
        }
      }
    });

    const outcome = core.commitOperation(session, createParameterRequest({ dryRun: false }));

    expect(calls).toHaveLength(1);
    expect(outcome.result.status).toBe("committed");
    expect(outcome.result.generatedRuntimeSnapshotIds).toEqual(["snap_candidate"]);
    expect(outcome.result.generatedValidationReportIds).toEqual(["val_candidate"]);
    expect(outcome.logEntry?.result.generatedRuntimeSnapshotIds).toEqual(["snap_candidate"]);
    expect(outcome.logEntry?.result.generatedValidationReportIds).toEqual(["val_candidate"]);
    expect(outcome.logEntry?.runtimeSnapshotIds).toEqual(["snap_candidate"]);
    expect(outcome.logEntry?.validationReportIds).toEqual(["val_candidate"]);
    expect(getParameterById(session.graph, targetParameterId)).toBeDefined();
    expect(core.operationLog.entries).toHaveLength(1);
  });

  it("does not call the provider or mutate/log on duplicate parameter rejection", () => {
    const session = createFixtureSession();
    const calls: OperationEvidenceProviderInput[] = [];
    const core = createOperationCore({
      evidenceProvider: (input) => {
        calls.push(input);
        return createEvidence();
      }
    });

    core.commitOperation(session, createParameterRequest({ dryRun: false }));
    calls.length = 0;
    const revisionAfterFirstCommit = session.authoringRevision;
    const logLengthAfterFirstCommit = core.operationLog.entries.length;

    const duplicate = core.commitOperation(session, createParameterRequest({ dryRun: false }));

    expect(duplicate.result.status).toBe("rejected");
    expect(duplicate.result.diagnostics[0]?.checkId).toBe("operation.createParameter.duplicateParameter");
    expect(calls).toHaveLength(0);
    expect(session.authoringRevision).toBe(revisionAfterFirstCommit);
    expect(core.operationLog.entries).toHaveLength(logLengthAfterFirstCommit);
  });
});

const createEvidence = (): OperationEvidenceResultDto => OperationEvidenceResultSchema.parse({
  runtimeDiff: {
    schemaVersion: "runtime-diff-v1",
    beforeSnapshotId: "snap_baseline",
    afterSnapshotId: "snap_candidate",
    parameterChanges: [
      {
        path: "/parameters/param_smile",
        before: null,
        after: 0
      }
    ],
    dynamicsChanges: [],
    drawableChanges: [],
    diagnosticDelta: []
  },
  validationDiff: {
    schemaVersion: "validation-diff-v1",
    beforeReportId: "val_baseline",
    afterReportId: "val_candidate",
    newFailures: [],
    resolvedFailures: [],
    severityChanges: []
  },
  generatedRuntimeSnapshotIds: ["snap_baseline", "snap_candidate"],
  generatedRuntimeStateRefs: ["runtime/states/candidate.runtime-state.json"],
  generatedRuntimeStateSequenceRefs: [
    "runtime/state-sequences/candidate.runtime-state-sequence.json"
  ],
  finalRuntimeState: {
    schemaVersion: "runtime-state-v1",
    packageId: PackageIdSchema.parse("pkg_operation_evidence_test"),
    packageRevision: 0,
    frameIndex: 1,
    fixedStepMs: 16.6666667,
    accumulatorMs: 0,
    dynamicsGroups: {}
  },
  finalRuntimeStateRef: "runtime/states/candidate.runtime-state.json",
  generatedValidationReportIds: ["val_baseline", "val_candidate"]
});

const createParameterRequest = (options: { readonly dryRun: boolean }) => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_create_smile",
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: 0,
  operationType: "createParameter",
  payload: {
    parameterId: "param_smile",
    displayName: "Smile",
    semanticRole: "mouth",
    min: 0,
    max: 1,
    default: 0,
    recommendedUiStep: 0.01
  }
});

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_operation_evidence_test"),
    packageDisplayName: "Operation Evidence Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: {
      width: 1024,
      height: 1024
    },
    parts: [],
    drawables: [],
    meshes: [],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: [],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});
