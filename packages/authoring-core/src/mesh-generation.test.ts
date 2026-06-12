import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  type RectDto,
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
import { computeMeshQualityMetrics } from "./mesh-quality-metrics.js";
import { createAutoOutlineMesh } from "./mesh-outline-generation.js";
import { createAutoOutlineV2Mesh } from "./mesh-outline-v2-generation.js";

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

  it("generates deterministic auto-outline-v2 meshes with inset rings, jittered samples, and quality metrics", () => {
    const rgbaBytes = createAlphaBytesFromPredicate(24, 24, (x, y) => {
      const dx = x - 11.5;
      const dy = y - 11.5;
      return dx * dx + dy * dy <= 72 || (x >= 17 && x <= 21 && y >= 9 && y <= 13);
    });
    const baseInput = {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 0, y: 0, width: 24, height: 24 },
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
      textureSize: { width: 24, height: 24 },
      rgbaBytes,
      densityHint: "medium" as const
    };

    const first = createAutoOutlineV2Mesh(baseInput);
    const second = createAutoOutlineV2Mesh(baseInput);

    expect(first).toEqual(second);
    expect(first.status).toBe("generated");
    if (first.status !== "generated") {
      return;
    }

    expect(first.insetRingCount).toBeGreaterThanOrEqual(1);
    expect(first.interiorPointCount).toBeGreaterThan(0);
    expect(first.qualityMetrics.triangulationMode).toBe("interim-delaunay-alpha-filter");
    expect(first.qualityMetrics.refinementIterationCount).toBeGreaterThanOrEqual(0);
    expect(first.qualityMetrics.maxEdgeLength).toBeGreaterThan(0);
    expect(first.qualityMetrics.maxTriangleArea).toBeGreaterThan(0);
    expect(first.qualityMetrics.minAngleDegrees).toBeGreaterThan(0);
    expect(first.qualityMetrics.maxVertexValence).toBeGreaterThan(0);
    expect(first.mesh.vertexStableIds.some((id) => id.includes("_inset_0_"))).toBe(true);
    expect(first.mesh.vertices.some((vertex) => !Number.isInteger(vertex.x) || !Number.isInteger(vertex.y))).toBe(true);
  });

  it("uses denser auto-outline-v2 points and inset rings for Large Motion than Standard or Low Motion", () => {
    const rgbaBytes = createAlphaBytesFromPredicate(40, 40, (x, y) => {
      const dx = x - 19.5;
      const dy = y - 19.5;
      return dx * dx + dy * dy <= 210;
    });
    const baseInput = {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 0, y: 0, width: 40, height: 40 },
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
      textureSize: { width: 40, height: 40 },
      rgbaBytes
    };

    const large = createAutoOutlineV2Mesh({ ...baseInput, densityHint: "high" });
    const standard = createAutoOutlineV2Mesh({ ...baseInput, densityHint: "medium" });
    const low = createAutoOutlineV2Mesh({ ...baseInput, densityHint: "low" });

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
    expect(standard.insetRingCount).toBeGreaterThanOrEqual(1);
    expect(large.insetRingCount).toBeGreaterThanOrEqual(standard.insetRingCount);
    expect(large.mesh.vertexStableIds.some((id) => id.includes("_inset_1_"))).toBe(true);
  });

  it("filters auto-outline-v2 triangles whose centroids or edge samples would land outside alpha", () => {
    const alphaPixels = createPixelsFromPredicate(22, 22, (x, y) => {
      const filledBlock = x >= 3 && x <= 18 && y >= 3 && y <= 18;
      const notch = x >= 10 && x <= 18 && y >= 10 && y <= 18;
      return filledBlock && !notch;
    });
    const alphaSet = createAlphaSet(alphaPixels);
    const mesh = createAutoOutlineV2Mesh({
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 0, y: 0, width: 22, height: 22 },
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
      textureSize: { width: 22, height: 22 },
      rgbaBytes: createAlphaBytes(22, 22, alphaPixels),
      densityHint: "medium"
    });

    expect(mesh.status).toBe("generated");
    if (mesh.status !== "generated") {
      return;
    }

    expect(countTransparentSampledTriangles(mesh.mesh, alphaSet)).toBe(0);
  });

  it("keeps deterministic jittered auto-outline-v2 interior samples from regressing to an axis-aligned grid", () => {
    const mesh = createAutoOutlineV2Mesh({
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 0, y: 0, width: 36, height: 36 },
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
      textureSize: { width: 36, height: 36 },
      rgbaBytes: createAlphaBytesFromPredicate(36, 36, (x, y) => {
        const dx = x - 17.5;
        const dy = y - 17.5;
        return dx * dx + dy * dy <= 150;
      }),
      densityHint: "medium"
    });

    expect(mesh.status).toBe("generated");
    if (mesh.status !== "generated") {
      return;
    }

    const interiorVertices = mesh.mesh.vertices.filter((_vertex, index) =>
      mesh.mesh.vertexStableIds[index]?.includes("_interior_")
    );
    const fractionalXs = new Set(interiorVertices.map((vertex) => fractionalKey(vertex.x)));
    const fractionalYs = new Set(interiorVertices.map((vertex) => fractionalKey(vertex.y)));

    expect(interiorVertices.length).toBeGreaterThanOrEqual(4);
    expect(fractionalXs.size).toBeGreaterThan(1);
    expect(fractionalYs.size).toBeGreaterThan(1);
    expect(minPairwiseDistance(interiorVertices)).toBeGreaterThan(1.5);
  });

  it("improves representative fan and oversized triangle metrics compared with auto-outline-v1", () => {
    const rgbaBytes = createAlphaBytesFromPredicate(32, 28, (x, y) => {
      const dx = (x - 14.5) / 11;
      const dy = (y - 13.5) / 8;
      const body = dx * dx + dy * dy <= 1;
      const tail = x >= 20 && x <= 29 && y >= 11 && y <= 16;
      const notch = x >= 8 && x <= 12 && y >= 13 && y <= 19;
      return (body || tail) && !notch;
    });
    const baseInput = {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 0, y: 0, width: 32, height: 28 },
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
      textureSize: { width: 32, height: 28 },
      rgbaBytes,
      densityHint: "medium" as const
    };
    const v1 = createAutoOutlineMesh(baseInput);
    const v2 = createAutoOutlineV2Mesh(baseInput);

    expect(v1.status).toBe("generated");
    expect(v2.status).toBe("generated");
    if (v1.status !== "generated" || v2.status !== "generated") {
      return;
    }

    const v1Metrics = computeMeshQualityMetrics(v1.mesh, {
      refinementIterationCount: 0,
      triangulationMode: "ordinary-delaunay-alpha-filter"
    });

    expect(v2.qualityMetrics.maxVertexValence).toBeLessThanOrEqual(v1Metrics.maxVertexValence);
    expect(v2.qualityMetrics.maxTriangleArea).toBeLessThan(v1Metrics.maxTriangleArea);
    expect(v2.qualityMetrics.maxEdgeLength).toBeLessThan(v1Metrics.maxEdgeLength);
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

    const v2Fallback = createGeneratedMeshForDrawable({
      session: emptyAlphaSession,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v2",
      densityHint: "low"
    });

    expect(v2Fallback?.source).toBe("bounds-grid");
    expect(v2Fallback?.fallbackReason).toBe("alpha-empty");
    expect(v2Fallback?.fallbackSteps).toEqual([
      { method: "auto-outline-v2", reason: "alpha-empty" },
      { method: "auto-outline-v1", reason: "alpha-empty" }
    ]);
    expect(v2Fallback?.mesh.vertices).toHaveLength(4);
  });

  it("routes auto-outline-v2 as an explicit drawable generation method with quality summary", () => {
    const session = createFixtureSession({
      includeBytes: true,
      textureSize: { width: 18, height: 18 },
      meshBounds: { x: 10, y: 20, width: 18, height: 18 },
      opaquePixels: createPixelsFromPredicate(18, 18, (x, y) => {
        const dx = x - 8.5;
        const dy = y - 8.5;
        return dx * dx + dy * dy <= 44;
      })
    });

    const generated = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v2",
      densityHint: "medium"
    });

    expect(generated?.source).toBe("outline-v2-rgba");
    expect(generated?.fallbackReason).toBeUndefined();
    expect(generated?.qualityMetrics).toMatchObject({
      triangulationMode: "interim-delaunay-alpha-filter"
    });
    expect(generated?.qualityMetrics?.maxEdgeLength).toBeGreaterThan(0);
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
  textureSize = { width: 4, height: 4 },
  meshBounds = { x: 10, y: 20, width: 4, height: 4 },
  opaquePixels = [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2]
  ]
}: {
  readonly includeBytes: boolean;
  readonly textureSize?: { readonly width: number; readonly height: number };
  readonly meshBounds?: RectDto;
  readonly opaquePixels?: readonly (readonly [number, number])[];
}): AuthoringSession {
  const bytes = createAlphaBytes(textureSize.width, textureSize.height, opaquePixels);

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
          bounds: meshBounds,
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
  return createAlphaBytes(width, height, createPixelsFromPredicate(width, height, predicate));
}

