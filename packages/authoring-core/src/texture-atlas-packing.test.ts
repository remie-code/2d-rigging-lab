import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  TriangleIdSchema,
  VertexIdSchema
} from "@private-2d-rigging-lab/contracts";
import { BinaryAssetReferenceSchema } from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { registerAuthoringSessionBinaryBytes } from "./binary-byte-registration.js";
import {
  DEFAULT_TEXTURE_ATLAS_PACKING_ALGORITHM_ID,
  TEXTURE_ATLAS_SHELF_ALGORITHM_ID,
  TEXTURE_ATLAS_SKYLINE_ALGORITHM_ID,
  createTextureAtlasPreview
} from "./texture-atlas-packing.js";

const PART_ROOT = PartIdSchema.parse("part_atlas_packing_root");
const RIG_ROOT = RigControlIdSchema.parse("rig_atlas_packing_root");
const SRC_FIXTURE = SourceAssetIdSchema.parse("src_texture_atlas_packing_fixture");
const PROV_FIXTURE = ProvenanceIdSchema.parse("prov_texture_atlas_packing_fixture");
const TEST_DIGEST_HEX = "0".repeat(64);

interface PackingTargetFixture {
  readonly token: string;
  readonly width: number;
  readonly height: number;
}

describe("texture atlas skyline packing", () => {
  it("uses skyline as the default algorithm and records it in new layouts", () => {
    const session = createPackingSession([
      { token: "body", width: 2, height: 2 },
      { token: "sleeve", width: 2, height: 2 }
    ]);
    const preview = createTextureAtlasPreview(session, {
      pageWidth: 8,
      pageHeight: 4,
      paddingPixels: 1,
      edgeExtrusionEnabled: true,
      edgeExtrusionPixels: 1
    });

    expect(DEFAULT_TEXTURE_ATLAS_PACKING_ALGORITHM_ID).toBe(TEXTURE_ATLAS_SKYLINE_ALGORITHM_ID);
    expect(preview.status).toBe("ready");
    if (preview.status !== "ready") {
      return;
    }
    expect(preview.settings.algorithmId).toBe("single-page-skyline-v1");
    expect(preview.layoutSummary.settings.algorithmId).toBe("single-page-skyline-v1");
    expect(preview.layoutSummary.sourceSignature?.digest).toMatch(/^fnv1a32:[a-f0-9]{8}$/);
  });

  it("keeps the shelf packer available as a non-default compatibility path", () => {
    const session = createPackingSession([
      { token: "body", width: 2, height: 2 },
      { token: "sleeve", width: 2, height: 2 }
    ]);
    const preview = createTextureAtlasPreview(session, {
      algorithmId: TEXTURE_ATLAS_SHELF_ALGORITHM_ID,
      pageWidth: 8,
      pageHeight: 4,
      paddingPixels: 1
    });

    expect(preview.status).toBe("ready");
    if (preview.status !== "ready") {
      return;
    }
    expect(preview.layoutSummary.settings.algorithmId).toBe("single-page-shelf-v1");
    expect(preview.layoutSummary.pages[0]?.placements.map((placement) => ({
      drawableId: placement.drawableId,
      contentRectPixels: placement.contentRectPixels,
      paddedRectPixels: placement.paddedRectPixels
    }))).toEqual([
      {
        drawableId: "draw_pack_body",
        contentRectPixels: { x: 1, y: 1, width: 2, height: 2 },
        paddedRectPixels: { x: 0, y: 0, width: 4, height: 4 }
      },
      {
        drawableId: "draw_pack_sleeve",
        contentRectPixels: { x: 5, y: 1, width: 2, height: 2 },
        paddedRectPixels: { x: 4, y: 0, width: 4, height: 4 }
      }
    ]);
  });

  it("packs mixed-size rectangles deterministically without padded overlap or page overflow", () => {
    const session = createPackingSession([
      { token: "large", width: 6, height: 6 },
      { token: "medium", width: 4, height: 4 },
      { token: "tall", width: 2, height: 5 },
      { token: "small", width: 2, height: 2 }
    ]);
    const first = createTextureAtlasPreview(session, {
      pageWidth: 14,
      pageHeight: 14,
      paddingPixels: 1
    });
    const second = createTextureAtlasPreview(session, {
      pageWidth: 14,
      pageHeight: 14,
      paddingPixels: 1
    });

    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    if (first.status !== "ready" || second.status !== "ready") {
      return;
    }
    expect(first.layoutSummary).toEqual(second.layoutSummary);
    const page = first.layoutSummary.pages[0];
    if (page === undefined) {
      throw new Error("Expected one atlas page.");
    }
    expect(page.placements).toHaveLength(4);
    expect(page.placements.map((placement) => placement.drawableId)).toEqual([
      "draw_pack_large",
      "draw_pack_medium",
      "draw_pack_tall",
      "draw_pack_small"
    ]);
    assertPaddedRectsInsidePage(page.placements, page.width, page.height);
    assertNoPaddedRectOverlap(page.placements);
  });

  it("calculates padded, content, source, and uv rects without source cropping", () => {
    const session = createPackingSession([
      { token: "rounded", width: 3.6, height: 2.4 }
    ]);
    const preview = createTextureAtlasPreview(session, {
      pageWidth: 8,
      pageHeight: 8,
      paddingPixels: 2
    });

    expect(preview.status).toBe("ready");
    if (preview.status !== "ready") {
      return;
    }
    const placement = preview.layoutSummary.pages[0]?.placements[0];
    expect(placement).toMatchObject({
      sourceTextureSize: { width: 4, height: 2 },
      sourceRectPixels: { x: 0, y: 0, width: 4, height: 2 },
      paddedRectPixels: { x: 0, y: 0, width: 8, height: 6 },
      contentRectPixels: { x: 2, y: 2, width: 4, height: 2 },
      uvRect: {
        topLeft: { x: 2 / 8, y: 2 / 8 },
        bottomRight: { x: 6 / 8, y: 4 / 8 }
      }
    });
  });

  it("produces deterministic cannot-fit failures for oversized targets", () => {
    const session = createPackingSession([
      { token: "oversized", width: 9, height: 9 }
    ]);
    const first = createTextureAtlasPreview(session, {
      pageWidth: 8,
      pageHeight: 8,
      paddingPixels: 0
    });
    const second = createTextureAtlasPreview(session, {
      pageWidth: 8,
      pageHeight: 8,
      paddingPixels: 0
    });

    expect(first.status).toBe("failed");
    expect(second.status).toBe("failed");
    if (first.status !== "failed" || second.status !== "failed") {
      return;
    }
    expect(first.warnings).toEqual(second.warnings);
    expect(first.warnings).toEqual([
      expect.objectContaining({
        code: "atlas.pack.cannotFit",
        targetPath: "/model/drawables/draw_pack_oversized",
        drawableId: "draw_pack_oversized",
        details: expect.arrayContaining([
          "algorithmId=single-page-skyline-v1",
          "pageWidth=8",
          "pageHeight=8",
          "paddedWidth=9",
          "paddedHeight=9"
        ])
      })
    ]);
  });

  it("includes algorithm identity in the source signature digest", () => {
    const session = createPackingSession([
      { token: "body", width: 2, height: 2 },
      { token: "sleeve", width: 2, height: 2 }
    ]);
    const skyline = createTextureAtlasPreview(session, {
      algorithmId: TEXTURE_ATLAS_SKYLINE_ALGORITHM_ID,
      pageWidth: 8,
      pageHeight: 4,
      paddingPixels: 1
    });
    const shelf = createTextureAtlasPreview(session, {
      algorithmId: TEXTURE_ATLAS_SHELF_ALGORITHM_ID,
      pageWidth: 8,
      pageHeight: 4,
      paddingPixels: 1
    });

    expect(skyline.status).toBe("ready");
    expect(shelf.status).toBe("ready");
    if (skyline.status !== "ready" || shelf.status !== "ready") {
      return;
    }
    expect(skyline.layoutSummary.sourceSignature?.digest).not.toBe(
      shelf.layoutSummary.sourceSignature?.digest
    );
  });
});

