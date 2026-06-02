import {
  CheckIdSchema,
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ParameterIdSchema,
  SourceAssetIdSchema,
  RuntimeSnapshotIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { RuntimeDiffSchema } from "@private-2d-rigging-lab/contracts";
import { RuntimeSnapshotSchema } from "@private-2d-rigging-lab/runtime-core";
import type { RuntimeSnapshotDto } from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import { projectEditorPreview } from "./preview-projection.js";

describe("projectEditorPreview", () => {
  it("projects runtime snapshot drawables in drawList order with hidden drawables retained", () => {
    const snapshot = createRepresentativeRuntimeSnapshot();
    const projection = projectEditorPreview({
      snapshot,
      canvasSize: { width: 640, height: 480 },
      drawableNames: {
        draw_front: "Front",
        draw_back: "Back",
        draw_hidden: "Hidden"
      }
    });

    expect(projection).toMatchObject({
      schemaVersion: "editor-preview-projection-v1",
      sourceSnapshotId: "snap_preview_001",
      packageId: "pkg_preview",
      packageRevision: 7,
      snapshotDetail: "full",
      canvasSize: { width: 640, height: 480 },
      drawList: ["draw_back", "draw_front"],
      drawableCount: 3,
      visibleDrawableCount: 2
    });
    expect(projection.drawables.map((drawable) => drawable.drawableId)).toEqual([
      "draw_back",
      "draw_front",
      "draw_hidden"
    ]);
    expect(projection.drawables.map((drawable) => drawable.projectionOrder)).toEqual([0, 1, 2]);
    expect(projection.drawables.map((drawable) => drawable.drawListIndex)).toEqual([0, 1, undefined]);
  });

  it("keeps runtime visibility opacity bounds and polygon geometry available for later rendering", () => {
    const projection = projectEditorPreview({ snapshot: createRepresentativeRuntimeSnapshot() });
    const front = expectDrawable(projection.drawables.find((drawable) => drawable.drawableId === "draw_front"));
    const hidden = expectDrawable(projection.drawables.find((drawable) => drawable.drawableId === "draw_hidden"));

    expect(front).toMatchObject({
      drawableId: "draw_front",
      name: "draw_front",
      meshId: "mesh_front",
      visible: true,
      opacity: 0.4,
      baseDrawOrder: 10,
      evaluatedDrawOrder: 20,
      bounds: { x: 10, y: 20, width: 30, height: 40 },
      geometry: {
        vertexCount: 4,
        vertexHash: "hash_front"
      },
      keyformSampleCount: 1
    });
    expect(front.geometry.polygonPoints).toEqual([
      { x: 10, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 60 },
      { x: 10, y: 60 }
    ]);
    expect(hidden).toMatchObject({
      visible: false,
      opacity: 0,
      bounds: { x: 0, y: 0, width: 5, height: 5 },
      keyformSampleCount: 0
    });
  });

  it("projects texture references and unresolved texture states separately from geometry fallback", () => {
    const projection = projectEditorPreview({ snapshot: createRepresentativeRuntimeSnapshot() });
    const front = expectDrawable(projection.drawables.find((drawable) => drawable.drawableId === "draw_front"));
    const back = expectDrawable(projection.drawables.find((drawable) => drawable.drawableId === "draw_back"));
    const hidden = expectDrawable(projection.drawables.find((drawable) => drawable.drawableId === "draw_hidden"));

    expect(front.texture).toEqual({
      status: "not_materialized",
      textureId: "tex_front",
      sourceAssetId: "src_split_body",
      sourceLayerId: "layer_front",
      projection: {
        kind: "uv",
        uvCount: 4,
        uvs: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ]
      }
    });
    expect(back.texture).toEqual({
      status: "missing",
      sourceAssetId: "src_split_body",
      sourceLayerId: "layer_back",
      projection: { kind: "bounds_fit" }
    });
    expect(hidden.texture).toEqual({
      status: "not_materialized",
      projection: { kind: "bounds_fit" }
    });
  });

  it("summarizes keyform samples and diagnostics without DOM state", () => {
    const projection = projectEditorPreview({ snapshot: createRepresentativeRuntimeSnapshot() });

    expect(projection.keyformSamples).toEqual({
      totalCount: 2,
      byEvaluator: [
        { evaluator: "linear-1d-v1", count: 1 },
        { evaluator: "parameter-grid-2d-v1", count: 1 }
      ],
      byTarget: [
        { target: "draw_back", count: 1, evaluators: ["parameter-grid-2d-v1"] },
        { target: "mesh_front", count: 1, evaluators: ["linear-1d-v1"] }
      ]
    });
    expect(projection.diagnostics.totalCount).toBe(3);
    expect(projection.diagnostics.errorCount).toBe(1);
    expect(projection.diagnostics.warningCount).toBe(2);
    expect(projection.diagnostics.items.map((item) => item.checkId)).toEqual([
      "runtime.previewWarning",
      "dynamics.outputClamped",
      "runtime.drawableError"
    ]);
  });

  it("projects runtime diff counts and affected drawables when a diff is supplied", () => {
    const projection = projectEditorPreview({
      snapshot: createRepresentativeRuntimeSnapshot(),
      runtimeDiff: RuntimeDiffSchema.parse({
        schemaVersion: "runtime-diff-v1",
        beforeSnapshotId: "snap_preview_000",
        afterSnapshotId: "snap_preview_001",
        parameterChanges: [{ path: "/parameters/param_smile/effectiveValue", before: 0, after: 1 }],
        dynamicsChanges: [],
        drawableChanges: [
          {
            drawableId: "draw_front",
            boundsChanged: true,
            vertexHashBefore: "hash_front_before",
            vertexHashAfter: "hash_front"
          }
        ],
        drawableRuntimeStateChanges: [
          {
            drawableId: "draw_back",
            opacityBefore: 1,
            opacityAfter: 0.75,
            visibleBefore: true,
            visibleAfter: true,
            baseDrawOrderBefore: 0,
            baseDrawOrderAfter: 0,
            evaluatedDrawOrderBefore: 0,
            evaluatedDrawOrderAfter: 0
          }
        ],
        drawListChanges: [
          {
            before: ["draw_front", "draw_back"],
            after: ["draw_back", "draw_front"],
            membershipChanged: false,
            orderChanged: true,
            positionChanges: [
              { drawableId: "draw_front", beforeIndex: 0, afterIndex: 1 },
              { drawableId: "draw_back", beforeIndex: 1, afterIndex: 0 }
            ]
          }
        ],
        diagnosticDelta: []
      })
    });

    expect(projection.diff).toEqual({
      beforeSnapshotId: "snap_preview_000",
      afterSnapshotId: "snap_preview_001",
      parameterChangeCount: 1,
      dynamicsChangeCount: 0,
      drawableGeometryChangeCount: 1,
      drawableRuntimeStateChangeCount: 1,
      drawListChangeCount: 1,
      diagnosticDeltaCount: 0,
      affectedDrawableIds: ["draw_back", "draw_front"]
    });
  });

  it("projects part hierarchy and editor-only layer state without changing runtime visibility", () => {
    const projection = projectEditorPreview({
      snapshot: createRepresentativeRuntimeSnapshot(),
      editorState: {
        selection: ["draw_front", "part_body"],
        lockedIds: ["draw_back"],
        editorHiddenIds: ["draw_hidden"]
      }
    });
    const front = expectDrawable(projection.drawables.find((drawable) => drawable.drawableId === "draw_front"));
    const back = expectDrawable(projection.drawables.find((drawable) => drawable.drawableId === "draw_back"));
    const hidden = expectDrawable(projection.drawables.find((drawable) => drawable.drawableId === "draw_hidden"));

    expect(projection.parts).toEqual([
      {
        partId: "part_body",
        displayName: "Body",
        childPartIds: ["part_face"],
        drawableIds: ["draw_back", "draw_hidden"],
        hierarchyPath: ["part_body"],
        depth: 0,
        layerState: {
          editorHidden: false,
          locked: false,
          selected: true
        }
      },
      {
        partId: "part_face",
        displayName: "Face",
        parentPartId: "part_body",
        childPartIds: [],
        drawableIds: ["draw_front"],
        hierarchyPath: ["part_body", "part_face"],
        depth: 1,
        layerState: {
          editorHidden: false,
          locked: false,
          selected: false
        }
      }
    ]);
    expect(front).toMatchObject({
      partId: "part_face",
      visible: true,
      layerState: {
        runtimeVisible: true,
        editorHidden: false,
        locked: false,
        selected: true,
        textureStatus: "not_materialized",
        textureBacked: false,
        textureUnresolved: true
      }
    });
    expect(back).toMatchObject({
      partId: "part_body",
      visible: true,
      layerState: {
        runtimeVisible: true,
        editorHidden: false,
        locked: true,
        selected: false
      }
    });
    expect(hidden).toMatchObject({
      partId: "part_body",
      visible: false,
      layerState: {
        runtimeVisible: false,
        editorHidden: true,
        locked: false,
        selected: false
      }
    });
  });

  it("summarizes runtime diff part and texture evidence paths for preview consumers", () => {
    const projection = projectEditorPreview({
      snapshot: createRepresentativeRuntimeSnapshot(),
      runtimeDiff: RuntimeDiffSchema.parse({
        schemaVersion: "runtime-diff-v1",
        beforeSnapshotId: "snap_preview_000",
        afterSnapshotId: "snap_preview_001",
        parameterChanges: [
          { path: "/parts/part_face/drawableIds", before: [], after: ["draw_front"] },
          { path: "/drawables/draw_front/partId", before: "part_body", after: "part_face" },
          { path: "/drawables/draw_front/texture/textureId", before: null, after: "tex_front" }
        ],
        dynamicsChanges: [],
        drawableChanges: [],
        drawableRuntimeStateChanges: [],
        drawListChanges: [],
        diagnosticDelta: []
      })
    });

    expect(projection.diff).toMatchObject({
      parameterChangeCount: 3,
      partChangeCount: 2,
      drawableTextureChangeCount: 1,
      affectedDrawableIds: ["draw_front"],
      affectedPartIds: ["part_body", "part_face"]
    });
  });

  it("adds tutorial semantic evidence summary without rendered correctness claims", () => {
    const projection = projectEditorPreview({ snapshot: createRepresentativeRuntimeSnapshot() });

    expect(projection.tutorialEvidenceSummary).toMatchObject({
      schemaVersion: "tutorial-snapshot-evidence-summary-v1",
      source: "preview",
      packageRef: {
        packageId: "pkg_preview",
        packageRevision: 7
      },
      semanticReadiness: {
        status: "incomplete",
        ready: false
      },
      renderedCorrectness: {
        status: "not_evaluated",
        fullRenderer: false,
        pixelOracle: false,
        textureSamplingCorrectness: false,
        basis: "semanticRuntimeEvidenceOnly"
      }
    });
    expect(projection.tutorialEvidenceSummary?.semanticReadiness.presentSlices).toEqual([
      "parts",
      "layers",
      "drawables",
      "meshes",
      "maskOpacity",
      "dynamics"
    ]);
    expect(projection.tutorialEvidenceSummary?.semanticReadiness.missingSlices).toEqual([
      "meshEdits",
      "rigControls",
      "rigControlKeyforms"
    ]);
  });
});

