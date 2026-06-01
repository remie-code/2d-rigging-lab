import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  createInitialEditorSemanticState,
  createEmptySourceIntakeDraftState,
  createDrawableMoveDownTestId,
  createDrawableMoveUpTestId,
  createDrawableRowTestId,
  createDrawableVisibilityToggleTestId,
  createMeshVertexNudgeButtonTestId,
  createPreviewParameterControlTestId,
  createRigControlRowTestId,
  createViewerParameterControlTestId,
  editorTestIds,
  projectEditorWorkflowViewModel,
  projectLoadedPackageState,
  type SourceIntakeDraftState
} from "../../editor-state/index.js";
import { createEditorWorkflowController } from "../../editor-workflow/workflow-controller.js";
import { createBrowserProjectStore, type StorageLike } from "../../project-persistence/index.js";
import { createEditorAppShell } from "./app-shell.js";

describe("editor app shell preview panel", () => {
  beforeEach(() => {
    installTestDocument();
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
  });

  it("renders the embedded preview panel from runtime projection and preview controls", () => {
    const workflow = createWorkflow();
    const shell = renderShell(workflow);

    expect(findByTestId(shell, editorTestIds.previewPanel)?.textContent).toContain("Preview");
    expect(findByTestId(shell, editorTestIds.previewSummary)?.textContent).toContain("1 visible / 1 total");
    expect(findByTestId(shell, editorTestIds.previewVisual)?.textContent).not.toContain("No runtime drawables");
    expect(findByTestId(shell, createPreviewParameterControlTestId("param_preview_body_yaw"))?.getAttribute("aria-label")).toBe(
      "Preview Body Yaw"
    );
  });

  it("keeps package-local texture preview references as truthful solid fallbacks", () => {
    const workflow = createWorkflow();
    const imported = workflow.commitSourceIntakeDraft(createTextureSourceIntakeDraft());
    const drawable = workflow.commitCreateDrawablePreset({
      createOperationId: "op_workflow_create_drawable_imported_face",
      generateOperationId: "op_workflow_generate_mesh_imported_face",
      displayName: "Workflow Imported Face",
      sourceAssetId: workflow.state.pendingCreateDrawable.sourceAssetId,
      ...(workflow.state.pendingCreateDrawable.sourceLayerId === null
        ? {}
        : { sourceLayerId: workflow.state.pendingCreateDrawable.sourceLayerId }),
      partId: workflow.state.pendingCreateDrawable.partId,
      initialBounds: workflow.state.pendingCreateDrawable.initialBounds,
      meshMethod: "auto-grid-v1",
      densityHint: "medium"
    });
    const shell = renderShell(workflow);
    const texturedShape = findDrawableShape(shell, "draw_workflow_imported_face");
    const fallbackShape = findDrawableShape(shell, "draw_body");

    expect(imported.status).toBe("committed");
    expect(drawable.status).toBe("committed");
    expect(texturedShape?.getAttribute("fill")).toBe("#4c8d87");
    expect(texturedShape?.getAttribute("data-texture-render")).toBe("solid_fallback");
    expect(texturedShape?.getAttribute("data-texture-id")).toBe("tex_face");
    expect(texturedShape?.textContent).toContain("package-local texture preview not browser materialized");
    expect(findByTag(shell, "image")).toBeNull();
    expect(fallbackShape?.getAttribute("data-texture-render")).toBe("solid_fallback");
    expect(findByTestId(shell, editorTestIds.previewSummary)?.textContent).toContain(
      "0 pattern / 2 fallback"
    );
    expect(findByTestId(shell, editorTestIds.previewSummary)?.textContent).toContain(
      "1 package-local unavailable"
    );
    expect(findByTestId(shell, editorTestIds.previewVisual)?.getAttribute("aria-label")).toContain(
      "0 texture pattern, 2 texture fallback"
    );
  });

  it("renders deterministic data URL texture preview references as SVG patterns", () => {
    const workflow = createWorkflow();
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    workflow.commitSourceIntakeDraft(createTextureSourceIntakeDraft({ texturePreviewReference: dataUrl }));
    workflow.commitCreateDrawablePreset({
      createOperationId: "op_workflow_create_drawable_imported_face",
      generateOperationId: "op_workflow_generate_mesh_imported_face",
      displayName: "Workflow Imported Face",
      sourceAssetId: workflow.state.pendingCreateDrawable.sourceAssetId,
      ...(workflow.state.pendingCreateDrawable.sourceLayerId === null
        ? {}
        : { sourceLayerId: workflow.state.pendingCreateDrawable.sourceLayerId }),
      partId: workflow.state.pendingCreateDrawable.partId,
      initialBounds: workflow.state.pendingCreateDrawable.initialBounds,
      meshMethod: "auto-grid-v1",
      densityHint: "medium"
    });

    const shell = renderShell(workflow);
    const texturedShape = findDrawableShape(shell, "draw_workflow_imported_face");

    expect(texturedShape?.getAttribute("fill")).toBe("url(#preview-texture-draw_workflow_imported_face)");
    expect(texturedShape?.getAttribute("data-texture-render")).toBe("texture_pattern");
    expect(findByTag(shell, "image")?.getAttribute("href")).toBe(dataUrl);
    expect(findByTestId(shell, editorTestIds.previewSummary)?.textContent).toContain(
      "1 pattern / 1 fallback"
    );
  });

  it("renders drawable authoring alongside the embedded preview", () => {
    const workflow = createWorkflow();
    workflow.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const shell = renderShell(workflow);

    expect(findByTestId(shell, editorTestIds.previewPanel)?.textContent).toContain("Preview");
    expect(findByTestId(shell, editorTestIds.drawableAuthoringPanel)?.textContent).toContain("Drawable Authoring");
    expect(findByTestId(shell, createDrawableRowTestId("draw_body"))?.textContent).toContain("Body");
    expect(findByTestId(shell, createDrawableRowTestId("draw_workflow_star"))?.textContent).toContain(
      "Workflow Star"
    );
    expect(findByTestId(shell, editorTestIds.drawableResult)?.textContent).toContain(
      "Drawable preset committed"
    );
  });

  it("renders dynamics authoring and wires preview controls", () => {
    const workflow = createWorkflow();
    workflow.commitCreateDynamicsGroup(createDynamicsGroupCommand("hair"));
    workflow.setPreviewParameterValue("param_preview_body_yaw", 1);
    workflow.runDynamicsPreview(2);
    const calls: unknown[] = [];
    const shell = renderShell(workflow, {
      onRunDynamicsPreview(frameCount) {
        calls.push(["run", frameCount]);
      },
      onResetDynamicsPreview() {
        calls.push(["reset"]);
      }
    });

    expect(findByTestId(shell, editorTestIds.dynamicsPanel)?.textContent).toContain("Dynamics");
    expect(findByTestId(shell, editorTestIds.dynamicsCreateForm)?.textContent).toContain("Create group");
    expect(findByTestId(shell, editorTestIds.dynamicsPreviewOutputs)?.textContent).toContain(
      "param_dynamics_workflow_hair_sway_r0"
    );
    expect(findByTestId(shell, editorTestIds.dynamicsPreviewEvidence)?.textContent).toContain(
      "val_editor_browser_sample_editorIncremental"
    );
    expect(findByTestId(shell, editorTestIds.dynamicsValidatorDiagnostics)?.textContent).toContain(
      "Validator Diagnostics"
    );

    findByTestId(shell, editorTestIds.dynamicsPreviewRun)?.emit("click");
    findByTestId(shell, editorTestIds.dynamicsPreviewReset)?.emit("click");

    expect(calls).toEqual([
      ["run", 8],
      ["reset"]
    ]);
  });

  it("opens the Viewer / Runtime surface and renders snapshot evidence", () => {
    const workflow = createWorkflow();
    workflow.openViewerRuntimeSurface();
    const shell = renderShell(workflow);

    expect(findByTestId(shell, editorTestIds.viewerRuntimePanel)?.textContent).toContain("Viewer / Runtime");
    expect(findByTestId(shell, editorTestIds.viewerRuntimeSnapshotSummary)?.textContent).toContain("viewer");
    expect(findByTestId(shell, editorTestIds.viewerRuntimeDiff)?.textContent).toContain("Runtime Diff");
    expect(findByTestId(shell, editorTestIds.viewerRuntimeDiagnostics)?.textContent).toContain(
      "val_editor_browser_sample_editorIncremental"
    );
    expect(findByTestId(shell, editorTestIds.viewerRuntimePackageState)?.textContent).toContain(
      "pkg_editor_browser_sample"
    );
  });

  it("renders rig control authoring with preview and viewer runtime evidence", () => {
    const workflow = createWorkflow();
    workflow.commitCreateRotation2dRigControl(createRotationRigControlCommand());
    workflow.commitBindRigControlChild({
      parentRigControlId: "rig_workflow_body_rotation",
      child: { kind: "drawable", id: "draw_body" }
    });
    workflow.openViewerRuntimeSurface();
    const shell = renderShell(workflow);

    expect(findByTestId(shell, editorTestIds.rigControlPanel)?.textContent).toContain(
      "Project-defined Rig Controls"
    );
    expect(findByTestId(shell, createRigControlRowTestId("rig_workflow_body_rotation"))?.textContent).toContain(
      "draw_body"
    );
    expect(findByTestId(shell, editorTestIds.rigControlEvidence)?.textContent).toContain(
      "rig_workflow_body_rotation"
    );
    expect(findByTestId(shell, editorTestIds.viewerRuntimeSnapshotSummary)?.textContent).toContain(
      "1 evaluated / 1 total"
    );
  });

  it("wires Viewer / Runtime open, close, slider, and reset callbacks", () => {
    const workflow = createWorkflow();
    const closedCalls: unknown[] = [];
    const closedShell = renderShell(workflow, {
      onOpenViewerRuntimeSurface() {
        closedCalls.push(["open"]);
      }
    });

    findByTestId(closedShell, editorTestIds.viewerRuntimeOpen)?.emit("click");
    expect(closedCalls).toEqual([["open"]]);

    workflow.openViewerRuntimeSurface();
    const calls: unknown[] = [];
    const shell = renderShell(workflow, {
      onOpenViewerRuntimeSurface() {
        calls.push(["open"]);
      },
      onCloseViewerRuntimeSurface() {
        calls.push(["close"]);
      },
      onSetViewerParameterValue(parameterId, value) {
        calls.push(["set", parameterId, value]);
      },
      onResetViewerParameterValues() {
        calls.push(["reset"]);
      }
    });

    findByTestId(shell, editorTestIds.viewerRuntimeOpen)?.emit("click");
    const slider = findByTestId(shell, createViewerParameterControlTestId("param_preview_body_yaw"));
    expect(slider?.getAttribute("aria-label")).toBe("Viewer Preview Body Yaw");
    slider?.setProperty("value", "1");
    slider?.emit("input");
    findByTestId(shell, editorTestIds.viewerRuntimeReset)?.emit("click");
    findByTestId(shell, editorTestIds.viewerRuntimeClose)?.emit("click");

    expect(calls).toEqual([
      ["close"],
      ["set", "param_preview_body_yaw", 1],
      ["reset"],
      ["close"]
    ]);
  });

  it("renders source intake draft controls without moving drawable authoring out of the shell", () => {
    const workflow = createWorkflow();
    const shell = renderShell(workflow);

    expect(findByTestId(shell, editorTestIds.sourceIntakePanel)?.textContent).toContain("Source Intake");
    expect(findByTestId(shell, editorTestIds.sourceIntakeForm)?.getAttribute("aria-label")).toBe(
      "Confirm source intake adapter profile draft"
    );
    expect(findByTestId(shell, editorTestIds.drawableAuthoringPanel)?.textContent).toContain("Drawable Authoring");
    expect(findByTestId(shell, editorTestIds.meshVertexControls)?.textContent).toContain("Mesh Vertex Controls");
  });

  it("wires slider and reset callbacks", () => {
    const workflow = createWorkflow();
    const calls: Array<readonly [string, number]> = [];
    let resetCount = 0;
    const shell = renderShell(workflow, {
      onSetPreviewParameterValue(parameterId, value) {
        calls.push([parameterId, value]);
      },
      onResetPreviewParameterValues() {
        resetCount += 1;
      }
    });

    const slider = findByTestId(shell, createPreviewParameterControlTestId("param_preview_body_yaw"));
    expect(slider).not.toBeNull();
    slider?.setProperty("value", "1");
    slider?.emit("input");
    findByTestId(shell, editorTestIds.previewReset)?.emit("click");

    expect(calls).toEqual([["param_preview_body_yaw", 1]]);
    expect(resetCount).toBe(1);
  });

  it("wires drawable layer callbacks from the authoring list", () => {
    const workflow = createWorkflow();
    workflow.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const calls: unknown[] = [];
    const shell = renderShell(workflow, {
      onToggleDrawableRuntimeVisibility(drawableId) {
        calls.push(["toggle", drawableId]);
      },
      onMoveDrawableLayer(drawableId, direction) {
        calls.push(["move", drawableId, direction]);
      }
    });

    findByTestId(shell, createDrawableVisibilityToggleTestId("draw_body"))?.emit("click");
    findByTestId(shell, createDrawableMoveUpTestId("draw_body"))?.emit("click");
    findByTestId(shell, createDrawableMoveDownTestId("draw_workflow_star"))?.emit("click");

    expect(calls).toEqual([
      ["toggle", "draw_body"],
      ["move", "draw_body", "up"],
      ["move", "draw_workflow_star", "down"]
    ]);
  });

  it("wires mesh vertex nudge callbacks from the authoring controls", () => {
    const workflow = createWorkflow();
    workflow.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const selectedMesh = workflow.viewModel.meshEdit.selectedMesh;
    const vertex = workflow.viewModel.meshEdit.editableVertices[0];
    const calls: unknown[] = [];

    if (selectedMesh === null || vertex === undefined) {
      throw new Error("Expected generated drawable mesh controls to expose an editable vertex.");
    }

    const shell = renderShell(workflow, {
      onNudgeMeshVertex(command) {
        calls.push(command);
      }
    });

    findByTestId(
      shell,
      createMeshVertexNudgeButtonTestId(selectedMesh.meshId, vertex.vertexId, "right")
    )?.emit("click");

    expect(calls).toEqual([vertex.nudgeCommands.right]);
  });

  it("updates the preview visual and mesh edit status after a vertex nudge", () => {
    const workflow = createWorkflow();
    workflow.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const selectedMesh = workflow.viewModel.meshEdit.selectedMesh;
    const vertex = workflow.viewModel.meshEdit.editableVertices[0];
    const initialShell = renderShell(workflow);
    const initialPoints =
      selectedMesh === null ? null : findDrawableShape(initialShell, selectedMesh.drawableId)?.getAttribute("points");

    if (selectedMesh === null || vertex === undefined) {
      throw new Error("Expected generated drawable mesh controls to expose an editable vertex.");
    }

    renderShell(workflow, {
      onNudgeMeshVertex(command) {
        workflow.nudgeMeshVertex(command);
      }
    })
      .queryByPredicate(
        (element) =>
          element.dataset.testid ===
          createMeshVertexNudgeButtonTestId(selectedMesh.meshId, vertex.vertexId, "right")
      )
      ?.emit("click");

    const updatedShell = renderShell(workflow);

    expect(findDrawableShape(updatedShell, selectedMesh.drawableId)?.getAttribute("points")).not.toBe(
      initialPoints
    );
    expect(findByTestId(updatedShell, editorTestIds.previewSummary)?.textContent).toContain("2 visible / 2 total");
    expect(findByTestId(updatedShell, editorTestIds.meshVertexStatus)?.textContent).toContain(
      "moveMeshVertex committed"
    );
  });

  it("updates preview summary after a drawable visibility action", () => {
    const workflow = createWorkflow();
    workflow.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    expect(findByTestId(renderShell(workflow), editorTestIds.previewSummary)?.textContent).toContain(
      "2 visible / 2 total"
    );

    workflow.toggleDrawableRuntimeVisibility("draw_workflow_star");
    const shell = renderShell(workflow);

    expect(findByTestId(shell, editorTestIds.previewSummary)?.textContent).toContain("1 visible / 2 total");
    expect(findByTestId(shell, createDrawableVisibilityToggleTestId("draw_workflow_star"))?.getAttribute("aria-label")).toBe(
      "Show Workflow Star"
    );
  });

  it("marks first and last drawable move buttons disabled", () => {
    const workflow = createWorkflow();
    workflow.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const shell = renderShell(workflow);

    expect(findByTestId(shell, createDrawableMoveDownTestId("draw_body"))?.disabled).toBe(true);
    expect(findByTestId(shell, createDrawableMoveUpTestId("draw_body"))?.disabled).toBe(false);
    expect(findByTestId(shell, createDrawableMoveDownTestId("draw_workflow_star"))?.disabled).toBe(false);
    expect(findByTestId(shell, createDrawableMoveUpTestId("draw_workflow_star"))?.disabled).toBe(true);
  });

  it("keeps preview and drawable layer controls in the same shell", () => {
    const workflow = createWorkflow();
    const shell = renderShell(workflow);

    expect(findByTestId(shell, editorTestIds.previewPanel)).not.toBeNull();
    expect(findByTestId(shell, editorTestIds.drawableList)).not.toBeNull();
  });

  it("updates the projected visual and summary after a preview parameter change", () => {
    const workflow = createWorkflow();
    const initialShell = renderShell(workflow);
    const initialPoints = findByTag(initialShell, "polygon")?.getAttribute("points");

    workflow.setPreviewParameterValue("param_preview_body_yaw", 1);
    const updatedShell = renderShell(workflow);

    expect(findByTag(updatedShell, "polygon")?.getAttribute("points")).not.toBe(initialPoints);
    expect(findByTestId(updatedShell, editorTestIds.previewSummary)?.textContent).toContain("2 changes");
  });

  it("renders no-preview and disabled-control states without throwing", () => {
    const state = projectLoadedPackageState({
      identity: {
        packageId: "pkg_disabled_preview",
        packageDisplayName: "Disabled Preview",
        formatVersion: "open-model-package-v1"
      },
      revision: {
        packageRevision: 0,
        authoringRevision: 0
      },
      parameters: [
        {
          parameterId: "param_computed",
          displayName: "Computed",
          valueSource: "computedDynamics",
          min: -1,
          max: 1,
          default: 0,
          recommendedUiStep: 0.01
        }
      ]
    });
    const shell = createEditorAppShell({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      previewProjection: null,
      viewerRuntimeProjection: null,
      latestPersistenceResult: null,
      latestProjectPersistenceResult: null,
      onCommitCreateParameter() {},
      onCommitCreateDrawablePreset() {},
      onCommitCreatePart() {},
      onCommitUpdatePart() {},
      onCommitSetDrawablePart() {},
      onCommitSetDrawableTexture() {},
      onSelectDrawableLayer() {},
      onToggleDrawableLayerLock() {},
      onToggleDrawableEditorHidden() {},
      onToggleDrawableRuntimeVisibility() {},
      onMoveDrawableLayer() {},
      onNudgeMeshVertex() {},
      onSelectMeshCanvasVertex() {},
      onNudgeMeshCanvasSelection() {},
      onDragMeshCanvasSelection() {},
      onCommitCreateDynamicsGroup() {},
      onCommitUpdateDynamicsGroup() {},
      onCommitCreateRotation2dRigControl() {},
      onCommitBindRigControlChild() {},
      onCommitSetMaskRelation() {},
      onCommitAddDrawableOpacityKeyform() {},
      onRunDynamicsPreview() {},
      onResetDynamicsPreview() {},
      onConfirmSourceIntakeDraft() {},
      onSaveProject() {},
      onLoadProject() {},
      onResetProject() {},
      onSetPreviewParameterValue() {},
      onResetPreviewParameterValues() {},
      onOpenViewerRuntimeSurface() {},
      onCloseViewerRuntimeSurface() {},
      onSetViewerParameterValue() {},
      onResetViewerParameterValues() {},
      async onDryRunAiCreateParameter() {},
      async onApproveLatestAiDryRun() {},
      async onRejectLatestAiDryRun() {},
      async onCommitApprovedAiOperation() {}
    }) as unknown as TestElement;

    expect(findByTestId(shell, editorTestIds.previewSummary)?.textContent).toContain("No preview snapshot");
    expect(findByTestId(shell, createPreviewParameterControlTestId("param_computed"))?.disabled).toBe(true);
    expect(findByTestId(shell, editorTestIds.previewReset)?.disabled).toBe(true);
  });

  it("renders an empty preview control state", () => {
    const state = createInitialEditorSemanticState();
    const shell = createEditorAppShell({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      previewProjection: null,
      viewerRuntimeProjection: null,
      latestPersistenceResult: null,
      latestProjectPersistenceResult: null,
      onCommitCreateParameter() {},
      onCommitCreateDrawablePreset() {},
      onCommitCreatePart() {},
      onCommitUpdatePart() {},
      onCommitSetDrawablePart() {},
      onCommitSetDrawableTexture() {},
      onSelectDrawableLayer() {},
      onToggleDrawableLayerLock() {},
      onToggleDrawableEditorHidden() {},
      onToggleDrawableRuntimeVisibility() {},
      onMoveDrawableLayer() {},
      onNudgeMeshVertex() {},
      onSelectMeshCanvasVertex() {},
      onNudgeMeshCanvasSelection() {},
      onDragMeshCanvasSelection() {},
      onCommitCreateDynamicsGroup() {},
      onCommitUpdateDynamicsGroup() {},
      onCommitCreateRotation2dRigControl() {},
      onCommitBindRigControlChild() {},
      onCommitSetMaskRelation() {},
      onCommitAddDrawableOpacityKeyform() {},
      onRunDynamicsPreview() {},
      onResetDynamicsPreview() {},
      onConfirmSourceIntakeDraft() {},
      onSaveProject() {},
      onLoadProject() {},
      onResetProject() {},
      onSetPreviewParameterValue() {},
      onResetPreviewParameterValues() {},
      onOpenViewerRuntimeSurface() {},
      onCloseViewerRuntimeSurface() {},
      onSetViewerParameterValue() {},
      onResetViewerParameterValues() {},
      async onDryRunAiCreateParameter() {},
      async onApproveLatestAiDryRun() {},
      async onRejectLatestAiDryRun() {},
      async onCommitApprovedAiOperation() {}
    }) as unknown as TestElement;

    expect(findByTestId(shell, editorTestIds.previewEmpty)?.textContent).toBe("No package loaded");
  });
});

