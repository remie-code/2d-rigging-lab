import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  TriangleIdSchema
} from "@private-2d-rigging-lab/contracts";
import {
  PackageDocumentSchema,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import type { NormalizedRuntimeGraph } from "@private-2d-rigging-lab/runtime-core";
import {
  evaluateViewerRuntimeSnapshot
} from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import { defaultCheckCatalog } from "./check-catalog.js";
import { validateMeshSemantics } from "./validators/mesh-semantics.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

const PACKAGE_ID = PackageIdSchema.parse("pkg_mesh_topology");
const PART_ID = PartIdSchema.parse("part_root");
const DRAWABLE_ID = DrawableIdSchema.parse("draw_body");
const MESH_ID = MeshIdSchema.parse("mesh_body");
const SOURCE_ASSET_ID = SourceAssetIdSchema.parse("src_generated");
const TEXTURE_ID = TextureIdSchema.parse("tex_body");
const PROVENANCE_ID = ProvenanceIdSchema.parse("prov_generated");
const VERTEX_STABLE_IDS = ["mesh_body_v0", "mesh_body_v1", "mesh_body_v2"] as const;
const TRIANGLE_STABLE_IDS = [TriangleIdSchema.parse("tri_body_0")] as const;
const TOPOLOGY_REVISION = 1;
const CREATED_AT = "2026-06-01T00:00:00.000Z";

describe("mesh topology diagnostics", () => {
  it("registers deterministic mesh topology and evidence checks", () => {
    expect(defaultCheckCatalog.has("mesh.triangleIndexOutOfRange")).toBe(true);
    expect(defaultCheckCatalog.has("mesh.degenerateTriangle")).toBe(true);
    expect(defaultCheckCatalog.has("mesh.duplicateTriangle")).toBe(true);
    expect(defaultCheckCatalog.has("mesh.orphanedVertex")).toBe(true);
    expect(defaultCheckCatalog.has("mesh.vertexStableIdsLengthMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("mesh.uvCountMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("mesh.triangleStableIdsLengthMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("mesh.uvCoordinateOutOfBounds")).toBe(true);
    expect(defaultCheckCatalog.has("mesh.runtimeEvidenceMissing")).toBe(true);
    expect(defaultCheckCatalog.has("mesh.runtimeEvidenceMismatch")).toBe(true);
  });

  it("accepts a valid edited mesh with runtime and viewer evidence", () => {
    const viewerResult = evaluateViewerRuntimeSnapshot(createRuntimeGraph(), {
      targetIds: [DRAWABLE_ID]
    });

    const report = validatePackageRuntime({
      packageDocument: createPackageDocument(),
      runtimeSnapshot: viewerResult.snapshot,
      viewerEvidence: viewerResult.evidence,
      profile: "viewer",
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
    expect(report.evidence.runtimeSnapshotIds).toEqual([
      viewerResult.baselineSnapshot.snapshotId,
      viewerResult.snapshot.snapshotId
    ]);
  });

  it("reports invalid triangle, degenerate triangle, UV count, and stable ID length diagnostics", () => {
    const document = clonePackageDocument(createPackageDocument());
    document.model.meshes.meshes[0] = {
      ...document.model.meshes.meshes[0]!,
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ],
      triangles: [
        [0, 1, 4],
        [0, 1, 1]
      ],
      vertexStableIds: ["mesh_body_v0", "mesh_body_v1"],
      triangleStableIds: [TRIANGLE_STABLE_IDS[0], TriangleIdSchema.parse("tri_body_1")]
    };

    const report = validatePackageRuntime({
      packageDocument: document,
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks.map((check) => check.checkId)).toEqual([
      "mesh.vertexStableIdsLengthMismatch",
      "mesh.uvCountMismatch",
      "mesh.triangleIndexOutOfRange",
      "mesh.degenerateTriangle"
    ]);
    expect(report.checks).toEqual([
      expect.objectContaining({
        checkId: "mesh.vertexStableIdsLengthMismatch",
        severity: "error",
        targetPath: "/model/meshes/meshes/0/vertexStableIds",
        evidence: [
          `meshId=${MESH_ID}`,
          "vertexCount=3",
          "vertexStableIdsCount=2",
          "reason=vertex-stable-id-count-mismatch"
        ]
      }),
      expect.objectContaining({
        checkId: "mesh.uvCountMismatch",
        severity: "error",
        targetPath: "/model/meshes/meshes/0/uvs",
        evidence: [
          `meshId=${MESH_ID}`,
          "vertexCount=3",
          "uvCount=2",
          "reason=uv-count-mismatch"
        ]
      }),
      expect.objectContaining({
        checkId: "mesh.triangleIndexOutOfRange",
        severity: "blocking",
        targetPath: "/model/meshes/meshes/0/triangles/0/2",
        evidence: [
          `meshId=${MESH_ID}`,
          "triangleIndex=0",
          "triangle=0,1,4",
          "cornerIndex=2",
          "vertexIndex=4",
          "vertexCount=3"
        ]
      }),
      expect.objectContaining({
        checkId: "mesh.degenerateTriangle",
        status: "warning",
        severity: "warning",
        targetPath: "/model/meshes/meshes/0/triangles/1",
        evidence: [
          `meshId=${MESH_ID}`,
          "triangleIndex=1",
          "triangle=0,1,1",
          "reason=repeated-index"
        ]
      })
    ]);
  });

  it("reports zero-area degenerate triangles deterministically", () => {
    const document = clonePackageDocument(createPackageDocument());
    document.model.meshes.meshes[0] = {
      ...document.model.meshes.meshes[0]!,
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 }
      ],
      bounds: {
        x: 0,
        y: 0,
        width: 2,
        height: 2
      }
    };

    const report = validatePackageRuntime({
      packageDocument: document,
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("warning");
    expect(report.checks).toEqual([
      expect.objectContaining({
        checkId: "mesh.degenerateTriangle",
        status: "warning",
        severity: "warning",
        targetPath: "/model/meshes/meshes/0/triangles/0",
        evidence: [
          `meshId=${MESH_ID}`,
          "triangleIndex=0",
          "triangle=0,1,2",
          "reason=zero-area"
        ]
      })
    ]);
  });

  it("reports duplicate triangles, orphaned vertices, stable triangle ID mismatch, and UV bounds", () => {
    const document = clonePackageDocument(createPackageDocument());
    document.model.meshes.meshes[0] = {
      ...document.model.meshes.meshes[0]!,
      vertices: [
        { x: 0.2, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 0.5, y: 0.5 }
      ],
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1.2, y: 0.5 },
        { x: 0.5, y: 0.5 }
      ],
      triangles: [
        [0, 1, 2],
        [2, 1, 0]
      ],
      vertexStableIds: [...VERTEX_STABLE_IDS, "mesh_body_v3"],
      triangleStableIds: [...TRIANGLE_STABLE_IDS],
      topologyRevision: TOPOLOGY_REVISION
    };

    const report = validatePackageRuntime({
      packageDocument: document,
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks.map((check) => check.checkId)).toEqual([
      "mesh.triangleStableIdsLengthMismatch",
      "mesh.uvCoordinateOutOfBounds",
      "mesh.duplicateTriangle",
      "mesh.orphanedVertex"
    ]);
    expect(report.checks).toEqual([
      expect.objectContaining({
        checkId: "mesh.triangleStableIdsLengthMismatch",
        severity: "error",
        targetPath: "/model/meshes/meshes/0/triangleStableIds",
        evidence: [
          `meshId=${MESH_ID}`,
          "triangleCount=2",
          "triangleStableIdsCount=1",
          "reason=triangle-stable-id-count-mismatch"
        ]
      }),
      expect.objectContaining({
        checkId: "mesh.uvCoordinateOutOfBounds",
        severity: "error",
        targetPath: "/model/meshes/meshes/0/uvs/2",
        evidence: [
          `meshId=${MESH_ID}`,
          "uvIndex=2",
          "uv=1.2,0.5",
          "outOfBoundsCoordinates=x",
          "semanticBounds=0..1",
          "reason=uv-coordinate-out-of-bounds"
        ]
      }),
      expect.objectContaining({
        checkId: "mesh.duplicateTriangle",
        severity: "error",
        targetPath: "/model/meshes/meshes/0/triangles/1",
        evidence: [
          `meshId=${MESH_ID}`,
          "triangleIndex=1",
          "triangle=2,1,0",
          "duplicateOfTriangleIndex=0",
          "duplicateOfTriangle=0,1,2",
          "normalizedTriangle=0,1,2",
          "reason=duplicate-triangle"
        ]
      }),
      expect.objectContaining({
        checkId: "mesh.orphanedVertex",
        severity: "error",
        targetPath: "/model/meshes/meshes/0/vertexStableIds/3",
        evidence: [
          `meshId=${MESH_ID}`,
          "vertexIndex=3",
          "vertexStableId=mesh_body_v3",
          "triangleCount=2",
          "referencedVertexIndexes=0,1,2",
          "reason=orphaned-stable-vertex"
        ]
      })
    ]);
  });

  it("keeps stale selected vertex refs as editor-only warnings", () => {
    const document = clonePackageDocument(createPackageDocument());
    document.model.editorState = {
      schemaVersion: "editor-state-v1",
      selection: [VERTEX_STABLE_IDS[0], "mesh_body_v_missing"],
      lockedIds: [],
      editorHiddenIds: [],
      activeTool: "meshEdit"
    };

    const report = validatePackageRuntime({
      packageDocument: document,
      createdAt: CREATED_AT
    });

    expect(report.summary).toMatchObject({
      status: "warning",
      highestSeverity: "warning"
    });
    expect(report.checks).toEqual([
      expect.objectContaining({
        checkId: "editorState.staleReference",
        status: "warning",
        severity: "warning",
        targetPath: "/model/editorState/selection/1",
        evidence: [
          "editorStateCollection=selection",
          "editorStateRef=mesh_body_v_missing",
          "targetMatch=missing",
          "runtimeSemantics=unchanged"
        ]
      })
    ]);
  });

  it("reports missing mesh runtime evidence when viewer evidence is required", () => {
    const report = validatePackageRuntime({
      packageDocument: createPackageDocument(),
      profile: "viewer",
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks.map((check) => check.checkId)).toEqual([
      "mesh.runtimeEvidenceMissing",
      "viewer.runtimeEvidenceMissing"
    ]);
    expect(report.checks[0]).toMatchObject({
      checkId: "mesh.runtimeEvidenceMissing",
      severity: "error",
      targetPath: "/runtime/snapshots",
      evidence: [
        "runtimeSnapshot=missing",
        "runtimeVisibleDrawableCount=1",
        `drawableIds=${DRAWABLE_ID}`,
        "reason=runtime-snapshot-missing"
      ]
    });
  });

  it("reports missing per-drawable runtime mesh evidence when viewer evidence is required", () => {
    const viewerResult = evaluateViewerRuntimeSnapshot(createRuntimeGraph());
    const snapshotWithoutMeshEvidence = {
      ...viewerResult.snapshot,
      drawables: viewerResult.snapshot.drawables.map((drawable) => {
        const { mesh: _mesh, ...withoutMeshEvidence } = drawable;
        return withoutMeshEvidence;
      })
    };

    const report = validatePackageRuntime({
      packageDocument: createPackageDocument(),
      runtimeSnapshot: snapshotWithoutMeshEvidence,
      viewerEvidence: viewerResult.evidence,
      profile: "viewer",
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks).toEqual([
      expect.objectContaining({
        checkId: "mesh.runtimeEvidenceMissing",
        status: "fail",
        severity: "error",
        targetPath: "drawables/0/mesh",
        evidence: [
          `drawableId=${DRAWABLE_ID}`,
          `meshId=${MESH_ID}`,
          `snapshotId=${viewerResult.snapshot.snapshotId}`,
          "runtimeDrawableMeshEvidence=missing",
          "reason=runtime-mesh-evidence-missing"
        ],
        snapshotIds: [viewerResult.snapshot.snapshotId]
      })
    ]);
  });

  it("reports package/runtime topology evidence mismatches deterministically", () => {
    const viewerResult = evaluateViewerRuntimeSnapshot(createRuntimeGraph());
    const snapshotWithInconsistentMeshEvidence = {
      ...viewerResult.snapshot,
      drawables: viewerResult.snapshot.drawables.map((drawable) => ({
        ...drawable,
        mesh: drawable.mesh === undefined
          ? undefined
          : {
              ...drawable.mesh,
              topology: {
                ...drawable.mesh.topology,
                stableVertexIdCount: 2,
                uvCount: 2,
                triangleCount: 0,
                triangleIndexCount: 0,
                stableTriangleIdCount: 0,
                hasStableVertexIds: false,
                hasStableTriangleIds: false,
                hasUvProjection: false,
                hasTriangles: false
              }
            }
      }))
    };

    const report = validatePackageRuntime({
      packageDocument: createPackageDocument(),
      runtimeSnapshot: snapshotWithInconsistentMeshEvidence,
      viewerEvidence: viewerResult.evidence,
      profile: "viewer",
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks).toEqual([
      expect.objectContaining({
        checkId: "mesh.runtimeEvidenceMismatch",
        status: "fail",
        severity: "error",
        targetPath: "drawables/0/mesh",
        evidence: [
          `drawableId=${DRAWABLE_ID}`,
          `meshId=${MESH_ID}`,
          `snapshotId=${viewerResult.snapshot.snapshotId}`,
          "mismatch=topology.stableVertexIdCount:expected=3,actual=2",
          "mismatch=topology.uvCount:expected=3,actual=2",
          "mismatch=topology.triangleCount:expected=1,actual=0",
          "mismatch=topology.triangleIndexCount:expected=3,actual=0",
          "mismatch=topology.stableTriangleIdCount:expected=1,actual=0",
          "mismatch=topology.hasStableVertexIds:expected=true,actual=false",
          "mismatch=topology.hasStableTriangleIds:expected=true,actual=false",
          "mismatch=topology.hasUvProjection:expected=true,actual=false",
          "mismatch=topology.hasTriangles:expected=true,actual=false",
          "reason=runtime-mesh-evidence-inconsistent"
        ],
        snapshotIds: [viewerResult.snapshot.snapshotId]
      })
    ]);
  });

  it("reports stale mesh-local topology revision evidence deterministically", () => {
    const viewerResult = evaluateViewerRuntimeSnapshot(createRuntimeGraph());
    const snapshotWithStaleTopologyRevision = {
      ...viewerResult.snapshot,
      drawables: viewerResult.snapshot.drawables.map((drawable) => ({
        ...drawable,
        mesh: drawable.mesh === undefined
          ? undefined
          : {
              ...drawable.mesh,
              topology: {
                ...drawable.mesh.topology,
                topologyRevision: 0
              }
            }
      }))
    };

    const report = validatePackageRuntime({
      packageDocument: createPackageDocument(),
      runtimeSnapshot: snapshotWithStaleTopologyRevision,
      viewerEvidence: viewerResult.evidence,
      profile: "viewer",
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks).toEqual([
      expect.objectContaining({
        checkId: "mesh.runtimeEvidenceMismatch",
        status: "fail",
        severity: "error",
        targetPath: "drawables/0/mesh",
        evidence: [
          `drawableId=${DRAWABLE_ID}`,
          `meshId=${MESH_ID}`,
          `snapshotId=${viewerResult.snapshot.snapshotId}`,
          "mismatch=topology.topologyRevision:expected=1,actual=0",
          "reason=runtime-mesh-evidence-inconsistent"
        ],
        snapshotIds: [viewerResult.snapshot.snapshotId]
      })
    ]);
  });

  it("reports stale runtime snapshot identity for mesh evidence", () => {
    const viewerResult = evaluateViewerRuntimeSnapshot(createRuntimeGraph());
    const staleRuntimeSnapshot = {
      ...viewerResult.snapshot,
      packageRevision: 2
    };

    const checks = validateMeshSemantics({
      packageDocument: createPackageDocument(),
      runtimeSnapshot: staleRuntimeSnapshot,
      requireRuntimeEvidence: true
    });

    expect(checks).toEqual([
      expect.objectContaining({
        checkId: "mesh.runtimeEvidenceMismatch",
        status: "fail",
        severity: "error",
        targetPath: "/runtimeSnapshot/packageRevision",
        evidence: [
          `snapshotId=${viewerResult.snapshot.snapshotId}`,
          "field=packageRevision",
          "packageValue=3",
          "evidenceValue=2",
          "reason=stale-runtime-snapshot-identity"
        ],
        snapshotIds: [viewerResult.snapshot.snapshotId]
      })
    ]);
  });

  it("reports inconsistent per-drawable runtime mesh evidence deterministically", () => {
    const viewerResult = evaluateViewerRuntimeSnapshot(createRuntimeGraph());
    const snapshotWithInconsistentMeshEvidence = {
      ...viewerResult.snapshot,
      drawables: viewerResult.snapshot.drawables.map((drawable) => ({
        ...drawable,
        mesh: drawable.mesh === undefined
          ? undefined
          : {
              ...drawable.mesh,
              topology: {
                ...drawable.mesh.topology,
                vertexCount: 2
              }
            }
      }))
    };

    const report = validatePackageRuntime({
      packageDocument: createPackageDocument(),
      runtimeSnapshot: snapshotWithInconsistentMeshEvidence,
      viewerEvidence: viewerResult.evidence,
      profile: "viewer",
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks).toEqual([
      expect.objectContaining({
        checkId: "mesh.runtimeEvidenceMismatch",
        status: "fail",
        severity: "error",
        targetPath: "drawables/0/mesh",
        evidence: [
          `drawableId=${DRAWABLE_ID}`,
          `meshId=${MESH_ID}`,
          `snapshotId=${viewerResult.snapshot.snapshotId}`,
          "mismatch=topology.vertexCount:expected=3,actual=2",
          "reason=runtime-mesh-evidence-inconsistent"
        ],
        snapshotIds: [viewerResult.snapshot.snapshotId]
      })
    ]);
  });

  it("reports missing drawable mesh evidence from supplied runtime snapshots", () => {
    const viewerResult = evaluateViewerRuntimeSnapshot(createRuntimeGraph());
    const snapshotWithoutDrawableEvidence = {
      ...viewerResult.snapshot,
      drawables: [],
      drawList: [DRAWABLE_ID]
    };

    const report = validatePackageRuntime({
      packageDocument: createPackageDocument(),
      runtimeSnapshot: snapshotWithoutDrawableEvidence,
      viewerEvidence: viewerResult.evidence,
      profile: "viewer",
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks).toEqual([
      expect.objectContaining({
        checkId: "mesh.runtimeEvidenceMissing",
        status: "fail",
        severity: "error",
        targetPath: "drawables",
        evidence: [
          `drawableId=${DRAWABLE_ID}`,
          `meshId=${MESH_ID}`,
          `snapshotId=${viewerResult.snapshot.snapshotId}`,
          "runtimeDrawableMatch=missing",
          "reason=runtime-drawable-missing"
        ],
        snapshotIds: [viewerResult.snapshot.snapshotId]
      })
    ]);
  });
});

const clonePackageDocument = (document: PackageDocumentDto): PackageDocumentDto =>
  JSON.parse(JSON.stringify(document)) as PackageDocumentDto;

const createRuntimeGraph = (): NormalizedRuntimeGraph => ({
  packageId: PACKAGE_ID,
  packageRevision: 3,
  coordinateSystem: "canvas-y-down-v1",
  parameters: new Map(),
  dynamicsGroups: new Map(),
  drawables: new Map([
    [
      DRAWABLE_ID,
      {
        drawableId: DRAWABLE_ID,
        meshId: MESH_ID,
        partId: PART_ID,
        visible: true,
        opacity: 1,
        baseDrawOrder: 0,
        bounds: {
          x: 0.2,
          y: 0,
          width: 0.8,
          height: 1
        },
        vertices: [
          { x: 0.2, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ],
        uvs: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ],
        triangles: [[0, 1, 2]],
        vertexStableIds: [...VERTEX_STABLE_IDS],
        triangleStableIds: [...TRIANGLE_STABLE_IDS],
        topologyRevision: TOPOLOGY_REVISION,
        vertexCount: 3
      }
    ]
  ]),
  rigControls: new Map(),
  keyformBindings: [],
  masks: [],
  drawOrder: [
    {
      drawableId: DRAWABLE_ID,
      drawOrder: 0
    }
  ],
  disabledFutureLayers: []
});

const createPackageDocument = (): PackageDocumentDto => PackageDocumentSchema.parse({
  manifest: {
    schemaVersion: "open-model-package-manifest-v1",
    packageId: PACKAGE_ID,
    packageDisplayName: "Mesh Topology",
    formatVersion: "open-model-package-v1",
    packageRevision: 3,
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
      drawOrder: "model/draw-order.json",
      editorState: "model/editor-state.json"
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
      stableOrder: [PART_ID, DRAWABLE_ID, MESH_ID, ...VERTEX_STABLE_IDS]
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
            { x: 0.2, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          uvs: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          triangles: [[0, 1, 2]],
          vertexStableIds: [...VERTEX_STABLE_IDS],
          triangleStableIds: [...TRIANGLE_STABLE_IDS],
          topologyRevision: TOPOLOGY_REVISION,
          bounds: {
            x: 0.2,
            y: 0,
            width: 0.8,
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
      rigControls: []
    },
    dynamics: {
      schemaVersion: "dynamics-file-v3",
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
    },
    editorState: {
      schemaVersion: "editor-state-v1",
      selection: [VERTEX_STABLE_IDS[0]],
      lockedIds: [],
      editorHiddenIds: [],
      activeTool: "meshEdit",
      canvas: {
        zoom: 1,
        pan: {
          x: 0,
          y: 0
        }
      }
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
          creator: "validator-test",
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
