import {
  createInitialAuthoringRevision,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  type DrawableId,
  type RectDto,
  type RigControlId,
  type Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createCanvasEvaluatedScene } from "./canvas-evaluation";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const DRAW_FACE = DrawableIdSchema.parse("draw_face");
const DRAW_HIDDEN = DrawableIdSchema.parse("draw_hidden");
const MESH_FACE = MeshIdSchema.parse("mesh_face");
const MESH_HIDDEN = MeshIdSchema.parse("mesh_hidden");
const TEX_FACE = TextureIdSchema.parse("tex_face");
const TEX_HIDDEN = TextureIdSchema.parse("tex_hidden");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_canvas_eval_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_canvas_eval_fixture");
const FACE_ANGLE_X = ParameterIdSchema.parse("param_face_angle_x");
const RIG_FACE_WARP = RigControlIdSchema.parse("rig_face_warp");
const RIG_PARENT_WARP = RigControlIdSchema.parse("rig_parent_warp");
const RIG_CHILD_WARP = RigControlIdSchema.parse("rig_child_warp");
const RIG_FACE_ROTATION = RigControlIdSchema.parse("rig_face_rotation");

describe("canvas evaluation", () => {
  it("evaluates parameter scrub geometry, opacity, and metadata without mutating AuthoringSession", () => {
    const session = createFixtureSession();
    session.graph.rigControls.push(createWarpRigControl(RIG_FACE_WARP, {
      childDrawableIds: [DRAW_FACE]
    }));
    session.graph.rigControlRootIds.push(RIG_FACE_WARP);
    session.graph.keyformSets.push(
      createDrawableOpacityKeyformSet([
        [-30, 1],
        [30, 0.2]
      ]),
      createWarpOffsetsKeyformSet(RIG_FACE_WARP, [
        { value: -30, statePatch: createOffsets(4, 0, 0) },
        { value: 30, statePatch: createOffsets(4, 20, 0) }
      ]),
      createRigNumberKeyformSet(RIG_FACE_WARP, "opacityMultiplier", [
        [-30, 1],
        [30, 0.5]
      ])
    );
    const before = JSON.stringify(session);

    const restScene = createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: -30 }
    });
    // Selection-driven partial evaluation (Perf Wave 2 / plan A): the evaluated rig-control subset
    // only holds a rig control when it (or a preview/draft) is selected. Select the face warp so its
    // evaluated shape is present and numerically identical to the old full-array evaluation.
    const evaluatedScene = createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 30 },
      selection: { kind: "rigControl", id: RIG_FACE_WARP }
    });
    const restFace = requireDrawable(restScene, DRAW_FACE);
    const evaluatedFace = requireDrawable(evaluatedScene, DRAW_FACE);

    expect(evaluatedFace.bounds.x).toBeCloseTo(restFace.bounds.x + 20);
    expect(evaluatedFace.evaluatedMesh.vertices[0]).toEqual({ x: 20, y: 0 });
    expect(evaluatedScene.rigControls).toHaveLength(1);
    expect(evaluatedScene.rigControls[0]).toMatchObject({
      kind: "warp",
      rigControlId: RIG_FACE_WARP,
      domainBounds: { x: 20, y: 0, width: 100, height: 100 },
      evaluatedControlPoints: [
        { x: 20, y: 0 },
        { x: 120, y: 0 },
        { x: 20, y: 100 },
        { x: 120, y: 100 }
      ]
    });
    expect(evaluatedFace.opacity).toBeCloseTo(0.1);
    expect(evaluatedFace.evaluatedMesh.triangles).toEqual([
      [0, 1, 2],
      [0, 2, 3]
    ]);
    expect(evaluatedFace.textureRef).toMatchObject({
      textureId: TEX_FACE,
      binaryAssetId: "bin_face",
      binaryAssetPath: "assets/textures/face.rgba"
    });
    expect(evaluatedFace.drawOrder).toBe(0);
    expect(evaluatedFace.visible).toBe(true);
    expect(requireDrawable(evaluatedScene, DRAW_HIDDEN).visible).toBe(false);
    expect(evaluatedScene.drawables.map((drawable) => drawable.drawableId)).toEqual([
      DRAW_HIDDEN,
      DRAW_FACE
    ]);
    expect(JSON.stringify(session)).toBe(before);
  });

  it("preserves committed empty mesh bounds for imported Drawable rendering", () => {
    const session = createFixtureSession();
    const faceMesh = session.graph.meshes.find((mesh) => mesh.meshId === MESH_FACE);
    if (faceMesh === undefined) {
      throw new Error("Expected fixture mesh.");
    }
    faceMesh.vertices = [];
    faceMesh.uvs = [];
    faceMesh.triangles = [];
    faceMesh.vertexStableIds = [];
    faceMesh.bounds = { x: 4, y: 8, width: 32, height: 24 };

    const face = requireDrawable(createCanvasEvaluatedScene(session), DRAW_FACE);

    expect(face.bounds).toEqual({ x: 4, y: 8, width: 32, height: 24 });
    expect(face.evaluatedMesh).toMatchObject({
      source: "committed",
      sourceMeshId: MESH_FACE,
      vertices: [],
      triangles: [],
      bounds: { x: 4, y: 8, width: 32, height: 24 }
    });
  });

  it("applies parent deformer influence over a child drawable evaluation", () => {
    const session = createFixtureSession();
    session.graph.rigControls.push(
      createWarpRigControl(RIG_PARENT_WARP, {
        childRigControlIds: [RIG_CHILD_WARP]
      }),
      createWarpRigControl(RIG_CHILD_WARP, {
        parentId: RIG_PARENT_WARP,
        childDrawableIds: [DRAW_FACE]
      })
    );
    session.graph.rigControlRootIds.push(RIG_PARENT_WARP);
    session.graph.keyformSets.push(
      createWarpOffsetsKeyformSet(RIG_PARENT_WARP, [
        { value: -30, statePatch: createOffsets(4, 0, 0) },
        { value: 30, statePatch: createOffsets(4, 10, 0) }
      ])
    );

    const scene = createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 30 }
    });
    const face = requireDrawable(scene, DRAW_FACE);

    expect(face.rigControlChainIds).toEqual([RIG_PARENT_WARP, RIG_CHILD_WARP]);
    expect(face.evaluatedMesh.vertices[0]).toEqual({ x: 10, y: 0 });
    expect(face.bounds.x).toBeCloseTo(10);
  });

  it("evaluates child warp in local rest space before parent warp moves the result", () => {
    const session = createFixtureSession();
    const childOffsets = [
      { x: 2, y: 0 },
      { x: 8, y: 0 },
      { x: 4, y: 10 },
      { x: 14, y: 20 }
    ];
    session.graph.rigControls.push(
      createWarpRigControl(RIG_PARENT_WARP, {
        childRigControlIds: [RIG_CHILD_WARP],
        domainBounds: { x: 0, y: 0, width: 150, height: 150 }
      }),
      createWarpRigControl(RIG_CHILD_WARP, {
        parentId: RIG_PARENT_WARP,
        childDrawableIds: [DRAW_FACE]
      })
    );
    session.graph.rigControlRootIds.push(RIG_PARENT_WARP);
    session.graph.keyformSets.push(
      createWarpOffsetsKeyformSet(RIG_PARENT_WARP, [
        { value: -30, statePatch: createOffsets(4, 0, 0) },
        { value: 30, statePatch: createOffsets(4, 200, 30) }
      ]),
      createWarpOffsetsKeyformSet(RIG_CHILD_WARP, [
        { value: -30, statePatch: createOffsets(4, 0, 0) },
        { value: 30, statePatch: childOffsets }
      ])
    );

    // Select the child warp so its evaluated overlay is present in the partial subset. Its evaluated
    // shape must still fold in the parent warp (resolved through the full ancestor chain internally).
    const scene = createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 30 },
      selection: { kind: "rigControl", id: RIG_CHILD_WARP }
    });
    const face = requireDrawable(scene, DRAW_FACE);
    const childOverlay = requireRigControl(scene, RIG_CHILD_WARP);
    if (childOverlay.kind !== "warp") {
      throw new Error("Expected child warp overlay.");
    }

    expect(face.rigControlChainIds).toEqual([RIG_PARENT_WARP, RIG_CHILD_WARP]);
    expect(face.evaluatedMesh.vertices).toEqual([
      { x: 202, y: 30 },
      { x: 308, y: 30 },
      { x: 314, y: 150 },
      { x: 204, y: 140 }
    ]);
    expect(face.bounds).toEqual({ x: 202, y: 30, width: 112, height: 120 });
    expect(childOverlay).toMatchObject({
      kind: "warp",
      rigControlId: RIG_CHILD_WARP,
      domainBounds: { x: 202, y: 30, width: 112, height: 120 },
      controlPointOffsets: childOffsets,
      evaluatedControlPoints: [
        { x: 202, y: 30 },
        { x: 308, y: 30 },
        { x: 204, y: 140 },
        { x: 314, y: 150 }
      ]
    });
    expect(childOverlay.evaluatedControlPoints[0]).toEqual(face.evaluatedMesh.vertices[0]);
    expect(childOverlay.evaluatedControlPoints[1]).toEqual(face.evaluatedMesh.vertices[1]);
    expect(childOverlay.evaluatedControlPoints[2]).toEqual(face.evaluatedMesh.vertices[3]);
    expect(childOverlay.evaluatedControlPoints[3]).toEqual(face.evaluatedMesh.vertices[2]);
  });

  it("keeps a rest-inside vertex bound to the parent warp after child warp moves current outside", () => {
    const vertices = evaluateNestedWarpCanvasVertices({
      baseVertex: { x: 5, y: 5 },
      childOffset: { x: 20, y: 0 },
      childDomainBounds: { x: 5, y: 5, width: 1, height: 1 },
      parentDomainBounds: { x: 0, y: 0, width: 10, height: 10 },
      parentControlPointOffsets: createOffsets(4, 1, 2)
    });

    expect(vertices).toEqual([{ x: 26, y: 7 }]);
  });

  it("keeps a rest-outside vertex outside the parent warp even when child warp moves current inside", () => {
    const vertices = evaluateNestedWarpCanvasVertices({
      baseVertex: { x: 15, y: 5 },
      childOffset: { x: -10, y: 0 },
      childDomainBounds: { x: 15, y: 5, width: 1, height: 1 },
      parentDomainBounds: { x: 0, y: 0, width: 10, height: 10 },
      parentControlPointOffsets: createOffsets(4, 1, 2)
    });

    expect(vertices).toEqual([{ x: 5, y: 5 }]);
  });

  it("samples nonuniform parent warp displacement from rest coordinates instead of current coordinates", () => {
    const vertices = evaluateNestedWarpCanvasVertices({
      baseVertex: { x: 2, y: 5 },
      childOffset: { x: 6, y: 0 },
      childDomainBounds: { x: 2, y: 5, width: 1, height: 1 },
      parentDomainBounds: { x: 0, y: 0, width: 10, height: 10 },
      parentControlPointOffsets: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ]
    });

    expect(vertices).toEqual([{ x: 10, y: 5 }]);
  });

  it("interpolates in-between scrub values and clamps values outside the parameter range", () => {
    const session = createFixtureSession();
    session.graph.rigControls.push(createWarpRigControl(RIG_FACE_WARP, {
      childDrawableIds: [DRAW_FACE]
    }));
    session.graph.rigControlRootIds.push(RIG_FACE_WARP);
    session.graph.keyformSets.push(
      createDrawableOpacityKeyformSet([
        [-30, 1],
        [30, 0.2]
      ]),
      createWarpOffsetsKeyformSet(RIG_FACE_WARP, [
        { value: -30, statePatch: createOffsets(4, 0, 0) },
        { value: 30, statePatch: createOffsets(4, 20, 0) }
      ]),
      createRigNumberKeyformSet(RIG_FACE_WARP, "opacityMultiplier", [
        [-30, 1],
        [30, 0.5]
      ])
    );

    const interpolated = requireDrawable(
      createCanvasEvaluatedScene(session, {
        parameterValues: { [FACE_ANGLE_X]: 0 }
      }),
      DRAW_FACE
    );
    const clamped = requireDrawable(
      createCanvasEvaluatedScene(session, {
        parameterValues: { [FACE_ANGLE_X]: 99 }
      }),
      DRAW_FACE
    );

    expect(interpolated.evaluatedMesh.vertices[0]).toEqual({ x: 10, y: 0 });
    expect(interpolated.bounds).toEqual({ x: 10, y: 0, width: 100, height: 100 });
    expect(interpolated.opacity).toBeCloseTo(0.45);
    expect(clamped.evaluatedMesh.vertices[0]).toEqual({ x: 20, y: 0 });
    expect(clamped.bounds).toEqual({ x: 20, y: 0, width: 100, height: 100 });
    expect(clamped.opacity).toBeCloseTo(0.1);
  });

  it("deforms committed mesh vertices outside source layer bounds when Warp domain includes mesh vertex bounds", () => {
    const session = createFixtureSession();
    const mesh = session.graph.meshes.find((candidate) => candidate.meshId === MESH_FACE);
    if (mesh === undefined) {
      throw new Error("Expected face mesh.");
    }
    mesh.bounds = { x: 0, y: 0, width: 100, height: 100 };
    mesh.vertices = [
      { x: -4, y: 0 },
      { x: 104, y: 0 },
      { x: 104, y: 100 },
      { x: -4, y: 100 }
    ];
    session.graph.rigControls.push(createWarpRigControl(RIG_FACE_WARP, {
      childDrawableIds: [DRAW_FACE],
      domainBounds: { x: -5, y: -1, width: 110, height: 102 }
    }));
    session.graph.rigControlRootIds.push(RIG_FACE_WARP);
    session.graph.keyformSets.push(
      createWarpOffsetsKeyformSet(RIG_FACE_WARP, [
        { value: -30, statePatch: createOffsets(4, 0, 0) },
        { value: 30, statePatch: createOffsets(4, 10, 0) }
      ])
    );

    const face = requireDrawable(createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 30 }
    }), DRAW_FACE);

    expect(mesh.bounds).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(face.evaluatedMesh.vertices[0]).toEqual({ x: 6, y: 0 });
    expect(face.evaluatedMesh.vertices[1]).toEqual({ x: 114, y: 0 });
    expect(face.bounds).toEqual({ x: 6, y: 0, width: 108, height: 100 });
  });

  it("evaluates rotation angle and rotation opacity multiplier keyforms", () => {
    const session = createFixtureSession();
    session.graph.rigControls.push(createRotationRigControl());
    session.graph.rigControlRootIds.push(RIG_FACE_ROTATION);
    session.graph.keyformSets.push(
      createRigNumberKeyformSet(RIG_FACE_ROTATION, "angleDegrees", [
        [-30, 0],
        [30, 90]
      ]),
      createRigNumberKeyformSet(RIG_FACE_ROTATION, "opacityMultiplier", [
        [-30, 1],
        [30, 0.25]
      ])
    );

    const scene = createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 30 }
    });
    const face = requireDrawable(scene, DRAW_FACE);

    expect(face.evaluatedMesh.vertices[1]).toEqual({ x: 100, y: 100 });
    expect(face.evaluatedMesh.vertices[3]).toEqual({ x: 0, y: 0 });
    expect(face.opacity).toBeCloseTo(0.25);
  });

  it("evaluates rotation rest translation, keyed translation, and parent-child composition", () => {
    const restSession = createFixtureSession();
    restSession.graph.rigControls.push(createRotationRigControl({
      restTranslation: { x: 6, y: -4 }
    }));
    restSession.graph.rigControlRootIds.push(RIG_FACE_ROTATION);

    // Select the rotation deformer so its evaluated overlay lands in the partial subset (Perf Wave 2
    // / plan A). Every scene in this test selects RIG_FACE_ROTATION for the same reason.
    const restScene = createCanvasEvaluatedScene(restSession, {
      selection: { kind: "rigControl", id: RIG_FACE_ROTATION }
    });
    const restFace = requireDrawable(restScene, DRAW_FACE);
    const restRigControl = requireRigControl(restScene, RIG_FACE_ROTATION);

    expect(restFace.evaluatedMesh.vertices[0]).toEqual({ x: 6, y: -4 });
    expect(restFace.bounds).toEqual({ x: 6, y: -4, width: 100, height: 100 });
    expect(restRigControl).toMatchObject({
      kind: "rotation",
      translation: { x: 6, y: -4 }
    });

    const keyedSession = createFixtureSession();
    keyedSession.graph.rigControls.push(createRotationRigControl());
    keyedSession.graph.rigControlRootIds.push(RIG_FACE_ROTATION);
    keyedSession.graph.keyformSets.push(createRotationTranslationKeyformSet([
      { value: -30, statePatch: { x: 0, y: 0 } },
      { value: 30, statePatch: { x: 8, y: 5 } }
    ]));

    const keyedScene = createCanvasEvaluatedScene(keyedSession, {
      parameterValues: { [FACE_ANGLE_X]: 30 },
      selection: { kind: "rigControl", id: RIG_FACE_ROTATION }
    });
    expect(requireDrawable(keyedScene, DRAW_FACE).evaluatedMesh.vertices[0]).toEqual({
      x: 8,
      y: 5
    });
    expect(requireRigControl(keyedScene, RIG_FACE_ROTATION)).toMatchObject({
      kind: "rotation",
      translation: { x: 8, y: 5 }
    });

    const midpointScene = createCanvasEvaluatedScene(keyedSession, {
      parameterValues: { [FACE_ANGLE_X]: 0 },
      selection: { kind: "rigControl", id: RIG_FACE_ROTATION }
    });
    expect(requireDrawable(midpointScene, DRAW_FACE).evaluatedMesh.vertices[0]).toEqual({
      x: 4,
      y: 2.5
    });
    expect(requireRigControl(midpointScene, RIG_FACE_ROTATION)).toMatchObject({
      kind: "rotation",
      translation: { x: 4, y: 2.5 }
    });

    const hierarchySession = createFixtureSession();
    hierarchySession.graph.rigControls.push(
      createRotationRigControl({
        rigControlId: RigControlIdSchema.parse("rig_parent_rotation"),
        childDrawableIds: [],
        childRigControlIds: [RIG_FACE_ROTATION],
        restTranslation: { x: 5, y: 0 }
      }),
      createRotationRigControl({
        parentId: RigControlIdSchema.parse("rig_parent_rotation"),
        restTranslation: { x: 2, y: 3 }
      })
    );
    hierarchySession.graph.rigControlRootIds.push(RigControlIdSchema.parse("rig_parent_rotation"));

    const hierarchyFace = requireDrawable(createCanvasEvaluatedScene(hierarchySession), DRAW_FACE);
    expect(hierarchyFace.rigControlChainIds).toEqual([
      RigControlIdSchema.parse("rig_parent_rotation"),
      RIG_FACE_ROTATION
    ]);
    expect(hierarchyFace.evaluatedMesh.vertices[0]).toEqual({ x: 7, y: 3 });
  });

  it("applies rotation rigDraft geometry and opacity multiplier", () => {
    const session = createFixtureSession();

    const scene = createCanvasEvaluatedScene(session, {
      rigDraft: {
        kind: "rotation",
        childDrawableIds: [DRAW_FACE],
        childRigControlIds: [],
        pivot: { x: 50, y: 50 },
        angleDegrees: 90,
        opacityMultiplier: 0.4
      }
    });
    const face = requireDrawable(scene, DRAW_FACE);

    expect(face.evaluatedMesh.vertices[1]).toEqual({ x: 100, y: 100 });
    expect(face.evaluatedMesh.vertices[3]).toEqual({ x: 0, y: 0 });
    expect(face.opacity).toBeCloseTo(0.4);
  });

  it("accepts control point drag preview as evaluation input without mutating AuthoringSession", () => {
    const session = createFixtureSession();
    session.graph.rigControls.push(createWarpRigControl(RIG_FACE_WARP, {
      childDrawableIds: [DRAW_FACE]
    }));
    session.graph.rigControlRootIds.push(RIG_FACE_WARP);
    const before = JSON.stringify(session);

    const baseScene = createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 0 }
    });
    const previewScene = createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 0 },
      controlPointPreview: {
        rigControlId: RIG_FACE_WARP,
        controlPointOffsets: createOffsets(4, 12, -3)
      }
    });

    expect(requireDrawable(baseScene, DRAW_FACE).evaluatedMesh.vertices[0]).toEqual({ x: 0, y: 0 });
    expect(requireDrawable(previewScene, DRAW_FACE).evaluatedMesh.vertices[0]).toEqual({
      x: 12,
      y: -3
    });
    expect(JSON.stringify(session)).toBe(before);
  });

  it("composes additive control point preview over evaluated keyform offsets", () => {
    const session = createFixtureSession();
    session.graph.rigControls.push(createWarpRigControl(RIG_FACE_WARP, {
      childDrawableIds: [DRAW_FACE]
    }));
    session.graph.rigControlRootIds.push(RIG_FACE_WARP);
    session.graph.keyformSets.push(
      createWarpOffsetsKeyformSet(RIG_FACE_WARP, [
        { value: -30, statePatch: createOffsets(4, 0, 0) },
        { value: 30, statePatch: createOffsets(4, 8, 2) }
      ])
    );

    const scene = createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 30 },
      controlPointPreview: {
        rigControlId: RIG_FACE_WARP,
        compositionMode: "additiveDelta",
        controlPointOffsets: createOffsets(4, 3, -1)
      }
    });
    const face = requireDrawable(scene, DRAW_FACE);

    expect(face.evaluatedMesh.vertices[0]).toEqual({ x: 11, y: 1 });
    expect(face.bounds).toEqual({ x: 11, y: 1, width: 100, height: 100 });
  });

  it("accepts meshDraft and rigDraft as evaluation inputs", () => {
    const session = createFixtureSession();
    const draftMesh = {
      ...createMesh(MESH_FACE, DRAW_FACE, 2, 3, 40, 30),
      meshId: MESH_FACE,
      vertexStableIds: ["vtx_draft_0", "vtx_draft_1", "vtx_draft_2", "vtx_draft_3"]
    };

    const scene = createCanvasEvaluatedScene(session, {
      meshDraft: {
        drawableId: DRAW_FACE,
        mesh: draftMesh
      },
      rigDraft: {
        kind: "warp",
        childDrawableIds: [DRAW_FACE],
        childRigControlIds: [],
        domainBounds: { x: 0, y: 0, width: 100, height: 100 },
        transformColumns: 2,
        transformRows: 2,
        controlPointOffsets: createOffsets(4, 5, 0)
      }
    });
    const face = requireDrawable(scene, DRAW_FACE);

    expect(face.evaluatedMesh.source).toBe("draft");
    expect(face.evaluatedMesh.vertices[0]).toEqual({ x: 7, y: 3 });
    expect(face.bounds).toEqual({ x: 7, y: 3, width: 40, height: 30 });
  });

  it("accepts multiple meshDrafts as evaluation inputs", () => {
    const session = createFixtureSession();
    const faceDraft = {
      ...createMesh(MESH_FACE, DRAW_FACE, 2, 3, 40, 30),
      vertexStableIds: ["vtx_face_draft_0", "vtx_face_draft_1", "vtx_face_draft_2", "vtx_face_draft_3"]
    };
    const hiddenDraft = {
      ...createMesh(MESH_HIDDEN, DRAW_HIDDEN, 12, 14, 16, 18),
      vertexStableIds: ["vtx_hidden_draft_0", "vtx_hidden_draft_1", "vtx_hidden_draft_2", "vtx_hidden_draft_3"]
    };

    const scene = createCanvasEvaluatedScene(session, {
      meshDrafts: [
        { drawableId: DRAW_FACE, mesh: faceDraft },
        { drawableId: DRAW_HIDDEN, mesh: hiddenDraft }
      ]
    });

    expect(requireDrawable(scene, DRAW_FACE).evaluatedMesh).toMatchObject({
      source: "draft",
      vertices: faceDraft.vertices
    });
    expect(requireDrawable(scene, DRAW_HIDDEN).evaluatedMesh).toMatchObject({
      source: "draft",
      vertices: hiddenDraft.vertices
    });
  });
});

