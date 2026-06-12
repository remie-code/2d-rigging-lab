import { createInitialAuthoringRevision, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
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
import { commitUpdateRigControl } from "../../features/editor-session/model/editor-session-commands";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const PART_NESTED_BLOCK = PartIdSchema.parse("part_nested_block");
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
const RIG_FACE_WARP = RigControlIdSchema.parse("rig_face_warp");
const RIG_FACE_ROTATION = RigControlIdSchema.parse("rig_face_rotation");
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
    expect(projection.drawables.map((drawable) => [drawable.drawableId, drawable.frontOrder])).toEqual([
      [DRAW_TARGET, 4],
      [DRAW_MASK, 3],
      [DRAW_HIDDEN, 2],
      [DRAW_BACK, 1],
      [DRAW_FRONT, 0]
    ]);

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

  it("flattens nested Part Container blocks for Canvas draw order and subtree selection", () => {
    const session = createNestedContainerBlockSession();
    const projection = createCanvasRenderProjection(session, {
      kind: "part",
      id: PART_FACE
    });

    expect(projection.drawables.map((drawable) => [drawable.drawableId, drawable.frontOrder])).toEqual([
      [DRAW_TARGET, 4],
      [DRAW_HIDDEN, 3],
      [DRAW_BACK, 2],
      [DRAW_MASK, 1],
      [DRAW_FRONT, 0]
    ]);
    expect(projection.selectedDrawableIds).toEqual(
      new Set([DRAW_FRONT, DRAW_MASK, DRAW_BACK, DRAW_HIDDEN, DRAW_TARGET])
    );
    expect(hitTestTopmostDrawable(projection, { x: 30, y: 30 })).toBe(DRAW_MASK);

    const nestedProjection = createCanvasRenderProjection(session, {
      kind: "part",
      id: PART_NESTED_BLOCK
    });
    expect(nestedProjection.selectedDrawableIds).toEqual(new Set([DRAW_MASK]));
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

  it("projects draft mesh overlay only for the selected Drawable", () => {
    const session = createFixtureSession();
    const draftMesh = {
      ...createMesh(MESH_FRONT, DRAW_FRONT, 5, 5, 20, 20),
      vertices: [
        { x: 6, y: 6 },
        { x: 18, y: 6 },
        { x: 6, y: 18 }
      ],
      uvs: [
        { x: 0.05, y: 0.05 },
        { x: 0.65, y: 0.05 },
        { x: 0.05, y: 0.65 }
      ],
      triangles: [[0, 1, 2]] as [number, number, number][],
      vertexStableIds: ["vtx_draft_0", "vtx_draft_1", "vtx_draft_2"]
    };

    const selectedProjection = createCanvasRenderProjection(
      session,
      {
        kind: "drawable",
        id: DRAW_FRONT
      },
      {
        meshDraft: {
          drawableId: DRAW_FRONT,
          mesh: draftMesh
        }
      }
    );

    expect(selectedProjection.meshOverlay).toMatchObject({
      drawableId: DRAW_FRONT,
      status: "draft",
      mesh: {
        vertices: draftMesh.vertices,
        triangles: draftMesh.triangles
      }
    });

    const otherSelectionProjection = createCanvasRenderProjection(
      session,
      {
        kind: "drawable",
        id: DRAW_BACK
      },
      {
        meshDraft: {
          drawableId: DRAW_FRONT,
          mesh: draftMesh
        }
      }
    );

    expect(otherSelectionProjection.meshOverlay).toMatchObject({
      drawableId: DRAW_BACK,
      status: "committed",
      mesh: {
        meshId: MESH_BACK
      }
    });
  });

  it("projects draft and committed Warp Deformer overlays for Canvas", () => {
    const session = createFixtureSession();
    const draftProjection = createCanvasRenderProjection(
      session,
      {
        kind: "drawable",
        id: DRAW_FRONT
      },
      {
        deformerDraft: {
          displayName: "Front Warp Draft",
          domainBounds: { x: 5, y: 5, width: 20, height: 20 },
          transformColumns: 5,
          transformRows: 4,
          bezierColumns: 3,
          bezierRows: 2,
          childDrawableIds: [DRAW_FRONT],
          childRigControlIds: []
        }
      }
    );

    expect(draftProjection.deformerOverlay).toMatchObject({
      kind: "warp",
      displayName: "Front Warp Draft",
      status: "draft",
      transformColumns: 5,
      transformRows: 4,
      bezierColumns: 3,
      bezierRows: 2,
      childDrawableIds: [DRAW_FRONT]
    });

    session.graph.rigControls.push(createWarpDeformerRigControl());
    session.graph.rigControlRootIds = [RIG_FACE_WARP];
    const committedProjection = createCanvasRenderProjection(session, {
      kind: "rigControl",
      id: RIG_FACE_WARP
    });

    expect(committedProjection.selectedDrawableIds).toEqual(new Set([DRAW_FRONT]));
    expect(committedProjection.deformerOverlay).toMatchObject({
      kind: "warp",
      rigControlId: RIG_FACE_WARP,
      displayName: "Face Warp",
      status: "committed",
      transformColumns: 4,
      transformRows: 3,
      bezierColumns: 3,
      bezierRows: 2,
      childDrawableIds: [DRAW_FRONT]
    });

    const updated = commitUpdateRigControl(session, {
      rigControlId: RIG_FACE_WARP,
      opacityMultiplier: 0.25,
      transformColumns: 5
    });
    expect(updated.committed).toBe(true);
    const updatedProjection = createCanvasRenderProjection(updated.session, {
      kind: "rigControl",
      id: RIG_FACE_WARP
    });

    expect(updatedProjection.deformerOverlay).toMatchObject({
      kind: "warp",
      rigControlId: RIG_FACE_WARP,
      status: "committed",
      transformColumns: 5
    });
    expect(
      updatedProjection.drawables.find((drawable) => drawable.drawableId === DRAW_FRONT)?.opacity
    ).toBeCloseTo(0.105);
  });

  it("projects committed Rotation Deformer overlays for Canvas", () => {
    const session = createFixtureSession();
    session.graph.rigControls.push(createRotationDeformerRigControl());
    session.graph.rigControlRootIds = [RIG_FACE_ROTATION];

    const projection = createCanvasRenderProjection(session, {
      kind: "rigControl",
      id: RIG_FACE_ROTATION
    });

    expect(projection.selectedDrawableIds).toEqual(new Set([DRAW_FRONT]));
    expect(projection.deformerOverlay).toMatchObject({
      kind: "rotation",
      rigControlId: RIG_FACE_ROTATION,
      displayName: "Face Rotation",
      status: "committed",
      domainBounds: { x: 5, y: 5, width: 20, height: 20 },
      pivot: { x: 15, y: 15 },
      restAngleDegrees: 12,
      childDrawableIds: [DRAW_FRONT]
    });
    expect(
      projection.drawables.find((drawable) => drawable.drawableId === DRAW_FRONT)?.opacity
    ).toBeCloseTo(0.336);
  });

  it("can temporarily render a selected hidden Drawable for Mesh Tool preview", () => {
    const session = createFixtureSession();
    const projection = createCanvasRenderProjection(
      session,
      {
        kind: "drawable",
        id: DRAW_HIDDEN
      },
      {
        meshPreviewDrawableId: DRAW_HIDDEN
      }
    );

    const hidden = projection.drawables.find((drawable) => drawable.drawableId === DRAW_HIDDEN);
    expect(hidden).toMatchObject({
      visible: true,
      meshPreview: true
    });
    expect(projection.hasRenderableArtwork).toBe(true);
    expect(hitTestTopmostDrawable(projection, { x: 26, y: 26 })).toBe(DRAW_HIDDEN);
    expect(session.graph.drawables.find((drawable) => drawable.drawableId === DRAW_HIDDEN)).toMatchObject({
      runtimeVisibility: false
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
          drawableIds: [],
          children: [
            {
              kind: "part",
              partId: PART_FACE
            }
          ]
        },
        {
          partId: PART_FACE,
          displayName: "Face",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_FRONT, DRAW_BACK, DRAW_HIDDEN, DRAW_MASK, DRAW_TARGET],
          children: [
            {
              kind: "drawable",
              drawableId: DRAW_FRONT
            },
            {
              kind: "drawable",
              drawableId: DRAW_BACK
            },
            {
              kind: "drawable",
              drawableId: DRAW_HIDDEN
            },
            {
              kind: "drawable",
              drawableId: DRAW_MASK
            },
            {
              kind: "drawable",
              drawableId: DRAW_TARGET
            }
          ]
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

function createWarpDeformerRigControl() {
  return {
    kind: "warpLattice2d" as const,
    rigControlId: RIG_FACE_WARP,
    displayName: "Face Warp",
    partId: PART_FACE,
    childDrawableIds: [DRAW_FRONT],
    childRigControlIds: [],
    bindSpace: "rigControlLocalRest" as const,
    domainBounds: { x: 5, y: 5, width: 20, height: 20 },
    latticeColumns: 4,
    latticeRows: 3,
    restControlPoints: [
      { x: 5, y: 5 },
      { x: 12, y: 5 },
      { x: 18, y: 5 },
      { x: 25, y: 5 },
      { x: 5, y: 15 },
      { x: 12, y: 15 },
      { x: 18, y: 15 },
      { x: 25, y: 15 },
      { x: 5, y: 25 },
      { x: 12, y: 25 },
      { x: 18, y: 25 },
      { x: 25, y: 25 }
    ],
    interpolationMethod: "bilinear-grid-v1" as const,
    warpDeformer: {
      schemaVersion: "warp-deformer-foundation-v0" as const,
      userFacingKind: "warpDeformer" as const,
      transformGrid: {
        columns: 4,
        rows: 3,
        pointCountSemantics: "controlPointCount" as const
      },
      bezierEditSurface: {
        columns: 3,
        rows: 2,
        editType: "cubicBezierSurfaceV1" as const,
        pointOrder: "rowMajorYThenXFromDomainMinV1" as const,
        restControlPoints: [
          { x: 5, y: 5 },
          { x: 15, y: 5 },
          { x: 25, y: 5 },
          { x: 5, y: 25 },
          { x: 15, y: 25 },
          { x: 25, y: 25 }
        ],
        handles: [
          createZeroBezierHandle(),
          createZeroBezierHandle(),
          createZeroBezierHandle(),
          createZeroBezierHandle(),
          createZeroBezierHandle(),
          createZeroBezierHandle()
        ],
        restSurfaceGeneration: {
          kind: "domainBoundsGridV1" as const,
          sourceDomainBounds: { x: 5, y: 5, width: 20, height: 20 },
          columns: 3,
          rows: 2,
          pointOrder: "rowMajorYThenXFromDomainMinV1" as const,
          handlePolicy: "zeroTangentsV1" as const
        }
      },
      compatibility: {
        storageKind: "warpLattice2d" as const,
        transformStorage: "latticeColumnsRows" as const,
        restControlPointStorage: "restControlPoints" as const,
        runtimeEvaluation: "bilinearGridV1" as const,
        bezierEvaluation: "storedNotEvaluatedV0" as const
      }
    },
    enabled: true
  };
}

function createRotationDeformerRigControl() {
  return {
    kind: "rotation2d" as const,
    rigControlId: RIG_FACE_ROTATION,
    displayName: "Face Rotation",
    partId: PART_FACE,
    childDrawableIds: [DRAW_FRONT],
    childRigControlIds: [],
    opacityMultiplier: 0.8,
    pivot: { x: 15, y: 15 },
    restAngleDegrees: 12,
    restTranslation: { x: 0, y: 0 },
    restScale: { x: 1, y: 1 },
    enabled: true
  };
}

function createZeroBezierHandle() {
  return {
    inTangent: { x: 0, y: 0 },
    outTangent: { x: 0, y: 0 }
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

function createNestedContainerBlockSession(): AuthoringSession {
  const session = createFixtureSession();
  const facePart = session.graph.parts.find((part) => part.partId === PART_FACE);
  const maskDrawable = session.graph.drawables.find((drawable) => drawable.drawableId === DRAW_MASK);

  if (facePart === undefined || maskDrawable === undefined) {
    throw new Error("Expected nested container fixture source graph.");
  }

  facePart.childPartIds = [PART_NESTED_BLOCK];
  facePart.drawableIds = [DRAW_FRONT, DRAW_BACK, DRAW_HIDDEN, DRAW_TARGET];
  facePart.children = [
    {
      kind: "drawable",
      drawableId: DRAW_FRONT
    },
    {
      kind: "part",
      partId: PART_NESTED_BLOCK
    },
    {
      kind: "drawable",
      drawableId: DRAW_BACK
    },
    {
      kind: "drawable",
      drawableId: DRAW_HIDDEN
    },
    {
      kind: "drawable",
      drawableId: DRAW_TARGET
    }
  ];
  maskDrawable.partId = PART_NESTED_BLOCK;
  maskDrawable.baseDrawOrder = 1;
  session.graph.parts.push({
    partId: PART_NESTED_BLOCK,
    displayName: "Nested block",
    parentPartId: PART_FACE,
    childPartIds: [],
    drawableIds: [DRAW_MASK],
    children: [
      {
        kind: "drawable",
        drawableId: DRAW_MASK
      }
    ]
  });
  session.graph.drawOrder = [
    { drawableId: DRAW_FRONT, baseDrawOrder: 0, stableOrder: 0 },
    { drawableId: DRAW_MASK, baseDrawOrder: 1, stableOrder: 1 },
    { drawableId: DRAW_BACK, baseDrawOrder: 2, stableOrder: 2 },
    { drawableId: DRAW_HIDDEN, baseDrawOrder: 3, stableOrder: 3 },
    { drawableId: DRAW_TARGET, baseDrawOrder: 4, stableOrder: 4 }
  ];
  session.graph.stableOrder = [
    PART_ROOT,
    PART_FACE,
    PART_NESTED_BLOCK,
    DRAW_FRONT,
    DRAW_MASK,
    DRAW_BACK,
    DRAW_HIDDEN,
    DRAW_TARGET
  ];

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
