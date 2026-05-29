import {
  createInitialAuthoringRevision,
  getKeyformSetById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  OperationIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  ProvenanceIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createKeyformSetIdFromOperationRequest } from "../operation-ids.js";
import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import { addKeyformGrid2dOperationHandler } from "./add-keyform-grid2d.js";

describe("addKeyformGrid2d operation handler", () => {
  it("dry-runs without mutating the original session", () => {
    const session = createFixtureSession();
    const request = createGridRequest({ dryRun: true });
    const operationId = OperationIdSchema.parse("op_add_grid_body");
    const keyformSetId = createKeyformSetIdFromOperationRequest(request);

    const outcome = addKeyformGrid2dOperationHandler.dryRun(session, request, operationId);

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.result.operationId).toBe(operationId);
    expect(outcome.result.precondition.ok).toBe(true);
    expect(outcome.result.modelDiff?.added).toEqual([{ kind: "keyformSet", id: keyformSetId }]);
    expect(outcome.result.modelDiff?.changed[0]).toMatchObject({
      target: { kind: "package", id: "pkg_add_keyform_grid2d_test" },
      fields: [
        {
          path: "/model/keyforms/keyformSets",
          before: null,
          after: keyformSetId
        }
      ]
    });
    expect(outcome.targetIds).toEqual([
      keyformSetId,
      "mesh_body",
      "param_face_yaw",
      "param_face_pitch"
    ]);
    expect(getKeyformSetById(session.graph, keyformSetId)).toBeUndefined();
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(outcome.candidateSession).not.toBe(session);
    expect(getKeyformSetById(outcome.candidateSession.graph, keyformSetId)).toBeDefined();
  });

  it("commits a grid keyform set into the input session", () => {
    const session = createFixtureSession();
    const request = createGridRequest({ dryRun: false });
    const operationId = OperationIdSchema.parse("op_add_grid_body");
    const keyformSetId = createKeyformSetIdFromOperationRequest(request);

    const outcome = addKeyformGrid2dOperationHandler.commit(session, request, operationId);

    expect(outcome.result.status).toBe("committed");
    expect(outcome.candidateSession).toBe(session);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
    expect(session.graph.stableOrder).toContain(keyformSetId);
    expect(getKeyformSetById(session.graph, keyformSetId)).toEqual(
      expect.objectContaining({
        keyformSetId,
        target: {
          kind: "mesh",
          id: "mesh_body",
          property: "vertices"
        },
        parameterX: "param_face_yaw",
        parameterY: "param_face_pitch",
        evaluator: "parameter-grid-2d-v1",
        interpolation: "bilinear-grid-v1",
        clampPolicy: "clamp-to-parameter-range",
        missingKeyPolicy: "diagnostic-error",
        compositionMode: "additiveDelta",
        compositionOrder: 0
      })
    );
  });

  it("rejects missing axis parameters as operation diagnostics", () => {
    const session = createFixtureSession({ includeParameterX: false });
    const request = createGridRequest({ dryRun: false });

    const outcome = addKeyformGrid2dOperationHandler.commit(
      session,
      request,
      OperationIdSchema.parse("op_add_grid_missing_parameter")
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.addKeyformGrid2d.missingParameter",
      target: { kind: "parameter", id: "param_face_yaw" }
    });
    expect(session.graph.keyformSets).toHaveLength(0);
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects duplicate axis parameters as operation diagnostics", () => {
    const session = createFixtureSession();
    const request = createGridRequest({
      dryRun: false,
      payload: {
        parameterY: "param_face_yaw"
      }
    });

    const outcome = addKeyformGrid2dOperationHandler.commit(
      session,
      request,
      OperationIdSchema.parse("op_add_grid_duplicate_axis")
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.addKeyformGrid2d.duplicateAxisParameter",
      target: { kind: "parameter", id: "param_face_yaw" }
    });
    expect(session.graph.keyformSets).toHaveLength(0);
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects invalid targets as operation diagnostics", () => {
    const session = createFixtureSession();
    const request = createGridRequest({
      dryRun: false,
      payload: {
        target: { kind: "mesh", id: "mesh_missing" }
      }
    });

    const outcome = addKeyformGrid2dOperationHandler.commit(
      session,
      request,
      OperationIdSchema.parse("op_add_grid_missing_target")
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.addKeyformGrid2d.missingTarget",
      target: { kind: "mesh", id: "mesh_missing" }
    });
    expect(session.graph.keyformSets).toHaveLength(0);
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects duplicate grid coordinates as operation diagnostics", () => {
    const session = createFixtureSession();
    const request = createGridRequest({
      dryRun: false,
      payload: {
        keys: [
          { x: -1, y: -1, statePatch: [] },
          { x: -1, y: -1, statePatch: [] }
        ]
      }
    });

    const outcome = addKeyformGrid2dOperationHandler.commit(
      session,
      request,
      OperationIdSchema.parse("op_add_grid_duplicate_coordinate")
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.addKeyformGrid2d.duplicateGridCoordinate"
    });
    expect(session.graph.keyformSets).toHaveLength(0);
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects unsupported payloads with a structured diagnostic", () => {
    const session = createFixtureSession();
    const request = createParameterRequest();

    const outcome = addKeyformGrid2dOperationHandler.commit(
      session,
      request,
      OperationIdSchema.parse("op_add_grid_unsupported")
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.addKeyformGrid2d.unsupportedPayload",
      target: { kind: "operation", id: "op_add_grid_unsupported" }
    });
    expect(session.graph.keyformSets).toHaveLength(0);
    expect(session.authoringRevision).toBe(0);
  });
});