describe("canvas evaluation — display/save two-layer separation (Perf Wave 2 / Domain G)", () => {
  // Domain G replaced the display-path `normalizeTransformNumber` string round-trip
  // (`Number(value.toFixed(12))`) with a pure numeric snap and removed redundant vertex clones. The
  // core invariant of that change is a two-layer separation:
  //   (save layer) the `session.graph` originals stay byte-identical across evaluation;
  //   (display layer) the evaluated vertices stay within epsilon (1e-9) of the old toFixed output.
  const DISPLAY_EPSILON = 1e-9;

  // A 45-degree rotation forces irrational coordinates, so the toFixed-vs-numeric difference is
  // actually exercised (an integer-only fixture would pass trivially). These are the values the OLD
  // `Number(value.toFixed(12))` normalization produced for the unit square rotated 45deg about
  // (50,50) — the display layer must reproduce them within DISPLAY_EPSILON.
  const OLD_TOFIXED_ROTATED_SQUARE: readonly Vec2Dto[] = [
    { x: 50, y: -20.710678118655 },
    { x: 120.710678118655, y: 50 },
    { x: 50, y: 120.710678118655 },
    { x: -20.710678118655, y: 50 }
  ];

  function expectVerticesWithinEpsilon(
    actual: readonly Vec2Dto[],
    expected: readonly Vec2Dto[]
  ): void {
    expect(actual).toHaveLength(expected.length);
    actual.forEach((vertex, index) => {
      const reference = expected[index];
      if (reference === undefined) {
        throw new Error(`Missing expected vertex at index ${index}.`);
      }
      expect(Math.abs(vertex.x - reference.x)).toBeLessThanOrEqual(DISPLAY_EPSILON);
      expect(Math.abs(vertex.y - reference.y)).toBeLessThanOrEqual(DISPLAY_EPSILON);
    });
  }

  function createRotatedSquareSession(): AuthoringSession {
    const session = createFixtureSession();
    session.graph.rigControls.push(
      createRotationRigControl({ childDrawableIds: [DRAW_FACE] })
    );
    session.graph.rigControlRootIds.push(RIG_FACE_ROTATION);
    session.graph.keyformSets.push(
      createRigNumberKeyformSet(RIG_FACE_ROTATION, "angleDegrees", [
        [-30, 0],
        [30, 45]
      ])
    );
    return session;
  }

  // Display layer: evaluated vertices reproduce the old toFixed output within epsilon on irrational
  // (non-integer) coordinates. This is what proves the toFixed removal preserved display equivalence
  // rather than merely passing because every fixture was integer-valued.
  it("keeps evaluated (display) vertices within 1e-9 of the old toFixed normalization", () => {
    const session = createRotatedSquareSession();

    const face = requireDrawable(
      createCanvasEvaluatedScene(session, { parameterValues: { [FACE_ANGLE_X]: 30 } }),
      DRAW_FACE
    );

    expectVerticesWithinEpsilon(face.evaluatedMesh.vertices, OLD_TOFIXED_ROTATED_SQUARE);
  });

  // Save layer: the `session.graph` originals (meshes, rig controls, everything) are byte-identical
  // before and after an evaluation that produces irrational display coordinates. The evaluated,
  // display-only scene never writes back to the save/export/provenance source of truth, and the
  // clone-reduction pass-throughs never alias — let alone mutate — the originals.
  it("leaves the session.graph save-layer originals byte-identical across evaluation", () => {
    const session = createRotatedSquareSession();
    const before = JSON.stringify(session);

    createCanvasEvaluatedScene(session, { parameterValues: { [FACE_ANGLE_X]: 30 } });

    expect(JSON.stringify(session)).toBe(before);
  });

  // Clone isolation: mutating the evaluated (display) vertices must not reach back into the original
  // mesh. Proves the display boundary still hands out fresh vertex objects even though the redundant
  // extra copies were removed.
  it("isolates evaluated display vertices from the original mesh objects", () => {
    const session = createRotatedSquareSession();
    const originalMesh = session.graph.meshes.find((mesh) => mesh.meshId === MESH_FACE);
    if (originalMesh === undefined) {
      throw new Error("Expected face mesh.");
    }
    const originalFirstVertex = { ...originalMesh.vertices[0] };

    const face = requireDrawable(
      createCanvasEvaluatedScene(session, { parameterValues: { [FACE_ANGLE_X]: 0 } }),
      DRAW_FACE
    );
    const evaluatedFirst = face.evaluatedMesh.vertices[0];
    if (evaluatedFirst === undefined) {
      throw new Error("Expected an evaluated vertex.");
    }
    // The evaluated vertex is a distinct object from the original; mutating it is inert on the source.
    (evaluatedFirst as { x: number }).x = 9999;

    expect(originalMesh.vertices[0]).toEqual(originalFirstVertex);
  });

  // Clone isolation on the deformer-free path (this is the line Domain G actually changed:
  // `cloneMesh` uses `shallowCloneVec2` for `vertices`/`uvs`). An unrigged drawable's evaluated
  // vertices come straight out of `cloneMesh` — `applyRigControlChainToVertices` short-circuits and
  // returns them untouched when the chain is empty — so no deformer transform intervenes to
  // manufacture fresh objects. If `shallowCloneVec2` regressed to `return value;` (aliasing the
  // original), the evaluated vertices would BE the `session.graph.meshes[...]` vertex objects, and
  // this destructive write would corrupt the save-layer original. DRAW_HIDDEN is deformer-free: no
  // rig control binds it in `createRotatedSquareSession` (only DRAW_FACE gets the rotation), so its
  // rig-control chain is empty.
  it("isolates evaluated display vertices for a deformer-free drawable from the original mesh", () => {
    const session = createRotatedSquareSession();
    const hiddenControl = session.graph.rigControls.find(
      (rigControl) =>
        rigControl.childDrawableIds !== undefined &&
        rigControl.childDrawableIds.includes(DRAW_HIDDEN)
    );
    // Guard the fixture premise: DRAW_HIDDEN must remain unrigged (empty deformer chain) for this
    // test to actually step on the `cloneMesh`/`shallowCloneVec2` boundary rather than a deformer.
    expect(hiddenControl).toBeUndefined();

    const originalMesh = session.graph.meshes.find((mesh) => mesh.meshId === MESH_HIDDEN);
    if (originalMesh === undefined) {
      throw new Error("Expected hidden mesh.");
    }
    const originalFirstVertex = { ...originalMesh.vertices[0] };

    const hidden = requireDrawable(
      createCanvasEvaluatedScene(session, { parameterValues: { [FACE_ANGLE_X]: 30 } }),
      DRAW_HIDDEN
    );
    const evaluatedFirst = hidden.evaluatedMesh.vertices[0];
    if (evaluatedFirst === undefined) {
      throw new Error("Expected an evaluated vertex.");
    }
    // With no deformer to interpose fresh objects, this only stays inert if `cloneMesh` handed out a
    // shallow copy rather than aliasing the original mesh vertex.
    (evaluatedFirst as { x: number }).x = 9999;

    expect(originalMesh.vertices[0]).toEqual(originalFirstVertex);
  });
});

