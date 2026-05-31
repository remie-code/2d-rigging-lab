import { describe, expect, it } from "vitest";

import type { ValidationCheckResultDto } from "./validation-report.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

const CREATED_AT = "2026-05-31T00:00:00.000Z";
const PACKAGE_ID = "pkg_dynamics";
const PART_ID = "part_root";
const DRAWABLE_ID = "draw_body";
const MESH_ID = "mesh_body";
const SOURCE_ASSET_ID = "src_generated";
const TEXTURE_ID = "tex_body";
const PROVENANCE_ID = "prov_generated";
const DRIVER_PARAMETER_ID = "param_faceYaw";
const OUTPUT_PARAMETER_ID = "param_hairSway";
const DYNAMICS_GROUP_ID = "dyn_hair_sway";

describe("validator dynamics semantic checks", () => {
  it("validates a minimal dynamics package with runtime evidence", () => {
    const packageDocument = createDynamicsPackage();
    const runtimeSnapshot = createRuntimeSnapshot();

    const report = validatePackageRuntime({
      packageDocument,
      runtimeSnapshot,
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
    expect(report.evidence.runtimeSnapshotIds).toEqual(["snap_dynamics_0"]);
  });

  it("emits deterministic diagnostics for invalid dynamics relations", () => {
    const report = validatePackageRuntime({
      packageDocument: createDynamicsPackage({
        parameters: [createAuthoredParameter(DRIVER_PARAMETER_ID)],
        dynamicsGroups: [
          createDynamicsGroup({
            drivers: [
              {
                driverId: "driver_missing",
                sourceParameterId: "param_missingDriver",
                inputScale: 1,
                inputOffset: 0,
                invert: false
              }
            ],
            output: createDynamicsOutput({
              targetParameterId: "param_missingOutput"
            })
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "dynamics.driverMissing",
        targetId: "param_missingDriver",
        targetPath: "/model/dynamics/dynamicsGroups/0/drivers/0/sourceParameterId",
        evidence: [
          "dynamicsGroupId=dyn_hair_sway",
          "driverId=driver_missing",
          "sourceParameterId=param_missingDriver",
          "parameterMatch=missing"
        ]
      },
      {
        checkId: "dynamics.outputMissing",
        targetId: "param_missingOutput",
        targetPath: "/model/dynamics/dynamicsGroups/0/output/targetParameterId",
        evidence: [
          "dynamicsGroupId=dyn_hair_sway",
          "outputId=output_hair_sway",
          "targetParameterId=param_missingOutput",
          "parameterMatch=missing"
        ]
      },
      {
        checkId: "dynamics.runtimeEvidenceMissing",
        targetId: "dyn_hair_sway",
        targetPath: "/model/dynamics/dynamicsGroups/0",
        evidence: [
          "dynamicsGroupId=dyn_hair_sway",
          "outputParameterId=param_missingOutput",
          "runtimeSnapshot=missing"
        ]
      }
    ]);
  });

  it("reports runtime evidence gaps for present dynamics groups", () => {
    const report = validatePackageRuntime({
      packageDocument: createDynamicsPackage(),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "dynamics.runtimeEvidenceMissing",
        targetId: "dyn_hair_sway",
        targetPath: "/model/dynamics/dynamicsGroups/0",
        evidence: [
          "dynamicsGroupId=dyn_hair_sway",
          "outputParameterId=param_hairSway",
          "runtimeSnapshot=missing"
        ]
      }
    ]);
  });

  it("reports statically unsafe dynamics output and settings", () => {
    const report = validatePackageRuntime({
      packageDocument: createDynamicsPackage({
        dynamicsGroups: [
          createDynamicsGroup({
            output: createDynamicsOutput({
              min: -2,
              max: 2
            }),
            settings: createDynamicsSettings({
              stiffness: 0.5,
              damping: 0,
              maxVelocity: 2,
              maxAmplitude: 3
            })
          })
        ]
      }),
      runtimeSnapshot: createRuntimeSnapshot(),
      createdAt: CREATED_AT
    });

    expect(report.checks.map((check) => check.checkId)).toEqual([
      "dynamics.outputParameterOutOfRange",
      "dynamics.unstableSettings",
      "dynamics.excessiveAmplitude"
    ]);
    expect(report.checks.map((check) => check.targetPath)).toEqual([
      "/model/dynamics/dynamicsGroups/0/output",
      "/model/dynamics/dynamicsGroups/0/settings",
      "/model/dynamics/dynamicsGroups/0/settings/maxAmplitude"
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
        createAuthoredParameter(DRIVER_PARAMETER_ID),
        createComputedParameter(OUTPUT_PARAMETER_ID)
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
      schemaVersion: "dynamics-file-v1",
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

const createAuthoredParameter = (parameterId: string) => ({
  parameterId,
  displayName: parameterId,
  semanticRole: "face",
  valueSource: "authoredInput",
  min: -1,
  max: 1,
  default: 0,
  recommendedUiStep: 0.1
});

const createComputedParameter = (parameterId: string) => ({
  parameterId,
  displayName: parameterId,
  semanticRole: "dynamics",
  valueSource: "computedDynamics",
  min: -1,
  max: 1,
  default: 0,
  recommendedUiStep: 0.1
});

const createDynamicsGroup = (overrides: {
  readonly drivers?: readonly unknown[];
  readonly output?: unknown;
  readonly settings?: unknown;
} = {}) => ({
  dynamicsGroupId: DYNAMICS_GROUP_ID,
  displayName: "Hair Sway",
  enabled: true,
  solverKind: "scalarDampedFollowV1",
  drivers: overrides.drivers ?? [
    {
      driverId: "driver_face_yaw",
      sourceParameterId: DRIVER_PARAMETER_ID,
      inputScale: 1,
      inputOffset: 0,
      invert: false
    }
  ],
  output: overrides.output ?? {
    ...createDynamicsOutput()
  },
  settings: overrides.settings ?? createDynamicsSettings(),
  resetPolicy: "reset-on-load"
});

const createDynamicsOutput = (overrides: Record<string, unknown> = {}) => ({
  outputId: "output_hair_sway",
  targetParameterId: OUTPUT_PARAMETER_ID,
  outputScale: 1,
  outputOffset: 0,
  min: -1,
  max: 1,
  clampPolicy: "clamp-to-output-range",
  ...overrides
});

const createDynamicsSettings = (overrides: Record<string, unknown> = {}) => ({
  stiffness: 0.4,
  damping: 0.6,
  maxVelocity: 2,
  maxAmplitude: 1,
  ...overrides
});

const createRuntimeSnapshot = () => ({
  schemaVersion: "runtime-snapshot-v1",
  runtimeCoreVersion: "wave23-dynamics-test",
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
      dynamics: "scalarDampedFollowV1",
      keyform1d: "linear-1d-v1",
      keyformGrid2d: "parameter-grid-2d-v1",
      warpLattice: "bilinear-grid-v1",
      rigControlHierarchy: "parent-before-child-v1"
    }
  },
  parameters: [
    {
      parameterId: DRIVER_PARAMETER_ID,
      valueSource: "authoredInput",
      authoredValue: 0.5,
      effectiveValue: 0.5,
      clamped: false,
      source: "viewerOverride"
    },
    {
      parameterId: OUTPUT_PARAMETER_ID,
      valueSource: "computedDynamics",
      computedValue: 0.25,
      effectiveValue: 0.25,
      clamped: false,
      source: "dynamicsComputed"
    }
  ],
  dynamics: [
    {
      dynamicsGroupId: DYNAMICS_GROUP_ID,
      enabled: true,
      solverKind: "scalarDampedFollowV1",
      driverValues: {
        [DRIVER_PARAMETER_ID]: 0.5
      },
      outputParameterId: OUTPUT_PARAMETER_ID,
      outputValue: 0.25,
      stateSummary: {
        position: 0.25,
        velocity: 0
      },
      tick: 1,
      fixedStepMs: 16.6666667,
      resetCounter: 0,
      diagnostics: []
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
