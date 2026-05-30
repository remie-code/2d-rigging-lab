import { describe, expect, it } from "vitest";

import {
  OperationLogEntrySchema,
  OperationPayloadSchema,
  OperationRequestSchema,
  OperationResultSchema
} from "./index.js";

const operationPayloads = [
  {
    operationType: "importSplitPngSourceAsset",
    payload: {
      sourceAssetId: "src_split_png",
      manifestPath: "assets/sources/split/manifest.json",
      importProfile: "split-png-fallback-v1",
      contentHash: "sha256:split-png",
      defaultPartId: "part_head",
      placementPolicy: "use-metadata",
      layers: [
        {
          sourceLayerId: "layer_head",
          imagePath: "assets/sources/split/head.png",
          originalName: "Head",
          normalizedName: "head",
          groupPath: ["Root"],
          bounds: { x: 0, y: 0, width: 128, height: 128 },
          visibleInSource: true,
          opacityInSource: 1,
          role: "editableLayer",
          unsupportedFeatures: []
        }
      ],
      rights: {
        rightsStatus: "cleared",
        license: "internal-test",
        redistributionAllowed: false
      },
      provenance: {
        creator: "fixture artist",
        license: "internal-test",
        redistributionAllowed: false,
        aiUsed: false,
        transformHistory: ["schema-fixture"]
      }
    }
  },
  {
    operationType: "createParameter",
    payload: {
      parameterId: "param_eye_open",
      displayName: "Eye Open",
      semanticRole: "eye",
      projectPresetAlias: "left-eye-open",
      min: 0,
      max: 1,
      default: 1,
      recommendedUiStep: 0.01
    }
  },
  {
    operationType: "createDynamicsGroup",
    payload: {
      dynamicsGroupId: "dyn_hair_sway",
      displayName: "Hair Sway",
      solverKind: "scalarDampedFollowV1",
      resetPolicy: "reset-on-load",
      settings: {
        stiffness: 0.35,
        damping: 0.7
      }
    }
  },
  {
    operationType: "moveMeshVertex",
    payload: {
      meshId: "mesh_body",
      vertexDeltas: [],
      intent: "schema permits empty deltas for operation precondition diagnostics"
    }
  },
  {
    operationType: "createRotation2dRigControl",
    payload: {
      partId: "part_head",
      displayName: "Head Rotation",
      childDrawableIds: ["draw_face"],
      childRigControlIds: [],
      pivot: {
        x: 512,
        y: 512
      },
      restAngleDegrees: 0
    }
  }
] as const;

const dryRunCreateParameterRequest = {
  schemaVersion: "operation-request-v1",
  operationId: "op_create_eye_open",
  actor: "test",
  surface: "testFixture",
  dryRun: true,
  basePackageRevision: 0,
  operationType: "createParameter",
  payload: {
    parameterId: "param_eye_open",
    displayName: "Eye Open",
    min: 0,
    max: 1,
    default: 1,
    recommendedUiStep: 0.01
  }
};

const acceptedResult = {
  schemaVersion: "operation-result-v1",
  operationId: "op_create_eye_open",
  status: "dry_run",
  precondition: {
    ok: true,
    diagnostics: []
  },
  modelDiff: {
    schemaVersion: "model-diff-v1",
    baseRevision: 0,
    candidateRevision: 1,
    added: [
      {
        kind: "parameter",
        id: "param_eye_open"
      }
    ],
    removed: [],
    changed: [],
    operationIds: ["op_create_eye_open"]
  },
  reversible: true
};

describe("operation-core DTO schemas", () => {
  it("parses representative operation payload families", () => {
    const parsed = operationPayloads.map((payload) => OperationPayloadSchema.parse(payload));

    expect(parsed.map((payload) => payload.operationType)).toEqual([
      "importSplitPngSourceAsset",
      "createParameter",
      "createDynamicsGroup",
      "moveMeshVertex",
      "createRotation2dRigControl"
    ]);
  });

  it("preserves dryRun=true on operation requests", () => {
    const parsed = OperationRequestSchema.parse(dryRunCreateParameterRequest);

    expect(parsed.dryRun).toBe(true);
    expect(parsed.operationType).toBe("createParameter");
  });

  it("parses operation results and log entries with required fields", () => {
    const result = OperationResultSchema.parse(acceptedResult);
    const logEntry = OperationLogEntrySchema.parse({
      schemaVersion: "operation-log-entry-v1",
      operationId: "op_create_eye_open",
      transactionId: "txn_create_eye_open",
      timestamp: "2026-05-29T00:00:00.000Z",
      actor: "test",
      surface: "testFixture",
      operationType: "createParameter",
      targetIds: ["param_eye_open"],
      precondition: {
        ok: true,
        diagnostics: [],
        checkedTargetRefs: [
          {
            kind: "parameter",
            id: "param_eye_open"
          }
        ]
      },
      payload: {
        operationType: "createParameter",
        payload: dryRunCreateParameterRequest.payload
      },
      result,
      provenanceId: "prov_test_fixture",
      reversible: true
    });

    expect(result.generatedRuntimeSnapshotIds).toEqual([]);
    expect(logEntry.targetIds).toEqual(["param_eye_open"]);
    expect(logEntry.validationReportIds).toEqual([]);
  });

  it("rejects invalid operation type and invalid ID prefixes", () => {
    expect(
      OperationPayloadSchema.safeParse({
        operationType: "deleteEverything",
        payload: {}
      }).success
    ).toBe(false);

    expect(
      OperationRequestSchema.safeParse({
        ...dryRunCreateParameterRequest,
        operationId: "operation_create_eye_open"
      }).success
    ).toBe(false);

    expect(
      OperationPayloadSchema.safeParse({
        ...dryRunCreateParameterRequest,
        payload: {
          ...dryRunCreateParameterRequest.payload,
          parameterId: "bad_eye_open"
        }
      }).success
    ).toBe(false);
  });
});
