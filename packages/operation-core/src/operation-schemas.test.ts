import { describe, expect, it } from "vitest";

import {
  OperationLogEntrySchema,
  OperationPayloadSchema,
  OperationRequestSchema,
  OperationResultSchema
} from "./index.js";

const psdAdapterResultPayload = {
  sourceAssetId: "src_psd_character",
  fileRef: {
    packageRelativePath: "assets/sources/character/source.psd",
    contentHash: "sha256:psd-character"
  },
  importProfile: "layered-character-psd-profile-v1",
  requestedLayerRoles: {
    layer_face: "editableLayer"
  },
  adapterResult: {
    schemaVersion: "psd-adapter-result-v1",
    sourceProfile: "layered-character-psd-profile-v1",
    adapterName: "fixture-psd-adapter",
    canvas: {
      width: 2048,
      height: 3072,
      bounds: {
        x: 0,
        y: 0,
        width: 2048,
        height: 3072
      }
    },
    sourceGroups: [
      {
        sourceGroupId: "group_head",
        originalName: "Head",
        normalizedName: "head",
        groupPath: ["Root", "Head"],
        sourceOrder: 0,
        blendMode: {
          modeKey: "pass",
          normalizedMode: "passThrough",
          supportedByMvp: false,
          source: { kind: "group", id: "group_head" }
        },
        targetPartId: "part_head"
      }
    ],
    sourceLayers: [
      {
        sourceLayerId: "layer_face",
        originalName: "Face",
        normalizedName: "face",
        parentGroupId: "group_head",
        groupPath: ["Root", "Head"],
        sourceOrder: 1,
        bounds: {
          x: 320,
          y: 240,
          width: 512,
          height: 512
        },
        visibleInSource: true,
        opacityInSource: 0.8,
        role: "editableLayer",
        blendMode: {
          modeKey: "mul ",
          normalizedMode: "multiply",
          displayName: "Multiply",
          supportedByMvp: false,
          source: { kind: "layer", id: "layer_face" }
        },
        unsupportedFeatures: [
          {
            featureId: "psd.textLayer",
            scope: "layer",
            severity: "warning",
            message: "Text layer requires adapter-side rasterization before materialization.",
            source: {
              kind: "layer",
              id: "layer_face"
            },
            rasterizeCandidate: true,
            manualConfirmationRequired: true
          }
        ],
        texturePreviewReference: "assets/textures/face.preview.png",
        textureId: "tex_face",
        targetPartId: "part_head"
      }
    ],
    unsupportedFeatures: [
      {
        featureId: "psd.adjustmentLayer",
        scope: "document",
        severity: "warning",
        message: "Adjustment layers are preserved as diagnostics in the adapter result."
      }
    ],
    diagnostics: [
      {
        checkId: "adapter.psd.unsupportedFeature",
        severity: "warning",
        message: "Adapter detected PSD features that operation-core must not render.",
        source: {
          kind: "adapter",
          path: "/unsupportedFeatures"
        }
      }
    ]
  },
  rights: {
    creator: "fixture artist",
    license: "internal-test",
    redistributionAllowed: false,
    aiUsed: false
  }
} as const;

