import {
  createInitialAuthoringRevision,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  type ParameterId,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it } from "vitest";

import {
  createEditorSessionGestureCommitController,
  type EditorSessionGestureCommitController
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
import type { EditorSessionCommandResult } from "../../features/editor-session/model/editor-session-commands";
import type {
  CanvasDeformerOverlayProjection,
  CanvasRenderProjection,
  CanvasViewState
} from "./canvas-projection";
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
import {
  useWarpDeformerControlPointInteraction,
  type WarpDeformerControlPointInteraction
} from "./use-warp-deformer-control-point-interaction";

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

  it("shows scale handles only at exact editable Warp keyform positions", async () => {
    const session = createRigFixtureSession();
    const exactHarness = await renderWarpInteractionProbe({
      session,
      projection: createMinimalProjection(createOverlay({
        transformColumns: 2,
        transformRows: 2
      })),
      activeParameterId: FACE_ANGLE_X,
      parameterValues: { [FACE_ANGLE_X]: 30 },
      commitGestureController: () => null
    });

    try {
      expect(exactHarness.current().editable).toBe(true);
      expect(exactHarness.current().scaleHandlesVisible).toBe(true);
      expect(exactHarness.current().rendererState).toMatchObject({
        editable: true,
        scaleHandlesVisible: true
      });
    } finally {
      await exactHarness.cleanup();
    }

    const offKeyHarness = await renderWarpInteractionProbe({
      session,
      projection: createMinimalProjection(createOverlay({
        transformColumns: 2,
        transformRows: 2
      })),
      activeParameterId: FACE_ANGLE_X,
      parameterValues: { [FACE_ANGLE_X]: 0 },
      commitGestureController: () => null
    });

    try {
      expect(offKeyHarness.current().editable).toBe(false);
      expect(offKeyHarness.current().scaleHandlesVisible).toBe(false);
      expect(offKeyHarness.current().rendererState).toMatchObject({
        editable: false,
        scaleHandlesVisible: false
      });
    } finally {
      await offKeyHarness.cleanup();
    }
  });

  it("drags corner scale handles from the outward operation ring and commits scaled offsets once", async () => {
    let currentSession = createRigFixtureSession();
    let history = createEmptyEditorSessionHistory();
    let commitCount = 0;
    const expectedOffsets = [
      { x: 10, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 0 }
    ];
    const harness = await renderWarpInteractionProbe({
      session: currentSession,
      projection: createMinimalProjection(createOverlay({
        transformColumns: 2,
        transformRows: 2
      })),
      activeParameterId: FACE_ANGLE_X,
      parameterValues: { [FACE_ANGLE_X]: 30 },
      commitGestureController: (controller) => {
        const outcome = controller.commitOnce({
          currentSession,
          history
        });
        if (outcome?.result.committed === true) {
          currentSession = outcome.result.session;
          history = outcome.history;
          commitCount += 1;
        }

        return outcome?.result ?? null;
      }
    });

    try {
      await act(async () => {
        expect(harness.current().handlePointerDown({
          pointerId: 1,
          screenPoint: { x: -10, y: -10 }
        })).toBe(true);
        expect(harness.current().handlePointerMove({
          pointerId: 1,
          screenPoint: { x: 0, y: -10 }
        })).toBe(true);
      });

      expect(harness.current().hoveredScaleHandle).toBe("topLeftCorner");
      expect(harness.current().selectedControlPointIndices).toEqual([]);
      expect(harness.current().previewActive).toBe(true);
      expect(harness.current().renderProjection.deformerOverlay).toMatchObject({
        kind: "warp",
        controlPointOffsets: expectedOffsets
      });

      await act(async () => {
        expect(harness.current().finishPointerDrag({
          pointerId: 1,
          commit: true
        })).toBe(true);
        expect(harness.current().finishPointerDrag({
          pointerId: 1,
          commit: true
        })).toBe(false);
      });

      expect(commitCount).toBe(1);
      expect(history.undoStack).toHaveLength(1);
      expect(readWarpOffsetsAt(currentSession, 30)).toEqual(expectedOffsets);
      expect(harness.current().previewActive).toBe(false);
    } finally {
      await harness.cleanup();
    }
  });

  it("keeps corner and edge control points hittable at their lattice positions", async () => {
    const cornerSession = createRigFixtureSession();
    const cornerHarness = await renderWarpInteractionProbe({
      session: cornerSession,
      projection: createMinimalProjection(createOverlay({
        transformColumns: 2,
        transformRows: 2
      })),
      activeParameterId: FACE_ANGLE_X,
      parameterValues: { [FACE_ANGLE_X]: 30 },
      commitGestureController: () => null
    });

    try {
      await act(async () => {
        expect(cornerHarness.current().handlePointerDown({
          pointerId: 2,
          screenPoint: { x: 0, y: 0 }
        })).toBe(true);
        expect(cornerHarness.current().handlePointerMove({
          pointerId: 2,
          screenPoint: { x: 6, y: 0 }
        })).toBe(true);
      });

      const previewOffsets = cornerHarness.current().renderProjection.deformerOverlay?.controlPointOffsets;
      expect(cornerHarness.current().hoveredScaleHandle).toBeUndefined();
      expect(cornerHarness.current().selectedControlPointIndices).toEqual([0]);
      expect(previewOffsets?.[0]).toEqual({ x: 6, y: 0 });
      expect(previewOffsets?.[1]).toEqual({ x: 0, y: 0 });
      expect(previewOffsets?.[2]).toEqual({ x: 0, y: 0 });
    } finally {
      await cornerHarness.cleanup();
    }

    const edgeSession = createRigFixtureSession({ transformColumns: 3, transformRows: 3 });
    const edgeHarness = await renderWarpInteractionProbe({
      session: edgeSession,
      projection: createMinimalProjection(createOverlay({
        transformColumns: 3,
        transformRows: 3
      })),
      activeParameterId: FACE_ANGLE_X,
      parameterValues: { [FACE_ANGLE_X]: 30 },
      commitGestureController: () => null
    });

    try {
      await act(async () => {
        expect(edgeHarness.current().handlePointerDown({
          pointerId: 3,
          screenPoint: { x: 50, y: 0 }
        })).toBe(true);
        expect(edgeHarness.current().handlePointerMove({
          pointerId: 3,
          screenPoint: { x: 50, y: 6 }
        })).toBe(true);
      });

      const previewOffsets = edgeHarness.current().renderProjection.deformerOverlay?.controlPointOffsets;
      expect(edgeHarness.current().hoveredScaleHandle).toBeUndefined();
      expect(edgeHarness.current().selectedControlPointIndices).toEqual([1]);
      expect(previewOffsets).toHaveLength(9);
      expect(previewOffsets?.[0]).toEqual({ x: 0, y: 0 });
      expect(previewOffsets?.[1]).toEqual({ x: 0, y: 6 });
      expect(previewOffsets?.[2]).toEqual({ x: 0, y: 0 });
      expect(previewOffsets?.[4]).toEqual({ x: 0, y: 0 });
    } finally {
      await edgeHarness.cleanup();
    }
  });

  it("drags edge scale handles from the outward operation ring", async () => {
    const session = createRigFixtureSession({ transformColumns: 3, transformRows: 3 });
    const harness = await renderWarpInteractionProbe({
      session,
      projection: createMinimalProjection(createOverlay({
        transformColumns: 3,
        transformRows: 3
      })),
      activeParameterId: FACE_ANGLE_X,
      parameterValues: { [FACE_ANGLE_X]: 30 },
      commitGestureController: () => null
    });

    try {
      await act(async () => {
        expect(harness.current().handlePointerDown({
          pointerId: 4,
          screenPoint: { x: 50, y: -10 }
        })).toBe(true);
        expect(harness.current().handlePointerMove({
          pointerId: 4,
          screenPoint: { x: 50, y: 0 }
        })).toBe(true);
      });

      const previewOffsets = harness.current().renderProjection.deformerOverlay?.controlPointOffsets;
      expect(harness.current().hoveredScaleHandle).toBe("topEdge");
      expect(harness.current().selectedControlPointIndices).toEqual([]);
      expect(previewOffsets).toHaveLength(9);
      expect(previewOffsets?.[0]).toEqual({ x: 0, y: 10 });
      expect(previewOffsets?.[1]).toEqual({ x: 0, y: 10 });
      expect(previewOffsets?.[2]).toEqual({ x: 0, y: 10 });
      expect(previewOffsets?.[4]).toEqual({ x: 0, y: 5 });
      expect(previewOffsets?.[7]).toEqual({ x: 0, y: 0 });
    } finally {
      await harness.cleanup();
    }
  });

  it("keeps the scale handle gap in screen pixels at non-1x zoom", async () => {
    const session = createRigFixtureSession();
    const expectedOffsets = [
      { x: 10, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 0 }
    ];
    const harness = await renderWarpInteractionProbe({
      session,
      projection: createMinimalProjection(createOverlay({
        transformColumns: 2,
        transformRows: 2
      })),
      activeParameterId: FACE_ANGLE_X,
      parameterValues: { [FACE_ANGLE_X]: 30 },
      commitGestureController: () => null,
      view: { zoom: 2, pan: { x: 0, y: 0 } }
    });

    try {
      await act(async () => {
        expect(harness.current().handlePointerDown({
          pointerId: 5,
          screenPoint: { x: -10, y: -10 }
        })).toBe(true);
        expect(harness.current().handlePointerMove({
          pointerId: 5,
          screenPoint: { x: 10, y: -10 }
        })).toBe(true);
      });

      expect(harness.current().hoveredScaleHandle).toBe("topLeftCorner");
      expect(harness.current().renderProjection.deformerOverlay).toMatchObject({
        kind: "warp",
        controlPointOffsets: expectedOffsets
      });
    } finally {
      await harness.cleanup();
    }
  });

  it("discards scale preview on pointercancel without committing", async () => {
    let currentSession = createRigFixtureSession();
    let history = createEmptyEditorSessionHistory();
    let commitCount = 0;
    const harness = await renderWarpInteractionProbe({
      session: currentSession,
      projection: createMinimalProjection(createOverlay({
        transformColumns: 2,
        transformRows: 2
      })),
      activeParameterId: FACE_ANGLE_X,
      parameterValues: { [FACE_ANGLE_X]: 30 },
      commitGestureController: (controller) => {
        const outcome = controller.commitOnce({
          currentSession,
          history
        });
        if (outcome?.result.committed === true) {
          currentSession = outcome.result.session;
          history = outcome.history;
          commitCount += 1;
        }

        return outcome?.result ?? null;
      }
    });

    try {
      await act(async () => {
        expect(harness.current().handlePointerDown({
          pointerId: 6,
          screenPoint: { x: 50, y: -10 }
        })).toBe(true);
        expect(harness.current().handlePointerMove({
          pointerId: 6,
          screenPoint: { x: 50, y: -2 }
        })).toBe(true);
      });
      expect(harness.current().previewActive).toBe(true);

      await act(async () => {
        expect(harness.current().finishPointerDrag({
          pointerId: 6,
          commit: false
        })).toBe(true);
      });

      expect(commitCount).toBe(0);
      expect(history.undoStack).toHaveLength(0);
      expect(readWarpOffsetsAt(currentSession, 30)).toEqual(createMutableControlPointOffsets(4, 0, 0));
      expect(harness.current().previewActive).toBe(false);
    } finally {
      await harness.cleanup();
    }
  });
});

