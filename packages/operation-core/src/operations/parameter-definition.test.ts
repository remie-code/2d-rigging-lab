import {
  createInitialAuthoringRevision,
  getParameterById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  KeyformSetIdSchema,
  PackageIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { OperationId } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import {
  deleteParameterOperationHandler,
  updateParameterOperationHandler
} from "./parameter-definition.js";

const CUSTOM_PARAMETER_ID = ParameterIdSchema.parse("param_custom_smile");

describe("parameter definition operation handlers", () => {
  it("dry-runs custom parameter updates without mutating the original session", () => {
    const session = createFixtureSession();
    const request = createUpdateParameterRequest({ dryRun: true });

    const outcome = updateParameterOperationHandler.dryRun(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(getParameterById(session.graph, CUSTOM_PARAMETER_ID)?.displayName).toBe("Custom Smile");
    expect(getParameterById(outcome.candidateSession.graph, CUSTOM_PARAMETER_ID)).toMatchObject({
      displayName: "Custom Smile Wide",
      min: -1,
      max: 1,
      default: 0,
      recommendedUiStep: 0.05
    });
    expect(outcome.result.modelDiff?.changed[0]?.fields.map((field) => field.path)).toEqual([
      "/model/parameters/parameters/param_custom_smile/displayName",
      "/model/parameters/parameters/param_custom_smile/min",
      "/model/parameters/parameters/param_custom_smile/recommendedUiStep"
    ]);
    expect(session.authoringRevision).toBe(0);
  });

  it("commits custom parameter updates to the original session", () => {
    const session = createFixtureSession();
    const request = createUpdateParameterRequest({ dryRun: false });

    const outcome = updateParameterOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(getParameterById(session.graph, CUSTOM_PARAMETER_ID)).toMatchObject({
      displayName: "Custom Smile Wide",
      min: -1,
      max: 1,
      default: 0,
      recommendedUiStep: 0.05
    });
    expect(outcome.result.modelDiff?.changed[0]?.target).toEqual({
      kind: "parameter",
      id: "param_custom_smile"
    });
    expect(session.authoringRevision).toBe(1);
  });

  it("commits safe custom parameter deletion", () => {
    const session = createFixtureSession();
    const request = createDeleteParameterRequest({ dryRun: false });

    const outcome = deleteParameterOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(getParameterById(session.graph, CUSTOM_PARAMETER_ID)).toBeUndefined();
    expect(session.graph.stableOrder).not.toContain("param_custom_smile");
    expect(outcome.result.modelDiff?.removed).toEqual([
      { kind: "parameter", id: "param_custom_smile" }
    ]);
    expect(session.authoringRevision).toBe(1);
  });

  it("rejects deleting custom parameters that still have keyform refs", () => {
    const session = createFixtureSession({ includeKeyformRef: true });
    const request = createDeleteParameterRequest({ dryRun: false });

    const outcome = deleteParameterOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.deleteParameter.parameterInUse",
      target: { kind: "parameter", id: "param_custom_smile" }
    });
    expect(session.graph.parameters).toHaveLength(1);
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects preset parameter update and delete operations", () => {
    const session = createFixtureSession();
    const updateRequest = createUpdateParameterRequest({
      dryRun: false,
      parameterId: "param_face_angle_x"
    });
    const deleteRequest = createDeleteParameterRequest({
      dryRun: false,
      parameterId: "param_face_angle_x"
    });

    const updateOutcome = updateParameterOperationHandler.commit(
      session,
      updateRequest,
      getRequestOperationId(updateRequest)
    );
    const deleteOutcome = deleteParameterOperationHandler.commit(
      session,
      deleteRequest,
      getRequestOperationId(deleteRequest)
    );

    expect(updateOutcome.result.status).toBe("rejected");
    expect(updateOutcome.result.diagnostics[0]?.checkId).toBe("operation.updateParameter.presetLocked");
    expect(deleteOutcome.result.status).toBe("rejected");
    expect(deleteOutcome.result.diagnostics[0]?.checkId).toBe("operation.deleteParameter.presetLocked");
    expect(session.authoringRevision).toBe(0);
  });
});

const createFixtureSession = (options: { readonly includeKeyformRef?: boolean } = {}): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_parameter_definition_operation_test"),
    packageDisplayName: "Parameter Definition Operation Test",
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
    parameters: [
      {
        parameterId: CUSTOM_PARAMETER_ID,
        displayName: "Custom Smile",
        valueSource: "authoredInput",
        min: 0,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      }
    ],
    keyformSets: options.includeKeyformRef === true
      ? [
          {
            keyformSetId: KeyformSetIdSchema.parse("keyset_custom_smile_opacity"),
            target: { kind: "drawable", id: "draw_face", property: "opacity" },
            parameterId: CUSTOM_PARAMETER_ID,
            evaluator: "linear-1d-v1",
            interpolation: "linear-1d-v1",
            compositionMode: "replace",
            compositionOrder: 0,
            keys: [{ value: 0, statePatch: 1 }]
          }
        ]
      : [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: ["param_custom_smile"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createUpdateParameterRequest = (options: {
  readonly dryRun: boolean;
  readonly parameterId?: string;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_update_parameter",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "updateParameter",
    payload: {
      parameterId: options.parameterId ?? "param_custom_smile",
      displayName: "Custom Smile Wide",
      min: -1,
      recommendedUiStep: 0.05
    }
  });

const createDeleteParameterRequest = (options: {
  readonly dryRun: boolean;
  readonly parameterId?: string;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_delete_parameter",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "deleteParameter",
    payload: {
      parameterId: options.parameterId ?? "param_custom_smile"
    }
  });

const getRequestOperationId = (request: OperationRequestDto): OperationId => {
  if (request.operationId === undefined) {
    throw new Error("Test requests must include an operationId.");
  }

  return request.operationId;
};
