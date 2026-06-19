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
  V6_MESH_GENERATION_DEPENDENCY_PACKAGE_IDS,
  type V6MeshGenerationBackendId
} from "./mesh-generation-contract.js";
import {
  V6_MESH_GENERATION_CONTRACT_FIXTURE_IDS,
  V6_MESH_GENERATION_CONTRACT_FIXTURES,
  createV6MeshGenerationFixtureRgbaBytes,
  getV6MeshGenerationContractFixture
} from "./mesh-generation-v6-fixtures.js";
import { createV6ContourCandidateInput } from "./mesh-generation-v6-contour-pipeline.js";
import { resolveV6DAdaptiveDensityForTest } from "./mesh-generation-v6d-adaptive-density.js";
import {
  probeAutoOutlineV6BConstrainautorRetryForTest,
  recoverV6BConstrainautorTriangles
} from "./mesh-generation-v6b-constrainautor.js";
import {
  probeAutoOutlineV6CPoly2TriFailureForTest,
  probeAutoOutlineV6CPoly2TriSanitizationForTest
} from "./mesh-generation-v6c-poly2tri.js";
import {
  probeV6DOutsideTriangleFilterForTest,
  recoverV6DConstrainautorTriangles
} from "./mesh-generation-v6d-contour-constrainautor.js";
import {
  probeV6DSupportRingGeometryFallbackForTest,
  probeV6DSupportRingTriangleFilterForTest
} from "./mesh-generation-v6d-contour-band-support-rings.js";
import {
  probeV6DAdaptiveStaggeredBandStripGeometryForTest,
  probeV6DAdaptiveStaggeredBandWave70FallbackForTest
} from "./mesh-generation-v6d-adaptive-staggered-band.js";
import {
  computeMeshQualityMetrics,
  type MeshGenerationV6Metrics
} from "./mesh-quality-metrics.js";
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
      },
      {
        methodId: "auto-outline-v6d-contour-constrainautor",
        sourceId: "outline-v6d-contour-constrainautor-rgba",
        backendId: "v6d-contour-constrainautor",
        dependencyGateStatus: "available",
        dependencyPackageIds: ["delaunator", "@kninnug/constrainautor"],
        backendImplementationStatus: "implemented"
      },
      {
        methodId: "auto-outline-v6d-contour-band-support-rings",
        sourceId: "outline-v6d-contour-band-support-rings-rgba",
        backendId: "v6d-contour-band-support-rings",
        dependencyGateStatus: "available",
        dependencyPackageIds: ["delaunator", "@kninnug/constrainautor"],
        backendImplementationStatus: "implemented"
      },
      {
        methodId: "auto-outline-v6d-adaptive-staggered-band",
        sourceId: "outline-v6d-adaptive-staggered-band-rgba",
        backendId: "v6d-adaptive-staggered-band",
        dependencyGateStatus: "available",
        dependencyPackageIds: ["delaunator", "@kninnug/constrainautor"],
        backendImplementationStatus: "implemented"
      },
      {
        methodId: "auto-outline-v6d-adaptive-contour-constrainautor",
        sourceId: "outline-v6d-adaptive-contour-constrainautor-rgba",
        backendId: "v6d-adaptive-contour-constrainautor",
        dependencyGateStatus: "available",
        dependencyPackageIds: ["delaunator", "@kninnug/constrainautor"],
        backendImplementationStatus: "implemented"
      },
      {
        methodId: "auto-outline-v6e-contour-poly2tri",
        sourceId: "outline-v6e-contour-poly2tri-rgba",
        backendId: "v6e-contour-poly2tri",
        dependencyGateStatus: "available",
        dependencyPackageIds: ["poly2tri"],
        backendImplementationStatus: "implemented"
      },
      {
        methodId: "auto-outline-v6f-contour-custom-cdt",
        sourceId: "outline-v6f-contour-custom-cdt-rgba",
        backendId: "v6f-contour-custom-cdt",
        dependencyGateStatus: "not-required",
        dependencyPackageIds: [],
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

  it("extracts deterministic shared v6 contour candidate input with boundary constraints", () => {
    for (const fixtureId of [
      "v6-simple-rectangle",
      "v6-curved-blob",
      "v6-thin-tapered",
      "v6-hole-like"
    ] as const) {
      const fixture = getV6MeshGenerationContractFixture(fixtureId);
      const baseInput = {
        textureSize: fixture.textureSize,
        meshBounds: fixture.meshBounds,
        rgbaBytes: createV6MeshGenerationFixtureRgbaBytes(fixture),
        densityHint: "medium" as const
      };

      const first = createV6ContourCandidateInput(baseInput);
      const second = createV6ContourCandidateInput(baseInput);

      expect(first, fixtureId).toEqual(second);
      expect(first.status, fixtureId).toBe("generated");
      if (first.status !== "generated") {
        continue;
      }

      const candidateInput = first.candidateInput;
      const alphaBounds = candidateInput.alphaBounds;
      const opaquePixelBounds = getOpaquePixelBounds(fixture.opaquePixels);
      expect(candidateInput.boundaryPoints.length, fixtureId).toBeGreaterThanOrEqual(3);
      expect(candidateInput.constraintEdges.length, fixtureId).toBe(candidateInput.boundaryPoints.length);
      expect(candidateInput.interiorPoints.length, fixtureId).toBeGreaterThan(0);
      expect(alphaBounds, fixtureId).toEqual(second.status === "generated" ? second.candidateInput.alphaBounds : undefined);
      expect(alphaBounds.pixelBounds.right, fixtureId).toBeGreaterThan(alphaBounds.pixelBounds.left);
      expect(alphaBounds.pixelBounds.bottom, fixtureId).toBeGreaterThan(alphaBounds.pixelBounds.top);
      expect(alphaBounds.pixelBounds.left, fixtureId).toBeGreaterThanOrEqual(0);
      expect(alphaBounds.pixelBounds.top, fixtureId).toBeGreaterThanOrEqual(0);
      expect(alphaBounds.pixelBounds.right, fixtureId).toBeLessThanOrEqual(fixture.textureSize.width);
      expect(alphaBounds.pixelBounds.bottom, fixtureId).toBeLessThanOrEqual(fixture.textureSize.height);
      expect(alphaBounds.stageBounds.x, fixtureId).toBeGreaterThanOrEqual(fixture.meshBounds.x);
      expect(alphaBounds.stageBounds.y, fixtureId).toBeGreaterThanOrEqual(fixture.meshBounds.y);
      expect(alphaBounds.stageBounds.x + alphaBounds.stageBounds.width, fixtureId).toBeLessThanOrEqual(
        fixture.meshBounds.x + fixture.meshBounds.width
      );
      expect(alphaBounds.stageBounds.y + alphaBounds.stageBounds.height, fixtureId).toBeLessThanOrEqual(
        fixture.meshBounds.y + fixture.meshBounds.height
      );
      expect(alphaBounds.stageBounds, fixtureId).toEqual({
        x: roundTestCoordinate(fixture.meshBounds.x + fixture.meshBounds.width * (alphaBounds.pixelBounds.left / fixture.textureSize.width)),
        y: roundTestCoordinate(fixture.meshBounds.y + fixture.meshBounds.height * (alphaBounds.pixelBounds.top / fixture.textureSize.height)),
        width: roundTestCoordinate(fixture.meshBounds.width * ((alphaBounds.pixelBounds.right - alphaBounds.pixelBounds.left) / fixture.textureSize.width)),
        height: roundTestCoordinate(fixture.meshBounds.height * ((alphaBounds.pixelBounds.bottom - alphaBounds.pixelBounds.top) / fixture.textureSize.height))
      });
      expect(alphaBounds.pixelBounds.left, fixtureId).toBeLessThanOrEqual(opaquePixelBounds.left);
      expect(alphaBounds.pixelBounds.top, fixtureId).toBeLessThanOrEqual(opaquePixelBounds.top);
      expect(alphaBounds.pixelBounds.right, fixtureId).toBeGreaterThanOrEqual(opaquePixelBounds.right);
      expect(alphaBounds.pixelBounds.bottom, fixtureId).toBeGreaterThanOrEqual(opaquePixelBounds.bottom);
      expect(candidateInput.diagnostics.boundaryPointCount, fixtureId).toBe(candidateInput.boundaryPoints.length);
      expect(candidateInput.diagnostics.constraintEdgeCount, fixtureId).toBe(candidateInput.constraintEdges.length);
      expect(candidateInput.diagnostics.interiorPointCount, fixtureId).toBe(candidateInput.interiorPoints.length);
      expect(candidateInput.diagnostics.provenance, fixtureId).toEqual(
        expect.arrayContaining([
          "v6-contour-soft-alpha-mask",
          "v6-contour-boundary-loop-trace",
          "v6-contour-constraint-edge-contract",
          "v6-contour-farthest-interior-steiner-sampling"
        ])
      );
      expect(candidateInput.diagnostics.provenance.join(">"), fixtureId).not.toMatch(/earclip|fan|split/i);

      candidateInput.constraintEdges.forEach((edge, index) => {
        expect(edge, fixtureId).toEqual([index, (index + 1) % candidateInput.boundaryPoints.length]);
      });
    }
  });

  it("expands the shared v6 contour mask only when requested before boundary tracing", () => {
    const baseInput = {
      textureSize: { width: 8, height: 8 },
      meshBounds: { x: 0, y: 0, width: 8, height: 8 },
      rgbaBytes: createAlphaBytes(8, 8, [[3, 3]]),
      densityHint: "medium" as const
    };

    const compact = createV6ContourCandidateInput(baseInput);
    const expanded = createV6ContourCandidateInput({
      ...baseInput,
      maskExpansionPixels: 2
    });

    expect(compact.status).toBe("generated");
    expect(expanded.status).toBe("generated");
    if (compact.status !== "generated" || expanded.status !== "generated") {
      return;
    }

    const compactBounds = getContourPointBounds(compact.candidateInput.boundaryLoop);
    const expandedBounds = getContourPointBounds(expanded.candidateInput.boundaryLoop);

    expect(compact.candidateInput.alphaBounds.pixelBounds).toEqual({
      left: 3,
      top: 3,
      right: 4,
      bottom: 4
    });
    expect(expanded.candidateInput.alphaBounds).toEqual(compact.candidateInput.alphaBounds);
    expect(compactBounds).toEqual({
      left: 3,
      top: 3,
      right: 4,
      bottom: 4
    });
    expect(expandedBounds.left).toBeLessThan(compactBounds.left);
    expect(expandedBounds.top).toBeLessThan(compactBounds.top);
    expect(expandedBounds.right).toBeGreaterThan(compactBounds.right);
    expect(expandedBounds.bottom).toBeGreaterThan(compactBounds.bottom);
    expect(expanded.candidateInput.mainMask[3 * 8 + 1]).toBe(true);
    expect(expanded.candidateInput.mainMask[3 * 8 + 0]).toBe(false);
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

  it("generates deterministic auto-outline-v6d-contour-constrainautor meshes with shared contour input", () => {
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
        method: "auto-outline-v6d-contour-constrainautor" as const,
        densityHint: "medium" as const
      };

      const first = createGeneratedMeshForDrawable(baseInput);
      const second = createGeneratedMeshForDrawable(baseInput);

      expect(first, fixtureId).toEqual(second);
      expect(first?.fallbackReason, fixtureId).toBeUndefined();
      expect(first?.fallbackSteps, fixtureId).toBeUndefined();
      expect(first?.source, fixtureId).toBe("outline-v6d-contour-constrainautor-rgba");
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
        triangulationMode: "v6d-contour-delaunator-constrainautor",
        v6Metrics: {
          algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
          methodId: "auto-outline-v6d-contour-constrainautor",
          backendId: "v6d-contour-constrainautor",
          backendImplementationStatus: "implemented",
          requestedSourceId: "outline-v6d-contour-constrainautor-rgba",
          actualSourceId: "outline-v6d-contour-constrainautor-rgba",
          outputKind: "backend-output",
          preset: "medium",
          fallbackSteps: [],
          alphaBoundsAvailable: true,
          opaquePixelCount: fixture.opaquePixels.length,
          contourPipelineDiagnostics: {
            status: "generated",
            inputOpaquePixelCount: fixture.opaquePixels.length,
            alphaBoundsAvailable: true
          },
          constrainautorDiagnostics: {
            dependencyGateStatus: "available",
            missingConstraintEdgeCount: 0,
            constraintRecoveryFailed: false
          }
        }
      });
      const v6Metrics = first?.qualityMetrics?.v6Metrics;
      const diagnostics = v6Metrics?.constrainautorDiagnostics;
      expect(v6Metrics?.vertexCount).toBe(first?.mesh.vertices.length);
      expect(v6Metrics?.triangleCount).toBe(first?.mesh.triangles.length);
      expect(v6Metrics?.boundaryVertexCount).toBeGreaterThan(2);
      expect(v6Metrics?.interiorVertexCount).toBeGreaterThan(0);
      expect(v6Metrics?.removedTriangleCount).toBeGreaterThanOrEqual(0);
      expect(v6Metrics?.outsideOrCrossingTriangleCount).toBeGreaterThanOrEqual(0);
      expect(v6Metrics?.provenance).toEqual(
        expect.arrayContaining([
          "v6-contour-boundary-sampling",
          "v6-contour-farthest-interior-steiner-sampling",
          "v6d-delaunator-all-points",
          "v6d-constrainautor-constraint-recovery",
          "v6d-boundary-constraints-verified",
          "v6d-outside-triangle-filter"
        ])
      );
      expect(v6Metrics?.provenance.join(">"), fixtureId).not.toMatch(/earclip|fan|split/i);
      expect(diagnostics?.constraintEdgeCount).toBe(v6Metrics?.boundaryVertexCount);
      expect(diagnostics?.preservedConstraintEdgeCount).toBe(diagnostics?.constraintEdgeCount);
      expect(diagnostics?.outsideTriangleCount).toBe(v6Metrics?.outsideOrCrossingTriangleCount);
    }
  });

  it("routes auto-outline-v6d-adaptive-contour-constrainautor through old v6d topology with adaptive density", () => {
    const fixture = getV6MeshGenerationContractFixture("v6-simple-rectangle");
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
      method: "auto-outline-v6d-adaptive-contour-constrainautor",
      densityHint: "medium"
    });

    expect(generated?.source).toBe("outline-v6d-adaptive-contour-constrainautor-rgba");
    expect(generated?.fallbackReason).toBeUndefined();
    expect(generated?.fallbackSteps).toBeUndefined();
    expectValidMeshDto(generated?.mesh, {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      generationProvenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      bounds: fixture.meshBounds
    });
    expect(generated?.qualityMetrics).toMatchObject({
      triangulationMode: "v6d-adaptive-contour-constrainautor",
      v6Metrics: {
        methodId: "auto-outline-v6d-adaptive-contour-constrainautor",
        backendId: "v6d-adaptive-contour-constrainautor",
        requestedSourceId: "outline-v6d-adaptive-contour-constrainautor-rgba",
        actualSourceId: "outline-v6d-adaptive-contour-constrainautor-rgba",
        outputKind: "backend-output",
        fallbackSteps: [],
        constrainautorDiagnostics: {
          dependencyGateStatus: "available",
          missingConstraintEdgeCount: 0,
          constraintRecoveryFailed: false
        },
        adaptiveDensityDiagnostics: {
          resolvedBoundarySpacing: expect.any(Number),
          resolvedInteriorSpacing: expect.any(Number),
          resolvedMaxBoundaryVertices: expect.any(Number),
          resolvedMaxInteriorVertices: expect.any(Number),
          resolvedInteriorBoundaryClearance: expect.any(Number)
        }
      }
    });
    const v6Metrics = generated?.qualityMetrics?.v6Metrics;
    const densityDiagnostics = v6Metrics?.adaptiveDensityDiagnostics;
    expect(v6Metrics?.supportRingDiagnostics).toBeUndefined();
    expect(v6Metrics?.adaptiveStaggeredBandDiagnostics).toBeUndefined();
    expect(densityDiagnostics?.resolvedMaxInteriorVertices).toBeGreaterThan(0);
    expect(v6Metrics?.boundaryVertexCount).toBe(v6Metrics?.contourPipelineDiagnostics?.boundaryPointCount);
    expect(v6Metrics?.interiorVertexCount).toBe(v6Metrics?.contourPipelineDiagnostics?.steinerPointCount);
    expect(v6Metrics?.provenance).toEqual(
      expect.arrayContaining([
        "v6d-adaptive-density-resolved",
        "v6d-adaptive-contour-constrainautor-delaunator-all-points",
        "v6d-adaptive-contour-constrainautor-constraint-recovery",
        "v6d-adaptive-contour-constrainautor-boundary-constraints-verified",
        "v6d-adaptive-contour-constrainautor-outside-triangle-filter"
      ])
    );
    expect(v6Metrics?.provenance.join(">")).not.toMatch(/staggered|support-ring|inner-strip/i);
  });

  it("allows v6d adaptive contour-constrainautor vertices outside layer bounds while keeping original texture UVs valid", () => {
    const textureSize = { width: 24, height: 20 };
    const meshBounds = { x: 10, y: 20, width: 24, height: 20 };
    const generated = createGeneratedMeshForDrawable({
      session: createFixtureSession({
        includeBytes: true,
        textureSize,
        meshBounds,
        opaquePixels: createPixelsFromPredicate(textureSize.width, textureSize.height, (x, y) =>
          x >= 0 && x <= 13 && y >= 0 && y <= 11
        )
      }),
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6d-adaptive-contour-constrainautor",
      densityHint: "medium"
    });

    expect(generated?.source).toBe("outline-v6d-adaptive-contour-constrainautor-rgba");
    expect(generated?.fallbackReason).toBeUndefined();
    expect(generated?.fallbackSteps).toBeUndefined();
    expectValidMeshDtoAllowingOutsideBounds(generated?.mesh, {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      generationProvenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      bounds: meshBounds
    });
    const outsideVertexIndexes =
      generated?.mesh.vertices
        .map((vertex, index) => ({ vertex, index }))
        .filter(({ vertex }) =>
          vertex.x < meshBounds.x ||
          vertex.x > meshBounds.x + meshBounds.width ||
          vertex.y < meshBounds.y ||
          vertex.y > meshBounds.y + meshBounds.height
        )
        .map(({ index }) => index) ?? [];

    expect(outsideVertexIndexes.length).toBeGreaterThan(0);
    for (const index of outsideVertexIndexes) {
      const uv = generated?.mesh.uvs[index];
      expect(uv).toBeDefined();
      expect(uv?.x).toBeGreaterThanOrEqual(0);
      expect(uv?.x).toBeLessThanOrEqual(1);
      expect(uv?.y).toBeGreaterThanOrEqual(0);
      expect(uv?.y).toBeLessThanOrEqual(1);
    }
    expect(outsideVertexIndexes.some((index) => {
      const uv = generated?.mesh.uvs[index];
      return uv?.x === 0 || uv?.y === 0;
    })).toBe(true);
  });

  it("filters v6d outside and crossing triangles before backend success", () => {
    const points = [
      { x: 0, y: 0, role: "boundary", stableOrder: 0 },
      { x: 4, y: 0, role: "boundary", stableOrder: 1 },
      { x: 4, y: 4, role: "boundary", stableOrder: 2 },
      { x: 0, y: 4, role: "boundary", stableOrder: 3 },
      { x: 2, y: 2, role: "interior", stableOrder: 0 },
      { x: 5, y: 2, role: "interior", stableOrder: 1 }
    ] as const;
    const boundaryEdges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0]
    ] as const;

    const filtered = probeV6DOutsideTriangleFilterForTest({
      points,
      boundaryEdges,
      triangles: [
        [0, 1, 4],
        [1, 2, 5],
        [0, 4, 3]
      ]
    });

    expect(filtered.outsideOrCrossingTriangleCount).toBeGreaterThan(0);
    expect(filtered.removedTriangleCount).toBeGreaterThan(0);
    expect(
      countV6DProbeOutsideOrCrossingTriangles({
        points,
        boundaryEdges,
        triangles: filtered.triangles
      })
    ).toBe(0);
    expect(filtered.triangles).toEqual([
      [0, 1, 4],
      [0, 4, 3]
    ]);
  });

  it("keeps v6d thin tapered output from collapsing to one boundary spoke hub", () => {
    const fixture = getV6MeshGenerationContractFixture("v6-thin-tapered");
    const generated = createGeneratedMeshForDrawable({
      session: createFixtureSession({
        includeBytes: true,
        textureSize: fixture.textureSize,
        meshBounds: fixture.meshBounds,
        opaquePixels: fixture.opaquePixels
      }),
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6d-contour-constrainautor",
      densityHint: "medium"
    });

    expect(generated?.fallbackReason).toBeUndefined();
    expect(generated?.source).toBe("outline-v6d-contour-constrainautor-rgba");
    expect(generated?.qualityMetrics?.v6Metrics?.outputKind).toBe("backend-output");
    const boundaryVertexCount = generated?.qualityMetrics?.v6Metrics?.boundaryVertexCount ?? 0;
    const maxBoundaryNeighborCount = countMaxBoundaryNeighborCount(generated?.mesh, "_v6d_boundary_");
    expect(boundaryVertexCount).toBeGreaterThan(8);
    expect(maxBoundaryNeighborCount).toBeLessThanOrEqual(Math.max(4, Math.ceil(boundaryVertexCount * 0.35)));
  });

  it("reports v6d duplicate and crossing constraints as structured non-success", () => {
    const duplicateZeroLength = recoverV6DConstrainautorTriangles({
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
    const crossing = recoverV6DConstrainautorTriangles({
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

    expect(duplicateZeroLength).toMatchObject({
      status: "failed",
      reason: "v6d-invalid-constraint-input",
      diagnostics: {
        dependencyGateStatus: "available",
        constraintRecoveryFailed: true,
        failureStage: "constraint-input",
        invalidConstraintInputReasons: ["zero-length-constraint-edge"],
        inputPointCount: 4,
        finitePointCount: 4,
        sanitizedPointCount: 3,
        mergedPointCount: 1,
        inputConstraintEdgeCount: 4,
        sanitizedConstraintEdgeCount: 3,
        zeroLengthConstraintEdgeCount: 1,
        invalidConstraintEndpointCount: 0,
        duplicateConstraintEdgeCount: 0,
        crossingConstraintEdgeCount: 0,
        pointOnConstraintEdgeCount: 0
      }
    });
    expect(crossing).toMatchObject({
      status: "failed",
      reason: "v6d-invalid-constraint-input",
      diagnostics: {
        dependencyGateStatus: "available",
        constraintEdgeCount: 2,
        missingConstraintEdgeCount: 2,
        constraintRecoveryFailed: true,
        failureStage: "constraint-input",
        invalidConstraintInputReasons: [
          "not-enough-constraint-edges",
          "crossing-constraint-edge"
        ],
        inputPointCount: 4,
        finitePointCount: 4,
        sanitizedPointCount: 4,
        mergedPointCount: 0,
        inputConstraintEdgeCount: 2,
        sanitizedConstraintEdgeCount: 2,
        zeroLengthConstraintEdgeCount: 0,
        invalidConstraintEndpointCount: 0,
        duplicateConstraintEdgeCount: 0,
        crossingConstraintEdgeCount: 1,
        pointOnConstraintEdgeCount: 0
      }
    });
  });

  it("routes auto-outline-v6d-contour-band-support-rings as deterministic backend output with ring diagnostics", () => {
    let fixtureWithInnerRingCount = 0;
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
        method: "auto-outline-v6d-contour-band-support-rings" as const,
        densityHint: "medium" as const
      };

      const first = createGeneratedMeshForDrawable(baseInput);
      const second = createGeneratedMeshForDrawable(baseInput);

      expect(first, fixtureId).toEqual(second);
      expect(first?.fallbackReason, fixtureId).toBeUndefined();
      expect(first?.fallbackSteps, fixtureId).toBeUndefined();
      expect(first?.source, fixtureId).toBe("outline-v6d-contour-band-support-rings-rgba");
      expectValidMeshDtoAllowingOutsideBounds(first?.mesh, {
        meshId: MeshIdSchema.parse("mesh_body"),
        drawableId: baseInput.drawableId,
        generationProvenanceId: baseInput.provenanceId,
        bounds: fixture.meshBounds
      });
      expect(first?.alphaBounds).toBeDefined();
      if (first?.alphaBounds !== undefined) {
        expectRectInsideBounds(first.alphaBounds, fixture.meshBounds);
      }
      const v6Metrics = first?.qualityMetrics?.v6Metrics;
      const diagnostics = v6Metrics?.constrainautorDiagnostics;
      const supportDiagnostics = v6Metrics?.supportRingDiagnostics;
      expect(first?.qualityMetrics).toMatchObject({
        triangulationMode: "v6d-contour-delaunator-constrainautor",
        v6Metrics: {
          algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
          methodId: "auto-outline-v6d-contour-band-support-rings",
          backendId: "v6d-contour-band-support-rings",
          backendImplementationStatus: "implemented",
          requestedSourceId: "outline-v6d-contour-band-support-rings-rgba",
          actualSourceId: "outline-v6d-contour-band-support-rings-rgba",
          outputKind: "backend-output",
          preset: "medium",
          fallbackSteps: [],
          constrainautorDiagnostics: {
            dependencyGateStatus: "available",
            missingConstraintEdgeCount: 0,
            constraintRecoveryFailed: false
          },
          supportRingDiagnostics: {
            boundaryRingPointCount: expect.any(Number),
            outerRingPointCount: expect.any(Number),
            innerRingPointCount: expect.any(Number),
            supportBandTriangleCount: expect.any(Number),
            interiorTriangleCount: expect.any(Number),
            outerRingUvPolicy: "projected-to-alpha-boundary"
          }
        }
      });
      expect(v6Metrics?.methodId).not.toContain("v6g");
      expect(v6Metrics?.requestedSourceId).not.toContain("v6g");
      expect(v6Metrics?.vertexCount).toBe(first?.mesh.vertices.length);
      expect(v6Metrics?.triangleCount).toBe(first?.mesh.triangles.length);
      expect(v6Metrics?.boundaryVertexCount).toBeGreaterThan(2);
      expect(v6Metrics?.interiorVertexCount).toBeGreaterThan(v6Metrics?.boundaryVertexCount ?? 0);
      expect(diagnostics?.constraintEdgeCount).toBeGreaterThan(v6Metrics?.boundaryVertexCount ?? 0);
      expect(diagnostics?.preservedConstraintEdgeCount).toBe(diagnostics?.constraintEdgeCount);
      expect(supportDiagnostics).toMatchObject({
        alphaBoundaryRingPointCount: v6Metrics?.boundaryVertexCount,
        outerRingPointCount: v6Metrics?.boundaryVertexCount,
        skippedRingPointCount: expect.any(Number),
        mergedRingPointCount: expect.any(Number),
        ringSelfIntersectionCount: 0,
        supportBandTriangleCount: expect.any(Number),
        verticesExtendOutsideLayerBounds: expect.any(Boolean),
        maxOutsideLayerDistance: expect.any(Number)
      });
      if ((supportDiagnostics?.innerRingPointCount ?? 0) > 2) {
        fixtureWithInnerRingCount += 1;
      }
      expect(supportDiagnostics?.supportBandTriangleCount ?? 0).toBeGreaterThan(0);
      expect(supportDiagnostics?.interiorTriangleCount ?? 0).toBeGreaterThan(0);
      expect(v6Metrics?.provenance).toEqual(
        expect.arrayContaining([
          "v6-contour-boundary-sampling",
          "v6d-support-rings-outer-ring",
          "v6d-support-rings-alpha-boundary-ring",
          "v6d-support-rings-inner-ring",
          "v6d-support-rings-outer-uv-projected-to-alpha-boundary",
          "v6d-support-rings-support-envelope-triangle-filter",
          "v6d-support-rings-constraints-verified"
        ])
      );
      expect(v6Metrics?.provenance.join(">"), fixtureId).not.toMatch(/v6g|earclip|fan|split/i);
    }

    expect(fixtureWithInnerRingCount).toBeGreaterThan(0);
  });

  it("uses support-ring preset tuning for offsets", () => {
    const fixture = getV6MeshGenerationContractFixture("v6-simple-rectangle");
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
      method: "auto-outline-v6d-contour-band-support-rings" as const
    };
    const low = createGeneratedMeshForDrawable({ ...baseInput, densityHint: "low" });
    const standard = createGeneratedMeshForDrawable({ ...baseInput, densityHint: "medium" });
    const large = createGeneratedMeshForDrawable({ ...baseInput, densityHint: "high" });
    const lowDiagnostics = low?.qualityMetrics?.v6Metrics?.supportRingDiagnostics;
    const standardDiagnostics = standard?.qualityMetrics?.v6Metrics?.supportRingDiagnostics;
    const largeDiagnostics = large?.qualityMetrics?.v6Metrics?.supportRingDiagnostics;

    expect(low?.qualityMetrics?.v6Metrics?.outputKind).toBe("backend-output");
    expect(standard?.qualityMetrics?.v6Metrics?.outputKind).toBe("backend-output");
    expect(large?.qualityMetrics?.v6Metrics?.outputKind).toBe("backend-output");
    expect(standardDiagnostics?.outerRingOffset).toBeGreaterThan(lowDiagnostics?.outerRingOffset ?? 0);
    expect(largeDiagnostics?.outerRingOffset).toBeGreaterThan(standardDiagnostics?.outerRingOffset ?? 0);
    expect(standardDiagnostics?.innerRingOffset).toBeGreaterThan(lowDiagnostics?.innerRingOffset ?? 0);
    expect(largeDiagnostics?.innerRingOffset).toBeGreaterThan(standardDiagnostics?.innerRingOffset ?? 0);
  });

  it("allows v6d support-ring vertices outside layer bounds while keeping UVs valid", () => {
    const textureSize = { width: 14, height: 12 };
    const meshBounds = { x: 10, y: 20, width: 14, height: 12 };
    const generated = createGeneratedMeshForDrawable({
      session: createFixtureSession({
        includeBytes: true,
        textureSize,
        meshBounds,
        opaquePixels: createPixelsFromPredicate(textureSize.width, textureSize.height, (x, y) =>
          x >= 0 && x <= 8 && y >= 0 && y <= 7
        )
      }),
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6d-contour-band-support-rings",
      densityHint: "medium"
    });

    expect(generated?.source).toBe("outline-v6d-contour-band-support-rings-rgba");
    expect(generated?.fallbackReason).toBeUndefined();
    expectValidMeshDtoAllowingOutsideBounds(generated?.mesh, {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      generationProvenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      bounds: meshBounds
    });
    expect(
      generated?.mesh.vertices.some(
        (vertex) =>
          vertex.x < meshBounds.x ||
          vertex.x > meshBounds.x + meshBounds.width ||
          vertex.y < meshBounds.y ||
          vertex.y > meshBounds.y + meshBounds.height
      )
    ).toBe(true);
    expect(generated?.mesh.uvs.every((uv) => uv.x >= 0 && uv.x <= 1 && uv.y >= 0 && uv.y <= 1)).toBe(true);
    expect(generated?.qualityMetrics?.v6Metrics?.supportRingDiagnostics).toMatchObject({
      verticesExtendOutsideLayerBounds: true,
      maxOutsideLayerDistance: expect.any(Number),
      outerRingUvPolicy: "projected-to-alpha-boundary"
    });
    expect(
      generated?.qualityMetrics?.v6Metrics?.supportRingDiagnostics?.maxOutsideLayerDistance ?? 0
    ).toBeGreaterThan(0);
  });

  it("keeps support-band triangles whose centroids are outside alpha but inside the support envelope", () => {
    const filtered = probeV6DSupportRingTriangleFilterForTest({
      points: [
        { x: -1, y: -1, ringRole: "outer-support" },
        { x: 5, y: -1, ringRole: "outer-support" },
        { x: 5, y: 5, ringRole: "outer-support" },
        { x: -1, y: 5, ringRole: "outer-support" },
        { x: 0, y: 0, ringRole: "alpha-boundary" },
        { x: 4, y: 0, ringRole: "alpha-boundary" },
        { x: 4, y: 4, ringRole: "alpha-boundary" },
        { x: 0, y: 4, ringRole: "alpha-boundary" },
        { x: 1, y: 1, ringRole: "inner-support" }
      ],
      outerRingEdges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0]
      ],
      alphaRingEdges: [
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4]
      ],
      triangles: [
        [0, 1, 5],
        [4, 5, 8]
      ]
    });

    expect(filtered.removedTriangleCount).toBe(0);
    expect(filtered.outsideOrCrossingTriangleCount).toBe(0);
    expect(filtered.supportBandTriangleCount).toBe(1);
    expect(filtered.alphaBoundaryBandTriangleCount).toBe(1);
    expect(filtered.triangles).toContainEqual([0, 1, 5]);
  });

  it("reports v6d support-ring invalid geometry as structured fallback output", () => {
    const fallback = probeV6DSupportRingGeometryFallbackForTest();

    expect(fallback.status).toBe("fallback");
    if (fallback.status !== "fallback") {
      throw new Error("Expected support-ring probe to return fallback output.");
    }

    expect(fallback.source).toBe("alpha-aware-rgba");
    expect(fallback.reason).toBe("v6d-support-ring-geometry-invalid");
    expect(fallback.fallbackSteps).toEqual([
      {
        method: "auto-outline-v6d-contour-band-support-rings",
        reason: "v6d-support-ring-geometry-invalid"
      }
    ]);
    expectValidMeshDto(fallback.mesh, {
      meshId: MeshIdSchema.parse("mesh_v6d_support_probe"),
      drawableId: DrawableIdSchema.parse("draw_v6d_support_probe"),
      generationProvenanceId: ProvenanceIdSchema.parse("prov_v6d_support_probe"),
      bounds: { x: 0, y: 0, width: 8, height: 8 }
    });
    expect(fallback.qualityMetrics).toMatchObject({
      fallbackReason: "v6d-support-ring-geometry-invalid",
      triangulationMode: "v6-backend-blocked-fallback",
      v6Metrics: {
        methodId: "auto-outline-v6d-contour-band-support-rings",
        backendId: "v6d-contour-band-support-rings",
        requestedSourceId: "outline-v6d-contour-band-support-rings-rgba",
        actualSourceId: "alpha-aware-rgba",
        outputKind: "fallback-output",
        fallbackReason: "v6d-support-ring-geometry-invalid",
        constrainautorDiagnostics: {
          dependencyGateStatus: "available",
          constraintRecoveryFailed: true
        },
        supportRingDiagnostics: {
          alphaBoundaryRingPointCount: expect.any(Number),
          outerRingPointCount: expect.any(Number),
          mergedRingPointCount: 1,
          ringSelfIntersectionCount: 1,
          supportBandTriangleCount: 0,
          interiorTriangleCount: 0,
          outerRingUvPolicy: "projected-to-alpha-boundary"
        }
      }
    });
    const v6Metrics = fallback.qualityMetrics.v6Metrics;
    expect(v6Metrics?.outputKind).not.toBe("backend-output");
    expect(v6Metrics?.fallbackSteps).toEqual(fallback.fallbackSteps);
    expect(v6Metrics?.constrainautorDiagnostics?.missingConstraintEdgeCount).toBe(
      v6Metrics?.constrainautorDiagnostics?.constraintEdgeCount
    );
    expect(v6Metrics?.supportRingDiagnostics?.ringSelfIntersectionCount).toBeGreaterThan(0);
    expect(v6Metrics?.provenance).toEqual(
      expect.arrayContaining([
        "v6d-support-rings-visible-fallback",
        "fallback-v6d-support-ring-geometry-invalid",
        "v6d-support-ring-test-probe-invalid-geometry"
      ])
    );
  });

  it("reports v6d support-ring empty and missing alpha as blocked without claiming backend output", () => {
    const emptyFixture = getV6MeshGenerationContractFixture("v6-empty-alpha-fallback");
    const emptyGenerated = createGeneratedMeshForDrawable({
      session: createFixtureSession({
        includeBytes: true,
        textureSize: emptyFixture.textureSize,
        meshBounds: emptyFixture.meshBounds,
        opaquePixels: emptyFixture.opaquePixels
      }),
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6d-contour-band-support-rings",
      densityHint: "low"
    });

    expect(emptyGenerated?.source).toBe("bounds-grid");
    expect(emptyGenerated?.fallbackReason).toBe("alpha-empty");
    expect(emptyGenerated?.fallbackSteps).toEqual([
      { method: "auto-outline-v6d-contour-band-support-rings", reason: "alpha-empty" }
    ]);
    expect(emptyGenerated?.qualityMetrics?.v6Metrics).toMatchObject({
      methodId: "auto-outline-v6d-contour-band-support-rings",
      backendId: "v6d-contour-band-support-rings",
      backendImplementationStatus: "implemented",
      requestedSourceId: "outline-v6d-contour-band-support-rings-rgba",
      actualSourceId: "bounds-grid",
      outputKind: "blocked",
      fallbackReason: "alpha-empty",
      alphaBoundsAvailable: false,
      opaquePixelCount: 0,
      constrainautorDiagnostics: {
        dependencyGateStatus: "available",
        constraintEdgeCount: 0,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: 0,
        constraintRecoveryFailed: false
      },
      supportRingDiagnostics: {
        boundaryRingPointCount: 0,
        alphaBoundaryRingPointCount: 0,
        outerRingPointCount: 0,
        innerRingPointCount: 0,
        skippedRingPointCount: 0,
        mergedRingPointCount: 0,
        supportBandTriangleCount: 0,
        interiorTriangleCount: 0,
        verticesExtendOutsideLayerBounds: false,
        maxOutsideLayerDistance: 0,
        outerRingOffset: 0,
        innerRingOffset: 0,
        outerRingUvPolicy: "projected-to-alpha-boundary"
      }
    });
    expect(emptyGenerated?.qualityMetrics?.v6Metrics?.outputKind).not.toBe("backend-output");

    const missingFixture = getV6MeshGenerationContractFixture("v6-simple-rectangle");
    const missingGenerated = createGeneratedMeshForDrawable({
      session: createFixtureSession({
        includeBytes: false,
        textureSize: missingFixture.textureSize,
        meshBounds: missingFixture.meshBounds,
        opaquePixels: missingFixture.opaquePixels
      }),
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6d-contour-band-support-rings",
      densityHint: "low"
    });

    expect(missingGenerated?.source).toBe("bounds-grid");
    expect(missingGenerated?.fallbackReason).toBe("texture-bytes-unavailable");
    expect(missingGenerated?.fallbackSteps).toEqual([
      { method: "auto-outline-v6d-contour-band-support-rings", reason: "texture-bytes-unavailable" }
    ]);
    expect(missingGenerated?.qualityMetrics?.v6Metrics).toMatchObject({
      methodId: "auto-outline-v6d-contour-band-support-rings",
      backendId: "v6d-contour-band-support-rings",
      backendImplementationStatus: "implemented",
      requestedSourceId: "outline-v6d-contour-band-support-rings-rgba",
      actualSourceId: "bounds-grid",
      outputKind: "blocked",
      fallbackReason: "texture-bytes-unavailable",
      alphaBoundsAvailable: false,
      supportRingDiagnostics: {
        boundaryRingPointCount: 0,
        alphaBoundaryRingPointCount: 0,
        outerRingPointCount: 0,
        innerRingPointCount: 0,
        supportBandTriangleCount: 0,
        interiorTriangleCount: 0,
        verticesExtendOutsideLayerBounds: false,
        outerRingUvPolicy: "projected-to-alpha-boundary"
      }
    });
    expect(missingGenerated?.qualityMetrics?.v6Metrics?.contourPipelineDiagnostics).toBeUndefined();
    expect(missingGenerated?.qualityMetrics?.v6Metrics?.outputKind).not.toBe("backend-output");
  });

  it("resolves shared v6d adaptive density from current tuned baselines and part size", () => {
    const highReference = resolveV6DAdaptiveDensityForTest({
      densityHint: "high",
      selectedComponentPixelCount: 73_936
    });
    const reference = resolveV6DAdaptiveDensityForTest({
      densityHint: "medium",
      selectedComponentPixelCount: 73_936
    });
    const lowReference = resolveV6DAdaptiveDensityForTest({
      densityHint: "low",
      selectedComponentPixelCount: 73_936
    });
    const alphaBoundsFallback = resolveV6DAdaptiveDensityForTest({
      densityHint: "medium",
      alphaBoundsArea: 400 * 288
    });
    const smaller = resolveV6DAdaptiveDensityForTest({
      densityHint: "medium",
      selectedComponentPixelCount: Math.round(73_936 * 0.25)
    });
    const larger = resolveV6DAdaptiveDensityForTest({
      densityHint: "medium",
      selectedComponentPixelCount: Math.round(73_936 * 3)
    });
    const maxedBoundaryCap = resolveV6DAdaptiveDensityForTest({
      densityHint: "medium",
      selectedComponentPixelCount: 73_936 * 4
    });

    expect(highReference.parameters).toEqual({
      boundarySpacing: 8,
      interiorSpacing: 7.5,
      maxBoundaryVertices: 128,
      maxInteriorVertices: 64,
      interiorBoundaryClearance: 1.1
    });
    expect(reference.parameters).toEqual({
      boundarySpacing: 12,
      interiorSpacing: 10,
      maxBoundaryVertices: 128,
      maxInteriorVertices: 32,
      interiorBoundaryClearance: 1.1
    });
    expect(reference.diagnostics).toMatchObject({
      adaptiveDensityReferenceArea: 73_936,
      adaptiveDensityEffectiveArea: 73_936,
      adaptiveDensityAreaRatio: 1,
      adaptiveDensitySpacingScale: 1,
      adaptiveDensityVertexScale: 1,
      adaptiveDensityBoundaryCapScale: 1,
      resolvedBoundarySpacing: 12,
      resolvedInteriorSpacing: 10,
      resolvedMaxBoundaryVertices: 128,
      resolvedMaxInteriorVertices: 32,
      resolvedInteriorBoundaryClearance: 1.1
    });
    expect(lowReference.parameters).toEqual({
      boundarySpacing: 30,
      interiorSpacing: 15,
      maxBoundaryVertices: 64,
      maxInteriorVertices: 16,
      interiorBoundaryClearance: 1.5
    });
    expect(alphaBoundsFallback.parameters).toEqual(reference.parameters);
    expect(alphaBoundsFallback.diagnostics).toMatchObject({
      adaptiveDensityReferenceArea: 400 * 288,
      adaptiveDensityEffectiveArea: 400 * 288,
      adaptiveDensityAreaRatio: 1,
      adaptiveDensitySpacingScale: 1,
      adaptiveDensityVertexScale: 1,
      adaptiveDensityBoundaryCapScale: 1,
      resolvedBoundarySpacing: 12,
      resolvedInteriorSpacing: 10,
      resolvedMaxBoundaryVertices: 128,
      resolvedMaxInteriorVertices: 32,
      resolvedInteriorBoundaryClearance: 1.1
    });
    expect(smaller.parameters.maxInteriorVertices).toBeLessThan(reference.parameters.maxInteriorVertices);
    expect(larger.parameters.maxInteriorVertices).toBeGreaterThan(reference.parameters.maxInteriorVertices);
    expect(larger.parameters.maxBoundaryVertices).toBeGreaterThanOrEqual(reference.parameters.maxBoundaryVertices);
    expect(larger.parameters.maxInteriorVertices).toBeGreaterThanOrEqual(smaller.parameters.maxInteriorVertices);
    expect(maxedBoundaryCap.parameters.maxBoundaryVertices).toBe(256);
    expect(maxedBoundaryCap.diagnostics.adaptiveDensityBoundaryCapScale).toBe(2);
  });

  it("builds v6d adaptive staggered inner points from edge midpoints and explicit strip topology", () => {
    const probe = probeV6DAdaptiveStaggeredBandStripGeometryForTest();

    expect(probe.alphaPoints.length).toBeGreaterThan(2);
    expect(probe.staggeredInnerPoints).toHaveLength(probe.alphaPoints.length);
    expect(probe.innerGlobalIndexByBoundaryIndex).toHaveLength(probe.alphaPoints.length);
    expect(probe.explicitAlphaInnerStripTriangles).toHaveLength(probe.alphaPoints.length * 2);
    for (let index = 0; index < probe.alphaPoints.length; index += 1) {
      const next = (index + 1) % probe.alphaPoints.length;
      expect(probe.explicitAlphaInnerStripTriangles[index * 2]).toEqual([
        probe.alphaStart + index,
        probe.alphaStart + next,
        probe.innerGlobalIndexByBoundaryIndex[index]
      ]);
      expect(probe.explicitAlphaInnerStripTriangles[index * 2 + 1]).toEqual([
        probe.alphaStart + next,
        probe.innerGlobalIndexByBoundaryIndex[next],
        probe.innerGlobalIndexByBoundaryIndex[index]
      ]);
    }

    const alphaPointKeys = new Set(probe.alphaPoints.map((point) => `${point.x}:${point.y}`));
    const hasMidpointShiftedInnerPoint = probe.staggeredInnerPoints.some((innerPoint, index) => {
      const start = probe.alphaPoints[index];
      const end = probe.alphaPoints[(index + 1) % probe.alphaPoints.length];
      if (start === undefined || end === undefined) {
        return false;
      }

      const midpoint = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2
      };
      const midpointDistance = Math.hypot(innerPoint.x - midpoint.x, innerPoint.y - midpoint.y);
      const startDistance = Math.hypot(innerPoint.x - start.x, innerPoint.y - start.y);
      const endDistance = Math.hypot(innerPoint.x - end.x, innerPoint.y - end.y);
      return (
        midpointDistance > 0 &&
        midpointDistance < startDistance &&
        midpointDistance < endDistance &&
        startDistance > 0 &&
        endDistance > 0 &&
        !alphaPointKeys.has(`${innerPoint.x}:${innerPoint.y}`)
      );
    });

    expect(hasMidpointShiftedInnerPoint).toBe(true);
    expect(probe.directAlphaToInteriorEdgeCount).toBe(0);
  });

  it("routes auto-outline-v6d-adaptive-staggered-band with explicit strip diagnostics", () => {
    const fixture = getV6MeshGenerationContractFixture("v6-simple-rectangle");
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
      method: "auto-outline-v6d-adaptive-staggered-band",
      densityHint: "medium"
    });

    expect(generated?.source).toBe("outline-v6d-adaptive-staggered-band-rgba");
    expect(generated?.fallbackReason).toBeUndefined();
    expect(generated?.fallbackSteps).toBeUndefined();
    expectValidMeshDtoAllowingOutsideBounds(generated?.mesh, {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      generationProvenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      bounds: fixture.meshBounds
    });
    const v6Metrics = generated?.qualityMetrics?.v6Metrics;
    const adaptiveDiagnostics = v6Metrics?.adaptiveStaggeredBandDiagnostics;
    expect(generated?.qualityMetrics).toMatchObject({
      triangulationMode: "v6d-adaptive-staggered-band",
      v6Metrics: {
        methodId: "auto-outline-v6d-adaptive-staggered-band",
        backendId: "v6d-adaptive-staggered-band",
        requestedSourceId: "outline-v6d-adaptive-staggered-band-rgba",
        actualSourceId: "outline-v6d-adaptive-staggered-band-rgba",
        outputKind: "backend-output",
        fallbackSteps: [],
        supportRingDiagnostics: {
          alphaBoundaryRingPointCount: expect.any(Number),
          innerRingPointCount: expect.any(Number),
          alphaBoundaryBandTriangleCount: expect.any(Number)
        },
        adaptiveStaggeredBandDiagnostics: {
          resolvedBoundarySpacing: expect.any(Number),
          resolvedInteriorSpacing: expect.any(Number),
          resolvedMaxInteriorVertices: expect.any(Number),
          staggeredInnerPointCount: expect.any(Number),
          skippedStaggeredInnerPointCount: 0,
          explicitAlphaInnerStripTriangleCount: expect.any(Number),
          degenerateExplicitStripTriangleCount: 0,
          directAlphaToInteriorEdgeCount: 0,
          interiorFillUsesStaggeredInnerBoundary: true
        }
      }
    });
    expect(v6Metrics?.methodId).not.toContain("v6g");
    expect(v6Metrics?.requestedSourceId).not.toContain("v6g");
    expect(adaptiveDiagnostics?.staggeredInnerPointCount).toBe(v6Metrics?.boundaryVertexCount);
    expect(adaptiveDiagnostics?.explicitAlphaInnerStripTriangleCount).toBe(
      (adaptiveDiagnostics?.staggeredInnerPointCount ?? 0) * 2
    );
    expect(adaptiveDiagnostics?.interiorPointCountBeforeInnerFilter ?? 0).toBeGreaterThanOrEqual(
      adaptiveDiagnostics?.interiorPointCountAfterInnerFilter ?? 0
    );
    expect(v6Metrics?.provenance).toEqual(
      expect.arrayContaining([
        "v6d-adaptive-density-resolved",
        "v6d-adaptive-staggered-band-edge-midpoint-inner-ring",
        "v6d-adaptive-staggered-band-explicit-alpha-inner-strip",
        "v6d-adaptive-staggered-band-inner-boundary-interior-fill",
        "v6d-adaptive-staggered-band-no-alpha-to-ordinary-interior-edges"
      ])
    );
  });

  it("falls back from globally invalid adaptive staggered-strip geometry to Wave70 support-ring v6d before coarse fallback", () => {
    const fallback = probeV6DAdaptiveStaggeredBandWave70FallbackForTest();

    expect(fallback.status).toBe("fallback");
    if (fallback.status !== "fallback") {
      throw new Error("Expected adaptive staggered-band probe to return fallback output.");
    }

    expect(fallback.source).toBe("outline-v6d-contour-band-support-rings-rgba");
    expect(fallback.reason).toBe("v6d-adaptive-staggered-band-geometry-invalid");
    expect(fallback.fallbackSteps[0]).toEqual({
      method: "auto-outline-v6d-adaptive-staggered-band",
      reason: "v6d-adaptive-staggered-band-geometry-invalid"
    });
    expect(fallback.fallbackSteps).not.toContainEqual({
      method: "auto-outline-v6d-contour-band-support-rings",
      reason: "v6d-support-ring-geometry-invalid"
    });
    expect(fallback.qualityMetrics.v6Metrics).toMatchObject({
      methodId: "auto-outline-v6d-adaptive-staggered-band",
      backendId: "v6d-adaptive-staggered-band",
      requestedSourceId: "outline-v6d-adaptive-staggered-band-rgba",
      actualSourceId: "outline-v6d-contour-band-support-rings-rgba",
      outputKind: "fallback-output",
      fallbackReason: "v6d-adaptive-staggered-band-geometry-invalid",
      supportRingDiagnostics: {
        outerRingPointCount: expect.any(Number),
        innerRingPointCount: expect.any(Number)
      },
      adaptiveStaggeredBandDiagnostics: {
        fallbackFromAdaptiveStaggeredReason: "v6d-adaptive-staggered-band-geometry-invalid",
        explicitAlphaInnerStripTriangleCount: 0
      }
    });
    expect(fallback.qualityMetrics.v6Metrics?.provenance).toEqual(
      expect.arrayContaining([
        "v6d-adaptive-staggered-band-wave70-support-ring-fallback",
        "v6d-adaptive-staggered-band-test-probe-wave70-fallback"
      ])
    );
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

  it("routes auto-outline-v6e-contour-poly2tri through public drawable generation as backend output", () => {
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
      method: "auto-outline-v6e-contour-poly2tri" as const,
      densityHint: "medium" as const
    };

    const first = createGeneratedMeshForDrawable(baseInput);
    const second = createGeneratedMeshForDrawable(baseInput);

    expect(first).toEqual(second);
    expect(first?.source).toBe("outline-v6e-contour-poly2tri-rgba");
    expect(first?.fallbackReason).toBeUndefined();
    expect(first?.fallbackSteps).toBeUndefined();
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
      triangulationMode: "v6e-contour-poly2tri-constrained-polygon",
      v6Metrics: {
        algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
        methodId: "auto-outline-v6e-contour-poly2tri",
        backendId: "v6e-contour-poly2tri",
        backendImplementationStatus: "implemented",
        requestedSourceId: "outline-v6e-contour-poly2tri-rgba",
        actualSourceId: "outline-v6e-contour-poly2tri-rgba",
        outputKind: "backend-output",
        preset: "medium",
        fallbackSteps: [],
        alphaBoundsAvailable: true,
        opaquePixelCount: fixture.opaquePixels.length,
        contourPipelineDiagnostics: {
          status: "generated",
          inputOpaquePixelCount: fixture.opaquePixels.length,
          alphaBoundsAvailable: true
        },
        poly2triDiagnostics: {
          dependencyGateStatus: "available",
          polygonValidationFailed: false,
          holeValidationFailed: false,
          triangulationThrown: false,
          boundaryEdgeMissingCount: 0
        }
      }
    });
    const v6Metrics = first?.qualityMetrics?.v6Metrics;
    const diagnostics = v6Metrics?.poly2triDiagnostics;
    expect(v6Metrics?.fallbackReason).toBeUndefined();
    expect(v6Metrics?.vertexCount).toBe(first?.mesh.vertices.length);
    expect(v6Metrics?.triangleCount).toBe(first?.mesh.triangles.length);
    expect(v6Metrics?.boundaryVertexCount).toBeGreaterThan(2);
    expect(v6Metrics?.interiorVertexCount).toBeGreaterThan(0);
    expect(diagnostics?.outerPointCount).toBe(v6Metrics?.boundaryVertexCount);
    expect(diagnostics?.steinerPointCount).toBe(v6Metrics?.interiorVertexCount);
    expect(diagnostics?.boundaryEdgePreservedCount).toBe(v6Metrics?.boundaryVertexCount);
    expect(v6Metrics?.provenance).toEqual(
      expect.arrayContaining([
        "shared-v6-contour-pipeline",
        "v6e-poly2tri-normalized-winding",
        "v6e-poly2tri-constrained-polygon-triangulation",
        "v6e-poly2tri-boundary-preserved"
      ])
    );
  });

  it("routes auto-outline-v6e-contour-poly2tri hole-like input to visible fallback metadata", () => {
    const fixture = getV6MeshGenerationContractFixture("v6-hole-like");
    const generated = createGeneratedMeshForDrawable({
      session: createFixtureSession({
        includeBytes: true,
        textureSize: fixture.textureSize,
        meshBounds: fixture.meshBounds,
        opaquePixels: fixture.opaquePixels
      }),
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6e-contour-poly2tri",
      densityHint: "medium"
    });

    expect(generated?.source).toBe("alpha-aware-rgba");
    expect(generated?.fallbackReason).toBe("v6e-poly2tri-polygon-invalid");
    expect(generated?.fallbackSteps).toEqual([
      { method: "auto-outline-v6e-contour-poly2tri", reason: "v6e-poly2tri-polygon-invalid" }
    ]);
    expectValidMeshDto(generated?.mesh, {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      generationProvenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      bounds: fixture.meshBounds
    });
    expect(generated?.qualityMetrics).toMatchObject({
      fallbackReason: "v6e-poly2tri-polygon-invalid",
      triangulationMode: "v6-backend-blocked-fallback",
      v6Metrics: {
        methodId: "auto-outline-v6e-contour-poly2tri",
        backendId: "v6e-contour-poly2tri",
        backendImplementationStatus: "implemented",
        requestedSourceId: "outline-v6e-contour-poly2tri-rgba",
        actualSourceId: "alpha-aware-rgba",
        outputKind: "fallback-output",
        fallbackReason: "v6e-poly2tri-polygon-invalid",
        fallbackSteps: [
          { method: "auto-outline-v6e-contour-poly2tri", reason: "v6e-poly2tri-polygon-invalid" }
        ],
        holeHandling: "unsupported-fallback",
        poly2triDiagnostics: {
          dependencyGateStatus: "available",
          holeValidationFailed: true,
          triangulationThrown: false
        }
      }
    });
    const v6Metrics = generated?.qualityMetrics?.v6Metrics;
    expect(v6Metrics?.outputKind).not.toBe("backend-output");
    expect(v6Metrics?.holeLikeRegionCount).toBeGreaterThan(0);
    expect(v6Metrics?.poly2triDiagnostics?.holeCount).toBeGreaterThan(0);
    expect(v6Metrics?.provenance).toEqual(
      expect.arrayContaining([
        "shared-v6-contour-pipeline",
        "limitation-hole-regions-reported",
        "fallback-hole-unsupported"
      ])
    );
  });

  it("routes auto-outline-v6e-contour-poly2tri empty alpha and missing texture as blocked metadata", () => {
    const emptyFixture = getV6MeshGenerationContractFixture("v6-empty-alpha-fallback");
    const emptyGenerated = createGeneratedMeshForDrawable({
      session: createFixtureSession({
        includeBytes: true,
        textureSize: emptyFixture.textureSize,
        meshBounds: emptyFixture.meshBounds,
        opaquePixels: emptyFixture.opaquePixels
      }),
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6e-contour-poly2tri",
      densityHint: "low"
    });

    expect(emptyGenerated?.source).toBe("bounds-grid");
    expect(emptyGenerated?.fallbackReason).toBe("alpha-empty");
    expect(emptyGenerated?.fallbackSteps).toEqual([
      { method: "auto-outline-v6e-contour-poly2tri", reason: "alpha-empty" }
    ]);
    expect(emptyGenerated?.qualityMetrics?.v6Metrics).toMatchObject({
      methodId: "auto-outline-v6e-contour-poly2tri",
      backendId: "v6e-contour-poly2tri",
      backendImplementationStatus: "implemented",
      requestedSourceId: "outline-v6e-contour-poly2tri-rgba",
      actualSourceId: "bounds-grid",
      outputKind: "blocked",
      fallbackReason: "alpha-empty",
      alphaBoundsAvailable: false,
      opaquePixelCount: 0,
      contourPipelineDiagnostics: {
        status: "blocked",
        inputOpaquePixelCount: 0,
        softMaskOpaquePixelCount: 0,
        alphaBoundsAvailable: false,
        blockedReason: "alpha-empty"
      },
      poly2triDiagnostics: {
        dependencyGateStatus: "available",
        outerPointCount: 0,
        steinerPointCount: 0,
        boundaryEdgePreservedCount: 0,
        boundaryEdgeMissingCount: 0,
        triangulationThrown: false
      }
    });
    expect(emptyGenerated?.qualityMetrics?.v6Metrics?.outputKind).not.toBe("backend-output");

    const missingFixture = getV6MeshGenerationContractFixture("v6-simple-rectangle");
    const missingGenerated = createGeneratedMeshForDrawable({
      session: createFixtureSession({
        includeBytes: false,
        textureSize: missingFixture.textureSize,
        meshBounds: missingFixture.meshBounds,
        opaquePixels: missingFixture.opaquePixels
      }),
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6e-contour-poly2tri",
      densityHint: "low"
    });

    expect(missingGenerated?.source).toBe("bounds-grid");
    expect(missingGenerated?.fallbackReason).toBe("texture-bytes-unavailable");
    expect(missingGenerated?.fallbackSteps).toEqual([
      { method: "auto-outline-v6e-contour-poly2tri", reason: "texture-bytes-unavailable" }
    ]);
    expect(missingGenerated?.qualityMetrics?.v6Metrics).toMatchObject({
      methodId: "auto-outline-v6e-contour-poly2tri",
      backendId: "v6e-contour-poly2tri",
      backendImplementationStatus: "implemented",
      requestedSourceId: "outline-v6e-contour-poly2tri-rgba",
      actualSourceId: "bounds-grid",
      outputKind: "blocked",
      fallbackReason: "texture-bytes-unavailable",
      alphaBoundsAvailable: false,
      poly2triDiagnostics: {
        dependencyGateStatus: "available",
        outerPointCount: 0,
        steinerPointCount: 0,
        boundaryEdgePreservedCount: 0,
        boundaryEdgeMissingCount: 0,
        triangulationThrown: false
      }
    });
    expect(missingGenerated?.qualityMetrics?.v6Metrics?.contourPipelineDiagnostics).toBeUndefined();
    expect(missingGenerated?.qualityMetrics?.v6Metrics?.outputKind).not.toBe("backend-output");
  });

  it("routes still-deferred v6 contour candidates through explicit non-success fallback metadata", () => {
    const fixture = getV6MeshGenerationContractFixture("v6-simple-rectangle");
    const newContourDeferredCandidates = V6_MESH_GENERATION_CANDIDATES.filter(
      (entry) =>
        (entry.backendImplementationStatus as string) === "deferred" &&
        (entry.methodId === "auto-outline-v6d-contour-constrainautor" ||
          entry.methodId === "auto-outline-v6e-contour-poly2tri" ||
          entry.methodId === "auto-outline-v6f-contour-custom-cdt")
    );

    expect(newContourDeferredCandidates).toEqual([]);

    for (const candidate of V6_MESH_GENERATION_CANDIDATES.filter(
      (entry) =>
        (entry.backendImplementationStatus as string) === "deferred" &&
        entry.methodId !== "auto-outline-v6d-contour-constrainautor" &&
        entry.methodId !== "auto-outline-v6e-contour-poly2tri"
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
          multiIslandHandling: "supported",
          holeHandling: "supported",
          contourPipelineDiagnostics: {
            status: "generated",
            inputOpaquePixelCount: fixture.opaquePixels.length,
            alphaBoundsAvailable: true
          }
        }
      });
      expect(generated?.qualityMetrics?.v6Metrics?.vertexCount).toBe(generated?.mesh.vertices.length);
      expect(generated?.qualityMetrics?.v6Metrics?.triangleCount).toBe(generated?.mesh.triangles.length);
      expect(generated?.qualityMetrics?.v6Metrics?.boundaryVertexCount).toBeGreaterThan(0);
      expect(generated?.qualityMetrics?.v6Metrics?.opaquePixelCount).toBe(fixture.opaquePixels.length);
      const v6Metrics = generated?.qualityMetrics?.v6Metrics;

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

  it("reports v6d empty and missing alpha as blocked without claiming constrained success", () => {
    const emptyFixture = getV6MeshGenerationContractFixture("v6-empty-alpha-fallback");
    const emptyGenerated = createGeneratedMeshForDrawable({
      session: createFixtureSession({
        includeBytes: true,
        textureSize: emptyFixture.textureSize,
        meshBounds: emptyFixture.meshBounds,
        opaquePixels: emptyFixture.opaquePixels
      }),
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6d-contour-constrainautor",
      densityHint: "low"
    });

    expect(emptyGenerated?.source).toBe("bounds-grid");
    expect(emptyGenerated?.fallbackReason).toBe("alpha-empty");
    expect(emptyGenerated?.fallbackSteps).toEqual([
      { method: "auto-outline-v6d-contour-constrainautor", reason: "alpha-empty" }
    ]);
    expect(emptyGenerated?.qualityMetrics?.v6Metrics).toMatchObject({
      methodId: "auto-outline-v6d-contour-constrainautor",
      backendId: "v6d-contour-constrainautor",
      backendImplementationStatus: "implemented",
      requestedSourceId: "outline-v6d-contour-constrainautor-rgba",
      actualSourceId: "bounds-grid",
      outputKind: "blocked",
      fallbackReason: "alpha-empty",
      alphaBoundsAvailable: false,
      opaquePixelCount: 0,
      contourPipelineDiagnostics: {
        status: "blocked",
        inputOpaquePixelCount: 0,
        softMaskOpaquePixelCount: 0,
        alphaBoundsAvailable: false,
        blockedReason: "alpha-empty"
      },
      constrainautorDiagnostics: {
        dependencyGateStatus: "available",
        constraintEdgeCount: 0,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: 0,
        constraintRecoveryFailed: false
      }
    });

    const missingFixture = getV6MeshGenerationContractFixture("v6-simple-rectangle");
    const missingGenerated = createGeneratedMeshForDrawable({
      session: createFixtureSession({
        includeBytes: false,
        textureSize: missingFixture.textureSize,
        meshBounds: missingFixture.meshBounds,
        opaquePixels: missingFixture.opaquePixels
      }),
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      method: "auto-outline-v6d-contour-constrainautor",
      densityHint: "low"
    });

    expect(missingGenerated?.source).toBe("bounds-grid");
    expect(missingGenerated?.fallbackReason).toBe("texture-bytes-unavailable");
    expect(missingGenerated?.fallbackSteps).toEqual([
      { method: "auto-outline-v6d-contour-constrainautor", reason: "texture-bytes-unavailable" }
    ]);
    expect(missingGenerated?.qualityMetrics?.v6Metrics).toMatchObject({
      methodId: "auto-outline-v6d-contour-constrainautor",
      backendId: "v6d-contour-constrainautor",
      backendImplementationStatus: "implemented",
      requestedSourceId: "outline-v6d-contour-constrainautor-rgba",
      actualSourceId: "bounds-grid",
      outputKind: "blocked",
      fallbackReason: "texture-bytes-unavailable",
      alphaBoundsAvailable: false,
      constrainautorDiagnostics: {
        dependencyGateStatus: "available",
        constraintEdgeCount: 0,
        preservedConstraintEdgeCount: 0,
        missingConstraintEdgeCount: 0,
        constraintRecoveryFailed: false
      }
    });
    expect(missingGenerated?.qualityMetrics?.v6Metrics?.contourPipelineDiagnostics).toBeUndefined();
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

  it("reports v6F custom CDT empty and missing alpha as implemented blocked metadata", () => {
    const customCdtCandidates = V6_MESH_GENERATION_CANDIDATES.filter(
      (candidate) => candidate.backendId === "v6f-contour-custom-cdt"
    );
    const emptyFixture = getV6MeshGenerationContractFixture("v6-empty-alpha-fallback");
    const emptySession = createFixtureSession({
      includeBytes: true,
      textureSize: emptyFixture.textureSize,
      meshBounds: emptyFixture.meshBounds,
      opaquePixels: emptyFixture.opaquePixels
    });
    const missingFixture = getV6MeshGenerationContractFixture("v6-simple-rectangle");
    const missingBytesSession = createFixtureSession({
      includeBytes: false,
      textureSize: missingFixture.textureSize,
      meshBounds: missingFixture.meshBounds,
      opaquePixels: missingFixture.opaquePixels
    });

    for (const candidate of customCdtCandidates) {
      const emptyGenerated = createGeneratedMeshForDrawable({
        session: emptySession,
        drawableId: DrawableIdSchema.parse("draw_body"),
        provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
        method: candidate.methodId,
        densityHint: "low"
      });

      expect(emptyGenerated?.source).toBe("bounds-grid");
      expect(emptyGenerated?.fallbackReason).toBe("alpha-empty");
      expect(emptyGenerated?.fallbackSteps).toEqual([{ method: candidate.methodId, reason: "alpha-empty" }]);
      expect(emptyGenerated?.qualityMetrics?.v6Metrics).toMatchObject({
        methodId: candidate.methodId,
        backendId: candidate.backendId,
        backendImplementationStatus: "implemented",
        requestedSourceId: candidate.sourceId,
        actualSourceId: "bounds-grid",
        outputKind: "blocked",
        fallbackReason: "alpha-empty",
        alphaBoundsAvailable: false,
        opaquePixelCount: 0,
        contourPipelineDiagnostics: {
          status: "blocked",
          inputOpaquePixelCount: 0,
          softMaskOpaquePixelCount: 0,
          alphaBoundsAvailable: false,
          blockedReason: "alpha-empty"
        }
      });
      expect(emptyGenerated?.qualityMetrics?.v6Metrics?.outputKind).not.toBe("backend-output");
      expectDeferredCandidateZeroDiagnostics(candidate.backendId, emptyGenerated?.qualityMetrics?.v6Metrics);

      const missingGenerated = createGeneratedMeshForDrawable({
        session: missingBytesSession,
        drawableId: DrawableIdSchema.parse("draw_body"),
        provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
        method: candidate.methodId,
        densityHint: "low"
      });

      expect(missingGenerated?.source).toBe("bounds-grid");
      expect(missingGenerated?.fallbackReason).toBe("texture-bytes-unavailable");
      expect(missingGenerated?.fallbackSteps).toEqual([
        { method: candidate.methodId, reason: "texture-bytes-unavailable" }
      ]);
      expect(missingGenerated?.qualityMetrics?.v6Metrics).toMatchObject({
        methodId: candidate.methodId,
        backendId: candidate.backendId,
        backendImplementationStatus: "implemented",
        requestedSourceId: candidate.sourceId,
        actualSourceId: "bounds-grid",
        outputKind: "blocked",
        fallbackReason: "texture-bytes-unavailable",
        alphaBoundsAvailable: false
      });
      expect(missingGenerated?.qualityMetrics?.v6Metrics?.contourPipelineDiagnostics).toBeUndefined();
      expect(missingGenerated?.qualityMetrics?.v6Metrics?.outputKind).not.toBe("backend-output");
      expectDeferredCandidateZeroDiagnostics(candidate.backendId, missingGenerated?.qualityMetrics?.v6Metrics);
    }
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

function expectValidMeshDtoAllowingOutsideBounds(
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
    const a = mesh.vertices[aIndex];
    const b = mesh.vertices[bIndex];
    const c = mesh.vertices[cIndex];
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(c).toBeDefined();
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

function countMaxBoundaryNeighborCount(mesh: MeshDto | undefined, boundaryStableIdToken: string): number {
  if (mesh === undefined) {
    return 0;
  }

  const boundaryIndexes = new Set(
    mesh.vertexStableIds
      .map((stableId, index) => ({ stableId, index }))
      .filter(({ stableId }) => stableId.includes(boundaryStableIdToken))
      .map(({ index }) => index)
  );
  const neighborsByBoundaryIndex = new Map<number, Set<number>>();
  const addNeighbor = (left: number, right: number): void => {
    if (!boundaryIndexes.has(left) || !boundaryIndexes.has(right)) {
      return;
    }

    const neighbors = neighborsByBoundaryIndex.get(left);
    if (neighbors === undefined) {
      neighborsByBoundaryIndex.set(left, new Set([right]));
      return;
    }

    neighbors.add(right);
  };

  for (const [a, b, c] of mesh.triangles) {
    addNeighbor(a, b);
    addNeighbor(b, a);
    addNeighbor(b, c);
    addNeighbor(c, b);
    addNeighbor(c, a);
    addNeighbor(a, c);
  }

  return neighborsByBoundaryIndex.size === 0
    ? 0
    : Math.max(...[...neighborsByBoundaryIndex.values()].map((neighbors) => neighbors.size));
}

type V6DProbePoint = {
  readonly x: number;
  readonly y: number;
  readonly role: "boundary" | "interior";
};

const V6D_PROBE_EPSILON = 0.000001;

function countV6DProbeOutsideOrCrossingTriangles(input: {
  readonly points: readonly V6DProbePoint[];
  readonly boundaryEdges: readonly (readonly [number, number])[];
  readonly triangles: readonly (readonly [number, number, number])[];
}): number {
  let count = 0;
  const boundary = input.points.filter((point) => point.role === "boundary");
  for (const triangle of input.triangles) {
    const a = getV6DProbePoint(input.points, triangle[0]);
    const b = getV6DProbePoint(input.points, triangle[1]);
    const c = getV6DProbePoint(input.points, triangle[2]);
    const centroid = {
      x: (a.x + b.x + c.x) / 3,
      y: (a.y + b.y + c.y) / 3
    };
    if (
      !isV6DProbePointInsideBoundaryPolygon(boundary, centroid) ||
      v6DProbeTriangleCrossesBoundary(input.points, triangle, input.boundaryEdges)
    ) {
      count += 1;
    }
  }

  return count;
}

function isV6DProbePointInsideBoundaryPolygon(
  boundary: readonly V6DProbePoint[],
  point: { readonly x: number; readonly y: number }
): boolean {
  for (let index = 0; index < boundary.length; index += 1) {
    if (isV6DProbePointOnSegment(point, boundary[index] ?? point, boundary[(index + 1) % boundary.length] ?? point)) {
      return true;
    }
  }

  let inside = false;
  for (let index = 0, previousIndex = boundary.length - 1; index < boundary.length; previousIndex = index, index += 1) {
    const current = boundary[index] ?? point;
    const previous = boundary[previousIndex] ?? point;
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function v6DProbeTriangleCrossesBoundary(
  points: readonly V6DProbePoint[],
  triangle: readonly [number, number, number],
  boundaryEdges: readonly (readonly [number, number])[]
): boolean {
  const triangleEdges = [
    [triangle[0], triangle[1]],
    [triangle[1], triangle[2]],
    [triangle[2], triangle[0]]
  ] as const;

  for (const triangleEdge of triangleEdges) {
    for (const boundaryEdge of boundaryEdges) {
      if (
        triangleEdge[0] === boundaryEdge[0] ||
        triangleEdge[0] === boundaryEdge[1] ||
        triangleEdge[1] === boundaryEdge[0] ||
        triangleEdge[1] === boundaryEdge[1]
      ) {
        continue;
      }

      if (
        v6DProbeSegmentsIntersect(
          getV6DProbePoint(points, triangleEdge[0]),
          getV6DProbePoint(points, triangleEdge[1]),
          getV6DProbePoint(points, boundaryEdge[0]),
          getV6DProbePoint(points, boundaryEdge[1])
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function v6DProbeSegmentsIntersect(
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number },
  c: { readonly x: number; readonly y: number },
  d: { readonly x: number; readonly y: number }
): boolean {
  const abC = v6DProbeCross(a, b, c);
  const abD = v6DProbeCross(a, b, d);
  const cdA = v6DProbeCross(c, d, a);
  const cdB = v6DProbeCross(c, d, b);

  if (
    Math.abs(abC) <= V6D_PROBE_EPSILON &&
    Math.abs(abD) <= V6D_PROBE_EPSILON &&
    Math.abs(cdA) <= V6D_PROBE_EPSILON &&
    Math.abs(cdB) <= V6D_PROBE_EPSILON
  ) {
    return v6DProbeRangesOverlap(a.x, b.x, c.x, d.x) && v6DProbeRangesOverlap(a.y, b.y, c.y, d.y);
  }

  return abC * abD < -V6D_PROBE_EPSILON && cdA * cdB < -V6D_PROBE_EPSILON;
}

function isV6DProbePointOnSegment(
  point: { readonly x: number; readonly y: number },
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number }
): boolean {
  if (Math.abs(v6DProbeCross(start, end, point)) > V6D_PROBE_EPSILON) {
    return false;
  }

  return (
    point.x >= Math.min(start.x, end.x) - V6D_PROBE_EPSILON &&
    point.x <= Math.max(start.x, end.x) + V6D_PROBE_EPSILON &&
    point.y >= Math.min(start.y, end.y) - V6D_PROBE_EPSILON &&
    point.y <= Math.max(start.y, end.y) + V6D_PROBE_EPSILON
  );
}

function v6DProbeRangesOverlap(leftA: number, rightA: number, leftB: number, rightB: number): boolean {
  return (
    Math.max(Math.min(leftA, rightA), Math.min(leftB, rightB)) <=
    Math.min(Math.max(leftA, rightA), Math.max(leftB, rightB)) + V6D_PROBE_EPSILON
  );
}

function v6DProbeCross(
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number },
  c: { readonly x: number; readonly y: number }
): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function getV6DProbePoint(points: readonly V6DProbePoint[], index: number): V6DProbePoint {
  const point = points[index];
  if (point === undefined) {
    throw new Error(`Expected v6D probe point at index ${index}.`);
  }

  return point;
}

function expectDeferredCandidateZeroDiagnostics(
  backendId: V6MeshGenerationBackendId,
  v6Metrics: MeshGenerationV6Metrics | undefined
): void {
  if (backendId === "v6d-contour-constrainautor") {
    expect(v6Metrics?.constrainautorDiagnostics).toMatchObject({
      dependencyGateStatus: "available",
      constraintEdgeCount: 0,
      preservedConstraintEdgeCount: 0,
      missingConstraintEdgeCount: 0,
      constraintRecoveryFailed: false
    });
  }

  if (backendId === "v6e-contour-poly2tri") {
    expect(v6Metrics?.poly2triDiagnostics).toMatchObject({
      dependencyGateStatus: "available",
      outerPointCount: 0,
      steinerPointCount: 0,
      boundaryEdgePreservedCount: 0,
      boundaryEdgeMissingCount: 0,
      triangulationThrown: false
    });
  }

  if (backendId === "v6f-contour-custom-cdt") {
    expect(v6Metrics?.customCdtDiagnostics).toMatchObject({
      dependencyGateStatus: "not-required",
      constraintEdgeCount: 0,
      preservedConstraintEdgeCount: 0,
      missingConstraintEdgeCount: 0,
      edgeFlipCount: 0,
      constraintRecoveryOperationCount: 0,
      longSpokeCandidateCount: 0,
      rejectedLocalImprovementCount: 0
    });
  }
}

function getOpaquePixelBounds(
  opaquePixels: readonly (readonly [number, number])[]
): { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number } {
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const [x, y] of opaquePixels) {
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + 1);
    bottom = Math.max(bottom, y + 1);
  }

  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
    throw new Error("Expected non-empty opaque pixels for alpha bounds test.");
  }

  return { left, top, right, bottom };
}

function getContourPointBounds(
  points: readonly { readonly x: number; readonly y: number }[]
): { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number } {
  if (points.length === 0) {
    throw new Error("Expected non-empty contour points for bounds test.");
  }

  return {
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y))
  };
}

function roundTestCoordinate(value: number): number {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
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
