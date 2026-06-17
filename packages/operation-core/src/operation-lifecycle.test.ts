import {
  createInitialAuthoringRevision,
  getDynamicsGroupById,
  getMeshById,
  getKeyformSetById,
  getParameterById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  ProvenanceIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "./index.js";
import type { OperationLogEntryDto } from "./operation-log-entry.js";

describe("operation lifecycle foundation", () => {
  it("dry-runs createParameter without mutating the original session", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const result = core.dryRunOperation(session, createParameterRequest({ dryRun: true }));

    expect(result.status).toBe("dry_run");
    expect(result.operationId).toBe("op_create_smile");
    expect(result.modelDiff?.added).toEqual([{ kind: "parameter", id: "param_smile" }]);
    expect(result.modelDiff?.operationIds).toEqual(["op_create_smile"]);
    expect(getParameterById(session.graph, ParameterIdSchema.parse("param_smile"))).toBeUndefined();
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(core.operationLog.entries).toHaveLength(0);
  });

  it("commits createParameter and appends an operation log entry", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-05-29T00:00:00.000Z")
    });

    const outcome = core.commitOperation(session, createParameterRequest({ dryRun: false }));

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
    expect(getParameterById(session.graph, ParameterIdSchema.parse("param_smile"))?.displayName).toBe("Smile");
    expect(outcome.operationLogLength).toBe(1);
    expect(core.operationLog.entries).toHaveLength(1);

    const logEntry = outcome.logEntry;
    expect(logEntry).toBeDefined();
    expect(logEntry?.operationId).toBe("op_create_smile");
    expect(logEntry?.transactionId).toBe("txn_create_smile");
    expect(logEntry?.actor).toBe("test");
    expect(logEntry?.surface).toBe("testFixture");
    expect(logEntry?.payload.operationType).toBe("createParameter");
    expect(logEntry?.result.status).toBe("committed");
    expect(logEntry?.targetIds).toEqual(["param_smile"]);
    expect(logEntry?.provenanceId).toBe("prov_create_smile");
  });

  it("dry-runs addKeyform through the registry without mutating the original session", () => {
    const session = createKeyformFixtureSession();
    const core = createOperationCore();
    const keyformSetId = expectedLinearKeyformSetId();

    const result = core.dryRunOperation(session, createAddKeyformRequest({ dryRun: true }));

    expect(result.status).toBe("dry_run");
    expect(result.operationId).toBe("op_add_keyform_body_yaw");
    expect(result.modelDiff?.added).toEqual([{ kind: "keyformSet", id: keyformSetId }]);
    expect(getKeyformSetById(session.graph, keyformSetId)).toBeUndefined();
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(core.operationLog.entries).toHaveLength(0);
  });

  it("commits addKeyform through the registry and logs keyform precondition refs", () => {
    const session = createKeyformFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-05-29T00:02:00.000Z")
    });
    const keyformSetId = expectedLinearKeyformSetId();

    const outcome = core.commitOperation(session, createAddKeyformRequest({ dryRun: false }));

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
    expect(getKeyformSetById(session.graph, keyformSetId)).toMatchObject({
      keyformSetId,
      target: {
        kind: "mesh",
        id: "mesh_body",
        property: "vertices"
      },
      parameterId: "param_face_yaw"
    });
    expect(outcome.operationLogLength).toBe(1);
    expect(core.operationLog.entries).toHaveLength(1);
    expect(outcome.logEntry?.operationType).toBe("addKeyform");
    expect(outcome.logEntry?.targetIds).toEqual([
      keyformSetId,
      "param_face_yaw",
      "mesh_body"
    ]);
    expect(outcome.logEntry?.result.modelDiff).toEqual(outcome.result.modelDiff);
    expect(outcome.logEntry?.precondition.checkedTargetRefs).toEqual([
      { kind: "keyformSet", id: keyformSetId },
      { kind: "parameter", id: "param_face_yaw" },
      { kind: "mesh", id: "mesh_body" }
    ]);
  });

  it("dry-runs addKeyformGrid2d through the registry without mutating the original session", () => {
    const session = createKeyformFixtureSession();
    const core = createOperationCore();
    const keyformSetId = expectedGridKeyformSetId();

    const result = core.dryRunOperation(session, createAddKeyformGrid2dRequest({ dryRun: true }));

    expect(result.status).toBe("dry_run");
    expect(result.operationId).toBe("op_add_keyform_grid_body");
    expect(result.modelDiff?.added).toEqual([{ kind: "keyformSet", id: keyformSetId }]);
    expect(getKeyformSetById(session.graph, keyformSetId)).toBeUndefined();
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(core.operationLog.entries).toHaveLength(0);
  });

  it("commits addKeyformGrid2d through the registry and does not record non-parameters as parameter refs", () => {
    const session = createKeyformFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-05-29T00:03:00.000Z")
    });
    const keyformSetId = expectedGridKeyformSetId();

    const outcome = core.commitOperation(session, createAddKeyformGrid2dRequest({ dryRun: false }));

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
    expect(getKeyformSetById(session.graph, keyformSetId)).toMatchObject({
      keyformSetId,
      target: {
        kind: "mesh",
        id: "mesh_body",
        property: "vertices"
      },
      parameterX: "param_face_yaw",
      parameterY: "param_face_pitch"
    });
    expect(outcome.operationLogLength).toBe(1);
    expect(core.operationLog.entries).toHaveLength(1);
    expect(outcome.logEntry?.operationType).toBe("addKeyformGrid2d");
    expect(outcome.logEntry?.targetIds).toEqual([
      keyformSetId,
      "mesh_body",
      "param_face_yaw",
      "param_face_pitch"
    ]);
    expect(outcome.logEntry?.result.modelDiff).toEqual(outcome.result.modelDiff);
    expect(outcome.logEntry?.precondition.checkedTargetRefs).toEqual([
      { kind: "keyformSet", id: keyformSetId },
      { kind: "parameter", id: "param_face_yaw" },
      { kind: "parameter", id: "param_face_pitch" },
      { kind: "mesh", id: "mesh_body" }
    ]);
  });

  it("hydrates initial operation log entries defensively", () => {
    const initialEntry = createCommittedLogEntry();
    const initialEntries = [initialEntry];
    const core = createOperationCore({
      initialOperationLogEntries: initialEntries
    });

    initialEntries.splice(0, initialEntries.length);
    initialEntry.targetIds.push("param_mutated");

    expect(core.operationLog.entries).toHaveLength(1);
    expect(core.operationLog.entries[0]?.operationId).toBe("op_create_smile");
    expect(core.operationLog.entries[0]?.targetIds).toEqual(["param_smile"]);
  });

  it("appends new commits after hydrated operation log entries", () => {
    const session = createFixtureSession({ packageRevision: 1 });
    const core = createOperationCore({
      initialOperationLogEntries: [createCommittedLogEntry()],
      now: () => new Date("2026-05-29T00:01:00.000Z")
    });

    const outcome = core.commitOperation(
      session,
      createParameterRequest({
        dryRun: false,
        basePackageRevision: 1,
        operationId: "op_create_frown",
        parameterId: "param_frown",
        displayName: "Frown"
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(outcome.operationLogLength).toBe(2);
    expect(core.operationLog.entries.map((entry) => entry.operationId)).toEqual([
      "op_create_smile",
      "op_create_frown"
    ]);
  });

  it("rejects invalid hydrated operation log entries", () => {
    expect(() =>
      createOperationCore({
        initialOperationLogEntries: [{} as OperationLogEntryDto]
      })
    ).toThrow();
  });

  it("rejects a stale base package revision before mutation or log append", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const outcome = core.commitOperation(
      session,
      createParameterRequest({ dryRun: false, basePackageRevision: 1 })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]?.checkId).toBe("operation.request.baseRevision");
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(getParameterById(session.graph, ParameterIdSchema.parse("param_smile"))).toBeUndefined();
    expect(outcome.operationLogLength).toBe(0);
    expect(core.operationLog.entries).toHaveLength(0);
  });

  it("rejects duplicate parameters without mutating or appending a log entry", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    core.commitOperation(session, createParameterRequest({ dryRun: false }));
    const packageRevisionAfterFirstCommit = session.packageRevision;
    const revisionAfterFirstCommit = session.authoringRevision;
    const logLengthAfterFirstCommit = core.operationLog.entries.length;
    const duplicate = core.commitOperation(
      session,
      createParameterRequest({
        dryRun: false,
        basePackageRevision: packageRevisionAfterFirstCommit
      })
    );

    expect(duplicate.result.status).toBe("rejected");
    expect(duplicate.result.precondition.ok).toBe(false);
    expect(duplicate.result.diagnostics[0]?.checkId).toBe("operation.createParameter.duplicateParameter");
    expect(session.packageRevision).toBe(packageRevisionAfterFirstCommit);
    expect(session.authoringRevision).toBe(revisionAfterFirstCommit);
    expect(core.operationLog.entries).toHaveLength(logLengthAfterFirstCommit);
  });

  it("rejects registered generateMesh precondition failures without mutation or log append", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const rejected = core.commitOperation(session, createGenerateMeshMissingDrawableRequest());

    expect(rejected.result.status).toBe("rejected");
    expect(rejected.result.diagnostics[0]?.checkId).toBe("operation.generateMesh.missingDrawable");
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(rejected.operationLogLength).toBe(0);
    expect(core.operationLog.entries).toHaveLength(0);
  });

  it("commits moveMeshVertex through the registry and appends an operation log entry", () => {
    const session = createKeyformFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-05-29T00:04:00.000Z")
    });

    const outcome = core.commitOperation(session, createMoveMeshVertexRequest({ dryRun: false }));

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
    expect(getMeshById(session.graph, MeshIdSchema.parse("mesh_body"))?.vertices[1]).toEqual({
      x: 3,
      y: -0.5
    });
    expect(outcome.operationLogLength).toBe(1);
    expect(outcome.logEntry?.operationType).toBe("moveMeshVertex");
    expect(outcome.logEntry?.targetIds).toEqual(["mesh_body", "vtx_body_1"]);
    expect(outcome.logEntry?.result.modelDiff).toEqual(outcome.result.modelDiff);
    expect(outcome.logEntry?.precondition.checkedTargetRefs).toEqual([
      { kind: "mesh", id: "mesh_body" },
      { kind: "drawable", id: "draw_body" },
      { kind: "vertex", id: "vtx_body_1", path: "/model/meshes/mesh_body/vertices/1" }
    ]);
  });

  it("rejects empty moveMeshVertex deltas with the operation-specific diagnostic", () => {
    const session = createKeyformFixtureSession();
    const core = createOperationCore();

    const outcome = core.commitOperation(
      session,
      createMoveMeshVertexRequest({
        dryRun: false,
        vertexDeltas: []
      })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "operation.moveMeshVertex.emptyDelta"
    ]);
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(outcome.operationLogLength).toBe(0);
    expect(core.operationLog.entries).toHaveLength(0);
  });

  it("commits createDynamicsGroup through the registry and logs dynamics parameter refs", () => {
    const session = createDynamicsFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-05-29T00:05:00.000Z")
    });

    const outcome = core.commitOperation(session, createDynamicsGroupRequest({ dryRun: false }));

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
    expect(getDynamicsGroupById(session.graph, DynamicsGroupIdSchema.parse("dyn_hair_sway"))).toMatchObject({
      dynamicsGroupId: "dyn_hair_sway",
      inputs: [{ parameterId: "param_face_yaw" }],
      outputs: [{ parameterId: "param_hair_sway" }]
    });
    expect(outcome.operationLogLength).toBe(1);
    expect(core.operationLog.entries).toHaveLength(1);
    expect(outcome.logEntry?.operationType).toBe("createDynamicsGroup");
    expect(outcome.logEntry?.targetIds).toEqual([
      "dyn_hair_sway",
      "param_face_yaw",
      "param_hair_sway"
    ]);
    expect(outcome.logEntry?.precondition.checkedTargetRefs).toEqual([
      { kind: "dynamicsGroup", id: "dyn_hair_sway" },
      {
        kind: "parameter",
        id: "param_face_yaw",
        path: "/model/dynamics/dynamicsGroups/dyn_hair_sway/inputs/0/parameterId"
      },
      {
        kind: "parameter",
        id: "param_hair_sway",
        path: "/model/dynamics/dynamicsGroups/dyn_hair_sway/outputs/0/parameterId"
      }
    ]);
  });

  it("dry-runs createDynamicsGroup without mutating the original session", () => {
    const session = createDynamicsFixtureSession();
    const core = createOperationCore();

    const result = core.dryRunOperation(session, createDynamicsGroupRequest({ dryRun: true }));

    expect(result.status).toBe("dry_run");
    expect(result.modelDiff?.added).toEqual([{ kind: "dynamicsGroup", id: "dyn_hair_sway" }]);
    expect(getDynamicsGroupById(session.graph, DynamicsGroupIdSchema.parse("dyn_hair_sway"))).toBeUndefined();
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(core.operationLog.entries).toHaveLength(0);
  });

  it("commits deleteDynamicsGroup through the registry and logs the removal", () => {
    const session = createDynamicsFixtureSession();
    const core = createOperationCore();
    core.commitOperation(session, createDynamicsGroupRequest({ dryRun: false }));

    const deletion = core.commitOperation(session, createDeleteDynamicsGroupRequest());

    expect(deletion.result.status).toBe("committed");
    expect(session.packageRevision).toBe(2);
    expect(session.authoringRevision).toBe(2);
    expect(getDynamicsGroupById(session.graph, DynamicsGroupIdSchema.parse("dyn_hair_sway"))).toBeUndefined();
    expect(deletion.operationLogLength).toBe(2);
    expect(core.operationLog.entries.at(-1)?.operationType).toBe("deleteDynamicsGroup");
  });
});

const createParameterRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
  readonly operationId?: string;
  readonly parameterId?: string;
  readonly displayName?: string;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: options.operationId ?? "op_create_smile",
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "createParameter",
  payload: {
    parameterId: options.parameterId ?? "param_smile",
    displayName: options.displayName ?? "Smile",
    semanticRole: "mouth",
    min: 0,
    max: 1,
    default: 0,
    recommendedUiStep: 0.01
  }
});

const createCommittedLogEntry = (): OperationLogEntryDto => {
  const session = createFixtureSession();
  const core = createOperationCore({
    now: () => new Date("2026-05-29T00:00:00.000Z")
  });
  const outcome = core.commitOperation(session, createParameterRequest({ dryRun: false }));

  if (outcome.logEntry === undefined) {
    throw new Error("Expected committed operation to produce a log entry.");
  }

  return outcome.logEntry;
};

const createGenerateMeshMissingDrawableRequest = () => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_generate_mesh",
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: 0,
  operationType: "generateMesh",
  payload: {
    drawableId: "draw_missing",
    method: "manual-empty"
  }
});

const createMoveMeshVertexRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
  readonly vertexDeltas?: readonly {
    readonly vertexId: string;
    readonly delta: { readonly x: number; readonly y: number };
  }[];
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_move_mesh_vertex",
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "moveMeshVertex",
  payload: {
    meshId: "mesh_body",
    vertexDeltas: options.vertexDeltas ?? [
      {
        vertexId: "vtx_body_1",
        delta: { x: 2, y: -0.5 }
      }
    ],
    intent: "supported lifecycle regression fixture"
  }
});

const createDynamicsGroupRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_create_dynamics_group",
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "createDynamicsGroup",
  payload: {
    dynamicsGroupId: "dyn_hair_sway",
    displayName: "Hair Sway",
    enabled: true,
    inputs: [
      {
        parameterId: "param_face_yaw",
        kind: "angle",
        influencePercent: 100,
        invert: false,
        normalization: {
          min: -1,
          center: 0,
          max: 1
        }
      }
    ],
    pendulums: [
      {
        length: 1,
        sway: 0.35,
        reactionSpeed: 8,
        convergenceSpeed: 4
      }
    ],
    outputs: [
      {
        parameterId: "param_hair_sway",
        kind: "angle",
        strength: 1,
        invert: false,
        limit: 1
      }
    ]
  }
});

const createDeleteDynamicsGroupRequest = () => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_delete_dynamics_group",
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: 1,
  operationType: "deleteDynamicsGroup",
  payload: {
    dynamicsGroupId: "dyn_hair_sway"
  }
});

const createAddKeyformRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_add_keyform_body_yaw",
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "addKeyform",
  payload: {
    target: {
      kind: "mesh",
      id: "mesh_body"
    },
    targetProperty: "vertices",
    parameterId: "param_face_yaw",
    keyValue: 1,
    interpolation: "linear-1d-v1",
    statePatch: {
      propertyPath: "vertices",
      value: [{ x: 2, y: 0 }]
    }
  }
});

