import { describe, expect, it } from "vitest";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ProvenanceIdSchema,
  RuntimeSnapshotIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { TextureAtlasFileDto } from "@private-2d-rigging-lab/package-format";

import type { EditorPreviewProjectionDto } from "./preview-dto.js";
import { applyEditorPreviewTextureAssets } from "./texture-preview-resolution.js";

describe("editor preview texture preview resolution", () => {
  it("attaches deterministic texture preview references to projected drawables", () => {
    const projected = applyEditorPreviewTextureAssets({
      preview: createPreviewProjection(),
      textureAtlas: createTextureAtlas(),
      drawableTextures: [
        {
          drawableId: "draw_face",
          textureId: "tex_face",
          sourceAssetId: "src_face",
          sourceLayerId: "layer_face"
        }
      ]
    });

    expect(projected?.drawables[0]?.texture).toMatchObject({
      status: "resolved",
      textureId: "tex_face",
      sourceAssetId: "src_face",
      sourceLayerId: "layer_face",
      previewReference: {
        previewAssetId: "preview_face",
        referenceKind: "deterministic-data-url-v1",
        href: "data:image/png;base64,iVBORw0KGgo="
      }
    });
  });

  it("keeps authored texture refs as not materialized when no preview asset is available", () => {
    const projected = applyEditorPreviewTextureAssets({
      preview: createPreviewProjection(),
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [],
        previewAssets: []
      },
      drawableTextures: [
        {
          drawableId: "draw_face",
          textureId: "tex_face"
        }
      ]
    });

    expect(projected?.drawables[0]?.texture).toMatchObject({
      status: "not_materialized",
      textureId: "tex_face"
    });
    expect(projected?.drawables[0]?.texture.previewReference).toBeUndefined();
  });
});

const createPreviewProjection = (): EditorPreviewProjectionDto => ({
  schemaVersion: "editor-preview-projection-v1",
  sourceSnapshotId: RuntimeSnapshotIdSchema.parse("snap_preview_texture"),
  packageId: PackageIdSchema.parse("pkg_preview_texture"),
  packageRevision: 1,
  snapshotDetail: "full",
  canvasSize: { width: 128, height: 128 },
  drawList: [DrawableIdSchema.parse("draw_face")],
  drawableCount: 1,
  visibleDrawableCount: 1,
  drawables: [
    {
      drawableId: DrawableIdSchema.parse("draw_face"),
      name: "Face",
      meshId: MeshIdSchema.parse("mesh_face"),
      visible: true,
      opacity: 1,
      baseDrawOrder: 0,
      evaluatedDrawOrder: 0,
      projectionOrder: 0,
      drawListIndex: 0,
      bounds: { x: 8, y: 10, width: 96, height: 112 },
      geometry: {
        vertexCount: 4,
        vertexHash: "hash_face",
        polygonPoints: [
          { x: 8, y: 10 },
          { x: 104, y: 10 },
          { x: 104, y: 122 },
          { x: 8, y: 122 }
        ]
      },
      texture: {
        status: "not_materialized",
        projection: { kind: "bounds_fit" }
      },
      keyformSampleCount: 0,
      diagnostics: emptyDiagnostics()
    }
  ],
  keyformSamples: {
    totalCount: 0,
    byEvaluator: [],
    byTarget: []
  },
  diagnostics: emptyDiagnostics()
});

const createTextureAtlas = (): TextureAtlasFileDto => ({
  schemaVersion: "texture-atlas-v1",
  textures: [
    {
      textureId: TextureIdSchema.parse("tex_face"),
      filePath: "assets/textures/face.png",
      sourceAssetId: SourceAssetIdSchema.parse("src_face"),
      sourceLayerId: "layer_face",
      provenanceId: ProvenanceIdSchema.parse("prov_face")
    }
  ],
  previewAssets: [
    {
      previewAssetId: "preview_face",
      textureId: TextureIdSchema.parse("tex_face"),
      reference: {
        referenceKind: "deterministic-data-url-v1",
        dataUrl: "data:image/png;base64,iVBORw0KGgo="
      },
      sourceAssetId: SourceAssetIdSchema.parse("src_face"),
      sourceLayerId: "layer_face",
      provenanceId: ProvenanceIdSchema.parse("prov_face"),
      rightsAssetId: "src_face"
    }
  ]
});

const emptyDiagnostics = (): EditorPreviewProjectionDto["diagnostics"] => ({
  totalCount: 0,
  bySeverity: {
    info: 0,
    warning: 0,
    error: 0,
    blocking: 0
  },
  byStatus: {
    pass: 0,
    warning: 0,
    fail: 0,
    needs_review: 0,
    not_applicable: 0
  },
  blockingCount: 0,
  errorCount: 0,
  warningCount: 0,
  items: []
});
