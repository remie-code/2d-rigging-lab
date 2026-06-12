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
import type { MeshDto } from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import {
  createAlphaAwareGridMesh,
  createGeneratedMeshForDrawable
} from "./mesh-generation.js";
import { createAutoOutlineMesh } from "./mesh-outline-generation.js";

describe("alpha-aware mesh generation", () => {
  it("generates an auto-outline mesh whose boundary vertices follow the alpha contour", () => {
    const mesh = createAutoOutlineMesh({
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 0, y: 0, width: 8, height: 8 },
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
      textureSize: { width: 8, height: 8 },
      rgbaBytes: createAlphaBytes(8, 8, [
        [1, 1],
        [2, 1],
        [3, 1],
        [1, 2],
        [2, 2],
        [3, 2],
        [1, 3],
        [2, 3],
        [1, 4],
        [2, 4],
        [1, 5],
        [2, 5]
      ]),
      densityHint: "medium"
    });

    expect(mesh.status).toBe("generated");
    if (mesh.status !== "generated") {
      return;
    }

    expect(mesh.alphaBounds).toEqual({ x: 1, y: 1, width: 3, height: 5 });
    expect(mesh.mesh.vertices).toContainEqual({ x: 4, y: 1 });
    expect(mesh.mesh.vertices).toContainEqual({ x: 3, y: 3 });
    expect(mesh.mesh.vertices).not.toContainEqual({ x: 8, y: 8 });
    expect(mesh.mesh.triangles.length).toBeGreaterThan(0);
    expect(countTransparentCentroidTriangles(mesh.mesh, createAlphaSet([[3, 3], [3, 4], [3, 5]]))).toBe(0);
  });

  it("uses denser auto-outline boundary and interior points for Large Motion than Standard or Low Motion", () => {
    const rgbaBytes = createAlphaBytesFromPredicate(18, 18, (x, y) => {
      const dx = x - 8.5;
      const dy = y - 8.5;
      return dx * dx + dy * dy <= 46;
    });
    const baseInput = {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 0, y: 0, width: 18, height: 18 },
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
      textureSize: { width: 18, height: 18 },
      rgbaBytes
    };

    const large = createAutoOutlineMesh({ ...baseInput, densityHint: "high" });
    const standard = createAutoOutlineMesh({ ...baseInput, densityHint: "medium" });
    const low = createAutoOutlineMesh({ ...baseInput, densityHint: "low" });

    expect(large.status).toBe("generated");
    expect(standard.status).toBe("generated");
    expect(low.status).toBe("generated");
    if (large.status !== "generated" || standard.status !== "generated" || low.status !== "generated") {
      return;
    }

    expect(large.mesh.vertices.length).toBeGreaterThan(standard.mesh.vertices.length);
    expect(standard.mesh.vertices.length).toBeGreaterThan(low.mesh.vertices.length);
    expect(large.mesh.triangles.length).toBeGreaterThan(standard.mesh.triangles.length);
    expect(standard.mesh.triangles.length).toBeGreaterThan(low.mesh.triangles.length);
  });

  it("generates deterministic auto-outline meshes and falls back explicitly when alpha is empty", () => {
    const session = createFixtureSession({ includeBytes: true });
    const first = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v1",
      densityHint: "medium"
    });
    const second = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v1",
      densityHint: "medium"
    });

    expect(first).toEqual(second);
    expect(first?.source).toBe("outline-rgba");

    const emptyAlphaSession = createFixtureSession({ includeBytes: true, opaquePixels: [] });
    const fallback = createGeneratedMeshForDrawable({
      session: emptyAlphaSession,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v1",
      densityHint: "low"
    });

    expect(fallback?.source).toBe("bounds-grid");
    expect(fallback?.fallbackReason).toBe("alpha-empty");
    expect(fallback?.mesh.vertices).toHaveLength(4);
  });

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

function createFixtureSession({
  includeBytes,
  opaquePixels = [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2]
  ]
}: {
  readonly includeBytes: boolean;
  readonly opaquePixels?: readonly (readonly [number, number])[];
}): AuthoringSession {
  const bytes = createAlphaBytes(4, 4, opaquePixels);

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

function createAlphaBytesFromPredicate(
  width: number,
  height: number,
  predicate: (x: number, y: number) => boolean
): Uint8Array {
  const pixels: [number, number][] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (predicate(x, y)) {
        pixels.push([x, y]);
      }
    }
  }

  return createAlphaBytes(width, height, pixels);
}

function createAlphaSet(pixels: readonly (readonly [number, number])[]): ReadonlySet<string> {
  return new Set(pixels.map(([x, y]) => `${x}:${y}`));
}

function countTransparentCentroidTriangles(
  mesh: MeshDto,
  transparentPixels: ReadonlySet<string>
): number {
  return mesh.triangles.filter((triangle) => {
    const [aIndex, bIndex, cIndex] = triangle;
    const a = mesh.vertices[aIndex]!;
    const b = mesh.vertices[bIndex]!;
    const c = mesh.vertices[cIndex]!;
    const centroidX = Math.floor((a.x + b.x + c.x) / 3);
    const centroidY = Math.floor((a.y + b.y + c.y) / 3);
    return transparentPixels.has(`${centroidX}:${centroidY}`);
  }).length;
}
