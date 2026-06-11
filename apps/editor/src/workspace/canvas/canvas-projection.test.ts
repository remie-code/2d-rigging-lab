import { createInitialAuthoringRevision, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  createCanvasRenderProjection,
  fitCanvasView,
  hasIsolatableCanvasSelection,
  hitTestTopmostDrawable,
  screenToCanvasPoint,
  zoomViewAtScreenPoint
} from "./canvas-projection";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const PART_HIDDEN_ONLY = PartIdSchema.parse("part_hidden_only");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_fixture_psd");
const PROVENANCE = ProvenanceIdSchema.parse("prov_fixture");
const DRAW_BACK = DrawableIdSchema.parse("draw_back");
const DRAW_FRONT = DrawableIdSchema.parse("draw_front");
const DRAW_HIDDEN = DrawableIdSchema.parse("draw_hidden");
const DRAW_MASK = DrawableIdSchema.parse("draw_mask");
const DRAW_TARGET = DrawableIdSchema.parse("draw_target");
const MESH_BACK = MeshIdSchema.parse("mesh_back");
const MESH_FRONT = MeshIdSchema.parse("mesh_front");
const MESH_HIDDEN = MeshIdSchema.parse("mesh_hidden");
const MESH_MASK = MeshIdSchema.parse("mesh_mask");
const MESH_TARGET = MeshIdSchema.parse("mesh_target");
const TEX_BACK = TextureIdSchema.parse("tex_back");
const TEX_FRONT = TextureIdSchema.parse("tex_front");
const TEX_HIDDEN = TextureIdSchema.parse("tex_hidden");
const TEX_MASK = TextureIdSchema.parse("tex_mask");
const TEX_TARGET = TextureIdSchema.parse("tex_target");

describe("canvas render projection", () => {
  it("projects runtime RGBA bytes, opacity, visibility, draw order, and masks for Canvas", () => {
    const session = createFixtureSession();
    const projection = createCanvasRenderProjection(session, {
      kind: "drawable",
      id: DRAW_FRONT
    });

    expect(projection.canvasBounds).toEqual({ x: -160, y: -120, width: 320, height: 240 });
    expect(projection.hasRenderableArtwork).toBe(true);
    expect(projection.selectedDrawableIds.has(DRAW_FRONT)).toBe(true);

    const front = projection.drawables.find((drawable) => drawable.drawableId === DRAW_FRONT);
    expect(front?.opacity).toBe(0.42);
    expect(front?.renderBytes?.byteLength).toBe(20 * 20 * 4);

    expect(hitTestTopmostDrawable(projection, { x: 6, y: 6 })).toBe(DRAW_FRONT);
    expect(hitTestTopmostDrawable(projection, { x: 3, y: 3 })).toBe(DRAW_BACK);

    const hidden = projection.drawables.find((drawable) => drawable.drawableId === DRAW_HIDDEN);
    expect(hidden?.visible).toBe(false);

    const target = projection.drawables.find((drawable) => drawable.drawableId === DRAW_TARGET);
    expect(target?.maskSourceDrawableIds).toEqual([DRAW_MASK]);
    expect(projection.maskRelations).toEqual([
      {
        maskRelationId: "maskrel_face_clip",
        sourceDrawableIds: [DRAW_MASK],
        targetDrawableIds: [DRAW_TARGET]
      }
    ]);
  });

  it("projects part subtree selection and stable fit/zoom math", () => {
    const session = createFixtureSession();
    const projection = createCanvasRenderProjection(session, {
      kind: "part",
      id: PART_FACE
    });

    expect(projection.selectedDrawableIds).toEqual(
      new Set([DRAW_BACK, DRAW_FRONT, DRAW_HIDDEN, DRAW_MASK, DRAW_TARGET])
    );
    expect(projection.selectionBounds).toEqual({ x: 0, y: 0, width: 40, height: 40 });

    const view = fitCanvasView(projection, { width: 640, height: 480 });
    expect(view.zoom).toBeCloseTo(1.6);
    expect(view.pan).toEqual({ x: 320, y: 240 });

    const pointer = { x: 127, y: 91 };
    const before = screenToCanvasPoint(pointer, view);
    const zoomed = zoomViewAtScreenPoint(view, pointer, view.zoom * 2);
    expect(screenToCanvasPoint(pointer, zoomed).x).toBeCloseTo(before.x);
    expect(screenToCanvasPoint(pointer, zoomed).y).toBeCloseTo(before.y);
  });

  it("allows isolate only when selection contains visible renderable drawables", () => {
    const session = createFixtureSession();

    expect(
      hasIsolatableCanvasSelection(
        createCanvasRenderProjection(session, {
          kind: "drawable",
          id: DRAW_FRONT
        })
      )
    ).toBe(true);
    expect(
      hasIsolatableCanvasSelection(
        createCanvasRenderProjection(session, {
          kind: "part",
          id: PART_FACE
        })
      )
    ).toBe(true);
    expect(
      hasIsolatableCanvasSelection(
        createCanvasRenderProjection(session, {
          kind: "drawable",
          id: DRAW_HIDDEN
        })
      )
    ).toBe(false);

    const hiddenOnlyProjection = createCanvasRenderProjection(createHiddenOnlyPartSession(), {
      kind: "part",
      id: PART_HIDDEN_ONLY
    });
    expect(hiddenOnlyProjection.selectedDrawableIds).toEqual(new Set([DRAW_HIDDEN]));
    expect(hasIsolatableCanvasSelection(hiddenOnlyProjection)).toBe(false);
  });

  it("applies editor-only part hidden gates to render and hit-test visibility", () => {
    const session = createFixtureSession();
    const projection = createCanvasRenderProjection(
      session,
      {
        kind: "drawable",
        id: DRAW_FRONT
      },
      { editorHiddenPartIds: new Set([PART_FACE]) }
    );

    expect(projection.selectedDrawableIds).toEqual(new Set([DRAW_FRONT]));
    expect(
      projection.drawables.find((drawable) => drawable.drawableId === DRAW_FRONT)?.visible
    ).toBe(false);
    expect(projection.hasRenderableArtwork).toBe(false);
    expect(hitTestTopmostDrawable(projection, { x: 6, y: 6 })).toBeUndefined();
    expect(session.graph.drawables.find((drawable) => drawable.drawableId === DRAW_FRONT)).toMatchObject({
      runtimeVisibility: true
    });
  });
});