const createGridRequest = (options: {
  readonly dryRun: boolean;
  readonly payload?: Partial<GridPayloadInput>;
}): Extract<OperationRequestDto, { operationType: "addKeyformGrid2d" }> =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: options.dryRun ? "op_add_grid_body_dry_run" : "op_add_grid_body_commit",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "addKeyformGrid2d",
    payload: {
      target: { kind: "mesh", id: "mesh_body" },
      targetProperty: "vertices",
      parameterX: "param_face_yaw",
      parameterY: "param_face_pitch",
      evaluator: "parameter-grid-2d-v1",
      interpolation: "bilinear-grid-v1",
      clampPolicy: "clamp-to-parameter-range",
      keys: [
        { x: -1, y: -1, statePatch: [{ x: -1, y: 0 }] },
        { x: 1, y: 1, statePatch: [{ x: 1, y: 0 }] }
      ],
      ...options.payload
    }
  }) as Extract<OperationRequestDto, { operationType: "addKeyformGrid2d" }>;

const createParameterRequest = (): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_create_smile",
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

const createFixtureSession = (options: {
  readonly includeParameterX?: boolean;
  readonly includeParameterY?: boolean;
} = {}): AuthoringSession => {
  const parameterX = createTestParameter("param_face_yaw");
  const parameterY = createTestParameter("param_face_pitch");
  const parameters = [
    ...(options.includeParameterX ?? true ? [parameterX] : []),
    ...(options.includeParameterY ?? true ? [parameterY] : [])
  ];

  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_add_keyform_grid2d_test"),
      packageDisplayName: "Add Keyform Grid2d Test",
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
          bounds: { x: 0, y: 0, width: 1, height: 1 },
          generationProvenanceId: ProvenanceIdSchema.parse("prov_mesh_body")
        }
      ],
      parameters,
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [],
      rigControlRootIds: [],
      stableOrder: [
        "mesh_body",
        ...parameters.map((parameter) => parameter.parameterId)
      ],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
};

const createTestParameter = (parameterIdText: string): AuthoringSession["graph"]["parameters"][number] => ({
  parameterId: ParameterIdSchema.parse(parameterIdText),
  displayName: parameterIdText
    .replace(/^param_/, "")
    .split("_")
    .map((token) => `${token[0]?.toUpperCase() ?? ""}${token.slice(1)}`)
    .join(" "),
  valueSource: "authoredInput",
  min: -1,
  max: 1,
  default: 0,
  recommendedUiStep: 0.01
});

interface GridPayloadInput {
  readonly target: { readonly kind: "mesh"; readonly id: string };
  readonly targetProperty: string;
  readonly parameterX: string;
  readonly parameterY: string;
  readonly evaluator: "parameter-grid-2d-v1";
  readonly interpolation: "bilinear-grid-v1";
  readonly clampPolicy: "clamp-to-parameter-range";
  readonly keys: readonly {
    readonly x: number;
    readonly y: number;
    readonly statePatch: readonly unknown[];
  }[];
}
