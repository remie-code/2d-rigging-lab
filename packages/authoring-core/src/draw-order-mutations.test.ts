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
import { setDrawableDrawOrders } from "./draw-order-mutations.js";
import { toRuntimeGraph } from "./to-runtime-graph.js";

describe("draw order authoring mutations", () => {
  it("updates drawable base order and normalized draw order entries together", () => {
    const session = createFixtureSession();

    const result = setDrawableDrawOrders(session, [
      { drawableId: DrawableIdSchema.parse("draw_back"), baseDrawOrder: 20 }
    ]);

    expect(result.drawableChanges).toEqual([
      {
        before: expect.objectContaining({
          drawableId: "draw_back",
          baseDrawOrder: 0
        }),
        after: expect.objectContaining({
          drawableId: "draw_back",
          baseDrawOrder: 1
        })
      },
      {
        before: expect.objectContaining({
          drawableId: "draw_front",
          baseDrawOrder: 1
        }),
        after: expect.objectContaining({
          drawableId: "draw_front",
          baseDrawOrder: 0
        })
      }
    ]);
    expect(session.graph.drawables.map((drawable) => [drawable.drawableId, drawable.baseDrawOrder])).toEqual([
      ["draw_back", 1],
      ["draw_front", 0]
    ]);
    expect(session.graph.drawOrder).toEqual([
      {
        drawableId: "draw_front",
        baseDrawOrder: 0,
        stableOrder: 0
      },
      {
        drawableId: "draw_back",
        baseDrawOrder: 1,
        stableOrder: 1
      }
    ]);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);

    const runtimeGraph = toRuntimeGraph(session);
    expect(runtimeGraph.drawOrder).toEqual([
      { drawableId: "draw_front", drawOrder: 0 },
      { drawableId: "draw_back", drawOrder: 1 }
    ]);
  });

  it("rejects duplicate payload entries without mutating graph order", () => {
    const session = createFixtureSession();

    expect(() =>
      setDrawableDrawOrders(session, [
        { drawableId: DrawableIdSchema.parse("draw_back"), baseDrawOrder: 4 },
        { drawableId: DrawableIdSchema.parse("draw_back"), baseDrawOrder: 6 }
      ])
    ).toThrow(
      expect.objectContaining({
        code: "duplicate_draw_order_entry"
      }) as AuthoringMutationError
    );
    expect(session.graph.drawables[0]?.baseDrawOrder).toBe(0);
    expect(session.graph.drawOrder[0]).toMatchObject({ baseDrawOrder: 0, stableOrder: 0 });
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects no-op draw order updates without changing authoring revision", () => {
    const session = createFixtureSession();

    expect(() =>
      setDrawableDrawOrders(session, [
        { drawableId: DrawableIdSchema.parse("draw_back"), baseDrawOrder: 0 }
      ])
    ).toThrow(
      expect.objectContaining({
        code: "no_op_draw_order_update"
      }) as AuthoringMutationError
    );
    expect(session.graph.drawOrder[0]).toMatchObject({ baseDrawOrder: 0, stableOrder: 0 });
    expect(session.authoringRevision).toBe(0);
  });

  it("repairs a drawable and draw order entry base order mismatch", () => {
    const session = createFixtureSession();
    session.graph.drawables[0]!.baseDrawOrder = 12;

    setDrawableDrawOrders(session, [
      { drawableId: DrawableIdSchema.parse("draw_back"), baseDrawOrder: 0 }
    ]);

    expect(session.graph.drawables[0]).toMatchObject({
      drawableId: "draw_back",
      baseDrawOrder: 0
    });
    expect(session.graph.drawOrder[0]).toMatchObject({
      drawableId: "draw_back",
      baseDrawOrder: 0,
      stableOrder: 0
    });
    expect(session.authoringRevision).toBe(1);
  });
});

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_draw_order_mutation_test"),
    packageDisplayName: "Draw Order Mutation Test",
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
        drawableIds: [DrawableIdSchema.parse("draw_back"), DrawableIdSchema.parse("draw_front")],
        children: [
          {
            kind: "drawable",
            drawableId: DrawableIdSchema.parse("draw_back")
          },
          {
            kind: "drawable",
            drawableId: DrawableIdSchema.parse("draw_front")
          }
        ]
      }
    ],
    drawables: [
      createFixtureDrawable("draw_back", "mesh_back", "Back", 0),
      createFixtureDrawable("draw_front", "mesh_front", "Front", 1)
    ],
    meshes: [
      createFixtureMesh("mesh_back", "draw_back", { x: 0, y: 0, width: 16, height: 16 }),
      createFixtureMesh("mesh_front", "draw_front", { x: 16, y: 16, width: 16, height: 16 })
    ],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [
      {
        drawableId: DrawableIdSchema.parse("draw_back"),
        baseDrawOrder: 0,
        stableOrder: 0
      },
      {
        drawableId: DrawableIdSchema.parse("draw_front"),
        baseDrawOrder: 1,
        stableOrder: 1
      }
    ],
    rigControlRootIds: [],
    stableOrder: ["draw_back", "draw_front"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createFixtureDrawable = (
  drawableId: string,
  meshId: string,
  displayName: string,
  baseDrawOrder: number
) => ({
  drawableId: DrawableIdSchema.parse(drawableId),
  displayName,
  partId: PartIdSchema.parse("part_root"),
  sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
  textureId: TextureIdSchema.parse(`tex_${drawableId.replace(/^draw_/, "")}`),
  meshId: MeshIdSchema.parse(meshId),
  defaultOpacity: 1,
  runtimeVisibility: true,
  baseDrawOrder,
  sourceProvenanceId: ProvenanceIdSchema.parse(`prov_${drawableId.replace(/^draw_/, "")}`)
});

const createFixtureMesh = (
  meshId: string,
  drawableId: string,
  bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
) => ({
  meshId: MeshIdSchema.parse(meshId),
  drawableId: DrawableIdSchema.parse(drawableId),
  vertices: [],
  uvs: [],
  triangles: [],
  vertexStableIds: [],
  bounds,
  generationProvenanceId: ProvenanceIdSchema.parse(`prov_${drawableId.replace(/^draw_/, "")}`)
});