function createFixtureSession(): AuthoringSession {
  const textures = [
    createTexture(TEX_BACK, "back", 20, 20),
    createTexture(TEX_FRONT, "front", 20, 20),
    createTexture(TEX_HIDDEN, "hidden", 30, 30),
    createTexture(TEX_MASK, "mask", 10, 10),
    createTexture(TEX_TARGET, "target", 10, 10)
  ];

  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_canvas_projection_fixture"),
      packageDisplayName: "Canvas projection fixture",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 1,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    binaryAssets: {
      fileEntries: textures.map((texture) => ({
        path: texture.binaryAssetRef.packageRelativePath,
        bytes: createRgbaBytes(texture.width, texture.height, texture.seed),
        mediaType: texture.binaryAssetRef.mediaType,
        binaryAssetId: texture.binaryAssetRef.binaryAssetId
      })),
      binaryAssetIndex: {
        schemaVersion: "binary-asset-index-v1",
        assets: textures.map((texture) => ({
          binaryAssetId: texture.binaryAssetRef.binaryAssetId,
          role: "texture-raster-v1",
          packageRelativePath: texture.binaryAssetRef.packageRelativePath,
          digest: texture.binaryAssetRef.digest,
          byteLength: texture.binaryAssetRef.byteLength,
          mediaType: texture.binaryAssetRef.mediaType,
          storageStatus: texture.binaryAssetRef.storageStatus,
          provenanceId: texture.binaryAssetRef.provenanceId,
          rightsAssetId: texture.binaryAssetRef.rightsAssetId,
          sourceAssetId: SOURCE_ASSET,
          textureId: texture.textureId
        }))
      },
      byteIntakeSummaries: []
    },
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 320, height: 240 },
      parts: [
        {
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [PART_FACE],
          drawableIds: []
        },
        {
          partId: PART_FACE,
          displayName: "Face",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_BACK, DRAW_FRONT, DRAW_HIDDEN, DRAW_MASK, DRAW_TARGET]
        }
      ],
      drawables: [
        createDrawable(DRAW_BACK, MESH_BACK, TEX_BACK, "Back", 1, true, 10),
        createDrawable(DRAW_FRONT, MESH_FRONT, TEX_FRONT, "Front", 0.42, true, 0),
        createDrawable(DRAW_HIDDEN, MESH_HIDDEN, TEX_HIDDEN, "Hidden", 1, false, 0),
        createDrawable(DRAW_MASK, MESH_MASK, TEX_MASK, "Mask", 1, true, 6),
        createDrawable(DRAW_TARGET, MESH_TARGET, TEX_TARGET, "Target", 1, true, 5)
      ],
      meshes: [
        createMesh(MESH_BACK, DRAW_BACK, 0, 0, 20, 20),
        createMesh(MESH_FRONT, DRAW_FRONT, 5, 5, 20, 20),
        createMesh(MESH_HIDDEN, DRAW_HIDDEN, 2, 2, 30, 30),
        createMesh(MESH_MASK, DRAW_MASK, 30, 30, 10, 10),
        createMesh(MESH_TARGET, DRAW_TARGET, 30, 30, 10, 10)
      ],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [
        {
          maskRelationId: MaskRelationIdSchema.parse("maskrel_face_clip"),
          maskDrawableIds: [DRAW_MASK],
          targetDrawableIds: [DRAW_TARGET],
          enabled: true
        }
      ],
      drawOrder: [
        { drawableId: DRAW_BACK, baseDrawOrder: 10, stableOrder: 10 },
        { drawableId: DRAW_FRONT, baseDrawOrder: 0, stableOrder: 0 },
        { drawableId: DRAW_HIDDEN, baseDrawOrder: 0, stableOrder: 0 },
        { drawableId: DRAW_MASK, baseDrawOrder: 6, stableOrder: 6 },
        { drawableId: DRAW_TARGET, baseDrawOrder: 5, stableOrder: 5 }
      ],
      rigControlRootIds: [],
      stableOrder: [
        PART_ROOT,
        PART_FACE,
        DRAW_BACK,
        DRAW_FRONT,
        DRAW_HIDDEN,
        DRAW_MASK,
        DRAW_TARGET
      ],
      sourceAssets: [
        {
          sourceAssetId: SOURCE_ASSET,
          kind: "psd-source-v1",
          filePath: "assets/sources/fixture.psd",
          contentHash: "sha256:fixture",
          importProfile: "layered-character-psd-profile-v1",
          layers: [
            createSourceLayer("layer_back", DRAW_BACK, 0, 0, 20, 20),
            createSourceLayer("layer_front", DRAW_FRONT, 5, 5, 20, 20),
            createSourceLayer("layer_hidden", DRAW_HIDDEN, 2, 2, 30, 30),
            createSourceLayer("layer_mask", DRAW_MASK, 30, 30, 10, 10),
            createSourceLayer("layer_target", DRAW_TARGET, 30, 30, 10, 10)
          ],
          diagnostics: [],
          psdProfile: {
            schemaVersion: "layered-character-psd-profile-v1",
            adapter: {
              adapterName: "fixture-adapter",
              adapterResultSchemaVersion: "psd-adapter-result-v1",
              sourceProfile: "layered-character-psd-profile-v1",
              evidenceKind: "adapter-supplied-metadata-v1"
            },
            canvas: {
              width: 320,
              height: 240,
              bounds: { x: -160, y: -120, width: 320, height: 240 }
            },
            sourceGroups: [],
            sourceLayers: [],
            unsupportedFeatures: [],
            diagnostics: [],
            compatibility: {
              structuredProfilePrecedence: "structured-profile-preferred-v1",
              flattenedDiagnosticsFallback: "sourceAsset.diagnostics-summary-fallback-v1",
              flattenedUnsupportedFeaturesFallback:
                "sourceLayer.unsupportedFeatures-feature-id-fallback-v1"
            }
          }
        }
      ],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: textures.map((texture) => ({
          textureId: texture.textureId,
          filePath: texture.binaryAssetRef.packageRelativePath,
          sourceAssetId: SOURCE_ASSET,
          sourceLayerId: `layer_${texture.name}`,
          provenanceId: PROVENANCE,
          binaryAssetRef: texture.binaryAssetRef
        }))
      },
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}