describe("canvas evaluation — selection-driven rig-control subset (Perf Wave 2 / plan A)", () => {
  // Gate: drawable equivalence (core). The rig-control subset change must never perturb the drawable
  // output. Evaluating with no rig selected vs. with a rig selected must yield byte-identical
  // drawables — the "which rig to evaluate" narrowing touches only `scene.rigControls`.
  it("produces byte-identical drawables whether or not a rig control is selected", () => {
    const session = createTwoWarpFixtureSession();

    const unselected = createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 30 }
    });
    const selected = createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 30 },
      selection: { kind: "rigControl", id: RIG_FACE_WARP }
    });

    expect(JSON.stringify(selected.drawables)).toBe(JSON.stringify(unselected.drawables));
    // Same rest-of-scene fields (bounds, masks) are unaffected too.
    expect(JSON.stringify(selected.canvasBounds)).toBe(JSON.stringify(unselected.canvasBounds));
    expect(JSON.stringify(selected.maskRelations)).toBe(JSON.stringify(unselected.maskRelations));
  });

  // Gate: lazy structure (call-structure assertion, no timing). With no selection / preview / draft
  // the rig-control subset is empty — no rig control evaluated shape is built.
  it("evaluates zero rig controls when nothing is selected, previewed, or drafted", () => {
    const session = createTwoWarpFixtureSession();

    const scene = createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 30 }
    });

    expect(scene.rigControls).toEqual([]);
  });

  // Gate: lazy structure — only the required subset is materialized. Selecting one of two rig
  // controls yields exactly that one evaluated overlay; the other is never built.
  it("evaluates only the selected rig control, leaving the rest of the subset empty", () => {
    const session = createTwoWarpFixtureSession();

    const faceSelected = createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 30 },
      selection: { kind: "rigControl", id: RIG_FACE_WARP }
    });
    const hiddenSelected = createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 30 },
      selection: { kind: "rigControl", id: RIG_PARENT_WARP }
    });

    expect(faceSelected.rigControls.map((rigControl) => rigControl.rigControlId)).toEqual([
      RIG_FACE_WARP
    ]);
    expect(hiddenSelected.rigControls.map((rigControl) => rigControl.rigControlId)).toEqual([
      RIG_PARENT_WARP
    ]);
  });

  // Gate: selection-time equivalence. A selected rig control's evaluated shape must be independent of
  // which sibling (or no sibling) is also present — i.e. the subset narrowing does not change the
  // numeric evaluation of any rig it does contain. We compare the evaluated overlay for RIG_FACE_WARP
  // taken alone against the same overlay when the (unrelated) sibling would otherwise be present.
  it("keeps the selected rig control's evaluated shape numerically identical to full evaluation", () => {
    const session = createTwoWarpFixtureSession();

    const faceSelected = createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 30 },
      selection: { kind: "rigControl", id: RIG_FACE_WARP }
    });
    const faceOverlay = requireRigControl(faceSelected, RIG_FACE_WARP);
    if (faceOverlay.kind !== "warp") {
      throw new Error("Expected warp overlay.");
    }

    // The face warp keys +20 on X at param 30, so every evaluated control point shifts by +20.
    expect(faceOverlay.evaluatedControlPoints).toEqual([
      { x: 20, y: 0 },
      { x: 120, y: 0 },
      { x: 20, y: 100 },
      { x: 120, y: 100 }
    ]);
    expect(faceOverlay.domainBounds).toEqual({ x: 20, y: 0, width: 100, height: 100 });
  });

  // Gate: the drag-preview path shares the same lazy evaluation. A control-point preview whose
  // rigControlId is set must pull that rig control into the subset even without a matching selection.
  it("includes a control-point preview's rig control in the subset without a selection", () => {
    const session = createTwoWarpFixtureSession();

    const scene = createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 0 },
      controlPointPreview: {
        rigControlId: RIG_FACE_WARP,
        controlPointOffsets: createOffsets(4, 12, -3)
      }
    });

    const overlay = requireRigControl(scene, RIG_FACE_WARP);
    if (overlay.kind !== "warp") {
      throw new Error("Expected warp overlay.");
    }
    expect(scene.rigControls.map((rigControl) => rigControl.rigControlId)).toEqual([RIG_FACE_WARP]);
    expect(overlay.evaluatedControlPoints[0]).toEqual({ x: 12, y: -3 });
  });

  // Gate: the draft path is covered too — a rigDraft lands in the subset even when the selection is a
  // plain drawable (mirrors the projection's `resolveDeformerOverlay` draft branch).
  it("includes the rig draft in the subset even when a drawable is selected", () => {
    const session = createFixtureSession();

    const scene = createCanvasEvaluatedScene(session, {
      selection: { kind: "drawable", id: DRAW_FACE },
      rigDraft: {
        kind: "warp",
        childDrawableIds: [DRAW_FACE],
        childRigControlIds: [],
        domainBounds: { x: 0, y: 0, width: 100, height: 100 },
        transformColumns: 2,
        transformRows: 2,
        controlPointOffsets: createOffsets(4, 5, 0)
      }
    });

    expect(scene.rigControls).toHaveLength(1);
    expect(scene.rigControls[0]?.status).toBe("draft");
  });
});

