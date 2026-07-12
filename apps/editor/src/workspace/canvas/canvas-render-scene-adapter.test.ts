import { DrawableIdSchema, PartIdSchema } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import type { CanvasRenderableDrawable, CanvasRenderProjection } from "./canvas-projection";
import { createRenderSceneFromCanvasProjection } from "./canvas-render-scene-adapter";

const DRAW_MASK = DrawableIdSchema.parse("draw_adapter_mask");
const DRAW_TARGET = DrawableIdSchema.parse("draw_adapter_target");
const PART = PartIdSchema.parse("part_adapter");

describe("canvas render scene adapter", () => {
  it("maps renderable projection drawables into RenderScene with texture bytes, mesh, opacity, order, and clipping", () => {
    const projection = createProjection([
      createDrawable(DRAW_MASK, "tex_mask", 3, {
        selected: true,
        opacity: 0.5
      }),
      createDrawable(DRAW_TARGET, "tex_target", 0, {
        maskSourceDrawableIds: [DRAW_MASK],
        opacity: 0.75
      })
    ]);

    const scene = createRenderSceneFromCanvasProjection(projection, { isolateSelected: true });

    expect(scene.schemaVersion).toBe("render-scene-v0");
    expect(scene.textureSources.map((source) => source.textureId)).toEqual([
      "tex_mask",
      "tex_target"
    ]);
    expect(scene.textureSources[0]?.bytes.byteLength).toBe(16);
    expect(scene.textureSources[0]?.contentSignature).toMatch(/^rgba8-fnv1a32:/);
    expect(scene.drawables.map((drawable) => [drawable.drawableId, drawable.drawOrder])).toEqual([
      [DRAW_MASK, 3],
      [DRAW_TARGET, 0]
    ]);
    expect(scene.drawables[0]?.opacity).toBe(0.5);
    expect(scene.drawables[1]?.opacity).toBeCloseTo(0.75 * 0.22);
    expect(scene.drawables[1]?.clipping).toEqual({
      mode: "drawable-alpha-mask-v0",
      maskDrawableIds: [DRAW_MASK]
    });
    expect(scene.drawables[1]?.mesh).toMatchObject({
      coordinateSpace: "stage",
      uvSpace: "layer-local-top-left-0-1-v1",
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 }
      ],
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ],
      triangles: [[0, 1, 2]]
    });
  });

  it("does not attach clipping to Mesh Tool preview drawables", () => {
    const projection = createProjection([
      createDrawable(DRAW_TARGET, "tex_target", 0, {
        maskSourceDrawableIds: [DRAW_MASK],
        meshPreview: true
      })
    ]);

    const scene = createRenderSceneFromCanvasProjection(projection);

    expect(scene.drawables[0]?.clipping).toBeUndefined();
  });

  it("maps empty committed meshes to a bounds quad for RenderScene drawing", () => {
    const projection = createProjection([
      createDrawable(DRAW_TARGET, "tex_target", 0, {
        bounds: { x: 12, y: 24, width: 32, height: 48 },
        evaluatedMesh: {
          source: "committed",
          sourceMeshId: "mesh_empty",
          bounds: { x: 12, y: 24, width: 32, height: 48 },
          vertices: [],
          uvs: [],
          triangles: []
        }
      })
    ]);

    const scene = createRenderSceneFromCanvasProjection(projection);

    expect(scene.drawables[0]?.mesh).toMatchObject({
      coordinateSpace: "stage",
      uvSpace: "layer-local-top-left-0-1-v1",
      vertices: [
        { x: 12, y: 24 },
        { x: 44, y: 24 },
        { x: 44, y: 72 },
        { x: 12, y: 72 }
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
      ]
    });
  });

  it("maps degenerate-only committed meshes to a bounds quad for RenderScene drawing", () => {
    const projection = createProjection([
      createDrawable(DRAW_TARGET, "tex_target", 0, {
        bounds: { x: 10, y: 20, width: 30, height: 40 },
        evaluatedMesh: {
          source: "committed",
          sourceMeshId: "mesh_degenerate",
          bounds: { x: 10, y: 20, width: 30, height: 40 },
          vertices: [
            { x: 10, y: 20 },
            { x: 10, y: 20 },
            { x: 40, y: 60 }
          ],
          uvs: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          triangles: [[0, 1, 2]]
        }
      })
    ]);

    const scene = createRenderSceneFromCanvasProjection(projection);

    expect(scene.drawables[0]?.mesh.vertices).toEqual([
      { x: 10, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 60 },
      { x: 10, y: 60 }
    ]);
    expect(scene.drawables[0]?.mesh.triangles).toEqual([
      [0, 1, 2],
      [0, 2, 3]
    ]);
  });

  it("remaps content-space UV onto the padded raster content sub-rect for a triangle mesh (Wave 1.2 F)", () => {
    const PADDED = 28;
    const PADDING = 4;
    const projection = createProjection([
      createDrawable(DRAW_TARGET, "tex_target", 0, {
        contentInset: { left: PADDING, top: PADDING, right: PADDING, bottom: PADDING },
        rasterDimensions: { width: PADDED, height: PADDED }
        // evaluatedMesh defaults to a triangle with content UVs {0,0},{1,0},{0,1}
      })
    ]);

    const scene = createRenderSceneFromCanvasProjection(projection);

    // u' = (P + u·(PADDED − 2P)) / PADDED = (4 + u·20) / 28
    const low = PADDING / PADDED; // 4/28
    const high = (PADDED - PADDING) / PADDED; // 24/28
    const uvs = scene.drawables[0]?.mesh.uvs ?? [];
    expect(uvs[0]?.x).toBeCloseTo(low, 12);
    expect(uvs[0]?.y).toBeCloseTo(low, 12);
    expect(uvs[1]?.x).toBeCloseTo(high, 12);
    expect(uvs[1]?.y).toBeCloseTo(low, 12);
    expect(uvs[2]?.x).toBeCloseTo(low, 12);
    expect(uvs[2]?.y).toBeCloseTo(high, 12);
    // Vertices (stage geometry) are untouched by the UV remap.
    expect(scene.drawables[0]?.mesh.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 }
    ]);
  });

  it("remaps the bounds-quad UV onto the content sub-rect for empty meshes (Wave 1.2 F)", () => {
    const PADDED = 28;
    const PADDING = 4;
    const projection = createProjection([
      createDrawable(DRAW_TARGET, "tex_target", 0, {
        bounds: { x: 12, y: 24, width: 32, height: 48 },
        contentInset: { left: PADDING, top: PADDING, right: PADDING, bottom: PADDING },
        rasterDimensions: { width: PADDED, height: PADDED },
        evaluatedMesh: {
          source: "committed",
          sourceMeshId: "mesh_empty",
          bounds: { x: 12, y: 24, width: 32, height: 48 },
          vertices: [],
          uvs: [],
          triangles: []
        }
      })
    ]);

    const scene = createRenderSceneFromCanvasProjection(projection);

    const low = PADDING / PADDED; // 4/28
    const high = (PADDED - PADDING) / PADDED; // 24/28
    const uvs = scene.drawables[0]?.mesh.uvs ?? [];
    expect(uvs[0]?.x).toBeCloseTo(low, 12);
    expect(uvs[0]?.y).toBeCloseTo(low, 12);
    expect(uvs[1]?.x).toBeCloseTo(high, 12);
    expect(uvs[1]?.y).toBeCloseTo(low, 12);
    expect(uvs[2]?.x).toBeCloseTo(high, 12);
    expect(uvs[2]?.y).toBeCloseTo(high, 12);
    expect(uvs[3]?.x).toBeCloseTo(low, 12);
    expect(uvs[3]?.y).toBeCloseTo(high, 12);
    // Bounds quad geometry is unchanged.
    expect(scene.drawables[0]?.mesh.vertices).toEqual([
      { x: 12, y: 24 },
      { x: 44, y: 24 },
      { x: 44, y: 72 },
      { x: 12, y: 72 }
    ]);
  });

  it("applies each inset side independently under the atlas contentUvRect formula (Wave 1.2 F)", () => {
    // Asymmetric inset + non-square raster: verifies the remap uses left/top/right/bottom per axis,
    // matching texture-atlas-packing.ts createTextureAtlasPlacement's contentUvRect.
    const inset = { left: 3, top: 5, right: 7, bottom: 9 };
    const raster = { width: 40, height: 60 };
    const projection = createProjection([
      createDrawable(DRAW_TARGET, "tex_target", 0, {
        contentInset: inset,
        rasterDimensions: raster,
        evaluatedMesh: {
          source: "committed",
          sourceMeshId: "mesh_corners",
          bounds: { x: 0, y: 0, width: 10, height: 10 },
          vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 }
          ],
          uvs: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 }
          ],
          triangles: [[0, 1, 2]]
        }
      })
    ]);

    const scene = createRenderSceneFromCanvasProjection(projection);

    const contentW = raster.width - inset.left - inset.right; // 30
    const contentH = raster.height - inset.top - inset.bottom; // 46
    const remapX = (u: number): number => (inset.left + u * contentW) / raster.width;
    const remapY = (v: number): number => (inset.top + v * contentH) / raster.height;
    const uvs = scene.drawables[0]?.mesh.uvs ?? [];
    expect(uvs[0]?.x).toBeCloseTo(remapX(0), 12); // 3/40
    expect(uvs[0]?.y).toBeCloseTo(remapY(0), 12); // 5/60
    expect(uvs[1]?.x).toBeCloseTo(remapX(1), 12); // 33/40
    expect(uvs[1]?.y).toBeCloseTo(remapY(0), 12);
    expect(uvs[2]?.x).toBeCloseTo(remapX(1), 12);
    expect(uvs[2]?.y).toBeCloseTo(remapY(1), 12); // 51/60
  });

  it("leaves content UV unchanged when contentInset is absent or all-zero (Wave 1.2 F back-compat)", () => {
    const absentProjection = createProjection([
      createDrawable(DRAW_TARGET, "tex_target", 0, {
        // no contentInset / rasterDimensions: legacy entry
      })
    ]);
    const absentUvs =
      createRenderSceneFromCanvasProjection(absentProjection).drawables[0]?.mesh.uvs ?? [];
    expect(absentUvs).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ]);

    const zeroProjection = createProjection([
      createDrawable(DRAW_TARGET, "tex_target", 0, {
        contentInset: { left: 0, top: 0, right: 0, bottom: 0 },
        rasterDimensions: { width: 20, height: 20 }
      })
    ]);
    const zeroUvs =
      createRenderSceneFromCanvasProjection(zeroProjection).drawables[0]?.mesh.uvs ?? [];
    expect(zeroUvs).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ]);
  });

  it("does not clamp content UV outside [0,1] — covering-margin overshoot maps linearly (Wave 1.2 F)", () => {
    const PADDED = 28;
    const PADDING = 4;
    const projection = createProjection([
      createDrawable(DRAW_TARGET, "tex_target", 0, {
        contentInset: { left: PADDING, top: PADDING, right: PADDING, bottom: PADDING },
        rasterDimensions: { width: PADDED, height: PADDED },
        evaluatedMesh: {
          source: "committed",
          sourceMeshId: "mesh_overshoot",
          bounds: { x: 0, y: 0, width: 10, height: 10 },
          vertices: [
            { x: -2, y: -2 },
            { x: 12, y: -2 },
            { x: 12, y: 12 }
          ],
          // Covering-margin overshoot: content UVs below 0 and above 1.
          uvs: [
            { x: -0.3, y: -0.3 },
            { x: 1.3, y: -0.3 },
            { x: 1.3, y: 1.3 }
          ],
          triangles: [[0, 1, 2]]
        }
      })
    ]);

    const scene = createRenderSceneFromCanvasProjection(projection);

    const contentW = PADDED - PADDING * 2; // 20
    const remap = (t: number): number => (PADDING + t * contentW) / PADDED;
    const uvs = scene.drawables[0]?.mesh.uvs ?? [];
    // u=-0.3 → (4 + (−0.3)·20)/28 = −2/28 ≈ −0.0714 — stays negative, NOT clamped to 0.
    expect(uvs[0]?.x).toBeCloseTo(remap(-0.3), 12);
    expect(uvs[0]?.x).toBeLessThan(0);
    expect(uvs[0]?.y).toBeCloseTo(remap(-0.3), 12);
    // u=1.3 → (4 + 1.3·20)/28 = 30/28 ≈ 1.0714 — stays above 1, NOT clamped.
    expect(uvs[1]?.x).toBeCloseTo(remap(1.3), 12);
    expect(uvs[1]?.x).toBeGreaterThan(1);
    expect(uvs[2]?.y).toBeCloseTo(remap(1.3), 12);
  });

  it("keeps the remapped content edges aligned to the drawable bounds (Wave 1.2 F position semantics)", () => {
    // Position semantics: the content occupies UV sub-rect [inset, PADDED−inset] of the padded
    // raster. A bounds quad (content edges at UV 0 and 1 pre-remap) must sample exactly that
    // sub-rect after remap, so the content fills `bounds` with no residual padding offset.
    const PADDED = 34;
    const PADDING = 7; // larger P, like the topwear/hair layers in the investigation
    const CONTENT = PADDED - PADDING * 2; // 20
    const bounds = { x: 100, y: 200, width: 20, height: 20 };
    const projection = createProjection([
      createDrawable(DRAW_TARGET, "tex_target", 0, {
        bounds,
        contentInset: { left: PADDING, top: PADDING, right: PADDING, bottom: PADDING },
        rasterDimensions: { width: PADDED, height: PADDED },
        evaluatedMesh: {
          source: "committed",
          sourceMeshId: "mesh_empty_pos",
          bounds,
          vertices: [],
          uvs: [],
          triangles: []
        }
      })
    ]);

    const scene = createRenderSceneFromCanvasProjection(projection);
    const uvs = scene.drawables[0]?.mesh.uvs ?? [];

    // The four bounds-quad corners (pre-remap UV [{0,0},{1,0},{1,1},{0,1}]) must map onto the
    // content sub-rect edges of the padded raster.
    const contentLeftUv = PADDING / PADDED;
    const contentRightUv = (PADDING + CONTENT) / PADDED;
    expect(uvs[0]?.x).toBeCloseTo(contentLeftUv, 12);
    expect(uvs[0]?.y).toBeCloseTo(contentLeftUv, 12);
    expect(uvs[1]?.x).toBeCloseTo(contentRightUv, 12);
    expect(uvs[1]?.y).toBeCloseTo(contentLeftUv, 12);
    expect(uvs[2]?.x).toBeCloseTo(contentRightUv, 12);
    expect(uvs[2]?.y).toBeCloseTo(contentRightUv, 12);
    expect(uvs[3]?.x).toBeCloseTo(contentLeftUv, 12);
    expect(uvs[3]?.y).toBeCloseTo(contentRightUv, 12);
    // The remapped content span in raster pixels equals the drawable bounds size — the content
    // exactly fills `bounds` with no residual padding offset (the H1 defect corrected).
    const contentPixelSpan = (contentRightUv - contentLeftUv) * PADDED;
    expect(contentPixelSpan).toBeCloseTo(bounds.width, 12);
    expect(contentPixelSpan).toBeCloseTo(CONTENT, 12);
  });
});

