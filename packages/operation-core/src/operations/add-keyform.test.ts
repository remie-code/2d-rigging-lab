import {
  createInitialAuthoringRevision,
  getKeyformSetById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  ProvenanceIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { OperationId } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import { addKeyformOperationHandler } from "./add-keyform.js";

describe("addKeyform operation handler", () => {
  it("dry-runs addKeyform on a cloned session without mutating the original", () => {
    const session = createFixtureSession();
    const request = createAddKeyformRequest({ dryRun: true });
    const operationId = getRequestOperationId(request);

    const outcome = addKeyformOperationHandler.dryRun(session, request, operationId);

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(getKeyformSetById(session.graph, expectedKeyformSetId())).toBeUndefined();
    expect(getKeyformSetById(outcome.candidateSession.graph, expectedKeyformSetId())).toEqual(
      expect.objectContaining({
        target: {
          kind: "mesh",
          id: "mesh_body",
          property: "vertices"
        },
        parameterId: "param_face_yaw",
        keys: [
          {
            value: 1,
            statePatch: [{ x: 2, y: 0 }]
          }
        ]
      })
    );
    expect(outcome.targetIds).toEqual([
      "keyset_mesh_mesh_body_vertices_face_yaw_1",
      "param_face_yaw",
      "mesh_body"
    ]);
    expect(outcome.result.modelDiff?.added).toEqual([
      { kind: "keyformSet", id: "keyset_mesh_mesh_body_vertices_face_yaw_1" }
    ]);
    expect(outcome.result.modelDiff?.changed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: {
            kind: "package",
            id: "pkg_add_keyform_operation_test",
            path: "/model/keyforms/keyformSets"
          }
        }),
        expect.objectContaining({
          target: { kind: "parameter", id: "param_face_yaw" }
        }),
        expect.objectContaining({
          target: { kind: "mesh", id: "mesh_body" }
        }),
        expect.objectContaining({
          target: { kind: "keyformSet", id: "keyset_mesh_mesh_body_vertices_face_yaw_1" },
          fields: [
            expect.objectContaining({
              after: expect.objectContaining({
                keys: [
                  {
                    value: 1,
                    statePatch: [{ x: 2, y: 0 }]
                  }
                ]
              })
            })
          ]
        })
      ])
    );
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(outcome.candidateSession.authoringRevision).toBe(1);
    expect(outcome.candidateSession.dirty).toBe(true);
  });

  it("commits addKeyform to the input session", () => {
    const session = createFixtureSession();
    const request = createAddKeyformRequest({ dryRun: false });
    const operationId = getRequestOperationId(request);

    const outcome = addKeyformOperationHandler.commit(session, request, operationId);

    expect(outcome.result.status).toBe("committed");
    expect(outcome.candidateSession).toBe(session);
    expect(getKeyformSetById(session.graph, expectedKeyformSetId())).toEqual(
      expect.objectContaining({
        evaluator: "linear-1d-v1",
        interpolation: "linear-1d-v1",
        compositionMode: "replace",
        compositionOrder: 0
      })
    );
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
    expect(outcome.result.modelDiff?.baseRevision).toBe(0);
    expect(outcome.result.modelDiff?.candidateRevision).toBe(1);
  });

  it("rejects a missing parameter as an operation diagnostic", () => {
    const session = createFixtureSession();
    const request = createAddKeyformRequest({
      dryRun: false,
      parameterId: "param_missing"
    });

    const outcome = addKeyformOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.addKeyform.missingParameter",
      target: { kind: "parameter", id: "param_missing" }
    });
    expect(session.graph.keyformSets).toHaveLength(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
  });

  it("rejects a missing target as an operation diagnostic", () => {
    const session = createFixtureSession();
    const request = createAddKeyformRequest({
      dryRun: false,
      targetId: "mesh_missing"
    });

    const outcome = addKeyformOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.addKeyform.missingTarget",
      target: { kind: "mesh", id: "mesh_missing" }
    });
    expect(session.graph.keyformSets).toHaveLength(0);
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects unsupported target kinds before authoring mutation", () => {
    const session = createFixtureSession();
    const request = createAddKeyformRequest({
      dryRun: false,
      targetKind: "parameter",
      targetId: "param_face_yaw"
    });

    const outcome = addKeyformOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.addKeyform.unsupportedTargetKind",
      target: { kind: "parameter", id: "param_face_yaw" }
    });
    expect(session.graph.keyformSets).toHaveLength(0);
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects unsupported target properties as operation diagnostics", () => {
    const session = createFixtureSession();
    const request = createAddKeyformRequest({
      dryRun: false,
      targetProperty: "angleDegrees"
    });

    const outcome = addKeyformOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.addKeyform.unsupportedTargetProperty",
      target: {
        kind: "mesh",
        id: "mesh_body",
        path: "/model/keyforms/keyformTargets/mesh/angleDegrees"
      }
    });
    expect(session.graph.keyformSets).toHaveLength(0);
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects mismatched targetProperty and statePatch propertyPath", () => {
    const session = createFixtureSession();
    const request = createAddKeyformRequest({
      dryRun: false,
      targetProperty: "vertices",
      statePatchPropertyPath: "runtimeVisibility"
    });

    const outcome = addKeyformOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.addKeyform.statePatchPropertyMismatch",
      target: {
        kind: "mesh",
        id: "mesh_body",
        path: "/payload/statePatch/propertyPath"
      }
    });
    expect(session.graph.keyformSets).toHaveLength(0);
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects duplicate keyform set ids without a second mutation", () => {
    const session = createFixtureSession();
    const request = createAddKeyformRequest({ dryRun: false });
    addKeyformOperationHandler.commit(session, request, getRequestOperationId(request));
    const revisionAfterFirstCommit = session.authoringRevision;

    const duplicate = addKeyformOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(duplicate.result.status).toBe("rejected");
    expect(duplicate.result.diagnostics[0]).toMatchObject({
      checkId: "operation.addKeyform.duplicateKeyformSet",
      target: { kind: "keyformSet", id: "keyset_mesh_mesh_body_vertices_face_yaw_1" }
    });
    expect(session.graph.keyformSets).toHaveLength(1);
    expect(session.authoringRevision).toBe(revisionAfterFirstCommit);
  });

  it("rejects unsupported payloads with a structured diagnostic", () => {
    const session = createFixtureSession();
    const request = createParameterRequest();
    const operationId = getRequestOperationId(request);

    const outcome = addKeyformOperationHandler.commit(session, request, operationId);

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.addKeyform.unsupportedPayload",
      target: { kind: "operation", id: "op_create_parameter" }
    });
    expect(session.graph.keyformSets).toHaveLength(0);
    expect(session.authoringRevision).toBe(0);
  });
});

