import {
  DrawableIdSchema,
  MeshIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createStableVertexHash } from "./drawable-geometry.js";
import { applyKeyformTargetPatches } from "./keyform-target-application.js";
import type { EvaluatedDrawableDto } from "./snapshot.js";

describe("keyform target application", () => {
  it("applies mesh vertex replacement and recomputes geometry metadata", () => {
    const drawable = createDrawable({
      drawableId: "draw_body",
      meshId: "mesh_body",
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ]
    });
    const patchVertices = [
      { x: -1, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 6 }
    ];

    const result = applyKeyformTargetPatches({
      drawables: [drawable],
      patches: [
        {
          keyformSetId: "keyset_body_vertices",
          targetKind: "mesh",
          targetId: drawable.meshId,
          targetProperty: "vertices",
          compositionMode: "replace",
          compositionOrder: 0,
          statePatch: patchVertices
        }
      ]
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.drawables).toHaveLength(1);
    const updated = expectDrawable(result.drawables[0]);
    expect(updated.vertices).toEqual(patchVertices);
    expect(updated.bounds).toEqual({ x: -1, y: 2, width: 4, height: 4 });
    expect(updated.vertexCount).toBe(3);
    expect(updated.vertexHash).toBe(createStableVertexHash(patchVertices));
    expect(result.drawList).toEqual([drawable.drawableId]);
  });

  it("applies mesh additive deltas to existing vertices", () => {
    const drawable = createDrawable({
      drawableId: "draw_hair",
      meshId: "mesh_hair",
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ]
    });

    const result = applyKeyformTargetPatches({
      drawables: [drawable],
      patches: [
        {
          keyformSetId: "keyset_hair_vertices",
          targetKind: "mesh",
          targetId: drawable.meshId,
          targetProperty: "vertices",
          compositionMode: "additiveDelta",
          compositionOrder: 0,
          statePatch: [
            { x: 0.5, y: 1 },
            { x: -0.25, y: 2 }
          ]
        }
      ]
    });

    expect(result.diagnostics).toEqual([]);
    expect(expectDrawable(result.drawables[0]).vertices).toEqual([
      { x: 0.5, y: 1 },
      { x: 0.75, y: 3 }
    ]);
  });

  it("accepts sampled target metadata produced by runtime sampling", () => {
    const drawable = createDrawable({
      drawableId: "draw_body",
      meshId: "mesh_body",
      opacity: 0.5
    });

    const result = applyKeyformTargetPatches({
      drawables: [drawable],
      patches: [
        {
          keyformSetId: "keyset_sampled_opacity",
          target: "drawable:draw_body.opacity",
          targetMetadata: {
            targetId: drawable.drawableId,
            targetKind: "drawable",
            targetProperty: "opacity"
          },
          compositionMode: "multiplyOpacity",
          compositionOrder: 0,
          statePatch: 0.5
        }
      ]
    });

    expect(result.diagnostics).toEqual([]);
    expect(expectDrawable(result.drawables[0]).opacity).toBe(0.25);
  });

  it("applies drawable opacity visibility and draw order patches", () => {
    const back = createDrawable({
      drawableId: "draw_back",
      meshId: "mesh_back",
      opacity: 0.8,
      visible: true,
      baseDrawOrder: 1,
      evaluatedDrawOrder: 1
    });
    const front = createDrawable({
      drawableId: "draw_front",
      meshId: "mesh_front",
      opacity: 0.5,
      visible: true,
      baseDrawOrder: 2,
      evaluatedDrawOrder: 2
    });

    const result = applyKeyformTargetPatches({
      drawables: [back, front],
      patches: [
        {
          keyformSetId: "keyset_back_opacity",
          targetKind: "drawable",
          targetId: back.drawableId,
          targetProperty: "opacity",
          compositionMode: "replace",
          compositionOrder: 0,
          statePatch: 1.5
        },
        {
          keyformSetId: "keyset_back_visibility",
          targetKind: "drawable",
          targetId: back.drawableId,
          targetProperty: "runtimeVisibility",
          compositionMode: "replace",
          compositionOrder: 1,
          statePatch: false
        },
        {
          keyformSetId: "keyset_back_order",
          targetKind: "drawable",
          targetId: back.drawableId,
          targetProperty: "drawOrder",
          compositionMode: "additiveDelta",
          compositionOrder: 2,
          statePatch: 3
        },
        {
          keyformSetId: "keyset_front_opacity",
          targetKind: "drawable",
          targetId: front.drawableId,
          targetProperty: "defaultOpacity",
          compositionMode: "multiplyOpacity",
          compositionOrder: 3,
          statePatch: 2
        }
      ]
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.drawables.map((drawable) => drawable.drawableId)).toEqual([front.drawableId, back.drawableId]);
    const updatedFront = expectDrawable(result.drawables[0]);
    const updatedBack = expectDrawable(result.drawables[1]);
    expect(updatedFront.opacity).toBe(1);
    expect(updatedBack.opacity).toBe(1);
    expect(updatedBack.visible).toBe(false);
    expect(updatedBack.evaluatedDrawOrder).toBe(4);
    expect(result.drawList).toEqual([front.drawableId]);
  });

  it("returns diagnostics for unsupported and incompatible patches", () => {
    const drawable = createDrawable({
      drawableId: "draw_body",
      meshId: "mesh_body",
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ]
    });

    const result = applyKeyformTargetPatches({
      drawables: [drawable],
      patches: [
        {
          keyformSetId: "keyset_unsupported_kind",
          targetKind: "rigControl",
          targetId: "rig_head",
          targetProperty: "angleDegrees",
          compositionMode: "replace",
          compositionOrder: 0,
          statePatch: 10
        },
        {
          keyformSetId: "keyset_missing_mesh",
          targetKind: "mesh",
          targetId: "mesh_missing",
          targetProperty: "vertices",
          compositionMode: "replace",
          compositionOrder: 1,
          statePatch: []
        },
        {
          keyformSetId: "keyset_bad_property",
          targetKind: "drawable",
          targetId: drawable.drawableId,
          targetProperty: "texture",
          compositionMode: "replace",
          compositionOrder: 2,
          statePatch: "texture_body"
        },
        {
          keyformSetId: "keyset_bad_mode",
          targetKind: "drawable",
          targetId: drawable.drawableId,
          targetProperty: "visible",
          compositionMode: "additiveDelta",
          compositionOrder: 3,
          statePatch: true
        },
        {
          keyformSetId: "keyset_length_mismatch",
          targetKind: "mesh",
          targetId: drawable.meshId,
          targetProperty: "vertices",
          compositionMode: "additiveDelta",
          compositionOrder: 4,
          statePatch: [{ x: 1, y: 0 }]
        },
        {
          keyformSetId: "keyset_nonfinite",
          targetKind: "mesh",
          targetId: drawable.meshId,
          targetProperty: "vertices",
          compositionMode: "replace",
          compositionOrder: 5,
          statePatch: [{ x: Infinity, y: 0 }]
        },
        {
          keyformSetId: "keyset_bad_opacity_shape",
          targetKind: "drawable",
          targetId: drawable.drawableId,
          targetProperty: "opacity",
          compositionMode: "replace",
          compositionOrder: 6,
          statePatch: { x: 1, y: 0 }
        },
        {
          keyformSetId: "keyset_bad_visibility_shape",
          targetKind: "drawable",
          targetId: drawable.drawableId,
          targetProperty: "visibility",
          compositionMode: "replace",
          compositionOrder: 7,
          statePatch: 1
        },
        {
          keyformSetId: "keyset_bad_draw_order",
          targetKind: "drawable",
          targetId: drawable.drawableId,
          targetProperty: "drawOrder",
          compositionMode: "replace",
          compositionOrder: 8,
          statePatch: 1.5
        }
      ]
    });

    expect(result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "keyformTarget.unsupportedTargetKind",
      "keyformTarget.missingTarget",
      "keyformTarget.unsupportedTargetProperty",
      "keyformTarget.unsupportedCompositionMode",
      "keyformTarget.vertexLengthMismatch",
      "keyformTarget.nonFinitePatchValue",
      "keyformTarget.invalidPatchShape",
      "keyformTarget.invalidPatchShape",
      "keyformTarget.nonIntegerDrawOrder"
    ]);
  });
});

