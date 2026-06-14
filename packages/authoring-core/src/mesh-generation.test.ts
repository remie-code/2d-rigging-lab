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
import {
  V6_MESH_GENERATION_CANDIDATES,
  V6_MESH_GENERATION_DEPENDENCY_PACKAGE_IDS
} from "./mesh-generation-contract.js";
import {
  V6_MESH_GENERATION_CONTRACT_FIXTURE_IDS,
  V6_MESH_GENERATION_CONTRACT_FIXTURES,
  createV6MeshGenerationFixtureRgbaBytes,
  getV6MeshGenerationContractFixture
} from "./mesh-generation-v6-fixtures.js";
import {
  probeAutoOutlineV6BConstrainautorRetryForTest,
  recoverV6BConstrainautorTriangles
} from "./mesh-generation-v6b-constrainautor.js";
import {
  probeAutoOutlineV6CPoly2TriFailureForTest,
  probeAutoOutlineV6CPoly2TriSanitizationForTest
} from "./mesh-generation-v6c-poly2tri.js";
import { computeMeshQualityMetrics } from "./mesh-quality-metrics.js";
import { createAutoOutlineMesh } from "./mesh-outline-generation.js";
import { createAutoOutlineV25SoftBoundaryMesh } from "./mesh-outline-v2-5-soft-boundary-generation.js";
import { createAutoOutlineV26SoftApronMesh } from "./mesh-outline-v2-6-soft-apron-generation.js";
import { createAutoOutlineV2Mesh } from "./mesh-outline-v2-generation.js";
import { createAutoOutlineV3EnvelopeMesh } from "./mesh-outline-v3-envelope-generation.js";
import { createAutoOutlineV4ContourBandMesh } from "./mesh-outline-v4-contour-band-generation.js";

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

  it("generates deterministic auto-outline-v2.5 soft-boundary meshes with coarser counts and provenance metrics", () => {
    const alphaPixels = createPixelsFromPredicate(40, 36, (x, y) => {
      const dx = (x - 18.5) / 12;
      const dy = (y - 17.5) / 9;
      const body = dx * dx + dy * dy <= 1;
      const tail = x >= 25 && x <= 34 && y >= 14 && y <= 20;
      const notch = x >= 9 && x <= 16 && y >= 19 && y <= 29;
      return (body || tail) && !notch;
    });
    const rgbaBytes = createAlphaBytes(40, 36, alphaPixels);
    const baseInput = {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 0, y: 0, width: 40, height: 36 },
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
      textureSize: { width: 40, height: 36 },
      rgbaBytes,
      densityHint: "medium" as const
    };

    const first = createAutoOutlineV25SoftBoundaryMesh(baseInput);
    const second = createAutoOutlineV25SoftBoundaryMesh(baseInput);
    const v2 = createAutoOutlineV2Mesh(baseInput);

    expect(first).toEqual(second);
    expect(first.status).toBe("generated");
    expect(v2.status).toBe("generated");
    if (first.status !== "generated" || v2.status !== "generated") {
      return;
    }

    expect(first.mesh.vertices.length).toBeLessThan(v2.mesh.vertices.length);
    expect(first.mesh.triangles.length).toBeLessThan(v2.mesh.triangles.length);
    expect(first.qualityMetrics.triangulationMode).toBe("interim-delaunay-soft-boundary-filter");
    expect(first.softBoundaryMetrics.algorithmId).toBe("auto-outline-v2.5-soft-boundary");
    expect(first.softBoundaryMetrics.padding).toBeGreaterThan(0);
    expect(first.softBoundaryMetrics.softBoundaryAreaRatio).toBeGreaterThan(1);
    expect(first.softBoundaryMetrics.softBoundaryAreaRatio).toBeLessThan(1.45);
    expect(first.softBoundaryMetrics.transparentSampleCount).toBeGreaterThan(0);
    expect(first.softBoundaryMetrics.outsideTriangleSampleCount).toBe(0);
    expect(first.softBoundaryMetrics.farTransparentSampleCount).toBe(0);
    expect(first.softBoundaryMetrics.provenance).toEqual(
      expect.arrayContaining([
        "ratio-based-centroid-soft-boundary",
        "transparent-near-boundary-allowance",
        "constrained-triangulation-deferred"
      ])
    );
    expect(first.mesh.vertexStableIds.some((id) => id.includes("_outline_v2_5_soft_boundary_boundary_"))).toBe(true);
    expect(first.qualityMetrics.softBoundaryMetrics).toEqual(first.softBoundaryMetrics);

    const independentSamples = countV25SoftBoundarySampleClasses(first.mesh, createAlphaSet(alphaPixels));
    expect(independentSamples.outsideSoftBoundary).toBe(0);
    expect(independentSamples.transparentInsideSoftBoundary).toBeGreaterThan(0);
  });

  it("keeps auto-outline-v2.5 Large Motion no denser than current auto-outline-v2 Low Motion", () => {
    const fixtures = [
      {
        name: "notched-tail",
        width: 40,
        height: 36,
        predicate: (x: number, y: number): boolean => {
          const dx = (x - 18.5) / 12;
          const dy = (y - 17.5) / 9;
          const body = dx * dx + dy * dy <= 1;
          const tail = x >= 25 && x <= 34 && y >= 14 && y <= 20;
          const notch = x >= 9 && x <= 16 && y >= 19 && y <= 29;
          return (body || tail) && !notch;
        }
      },
      {
        name: "round-body",
        width: 40,
        height: 40,
        predicate: (x: number, y: number): boolean => {
          const dx = x - 19.5;
          const dy = y - 19.5;
          return dx * dx + dy * dy <= 210;
        }
      }
    ];

    for (const fixture of fixtures) {
      const baseInput = {
        meshId: MeshIdSchema.parse("mesh_body"),
        drawableId: DrawableIdSchema.parse("draw_body"),
        bounds: { x: 0, y: 0, width: fixture.width, height: fixture.height },
        provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
        textureSize: { width: fixture.width, height: fixture.height },
        rgbaBytes: createAlphaBytesFromPredicate(fixture.width, fixture.height, fixture.predicate)
      };
      const v2Low = createAutoOutlineV2Mesh({ ...baseInput, densityHint: "low" });
      const v25Large = createAutoOutlineV25SoftBoundaryMesh({ ...baseInput, densityHint: "high" });

      expect(v2Low.status, `${fixture.name}:v2-low`).toBe("generated");
      expect(v25Large.status, `${fixture.name}:v2.5-large`).toBe("generated");
      if (v2Low.status !== "generated" || v25Large.status !== "generated") {
        continue;
      }

      expect(v25Large.mesh.vertices.length, `${fixture.name}:vertices`).toBeLessThanOrEqual(
        v2Low.mesh.vertices.length
      );
      expect(v25Large.mesh.triangles.length, `${fixture.name}:triangles`).toBeLessThanOrEqual(
        v2Low.mesh.triangles.length
      );
    }
  });

  it("records auto-outline-v2.5 soft-boundary rejection metrics for far transparent triangles", () => {
    const mesh = createAutoOutlineV25SoftBoundaryMesh({
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 0, y: 0, width: 48, height: 40 },
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
      textureSize: { width: 48, height: 40 },
      rgbaBytes: createAlphaBytesFromPredicate(48, 40, (x, y) => {
        const outer = x >= 5 && x <= 42 && y >= 5 && y <= 34;
        const hole = x >= 18 && x <= 30 && y >= 14 && y <= 25;
        return outer && !hole;
      }),
      densityHint: "medium"
    });

    expect(mesh.status).toBe("generated");
    if (mesh.status !== "generated") {
      return;
    }

    expect(mesh.softBoundaryMetrics.outsideTriangleSampleCount).toBe(0);
    expect(mesh.softBoundaryMetrics.farTransparentSampleCount).toBe(0);
    expect(mesh.softBoundaryMetrics.rejectedFarTransparentTriangleCount).toBeGreaterThan(0);
  });

  it("generates deterministic auto-outline-v2.6 soft-apron meshes with bounded apron coverage", () => {
    const alphaPixels = createPixelsFromPredicate(44, 40, (x, y) => {
      const dx = (x - 20.5) / 12;
      const dy = (y - 18.5) / 9;
      const body = dx * dx + dy * dy <= 1;
      const top = x >= 17 && x <= 24 && y >= 5 && y <= 13;
      const tail = x >= 28 && x <= 37 && y >= 16 && y <= 22;
      const notch = x >= 10 && x <= 16 && y >= 22 && y <= 32;
      return (body || top || tail) && !notch;
    });
    const rgbaBytes = createAlphaBytes(44, 40, alphaPixels);
    const baseInput = {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 0, y: 0, width: 44, height: 40 },
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
      textureSize: { width: 44, height: 40 },
      rgbaBytes,
      densityHint: "medium" as const
    };

    const first = createAutoOutlineV26SoftApronMesh(baseInput);
    const second = createAutoOutlineV26SoftApronMesh(baseInput);
    const v25 = createAutoOutlineV25SoftBoundaryMesh(baseInput);

    expect(first).toEqual(second);
    expect(first.status).toBe("generated");
    expect(v25.status).toBe("generated");
    if (first.status !== "generated" || v25.status !== "generated") {
      return;
    }

    expect(first.qualityMetrics.triangulationMode).toBe("interim-delaunay-soft-apron-strip");
    expect(first.softApronMetrics.algorithmId).toBe("auto-outline-v2.6-soft-apron");
    expect(first.softApronMetrics.baseAlgorithmId).toBe("auto-outline-v2.5-soft-boundary");
    expect(first.softApronMetrics.apronRingCount).toBeGreaterThanOrEqual(1);
    expect(first.softApronMetrics.apronRingCount).toBeLessThanOrEqual(2);
    expect(first.softApronMetrics.baseInteriorPointCount).toBe(v25.softBoundaryMetrics.interiorPointCount);
    expect(first.mesh.vertices.length).toBe(v25.mesh.vertices.length + first.softApronMetrics.apronVertexCount);
    expect(first.mesh.triangles.length).toBe(v25.mesh.triangles.length + first.softApronMetrics.apronTriangleCount);
    expect(first.softApronMetrics.apronBoundaryAreaRatio).toBeGreaterThan(
      v25.softBoundaryMetrics.softBoundaryAreaRatio
    );
    expect(first.softApronMetrics.apronBoundaryAreaRatio).toBeLessThan(1.58);
    expect(first.softApronMetrics.triangleCountIncreaseRatio).toBeLessThanOrEqual(4);
    expect(first.softApronMetrics.longApronEdgeCount).toBe(0);
    expect(first.softApronMetrics.skinnyApronTriangleCount).toBe(0);
    expect(first.softApronMetrics.maxApronFanTriangleCount).toBeLessThanOrEqual(4);
    expect(first.softApronMetrics.maxBoundaryToApronEdgeLength).toBeGreaterThan(0);
    expect(first.softApronMetrics.maxBoundaryToApronEdgeLength).toBeLessThanOrEqual(
      first.softApronMetrics.maxApronEdgeLength + 0.000001
    );
    const apronTriangles = first.mesh.triangles.filter((_triangle, triangleIndex) =>
      first.mesh.triangleStableIds?.[triangleIndex]?.includes("_outline_v2_6_soft_apron_ring_")
    );
    expect(apronTriangles.length).toBe(first.softApronMetrics.apronTriangleCount);
    for (const triangle of apronTriangles) {
      expect(
        triangle.every((vertexIndex) => {
          const stableId = first.mesh.vertexStableIds[vertexIndex] ?? "";
          return stableId.includes("_outline_v2_6_soft_apron_inner_boundary_") ||
            stableId.includes("_outline_v2_6_soft_apron_ring_");
        })
      ).toBe(true);
    }
    expect(first.mesh.vertexStableIds.some((id) => id.includes("_outline_v2_6_soft_apron_ring_"))).toBe(true);
    expect(first.qualityMetrics.softApronMetrics).toEqual(first.softApronMetrics);
  });

  it("keeps auto-outline-v2.6 Large Motion apron count increases bounded over V2.5", () => {
    const fixtures = [
      {
        name: "notched-tail",
        width: 44,
        height: 40,
        predicate: (x: number, y: number): boolean => {
          const dx = (x - 20.5) / 12;
          const dy = (y - 18.5) / 9;
          const body = dx * dx + dy * dy <= 1;
          const top = x >= 17 && x <= 24 && y >= 5 && y <= 13;
          const tail = x >= 28 && x <= 37 && y >= 16 && y <= 22;
          const notch = x >= 10 && x <= 16 && y >= 22 && y <= 32;
          return (body || top || tail) && !notch;
        }
      },
      {
        name: "round-body",
        width: 42,
        height: 42,
        predicate: (x: number, y: number): boolean => {
          const dx = x - 20.5;
          const dy = y - 20.5;
          return dx * dx + dy * dy <= 220;
        }
      }
    ];

    for (const fixture of fixtures) {
      const baseInput = {
        meshId: MeshIdSchema.parse("mesh_body"),
        drawableId: DrawableIdSchema.parse("draw_body"),
        bounds: { x: 0, y: 0, width: fixture.width, height: fixture.height },
        provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
        textureSize: { width: fixture.width, height: fixture.height },
        rgbaBytes: createAlphaBytesFromPredicate(fixture.width, fixture.height, fixture.predicate),
        densityHint: "high" as const
      };
      const v25 = createAutoOutlineV25SoftBoundaryMesh(baseInput);
      const v26 = createAutoOutlineV26SoftApronMesh(baseInput);

      expect(v25.status, `${fixture.name}:v2.5-large`).toBe("generated");
      expect(v26.status, `${fixture.name}:v2.6-large`).toBe("generated");
      if (v25.status !== "generated" || v26.status !== "generated") {
        continue;
      }

      expect(v26.softApronMetrics.baseInteriorPointCount, `${fixture.name}:interior`).toBe(
        v25.softBoundaryMetrics.interiorPointCount
      );
      expect(v26.softApronMetrics.triangleCountIncreaseRatio, `${fixture.name}:triangles`).toBeLessThanOrEqual(4);
      expect(v26.softApronMetrics.apronBoundaryAreaRatio, `${fixture.name}:area`).toBeLessThan(1.7);
      expect(v26.softApronMetrics.maxApronFanTriangleCount, `${fixture.name}:fan`).toBeLessThanOrEqual(6);
      expect(v26.softApronMetrics.rejectedLongApronTriangleCount, `${fixture.name}:long-rejected`).toBe(0);
    }
  });

  it("generates deterministic auto-outline-v3 envelope meshes with coarser counts and envelope metrics", () => {
    const alphaPixels = createPixelsFromPredicate(40, 36, (x, y) => {
      const dx = (x - 18.5) / 12;
      const dy = (y - 17.5) / 9;
      const body = dx * dx + dy * dy <= 1;
      const tail = x >= 25 && x <= 34 && y >= 14 && y <= 20;
      const notch = x >= 9 && x <= 16 && y >= 19 && y <= 29;
      return (body || tail) && !notch;
    });
    const rgbaBytes = createAlphaBytes(40, 36, alphaPixels);
    const baseInput = {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 0, y: 0, width: 40, height: 36 },
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
      textureSize: { width: 40, height: 36 },
      rgbaBytes,
      densityHint: "medium" as const
    };

    const first = createAutoOutlineV3EnvelopeMesh(baseInput);
    const second = createAutoOutlineV3EnvelopeMesh(baseInput);
    const v2 = createAutoOutlineV2Mesh(baseInput);

    expect(first).toEqual(second);
    expect(first.status).toBe("generated");
    expect(v2.status).toBe("generated");
    if (first.status !== "generated" || v2.status !== "generated") {
      return;
    }

    expect(first.mesh.vertices.length).toBeLessThanOrEqual(v2.mesh.vertices.length);
    expect(first.mesh.triangles.length).toBeLessThanOrEqual(v2.mesh.triangles.length);
    expect(first.qualityMetrics.triangulationMode).toBe("interim-delaunay-envelope-filter");
    expect(first.envelopeMetrics.algorithmId).toBe("auto-outline-v3-envelope");
    expect(first.envelopeMetrics.envelopeAreaRatio).toBeGreaterThan(1);
    expect(first.envelopeMetrics.transparentSampleCount).toBeGreaterThan(0);
    expect(first.envelopeMetrics.outsideTriangleSampleCount).toBe(0);
    expect(first.envelopeMetrics.supportRingCount).toBeGreaterThanOrEqual(1);
    expect(first.envelopeMetrics.provenance).toContain("constrained-triangulation-deferred");
    expect(first.mesh.vertexStableIds.some((id) => id.includes("_outline_v3_envelope_boundary_"))).toBe(true);
    expect(first.mesh.vertexStableIds.some((id) => id.includes("_outline_v3_envelope_support_0_"))).toBe(true);
    expect(first.qualityMetrics.envelopeMetrics).toEqual(first.envelopeMetrics);

    const independentSamples = countV3EnvelopeSampleClasses(first.mesh, createAlphaSet(alphaPixels));
    expect(independentSamples.outsideEnvelope).toBe(0);
    expect(independentSamples.transparentInsideEnvelope).toBeGreaterThan(0);
  });

  it("keeps auto-outline-v3 envelope counts no greater than v2 across representative fixtures and densities", () => {
    const fixtures = [
      {
        name: "notched-tail",
        width: 40,
        height: 36,
        predicate: (x: number, y: number): boolean => {
          const dx = (x - 18.5) / 12;
          const dy = (y - 17.5) / 9;
          const body = dx * dx + dy * dy <= 1;
          const tail = x >= 25 && x <= 34 && y >= 14 && y <= 20;
          const notch = x >= 9 && x <= 16 && y >= 19 && y <= 29;
          return (body || tail) && !notch;
        }
      },
      {
        name: "round-body",
        width: 40,
        height: 40,
        predicate: (x: number, y: number): boolean => {
          const dx = x - 19.5;
          const dy = y - 19.5;
          return dx * dx + dy * dy <= 210;
        }
      }
    ];
    const densities = ["low", "medium", "high"] as const;

    for (const fixture of fixtures) {
      for (const densityHint of densities) {
        const baseInput = {
          meshId: MeshIdSchema.parse("mesh_body"),
          drawableId: DrawableIdSchema.parse("draw_body"),
          bounds: { x: 0, y: 0, width: fixture.width, height: fixture.height },
          provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
          textureSize: { width: fixture.width, height: fixture.height },
          rgbaBytes: createAlphaBytesFromPredicate(fixture.width, fixture.height, fixture.predicate),
          densityHint
        };
        const v2 = createAutoOutlineV2Mesh(baseInput);
        const v3 = createAutoOutlineV3EnvelopeMesh(baseInput);

        expect(v2.status, `${fixture.name}:${densityHint}:v2`).toBe("generated");
        expect(v3.status, `${fixture.name}:${densityHint}:v3`).toBe("generated");
        if (v2.status !== "generated" || v3.status !== "generated") {
          continue;
        }

        expect(v3.mesh.vertices.length, `${fixture.name}:${densityHint}:vertices`).toBeLessThanOrEqual(
          v2.mesh.vertices.length
        );
        expect(v3.mesh.triangles.length, `${fixture.name}:${densityHint}:triangles`).toBeLessThanOrEqual(
          v2.mesh.triangles.length
        );
      }
    }
  });

  it("generates deterministic auto-outline-v4 contour-band meshes with bounded band metrics", () => {
    const alphaPixels = createPixelsFromPredicate(52, 46, (x, y) => {
      const dx = (x - 24.5) / 14;
      const dy = (y - 21.5) / 10;
      const body = dx * dx + dy * dy <= 1;
      const top = x >= 21 && x <= 29 && y >= 6 && y <= 14;
      const tail = x >= 32 && x <= 44 && y >= 18 && y <= 25;
      const notch = x >= 12 && x <= 19 && y >= 25 && y <= 36;
      return (body || top || tail) && !notch;
    });
    const rgbaBytes = createAlphaBytes(52, 46, alphaPixels);
    const baseInput = {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 0, y: 0, width: 52, height: 46 },
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
      textureSize: { width: 52, height: 46 },
      rgbaBytes,
      densityHint: "medium" as const
    };

    const first = createAutoOutlineV4ContourBandMesh(baseInput);
    const second = createAutoOutlineV4ContourBandMesh(baseInput);

    expect(first).toEqual(second);
    expect(first.status).toBe("generated");
    if (first.status !== "generated") {
      return;
    }

    expect(first.qualityMetrics.triangulationMode).toBe("interim-delaunay-contour-band-strip");
    expect(first.contourBandMetrics.algorithmId).toBe("auto-outline-v4-contour-band");
    expect(first.contourBandMetrics.contourPointCount).toBeGreaterThan(0);
    expect(first.contourBandMetrics.outerContourPointCount).toBe(first.contourBandMetrics.contourPointCount);
    expect(first.contourBandMetrics.contourBandTriangleCount).toBeGreaterThan(0);
    expect(first.contourBandMetrics.interiorPointCount).toBeGreaterThan(0);
    expect(first.contourBandMetrics.interiorTriangleCount).toBeGreaterThan(0);
    expect(first.contourBandMetrics.outerContourAreaRatio).toBeGreaterThan(1);
    expect(first.contourBandMetrics.outerContourAreaRatio).toBeLessThan(1.58);
    expect(first.contourBandMetrics.maxBoundaryToInteriorEdgeLength).toBeLessThanOrEqual(
      first.contourBandMetrics.targetEdgeLength * 2 + 0.000001
    );
    expect(first.contourBandMetrics.maxVertexValence).toBeLessThanOrEqual(12);
    expect(first.contourBandMetrics.transparentOnlyTriangleRatio).toBeLessThanOrEqual(0.08);
    expect(first.contourBandMetrics.vertexCount).toBeLessThanOrEqual(first.contourBandMetrics.maxVertexCountCap);
    expect(first.mesh.vertexStableIds.some((id) => id.includes("_outline_v4_contour_band_outer_contour_"))).toBe(true);
    expect(first.mesh.vertexStableIds.some((id) => id.includes("_outline_v4_contour_band_inner_contour_"))).toBe(true);
    expect(first.mesh.vertexStableIds.some((id) => id.includes("_outline_v4_contour_band_interior_"))).toBe(true);
    expect(first.qualityMetrics.contourBandMetrics).toEqual(first.contourBandMetrics);
  });

  it("uses denser auto-outline-v4 contour-band presets without exceeding vertex caps", () => {
    const baseInput = {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 0, y: 0, width: 54, height: 50 },
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_body"),
      textureSize: { width: 54, height: 50 },
      rgbaBytes: createAlphaBytesFromPredicate(54, 50, (x, y) => {
        const dx = (x - 26.5) / 16;
        const dy = (y - 24.5) / 13;
        const body = dx * dx + dy * dy <= 1;
        const sweep = x >= 35 && x <= 47 && y >= 21 && y <= 28;
        return body || sweep;
      })
    };

    const large = createAutoOutlineV4ContourBandMesh({ ...baseInput, densityHint: "high" });
    const standard = createAutoOutlineV4ContourBandMesh({ ...baseInput, densityHint: "medium" });
    const low = createAutoOutlineV4ContourBandMesh({ ...baseInput, densityHint: "low" });

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
    for (const result of [large, standard, low]) {
      expect(result.contourBandMetrics.vertexCount).toBeLessThanOrEqual(result.contourBandMetrics.maxVertexCountCap);
      expect(result.contourBandMetrics.transparentOnlyTriangleRatio).toBeLessThanOrEqual(0.08);
      expect(result.contourBandMetrics.maxVertexValence).toBeLessThanOrEqual(12);
    }
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

    const v25Fallback = createGeneratedMeshForDrawable({
      session: emptyAlphaSession,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v2.5-soft-boundary",
      densityHint: "low"
    });

    expect(v25Fallback?.source).toBe("bounds-grid");
    expect(v25Fallback?.fallbackReason).toBe("alpha-empty");
    expect(v25Fallback?.fallbackSteps).toEqual([
      { method: "auto-outline-v2.5-soft-boundary", reason: "alpha-empty" },
      { method: "auto-outline-v2", reason: "alpha-empty" },
      { method: "auto-outline-v1", reason: "alpha-empty" }
    ]);
    expect(v25Fallback?.mesh.vertices).toHaveLength(4);

    const v26Fallback = createGeneratedMeshForDrawable({
      session: emptyAlphaSession,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v2.6-soft-apron",
      densityHint: "low"
    });

    expect(v26Fallback?.source).toBe("bounds-grid");
    expect(v26Fallback?.fallbackReason).toBe("alpha-empty");
    expect(v26Fallback?.fallbackSteps).toEqual([
      { method: "auto-outline-v2.6-soft-apron", reason: "alpha-empty" },
      { method: "auto-outline-v2.5-soft-boundary", reason: "alpha-empty" },
      { method: "auto-outline-v2", reason: "alpha-empty" },
      { method: "auto-outline-v1", reason: "alpha-empty" }
    ]);
    expect(v26Fallback?.mesh.vertices).toHaveLength(4);

    const v4Fallback = createGeneratedMeshForDrawable({
      session: emptyAlphaSession,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v4-contour-band",
      densityHint: "low"
    });

    expect(v4Fallback?.source).toBe("bounds-grid");
    expect(v4Fallback?.fallbackReason).toBe("alpha-empty");
    expect(v4Fallback?.fallbackSteps).toEqual([
      { method: "auto-outline-v4-contour-band", reason: "alpha-empty" },
      { method: "auto-outline-v2.6-soft-apron", reason: "alpha-empty" },
      { method: "auto-outline-v2.5-soft-boundary", reason: "alpha-empty" },
      { method: "auto-outline-v2", reason: "alpha-empty" },
      { method: "auto-outline-v1", reason: "alpha-empty" }
    ]);
    expect(v4Fallback?.mesh.vertices).toHaveLength(4);

    const v3Fallback = createGeneratedMeshForDrawable({
      session: emptyAlphaSession,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v3-envelope",
      densityHint: "low"
    });

    expect(v3Fallback?.source).toBe("bounds-grid");
    expect(v3Fallback?.fallbackReason).toBe("alpha-empty");
    expect(v3Fallback?.fallbackSteps).toEqual([
      { method: "auto-outline-v3-envelope", reason: "alpha-empty" },
      { method: "auto-outline-v2", reason: "alpha-empty" },
      { method: "auto-outline-v1", reason: "alpha-empty" }
    ]);
    expect(v3Fallback?.mesh.vertices).toHaveLength(4);
  });

  it("falls back from a v3-specific envelope failure to a generated v2 mesh", () => {
    const opaquePixels = createPixelsFromPredicate(20, 20, (x, y) => x >= 5 && x <= 7 && y >= 5 && y <= 8);
    const directInput = {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 0, y: 0, width: 20, height: 20 },
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      textureSize: { width: 20, height: 20 },
      rgbaBytes: createAlphaBytes(20, 20, opaquePixels),
      densityHint: "high" as const
    };
    const v3 = createAutoOutlineV3EnvelopeMesh(directInput);
    const v2 = createAutoOutlineV2Mesh(directInput);

    expect(v3).toMatchObject({ status: "failed", reason: "envelope-generation-failed" });
    expect(v2.status).toBe("generated");

    const session = createFixtureSession({
      includeBytes: true,
      textureSize: { width: 20, height: 20 },
      meshBounds: { x: 0, y: 0, width: 20, height: 20 },
      opaquePixels
    });

    const generated = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v3-envelope",
      densityHint: "high"
    });

    expect(generated?.source).toBe("outline-v2-rgba");
    expect(generated?.fallbackReason).toBe("envelope-generation-failed");
    expect(generated?.fallbackSteps).toEqual([
      { method: "auto-outline-v3-envelope", reason: "envelope-generation-failed" }
    ]);
    expect(generated?.qualityMetrics).toMatchObject({
      fallbackReason: "envelope-generation-failed",
      triangulationMode: "interim-delaunay-alpha-filter"
    });
    expect(generated?.mesh.vertexStableIds.some((id) => id.includes("_outline_v2_"))).toBe(true);
  });

  it("falls back from a v2.5 soft-boundary failure to a generated v2 mesh", () => {
    const opaquePixels = createPixelsFromPredicate(20, 20, (x, y) => x >= 5 && x <= 7 && y >= 5 && y <= 8);
    const directInput = {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: { x: 0, y: 0, width: 20, height: 20 },
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      textureSize: { width: 20, height: 20 },
      rgbaBytes: createAlphaBytes(20, 20, opaquePixels),
      densityHint: "high" as const
    };
    const v25 = createAutoOutlineV25SoftBoundaryMesh(directInput);
    const v2 = createAutoOutlineV2Mesh(directInput);

    expect(v25).toMatchObject({ status: "failed", reason: "soft-boundary-generation-failed" });
    expect(v2.status).toBe("generated");

    const session = createFixtureSession({
      includeBytes: true,
      textureSize: { width: 20, height: 20 },
      meshBounds: { x: 0, y: 0, width: 20, height: 20 },
      opaquePixels
    });

    const generated = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v2.5-soft-boundary",
      densityHint: "high"
    });

    expect(generated?.source).toBe("outline-v2-rgba");
    expect(generated?.fallbackReason).toBe("soft-boundary-generation-failed");
    expect(generated?.fallbackSteps).toEqual([
      { method: "auto-outline-v2.5-soft-boundary", reason: "soft-boundary-generation-failed" }
    ]);
    expect(generated?.qualityMetrics).toMatchObject({
      fallbackReason: "soft-boundary-generation-failed",
      triangulationMode: "interim-delaunay-alpha-filter"
    });
    expect(generated?.mesh.vertexStableIds.some((id) => id.includes("_outline_v2_"))).toBe(true);
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

  it("routes auto-outline-v2.5-soft-boundary as an explicit drawable generation sidecar with soft-boundary summary", () => {
    const session = createFixtureSession({
      includeBytes: true,
      textureSize: { width: 40, height: 36 },
      meshBounds: { x: 10, y: 20, width: 40, height: 36 },
      opaquePixels: createPixelsFromPredicate(40, 36, (x, y) => {
        const dx = (x - 18.5) / 12;
        const dy = (y - 17.5) / 9;
        const body = dx * dx + dy * dy <= 1;
        const tail = x >= 25 && x <= 34 && y >= 14 && y <= 20;
        const notch = x >= 9 && x <= 16 && y >= 19 && y <= 29;
        return (body || tail) && !notch;
      })
    });

    const generated = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v2.5-soft-boundary",
      densityHint: "medium"
    });

    expect(generated?.source).toBe("outline-v2-5-soft-boundary-rgba");
    expect(generated?.fallbackReason).toBeUndefined();
    expect(generated?.qualityMetrics).toMatchObject({
      triangulationMode: "interim-delaunay-soft-boundary-filter",
      softBoundaryMetrics: {
        algorithmId: "auto-outline-v2.5-soft-boundary",
        outsideTriangleSampleCount: 0,
        farTransparentSampleCount: 0
      }
    });
    expect(generated?.qualityMetrics?.softBoundaryMetrics?.transparentSampleCount).toBeGreaterThan(0);
  });

  it("routes auto-outline-v2.6-soft-apron as an explicit drawable generation sidecar with apron summary", () => {
    const session = createFixtureSession({
      includeBytes: true,
      textureSize: { width: 44, height: 40 },
      meshBounds: { x: 10, y: 20, width: 44, height: 40 },
      opaquePixels: createPixelsFromPredicate(44, 40, (x, y) => {
        const dx = (x - 20.5) / 12;
        const dy = (y - 18.5) / 9;
        const body = dx * dx + dy * dy <= 1;
        const top = x >= 17 && x <= 24 && y >= 5 && y <= 13;
        const tail = x >= 28 && x <= 37 && y >= 16 && y <= 22;
        const notch = x >= 10 && x <= 16 && y >= 22 && y <= 32;
        return (body || top || tail) && !notch;
      })
    });

    const generated = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v2.6-soft-apron",
      densityHint: "medium"
    });

    expect(generated?.source).toBe("outline-v2-6-soft-apron-rgba");
    expect(generated?.fallbackReason).toBeUndefined();
    expect(generated?.qualityMetrics).toMatchObject({
      triangulationMode: "interim-delaunay-soft-apron-strip",
      softApronMetrics: {
        algorithmId: "auto-outline-v2.6-soft-apron",
        baseAlgorithmId: "auto-outline-v2.5-soft-boundary",
        longApronEdgeCount: 0,
        skinnyApronTriangleCount: 0
      }
    });
    expect(generated?.qualityMetrics?.softApronMetrics?.apronTriangleCount).toBeGreaterThan(0);
  });

  it("routes auto-outline-v4-contour-band as an explicit drawable generation sidecar with contour-band summary", () => {
    const session = createFixtureSession({
      includeBytes: true,
      textureSize: { width: 52, height: 46 },
      meshBounds: { x: 10, y: 20, width: 52, height: 46 },
      opaquePixels: createPixelsFromPredicate(52, 46, (x, y) => {
        const dx = (x - 24.5) / 14;
        const dy = (y - 21.5) / 10;
        const body = dx * dx + dy * dy <= 1;
        const top = x >= 21 && x <= 29 && y >= 6 && y <= 14;
        const tail = x >= 32 && x <= 44 && y >= 18 && y <= 25;
        const notch = x >= 12 && x <= 19 && y >= 25 && y <= 36;
        return (body || top || tail) && !notch;
      })
    });

    const generated = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v4-contour-band",
      densityHint: "medium"
    });

    expect(generated?.source).toBe("outline-v4-contour-band-rgba");
    expect(generated?.fallbackReason).toBeUndefined();
    expect(generated?.qualityMetrics).toMatchObject({
      triangulationMode: "interim-delaunay-contour-band-strip",
      contourBandMetrics: {
        algorithmId: "auto-outline-v4-contour-band"
      }
    });
    expect(generated?.qualityMetrics?.contourBandMetrics?.contourBandTriangleCount).toBeGreaterThan(0);
    expect(generated?.qualityMetrics?.contourBandMetrics?.interiorPointCount).toBeGreaterThan(0);
    expect(generated?.qualityMetrics?.contourBandMetrics?.transparentOnlyTriangleRatio).toBeLessThanOrEqual(0.08);
  });

  it("provides shared v6 fixture helpers without exact triangle-layout expectations", () => {
    expect(V6_MESH_GENERATION_CONTRACT_FIXTURE_IDS).toEqual([
      "v6-simple-rectangle",
      "v6-curved-blob",
      "v6-thin-tapered",
      "v6-hole-like",
      "v6-empty-alpha-fallback"
    ]);
    expect(V6_MESH_GENERATION_DEPENDENCY_PACKAGE_IDS).toEqual([
      "@kninnug/constrainautor",
      "d3-contour",
      "delaunator",
      "poly2tri",
      "simplify-js"
    ]);
    expect(V6_MESH_GENERATION_CANDIDATES).toEqual([
      {
        methodId: "auto-outline-v6a-local",
        sourceId: "outline-v6a-local-rgba",
        backendId: "v6a-local",
        dependencyGateStatus: "not-required",
        dependencyPackageIds: [],
        backendImplementationStatus: "implemented"
      },
      {
        methodId: "auto-outline-v6b-constrainautor",
        sourceId: "outline-v6b-constrainautor-rgba",
        backendId: "v6b-constrainautor",
        dependencyGateStatus: "available",
        dependencyPackageIds: ["d3-contour", "simplify-js", "delaunator", "@kninnug/constrainautor"],
        backendImplementationStatus: "implemented"
      },
      {
        methodId: "auto-outline-v6c-poly2tri",
        sourceId: "outline-v6c-poly2tri-rgba",
        backendId: "v6c-poly2tri",
        dependencyGateStatus: "available",
        dependencyPackageIds: ["d3-contour", "simplify-js", "poly2tri"],
        backendImplementationStatus: "implemented"
      }
    ]);

    for (const fixture of V6_MESH_GENERATION_CONTRACT_FIXTURES) {
      const bytes = createV6MeshGenerationFixtureRgbaBytes(fixture);

      expect(bytes.byteLength).toBe(fixture.textureSize.width * fixture.textureSize.height * 4);
      expect(fixture.meshBounds).toMatchObject({
        width: fixture.textureSize.width,
        height: fixture.textureSize.height
      });
      expect(fixture.opaquePixels.length > 0).toBe(fixture.expectedAlphaState === "non-empty");
      expect(fixture.expectedShapeFeatures.length).toBeGreaterThan(0);
    }
  });

  it("generates deterministic auto-outline-v6a-local backend meshes from representative alpha fixtures", () => {
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
        opaquePixels: fixture.opaquePixels
      });
      const baseInput = {
        session,
        drawableId: DrawableIdSchema.parse("draw_body"),
        provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
        method: "auto-outline-v6a-local" as const,
        densityHint: "medium" as const
      };

      const first = createGeneratedMeshForDrawable(baseInput);
      const second = createGeneratedMeshForDrawable(baseInput);

      expect(first).toEqual(second);
      expect(first?.source).toBe("outline-v6a-local-rgba");
      expect(first?.fallbackReason, fixtureId).toBeUndefined();
      expect(first?.fallbackSteps, fixtureId).toBeUndefined();
      expectValidMeshDto(first?.mesh, {
        meshId: MeshIdSchema.parse("mesh_body"),
        drawableId: baseInput.drawableId,
        generationProvenanceId: baseInput.provenanceId,
        bounds: fixture.meshBounds
      });
      expect(first?.alphaBounds).toBeDefined();
      if (first?.alphaBounds !== undefined) {
        expectRectInsideBounds(first.alphaBounds, fixture.meshBounds);
      }
      expect(first?.mesh.vertices.length).toBeGreaterThan(0);
      expect(first?.mesh.triangles.length).toBeGreaterThan(0);
      expect(first?.qualityMetrics).toMatchObject({
        triangulationMode: "v6a-local-earclip-steiner-approximation",
        v6Metrics: {
          algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
          methodId: "auto-outline-v6a-local",
          backendId: "v6a-local",
          backendImplementationStatus: "implemented",
          requestedSourceId: "outline-v6a-local-rgba",
          actualSourceId: "outline-v6a-local-rgba",
          outputKind: "backend-output",
          preset: "medium",
          fallbackSteps: [],
          alphaBoundsAvailable: true,
          opaquePixelCount: fixture.opaquePixels.length
        }
      });
      expect(first?.qualityMetrics?.v6Metrics?.fallbackReason).toBeUndefined();
      expect(first?.qualityMetrics?.v6Metrics?.vertexCount).toBe(first?.mesh.vertices.length);
      expect(first?.qualityMetrics?.v6Metrics?.triangleCount).toBe(first?.mesh.triangles.length);
      expect(first?.qualityMetrics?.v6Metrics?.boundaryVertexCount).toBeGreaterThan(0);
      expect(first?.qualityMetrics?.v6Metrics?.interiorVertexCount).toBeGreaterThan(0);
      expect(first?.qualityMetrics?.v6Metrics?.provenance).toContain(
        "limitation-not-full-constrained-delaunay"
      );

      if (fixtureId === "v6-hole-like") {
        expect(first?.qualityMetrics?.v6Metrics?.holeLikeRegionCount).toBeGreaterThan(0);
        expect(first?.qualityMetrics?.v6Metrics?.holeHandling).toBe("unsupported-fallback");
      } else {
        expect(first?.qualityMetrics?.v6Metrics?.holeHandling).toBe("supported");
      }
    }
  });

  it("uses denser auto-outline-v6a-local presets for Large Motion than Standard or Low Motion", () => {
    const fixture = getV6MeshGenerationContractFixture("v6-curved-blob");
    const session = createFixtureSession({
      includeBytes: true,
      textureSize: fixture.textureSize,
      meshBounds: fixture.meshBounds,
      opaquePixels: fixture.opaquePixels
    });
    const baseInput = {
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6a-local" as const
    };
    const large = createGeneratedMeshForDrawable({ ...baseInput, densityHint: "high" });
    const standard = createGeneratedMeshForDrawable({ ...baseInput, densityHint: "medium" });
    const low = createGeneratedMeshForDrawable({ ...baseInput, densityHint: "low" });

    expect(large?.source).toBe("outline-v6a-local-rgba");
    expect(standard?.source).toBe("outline-v6a-local-rgba");
    expect(low?.source).toBe("outline-v6a-local-rgba");
    expect(large?.fallbackReason).toBeUndefined();
    expect(standard?.fallbackReason).toBeUndefined();
    expect(low?.fallbackReason).toBeUndefined();
    expect(large?.qualityMetrics?.v6Metrics?.boundaryVertexCount).toBeGreaterThan(
      standard?.qualityMetrics?.v6Metrics?.boundaryVertexCount ?? 0
    );
    expect(standard?.qualityMetrics?.v6Metrics?.boundaryVertexCount).toBeGreaterThan(
      low?.qualityMetrics?.v6Metrics?.boundaryVertexCount ?? 0
    );
    expect(large?.qualityMetrics?.v6Metrics?.interiorVertexCount).toBeGreaterThanOrEqual(
      standard?.qualityMetrics?.v6Metrics?.interiorVertexCount ?? 0
    );
    expect(standard?.qualityMetrics?.v6Metrics?.interiorVertexCount).toBeGreaterThanOrEqual(
      low?.qualityMetrics?.v6Metrics?.interiorVertexCount ?? 0
    );
    expect(large?.mesh.vertices.length).toBeGreaterThan(standard?.mesh.vertices.length ?? 0);
    expect(standard?.mesh.vertices.length).toBeGreaterThan(low?.mesh.vertices.length ?? 0);
    expect(large?.mesh.triangles.length).toBeGreaterThan(standard?.mesh.triangles.length ?? 0);
    expect(standard?.mesh.triangles.length).toBeGreaterThan(low?.mesh.triangles.length ?? 0);
  });

  it("generates deterministic auto-outline-v6b-constrainautor meshes with preserved boundary constraints", () => {
    for (const fixtureId of ["v6-simple-rectangle", "v6-curved-blob"] as const) {
      const fixture = getV6MeshGenerationContractFixture(fixtureId);
      const session = createFixtureSession({
        includeBytes: true,
        textureSize: fixture.textureSize,
        meshBounds: fixture.meshBounds,
        opaquePixels: fixture.opaquePixels
      });
      const baseInput = {
        session,
        drawableId: DrawableIdSchema.parse("draw_body"),
        provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
        method: "auto-outline-v6b-constrainautor" as const,
        densityHint: "medium" as const
      };

      const first = createGeneratedMeshForDrawable(baseInput);
      const second = createGeneratedMeshForDrawable(baseInput);

      expect(first).toEqual(second);
      expect(first?.source, fixtureId).toBe("outline-v6b-constrainautor-rgba");
      expect(first?.fallbackReason, fixtureId).toBeUndefined();
      expect(first?.fallbackSteps, fixtureId).toBeUndefined();
      expectValidMeshDto(first?.mesh, {
        meshId: MeshIdSchema.parse("mesh_body"),
        drawableId: baseInput.drawableId,
        generationProvenanceId: baseInput.provenanceId,
        bounds: fixture.meshBounds
      });
      expect(first?.alphaBounds).toBeDefined();
      if (first?.alphaBounds !== undefined) {
        expectRectInsideBounds(first.alphaBounds, fixture.meshBounds);
      }
      expect(first?.qualityMetrics).toMatchObject({
        triangulationMode: "v6b-delaunator-constrainautor",
        v6Metrics: {
          algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
          methodId: "auto-outline-v6b-constrainautor",
          backendId: "v6b-constrainautor",
          backendImplementationStatus: "implemented",
          requestedSourceId: "outline-v6b-constrainautor-rgba",
          actualSourceId: "outline-v6b-constrainautor-rgba",
          outputKind: "backend-output",
          preset: "medium",
          fallbackSteps: [],
          alphaBoundsAvailable: true,
          opaquePixelCount: fixture.opaquePixels.length,
          constrainautorDiagnostics: {
            dependencyGateStatus: "available",
            missingConstraintEdgeCount: 0,
            constraintRecoveryFailed: false
          }
        }
      });
      const v6Metrics = first?.qualityMetrics?.v6Metrics;
      const diagnostics = v6Metrics?.constrainautorDiagnostics;
      expect(v6Metrics?.fallbackReason).toBeUndefined();
      expect(v6Metrics?.vertexCount).toBe(first?.mesh.vertices.length);
      expect(v6Metrics?.triangleCount).toBe(first?.mesh.triangles.length);
      expect(v6Metrics?.boundaryVertexCount).toBeGreaterThan(0);
      expect(v6Metrics?.interiorVertexCount).toBeGreaterThan(0);
      expect(v6Metrics?.provenance).toContain("v6b-boundary-constraints-verified");
      expect(diagnostics?.constraintEdgeCount).toBeGreaterThan(2);
      expect(diagnostics?.preservedConstraintEdgeCount).toBe(diagnostics?.constraintEdgeCount);
      expect(diagnostics?.outsideTriangleCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles auto-outline-v6b-constrainautor thin tapered fixtures deterministically without fake backend success", () => {
    const fixture = getV6MeshGenerationContractFixture("v6-thin-tapered");
    const session = createFixtureSession({
      includeBytes: true,
      textureSize: fixture.textureSize,
      meshBounds: fixture.meshBounds,
      opaquePixels: fixture.opaquePixels
    });
    const baseInput = {
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6b-constrainautor" as const,
      densityHint: "medium" as const
    };

    const first = createGeneratedMeshForDrawable(baseInput);
    const second = createGeneratedMeshForDrawable(baseInput);

    expect(first).toEqual(second);
    expectValidMeshDto(first?.mesh, {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: baseInput.drawableId,
      generationProvenanceId: baseInput.provenanceId,
      bounds: fixture.meshBounds
    });
    const v6Metrics = first?.qualityMetrics?.v6Metrics;
    const diagnostics = v6Metrics?.constrainautorDiagnostics;
    expect(v6Metrics).toMatchObject({
      methodId: "auto-outline-v6b-constrainautor",
      backendId: "v6b-constrainautor",
      backendImplementationStatus: "implemented",
      requestedSourceId: "outline-v6b-constrainautor-rgba",
      alphaBoundsAvailable: true,
      opaquePixelCount: fixture.opaquePixels.length
    });
    expect(diagnostics?.dependencyGateStatus).toBe("available");

    if (first?.source === "outline-v6b-constrainautor-rgba") {
      expect(first.fallbackReason).toBeUndefined();
      expect(first.fallbackSteps).toBeUndefined();
      expect(v6Metrics?.outputKind).toBe("backend-output");
      expect(v6Metrics?.actualSourceId).toBe("outline-v6b-constrainautor-rgba");
      expect(v6Metrics?.provenance).toContain("v6b-boundary-constraints-verified");
      expect(diagnostics?.constraintEdgeCount).toBeGreaterThan(2);
      expect(diagnostics?.missingConstraintEdgeCount).toBe(0);
      expect(diagnostics?.preservedConstraintEdgeCount).toBe(diagnostics?.constraintEdgeCount);
      return;
    }

    const fallbackReason = first?.fallbackReason;
    expect(first?.source).toBe("alpha-aware-rgba");
    expect(fallbackReason).toMatch(/^v6b-/);
    if (fallbackReason !== undefined) {
      expect(first?.fallbackSteps).toEqual([
        { method: "auto-outline-v6b-constrainautor", reason: fallbackReason }
      ]);
    }
    expect(v6Metrics?.outputKind).toBe("fallback-output");
    expect(v6Metrics?.actualSourceId).toBe("alpha-aware-rgba");
    expect(v6Metrics?.provenance).toContain("v6b-visible-fallback");
    expect(v6Metrics?.provenance).not.toContain("v6b-boundary-constraints-verified");
    expect(diagnostics?.constraintRecoveryFailed).toBe(true);
  });

  it("reports auto-outline-v6b-constrainautor hole limitations as visible fallback metadata", () => {
    const fixture = getV6MeshGenerationContractFixture("v6-hole-like");
    const session = createFixtureSession({
      includeBytes: true,
      textureSize: fixture.textureSize,
      meshBounds: fixture.meshBounds,
      opaquePixels: fixture.opaquePixels
    });

    const generated = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6b-constrainautor",
      densityHint: "medium"
    });

    expect(generated?.source).toBe("alpha-aware-rgba");
    expect(generated?.fallbackReason).toBe("v6b-unsupported-hole-region");
    expect(generated?.fallbackSteps).toEqual([
      { method: "auto-outline-v6b-constrainautor", reason: "v6b-unsupported-hole-region" }
    ]);
    expectValidMeshDto(generated?.mesh, {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      generationProvenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      bounds: fixture.meshBounds
    });
    expect(generated?.qualityMetrics).toMatchObject({
      fallbackReason: "v6b-unsupported-hole-region",
      triangulationMode: "v6-backend-blocked-fallback",
      v6Metrics: {
        methodId: "auto-outline-v6b-constrainautor",
        backendId: "v6b-constrainautor",
        backendImplementationStatus: "implemented",
        requestedSourceId: "outline-v6b-constrainautor-rgba",
        actualSourceId: "alpha-aware-rgba",
        outputKind: "fallback-output",
        fallbackReason: "v6b-unsupported-hole-region",
        fallbackSteps: [
          { method: "auto-outline-v6b-constrainautor", reason: "v6b-unsupported-hole-region" }
        ],
        holeHandling: "unsupported-fallback",
        constrainautorDiagnostics: {
          dependencyGateStatus: "available",
          constraintRecoveryFailed: true
        }
      }
    });
    const diagnostics = generated?.qualityMetrics?.v6Metrics?.constrainautorDiagnostics;
    expect(diagnostics?.constraintEdgeCount).toBeGreaterThan(2);
    expect(diagnostics?.missingConstraintEdgeCount).toBe(diagnostics?.constraintEdgeCount);
  });

  it("validates v6b duplicate, zero-length, and crossing constraints before triangulation", () => {
    const duplicateZeroLength = recoverV6BConstrainautorTriangles({
      points: [
        { x: 0, y: 0, role: "boundary", stableOrder: 0 },
        { x: 1, y: 0, role: "boundary", stableOrder: 1 },
        { x: 1, y: 0, role: "boundary", stableOrder: 2 },
        { x: 0, y: 1, role: "boundary", stableOrder: 3 }
      ],
      constraintEdges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0]
      ]
    });
    const crossing = recoverV6BConstrainautorTriangles({
      points: [
        { x: 0, y: 0, role: "boundary", stableOrder: 0 },
        { x: 1, y: 0, role: "boundary", stableOrder: 1 },
        { x: 1, y: 1, role: "boundary", stableOrder: 2 },
        { x: 0, y: 1, role: "boundary", stableOrder: 3 }
      ],
      constraintEdges: [
        [0, 2],
        [1, 3]
      ]
    });

    expect(duplicateZeroLength.status).toBe("failed");
    expect(duplicateZeroLength).toMatchObject({
      reason: "v6b-invalid-constraints"
    });
    expect(duplicateZeroLength.diagnostics).toMatchObject({
      dependencyGateStatus: "available",
      constraintRecoveryFailed: true
    });
    expect(crossing.status).toBe("failed");
    expect(crossing).toMatchObject({
      reason: "v6b-invalid-constraints"
    });
    expect(crossing.diagnostics).toMatchObject({
      dependencyGateStatus: "available",
      constraintEdgeCount: 2,
      missingConstraintEdgeCount: 2,
      constraintRecoveryFailed: true
    });
  });

  it("recovers or reports structured failure for v6b near-collinear boundary spans", () => {
    const nearCollinear = recoverV6BConstrainautorTriangles({
      points: [
        { x: 0, y: 0, role: "boundary", stableOrder: 0 },
        { x: 1, y: 0.000004, role: "boundary", stableOrder: 1 },
        { x: 2, y: 0.000009, role: "boundary", stableOrder: 2 },
        { x: 3, y: 0.08, role: "boundary", stableOrder: 3 },
        { x: 3, y: 1, role: "boundary", stableOrder: 4 },
        { x: 0, y: 1, role: "boundary", stableOrder: 5 },
        { x: 1.4, y: 0.45, role: "interior", stableOrder: 0 }
      ],
      constraintEdges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 0]
      ]
    });

    expect(nearCollinear.diagnostics.dependencyGateStatus).toBe("available");
    expect(nearCollinear.diagnostics.constraintEdgeCount).toBeGreaterThan(2);
    if (nearCollinear.status === "generated") {
      expect(nearCollinear.diagnostics.constraintRecoveryFailed).toBe(false);
      expect(nearCollinear.diagnostics.missingConstraintEdgeCount).toBe(0);
      expect(nearCollinear.diagnostics.preservedConstraintEdgeCount).toBe(
        nearCollinear.diagnostics.constraintEdgeCount
      );
      expect(nearCollinear.triangles.length).toBeGreaterThan(0);
      return;
    }

    expect([
      "v6b-invalid-constraints",
      "v6b-constraint-recovery-failed",
      "v6b-backend-threw"
    ]).toContain(nearCollinear.reason);
    expect(nearCollinear.diagnostics.constraintRecoveryFailed).toBe(true);
  });

  it("reports near-duplicate v6b points after quantization as structured invalid constraints", () => {
    const nearDuplicateAfterQuantization = recoverV6BConstrainautorTriangles({
      points: [
        { x: 0, y: 0, role: "boundary", stableOrder: 0 },
        { x: 0.0000004, y: 0.0000004, role: "boundary", stableOrder: 1 },
        { x: 1, y: 0, role: "boundary", stableOrder: 2 },
        { x: 0, y: 1, role: "boundary", stableOrder: 3 }
      ],
      constraintEdges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0]
      ]
    });

    expect(nearDuplicateAfterQuantization.status).toBe("failed");
    expect(nearDuplicateAfterQuantization).toMatchObject({
      reason: "v6b-invalid-constraints",
      diagnostics: {
        dependencyGateStatus: "available",
        constraintRecoveryFailed: true
      }
    });
    expect(nearDuplicateAfterQuantization.diagnostics.constraintEdgeCount).toBeGreaterThan(2);
    expect(nearDuplicateAfterQuantization.diagnostics.missingConstraintEdgeCount).toBe(
      nearDuplicateAfterQuantization.diagnostics.constraintEdgeCount
    );
  });

  it("records v6b retry provenance for retry success and retry fallback probes", () => {
    const invalidRecoveryInput = {
      points: [
        { x: 0, y: 0, role: "boundary", stableOrder: 0 },
        { x: 4, y: 0, role: "boundary", stableOrder: 1 },
        { x: 4, y: 4, role: "boundary", stableOrder: 2 },
        { x: 0, y: 4, role: "boundary", stableOrder: 3 }
      ],
      constraintEdges: [
        [0, 2],
        [1, 3]
      ]
    } as const;
    const validRecoveryInput = {
      points: [
        { x: 1, y: 1, role: "boundary", stableOrder: 0 },
        { x: 6, y: 1, role: "boundary", stableOrder: 1 },
        { x: 6, y: 6, role: "boundary", stableOrder: 2 },
        { x: 1, y: 6, role: "boundary", stableOrder: 3 },
        { x: 3.5, y: 3.5, role: "interior", stableOrder: 0 }
      ],
      constraintEdges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0]
      ]
    } as const;

    const retrySuccess = probeAutoOutlineV6BConstrainautorRetryForTest({
      width: 8,
      height: 8,
      attempts: [
        { recoveryInput: invalidRecoveryInput },
        {
          recoveryInput: validRecoveryInput,
          retryProvenance: ["v6b-retry-coarser-boundary"]
        },
        {
          recoveryInput: validRecoveryInput,
          retryProvenance: ["v6b-retry-fewer-interior-points"]
        }
      ]
    });

    expect(retrySuccess).toMatchObject({
      outputKind: "backend-output",
      attemptCount: 2,
      diagnostics: {
        dependencyGateStatus: "available",
        constraintRecoveryFailed: false,
        missingConstraintEdgeCount: 0
      }
    });
    expect(retrySuccess.triangleCount).toBeGreaterThan(0);
    expect(retrySuccess.provenance).toEqual(
      expect.arrayContaining([
        "v6b-constrainautor-constraint-recovery",
        "v6b-retry-coarser-boundary",
        "v6b-boundary-constraints-verified"
      ])
    );
    expect(retrySuccess.provenance).not.toContain("v6b-retry-fewer-interior-points");

    const retryFallback = probeAutoOutlineV6BConstrainautorRetryForTest({
      width: 8,
      height: 8,
      attempts: [
        { recoveryInput: invalidRecoveryInput },
        {
          recoveryInput: invalidRecoveryInput,
          retryProvenance: ["v6b-retry-coarser-boundary"]
        },
        {
          recoveryInput: invalidRecoveryInput,
          retryProvenance: ["v6b-retry-fewer-interior-points"]
        }
      ]
    });

    expect(retryFallback).toMatchObject({
      outputKind: "fallback-output",
      reason: "v6b-invalid-constraints",
      attemptCount: 3,
      diagnostics: {
        dependencyGateStatus: "available",
        constraintRecoveryFailed: true
      }
    });
    expect(retryFallback.provenance).toEqual(
      expect.arrayContaining([
        "v6b-visible-fallback",
        "fallback-v6b-invalid-constraints",
        "v6b-retry-coarser-boundary",
        "v6b-retry-fewer-interior-points",
        "v6b-constrainautor-recovery-failed"
      ])
    );
  });

  it("records v6b main-island-only handling for multi-island alpha inputs", () => {
    const textureSize = { width: 24, height: 16 };
    const meshBounds = { x: 0, y: 0, width: 24, height: 16 };
    const opaquePixels = createPixelsFromPredicate(textureSize.width, textureSize.height, (x, y) =>
      (x >= 3 && x <= 8 && y >= 3 && y <= 10) ||
      (x >= 15 && x <= 20 && y >= 5 && y <= 12)
    );
    const session = createFixtureSession({
      includeBytes: true,
      textureSize,
      meshBounds,
      opaquePixels
    });
    const baseInput = {
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6b-constrainautor" as const,
      densityHint: "medium" as const
    };

    const first = createGeneratedMeshForDrawable(baseInput);
    const second = createGeneratedMeshForDrawable(baseInput);
    const v6Metrics = first?.qualityMetrics?.v6Metrics;
    const diagnostics = v6Metrics?.constrainautorDiagnostics;

    expect(first).toEqual(second);
    expectValidMeshDto(first?.mesh, {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: baseInput.drawableId,
      generationProvenanceId: baseInput.provenanceId,
      bounds: meshBounds
    });
    expect(v6Metrics?.methodId).toBe("auto-outline-v6b-constrainautor");
    expect(v6Metrics?.multiIslandHandling).toBe("main-island-only");
    expect(diagnostics?.dependencyGateStatus).toBe("available");

    if (first?.source === "outline-v6b-constrainautor-rgba") {
      expect(first.fallbackReason).toBeUndefined();
      expect(v6Metrics?.outputKind).toBe("backend-output");
      expect(v6Metrics?.provenance).toContain("limitation-main-island-only");
      expect(diagnostics?.missingConstraintEdgeCount).toBe(0);
      return;
    }

    const fallbackReason = first?.fallbackReason;
    expect(first?.source).toBe("alpha-aware-rgba");
    expect(fallbackReason).toMatch(/^v6b-/);
    if (fallbackReason !== undefined) {
      expect(first?.fallbackSteps).toEqual([
        { method: "auto-outline-v6b-constrainautor", reason: fallbackReason }
      ]);
    }
    expect(v6Metrics?.outputKind).toBe("fallback-output");
    expect(v6Metrics?.provenance).toContain("v6b-visible-fallback");
    expect(diagnostics?.constraintRecoveryFailed).toBe(true);
  });

  it("generates deterministic auto-outline-v6c-poly2tri backend meshes from simple polygon fixtures", () => {
    for (const fixtureId of [
      "v6-simple-rectangle",
      "v6-curved-blob",
      "v6-thin-tapered"
    ] as const) {
      const fixture = getV6MeshGenerationContractFixture(fixtureId);
      const session = createFixtureSession({
        includeBytes: true,
        textureSize: fixture.textureSize,
        meshBounds: fixture.meshBounds,
        opaquePixels: fixture.opaquePixels
      });
      const baseInput = {
        session,
        drawableId: DrawableIdSchema.parse("draw_body"),
        provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
        method: "auto-outline-v6c-poly2tri" as const,
        densityHint: "medium" as const
      };

      const first = createGeneratedMeshForDrawable(baseInput);
      const second = createGeneratedMeshForDrawable(baseInput);

      expect(first).toEqual(second);
      expect(first?.qualityMetrics?.v6Metrics?.poly2triDiagnostics).toMatchObject({
        boundaryEdgeMissingCount: 0
      });
      expect(first?.fallbackReason).toBeUndefined();
      expect(first?.fallbackSteps).toBeUndefined();
      expect(first?.source).toBe("outline-v6c-poly2tri-rgba");
      expectValidMeshDto(first?.mesh, {
        meshId: MeshIdSchema.parse("mesh_body"),
        drawableId: baseInput.drawableId,
        generationProvenanceId: baseInput.provenanceId,
        bounds: fixture.meshBounds
      });
      expect(first?.alphaBounds).toBeDefined();
      if (first?.alphaBounds !== undefined) {
        expectRectInsideBounds(first.alphaBounds, fixture.meshBounds);
      }
      expect(first?.qualityMetrics).toMatchObject({
        triangulationMode: "v6c-poly2tri-constrained-polygon",
        v6Metrics: {
          algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
          methodId: "auto-outline-v6c-poly2tri",
          backendId: "v6c-poly2tri",
          backendImplementationStatus: "implemented",
          requestedSourceId: "outline-v6c-poly2tri-rgba",
          actualSourceId: "outline-v6c-poly2tri-rgba",
          outputKind: "backend-output",
          preset: "medium",
          fallbackSteps: [],
          alphaBoundsAvailable: true,
          opaquePixelCount: fixture.opaquePixels.length,
          multiIslandHandling: "supported",
          holeHandling: "supported",
          poly2triDiagnostics: {
            dependencyGateStatus: "available",
            holeCount: 0,
            polygonValidationFailed: false,
            holeValidationFailed: false,
            triangulationThrown: false,
            boundaryEdgeMissingCount: 0,
            mainIslandOnlyFallback: false
          }
        }
      });
      const v6Metrics = first?.qualityMetrics?.v6Metrics;
      const diagnostics = v6Metrics?.poly2triDiagnostics;
      expect(v6Metrics?.fallbackReason).toBeUndefined();
      expect(v6Metrics?.vertexCount).toBe(first?.mesh.vertices.length);
      expect(v6Metrics?.triangleCount).toBe(first?.mesh.triangles.length);
      expect(v6Metrics?.boundaryVertexCount).toBeGreaterThan(0);
      expect(v6Metrics?.interiorVertexCount).toBeGreaterThan(0);
      expect(v6Metrics?.provenance).toContain("v6c-poly2tri-constrained-polygon-triangulation");
      expect(diagnostics?.outerPointCount).toBeGreaterThan(2);
      expect(diagnostics?.steinerPointCount).toBeGreaterThan(0);
      expect(diagnostics?.boundaryEdgePreservedCount).toBe(diagnostics?.outerPointCount);
    }
  });

  it("exposes auto-outline-v6c-poly2tri invalid polygon, throw, and boundary-missing blockers", () => {
    const invalidPolygon = probeAutoOutlineV6CPoly2TriFailureForTest({
      boundaryPoints: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 0 },
        { x: 0, y: 8 }
      ]
    });
    const thrown = probeAutoOutlineV6CPoly2TriFailureForTest({
      boundaryPoints: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 8 },
        { x: 0, y: 8 }
      ],
      interiorPoints: [{ x: 4, y: 4 }],
      createSweepContext: () => ({
        addPoints: () => undefined,
        triangulate: () => {
          throw new Error("forced poly2tri probe failure");
        },
        getTriangles: () => []
      })
    });
    const missingBoundary = probeAutoOutlineV6CPoly2TriFailureForTest({
      boundaryPoints: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 8 },
        { x: 0, y: 8 }
      ],
      interiorPoints: [{ x: 4, y: 4 }],
      createSweepContext: (contourPoints) => {
        let steinerPoints = contourPoints.slice(0, 0);
        return {
          addPoints: (points) => {
            steinerPoints = points;
          },
          triangulate: () => undefined,
          getTriangles: () => [
            {
              getPoints: () => [
                contourPoints[0]!,
                contourPoints[1]!,
                steinerPoints[0] ?? contourPoints[2]!
              ]
            }
          ]
        };
      }
    });

    expect(invalidPolygon.outputKind).toBe("blocked");
    expect(invalidPolygon.reason).toBe("v6c-poly2tri-polygon-invalid");
    expect(invalidPolygon.validationFailures).toEqual(
      expect.arrayContaining(["duplicate-point", "zero-length-edge"])
    );
    expect(invalidPolygon.diagnostics).toMatchObject({
      outerPointCount: 4,
      polygonValidationFailed: true,
      triangulationThrown: false,
      boundaryEdgeMissingCount: 0
    });

    expect(thrown.outputKind).toBe("blocked");
    expect(thrown.reason).toBe("v6c-poly2tri-triangulation-threw");
    expect(thrown.triangleCount).toBe(0);
    expect(thrown.diagnostics).toMatchObject({
      polygonValidationFailed: false,
      triangulationThrown: true,
      boundaryEdgeMissingCount: 0
    });

    expect(missingBoundary.outputKind).toBe("blocked");
    expect(missingBoundary.reason).toBe("v6c-poly2tri-boundary-missing");
    expect(missingBoundary.triangleCount).toBe(1);
    expect(missingBoundary.diagnostics).toMatchObject({
      polygonValidationFailed: false,
      triangulationThrown: false,
      boundaryEdgePreservedCount: 1,
      boundaryEdgeMissingCount: 3
    });
  });

  it("sanitizes near-duplicate auto-outline-v6c-poly2tri contour points before validation", () => {
    const sanitization = probeAutoOutlineV6CPoly2TriSanitizationForTest({
      boundaryPoints: [
        { x: 0, y: 0 },
        { x: 0.2, y: 0.05 },
        { x: 8, y: 0 },
        { x: 8, y: 8 },
        { x: 0, y: 8 }
      ]
    });
    const backendProbe = probeAutoOutlineV6CPoly2TriFailureForTest({
      boundaryPoints: sanitization.sanitizedPoints,
      interiorPoints: [{ x: 4, y: 4 }]
    });

    expect(sanitization).toMatchObject({
      originalPointCount: 5,
      sanitizedPointCount: 4,
      removedPointCount: 1,
      validationFailures: [],
      diagnostics: {
        dependencyGateStatus: "available",
        outerPointCount: 4,
        polygonValidationFailed: false,
        triangulationThrown: false,
        boundaryEdgeMissingCount: 0
      }
    });
    expect(sanitization.shortestSanitizedEdgeLength).toBeGreaterThanOrEqual(1.25);
    expect(sanitization.sanitizedPoints).toEqual([
      { x: 0, y: 0 },
      { x: 8, y: 0 },
      { x: 8, y: 8 },
      { x: 0, y: 8 }
    ]);
    expect(backendProbe).toMatchObject({
      outputKind: "backend-output",
      validationFailures: [],
      diagnostics: {
        outerPointCount: 4,
        polygonValidationFailed: false,
        triangulationThrown: false,
        boundaryEdgeMissingCount: 0
      }
    });
    expect(backendProbe.triangleCount).toBeGreaterThan(0);
  });

  it("reports auto-outline-v6c-poly2tri hole and multi-island limitations as visible fallback metadata", () => {
    const holeFixture = getV6MeshGenerationContractFixture("v6-hole-like");
    const cases = [
      {
        name: "hole",
        textureSize: holeFixture.textureSize,
        meshBounds: holeFixture.meshBounds,
        opaquePixels: holeFixture.opaquePixels,
        reason: "v6c-poly2tri-hole-unsupported",
        expectedHoleHandling: "unsupported-fallback",
        expectedMultiIslandHandling: "supported",
        expectedDiagnostics: {
          holeValidationFailed: true,
          mainIslandOnlyFallback: false
        }
      },
      {
        name: "near-touching-hole",
        textureSize: { width: 26, height: 22 },
        meshBounds: { x: 0, y: 0, width: 26, height: 22 },
        opaquePixels: createPixelsFromPredicate(26, 22, (x, y) => {
          const outer = x >= 3 && x <= 22 && y >= 3 && y <= 18;
          const nearTouchingHole = x >= 11 && x <= 15 && y >= 4 && y <= 12;
          return outer && !nearTouchingHole;
        }),
        reason: "v6c-poly2tri-hole-unsupported",
        expectedHoleHandling: "unsupported-fallback",
        expectedMultiIslandHandling: "supported",
        expectedDiagnostics: {
          holeValidationFailed: true,
          mainIslandOnlyFallback: false
        }
      },
      {
        name: "multi-island",
        textureSize: { width: 24, height: 16 },
        meshBounds: { x: 0, y: 0, width: 24, height: 16 },
        opaquePixels: createPixelsFromPredicate(24, 16, (x, y) =>
          (x >= 3 && x <= 8 && y >= 3 && y <= 10) ||
          (x >= 15 && x <= 20 && y >= 5 && y <= 12)
        ),
        reason: "v6c-poly2tri-multi-island-unsupported",
        expectedHoleHandling: "supported",
        expectedMultiIslandHandling: "main-island-only",
        expectedDiagnostics: {
          holeValidationFailed: false,
          mainIslandOnlyFallback: true
        }
      }
    ] as const;

    for (const testCase of cases) {
      const session = createFixtureSession({
        includeBytes: true,
        textureSize: testCase.textureSize,
        meshBounds: testCase.meshBounds,
        opaquePixels: testCase.opaquePixels
      });
      const generated = createGeneratedMeshForDrawable({
        session,
        drawableId: DrawableIdSchema.parse("draw_body"),
        provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
        method: "auto-outline-v6c-poly2tri",
        densityHint: "medium"
      });

      expect(generated?.source, testCase.name).toBe("alpha-aware-rgba");
      expect(generated?.fallbackReason, testCase.name).toBe(testCase.reason);
      expect(generated?.fallbackSteps).toEqual([
        { method: "auto-outline-v6c-poly2tri", reason: testCase.reason }
      ]);
      expectValidMeshDto(generated?.mesh, {
        meshId: MeshIdSchema.parse("mesh_body"),
        drawableId: DrawableIdSchema.parse("draw_body"),
        generationProvenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
        bounds: testCase.meshBounds
      });
      expect(generated?.qualityMetrics).toMatchObject({
        fallbackReason: testCase.reason,
        triangulationMode: "v6-backend-blocked-fallback",
        v6Metrics: {
          methodId: "auto-outline-v6c-poly2tri",
          backendId: "v6c-poly2tri",
          backendImplementationStatus: "implemented",
          requestedSourceId: "outline-v6c-poly2tri-rgba",
          actualSourceId: "alpha-aware-rgba",
          outputKind: "fallback-output",
          fallbackReason: testCase.reason,
          fallbackSteps: [{ method: "auto-outline-v6c-poly2tri", reason: testCase.reason }],
          multiIslandHandling: testCase.expectedMultiIslandHandling,
          holeHandling: testCase.expectedHoleHandling,
          poly2triDiagnostics: {
            dependencyGateStatus: "available",
            polygonValidationFailed: false,
            triangulationThrown: false,
            boundaryEdgeMissingCount: 0,
            ...testCase.expectedDiagnostics
          }
        }
      });
      expect(generated?.qualityMetrics?.v6Metrics?.poly2triDiagnostics?.outerPointCount).toBeGreaterThan(2);
      if (testCase.expectedHoleHandling === "unsupported-fallback") {
        expect(generated?.qualityMetrics?.v6Metrics?.poly2triDiagnostics?.holeCount).toBeGreaterThan(0);
      }
    }
  });

  it("routes deferred v6 library candidates through explicit non-success fallback metadata", () => {
    const fixture = getV6MeshGenerationContractFixture("v6-simple-rectangle");

    for (const candidate of V6_MESH_GENERATION_CANDIDATES.filter(
      (entry) => (entry.backendImplementationStatus as string) === "deferred"
    )) {
      const session = createFixtureSession({
        includeBytes: true,
        textureSize: fixture.textureSize,
        meshBounds: fixture.meshBounds,
        opaquePixels: fixture.opaquePixels
      });
      const generated = createGeneratedMeshForDrawable({
        session,
        drawableId: DrawableIdSchema.parse("draw_body"),
        provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
        method: candidate.methodId,
        densityHint: "medium"
      });
      const expectedReason = "v6-backend-not-implemented";

      expect(generated?.source).toBe("alpha-aware-rgba");
      expect(generated?.fallbackReason).toBe(expectedReason);
      expect(generated?.fallbackSteps).toEqual([{ method: candidate.methodId, reason: expectedReason }]);
      expect(generated?.qualityMetrics).toMatchObject({
        fallbackReason: expectedReason,
        triangulationMode: "v6-backend-blocked-fallback",
        v6Metrics: {
          algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
          methodId: candidate.methodId,
          backendId: candidate.backendId,
          backendImplementationStatus: "deferred",
          requestedSourceId: candidate.sourceId,
          actualSourceId: "alpha-aware-rgba",
          outputKind: "fallback-output",
          preset: "medium",
          fallbackReason: expectedReason,
          fallbackSteps: [{ method: candidate.methodId, reason: expectedReason }],
          alphaBoundsAvailable: true,
          multiIslandHandling: "not-evaluated",
          holeHandling: "not-evaluated"
        }
      });
      expect(generated?.qualityMetrics?.v6Metrics?.vertexCount).toBe(generated?.mesh.vertices.length);
      expect(generated?.qualityMetrics?.v6Metrics?.triangleCount).toBe(generated?.mesh.triangles.length);
      expect(generated?.qualityMetrics?.v6Metrics?.boundaryVertexCount).toBeGreaterThan(0);
      expect(generated?.qualityMetrics?.v6Metrics?.opaquePixelCount).toBe(fixture.opaquePixels.length);

      if (candidate.backendId === "v6b-constrainautor") {
        expect(generated?.qualityMetrics?.v6Metrics?.constrainautorDiagnostics).toMatchObject({
          dependencyGateStatus: "available",
          constraintRecoveryFailed: false
        });
      }

      if (candidate.backendId === "v6c-poly2tri") {
        expect(generated?.qualityMetrics?.v6Metrics?.poly2triDiagnostics).toMatchObject({
          dependencyGateStatus: "available",
          polygonValidationFailed: false
        });
      }
    }
  });

  it("reports v6 empty and missing alpha fallbacks without claiming backend output", () => {
    const emptyFixture = getV6MeshGenerationContractFixture("v6-empty-alpha-fallback");
    const emptySession = createFixtureSession({
      includeBytes: true,
      textureSize: emptyFixture.textureSize,
      meshBounds: emptyFixture.meshBounds,
      opaquePixels: emptyFixture.opaquePixels
    });
    const emptyGenerated = createGeneratedMeshForDrawable({
      session: emptySession,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6a-local",
      densityHint: "low"
    });

    expect(emptyGenerated?.source).toBe("bounds-grid");
    expect(emptyGenerated?.fallbackReason).toBe("alpha-empty");
    expect(emptyGenerated?.fallbackSteps).toEqual([{ method: "auto-outline-v6a-local", reason: "alpha-empty" }]);
    expect(emptyGenerated?.qualityMetrics?.v6Metrics).toMatchObject({
      methodId: "auto-outline-v6a-local",
      backendImplementationStatus: "implemented",
      requestedSourceId: "outline-v6a-local-rgba",
      actualSourceId: "bounds-grid",
      outputKind: "blocked",
      alphaBoundsAvailable: false,
      opaquePixelCount: 0
    });

    const emptyConstrainautorGenerated = createGeneratedMeshForDrawable({
      session: emptySession,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6b-constrainautor",
      densityHint: "low"
    });

    expect(emptyConstrainautorGenerated?.source).toBe("bounds-grid");
    expect(emptyConstrainautorGenerated?.fallbackReason).toBe("alpha-empty");
    expect(emptyConstrainautorGenerated?.fallbackSteps).toEqual([
      { method: "auto-outline-v6b-constrainautor", reason: "alpha-empty" }
    ]);
    expect(emptyConstrainautorGenerated?.qualityMetrics?.v6Metrics).toMatchObject({
      methodId: "auto-outline-v6b-constrainautor",
      backendImplementationStatus: "implemented",
      requestedSourceId: "outline-v6b-constrainautor-rgba",
      actualSourceId: "bounds-grid",
      outputKind: "blocked",
      alphaBoundsAvailable: false,
      opaquePixelCount: 0,
      constrainautorDiagnostics: {
        dependencyGateStatus: "available"
      }
    });

    const missingFixture = getV6MeshGenerationContractFixture("v6-simple-rectangle");
    const missingBytesSession = createFixtureSession({
      includeBytes: false,
      textureSize: missingFixture.textureSize,
      meshBounds: missingFixture.meshBounds,
      opaquePixels: missingFixture.opaquePixels
    });
    const missingLocalGenerated = createGeneratedMeshForDrawable({
      session: missingBytesSession,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6a-local",
      densityHint: "low"
    });

    expect(missingLocalGenerated?.source).toBe("bounds-grid");
    expect(missingLocalGenerated?.fallbackReason).toBe("texture-bytes-unavailable");
    expect(missingLocalGenerated?.fallbackSteps).toEqual([
      { method: "auto-outline-v6a-local", reason: "texture-bytes-unavailable" }
    ]);
    expect(missingLocalGenerated?.qualityMetrics?.v6Metrics).toMatchObject({
      methodId: "auto-outline-v6a-local",
      backendImplementationStatus: "implemented",
      requestedSourceId: "outline-v6a-local-rgba",
      actualSourceId: "bounds-grid",
      outputKind: "blocked",
      alphaBoundsAvailable: false
    });

    const missingGenerated = createGeneratedMeshForDrawable({
      session: missingBytesSession,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6b-constrainautor",
      densityHint: "low"
    });

    expect(missingGenerated?.source).toBe("bounds-grid");
    expect(missingGenerated?.fallbackReason).toBe("texture-bytes-unavailable");
    expect(missingGenerated?.fallbackSteps).toEqual([
      { method: "auto-outline-v6b-constrainautor", reason: "texture-bytes-unavailable" }
    ]);
    expect(missingGenerated?.qualityMetrics?.v6Metrics).toMatchObject({
      methodId: "auto-outline-v6b-constrainautor",
      requestedSourceId: "outline-v6b-constrainautor-rgba",
      actualSourceId: "bounds-grid",
      outputKind: "blocked",
      alphaBoundsAvailable: false,
      constrainautorDiagnostics: {
        dependencyGateStatus: "available"
      }
    });

    const missingPoly2TriGenerated = createGeneratedMeshForDrawable({
      session: missingBytesSession,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6c-poly2tri",
      densityHint: "low"
    });

    expect(missingPoly2TriGenerated?.source).toBe("bounds-grid");
    expect(missingPoly2TriGenerated?.fallbackReason).toBe("texture-bytes-unavailable");
    expect(missingPoly2TriGenerated?.fallbackSteps).toEqual([
      { method: "auto-outline-v6c-poly2tri", reason: "texture-bytes-unavailable" }
    ]);
    expect(missingPoly2TriGenerated?.qualityMetrics?.v6Metrics).toMatchObject({
      methodId: "auto-outline-v6c-poly2tri",
      backendImplementationStatus: "implemented",
      requestedSourceId: "outline-v6c-poly2tri-rgba",
      actualSourceId: "bounds-grid",
      outputKind: "blocked",
      alphaBoundsAvailable: false,
      poly2triDiagnostics: {
        dependencyGateStatus: "available",
        outerPointCount: 0,
        triangulationThrown: false
      }
    });
  });

  it("routes auto-outline-v3-envelope as an explicit drawable generation sidecar with envelope summary", () => {
    const session = createFixtureSession({
      includeBytes: true,
      textureSize: { width: 36, height: 32 },
      meshBounds: { x: 10, y: 20, width: 36, height: 32 },
      opaquePixels: createPixelsFromPredicate(36, 32, (x, y) => {
        const dx = (x - 16.5) / 10;
        const dy = (y - 15.5) / 8;
        const body = dx * dx + dy * dy <= 1;
        const tail = x >= 23 && x <= 30 && y >= 13 && y <= 18;
        const notch = x >= 8 && x <= 14 && y >= 18 && y <= 26;
        return (body || tail) && !notch;
      })
    });

    const generated = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v3-envelope",
      densityHint: "medium"
    });

    expect(generated?.source).toBe("outline-v3-envelope-rgba");
    expect(generated?.fallbackReason).toBeUndefined();
    expect(generated?.qualityMetrics).toMatchObject({
      triangulationMode: "interim-delaunay-envelope-filter",
      envelopeMetrics: {
        algorithmId: "auto-outline-v3-envelope",
        outsideTriangleSampleCount: 0
      }
    });
    expect(generated?.qualityMetrics?.envelopeMetrics?.transparentSampleCount).toBeGreaterThan(0);
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