const expectedKeyformSetId = () =>
  KeyformSetIdSchema.parse("keyset_mesh_mesh_body_vertices_face_yaw_1");

const createAddKeyformRequest = (options: {
  readonly dryRun: boolean;
  readonly parameterId?: string;
  readonly targetKind?: string;
  readonly targetId?: string;
  readonly targetProperty?: string;
  readonly statePatchPropertyPath?: string;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_add_keyform_body_yaw",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "addKeyform",
    payload: {
      target: {
        kind: options.targetKind ?? "mesh",
        id: options.targetId ?? "mesh_body"
      },
      targetProperty: options.targetProperty ?? "vertices",
      parameterId: options.parameterId ?? "param_face_yaw",
      keyValue: 1,
      interpolation: "linear-1d-v1",
      statePatch: {
        propertyPath: options.statePatchPropertyPath ?? options.targetProperty ?? "vertices",
        value: [{ x: 2, y: 0 }]
      }
    }
  });

const createParameterRequest = (): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_create_parameter",
    actor: "test",
    surface: "testFixture",
    dryRun: false,
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

const getRequestOperationId = (request: OperationRequestDto): OperationId => {
  if (request.operationId === undefined) {
    throw new Error("Test requests must include an operationId.");
  }

  return request.operationId;
};

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_add_keyform_operation_test"),
    packageDisplayName: "Add Keyform Operation Test",
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
      {
        parameterId: ParameterIdSchema.parse("param_face_yaw"),
        displayName: "Face Yaw",
        semanticRole: "face",
        valueSource: "authoredInput",
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
    stableOrder: ["mesh_body", "param_face_yaw"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});
