import { createInitialAuthoringRevision, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CommittedWarpDeformerInspector,
  createWarpUpdatePayload
} from "./rig-tool-inspector";
import type { WarpDeformerReadModel } from "../../features/editor-session/model/rig-tool-state";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const DRAW_FACE = DrawableIdSchema.parse("draw_face");
const MESH_FACE = MeshIdSchema.parse("mesh_face");
const TEX_FACE = TextureIdSchema.parse("tex_face");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_fixture");
const RIG_FACE_WARP = RigControlIdSchema.parse("rig_face_warp");

describe("RigToolInspector committed Warp Deformer", () => {
  it("disables division fields for keyformed Warp Deformers and omits division updates", () => {
    const readModel = createWarpReadModel(true);
    const markup = renderToStaticMarkup(
      createElement(CommittedWarpDeformerInspector, {
        feedback: null,
        onCreateParentRotation: () => undefined,
        onCreateParentWarp: () => undefined,
        onReparent: () => undefined,
        onUpdate: () => undefined,
        readModel,
        session: createFixtureSession()
      })
    );

    expect(inputMarkup(markup, "Transform columns control points")).toContain("disabled");
    expect(inputMarkup(markup, "Transform rows control points")).toContain("disabled");
    expect(inputMarkup(markup, "Bezier columns")).toContain("disabled");
    expect(inputMarkup(markup, "Bezier rows")).toContain("disabled");

    const payload = createWarpUpdatePayload(
      readModel,
      {
        displayName: "Face Warp Edited",
        parentRigControlId: "",
        domainBounds: structuredClone(readModel.domainBounds),
        transformColumns: 8,
        transformRows: 7,
        bezierColumns: 6,
        bezierRows: 5,
        opacityMultiplier: readModel.opacityMultiplier
      },
      true
    );

    expect(payload).toEqual({
      rigControlId: RIG_FACE_WARP,
      displayName: "Face Warp Edited"
    });
    expect(payload).not.toHaveProperty("transformColumns");
    expect(payload).not.toHaveProperty("transformRows");
    expect(payload).not.toHaveProperty("bezierColumns");
    expect(payload).not.toHaveProperty("bezierRows");
  });
});

function inputMarkup(markup: string, ariaLabel: string): string {
  const escapedLabel = ariaLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markup.match(new RegExp(`<input[^>]*aria-label="${escapedLabel}"[^>]*>`));
  if (match === null) {
    throw new Error(`Expected input with aria-label ${ariaLabel}.`);
  }

  return match[0];
}

function createWarpReadModel(hasKeyforms: boolean): WarpDeformerReadModel {
  return {
    kind: "warpDeformer",
    storageKind: "warpLattice2d",
    rigControlId: RIG_FACE_WARP,
    displayName: "Face Warp",
    partId: PART_FACE,
    childDrawableIds: [DRAW_FACE],
    childRigControlIds: [],
    opacityMultiplier: 1,
    hasKeyforms,
    domainBounds: { x: 10, y: 20, width: 30, height: 40 },
    transformGrid: {
      columns: 5,
      rows: 5,
      pointCountSemantics: "controlPointCount"
    },
    bezierEditSurface: {
      columns: 3,
      rows: 3,
      editType: "cubicBezierSurfaceV1"
    },
    evaluationBoundary: {
      transformEvaluation: "bilinearGridV1",
      bezierEvaluation: "storedNotEvaluatedV0"
    },
    bezierSurfaceStatus: "stored"
  };
}

function createFixtureSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_rig_tool_inspector_fixture"),
      packageDisplayName: "Rig Tool Inspector Fixture",
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
          drawableIds: []
        },
        {
          partId: PART_FACE,
          displayName: "Face Part",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_FACE]
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
          ] as [number, number, number][],
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
