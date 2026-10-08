import {
  createGeneratedMeshForDrawable,
  createInitialAuthoringRevision,
  toRuntimeGraph,
  V6_MESH_GENERATION_CANDIDATES
} from "@private-2d-rigging-lab/authoring-core";
import type {
  AuthoringSession,
  DrawableGeneratedMeshResult,
  MeshGenerationMethod
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { OperationId } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import { getOperationHandler } from "../operation-registry.js";
import { generateMeshOperationHandler } from "./generate-mesh.js";

type GenerateMeshPreviewProvenance = NonNullable<
  Extract<OperationRequestDto, { readonly operationType: "generateMesh" }>["payload"]["previewProvenance"]
>;

describe("generateMesh operation handler", () => {
  it("is registered in the operation registry", () => {
    expect(getOperationHandler("generateMesh")).toBe(generateMeshOperationHandler);
  });

  it("dry-runs auto-grid-v1 on a cloned session with deterministic vertices and triangles", () => {
    const session = createFixtureSession();
    const request = createGenerateMeshRequest({ dryRun: true, densityHint: "medium" });

    const outcome = generateMeshOperationHandler.dryRun(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(session.graph.meshes[0]?.vertices).toEqual([]);
    expect(outcome.candidateSession.graph.meshes[0]).toMatchObject({
      meshId: "mesh_body",
      drawableId: "draw_body",
      vertices: [
        { x: 4, y: 8 },
        { x: 24, y: 8 },
        { x: 44, y: 8 },
        { x: 4, y: 18 },
        { x: 24, y: 18 },
        { x: 44, y: 18 },
        { x: 4, y: 28 },
        { x: 24, y: 28 },
        { x: 44, y: 28 }
      ],
      triangles: [
        [0, 1, 3],
        [1, 4, 3],
        [1, 2, 4],
        [2, 5, 4],
        [3, 4, 6],
        [4, 7, 6],
        [4, 5, 7],
        [5, 8, 7]
      ]
    });
    expect(outcome.result.modelDiff?.changed[0]?.target).toEqual({
      kind: "mesh",
      id: "mesh_body"
    });
    expect(() => toRuntimeGraph(outcome.candidateSession)).not.toThrow();
  });

  it("commits manual-empty while preserving runtime-safe graph conversion", () => {
    const session = createFixtureSessionWithGeneratedMesh();
    const request = createGenerateMeshRequest({ dryRun: false, method: "manual-empty" });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.meshes[0]).toMatchObject({
      vertices: [],
      uvs: [],
      triangles: [],
      bounds: { x: 4, y: 8, width: 40, height: 20 },
      generationProvenanceId: "prov_generate_body_mesh"
    });
    expect(toRuntimeGraph(session).drawables.get(DrawableIdSchema.parse("draw_body"))).toMatchObject({
      vertexCount: 0
    });
    expect(session.authoringRevision).toBe(1);
  });

  it("commits auto-grid-v1 from drawable texture alpha bounds when raw RGBA bytes are available", () => {
    const session = createFixtureSessionWithTextureBytes();
    const request = createGenerateMeshRequest({ dryRun: false, densityHint: "low" });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.meshes[0]).toMatchObject({
      bounds: { x: 4, y: 8, width: 4, height: 4 },
      vertices: [
        { x: 5, y: 9 },
        { x: 7, y: 9 },
        { x: 5, y: 11 },
        { x: 7, y: 11 }
      ],
      uvs: [
        { x: 0.25, y: 0.25 },
        { x: 0.75, y: 0.25 },
        { x: 0.25, y: 0.75 },
        { x: 0.75, y: 0.75 }
      ],
      triangles: [
        [0, 1, 2],
        [1, 3, 2]
      ]
    });
    expect(toRuntimeGraph(session).drawables.get(DrawableIdSchema.parse("draw_body"))).toMatchObject({
      vertexCount: 4
    });
  });

  it("commits the provided preview mesh geometry instead of regenerating on apply", () => {
    const session = createFixtureSessionWithTextureBytes();
    const previewMesh = createPreviewMesh(session);
    const request = createGenerateMeshRequest({
      dryRun: false,
      densityHint: "high",
      previewMesh
    });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.meshes[0]).toMatchObject({
      vertices: previewMesh.vertices,
      uvs: previewMesh.uvs,
      triangles: previewMesh.triangles,
      vertexStableIds: previewMesh.vertexStableIds,
      generationProvenanceId: "prov_generate_body_mesh"
    });
    expect(toRuntimeGraph(session).drawables.get(DrawableIdSchema.parse("draw_body"))).toMatchObject({
      vertexCount: 3
    });
  });

  it("rejects a preview mesh with an out-of-range triangle vertex reference", () => {
    const session = createFixtureSessionWithTextureBytes();
    const meshBefore = structuredClone(session.graph.meshes[0]);
    const request = createGenerateMeshRequest({
      dryRun: false,
      previewMesh: createPreviewMesh(session, {
        triangles: [[0, 1, 999] as [number, number, number]]
      })
    });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.generateMesh.previewMeshTriangleIndexOutOfRange",
      target: { kind: "mesh", id: "mesh_body", path: "/payload/previewMesh/triangles/0" }
    });
    expect(session.graph.meshes[0]).toEqual(meshBefore);
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects a preview mesh with a degenerate repeated-index triangle", () => {
    const session = createFixtureSessionWithTextureBytes();
    const meshBefore = structuredClone(session.graph.meshes[0]);
    const request = createGenerateMeshRequest({
      dryRun: false,
      previewMesh: createPreviewMesh(session, {
        triangles: [[0, 1, 1] as [number, number, number]]
      })
    });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.generateMesh.previewMeshDegenerateTriangle",
      target: { kind: "mesh", id: "mesh_body", path: "/payload/previewMesh/triangles/0" }
    });
    expect(session.graph.meshes[0]).toEqual(meshBefore);
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects missing drawable and missing mesh preconditions", () => {
    const missingDrawableSession = createFixtureSession();
    missingDrawableSession.graph.drawables = [];
    missingDrawableSession.graph.meshes = [];
    const missingDrawableRequest = createGenerateMeshRequest({ dryRun: false });

    const missingDrawable = generateMeshOperationHandler.commit(
      missingDrawableSession,
      missingDrawableRequest,
      getRequestOperationId(missingDrawableRequest)
    );

    expect(missingDrawable.result.status).toBe("rejected");
    expect(missingDrawable.result.diagnostics[0]).toMatchObject({
      checkId: "operation.generateMesh.missingDrawable",
      target: { kind: "drawable", id: "draw_body" }
    });

    const missingMeshSession = createFixtureSession();
    missingMeshSession.graph.meshes = [];
    const missingMeshRequest = createGenerateMeshRequest({ dryRun: false });

    const missingMesh = generateMeshOperationHandler.commit(
      missingMeshSession,
      missingMeshRequest,
      getRequestOperationId(missingMeshRequest)
    );

    expect(missingMesh.result.status).toBe("rejected");
    expect(missingMesh.result.diagnostics[0]).toMatchObject({
      checkId: "operation.generateMesh.missingMesh",
      target: { kind: "drawable", id: "draw_body", path: "/meshId" }
    });
  });

  it("commits auto-outline-v1 from drawable texture alpha contour when raw RGBA bytes are available", () => {
    const session = createFixtureSessionWithTextureBytes();
    const request = createGenerateMeshRequest({ dryRun: false, method: "auto-outline-v1" });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.meshes[0]).toMatchObject({
      vertices: [
        { x: 5, y: 9 },
        { x: 7, y: 9 },
        { x: 7, y: 11 },
        { x: 5, y: 11 }
      ],
      uvs: [
        { x: 0.25, y: 0.25 },
        { x: 0.75, y: 0.25 },
        { x: 0.75, y: 0.75 },
        { x: 0.25, y: 0.75 }
      ],
      triangles: [
        [1, 2, 0],
        [2, 3, 0]
      ],
      generationProvenanceId: "prov_generate_body_mesh"
    });
    expect(session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v1",
        "meshSource:outline-rgba",
        "meshQuality:triangulationMode=ordinary-delaunay-alpha-filter"
      ])
    );
    expect(toRuntimeGraph(session).drawables.get(DrawableIdSchema.parse("draw_body"))).toMatchObject({
      vertexCount: 4
    });
  });

  it("commits auto-outline-v2 and records quality metrics in provenance", () => {
    const session = createFixtureSessionWithTextureBytes();
    const request = createGenerateMeshRequest({ dryRun: false, method: "auto-outline-v2" });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.meshes[0]?.vertices.length).toBeGreaterThan(0);
    expect(session.graph.meshes[0]?.triangles.length).toBeGreaterThan(0);
    expect(session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v2",
        "meshSource:outline-v2-rgba",
        "meshQuality:triangulationMode=interim-delaunay-alpha-filter"
      ])
    );
    const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:maxEdgeLength="))).toBe(true);
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:maxTriangleArea="))).toBe(true);
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:minAngleDegrees="))).toBe(true);
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:maxVertexValence="))).toBe(true);
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:refinementIterations="))).toBe(true);
  });

  it("commits auto-outline-v2.5-soft-boundary and records soft boundary metrics in provenance", () => {
    const session = createFixtureSessionWithSizedTextureBytes({
      textureSize: { width: 40, height: 36 },
      meshBounds: { x: 4, y: 8, width: 40, height: 36 },
      opaquePixels: createPixelsFromPredicate(40, 36, (x, y) => {
        const dx = (x - 18.5) / 12;
        const dy = (y - 17.5) / 9;
        const body = dx * dx + dy * dy <= 1;
        const tail = x >= 25 && x <= 34 && y >= 14 && y <= 20;
        const notch = x >= 9 && x <= 16 && y >= 19 && y <= 29;
        return (body || tail) && !notch;
      })
    });
    const request = createGenerateMeshRequest({ dryRun: false, method: "auto-outline-v2.5-soft-boundary" });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.meshes[0]?.vertices.length).toBeGreaterThan(0);
    expect(session.graph.meshes[0]?.triangles.length).toBeGreaterThan(0);
    expect(session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v2.5-soft-boundary",
        "meshSource:outline-v2-5-soft-boundary-rgba",
        "meshQuality:triangulationMode=interim-delaunay-soft-boundary-filter",
        "meshQuality:softBoundaryAlgorithm=auto-outline-v2.5-soft-boundary",
        "meshQuality:softBoundaryOutsideSamples=0",
        "meshQuality:softBoundaryFarTransparentSamples=0"
      ])
    );
    const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:softBoundaryAreaRatio="))).toBe(true);
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:softBoundaryTransparentSamples="))).toBe(true);
    expect(transformHistory.some((entry) => entry.includes("transparent-near-boundary-allowance"))).toBe(true);
  });

  it("commits auto-outline-v2.6-soft-apron and records apron provenance metrics", () => {
    const session = createFixtureSessionWithSizedTextureBytes({
      textureSize: { width: 44, height: 40 },
      meshBounds: { x: 4, y: 8, width: 44, height: 40 },
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
    const request = createGenerateMeshRequest({ dryRun: false, method: "auto-outline-v2.6-soft-apron" });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.meshes[0]?.vertices.length).toBeGreaterThan(0);
    expect(session.graph.meshes[0]?.triangles.length).toBeGreaterThan(0);
    expect(session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v2.6-soft-apron",
        "meshSource:outline-v2-6-soft-apron-rgba",
        "meshQuality:triangulationMode=interim-delaunay-soft-apron-strip",
        "meshQuality:softApronAlgorithm=auto-outline-v2.6-soft-apron",
        "meshQuality:softApronBaseAlgorithm=auto-outline-v2.5-soft-boundary",
        "meshQuality:softApronLongEdges=0",
        "meshQuality:softApronSkinnyTriangles=0"
      ])
    );
    const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:softApronBoundaryAreaRatio="))).toBe(true);
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:softApronTriangleIncreaseRatio="))).toBe(true);
    expect(transformHistory.some((entry) => entry.includes("frontier-growth-apron-triangulation"))).toBe(true);
  });

  it("commits auto-outline-v4-contour-band and records contour-band provenance metrics", () => {
    const session = createFixtureSessionWithSizedTextureBytes({
      textureSize: { width: 52, height: 46 },
      meshBounds: { x: 4, y: 8, width: 52, height: 46 },
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
    const request = createGenerateMeshRequest({ dryRun: false, method: "auto-outline-v4-contour-band" });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.meshes[0]?.vertices.length).toBeGreaterThan(0);
    expect(session.graph.meshes[0]?.triangles.length).toBeGreaterThan(0);
    expect(session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v4-contour-band",
        "meshSource:outline-v4-contour-band-rgba",
        "meshQuality:triangulationMode=interim-delaunay-contour-band-strip",
        "meshQuality:contourBandAlgorithm=auto-outline-v4-contour-band"
      ])
    );
    const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:contourBandTriangles="))).toBe(true);
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:contourBandInteriorPoints="))).toBe(true);
    expect(
      transformHistory.some((entry) => entry.startsWith("meshQuality:contourBandTransparentOnlyTriangleRatio="))
    ).toBe(true);
    expect(transformHistory.some((entry) => entry.includes("explicit-inner-outer-contour-strip"))).toBe(true);
  });

  it("commits v6 candidates and records shared v6 provenance", () => {
    for (const candidate of V6_MESH_GENERATION_CANDIDATES) {
      const session = createFixtureSessionWithSizedTextureBytes({
        textureSize: { width: 20, height: 16 },
        meshBounds: { x: 4, y: 8, width: 20, height: 16 },
        opaquePixels: createPixelsFromPredicate(20, 16, (x, y) => x >= 4 && x <= 15 && y >= 3 && y <= 12)
      });
      const request = createGenerateMeshRequest({
        dryRun: false,
        method: candidate.methodId,
        densityHint: "medium"
      });

      const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

      expect(outcome.result.status).toBe("committed");
      expect(session.graph.meshes[0]?.vertices.length).toBeGreaterThan(0);
      const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];
      if (candidate.backendImplementationStatus === "implemented") {
        expect(transformHistory).toEqual(
          expect.arrayContaining([
            `generateMesh:${candidate.methodId}`,
            "meshQuality:v6Algorithm=auto-outline-v6-alpha-constrained-delaunay",
            `meshQuality:v6Method=${candidate.methodId}`,
            `meshQuality:v6Backend=${candidate.backendId}`,
            "meshQuality:v6BackendImplementation=implemented",
            `meshQuality:v6RequestedSource=${candidate.sourceId}`
          ])
        );
        expect(transformHistory).toEqual(
          expect.arrayContaining([
            "meshQuality:v6MultiIslandHandling=supported",
            "meshQuality:v6HoleHandling=supported"
          ])
        );

        if (candidate.backendId === "v6a-local") {
          expect(transformHistory).toEqual(
            expect.arrayContaining([
              `meshSource:${candidate.sourceId}`,
              `meshQuality:v6ActualSource=${candidate.sourceId}`,
              "meshQuality:v6Output=backend-output",
              "meshQuality:v6FallbackSteps=0",
              "meshQuality:triangulationMode=v6a-local-earclip-steiner-approximation"
            ])
          );
          expect(transformHistory.some((entry) => entry.startsWith(`fallback:${candidate.methodId}`))).toBe(false);
          expect(transformHistory).toContain(
            "meshQuality:v6Provenance=v6a-local-soft-alpha-mask>v6a-local-main-island-boundary>v6a-local-adaptive-boundary-sampling>v6a-local-deterministic-interior-sampling>v6a-local-earclip-steiner-approximation>limitation-not-full-constrained-delaunay"
          );
        }

        if (candidate.backendId === "v6b-constrainautor") {
          expect(transformHistory).toEqual(
            expect.arrayContaining([
              `meshSource:${candidate.sourceId}`,
              `meshQuality:v6ActualSource=${candidate.sourceId}`,
              "meshQuality:v6Output=backend-output",
              "meshQuality:v6FallbackSteps=0",
              "meshQuality:triangulationMode=v6b-delaunator-constrainautor",
              "meshQuality:v6ConstrainautorDependencyGate=available",
              "meshQuality:v6ConstrainautorMissingConstraints=0",
              "meshQuality:v6ConstrainautorRecoveryFailed=false"
            ])
          );
          expect(transformHistory.some((entry) => entry.startsWith(`fallback:${candidate.methodId}:`))).toBe(false);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6ConstrainautorConstraintEdges="))).toBe(true);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6ConstrainautorPreservedConstraints="))).toBe(true);
        }

        if (candidate.backendId === "v6d-contour-constrainautor") {
          expect(transformHistory).toEqual(
            expect.arrayContaining([
              `meshSource:${candidate.sourceId}`,
              `meshQuality:v6ActualSource=${candidate.sourceId}`,
              "meshQuality:v6Output=backend-output",
              "meshQuality:v6FallbackSteps=0",
              "meshQuality:triangulationMode=v6d-contour-delaunator-constrainautor",
              "meshQuality:v6ConstrainautorDependencyGate=available",
              "meshQuality:v6ConstrainautorMissingConstraints=0",
              "meshQuality:v6ConstrainautorRecoveryFailed=false"
            ])
          );
          expect(transformHistory.some((entry) => entry.startsWith(`fallback:${candidate.methodId}:`))).toBe(false);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6ConstrainautorConstraintEdges="))).toBe(true);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6ConstrainautorPreservedConstraints="))).toBe(true);
        }

        if (candidate.backendId === "v6d-contour-band-support-rings") {
          expect(transformHistory).toEqual(
            expect.arrayContaining([
              `meshSource:${candidate.sourceId}`,
              `meshQuality:v6ActualSource=${candidate.sourceId}`,
              "meshQuality:v6Output=backend-output",
              "meshQuality:v6FallbackSteps=0",
              "meshQuality:triangulationMode=v6d-contour-delaunator-constrainautor",
              "meshQuality:v6ConstrainautorDependencyGate=available",
              "meshQuality:v6ConstrainautorMissingConstraints=0",
              "meshQuality:v6ConstrainautorRecoveryFailed=false",
              "meshQuality:v6SupportRingOuterOffset=2.5",
              "meshQuality:v6SupportRingInnerOffset=1.75",
              "meshQuality:v6SupportRingOuterUvPolicy=projected-to-alpha-boundary"
            ])
          );
          expect(transformHistory.some((entry) => entry.startsWith(`fallback:${candidate.methodId}:`))).toBe(false);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6ConstrainautorConstraintEdges="))).toBe(true);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6ConstrainautorPreservedConstraints="))).toBe(true);
          expect(transformHistory.some((entry) => /^meshQuality:v6SupportRingBoundaryPoints=[1-9]\d*$/.test(entry))).toBe(true);
          expect(transformHistory.some((entry) => /^meshQuality:v6SupportRingAlphaBoundaryPoints=[1-9]\d*$/.test(entry))).toBe(true);
          expect(transformHistory.some((entry) => /^meshQuality:v6SupportRingOuterPoints=[1-9]\d*$/.test(entry))).toBe(true);
          expect(transformHistory.some((entry) => /^meshQuality:v6SupportRingInnerPoints=[1-9]\d*$/.test(entry))).toBe(true);
          expect(transformHistory.some((entry) => /^meshQuality:v6SupportRingSupportBandTriangles=[1-9]\d*$/.test(entry))).toBe(true);
          expect(transformHistory.some((entry) => /^meshQuality:v6SupportRingInteriorTriangles=[1-9]\d*$/.test(entry))).toBe(true);
          expect(transformHistory.some((entry) => /^meshQuality:v6SupportRingOutsideLayer=(true|false)$/.test(entry))).toBe(true);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6SupportRingMaxOutsideLayerDistance="))).toBe(true);
        }

        if (candidate.backendId === "v6d-adaptive-staggered-band") {
          expect(transformHistory).toEqual(
            expect.arrayContaining([
              `meshSource:${candidate.sourceId}`,
              `meshQuality:v6ActualSource=${candidate.sourceId}`,
              "meshQuality:v6Output=backend-output",
              "meshQuality:v6FallbackSteps=0",
              "meshQuality:triangulationMode=v6d-adaptive-staggered-band",
              "meshQuality:v6ConstrainautorDependencyGate=available",
              "meshQuality:v6ConstrainautorMissingConstraints=0",
              "meshQuality:v6ConstrainautorRecoveryFailed=false",
              "meshQuality:v6AdaptiveDirectAlphaToInteriorEdges=0",
              "meshQuality:v6AdaptiveInteriorFillUsesStaggeredInnerBoundary=true"
            ])
          );
          expect(transformHistory.some((entry) => entry.startsWith(`fallback:${candidate.methodId}:`))).toBe(false);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6AdaptiveResolvedBoundarySpacing="))).toBe(true);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6AdaptiveResolvedInteriorSpacing="))).toBe(true);
          expect(transformHistory.some((entry) => /^meshQuality:v6AdaptiveStaggeredInnerPoints=[1-9]\d*$/.test(entry))).toBe(true);
          expect(transformHistory.some((entry) => /^meshQuality:v6AdaptiveExplicitAlphaInnerStripTriangles=[1-9]\d*$/.test(entry))).toBe(true);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6AdaptiveInteriorPointsBeforeInnerFilter="))).toBe(true);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6AdaptiveInteriorPointsAfterInnerFilter="))).toBe(true);
        }

        if (candidate.backendId === "v6d-adaptive-contour-constrainautor") {
          expect(transformHistory).toEqual(
            expect.arrayContaining([
              `meshSource:${candidate.sourceId}`,
              `meshQuality:v6ActualSource=${candidate.sourceId}`,
              "meshQuality:v6Output=backend-output",
              "meshQuality:v6FallbackSteps=0",
              "meshQuality:triangulationMode=v6d-adaptive-contour-constrainautor",
              "meshQuality:v6ConstrainautorDependencyGate=available",
              "meshQuality:v6ConstrainautorMissingConstraints=0",
              "meshQuality:v6ConstrainautorRecoveryFailed=false"
            ])
          );
          expect(transformHistory.some((entry) => entry.startsWith(`fallback:${candidate.methodId}:`))).toBe(false);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6AdaptiveResolvedBoundarySpacing="))).toBe(true);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6AdaptiveResolvedInteriorSpacing="))).toBe(true);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6AdaptiveResolvedMaxInteriorVertices="))).toBe(true);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6AdaptiveStaggeredInnerPoints="))).toBe(false);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6AdaptiveExplicitAlphaInnerStripTriangles="))).toBe(false);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6AdaptiveInteriorFillUsesStaggeredInnerBoundary="))).toBe(false);
        }

        if (candidate.backendId === "v6c-poly2tri") {
          expect(transformHistory).toEqual(
            expect.arrayContaining([
              `meshSource:${candidate.sourceId}`,
              `meshQuality:v6ActualSource=${candidate.sourceId}`,
              "meshQuality:v6Output=backend-output",
              "meshQuality:v6FallbackSteps=0",
              "meshQuality:triangulationMode=v6c-poly2tri-constrained-polygon",
              "meshQuality:v6Poly2TriDependencyGate=available",
              "meshQuality:v6Poly2TriPolygonValidationFailed=false",
              "meshQuality:v6Poly2TriHoleValidationFailed=false",
              "meshQuality:v6Poly2TriTriangulationThrown=false",
              "meshQuality:v6Poly2TriBoundaryMissing=0"
            ])
          );
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6Poly2TriOuterPoints="))).toBe(true);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6Poly2TriSteinerPoints="))).toBe(true);
        }

        if (candidate.backendId === "v6e-contour-poly2tri") {
          expect(transformHistory).toEqual(
            expect.arrayContaining([
              `meshSource:${candidate.sourceId}`,
              `meshQuality:v6ActualSource=${candidate.sourceId}`,
              "meshQuality:v6Output=backend-output",
              "meshQuality:v6FallbackSteps=0",
              "meshQuality:triangulationMode=v6e-contour-poly2tri-constrained-polygon",
              "meshQuality:v6Poly2TriDependencyGate=available",
              "meshQuality:v6Poly2TriPolygonValidationFailed=false",
              "meshQuality:v6Poly2TriHoleValidationFailed=false",
              "meshQuality:v6Poly2TriTriangulationThrown=false",
              "meshQuality:v6Poly2TriBoundaryMissing=0"
            ])
          );
          expect(transformHistory.some((entry) => entry.startsWith(`fallback:${candidate.methodId}:`))).toBe(false);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6Poly2TriOuterPoints="))).toBe(true);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6Poly2TriSteinerPoints="))).toBe(true);
        }

        if (candidate.backendId === "v6f-contour-custom-cdt") {
          expect(transformHistory).toEqual(
            expect.arrayContaining([
              `meshSource:${candidate.sourceId}`,
              `meshQuality:v6ActualSource=${candidate.sourceId}`,
              "meshQuality:v6Output=backend-output",
              "meshQuality:v6FallbackSteps=0",
              "meshQuality:triangulationMode=v6f-contour-custom-cdt",
              "meshQuality:v6CustomCdtDependencyGate=not-required",
              "meshQuality:v6CustomCdtMissingConstraints=0"
            ])
          );
          expect(transformHistory.some((entry) => entry.startsWith(`fallback:${candidate.methodId}:`))).toBe(false);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6CustomCdtConstraintEdges="))).toBe(true);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6CustomCdtPreservedConstraints="))).toBe(true);
          expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6CustomCdtLongSpokeCandidates="))).toBe(true);
        }
      } else {
        const expectedReason = "v6-backend-not-implemented";
        expect(transformHistory).toEqual(
          expect.arrayContaining([
            `generateMesh:${candidate.methodId}`,
            "meshSource:alpha-aware-rgba",
            `fallback:${candidate.methodId}:${expectedReason}`,
            "meshQuality:triangulationMode=v6-backend-blocked-fallback",
            "meshQuality:v6Algorithm=auto-outline-v6-alpha-constrained-delaunay",
            `meshQuality:v6Method=${candidate.methodId}`,
            `meshQuality:v6Backend=${candidate.backendId}`,
            "meshQuality:v6BackendImplementation=deferred",
            `meshQuality:v6RequestedSource=${candidate.sourceId}`,
            "meshQuality:v6ActualSource=alpha-aware-rgba",
            "meshQuality:v6Output=fallback-output",
            `meshQuality:v6Fallback=${expectedReason}`,
            "meshQuality:v6ContourPipelineStatus=generated"
          ])
        );

        if (candidate.backendId === "v6e-contour-poly2tri") {
          expect(transformHistory).toEqual(
            expect.arrayContaining([
              "meshQuality:v6Poly2TriDependencyGate=available",
              "meshQuality:v6Poly2TriBoundaryPreserved=0"
            ])
          );
          expect(transformHistory.some((entry) => /^meshQuality:v6Poly2TriOuterPoints=[1-9]\d*$/.test(entry))).toBe(true);
          expect(transformHistory.some((entry) => /^meshQuality:v6Poly2TriBoundaryMissing=[1-9]\d*$/.test(entry))).toBe(true);
        }
      }
      expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6BoundaryVertices="))).toBe(true);
      expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6OpaquePixels="))).toBe(true);

      if (candidate.backendId === "v6b-constrainautor") {
        expect(transformHistory).toEqual(
          expect.arrayContaining(["meshQuality:v6ConstrainautorDependencyGate=available"])
        );
      }

      if (candidate.backendId === "v6c-poly2tri" || candidate.backendId === "v6e-contour-poly2tri") {
        expect(transformHistory).toEqual(
          expect.arrayContaining(["meshQuality:v6Poly2TriDependencyGate=available"])
        );
      }
    }
  });

  it("records v6d adaptive contour multi-island diagnostics in generated operation provenance", () => {
    const session = createFixtureSessionWithSizedTextureBytes({
      textureSize: { width: 64, height: 32 },
      meshBounds: { x: 4, y: 8, width: 64, height: 32 },
      opaquePixels: [
        ...createPixelsFromPredicate(64, 32, (x, y) => x >= 8 && x <= 35 && y >= 6 && y <= 25),
        [58, 5],
        [59, 5]
      ]
    });
    const request = createGenerateMeshRequest({
      dryRun: false,
      method: "auto-outline-v6d-adaptive-contour-constrainautor",
      densityHint: "medium"
    });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));
    const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];

    expect(outcome.result.status).toBe("committed");
    expect(transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v6d-adaptive-contour-constrainautor",
        "meshSource:outline-v6d-adaptive-contour-constrainautor-rgba",
        "meshQuality:v6MultiIslandHandling=supported",
        "meshQuality:v6RawAlphaComponents=2",
        "meshQuality:v6KeptIslands=1",
        "meshQuality:v6GeneratedIslands=1",
        "meshQuality:v6BackendGeneratedIslands=1",
        "meshQuality:v6SkippedTinyNoiseIslands=1",
        "meshQuality:v6SkippedTinyNoisePixels=2",
        "meshQuality:v6LocalizedFallbacks=0"
      ])
    );
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6LocalizedFallbackReasons=")))
      .toBe(false);
    expect(() => toRuntimeGraph(session)).not.toThrow();
  });

  it("records v6D v6E and v6F empty-alpha blocked metadata in operation provenance", () => {
    const newContourCandidates = V6_MESH_GENERATION_CANDIDATES.filter(
      (candidate) =>
        candidate.backendId === "v6d-contour-constrainautor" ||
        candidate.backendId === "v6d-contour-band-support-rings" ||
        candidate.backendId === "v6d-adaptive-staggered-band" ||
        candidate.backendId === "v6d-adaptive-contour-constrainautor" ||
        candidate.backendId === "v6e-contour-poly2tri" ||
        candidate.backendId === "v6f-contour-custom-cdt"
    );

    for (const candidate of newContourCandidates) {
      const session = createFixtureSessionWithSizedTextureBytes({
        textureSize: { width: 16, height: 16 },
        meshBounds: { x: 4, y: 8, width: 16, height: 16 },
        opaquePixels: []
      });
      const request = createGenerateMeshRequest({
        dryRun: false,
        method: candidate.methodId,
        densityHint: "low"
      });

      const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));
      const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];

      expect(outcome.result.status).toBe("committed");
      expect(transformHistory).toEqual(
        expect.arrayContaining([
          `generateMesh:${candidate.methodId}`,
          "meshSource:bounds-grid",
          `fallback:${candidate.methodId}:alpha-empty`,
          "meshQuality:triangulationMode=v6-backend-blocked-fallback",
          `meshQuality:v6Method=${candidate.methodId}`,
          `meshQuality:v6Backend=${candidate.backendId}`,
          `meshQuality:v6BackendImplementation=${candidate.backendImplementationStatus}`,
          `meshQuality:v6RequestedSource=${candidate.sourceId}`,
          "meshQuality:v6ActualSource=bounds-grid",
          "meshQuality:v6Output=blocked",
          "meshQuality:v6Fallback=alpha-empty",
          "meshQuality:v6AlphaBounds=unavailable",
          "meshQuality:v6OpaquePixels=0",
          "meshQuality:v6ContourPipelineStatus=blocked",
          "meshQuality:v6ContourBlockedReason=alpha-empty"
        ])
      );
      expect(transformHistory).not.toContain("meshQuality:v6Output=backend-output");
      expectBlockedBackendProvenance(transformHistory, candidate.backendId, "alpha-empty");
    }
  });

  it("records v6D v6E and v6F missing-texture blocked metadata in operation provenance", () => {
    const newContourCandidates = V6_MESH_GENERATION_CANDIDATES.filter(
      (candidate) =>
        candidate.backendId === "v6d-contour-constrainautor" ||
        candidate.backendId === "v6d-contour-band-support-rings" ||
        candidate.backendId === "v6d-adaptive-staggered-band" ||
        candidate.backendId === "v6d-adaptive-contour-constrainautor" ||
        candidate.backendId === "v6e-contour-poly2tri" ||
        candidate.backendId === "v6f-contour-custom-cdt"
    );

    for (const candidate of newContourCandidates) {
      const session = createFixtureSession();
      const request = createGenerateMeshRequest({
        dryRun: false,
        method: candidate.methodId,
        densityHint: "low"
      });

      const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));
      const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];

      expect(outcome.result.status).toBe("committed");
      expect(transformHistory).toEqual(
        expect.arrayContaining([
          `generateMesh:${candidate.methodId}`,
          "meshSource:bounds-grid",
          `fallback:${candidate.methodId}:texture-bytes-unavailable`,
          "meshQuality:triangulationMode=v6-backend-blocked-fallback",
          `meshQuality:v6Method=${candidate.methodId}`,
          `meshQuality:v6Backend=${candidate.backendId}`,
          `meshQuality:v6BackendImplementation=${candidate.backendImplementationStatus}`,
          `meshQuality:v6RequestedSource=${candidate.sourceId}`,
          "meshQuality:v6ActualSource=bounds-grid",
          "meshQuality:v6Output=blocked",
          "meshQuality:v6Fallback=texture-bytes-unavailable",
          "meshQuality:v6AlphaBounds=unavailable"
        ])
      );
      expect(transformHistory).not.toContain("meshQuality:v6Output=backend-output");
      expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6ContourPipelineStatus="))).toBe(false);
      expectBlockedBackendProvenance(transformHistory, candidate.backendId, "texture-bytes-unavailable");
    }
  });

  it("commits auto-outline-v6b-constrainautor and records constraint diagnostics", () => {
    const session = createFixtureSessionWithSizedTextureBytes({
      textureSize: { width: 20, height: 16 },
      meshBounds: { x: 4, y: 8, width: 20, height: 16 },
      opaquePixels: createPixelsFromPredicate(20, 16, (x, y) => x >= 4 && x <= 15 && y >= 3 && y <= 12)
    });
    const request = createGenerateMeshRequest({
      dryRun: false,
      method: "auto-outline-v6b-constrainautor",
      densityHint: "medium"
    });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));
    const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.meshes[0]?.vertices.length).toBeGreaterThan(0);
    expect(session.graph.meshes[0]?.triangles.length).toBeGreaterThan(0);
    expect(transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v6b-constrainautor",
        "meshSource:outline-v6b-constrainautor-rgba",
        "meshQuality:triangulationMode=v6b-delaunator-constrainautor",
        "meshQuality:v6Backend=v6b-constrainautor",
        "meshQuality:v6BackendImplementation=implemented",
        "meshQuality:v6ActualSource=outline-v6b-constrainautor-rgba",
        "meshQuality:v6Output=backend-output",
        "meshQuality:v6ConstrainautorDependencyGate=available",
        "meshQuality:v6ConstrainautorRecoveryFailed=false",
        "meshQuality:v6ConstrainautorMissingConstraints=0"
      ])
    );
    expect(transformHistory.some((entry) => entry.startsWith("fallback:auto-outline-v6b-constrainautor"))).toBe(false);
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6ConstrainautorConstraintEdges="))).toBe(true);
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6ConstrainautorPreservedConstraints="))).toBe(true);
  });

  it("records auto-outline-v6c-poly2tri hole limitation fallback provenance", () => {
    const session = createFixtureSessionWithSizedTextureBytes({
      textureSize: { width: 26, height: 22 },
      meshBounds: { x: 4, y: 8, width: 26, height: 22 },
      opaquePixels: createPixelsFromPredicate(26, 22, (x, y) => {
        const outer = x >= 3 && x <= 22 && y >= 3 && y <= 18;
        const nearTouchingHole = x >= 11 && x <= 15 && y >= 4 && y <= 12;
        return outer && !nearTouchingHole;
      })
    });
    const request = createGenerateMeshRequest({
      dryRun: false,
      method: "auto-outline-v6c-poly2tri",
      densityHint: "medium"
    });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));
    const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.meshes[0]?.vertices.length).toBeGreaterThan(0);
    expect(transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v6c-poly2tri",
        "meshSource:alpha-aware-rgba",
        "fallback:auto-outline-v6c-poly2tri:v6c-poly2tri-hole-unsupported",
        "meshQuality:triangulationMode=v6-backend-blocked-fallback",
        "meshQuality:v6Backend=v6c-poly2tri",
        "meshQuality:v6BackendImplementation=implemented",
        "meshQuality:v6ActualSource=alpha-aware-rgba",
        "meshQuality:v6Output=fallback-output",
        "meshQuality:v6Fallback=v6c-poly2tri-hole-unsupported",
        "meshQuality:v6HoleHandling=unsupported-fallback",
        "meshQuality:v6Poly2TriDependencyGate=available",
        "meshQuality:v6Poly2TriPolygonValidationFailed=false",
        "meshQuality:v6Poly2TriHoleValidationFailed=true",
        "meshQuality:v6Poly2TriTriangulationThrown=false",
        "meshQuality:v6Poly2TriBoundaryMissing=0",
        "meshQuality:v6Poly2TriMainIslandOnlyFallback=false"
      ])
    );
    expect(transformHistory).not.toContain("meshQuality:v6Output=backend-output");
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6Poly2TriOuterPoints="))).toBe(true);
    expect(transformHistory.some((entry) => /^meshQuality:v6Poly2TriHoles=[1-9]\d*$/.test(entry))).toBe(true);
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6Poly2TriSteinerPoints="))).toBe(true);
  });

  it("allows previewMesh commits for v6 candidate methods", () => {
    for (const candidate of V6_MESH_GENERATION_CANDIDATES) {
      const session = createFixtureSessionWithGeneratedMesh();
      const previewMesh = createPreviewMesh(session);
      const request = createGenerateMeshRequest({
        dryRun: false,
        method: candidate.methodId,
        previewMesh
      });

      const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

      expect(outcome.result.status).toBe("committed");
      expect(session.graph.meshes[0]).toMatchObject({
        vertices: previewMesh.vertices,
        uvs: previewMesh.uvs,
        triangles: previewMesh.triangles,
        vertexStableIds: previewMesh.vertexStableIds
      });
      expect(session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
        expect.arrayContaining([`generateMesh:${candidate.methodId}`, "meshSource:previewMesh"])
      );
    }
  });

  it("preserves v6 backend-output preview provenance on previewMesh commit", () => {
    const session = createFixtureSessionWithSizedTextureBytes({
      textureSize: { width: 20, height: 16 },
      meshBounds: { x: 4, y: 8, width: 20, height: 16 },
      opaquePixels: createPixelsFromPredicate(20, 16, (x, y) => x >= 4 && x <= 15 && y >= 3 && y <= 12)
    });
    const preview = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_preview_body_v6a"),
      method: "auto-outline-v6a-local",
      densityHint: "medium"
    });
    if (preview === undefined) {
      throw new Error("Expected v6a preview mesh.");
    }
    const request = createGenerateMeshRequest({
      dryRun: false,
      method: "auto-outline-v6a-local",
      densityHint: "medium",
      previewMesh: preview.mesh,
      previewProvenance: createPreviewProvenance(preview)
    });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));
    const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.meshes[0]).toMatchObject({
      vertices: preview.mesh.vertices,
      uvs: preview.mesh.uvs,
      triangles: preview.mesh.triangles,
      vertexStableIds: preview.mesh.vertexStableIds
    });
    expect(transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v6a-local",
        "meshSource:previewMesh",
        "previewMeshSource:outline-v6a-local-rgba",
        "meshQuality:v6ActualSource=outline-v6a-local-rgba",
        "meshQuality:v6Output=backend-output",
        "meshQuality:v6Backend=v6a-local",
        "meshQuality:v6FallbackSteps=0"
      ])
    );
  });

  it("preserves v6d support-ring preview provenance diagnostics on previewMesh commit", () => {
    const session = createFixtureSessionWithSizedTextureBytes({
      textureSize: { width: 20, height: 16 },
      meshBounds: { x: 4, y: 8, width: 20, height: 16 },
      opaquePixels: createPixelsFromPredicate(20, 16, (x, y) => x >= 4 && x <= 15 && y >= 3 && y <= 12)
    });
    const preview = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_preview_body_v6d_support"),
      method: "auto-outline-v6d-contour-band-support-rings",
      densityHint: "medium"
    });
    if (preview === undefined) {
      throw new Error("Expected v6d support-ring preview mesh.");
    }
    expect(preview.qualityMetrics?.v6Metrics?.supportRingDiagnostics).toBeDefined();
    const request = createGenerateMeshRequest({
      dryRun: false,
      method: "auto-outline-v6d-contour-band-support-rings",
      densityHint: "medium",
      previewMesh: preview.mesh,
      previewProvenance: createPreviewProvenance(preview)
    });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));
    const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];

    expect(outcome.result.status).toBe("committed");
    expect(transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v6d-contour-band-support-rings",
        "meshSource:previewMesh",
        "previewMeshSource:outline-v6d-contour-band-support-rings-rgba",
        "meshQuality:v6ActualSource=outline-v6d-contour-band-support-rings-rgba",
        "meshQuality:v6Output=backend-output",
        "meshQuality:v6Backend=v6d-contour-band-support-rings",
        "meshQuality:v6ConstrainautorDependencyGate=available",
        "meshQuality:v6ConstrainautorRecoveryFailed=false",
        "meshQuality:v6SupportRingOuterOffset=2.5",
        "meshQuality:v6SupportRingInnerOffset=1.75",
        "meshQuality:v6SupportRingOuterUvPolicy=projected-to-alpha-boundary"
      ])
    );
    expect(transformHistory.some((entry) => /^meshQuality:v6SupportRingBoundaryPoints=[1-9]\d*$/.test(entry))).toBe(true);
    expect(transformHistory.some((entry) => /^meshQuality:v6SupportRingOuterPoints=[1-9]\d*$/.test(entry))).toBe(true);
    expect(transformHistory.some((entry) => /^meshQuality:v6SupportRingSupportBandTriangles=[1-9]\d*$/.test(entry))).toBe(true);
  });

  it("preserves v6d adaptive staggered-band preview provenance diagnostics on previewMesh commit", () => {
    const session = createFixtureSessionWithSizedTextureBytes({
      textureSize: { width: 20, height: 16 },
      meshBounds: { x: 4, y: 8, width: 20, height: 16 },
      opaquePixels: createPixelsFromPredicate(20, 16, (x, y) => x >= 4 && x <= 15 && y >= 3 && y <= 12)
    });
    const preview = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_preview_body_v6d_adaptive"),
      method: "auto-outline-v6d-adaptive-staggered-band",
      densityHint: "medium"
    });
    if (preview === undefined) {
      throw new Error("Expected v6d adaptive staggered-band preview mesh.");
    }
    expect(preview.qualityMetrics?.v6Metrics?.adaptiveStaggeredBandDiagnostics).toBeDefined();
    const request = createGenerateMeshRequest({
      dryRun: false,
      method: "auto-outline-v6d-adaptive-staggered-band",
      densityHint: "medium",
      previewMesh: preview.mesh,
      previewProvenance: createPreviewProvenance(preview)
    });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));
    const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];

    expect(outcome.result.status).toBe("committed");
    expect(transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v6d-adaptive-staggered-band",
        "meshSource:previewMesh",
        "previewMeshSource:outline-v6d-adaptive-staggered-band-rgba",
        "meshQuality:v6ActualSource=outline-v6d-adaptive-staggered-band-rgba",
        "meshQuality:v6Output=backend-output",
        "meshQuality:v6Backend=v6d-adaptive-staggered-band",
        "meshQuality:v6AdaptiveDirectAlphaToInteriorEdges=0",
        "meshQuality:v6AdaptiveInteriorFillUsesStaggeredInnerBoundary=true"
      ])
    );
    expect(transformHistory.some((entry) => /^meshQuality:v6AdaptiveStaggeredInnerPoints=[1-9]\d*$/.test(entry))).toBe(true);
    expect(transformHistory.some((entry) => /^meshQuality:v6AdaptiveExplicitAlphaInnerStripTriangles=[1-9]\d*$/.test(entry))).toBe(true);
  });

  it("preserves v6d adaptive contour-constrainautor preview provenance diagnostics on previewMesh commit", () => {
    const session = createFixtureSessionWithSizedTextureBytes({
      textureSize: { width: 20, height: 16 },
      meshBounds: { x: 4, y: 8, width: 20, height: 16 },
      opaquePixels: createPixelsFromPredicate(20, 16, (x, y) => x >= 4 && x <= 15 && y >= 3 && y <= 12)
    });
    const preview = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_preview_body_v6d_adaptive_contour"),
      method: "auto-outline-v6d-adaptive-contour-constrainautor",
      densityHint: "medium"
    });
    if (preview === undefined) {
      throw new Error("Expected v6d adaptive contour-constrainautor preview mesh.");
    }
    expect(preview.qualityMetrics?.v6Metrics?.adaptiveDensityDiagnostics).toBeDefined();
    expect(preview.qualityMetrics?.v6Metrics?.adaptiveStaggeredBandDiagnostics).toBeUndefined();
    const request = createGenerateMeshRequest({
      dryRun: false,
      method: "auto-outline-v6d-adaptive-contour-constrainautor",
      densityHint: "medium",
      previewMesh: preview.mesh,
      previewProvenance: createPreviewProvenance(preview)
    });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));
    const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];

    expect(outcome.result.status).toBe("committed");
    expect(transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v6d-adaptive-contour-constrainautor",
        "meshSource:previewMesh",
        "previewMeshSource:outline-v6d-adaptive-contour-constrainautor-rgba",
        "meshQuality:v6ActualSource=outline-v6d-adaptive-contour-constrainautor-rgba",
        "meshQuality:v6Output=backend-output",
        "meshQuality:v6Backend=v6d-adaptive-contour-constrainautor"
      ])
    );
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6AdaptiveResolvedBoundarySpacing="))).toBe(true);
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6AdaptiveStaggeredInnerPoints="))).toBe(false);
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:v6AdaptiveExplicitAlphaInnerStripTriangles="))).toBe(false);
  });

  it("preserves v6d adaptive contour multi-island preview provenance diagnostics on previewMesh commit", () => {
    const textureSize = { width: 48, height: 36 };
    const session = createFixtureSessionWithSizedTextureBytes({
      textureSize,
      meshBounds: { x: 4, y: 8, width: 48, height: 36 },
      opaquePixels: createPixelsFromPredicate(textureSize.width, textureSize.height, (x, y) => {
        const leftLeg = x >= 7 && x <= 17 && y >= 5 && y <= 30 && !(x >= 7 && x <= 9 && y <= 9);
        const rightLeg = x >= 30 && x <= 40 && y >= 5 && y <= 30 && !(x >= 38 && x <= 40 && y <= 9);
        return leftLeg || rightLeg;
      })
    });
    const preview = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_preview_body_v6d_adaptive_contour_multi_island"),
      method: "auto-outline-v6d-adaptive-contour-constrainautor",
      densityHint: "medium"
    });
    if (preview === undefined) {
      throw new Error("Expected v6d adaptive contour multi-island preview mesh.");
    }
    expect(preview.qualityMetrics?.v6Metrics?.multiIslandHandling).toBe("supported");
    const request = createGenerateMeshRequest({
      dryRun: false,
      method: "auto-outline-v6d-adaptive-contour-constrainautor",
      densityHint: "medium",
      previewMesh: preview.mesh,
      previewProvenance: createPreviewProvenance(preview)
    });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));
    const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];

    expect(outcome.result.status).toBe("committed");
    expect(transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v6d-adaptive-contour-constrainautor",
        "meshSource:previewMesh",
        "previewMeshSource:outline-v6d-adaptive-contour-constrainautor-rgba",
        "meshQuality:v6MultiIslandHandling=supported",
        "meshQuality:v6RawAlphaComponents=2",
        "meshQuality:v6KeptIslands=2",
        "meshQuality:v6GeneratedIslands=2",
        "meshQuality:v6BackendGeneratedIslands=2",
        "meshQuality:v6SkippedTinyNoiseIslands=0",
        "meshQuality:v6SkippedTinyNoisePixels=0",
        "meshQuality:v6LocalizedFallbacks=0"
      ])
    );
  });

  it("preserves v6 fallback preview provenance on previewMesh commit", () => {
    const session = createFixtureSessionWithSizedTextureBytes({
      textureSize: { width: 26, height: 22 },
      meshBounds: { x: 4, y: 8, width: 26, height: 22 },
      opaquePixels: createPixelsFromPredicate(26, 22, (x, y) => {
        const outer = x >= 3 && x <= 22 && y >= 3 && y <= 18;
        const nearTouchingHole = x >= 11 && x <= 15 && y >= 4 && y <= 12;
        return outer && !nearTouchingHole;
      })
    });
    const preview = createGeneratedMeshForDrawable({
      session,
      drawableId: DrawableIdSchema.parse("draw_body"),
      provenanceId: ProvenanceIdSchema.parse("prov_mesh_preview_body_v6c"),
      method: "auto-outline-v6c-poly2tri",
      densityHint: "medium"
    });
    if (preview === undefined) {
      throw new Error("Expected v6c fallback preview mesh.");
    }
    const request = createGenerateMeshRequest({
      dryRun: false,
      method: "auto-outline-v6c-poly2tri",
      densityHint: "medium",
      previewMesh: preview.mesh,
      previewProvenance: createPreviewProvenance(preview)
    });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));
    const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];

    expect(outcome.result.status).toBe("committed");
    expect(transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v6c-poly2tri",
        "meshSource:previewMesh",
        "previewMeshSource:alpha-aware-rgba",
        "fallback:auto-outline-v6c-poly2tri:v6c-poly2tri-hole-unsupported",
        "meshQuality:v6ActualSource=alpha-aware-rgba",
        "meshQuality:v6Output=fallback-output",
        "meshQuality:v6Fallback=v6c-poly2tri-hole-unsupported",
        "meshQuality:v6Poly2TriHoleValidationFailed=true"
      ])
    );
    expect(transformHistory).not.toContain("meshQuality:v6Output=backend-output");
  });

  it("commits auto-outline-v3-envelope and records envelope provenance metrics", () => {
    const session = createFixtureSessionWithSizedTextureBytes({
      textureSize: { width: 36, height: 32 },
      meshBounds: { x: 4, y: 8, width: 36, height: 32 },
      opaquePixels: createPixelsFromPredicate(36, 32, (x, y) => {
        const dx = (x - 16.5) / 10;
        const dy = (y - 15.5) / 8;
        const body = dx * dx + dy * dy <= 1;
        const tail = x >= 23 && x <= 30 && y >= 13 && y <= 18;
        const notch = x >= 8 && x <= 14 && y >= 18 && y <= 26;
        return (body || tail) && !notch;
      })
    });
    const request = createGenerateMeshRequest({ dryRun: false, method: "auto-outline-v3-envelope" });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.meshes[0]?.vertices.length).toBeGreaterThan(0);
    expect(session.graph.meshes[0]?.triangles.length).toBeGreaterThan(0);
    expect(session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v3-envelope",
        "meshSource:outline-v3-envelope-rgba",
        "meshQuality:triangulationMode=interim-delaunay-envelope-filter",
        "meshQuality:envelopeAlgorithm=auto-outline-v3-envelope",
        "meshQuality:envelopeOutsideSamples=0"
      ])
    );
    const transformHistory = session.graph.provenanceRecords.at(-1)?.transformHistory ?? [];
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:envelopeAreaRatio="))).toBe(true);
    expect(transformHistory.some((entry) => entry.startsWith("meshQuality:envelopeTransparentSamples="))).toBe(true);
    expect(transformHistory.some((entry) => entry.includes("constrained-triangulation-deferred"))).toBe(true);
  });

  it("records v3-specific fallback to a generated auto-outline-v2 mesh in operation provenance", () => {
    const session = createFixtureSessionWithSizedTextureBytes({
      textureSize: { width: 20, height: 20 },
      meshBounds: { x: 0, y: 0, width: 20, height: 20 },
      opaquePixels: createPixelsFromPredicate(20, 20, (x, y) => x >= 5 && x <= 7 && y >= 5 && y <= 8)
    });
    const request = createGenerateMeshRequest({
      dryRun: false,
      method: "auto-outline-v3-envelope",
      densityHint: "high"
    });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.meshes[0]?.vertexStableIds.some((id) => id.includes("_outline_v2_"))).toBe(true);
    expect(session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v3-envelope",
        "meshSource:outline-v2-rgba",
        "fallback:auto-outline-v3-envelope:envelope-generation-failed",
        "meshQuality:triangulationMode=interim-delaunay-alpha-filter"
      ])
    );
    expect(
      session.graph.provenanceRecords.at(-1)?.transformHistory.some((entry) =>
        entry.startsWith("fallback:auto-outline-v2:")
      )
    ).toBe(false);
  });

  it("records v2.5 soft-boundary failure fallback to a generated auto-outline-v2 mesh in operation provenance", () => {
    const session = createFixtureSessionWithSizedTextureBytes({
      textureSize: { width: 20, height: 20 },
      meshBounds: { x: 0, y: 0, width: 20, height: 20 },
      opaquePixels: createPixelsFromPredicate(20, 20, (x, y) => x >= 5 && x <= 7 && y >= 5 && y <= 8)
    });
    const request = createGenerateMeshRequest({
      dryRun: false,
      method: "auto-outline-v2.5-soft-boundary",
      densityHint: "high"
    });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.meshes[0]?.vertexStableIds.some((id) => id.includes("_outline_v2_"))).toBe(true);
    expect(session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v2.5-soft-boundary",
        "meshSource:outline-v2-rgba",
        "fallback:auto-outline-v2.5-soft-boundary:soft-boundary-generation-failed",
        "meshQuality:triangulationMode=interim-delaunay-alpha-filter"
      ])
    );
    expect(
      session.graph.provenanceRecords.at(-1)?.transformHistory.some((entry) =>
        entry.startsWith("fallback:auto-outline-v2:")
      )
    ).toBe(false);
  });

  it("records auto-outline-v2 fallback chain in operation provenance", () => {
    const session = createFixtureSessionWithTextureBytes([]);
    const request = createGenerateMeshRequest({ dryRun: false, method: "auto-outline-v2" });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v2",
        "meshSource:bounds-grid",
        "fallback:auto-outline-v2:alpha-empty",
        "fallback:auto-outline-v1:alpha-empty"
      ])
    );
  });

  it("records auto-outline-v2.5-soft-boundary fallback chain in operation provenance", () => {
    const session = createFixtureSessionWithTextureBytes([]);
    const request = createGenerateMeshRequest({ dryRun: false, method: "auto-outline-v2.5-soft-boundary" });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v2.5-soft-boundary",
        "meshSource:bounds-grid",
        "fallback:auto-outline-v2.5-soft-boundary:alpha-empty",
        "fallback:auto-outline-v2:alpha-empty",
        "fallback:auto-outline-v1:alpha-empty"
      ])
    );
  });

  it("records auto-outline-v2.6-soft-apron fallback chain in operation provenance", () => {
    const session = createFixtureSessionWithTextureBytes([]);
    const request = createGenerateMeshRequest({ dryRun: false, method: "auto-outline-v2.6-soft-apron" });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v2.6-soft-apron",
        "meshSource:bounds-grid",
        "fallback:auto-outline-v2.6-soft-apron:alpha-empty",
        "fallback:auto-outline-v2.5-soft-boundary:alpha-empty",
        "fallback:auto-outline-v2:alpha-empty",
        "fallback:auto-outline-v1:alpha-empty"
      ])
    );
  });

  it("records auto-outline-v4-contour-band fallback chain in operation provenance", () => {
    const session = createFixtureSessionWithTextureBytes([]);
    const request = createGenerateMeshRequest({ dryRun: false, method: "auto-outline-v4-contour-band" });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v4-contour-band",
        "meshSource:bounds-grid",
        "fallback:auto-outline-v4-contour-band:alpha-empty",
        "fallback:auto-outline-v2.6-soft-apron:alpha-empty",
        "fallback:auto-outline-v2.5-soft-boundary:alpha-empty",
        "fallback:auto-outline-v2:alpha-empty",
        "fallback:auto-outline-v1:alpha-empty"
      ])
    );
  });

  it("records auto-outline-v3-envelope fallback chain in operation provenance", () => {
    const session = createFixtureSessionWithTextureBytes([]);
    const request = createGenerateMeshRequest({ dryRun: false, method: "auto-outline-v3-envelope" });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.provenanceRecords.at(-1)?.transformHistory).toEqual(
      expect.arrayContaining([
        "generateMesh:auto-outline-v3-envelope",
        "meshSource:bounds-grid",
        "fallback:auto-outline-v3-envelope:alpha-empty",
        "fallback:auto-outline-v2:alpha-empty",
        "fallback:auto-outline-v1:alpha-empty"
      ])
    );
  });
});

