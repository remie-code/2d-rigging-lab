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
        stableOrder: ["param_preview_body_yaw", "draw_body", "mesh_body", "keyset_preview_body_yaw_vertices"]
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
              { x: 24, y: 16 },
              { x: 72, y: 16 },
              { x: 48, y: 80 }
            ],
            uvs: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 }
            ],
            triangles: [[0, 1, 2]],
            vertexStableIds: ["v0", "v1", "v2"],
            bounds: {
              x: 24,
              y: 16,
              width: 48,
              height: 64
            },
            generationProvenanceId: "prov_generated"
          }
        ]
      },
      parameters: {
        schemaVersion: "parameters-file-v1",
        parameters: [
          {
            parameterId: "param_preview_body_yaw",
            displayName: "Preview Body Yaw",
            semanticRole: "body",
            projectPresetAlias: "private-editor-preview-body-yaw",
            valueSource: "authoredInput",
            min: -1,
            max: 1,
            default: 0,
            recommendedUiStep: 0.01
          }
        ]
      },
      keyforms: {
        schemaVersion: "keyforms-file-v1",
        keyformSets: [
          {
            keyformSetId: "keyset_preview_body_yaw_vertices",
            target: {
              kind: "mesh",
              id: "mesh_body",
              property: "vertices"
            },
            parameterId: "param_preview_body_yaw",
            evaluator: "linear-1d-v1",
            interpolation: "linear-1d-v1",
            compositionMode: "replace",
            compositionOrder: 0,
            keys: [
              {
                value: -1,
                statePatch: [
                  { x: 18, y: 18 },
                  { x: 66, y: 12 },
                  { x: 42, y: 82 }
                ]
              },
              {
                value: 0,
                statePatch: [
                  { x: 24, y: 16 },
                  { x: 72, y: 16 },
                  { x: 48, y: 80 }
                ]
              },
              {
                value: 1,
                statePatch: [
                  { x: 30, y: 16 },
                  { x: 84, y: 22 },
                  { x: 54, y: 78 }
                ]
              }
            ]
          }
        ]
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
                  x: 24,
                  y: 16,
                  width: 48,
                  height: 64
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