function createPackingSession(targets: readonly PackingTargetFixture[]): AuthoringSession {
  const session: AuthoringSession = {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_texture_atlas_packing_test"),
      packageDisplayName: "Texture Atlas Packing Test",
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
          partId: PART_ROOT,
          displayName: "Packing Root",
          childPartIds: [],
          drawableIds: targets.map((target) => createDrawableId(target.token)),
          children: targets.map((target) => ({
            kind: "drawable" as const,
            drawableId: createDrawableId(target.token)
          }))
        }
      ],
      drawables: targets.map((target, index) =>
        createDrawable(target, index)
      ),
      meshes: targets.map(createMesh),
      parameters: [],
      keyformSets: [],
      rigControls: [
        {
          kind: "rotation2d",
          rigControlId: RIG_ROOT,
          displayName: "Packing Rig",
          childDrawableIds: targets.map((target) => createDrawableId(target.token)),
          childRigControlIds: [],
          pivot: { x: 0, y: 0 },
          restAngleDegrees: 0,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        }
      ],
      dynamicsGroups: [],
      masks: [],
      drawOrder: targets.map((target, index) => ({
        drawableId: createDrawableId(target.token),
        baseDrawOrder: index,
        stableOrder: index
      })),
      rigControlRootIds: [RIG_ROOT],
      stableOrder: [
        PART_ROOT,
        ...targets.map((target) => createDrawableId(target.token))
      ],
      sourceAssets: [],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: targets.map(createTextureEntry)
      },
      provenanceRecords: [
        {
          provenanceId: PROV_FIXTURE,
          assetId: SRC_FIXTURE,
          assetKind: "generatedFixture",
          filePath: "assets/sources/generated/texture-atlas-packing-fixture.json",
          creator: "texture-atlas-packing-test",
          license: "internal-authoring-generated",
          redistributionAllowed: false,
          aiUsed: false,
          transformHistory: [],
          relatedOperationIds: []
        }
      ],
      rightsRecords: [
        {
          assetId: SRC_FIXTURE,
          rightsStatus: "cleared",
          license: "internal-authoring-generated",
          redistributionAllowed: false
        }
      ]
    }
  };

  for (const target of targets) {
    const width = Math.round(target.width);
    const height = Math.round(target.height);
    const bytes = createSolidRgbaBytes(width, height);
    const binaryAssetRef = createTextureBinaryAssetReference(target.token, bytes);

    registerAuthoringSessionBinaryBytes(session, {
      binaryAssetRef,
      bytes,
      role: "texture-raster-v1",
      sourceAssetId: SRC_FIXTURE,
      textureId: createTextureId(target.token)
    });
  }

  return session;
}