function expectBlockedBackendProvenance(
  transformHistory: readonly string[],
  backendId: string,
  fallbackReason: "alpha-empty" | "texture-bytes-unavailable"
): void {
  if (backendId === "v6d-contour-constrainautor") {
    expect(transformHistory).toEqual(
      expect.arrayContaining([
        "meshQuality:v6ConstrainautorDependencyGate=available",
        "meshQuality:v6ConstrainautorConstraintEdges=0",
        "meshQuality:v6ConstrainautorPreservedConstraints=0",
        "meshQuality:v6ConstrainautorMissingConstraints=0",
        "meshQuality:v6ConstrainautorRecoveryFailed=false"
      ])
    );
  }

  if (backendId === "v6d-contour-band-support-rings") {
    expect(transformHistory).toEqual(
      expect.arrayContaining([
        "meshQuality:v6ConstrainautorDependencyGate=available",
        "meshQuality:v6ConstrainautorConstraintEdges=0",
        "meshQuality:v6ConstrainautorPreservedConstraints=0",
        "meshQuality:v6ConstrainautorMissingConstraints=0",
        "meshQuality:v6ConstrainautorRecoveryFailed=false",
        "meshQuality:v6SupportRingBoundaryPoints=0",
        "meshQuality:v6SupportRingAlphaBoundaryPoints=0",
        "meshQuality:v6SupportRingOuterPoints=0",
        "meshQuality:v6SupportRingInnerPoints=0",
        "meshQuality:v6SupportRingSkippedPoints=0",
        "meshQuality:v6SupportRingMergedPoints=0",
        "meshQuality:v6SupportRingSupportBandTriangles=0",
        "meshQuality:v6SupportRingInteriorTriangles=0",
        "meshQuality:v6SupportRingOutsideLayer=false",
        "meshQuality:v6SupportRingMaxOutsideLayerDistance=0",
        "meshQuality:v6SupportRingOuterOffset=0",
        "meshQuality:v6SupportRingInnerOffset=0",
        "meshQuality:v6SupportRingOuterUvPolicy=projected-to-alpha-boundary"
      ])
    );
  }

  if (backendId === "v6d-adaptive-staggered-band") {
    expect(transformHistory).toEqual(
      expect.arrayContaining([
        "meshQuality:v6ConstrainautorDependencyGate=available",
        "meshQuality:v6ConstrainautorConstraintEdges=0",
        "meshQuality:v6ConstrainautorPreservedConstraints=0",
        "meshQuality:v6ConstrainautorMissingConstraints=0",
        "meshQuality:v6ConstrainautorRecoveryFailed=false",
        "meshQuality:v6SupportRingBoundaryPoints=0",
        "meshQuality:v6SupportRingAlphaBoundaryPoints=0",
        "meshQuality:v6SupportRingOuterPoints=0",
        "meshQuality:v6SupportRingInnerPoints=0",
        "meshQuality:v6SupportRingSkippedPoints=0",
        "meshQuality:v6SupportRingMergedPoints=0",
        "meshQuality:v6SupportRingSupportBandTriangles=0",
        "meshQuality:v6SupportRingInteriorTriangles=0",
        "meshQuality:v6SupportRingOutsideLayer=false",
        "meshQuality:v6SupportRingMaxOutsideLayerDistance=0",
        "meshQuality:v6SupportRingOuterOffset=0",
        "meshQuality:v6SupportRingInnerOffset=0",
        "meshQuality:v6SupportRingOuterUvPolicy=projected-to-alpha-boundary",
        "meshQuality:v6AdaptiveDensityReferenceArea=0",
        "meshQuality:v6AdaptiveDensityEffectiveArea=0",
        "meshQuality:v6AdaptiveResolvedMaxInteriorVertices=0",
        "meshQuality:v6AdaptiveStaggeredInnerPoints=0",
        "meshQuality:v6AdaptiveExplicitAlphaInnerStripTriangles=0",
        "meshQuality:v6AdaptiveDirectAlphaToInteriorEdges=0",
        "meshQuality:v6AdaptiveInteriorFillUsesStaggeredInnerBoundary=false"
      ])
    );
  }

  if (backendId === "v6d-adaptive-contour-constrainautor") {
    expect(transformHistory).toEqual(
      expect.arrayContaining([
        "meshQuality:v6ConstrainautorDependencyGate=available",
        "meshQuality:v6ConstrainautorConstraintEdges=0",
        "meshQuality:v6ConstrainautorPreservedConstraints=0",
        "meshQuality:v6ConstrainautorMissingConstraints=0",
        "meshQuality:v6ConstrainautorRecoveryFailed=false",
        "meshQuality:v6AdaptiveDensityReferenceArea=0",
        "meshQuality:v6AdaptiveDensityEffectiveArea=0",
        "meshQuality:v6AdaptiveResolvedMaxInteriorVertices=0"
      ])
    );
    expect(transformHistory).not.toContain("meshQuality:v6AdaptiveStaggeredInnerPoints=0");
    expect(transformHistory).not.toContain("meshQuality:v6AdaptiveExplicitAlphaInnerStripTriangles=0");
    expect(transformHistory).not.toContain("meshQuality:v6AdaptiveInteriorFillUsesStaggeredInnerBoundary=false");
  }

  if (backendId === "v6e-contour-poly2tri") {
    expect(transformHistory).toEqual(
      expect.arrayContaining([
        "meshQuality:v6Poly2TriDependencyGate=available",
        "meshQuality:v6Poly2TriOuterPoints=0",
        "meshQuality:v6Poly2TriSteinerPoints=0",
        "meshQuality:v6Poly2TriBoundaryPreserved=0",
        "meshQuality:v6Poly2TriBoundaryMissing=0",
        "meshQuality:v6Poly2TriTriangulationThrown=false"
      ])
    );
  }

  if (backendId === "v6f-contour-custom-cdt") {
    expect(transformHistory).toEqual(
      expect.arrayContaining([
        "meshQuality:v6CustomCdtDependencyGate=not-required",
        "meshQuality:v6CustomCdtConstraintEdges=0",
        "meshQuality:v6CustomCdtPreservedConstraints=0",
        "meshQuality:v6CustomCdtMissingConstraints=0",
        "meshQuality:v6CustomCdtEdgeFlips=0",
        "meshQuality:v6CustomCdtLongSpokeCandidates=0",
        `meshQuality:v6CustomCdtFallback=${fallbackReason}`
      ])
    );
  }
}

