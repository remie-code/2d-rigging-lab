import {
  DrawableIdSchema,
  MeshIdSchema,
  TextureIdSchema,
  type Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import {
  TextureAtlasPlacementSchema,
  type TextureAtlasPlacementDto
} from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import { mapSourceUvToAtlasUv } from "./runtime-export-materialization.js";

// Wave108 Domain E — export/runtime materialization of non-clamped layer-local UV into
// the atlas transparent gutter. Oracle:
// discussion/design/mesh-rendering/boundary-transparent-margin-design.md (§3.2, §4, §7),
// and the D-atlas placement contract (wave108-domain-c report §3): `uvRect` is the
// **content sub-rect** (single source of truth), `sourceRectPixels = (0,0,padded raster)`,
// `sourceTextureSize` = padded raster. These tests express, as numbers, that
// `mapSourceUvToAtlasUv` is unchanged-correct against those placements: it reduces to the
// identical linear consume of `uvRect` that the editor atlasRuntime remap performs, and
// that non-clamped overshoot lands in each tile's own transparent band, never a neighbour.

// D-atlas placement geometry, reproduced exactly as texture-atlas-packing.ts
// `createTextureAtlasPlacement` builds it, for a tile with a uniform baked transparent
// covering-margin border of `inset` source pixels around a `content`-sized content region:
//   padded raster    = content + 2·inset  (== sourceTextureSize == sourceRectPixels span)
//   contentRectPixels = the whole padded raster placed at (rasterX, rasterY) on the page
//   uvRect            = the content sub-rect (raster inset by `inset`), page-normalized
const makePlacement = (input: {
  readonly token: string;
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly rasterX: number;
  readonly rasterY: number;
  readonly content: number;
  readonly inset: number;
}): TextureAtlasPlacementDto => {
  const padded = input.content + 2 * input.inset;
  const contentRect = {
    x: input.rasterX,
    y: input.rasterY,
    width: padded,
    height: padded
  };
  const contentSubRect = {
    x: contentRect.x + input.inset,
    y: contentRect.y + input.inset,
    width: input.content,
    height: input.content
  };

  return TextureAtlasPlacementSchema.parse({
    placementId: `atlas_place_${input.token}`,
    pageId: "atlas_page_0",
    drawableId: DrawableIdSchema.parse(`draw_${input.token}`),
    meshId: MeshIdSchema.parse(`mesh_${input.token}`),
    originalTextureId: TextureIdSchema.parse(`tex_${input.token}`),
    atlasTextureId: TextureIdSchema.parse("tex_atlas_page_0"),
    sourceTextureSize: { width: padded, height: padded },
    sourceRectPixels: { x: 0, y: 0, width: padded, height: padded },
    contentRectPixels: contentRect,
    paddedRectPixels: contentRect,
    uvRect: {
      topLeft: {
        x: contentSubRect.x / input.pageWidth,
        y: contentSubRect.y / input.pageHeight
      },
      bottomRight: {
        x: (contentSubRect.x + contentSubRect.width) / input.pageWidth,
        y: (contentSubRect.y + contentSubRect.height) / input.pageHeight
      }
    },
    hiddenAtApply: false,
    hiddenReasons: []
  });
};

// Editor atlasRuntime remap, transcribed verbatim from
// apps/editor/src/workspace/viewer/viewer-render-source.ts:507-520 as a reference oracle.
// Both consumers read the same `uvRect` and multiply by the same span, so export must
// agree with this exactly (three-way consistency: editor atlasRuntime = export = runtime).
const remapUvIntoPlacementOracle = (
  uv: Vec2Dto,
  placement: TextureAtlasPlacementDto
): Vec2Dto => {
  const left = placement.uvRect.topLeft.x;
  const top = placement.uvRect.topLeft.y;
  const width = placement.uvRect.bottomRight.x - left;
  const height = placement.uvRect.bottomRight.y - top;

  return {
    x: left + uv.x * width,
    y: top + uv.y * height
  };
};

describe("mapSourceUvToAtlasUv (Wave108 Domain E export materialization)", () => {
  it("reduces to identity local-normalization and the linear uvRect consume", () => {
    // Fact 1: with sourceRectPixels = (0,0,sourceTextureSize), localX = uv.x, so
    // atlasUv = uvRect.topLeft + uv · (uvRect.bottomRight − uvRect.topLeft).
    const placement = makePlacement({
      token: "mouth_u",
      pageWidth: 128,
      pageHeight: 96,
      rasterX: 4,
      rasterY: 4,
      content: 17,
      inset: 3
    });
    // uvRect = content sub-rect: x ∈ [(4+3)/128, (4+3+17)/128] = [7/128, 24/128].
    expect(placement.uvRect.topLeft.x).toBeCloseTo(7 / 128, 12);
    expect(placement.uvRect.bottomRight.x).toBeCloseTo(24 / 128, 12);

    const uv: Vec2Dto = { x: 0.3, y: 0.7 };
    const atlasUv = mapSourceUvToAtlasUv(uv, placement);

    const spanX = placement.uvRect.bottomRight.x - placement.uvRect.topLeft.x;
    const spanY = placement.uvRect.bottomRight.y - placement.uvRect.topLeft.y;
    expect(atlasUv.x).toBeCloseTo(placement.uvRect.topLeft.x + uv.x * spanX, 12);
    expect(atlasUv.y).toBeCloseTo(placement.uvRect.topLeft.y + uv.y * spanY, 12);
    // Numeric ground truth: (7 + 0.3·17)/128 = 12.1/128 in x.
    expect(atlasUv.x).toBeCloseTo(12.1 / 128, 12);
    expect(atlasUv.y).toBeCloseTo((4 + 3 + 0.7 * 17) / 96, 12);
  });

  it("agrees exactly with the editor atlasRuntime remap on the shared uvRect", () => {
    // Fact 2: export mapping == editor remapUvIntoPlacement, for interior AND overshoot UV.
    const placements = [
      makePlacement({
        token: "mouth_u",
        pageWidth: 128,
        pageHeight: 96,
        rasterX: 4,
        rasterY: 4,
        content: 17,
        inset: 3
      }),
      makePlacement({
        token: "large_v7",
        pageWidth: 128,
        pageHeight: 96,
        rasterX: 31,
        rasterY: 4,
        content: 40,
        inset: 17
      })
    ];
    const uvs: readonly Vec2Dto[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 0.5, y: 0.25 },
      { x: -0.3, y: 1.2 }, // overshoot both directions (non-clamped layer-local UV)
      { x: 1.4, y: -0.15 }
    ];

    for (const placement of placements) {
      for (const uv of uvs) {
        const exported = mapSourceUvToAtlasUv(uv, placement);
        const remapped = remapUvIntoPlacementOracle(uv, placement);
        expect(exported.x).toBeCloseTo(remapped.x, 12);
        expect(exported.y).toBeCloseTo(remapped.y, 12);
      }
    }
  });

  it("maps u=0 and u=1 to the content edges (inset px inside the raster)", () => {
    const placement = makePlacement({
      token: "mouth_u",
      pageWidth: 128,
      pageHeight: 96,
      rasterX: 4,
      rasterY: 4,
      content: 17,
      inset: 3
    });

    const left = mapSourceUvToAtlasUv({ x: 0, y: 0 }, placement);
    const right = mapSourceUvToAtlasUv({ x: 1, y: 1 }, placement);
    // u=0 → content left edge = rasterX + inset = 7 px; u=1 → content right = 7+17 = 24 px.
    expect(left.x * 128).toBeCloseTo(7, 9);
    expect(right.x * 128).toBeCloseTo(24, 9);
    expect(left.y * 96).toBeCloseTo(7, 9);
    expect(right.y * 96).toBeCloseTo(24, 9);
  });

  it("keeps max non-clamped overshoot inside the tile's own transparent band, off the neighbour", () => {
    // Fact 3: overshoot up to u = 1 + inset/content lands in the raster's transparent band
    // (raster outer edge is the extreme), stays within atlas page [0,1], stays inside the
    // tile's own contentRectPixels, and never reaches the neighbouring placement (§4).
    const pageWidth = 128;
    const pageHeight = 96;
    const tileA = makePlacement({
      token: "mouth_u",
      pageWidth,
      pageHeight,
      rasterX: 4,
      rasterY: 4,
      content: 17,
      inset: 3
    });
    // tileA raster spans x ∈ [4, 27]; gutter of 4 px, then tileB raster x ∈ [31, 105].
    const tileB = makePlacement({
      token: "large_v7",
      pageWidth,
      pageHeight,
      rasterX: 31,
      rasterY: 4,
      content: 40,
      inset: 17
    });

    const bandForTile = (
      placement: TextureAtlasPlacementDto,
      content: number,
      inset: number
    ): void => {
      const uMax = 1 + inset / content; // max overshoot (right/bottom)
      const uMin = -inset / content; // max overshoot (left/top)

      for (const u of [uMin, 0, 1, uMax]) {
        for (const v of [uMin, 0, 1, uMax]) {
          const atlasUv = mapSourceUvToAtlasUv({ x: u, y: v }, placement);
          // Stays within the atlas page [0,1].
          expect(atlasUv.x).toBeGreaterThanOrEqual(0);
          expect(atlasUv.x).toBeLessThanOrEqual(1);
          expect(atlasUv.y).toBeGreaterThanOrEqual(0);
          expect(atlasUv.y).toBeLessThanOrEqual(1);

          const px = atlasUv.x * pageWidth;
          const py = atlasUv.y * pageHeight;
          const rect = placement.contentRectPixels;
          // Stays inside THIS tile's own raster placement (content sub-rect + band).
          expect(px).toBeGreaterThanOrEqual(rect.x - 1e-6);
          expect(px).toBeLessThanOrEqual(rect.x + rect.width + 1e-6);
          expect(py).toBeGreaterThanOrEqual(rect.y - 1e-6);
          expect(py).toBeLessThanOrEqual(rect.y + rect.height + 1e-6);
        }
      }
    };

    bandForTile(tileA, 17, 3);
    bandForTile(tileB, 40, 17);

    // Max overshoot maps to exactly the raster's outer edge, not beyond it.
    const aMax = mapSourceUvToAtlasUv({ x: 1 + 3 / 17, y: 1 + 3 / 17 }, tileA);
    expect(aMax.x * pageWidth).toBeCloseTo(27, 9); // tileA raster right edge = 4 + 23
    // ...and strictly short of tileB's raster placement (gutter gap), so no cross-bleed.
    expect(aMax.x * pageWidth).toBeLessThan(tileB.contentRectPixels.x);

    const bMax = mapSourceUvToAtlasUv({ x: 1 + 17 / 40, y: 1 + 17 / 40 }, tileB);
    expect(bMax.x * pageWidth).toBeCloseTo(105, 9); // tileB raster right edge = 31 + 74
    // ...and strictly clear of tileA's raster placement on the other side.
    expect(bMax.x * pageWidth).toBeGreaterThan(
      tileA.contentRectPixels.x + tileA.contentRectPixels.width
    );
  });
});