function createDrawable(target: PackingTargetFixture, baseDrawOrder: number) {
  return {
    drawableId: createDrawableId(target.token),
    displayName: `Packing ${target.token}`,
    partId: PART_ROOT,
    sourceAssetId: SRC_FIXTURE,
    textureId: createTextureId(target.token),
    meshId: createMeshId(target.token),
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder,
    sourceProvenanceId: PROV_FIXTURE
  };
}

function createMesh(target: PackingTargetFixture) {
  const meshId = createMeshId(target.token);
  const drawableId = createDrawableId(target.token);

  return {
    meshId,
    drawableId,
    vertices: [
      { x: 0, y: 0 },
      { x: target.width, y: 0 },
      { x: target.width, y: target.height },
      { x: 0, y: target.height }
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
    ] as [[number, number, number], [number, number, number]],
    vertexStableIds: [
      VertexIdSchema.parse(`vtx_pack_${target.token}_0`),
      VertexIdSchema.parse(`vtx_pack_${target.token}_1`),
      VertexIdSchema.parse(`vtx_pack_${target.token}_2`),
      VertexIdSchema.parse(`vtx_pack_${target.token}_3`)
    ],
    triangleStableIds: [
      TriangleIdSchema.parse(`tri_pack_${target.token}_0`),
      TriangleIdSchema.parse(`tri_pack_${target.token}_1`)
    ],
    topologyRevision: 0,
    bounds: { x: 0, y: 0, width: target.width, height: target.height },
    generationProvenanceId: PROV_FIXTURE
  };
}

function createTextureEntry(target: PackingTargetFixture) {
  const width = Math.round(target.width);
  const height = Math.round(target.height);
  const bytes = createSolidRgbaBytes(width, height);

  return {
    textureId: createTextureId(target.token),
    filePath: `assets/textures/${target.token}.raw-rgba`,
    dimensions: {
      width,
      height,
      pixelFormat: "rgba8" as const
    },
    provenanceId: PROV_FIXTURE,
    binaryAssetRef: createTextureBinaryAssetReference(target.token, bytes)
  };
}

function createTextureBinaryAssetReference(token: string, bytes: Uint8Array) {
  return BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_pack_${token}`,
    packageRelativePath: `assets/textures/${token}.raw-rgba`,
    digest: {
      algorithm: "sha256",
      hex: TEST_DIGEST_HEX
    },
    byteLength: bytes.byteLength,
    mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
    storageStatus: "stored-package-local-v1",
    provenanceId: PROV_FIXTURE,
    rightsAssetId: SRC_FIXTURE
  });
}

function createSolidRgbaBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(width * height * 4);

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    bytes[pixel * 4] = (pixel * 17) % 255;
    bytes[pixel * 4 + 1] = (pixel * 31) % 255;
    bytes[pixel * 4 + 2] = (pixel * 47) % 255;
    bytes[pixel * 4 + 3] = 255;
  }

  return bytes;
}

function assertPaddedRectsInsidePage(
  placements: readonly {
    readonly paddedRectPixels: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  }[],
  pageWidth: number,
  pageHeight: number
): void {
  for (const placement of placements) {
    expect(placement.paddedRectPixels.x).toBeGreaterThanOrEqual(0);
    expect(placement.paddedRectPixels.y).toBeGreaterThanOrEqual(0);
    expect(placement.paddedRectPixels.x + placement.paddedRectPixels.width)
      .toBeLessThanOrEqual(pageWidth);
    expect(placement.paddedRectPixels.y + placement.paddedRectPixels.height)
      .toBeLessThanOrEqual(pageHeight);
  }
}

function assertNoPaddedRectOverlap(
  placements: readonly {
    readonly drawableId: string;
    readonly paddedRectPixels: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  }[]
): void {
  for (let leftIndex = 0; leftIndex < placements.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < placements.length; rightIndex += 1) {
      const left = placements[leftIndex]!;
      const right = placements[rightIndex]!;

      expect(rectsOverlap(left.paddedRectPixels, right.paddedRectPixels), `${left.drawableId} overlaps ${right.drawableId}`)
        .toBe(false);
    }
  }
}

function rectsOverlap(
  left: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  right: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
): boolean {
  return left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y;
}

function createDrawableId(token: string) {
  return DrawableIdSchema.parse(`draw_pack_${token}`);
}

function createMeshId(token: string) {
  return MeshIdSchema.parse(`mesh_pack_${token}`);
}

function createTextureId(token: string) {
  return TextureIdSchema.parse(`tex_pack_${token}`);
}
