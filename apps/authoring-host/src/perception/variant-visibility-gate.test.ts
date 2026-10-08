import { DrawableIdSchema } from "@private-2d-rigging-lab/contracts";
import type { RenderViewPayload } from "@private-2d-rigging-lab/ai-interface";
import { describe, expect, it } from "vitest";

import {
  createEmptyParameterPerceptionFixture,
  createVariantPerceptionFixture
} from "../test-support/perception-fixtures.js";
import { evaluatePerceptionSnapshot } from "./evaluation-adapter.js";
import { measureEvaluatedGeometry } from "./measurement-command.js";
import { renderPerceptionView } from "./render-view-command.js";
import { VariantSelectionResolutionError } from "./variant-selection-resolution.js";

/**
 * Wave105 Domain A — Variant visibility gate (perception).
 *
 * Proves the two-layer visibility composition `base visible AND
 * variantVisibilityPredicate(activeSelections)` is applied at the SNAPSHOT level
 * so the eye (render bytes), the tape measure (measurement `visible` flag) and
 * the framing all see the SAME gated visibility world; and that the empty case
 * (no Variant Groups) is a provable no-op.
 */

const visibleById = (
  snapshot: ReturnType<typeof evaluatePerceptionSnapshot>["snapshot"]
): ReadonlyMap<string, boolean> =>
  new Map(snapshot.drawables.map((drawable) => [drawable.drawableId, drawable.visible]));

const asDrawableId = (id: string) => DrawableIdSchema.parse(id);

const renderPayload = (overrides: Partial<RenderViewPayload> = {}): RenderViewPayload => ({
  parameterOverrides: {},
  outDir: "unused",
  outputName: "render",
  ...overrides
});

interface DrawableMeasurement {
  readonly found: boolean;
  readonly visible: boolean | undefined;
  readonly hasBounds: boolean;
}

const drawableMeasurement = (
  result: ReturnType<typeof measureEvaluatedGeometry>,
  drawableId: string
): DrawableMeasurement | undefined => {
  const entry = result.results.find(
    (candidate) => candidate.kind === "drawable" && candidate.drawableId === drawableId
  );
  if (entry === undefined || entry.kind !== "drawable") {
    return undefined;
  }
  return { found: entry.found, visible: entry.visible, hasBounds: entry.bounds !== undefined };
};

describe("variant visibility gate — empty case invariance", () => {
  it("leaves the snapshot object unchanged for a package with no Variant Groups (identity gate)", () => {
    const { session } = createEmptyParameterPerceptionFixture();

    const gated = evaluatePerceptionSnapshot(session);

    // No Variant Groups → predicate is identity → every base-visible drawable
    // stays visible; drawList unchanged.
    for (const drawable of gated.snapshot.drawables) {
      expect(drawable.visible).toBe(true);
    }
  });

  it("renders byte-identically with and without a (no-op) variantSelections request when there are no groups", () => {
    const { session } = createEmptyParameterPerceptionFixture();

    const withoutSelections = renderPerceptionView({
      session,
      payload: renderPayload()
    });
    // An empty selections array is a no-op when the package has no groups.
    const withEmptySelections = renderPerceptionView({
      session,
      payload: renderPayload({ variantSelections: [] })
    });

    expect(Buffer.from(withEmptySelections.png).equals(Buffer.from(withoutSelections.png))).toBe(
      true
    );
    // And the sidecar records an empty resolved selection (no groups).
    const sidecar = withoutSelections.sidecar({
      packagePath: "/pkg",
      pngPath: "/pkg/out.png"
    });
    expect(sidecar.variantSelections).toEqual([]);
  });
});

describe("variant visibility gate — composite fixture (default selection)", () => {
  it("passes only the Default-member drawable and hides the other at the snapshot level", () => {
    const { session, ids } = createVariantPerceptionFixture();

    const gated = evaluatePerceptionSnapshot(session);
    const visibility = visibleById(gated.snapshot);

    // Default variant: eye is a member (visible), eye-mask is not (hidden).
    expect(visibility.get(ids.eyeDrawableId)).toBe(true);
    expect(visibility.get(ids.eyeMaskDrawableId)).toBe(false);
    // drawList reflects the gate: hidden drawable dropped.
    expect(gated.snapshot.drawList).toContain(ids.eyeDrawableId);
    expect(gated.snapshot.drawList).not.toContain(ids.eyeMaskDrawableId);
  });

  it("produces DIFFERENT render bytes from the ungated (all-visible) baseline", () => {
    const variant = createVariantPerceptionFixture();
    const ungated = createEmptyParameterPerceptionFixture();

    const gatedPng = renderPerceptionView({
      session: variant.session,
      payload: renderPayload()
    }).png;
    // Same two drawables, no Variant Groups → both visible → different pixels
    // than the gated (one hidden) render.
    const baselinePng = renderPerceptionView({
      session: ungated.session,
      payload: renderPayload()
    }).png;

    expect(Buffer.from(gatedPng).equals(Buffer.from(baselinePng))).toBe(false);
  });
});