function createOverlay(input: {
  readonly transformColumns: number;
  readonly transformRows: number;
  readonly controlPointOffsets?: readonly { readonly x: number; readonly y: number }[];
}): CanvasDeformerOverlayProjection {
  const domainBounds = { x: 0, y: 0, width: 100, height: 100 };

  return {
    kind: "warp",
    rigControlId: RIG_FACE_WARP,
    displayName: "Face Warp",
    domainBounds,
    transformColumns: input.transformColumns,
    transformRows: input.transformRows,
    bezierColumns: 2,
    bezierRows: 2,
    restControlPoints: createRestControlPoints(
      domainBounds,
      input.transformColumns,
      input.transformRows
    ),
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

function createRigFixtureSession(input: {
  readonly transformColumns?: number;
  readonly transformRows?: number;
} = {}): AuthoringSession {
  const session = createFixtureSession();
  const transformColumns = input.transformColumns ?? 2;
  const transformRows = input.transformRows ?? 2;
  const pointCount = transformColumns * transformRows;
  session.graph.parameters.push({
    parameterId: FACE_ANGLE_X,
    displayName: "Face Angle X",
    valueSource: "authoredInput",
    min: -30,
    default: 0,
    max: 30,
    recommendedUiStep: 1
  });
  session.graph.rigControls.push(createWarpRigControl({ transformColumns, transformRows }));
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
      { value: -30, statePatch: createMutableControlPointOffsets(pointCount, 0, 0) },
      { value: 30, statePatch: createMutableControlPointOffsets(pointCount, 0, 0) }
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

function createWarpRigControl(input: {
  readonly transformColumns: number;
  readonly transformRows: number;
}) {
  const domainBounds = { x: 0, y: 0, width: 100, height: 100 };

  return {
    kind: "warpLattice2d" as const,
    rigControlId: RIG_FACE_WARP,
    displayName: "Face Warp",
    partId: PART_FACE,
    childDrawableIds: [DRAW_FACE],
    childRigControlIds: [],
    opacityMultiplier: 1,
    bindSpace: "rigControlLocalRest" as const,
    domainBounds,
    latticeColumns: input.transformColumns,
    latticeRows: input.transformRows,
    restControlPoints: createRestControlPoints(
      domainBounds,
      input.transformColumns,
      input.transformRows
    ),
    interpolationMethod: "bilinear-grid-v1" as const,
    enabled: true
  };
}

function createMinimalProjection(
  overlay: CanvasDeformerOverlayProjection
): CanvasRenderProjection {
  return {
    canvasBounds: { x: 0, y: 0, width: 128, height: 128 },
    artworkBounds: overlay.domainBounds,
    selectedDrawableIds: new Set(overlay.childDrawableIds),
    drawables: [],
    maskRelations: [],
    hasRenderableArtwork: false,
    contentKey: `warp-interaction-${overlay.rigControlId}`,
    deformerOverlay: overlay
  };
}

function createRestControlPoints(
  domainBounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
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

async function renderWarpInteractionProbe(input: {
  readonly session: AuthoringSession;
  readonly projection: CanvasRenderProjection;
  readonly commitGestureController: <
    Preview,
    Result extends EditorSessionCommandResult = EditorSessionCommandResult
  >(
    controller: EditorSessionGestureCommitController<Preview, Result>
  ) => Result | null;
  readonly activeParameterId?: ParameterId | null;
  readonly parameterValues?: Record<string, number>;
  readonly view?: CanvasViewState;
}): Promise<{
  readonly cleanup: () => Promise<void>;
  readonly current: () => WarpDeformerControlPointInteraction;
}> {
  const fakeRoot = createFakeDomRoot();
  let current: WarpDeformerControlPointInteraction | null = null;
  let reactRoot: Root | null = null;

  reactRoot = createRoot(fakeRoot.container as unknown as Element);
  await act(async () => {
    reactRoot?.render(
      createElement(
        StrictMode,
        null,
        createElement(WarpInteractionProbe, {
          input,
          onRender: (nextInteraction) => {
            current = nextInteraction;
          }
        })
      )
    );
  });

  return {
    current: () => {
      if (current === null) {
        throw new Error("Warp interaction probe was not rendered.");
      }

      return current;
    },
    cleanup: async () => {
      await act(async () => {
        reactRoot?.unmount();
      });
      fakeRoot.restore();
    }
  };
}

function WarpInteractionProbe({
  input,
  onRender
}: {
  readonly input: {
    readonly session: AuthoringSession;
    readonly projection: CanvasRenderProjection;
    readonly commitGestureController: <
      Preview,
      Result extends EditorSessionCommandResult = EditorSessionCommandResult
    >(
      controller: EditorSessionGestureCommitController<Preview, Result>
    ) => Result | null;
    readonly activeParameterId?: ParameterId | null;
    readonly parameterValues?: Record<string, number>;
    readonly view?: CanvasViewState;
  };
  readonly onRender: (interaction: WarpDeformerControlPointInteraction) => void;
}) {
  onRender(useWarpDeformerControlPointInteraction({
    activeParameterId: input.activeParameterId ?? null,
    commitGestureController: input.commitGestureController,
    enabled: true,
    parameterValues: input.parameterValues ?? {},
    projection: input.projection,
    session: input.session,
    view: input.view ?? { zoom: 1, pan: { x: 0, y: 0 } }
  }));
  return null;
}

type FakeNode = FakeElement | FakeTextNode;

class FakeTextNode {
  readonly nodeType = 3;
  readonly nodeName = "#text";
  readonly ownerDocument: FakeDocument;
  parentNode: FakeElement | null = null;
  data: string;
  nodeValue: string;

  constructor(text: string, ownerDocument: FakeDocument) {
    this.data = text;
    this.nodeValue = text;
    this.ownerDocument = ownerDocument;
  }

  get textContent(): string {
    return this.nodeValue;
  }

  set textContent(value: string) {
    this.data = value;
    this.nodeValue = value;
  }
}

class FakeElement {
  readonly nodeType = 1;
  readonly ownerDocument: FakeDocument;
  readonly style: Record<string, string> = {};
  readonly childNodes: FakeNode[] = [];
  readonly listeners = new Map<string, Set<EventListener>>();
  parentNode: FakeElement | null = null;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  nodeValue: string | null = null;

  private readonly attributes = new Map<string, string>();

  constructor(
    readonly localName: string,
    ownerDocument: FakeDocument
  ) {
    this.ownerDocument = ownerDocument;
  }

  get tagName(): string {
    return this.localName.toUpperCase();
  }

  get nodeName(): string {
    return this.tagName;
  }

  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.childNodes.splice(0, this.childNodes.length);
    this.appendChild(this.ownerDocument.createTextNode(value));
  }

  appendChild(node: FakeNode): FakeNode {
    node.parentNode?.removeChild(node);
    this.childNodes.push(node);
    node.parentNode = this;
    return node;
  }

  insertBefore(node: FakeNode, before: FakeNode | null): FakeNode {
    if (before === null) {
      return this.appendChild(node);
    }

    node.parentNode?.removeChild(node);
    const index = this.childNodes.indexOf(before);
    if (index < 0) {
      return this.appendChild(node);
    }

    this.childNodes.splice(index, 0, node);
    node.parentNode = this;
    return node;
  }

  removeChild(node: FakeNode): FakeNode {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
    }
    node.parentNode = null;
    return node;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  contains(node: FakeNode): boolean {
    if (node === this) {
      return true;
    }

    return this.childNodes.some(
      (child) => child instanceof FakeElement && child.contains(node)
    );
  }
}

class FakeDocument {
  readonly nodeType = 9;
  readonly nodeName = "#document";
  readonly namespaceURI = "http://www.w3.org/1999/xhtml";
  readonly documentElement: FakeElement;
  readonly body: FakeElement;
  readonly defaultView: {
    readonly document: FakeDocument;
    readonly Element: typeof FakeElement;
    readonly HTMLElement: typeof FakeElement;
    readonly SVGElement: typeof FakeElement;
    readonly HTMLIFrameElement: new () => object;
  };
  activeElement: FakeElement | null = null;

  constructor() {
    this.documentElement = new FakeElement("html", this);
    this.body = new FakeElement("body", this);
    this.documentElement.appendChild(this.body);
    this.defaultView = {
      document: this,
      Element: FakeElement,
      HTMLElement: FakeElement,
      SVGElement: FakeElement,
      HTMLIFrameElement: class HTMLIFrameElement {}
    };
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName.toLowerCase(), this);
  }

  createElementNS(namespaceURI: string, tagName: string): FakeElement {
    const element = this.createElement(tagName);
    element.namespaceURI = namespaceURI;
    return element;
  }

  createTextNode(text: string): FakeTextNode {
    return new FakeTextNode(text, this);
  }

  addEventListener(): void {
    return undefined;
  }

  removeEventListener(): void {
    return undefined;
  }
}

type ReactActGlobal = typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
};

function createFakeDomRoot(): {
  readonly container: FakeElement;
  readonly restore: () => void;
} {
  const document = new FakeDocument();
  const reactActGlobal = globalThis as ReactActGlobal;
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    Element: globalThis.Element,
    HTMLElement: globalThis.HTMLElement,
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
    SVGElement: globalThis.SVGElement,
    IS_REACT_ACT_ENVIRONMENT: reactActGlobal.IS_REACT_ACT_ENVIRONMENT
  };

  globalThis.document = document as unknown as Document;
  globalThis.window = document.defaultView as unknown as Window & typeof globalThis;
  globalThis.Element = FakeElement as unknown as typeof Element;
  globalThis.HTMLElement = FakeElement as unknown as typeof HTMLElement;
  globalThis.HTMLIFrameElement =
    document.defaultView.HTMLIFrameElement as unknown as typeof HTMLIFrameElement;
  globalThis.SVGElement = FakeElement as unknown as typeof SVGElement;
  reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;

  return {
    container: document.createElement("div"),
    restore: () => {
      globalThis.document = previous.document;
      globalThis.window = previous.window;
      globalThis.Element = previous.Element;
      globalThis.HTMLElement = previous.HTMLElement;
      globalThis.HTMLIFrameElement = previous.HTMLIFrameElement;
      globalThis.SVGElement = previous.SVGElement;
      reactActGlobal.IS_REACT_ACT_ENVIRONMENT = previous.IS_REACT_ACT_ENVIRONMENT;
    }
  };
}