const renderShell = (
  workflow: ReturnType<typeof createEditorWorkflowController>,
  callbacks: {
    readonly onSetPreviewParameterValue?: (parameterId: string, value: number) => void;
    readonly onResetPreviewParameterValues?: () => void;
    readonly onToggleDrawableRuntimeVisibility?: (drawableId: string) => void;
    readonly onMoveDrawableLayer?: (drawableId: string, direction: "up" | "down") => void;
    readonly onNudgeMeshVertex?: Parameters<typeof createEditorAppShell>[0]["onNudgeMeshVertex"];
    readonly onSelectMeshCanvasVertex?: Parameters<typeof createEditorAppShell>[0]["onSelectMeshCanvasVertex"];
    readonly onNudgeMeshCanvasSelection?: Parameters<typeof createEditorAppShell>[0]["onNudgeMeshCanvasSelection"];
    readonly onDragMeshCanvasSelection?: Parameters<typeof createEditorAppShell>[0]["onDragMeshCanvasSelection"];
    readonly onRunDynamicsPreview?: (frameCount: number) => void;
    readonly onResetDynamicsPreview?: () => void;
    readonly onCommitCreateRotation2dRigControl?: Parameters<typeof createEditorAppShell>[0]["onCommitCreateRotation2dRigControl"];
    readonly onCommitBindRigControlChild?: Parameters<typeof createEditorAppShell>[0]["onCommitBindRigControlChild"];
    readonly onOpenViewerRuntimeSurface?: () => void;
    readonly onCloseViewerRuntimeSurface?: () => void;
    readonly onSetViewerParameterValue?: (parameterId: string, value: number) => void;
    readonly onResetViewerParameterValues?: () => void;
  } = {}
): TestElement =>
  createEditorAppShell({
    state: workflow.state,
    viewModel: workflow.viewModel,
    previewProjection: workflow.previewProjection,
    viewerRuntimeProjection: workflow.viewerRuntimeProjection,
    latestPersistenceResult: workflow.latestSessionPersistenceResult,
    latestProjectPersistenceResult: workflow.latestProjectPersistenceResult,
    onCommitCreateParameter() {},
    onCommitCreateDrawablePreset() {},
    onCommitCreatePart() {},
    onCommitUpdatePart() {},
    onCommitSetDrawablePart() {},
    onCommitSetDrawableTexture() {},
    onSelectDrawableLayer() {},
    onToggleDrawableLayerLock() {},
    onToggleDrawableEditorHidden() {},
    onToggleDrawableRuntimeVisibility: callbacks.onToggleDrawableRuntimeVisibility ?? (() => {}),
    onMoveDrawableLayer: callbacks.onMoveDrawableLayer ?? (() => {}),
    onNudgeMeshVertex: callbacks.onNudgeMeshVertex ?? (() => {}),
    onSelectMeshCanvasVertex: callbacks.onSelectMeshCanvasVertex ?? (() => {}),
    onNudgeMeshCanvasSelection: callbacks.onNudgeMeshCanvasSelection ?? (() => {}),
    onDragMeshCanvasSelection: callbacks.onDragMeshCanvasSelection ?? (() => {}),
    onCommitCreateDynamicsGroup() {},
    onCommitUpdateDynamicsGroup() {},
    onCommitCreateRotation2dRigControl: callbacks.onCommitCreateRotation2dRigControl ?? (() => {}),
    onCommitBindRigControlChild: callbacks.onCommitBindRigControlChild ?? (() => {}),
    onCommitSetMaskRelation() {},
    onCommitAddDrawableOpacityKeyform() {},
    onRunDynamicsPreview: callbacks.onRunDynamicsPreview ?? (() => {}),
    onResetDynamicsPreview: callbacks.onResetDynamicsPreview ?? (() => {}),
    onConfirmSourceIntakeDraft() {},
    onSaveProject() {},
    onLoadProject() {},
    onResetProject() {},
    onSetPreviewParameterValue: callbacks.onSetPreviewParameterValue ?? (() => {}),
    onResetPreviewParameterValues: callbacks.onResetPreviewParameterValues ?? (() => {}),
    onOpenViewerRuntimeSurface: callbacks.onOpenViewerRuntimeSurface ?? (() => {}),
    onCloseViewerRuntimeSurface: callbacks.onCloseViewerRuntimeSurface ?? (() => {}),
    onSetViewerParameterValue: callbacks.onSetViewerParameterValue ?? (() => {}),
    onResetViewerParameterValues: callbacks.onResetViewerParameterValues ?? (() => {}),
    async onDryRunAiCreateParameter() {},
    async onApproveLatestAiDryRun() {},
    async onRejectLatestAiDryRun() {},
    async onCommitApprovedAiOperation() {}
  }) as unknown as TestElement;

