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
import { createTextureAtlasPageRgbaBytes } from "./texture-atlas-binary.js";
import { createTextureAtlasPreview } from "./texture-atlas-packing.js";

// Wave108 Domain C (D-atlas) — transparent covering-margin gutter + bounds↔raster
// separation. These tests exercise the real bake pipeline (targets → packing → binary)
// with **padded** layer rasters (content interior opaque, a per-side transparent border
// of width P baked in by D-texprep) and per-tile `contentInset`, and assert:
//   - textureSize/byteLength derive from the padded raster (drawable stays packable),
//   - `uvRect` is the content sub-rect (raster placement inset by P),
//   - the covering-margin band and the atlas gutter are transparent (premultiplied
//     (0,0,0,0), not opaque edge-color),
//   - covering-margin overshoot UV (≤ P px past a content edge) stays inside the tile's
//     own raster placement — never the neighbour (§4 cross-bleed avoidance),
//   - determinism / within-page / non-overlap hold with mixed sizes.

const PART_ROOT = PartIdSchema.parse("part_gutter_root");
const RIG_ROOT = RigControlIdSchema.parse("rig_gutter_root");
const SRC_FIXTURE = SourceAssetIdSchema.parse("src_transparent_gutter_fixture");
const PROV_FIXTURE = ProvenanceIdSchema.parse("prov_transparent_gutter_fixture");
const TEST_DIGEST_HEX = "0".repeat(64);

// Large tile carries the upper-saturation covering-margin (P=17), small tile the
// lower-saturation one (P=5) — the design's mixed-size adjacency case (§4 test 1).
const LARGE = { token: "large", content: 20, padding: 17, color: [200, 0, 0, 255] as const };
const SMALL = { token: "small", content: 10, padding: 5, color: [0, 200, 0, 255] as const };

const GUTTER_PIXELS = 2;
const PAGE_WIDTH = 128;
const PAGE_HEIGHT = 64;