function requireDrawable(scene: ReturnType<typeof createCanvasEvaluatedScene>, drawableId: DrawableId) {
  const drawable = scene.drawables.find((candidate) => candidate.drawableId === drawableId);
  if (drawable === undefined) {
    throw new Error(`Expected drawable ${drawableId}.`);
  }

  return drawable;
}

function requireRigControl(
  scene: ReturnType<typeof createCanvasEvaluatedScene>,
  rigControlId: RigControlId
) {
  const rigControl = scene.rigControls.find((candidate) => candidate.rigControlId === rigControlId);
  if (rigControl === undefined) {
    throw new Error(`Expected rig control ${rigControlId}.`);
  }

  return rigControl;
}

function createDrawableOpacityKeyformSet(keys: readonly (readonly [number, number])[]) {
  return {
    keyformSetId: KeyformSetIdSchema.parse("keyset_canvas_eval_drawable_opacity"),
    target: {
      kind: "drawable" as const,
      id: DRAW_FACE,
      property: "opacity" as const
    },
    parameterId: FACE_ANGLE_X,
    evaluator: "linear-1d-v1" as const,
    interpolation: "linear-1d-v1" as const,
    compositionMode: "replace" as const,
    compositionOrder: 0,
    keys: keys.map(([value, statePatch]) => ({ value, statePatch }))
  };
}