const createWorkflow = () =>
  createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage: createMemoryStorage(),
      now: () => new Date("2026-05-30T00:00:00.000Z")
    }),
    now: () => new Date("2026-05-30T00:00:00.000Z")
  });

const createDrawablePresetCommand = (name: "star") => ({
  createOperationId: `op_workflow_create_drawable_${name}`,
  generateOperationId: `op_workflow_generate_mesh_${name}`,
  displayName: `Workflow ${name.slice(0, 1).toUpperCase()}${name.slice(1)}`,
  sourceAssetId: "src_generated",
  sourceLayerId: "layer_body",
  partId: "part_root",
  initialBounds: { x: 16, y: 24, width: 24, height: 24 },
  meshMethod: "auto-grid-v1",
  densityHint: "low"
} as const);

const createDynamicsGroupCommand = (name: "hair") => ({
  operationId: `op_workflow_create_dynamics_${name}`,
  outputParameterOperationId: `op_workflow_create_dynamics_output_${name}`,
  dynamicsGroupId: "dyn_workflow_hair_sway",
  displayName: "Workflow Hair Sway",
  driverParameterId: "param_preview_body_yaw",
  outputParameterDisplayName: "Workflow Hair Sway",
  outputMin: -1,
  outputMax: 1,
  outputScale: 1,
  outputOffset: 0,
  resetPolicy: "reset-on-manual-command",
  enabled: true,
  stiffness: 0.25,
  damping: 0.35,
  maxVelocity: 2,
  maxAmplitude: 1
} as const);