const createGenerateMeshRequest = (options: {
  readonly dryRun: boolean;
  readonly method?: MeshGenerationMethod;
  readonly densityHint?: "low" | "medium" | "high";
  readonly previewMesh?: AuthoringSession["graph"]["meshes"][number];
  readonly previewProvenance?: GenerateMeshPreviewProvenance;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_generate_body_mesh",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "generateMesh",
    payload: {
      drawableId: "draw_body",
      method: options.method ?? "auto-grid-v1",
      ...(options.densityHint === undefined ? {} : { densityHint: options.densityHint }),
      ...(options.previewMesh === undefined ? {} : { previewMesh: options.previewMesh }),
      ...(options.previewProvenance === undefined ? {} : { previewProvenance: options.previewProvenance })
    }
  });

const getRequestOperationId = (request: OperationRequestDto): OperationId => {
  if (request.operationId === undefined) {
    throw new Error("Test requests must include an operationId.");
  }

  return request.operationId;
};

const createFixtureSessionWithGeneratedMesh = (): AuthoringSession => {
  const session = createFixtureSession();
  session.graph.meshes[0] = {
    ...session.graph.meshes[0]!,
    vertices: [
      { x: 4, y: 8 },
      { x: 44, y: 8 },
      { x: 4, y: 28 },
      { x: 44, y: 28 }
    ],
    uvs: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 }
    ],
    triangles: [
      [0, 1, 2],
      [1, 3, 2]
    ],
    vertexStableIds: ["vtx_body_0_0", "vtx_body_0_1", "vtx_body_1_0", "vtx_body_1_1"]
  };
  return session;
};