function createRigNumberKeyformSet(
  rigControlId: RigControlId,
  property: "angleDegrees" | "opacityMultiplier",
  keys: readonly (readonly [number, number])[]
) {
  return {
    keyformSetId: KeyformSetIdSchema.parse(
      `keyset_canvas_eval_${rigControlId}_${property.toLowerCase()}`
    ),
    target: {
      kind: "rigControl" as const,
      id: rigControlId,
      property
    },
    parameterId: FACE_ANGLE_X,
    evaluator: "linear-1d-v1" as const,
    interpolation: "linear-1d-v1" as const,
    compositionMode: "replace" as const,
    compositionOrder: 0,
    keys: keys.map(([value, statePatch]) => ({ value, statePatch }))
  };
}

function createRotationTranslationKeyformSet(
  keys: readonly {
    readonly value: number;
    readonly statePatch: { readonly x: number; readonly y: number };
  }[]
) {
  return {
    keyformSetId: KeyformSetIdSchema.parse("keyset_canvas_eval_rotation_translation"),
    target: {
      kind: "rigControl" as const,
      id: RIG_FACE_ROTATION,
      property: "translation" as const
    },
    parameterId: FACE_ANGLE_X,
    evaluator: "linear-1d-v1" as const,
    interpolation: "linear-1d-v1" as const,
    compositionMode: "replace" as const,
    compositionOrder: 0,
    keys: keys.map((key) => ({
      value: key.value,
      statePatch: { x: key.statePatch.x, y: key.statePatch.y }
    }))
  };
}

