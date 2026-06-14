import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  type RectDto
} from "@private-2d-rigging-lab/contracts";
import { createPackageBinaryFileEntry } from "@private-2d-rigging-lab/package-format";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { createGeneratedMeshForDrawable } from "./mesh-generation.js";
import {
  createV6MeshGenerationFixtureRgbaBytes,
  getV6MeshGenerationContractFixture
} from "./mesh-generation-v6-fixtures.js";

describe("auto-outline-v6f-contour-custom-cdt", () => {
  it("generates deterministic backend meshes from shared contour candidate input", () => {
    for (const fixtureId of [
      "v6-simple-rectangle",
      "v6-curved-blob",
      "v6-thin-tapered",
      "v6-hole-like"
    ] as const) {
      const fixture = getV6MeshGenerationContractFixture(fixtureId);
      const session = createFixtureSession({
        includeBytes: true,
        textureSize: fixture.textureSize,
        meshBounds: fixture.meshBounds,
        rgbaBytes: createV6MeshGenerationFixtureRgbaBytes(fixture)
      });
      const baseInput = {
        session,
        drawableId: DrawableIdSchema.parse("draw_body"),
        provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
        method: "auto-outline-v6f-contour-custom-cdt" as const,
        densityHint: "medium" as const
      };

      const first = createGeneratedMeshForDrawable(baseInput);
      const second = createGeneratedMeshForDrawable(baseInput);

      expect(first, fixtureId).toEqual(second);
      expect(first?.source, fixtureId).toBe("outline-v6f-contour-custom-cdt-rgba");
      expect(first?.fallbackReason, fixtureId).toBeUndefined();
      expect(first?.fallbackSteps, fixtureId).toBeUndefined();
      expectValidMeshDto(first?.mesh, {
        meshId: MeshIdSchema.parse("mesh_body"),
        drawableId: baseInput.drawableId,
        generationProvenanceId: baseInput.provenanceId,
        bounds: fixture.meshBounds
      });

      const v6Metrics = first?.qualityMetrics?.v6Metrics;
      const customDiagnostics = v6Metrics?.customCdtDiagnostics;
      expect(first?.qualityMetrics, fixtureId).toMatchObject({
        triangulationMode: "v6f-contour-custom-cdt",
        v6Metrics: {
          algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
          methodId: "auto-outline-v6f-contour-custom-cdt",
          backendId: "v6f-contour-custom-cdt",
          backendImplementationStatus: "implemented",
          requestedSourceId: "outline-v6f-contour-custom-cdt-rgba",
          actualSourceId: "outline-v6f-contour-custom-cdt-rgba",
          outputKind: "backend-output",
          preset: "medium",
          fallbackSteps: [],
          alphaBoundsAvailable: true,
          contourPipelineDiagnostics: {
            status: "generated",
            alphaBoundsAvailable: true
          },
          customCdtDiagnostics: {
            dependencyGateStatus: "not-required",
            missingConstraintEdgeCount: 0
          }
        }
      });
      expect(v6Metrics?.fallbackReason, fixtureId).toBeUndefined();
      expect(customDiagnostics?.customTriangulationFallbackReason, fixtureId).toBeUndefined();
      expect(v6Metrics?.vertexCount, fixtureId).toBe(first?.mesh.vertices.length);
      expect(v6Metrics?.triangleCount, fixtureId).toBe(first?.mesh.triangles.length);
      expect(v6Metrics?.boundaryVertexCount, fixtureId).toBe(v6Metrics?.contourPipelineDiagnostics?.boundaryPointCount);
      expect(v6Metrics?.interiorVertexCount, fixtureId).toBe(v6Metrics?.contourPipelineDiagnostics?.steinerPointCount);
      expect(customDiagnostics?.constraintEdgeCount, fixtureId).toBe(v6Metrics?.boundaryVertexCount);
      expect(customDiagnostics?.preservedConstraintEdgeCount, fixtureId).toBe(customDiagnostics?.constraintEdgeCount);
      expect(customDiagnostics?.constraintRecoveryOperationCount, fixtureId).toBe(customDiagnostics?.constraintEdgeCount);
      expect(customDiagnostics?.edgeFlipCount, fixtureId).toBeGreaterThanOrEqual(0);
      expect(customDiagnostics?.rejectedLocalImprovementCount, fixtureId).toBeGreaterThanOrEqual(0);
      expect(v6Metrics?.provenance, fixtureId).toEqual(
        expect.arrayContaining([
          "shared-v6-contour-pipeline",
          "v6f-all-selected-points-seeded",
          "v6f-boundary-constraints-seeded",
          "v6f-boundary-constraints-verified"
        ])
      );
      expect(countUsedVertices(first?.mesh), fixtureId).toBe(first?.mesh.vertices.length);
      expect(countMissingBoundaryEdges(first?.mesh, v6Metrics?.boundaryVertexCount ?? 0), fixtureId).toBe(0);
    }
  });

  it("counts long boundary spoke candidates while keeping final long boundary chords out of the rectangle fixture", () => {
    const fixture = getV6MeshGenerationContractFixture("v6-simple-rectangle");
    const generated = createGeneratedMeshForDrawable({
      session: createFixtureSession({
        includeBytes: true,
        textureSize: fixture.textureSize,
        meshBounds: fixture.meshBounds,
        rgbaBytes: createV6MeshGenerationFixtureRgbaBytes(fixture)
      }),
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6f-contour-custom-cdt",
      densityHint: "medium"
    });

    const boundaryVertexCount = generated?.qualityMetrics?.v6Metrics?.boundaryVertexCount ?? 0;
    expect(generated?.source).toBe("outline-v6f-contour-custom-cdt-rgba");
    expect(generated?.qualityMetrics?.v6Metrics?.customCdtDiagnostics?.longSpokeCandidateCount).toBeGreaterThan(0);
    expect(countLongBoundaryChordEdges(generated?.mesh, boundaryVertexCount)).toBe(0);
  });

  it("reports empty alpha and missing texture bytes as blocked custom CDT metadata", () => {
    const emptyFixture = getV6MeshGenerationContractFixture("v6-empty-alpha-fallback");
    const emptyGenerated = createGeneratedMeshForDrawable({
      session: createFixtureSession({
        includeBytes: true,
        textureSize: emptyFixture.textureSize,
        meshBounds: emptyFixture.meshBounds,
        rgbaBytes: createV6MeshGenerationFixtureRgbaBytes(emptyFixture)
      }),
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6f-contour-custom-cdt",
      densityHint: "low"
    });

    expect(emptyGenerated?.source).toBe("bounds-grid");
    expect(emptyGenerated?.fallbackReason).toBe("alpha-empty");
    expect(emptyGenerated?.qualityMetrics?.v6Metrics).toMatchObject({
      methodId: "auto-outline-v6f-contour-custom-cdt",
      backendId: "v6f-contour-custom-cdt",
      backendImplementationStatus: "implemented",
      outputKind: "blocked",
      contourPipelineDiagnostics: {
        status: "blocked",
        blockedReason: "alpha-empty"
      },
      customCdtDiagnostics: {
        dependencyGateStatus: "not-required",
        customTriangulationFallbackReason: "alpha-empty"
      }
    });

    const missingFixture = getV6MeshGenerationContractFixture("v6-simple-rectangle");
    const missingGenerated = createGeneratedMeshForDrawable({
      session: createFixtureSession({
        includeBytes: false,
        textureSize: missingFixture.textureSize,
        meshBounds: missingFixture.meshBounds,
        rgbaBytes: createV6MeshGenerationFixtureRgbaBytes(missingFixture)
      }),
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6f-contour-custom-cdt",
      densityHint: "low"
    });

    expect(missingGenerated?.source).toBe("bounds-grid");
    expect(missingGenerated?.fallbackReason).toBe("texture-bytes-unavailable");
    expect(missingGenerated?.qualityMetrics?.v6Metrics).toMatchObject({
      methodId: "auto-outline-v6f-contour-custom-cdt",
      backendImplementationStatus: "implemented",
      outputKind: "blocked",
      customCdtDiagnostics: {
        dependencyGateStatus: "not-required",
        customTriangulationFallbackReason: "texture-bytes-unavailable"
      }
    });
    expect(missingGenerated?.qualityMetrics?.v6Metrics?.contourPipelineDiagnostics).toBeUndefined();
  });
});