const operationPayloads = [
  {
    operationType: "importPsdSourceAsset",
    payload: psdAdapterResultPayload
  },
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
    operationType: "updateDrawable",
    payload: {
      drawableId: "draw_face",
      displayName: "Face Paint",
      defaultOpacity: 0.75
    }
  },
  {
    operationType: "createPart",
    payload: {
      partId: "part_face",
      displayName: "Face",
      parentPartId: "part_head"
    }
  },
  {
    operationType: "updatePart",
    payload: {
      partId: "part_face",
      displayName: "Face Controls"
    }
  },
  {
    operationType: "deletePart",
    payload: {
      partId: "part_empty"
    }
  },
  {
    operationType: "moveStructureChild",
    payload: {
      moved: {
        kind: "drawable",
        drawableId: "draw_face"
      },
      drop: {
        placement: "inside",
        parentPartId: "part_head"
      }
    }
  },
  {
    operationType: "setDrawablePart",
    payload: {
      drawableId: "draw_face",
      partId: "part_head"
    }
  },
  {
    operationType: "setDrawableTexture",
    payload: {
      drawableId: "draw_face",
      textureId: "tex_face"
    }
  },
  {
    operationType: "createDynamicsGroup",
    payload: {
      dynamicsGroupId: "dyn_hair_sway",
      displayName: "Hair Sway",
      inputs: [
        {
          parameterId: "param_face_yaw",
          kind: "angle",
          influencePercent: 100,
          invert: false,
          normalization: { min: -1, center: 0, max: 1 }
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
    operationType: "setMaskRelation",
    payload: {
      maskRelationId: "maskrel_empty_relation",
      maskDrawableIds: [],
      targetDrawableIds: ["draw_body"],
      enabled: true
    }
  },
  {
    operationType: "createRotation2dRigControl",
    payload: {
      displayName: "Head Rotation",
      childDrawableIds: ["draw_face"],
      childRigControlIds: [],
      wrapChildren: [
        {
          kind: "drawable",
          id: "draw_face"
        }
      ],
      opacityMultiplier: 0.8,
      pivot: {
        x: 512,
        y: 512
      },
      restAngleDegrees: 0
    }
  },
  {
    operationType: "createWarpLattice2dRigControl",
    payload: {
      displayName: "Head Warp Lattice",
      childDrawableIds: ["draw_face"],
      childRigControlIds: [],
      domainBounds: {
        x: 320,
        y: 240,
        width: 512,
        height: 512
      },
      latticeColumns: 2,
      latticeRows: 2,
      interpolationMethod: "bilinear-grid-v1"
    }
  },
  {
    operationType: "createWarpDeformer",
    payload: {
      displayName: "Head Warp Deformer",
      parentRigControlId: "rig_head_rotation",
      childDrawableIds: ["draw_face"],
      childRigControlIds: [],
      wrapChildren: [
        {
          kind: "drawable",
          id: "draw_face"
        }
      ],
      opacityMultiplier: 0.75,
      domainBounds: {
        x: 320,
        y: 240,
        width: 512,
        height: 512
      },
      transformColumns: 5,
      transformRows: 4,
      bezierColumns: 3,
      bezierRows: 2,
      bezierEditType: "cubicBezierSurfaceV1"
    }
  },
  {
    operationType: "bindRigControlChild",
    payload: {
      parentRigControlId: "rig_head_rotation",
      child: {
        kind: "rigControl",
        id: "rig_child_rotation"
      }
    }
  },
  {
    operationType: "moveDrawableRigControlBinding",
    payload: {
      drawableId: "draw_face",
      targetRigControlId: "rig_face_warp"
    }
  },
  {
    operationType: "reparentRigControl",
    payload: {
      childRigControlId: "rig_child_rotation",
      parentRigControlId: "rig_head_rotation"
    }
  },
  {
    operationType: "updateRigControl",
    payload: {
      rigControlId: "rig_face_warp",
      displayName: "Face Warp",
      domainBounds: {
        x: 320,
        y: 240,
        width: 512,
        height: 512
      },
      transformColumns: 5,
      transformRows: 4,
      bezierColumns: 3,
      bezierRows: 2,
      opacityMultiplier: 0.5
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
      "importPsdSourceAsset",
      "importSplitPngSourceAsset",
      "createParameter",
      "updateDrawable",
      "createPart",
      "updatePart",
      "deletePart",
      "moveStructureChild",
      "setDrawablePart",
      "setDrawableTexture",
      "createDynamicsGroup",
      "moveMeshVertex",
      "setMaskRelation",
      "createRotation2dRigControl",
      "createWarpLattice2dRigControl",
      "createWarpDeformer",
      "bindRigControlChild",
      "moveDrawableRigControlBinding",
      "reparentRigControl",
      "updateRigControl"
    ]);
  });

  it("parses PSD adapter results through operation payload and request schemas", () => {
    const payload = OperationPayloadSchema.parse({
      operationType: "importPsdSourceAsset",
      payload: psdAdapterResultPayload
    });
    const request = OperationRequestSchema.parse({
      schemaVersion: "operation-request-v1",
      operationId: "op_import_psd_character",
      actor: "test",
      surface: "testFixture",
      dryRun: true,
      basePackageRevision: 0,
      operationType: "importPsdSourceAsset",
      payload: psdAdapterResultPayload
    });

    if (payload.operationType !== "importPsdSourceAsset") {
      throw new Error("Expected PSD operation payload.");
    }

    if (request.operationType !== "importPsdSourceAsset") {
      throw new Error("Expected PSD operation request.");
    }

    expect(payload.payload.adapterResult?.sourceLayers[0]?.unsupportedFeatures[0]).toMatchObject({
      featureId: "psd.textLayer",
      scope: "layer",
      rasterizeCandidate: true,
      manualConfirmationRequired: true
    });
    expect(request.payload.adapterResult?.sourceGroups[0]).toMatchObject({
      sourceGroupId: "group_head",
      blendMode: {
        modeKey: "pass",
        normalizedMode: "passThrough",
        supportedByMvp: false
      },
      targetPartId: "part_head"
    });
    expect(request.payload.adapterResult?.sourceLayers[0]?.blendMode).toMatchObject({
      modeKey: "mul ",
      normalizedMode: "multiply",
      displayName: "Multiply",
      supportedByMvp: false
    });
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
