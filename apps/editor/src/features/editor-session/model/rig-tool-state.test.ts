import { createInitialAuthoringRevision, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
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

import { commitCreateWarpDeformer } from "./editor-session-commands";
import {
  createDeformerTreeRows,
  createWarpDeformerDraftForDrawable,
  createWarpDeformerPayloadFromDraft
} from "./rig-tool-state";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const DRAW_FACE = DrawableIdSchema.parse("draw_face");
const MESH_FACE = MeshIdSchema.parse("mesh_face");
const TEX_FACE = TextureIdSchema.parse("tex_face");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_fixture");

describe("rig tool state", () => {
  it("creates a Warp Deformer draft from a Drawable and projects the committed Deformer Tree", () => {
    const session = createFixtureSession();
    const draft = createWarpDeformerDraftForDrawable(session, DRAW_FACE);

    expect(draft).toMatchObject({
      displayName: "Face Warp Deformer",
      partId: PART_FACE,
      childDrawableIds: [DRAW_FACE],
      domainBounds: { x: 10, y: 20, width: 30, height: 40 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });

    const payload = createWarpDeformerPayloadFromDraft(draft!);
    const result = commitCreateWarpDeformer(session, payload);

    expect(result.committed).toBe(true);
    expect(session.graph.rigControls).toHaveLength(0);
    expect(result.rigControlId).toBeDefined();

    const rows = createDeformerTreeRows(result.session, {
      kind: "rigControl",
      id: result.rigControlId!
    });

    expect(rows.map((row) => [row.kind, row.selected])).toEqual([
      ["warpDeformer", true],
      ["drawableRef", false]
    ]);
    expect(rows[0]).toMatchObject({
      kind: "warpDeformer",
      displayName: "Face Warp Deformer",
      childDrawableCount: 1,
      transformLabel: "5 x 5 control points",
      bezierLabel: "3 x 3 control points"
    });
    expect(rows[1]).toMatchObject({
      kind: "drawableRef",
      drawableId: DRAW_FACE,
      displayName: "Face"
    });
  });
});

function createFixtureSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_rig_tool_state_fixture"),
      packageDisplayName: "Rig Tool State Fixture",
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
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [PART_FACE],
          drawableIds: [],
          children: [{ kind: "part", partId: PART_FACE }]
        },
        {
          partId: PART_FACE,
          displayName: "Face Part",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_FACE],
          children: [{ kind: "drawable", drawableId: DRAW_FACE }]
        }
      ],
      drawables: [
        {
          drawableId: DRAW_FACE,
          displayName: "Face",
          partId: PART_FACE,
          sourceAssetId: SOURCE_ASSET,
          textureId: TEX_FACE,
          meshId: MESH_FACE,
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: PROVENANCE
        }
      ],
      meshes: [
        {
          meshId: MESH_FACE,
          drawableId: DRAW_FACE,
          vertices: [
            { x: 10, y: 20 },
            { x: 40, y: 20 },
            { x: 40, y: 60 },
            { x: 10, y: 60 }
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
          ],
          vertexStableIds: ["vtx_0", "vtx_1", "vtx_2", "vtx_3"],
          bounds: { x: 10, y: 20, width: 30, height: 40 },
          generationProvenanceId: PROVENANCE
        }
      ],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [{ drawableId: DRAW_FACE, baseDrawOrder: 0, stableOrder: 0 }],
      rigControlRootIds: [],
      stableOrder: [PART_ROOT, PART_FACE, DRAW_FACE],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}
