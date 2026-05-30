import { describe, expect, it } from "vitest";

import {
  PackageDocumentSchema,
  PackageManifestSchema,
  SourceManifestSchema,
  TextureAtlasEntrySchema,
  TexturePreviewReferenceSchema,
  parsePackageDocument
} from "./index.js";

const minimalManifest = {
  schemaVersion: "open-model-package-manifest-v1",
  packageId: "pkg_minimal",
  packageDisplayName: "Minimal Package",
  formatVersion: "open-model-package-v1",
  packageRevision: 0,
  createdAt: "2026-05-29T00:00:00.000Z",
  updatedAt: "2026-05-29T00:00:00.000Z",
  schemaVersions: {
    manifest: "open-model-package-manifest-v1"
  },
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
};

const minimalDocument = {
  manifest: minimalManifest,
  model: {
    graph: {
      schemaVersion: "model-graph-v1",
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: {
        width: 1024,
        height: 1024
      },
      parts: [],
      rigControlRootIds: [],
      stableOrder: []
    },
    drawables: {
      schemaVersion: "drawables-file-v1",
      drawables: []
    },
    meshes: {
      schemaVersion: "meshes-file-v1",
      meshes: []
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
      entries: []
    }
  },
  assets: {
    sourceManifest: {
      schemaVersion: "source-manifest-v1",
      sourceAssets: [
        {
          sourceAssetId: "src_split_png",
          kind: "split-png-set-v1",
          filePath: "assets/sources/split/body.png",
          contentHash: "sha256:test",
          importProfile: "split-png-fallback-v1",
          layers: [],
          diagnostics: ["source.psd.absent"]
        }
      ]
    },
    provenance: {
      schemaVersion: "provenance-file-v1",
      records: []
    },
    rights: {
      schemaVersion: "rights-file-v1",
      records: []
    }
  }
};

describe("package-format DTO schemas", () => {
  it("parses a valid minimal in-memory package document", () => {
    const parsed = PackageDocumentSchema.parse(minimalDocument);

    expect(parsed.manifest.packageId).toBe("pkg_minimal");
    expect(parsed.assets.sourceManifest.sourceAssets[0]?.kind).toBe("split-png-set-v1");
  });

  it("parses texture preview asset metadata as safe text references", () => {
    const parsed = PackageDocumentSchema.parse({
      ...minimalDocument,
      assets: {
        ...minimalDocument.assets,
        textureAtlas: {
          schemaVersion: "texture-atlas-v1",
          textures: [
            {
              textureId: "tex_body",
              filePath: "assets/textures/body.png",
              contentHash: "sha256:texture-body",
              sourceAssetId: "src_split_png",
              sourceLayerId: "layer_body",
              provenanceId: "prov_texture_body"
            }
          ],
          previewAssets: [
            {
              previewAssetId: "preview_body",
              textureId: "tex_body",
              reference: {
                referenceKind: "deterministic-data-url-v1",
                dataUrl: "data:image/png;base64,iVBORw0KGgo="
              },
              contentHash: "sha256:preview-body",
              sourceAssetId: "src_split_png",
              sourceLayerId: "layer_body",
              provenanceId: "prov_texture_body",
              rightsAssetId: "tex_body"
            }
          ]
        }
      }
    });

    expect(parsed.assets.textureAtlas?.previewAssets?.[0]).toMatchObject({
      previewAssetId: "preview_body",
      textureId: "tex_body",
      sourceAssetId: "src_split_png",
      sourceLayerId: "layer_body",
      provenanceId: "prov_texture_body",
      rightsAssetId: "tex_body"
    });
  });

  it("rejects external texture preview references", () => {
    expect(TexturePreviewReferenceSchema.safeParse({
      referenceKind: "package-local-file-v1",
      filePath: "https://example.test/body.png"
    }).success).toBe(false);
    expect(TexturePreviewReferenceSchema.safeParse({
      referenceKind: "deterministic-data-url-v1",
      dataUrl: "https://example.test/body.png"
    }).success).toBe(false);
  });

  it("rejects external or non-texture texture atlas entry paths", () => {
    const validEntry = {
      textureId: "tex_body",
      filePath: "assets/textures/body.png"
    };

    expect(TextureAtlasEntrySchema.safeParse(validEntry).success).toBe(true);
    expect(TextureAtlasEntrySchema.safeParse({
      ...validEntry,
      filePath: "https://example.test/body.png"
    }).success).toBe(false);
    expect(TextureAtlasEntrySchema.safeParse({
      ...validEntry,
      filePath: "assets/sources/body.png"
    }).success).toBe(false);
    expect(TextureAtlasEntrySchema.safeParse({
      ...validEntry,
      filePath: "assets/textures/../body.png"
    }).success).toBe(false);
  });

  it("returns parse issues for invalid schemaVersion and missing required manifest fields", () => {
    const invalidVersion = PackageManifestSchema.safeParse({
      ...minimalManifest,
      schemaVersion: "open-model-package-manifest-v2"
    });
    const missingRequired = PackageManifestSchema.safeParse({
      ...minimalManifest,
      packageId: undefined
    });

    expect(invalidVersion.success).toBe(false);
    expect(missingRequired.success).toBe(false);
  });

  it("parses split PNG fallback and generated fixture source asset kinds", () => {
    const parsed = SourceManifestSchema.parse({
      schemaVersion: "source-manifest-v1",
      sourceAssets: [
        {
          sourceAssetId: "src_split_png",
          kind: "split-png-set-v1",
          filePath: "assets/sources/split/body.png",
          contentHash: "sha256:split",
          importProfile: "split-png-fallback-v1"
        },
        {
          sourceAssetId: "src_generated_fixture",
          kind: "generated-fixture-v1",
          filePath: "assets/sources/generated/minimal.png",
          contentHash: "sha256:generated",
          importProfile: "split-png-fallback-v1"
        }
      ]
    });

    expect(parsed.sourceAssets.map((asset) => asset.kind)).toEqual([
      "split-png-set-v1",
      "generated-fixture-v1"
    ]);
  });

  it("exposes parse helpers through the public barrel", () => {
    const parsed = parsePackageDocument(minimalDocument);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.model.drawables.drawables).toHaveLength(0);
    }
  });
});
