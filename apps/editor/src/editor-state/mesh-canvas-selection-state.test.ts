import { describe, expect, it } from "vitest";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";

import {
  applyCommittedOperationSummary,
  createMeshCanvasDragDraftCommand,
  createMeshCanvasNudgeDraftCommand,
  createMeshEditStateWithSelectedVertices,
  hitTestMeshCanvasVertices,
  projectEditorWorkflowViewModel,
  projectLoadedPackageState,
  selectMeshCanvasHitTarget,
  selectMeshCanvasVertex
} from "./index.js";

describe("mesh canvas selection state", () => {
  it("reprojects editor-state-only committed summaries without dropping current mesh targets", () => {
    const state = createMeshCanvasState({
      selection: ["draw_front"]
    });
    const selected = {
      ...state,
      meshEdit: createMeshEditStateWithSelectedVertices(state.meshEdit, [
        "vtx_front_0",
        "vtx_front_2"
      ])
    };

    const locked = applyEditorStateOnlySummary(selected, {
      selection: ["draw_front"],
      lockedIds: ["draw_front"],
      editorHiddenIds: []
    });
    expect(locked.meshEdit).toMatchObject({
      selectedMesh: {
        drawableId: "draw_front",
        meshId: "mesh_front",
        locked: true,
        editorHidden: false
      },
      selectedVertexIds: ["vtx_front_0", "vtx_front_2"],
      editDisabledReason: "locked",
      canDraftCanvasMeshMove: false
    });
    expect(locked.meshEdit.editableVertices).toHaveLength(3);
    expect(locked.meshEdit.canvasHitTargets).toHaveLength(3);
    expect(locked.meshEdit.canvasHitTargets[0]).toMatchObject({
      vertexId: "vtx_front_0",
      selected: true,
      selectable: false,
      disabledReason: "locked"
    });

    const editorHidden = applyEditorStateOnlySummary(selected, {
      selection: ["draw_front"],
      lockedIds: [],
      editorHiddenIds: ["draw_front"]
    });
    expect(editorHidden.meshEdit).toMatchObject({
      selectedMesh: {
        drawableId: "draw_front",
        editorHidden: true,
        locked: false
      },
      selectedVertexIds: ["vtx_front_0", "vtx_front_2"],
      canvasHitTargets: [],
      editDisabledReason: "editorHidden"
    });
    expect(editorHidden.meshEdit.editableVertices).toHaveLength(3);

    const selectedBack = applyEditorStateOnlySummary(selected, {
      selection: ["draw_back"],
      lockedIds: ["draw_back"],
      editorHiddenIds: []
    });
    expect(selectedBack.meshEdit).toMatchObject({
      selectedMesh: {
        drawableId: "draw_back",
        meshId: "mesh_back",
        locked: true,
        runtimeVisible: false
      },
      selectedVertexIds: [],
      editDisabledReason: "locked"
    });
    expect(selectedBack.meshEdit.editableVertices.map((vertex) => vertex.vertexId)).toEqual([
      "vtx_back_0",
      "vtx_back_1",
      "vtx_back_2"
    ]);
    expect(selectedBack.meshEdit.canvasHitTargets).toHaveLength(3);
  });

  it("reprojects full drawables, meshes, and editor state from committed summaries", () => {
    const state = createMeshCanvasState({
      selection: ["draw_front"]
    });
    const packageInput = createMeshCanvasPackageInput({
      selection: ["draw_back"],
      lockedIds: ["draw_back"],
      editorHiddenIds: []
    });
    const reprojected = applyCommittedOperationSummary(state, {
      result: createLayerStateOperationResult("op_full_mesh_reproject"),
      operationLogEntries: [],
      drawables: packageInput.drawables,
      drawOrderEntries: packageInput.drawOrderEntries,
      meshes: packageInput.meshes,
      editorState: packageInput.editorState
    });

    expect(reprojected.meshEdit).toMatchObject({
      selectedMesh: {
        drawableId: "draw_back",
        meshId: "mesh_back",
        runtimeVisible: false,
        locked: true,
        editorHidden: false
      },
      editDisabledReason: "locked"
    });
    expect(reprojected.meshEdit.editableVertices.map((vertex) => vertex.vertexId)).toEqual([
      "vtx_back_0",
      "vtx_back_1",
      "vtx_back_2"
    ]);
    expect(reprojected.meshEdit.canvasHitTargets).toEqual([
      expect.objectContaining({
        vertexId: "vtx_back_0",
        selectable: false,
        disabledReason: "locked"
      }),
      expect.objectContaining({
        vertexId: "vtx_back_1",
        selectable: false,
        disabledReason: "locked"
      }),
      expect.objectContaining({
        vertexId: "vtx_back_2",
        selectable: false,
        disabledReason: "locked"
      })
    ]);
  });

  it("projects layer-selected mesh editability without conflating runtime and editor visibility", () => {
    const runtimeHidden = createMeshCanvasState({
      selection: ["draw_back"]
    });

    expect(runtimeHidden.meshEdit.selectedMesh).toMatchObject({
      drawableId: "draw_back",
      meshId: "mesh_back",
      runtimeVisible: false,
      editorHidden: false,
      locked: false
    });
    expect(runtimeHidden.meshEdit).toMatchObject({
      canNudgeSelectedMesh: true,
      editDisabledReason: null
    });
    expect(runtimeHidden.meshEdit.canvasHitTargets[0]).toMatchObject({
      vertexId: "vtx_back_0",
      canvasPosition: { x: 0, y: 0 },
      runtimeVisible: false,
      selectable: true,
      disabledReason: null
    });

    const locked = createMeshCanvasState({
      selection: ["draw_front"],
      lockedIds: ["draw_front"]
    });
    expect(locked.meshEdit).toMatchObject({
      canNudgeSelectedMesh: false,
      canDraftCanvasMeshMove: false,
      editDisabledReason: "locked"
    });
    expect(locked.meshEdit.canvasHitTargets).toEqual([
      expect.objectContaining({
        vertexId: "vtx_front_0",
        selectable: false,
        editable: false,
        disabledReason: "locked"
      }),
      expect.objectContaining({
        vertexId: "vtx_front_1",
        selectable: false,
        editable: false,
        disabledReason: "locked"
      }),
      expect.objectContaining({
        vertexId: "vtx_front_2",
        selectable: false,
        editable: false,
        disabledReason: "locked"
      })
    ]);

    const editorHidden = createMeshCanvasState({
      selection: ["draw_front"],
      editorHiddenIds: ["draw_front"]
    });
    expect(editorHidden.meshEdit.selectedMesh).toMatchObject({
      drawableId: "draw_front",
      runtimeVisible: true,
      editorHidden: true,
      locked: false
    });
    expect(editorHidden.meshEdit).toMatchObject({
      canvasHitTargets: [],
      canNudgeSelectedMesh: false,
      editDisabledReason: "editorHidden"
    });
  });

  it("updates single and multi vertex selection in mesh vertex order", () => {
    const state = createMeshCanvasState({
      selection: ["draw_front"]
    });

    const selectedByHit = selectMeshCanvasHitTarget(state.meshEdit, {
      point: { x: 10.2, y: 20.1 }
    });
    const multiSelected = selectMeshCanvasVertex(selectedByHit, {
      vertexId: "vtx_front_0",
      mode: "add"
    });
    const toggled = selectMeshCanvasVertex(multiSelected, {
      vertexId: "vtx_front_2",
      mode: "toggle"
    });

    expect(hitTestMeshCanvasVertices(multiSelected, { x: 10.1, y: 10.1 })?.vertexId).toBe(
      "vtx_front_0"
    );
    expect(selectedByHit.selectedVertexIds).toEqual(["vtx_front_2"]);
    expect(multiSelected.selectedVertexIds).toEqual(["vtx_front_0", "vtx_front_2"]);
    expect(toggled.selectedVertexIds).toEqual(["vtx_front_0"]);
    expect(toggled.canvasHitTargets.map((target) => [target.vertexId, target.selected])).toEqual([
      ["vtx_front_0", true],
      ["vtx_front_1", false],
      ["vtx_front_2", false]
    ]);
  });

  it("uses deterministic vertex index tie-breaking during hit tests", () => {
    const state = createMeshCanvasState({
      selection: ["draw_front"]
    });

    expect(hitTestMeshCanvasVertices(state.meshEdit, { x: 15, y: 10 })?.vertexId).toBe(
      "vtx_front_0"
    );
  });

  it("normalizes invalid selection targets deterministically", () => {
    const state = createMeshCanvasState({
      selection: ["draw_front"]
    });
    const normalized = createMeshEditStateWithSelectedVertices(state.meshEdit, [
      " ",
      "vtx_front_2",
      "missing_vertex",
      " vtx_front_0 ",
      "vtx_front_2"
    ]);

    expect(normalized.selectedVertexIds).toEqual(["vtx_front_0", "vtx_front_2"]);
    expect(
      selectMeshCanvasVertex(normalized, {
        vertexId: "missing_vertex",
        mode: "replace"
      }).selectedVertexIds
    ).toEqual([]);
    expect(
      selectMeshCanvasVertex(normalized, {
        vertexId: "missing_vertex",
        mode: "add"
      }).selectedVertexIds
    ).toEqual(["vtx_front_0", "vtx_front_2"]);
    expect(
      selectMeshCanvasVertex(normalized, {
        vertexId: " ",
        mode: "replace"
      }).selectedVertexIds
    ).toEqual([]);
    expect(
      selectMeshCanvasVertex(normalized, {
        vertexId: " ",
        mode: "add"
      }).selectedVertexIds
    ).toEqual(["vtx_front_0", "vtx_front_2"]);
  });

  it("creates drag and nudge drafts for selected vertices without committing operations", () => {
    const state = createMeshCanvasState({
      selection: ["draw_front"]
    });
    const selected = createMeshEditStateWithSelectedVertices(state.meshEdit, [
      "vtx_front_2",
      "vtx_front_0"
    ]);

    expect(selected.selectedVertexIds).toEqual(["vtx_front_0", "vtx_front_2"]);
    expect(createMeshCanvasDragDraftCommand(selected, { x: 2, y: -3 })).toEqual({
      status: "ready",
      command: {
        operationType: "moveMeshVertex",
        meshId: "mesh_front",
        selectedVertexIds: ["vtx_front_0", "vtx_front_2"],
        source: "canvasDrag",
        intent: "canvasDrag vtx_front_0, vtx_front_2 by 2, -3",
        vertexDeltas: [
          {
            vertexId: "vtx_front_0",
            delta: { x: 2, y: -3 }
          },
          {
            vertexId: "vtx_front_2",
            delta: { x: 2, y: -3 }
          }
        ]
      },
      blockedReason: null
    });
    expect(createMeshCanvasNudgeDraftCommand(selected, { x: 0, y: 1 })).toMatchObject({
      status: "ready",
      command: {
        source: "canvasNudge",
        vertexDeltas: [
          { vertexId: "vtx_front_0", delta: { x: 0, y: 1 } },
          { vertexId: "vtx_front_2", delta: { x: 0, y: 1 } }
        ]
      }
    });
    expect(createMeshCanvasNudgeDraftCommand(selected, { x: 0, y: 0 })).toMatchObject({
      status: "blocked",
      command: null,
      blockedReason: "invalidDelta"
    });
    expect(
      createMeshCanvasDragDraftCommand(
        createMeshEditStateWithSelectedVertices(state.meshEdit, []),
        { x: 1, y: 0 }
      )
    ).toMatchObject({
      status: "blocked",
      command: null,
      blockedReason: "noSelectedVertices"
    });
  });

  it("blocks drag and nudge drafts for locked and editor-hidden selected meshes", () => {
    const locked = createMeshEditStateWithSelectedVertices(
      createMeshCanvasState({
        selection: ["draw_front"],
        lockedIds: ["draw_front"]
      }).meshEdit,
      ["vtx_front_0"]
    );
    const editorHidden = createMeshEditStateWithSelectedVertices(
      createMeshCanvasState({
        selection: ["draw_front"],
        editorHiddenIds: ["draw_front"]
      }).meshEdit,
      ["vtx_front_0"]
    );

    expect(createMeshCanvasDragDraftCommand(locked, { x: 1, y: 0 })).toMatchObject({
      status: "blocked",
      command: null,
      blockedReason: "locked"
    });
    expect(createMeshCanvasNudgeDraftCommand(locked, { x: 0, y: 1 })).toMatchObject({
      status: "blocked",
      command: null,
      blockedReason: "locked"
    });
    expect(createMeshCanvasDragDraftCommand(editorHidden, { x: 1, y: 0 })).toMatchObject({
      status: "blocked",
      command: null,
      blockedReason: "editorHidden"
    });
    expect(createMeshCanvasNudgeDraftCommand(editorHidden, { x: 0, y: 1 })).toMatchObject({
      status: "blocked",
      command: null,
      blockedReason: "editorHidden"
    });
  });

  it("keeps locked hit targets disabled unless explicitly included", () => {
    const locked = createMeshEditStateWithSelectedVertices(
      createMeshCanvasState({
        selection: ["draw_front"],
        lockedIds: ["draw_front"]
      }).meshEdit,
      ["vtx_front_2"]
    );

    expect(hitTestMeshCanvasVertices(locked, { x: 10, y: 10 })).toBeNull();
    expect(
      hitTestMeshCanvasVertices(locked, { x: 10, y: 10 }, { includeDisabledTargets: true })
    ).toMatchObject({
      vertexId: "vtx_front_0",
      selectable: false,
      disabledReason: "locked"
    });
    expect(
      selectMeshCanvasHitTarget(locked, {
        point: { x: 10, y: 10 }
      }).selectedVertexIds
    ).toEqual([]);
    expect(
      selectMeshCanvasHitTarget(locked, {
        point: { x: 10, y: 10 },
        includeDisabledTargets: true
      }).selectedVertexIds
    ).toEqual(["vtx_front_2"]);
  });

  it("projects selected canvas hit targets through the mesh edit view model", () => {
    const state = createMeshCanvasState({
      selection: ["draw_front"]
    });
    const viewModel = projectEditorWorkflowViewModel({
      ...state,
      meshEdit: createMeshEditStateWithSelectedVertices(state.meshEdit, [
        "vtx_front_0",
        "vtx_front_2"
      ])
    }).meshEdit;

    expect(viewModel.selectedMesh).toMatchObject({
      meshId: "mesh_front",
      drawableId: "draw_front",
      runtimeVisibilityLabel: "Runtime visible",
      editorVisibilityLabel: "Editor visible",
      lockedLabel: "Unlocked",
      editabilityLabel: "Editable"
    });
    expect(viewModel.canvasSelection).toMatchObject({
      selectedVertexIds: ["vtx_front_0", "vtx_front_2"],
      hasHitTargets: true,
      canDraftMove: true,
      selectedVertexCountLabel: "2 selected vertices",
      hitTargetCountLabel: "3 canvas targets",
      editabilityLabel: "Editable"
    });
    expect(viewModel.editableVertices[0]).toMatchObject({
      vertexId: "vtx_front_0",
      canvasX: 10,
      canvasY: 10,
      hitRadius: 6,
      selected: true,
      canvasPositionLabel: "10, 10"
    });
    expect(viewModel.canvasSelection.hitTargets[2]).toMatchObject({
      vertexId: "vtx_front_2",
      x: 10,
      y: 20,
      selected: true,
      selectable: true,
      editable: true,
      stateLabel: "Runtime visible / Editor visible / Unlocked / Selected / Selectable"
    });
  });
});

