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
    readonly maskSourceDrawableIds?: readonly ReturnType<typeof DrawableIdSchema.parse>[];
    readonly meshPreview?: boolean;
    readonly opacity?: number;
    readonly selected?: boolean;
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
    bounds: { x: 0, y: 0, width: 10, height: 10 },
    evaluatedMesh: {
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