function createProjection(drawables: readonly CanvasRenderableDrawable[]): CanvasRenderProjection {
  return {
    canvasBounds: { x: 0, y: 0, width: 64, height: 64 },
    artworkBounds: { x: 0, y: 0, width: 16, height: 16 },
    selectedDrawableIds: new Set(drawables.filter((drawable) => drawable.selected).map((drawable) => drawable.drawableId)),
    drawables,
    maskRelations: [],
    hasRenderableArtwork: true,
    contentKey: "adapter-test"
  };
}

function createDrawable(
  drawableId: ReturnType<typeof DrawableIdSchema.parse>,
  textureId: string,
  frontOrder: number,
  options: {
    readonly bounds?: CanvasRenderableDrawable["bounds"];
    readonly evaluatedMesh?: CanvasRenderableDrawable["evaluatedMesh"];
    readonly maskSourceDrawableIds?: readonly ReturnType<typeof DrawableIdSchema.parse>[];
    readonly meshPreview?: boolean;
    readonly opacity?: number;
    readonly selected?: boolean;
    readonly contentInset?: CanvasRenderableDrawable["contentInset"];
    readonly rasterDimensions?: CanvasRenderableDrawable["rasterDimensions"];
  } = {}
): CanvasRenderableDrawable {
  return {
    drawableId,
    displayName: drawableId,
    partId: PART,
    partAncestorIds: [],
    textureId,
    binaryAssetId: `bin_${textureId}`,
    binaryAssetPath: `assets/${textureId}.rgba`,
    bounds: options.bounds ?? { x: 0, y: 0, width: 10, height: 10 },
    ...(options.contentInset === undefined ? {} : { contentInset: options.contentInset }),
    ...(options.rasterDimensions === undefined
      ? {}
      : { rasterDimensions: options.rasterDimensions }),
    evaluatedMesh: options.evaluatedMesh ?? {
      source: "committed",
      sourceMeshId: `mesh_${drawableId}`,
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 }
      ],
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ],
      triangles: [[0, 1, 2]]
    },
    frontOrder,
    visible: true,
    opacity: options.opacity ?? 1,
    selected: options.selected ?? false,
    selectedBySubtree: false,
    meshPreview: options.meshPreview ?? false,
    renderBytes: new Uint8Array([
      255,
      0,
      0,
      255,
      0,
      255,
      0,
      255,
      0,
      0,
      255,
      255,
      255,
      255,
      255,
      255
    ]),
    renderWidth: 2,
    renderHeight: 2,
    maskSourceDrawableIds: options.maskSourceDrawableIds ?? []
  };
}