const createPreviewMesh = (
  session: AuthoringSession,
  overrides: Partial<AuthoringSession["graph"]["meshes"][number]> = {}
): AuthoringSession["graph"]["meshes"][number] => ({
  ...session.graph.meshes[0]!,
  vertices: [
    { x: 9, y: 10 },
    { x: 12, y: 10 },
    { x: 9, y: 14 }
  ],
  uvs: [
    { x: 0.1, y: 0.2 },
    { x: 0.6, y: 0.2 },
    { x: 0.1, y: 0.9 }
  ],
  triangles: [[0, 1, 2] as [number, number, number]],
  vertexStableIds: ["vtx_preview_0", "vtx_preview_1", "vtx_preview_2"],
  generationProvenanceId: ProvenanceIdSchema.parse("prov_mesh_preview_draw_body"),
  ...overrides
});

const createPreviewProvenance = (
  generated: DrawableGeneratedMeshResult
): GenerateMeshPreviewProvenance => ({
  source: generated.source,
  ...(generated.fallbackReason === undefined ? {} : { fallbackReason: generated.fallbackReason }),
  ...(generated.fallbackSteps === undefined ? {} : { fallbackSteps: generated.fallbackSteps }),
  ...(generated.qualityMetrics === undefined ? {} : { qualityMetrics: generated.qualityMetrics })
});

