import {
  describe,
  expect,
  it
} from "vitest";

import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RuntimeEvaluationContextSchema,
  RuntimeStateDtoSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { NormalizedRuntimeGraph } from "@private-2d-rigging-lab/runtime-core";
import {
  createInitialRuntimeState,
  createRuntimeSnapshot,
  defaultRuntimeEvaluationOptions
} from "@private-2d-rigging-lab/runtime-core";

import { createCheckCatalog } from "./check-catalog.js";
import { buildValidationReport } from "./report-builder.js";
import { aggregateValidationSummary } from "./validation-summary.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

const PACKAGE_ID = PackageIdSchema.parse("pkg_minimal");
const PART_ID = PartIdSchema.parse("part_root");
const DRAWABLE_ID = DrawableIdSchema.parse("draw_body");
const MESH_ID = MeshIdSchema.parse("mesh_body");
const SOURCE_ASSET_ID = SourceAssetIdSchema.parse("src_generated");
const TEXTURE_ID = TextureIdSchema.parse("tex_body");
const PROVENANCE_ID = ProvenanceIdSchema.parse("prov_generated");

describe("validator-core foundation", () => {
  it("registers the Wave 2 check catalog entries", () => {
    const catalog = createCheckCatalog();

    expect(catalog.has("pkg.schema.requiredFileMissing")).toBe(true);
    expect(catalog.has("runtime.loadBlocking")).toBe(true);
    expect(catalog.has("runtime.drawListEmpty")).toBe(true);
    expect(catalog.has("dynamics.driverMissing")).toBe(true);
    expect(catalog.has("dynamics.runtimeEvidenceMissing")).toBe(true);
    expect(catalog.list("acceptance").map((definition) => definition.checkId)).toContain("evidence.guiOperationLogMissing");
  });

  it("summarizes empty checks as pass", () => {
    expect(aggregateValidationSummary([])).toEqual({
      status: "pass",
      highestSeverity: "info",
      counts: {
        info: 0,
        warning: 0,
        error: 0,
        blocking: 0
      }
    });
  });

  it("summarizes blocking and error checks as fail", () => {
    const report = buildValidationReport({
      packageId: PACKAGE_ID,
      packageRevision: 0,
      createdAt: "2026-05-29T00:00:00.000Z",
      checks: [
        {
          checkId: "runtime.drawListEmpty",
          status: "fail",
          severity: "blocking",
          phase: "runtime_load",
          target: {
            kind: "runtimeSnapshot",
            id: "snap_minimal_0"
          },
          message: "Runtime snapshot drawList is empty.",
          impact: "Viewer load evidence has no visible drawable to render."
        }
      ]
    });

    expect(report.summary.status).toBe("fail");
    expect(report.summary.highestSeverity).toBe("blocking");
    expect(report.summary.counts.blocking).toBe(1);
  });

  it("builds a pass report for a minimal package and runtime snapshot", () => {
    const packageDocument = createMinimalPackageDocument();
    const graph = createMinimalRuntimeGraph();
    const initialState = createInitialRuntimeState(graph, {
      packageId: PACKAGE_ID,
      packageRevision: 0,
      fixedStepMs: 16.6666667,
      resetReasons: ["validationRunStart"]
    });
    const snapshot = createRuntimeSnapshot({
      graph,
      evaluationInput: {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 0,
        deltaTimeMs: 0,
        resetReasons: [],
        authoredParameterValues: {},
        targetIds: []
      },
      state: RuntimeStateDtoSchema.parse(initialState),
      options: defaultRuntimeEvaluationOptions(),
      context: RuntimeEvaluationContextSchema.parse({
        source: {
          surface: "validator"
        },
        policy: {
          strictness: "strict"
        }
      }),
      diagnostics: []
    });

    const report = validatePackageRuntime({
      packageDocument,
      runtimeSnapshot: snapshot,
      createdAt: "2026-05-29T00:00:00.000Z"
    });

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toHaveLength(0);
    expect(report.evidence.runtimeSnapshotIds).toEqual([snapshot.snapshotId]);
  });

  it("reports missing required package files and empty runtime draw lists", () => {
    const invalidPackageDocument = {
      ...createMinimalPackageDocument(),
      model: {
        ...createMinimalPackageDocument().model,
        drawables: undefined
      }
    };
    const emptySnapshot = {
      ...createMinimalRuntimeSnapshotLike(),
      drawables: [],
      drawList: []
    };

    const report = validatePackageRuntime({
      packageDocument: invalidPackageDocument,
      runtimeSnapshot: emptySnapshot,
      createdAt: "2026-05-29T00:00:00.000Z"
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks.map((check) => check.checkId)).toContain("pkg.schema.requiredFileMissing");
    expect(report.checks.map((check) => check.checkId)).toContain("runtime.drawListEmpty");
  });
});

const createMinimalPackageDocument = () => ({
  manifest: {
    schemaVersion: "open-model-package-manifest-v1",
    packageId: PACKAGE_ID,
    packageDisplayName: "Minimal",
    formatVersion: "open-model-package-v1",
    packageRevision: 0,
    createdAt: "2026-05-29T00:00:00.000Z",
    updatedAt: "2026-05-29T00:00:00.000Z",
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
      stableOrder: ["draw_body"]
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

const createMinimalRuntimeGraph = (): NormalizedRuntimeGraph => ({
  packageId: PACKAGE_ID,
  packageRevision: 0,
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
        vertexCount: 3,
        vertexHash: "hash_draw_body_3"
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

const createMinimalRuntimeSnapshotLike = () => ({
  schemaVersion: "runtime-snapshot-v1",
  runtimeCoreVersion: "wave2-foundation",
  snapshotId: "snap_minimal_0",
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
  rigControls: [],
  masks: [],
  diagnostics: []
});
