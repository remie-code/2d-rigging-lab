import { DrawableIdSchema, MeshIdSchema } from "@private-2d-rigging-lab/contracts";
import type { RectDto } from "@private-2d-rigging-lab/contracts";
import type { RuntimeSnapshotDto } from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import { modelEvaluatedBounds } from "./evaluated-bounds.js";

/**
 * Wave105 Domain A — `modelEvaluatedBounds` visibility-world framing.
 *
 * Locks the visible-only union that plan §3.1 ("framing shares the same
 * visibility world") / §9 ("目と巻尺が同じ可視性世界を見る") requires: the
 * model-bounds framing region unions ONLY the visible drawables, so a
 * gated-hidden drawable placed OUTSIDE the visible union does not widen the
 * frame. Reverting the implementation to the pre-Wave105 "union all drawables"
 * behaviour would fold the hidden drawable's bounds back in and widen the
 * returned rect — which this test rejects (mutation-detecting).
 *
 * Hand-built snapshot: `modelEvaluatedBounds` reads only each drawable's
 * `visible` flag and `bounds`, so a minimal drawable list exercises the whole
 * contract directly (no fixture / renderer needed to observe the gap).
 */

interface StubDrawable {
  readonly drawableId: string;
  readonly meshId: string;
  readonly visible: boolean;
  readonly bounds: RectDto;
}

/**
 * A snapshot carrying only the fields `modelEvaluatedBounds` consumes
 * (`drawables[].visible` + `drawables[].bounds`). Everything else is filled
 * with schema-valid defaults so the object is a real {@link RuntimeSnapshotDto}.
 */
const snapshotWithDrawables = (drawables: readonly StubDrawable[]): RuntimeSnapshotDto =>
  ({
    schemaVersion: "runtime-snapshot-v1",
    runtimeCoreVersion: "test",
    snapshotId: "snap_evaluated_bounds_test",
    context: {
      source: { surface: "preview" },
      policy: { strictness: "interactive" }
    },
    packageId: "pkg_evaluated_bounds_test",
    packageRevision: 0,
    dirty: false,
    evaluation: {
      snapshotDetail: "summary",
      evaluatorVersions: {}
    },
    parameters: [],
    dynamics: [],
    keyformSamples: [],
    rigControls: [],
    drawables: drawables.map((drawable, index) => ({
      drawableId: DrawableIdSchema.parse(drawable.drawableId),
      meshId: MeshIdSchema.parse(drawable.meshId),
      visible: drawable.visible,
      opacity: 1,
      baseDrawOrder: index,
      evaluatedDrawOrder: index,
      bounds: drawable.bounds,
      vertexCount: 4,
      vertexHash: `hash_${drawable.drawableId}`,
      diagnostics: []
    })),
    masks: [],
    drawList: drawables
      .filter((drawable) => drawable.visible)
      .map((drawable) => DrawableIdSchema.parse(drawable.drawableId)),
    disabledFutureLayers: [],
    diagnostics: []
  }) as unknown as RuntimeSnapshotDto;

describe("modelEvaluatedBounds — visible-only framing world", () => {
  it("excludes a hidden drawable that sits OUTSIDE the visible union's bbox", () => {
    // Visible drawable occupies [0,10]×[0,10]. The hidden drawable sits far
    // away at [100,120]×[100,120] — well outside the visible union — so
    // whether the hidden bounds are unioned in is observable in the rect:
    //   visible-only (current) → { x: 0, y: 0, width: 10, height: 10 }
    //   union-all   (reverted) → { x: 0, y: 0, width: 120, height: 120 }
    const snapshot = snapshotWithDrawables([
      {
        drawableId: "draw_visible_eye",
        meshId: "mesh_visible_eye",
        visible: true,
        bounds: { x: 0, y: 0, width: 10, height: 10 }
      },
      {
        drawableId: "draw_hidden_outfit",
        meshId: "mesh_hidden_outfit",
        visible: false,
        bounds: { x: 100, y: 100, width: 20, height: 20 }
      }
    ]);

    const bounds = modelEvaluatedBounds(snapshot);

    // The frame is exactly the visible drawable — the hidden, spatially-distinct
    // drawable does NOT widen it. Union-all would return width/height 120.
    expect(bounds).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it("unions every drawable when all are visible (gate-free framing unchanged)", () => {
    const snapshot = snapshotWithDrawables([
      {
        drawableId: "draw_visible_eye",
        meshId: "mesh_visible_eye",
        visible: true,
        bounds: { x: 0, y: 0, width: 10, height: 10 }
      },
      {
        drawableId: "draw_visible_outfit",
        meshId: "mesh_visible_outfit",
        visible: true,
        bounds: { x: 100, y: 100, width: 20, height: 20 }
      }
    ]);

    const bounds = modelEvaluatedBounds(snapshot);

    // Both visible → union spans both: [0,120]×[0,120].
    expect(bounds).toEqual({ x: 0, y: 0, width: 120, height: 120 });
  });
});