describe("variant visibility gate — override selection", () => {
  it("flips the passing set when the Alt variant is selected", () => {
    const { session, ids } = createVariantPerceptionFixture();

    const gated = evaluatePerceptionSnapshot(session, {
      variantSelections: [
        {
          variantGroupId: ids.variantGroupId,
          activeSelection: { kind: "singleSelect", variantId: ids.altVariantId }
        }
      ]
    });
    const visibility = visibleById(gated.snapshot);

    // Alt variant: eye-mask is now the member (visible), eye is hidden.
    expect(visibility.get(ids.eyeMaskDrawableId)).toBe(true);
    expect(visibility.get(ids.eyeDrawableId)).toBe(false);
  });

  it("produces different render bytes for Default vs Alt selection", () => {
    const { session, ids } = createVariantPerceptionFixture();

    const defaultPng = renderPerceptionView({
      session,
      payload: renderPayload()
    }).png;
    const altPng = renderPerceptionView({
      session,
      payload: renderPayload({
        variantSelections: [
          {
            kind: "singleSelect",
            variantGroupId: ids.variantGroupId,
            variantId: ids.altVariantId
          }
        ]
      })
    }).png;

    expect(Buffer.from(altPng).equals(Buffer.from(defaultPng))).toBe(false);
  });
});

describe("variant visibility gate — deterministic reject of invalid selections", () => {
  it("rejects an unknown Variant Group reference", () => {
    const { session } = createVariantPerceptionFixture();
    expect(() =>
      renderPerceptionView({
        session,
        payload: renderPayload({
          variantSelections: [
            { kind: "singleSelect", variantGroupId: "vgrp_does_not_exist", variantId: "var_x" }
          ]
        })
      })
    ).toThrowError(VariantSelectionResolutionError);
  });

  it("rejects an unknown Variant id within a known group", () => {
    const { session, ids } = createVariantPerceptionFixture();
    expect(() =>
      renderPerceptionView({
        session,
        payload: renderPayload({
          variantSelections: [
            {
              kind: "singleSelect",
              variantGroupId: ids.variantGroupId,
              variantId: "var_not_a_real_variant"
            }
          ]
        })
      })
    ).toThrowError(VariantSelectionResolutionError);
  });

  it("rejects a mode mismatch (multiToggle selection against a singleSelect group)", () => {
    const { session, ids } = createVariantPerceptionFixture();
    expect(() =>
      renderPerceptionView({
        session,
        payload: renderPayload({
          variantSelections: [
            {
              kind: "multiToggle",
              variantGroupId: ids.variantGroupId,
              variantIds: [ids.defaultVariantId]
            }
          ]
        })
      })
    ).toThrowError(VariantSelectionResolutionError);
  });
});

describe("variant visibility gate — sidecar records the resolved outfit", () => {
  it("records defaultActive when variantSelections is omitted", () => {
    const { session, ids } = createVariantPerceptionFixture();
    const sidecar = renderPerceptionView({ session, payload: renderPayload() }).sidecar({
      packagePath: "/pkg",
      pngPath: "/pkg/out.png"
    });
    expect(sidecar.variantSelections).toEqual([
      {
        kind: "singleSelect",
        variantGroupId: ids.variantGroupId,
        variantId: ids.defaultVariantId
      }
    ]);
  });

  it("records the explicit selection when given", () => {
    const { session, ids } = createVariantPerceptionFixture();
    const sidecar = renderPerceptionView({
      session,
      payload: renderPayload({
        variantSelections: [
          { kind: "singleSelect", variantGroupId: ids.variantGroupId, variantId: ids.altVariantId }
        ]
      })
    }).sidecar({ packagePath: "/pkg", pngPath: "/pkg/out.png" });
    expect(sidecar.variantSelections).toEqual([
      {
        kind: "singleSelect",
        variantGroupId: ids.variantGroupId,
        variantId: ids.altVariantId
      }
    ]);
  });
});

describe("variant visibility gate — measurement carries the gated flag", () => {
  it("returns geometry for a gated-hidden drawable but reports visible=false", () => {
    const { session, ids } = createVariantPerceptionFixture();

    const result = measureEvaluatedGeometry({
      session,
      payload: {
        targets: [
          { kind: "drawable", drawableId: asDrawableId(ids.eyeDrawableId) },
          { kind: "drawable", drawableId: asDrawableId(ids.eyeMaskDrawableId) }
        ],
        parameterOverrides: {},
        includeVertices: false
      }
    });

    const eye = drawableMeasurement(result, ids.eyeDrawableId);
    const eyeMask = drawableMeasurement(result, ids.eyeMaskDrawableId);

    // Default selection: eye visible (and has geometry).
    expect(eye).toEqual({ found: true, visible: true, hasBounds: true });
    // Hidden drawable: geometry still returned, but visible=false (not silenced).
    expect(eyeMask).toEqual({ found: true, visible: false, hasBounds: true });

    // The resolved outfit is echoed on the result.
    expect(result.variantSelections).toEqual([
      {
        kind: "singleSelect",
        variantGroupId: ids.variantGroupId,
        variantId: ids.defaultVariantId
      }
    ]);
  });

  it("records an empty resolved selection for a package with no Variant Groups", () => {
    const { session, ids } = createEmptyParameterPerceptionFixture();

    const result = measureEvaluatedGeometry({
      session,
      payload: {
        targets: [{ kind: "drawable", drawableId: asDrawableId(ids.eyeDrawableId) }],
        parameterOverrides: {},
        includeVertices: false
      }
    });

    expect(result.variantSelections).toEqual([]);
    // No gate → base visibility preserved (true).
    expect(drawableMeasurement(result, ids.eyeDrawableId)?.visible).toBe(true);
  });

  it("rejects an invalid variantSelections deterministically from measurement too", () => {
    const { session } = createVariantPerceptionFixture();
    expect(() =>
      measureEvaluatedGeometry({
        session,
        payload: {
          targets: [{ kind: "drawable", drawableId: asDrawableId("draw_anything") }],
          parameterOverrides: {},
          includeVertices: false,
          variantSelections: [
            { kind: "singleSelect", variantGroupId: "vgrp_missing", variantId: "var_x" }
          ]
        }
      })
    ).toThrowError(VariantSelectionResolutionError);
  });
});
