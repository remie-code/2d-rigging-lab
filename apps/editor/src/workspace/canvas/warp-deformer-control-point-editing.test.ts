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
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  createEditorSessionGestureCommitController
} from "../../features/editor-session/model/editor-session-gesture-commit";
import {
  createEmptyEditorSessionHistory,
  undoEditorSessionHistory
} from "../../features/editor-session/model/editor-session-history";
import {
  createParameterBindingProjection,
  createRigControlParameterBindings,
  createUniformControlPointOffsets
} from "../../features/editor-session/model/parameter-keyform-state";
import type { CanvasDeformerOverlayProjection } from "./canvas-projection";
import {
  applyWarpControlPointDragDelta,
  createWarpControlPointSelection,
  hitTestWarpControlPoint,
  listWarpControlPointPositions,
  selectWarpControlPointsInMarquee
} from "./warp-deformer-control-points";
import {
  canCommitWarpControlPointOffsetUpdate,
  createWarpControlPointOffsetUpdateGesture
} from "./warp-deformer-control-point-gesture";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const DRAW_FACE = DrawableIdSchema.parse("draw_face");
const MESH_FACE = MeshIdSchema.parse("mesh_face");
const TEX_FACE = TextureIdSchema.parse("tex_face");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_fixture");
const FACE_ANGLE_X = ParameterIdSchema.parse("param_face_angle_x");
const RIG_FACE_WARP = RigControlIdSchema.parse("rig_face_warp");

describe("Warp Deformer canvas control point editing", () => {
  it("computes screen positions and hit-tests the closest Warp control point", () => {
    const overlay = createOverlay({
      transformColumns: 3,
      transformRows: 2,
      controlPointOffsets: [
        { x: 0, y: 0 },
        { x: 1, y: 2 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: -5, y: 4 },
        { x: 0, y: 0 }
      ]
    });
    const view = { zoom: 2, pan: { x: 10, y: 20 } };

    const positions = listWarpControlPointPositions({ overlay, view });
    expect(positions).toHaveLength(6);
    expect(positions[4]).toMatchObject({
      index: 4,
      column: 1,
      row: 1,
      canvasPoint: { x: 45, y: 104 },
      screenPoint: { x: 100, y: 228 }
    });

    expect(
      hitTestWarpControlPoint({
        overlay,
        view,
        screenPoint: { x: 102, y: 227 },
        tolerancePx: 6
      })?.index
    ).toBe(4);
    expect(
      hitTestWarpControlPoint({
        overlay,
        view,
        screenPoint: { x: 160, y: 160 },
        tolerancePx: 6
      })
    ).toBeUndefined();
  });

  it("selects Warp control points with a marquee rectangle", () => {
    const overlay = createOverlay({
      transformColumns: 3,
      transformRows: 3
    });

    const selected = selectWarpControlPointsInMarquee({
      overlay,
      view: { zoom: 1, pan: { x: 0, y: 0 } },
      rect: { x: -5, y: -5, width: 60, height: 60 }
    });

    expect(selected).toEqual([0, 1, 3, 4]);
    expect(
      createWarpControlPointSelection({
        rigControlId: RIG_FACE_WARP,
        pointCount: 9,
        indices: [4, 1, 1, 99, -1]
      })
    ).toEqual({
      rigControlId: RIG_FACE_WARP,
      pointCount: 9,
      indices: [1, 4]
    });
  });

  it("commits a multi-point drag once and Undo restores the previous keyform offsets", () => {
    const session = createRigFixtureSession();
    const binding = requireWarpOffsetsBinding(session);
    const projection = createParameterBindingProjection(session, binding, FACE_ANGLE_X, {
      [FACE_ANGLE_X]: 30
    });
    if (!canCommitWarpControlPointOffsetUpdate(projection)) {
      throw new Error("Expected exact keyform position to be editable.");
    }

    const nextOffsets = applyWarpControlPointDragDelta({
      baseOffsets: createUniformControlPointOffsets(4, 0, 0),
      pointCount: 4,
      selectedIndices: [0, 3],
      deltaCanvas: { x: 3, y: -2 }
    });
    const controller = createEditorSessionGestureCommitController(
      createWarpControlPointOffsetUpdateGesture({
        binding,
        currentParameterValue: projection.currentParameterValue,
        getNextOffsets: () => nextOffsets,
        parameter: projection.parameter
      })
    );
    const history = createEmptyEditorSessionHistory();
    const previewOffsets = controller.preview({ currentSession: session });

    expect(previewOffsets).toEqual(nextOffsets);
    expect(history.undoStack).toHaveLength(0);
    expect(history.redoStack).toHaveLength(0);
    expect(readWarpOffsetsAt(session, 30)).toEqual(createUniformControlPointOffsets(4, 0, 0));

    const outcome = controller.commitOnce({
      currentSession: session,
      history
    });

    if (outcome?.result.committed !== true) {
      throw new Error(JSON.stringify(outcome?.result.diagnostics ?? []));
    }
    expect(outcome?.history.undoStack).toHaveLength(1);
    expect(controller.commitOnce({
      currentSession: outcome?.result.session ?? session,
      history: outcome?.history ?? createEmptyEditorSessionHistory()
    })).toBeNull();

    const committedOffsets = readWarpOffsetsAt(outcome?.result.session ?? session, 30);
    expect(committedOffsets[0]).toEqual({ x: 3, y: -2 });
    expect(committedOffsets[1]).toEqual({ x: 0, y: 0 });
    expect(committedOffsets[3]).toEqual({ x: 3, y: -2 });

    const undo = undoEditorSessionHistory(outcome?.history ?? createEmptyEditorSessionHistory());
    expect(undo).not.toBeNull();
    const restoredOffsets = readWarpOffsetsAt(undo?.session ?? session, 30);
    expect(restoredOffsets).toEqual(createUniformControlPointOffsets(4, 0, 0));
  });

  it("blocks direct drag commit when the active parameter is between keyforms", () => {
    const session = createRigFixtureSession();
    const binding = requireWarpOffsetsBinding(session);
    const projection = createParameterBindingProjection(session, binding, FACE_ANGLE_X, {
      [FACE_ANGLE_X]: 0
    });

    expect(projection.source).toBe("interpolated");
    expect(projection.canAddCurrent).toBe(true);
    expect(canCommitWarpControlPointOffsetUpdate(projection)).toBe(false);
  });
});

