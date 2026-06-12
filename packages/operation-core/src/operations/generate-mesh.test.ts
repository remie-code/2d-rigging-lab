import {
  createInitialAuthoringRevision,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
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

const createGenerateMeshRequest = (options: {
  readonly dryRun: boolean;
  readonly method?:
    | "manual-empty"
    | "auto-grid-v1"
    | "auto-outline-v1"
    | "auto-outline-v2"
    | "auto-outline-v3-envelope";
  readonly densityHint?: "low" | "medium" | "high";
  readonly previewMesh?: AuthoringSession["graph"]["meshes"][number];
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
      ...(options.previewMesh === undefined ? {} : { previewMesh: options.previewMesh })
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
