import {
  createInitialAuthoringRevision,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  type DrawableId,
  type RectDto,
  type TextureId
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  createViewerCleanStageProjection,
  VIEWER_CLEAN_STAGE_BACKGROUND_COLOR,
  VIEWER_CLEAN_STAGE_OVERLAYS
} from "./viewer-clean-stage";

const PART_ROOT = PartIdSchema.parse("part_viewer_clean_root");
const PART_FACE = PartIdSchema.parse("part_viewer_clean_face");
const DRAW_MASK = DrawableIdSchema.parse("draw_viewer_clean_mask");
const DRAW_FACE = DrawableIdSchema.parse("draw_viewer_clean_face");
const MESH_MASK = MeshIdSchema.parse("mesh_viewer_clean_mask");
const MESH_FACE = MeshIdSchema.parse("mesh_viewer_clean_face");
const TEX_MASK = TextureIdSchema.parse("tex_viewer_clean_mask");
const TEX_FACE = TextureIdSchema.parse("tex_viewer_clean_face");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_viewer_clean_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_viewer_clean_fixture");
const FACE_ANGLE_X = ParameterIdSchema.parse("param_face_angle_x");
const RIG_FACE_WARP = RigControlIdSchema.parse("rig_viewer_clean_face_warp");

describe("viewer clean stage", () => {
  it("creates a committed no-selection projection with session-only parameter overrides", () => {
    const session = createCleanStageSession();
    const before = JSON.stringify(session);

    const restProjection = createViewerCleanStageProjection(session);
    const posedProjection = createViewerCleanStageProjection(session, {
      parameterValues: {
        [FACE_ANGLE_X]: 30
      }
    });
    const restFace = requireDrawable(restProjection, DRAW_FACE);
    const posedFace = requireDrawable(posedProjection, DRAW_FACE);

    expect(restProjection.selectedDrawableIds.size).toBe(0);
    expect(restProjection.selectionBounds).toBeUndefined();
    expect(restProjection.meshOverlay).toBeUndefined();
    expect(restProjection.meshOverlays).toEqual([]);
    expect(restProjection.deformerOverlay).toBeUndefined();
    expect(restProjection.drawables.every((drawable) => !drawable.selected)).toBe(true);
    expect(restProjection.drawables.every((drawable) => !drawable.selectedBySubtree)).toBe(true);
    expect(restProjection.drawables.every((drawable) => !drawable.meshPreview)).toBe(true);

    expect(restProjection.maskRelations).toEqual([
      {
        maskRelationId: "maskrel_viewer_clean_face_clip",
        sourceDrawableIds: [DRAW_MASK],
        targetDrawableIds: [DRAW_FACE]
      }
    ]);
    expect(restFace.maskSourceDrawableIds).toEqual([DRAW_MASK]);
    expect(restFace.bounds).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(posedFace.bounds).toEqual({ x: 12, y: 0, width: 100, height: 100 });
    expect(JSON.stringify(session)).toBe(before);
  });

  it("applies Parts Container visibility while preserving Drawable visibility", () => {
    const visibleProjection = createViewerCleanStageProjection(createCleanStageSession(), {
      editorHiddenPartIds: new Set()
    });
    const hiddenPartProjection = createViewerCleanStageProjection(createCleanStageSession(), {
      editorHiddenPartIds: new Set([PART_FACE])
    });
    const hiddenAncestorProjection = createViewerCleanStageProjection(createCleanStageSession(), {
      editorHiddenPartIds: new Set([PART_ROOT])
    });
    const drawableHiddenProjection = createViewerCleanStageProjection(
      createCleanStageSession({ faceRuntimeVisible: false }),
      {
        editorHiddenPartIds: new Set()
      }
    );

    expect(requireDrawable(visibleProjection, DRAW_MASK).visible).toBe(true);
    expect(requireDrawable(visibleProjection, DRAW_FACE).visible).toBe(true);
    expect(visibleProjection.hasRenderableArtwork).toBe(true);

    expect(requireDrawable(hiddenPartProjection, DRAW_MASK).visible).toBe(false);
    expect(requireDrawable(hiddenPartProjection, DRAW_FACE).visible).toBe(false);
    expect(hiddenPartProjection.hasRenderableArtwork).toBe(false);

    expect(requireDrawable(hiddenAncestorProjection, DRAW_MASK).visible).toBe(false);
    expect(requireDrawable(hiddenAncestorProjection, DRAW_FACE).visible).toBe(false);
    expect(hiddenAncestorProjection.hasRenderableArtwork).toBe(false);

    expect(requireDrawable(drawableHiddenProjection, DRAW_MASK).visible).toBe(true);
    expect(requireDrawable(drawableHiddenProjection, DRAW_FACE).visible).toBe(false);
    expect(drawableHiddenProjection.hasRenderableArtwork).toBe(true);
  });

  it("defines a clean overlay state that suppresses all authoring guides", () => {
    expect(VIEWER_CLEAN_STAGE_BACKGROUND_COLOR).toBe("#6b7280");
    expect(VIEWER_CLEAN_STAGE_OVERLAYS).toEqual({
      grid: false,
      originGuide: false,
      canvasBounds: false,
      selectionBounds: false,
      mesh: false,
      deformer: false,
      isolateSelected: false
    });
  });
});

function requireDrawable(
  projection: ReturnType<typeof createViewerCleanStageProjection>,
  drawableId: DrawableId
) {
  const drawable = projection.drawables.find((candidate) => candidate.drawableId === drawableId);
  if (drawable === undefined) {
    throw new Error(`Expected drawable ${drawableId}.`);
  }

  return drawable;
}

