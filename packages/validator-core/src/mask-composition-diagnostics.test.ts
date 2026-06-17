import {
  describe,
  expect,
  it
} from "vitest";

import { defaultCheckCatalog } from "./check-catalog.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

const PACKAGE_ID = "pkg_maskComposition";
const SOURCE_ASSET_ID = "src_generated";
const PROVENANCE_ID = "prov_generated";
const PART_ID = "part_root";
const MASK_DRAWABLE_ID = "draw_mask";
const TARGET_DRAWABLE_ID = "draw_target";
const MASK_MESH_ID = "mesh_mask";
const TARGET_MESH_ID = "mesh_target";
const MASK_TEXTURE_ID = "tex_mask";
const TARGET_TEXTURE_ID = "tex_target";
const MASK_RELATION_ID = "maskrel_faceClip";

describe("validator mask composition diagnostics", () => {
  it("registers formal mask composition check catalog entries", () => {
    expect(defaultCheckCatalog.has("mask.sourceMissing")).toBe(true);
    expect(defaultCheckCatalog.has("mask.targetMissing")).toBe(true);
    expect(defaultCheckCatalog.has("mask.selfReference")).toBe(true);
    expect(defaultCheckCatalog.has("mask.duplicateRelation")).toBe(true);
    expect(defaultCheckCatalog.has("mask.runtimeEvidenceMissing")).toBe(true);
    expect(defaultCheckCatalog.has("mask.runtimeEvidenceMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("mask.opacityEvidenceMissing")).toBe(true);
  });

  it("validates an enabled mask relation with matching runtime evidence", () => {
    const report = validatePackageRuntime({
      packageDocument: createPackageDocument({
        masks: [createMaskRelation()]
      }),
      runtimeSnapshot: createRuntimeSnapshot({
        masks: [createRuntimeMaskEvidence()]
      }),
      createdAt: "2026-06-01T00:00:00.000Z"
    });

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
    expect(report.evidence.runtimeSnapshotIds).toEqual(["snap_maskComposition_0"]);
  });

  it("reports a missing mask drawable deterministically", () => {
    const report = validatePackageRuntime({
      packageDocument: createPackageDocument({
        masks: [
          createMaskRelation({
            maskDrawableIds: ["draw_missingMask"]
          })
        ]
      }),
      createdAt: "2026-06-01T00:00:00.000Z"
    });

    expect(toCheckIds(report)).toEqual(["mask.sourceMissing"]);
    expect(report.checks[0]).toMatchObject({
      targetPath: "/model/masks/masks/0/maskDrawableIds/0",
      evidence: expect.arrayContaining([
        "maskDrawableId=draw_missingMask",
        "maskDrawableMatch=missing"
      ])
    });
  });

  it("reports a missing target drawable deterministically", () => {
    const report = validatePackageRuntime({
      packageDocument: createPackageDocument({
        masks: [
          createMaskRelation({
            targetDrawableIds: ["draw_missingTarget"]
          })
        ]
      }),
      createdAt: "2026-06-01T00:00:00.000Z"
    });

    expect(toCheckIds(report)).toEqual(["mask.targetMissing"]);
    expect(report.checks[0]).toMatchObject({
      targetPath: "/model/masks/masks/0/targetDrawableIds/0",
      evidence: expect.arrayContaining([
        "targetDrawableId=draw_missingTarget",
        "targetDrawableMatch=missing"
      ])
    });
  });

  it("reports self-mask relations deterministically", () => {
    const report = validatePackageRuntime({
      packageDocument: createPackageDocument({
        masks: [
          createMaskRelation({
            targetDrawableIds: [MASK_DRAWABLE_ID]
          })
        ]
      }),
      createdAt: "2026-06-01T00:00:00.000Z"
    });

    expect(toCheckIds(report)).toEqual(["mask.selfReference"]);
    expect(report.checks[0]).toMatchObject({
      targetPath: "/model/masks/masks/0",
      evidence: expect.arrayContaining([
        `drawableId=${MASK_DRAWABLE_ID}`,
        "selfMask=true"
      ])
    });
  });

  it("reports duplicate semantic mask relations deterministically", () => {
    const report = validatePackageRuntime({
      packageDocument: createPackageDocument({
        masks: [
          createMaskRelation(),
          createMaskRelation({
            maskRelationId: "maskrel_duplicateFaceClip"
          })
        ]
      }),
      runtimeSnapshot: createRuntimeSnapshot({
        masks: [
          createRuntimeMaskEvidence(),
          createRuntimeMaskEvidence({
            maskRelationId: "maskrel_duplicateFaceClip"
          })
        ]
      }),
      createdAt: "2026-06-01T00:00:00.000Z"
    });

    expect(toCheckIds(report)).toEqual(["mask.duplicateRelation"]);
    expect(report.checks[0]).toMatchObject({
      targetPath: "/model/masks/masks/1",
      evidence: expect.arrayContaining([
        "duplicateKind=semanticRelation",
        "firstRelationIndex=0",
        "duplicateRelationIndex=1"
      ])
    });
  });

  it("reports disabled relation evidence mismatches deterministically", () => {
    const report = validatePackageRuntime({
      packageDocument: createPackageDocument({
        masks: [
          createMaskRelation({
            enabled: false
          })
        ]
      }),
      runtimeSnapshot: createRuntimeSnapshot({
        masks: [createRuntimeMaskEvidence()]
      }),
      createdAt: "2026-06-01T00:00:00.000Z"
    });

    expect(toCheckIds(report)).toEqual(["mask.runtimeEvidenceMismatch"]);
    expect(report.checks[0]).toMatchObject({
      targetPath: "/runtimeSnapshot/masks/0",
      evidence: expect.arrayContaining([
        "packageEnabled=false",
        "runtimeMaskEvidence=present"
      ]),
      snapshotIds: ["snap_maskComposition_0"]
    });
  });

  it("reports enabled mask relation runtime evidence gaps deterministically", () => {
    const report = validatePackageRuntime({
      packageDocument: createPackageDocument({
        masks: [createMaskRelation()]
      }),
      createdAt: "2026-06-01T00:00:00.000Z"
    });

    expect(toCheckIds(report)).toEqual(["mask.runtimeEvidenceMissing"]);
    expect(report.checks[0]).toMatchObject({
      targetPath: "/model/masks/masks/0",
      evidence: expect.arrayContaining([
        "enabled=true",
        "runtimeSnapshot=missing"
      ])
    });
  });

  it("reports stale runtime snapshot identity as missing runtime evidence deterministically", () => {
    const report = validatePackageRuntime({
      packageDocument: createPackageDocument({
        masks: [createMaskRelation()]
      }),
      runtimeSnapshot: {
        ...createRuntimeSnapshot({
          masks: [createRuntimeMaskEvidence()]
        }),
        packageRevision: 1
      },
      createdAt: "2026-06-01T00:00:00.000Z"
    });

    expect(toCheckIds(report)).toEqual(["mask.runtimeEvidenceMissing"]);
    expect(report.checks[0]).toMatchObject({
      targetPath: "/model/masks/masks/0",
      evidence: expect.arrayContaining([
        "runtimeSnapshotIdentity=mismatch",
        "packageRevision=0",
        "snapshotPackageRevision=1"
      ]),
      snapshotIds: ["snap_maskComposition_0"]
    });
  });

  it("reports mask opacity evidence gaps when runtime drawable evidence is absent", () => {
    const report = validatePackageRuntime({
      packageDocument: createPackageDocument({
        masks: [createMaskRelation()]
      }),
      runtimeSnapshot: createRuntimeSnapshot({
        drawables: [createRuntimeDrawable(TARGET_DRAWABLE_ID, TARGET_MESH_ID, 1)],
        masks: [createRuntimeMaskEvidence()]
      }),
      createdAt: "2026-06-01T00:00:00.000Z"
    });

    expect(toCheckIds(report)).toEqual(["mask.opacityEvidenceMissing"]);
    expect(report.checks[0]).toMatchObject({
      targetPath: "/model/masks/masks/0",
      evidence: expect.arrayContaining([
        `opacityDrawableEvidenceMissing=${MASK_DRAWABLE_ID}`
      ]),
      snapshotIds: ["snap_maskComposition_0"]
    });
  });

  it("keeps out-of-range runtime opacity under runtime load diagnostics", () => {
    const report = validatePackageRuntime({
      packageDocument: createPackageDocument({
        masks: [createMaskRelation()]
      }),
      runtimeSnapshot: createRuntimeSnapshot({
        drawables: [
          createRuntimeDrawable(MASK_DRAWABLE_ID, MASK_MESH_ID, 0, 1.25),
          createRuntimeDrawable(TARGET_DRAWABLE_ID, TARGET_MESH_ID, 1)
        ],
        masks: [createRuntimeMaskEvidence()]
      }),
      createdAt: "2026-06-01T00:00:00.000Z"
    });

    expect(toCheckIds(report)).toEqual(expect.arrayContaining([
      "mask.runtimeEvidenceMissing",
      "runtime.loadBlocking"
    ]));
    expect(report.checks.find((check) => check.checkId === "runtime.loadBlocking")).toMatchObject({
      targetPath: "drawables.0.opacity"
    });
  });
});

const createPackageDocument = (input: {
  readonly masks?: readonly Record<string, unknown>[];
} = {}) => ({
  manifest: {
    schemaVersion: "open-model-package-manifest-v1",
    packageId: PACKAGE_ID,
    packageDisplayName: "Mask Composition",
    formatVersion: "open-model-package-v1",
    packageRevision: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
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
          drawableIds: [MASK_DRAWABLE_ID, TARGET_DRAWABLE_ID]
        }
      ],
      rigControlRootIds: [],
      stableOrder: [MASK_DRAWABLE_ID, TARGET_DRAWABLE_ID]
    },
    drawables: {
      schemaVersion: "drawables-file-v1",
      drawables: [
        createDrawable(MASK_DRAWABLE_ID, MASK_MESH_ID, MASK_TEXTURE_ID, 0),
        createDrawable(TARGET_DRAWABLE_ID, TARGET_MESH_ID, TARGET_TEXTURE_ID, 1)
      ]
    },
    meshes: {
      schemaVersion: "meshes-file-v1",
      meshes: [
        createMesh(MASK_MESH_ID, MASK_DRAWABLE_ID, 0),
        createMesh(TARGET_MESH_ID, TARGET_DRAWABLE_ID, 16)
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
      rigControls: []
    },
    dynamics: {
      schemaVersion: "dynamics-file-v2",
      dynamicsGroups: []
    },
    masks: {
      schemaVersion: "masks-file-v1",
      masks: [...(input.masks ?? [])]
    },
    drawOrder: {
      schemaVersion: "draw-order-file-v1",
      entries: [
        {
          drawableId: MASK_DRAWABLE_ID,
          baseDrawOrder: 0,
          stableOrder: 0
        },
        {
          drawableId: TARGET_DRAWABLE_ID,
          baseDrawOrder: 1,
          stableOrder: 1
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

const createDrawable = (
  drawableId: string,
  meshId: string,
  textureId: string,
  baseDrawOrder: number
) => ({
  drawableId,
  displayName: drawableId.replace(/^draw_/, ""),
  partId: PART_ID,
  sourceAssetId: SOURCE_ASSET_ID,
  textureId,
  meshId,
  defaultOpacity: 1,
  runtimeVisibility: true,
  baseDrawOrder,
  sourceProvenanceId: PROVENANCE_ID
});

const createMesh = (
  meshId: string,
  drawableId: string,
  xOffset: number
) => ({
  meshId,
  drawableId,
  vertices: [
    { x: xOffset, y: 0 },
    { x: xOffset + 1, y: 0 },
    { x: xOffset, y: 1 }
  ],
  uvs: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 }
  ],
  triangles: [[0, 1, 2]],
  vertexStableIds: ["v0", "v1", "v2"],
  bounds: {
    x: xOffset,
    y: 0,
    width: 1,
    height: 1
  },
  generationProvenanceId: PROVENANCE_ID
});

const createMaskRelation = (overrides: Record<string, unknown> = {}) => ({
  maskRelationId: MASK_RELATION_ID,
  maskDrawableIds: [MASK_DRAWABLE_ID],
  targetDrawableIds: [TARGET_DRAWABLE_ID],
  enabled: true,
  ...overrides
});

const createRuntimeSnapshot = (input: {
  readonly drawables?: readonly Record<string, unknown>[];
  readonly masks?: readonly Record<string, unknown>[];
} = {}) => ({
  schemaVersion: "runtime-snapshot-v1",
  runtimeCoreVersion: "wave27-composition-test",
  snapshotId: "snap_maskComposition_0",
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
  parameters: [],
  dynamics: [],
  keyformSamples: [],
  rigControls: [],
  masks: [...(input.masks ?? [])],
  drawables: [
    ...(input.drawables ?? [
      createRuntimeDrawable(MASK_DRAWABLE_ID, MASK_MESH_ID, 0),
      createRuntimeDrawable(TARGET_DRAWABLE_ID, TARGET_MESH_ID, 1)
    ])
  ],
  drawList: [MASK_DRAWABLE_ID, TARGET_DRAWABLE_ID],
  disabledFutureLayers: [],
  diagnostics: []
});

const createRuntimeDrawable = (
  drawableId: string,
  meshId: string,
  evaluatedDrawOrder: number,
  opacity = 1
) => ({
  drawableId,
  meshId,
  visible: true,
  opacity,
  baseDrawOrder: evaluatedDrawOrder,
  evaluatedDrawOrder,
  bounds: {
    x: evaluatedDrawOrder * 16,
    y: 0,
    width: 1,
    height: 1
  },
  vertexCount: 3,
  vertexHash: `hash_${drawableId}_3`,
  diagnostics: []
});

const createRuntimeMaskEvidence = (overrides: Record<string, unknown> = {}) => ({
  maskRelationId: MASK_RELATION_ID,
  sourceDrawableIds: [MASK_DRAWABLE_ID],
  targetDrawableIds: [TARGET_DRAWABLE_ID],
  enabled: true,
  clippingIntent: "semanticClipping",
  resolved: true,
  ...overrides
});

const toCheckIds = (report: ReturnType<typeof validatePackageRuntime>): readonly string[] =>
  report.checks.map((check) => check.checkId);
