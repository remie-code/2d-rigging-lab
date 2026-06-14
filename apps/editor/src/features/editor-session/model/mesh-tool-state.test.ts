import { describe, expect, it } from "vitest";
import { DrawableIdSchema } from "@private-2d-rigging-lab/contracts";

import * as meshToolState from "./mesh-tool-state";

import {
  DEFAULT_MESH_GENERATION_METHOD,
  MESH_GENERATION_PRESETS,
  createMeshPreviewProvenanceId
} from "./mesh-tool-state";

describe("mesh tool state", () => {
  it("routes normal mesh preview defaults to the adaptive contour-constrainautor method", () => {
    const drawableId = DrawableIdSchema.parse("draw_face");

    expect(DEFAULT_MESH_GENERATION_METHOD).toBe(
      "auto-outline-v6d-adaptive-contour-constrainautor"
    );
    expect(createMeshPreviewProvenanceId(drawableId, "standard")).toBe(
      "prov_mesh_preview_face_standard"
    );
    expect(
      createMeshPreviewProvenanceId(
        drawableId,
        "standard",
        "auto-outline-v6d-contour-constrainautor"
      )
    ).toBe("prov_mesh_preview_face_standard_auto-outline-v6d-contour-constrainautor");
  });

  it("keeps product-facing mesh presets as the visible control dimension", () => {
    expect(MESH_GENERATION_PRESETS.map((preset) => preset.id)).toEqual([
      "largeMotion",
      "standard",
      "lowMotion"
    ]);
  });

  it("does not expose backend candidates as Mesh Tool selector options", () => {
    expect("MESH_GENERATION_BACKEND_OPTIONS" in meshToolState).toBe(false);
    expect("DEFAULT_MESH_GENERATION_BACKEND_OPTION_ID" in meshToolState).toBe(false);
    expect("parseMeshGenerationBackendOptionId" in meshToolState).toBe(false);
  });
});
