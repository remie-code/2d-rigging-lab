import { describe, expect, it } from "vitest";
import {
  createPackageInMemoryFileSet,
  exportPortablePackageBundleV0,
  importPortablePackageBundleV0,
  PackageDocumentSchema
} from "@private-2d-rigging-lab/package-format";

import type { ValidationCheckResultDto } from "./validation-report.js";
import { validateDynamicsSemantics } from "./validators/dynamics-semantic.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

const CREATED_AT = "2026-05-31T00:00:00.000Z";
const PACKAGE_ID = "pkg_dynamics";
const PART_ID = "part_root";
const DRAWABLE_ID = "draw_body";
const MESH_ID = "mesh_body";
const SOURCE_ASSET_ID = "src_generated";
const TEXTURE_ID = "tex_body";
const PROVENANCE_ID = "prov_generated";
const INPUT_PARAMETER_ID = "param_faceYaw";
const OUTPUT_PARAMETER_ID = "param_hairSway";
const PRESET_INPUT_PARAMETER_ID = "param_face_angle_x";
const PRESET_OUTPUT_PARAMETER_ID = "param_hair_front_sway_x";
const DYNAMICS_GROUP_ID = "dyn_hair_sway";

describe("validator dynamics semantic checks", () => {
  it("validates a minimal additive dynamics package with runtime evidence", () => {
    const report = validatePackageRuntime({
      packageDocument: createDynamicsPackage(),
      runtimeSnapshot: createRuntimeSnapshot(),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
    expect(report.evidence.runtimeSnapshotIds).toEqual(["snap_dynamics_0"]);
  });

  it("does not require runtime evidence for static package validation", () => {
    const report = validatePackageRuntime({
      packageDocument: createDynamicsPackage(),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("pass");
    expect(report.checks.map((check) => check.checkId)).not.toContain("dynamics.runtimeEvidenceMissing");
  });

  it("accepts initialized preset driver and output refs without persisted parameters", () => {
    const checks = validateDynamicsSemantics(createDynamicsPackage({
      parameters: [],
      dynamicsGroups: [
        createDynamicsGroup({
          inputs: [
            createDynamicsInput({
              parameterId: PRESET_INPUT_PARAMETER_ID,
              normalization: {
                min: -30,
                center: 0,
                max: 30
              }
            })
          ],
          outputs: [
            createDynamicsOutput({
              parameterId: PRESET_OUTPUT_PARAMETER_ID
            })
          ]
        })
      ]
    }) as unknown as Parameters<typeof validateDynamicsSemantics>[0]);

    expect(checks).toEqual([]);
  });

  it("keeps initialized preset dynamics refs semantically valid through portable package export/import", async () => {
    const packageDocument = PackageDocumentSchema.parse(createDynamicsPackage({
      parameters: [],
      dynamicsGroups: [
        createDynamicsGroup({
          inputs: [
            createDynamicsInput({
              parameterId: PRESET_INPUT_PARAMETER_ID,
              normalization: {
                min: -30,
                center: 0,
                max: 30
              }
            })
          ],
          outputs: [
            createDynamicsOutput({
              parameterId: PRESET_OUTPUT_PARAMETER_ID
            })
          ]
        })
      ]
    }));
    const bundle = await exportPortablePackageBundleV0({
      packageDocument,
      fileSet: createPackageInMemoryFileSet([])
    });
    const imported = await importPortablePackageBundleV0({ bundle });
    const importedDocument = PackageDocumentSchema.parse(imported.packageDocument);

    expect(importedDocument.model.parameters.parameters).toEqual([]);
    expect(importedDocument.model.dynamics.dynamicsGroups[0]).toMatchObject({
      inputs: [{ parameterId: PRESET_INPUT_PARAMETER_ID }],
      outputs: [{ parameterId: PRESET_OUTPUT_PARAMETER_ID }]
    });

    const report = validatePackageRuntime({
      packageDocument: importedDocument,
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
  });

  it("reports missing input and output parameters", () => {
    const report = validatePackageRuntime({
      packageDocument: createDynamicsPackage({
        parameters: [createAuthoredParameter(INPUT_PARAMETER_ID)],
        dynamicsGroups: [
          createDynamicsGroup({
            inputs: [
              createDynamicsInput({
                parameterId: "param_missingInput"
              })
            ],
            outputs: [
              createDynamicsOutput({
                parameterId: "param_missingOutput"
              })
            ]
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "dynamics.driverMissing",
        targetId: "param_missingInput",
        targetPath: "/model/dynamics/dynamicsGroups/0/inputs/0/parameterId",
        evidence: [
          "dynamicsGroupId=dyn_hair_sway",
          "inputIndex=0",
          "parameterId=param_missingInput",
          "parameterMatch=missing"
        ]
      },
      {
        checkId: "dynamics.outputMissing",
        targetId: "param_missingOutput",
        targetPath: "/model/dynamics/dynamicsGroups/0/outputs/0/parameterId",
        evidence: [
          "dynamicsGroupId=dyn_hair_sway",
          "outputIndex=0",
          "parameterId=param_missingOutput",
          "parameterMatch=missing"
        ]
      }
    ]);
  });

  it("reports invalid v0 group cardinality directly from dynamics semantics", () => {
    const checks = validateDynamicsSemantics(createDynamicsPackage({
      dynamicsGroups: [
        createDynamicsGroup({
          inputs: [],
          pendulums: [],
          outputs: []
        })
      ]
    }) as unknown as Parameters<typeof validateDynamicsSemantics>[0]);

    expect(checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "dynamics.inputMissing",
        targetId: DYNAMICS_GROUP_ID,
        targetPath: "/model/dynamics/dynamicsGroups/0/inputs",
        evidence: [
          "dynamicsGroupId=dyn_hair_sway",
          "inputs=0"
        ]
      },
      {
        checkId: "dynamics.invalidPendulumCardinality",
        targetId: DYNAMICS_GROUP_ID,
        targetPath: "/model/dynamics/dynamicsGroups/0/pendulums",
        evidence: [
          "dynamicsGroupId=dyn_hair_sway",
          "pendulumCount=0"
        ]
      },
      {
        checkId: "dynamics.invalidOutputCardinality",
        targetId: DYNAMICS_GROUP_ID,
        targetPath: "/model/dynamics/dynamicsGroups/0/outputs",
        evidence: [
          "dynamicsGroupId=dyn_hair_sway",
          "outputCount=0"
        ]
      }
    ]);
  });

  it("reports invalid input normalization directly from dynamics semantics", () => {
    const checks = validateDynamicsSemantics(createDynamicsPackage({
      dynamicsGroups: [
        createDynamicsGroup({
          inputs: [
            createDynamicsInput({
              normalization: {
                min: 0,
                center: 0,
                max: 1
              }
            })
          ]
        })
      ]
    }) as unknown as Parameters<typeof validateDynamicsSemantics>[0]);

    expect(checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "dynamics.normalizationInvalid",
        targetId: DYNAMICS_GROUP_ID,
        targetPath: "/model/dynamics/dynamicsGroups/0/inputs/0/normalization",
        evidence: [
          "dynamicsGroupId=dyn_hair_sway",
          "inputIndex=0",
          "min=0",
          "center=0",
          "max=1"
        ]
      }
    ]);
  });

  it("blocks duplicate additive output ownership", () => {
    const report = validatePackageRuntime({
      packageDocument: createDynamicsPackage({
        dynamicsGroups: [
          createDynamicsGroup(),
          createDynamicsGroup({
            dynamicsGroupId: "dyn_second_hair_sway",
            displayName: "Second Hair Sway"
          })
        ]
      }),
      runtimeSnapshot: createRuntimeSnapshot(),
      createdAt: CREATED_AT
    });

    expect(report.checks.map(toDiagnosticSummary)).toContainEqual({
      checkId: "dynamics.outputTargetDuplicate",
      targetId: OUTPUT_PARAMETER_ID,
      targetPath: "/model/dynamics/dynamicsGroups/0/outputs/0/parameterId",
      evidence: [
        `targetParameterId=${OUTPUT_PARAMETER_ID}`,
        "ownerGroupId=dyn_hair_sway",
        "ownerGroupId=dyn_second_hair_sway"
      ]
    });
  });

  it("reports additive dynamics warnings and runtime output mismatch", () => {
    const report = validatePackageRuntime({
      packageDocument: createDynamicsPackage({
        dynamicsGroups: [
          createDynamicsGroup({
            inputs: [
              createDynamicsInput({
                influencePercent: 0
              })
            ],
            pendulums: [
              {
                length: 1,
                sway: 101,
                reactionSpeed: 8,
                convergenceSpeed: 4
              }
            ],
            outputs: [
              createDynamicsOutput({
                strength: 0,
                limit: 0
              })
            ]
          })
        ]
      }),
      runtimeSnapshot: createRuntimeSnapshot({ outputParameterId: "param_other_output" }),
      createdAt: CREATED_AT
    });

    expect(report.checks.map((check) => check.checkId)).toEqual([
      "dynamics.zeroInputInfluence",
      "dynamics.outputStrengthZero",
      "dynamics.outputLimitTooSmall",
      "dynamics.unstableSettings",
      "dynamics.runtimeEvidenceMismatch"
    ]);
  });
});

const toDiagnosticSummary = (check: ValidationCheckResultDto) => ({
  checkId: check.checkId,
  targetId: check.target.id,
  targetPath: check.targetPath,
  evidence: check.evidence
});

const createDynamicsPackage = (overrides: {
  readonly parameters?: readonly unknown[];
  readonly dynamicsGroups?: readonly unknown[];
} = {}) => ({
  manifest: {
    schemaVersion: "open-model-package-manifest-v1",
    packageId: PACKAGE_ID,
    packageDisplayName: "Dynamics",
    formatVersion: "open-model-package-v1",
    packageRevision: 0,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    schemaVersions: {},
    evaluatorVersions: {},
    modelFiles: {
      graph: "model/graph.json",
      drawables: "model/drawables.json",
      meshes: "model/meshes.json",
      parameters: "model/parameters.json",
      keyforms: "model/keyforms.json",
      rigControls: "model/rig-controls.json",
      dynamics: "model/dynamics.json",
      masks: "model/masks.json",
      drawOrder: "model/draw-order.json"
    },
    assetIndex: "assets/sources/source-manifest.json",
    operationLog: "operations/log.jsonl",
    rightsSummary: {
      status: "cleared"
    },
    provenanceSummary: {
      sourceAssetCount: 1
    },
    packageStableOrderVersion: "stable-order-v1"
  },
  model: {
    graph: {
      schemaVersion: "model-graph-v1",
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: {
        width: 512,
        height: 512
      },
      parts: [
        {
          partId: PART_ID,
          displayName: "Root",
          childPartIds: [],
          drawableIds: [DRAWABLE_ID]
        }
      ],
      rigControlRootIds: [],
      stableOrder: [DRAWABLE_ID, DYNAMICS_GROUP_ID]
    },
    drawables: {
      schemaVersion: "drawables-file-v1",
      drawables: [
        {
          drawableId: DRAWABLE_ID,
          displayName: "Body",
          partId: PART_ID,
          sourceAssetId: SOURCE_ASSET_ID,
          textureId: TEXTURE_ID,
          meshId: MESH_ID,
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: PROVENANCE_ID
        }
      ]
    },
    meshes: {
      schemaVersion: "meshes-file-v1",
      meshes: [
        {
          meshId: MESH_ID,
          drawableId: DRAWABLE_ID,
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
          vertexStableIds: ["v0", "v1", "v2"],
          bounds: {
            x: 0,
            y: 0,
            width: 1,
            height: 1
          },
          generationProvenanceId: PROVENANCE_ID
        }
      ]
    },
    parameters: {
      schemaVersion: "parameters-file-v1",
      parameters: overrides.parameters ?? [
        createAuthoredParameter(INPUT_PARAMETER_ID),
        createAuthoredParameter(OUTPUT_PARAMETER_ID, "dynamics")
      ]
    },
    keyforms: {
      schemaVersion: "keyforms-file-v1",
      keyformSets: []
    },
    rigControls: {
      schemaVersion: "rig-controls-file-v1",
      rigControls: []
    },
    dynamics: {
      schemaVersion: "dynamics-file-v2",
      dynamicsGroups: overrides.dynamicsGroups ?? [createDynamicsGroup()]
    },
    masks: {
      schemaVersion: "masks-file-v1",
      masks: []
    },
    drawOrder: {
      schemaVersion: "draw-order-file-v1",
      entries: [
        {
          drawableId: DRAWABLE_ID,
          baseDrawOrder: 0,
          stableOrder: 0
        }
      ]
    }
  },
  assets: {
    sourceManifest: {
      schemaVersion: "source-manifest-v1",
      sourceAssets: [
        {
          sourceAssetId: SOURCE_ASSET_ID,
          kind: "generated-fixture-v1",
          filePath: "assets/sources/generated.png",
          contentHash: "hash_generated",
          importProfile: "split-png-fallback-v1",
          layers: [],
          diagnostics: []
        }
      ]
    },
    provenance: {
      schemaVersion: "provenance-file-v1",
      records: [
        {
          provenanceId: PROVENANCE_ID,
          assetId: SOURCE_ASSET_ID,
          assetKind: "generatedFixture",
          filePath: "assets/sources/generated.png",
          creator: "test",
          license: "internal-test",
          redistributionAllowed: false,
          aiUsed: false,
          transformHistory: [],
          relatedOperationIds: []
        }
      ]
    },
    rights: {
      schemaVersion: "rights-file-v1",
      records: [
        {
          assetId: SOURCE_ASSET_ID,
          rightsStatus: "cleared",
          license: "internal-test",
          redistributionAllowed: false
        }
      ]
    }
  }
});

const createAuthoredParameter = (parameterId: string, semanticRole = "face") => ({
  parameterId,
  displayName: parameterId,
  semanticRole,
  valueSource: "authoredInput",
  min: -1,
  max: 1,
  default: 0,
  recommendedUiStep: 0.1
});

const createDynamicsGroup = (overrides: {
  readonly dynamicsGroupId?: string;
  readonly displayName?: string;
  readonly inputs?: readonly unknown[];
  readonly pendulums?: readonly unknown[];
  readonly outputs?: readonly unknown[];
} = {}) => ({
  dynamicsGroupId: overrides.dynamicsGroupId ?? DYNAMICS_GROUP_ID,
  displayName: overrides.displayName ?? "Hair Sway",
  enabled: true,
  inputs: overrides.inputs ?? [createDynamicsInput()],
  pendulums: overrides.pendulums ?? [
    {
      length: 1,
      sway: 0.35,
      reactionSpeed: 8,
      convergenceSpeed: 4
    }
  ],
  outputs: overrides.outputs ?? [createDynamicsOutput()]
});

const createDynamicsInput = (overrides: Record<string, unknown> = {}) => ({
  parameterId: INPUT_PARAMETER_ID,
  kind: "angle",
  influencePercent: 100,
  invert: false,
  normalization: {
    min: -1,
    center: 0,
    max: 1
  },
  ...overrides
});

const createDynamicsOutput = (overrides: Record<string, unknown> = {}) => ({
  parameterId: OUTPUT_PARAMETER_ID,
  kind: "angle",
  strength: 1,
  invert: false,
  limit: 1,
  ...overrides
});

const createRuntimeSnapshot = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: "runtime-snapshot-v1",
  runtimeCoreVersion: "wave81-dynamics-test",
  snapshotId: "snap_dynamics_0",
  context: {
    source: {
      surface: "validator"
    },
    policy: {
      strictness: "strict"
    }
  },
  packageId: PACKAGE_ID,
  packageRevision: 0,
  dirty: false,
  evaluation: {
    snapshotDetail: "summary",
    evaluatorVersions: {
      dynamics: "additivePendulumV0",
      keyform1d: "linear-1d-v1",
      keyformGrid2d: "parameter-grid-2d-v1",
      warpLattice: "bilinear-grid-v1",
      rigControlHierarchy: "parent-before-child-v1"
    }
  },
  parameters: [
    {
      parameterId: INPUT_PARAMETER_ID,
      valueSource: "authoredInput",
      authoredValue: 0.5,
      baseValue: 0.5,
      effectiveValue: 0.5,
      clamped: false,
      source: "viewerOverride"
    },
    {
      parameterId: OUTPUT_PARAMETER_ID,
      valueSource: "authoredInput",
      baseValue: 0,
      dynamicsOffset: 0.25,
      effectiveValue: 0.25,
      clamped: false,
      source: "dynamicsAdditive"
    }
  ],
  dynamics: [
    {
      dynamicsGroupId: DYNAMICS_GROUP_ID,
      enabled: true,
      solverKind: "additivePendulumV0",
      inputValues: {
        [INPUT_PARAMETER_ID]: 0.5
      },
      outputParameterId: OUTPUT_PARAMETER_ID,
      outputOffset: 0.25,
      effectiveOutputValue: 0.25,
      stateSummary: {
        angle: 0.25,
        angularVelocity: 0,
        previousSource: 0.5,
        previousSourceVelocity: 0
      },
      tick: 1,
      fixedStepMs: 16.6666667,
      resetCounter: 0,
      diagnostics: [],
      ...overrides
    }
  ],
  keyformSamples: [],
  rigControls: [],
  masks: [],
  drawables: [
    {
      drawableId: DRAWABLE_ID,
      meshId: MESH_ID,
      visible: true,
      opacity: 1,
      baseDrawOrder: 0,
      evaluatedDrawOrder: 0,
      bounds: {
        x: 0,
        y: 0,
        width: 1,
        height: 1
      },
      vertexCount: 3,
      vertexHash: "hash_draw_body_3",
      diagnostics: []
    }
  ],
  drawList: [DRAWABLE_ID],
  disabledFutureLayers: [],
  diagnostics: []
});
