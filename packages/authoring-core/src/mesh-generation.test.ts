import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { createPackageBinaryFileEntry } from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import {
  createAlphaAwareGridMesh,
  createGeneratedMeshForDrawable
} from "./mesh-generation.js";

describe("alpha-aware mesh generation", () => {
  it("generates vertices and UVs from the drawable texture alpha bounds while preserving texture bounds", () => {
    const mesh = createAlphaAwareGridMesh({
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 10, y: 20, width: 4, height: 4 },
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
      textureSize: { width: 4, height: 4 },
      rgbaBytes: createAlphaBytes(4, 4, [
        [1, 1],
        [2, 1],
        [1, 2],
        [2, 2]
      ]),
      densityHint: "medium"
    });

    expect(mesh).not.toBeUndefined();
    expect(mesh?.alphaBounds).toEqual({ x: 11, y: 21, width: 2, height: 2 });
    expect(mesh?.mesh.bounds).toEqual({ x: 10, y: 20, width: 4, height: 4 });
    expect(mesh?.mesh.vertices).toEqual([
      { x: 11, y: 21 },
      { x: 12, y: 21 },
      { x: 11, y: 22 },
      { x: 12, y: 22 },
      { x: 13, y: 21 },
      { x: 13, y: 22 },
      { x: 11, y: 23 },
      { x: 12, y: 23 },
      { x: 13, y: 23 }
    ]);
    expect(mesh?.mesh.uvs[0]).toEqual({ x: 0.25, y: 0.25 });
    expect(mesh?.mesh.uvs.at(-1)).toEqual({ x: 0.75, y: 0.75 });
    expect(mesh?.mesh.triangles).toHaveLength(8);
    expect(new Set(mesh?.mesh.triangles.flat())).toEqual(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]));
  });

  it("falls back to bounds-grid generation when drawable texture bytes are unavailable", () => {
    const session = createFixtureSession({ includeBytes: false });

    const generated = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-grid-v1",
      densityHint: "low"
    });

    expect(generated?.source).toBe("bounds-grid");
    expect(generated?.mesh.vertices).toEqual([
      { x: 10, y: 20 },
      { x: 14, y: 20 },
      { x: 10, y: 24 },
      { x: 14, y: 24 }
    ]);
  });

  it("uses session texture bytes for drawable generation without mutating the session", () => {
    const session = createFixtureSession({ includeBytes: true });

    const generated = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-grid-v1",
      densityHint: "low"
    });

    expect(generated?.source).toBe("alpha-aware-rgba");
    expect(generated?.alphaBounds).toEqual({ x: 11, y: 21, width: 2, height: 2 });
    expect(generated?.mesh.vertices).toEqual([
      { x: 11, y: 21 },
      { x: 13, y: 21 },
      { x: 11, y: 23 },
      { x: 13, y: 23 }
    ]);
    expect(session.graph.meshes[0]?.vertices).toEqual([]);
    expect(session.authoringRevision).toBe(0);
  });
});

function createFixtureSession({ includeBytes }: { readonly includeBytes: boolean }): AuthoringSession {
  const bytes = createAlphaBytes(4, 4, [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2]
  ]);

  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_mesh_generation_test"),
      packageDisplayName: "Mesh Generation Test",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 0,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 32, height: 32 },
      parts: [
        {
          partId: PartIdSchema.parse("part_root"),
          displayName: "Root",
          childPartIds: [],
          drawableIds: [DrawableIdSchema.parse("draw_body")]
        }
      ],
      drawables: [
        {
          drawableId: DrawableIdSchema.parse("draw_body"),
          displayName: "Body",
          partId: PartIdSchema.parse("part_root"),
          sourceAssetId: SourceAssetIdSchema.parse("src_body"),
          textureId: TextureIdSchema.parse("tex_body"),
          meshId: MeshIdSchema.parse("mesh_body"),
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_body")
        }
      ],
      meshes: [
        {
          meshId: MeshIdSchema.parse("mesh_body"),
          drawableId: DrawableIdSchema.parse("draw_body"),
          vertices: [],
          uvs: [],
          triangles: [],
          vertexStableIds: [],
          triangleStableIds: [],
          topologyRevision: 0,
          bounds: { x: 10, y: 20, width: 4, height: 4 },
          generationProvenanceId: ProvenanceIdSchema.parse("prov_body")
        }
      ],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [
        {
          drawableId: DrawableIdSchema.parse("draw_body"),
          baseDrawOrder: 0,
          stableOrder: 0
        }
      ],
      rigControlRootIds: [],
      stableOrder: ["draw_body"],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: [],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          {
            textureId: TextureIdSchema.parse("tex_body"),
            filePath: "assets/textures/body.raw-rgba",
            sourceAssetId: SourceAssetIdSchema.parse("src_body"),
            binaryAssetRef: {
              referenceKind: "package-binary-asset-ref-v1",
              binaryAssetId: "bin_body_rgba",
              packageRelativePath: "assets/textures/body.raw-rgba",
              digest: {
                algorithm: "sha256",
                hex: "0".repeat(64)
              },
              byteLength: bytes.byteLength,
              mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
              storageStatus: "stored-package-local-v1",
              provenanceId: ProvenanceIdSchema.parse("prov_body"),
              rightsAssetId: "rights_body"
            }
          }
        ]
      }
    },
    ...(includeBytes
      ? {
          binaryAssets: {
            fileEntries: [
              createPackageBinaryFileEntry({
                path: "assets/textures/body.raw-rgba",
                bytes,
                mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
                binaryAssetId: "bin_body_rgba"
              })
            ],
            binaryAssetIndex: {
              schemaVersion: "binary-asset-index-v1",
              assets: []
            },
            byteIntakeSummaries: []
          }
        }
      : {})
  };
}

function createAlphaBytes(
  width: number,
  height: number,
  opaquePixels: readonly (readonly [number, number])[]
): Uint8Array {
  const bytes = new Uint8Array(width * height * 4);

  for (const [x, y] of opaquePixels) {
    const index = (y * width + x) * 4;
    bytes[index] = 255;
    bytes[index + 1] = 255;
    bytes[index + 2] = 255;
    bytes[index + 3] = 255;
  }

  return bytes;
}