const createFixtureSessionWithTextureBytes = (
  opaquePixels: readonly (readonly [number, number])[] = [
    [1, 1],
    [2, 1],
    [1, 2],
    [2, 2]
  ]
): AuthoringSession => {
  const session = createFixtureSession();
  const bytes = createAlphaBytes(4, 4, opaquePixels);
  session.graph.meshes[0] = {
    ...session.graph.meshes[0]!,
    bounds: { x: 4, y: 8, width: 4, height: 4 }
  };
  session.graph.textureAtlas = {
    schemaVersion: "texture-atlas-v1",
    textures: [
      {
        textureId: TextureIdSchema.parse("tex_body"),
        filePath: "assets/textures/body.raw-rgba",
        sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
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
          provenanceId: ProvenanceIdSchema.parse("prov_create_body"),
          rightsAssetId: "rights_body"
        }
      }
    ]
  };
  session.binaryAssets = {
    fileEntries: [
      {
        path: "assets/textures/body.raw-rgba",
        bytes,
        mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
        binaryAssetId: "bin_body_rgba"
      }
    ],
    binaryAssetIndex: {
      schemaVersion: "binary-asset-index-v1",
      assets: []
    },
    byteIntakeSummaries: []
  };
  return session;
};

const createFixtureSessionWithSizedTextureBytes = (input: {
  readonly textureSize: { readonly width: number; readonly height: number };
  readonly meshBounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly opaquePixels: readonly (readonly [number, number])[];
}): AuthoringSession => {
  const session = createFixtureSession();
  const bytes = createAlphaBytes(input.textureSize.width, input.textureSize.height, input.opaquePixels);
  session.graph.meshes[0] = {
    ...session.graph.meshes[0]!,
    bounds: input.meshBounds
  };
  session.graph.textureAtlas = {
    schemaVersion: "texture-atlas-v1",
    textures: [
      {
        textureId: TextureIdSchema.parse("tex_body"),
        filePath: "assets/textures/body.raw-rgba",
        sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
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
          provenanceId: ProvenanceIdSchema.parse("prov_create_body"),
          rightsAssetId: "rights_body"
        }
      }
    ]
  };
  session.binaryAssets = {
    fileEntries: [
      {
        path: "assets/textures/body.raw-rgba",
        bytes,
        mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
        binaryAssetId: "bin_body_rgba"
      }
    ],
    binaryAssetIndex: {
      schemaVersion: "binary-asset-index-v1",
      assets: []
    },
    byteIntakeSummaries: []
  };
  return session;
};

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_generate_mesh_operation_test"),
    packageDisplayName: "Generate Mesh Operation Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 128, height: 128 },
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
        sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
        textureId: TextureIdSchema.parse("tex_body"),
        meshId: MeshIdSchema.parse("mesh_body"),
        defaultOpacity: 1,
        runtimeVisibility: true,
        baseDrawOrder: 0,
        sourceProvenanceId: ProvenanceIdSchema.parse("prov_create_body")
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
        bounds: { x: 4, y: 8, width: 40, height: 20 },
        generationProvenanceId: ProvenanceIdSchema.parse("prov_create_body")
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
    rightsRecords: []
  }
});

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
