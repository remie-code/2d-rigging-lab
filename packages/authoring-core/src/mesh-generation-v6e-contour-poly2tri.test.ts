import {
  DrawableIdSchema,
  MeshIdSchema,
  ProvenanceIdSchema,
  type RectDto
} from "@private-2d-rigging-lab/contracts";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import {
  createAutoOutlineV6EContourPoly2TriMesh,
  probeAutoOutlineV6EContourPoly2TriFailureForTest,
  probeAutoOutlineV6EContourPoly2TriSanitizationForTest
} from "./mesh-generation-v6e-contour-poly2tri.js";
import {
  createV6MeshGenerationFixtureRgbaBytes,
  getV6MeshGenerationContractFixture
} from "./mesh-generation-v6-fixtures.js";

describe("auto-outline-v6e-contour-poly2tri", () => {
  it("generates deterministic backend meshes from shared contour candidate input and Steiner points", () => {
    const fixture = getV6MeshGenerationContractFixture("v6-curved-blob");
    const baseInput = {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: fixture.meshBounds,
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      textureSize: fixture.textureSize,
      rgbaBytes: createV6MeshGenerationFixtureRgbaBytes(fixture),
      densityHint: "medium" as const
    };

    const first = createAutoOutlineV6EContourPoly2TriMesh(baseInput);
    const second = createAutoOutlineV6EContourPoly2TriMesh(baseInput);

    expect(first).toEqual(second);
    expect(first.status).toBe("generated");
    if (first.status !== "generated") {
      return;
    }

    expectValidMeshDto(first.mesh, {
      meshId: baseInput.meshId,
      drawableId: baseInput.drawableId,
      generationProvenanceId: baseInput.provenanceId,
      bounds: fixture.meshBounds
    });
    expect(first.alphaBounds).toBeDefined();
    expect(first.qualityMetrics).toMatchObject({
      triangulationMode: "v6e-contour-poly2tri-constrained-polygon",
      v6Metrics: {
        methodId: "auto-outline-v6e-contour-poly2tri",
        backendId: "v6e-contour-poly2tri",
        backendImplementationStatus: "implemented",
        requestedSourceId: "outline-v6e-contour-poly2tri-rgba",
        actualSourceId: "outline-v6e-contour-poly2tri-rgba",
        outputKind: "backend-output",
        fallbackSteps: [],
        contourPipelineDiagnostics: {
          status: "generated",
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
    const v6Metrics = first.qualityMetrics.v6Metrics;
    expect(v6Metrics?.boundaryVertexCount).toBeGreaterThanOrEqual(3);
    expect(v6Metrics?.interiorVertexCount).toBeGreaterThan(0);
    expect(v6Metrics?.poly2triDiagnostics?.outerPointCount).toBe(v6Metrics?.boundaryVertexCount);
    expect(v6Metrics?.poly2triDiagnostics?.steinerPointCount).toBe(v6Metrics?.interiorVertexCount);
    expect(v6Metrics?.poly2triDiagnostics?.boundaryEdgePreservedCount).toBe(v6Metrics?.boundaryVertexCount);
    expect(v6Metrics?.provenance).toEqual(
      expect.arrayContaining([
        "shared-v6-contour-pipeline",
        "v6e-poly2tri-quantized-deduped-points",
        "v6e-poly2tri-normalized-winding",
        "v6e-poly2tri-steiner-points",
        "v6e-poly2tri-constrained-polygon-triangulation",
        "v6e-poly2tri-boundary-preserved"
      ])
    );
    expect(v6Metrics?.provenance.join(">")).not.toMatch(/earclip|fan|splitTriangles|row-major/i);
    expect(first.mesh.vertexStableIds.some((id) => id.includes("_v6e_steiner_"))).toBe(true);
  });

  it("reports hole-like input as an explicit no-hole limitation instead of backend success", () => {
    const fixture = getV6MeshGenerationContractFixture("v6-hole-like");
    const generated = createAutoOutlineV6EContourPoly2TriMesh({
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      bounds: fixture.meshBounds,
      provenanceId: ProvenanceIdSchema.parse("prov_generate_body"),
      textureSize: fixture.textureSize,
      rgbaBytes: createV6MeshGenerationFixtureRgbaBytes(fixture),
      densityHint: "medium"
    });

    expect(generated.status).toBe("blocked");
    if (generated.status !== "blocked") {
      return;
    }

    expect(generated.reason).toBe("v6e-poly2tri-polygon-invalid");
    expect(generated.failureMetrics.holeHandling).toBe("unsupported-fallback");
    expect(generated.failureMetrics.holeLikeRegionCount).toBeGreaterThan(0);
    expect(generated.failureMetrics.diagnostics).toMatchObject({
      dependencyGateStatus: "available",
      holeValidationFailed: true,
      triangulationThrown: false
    });
    expect(generated.failureMetrics.diagnostics.holeCount).toBeGreaterThan(0);
    expect(generated.failureMetrics.provenance).toEqual(
      expect.arrayContaining([
        "shared-v6-contour-pipeline",
        "limitation-hole-regions-reported",
        "fallback-hole-unsupported"
      ])
    );
  });

  it("makes invalid polygon, triangulation throw, and boundary-missing failures visible through probes", () => {
    const invalidPolygon = probeAutoOutlineV6EContourPoly2TriFailureForTest({
      boundaryPoints: [
        { x: 0, y: 0 },
        { x: 6, y: 6 },
        { x: 0, y: 6 },
        { x: 6, y: 0 }
      ]
    });
    expect(invalidPolygon.outputKind).toBe("blocked");
    expect(invalidPolygon.reason).toBe("v6e-poly2tri-polygon-invalid");
    expect(invalidPolygon.validationFailures).toContain("self-intersection");
    expect(invalidPolygon.diagnostics.polygonValidationFailed).toBe(true);

    const thrown = probeAutoOutlineV6EContourPoly2TriFailureForTest({
      boundaryPoints: [
        { x: 1, y: 1 },
        { x: 8, y: 1 },
        { x: 8, y: 8 },
        { x: 1, y: 8 }
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

    expect(thrown.outputKind).toBe("blocked");
    expect(thrown.reason).toBe("v6e-poly2tri-triangulation-threw");
    expect(thrown.diagnostics.triangulationThrown).toBe(true);

    const missingBoundary = probeAutoOutlineV6EContourPoly2TriFailureForTest({
      boundaryPoints: [
        { x: 1, y: 1 },
        { x: 8, y: 1 },
        { x: 8, y: 8 },
        { x: 1, y: 8 }
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

    expect(missingBoundary.outputKind).toBe("blocked");
    expect(missingBoundary.reason).toBe("v6e-poly2tri-generation-failed");
    expect(missingBoundary.triangleCount).toBe(1);
    expect(missingBoundary.diagnostics).toMatchObject({
      polygonValidationFailed: false,
      triangulationThrown: false,
      boundaryEdgePreservedCount: 1,
      boundaryEdgeMissingCount: 3
    });
  });

  it("normalizes reversed winding before passing the contour to Poly2Tri", () => {
    let receivedContourKeys: readonly string[] = [];
    const normalized = probeAutoOutlineV6EContourPoly2TriFailureForTest({
      boundaryPoints: [
        { x: 1, y: 1 },
        { x: 1, y: 8 },
        { x: 8, y: 8 },
        { x: 8, y: 1 }
      ],
      interiorPoints: [{ x: 4, y: 4 }],
      createSweepContext: (contourPoints) => {
        receivedContourKeys = contourPoints.map((point) => `${point.x}:${point.y}`);
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
            },
            {
              getPoints: () => [
                contourPoints[1]!,
                contourPoints[2]!,
                steinerPoints[0] ?? contourPoints[3]!
              ]
            },
            {
              getPoints: () => [
                contourPoints[2]!,
                contourPoints[3]!,
                steinerPoints[0] ?? contourPoints[0]!
              ]
            },
            {
              getPoints: () => [
                contourPoints[3]!,
                contourPoints[0]!,
                steinerPoints[0] ?? contourPoints[1]!
              ]
            }
          ]
        };
      }
    });

    expect(receivedContourKeys).toEqual(["1:1", "8:1", "8:8", "1:8"]);
    expect(normalized.outputKind).toBe("backend-output");
    expect(normalized.validationFailures).toEqual([]);
    expect(normalized.diagnostics).toMatchObject({
      outerPointCount: 4,
      steinerPointCount: 1,
      boundaryEdgePreservedCount: 4,
      boundaryEdgeMissingCount: 0,
      polygonValidationFailed: false,
      triangulationThrown: false
    });
  });

  it("quantizes and dedupes contour and interior points before validation", () => {
    const sanitized = probeAutoOutlineV6EContourPoly2TriSanitizationForTest({
      boundaryPoints: [
        { x: 1, y: 1 },
        { x: 1.0000002, y: 1 },
        { x: 5, y: 1 },
        { x: 8, y: 1 },
        { x: 8, y: 8 },
        { x: 1, y: 8 }
      ],
      interiorPoints: [
        { x: 4, y: 4 },
        { x: 4.0000002, y: 4 },
        { x: 1, y: 1 },
        { x: 12, y: 12 }
      ],
      width: 16,
      height: 16
    });

    expect(sanitized.originalBoundaryPointCount).toBe(6);
    expect(sanitized.sanitizedBoundaryPointCount).toBe(4);
    expect(sanitized.removedBoundaryPointCount).toBe(2);
    expect(sanitized.originalInteriorPointCount).toBe(4);
    expect(sanitized.sanitizedInteriorPointCount).toBe(1);
    expect(sanitized.removedInteriorPointCount).toBe(3);
    expect(sanitized.shortestSanitizedEdgeLength).toBeGreaterThanOrEqual(1.25);
    expect(sanitized.validationFailures).toEqual([]);
    expect(sanitized.diagnostics).toMatchObject({
      outerPointCount: 4,
      steinerPointCount: 1,
      polygonValidationFailed: false
    });
  });
});

function expectValidMeshDto(
  mesh: MeshDto,
  expected: {
    readonly meshId: MeshDto["meshId"];
    readonly drawableId: MeshDto["drawableId"];
    readonly generationProvenanceId: MeshDto["generationProvenanceId"];
    readonly bounds: RectDto;
  }
): void {
  expect(mesh.meshId).toBe(expected.meshId);
  expect(mesh.drawableId).toBe(expected.drawableId);
  expect(mesh.generationProvenanceId).toBe(expected.generationProvenanceId);
  expect(mesh.bounds).toEqual(expected.bounds);
  expect(mesh.vertices).toHaveLength(mesh.uvs.length);
  expect(mesh.vertices).toHaveLength(mesh.vertexStableIds.length);
  expect(mesh.triangleStableIds).toHaveLength(mesh.triangles.length);
  expect(mesh.topologyRevision).toBe(0);

  for (const vertex of mesh.vertices) {
    expect(Number.isFinite(vertex.x)).toBe(true);
    expect(Number.isFinite(vertex.y)).toBe(true);
    expect(vertex.x).toBeGreaterThanOrEqual(expected.bounds.x);
    expect(vertex.x).toBeLessThanOrEqual(expected.bounds.x + expected.bounds.width);
    expect(vertex.y).toBeGreaterThanOrEqual(expected.bounds.y);
    expect(vertex.y).toBeLessThanOrEqual(expected.bounds.y + expected.bounds.height);
  }

  for (const uv of mesh.uvs) {
    expect(Number.isFinite(uv.x)).toBe(true);
    expect(Number.isFinite(uv.y)).toBe(true);
    expect(uv.x).toBeGreaterThanOrEqual(0);
    expect(uv.x).toBeLessThanOrEqual(1);
    expect(uv.y).toBeGreaterThanOrEqual(0);
    expect(uv.y).toBeLessThanOrEqual(1);
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