function createWarpOffsetsKeyformSet(
  rigControlId: RigControlId,
  keys: readonly {
    readonly value: number;
    readonly statePatch: readonly { readonly x: number; readonly y: number }[];
  }[]
) {
  return {
    keyformSetId: KeyformSetIdSchema.parse(`keyset_canvas_eval_${rigControlId}_offsets`),
    target: {
      kind: "rigControl" as const,
      id: rigControlId,
      property: "controlPointOffsets" as const
    },
    parameterId: FACE_ANGLE_X,
    evaluator: "linear-1d-v1" as const,
    interpolation: "linear-1d-v1" as const,
    compositionMode: "replace" as const,
    compositionOrder: 0,
    keys: keys.map((key) => ({
      value: key.value,
      statePatch: key.statePatch.map((offset) => ({ x: offset.x, y: offset.y }))
    }))
  };
}

function evaluateNestedWarpCanvasVertices(input: {
  readonly baseVertex: Vec2Dto;
  readonly childOffset: Vec2Dto;
  readonly childDomainBounds: RectDto;
  readonly parentDomainBounds: RectDto;
  readonly parentControlPointOffsets: readonly Vec2Dto[];
}): readonly Vec2Dto[] {
  const session = createFixtureSession();
  setFaceMeshToSingleVertex(session, input.baseVertex);
  session.graph.rigControls.push(
    createWarpRigControl(RIG_PARENT_WARP, {
      childRigControlIds: [RIG_CHILD_WARP],
      domainBounds: input.parentDomainBounds
    }),
    createWarpRigControl(RIG_CHILD_WARP, {
      parentId: RIG_PARENT_WARP,
      childDrawableIds: [DRAW_FACE],
      domainBounds: input.childDomainBounds
    })
  );
  session.graph.rigControlRootIds.push(RIG_PARENT_WARP);
  session.graph.keyformSets.push(
    createWarpOffsetsKeyformSet(RIG_CHILD_WARP, [
      { value: -30, statePatch: createOffsets(4, 0, 0) },
      {
        value: 30,
        statePatch: createOffsets(4, input.childOffset.x, input.childOffset.y)
      }
    ]),
    createWarpOffsetsKeyformSet(RIG_PARENT_WARP, [
      { value: -30, statePatch: createOffsets(4, 0, 0) },
      { value: 30, statePatch: input.parentControlPointOffsets }
    ])
  );

  return requireDrawable(
    createCanvasEvaluatedScene(session, {
      parameterValues: { [FACE_ANGLE_X]: 30 }
    }),
    DRAW_FACE
  ).evaluatedMesh.vertices;
}