function expectValidMeshDto(
  mesh: MeshDto | undefined,
  expected: {
    readonly meshId: MeshDto["meshId"];
    readonly drawableId: MeshDto["drawableId"];
    readonly generationProvenanceId: MeshDto["generationProvenanceId"];
    readonly bounds: RectDto;
  }
): void {
  expect(mesh).toBeDefined();
  if (mesh === undefined) {
    return;
  }

  expect(mesh.meshId).toBe(expected.meshId);
  expect(mesh.drawableId).toBe(expected.drawableId);
  expect(mesh.generationProvenanceId).toBe(expected.generationProvenanceId);
  expect(mesh.bounds).toEqual(expected.bounds);
  expect(mesh.vertices).toHaveLength(mesh.uvs.length);
  expect(mesh.vertices).toHaveLength(mesh.vertexStableIds.length);
  expect(mesh.triangleStableIds).toHaveLength(mesh.triangles.length);
  expect(mesh.topologyRevision).toBe(0);
  expect(mesh.vertices.length).toBeGreaterThan(0);
  expect(mesh.triangles.length).toBeGreaterThan(0);

  for (const vertex of mesh.vertices) {
    expect(vertex.x).toBeGreaterThanOrEqual(expected.bounds.x);
    expect(vertex.x).toBeLessThanOrEqual(expected.bounds.x + expected.bounds.width);
    expect(vertex.y).toBeGreaterThanOrEqual(expected.bounds.y);
    expect(vertex.y).toBeLessThanOrEqual(expected.bounds.y + expected.bounds.height);
  }

  for (const triangle of mesh.triangles) {
    const [aIndex, bIndex, cIndex] = triangle;
    expect(aIndex).not.toBe(bIndex);
    expect(bIndex).not.toBe(cIndex);
    expect(cIndex).not.toBe(aIndex);
    expect(mesh.vertices[aIndex]).toBeDefined();
    expect(mesh.vertices[bIndex]).toBeDefined();
    expect(mesh.vertices[cIndex]).toBeDefined();
  }
}

