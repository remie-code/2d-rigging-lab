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
  CommittedRotationDeformerInspector,
  CommittedWarpDeformerInspector,
  DeformerTreeWrapTargetStart,
  RigBatchTargetStart,
  createRotationUpdatePayload,
  createWarpUpdatePayload
} from "./rig-tool-inspector";
import type { DeformerTreeWrapSelectionReadModel } from "../../features/editor-session/model/deformer-tree-wrap-selection";
import type {
  RotationDeformerReadModel,
  WarpDeformerReadModel
} from "../../features/editor-session/model/rig-tool-state";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const DRAW_FACE = DrawableIdSchema.parse("draw_face");
const DRAW_HAIR = DrawableIdSchema.parse("draw_hair");
const MESH_FACE = MeshIdSchema.parse("mesh_face");
const TEX_FACE = TextureIdSchema.parse("tex_face");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_fixture");
const RIG_FACE_WARP = RigControlIdSchema.parse("rig_face_warp");
const RIG_FACE_ROTATION = RigControlIdSchema.parse("rig_face_rotation");

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
    expect(inputMarkup(markup, "Bezier edit type")).toContain("readOnly");
    expect(markup).not.toContain('aria-label="Opacity multiplier"');

    const payload = createWarpUpdatePayload(
      readModel,
      {
        displayName: "Face Warp Edited",
        parentRigControlId: "",
        domainBounds: structuredClone(readModel.domainBounds),
        transformColumns: 8,
        transformRows: 7,
        bezierColumns: 6,
        bezierRows: 5
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

describe("RigToolInspector committed Rotation Deformer", () => {
  it("renders compact editable setup fields and omits duplicate summaries and opacity section", () => {
    const readModel = createRotationReadModel(true);
    const markup = renderToStaticMarkup(
      createElement(CommittedRotationDeformerInspector, {
        feedback: null,
        onCreateParentRotation: () => undefined,
        onCreateParentWarp: () => undefined,
        onReparent: () => undefined,
        onUpdate: () => undefined,
        readModel,
        session: createFixtureSession()
      })
    );

    expect(hasDisabledAttribute(inputMarkup(markup, "Rotation pivot x"))).toBe(false);
    expect(hasDisabledAttribute(inputMarkup(markup, "Rotation pivot y"))).toBe(false);
    expect(hasDisabledAttribute(inputMarkup(markup, "Rotation rest translation x"))).toBe(false);
    expect(hasDisabledAttribute(inputMarkup(markup, "Rotation rest translation y"))).toBe(false);
    expect(hasDisabledAttribute(inputMarkup(markup, "Rotation rest angle degrees"))).toBe(false);
    expect(markup).toContain("Setup transform");
    expect(markup).not.toContain("Bound children");
    expect(markup).not.toContain("Angle keyforms");
    expect(markup).not.toContain("Rotation keyforms present");
    expect(markup).not.toContain("Rest angle is fallback");
    expect(markup).not.toContain('aria-label="Opacity multiplier"');

    const payload = createRotationUpdatePayload(readModel, {
      displayName: "Face Rotation Edited",
      parentRigControlId: "",
      pivot: { x: 12, y: 34 },
      restTranslation: { x: 7, y: -4 },
      restAngleDegrees: -25
    });

    expect(payload).toEqual({
      rigControlId: RIG_FACE_ROTATION,
      displayName: "Face Rotation Edited",
      pivot: { x: 12, y: 34 },
      restTranslation: { x: 7, y: -4 },
      restAngleDegrees: -25
    });
  });
});

describe("RigToolInspector batch Drawable target start", () => {
  it("shows selected Drawable names and warns for already-bound selections", () => {
    const markup = renderToStaticMarkup(
      createElement(RigBatchTargetStart, {
        onCreateRotation: () => undefined,
        onCreateWarp: () => undefined,
        targets: [
          {
            drawableId: DRAW_FACE,
            displayName: "Face",
            bounds: { x: 10, y: 20, width: 30, height: 40 },
            status: "alreadyBound",
            boundRigControlId: RIG_FACE_WARP
          },
          {
            drawableId: DRAW_HAIR,
            displayName: "Hair",
            bounds: { x: 50, y: 20, width: 30, height: 40 },
            status: "eligible"
          }
        ]
      })
    );

    expect(markup).toContain("Target Drawables");
    expect(markup).toContain("Face");
    expect(markup).toContain("Hair");
    expect(markup).toContain("Already-bound Drawables are excluded");
    expect(markup).toContain('data-testid="rig-tool-bound-drawable-warning"');
    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Rotation Deformer"))).toBe(false);
    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Warp Deformer"))).toBe(false);
    expect(markup).not.toContain("Wrap");
  });

  it("disables create actions when every selected Drawable is already bound", () => {
    const markup = renderToStaticMarkup(
      createElement(RigBatchTargetStart, {
        onCreateRotation: () => undefined,
        onCreateWarp: () => undefined,
        targets: [
          {
            drawableId: DRAW_FACE,
            displayName: "Face",
            bounds: { x: 10, y: 20, width: 30, height: 40 },
            status: "alreadyBound",
            boundRigControlId: RIG_FACE_WARP
          }
        ]
      })
    );

    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Rotation Deformer"))).toBe(true);
    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Warp Deformer"))).toBe(true);
    expect(markup).not.toContain("Wrap");
  });
});

describe("RigToolInspector Deformer Tree wrap target start", () => {
  it("shows selected Deformer Tree target names with enabled create actions", () => {
    const markup = renderToStaticMarkup(
      createElement(DeformerTreeWrapTargetStart, {
        feedback: null,
        onCreateRotation: () => undefined,
        onCreateWarp: () => undefined,
        readModel: createCoherentWrapReadModel()
      })
    );

    expect(markup).toContain("Target Selection");
    expect(markup).toContain("Face Warp");
    expect(markup).toContain("Hair");
    expect(markup).toContain("Root Deformer");
    expect(markup).toContain("Pool Drawable");
    expect(markup).not.toContain('data-testid="rig-tool-wrap-selection-warning"');
    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Rotation Deformer"))).toBe(false);
    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Warp Deformer"))).toBe(false);
  });

  it("disables create actions and shows a warning for incoherent selections", () => {
    const markup = renderToStaticMarkup(
      createElement(DeformerTreeWrapTargetStart, {
        feedback: null,
        onCreateRotation: () => undefined,
        onCreateWarp: () => undefined,
        readModel: {
          ...createCoherentWrapReadModel(),
          status: "incoherent",
          canCreate: false,
          warning: "Selection includes a Deformer and one of its descendants. Select direct siblings instead.",
          wrapChildren: []
        }
      })
    );

    expect(markup).toContain('data-testid="rig-tool-wrap-selection-warning"');
    expect(markup).toContain("Select direct siblings instead");
    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Rotation Deformer"))).toBe(true);
    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Warp Deformer"))).toBe(true);
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

function buttonMarkup(markup: string, buttonText: string): string {
  const escapedText = buttonText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markup.match(new RegExp(`<button[^>]*>[\\s\\S]*?${escapedText}[\\s\\S]*?</button>`));
  if (match === null) {
    throw new Error(`Expected button with text ${buttonText}.`);
  }

  return match[0];
}

function hasDisabledAttribute(markup: string): boolean {
  return /\sdisabled(?:=""|(?=[\s/>]))/.test(markup);
}

function createCoherentWrapReadModel(): DeformerTreeWrapSelectionReadModel {
  return {
    status: "coherent",
    canCreate: true,
    targets: [
      {
        kind: "rigControl",
        source: "rigControl",
        id: RIG_FACE_WARP,
        displayName: "Face Warp",
        detail: "Root Deformer",
        status: "included"
      },
      {
        kind: "drawable",
        source: "poolDrawable",
        id: DRAW_HAIR,
        displayName: "Hair",
        detail: "Pool Drawable",
        status: "included"
      }
    ],
    warning: null,
    wrapChildren: [
      { kind: "rigControl", id: RIG_FACE_WARP },
      { kind: "drawable", id: DRAW_HAIR }
    ],
    bounds: { x: 10, y: 20, width: 70, height: 40 },
    warpDomainBounds: { x: 9, y: 19, width: 72, height: 42 }
  };
}

function createWarpReadModel(hasKeyforms: boolean): WarpDeformerReadModel {
  return {
    kind: "warpDeformer",
    storageKind: "warpLattice2d",
    rigControlId: RIG_FACE_WARP,
    displayName: "Face Warp",
    childDrawableIds: [DRAW_FACE],
    childRigControlIds: [],
    opacityMultiplier: 1,
    hasKeyforms,
    keyformSetCount: hasKeyforms ? 1 : 0,
    keyformKeyCount: hasKeyforms ? 3 : 0,
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

function createRotationReadModel(hasKeyforms: boolean): RotationDeformerReadModel {
  return {
    kind: "rotationDeformer",
    storageKind: "rotation2d",
    rigControlId: RIG_FACE_ROTATION,
    displayName: "Face Rotation",
    childDrawableIds: [DRAW_FACE],
    childRigControlIds: [],
    opacityMultiplier: 1,
    hasKeyforms,
    keyformSetCount: hasKeyforms ? 1 : 0,
    keyformKeyCount: hasKeyforms ? 3 : 0,
    pivot: { x: 16, y: 24 },
    restTranslation: { x: 1, y: -2 },
    restAngleDegrees: 10
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