interface TileFixture {
  readonly token: string;
  readonly content: number;
  readonly padding: number;
  readonly color: readonly [number, number, number, number];
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

describe("texture atlas transparent covering-margin gutter", () => {
  it("keeps padded-raster drawables packable and sizes placements to the padded raster", () => {
    const preview = createGutterPreview();

    expect(preview.status).toBe("ready");
    if (preview.status !== "ready") {
      return;
    }
    // Under-counting the padded bytes (content*content*4) would raise
    // atlas.target.invalidRgbaByteLength and drop the drawable.
    expect(preview.warnings).toEqual([]);
    const page = requirePage(preview);
    expect(page.placements).toHaveLength(2);

    for (const tile of [LARGE, SMALL]) {
      const placement = requirePlacement(preview, tile.token);
      const padded = tile.content + tile.padding * 2;

      // textureSize / sourceRect / contentRect are all the padded raster (not content).
      expect(placement.sourceTextureSize).toEqual({ width: padded, height: padded });
      expect(placement.sourceRectPixels).toEqual({ x: 0, y: 0, width: padded, height: padded });
      expect(placement.contentRectPixels.width).toBe(padded);
      expect(placement.contentRectPixels.height).toBe(padded);
    }
  });

  it("insets uvRect onto the content sub-rect (raster placement inset by P)", () => {
    const preview = createGutterPreview();
    expect(preview.status).toBe("ready");
    if (preview.status !== "ready") {
      return;
    }

    for (const tile of [LARGE, SMALL]) {
      const placement = requirePlacement(preview, tile.token);
      const contentRect = placement.contentRectPixels;
      const expected = insetRect(contentRect, tile.padding);

      expect(placement.uvRect.topLeft.x * PAGE_WIDTH).toBeCloseTo(expected.x, 6);
      expect(placement.uvRect.topLeft.y * PAGE_HEIGHT).toBeCloseTo(expected.y, 6);
      expect(placement.uvRect.bottomRight.x * PAGE_WIDTH).toBeCloseTo(expected.x + expected.width, 6);
      expect(placement.uvRect.bottomRight.y * PAGE_HEIGHT).toBeCloseTo(expected.y + expected.height, 6);
    }
  });

  it("bakes opaque content only inside the content sub-rect; band + gutter stay transparent", () => {
    const preview = createGutterPreview();
    expect(preview.status).toBe("ready");
    if (preview.status !== "ready") {
      return;
    }
    const page = requirePage(preview);
    const pageBytes = createTextureAtlasPageRgbaBytes(preview);

    const largeSubRect = insetRect(requirePlacement(preview, LARGE.token).contentRectPixels, LARGE.padding);
    const smallSubRect = insetRect(requirePlacement(preview, SMALL.token).contentRectPixels, SMALL.padding);

    // Every opaque pixel on the page belongs to exactly one tile's content sub-rect and
    // matches that tile's colour. This simultaneously proves: (a) the covering-margin
    // band is transparent, (b) the atlas gutter is transparent (edge-extrude copied the
    // raster's transparent border, not an opaque edge), and (c) no tile's content bled
    // into the other tile's region (§4 cross-bleed avoidance).
    for (let y = 0; y < page.height; y += 1) {
      for (let x = 0; x < page.width; x += 1) {
        const pixel = readPixel(pageBytes, page.width, x, y);
        if (pixel[3] === 0) {
          continue;
        }

        if (pointInRect(x, y, largeSubRect)) {
          expect(pixel).toEqual([...LARGE.color]);
        } else if (pointInRect(x, y, smallSubRect)) {
          expect(pixel).toEqual([...SMALL.color]);
        } else {
          throw new Error(`Opaque page pixel outside any content sub-rect at (${x}, ${y}): ${pixel.join(",")}`);
        }
      }
    }

    // Content sub-rects are fully opaque (the content raster interior survived the copy).
    expectRectFilledWith(pageBytes, page.width, largeSubRect, LARGE.color);
    expectRectFilledWith(pageBytes, page.width, smallSubRect, SMALL.color);
  });

  it("keeps the covering-margin band and gutter premultiplied (0,0,0,0)", () => {
    const preview = createGutterPreview();
    expect(preview.status).toBe("ready");
    if (preview.status !== "ready") {
      return;
    }
    const page = requirePage(preview);
    const pageBytes = createTextureAtlasPageRgbaBytes(preview);
    const placement = requirePlacement(preview, LARGE.token);
    const contentRect = placement.contentRectPixels;
    const padded = placement.paddedRectPixels;

    // A band pixel just inside the raster's outer edge (covering-margin, must be transparent).
    const bandX = contentRect.x + 1;
    const bandY = contentRect.y + Math.floor(contentRect.height / 2);
    expect(readPixel(pageBytes, page.width, bandX, bandY)).toEqual([0, 0, 0, 0]);

    // A gutter pixel between the raster placement and the padded rect edge (edge-extrude
    // target — must be transparent, not an opaque clamped edge colour).
    const gutterX = padded.x;
    const gutterY = contentRect.y + Math.floor(contentRect.height / 2);
    expect(gutterX).toBeLessThan(contentRect.x);
    expect(readPixel(pageBytes, page.width, gutterX, gutterY)).toEqual([0, 0, 0, 0]);
  });

  it("maps maximum covering-margin overshoot into the tile's own transparent band, not the neighbour", () => {
    const preview = createGutterPreview();
    expect(preview.status).toBe("ready");
    if (preview.status !== "ready") {
      return;
    }
    const page = requirePage(preview);
    const pageBytes = createTextureAtlasPageRgbaBytes(preview);
    const large = requirePlacement(preview, LARGE.token);
    const small = requirePlacement(preview, SMALL.token);

    // The same linear uvRect consume the viewer (remapUvIntoPlacement) and export
    // (mapSourceUvToAtlasUv) apply: atlasUv = uvRect.topLeft + layerUv * span.
    const spanX = large.uvRect.bottomRight.x - large.uvRect.topLeft.x;
    const remapPxX = (layerU: number): number =>
      (large.uvRect.topLeft.x + layerU * spanX) * page.width;

    // u=0 → content left edge (which sits P px inside the raster placement); u=1 →
    // content right edge (P px inside from the right). (§4 test 4 endpoints.)
    expect(remapPxX(0)).toBeCloseTo(large.contentRectPixels.x + LARGE.padding, 6);
    expect(remapPxX(1)).toBeCloseTo(
      large.contentRectPixels.x + large.contentRectPixels.width - LARGE.padding,
      6
    );

    // Extreme right-edge overshoot: u = 1 + P/contentW is the largest the covering margin
    // can produce (design bounds the real overshoot strictly below this).
    const overshootPxX = remapPxX(1 + LARGE.padding / LARGE.content);

    // Stays within the large tile's own raster placement (contentRectPixels) …
    expect(overshootPxX).toBeGreaterThanOrEqual(large.contentRectPixels.x);
    expect(overshootPxX).toBeLessThanOrEqual(large.contentRectPixels.x + large.contentRectPixels.width);
    // … and never reaches the small tile's placement.
    expect(rectsOverlap(large.contentRectPixels, small.paddedRectPixels)).toBe(false);

    // The last band pixel on that edge (raster right − 1) is transparent.
    const lastBandX = large.contentRectPixels.x + large.contentRectPixels.width - 1;
    const midY = large.contentRectPixels.y + Math.floor(large.contentRectPixels.height / 2);
    expect(readPixel(pageBytes, page.width, lastBandX, midY)).toEqual([0, 0, 0, 0]);
  });

  it("packs deterministically inside the page without padded overlap", () => {
    const first = createGutterPreview();
    const second = createGutterPreview();

    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    if (first.status !== "ready" || second.status !== "ready") {
      return;
    }
    expect(first.layoutSummary).toEqual(second.layoutSummary);

    const page = requirePage(first);
    for (const placement of page.placements) {
      const padded = placement.paddedRectPixels;
      expect(padded.x).toBeGreaterThanOrEqual(0);
      expect(padded.y).toBeGreaterThanOrEqual(0);
      expect(padded.x + padded.width).toBeLessThanOrEqual(page.width);
      expect(padded.y + padded.height).toBeLessThanOrEqual(page.height);
    }
    expect(
      rectsOverlap(
        requirePlacement(first, LARGE.token).paddedRectPixels,
        requirePlacement(first, SMALL.token).paddedRectPixels
      )
    ).toBe(false);
  });
});

type ReadyPreview = Extract<ReturnType<typeof createTextureAtlasPreview>, { readonly status: "ready" }>;

function createGutterPreview() {
  const session = createGutterSession([LARGE, SMALL]);

  return createTextureAtlasPreview(session, {
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
    paddingPixels: GUTTER_PIXELS,
    edgeExtrusionEnabled: true,
    edgeExtrusionPixels: 1
  });
}

function requirePage(preview: ReadyPreview) {
  const page = preview.layoutSummary.pages[0];
  if (page === undefined) {
    throw new Error("Expected one atlas page.");
  }

  return page;
}

function requirePlacement(preview: ReadyPreview, token: string) {
  const placement = requirePage(preview).placements.find(
    (candidate) => candidate.drawableId === `draw_gutter_${token}`
  );
  if (placement === undefined) {
    throw new Error(`Expected atlas placement for ${token}.`);
  }

  return placement;
}

function insetRect(rect: Rect, inset: number): Rect {
  return {
    x: rect.x + inset,
    y: rect.y + inset,
    width: rect.width - inset * 2,
    height: rect.height - inset * 2
  };
}

function readPixel(
  bytes: Uint8Array,
  pageWidth: number,
  x: number,
  y: number
): [number, number, number, number] {
  const index = (y * pageWidth + x) * 4;

  return [
    bytes[index] ?? 0,
    bytes[index + 1] ?? 0,
    bytes[index + 2] ?? 0,
    bytes[index + 3] ?? 0
  ];
}

function expectRectFilledWith(
  bytes: Uint8Array,
  pageWidth: number,
  rect: Rect,
  color: readonly [number, number, number, number]
): void {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      expect(readPixel(bytes, pageWidth, x, y)).toEqual([...color]);
    }
  }
}

function pointInRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

function rectsOverlap(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function createPaddedRaster(tile: TileFixture): Uint8Array {
  const padded = tile.content + tile.padding * 2;
  const bytes = new Uint8Array(padded * padded * 4);

  for (let y = 0; y < padded; y += 1) {
    for (let x = 0; x < padded; x += 1) {
      const inContent =
        x >= tile.padding &&
        x < tile.padding + tile.content &&
        y >= tile.padding &&
        y < tile.padding + tile.content;
      if (!inContent) {
        continue; // transparent (0,0,0,0) covering-margin border
      }

      const index = (y * padded + x) * 4;
      bytes[index] = tile.color[0];
      bytes[index + 1] = tile.color[1];
      bytes[index + 2] = tile.color[2];
      bytes[index + 3] = tile.color[3];
    }
  }

  return bytes;
}

function createGutterSession(tiles: readonly TileFixture[]): AuthoringSession {
  const session: AuthoringSession = {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_transparent_gutter_test"),
      packageDisplayName: "Transparent Gutter Test",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 0,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 256, height: 256 },
      parts: [
        {
          partId: PART_ROOT,
          displayName: "Gutter Root",
          childPartIds: [],
          drawableIds: tiles.map((tile) => createDrawableId(tile.token)),
          children: tiles.map((tile) => ({
            kind: "drawable" as const,
            drawableId: createDrawableId(tile.token)
          }))
        }
      ],
      drawables: tiles.map((tile, index) => createDrawable(tile, index)),
      meshes: tiles.map(createMesh),
      parameters: [],
      keyformSets: [],
      rigControls: [
        {
          kind: "rotation2d",
          rigControlId: RIG_ROOT,
          displayName: "Gutter Rig",
          childDrawableIds: tiles.map((tile) => createDrawableId(tile.token)),
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
      drawOrder: tiles.map((tile, index) => ({
        drawableId: createDrawableId(tile.token),
        baseDrawOrder: index,
        stableOrder: index
      })),
      rigControlRootIds: [RIG_ROOT],
      stableOrder: [PART_ROOT, ...tiles.map((tile) => createDrawableId(tile.token))],
      sourceAssets: [],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: tiles.map(createTextureEntry)
      },
      provenanceRecords: [
        {
          provenanceId: PROV_FIXTURE,
          assetId: SRC_FIXTURE,
          assetKind: "generatedFixture",
          filePath: "assets/sources/generated/transparent-gutter-fixture.json",
          creator: "transparent-gutter-test",
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

  for (const tile of tiles) {
    const bytes = createPaddedRaster(tile);
    const binaryAssetRef = createTextureBinaryAssetReference(tile.token, bytes);

    registerAuthoringSessionBinaryBytes(session, {
      binaryAssetRef,
      bytes,
      role: "texture-raster-v1",
      sourceAssetId: SRC_FIXTURE,
      textureId: createTextureId(tile.token)
    });
  }

  return session;
}

function createDrawable(tile: TileFixture, baseDrawOrder: number) {
  return {
    drawableId: createDrawableId(tile.token),
    displayName: `Gutter ${tile.token}`,
    partId: PART_ROOT,
    sourceAssetId: SRC_FIXTURE,
    textureId: createTextureId(tile.token),
    meshId: createMeshId(tile.token),
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder,
    sourceProvenanceId: PROV_FIXTURE
  };
}

function createMesh(tile: TileFixture) {
  // Stage bounds stay content-sized (bounds != padded raster). UVs include covering-margin
  // overshoot ( < 0 and > 1) to mirror the unclamped layer-local UV D-gen emits.
  const overshoot = tile.padding / tile.content;

  return {
    meshId: createMeshId(tile.token),
    drawableId: createDrawableId(tile.token),
    vertices: [
      { x: -tile.padding, y: -tile.padding },
      { x: tile.content + tile.padding, y: -tile.padding },
      { x: tile.content + tile.padding, y: tile.content + tile.padding },
      { x: -tile.padding, y: tile.content + tile.padding }
    ],
    uvs: [
      { x: -overshoot, y: -overshoot },
      { x: 1 + overshoot, y: -overshoot },
      { x: 1 + overshoot, y: 1 + overshoot },
      { x: -overshoot, y: 1 + overshoot }
    ],
    triangles: [
      [0, 1, 2],
      [0, 2, 3]
    ] as [[number, number, number], [number, number, number]],
    vertexStableIds: [
      VertexIdSchema.parse(`vtx_gutter_${tile.token}_0`),
      VertexIdSchema.parse(`vtx_gutter_${tile.token}_1`),
      VertexIdSchema.parse(`vtx_gutter_${tile.token}_2`),
      VertexIdSchema.parse(`vtx_gutter_${tile.token}_3`)
    ],
    triangleStableIds: [
      TriangleIdSchema.parse(`tri_gutter_${tile.token}_0`),
      TriangleIdSchema.parse(`tri_gutter_${tile.token}_1`)
    ],
    topologyRevision: 0,
    bounds: { x: 0, y: 0, width: tile.content, height: tile.content },
    generationProvenanceId: PROV_FIXTURE
  };
}

function createTextureEntry(tile: TileFixture) {
  const padded = tile.content + tile.padding * 2;
  const bytes = createPaddedRaster(tile);

  return {
    textureId: createTextureId(tile.token),
    filePath: `assets/textures/${tile.token}.raw-rgba`,
    dimensions: {
      width: padded,
      height: padded,
      pixelFormat: "rgba8" as const
    },
    contentInset: {
      left: tile.padding,
      top: tile.padding,
      right: tile.padding,
      bottom: tile.padding
    },
    provenanceId: PROV_FIXTURE,
    binaryAssetRef: createTextureBinaryAssetReference(tile.token, bytes)
  };
}

function createTextureBinaryAssetReference(token: string, bytes: Uint8Array) {
  return BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_gutter_${token}`,
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

function createDrawableId(token: string) {
  return DrawableIdSchema.parse(`draw_gutter_${token}`);
}

function createMeshId(token: string) {
  return MeshIdSchema.parse(`mesh_gutter_${token}`);
}

function createTextureId(token: string) {
  return TextureIdSchema.parse(`tex_gutter_${token}`);
}
