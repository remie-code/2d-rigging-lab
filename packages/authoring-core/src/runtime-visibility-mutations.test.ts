import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { AuthoringMutationError } from "./authoring-mutations.js";
import { setDrawableRuntimeVisibility } from "./runtime-visibility-mutations.js";
import { toRuntimeGraph } from "./to-runtime-graph.js";

describe("runtime visibility authoring mutations", () => {
  it("updates drawable runtime visibility and runtime graph projection", () => {
    const session = createFixtureSession();

    const result = setDrawableRuntimeVisibility(session, {
      drawableId: DrawableIdSchema.parse("draw_body"),
      runtimeVisibility: false
    });

    expect(result.drawableBefore.runtimeVisibility).toBe(true);
    expect(result.drawableAfter.runtimeVisibility).toBe(false);
    expect(session.graph.drawables[0]?.runtimeVisibility).toBe(false);
    expect(session.authoringRevision).toBe(1);

    const runtimeGraph = toRuntimeGraph(session);
    expect(runtimeGraph.drawables.get(DrawableIdSchema.parse("draw_body"))).toMatchObject({
      visible: false
    });
  });

  it("rejects no-op visibility updates without mutating revision", () => {
    const session = createFixtureSession();

    expect(() =>
      setDrawableRuntimeVisibility(session, {
        drawableId: DrawableIdSchema.parse("draw_body"),
        runtimeVisibility: true
      })
    ).toThrow(
      expect.objectContaining({
        code: "no_op_runtime_visibility_update"
      }) as AuthoringMutationError
    );
    expect(session.graph.drawables[0]?.runtimeVisibility).toBe(true);
    expect(session.authoringRevision).toBe(0);
  });
});

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_runtime_visibility_mutation_test"),
    packageDisplayName: "Runtime Visibility Mutation Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 128, height: 128 },
    parts: [
      {
        partId: PartIdSchema.parse("part_root"),
        displayName: "Root",
        childPartIds: [],
        drawableIds: [DrawableIdSchema.parse("draw_body")]
      }
    ],
    drawables: [
      {
        drawableId: DrawableIdSchema.parse("draw_body"),
        displayName: "Body",
        partId: PartIdSchema.parse("part_root"),
        sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
        textureId: TextureIdSchema.parse("tex_body"),
        meshId: MeshIdSchema.parse("mesh_body"),
        defaultOpacity: 1,
        runtimeVisibility: true,
        baseDrawOrder: 0,
        sourceProvenanceId: ProvenanceIdSchema.parse("prov_body")
      }
    ],
    meshes: [
      {
        meshId: MeshIdSchema.parse("mesh_body"),
        drawableId: DrawableIdSchema.parse("draw_body"),
        vertices: [],
        uvs: [],
        triangles: [],
        vertexStableIds: [],
        bounds: { x: 0, y: 0, width: 16, height: 16 },
        generationProvenanceId: ProvenanceIdSchema.parse("prov_body")
      }
    ],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [
      {
        drawableId: DrawableIdSchema.parse("draw_body"),
        baseDrawOrder: 0,
        stableOrder: 0
      }
    ],
    rigControlRootIds: [],
    stableOrder: ["draw_body"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});
