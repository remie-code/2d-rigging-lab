import { describe, expect, it } from "vitest";

import type { ValidationCheckResultDto } from "./validation-report.js";
import { defaultCheckCatalog } from "./check-catalog.js";
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

describe("validator rig control semantic checks", () => {
  it("registers rig control semantic checks in the catalog", () => {
    expect(defaultCheckCatalog.has("rigControl.cycle")).toBe(true);
    expect(defaultCheckCatalog.has("rigControl.parentMissing")).toBe(true);
    expect(defaultCheckCatalog.has("rigControl.childMissing")).toBe(true);
    expect(defaultCheckCatalog.has("rigControl.invalidChildTargetKind")).toBe(true);
    expect(defaultCheckCatalog.has("rigControl.duplicateChild")).toBe(true);
    expect(defaultCheckCatalog.has("rigControl.drawableMultipleParents")).toBe(true);
    expect(defaultCheckCatalog.has("rigControl.opacityMultiplierRange")).toBe(true);
    expect(defaultCheckCatalog.has("rigControl.parentChildMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("rigControl.runtimeEvidenceMissing")).toBe(true);
  });

  it("validates a parent-child rig control package with runtime evidence", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage(),
      runtimeSnapshot: createRuntimeSnapshot(),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
    expect(report.evidence.runtimeSnapshotIds).toEqual(["snap_rig_validator_0"]);
  });

  it("emits deterministic diagnostics for rig control hierarchy cycles", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage({
        graphRootIds: [],
        rigControls: [
          createRotationRigControl(RIG_PARENT_ID, {
            parentId: RIG_CHILD_ID,
            childRigControlIds: [RIG_CHILD_ID]
          }),
          createRotationRigControl(RIG_CHILD_ID, {
            parentId: RIG_PARENT_ID,
            childRigControlIds: [RIG_PARENT_ID]
          })
        ]
      }),
      runtimeSnapshot: createRuntimeSnapshot({
        rigControls: [
          createSnapshotRigControl(RIG_PARENT_ID, {
            parentId: RIG_CHILD_ID
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
    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.cycle",
        targetId: RIG_CHILD_ID,
        targetPath: "/model/rigControls/rigControls/1",
        severity: "blocking",
        evidence: [
          "cyclePath=rig_child>rig_parent>rig_child",
          "cycleLength=2"
        ]
      }
    ]);
  });

  it("emits deterministic diagnostics for parentId-only rig control hierarchy cycles", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage({
        graphRootIds: [],
        rigControls: [
          createRotationRigControl(RIG_PARENT_ID, {
            parentId: RIG_CHILD_ID
          }),
          createRotationRigControl(RIG_CHILD_ID, {
            parentId: RIG_PARENT_ID
          })
        ]
      }),
      runtimeSnapshot: createRuntimeSnapshot(),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.cycle",
        targetId: RIG_CHILD_ID,
        targetPath: "/model/rigControls/rigControls/1",
        severity: "blocking",
        evidence: [
          "cyclePath=rig_child>rig_parent>rig_child",
          "cycleLength=2"
        ]
      }
    ]);
  });

  it("emits deterministic diagnostics for missing rig control parent and child targets", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage({
        graphRootIds: [],
        rigControls: [
          createRotationRigControl(RIG_PARENT_ID, {
            parentId: "rig_missingParent",
            childDrawableIds: ["draw_missingDrawable"],
            childRigControlIds: ["rig_missingChild"]
          })
        ]
      }),
      runtimeSnapshot: createRuntimeSnapshot({
        rigControls: [
          createSnapshotRigControl(RIG_PARENT_ID, {
            parentId: "rig_missingParent"
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.parentMissing",
        targetId: "rig_missingParent",
        targetPath: "/model/rigControls/rigControls/0/parentId",
        severity: "error",
        evidence: [
          "rigControlId=rig_parent",
          "parentId=rig_missingParent",
          "parentMatch=missing"
        ]
      },
      {
        checkId: "rigControl.childMissing",
        targetId: "rig_missingChild",
        targetPath: "/model/rigControls/rigControls/0/childRigControlIds/0",
        severity: "error",
        evidence: [
          "rigControlId=rig_parent",
          "childKind=rigControl",
          "childId=rig_missingChild",
          "childMatch=missing"
        ]
      },
      {
        checkId: "rigControl.childMissing",
        targetId: "draw_missingDrawable",
        targetPath: "/model/rigControls/rigControls/0/childDrawableIds/0",
        severity: "error",
        evidence: [
          "rigControlId=rig_parent",
          "childKind=drawable",
          "childId=draw_missingDrawable",
          "childMatch=missing"
        ]
      }
    ]);
  });

  it("emits a deterministic diagnostic for parent/child hierarchy mismatches", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage({
        graphRootIds: [RIG_PARENT_ID],
        rigControls: [
          createRotationRigControl(RIG_PARENT_ID, {
            childRigControlIds: [RIG_CHILD_ID]
          }),
          createRotationRigControl(RIG_CHILD_ID)
        ]
      }),
      runtimeSnapshot: createRuntimeSnapshot({
        rigControls: [
          createSnapshotRigControl(RIG_PARENT_ID, {
            childRigControlIds: [RIG_CHILD_ID],
            affectedRigControlIds: [RIG_CHILD_ID]
          }),
          createSnapshotRigControl(RIG_CHILD_ID, {
            hierarchyIndex: 1
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.parentChildMismatch",
        targetId: RIG_CHILD_ID,
        targetPath: "/model/rigControls/rigControls/0/childRigControlIds/0",
        severity: "error",
        evidence: [
          "parentRigControlId=rig_parent",
          "childRigControlId=rig_child",
          "expectedChildParentId=rig_parent",
          "childParentId=missing"
        ]
      }
    ]);
  });

  it("emits deterministic diagnostics for duplicate deformer child bindings", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage({
        graphRootIds: [RIG_PARENT_ID, RIG_CHILD_ID],
        rigControls: [
          createRotationRigControl(RIG_PARENT_ID, {
            childDrawableIds: [DRAWABLE_ID, DRAWABLE_ID]
          }),
          createRotationRigControl(RIG_CHILD_ID, {
            childDrawableIds: [DRAWABLE_ID]
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks.filter(isDuplicateBindingCheck).map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.duplicateChild",
        targetId: DRAWABLE_ID,
        targetPath: "/model/rigControls/rigControls/0/childDrawableIds/1",
        severity: "error",
        evidence: [
          "rigControlId=rig_parent",
          "childCollection=childDrawableIds",
          `childId=${DRAWABLE_ID}`,
          "firstIndex=0",
          "duplicateIndex=1"
        ]
      },
      {
        checkId: "rigControl.drawableMultipleParents",
        targetId: DRAWABLE_ID,
        targetPath: "/model/rigControls/rigControls/1/childDrawableIds/0",
        severity: "error",
        evidence: [
          `drawableId=${DRAWABLE_ID}`,
          "parentRigControlIds=rig_child,rig_parent",
          "parentCount=2"
        ]
      }
    ]);
  });

  it("emits a deterministic diagnostic for duplicate child rig-control bindings", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage({
        graphRootIds: [RIG_PARENT_ID],
        rigControls: [
          createRotationRigControl(RIG_PARENT_ID, {
            childRigControlIds: [RIG_CHILD_ID, RIG_CHILD_ID]
          }),
          createRotationRigControl(RIG_CHILD_ID, {
            parentId: RIG_PARENT_ID
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks.filter(isDuplicateBindingCheck).map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.duplicateChild",
        targetId: RIG_CHILD_ID,
        targetPath: "/model/rigControls/rigControls/0/childRigControlIds/1",
        severity: "error",
        evidence: [
          "rigControlId=rig_parent",
          "childCollection=childRigControlIds",
          `childId=${RIG_CHILD_ID}`,
          "firstIndex=0",
          "duplicateIndex=1"
        ]
      }
    ]);
  });

  it("emits a deterministic diagnostic for invalid static opacity multipliers", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage({
        rigControls: [
          createRotationRigControl(RIG_PARENT_ID, {
            opacityMultiplier: 1.2
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.opacityMultiplierRange",
        targetId: RIG_PARENT_ID,
        targetPath: "model.rigControls.rigControls.0.opacityMultiplier",
        severity: "error",
        evidence: [
          "rigControlId=rig_parent",
          "opacityMultiplier=1.2",
          "expectedRange=0..1",
          "Too big: expected number to be <=1"
        ]
      }
    ]);
  });

  it("emits a deterministic diagnostic for invalid child target kind", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage({
        graphRootIds: [RIG_PARENT_ID],
        rigControls: [
          createRotationRigControl(RIG_PARENT_ID, {
            childDrawableIds: [RIG_CHILD_ID]
          })
        ]
      }),
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.invalidChildTargetKind",
        targetId: RIG_PARENT_ID,
        targetPath: "model.rigControls.rigControls.0.childDrawableIds.0",
        severity: "error",
        evidence: [
          "rigControlId=rig_parent",
          "childCollection=childDrawableIds",
          "expectedChildKind=drawable",
          "childId=rig_child",
          "actualChildKind=rigControl",
          expect.stringContaining("Invalid string")
        ]
      }
    ]);
  });

  it("reports runtime evidence mismatches for enabled rig controls", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage(),
      runtimeSnapshot: createRuntimeSnapshot({
        rigControls: [
          createSnapshotRigControl(RIG_PARENT_ID, {
            kind: "warpLattice2d",
            enabled: false,
            parentId: RIG_CHILD_ID,
            childDrawableIds: [DRAWABLE_ID],
            childRigControlIds: [RIG_CHILD_ID],
            affectedDrawableIds: [DRAWABLE_ID],
            affectedRigControlIds: [RIG_CHILD_ID]
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
    expect(report.checks.map(toDiagnosticSummary)).toEqual([
      {
        checkId: "rigControl.runtimeEvidenceMissing",
        targetId: RIG_PARENT_ID,
        targetPath: "/model/rigControls/rigControls/0",
        severity: "error",
        evidence: [
          "rigControlId=rig_parent",
          "snapshotId=snap_rig_validator_0",
          "runtimeSnapshotRef=runtime/snapshots/snap_rig_validator_0.runtime-snapshot.json",
          "snapshotRigControl=mismatch",
          "packageKind=rotation2d",
          "runtimeKind=warpLattice2d",
          "packageEnabled=true",
          "runtimeEnabled=false",
          "packageParentId=root",
          "runtimeParentId=rig_child"
        ]
      }
    ]);
  });

  it("reports runtime evidence gaps for present enabled rig controls", () => {
    const report = validatePackageRuntime({
      packageDocument: createRigControlPackage(),
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
          "runtimeSnapshot=missing"
        ]
      }
    ]);
  });
});

const toDiagnosticSummary = (check: ValidationCheckResultDto) => ({
  checkId: check.checkId,
  targetId: check.target.id,
  targetPath: check.targetPath,
  severity: check.severity,
  evidence: check.evidence
});

const isDuplicateBindingCheck = (check: ValidationCheckResultDto): boolean =>
  check.checkId === "rigControl.duplicateChild" ||
  check.checkId === "rigControl.drawableMultipleParents";

const createRigControlPackage = (overrides: {
  readonly graphRootIds?: readonly string[];
  readonly rigControls?: readonly unknown[];
} = {}) => ({
  manifest: {
    schemaVersion: "open-model-package-manifest-v1",
    packageId: PACKAGE_ID,
    packageDisplayName: "Rig Control Validator",
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
      stableOrder: [DRAWABLE_ID, RIG_PARENT_ID, RIG_CHILD_ID]
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
      parameters: []
    },
    keyforms: {
      schemaVersion: "keyforms-file-v1",
      keyformSets: []
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

const createRuntimeSnapshot = (overrides: {
  readonly rigControls?: readonly unknown[];
} = {}) => ({
  schemaVersion: "runtime-snapshot-v1",
  runtimeCoreVersion: "wave25-rig-control-test",
  snapshotId: "snap_rig_validator_0",
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
  parameters: [],
  dynamics: [],
  keyformSamples: [],
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
