import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RuntimeEvaluationContextSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { NormalizedRuntimeGraph } from "@private-2d-rigging-lab/runtime-core";
import {
  createRuntimeSnapshotArtifactPath,
  evaluateViewerRuntimeSnapshot
} from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import { createCheckCatalog } from "./check-catalog.js";
import { createValidationReportArtifactPath } from "./validation-report-artifacts.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

const PACKAGE_ID = PackageIdSchema.parse("pkg_viewer_validator");
const PART_ID = PartIdSchema.parse("part_root");
const DRAWABLE_ID = DrawableIdSchema.parse("draw_body");
const MESH_ID = MeshIdSchema.parse("mesh_body");
const SOURCE_ASSET_ID = SourceAssetIdSchema.parse("src_generated");
const TEXTURE_ID = TextureIdSchema.parse("tex_body");
const PROVENANCE_ID = ProvenanceIdSchema.parse("prov_generated");

describe("viewer validator report integration", () => {
  it("registers viewer runtime evidence checks in the catalog", () => {
    const catalog = createCheckCatalog();

    expect(catalog.has("viewer.runtimeEvidenceMissing")).toBe(true);
    expect(catalog.has("viewer.runtimeEvidenceStale")).toBe(true);
  });

  it("validates viewer snapshot evidence and records stable report refs", () => {
    const result = evaluateViewerRuntimeSnapshot(createViewerRuntimeGraph(), {
      targetIds: [DRAWABLE_ID]
    });

    const report = validatePackageRuntime({
      packageDocument: createViewerPackageDocument(),
      runtimeSnapshot: result.snapshot,
      viewerEvidence: result.evidence,
      profile: "viewer",
      createdAt: "2026-06-01T00:00:00.000Z"
    });

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
    expect(report.evidence.runtimeSnapshotIds).toEqual([
      result.baselineSnapshot.snapshotId,
      result.snapshot.snapshotId
    ]);
    expect(report.evidence.supplementalGuiEvidenceRefs).toEqual([
      createRuntimeSnapshotArtifactPath(result.baselineSnapshot.snapshotId),
      createRuntimeSnapshotArtifactPath(result.snapshot.snapshotId),
      result.evidence.finalRuntimeStateRef
    ]);
    expect(createValidationReportArtifactPath(report.reportId)).toBe(
      "validation/reports/val_viewer_validator_viewer.validation.json"
    );
  });

  it("reports deterministic viewer diagnostics when viewer evidence is missing", () => {
    const result = evaluateViewerRuntimeSnapshot(createViewerRuntimeGraph());

    const report = validatePackageRuntime({
      packageDocument: createViewerPackageDocument(),
      runtimeSnapshot: result.snapshot,
      profile: "viewer",
      createdAt: "2026-06-01T00:00:00.000Z"
    });

    expect(report.summary.status).toBe("fail");
    expect(report.evidence.runtimeSnapshotIds).toEqual([result.snapshot.snapshotId]);
    expect(report.checks).toEqual([
      expect.objectContaining({
        checkId: "viewer.runtimeEvidenceMissing",
        status: "fail",
        severity: "error",
        snapshotIds: [result.snapshot.snapshotId],
        evidence: [
          "viewerEvidence=missing",
          `snapshotId=${result.snapshot.snapshotId}`
        ]
      })
    ]);
  });

  it("reports stale viewer diagnostics for non-viewer runtime snapshots", () => {
    const result = evaluateViewerRuntimeSnapshot(createViewerRuntimeGraph());
    const staleSnapshot = {
      ...result.snapshot,
      context: RuntimeEvaluationContextSchema.parse({
        source: {
          surface: "preview"
        },
        policy: {
          strictness: "interactive"
        }
      })
    };

    const report = validatePackageRuntime({
      packageDocument: createViewerPackageDocument(),
      runtimeSnapshot: staleSnapshot,
      viewerEvidence: result.evidence,
      profile: "viewer",
      createdAt: "2026-06-01T00:00:00.000Z"
    });

    expect(report.summary.status).toBe("fail");
    expect(report.evidence.runtimeSnapshotIds).toEqual([
      result.baselineSnapshot.snapshotId,
      result.snapshot.snapshotId
    ]);
    expect(report.checks).toEqual([
      expect.objectContaining({
        checkId: "viewer.runtimeEvidenceStale",
        status: "fail",
        severity: "error",
        snapshotIds: [result.snapshot.snapshotId],
        evidence: [
          `snapshotId=${result.snapshot.snapshotId}`,
          "snapshotSurface=preview"
        ]
      })
    ]);
  });
});

const createViewerRuntimeGraph = (): NormalizedRuntimeGraph => ({
  packageId: PACKAGE_ID,
  packageRevision: 2,
  coordinateSystem: "canvas-y-down-v1",
  parameters: new Map(),
  dynamicsGroups: new Map(),
  drawables: new Map([
    [
      DRAWABLE_ID,
      {
        drawableId: DRAWABLE_ID,
        meshId: MESH_ID,
        visible: true,
        opacity: 1,
        baseDrawOrder: 0,
        bounds: {
          x: 0,
          y: 0,
          width: 1,
          height: 1
        },
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

const createViewerPackageDocument = () => ({
  manifest: {
    schemaVersion: "open-model-package-manifest-v1",
    packageId: PACKAGE_ID,
    packageDisplayName: "Viewer Validator",
    formatVersion: "open-model-package-v1",
    packageRevision: 2,
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
          drawableIds: [DRAWABLE_ID]
        }
      ],
      rigControlRootIds: [],
      stableOrder: [DRAWABLE_ID]
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
      rigControls: []
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
