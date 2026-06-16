import { describe, expect, it } from "vitest";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { DrawableIdSchema, MeshIdSchema, PartIdSchema } from "@private-2d-rigging-lab/contracts";

import * as meshToolState from "./mesh-tool-state";

import {
  DEFAULT_MESH_GENERATION_METHOD,
  MESH_GENERATION_PRESETS,
  createMeshDrawableBatchTargets,
  createMeshPreviewProvenanceId
} from "./mesh-tool-state";

const DRAW_EMPTY = DrawableIdSchema.parse("draw_empty");
const DRAW_GENERATED = DrawableIdSchema.parse("draw_generated");
const DRAW_MISSING_MESH = DrawableIdSchema.parse("draw_missing_mesh");
const MESH_EMPTY = MeshIdSchema.parse("mesh_empty");
const MESH_GENERATED = MeshIdSchema.parse("mesh_generated");
const MESH_MISSING = MeshIdSchema.parse("mesh_missing");
const PART_ROOT = PartIdSchema.parse("part_root");

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

  it("marks empty scaffold and missing meshes eligible while excluding generated meshes", () => {
    const targets = createMeshDrawableBatchTargets(createBatchEligibilityFixture(), [
      DRAW_EMPTY,
      DRAW_GENERATED,
      DRAW_MISSING_MESH
    ]);

    expect(targets.map((target) => [
      target.drawableId,
      target.meshStatus.status,
      target.eligible,
      target.exclusionReason
    ])).toEqual([
      [DRAW_EMPTY, "empty", true, undefined],
      [DRAW_GENERATED, "generated", false, "existingGeneratedMesh"],
      [DRAW_MISSING_MESH, "pending", true, undefined]
    ]);
  });
});

function createBatchEligibilityFixture(): AuthoringSession {
  return {
    graph: {
      parts: [
        {
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [],
          drawableIds: [DRAW_EMPTY, DRAW_GENERATED, DRAW_MISSING_MESH]
        }
      ],
      drawables: [
        createDrawable(DRAW_EMPTY, MESH_EMPTY, "Empty"),
        createDrawable(DRAW_GENERATED, MESH_GENERATED, "Generated"),
        createDrawable(DRAW_MISSING_MESH, MESH_MISSING, "Missing Mesh")
      ],
      meshes: [
        {
          meshId: MESH_EMPTY,
          drawableId: DRAW_EMPTY,
          vertices: [],
          uvs: [],
          triangles: [],
          vertexStableIds: [],
          bounds: { x: 0, y: 0, width: 10, height: 10 },
          generationProvenanceId: "prov_empty"
        },
        {
          meshId: MESH_GENERATED,
          drawableId: DRAW_GENERATED,
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
          triangles: [[0, 1, 2]],
          vertexStableIds: ["vtx_0", "vtx_1", "vtx_2"],
          bounds: { x: 0, y: 0, width: 10, height: 10 },
          generationProvenanceId: "prov_generated"
        }
      ]
    }
  } as AuthoringSession;
}

function createDrawable(
  drawableId: typeof DRAW_EMPTY,
  meshId: typeof MESH_EMPTY,
  displayName: string
) {
  return {
    drawableId,
    displayName,
    partId: PART_ROOT,
    sourceAssetId: "src_mesh_batch",
    textureId: "tex_mesh_batch",
    meshId,
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: 0,
    sourceProvenanceId: "prov_mesh_batch"
  };
}