const createMeshCanvasState = (input: {
  readonly selection: readonly string[];
  readonly lockedIds?: readonly string[];
  readonly editorHiddenIds?: readonly string[];
}) =>
  projectLoadedPackageState(createMeshCanvasPackageInput(input));

const applyEditorStateOnlySummary = (
  state: ReturnType<typeof createMeshCanvasState>,
  editorState: {
    readonly selection: readonly string[];
    readonly lockedIds: readonly string[];
    readonly editorHiddenIds: readonly string[];
  }
) =>
  applyCommittedOperationSummary(state, {
    result: createLayerStateOperationResult("op_editor_state_only"),
    operationLogEntries: [],
    editorState: {
      schemaVersion: "editor-state-v1",
      selection: [...editorState.selection],
      lockedIds: [...editorState.lockedIds],
      editorHiddenIds: [...editorState.editorHiddenIds]
    }
  });

const createLayerStateOperationResult = (operationId: string) => ({
  operationId,
  operationType: "setEditorLayerState",
  status: "committed" as const,
  precondition: {
    ok: true
  },
  reversible: true
});

const createMeshCanvasPackageInput = (input: {
  readonly selection: readonly string[];
  readonly lockedIds?: readonly string[];
  readonly editorHiddenIds?: readonly string[];
}) => ({
  identity: {
    packageId: "pkg_mesh_canvas",
    packageDisplayName: "Mesh Canvas Package",
    formatVersion: "open-model-package-v1"
  },
  revision: {
    packageRevision: 1,
    authoringRevision: 1
  },
  editorState: {
    schemaVersion: "editor-state-v1",
    selection: [...input.selection],
    lockedIds: [...(input.lockedIds ?? [])],
    editorHiddenIds: [...(input.editorHiddenIds ?? [])]
  },
  drawables: [
    {
      drawableId: DrawableIdSchema.parse("draw_back"),
      displayName: "Back",
      partId: PartIdSchema.parse("part_root"),
      sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
      textureId: TextureIdSchema.parse("tex_back"),
      meshId: MeshIdSchema.parse("mesh_back"),
      defaultOpacity: 1,
      runtimeVisibility: false,
      baseDrawOrder: 0,
      sourceProvenanceId: ProvenanceIdSchema.parse("prov_mesh_canvas")
    },
    {
      drawableId: DrawableIdSchema.parse("draw_front"),
      displayName: "Front",
      partId: PartIdSchema.parse("part_root"),
      sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
      textureId: TextureIdSchema.parse("tex_front"),
      meshId: MeshIdSchema.parse("mesh_front"),
      defaultOpacity: 1,
      runtimeVisibility: true,
      baseDrawOrder: 1,
      sourceProvenanceId: ProvenanceIdSchema.parse("prov_mesh_canvas")
    }
  ],
  drawOrderEntries: [
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
  meshes: [
    {
      meshId: MeshIdSchema.parse("mesh_back"),
      drawableId: DrawableIdSchema.parse("draw_back"),
      vertices: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 4 }
      ],
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ],
      triangles: [[0, 1, 2]],
      vertexStableIds: ["vtx_back_0", "vtx_back_1", "vtx_back_2"],
      bounds: { x: 0, y: 0, width: 4, height: 4 },
      generationProvenanceId: ProvenanceIdSchema.parse("prov_mesh_canvas")
    },
    {
      meshId: MeshIdSchema.parse("mesh_front"),
      drawableId: DrawableIdSchema.parse("draw_front"),
      vertices: [
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 10, y: 20 }
      ],
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ],
      triangles: [[0, 1, 2]],
      vertexStableIds: ["vtx_front_0", "vtx_front_1", "vtx_front_2"],
      bounds: { x: 10, y: 10, width: 10, height: 10 },
      generationProvenanceId: ProvenanceIdSchema.parse("prov_mesh_canvas")
    }
  ]
} satisfies Parameters<typeof projectLoadedPackageState>[0]);