const createRotationRigControlCommand = () => ({
  operationId: "op_workflow_create_rotation2d_body",
  displayName: "Workflow Body Rotation",
  partId: "part_root",
  pivot: { x: 50, y: 56 },
  restAngleDegrees: 15
} as const);

const createTextureSourceIntakeDraft = (
  input: {
    readonly texturePreviewReference?: string;
  } = {}
): SourceIntakeDraftState => ({
  ...createEmptySourceIntakeDraftState({ defaultPartId: "part_root" }),
  status: "confirmed",
  sourceAssetId: "src_workflow_split",
  manifestPath: "assets/sources/workflow/split-manifest.json",
  contentHash: "sha256:workflow-split",
  defaultPartId: "part_root",
  placementPolicy: "use-metadata",
  layers: [
    {
      sourceLayerId: "layer_face",
      originalName: "Face.png",
      normalizedName: "face",
      groupPath: ["Head"],
      bounds: { x: 8, y: 10, width: 96, height: 112 },
      visibleInSource: true,
      opacityInSource: 1,
      role: "editableLayer",
      unsupportedFeatures: [],
      texturePreviewReference: input.texturePreviewReference ?? "assets/textures/workflow/face.preview.png",
      textureId: "tex_face",
      targetPartId: "part_root"
    }
  ],
  rights: {
    rightsStatus: "cleared",
    creator: "Workflow Artist",
    license: "private-cleared",
    redistributionAllowed: false,
    aiUsed: false,
    sourceUrl: "https://example.invalid/workflow-source",
    notes: "workflow source intake test"
  },
  diagnostics: []
});