function setFaceMeshToSingleVertex(session: AuthoringSession, vertex: Vec2Dto): void {
  const mesh = session.graph.meshes.find((candidate) => candidate.meshId === MESH_FACE);
  if (mesh === undefined) {
    throw new Error("Expected face mesh.");
  }

  mesh.vertices = [cloneVec2(vertex)];
  mesh.uvs = [{ x: 0, y: 0 }];
  mesh.triangles = [];
  mesh.vertexStableIds = ["vtx_single"];
  mesh.bounds = { x: vertex.x, y: vertex.y, width: 0, height: 0 };
}

function createWarpRigControl(
  rigControlId: RigControlId,
  input: {
    readonly parentId?: RigControlId;
    readonly childDrawableIds?: readonly DrawableId[];
    readonly childRigControlIds?: readonly RigControlId[];
    readonly domainBounds?: RectDto;
  }
) {
  const domainBounds = input.domainBounds ?? { x: 0, y: 0, width: 100, height: 100 };

  return {
    kind: "warpLattice2d" as const,
    rigControlId,
    displayName: rigControlId,
    partId: PART_FACE,
    ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
    childDrawableIds: [...(input.childDrawableIds ?? [])],
    childRigControlIds: [...(input.childRigControlIds ?? [])],
    opacityMultiplier: 1,
    bindSpace: "rigControlLocalRest" as const,
    domainBounds: structuredClone(domainBounds),
    latticeColumns: 2,
    latticeRows: 2,
    restControlPoints: createRestControlPoints(domainBounds, 2, 2),
    interpolationMethod: "bilinear-grid-v1" as const,
    enabled: true
  };
}