function createHiddenOnlyPartSession(): AuthoringSession {
  const session = createFixtureSession();
  const rootPart = session.graph.parts.find((part) => part.partId === PART_ROOT);
  const facePart = session.graph.parts.find((part) => part.partId === PART_FACE);
  const hiddenDrawable = session.graph.drawables.find(
    (drawable) => drawable.drawableId === DRAW_HIDDEN
  );

  if (rootPart === undefined || facePart === undefined || hiddenDrawable === undefined) {
    throw new Error("Expected hidden-only fixture source graph.");
  }

  rootPart.childPartIds = [...rootPart.childPartIds, PART_HIDDEN_ONLY];
  facePart.drawableIds = facePart.drawableIds.filter((drawableId) => drawableId !== DRAW_HIDDEN);
  hiddenDrawable.partId = PART_HIDDEN_ONLY;
  session.graph.parts.push({
    partId: PART_HIDDEN_ONLY,
    displayName: "Hidden only",
    parentPartId: PART_ROOT,
    childPartIds: [],
    drawableIds: [DRAW_HIDDEN]
  });

  return session;
}

function createDrawable(
  drawableId: ReturnType<typeof DrawableIdSchema.parse>,
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  textureId: ReturnType<typeof TextureIdSchema.parse>,
  displayName: string,
  defaultOpacity: number,
  runtimeVisibility: boolean,
  baseDrawOrder: number
) {
  return {
    drawableId,
    displayName,
    partId: PART_FACE,
    sourceAssetId: SOURCE_ASSET,
    textureId,
    meshId,
    defaultOpacity,
    runtimeVisibility,
    baseDrawOrder,
    sourceProvenanceId: PROVENANCE
  };
}

