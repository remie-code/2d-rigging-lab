import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { TUTORIAL_MINI_MODEL_IDS } from "@private-2d-rigging-lab/authoring-core";

import {
  createInitialEditorSemanticState,
  createEmptySourceIntakeDraftState,
  createDrawableMoveDownTestId,
  createDrawableMoveUpTestId,
  createDrawableRowTestId,
  createDrawableVisibilityToggleTestId,
  createLayerTreeDrawablePartDraftFormTestId,
  createLayerTreeDrawableTextureDraftFormTestId,
  createLayerTreeEmptyLeafDeleteDraftTestId,
  createLayerTreePartRenameFormTestId,
  createLayerTreePartReparentFormTestId,
  createMeshVertexNudgeButtonTestId,
  createPreviewParameterControlTestId,
  createProjectPersistenceTransportCapabilityRowTestId,
  createProjectPersistenceTransportUnavailableActionTestId,
  createRigControlRowTestId,
  createViewerParameterControlTestId,
  editorTestIds,
  projectEditorWorkflowViewModel,
  projectLoadedPackageState,
  type SourceIntakeDraftState
} from "../../editor-state/index.js";
import { createEditorWorkflowController } from "../../editor-workflow/workflow-controller.js";
import { createBrowserProjectStore, type StorageLike } from "../../project-persistence/index.js";
import { aiApprovalTestIds } from "../ai-approval/index.js";
import { aiTranscriptTestIds } from "../ai-transcript/index.js";
import { createEditorAppShell } from "./app-shell.js";
import { shellSurfaceDefinitions, shellSurfaces } from "./shell-surfaces.js";
import { workspaceContextSurfaceTestIds } from "./workspace-context-surfaces.js";

