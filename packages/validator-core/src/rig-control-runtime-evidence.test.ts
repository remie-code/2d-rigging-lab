import { describe, expect, it } from "vitest";

import type { ValidationCheckResultDto } from "./validation-report.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

const CREATED_AT = "2026-06-01T00:00:00.000Z";
const PACKAGE_ID = "pkg_rig_validator";
const PART_ID = "part_root";
const DRAWABLE_ID = "draw_body";
const MESH_ID = "mesh_body";
const SOURCE_ASSET_ID = "src_generated";
const TEXTURE_ID = "tex_body";
const PROVENANCE_ID = "prov_generated";
const RIG_PARENT_ID = "rig_parent";
const RIG_CHILD_ID = "rig_child";
const RIG_WARP_ID = "rig_warp";
const PARAMETER_ID = "param_faceYaw";
const KEYFORM_SET_ID = "keyset_rig_parent_angleDegrees_param_faceYaw";

describe("validator rig control runtime evidence checks", () => {
  it("validates a keyform-driven rotation2d rig control package with runtime evidence", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage({
        parameters: [createAuthoredParameter()],
        keyformSets: [createRigControlAngleKeyformSet()]
      }),
      runtimeSnapshot: createRuntimeSnapshot({
        keyformSamples: [createRigControlAngleKeyformSample()],
        rigControls: [
          createSnapshotRigControl(RIG_PARENT_ID, {
            childDrawableIds: [DRAWABLE_ID],
            childRigControlIds: [RIG_CHILD_ID],
            affectedDrawableIds: [DRAWABLE_ID],
            affectedRigControlIds: [RIG_CHILD_ID],
            localTransform: createRotationTransform(45),
            worldTransform: createRotationTransform(45)
          }),
          createSnapshotRigControl(RIG_CHILD_ID, {
            hierarchyIndex: 1,
            parentId: RIG_PARENT_ID
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
    expect(report.evidence.runtimeSnapshotIds).toEqual(["snap_rig_validator_0"]);
  });

  it("accepts matrix-derived child world angle under a non-uniform parent scale", () => {
    const childKeyformSetId = "keyset_rig_child_angleDegrees_param_faceYaw";
    const parentTransform = createScaleTransform({ x: 2, y: 1 });
    const childLocalTransform = createRotationTransform(45);
    const childWorldTransform = createComposedTransform(parentTransform, childLocalTransform);

    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage({
        parameters: [createAuthoredParameter()],
        keyformSets: [
          createRigControlAngleKeyformSet({
            keyformSetId: childKeyformSetId,
            rigControlId: RIG_CHILD_ID
          })
        ],
        rigControls: [
          createRotationRigControl(RIG_PARENT_ID, {
            childRigControlIds: [RIG_CHILD_ID],
            restScale: { x: 2, y: 1 }
          }),
          createRotationRigControl(RIG_CHILD_ID, {
            parentId: RIG_PARENT_ID,
            childDrawableIds: [DRAWABLE_ID]
          })
        ]
      }),
      runtimeSnapshot: createRuntimeSnapshot({
        keyformSamples: [
          createRigControlAngleKeyformSample({
            keyformSetId: childKeyformSetId,
            target: "rigControl:rig_child.angleDegrees",
            targetMetadata: {
              targetKind: "rigControl",
              targetId: RIG_CHILD_ID,
              targetProperty: "angleDegrees"
            }
          })
        ],
        rigControls: [
          createSnapshotRigControl(RIG_PARENT_ID, {
            childRigControlIds: [RIG_CHILD_ID],
            localTransform: parentTransform,
            worldTransform: parentTransform
          }),
          createSnapshotRigControl(RIG_CHILD_ID, {
            hierarchyIndex: 1,
            parentId: RIG_PARENT_ID,
            childDrawableIds: [DRAWABLE_ID],
            affectedDrawableIds: [DRAWABLE_ID],
            localTransform: childLocalTransform,
            worldTransform: childWorldTransform
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(childWorldTransform.angleDegrees).not.toBe(45);
    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
    expect(report.evidence.runtimeSnapshotIds).toEqual(["snap_rig_validator_0"]);
  });

  it("reports missing keyform-driven rig control runtime evidence with required keyform refs", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage({
        parameters: [createAuthoredParameter()],
        keyformSets: [createRigControlAngleKeyformSet()]
      }),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.runtimeEvidenceMissing",
        targetId: RIG_CHILD_ID,
        targetPath: "/model/rigControls/rigControls/1",
        severity: "error",
        evidence: [
          "rigControlId=rig_child",
          "rigControlKind=rotation2d",
          "runtimeSnapshot=missing"
        ]
      },
      {
        checkId: "rigControl.runtimeEvidenceMissing",
        targetId: RIG_PARENT_ID,
        targetPath: "/model/rigControls/rigControls/0",
        severity: "error",
        evidence: [
          "rigControlId=rig_parent",
          "rigControlKind=rotation2d",
          "runtimeSnapshot=missing",
          "requiredKeyformSetIds=keyset_rig_parent_angleDegrees_param_faceYaw",
          "expectedKeyformTargets=rigControl:rig_parent.angleDegrees"
        ]
      }
    ]);
    expect(report.evidence.runtimeSnapshotIds).toEqual([]);
  });

  it("reports stale rig control runtime snapshot identity deterministically", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage({
        parameters: [createAuthoredParameter()],
        keyformSets: [createRigControlAngleKeyformSet()]
      }),
      runtimeSnapshot: createRuntimeSnapshot({
        packageId: "pkg_rig_validator_stale",
        packageRevision: 7,
        keyformSamples: [createRigControlAngleKeyformSample()],
        rigControls: [
          createSnapshotRigControl(RIG_PARENT_ID, {
            childDrawableIds: [DRAWABLE_ID],
            childRigControlIds: [RIG_CHILD_ID],
            affectedDrawableIds: [DRAWABLE_ID],
            affectedRigControlIds: [RIG_CHILD_ID],
            localTransform: createRotationTransform(45),
            worldTransform: createRotationTransform(45)
          }),
          createSnapshotRigControl(RIG_CHILD_ID, {
            hierarchyIndex: 1,
            parentId: RIG_PARENT_ID
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(toRuntimeEvidenceSummaries(report.checks)).toEqual([
      {
        checkId: "rigControl.runtimeEvidenceMissing",
        targetId: RIG_CHILD_ID,
        targetPath: "/model/rigControls/rigControls/1",
        status: "fail",
        severity: "error",
        snapshotIds: ["snap_rig_validator_0"],
        evidence: [
          "rigControlId=rig_child",
          "snapshotId=snap_rig_validator_0",
          "runtimeSnapshotRef=runtime/snapshots/snap_rig_validator_0.runtime-snapshot.json",
          "runtimeSnapshotIdentity=mismatch",
          "packageId=pkg_rig_validator",
          "snapshotPackageId=pkg_rig_validator_stale",
          "packageRevision=0",
          "snapshotPackageRevision=7"
        ]
      },
      {
        checkId: "rigControl.runtimeEvidenceMissing",
        targetId: RIG_PARENT_ID,
        targetPath: "/model/rigControls/rigControls/0",
        status: "fail",
        severity: "error",
        snapshotIds: ["snap_rig_validator_0"],
        evidence: [
          "rigControlId=rig_parent",
          "snapshotId=snap_rig_validator_0",
          "runtimeSnapshotRef=runtime/snapshots/snap_rig_validator_0.runtime-snapshot.json",
          "runtimeSnapshotIdentity=mismatch",
          "packageId=pkg_rig_validator",
          "snapshotPackageId=pkg_rig_validator_stale",
          "packageRevision=0",
          "snapshotPackageRevision=7",
          "requiredKeyformSetIds=keyset_rig_parent_angleDegrees_param_faceYaw",
          "expectedKeyformTargets=rigControl:rig_parent.angleDegrees"
        ]
      }
    ]);
  });

  it("reports mismatched keyform-driven world transform evidence deterministically", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage({
        parameters: [createAuthoredParameter()],
        keyformSets: [createRigControlAngleKeyformSet()]
      }),
      runtimeSnapshot: createRuntimeSnapshot({
        keyformSamples: [createRigControlAngleKeyformSample()],
        rigControls: [
          createSnapshotRigControl(RIG_PARENT_ID, {
            childDrawableIds: [DRAWABLE_ID],
            childRigControlIds: [RIG_CHILD_ID],
            affectedDrawableIds: [DRAWABLE_ID],
            affectedRigControlIds: [RIG_CHILD_ID],
            localTransform: createRotationTransform(45),
            worldTransform: createRotationTransform(0)
          }),
          createSnapshotRigControl(RIG_CHILD_ID, {
            hierarchyIndex: 1,
            parentId: RIG_PARENT_ID
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(toRuntimeEvidenceSummaries(report.checks)).toEqual([
      {
        checkId: "rigControl.runtimeEvidenceMissing",
        targetId: RIG_PARENT_ID,
        targetPath: "/model/rigControls/rigControls/0",
        status: "fail",
        severity: "error",
        snapshotIds: ["snap_rig_validator_0"],
        evidence: [
          "rigControlId=rig_parent",
          "snapshotId=snap_rig_validator_0",
          "runtimeSnapshotRef=runtime/snapshots/snap_rig_validator_0.runtime-snapshot.json",
          "snapshotRigControl=mismatch",
          "requiredKeyformSetIds=keyset_rig_parent_angleDegrees_param_faceYaw",
          "expectedKeyformTargets=rigControl:rig_parent.angleDegrees",
          "expectedWorldAngleDegrees=45",
          "runtimeWorldAngleDegrees=0",
          "expectedWorldMatrix=a=0.707106781187,b=0.707106781187,c=-0.707106781187,d=0.707106781187,e=0,f=0",
          "runtimeWorldMatrix=a=1,b=0,c=0,d=1,e=0,f=0"
        ]
      }
    ]);
  });

  it("reports mismatched keyform-driven rig control runtime evidence deterministically", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage({
        parameters: [createAuthoredParameter()],
        keyformSets: [createRigControlAngleKeyformSet()]
      }),
      runtimeSnapshot: createRuntimeSnapshot({
        keyformSamples: [
          createRigControlAngleKeyformSample({
            target: "rigControl:rig_child.restAngleDegrees",
            targetMetadata: {
              targetKind: "rigControl",
              targetId: RIG_CHILD_ID,
              targetProperty: "restAngleDegrees"
            },
            compositionMode: "additiveDelta",
            compositionOrder: 2,
            statePatch: 15
          })
        ],
        rigControls: [
          createSnapshotRigControl(RIG_PARENT_ID, {
            childDrawableIds: [DRAWABLE_ID],
            childRigControlIds: [RIG_CHILD_ID],
            affectedDrawableIds: [],
            affectedRigControlIds: [],
            localTransform: createRotationTransform(0)
          }),
          createSnapshotRigControl(RIG_CHILD_ID, {
            hierarchyIndex: 1,
            parentId: RIG_PARENT_ID
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(toRuntimeEvidenceSummaries(report.checks)).toEqual([
      {
        checkId: "rigControl.runtimeEvidenceMissing",
        targetId: RIG_PARENT_ID,
        targetPath: "/model/rigControls/rigControls/0",
        status: "fail",
        severity: "error",
        snapshotIds: ["snap_rig_validator_0"],
        evidence: [
          "rigControlId=rig_parent",
          "snapshotId=snap_rig_validator_0",
          "runtimeSnapshotRef=runtime/snapshots/snap_rig_validator_0.runtime-snapshot.json",
          "snapshotRigControl=mismatch",
          "requiredKeyformSetIds=keyset_rig_parent_angleDegrees_param_faceYaw",
          "expectedKeyformTargets=rigControl:rig_parent.angleDegrees",
          "keyformSetId=keyset_rig_parent_angleDegrees_param_faceYaw",
          "expectedKeyformTarget=rigControl:rig_parent.angleDegrees",
          "runtimeKeyformTarget=rigControl:rig_child.restAngleDegrees",
          "keyformSetId=keyset_rig_parent_angleDegrees_param_faceYaw",
          "runtimeKeyformTargetMetadata=mismatch",
          "expectedTargetKind=rigControl",
          "runtimeTargetKind=rigControl",
          "expectedTargetId=rig_parent",
          "runtimeTargetId=rig_child",
          "expectedTargetProperty=angleDegrees",
          "runtimeTargetProperty=restAngleDegrees",
          "keyformSetId=keyset_rig_parent_angleDegrees_param_faceYaw",
          "expectedCompositionMode=replace",
          "runtimeCompositionMode=additiveDelta",
          "keyformSetId=keyset_rig_parent_angleDegrees_param_faceYaw",
          "expectedCompositionOrder=0",
          "runtimeCompositionOrder=2",
          "runtimeWorldTransform=missing",
          "keyformSetId=keyset_rig_parent_angleDegrees_param_faceYaw",
          "expectedLocalAngleDegrees=15",
          "runtimeLocalAngleDegrees=0",
          "expectedAffectedDrawableIds=draw_body",
          "runtimeAffectedDrawableIds=none",
          "expectedAffectedRigControlIds=rig_child",
          "runtimeAffectedRigControlIds=none"
        ]
      }
    ]);
  });

  it("reports unsupported warp lattice property and unsupported no-op runtime evidence after Wave32", () => {
    const warpKeyformSetId = "keyset_rig_warp_angleDegrees_param_faceYaw";
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage({
        graphRootIds: [RIG_WARP_ID],
        parameters: [createAuthoredParameter()],
        keyformSets: [
          createRigControlAngleKeyformSet({
            keyformSetId: warpKeyformSetId,
            rigControlId: RIG_WARP_ID
          })
        ],
        rigControls: [
          createWarpRigControl(RIG_WARP_ID, {
            childDrawableIds: [DRAWABLE_ID]
          })
        ]
      }),
      runtimeSnapshot: createRuntimeSnapshot({
        keyformSamples: [
          createRigControlAngleKeyformSample({
            keyformSetId: warpKeyformSetId,
            target: "rigControl:rig_warp.angleDegrees",
            targetMetadata: {
              targetKind: "rigControl",
              targetId: RIG_WARP_ID,
              targetProperty: "angleDegrees"
            },
            statePatch: 10
          })
        ],
        rigControls: [
          createSnapshotRigControl(RIG_WARP_ID, {
            kind: "warpLattice2d",
            evaluationStatus: "unsupported",
            childDrawableIds: [DRAWABLE_ID],
            affectedDrawableIds: [DRAWABLE_ID],
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

    expect(report.summary.status).toBe("fail");
    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.warpLatticeUnsupportedProperty",
        targetId: warpKeyformSetId,
        targetPath: "/model/keyforms/keyformSets/0/target/property",
        severity: "error",
        evidence: [
          `keyformSetId=${warpKeyformSetId}`,
          "rigControlId=rig_warp",
          "targetProperty=angleDegrees",
          "supportedProperty=controlPointOffsets"
        ]
      },
      {
        checkId: "rigControl.warpLatticeRuntimeEvidenceMismatch",
        targetId: RIG_WARP_ID,
        targetPath: "/model/rigControls/rigControls/0",
        severity: "error",
        evidence: [
          "rigControlId=rig_warp",
          "snapshotId=snap_rig_validator_0",
          "runtimeSnapshotRef=runtime/snapshots/snap_rig_validator_0.runtime-snapshot.json",
          "expectedEvaluationStatus=evaluated",
          "runtimeEvaluationStatus=unsupported",
          "runtimeUnsupportedReason=warpLattice2dEvaluatorFutureScope"
        ]
      }
    ]);
    expect(report.evidence.runtimeSnapshotIds).toEqual(["snap_rig_validator_0"]);
  });
});

const toDiagnosticSummary = (check: ValidationCheckResultDto) => ({
  checkId: check.checkId,
  targetId: check.target.id,
  targetPath: check.targetPath,
  severity: check.severity,
  evidence: check.evidence
});

const toRuntimeEvidenceSummaries = (checks: readonly ValidationCheckResultDto[]) =>
  checks
    .filter((check) => check.checkId === "rigControl.runtimeEvidenceMissing")
    .map((check) => ({
      checkId: check.checkId,
      targetId: check.target.id,
      targetPath: check.targetPath,
      status: check.status,
      severity: check.severity,
      snapshotIds: check.snapshotIds,
      evidence: check.evidence
    }));

const createRigControlPackage = (overrides: {
  readonly graphRootIds?: readonly string[];
  readonly parameters?: readonly unknown[];
  readonly keyformSets?: readonly unknown[];
  readonly rigControls?: readonly unknown[];
} = {}) => ({
  manifest: {
    schemaVersion: "open-model-package-manifest-v1",
    packageId: PACKAGE_ID,
    packageDisplayName: "Rig Control Runtime Evidence Validator",
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
      rigControlRootIds: overrides.graphRootIds ?? [RIG_PARENT_ID],
      stableOrder: [DRAWABLE_ID, RIG_PARENT_ID, RIG_CHILD_ID, RIG_WARP_ID]
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
      parameters: overrides.parameters ?? []
    },
    keyforms: {
      schemaVersion: "keyforms-file-v1",
      keyformSets: overrides.keyformSets ?? []
    },
    rigControls: {
      schemaVersion: "rig-controls-file-v1",
      rigControls: overrides.rigControls ?? [
        createRotationRigControl(RIG_PARENT_ID, {
          childDrawableIds: [DRAWABLE_ID],
          childRigControlIds: [RIG_CHILD_ID]
        }),
        createRotationRigControl(RIG_CHILD_ID, {
          parentId: RIG_PARENT_ID
        })
      ]
    },
    dynamics: {
      schemaVersion: "dynamics-file-v2",
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

const createRigControlAngleKeyformSet = (overrides: {
  readonly keyformSetId?: string;
  readonly rigControlId?: string;
} = {}) => ({
  keyformSetId: overrides.keyformSetId ?? KEYFORM_SET_ID,
  target: {
    kind: "rigControl",
    id: overrides.rigControlId ?? RIG_PARENT_ID,
    property: "angleDegrees"
  },
  parameterId: PARAMETER_ID,
  evaluator: "linear-1d-v1",
  interpolation: "linear-1d-v1",
  compositionMode: "replace",
  compositionOrder: 0,
  keys: [
    {
      value: -1,
      statePatch: -45
    },
    {
      value: 1,
      statePatch: 45
    }
  ]
});

const createRotationRigControl = (rigControlId: string, overrides: Record<string, unknown> = {}) => ({
  kind: "rotation2d",
  rigControlId,
  displayName: rigControlId,
  partId: PART_ID,
  childDrawableIds: [],
  childRigControlIds: [],
  pivot: { x: 0, y: 0 },
  restAngleDegrees: 0,
  restTranslation: { x: 0, y: 0 },
  restScale: { x: 1, y: 1 },
  enabled: true,
  ...overrides
});

const createWarpRigControl = (rigControlId: string, overrides: Record<string, unknown> = {}) => ({
  kind: "warpLattice2d",
  rigControlId,
  displayName: rigControlId,
  partId: PART_ID,
  childDrawableIds: [],
  childRigControlIds: [],
  bindSpace: "rigControlLocalRest",
  domainBounds: {
    x: 0,
    y: 0,
    width: 1,
    height: 1
  },
  latticeColumns: 2,
  latticeRows: 2,
  restControlPoints: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 }
  ],
  interpolationMethod: "bilinear-grid-v1",
  enabled: true,
  ...overrides
});

const createRuntimeSnapshot = (overrides: {
  readonly packageId?: string;
  readonly packageRevision?: number;
  readonly keyformSamples?: readonly unknown[];
  readonly rigControls?: readonly unknown[];
} = {}) => ({
  schemaVersion: "runtime-snapshot-v1",
  runtimeCoreVersion: "wave26-rig-control-runtime-evidence-test",
  snapshotId: "snap_rig_validator_0",
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
      dynamics: "additivePendulumV0",
      keyform1d: "linear-1d-v1",
      keyformGrid2d: "parameter-grid-2d-v1",
      warpLattice: "bilinear-grid-v1",
      rigControlHierarchy: "parent-before-child-v1"
    }
  },
  parameters: [],
  dynamics: [],
  keyformSamples: overrides.keyformSamples ?? [],
  rigControls: overrides.rigControls ?? [
    createSnapshotRigControl(RIG_PARENT_ID, {
      childDrawableIds: [DRAWABLE_ID],
      childRigControlIds: [RIG_CHILD_ID],
      affectedDrawableIds: [DRAWABLE_ID],
      affectedRigControlIds: [RIG_CHILD_ID]
    }),
    createSnapshotRigControl(RIG_CHILD_ID, {
      hierarchyIndex: 1,
      parentId: RIG_PARENT_ID
    })
  ],
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

const createRigControlAngleKeyformSample = (overrides: Record<string, unknown> = {}) => ({
  keyformSetId: KEYFORM_SET_ID,
  evaluator: "linear-1d-v1",
  sampledCoordinates: {
    [PARAMETER_ID]: 1
  },
  target: "rigControl:rig_parent.angleDegrees",
  targetMetadata: {
    targetKind: "rigControl",
    targetId: RIG_PARENT_ID,
    targetProperty: "angleDegrees"
  },
  compositionMode: "replace",
  compositionOrder: 0,
  statePatch: 45,
  samplingStatus: "exactKey",
  ...overrides
});

const createSnapshotRigControl = (rigControlId: string, overrides: Record<string, unknown> = {}) => ({
  rigControlId,
  kind: "rotation2d",
  enabled: true,
  hierarchyIndex: 0,
  evaluationStatus: "evaluated",
  childDrawableIds: [],
  childRigControlIds: [],
  affectedDrawableIds: [],
  affectedRigControlIds: [],
  ...overrides
});

const createRotationTransform = (angleDegrees: number) => {
  const radians = (angleDegrees * Math.PI) / 180;
  const cos = Number(Math.cos(radians).toFixed(12));
  const sin = Number(Math.sin(radians).toFixed(12));

  return {
    pivot: { x: 0, y: 0 },
    angleDegrees,
    translation: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    matrix: {
      a: cos,
      b: sin,
      c: -sin,
      d: cos,
      e: 0,
      f: 0
    }
  };
};

const createScaleTransform = (scale: { readonly x: number; readonly y: number }): ReturnType<typeof createRotationTransform> => ({
  pivot: { x: 0, y: 0 },
  angleDegrees: 0,
  translation: { x: 0, y: 0 },
  scale,
  matrix: {
    a: scale.x,
    b: 0,
    c: 0,
    d: scale.y,
    e: 0,
    f: 0
  }
});

const createComposedTransform = (
  parent: ReturnType<typeof createRotationTransform>,
  local: ReturnType<typeof createRotationTransform>
): ReturnType<typeof createRotationTransform> => {
  const matrix = composeAffine2d(parent.matrix, local.matrix);

  return {
    pivot: { x: 0, y: 0 },
    angleDegrees: extractRotationDegrees(matrix),
    translation: {
      x: matrix.e,
      y: matrix.f
    },
    scale: {
      x: Number(Math.hypot(matrix.a, matrix.b).toFixed(12)),
      y: Number(Math.hypot(matrix.c, matrix.d).toFixed(12))
    },
    matrix
  };
};

const composeAffine2d = (
  parent: ReturnType<typeof createRotationTransform>["matrix"],
  local: ReturnType<typeof createRotationTransform>["matrix"]
): ReturnType<typeof createRotationTransform>["matrix"] => ({
  a: parent.a * local.a + parent.c * local.b,
  b: parent.b * local.a + parent.d * local.b,
  c: parent.a * local.c + parent.c * local.d,
  d: parent.b * local.c + parent.d * local.d,
  e: parent.a * local.e + parent.c * local.f + parent.e,
  f: parent.b * local.e + parent.d * local.f + parent.f
});

const extractRotationDegrees = (matrix: ReturnType<typeof createRotationTransform>["matrix"]): number => {
  const radians = Math.atan2(matrix.b, matrix.a);
  return Number(((radians * 180) / Math.PI).toFixed(12));
};