function createCleanStageSession(input: {
  readonly faceRuntimeVisible?: boolean;
} = {}): AuthoringSession {
  const textures = [
    createTexture(TEX_MASK, "mask", 100, 100),
    createTexture(TEX_FACE, "face", 100, 100)
  ];

  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_viewer_clean_stage_fixture"),
      packageDisplayName: "Viewer clean stage fixture",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 7,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    binaryAssets: {
      fileEntries: textures.map((texture) => ({
        path: texture.binaryAssetRef.packageRelativePath,
        bytes: createRgbaBytes(texture.width, texture.height),
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
      canvasSize: { width: 160, height: 160 },
      parts: [
        {
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [PART_FACE],
          drawableIds: [],
          children: [{ kind: "part", partId: PART_FACE }]
        },
        {
          partId: PART_FACE,
          displayName: "Face",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_MASK, DRAW_FACE],
          children: [
            { kind: "drawable", drawableId: DRAW_MASK },
            { kind: "drawable", drawableId: DRAW_FACE }
          ]
        }
      ],
      drawables: [
        createDrawable(DRAW_MASK, MESH_MASK, TEX_MASK, "Mask", 1),
        createDrawable(
          DRAW_FACE,
          MESH_FACE,
          TEX_FACE,
          "Face",
          0,
          input.faceRuntimeVisible ?? true
        )
      ],
      meshes: [
        createMesh(MESH_MASK, DRAW_MASK, { x: 0, y: 0, width: 100, height: 100 }),
        createMesh(MESH_FACE, DRAW_FACE, { x: 0, y: 0, width: 100, height: 100 })
      ],
      parameters: [],
      keyformSets: [
        {
          keyformSetId: KeyformSetIdSchema.parse("keyset_viewer_clean_face_warp_offsets"),
          target: {
            kind: "rigControl",
            id: RIG_FACE_WARP,
            property: "controlPointOffsets"
          },
          parameterId: FACE_ANGLE_X,
          evaluator: "linear-1d-v1",
          interpolation: "linear-1d-v1",
          compositionMode: "replace",
          compositionOrder: 0,
          keys: [
            { value: -30, statePatch: createOffsets(4, 0, 0) },
            { value: 0, statePatch: createOffsets(4, 0, 0) },
            { value: 30, statePatch: createOffsets(4, 12, 0) }
          ]
        }
      ],
      rigControls: [
        {
          kind: "warpLattice2d",
          rigControlId: RIG_FACE_WARP,
          displayName: "Face Warp",
          partId: PART_FACE,
          childDrawableIds: [DRAW_FACE],
          childRigControlIds: [],
          bindSpace: "rigControlLocalRest",
          domainBounds: { x: 0, y: 0, width: 100, height: 100 },
          latticeColumns: 2,
          latticeRows: 2,
          restControlPoints: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 0, y: 100 },
            { x: 100, y: 100 }
          ],
          interpolationMethod: "bilinear-grid-v1",
          enabled: true
        }
      ],
      dynamicsGroups: [],
      masks: [
        {
          maskRelationId: MaskRelationIdSchema.parse("maskrel_viewer_clean_face_clip"),
          maskDrawableIds: [DRAW_MASK],
          targetDrawableIds: [DRAW_FACE],
          enabled: true
        }
      ],
      drawOrder: [
        { drawableId: DRAW_MASK, baseDrawOrder: 1, stableOrder: 1 },
        { drawableId: DRAW_FACE, baseDrawOrder: 0, stableOrder: 0 }
      ],
      rigControlRootIds: [RIG_FACE_WARP],
      stableOrder: [PART_ROOT, PART_FACE, DRAW_MASK, DRAW_FACE],
      sourceAssets: [],
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

function createDrawable(
  drawableId: DrawableId,
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  textureId: TextureId,
  displayName: string,
  baseDrawOrder: number,
  runtimeVisibility = true
) {
  return {
    drawableId,
    displayName,
    partId: PART_FACE,
    sourceAssetId: SOURCE_ASSET,
    textureId,
    meshId,
    defaultOpacity: 1,
    runtimeVisibility,
    baseDrawOrder,
    sourceProvenanceId: PROVENANCE
  };
}

function createMesh(
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  drawableId: DrawableId,
  bounds: RectDto
) {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;

  return {
    meshId,
    drawableId,
    vertices: [
      { x: bounds.x, y: bounds.y },
      { x: right, y: bounds.y },
      { x: right, y: bottom },
      { x: bounds.x, y: bottom }
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
    bounds,
    generationProvenanceId: PROVENANCE
  };
}

function createTexture(textureId: TextureId, name: string, width: number, height: number) {
  const byteLength = width * height * 4;

  return {
    textureId,
    name,
    width,
    height,
    binaryAssetRef: {
      referenceKind: "package-binary-asset-ref-v1" as const,
      binaryAssetId: `bin_viewer_clean_${name}`,
      packageRelativePath: `assets/textures/viewer-clean-${name}.rgba`,
      digest: {
        algorithm: "sha256" as const,
        hex: name.padEnd(64, name).slice(0, 64).replaceAll(/[^a-f0-9]/g, "a")
      },
      byteLength,
      mediaType: "application/octet-stream; pixelFormat=rgba8",
      storageStatus: "stored-package-local-v1" as const,
      provenanceId: PROVENANCE,
      rightsAssetId: "rights_viewer_clean_fixture"
    }
  };
}

function createRgbaBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < bytes.length; offset += 4) {
    bytes[offset] = 128;
    bytes[offset + 1] = 128;
    bytes[offset + 2] = 128;
    bytes[offset + 3] = 255;
  }

  return bytes;
}

function createOffsets(count: number, x: number, y: number) {
  return Array.from({ length: count }, () => ({ x, y }));
}