const createAddKeyformGrid2dRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_add_keyform_grid_body",
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "addKeyformGrid2d",
  payload: {
    target: {
      kind: "mesh",
      id: "mesh_body"
    },
    targetProperty: "vertices",
    parameterX: "param_face_yaw",
    parameterY: "param_face_pitch",
    evaluator: "parameter-grid-2d-v1",
    interpolation: "bilinear-grid-v1",
    clampPolicy: "clamp-to-parameter-range",
    keys: [
      { x: -1, y: -1, statePatch: [{ x: -1, y: 0 }] },
      { x: 1, y: 1, statePatch: [{ x: 1, y: 0 }] }
    ]
  }
});

const expectedLinearKeyformSetId = () =>
  KeyformSetIdSchema.parse("keyset_mesh_mesh_body_vertices_face_yaw_1");

const expectedGridKeyformSetId = () =>
  KeyformSetIdSchema.parse("keyset_grid_mesh_mesh_body_vertices_face_yaw_face_pitch");

const createFixtureSession = (options: {
  readonly packageRevision?: number;
} = {}): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_operation_lifecycle_test"),
    packageDisplayName: "Operation Lifecycle Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: options.packageRevision ?? 0,
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

const createKeyformFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_operation_keyform_lifecycle_test"),
    packageDisplayName: "Operation Keyform Lifecycle Test",
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
    meshes: [
      {
        meshId: MeshIdSchema.parse("mesh_body"),
        drawableId: DrawableIdSchema.parse("draw_body"),
        vertices: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ],
        uvs: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ],
        triangles: [[0, 1, 2]],
        vertexStableIds: ["vtx_body_0", "vtx_body_1", "vtx_body_2"],
        bounds: {
          x: 0,
          y: 0,
          width: 1,
          height: 1
        },
        generationProvenanceId: ProvenanceIdSchema.parse("prov_mesh_body")
      }
    ],
    parameters: [
      createTestParameter("param_face_yaw", "Face Yaw"),
      createTestParameter("param_face_pitch", "Face Pitch")
    ],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: ["mesh_body", "param_face_yaw", "param_face_pitch"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createDynamicsFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_operation_dynamics_lifecycle_test"),
    packageDisplayName: "Operation Dynamics Lifecycle Test",
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
      createTestParameter("param_face_yaw", "Face Yaw"),
      {
        parameterId: ParameterIdSchema.parse("param_hair_sway"),
        displayName: "Hair Sway",
        semanticRole: "dynamics",
        valueSource: "computedDynamics",
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

const createTestParameter = (
  parameterId: string,
  displayName: string
): AuthoringSession["graph"]["parameters"][number] => ({
  parameterId: ParameterIdSchema.parse(parameterId),
  displayName,
  semanticRole: "face",
  valueSource: "authoredInput",
  min: -1,
  max: 1,
  default: 0,
  recommendedUiStep: 0.01
});