const createDrawable = (input: {
  readonly drawableId: string;
  readonly meshId: string;
  readonly visible?: boolean;
  readonly opacity?: number;
  readonly baseDrawOrder?: number;
  readonly evaluatedDrawOrder?: number;
  readonly vertices?: readonly { readonly x: number; readonly y: number }[];
}): EvaluatedDrawableDto => {
  const vertices = input.vertices?.map((vertex) => ({ x: vertex.x, y: vertex.y }));
  const baseDrawable = {
    drawableId: DrawableIdSchema.parse(input.drawableId),
    meshId: MeshIdSchema.parse(input.meshId),
    visible: input.visible ?? true,
    opacity: input.opacity ?? 1,
    baseDrawOrder: input.baseDrawOrder ?? 0,
    evaluatedDrawOrder: input.evaluatedDrawOrder ?? input.baseDrawOrder ?? 0,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    vertexCount: vertices?.length ?? 0,
    vertexHash: vertices === undefined ? "hash_empty_0" : createStableVertexHash(vertices),
    diagnostics: []
  };

  return vertices === undefined
    ? baseDrawable
    : {
        ...baseDrawable,
        vertices
      };
};

const expectDrawable = (drawable: EvaluatedDrawableDto | undefined): EvaluatedDrawableDto => {
  expect(drawable).toBeDefined();
  if (drawable === undefined) {
    throw new Error("Expected drawable to be present.");
  }

  return drawable;
};
