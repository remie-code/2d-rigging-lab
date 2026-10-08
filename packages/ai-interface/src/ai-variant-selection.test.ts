import { describe, expect, it } from "vitest";

import {
  InspectEvaluatedGeometryResultSchema
} from "./ai-measurement-command.js";
import {
  RenderViewPayloadSchema,
  RenderViewSidecarSchema
} from "./ai-render-view-command.js";
import {
  ResolvedVariantSelectionEntrySchema,
  VariantSelectionEntrySchema,
  VariantSelectionsPayloadSchema
} from "./ai-variant-selection.js";

/**
 * Wave105 Domain A — variantSelections contract (pure zod).
 *
 * Verifies the shared shape: the discriminated union by `kind`, the id token
 * patterns, the multiToggle default, and that the perception payloads / sidecar
 * / measurement result carry the optional field with pre-revision compatibility.
 */

describe("VariantSelectionEntrySchema", () => {
  it("accepts a singleSelect entry", () => {
    expect(
      VariantSelectionEntrySchema.parse({
        kind: "singleSelect",
        variantGroupId: "vgrp_outfit",
        variantId: "var_default"
      })
    ).toEqual({ kind: "singleSelect", variantGroupId: "vgrp_outfit", variantId: "var_default" });
  });

  it("accepts a multiToggle entry and defaults variantIds to []", () => {
    expect(
      VariantSelectionEntrySchema.parse({
        kind: "multiToggle",
        variantGroupId: "vgrp_acc"
      })
    ).toEqual({ kind: "multiToggle", variantGroupId: "vgrp_acc", variantIds: [] });
  });

  it("rejects a malformed group id token", () => {
    expect(() =>
      VariantSelectionEntrySchema.parse({
        kind: "singleSelect",
        variantGroupId: "outfit",
        variantId: "var_default"
      })
    ).toThrow();
  });

  it("rejects a malformed variant id token", () => {
    expect(() =>
      VariantSelectionEntrySchema.parse({
        kind: "singleSelect",
        variantGroupId: "vgrp_outfit",
        variantId: "default"
      })
    ).toThrow();
  });

  it("rejects an unknown kind (discriminated union closed)", () => {
    expect(() =>
      VariantSelectionEntrySchema.parse({
        kind: "toggleAll",
        variantGroupId: "vgrp_outfit"
      })
    ).toThrow();
  });
});

describe("VariantSelectionsPayloadSchema", () => {
  it("is optional (undefined stays undefined)", () => {
    expect(VariantSelectionsPayloadSchema.parse(undefined)).toBeUndefined();
  });

  it("accepts an empty array", () => {
    expect(VariantSelectionsPayloadSchema.parse([])).toEqual([]);
  });
});

describe("RenderViewPayloadSchema — variantSelections", () => {
  it("parses without variantSelections (stays undefined)", () => {
    const parsed = RenderViewPayloadSchema.parse({ outDir: "out" });
    expect(parsed.variantSelections).toBeUndefined();
  });

  it("parses an explicit selection", () => {
    const parsed = RenderViewPayloadSchema.parse({
      outDir: "out",
      variantSelections: [
        { kind: "singleSelect", variantGroupId: "vgrp_outfit", variantId: "var_alt" }
      ]
    });
    expect(parsed.variantSelections).toEqual([
      { kind: "singleSelect", variantGroupId: "vgrp_outfit", variantId: "var_alt" }
    ]);
  });
});

describe("RenderViewSidecarSchema — variantSelections", () => {
  const baseSidecar = {
    schemaVersion: "render-view-sidecar-v1",
    packagePath: "/pkg",
    packageId: "pkg_x",
    packageRevision: 1,
    pngPath: "/pkg/out.png",
    parameterOverrides: [],
    resolvedView: {
      stageViewport: { minX: 0, minY: 0, width: 10, height: 10 },
      outputWidth: 10,
      outputHeight: 10,
      pixelsPerStageX: 1,
      pixelsPerStageY: 1
    }
  };

  it("parses a pre-revision sidecar without variantSelections (backward compatible)", () => {
    const parsed = RenderViewSidecarSchema.parse(baseSidecar);
    expect(parsed.variantSelections).toBeUndefined();
  });

  it("records a resolved selection (including an empty array)", () => {
    expect(
      RenderViewSidecarSchema.parse({ ...baseSidecar, variantSelections: [] }).variantSelections
    ).toEqual([]);
    expect(
      RenderViewSidecarSchema.parse({
        ...baseSidecar,
        variantSelections: [
          { kind: "singleSelect", variantGroupId: "vgrp_outfit", variantId: "var_default" }
        ]
      }).variantSelections
    ).toEqual([
      { kind: "singleSelect", variantGroupId: "vgrp_outfit", variantId: "var_default" }
    ]);
  });
});

describe("InspectEvaluatedGeometryResultSchema — variantSelections + visible", () => {
  const baseResult = {
    schemaVersion: "inspect-evaluated-geometry-result-v1",
    packageRevision: 1,
    parameterOverrides: [],
    results: [
      {
        kind: "drawable",
        drawableId: "draw_body",
        found: true,
        visible: false,
        bounds: { x: 0, y: 0, width: 1, height: 1 }
      }
    ]
  };

  it("parses a pre-revision result without variantSelections", () => {
    expect(InspectEvaluatedGeometryResultSchema.parse(baseResult).variantSelections).toBeUndefined();
  });

  it("carries the gated visible flag and the resolved selection", () => {
    const parsed = InspectEvaluatedGeometryResultSchema.parse({
      ...baseResult,
      variantSelections: [
        { kind: "singleSelect", variantGroupId: "vgrp_outfit", variantId: "var_default" }
      ]
    });
    const first = parsed.results[0];
    expect(first?.kind === "drawable" ? first.visible : undefined).toBe(false);
    expect(parsed.variantSelections).toEqual([
      { kind: "singleSelect", variantGroupId: "vgrp_outfit", variantId: "var_default" }
    ]);
  });
});

describe("ResolvedVariantSelectionEntrySchema", () => {
  it("accepts an explicit multiToggle resolved echo", () => {
    expect(
      ResolvedVariantSelectionEntrySchema.parse({
        kind: "multiToggle",
        variantGroupId: "vgrp_acc",
        variantIds: ["var_hat"]
      })
    ).toEqual({ kind: "multiToggle", variantGroupId: "vgrp_acc", variantIds: ["var_hat"] });
  });

  it("requires multiToggle variantIds (no default on the resolved echo — producers always fill it)", () => {
    expect(() =>
      ResolvedVariantSelectionEntrySchema.parse({
        kind: "multiToggle",
        variantGroupId: "vgrp_acc"
      })
    ).toThrow();
  });
});
