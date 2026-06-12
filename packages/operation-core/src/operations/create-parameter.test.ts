import {
  createInitialAuthoringRevision,
  getParameterById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  PackageIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { OperationId } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import { createParameterOperationHandler } from "./create-parameter.js";

describe("createParameter operation handler", () => {
  it("rejects preset catalog id collisions without throwing or mutating", () => {
    const session = createFixtureSession();
    const request = createCreateParameterRequest({
      parameterId: "param_face_angle_x",
      displayName: "Face Angle X Custom"
    });

    const outcome = createParameterOperationHandler.commit(
      session,
      request,
      getRequestOperationId(request)
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.createParameter.duplicateParameter",
      target: { kind: "parameter", id: "param_face_angle_x" }
    });
    expect(session.graph.parameters).toEqual([]);
    expect(session.graph.stableOrder).toEqual([]);
    expect(session.authoringRevision).toBe(0);
  });

  it("does not store custom semantic or preset alias fields from legacy payloads", () => {
    const session = createFixtureSession();
    const request = createCreateParameterRequest({
      parameterId: "param_custom_smile",
      displayName: "Custom Smile",
      semanticRole: "mouth",
      projectPresetAlias: "mouth.smile"
    });

    const outcome = createParameterOperationHandler.commit(
      session,
      request,
      getRequestOperationId(request)
    );

    const parameter = getParameterById(session.graph, ParameterIdSchema.parse("param_custom_smile"));
    expect(outcome.result.status).toBe("committed");
    expect(parameter).toMatchObject({
      parameterId: "param_custom_smile",
      displayName: "Custom Smile"
    });
    expect(parameter).not.toHaveProperty("semanticRole");
    expect(parameter).not.toHaveProperty("projectPresetAlias");
    expect(session.authoringRevision).toBe(1);
  });
});

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_create_parameter_operation_test"),
    packageDisplayName: "Create Parameter Operation Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 1024, height: 1024 },
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

const createCreateParameterRequest = (options: {
  readonly parameterId: string;
  readonly displayName: string;
  readonly semanticRole?: string;
  readonly projectPresetAlias?: string;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_create_parameter",
    actor: "test",
    surface: "testFixture",
    dryRun: false,
    basePackageRevision: 0,
    operationType: "createParameter",
    payload: {
      parameterId: options.parameterId,
      displayName: options.displayName,
      ...(options.semanticRole === undefined ? {} : { semanticRole: options.semanticRole }),
      ...(options.projectPresetAlias === undefined
        ? {}
        : { projectPresetAlias: options.projectPresetAlias }),
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