function createRestControlPoints(
  domainBounds: RectDto,
  columns: number,
  rows: number
) {
  const points = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      points.push({
        x: domainBounds.x + domainBounds.width * (columns <= 1 ? 0 : column / (columns - 1)),
        y: domainBounds.y + domainBounds.height * (rows <= 1 ? 0 : row / (rows - 1))
      });
    }
  }

  return points;
}

function createRotationRigControl(input: {
  readonly rigControlId?: RigControlId;
  readonly parentId?: RigControlId;
  readonly childDrawableIds?: readonly DrawableId[];
  readonly childRigControlIds?: readonly RigControlId[];
  readonly restTranslation?: { readonly x: number; readonly y: number };
} = {}) {
  return {
    kind: "rotation2d" as const,
    rigControlId: input.rigControlId ?? RIG_FACE_ROTATION,
    displayName: "Face Rotation",
    partId: PART_FACE,
    ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
    childDrawableIds: [...(input.childDrawableIds ?? [DRAW_FACE])],
    childRigControlIds: [...(input.childRigControlIds ?? [])],
    opacityMultiplier: 1,
    pivot: { x: 50, y: 50 },
    restAngleDegrees: 0,
    restTranslation: input.restTranslation ?? { x: 0, y: 0 },
    restScale: { x: 1, y: 1 },
    enabled: true
  };
}

function createOffsets(count: number, x: number, y: number) {
  return Array.from({ length: count }, () => ({ x, y }));
}

function cloneVec2(value: Vec2Dto): Vec2Dto {
  return { x: value.x, y: value.y };
}

// Two unrelated committed warp rig controls (RIG_FACE_WARP over DRAW_FACE, RIG_PARENT_WARP over
// DRAW_HIDDEN). Only RIG_FACE_WARP is keyed (+20 on X at param 30) so selection-equivalence
// assertions have concrete evaluated values; the second exists so the "only the selected rig is
// evaluated" subset gate has a sibling to exclude.
function createTwoWarpFixtureSession(): AuthoringSession {
  const session = createFixtureSession();
  session.graph.rigControls.push(
    createWarpRigControl(RIG_FACE_WARP, { childDrawableIds: [DRAW_FACE] }),
    createWarpRigControl(RIG_PARENT_WARP, { childDrawableIds: [DRAW_HIDDEN] })
  );
  session.graph.rigControlRootIds.push(RIG_FACE_WARP, RIG_PARENT_WARP);
  session.graph.keyformSets.push(
    createWarpOffsetsKeyformSet(RIG_FACE_WARP, [
      { value: -30, statePatch: createOffsets(4, 0, 0) },
      { value: 30, statePatch: createOffsets(4, 20, 0) }
    ])
  );

  return session;
}

function createFixtureSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_canvas_evaluation_fixture"),
      packageDisplayName: "Canvas evaluation fixture",
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
          drawableIds: [DRAW_FACE, DRAW_HIDDEN]
        }
      ],
      drawables: [
        createDrawable(DRAW_FACE, MESH_FACE, TEX_FACE, "Face", true, 0),
        createDrawable(DRAW_HIDDEN, MESH_HIDDEN, TEX_HIDDEN, "Hidden", false, 2)
      ],
      meshes: [
        createMesh(MESH_FACE, DRAW_FACE, 0, 0, 100, 100),
        createMesh(MESH_HIDDEN, DRAW_HIDDEN, 10, 10, 20, 20)
      ],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [
        { drawableId: DRAW_FACE, baseDrawOrder: 0, stableOrder: 0 },
        { drawableId: DRAW_HIDDEN, baseDrawOrder: 2, stableOrder: 2 }
      ],
      rigControlRootIds: [],
      stableOrder: [PART_ROOT, PART_FACE, DRAW_FACE, DRAW_HIDDEN],
      sourceAssets: [],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          createTexture(TEX_FACE, "face"),
          createTexture(TEX_HIDDEN, "hidden")
        ]
      },
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}

function createDrawable(
  drawableId: DrawableId,
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  textureId: ReturnType<typeof TextureIdSchema.parse>,
  displayName: string,
  runtimeVisibility: boolean,
  baseDrawOrder: number
) {
  return {
    drawableId,
    displayName,
    partId: PART_FACE,
    sourceAssetId: SOURCE_ASSET,
    textureId,
    meshId,
    defaultOpacity: 1,
    runtimeVisibility,
    baseDrawOrder,
    sourceProvenanceId: PROVENANCE
  };
}

function createMesh(
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  drawableId: DrawableId,
  x: number,
  y: number,
  width: number,
  height: number
) {
  return {
    meshId,
    drawableId,
    vertices: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height }
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
    bounds: { x, y, width, height },
    generationProvenanceId: PROVENANCE
  };
}

function createTexture(textureId: ReturnType<typeof TextureIdSchema.parse>, name: string) {
  return {
    textureId,
    filePath: `assets/textures/${name}.rgba`,
    sourceAssetId: SOURCE_ASSET,
    sourceLayerId: `layer_${name}`,
    provenanceId: PROVENANCE,
    binaryAssetRef: {
      referenceKind: "package-binary-asset-ref-v1" as const,
      binaryAssetId: `bin_${name}`,
      packageRelativePath: `assets/textures/${name}.rgba`,
      digest: {
        algorithm: "sha256" as const,
        hex: name.padEnd(64, name).slice(0, 64).replaceAll(/[^a-f0-9]/g, "a")
      },
      byteLength: 100 * 100 * 4,
      mediaType: "application/octet-stream; pixelFormat=rgba8",
      storageStatus: "stored-package-local-v1" as const,
      provenanceId: PROVENANCE,
      rightsAssetId: "rights_canvas_eval_fixture"
    }
  };
}