const findByTestId = (root: TestElement, testId: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.testid === testId);

const findByTag = (root: TestElement, tagName: string): TestElement | null =>
  root.queryByPredicate((element) => element.tagName === tagName);

const findDrawableShape = (root: TestElement, drawableId: string): TestElement | null =>
  root.queryByPredicate((element) => element.getAttribute("data-drawable-id") === drawableId);

class TestElement {
  readonly children: TestElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<() => void>>();
  readonly style: Record<string, string> = {};
  readonly classList = {
    add: (...classNames: string[]) => {
      this.className = [...new Set([...this.className.split(" ").filter(Boolean), ...classNames])].join(" ");
    }
  };
  parentElement: TestElement | null = null;
  className = "";
  id = "";
  htmlFor = "";
  type = "";
  min = "";
  max = "";
  step = "";
  value = "";
  name = "";
  required = false;
  disabled = false;
  private ownText = "";

  constructor(readonly tagName: string) {}

  get textContent(): string {
    return `${this.ownText}${this.children.map((child) => child.textContent).join("")}`;
  }

  set textContent(value: string | null) {
    this.ownText = value ?? "";
    this.children.splice(0, this.children.length);
  }

  append(...nodes: Array<TestElement | string>): void {
    for (const node of nodes) {
      if (typeof node === "string") {
        const text = new TestElement("#text");
        text.textContent = node;
        this.append(text);
        continue;
      }

      node.parentElement = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes: TestElement[]): void {
    this.children.splice(0, this.children.length);
    this.append(...nodes);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === "aria-label" || name === "role") {
      return;
    }
    if (name === "id") {
      this.id = value;
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }

  setProperty(name: "value", value: string): void {
    this[name] = value;
  }

  queryByPredicate(predicate: (element: TestElement) => boolean): TestElement | null {
    if (predicate(this)) {
      return this;
    }

    for (const child of this.children) {
      const match = child.queryByPredicate(predicate);
      if (match !== null) {
        return match;
      }
    }

    return null;
  }

  querySelector(selector: string): TestElement | null {
    return this.queryByPredicate((element) => element.tagName === selector);
  }
}

const installTestDocument = (): void => {
  const document = {
    createElement(tagName: string) {
      return new TestElement(tagName);
    },
    createElementNS(_namespace: string, tagName: string) {
      return new TestElement(tagName);
    }
  };

  (globalThis as unknown as { document: Document }).document = document as unknown as Document;
};

const createMemoryStorage = (): StorageLike => {
  const values = new Map<string, string>();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    }
  };
};