function createPixelsFromPredicate(
  width: number,
  height: number,
  predicate: (x: number, y: number) => boolean
): readonly (readonly [number, number])[] {
  const pixels: [number, number][] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (predicate(x, y)) {
        pixels.push([x, y]);
      }
    }
  }

  return pixels;
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

function countTransparentSampledTriangles(
  mesh: MeshDto,
  alphaPixels: ReadonlySet<string>
): number {
  return mesh.triangles.filter((triangle) => {
    const [aIndex, bIndex, cIndex] = triangle;
    const a = mesh.vertices[aIndex]!;
    const b = mesh.vertices[bIndex]!;
    const c = mesh.vertices[cIndex]!;
    const centroid = {
      x: (a.x + b.x + c.x) / 3,
      y: (a.y + b.y + c.y) / 3
    };
    const samples = [
      centroid,
      midpoint(a, b),
      midpoint(b, c),
      midpoint(c, a),
      midpoint(a, centroid),
      midpoint(b, centroid),
      midpoint(c, centroid)
    ];
    return samples.some((sample) => !alphaPixels.has(`${Math.floor(sample.x)}:${Math.floor(sample.y)}`));
  }).length;
}

function fractionalKey(value: number): number {
  return Math.round((value - Math.floor(value)) * 1_000);
}

function minPairwiseDistance(points: readonly MeshDto["vertices"][number][]): number {
  let result = Number.POSITIVE_INFINITY;
  for (let leftIndex = 0; leftIndex < points.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < points.length; rightIndex += 1) {
      const left = points[leftIndex]!;
      const right = points[rightIndex]!;
      result = Math.min(result, Math.hypot(left.x - right.x, left.y - right.y));
    }
  }

  return Number.isFinite(result) ? result : 0;
}

function midpoint(
  left: MeshDto["vertices"][number],
  right: MeshDto["vertices"][number]
): MeshDto["vertices"][number] {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2
  };
}
