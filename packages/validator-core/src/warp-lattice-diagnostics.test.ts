import { describe, expect, it } from "vitest";

import { defaultCheckCatalog } from "./check-catalog.js";
import type { ValidationCheckResultDto } from "./validation-report.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

const CREATED_AT = "2026-06-02T00:00:00.000Z";
const PACKAGE_ID = "pkg_warp_validator";
const PART_ID = "part_root";
const DRAWABLE_ID = "draw_body";
const MESH_ID = "mesh_body";
const SOURCE_ASSET_ID = "src_generated";
const TEXTURE_ID = "tex_body";
const PROVENANCE_ID = "prov_generated";
const RIG_WARP_ID = "rig_warp";
const PARAMETER_ID = "param_faceYaw";
const KEYFORM_SET_ID = "keyset_rig_warp_controlPointOffsets_param_faceYaw";

describe("validator warpLattice2d diagnostics", () => {
  it("registers deterministic warp lattice check IDs", () => {
    expect(defaultCheckCatalog.has("rigControl.warpLatticeCardinalityMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("rigControl.warpLatticeDomainBoundsInvalid")).toBe(true);
    expect(defaultCheckCatalog.has("rigControl.warpLatticeRestControlPointMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("rigControl.warpLatticeUnsupportedProperty")).toBe(true);
    expect(defaultCheckCatalog.has("rigControl.warpLatticeMalformedPatch")).toBe(true);
    expect(defaultCheckCatalog.has("rigControl.warpLatticeRuntimeEvidenceMismatch")).toBe(true);
  });

  it("accepts valid warp lattice package and evaluated runtime evidence", () => {
    const report = validatePackageRuntime({
      packageDocument: createWarpPackage({
        parameters: [createAuthoredParameter()],
        keyformSets: [createWarpControlPointOffsetsKeyformSet()]
      }),
      runtimeSnapshot: createRuntimeSnapshot({
        keyformSamples: [createWarpControlPointOffsetsSample()],
        rigControls: [createSnapshotWarpRigControl()]
      }),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
    expect(report.evidence.runtimeSnapshotIds).toEqual(["snap_warp_validator_0"]);
  });

  it("maps invalid lattice cardinality and domain bounds schema issues to warp lattice diagnostics", () => {
    const report = validatePackageRuntime({
      packageDocument: createWarpPackage({
        rigControls: [
          createWarpRigControl({
            enabled: false,
            domainBounds: {
              x: 0,
              y: 0,
              width: 0,
              height: 2
            },
            latticeColumns: 3,
            latticeRows: 2,
            restControlPoints: [
              { x: 0, y: 0 },
              { x: 2, y: 0 },
              { x: 0, y: 2 },
              { x: 3, y: 3 }
            ]
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(toCheckIds(report.checks)).toEqual([
      "rigControl.warpLatticeDomainBoundsInvalid",
      "rigControl.warpLatticeCardinalityMismatch"
    ]);
    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.warpLatticeDomainBoundsInvalid",
        targetPath: "model.rigControls.rigControls.0.domainBounds.width",
        evidence: [
          "rigControlId=rig_warp",
          "domainBounds=x=0,y=0,width=0,height=2",
          "warpLattice2d domainBounds.width must be greater than 0."
        ]
      },
      {
        checkId: "rigControl.warpLatticeCardinalityMismatch",
        targetPath: "model.rigControls.rigControls.0.restControlPoints",
        evidence: [
          "rigControlId=rig_warp",
          "latticeColumns=3",
          "latticeRows=2",
          "expectedRestControlPointCount=6",
          "actualRestControlPointCount=4",
          "warpLattice2d restControlPoints length must equal latticeColumns * latticeRows (6)."
        ]
      }
    ]);
  });

  it("reports rest control points that do not fit inside domain bounds", () => {
    const report = validatePackageRuntime({
      packageDocument: createWarpPackage({
        rigControls: [
          createWarpRigControl({
            enabled: false,
            restControlPoints: [
              { x: 0, y: 0 },
              { x: 2, y: 0 },
              { x: 0, y: 2 },
              { x: 3, y: 3 }
            ]
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.warpLatticeRestControlPointMismatch",
        targetPath: "/model/rigControls/rigControls/0/restControlPoints",
        evidence: [
          "rigControlId=rig_warp",
          "domainBounds=x=0,y=0,width=2,height=2",
          "outsideRestControlPointIndexes=3"
        ]
      }
    ]);
  });

  it("reports unsupported warp lattice keyform property", () => {
    const report = validatePackageRuntime({
      packageDocument: createWarpPackage({
        parameters: [createAuthoredParameter()],
        rigControls: [createWarpRigControl({ enabled: false })],
        keyformSets: [
          createWarpControlPointOffsetsKeyformSet({
            keyformSetId: "keyset_rig_warp_angle_param_faceYaw",
            property: "angleDegrees",
            statePatch: 10
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.warpLatticeUnsupportedProperty",
        targetPath: "/model/keyforms/keyformSets/0/target/property",
        evidence: [
          "keyformSetId=keyset_rig_warp_angle_param_faceYaw",
          "rigControlId=rig_warp",
          "targetProperty=angleDegrees",
          "supportedProperty=controlPointOffsets"
        ]
      }
    ]);
  });

  it("maps malformed warp lattice keyform patch schema issues to a stable diagnostic", () => {
    const report = validatePackageRuntime({
      packageDocument: createWarpPackage({
        parameters: [createAuthoredParameter()],
        rigControls: [createWarpRigControl({ enabled: false })],
        keyformSets: [
          createWarpControlPointOffsetsKeyformSet({
            statePatch: [{ x: 0, y: 0 }]
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.warpLatticeMalformedPatch",
        targetPath: "model.keyforms.keyformSets.0.keys.0.statePatch",
        evidence: [
          "keyformSetId=keyset_rig_warp_controlPointOffsets_param_faceYaw",
          "rigControlId=rig_warp",
          "targetProperty=controlPointOffsets",
          "warpLattice2d controlPointOffsets statePatch must be a control-point-ordered Vec2[] with at least four entries."
        ]
      }
    ]);
  });

  it("reports missing and stale warp lattice runtime evidence through the rig control runtime check", () => {
    const missingReport = validatePackageRuntime({
      packageDocument: createWarpPackage(),
      createdAt: CREATED_AT
    });
    const staleReport = validatePackageRuntime({
      packageDocument: createWarpPackage(),
      runtimeSnapshot: createRuntimeSnapshot({
        packageId: "pkg_warp_validator_stale",
        packageRevision: 7,
        rigControls: [createSnapshotWarpRigControl()]
      }),
      createdAt: CREATED_AT
    });

    expect(missingReport.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.runtimeEvidenceMissing",
        targetPath: "/model/rigControls/rigControls/0",
        evidence: [
          "rigControlId=rig_warp",
          "rigControlKind=warpLattice2d",
          "runtimeSnapshot=missing"
        ]
      }
    ]);
    expect(staleReport.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.runtimeEvidenceMissing",
        targetPath: "/model/rigControls/rigControls/0",
        evidence: [
          "rigControlId=rig_warp",
          "snapshotId=snap_warp_validator_0",
          "runtimeSnapshotRef=runtime/snapshots/snap_warp_validator_0.runtime-snapshot.json",
          "runtimeSnapshotIdentity=mismatch",
          "packageId=pkg_warp_validator",
          "snapshotPackageId=pkg_warp_validator_stale",
          "packageRevision=0",
          "snapshotPackageRevision=7"
        ]
      }
    ]);
  });

  it("reports malformed Viewer evidence while keeping valid warp runtime evidence accepted", () => {
    const report = validatePackageRuntime({
      packageDocument: createWarpPackage(),
      runtimeSnapshot: createRuntimeSnapshot({
        rigControls: [createSnapshotWarpRigControl()]
      }),
      viewerEvidence: {},
      createdAt: CREATED_AT
    });

    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "viewer.runtimeEvidenceMissing",
        targetPath: "context/source/surface",
        evidence: [
          "viewerEvidence=parse-failed",
          "schemaVersion=Invalid input: expected \"viewer-runtime-evaluation-evidence-v1\"",
          "surface=Invalid input: expected \"viewer\"",
          "packageId=Invalid input: expected string, received undefined",
          "packageRevision=Invalid input: expected number, received undefined",
          "baselineSnapshotId=Invalid input: expected string, received undefined",
          "snapshotId=Invalid input: expected string, received undefined",
          "finalRuntimeStateRef=Invalid input: expected string, received undefined",
          "parameterOverrides=Invalid input: expected array, received undefined",
          "baselineParameterOverrides=Invalid input: expected array, received undefined",
          "targetIds=Invalid input: expected array, received undefined",
          "tutorialEvidenceSummary=Invalid input: expected object, received undefined",
          "runtimeDiffEquivalent=Invalid input: expected boolean, received undefined",
          "runtimeEvaluationContext=Invalid input: expected object, received undefined"
        ]
      }
    ]);
  });

  it("reports stale warp lattice runtime shape and unsupported no-op evidence as mismatch", () => {
    const report = validatePackageRuntime({
      packageDocument: createWarpPackage(),
      runtimeSnapshot: createRuntimeSnapshot({
        rigControls: [
          createSnapshotWarpRigControl({
            evaluationStatus: "unsupported",
            affectedDrawableIds: [],
            bounds: {
              x: 0,
              y: 0,
              width: 1,
              height: 1
            },
            unsupportedReason: "warpLattice2dEvaluatorFutureScope"
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.warpLatticeRuntimeEvidenceMismatch",
        targetPath: "/model/rigControls/rigControls/0",
        evidence: [
          "rigControlId=rig_warp",
          "snapshotId=snap_warp_validator_0",
          "runtimeSnapshotRef=runtime/snapshots/snap_warp_validator_0.runtime-snapshot.json",
          "expectedEvaluationStatus=evaluated",
          "runtimeEvaluationStatus=unsupported",
          "runtimeUnsupportedReason=warpLattice2dEvaluatorFutureScope",
          "expectedDomainBounds=x=0,y=0,width=2,height=2",
          "runtimeDomainBounds=x=0,y=0,width=1,height=1",
          "expectedAffectedDrawableIds=draw_body",
          "runtimeAffectedDrawableIds=none"
        ]
      }
    ]);
  });
});

const toCheckIds = (checks: readonly ValidationCheckResultDto[]) =>
  checks.map((check) => check.checkId);

const toDiagnosticSummary = (check: ValidationCheckResultDto) => ({
  checkId: check.checkId,
  targetPath: check.targetPath,
  evidence: check.evidence
});

const createWarpPackage = (overrides: {
  readonly parameters?: readonly unknown[];
  readonly keyformSets?: readonly unknown[];
  readonly rigControls?: readonly unknown[];
} = {}) => ({
  manifest: {
    schemaVersion: "open-model-package-manifest-v1",
    packageId: PACKAGE_ID,
    packageDisplayName: "Warp Lattice Validator",
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
      rigControlRootIds: [RIG_WARP_ID],
      stableOrder: [DRAWABLE_ID, RIG_WARP_ID]
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
            { x: 2, y: 0 },
            { x: 0, y: 2 }
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
            width: 2,
            height: 2
          },
          generationProvenanceId: PROVENANCE_ID
        }
      ]
    },
    parameters: {
      schemaVersion: "parameters-file-v1",
      parameters: overrides.parameters ?? []
    },
    keyforms: {
      schemaVersion: "keyforms-file-v1",
      keyformSets: overrides.keyformSets ?? []
    },
    rigControls: {
      schemaVersion: "rig-controls-file-v1",
      rigControls: overrides.rigControls ?? [createWarpRigControl()]
    },
    dynamics: {
      schemaVersion: "dynamics-file-v1",
      dynamicsGroups: []
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

const createAuthoredParameter = () => ({
  parameterId: PARAMETER_ID,
  displayName: "Face Yaw",
  semanticRole: "face",
  valueSource: "authoredInput",
  min: -1,
  max: 1,
  default: 0,
  recommendedUiStep: 0.1
});

const createWarpRigControl = (overrides: Record<string, unknown> = {}) => ({
  kind: "warpLattice2d",
  rigControlId: RIG_WARP_ID,
  displayName: "Body Warp",
  partId: PART_ID,
  childDrawableIds: [DRAWABLE_ID],
  childRigControlIds: [],
  bindSpace: "rigControlLocalRest",
  domainBounds: {
    x: 0,
    y: 0,
    width: 2,
    height: 2
  },
  latticeColumns: 2,
  latticeRows: 2,
  restControlPoints: [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 2 },
    { x: 2, y: 2 }
  ],
  interpolationMethod: "bilinear-grid-v1",
  enabled: true,
  ...overrides
});

const createWarpControlPointOffsetsKeyformSet = (overrides: {
  readonly keyformSetId?: string;
  readonly property?: string;
  readonly statePatch?: unknown;
} = {}) => ({
  keyformSetId: overrides.keyformSetId ?? KEYFORM_SET_ID,
  target: {
    kind: "rigControl",
    id: RIG_WARP_ID,
    property: overrides.property ?? "controlPointOffsets"
  },
  parameterId: PARAMETER_ID,
  evaluator: "linear-1d-v1",
  interpolation: "linear-1d-v1",
  compositionMode: "replace",
  compositionOrder: 0,
  keys: [
    {
      value: 1,
      statePatch: overrides.statePatch ?? createControlPointOffsetsPatch()
    }
  ]
});

const createControlPointOffsetsPatch = () => [
  { x: 0, y: 0 },
  { x: 0.25, y: 0 },
  { x: 0, y: 0.25 },
  { x: 0.25, y: 0.25 }
];

const createRuntimeSnapshot = (overrides: {
  readonly packageId?: string;
  readonly packageRevision?: number;
  readonly keyformSamples?: readonly unknown[];
  readonly rigControls?: readonly unknown[];
} = {}) => ({
  schemaVersion: "runtime-snapshot-v1",
  runtimeCoreVersion: "wave32-warp-lattice-validator-test",
  snapshotId: "snap_warp_validator_0",
  context: {
    source: {
      surface: "validator"
    },
    policy: {
      strictness: "strict"
    }
  },
  packageId: overrides.packageId ?? PACKAGE_ID,
  packageRevision: overrides.packageRevision ?? 0,
  dirty: false,
  evaluation: {
    snapshotDetail: "summary",
    evaluatorVersions: {
      keyform1d: "linear-1d-v1",
      keyformGrid2d: "parameter-grid-2d-v1",
      warpLattice: "bilinear-grid-v1",
      rigControlHierarchy: "parent-before-child-v1"
    }
  },
  parameters: [],
  dynamics: [],
  keyformSamples: overrides.keyformSamples ?? [],
  rigControls: overrides.rigControls ?? [createSnapshotWarpRigControl()],
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
        width: 2.25,
        height: 2.25
      },
      vertexCount: 3,
      vertexHash: "hash_draw_body_warped",
      diagnostics: []
    }
  ],
  drawList: [DRAWABLE_ID],
  disabledFutureLayers: [],
  diagnostics: []
});

const createSnapshotWarpRigControl = (overrides: Record<string, unknown> = {}) => ({
  rigControlId: RIG_WARP_ID,
  kind: "warpLattice2d",
  enabled: true,
  hierarchyIndex: 0,
  evaluationStatus: "evaluated",
  childDrawableIds: [DRAWABLE_ID],
  childRigControlIds: [],
  affectedDrawableIds: [DRAWABLE_ID],
  affectedRigControlIds: [],
  bounds: {
    x: 0,
    y: 0,
    width: 2,
    height: 2
  },
  ...overrides
});

const createWarpControlPointOffsetsSample = (overrides: Record<string, unknown> = {}) => ({
  keyformSetId: KEYFORM_SET_ID,
  evaluator: "linear-1d-v1",
  sampledCoordinates: {
    [PARAMETER_ID]: 1
  },
  target: "rigControl:rig_warp.controlPointOffsets",
  targetMetadata: {
    targetKind: "rigControl",
    targetId: RIG_WARP_ID,
    targetProperty: "controlPointOffsets"
  },
  compositionMode: "replace",
  compositionOrder: 0,
  statePatch: createControlPointOffsetsPatch(),
  samplingStatus: "exactKey",
  ...overrides
});
