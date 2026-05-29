import {
  PackageDocumentSchema,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";

export const EDITOR_BROWSER_SAMPLE_PACKAGE_HASH = "sha256:editor-browser-sample-package";

export const createBrowserSamplePackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    manifest: {
      schemaVersion: "open-model-package-manifest-v1",
      packageId: "pkg_editor_browser_sample",
      packageDisplayName: "Editor Browser Sample",
      formatVersion: "open-model-package-v1",
      packageRevision: 0,
      createdAt: "2026-05-29T00:00:00.000Z",
      updatedAt: "2026-05-29T00:00:00.000Z",
      schemaVersions: {
        manifest: "open-model-package-manifest-v1",
        sourceManifest: "source-manifest-v1",
        modelGraph: "model-graph-v1"
      },
      evaluatorVersions: {
        runtimeCore: "wave2-foundation"
      },
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
          width: 128,
          height: 128
        },
        parts: [
          {
            partId: "part_root",
            displayName: "Root",
            childPartIds: [],
            drawableIds: ["draw_body"]
          }
        ],
        rigControlRootIds: [],
        stableOrder: ["draw_body"]
      },
      drawables: {
        schemaVersion: "drawables-file-v1",
        drawables: [
          {
            drawableId: "draw_body",
            displayName: "Body",
            partId: "part_root",
            sourceAssetId: "src_generated",
            textureId: "tex_body",
            meshId: "mesh_body",
            defaultOpacity: 1,
            runtimeVisibility: true,
            baseDrawOrder: 0,
            sourceProvenanceId: "prov_generated"
          }
        ]
      },
      meshes: {
        schemaVersion: "meshes-file-v1",
        meshes: [
          {
            meshId: "mesh_body",
            drawableId: "draw_body",
            vertices: [
              { x: 0, y: 0 },
              { x: 32, y: 0 },
              { x: 0, y: 32 }
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
              width: 32,
              height: 32
            },
            generationProvenanceId: "prov_generated"
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
            drawableId: "draw_body",
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
            sourceAssetId: "src_generated",
            kind: "generated-fixture-v1",
            filePath: "assets/sources/generated/editor-browser-sample-body.json",
            contentHash: "sha256:editor-browser-sample-generated-source",
            importProfile: "split-png-fallback-v1",
            layers: [
              {
                sourceLayerId: "layer_body",
                sourceAssetId: "src_generated",
                originalName: "Body",
                normalizedName: "body",
                groupPath: ["Root"],
                bounds: {
                  x: 0,
                  y: 0,
                  width: 32,
                  height: 32
                },
                visibleInSource: true,
                opacityInSource: 1,
                role: "editableLayer",
                unsupportedFeatures: [],
                mappedDrawableIds: ["draw_body"]
              }
            ],
            diagnostics: []
          }
        ]
      },
      provenance: {
        schemaVersion: "provenance-file-v1",
        records: [
          {
            provenanceId: "prov_generated",
            assetId: "src_generated",
            assetKind: "generatedFixture",
            filePath: "assets/sources/generated/editor-browser-sample-body.json",
            contentHash: "sha256:editor-browser-sample-generated-source",
            creator: "editor-browser-sample",
            license: "internal-test-fixture",
            redistributionAllowed: true,
            aiUsed: false,
            transformHistory: ["Authored as browser-safe text fixture; no binary art asset."],
            relatedOperationIds: []
          }
        ]
      },
      rights: {
        schemaVersion: "rights-file-v1",
        records: [
          {
            assetId: "src_generated",
            rightsStatus: "cleared",
            license: "internal-test-fixture",
            redistributionAllowed: true,
            notes: "Generated text-only fixture source; no PSD, PNG, Cubism, or proprietary asset."
          }
        ]
      }
    }
  });