function createMesh(
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  drawableId: ReturnType<typeof DrawableIdSchema.parse>,
  x: number,
  y: number,
  width: number,
  height: number
) {
  return {
    meshId,
    drawableId,
    vertices: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height }
    ],
    uvs: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ],
    triangles: [
      [0, 1, 2],
      [0, 2, 3]
    ] as [number, number, number][],
    vertexStableIds: ["vtx_0", "vtx_1", "vtx_2", "vtx_3"],
    bounds: { x, y, width, height },
    generationProvenanceId: PROVENANCE
  };
}

function createSourceLayer(
  sourceLayerId: string,
  drawableId: ReturnType<typeof DrawableIdSchema.parse>,
  x: number,
  y: number,
  width: number,
  height: number
) {
  return {
    sourceLayerId,
    sourceAssetId: SOURCE_ASSET,
    originalName: sourceLayerId,
    normalizedName: sourceLayerId,
    groupPath: [],
    bounds: { x, y, width, height },
    visibleInSource: true,
    opacityInSource: 1,
    role: "editableLayer" as const,
    unsupportedFeatures: [],
    mappedDrawableIds: [drawableId]
  };
}

function createTexture(
  textureId: ReturnType<typeof TextureIdSchema.parse>,
  name: string,
  width: number,
  height: number
) {
  const byteLength = width * height * 4;

  return {
    textureId,
    name,
    width,
    height,
    seed: name.charCodeAt(0),
    binaryAssetRef: {
      referenceKind: "package-binary-asset-ref-v1" as const,
      binaryAssetId: `bin_${name}`,
      packageRelativePath: `assets/textures/${name}.rgba`,
      digest: {
        algorithm: "sha256" as const,
        hex: createDigestHex(name)
      },
      byteLength,
      mediaType: "application/octet-stream; pixelFormat=rgba8",
      storageStatus: "stored-package-local-v1" as const,
      provenanceId: PROVENANCE,
      rightsAssetId: "rights_fixture"
    }
  };
}

function createRgbaBytes(width: number, height: number, seed: number): Uint8Array {
  const bytes = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < bytes.length; offset += 4) {
    bytes[offset] = seed;
    bytes[offset + 1] = 64;
    bytes[offset + 2] = 192;
    bytes[offset + 3] = 255;
  }

  return bytes;
}

function createDigestHex(seed: string): string {
  return seed.padEnd(64, seed).slice(0, 64).replaceAll(/[^a-f0-9]/g, "a");
}