const createRepresentativeRuntimeSnapshot = (): RuntimeSnapshotDto =>
  RuntimeSnapshotSchema.parse({
    schemaVersion: "runtime-snapshot-v1",
    runtimeCoreVersion: "test",
    snapshotId: RuntimeSnapshotIdSchema.parse("snap_preview_001"),
    context: {
      source: { surface: "preview" },
      policy: { strictness: "interactive" }
    },
    packageId: PackageIdSchema.parse("pkg_preview"),
    packageRevision: 7,
    dirty: false,
    evaluation: {
      snapshotDetail: "full",
      evaluatorVersions: {
        keyform1d: "linear-1d-v1",
        keyformGrid2d: "parameter-grid-2d-v1"
      }
    },
    parameters: [],
    parts: [
      {
        partId: PartIdSchema.parse("part_body"),
        displayName: "Body",
        childPartIds: [PartIdSchema.parse("part_face")],
        drawableIds: [
          DrawableIdSchema.parse("draw_back"),
          DrawableIdSchema.parse("draw_hidden")
        ],
        hierarchyPath: [PartIdSchema.parse("part_body")],
        depth: 0,
        drawableCount: 2,
        runtimeVisibleDrawableCount: 1
      },
      {
        partId: PartIdSchema.parse("part_face"),
        displayName: "Face",
        parentPartId: PartIdSchema.parse("part_body"),
        childPartIds: [],
        drawableIds: [DrawableIdSchema.parse("draw_front")],
        hierarchyPath: [
          PartIdSchema.parse("part_body"),
          PartIdSchema.parse("part_face")
        ],
        depth: 1,
        drawableCount: 1,
        runtimeVisibleDrawableCount: 1
      }
    ],
    dynamics: [
      {
        dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_hair"),
        enabled: true,
        solverKind: "scalarDampedFollowV1",
        driverValues: { param_faceYaw: 1 },
        outputParameterId: ParameterIdSchema.parse("param_hairSway"),
        outputValue: 0.25,
        stateSummary: {
          position: 0.25,
          velocity: 0
        },
        tick: 3,
        fixedStepMs: 16.6666667,
        resetCounter: 1,
        diagnostics: [
          {
            checkId: CheckIdSchema.parse("dynamics.outputClamped"),
            status: "warning",
            severity: "warning",
            phase: "dynamics_evaluation",
            target: { kind: "dynamicsGroup", id: "dyn_hair" },
            message: "Dynamics diagnostic from runtime."
          }
        ]
      }
    ],
    keyformSamples: [
      {
        keyformSetId: "keyset_front",
        evaluator: "linear-1d-v1",
        sampledCoordinates: { param_smile: 1 },
        target: "mesh_front"
      },
      {
        keyformSetId: "keyset_back",
        evaluator: "parameter-grid-2d-v1",
        sampledCoordinates: { param_faceX: 0.5, param_faceY: -0.25 },
        target: "draw_back"
      }
    ],
    rigControls: [],
    drawables: [
      {
        drawableId: DrawableIdSchema.parse("draw_front"),
        meshId: MeshIdSchema.parse("mesh_front"),
        partId: PartIdSchema.parse("part_face"),
        texture: {
          status: "not_materialized",
          textureId: TextureIdSchema.parse("tex_front"),
          sourceAssetId: SourceAssetIdSchema.parse("src_split_body"),
          sourceLayerId: "layer_front",
          projection: {
            kind: "uv",
            uvCount: 4,
            uvs: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 1, y: 1 },
              { x: 0, y: 1 }
            ]
          }
        },
        visible: true,
        opacity: 0.4,
        baseDrawOrder: 10,
        evaluatedDrawOrder: 20,
        bounds: { x: 10, y: 20, width: 30, height: 40 },
        vertexCount: 4,
        vertexHash: "hash_front",
        vertices: [
          { x: 10, y: 20 },
          { x: 40, y: 20 },
          { x: 40, y: 60 },
          { x: 10, y: 60 }
        ],
        diagnostics: [
          {
            checkId: CheckIdSchema.parse("runtime.drawableError"),
            status: "fail",
            severity: "error",
            phase: "mesh_evaluation",
            target: { kind: "drawable", id: "draw_front" },
            message: "Drawable diagnostic from runtime."
          }
        ]
      },
      {
        drawableId: DrawableIdSchema.parse("draw_hidden"),
        meshId: MeshIdSchema.parse("mesh_hidden"),
        partId: PartIdSchema.parse("part_body"),
        visible: false,
        opacity: 0,
        baseDrawOrder: 5,
        evaluatedDrawOrder: 5,
        bounds: { x: 0, y: 0, width: 5, height: 5 },
        vertexCount: 0,
        vertexHash: "hash_hidden",
        diagnostics: []
      },
      {
        drawableId: DrawableIdSchema.parse("draw_back"),
        meshId: MeshIdSchema.parse("mesh_back"),
        partId: PartIdSchema.parse("part_body"),
        texture: {
          status: "missing",
          sourceAssetId: SourceAssetIdSchema.parse("src_split_body"),
          sourceLayerId: "layer_back",
          projection: {
            kind: "bounds_fit"
          }
        },
        visible: true,
        opacity: 0.75,
        baseDrawOrder: 0,
        evaluatedDrawOrder: 0,
        bounds: { x: -10, y: -20, width: 50, height: 60 },
        vertexCount: 4,
        vertexHash: "hash_back",
        diagnostics: []
      }
    ],
    masks: [],
    drawList: [DrawableIdSchema.parse("draw_back"), DrawableIdSchema.parse("draw_front")],
    disabledFutureLayers: [],
    diagnostics: [
      {
        checkId: CheckIdSchema.parse("runtime.previewWarning"),
        status: "warning",
        severity: "warning",
        phase: "render_preparation",
        target: { kind: "runtimeSnapshot", id: "snap_preview_001" },
        message: "Snapshot diagnostic from runtime."
      }
    ]
  });

const expectDrawable = <TValue>(value: TValue | undefined): TValue => {
  expect(value).toBeDefined();
  return value as TValue;
};
