import { createInitialAuthoringRevision, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { commitCreateRotationDeformer, commitCreateWarpDeformer } from "./editor-session-commands";
import { resolveDeformerTreeSelectionTransition } from "./editor-selection";
import {
  createDeformerTreeSelectableTargets,
  createDrawablePoolItems,
  createDeformerTreeRows,
  createRigBatchDrawableTargets,
  createRotationDeformerPayloadForDrawable,
  createRotationDeformerPayloadForUnboundDrawables,
  createRotationDeformerParentPayloadForRigControl,
  createWarpDeformerParentPayloadForRigControl,
  createWarpDeformerDraftForDrawable,
  createWarpDeformerPayloadFromDraft,
  createWarpDeformerPayloadForUnboundDrawables,
  fitWarpDeformerDraftToChildren,
  resetWarpDeformerDraft,
  updateWarpDeformerDraft,
  WARP_DEFORMER_DOMAIN_MARGIN
} from "./rig-tool-state";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const PART_EYE = PartIdSchema.parse("part_eye");
const PART_EMPTY = PartIdSchema.parse("part_empty");
const DRAW_FACE = DrawableIdSchema.parse("draw_face");
const DRAW_HAIR = DrawableIdSchema.parse("draw_hair");
const MESH_FACE = MeshIdSchema.parse("mesh_face");
const MESH_HAIR = MeshIdSchema.parse("mesh_hair");
const TEX_FACE = TextureIdSchema.parse("tex_face");
const TEX_HAIR = TextureIdSchema.parse("tex_hair");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_fixture");
const FACE_ANGLE_X = ParameterIdSchema.parse("param_face_angle_x");

describe("rig tool state", () => {
  it("creates a Warp Deformer draft from a Drawable and projects the committed Deformer Tree", () => {
    const session = createFixtureSession();
    const draft = createWarpDeformerDraftForDrawable(session, DRAW_FACE);

    expect(draft).toMatchObject({
      displayName: "Face Warp Deformer",
      childDrawableIds: [DRAW_FACE],
      domainBounds: { x: 9, y: 19, width: 32, height: 42 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });
    expect(draft).not.toHaveProperty("partId");

    const payload = createWarpDeformerPayloadFromDraft(draft!);
    expect(payload).not.toHaveProperty("partId");
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
      keyformSetCount: 0,
      keyformKeyCount: 0,
      transformLabel: "5 x 5 control points",
      bezierLabel: "3 x 3 control points"
    });
    expect(rows[1]).toMatchObject({
      kind: "drawableRef",
      drawableId: DRAW_FACE,
      displayName: "Face"
    });
  });

  it("creates Warp Deformer domains from committed mesh vertices outside the layer bounds", () => {
    const session = createFixtureSession();
    setFaceMeshVerticesOutsideLayer(session);
    const expectedDomain = { x: 5, y: 17, width: 42, height: 48 };

    const draft = createWarpDeformerDraftForDrawable(session, DRAW_FACE);
    expect(draft?.domainBounds).toEqual(expectedDomain);
    expect(WARP_DEFORMER_DOMAIN_MARGIN).toBe(1);

    const payload = createWarpDeformerPayloadFromDraft(draft!);
    const result = commitCreateWarpDeformer(session, payload);

    expect(result.committed).toBe(true);
    expect(
      result.session.graph.rigControls.find((rigControl) => rigControl.rigControlId === result.rigControlId)
    ).toMatchObject({
      kind: "warpLattice2d",
      domainBounds: expectedDomain
    });
  });

  it("fits and resets Warp Deformer drafts to mesh vertex bounds and falls back without a mesh", () => {
    const session = createFixtureSession();
    setFaceMeshVerticesOutsideLayer(session);
    const draft = createWarpDeformerDraftForDrawable(session, DRAW_FACE);
    if (draft === undefined) {
      throw new Error("Expected Warp Deformer draft.");
    }
    const edited = updateWarpDeformerDraft(draft, {
      domainBounds: { x: 0, y: 0, width: 12, height: 12 },
      transformColumns: 8,
      transformRows: 7,
      bezierColumns: 6,
      bezierRows: 5
    });

    const fitted = fitWarpDeformerDraftToChildren(session, edited);
    const reset = resetWarpDeformerDraft(session, edited);

    expect(fitted.domainBounds).toEqual({ x: 5, y: 17, width: 42, height: 48 });
    expect(fitted.transformColumns).toBe(8);
    expect(reset.domainBounds).toEqual({ x: 5, y: 17, width: 42, height: 48 });
    expect(reset.transformColumns).toBe(5);
    expect(reset.transformRows).toBe(5);

    const fallbackSession = createFixtureSession();
    fallbackSession.graph.meshes = fallbackSession.graph.meshes.filter(
      (mesh) => mesh.meshId !== MESH_FACE
    );
    const fallbackDraft = createWarpDeformerDraftForDrawable(fallbackSession, DRAW_FACE);
    if (fallbackDraft === undefined) {
      throw new Error("Expected fallback Warp Deformer draft.");
    }

    expect(fitWarpDeformerDraftToChildren(fallbackSession, fallbackDraft).domainBounds).toEqual({
      x: 0,
      y: 0,
      width: 128,
      height: 128
    });
    expect(resetWarpDeformerDraft(fallbackSession, fallbackDraft).domainBounds).toEqual({
      x: 0,
      y: 0,
      width: 128,
      height: 128
    });
  });

  it("creates insertion payloads when a selected Drawable is already bound", () => {
    const session = createFixtureSession();
    const parentResult = commitCreateWarpDeformer(session, {
      displayName: "Parent Warp",
      childDrawableIds: [DRAW_FACE],
      childRigControlIds: [],
      domainBounds: { x: 10, y: 20, width: 30, height: 40 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });

    expect(parentResult.committed).toBe(true);
    const parentRigControlId = parentResult.rigControlId!;
    const draft = createWarpDeformerDraftForDrawable(parentResult.session, DRAW_FACE);
    expect(draft).toMatchObject({
      parentRigControlId,
      insertBeforeChild: {
        kind: "drawable",
        id: DRAW_FACE
      }
    });
    expect(createWarpDeformerPayloadFromDraft(draft!)).toMatchObject({
      parentRigControlId,
      insertBeforeChild: {
        kind: "drawable",
        id: DRAW_FACE
      }
    });

    const rotationPayload = createRotationDeformerPayloadForDrawable(
      parentResult.session,
      DRAW_FACE
    );
    expect(rotationPayload).toMatchObject({
      parentRigControlId,
      insertBeforeChild: {
        kind: "drawable",
        id: DRAW_FACE
      },
      pivot: { x: 25, y: 40 },
      restAngleDegrees: 0
    });
  });

  it("classifies batch Rig targets and excludes already-bound Drawables from create payloads", () => {
    const session = createFixtureSession();
    const parentResult = commitCreateWarpDeformer(session, {
      displayName: "Parent Warp",
      childDrawableIds: [DRAW_FACE],
      childRigControlIds: [],
      domainBounds: { x: 10, y: 20, width: 30, height: 40 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });
    expect(parentResult.committed).toBe(true);

    const targets = createRigBatchDrawableTargets(parentResult.session, [DRAW_FACE, DRAW_HAIR]);
    expect(targets).toEqual([
      {
        drawableId: DRAW_FACE,
        displayName: "Face",
        bounds: { x: 10, y: 20, width: 30, height: 40 },
        status: "alreadyBound",
        boundRigControlId: parentResult.rigControlId
      },
      {
        drawableId: DRAW_HAIR,
        displayName: "Hair",
        bounds: { x: 50, y: 20, width: 30, height: 40 },
        status: "eligible"
      }
    ]);

    const rotationPayload = createRotationDeformerPayloadForUnboundDrawables(
      parentResult.session,
      [DRAW_FACE, DRAW_HAIR]
    );
    expect(rotationPayload).toMatchObject({
      childDrawableIds: [DRAW_HAIR],
      childRigControlIds: [],
      pivot: { x: 65, y: 40 }
    });
    expect(rotationPayload).not.toHaveProperty("partId");
    expect(rotationPayload).not.toHaveProperty("parentRigControlId");
    expect(rotationPayload).not.toHaveProperty("insertBeforeChild");

    expect(
      createRotationDeformerPayloadForUnboundDrawables(parentResult.session, [DRAW_FACE])
    ).toBeUndefined();
    expect(
      createWarpDeformerPayloadForUnboundDrawables(parentResult.session, [DRAW_FACE])
    ).toBeUndefined();
  });

  it("creates one root Rotation Deformer payload for selected unbound Drawables", () => {
    const session = createFixtureSession();
    const payload = createRotationDeformerPayloadForUnboundDrawables(session, [
      DRAW_FACE,
      DRAW_HAIR
    ]);

    expect(payload).toMatchObject({
      displayName: "2 Drawables Rotation Deformer",
      childDrawableIds: [DRAW_FACE, DRAW_HAIR],
      childRigControlIds: [],
      opacityMultiplier: 1,
      pivot: { x: 45, y: 40 },
      restAngleDegrees: 0
    });
    expect(payload).not.toHaveProperty("partId");
    expect(payload).not.toHaveProperty("parentRigControlId");
    expect(payload).not.toHaveProperty("insertBeforeChild");

    const result = commitCreateRotationDeformer(session, payload!);
    expect(result.committed).toBe(true);
    const rigControl = result.session.graph.rigControls.find(
      (candidate) => candidate.rigControlId === result.rigControlId
    );

    expect(rigControl).toMatchObject({
      kind: "rotation2d",
      childDrawableIds: [DRAW_FACE, DRAW_HAIR],
      childRigControlIds: [],
      pivot: { x: 45, y: 40 }
    });
    expect(rigControl).not.toHaveProperty("partId");
    expect(result.session.graph.rigControlRootIds).toContain(result.rigControlId);
  });

  it("creates one root Warp Deformer payload for selected unbound Drawables", () => {
    const session = createFixtureSession();
    const payload = createWarpDeformerPayloadForUnboundDrawables(session, [
      DRAW_FACE,
      DRAW_HAIR
    ]);

    expect(payload).toMatchObject({
      displayName: "2 Drawables Warp Deformer",
      childDrawableIds: [DRAW_FACE, DRAW_HAIR],
      childRigControlIds: [],
      domainBounds: { x: 9, y: 19, width: 72, height: 42 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });
    expect(payload).not.toHaveProperty("partId");
    expect(payload).not.toHaveProperty("parentRigControlId");
    expect(payload).not.toHaveProperty("insertBeforeChild");

    const result = commitCreateWarpDeformer(session, payload!);
    expect(result.committed).toBe(true);
    const rigControl = result.session.graph.rigControls.find(
      (candidate) => candidate.rigControlId === result.rigControlId
    );

    expect(rigControl).toMatchObject({
      kind: "warpLattice2d",
      childDrawableIds: [DRAW_FACE, DRAW_HAIR],
      childRigControlIds: [],
      domainBounds: { x: 9, y: 19, width: 72, height: 42 }
    });
    expect(rigControl).not.toHaveProperty("partId");
    expect(result.session.graph.rigControlRootIds).toContain(result.rigControlId);
  });

  it("computes Drawable Pool from deformer binding without using Parts membership", () => {
    const session = createFixtureSession();
    expect(getPoolDrawableIds(createDrawablePoolItems(session, null))).toEqual([
      DRAW_FACE,
      DRAW_HAIR
    ]);

    const result = commitCreateWarpDeformer(session, {
      displayName: "Face Warp",
      childDrawableIds: [DRAW_FACE],
      childRigControlIds: [],
      domainBounds: { x: 10, y: 20, width: 30, height: 40 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });

    expect(result.committed).toBe(true);
    expect(createDrawablePoolItems(result.session, { kind: "drawable", id: DRAW_HAIR })).toEqual([
      {
        kind: "part",
        partId: PART_ROOT,
        depth: 0,
        displayName: "Root",
        selected: false,
        displayOnly: true
      },
      {
        kind: "part",
        partId: PART_FACE,
        depth: 1,
        displayName: "Face Part",
        selected: false,
        displayOnly: true
      },
      {
        kind: "drawable",
        drawableId: DRAW_HAIR,
        depth: 2,
        displayName: "Hair",
        partDisplayName: "Face Part",
        selected: true,
        displayOnly: false
      }
    ]);
    expect(
      result.session.graph.drawables.find((drawable) => drawable.drawableId === DRAW_HAIR)?.partId
    ).toBe(PART_FACE);
  });

  it("resolves Deformer Tree mixed selection transitions in visible selectable row order", () => {
    const session = createFixtureSession();
    const result = commitCreateWarpDeformer(session, {
      displayName: "Face Warp",
      childDrawableIds: [DRAW_FACE],
      childRigControlIds: [],
      domainBounds: { x: 10, y: 20, width: 30, height: 40 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });
    expect(result.committed).toBe(true);

    const deformerRows = createDeformerTreeRows(result.session, null);
    const poolItems = createDrawablePoolItems(result.session, null);
    const visibleTargets = createDeformerTreeSelectableTargets(deformerRows, poolItems);
    const rigTarget = {
      kind: "rigControl" as const,
      rigControlId: result.rigControlId!
    };
    const boundTarget = {
      kind: "boundDrawable" as const,
      drawableId: DRAW_FACE,
      parentRigControlId: result.rigControlId!
    };
    const poolTarget = {
      kind: "poolDrawable" as const,
      drawableId: DRAW_HAIR
    };

    expect(poolItems.filter((item) => item.kind === "part")).toHaveLength(2);
    expect(visibleTargets).toEqual([rigTarget, boundTarget, poolTarget]);

    const replaced = resolveDeformerTreeSelectionTransition({
      currentSelection: null,
      anchorTarget: null,
      clickedTarget: rigTarget,
      visibleTargets,
      mode: "replace"
    });
    expect(replaced).toEqual({
      selection: { kind: "rigControl", id: result.rigControlId },
      anchorTarget: rigTarget
    });

    const toggled = resolveDeformerTreeSelectionTransition({
      currentSelection: replaced.selection,
      anchorTarget: replaced.anchorTarget,
      clickedTarget: poolTarget,
      visibleTargets,
      mode: "toggle"
    });
    expect(toggled).toEqual({
      selection: {
        kind: "deformerTreeSet",
        targets: [rigTarget, poolTarget]
      },
      anchorTarget: poolTarget
    });

    const ranged = resolveDeformerTreeSelectionTransition({
      currentSelection: {
        kind: "drawable",
        id: DRAW_FACE
      },
      anchorTarget: boundTarget,
      clickedTarget: poolTarget,
      visibleTargets,
      mode: "range"
    });
    expect(ranged).toEqual({
      selection: {
        kind: "deformerTreeSet",
        targets: [boundTarget, poolTarget]
      },
      anchorTarget: boundTarget
    });

    const fallback = resolveDeformerTreeSelectionTransition({
      currentSelection: replaced.selection,
      anchorTarget: {
        kind: "poolDrawable",
        drawableId: DRAW_FACE
      },
      clickedTarget: poolTarget,
      visibleTargets,
      mode: "range"
    });
    expect(fallback).toEqual({
      selection: { kind: "drawable", id: DRAW_HAIR },
      anchorTarget: poolTarget
    });
  });

  it("projects Drawable Pool under nested Parts hierarchy and prunes empty containers", () => {
    const session = createFixtureSession();
    session.graph.parts = [
      {
        partId: PART_ROOT,
        displayName: "Root",
        childPartIds: [PART_FACE, PART_EMPTY],
        drawableIds: [],
        children: [
          { kind: "part", partId: PART_FACE },
          { kind: "part", partId: PART_EMPTY }
        ]
      },
      {
        partId: PART_FACE,
        displayName: "Face Part",
        parentPartId: PART_ROOT,
        childPartIds: [PART_EYE],
        drawableIds: [DRAW_FACE],
        children: [
          { kind: "drawable", drawableId: DRAW_FACE },
          { kind: "part", partId: PART_EYE }
        ]
      },
      {
        partId: PART_EYE,
        displayName: "Eye Part",
        parentPartId: PART_FACE,
        childPartIds: [],
        drawableIds: [DRAW_HAIR],
        children: [{ kind: "drawable", drawableId: DRAW_HAIR }]
      },
      {
        partId: PART_EMPTY,
        displayName: "Empty Part",
        parentPartId: PART_ROOT,
        childPartIds: [],
        drawableIds: [],
        children: []
      }
    ];
    session.graph.drawables = session.graph.drawables.map((drawable) =>
      drawable.drawableId === DRAW_HAIR ? { ...drawable, partId: PART_EYE } : drawable
    );
    session.graph.stableOrder = [
      PART_ROOT,
      PART_FACE,
      DRAW_FACE,
      PART_EYE,
      DRAW_HAIR,
      PART_EMPTY
    ];

    const result = commitCreateWarpDeformer(session, {
      displayName: "Face Warp",
      childDrawableIds: [DRAW_FACE],
      childRigControlIds: [],
      domainBounds: { x: 10, y: 20, width: 30, height: 40 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });
    expect(result.committed).toBe(true);

    expect(
      createDrawablePoolItems(result.session, {
        kind: "deformerTreeSet",
        targets: [{ kind: "poolDrawable", drawableId: DRAW_HAIR }]
      })
    ).toEqual([
      {
        kind: "part",
        partId: PART_ROOT,
        depth: 0,
        displayName: "Root",
        selected: false,
        displayOnly: true
      },
      {
        kind: "part",
        partId: PART_FACE,
        depth: 1,
        displayName: "Face Part",
        selected: false,
        displayOnly: true
      },
      {
        kind: "part",
        partId: PART_EYE,
        depth: 2,
        displayName: "Eye Part",
        selected: false,
        displayOnly: true
      },
      {
        kind: "drawable",
        drawableId: DRAW_HAIR,
        depth: 3,
        displayName: "Hair",
        partDisplayName: "Eye Part",
        selected: true,
        displayOnly: false
      }
    ]);
  });

  it("creates parent Deformer payloads for root and parented selected Deformers", () => {
    const session = createFixtureSession();
    const childResult = commitCreateWarpDeformer(session, {
      displayName: "Child Warp",
      childDrawableIds: [DRAW_FACE],
      childRigControlIds: [],
      domainBounds: { x: 10, y: 20, width: 30, height: 40 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });
    expect(childResult.committed).toBe(true);

    const rootParentWarp = createWarpDeformerParentPayloadForRigControl(
      childResult.session,
      childResult.rigControlId!
    );
    expect(rootParentWarp).toMatchObject({
      childRigControlIds: [childResult.rigControlId!],
      domainBounds: { x: 10, y: 20, width: 30, height: 40 }
    });
    expect(rootParentWarp).not.toHaveProperty("parentRigControlId");
    expect(rootParentWarp).not.toHaveProperty("insertBeforeChild");

    const parentResult = commitCreateWarpDeformer(childResult.session, rootParentWarp!);
    expect(parentResult.committed).toBe(true);
    const parentedRotation = createRotationDeformerParentPayloadForRigControl(
      parentResult.session,
      childResult.rigControlId!
    );

    expect(parentedRotation).toMatchObject({
      parentRigControlId: parentResult.rigControlId!,
      insertBeforeChild: {
        kind: "rigControl",
        id: childResult.rigControlId!
      },
      pivot: { x: 25, y: 40 }
    });
    expect(parentedRotation?.childRigControlIds).toEqual([]);
  });

  it("projects deterministic keyform counts for Deformer Tree discovery", () => {
    const session = createFixtureSession();
    const result = commitCreateWarpDeformer(session, {
      displayName: "Face Warp",
      childDrawableIds: [DRAW_FACE],
      childRigControlIds: [],
      domainBounds: { x: 10, y: 20, width: 30, height: 40 },
      transformColumns: 5,
      transformRows: 5,
      bezierColumns: 3,
      bezierRows: 3,
      bezierEditType: "cubicBezierSurfaceV1"
    });
    expect(result.committed).toBe(true);
    const rigControlId = result.rigControlId!;

    result.session.graph.keyformSets.push({
      keyformSetId: KeyformSetIdSchema.parse("keyset_face_warp_offsets"),
      target: {
        kind: "rigControl",
        id: rigControlId,
        property: "controlPointOffsets"
      },
      parameterId: FACE_ANGLE_X,
      evaluator: "linear-1d-v1",
      interpolation: "linear-1d-v1",
      compositionMode: "replace",
      compositionOrder: 0,
      keys: [
        { value: 0, statePatch: [{ x: 4, y: 6 }] },
        { value: 30, statePatch: [{ x: 8, y: 12 }] }
      ]
    });

    const rows = createDeformerTreeRows(result.session, null);

    expect(rows[0]).toMatchObject({
      kind: "warpDeformer",
      displayName: "Face Warp",
      keyformSetCount: 1,
      keyformKeyCount: 2
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

function setFaceMeshVerticesOutsideLayer(session: AuthoringSession): void {
  const mesh = session.graph.meshes.find((candidate) => candidate.meshId === MESH_FACE);
  if (mesh === undefined) {
    throw new Error("Expected face mesh.");
  }

  mesh.vertices = [
    { x: 6, y: 18 },
    { x: 46, y: 18 },
    { x: 46, y: 64 },
    { x: 6, y: 64 }
  ];
  mesh.bounds = { x: 10, y: 20, width: 30, height: 40 };
}

function getPoolDrawableIds(items: ReturnType<typeof createDrawablePoolItems>) {
  return items
    .filter(
      (item): item is Extract<(typeof items)[number], { readonly kind: "drawable" }> =>
        item.kind === "drawable"
    )
    .map((item) => item.drawableId);
}
