import {
  createInitialAuthoringRevision,
  getDynamicsGroupById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DynamicsGroupIdSchema,
  PackageIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "../operation-core.js";
import type { OperationEvidenceProviderInput } from "../operation-evidence-provider.js";

describe("createDynamicsGroup operation", () => {
  it("commits a deterministic dynamics group and exposes driver/output parameter evidence", () => {
    const session = createDynamicsFixtureSession();
    const calls: OperationEvidenceProviderInput[] = [];
    const core = createOperationCore({
      now: () => new Date("2026-05-31T00:00:00.000Z"),
      evidenceProvider: (input) => {
        calls.push(input);
        expect(input.targetIds).toEqual([
          "dyn_hair_sway",
          "param_face_yaw",
          "param_hair_sway"
        ]);
        expect(input.request.operationType).toBe("createDynamicsGroup");

        return {
          runtimeDiff: {
            schemaVersion: "runtime-diff-v1",
            beforeSnapshotId: "snap_before_dynamics",
            afterSnapshotId: "snap_after_dynamics",
            parameterChanges: [],
            dynamicsChanges: [
              {
                dynamicsGroupId: "dyn_hair_sway",
                outputParameterId: "param_hair_sway",
                stateChanged: false,
                outputChanged: true
              }
            ],
            drawableChanges: [],
            diagnosticDelta: []
          },
          generatedRuntimeSnapshotIds: ["snap_after_dynamics"]
        };
      }
    });

    const outcome = core.commitOperation(session, createDynamicsGroupRequest({ dryRun: false }));

    expect(calls).toHaveLength(1);
    expect(outcome.result.status).toBe("committed");
    expect(outcome.result.runtimeDiff?.dynamicsChanges).toEqual([
      {
        dynamicsGroupId: "dyn_hair_sway",
        outputParameterId: "param_hair_sway",
        stateChanged: false,
        outputChanged: true
      }
    ]);
    expect(outcome.logEntry?.runtimeSnapshotIds).toEqual(["snap_after_dynamics"]);
    expect(getDynamicsGroupById(session.graph, DynamicsGroupIdSchema.parse("dyn_hair_sway"))).toMatchObject({
      output: {
        targetParameterId: "param_hair_sway"
      }
    });
  });

  it("rejects createDynamicsGroup without initial output binding before package mutation", () => {
    const session = createDynamicsFixtureSession();
    const core = createOperationCore();

    const outcome = core.commitOperation(
      session,
      createDynamicsGroupRequest({
        dryRun: false,
        includeOutput: false
      })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "operation.createDynamicsGroup.missingOutputBinding"
    ]);
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.graph.dynamicsGroups).toEqual([]);
    expect(outcome.operationLogLength).toBe(0);
  });

  it("updates existing dynamics group metadata without changing bindings", () => {
    const session = createDynamicsFixtureSession();
    const core = createOperationCore();
    core.commitOperation(session, createDynamicsGroupRequest({ dryRun: false }));

    const outcome = core.commitOperation(session, createUpdateDynamicsGroupRequest());

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(2);
    expect(getDynamicsGroupById(session.graph, DynamicsGroupIdSchema.parse("dyn_hair_sway"))).toMatchObject({
      displayName: "Hair Sway Preview",
      enabled: false,
      output: {
        targetParameterId: "param_hair_sway"
      }
    });
    expect(outcome.logEntry?.operationType).toBe("updateDynamicsGroup");
    expect(outcome.logEntry?.targetIds).toEqual(["dyn_hair_sway"]);
  });

  it("rejects non-computed output parameters with an operation diagnostic", () => {
    const session = createDynamicsFixtureSession({ outputValueSource: "authoredInput" });
    const core = createOperationCore();

    const outcome = core.commitOperation(session, createDynamicsGroupRequest({ dryRun: false }));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]?.checkId).toBe(
      "operation.createDynamicsGroup.invalidOutputParameterSource"
    );
    expect(session.graph.dynamicsGroups).toEqual([]);
  });
});

const createDynamicsGroupRequest = (options: {
  readonly dryRun: boolean;
  readonly includeOutput?: boolean;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_create_dynamics_group",
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: 0,
  operationType: "createDynamicsGroup",
  payload: {
    dynamicsGroupId: "dyn_hair_sway",
    displayName: "Hair Sway",
    enabled: true,
    solverKind: "scalarDampedFollowV1",
    resetPolicy: "reset-on-load",
    drivers: [
      {
        sourceParameterId: "param_face_yaw",
        inputScale: 1,
        inputOffset: 0,
        invert: false
      }
    ],
    ...(options.includeOutput === false
      ? {}
      : {
          output: {
            targetParameterId: "param_hair_sway",
            outputScale: 1,
            outputOffset: 0,
            min: -1,
            max: 1,
            clampPolicy: "clamp-to-output-range"
          }
        }),
    settings: {
      stiffness: 0.35,
      damping: 0.7
    }
  }
});

const createUpdateDynamicsGroupRequest = () => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_update_dynamics_group",
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: 1,
  operationType: "updateDynamicsGroup",
  payload: {
    dynamicsGroupId: "dyn_hair_sway",
    displayName: "Hair Sway Preview",
    enabled: false,
    resetPolicy: "reset-on-manual-command"
  }
});

const createDynamicsFixtureSession = (options: {
  readonly outputValueSource?: "authoredInput" | "computedDynamics" | "debugOverride";
} = {}): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_operation_create_dynamics_test"),
    packageDisplayName: "Operation Create Dynamics Test",
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
    parameters: [
      {
        parameterId: ParameterIdSchema.parse("param_face_yaw"),
        displayName: "Face Yaw",
        semanticRole: "face",
        valueSource: "authoredInput",
        min: -1,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      },
      {
        parameterId: ParameterIdSchema.parse("param_hair_sway"),
        displayName: "Hair Sway",
        semanticRole: "dynamics",
        valueSource: options.outputValueSource ?? "computedDynamics",
        min: -1,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      }
    ],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: ["param_face_yaw", "param_hair_sway"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});