function expectValidMeshDto(
  mesh: MeshDto | undefined,
  expected?: {
    readonly meshId?: MeshDto["meshId"];
    readonly drawableId?: MeshDto["drawableId"];
    readonly generationProvenanceId?: MeshDto["generationProvenanceId"];
    readonly bounds?: RectDto;
  }
): void {
  expect(mesh).toBeDefined();
  if (mesh === undefined) {
    return;
  }

  if (expected?.meshId !== undefined) {
    expect(mesh.meshId).toBe(expected.meshId);
  }
  if (expected?.drawableId !== undefined) {
    expect(mesh.drawableId).toBe(expected.drawableId);
  }
  if (expected?.generationProvenanceId !== undefined) {
    expect(mesh.generationProvenanceId).toBe(expected.generationProvenanceId);
  }
  if (expected?.bounds !== undefined) {
    expect(mesh.bounds).toEqual(expected.bounds);
  }
  expect(mesh.vertices).toHaveLength(mesh.uvs.length);
  expect(mesh.vertices).toHaveLength(mesh.vertexStableIds.length);
  expect(mesh.triangleStableIds).toHaveLength(mesh.triangles.length);
  expect(mesh.topologyRevision).toBe(0);

  for (const vertex of mesh.vertices) {
    expect(Number.isFinite(vertex.x)).toBe(true);
    expect(Number.isFinite(vertex.y)).toBe(true);
    if (expected?.bounds !== undefined) {
      expect(vertex.x).toBeGreaterThanOrEqual(expected.bounds.x);
      expect(vertex.x).toBeLessThanOrEqual(expected.bounds.x + expected.bounds.width);
      expect(vertex.y).toBeGreaterThanOrEqual(expected.bounds.y);
      expect(vertex.y).toBeLessThanOrEqual(expected.bounds.y + expected.bounds.height);
    }
  }

  for (const uv of mesh.uvs) {
    expect(Number.isFinite(uv.x)).toBe(true);
    expect(Number.isFinite(uv.y)).toBe(true);
    expect(uv.x).toBeGreaterThanOrEqual(0);
    expect(uv.x).toBeLessThanOrEqual(1);
    expect(uv.y).toBeGreaterThanOrEqual(0);
    expect(uv.y).toBeLessThanOrEqual(1);
  }

  for (const stableId of mesh.vertexStableIds) {
    expect(stableId).toMatch(/^[A-Za-z0-9_-]+$/);
  }

  for (const stableId of mesh.triangleStableIds ?? []) {
    expect(stableId).toMatch(/^tri_[A-Za-z0-9_-]+$/);
  }

  for (const triangle of mesh.triangles) {
    const [aIndex, bIndex, cIndex] = triangle;
    expect(aIndex).not.toBe(bIndex);
    expect(bIndex).not.toBe(cIndex);
    expect(cIndex).not.toBe(aIndex);
    expect(mesh.vertices[aIndex]).toBeDefined();
    expect(mesh.vertices[bIndex]).toBeDefined();
    expect(mesh.vertices[cIndex]).toBeDefined();
    const a = mesh.vertices[aIndex];
    const b = mesh.vertices[bIndex];
    const c = mesh.vertices[cIndex];
    if (a === undefined || b === undefined || c === undefined) {
      continue;
    }

    const area = Math.abs(((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2);
    expect(area).toBeGreaterThan(0);
  }
}

function expectRectInsideBounds(rect: RectDto, bounds: RectDto): void {
  expect(Number.isFinite(rect.x)).toBe(true);
  expect(Number.isFinite(rect.y)).toBe(true);
  expect(Number.isFinite(rect.width)).toBe(true);
  expect(Number.isFinite(rect.height)).toBe(true);
  expect(rect.width).toBeGreaterThanOrEqual(0);
  expect(rect.height).toBeGreaterThanOrEqual(0);
  expect(rect.x).toBeGreaterThanOrEqual(bounds.x);
  expect(rect.y).toBeGreaterThanOrEqual(bounds.y);
  expect(rect.x + rect.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  expect(rect.y + rect.height).toBeLessThanOrEqual(bounds.y + bounds.height);
}

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

function countV3EnvelopeSampleClasses(
  mesh: MeshDto,
  alphaPixels: ReadonlySet<string>
): { readonly outsideEnvelope: number; readonly transparentInsideEnvelope: number } {
  const boundaryVertices = mesh.vertices.filter((_vertex, index) =>
    mesh.vertexStableIds[index]?.includes("_outline_v3_envelope_boundary_")
  );
  const envelope = convexHull(boundaryVertices);
  let outsideEnvelope = 0;
  let transparentInsideEnvelope = 0;

  expect(envelope.length).toBeGreaterThanOrEqual(3);

  for (const triangle of mesh.triangles) {
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

    for (const sample of samples) {
      if (!isPointInsidePolygon(sample, envelope)) {
        outsideEnvelope += 1;
        continue;
      }

      if (!alphaPixels.has(`${Math.floor(sample.x)}:${Math.floor(sample.y)}`)) {
        transparentInsideEnvelope += 1;
      }
    }
  }

  return {
    outsideEnvelope,
    transparentInsideEnvelope
  };
}

function countV25SoftBoundarySampleClasses(
  mesh: MeshDto,
  alphaPixels: ReadonlySet<string>
): { readonly outsideSoftBoundary: number; readonly transparentInsideSoftBoundary: number } {
  const softBoundary = mesh.vertices.filter((_vertex, index) =>
    mesh.vertexStableIds[index]?.includes("_outline_v2_5_soft_boundary_boundary_")
  );
  let outsideSoftBoundary = 0;
  let transparentInsideSoftBoundary = 0;

  expect(softBoundary.length).toBeGreaterThanOrEqual(3);

  for (const triangle of mesh.triangles) {
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

    for (const sample of samples) {
      if (!isPointInsidePolygon(sample, softBoundary)) {
        outsideSoftBoundary += 1;
        continue;
      }

      if (!alphaPixels.has(`${Math.floor(sample.x)}:${Math.floor(sample.y)}`)) {
        transparentInsideSoftBoundary += 1;
      }
    }
  }

  return {
    outsideSoftBoundary,
    transparentInsideSoftBoundary
  };
}

function convexHull(points: readonly MeshDto["vertices"][number][]): readonly MeshDto["vertices"][number][] {
  const sorted = [...dedupeVertices(points)].sort((left, right) => left.x - right.x || left.y - right.y);
  if (sorted.length <= 3) {
    return sorted;
  }

  const lower: MeshDto["vertices"][number][] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: MeshDto["vertices"][number][] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function dedupeVertices(
  points: readonly MeshDto["vertices"][number][]
): readonly MeshDto["vertices"][number][] {
  const seen = new Set<string>();
  const result: MeshDto["vertices"][number][] = [];
  for (const point of points) {
    const key = `${point.x}:${point.y}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(point);
  }

  return result;
}

function isPointInsidePolygon(
  point: MeshDto["vertices"][number],
  polygon: readonly MeshDto["vertices"][number][]
): boolean {
  for (let index = 0; index < polygon.length; index += 1) {
    if (isPointOnSegment(point, polygon[index]!, polygon[(index + 1) % polygon.length]!)) {
      return true;
    }
  }

  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const a = polygon[index]!;
    const b = polygon[previousIndex]!;
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function isPointOnSegment(
  point: MeshDto["vertices"][number],
  start: MeshDto["vertices"][number],
  end: MeshDto["vertices"][number]
): boolean {
  if (Math.abs(cross(start, end, point)) > 0.000001) {
    return false;
  }

  return (
    point.x >= Math.min(start.x, end.x) - 0.000001 &&
    point.x <= Math.max(start.x, end.x) + 0.000001 &&
    point.y >= Math.min(start.y, end.y) - 0.000001 &&
    point.y <= Math.max(start.y, end.y) + 0.000001
  );
}

function cross(
  a: MeshDto["vertices"][number],
  b: MeshDto["vertices"][number],
  c: MeshDto["vertices"][number]
): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
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
