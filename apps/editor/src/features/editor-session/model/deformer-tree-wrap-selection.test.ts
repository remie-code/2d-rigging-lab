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

import { commitCreateRotationDeformer, commitCreateWarpDeformer } from "./editor-session-commands";
import {
  createDeformerTreeWrapSelectionReadModel,
  createRotationDeformerPayloadForDeformerTreeSelection,
  createWarpDeformerPayloadForDeformerTreeSelection
} from "./deformer-tree-wrap-selection";
import { createWarpDeformerPayloadForUnboundDrawables } from "./rig-tool-state";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const DRAW_FACE = DrawableIdSchema.parse("draw_face");
const DRAW_HAIR = DrawableIdSchema.parse("draw_hair");
const MESH_FACE = MeshIdSchema.parse("mesh_face");
const MESH_HAIR = MeshIdSchema.parse("mesh_hair");
const TEX_FACE = TextureIdSchema.parse("tex_face");
const TEX_HAIR = TextureIdSchema.parse("tex_hair");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_fixture");

describe("deformer tree wrap selection", () => {
  it("creates wrap payloads for a root Deformer plus a Pool Drawable", () => {
    const session = createFixtureSession();
    const rootPayload = createWarpDeformerPayloadForUnboundDrawables(session, [DRAW_FACE]);
    const rootResult = commitCreateWarpDeformer(session, rootPayload!);
    expect(rootResult.committed).toBe(true);
    const selection = {
      kind: "deformerTreeSet" as const,
      targets: [
        {
          kind: "rigControl" as const,
          rigControlId: rootResult.rigControlId!
        },
        {
          kind: "poolDrawable" as const,
          drawableId: DRAW_HAIR
        }
      ]
    };

    const readModel = createDeformerTreeWrapSelectionReadModel(rootResult.session, selection);
    const rotationPayload = createRotationDeformerPayloadForDeformerTreeSelection(
      rootResult.session,
      selection
    );
    const warpPayload = createWarpDeformerPayloadForDeformerTreeSelection(
      rootResult.session,
      selection
    );

    expect(readModel).toMatchObject({
      status: "coherent",
      canCreate: true,
      targets: [
        { displayName: "Face Warp Deformer", detail: "Root Deformer" },
        { displayName: "Hair", detail: "Pool Drawable" }
      ]
    });
    expect(readModel).not.toHaveProperty("parentRigControlId");
    expect(rotationPayload).toMatchObject({
      displayName: "2 Selected Rotation Deformer",
      childDrawableIds: [DRAW_HAIR],
      childRigControlIds: [rootResult.rigControlId!],
      pivot: { x: 44.5, y: 40 },
      wrapChildren: [
        { kind: "rigControl", id: rootResult.rigControlId! },
        { kind: "drawable", id: DRAW_HAIR }
      ]
    });
    expect(rotationPayload).not.toHaveProperty("parentRigControlId");
    expect(warpPayload).toMatchObject({
      displayName: "2 Selected Warp Deformer",
      childDrawableIds: [DRAW_HAIR],
      childRigControlIds: [rootResult.rigControlId!],
      domainBounds: { x: 9, y: 19, width: 72, height: 42 },
      wrapChildren: [
        { kind: "rigControl", id: rootResult.rigControlId! },
        { kind: "drawable", id: DRAW_HAIR }
      ]
    });
    expect(warpPayload).not.toHaveProperty("parentRigControlId");

    const wrapResult = commitCreateRotationDeformer(rootResult.session, rotationPayload!);
    expect(wrapResult.committed).toBe(true);
    expect(wrapResult.session.graph.rigControlRootIds).toEqual([wrapResult.rigControlId]);
    expect(
      wrapResult.session.graph.rigControls.find(
        (candidate) => candidate.rigControlId === wrapResult.rigControlId
      )
    ).toMatchObject({
      childDrawableIds: [DRAW_HAIR],
      childRigControlIds: [rootResult.rigControlId!]
    });
  });

  it("creates a same-parent wrapper payload for a bound Drawable plus a Pool Drawable", () => {
    const session = createFixtureSession();
    const parentResult = commitCreateRotationDeformer(session, {
      displayName: "Parent Rotation",
      childDrawableIds: [DRAW_FACE],
      childRigControlIds: [],
      opacityMultiplier: 1,
      pivot: { x: 25, y: 40 },
      restAngleDegrees: 0
    });
    expect(parentResult.committed).toBe(true);
    const selection = {
      kind: "deformerTreeSet" as const,
      targets: [
        {
          kind: "boundDrawable" as const,
          drawableId: DRAW_FACE,
          parentRigControlId: parentResult.rigControlId!
        },
        {
          kind: "poolDrawable" as const,
          drawableId: DRAW_HAIR
        }
      ]
    };

    const readModel = createDeformerTreeWrapSelectionReadModel(parentResult.session, selection);
    const payload = createWarpDeformerPayloadForDeformerTreeSelection(
      parentResult.session,
      selection
    );

    expect(readModel).toMatchObject({
      status: "coherent",
      canCreate: true,
      parentRigControlId: parentResult.rigControlId!,
      targets: [
        { displayName: "Face", detail: "Bound Drawable" },
        { displayName: "Hair", detail: "Pool Drawable" }
      ]
    });
    expect(payload).toMatchObject({
      parentRigControlId: parentResult.rigControlId!,
      childDrawableIds: [DRAW_FACE, DRAW_HAIR],
      childRigControlIds: [],
      domainBounds: { x: 9, y: 19, width: 72, height: 42 },
      wrapChildren: [
        { kind: "drawable", id: DRAW_FACE },
        { kind: "drawable", id: DRAW_HAIR }
      ]
    });

    const wrapResult = commitCreateWarpDeformer(parentResult.session, payload!);
    expect(wrapResult.committed).toBe(true);
    expect(
      wrapResult.session.graph.rigControls.find(
        (candidate) => candidate.rigControlId === parentResult.rigControlId
      )
    ).toMatchObject({
      childDrawableIds: [],
      childRigControlIds: [wrapResult.rigControlId!]
    });
    expect(
      wrapResult.session.graph.rigControls.find(
        (candidate) => candidate.rigControlId === wrapResult.rigControlId
      )
    ).toMatchObject({
      parentId: parentResult.rigControlId!,
      childDrawableIds: [DRAW_FACE, DRAW_HAIR],
      childRigControlIds: []
    });
  });

  it("marks mixed-parent Deformer Tree selections incoherent and omits create payloads", () => {
    const session = createFixtureSession();
    const faceParentResult = commitCreateRotationDeformer(session, {
      displayName: "Face Parent",
      childDrawableIds: [DRAW_FACE],
      childRigControlIds: [],
      opacityMultiplier: 1,
      pivot: { x: 25, y: 40 },
      restAngleDegrees: 0
    });
    expect(faceParentResult.committed).toBe(true);
    const hairParentResult = commitCreateRotationDeformer(faceParentResult.session, {
      displayName: "Hair Parent",
      childDrawableIds: [DRAW_HAIR],
      childRigControlIds: [],
      opacityMultiplier: 1,
      pivot: { x: 65, y: 40 },
      restAngleDegrees: 0
    });
    expect(hairParentResult.committed).toBe(true);
    const selection = {
      kind: "deformerTreeSet" as const,
      targets: [
        {
          kind: "boundDrawable" as const,
          drawableId: DRAW_FACE,
          parentRigControlId: faceParentResult.rigControlId!
        },
        {
          kind: "boundDrawable" as const,
          drawableId: DRAW_HAIR,
          parentRigControlId: hairParentResult.rigControlId!
        }
      ]
    };

    const readModel = createDeformerTreeWrapSelectionReadModel(hairParentResult.session, selection);

    expect(readModel).toMatchObject({
      status: "incoherent",
      canCreate: false,
      warning: "Selected existing children must share one immediate parent Deformer."
    });
    expect(
      createRotationDeformerPayloadForDeformerTreeSelection(hairParentResult.session, selection)
    ).toBeUndefined();
    expect(
      createWarpDeformerPayloadForDeformerTreeSelection(hairParentResult.session, selection)
    ).toBeUndefined();
  });
});

function createFixtureSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_deformer_tree_wrap_selection_fixture"),
      packageDisplayName: "Deformer Tree Wrap Selection Fixture",
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
          drawableIds: [DRAW_FACE, DRAW_HAIR],
          children: [
            { kind: "drawable", drawableId: DRAW_FACE },
            { kind: "drawable", drawableId: DRAW_HAIR }
          ]
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
        },
        {
          drawableId: DRAW_HAIR,
          displayName: "Hair",
          partId: PART_FACE,
          sourceAssetId: SOURCE_ASSET,
          textureId: TEX_HAIR,
          meshId: MESH_HAIR,
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 1,
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
        },
        {
          meshId: MESH_HAIR,
          drawableId: DRAW_HAIR,
          vertices: [
            { x: 50, y: 20 },
            { x: 80, y: 20 },
            { x: 80, y: 60 },
            { x: 50, y: 60 }
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
          vertexStableIds: ["vtx_hair_0", "vtx_hair_1", "vtx_hair_2", "vtx_hair_3"],
          bounds: { x: 50, y: 20, width: 30, height: 40 },
          generationProvenanceId: PROVENANCE
        }
      ],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [
        { drawableId: DRAW_FACE, baseDrawOrder: 0, stableOrder: 0 },
        { drawableId: DRAW_HAIR, baseDrawOrder: 1, stableOrder: 1 }
      ],
      rigControlRootIds: [],
      stableOrder: [PART_ROOT, PART_FACE, DRAW_FACE, DRAW_HAIR],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}
