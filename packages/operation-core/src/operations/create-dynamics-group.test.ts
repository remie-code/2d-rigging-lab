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

const PRESET_DRIVER_ID = "param_face_angle_x";
const PRESET_OUTPUT_ID = "param_hair_front_sway_x";
const UPDATED_PRESET_DRIVER_ID = "param_body_angle_x";
const UPDATED_PRESET_OUTPUT_ID = "param_hair_side_sway_x";

describe("createDynamicsGroup operation", () => {
  it("commits a deterministic dynamics group and exposes input/output parameter evidence", () => {
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
      inputs: [{ parameterId: "param_face_yaw" }],
      outputs: [{ parameterId: "param_hair_sway" }]
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
      outputs: [{ parameterId: "param_hair_sway" }]
    });
    expect(outcome.logEntry?.operationType).toBe("updateDynamicsGroup");
    expect(outcome.logEntry?.targetIds).toEqual(["dyn_hair_sway"]);
  });

  it("allows authored scalar output parameters for additive dynamics", () => {
    const session = createDynamicsFixtureSession({ outputValueSource: "authoredInput" });
    const core = createOperationCore();

    const outcome = core.commitOperation(session, createDynamicsGroupRequest({ dryRun: false }));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.dynamicsGroups).toHaveLength(1);
  });

  it("commits create and update with initialized preset refs from an empty graph", () => {
    const session = createPresetOnlyDynamicsFixtureSession();
    const core = createOperationCore();

    const creation = core.commitOperation(session, createPresetDynamicsGroupRequest());

    expect(creation.result.status).toBe("committed");
    expect(session.graph.parameters).toEqual([]);
    expect(creation.logEntry?.targetIds).toEqual([
      "dyn_preset_hair_sway",
      PRESET_DRIVER_ID,
      PRESET_OUTPUT_ID
    ]);
    expect(getDynamicsGroupById(session.graph, DynamicsGroupIdSchema.parse("dyn_preset_hair_sway")))
      .toMatchObject({
        inputs: [{ parameterId: PRESET_DRIVER_ID }],
        outputs: [{ parameterId: PRESET_OUTPUT_ID }]
      });

    const update = core.commitOperation(session, createPresetDynamicsGroupUpdateRequest());

    expect(update.result.status).toBe("committed");
    expect(session.graph.parameters).toEqual([]);
    expect(update.logEntry?.targetIds).toEqual([
      "dyn_preset_hair_sway",
      UPDATED_PRESET_DRIVER_ID,
      UPDATED_PRESET_OUTPUT_ID
    ]);
    expect(getDynamicsGroupById(session.graph, DynamicsGroupIdSchema.parse("dyn_preset_hair_sway")))
      .toMatchObject({
        inputs: [{ parameterId: UPDATED_PRESET_DRIVER_ID }],
        outputs: [{ parameterId: UPDATED_PRESET_OUTPUT_ID }]
      });
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
    inputs: [
      {
        parameterId: "param_face_yaw",
        kind: "angle",
        scale: 30
      }
    ],
    chain: {
      rootOffset: { x: 0, y: 0 },
      segmentLengths: [14],
      damping: 2.5,
      gravityScale: 1
    },
    ...(options.includeOutput === false
      ? {}
      : {
          outputs: [
            {
              parameterId: "param_hair_sway",
              segmentIndex: 1,
              scale: 0.0333,
              limit: 1
            }
          ]
        }),
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
    enabled: false
  }
});

const createPresetDynamicsGroupRequest = () => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_create_preset_dynamics_group",
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: 0,
  operationType: "createDynamicsGroup",
  payload: {
    dynamicsGroupId: "dyn_preset_hair_sway",
    displayName: "Preset Hair Sway",
    enabled: true,
    inputs: [
      {
        parameterId: PRESET_DRIVER_ID,
        kind: "angle",
        scale: 30
      }
    ],
    chain: {
      rootOffset: { x: 0, y: 0 },
      segmentLengths: [14],
      damping: 2.5,
      gravityScale: 1
    },
    outputs: [
      {
        parameterId: PRESET_OUTPUT_ID,
        segmentIndex: 1,
        scale: 0.0333,
        limit: 1
      }
    ]
  }
});

const createPresetDynamicsGroupUpdateRequest = () => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_update_preset_dynamics_group",
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: 1,
  operationType: "updateDynamicsGroup",
  payload: {
    dynamicsGroupId: "dyn_preset_hair_sway",
    inputs: [
      {
        parameterId: UPDATED_PRESET_DRIVER_ID,
        kind: "angle",
        scale: -15
      }
    ],
    outputs: [
      {
        parameterId: UPDATED_PRESET_OUTPUT_ID,
        segmentIndex: 1,
        scale: -0.025,
        limit: 0.75
      }
    ]
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
        valueSource: options.outputValueSource ?? "authoredInput",
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

const createPresetOnlyDynamicsFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_operation_preset_dynamics_test"),
    packageDisplayName: "Operation Preset Dynamics Test",
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