function createOverlay(input: {
  readonly transformColumns: number;
  readonly transformRows: number;
  readonly controlPointOffsets?: readonly { readonly x: number; readonly y: number }[];
}): CanvasDeformerOverlayProjection {
  return {
    kind: "warp",
    rigControlId: RIG_FACE_WARP,
    displayName: "Face Warp",
    domainBounds: { x: 0, y: 0, width: 100, height: 100 },
    transformColumns: input.transformColumns,
    transformRows: input.transformRows,
    bezierColumns: 2,
    bezierRows: 2,
    ...(input.controlPointOffsets === undefined
      ? {}
      : { controlPointOffsets: input.controlPointOffsets }),
    childDrawableIds: [DRAW_FACE],
    childRigControlIds: [],
    status: "committed"
  };
}

function requireWarpOffsetsBinding(session: AuthoringSession) {
  const binding = createRigControlParameterBindings(session, RIG_FACE_WARP).find(
    (candidate) => candidate.targetProperty === "controlPointOffsets"
  );
  if (binding === undefined) {
    throw new Error("Expected Warp controlPointOffsets binding.");
  }

  return binding;
}

function readWarpOffsetsAt(session: AuthoringSession, value: number) {
  const keyformSet = session.graph.keyformSets.find(
    (candidate) =>
      candidate.target.kind === "rigControl" &&
      candidate.target.id === RIG_FACE_WARP &&
      candidate.target.property === "controlPointOffsets"
  );
  const key = keyformSet?.keys.find(
    (candidate) => "value" in candidate && candidate.value === value
  );
  if (key === undefined || !Array.isArray(key.statePatch)) {
    throw new Error("Expected Warp controlPointOffsets key.");
  }

  return key.statePatch;
}

function createRigFixtureSession(): AuthoringSession {
  const session = createFixtureSession();
  session.graph.rigControls.push(createWarpRigControl());
  session.graph.rigControlRootIds.push(RIG_FACE_WARP);
  session.graph.keyformSets.push({
    keyformSetId: KeyformSetIdSchema.parse(
      "keyset_rigcontrol_rig_face_warp_controlpointoffsets_face_angle_x"
    ),
    target: {
      kind: "rigControl",
      id: RIG_FACE_WARP,
      property: "controlPointOffsets"
    },
    parameterId: FACE_ANGLE_X,
    evaluator: "linear-1d-v1",
    interpolation: "linear-1d-v1",
    compositionMode: "replace",
    compositionOrder: 0,
    keys: [
      { value: -30, statePatch: createMutableControlPointOffsets(4, 0, 0) },
      { value: 30, statePatch: createMutableControlPointOffsets(4, 0, 0) }
    ]
  });
  return session;
}

function createMutableControlPointOffsets(count: number, x: number, y: number) {
  return createUniformControlPointOffsets(count, x, y).map((offset) => ({
    x: offset.x,
    y: offset.y
  }));
}

function createWarpRigControl() {
  return {
    kind: "warpLattice2d" as const,
    rigControlId: RIG_FACE_WARP,
    displayName: "Face Warp",
    partId: PART_FACE,
    childDrawableIds: [DRAW_FACE],
    childRigControlIds: [],
    opacityMultiplier: 1,
    bindSpace: "rigControlLocalRest" as const,
    domainBounds: { x: 0, y: 0, width: 100, height: 100 },
    latticeColumns: 2,
    latticeRows: 2,
    restControlPoints: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 }
    ],
    interpolationMethod: "bilinear-grid-v1" as const,
    enabled: true
  };
}

function createFixtureSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_warp_control_point_editing_fixture"),
      packageDisplayName: "Warp Control Point Editing Fixture",
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
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 }
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
          bounds: { x: 0, y: 0, width: 100, height: 100 },
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