function countUsedVertices(mesh: MeshDto | undefined): number {
  const used = new Set<number>();
  for (const triangle of mesh?.triangles ?? []) {
    used.add(triangle[0]);
    used.add(triangle[1]);
    used.add(triangle[2]);
  }

  return used.size;
}

function countMissingBoundaryEdges(
  mesh: MeshDto | undefined,
  boundaryVertexCount: number
): number {
  const edgeKeys = createTriangleEdgeKeys(mesh);
  let missing = 0;
  for (let index = 0; index < boundaryVertexCount; index += 1) {
    if (!edgeKeys.has(edgeKey(index, (index + 1) % boundaryVertexCount))) {
      missing += 1;
    }
  }

  return missing;
}

function countLongBoundaryChordEdges(
  mesh: MeshDto | undefined,
  boundaryVertexCount: number
): number {
  if (mesh === undefined || boundaryVertexCount < 3) {
    return 0;
  }

  const boundaryLengths = Array.from({ length: boundaryVertexCount }, (_value, index) =>
    distance(mesh.vertices[index]!, mesh.vertices[(index + 1) % boundaryVertexCount]!)
  );
  const averageBoundaryLength =
    boundaryLengths.reduce((sum, length) => sum + length, 0) / boundaryLengths.length;
  const longThreshold = Math.max(averageBoundaryLength * 2.75, diagonalLength(mesh.vertices.slice(0, boundaryVertexCount)) * 0.28);
  const seen = createTriangleEdgeKeys(mesh);
  let count = 0;

  for (const key of seen) {
    const [left, right] = key.split(":").map((value) => Number.parseInt(value, 10));
    if (
      left === undefined ||
      right === undefined ||
      left >= boundaryVertexCount ||
      right >= boundaryVertexCount ||
      areAdjacentBoundaryIndexes(left, right, boundaryVertexCount)
    ) {
      continue;
    }

    if (distance(mesh.vertices[left]!, mesh.vertices[right]!) > longThreshold) {
      count += 1;
    }
  }

  return count;
}

function createTriangleEdgeKeys(mesh: MeshDto | undefined): Set<string> {
  const edgeKeys = new Set<string>();
  for (const [a, b, c] of mesh?.triangles ?? []) {
    edgeKeys.add(edgeKey(a, b));
    edgeKeys.add(edgeKey(b, c));
    edgeKeys.add(edgeKey(c, a));
  }

  return edgeKeys;
}

function createFixtureSession(input: {
  readonly includeBytes: boolean;
  readonly textureSize: { readonly width: number; readonly height: number };
  readonly meshBounds: RectDto;
  readonly rgbaBytes: Uint8Array;
}): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_mesh_generation_v6f_test"),
      packageDisplayName: "Mesh Generation V6F Test",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 0,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 64, height: 64 },
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
          bounds: input.meshBounds,
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
              byteLength: input.rgbaBytes.byteLength,
              mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
              storageStatus: "stored-package-local-v1",
              provenanceId: ProvenanceIdSchema.parse("prov_body"),
              rightsAssetId: "rights_body"
            }
          }
        ]
      }
    },
    ...(input.includeBytes
      ? {
          binaryAssets: {
            fileEntries: [
              createPackageBinaryFileEntry({
                path: "assets/textures/body.raw-rgba",
                bytes: input.rgbaBytes,
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

function edgeKey(left: number, right: number): string {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

function areAdjacentBoundaryIndexes(
  left: number,
  right: number,
  boundaryVertexCount: number
): boolean {
  return Math.abs(left - right) === 1 || Math.abs(left - right) === boundaryVertexCount - 1;
}

function diagonalLength(points: readonly MeshDto["vertices"][number][]): number {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return Math.hypot(maxX - minX, maxY - minY);
}

function distance(
  left: MeshDto["vertices"][number],
  right: MeshDto["vertices"][number]
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}