describe("editor app shell preview panel", () => {
  let originalFormData: typeof FormData | undefined;

  beforeEach(() => {
    installTestDocument();
    originalFormData = globalThis.FormData;
    (globalThis as unknown as { FormData: typeof FormData }).FormData =
      TestFormData as unknown as typeof FormData;
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
    if (originalFormData === undefined) {
      delete (globalThis as Partial<{ FormData: typeof FormData }>).FormData;
    } else {
      globalThis.FormData = originalFormData;
    }
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

  it("renders the tutorial workflow panel and wires tutorial actions", () => {
    const workflow = createWorkflow();
    workflow.createTutorialMiniModel();
    const calls: unknown[] = [];
    const shell = renderShell(workflow, {
      onCreateTutorialMiniModel() {
        calls.push(["create"]);
      },
      onApplyTutorialSmallEdit() {
        calls.push(["smallEdit"]);
      },
      onSelectTutorialTarget(target) {
        calls.push(["select", target]);
      }
    });

    expect(findByTestId(shell, editorTestIds.tutorialWorkflowPanel)?.textContent).toContain(
      "Tutorial Mini Model v0"
    );
    expect(findByTestId(shell, editorTestIds.tutorialWorkflowPanel)?.textContent).toContain(
      "In progress: 7 of 8 tutorial steps ready"
    );
    expect(findByTestId(shell, editorTestIds.tutorialWorkflowSteps)?.textContent).toContain(
      "Mask or opacity evidence"
    );
    expect(findByTestId(shell, editorTestIds.tutorialWorkflowNonGoals)?.textContent).toContain(
      "no full renderer"
    );

    findByTestId(shell, editorTestIds.tutorialWorkflowCreate)?.emit("click");
    findByTestId(shell, editorTestIds.tutorialWorkflowSmallEdit)?.emit("click");
    const targetSelect = findByTestId(shell, editorTestIds.tutorialWorkflowTargetSelect);
    targetSelect?.setProperty(
      "value",
      `drawable:${TUTORIAL_MINI_MODEL_IDS.drawables.frontHair}`
    );
    targetSelect?.emit("change");

    expect(calls).toEqual([
      ["create"],
      ["smallEdit"],
      [
        "select",
        {
          kind: "drawable",
          id: TUTORIAL_MINI_MODEL_IDS.drawables.frontHair
        }
      ]
    ]);
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

  it("routes warp lattice draft forms through production shell commit callbacks", () => {
    const createRigWorkflow = createWorkflow();
    const createShell = renderShell(createRigWorkflow, {
      onCommitCreateWarpLattice2dRigControl(command) {
        createRigWorkflow.commitCreateWarpLattice2dRigControl(command);
      }
    });
    const createForm = findByTestId(
      createShell,
      editorTestIds.rigControlWarpLatticeCreateDraftForm
    );
    if (createForm === null) {
      throw new Error("Expected warp lattice create draft form.");
    }

    setNamedFieldValue(createForm, "displayName", "Shell Warp Draft");
    setNamedFieldValue(createForm, "domainX", "8");
    setNamedFieldValue(createForm, "domainY", "12");
    setNamedFieldValue(createForm, "domainWidth", "64");
    setNamedFieldValue(createForm, "domainHeight", "48");
    createForm.emit("submit");

    expect(
      createRigWorkflow.state.rigControls.find(
        (rigControl) => rigControl.displayName === "Shell Warp Draft"
      )
    ).toMatchObject({
      kind: "warpLattice2d",
      domainBounds: { x: 8, y: 12, width: 64, height: 48 }
    });

    const bindRigWorkflow = createWorkflow();
    const bindShell = renderShell(bindRigWorkflow, {
      onCommitBindWarpLattice2dChild(command) {
        bindRigWorkflow.commitBindWarpLattice2dChild(command);
      }
    });
    const bindForm = findByTestId(
      bindShell,
      editorTestIds.rigControlWarpLatticeBindDraftForm
    );
    if (bindForm === null) {
      throw new Error("Expected warp lattice bind draft form.");
    }

    setNamedFieldValue(bindForm, "warpParentTarget", "draft:rig_warp_lattice_draft");
    setNamedFieldValue(bindForm, "childTarget", "drawable:draw_body");
    bindForm.emit("submit");

    expect(
      bindRigWorkflow.state.rigControls.find((rigControl) => rigControl.kind === "warpLattice2d")
        ?.childDrawableIds
    ).toContain("draw_body");

    const keyformRigWorkflow = createWorkflow();
    const keyformShell = renderShell(keyformRigWorkflow, {
      onCommitAddWarpLattice2dControlPointOffsetsKeyform(command) {
        keyformRigWorkflow.commitAddWarpLattice2dControlPointOffsetsKeyform(command);
      }
    });
    const keyformForm = findByTestId(
      keyformShell,
      editorTestIds.rigControlWarpLatticeKeyformDraftForm
    );
    if (keyformForm === null) {
      throw new Error("Expected warp lattice controlPointOffsets keyform draft form.");
    }

    setNamedFieldValue(keyformForm, "parameterId", "param_preview_body_yaw");
    setNamedFieldValue(keyformForm, "warpTarget", "draft:rig_warp_lattice_draft");
    setNamedFieldValue(keyformForm, "keyValue", "1");
    setNamedFieldValue(keyformForm, "compositionMode", "additiveDelta");
    setNamedFieldValue(keyformForm, "offsetX1", "3");
    setNamedFieldValue(keyformForm, "offsetY2", "-2");
    keyformForm.emit("submit");

    expect(keyformRigWorkflow.state.rigControlWarpLatticeKeyforms).toHaveLength(1);
    expect(keyformRigWorkflow.state.rigControlWarpLatticeKeyforms[0]).toMatchObject({
      rigControlId: "rig_2x2_warp_lattice_draft",
      parameterId: "param_preview_body_yaw",
      keyValue: 1,
      compositionMode: "additiveDelta"
    });
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

  it("keeps the manual drawable authoring route reachable from the support area", () => {
    const workflow = createWorkflow();
    const shell = renderShell(workflow);
    const support = findByShellSurfaceGroup(shell, "legacy-support");
    const panel = findByTestId(support ?? shell, editorTestIds.drawableAuthoringPanel);

    expect(support).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(panel?.dataset.shellSurfaceGroup).toBe("drawable-authoring");
    expect(panel?.textContent).toContain("Drawable Authoring");
    expect(findByTestId(panel ?? shell, editorTestIds.drawableCreateForm)).not.toBeNull();
    expect(findByTestId(panel ?? shell, editorTestIds.drawableCreateSubmit)).not.toBeNull();
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

  it("routes layer tree direct manipulation draft controls through production shell callbacks", () => {
    const workflow = createWorkflow();
    workflow.commitSourceIntakeDraft(createTextureSourceIntakeDraft());
    workflow.commitCreatePart({
      operationId: "op_shell_create_direct_head",
      partId: "part_shell_head",
      displayName: "Shell Head",
      parentPartId: "part_root"
    });
    const calls: unknown[] = [];
    const callbacks = {
      onDraftLayerTreePartRename(command) {
        calls.push(["rename", command]);
        workflow.draftLayerTreePartRename(command);
      },
      onDraftLayerTreePartReparent(command) {
        calls.push(["reparent", command]);
        workflow.draftLayerTreePartReparent(command);
      },
      onDraftLayerTreeEmptyLeafPartDelete(command) {
        calls.push(["delete", command]);
        workflow.draftLayerTreeEmptyLeafPartDelete(command);
      },
      onDraftLayerTreeDrawablePartAssignment(command) {
        calls.push(["drawablePart", command]);
        workflow.draftLayerTreeDrawablePartAssignment(command);
      },
      onDraftLayerTreeDrawableTextureAssignment(command) {
        calls.push(["drawableTexture", command]);
        workflow.draftLayerTreeDrawableTextureAssignment(command);
      },
      onCommitLayerTreeDirectManipulationDrafts() {
        calls.push(["commit"]);
      },
      onClearLayerTreeDirectManipulationDrafts() {
        calls.push(["clear"]);
      }
    } satisfies Parameters<typeof renderShell>[1];
    const shell = renderShell(workflow, callbacks);
    const renameForm = findByTestId(shell, createLayerTreePartRenameFormTestId("part_shell_head"));
    const reparentForm = findByTestId(shell, createLayerTreePartReparentFormTestId("part_shell_head"));
    const drawablePartForm = findByTestId(shell, createLayerTreeDrawablePartDraftFormTestId("draw_body"));
    const drawableTextureForm = findByTestId(shell, createLayerTreeDrawableTextureDraftFormTestId("draw_body"));

    renameForm?.querySelector("input")?.setProperty("value", "Shell Head Renamed");
    renameForm?.emit("submit");
    reparentForm?.querySelector("select")?.setProperty("value", "");
    reparentForm?.emit("submit");
    drawablePartForm?.querySelector("select")?.setProperty("value", "part_shell_head");
    drawablePartForm?.emit("submit");
    drawableTextureForm?.querySelector("select")?.setProperty("value", "tex_face");
    drawableTextureForm?.emit("submit");
    findByTestId(shell, createLayerTreeEmptyLeafDeleteDraftTestId("part_shell_head"))?.emit("click");

    const commitShell = renderShell(workflow, callbacks);
    findByTestId(commitShell, editorTestIds.layerTreeDirectDraftCommit)?.emit("click");
    findByTestId(commitShell, editorTestIds.layerTreeDirectDraftClear)?.emit("click");

    expect(calls).toEqual([
      ["rename", { partId: "part_shell_head", displayName: "Shell Head Renamed" }],
      ["reparent", { partId: "part_shell_head", parentPartId: null }],
      ["drawablePart", { drawableId: "draw_body", partId: "part_shell_head" }],
      ["drawableTexture", { drawableId: "draw_body", textureId: "tex_face" }],
      ["delete", { partId: "part_shell_head" }],
      ["commit"],
      ["clear"]
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

  it("renders the v0 authoring workspace skeleton with Preview centered", () => {
    const workflow = createWorkflow();
    const shell = renderShell(workflow);
    const workspace = findByClassName(shell, "editor-workspace");
    const canvasRegion = findByWorkspaceRegion(shell, "canvas-preview");
    const previewPanel = findByTestId(shell, editorTestIds.previewPanel);
    const partsTreeSurface = findByShellSurfaceGroup(shell, "parts-tree");

    expect(workspace?.dataset.shellSurfaceId).toBe(shellSurfaces.authoringWorkspace.id);
    expect(workspace?.dataset.shellSurfaceGroup).toBe("workspace-shell");
    expect(findByShellSurfaceGroup(shell, "workspace-v0")).not.toBeNull();
    expect(findByShellSurfaceGroup(shell, "toolbox")).not.toBeNull();
    expect(partsTreeSurface).not.toBeNull();
    expect(findByShellSurfaceGroup(shell, "canvas-preview")).not.toBeNull();
    expect(findByShellSurfaceGroup(shell, "inspector")).not.toBeNull();
    expect(findByShellSurfaceGroup(shell, "parameter-bar")).not.toBeNull();
    expect(findByShellSurfaceGroup(shell, "diagnostics-strip")).not.toBeNull();
    expect(findByShellSurfaceGroup(shell, "legacy-support")).not.toBeNull();

    expect(canvasRegion).not.toBeNull();
    expect(previewPanel).not.toBeNull();
    expect(previewPanel?.parentElement).toBe(canvasRegion);
    expect(findByTestId(canvasRegion ?? shell, editorTestIds.previewPanel)).not.toBeNull();
    expect(findByTestId(partsTreeSurface ?? shell, editorTestIds.layerTreePanel)).not.toBeNull();
    expect(findByTestId(partsTreeSurface ?? shell, editorTestIds.drawableList)).not.toBeNull();
    expect(findByTestId(shell, workspaceContextSurfaceTestIds.inspectorSurface)).not.toBeNull();
    expect(findByTestId(shell, workspaceContextSurfaceTestIds.parameterBarSurface)).not.toBeNull();
    expect(findByTestId(shell, workspaceContextSurfaceTestIds.diagnosticsStripSurface)).not.toBeNull();
  });

  it("registers the screen-design shell surfaces", () => {
    expect(shellSurfaceDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: shellSurfaces.authoringWorkspace.id,
          kind: "authoring-workspace",
          label: "Authoring Workspace"
        }),
        expect.objectContaining({
          id: shellSurfaces.psdImportTask.id,
          kind: "task",
          label: "PSD Import Task"
        }),
        expect.objectContaining({
          id: shellSurfaces.diagnosticsEvidenceView.id,
          kind: "view",
          label: "Diagnostics / Evidence View"
        }),
        expect.objectContaining({
          id: shellSurfaces.codexAutomationView.id,
          kind: "view",
          label: "Codex / Automation View"
        })
      ])
    );
  });

  it("renders a minimal PSD import task entry without appending the PSD panel by default", () => {
    const workflow = createWorkflow();
    const calls: string[] = [];
    const shell = renderShell(workflow, {
      onOpenPsdImportTask() {
        calls.push("open");
      }
    });
    const taskEntry = findByTestId(shell, editorTestIds.psdImportTaskOpen);
    const launcher = findByShellSurfaceGroup(shell, "toolbox");

    expect(findByTestId(launcher ?? shell, editorTestIds.psdImportTaskOpen)).toBe(taskEntry);
    expect(taskEntry?.getAttribute("aria-label")).toBe("Import PSD");
    expect(taskEntry?.getAttribute("aria-pressed")).toBe("false");
    expect(launcher?.dataset.shellSurfaceId).toBe(shellSurfaces.authoringWorkspace.id);
    expect(launcher?.dataset.shellSurfaceKind).toBe(shellSurfaces.authoringWorkspace.kind);
    expect(findByTestId(shell, editorTestIds.explicitPsdImportPanel)).toBeNull();

    taskEntry?.emit("click");

    expect(calls).toEqual(["open"]);
  });

  it("renders PSD import inside a task shell with focused-flow hooks and observation summary", () => {
    const workflow = createWorkflow();
    const calls: string[] = [];
    const shell = renderShell(workflow, {
      activeTask: "psdImport",
      onCloseActiveTask() {
        calls.push("close");
      }
    });
    const taskShell = findByShellSurfaceGroup(shell, "psd-import");
    const psdPanel = findByTestId(shell, editorTestIds.explicitPsdImportPanel);
    const taskEntry = findByTestId(shell, editorTestIds.psdImportTaskOpen);
    const status = findByTaskShellRegion(taskShell ?? shell, "status");
    const observation = findByAriaLabel(shell, "PSD import task observation summary");

    expect(taskEntry?.getAttribute("aria-pressed")).toBe("true");
    expect(taskShell?.dataset.taskShellRegion).toBe("root");
    expect(taskShell?.dataset.shellSurfaceId).toBe(shellSurfaces.psdImportTask.id);
    expect(taskShell?.dataset.shellSurfaceKind).toBe(shellSurfaces.psdImportTask.kind);
    expect(psdPanel).not.toBeNull();
    expect(psdPanel?.dataset.shellSurfaceId).toBe(shellSurfaces.psdImportTask.id);
    expect(findByTestId(psdPanel ?? shell, editorTestIds.explicitPsdImportForm)).not.toBeNull();
    expect(status?.textContent).toContain("No PSD source loaded.");
    expect(observation?.dataset.psdImportTaskSchemaVersion).toBe(
      "explicit-psd-import-task-observation-v1"
    );
    expect(observation?.dataset.psdImportTaskParseStatus).toBe("idle");
    expect(observation?.textContent).toContain("diagnosticsEvidenceView");

    findByAriaLabel(shell, "Back to authoring workspace")?.emit("click");
    findByAriaLabel(shell, "Close PSD import task")?.emit("click");

    expect(calls).toEqual(["close", "close"]);
  });

  it("classifies existing panels into named shell surfaces without moving workflows", () => {
    const workflow = createWorkflow();
    workflow.openViewerRuntimeSurface();
    const shell = renderShell(workflow);
    const workspace = findByClassName(shell, "editor-workspace");

    expect(workspace?.dataset.shellSurfaceId).toBe(shellSurfaces.authoringWorkspace.id);
    expect(workspace?.dataset.shellSurfaceKind).toBe(shellSurfaces.authoringWorkspace.kind);
    expect(workspace?.dataset.shellSurfaceGroup).toBe("workspace-shell");
    expect(findByShellSurfaceGroup(shell, "workspace-v0")?.dataset.shellSurfaceId).toBe(
      shellSurfaces.authoringWorkspace.id
    );
    expect(findByShellSurfaceGroup(shell, "legacy-support")?.dataset.shellSurfaceId).toBe(
      shellSurfaces.authoringWorkspace.id
    );

    expectPanelSurface(
      shell,
      editorTestIds.previewPanel,
      shellSurfaces.authoringWorkspace,
      "canvas-preview"
    );
    expectPanelSurface(
      shell,
      editorTestIds.layerTreePanel,
      shellSurfaces.authoringWorkspace,
      "parts-tree"
    );
    expectPanelSurface(
      shell,
      editorTestIds.drawableAuthoringPanel,
      shellSurfaces.authoringWorkspace,
      "drawable-authoring"
    );
    expect(findByTestId(shell, editorTestIds.explicitPsdImportPanel)).toBeNull();
    expect(findByShellSurfaceGroup(shell, "toolbox")?.dataset.shellSurfaceId).toBe(
      shellSurfaces.authoringWorkspace.id
    );
    expect(findByShellSurfaceGroup(shell, "inspector")?.dataset.shellSurfaceId).toBe(
      shellSurfaces.authoringWorkspace.id
    );
    expect(findByShellSurfaceGroup(shell, "parameter-bar")?.dataset.shellSurfaceId).toBe(
      shellSurfaces.authoringWorkspace.id
    );
    expect(findByShellSurfaceGroup(shell, "diagnostics-strip")?.dataset.shellSurfaceId).toBe(
      shellSurfaces.authoringWorkspace.id
    );
    expectPanelSurface(
      shell,
      editorTestIds.sourceIntakePanel,
      shellSurfaces.sourceIntakeTask,
      "source-intake"
    );
    expectPanelSurface(
      shell,
      editorTestIds.projectPersistencePanel,
      shellSurfaces.projectStorageTask,
      "project-persistence"
    );
    expectPanelSurface(
      shell,
      editorTestIds.productPreflightPanel,
      shellSurfaces.validationTask,
      "product-preflight"
    );
    expectPanelSurface(
      shell,
      editorTestIds.tutorialWorkflowPanel,
      shellSurfaces.tutorialTask,
      "tutorial-workflow"
    );
    expectPanelSurface(
      shell,
      editorTestIds.viewerRuntimePanel,
      shellSurfaces.viewerRuntimeView,
      "viewer-runtime"
    );
    expectPanelSurface(
      shell,
      editorTestIds.codexProposalReviewPanel,
      shellSurfaces.codexAutomationView,
      "proposal-review"
    );
    expectPanelSurface(
      shell,
      aiApprovalTestIds.panel,
      shellSurfaces.codexAutomationView,
      "ai-approval"
    );
    expectPanelSurface(
      shell,
      aiTranscriptTestIds.panel,
      shellSurfaces.codexAutomationView,
      "ai-transcript"
    );

    const diagnosticsSurface = findByShellSurfaceGroup(shell, "operation-persistence-evidence");
    expect(diagnosticsSurface?.dataset.shellSurfaceId).toBe(
      shellSurfaces.diagnosticsEvidenceView.id
    );
    expect(diagnosticsSurface?.dataset.shellSurfaceKind).toBe(
      shellSurfaces.diagnosticsEvidenceView.kind
    );
    expect(findByTestId(diagnosticsSurface ?? shell, editorTestIds.operationLogSummary)).not.toBeNull();
    expect(findByTestId(diagnosticsSurface ?? shell, editorTestIds.generatedEvidenceSummary)).not.toBeNull();
    expect(findByTestId(diagnosticsSurface ?? shell, editorTestIds.reloadSummary)).not.toBeNull();
  });

  it("renders Product Preflight and wires the run action", () => {
    const workflow = createWorkflow();
    const calls: string[] = [];
    const shell = renderShell(workflow, {
      onRunProductPreflight() {
        calls.push("run");
      }
    });

    expect(findByTestId(shell, editorTestIds.productPreflightPanel)?.textContent).toContain(
      "Product Preflight"
    );
    expect(findByTestId(shell, editorTestIds.productPreflightRun)?.disabled).toBe(false);

    findByTestId(shell, editorTestIds.productPreflightRun)?.emit("click");

    expect(calls).toEqual(["run"]);
  });

  it("renders truthful project transport capabilities with only portable JSON actions active", () => {
    const workflow = createWorkflow();
    const calls: unknown[] = [];
    const shell = renderShell(workflow, {
      onExportPortableBundle() {
        calls.push(["export"]);
      },
      onImportPortableBundleText(bundleText) {
        calls.push(["import", bundleText]);
      }
    });
    const capabilityList = findByTestId(
      shell,
      editorTestIds.projectPersistenceTransportCapabilityList
    );

    expect(findByTestId(shell, editorTestIds.projectPersistencePanel)?.textContent).toContain(
      "Export portable JSON"
    );
    expect(findByTestId(shell, editorTestIds.projectPersistencePanel)?.textContent).toContain(
      "Import portable JSON"
    );
    expect(findByTestId(shell, editorTestIds.projectPersistencePortableExport)?.disabled).toBe(false);
    expect(findByTestId(shell, editorTestIds.projectPersistencePortableImportInput)?.disabled).toBe(false);

    findByTestId(shell, editorTestIds.projectPersistencePortableExport)?.emit("click");

    const portableRow = findByTestId(
      shell,
      createProjectPersistenceTransportCapabilityRowTestId("projectDefinedJsonBundleV0")
    );
    expect(portableRow?.dataset.capabilityStatus).toBe("supported");
    expect(portableRow?.textContent).toContain("Supported / Available in this editor");
    expect(portableRow?.textContent).toContain("Issues: none");

    const expectedUnavailableRows = [
      ["standardArchiveZipV0", "dependency-gated"],
      ["fileSystemAccessApiV0", "future-gated"],
      ["directoryPickerV0", "future-gated"],
      ["dragDropFileIntakeV0", "future-gated"],
      ["nativeFilesystemPersistenceV0", "unsupported"]
    ] as const;

    for (const [capabilityId, status] of expectedUnavailableRows) {
      const row = findByTestId(
        shell,
        createProjectPersistenceTransportCapabilityRowTestId(capabilityId)
      );
      const unavailableAction = findByTestId(
        shell,
        createProjectPersistenceTransportUnavailableActionTestId(capabilityId)
      );

      expect(row?.dataset.capabilityStatus).toBe(status);
      expect(row?.textContent).toContain("Unavailable in this editor");
      expect(unavailableAction?.disabled).toBe(true);
      unavailableAction?.emit("click");
    }

    expect(capabilityList?.textContent).toContain("Standard ZIP package archive");
    expect(capabilityList?.textContent).toContain("File System Access API");
    expect(capabilityList?.textContent).toContain("Directory picker");
    expect(capabilityList?.textContent).toContain("Drag-drop file intake");
    expect(capabilityList?.textContent).not.toContain("ZIP/archive supported");
    expect(capabilityList?.textContent).not.toContain("filesystem supported");
    expect(capabilityList?.textContent).not.toContain("parser");
    expect(capabilityList?.textContent).not.toContain("decode");
    expect(calls).toEqual([["export"]]);
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
      onAddMeshVertex() {},
      onRemoveSelectedMeshVertex() {},
      onAddMeshTriangle() {},
      onRemoveMeshTriangle() {},
      onNudgeMeshUv() {},
      onCommitCreateDynamicsGroup() {},
      onCommitUpdateDynamicsGroup() {},
      onCommitCreateRotation2dRigControl() {},
      onCommitCreateWarpLattice2dRigControl() {},
      onCommitBindRigControlChild() {},
      onCommitBindWarpLattice2dChild() {},
      onCommitAddWarpLattice2dControlPointOffsetsKeyform() {},
      onCommitSetMaskRelation() {},
      onCommitAddDrawableOpacityKeyform() {},
      onRunDynamicsPreview() {},
      onResetDynamicsPreview() {},
      onConfirmSourceIntakeDraft() {},
      onParseExplicitPsdImportFile() {},
      onIntakeExplicitPsdLayer() {},
      onSaveProject() {},
      onLoadProject() {},
      onResetProject() {},
      onCreateTutorialMiniModel() {},
      onApplyTutorialSmallEdit() {},
      onSelectTutorialTarget() {},
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
      onAddMeshVertex() {},
      onRemoveSelectedMeshVertex() {},
      onAddMeshTriangle() {},
      onRemoveMeshTriangle() {},
      onNudgeMeshUv() {},
      onCommitCreateDynamicsGroup() {},
      onCommitUpdateDynamicsGroup() {},
      onCommitCreateRotation2dRigControl() {},
      onCommitCreateWarpLattice2dRigControl() {},
      onCommitBindRigControlChild() {},
      onCommitBindWarpLattice2dChild() {},
      onCommitAddWarpLattice2dControlPointOffsetsKeyform() {},
      onCommitSetMaskRelation() {},
      onCommitAddDrawableOpacityKeyform() {},
      onRunDynamicsPreview() {},
      onResetDynamicsPreview() {},
      onConfirmSourceIntakeDraft() {},
      onParseExplicitPsdImportFile() {},
      onIntakeExplicitPsdLayer() {},
      onSaveProject() {},
      onLoadProject() {},
      onResetProject() {},
      onCreateTutorialMiniModel() {},
      onApplyTutorialSmallEdit() {},
      onSelectTutorialTarget() {},
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
    readonly onAddMeshVertex?: Parameters<typeof createEditorAppShell>[0]["onAddMeshVertex"];
    readonly onRemoveSelectedMeshVertex?: Parameters<typeof createEditorAppShell>[0]["onRemoveSelectedMeshVertex"];
    readonly onAddMeshTriangle?: Parameters<typeof createEditorAppShell>[0]["onAddMeshTriangle"];
    readonly onRemoveMeshTriangle?: Parameters<typeof createEditorAppShell>[0]["onRemoveMeshTriangle"];
    readonly onNudgeMeshUv?: Parameters<typeof createEditorAppShell>[0]["onNudgeMeshUv"];
    readonly onRunDynamicsPreview?: (frameCount: number) => void;
    readonly onResetDynamicsPreview?: () => void;
    readonly onCommitCreateRotation2dRigControl?: Parameters<typeof createEditorAppShell>[0]["onCommitCreateRotation2dRigControl"];
    readonly onCommitCreateWarpLattice2dRigControl?: Parameters<typeof createEditorAppShell>[0]["onCommitCreateWarpLattice2dRigControl"];
    readonly onCommitBindRigControlChild?: Parameters<typeof createEditorAppShell>[0]["onCommitBindRigControlChild"];
    readonly onCommitBindWarpLattice2dChild?: Parameters<typeof createEditorAppShell>[0]["onCommitBindWarpLattice2dChild"];
    readonly onCommitAddWarpLattice2dControlPointOffsetsKeyform?: Parameters<typeof createEditorAppShell>[0]["onCommitAddWarpLattice2dControlPointOffsetsKeyform"];
    readonly onDraftLayerTreePartRename?: Parameters<typeof createEditorAppShell>[0]["onDraftLayerTreePartRename"];
    readonly onDraftLayerTreePartReparent?: Parameters<typeof createEditorAppShell>[0]["onDraftLayerTreePartReparent"];
    readonly onDraftLayerTreeEmptyLeafPartDelete?: Parameters<typeof createEditorAppShell>[0]["onDraftLayerTreeEmptyLeafPartDelete"];
    readonly onDraftLayerTreeDrawablePartAssignment?: Parameters<typeof createEditorAppShell>[0]["onDraftLayerTreeDrawablePartAssignment"];
    readonly onDraftLayerTreeDrawableTextureAssignment?: Parameters<typeof createEditorAppShell>[0]["onDraftLayerTreeDrawableTextureAssignment"];
    readonly onCommitLayerTreeDirectManipulationDrafts?: Parameters<typeof createEditorAppShell>[0]["onCommitLayerTreeDirectManipulationDrafts"];
    readonly onClearLayerTreeDirectManipulationDrafts?: Parameters<typeof createEditorAppShell>[0]["onClearLayerTreeDirectManipulationDrafts"];
    readonly onOpenViewerRuntimeSurface?: () => void;
    readonly onCloseViewerRuntimeSurface?: () => void;
    readonly onSetViewerParameterValue?: (parameterId: string, value: number) => void;
    readonly onResetViewerParameterValues?: () => void;
    readonly onCreateTutorialMiniModel?: () => void;
    readonly onApplyTutorialSmallEdit?: () => void;
    readonly onSelectTutorialTarget?: Parameters<typeof createEditorAppShell>[0]["onSelectTutorialTarget"];
    readonly onRunProductPreflight?: Parameters<typeof createEditorAppShell>[0]["onRunProductPreflight"];
    readonly onExportPortableBundle?: Parameters<typeof createEditorAppShell>[0]["onExportPortableBundle"];
    readonly onImportPortableBundleText?: Parameters<typeof createEditorAppShell>[0]["onImportPortableBundleText"];
    readonly activeTask?: Parameters<typeof createEditorAppShell>[0]["activeTask"];
    readonly onOpenPsdImportTask?: Parameters<typeof createEditorAppShell>[0]["onOpenPsdImportTask"];
    readonly onCloseActiveTask?: Parameters<typeof createEditorAppShell>[0]["onCloseActiveTask"];
  } = {}
): TestElement =>
  createEditorAppShell({
    state: workflow.state,
    viewModel: workflow.viewModel,
    previewProjection: workflow.previewProjection,
    viewerRuntimeProjection: workflow.viewerRuntimeProjection,
    latestPersistenceResult: workflow.latestSessionPersistenceResult,
    latestProjectPersistenceResult: workflow.latestProjectPersistenceResult,
    ...(callbacks.activeTask === undefined ? {} : { activeTask: callbacks.activeTask }),
    ...(callbacks.onOpenPsdImportTask === undefined
      ? {}
      : { onOpenPsdImportTask: callbacks.onOpenPsdImportTask }),
    ...(callbacks.onCloseActiveTask === undefined
      ? {}
      : { onCloseActiveTask: callbacks.onCloseActiveTask }),
    onCommitCreateParameter() {},
    onCommitCreateDrawablePreset() {},
    onCommitCreatePart() {},
    onCommitUpdatePart() {},
    onCommitSetDrawablePart() {},
    onCommitSetDrawableTexture() {},
    ...(callbacks.onDraftLayerTreePartRename === undefined
      ? {}
      : { onDraftLayerTreePartRename: callbacks.onDraftLayerTreePartRename }),
    ...(callbacks.onDraftLayerTreePartReparent === undefined
      ? {}
      : { onDraftLayerTreePartReparent: callbacks.onDraftLayerTreePartReparent }),
    ...(callbacks.onDraftLayerTreeEmptyLeafPartDelete === undefined
      ? {}
      : { onDraftLayerTreeEmptyLeafPartDelete: callbacks.onDraftLayerTreeEmptyLeafPartDelete }),
    ...(callbacks.onDraftLayerTreeDrawablePartAssignment === undefined
      ? {}
      : { onDraftLayerTreeDrawablePartAssignment: callbacks.onDraftLayerTreeDrawablePartAssignment }),
    ...(callbacks.onDraftLayerTreeDrawableTextureAssignment === undefined
      ? {}
      : { onDraftLayerTreeDrawableTextureAssignment: callbacks.onDraftLayerTreeDrawableTextureAssignment }),
    ...(callbacks.onCommitLayerTreeDirectManipulationDrafts === undefined
      ? {}
      : { onCommitLayerTreeDirectManipulationDrafts: callbacks.onCommitLayerTreeDirectManipulationDrafts }),
    ...(callbacks.onClearLayerTreeDirectManipulationDrafts === undefined
      ? {}
      : { onClearLayerTreeDirectManipulationDrafts: callbacks.onClearLayerTreeDirectManipulationDrafts }),
    onSelectDrawableLayer() {},
    onToggleDrawableLayerLock() {},
    onToggleDrawableEditorHidden() {},
    onToggleDrawableRuntimeVisibility: callbacks.onToggleDrawableRuntimeVisibility ?? (() => {}),
    onMoveDrawableLayer: callbacks.onMoveDrawableLayer ?? (() => {}),
    onNudgeMeshVertex: callbacks.onNudgeMeshVertex ?? (() => {}),
    onSelectMeshCanvasVertex: callbacks.onSelectMeshCanvasVertex ?? (() => {}),
    onNudgeMeshCanvasSelection: callbacks.onNudgeMeshCanvasSelection ?? (() => {}),
    onDragMeshCanvasSelection: callbacks.onDragMeshCanvasSelection ?? (() => {}),
    onAddMeshVertex: callbacks.onAddMeshVertex ?? (() => {}),
    onRemoveSelectedMeshVertex: callbacks.onRemoveSelectedMeshVertex ?? (() => {}),
    onAddMeshTriangle: callbacks.onAddMeshTriangle ?? (() => {}),
    onRemoveMeshTriangle: callbacks.onRemoveMeshTriangle ?? (() => {}),
    onNudgeMeshUv: callbacks.onNudgeMeshUv ?? (() => {}),
    onCommitCreateDynamicsGroup() {},
    onCommitUpdateDynamicsGroup() {},
    onCommitCreateRotation2dRigControl: callbacks.onCommitCreateRotation2dRigControl ?? (() => {}),
    onCommitCreateWarpLattice2dRigControl:
      callbacks.onCommitCreateWarpLattice2dRigControl ?? (() => {}),
    onCommitBindRigControlChild: callbacks.onCommitBindRigControlChild ?? (() => {}),
    onCommitBindWarpLattice2dChild: callbacks.onCommitBindWarpLattice2dChild ?? (() => {}),
    onCommitAddWarpLattice2dControlPointOffsetsKeyform:
      callbacks.onCommitAddWarpLattice2dControlPointOffsetsKeyform ?? (() => {}),
    onCommitSetMaskRelation() {},
    onCommitAddDrawableOpacityKeyform() {},
    onRunDynamicsPreview: callbacks.onRunDynamicsPreview ?? (() => {}),
    onResetDynamicsPreview: callbacks.onResetDynamicsPreview ?? (() => {}),
    onConfirmSourceIntakeDraft() {},
    onParseExplicitPsdImportFile() {},
    onIntakeExplicitPsdLayer() {},
    onSaveProject() {},
    onLoadProject() {},
    onResetProject() {},
    ...(callbacks.onRunProductPreflight === undefined
      ? {}
      : { onRunProductPreflight: callbacks.onRunProductPreflight }),
    ...(callbacks.onExportPortableBundle === undefined
      ? {}
      : { onExportPortableBundle: callbacks.onExportPortableBundle }),
    ...(callbacks.onImportPortableBundleText === undefined
      ? {}
      : { onImportPortableBundleText: callbacks.onImportPortableBundleText }),
    onCreateTutorialMiniModel: callbacks.onCreateTutorialMiniModel ?? (() => {}),
    onApplyTutorialSmallEdit: callbacks.onApplyTutorialSmallEdit ?? (() => {}),
    onSelectTutorialTarget: callbacks.onSelectTutorialTarget ?? (() => {}),
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

const findByClassName = (root: TestElement, className: string): TestElement | null =>
  root.queryByPredicate((element) => element.className.split(" ").includes(className));

const findByShellSurfaceGroup = (root: TestElement, group: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.shellSurfaceGroup === group);

const findByWorkspaceRegion = (root: TestElement, region: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.workspaceRegion === region);

const findByTaskShellRegion = (root: TestElement, region: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.taskShellRegion === region);

const findByAriaLabel = (root: TestElement, ariaLabel: string): TestElement | null =>
  root.queryByPredicate((element) => element.getAttribute("aria-label") === ariaLabel);

const findByTag = (root: TestElement, tagName: string): TestElement | null =>
  root.queryByPredicate((element) => element.tagName === tagName);

const findDrawableShape = (root: TestElement, drawableId: string): TestElement | null =>
  root.queryByPredicate((element) => element.getAttribute("data-drawable-id") === drawableId);

const expectPanelSurface = (
  root: TestElement,
  testId: string,
  surface: (typeof shellSurfaces)[keyof typeof shellSurfaces],
  group: string
): void => {
  const panel = findByTestId(root, testId);

  expect(panel).not.toBeNull();
  expect(panel?.dataset.shellSurfaceId).toBe(surface.id);
  expect(panel?.dataset.shellSurfaceKind).toBe(surface.kind);
  expect(panel?.dataset.shellSurfaceGroup).toBe(group);
};

const setNamedFieldValue = (
  root: TestElement,
  name: string,
  value: string
): void => {
  const field = root.queryByPredicate((element) => element.name === name);
  if (field === null) {
    throw new Error(`Missing field ${name}.`);
  }

  field.value = value;
  field.valueWasSet = true;
};

class TestFormData {
  private readonly values = new Map<string, string>();

  constructor(form: TestElement) {
    for (const field of form.queryAllByPredicate((element) => element.name.length > 0)) {
      if (field.type === "checkbox" && !field.checked) {
        continue;
      }

      this.values.set(field.name, readFormFieldValue(field));
    }
  }

  get(name: string): string | null {
    return this.values.get(name) ?? null;
  }
}

const readFormFieldValue = (field: TestElement): string => {
  if (field.tagName !== "select") {
    return field.type === "checkbox" ? "on" : field.value;
  }

  if (field.valueWasSet || field.value.length > 0) {
    return field.value;
  }

  const selected = field.children.find((child) => child.selected) ?? field.children[0];
  return selected?.value ?? "";
};

class TestElement {
  readonly children: TestElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: { preventDefault(): void }) => void>>();
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
  autocomplete = "";
  required = false;
  disabled = false;
  checked = false;
  selected = false;
  valueWasSet = false;
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

  addEventListener(type: string, listener: (event: { preventDefault(): void }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string): void {
    const event = {
      preventDefault() {}
    };
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
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

  queryAllByPredicate(predicate: (element: TestElement) => boolean): readonly TestElement[] {
    return [
      ...(predicate(this) ? [this] : []),
      ...this.children.flatMap((child) => child.queryAllByPredicate(predicate))
    ];
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
