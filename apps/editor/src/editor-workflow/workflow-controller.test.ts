import { describe, expect, it } from "vitest";
import type { PackageDocumentDto } from "@private-2d-rigging-lab/package-format";

import { createBrowserProjectStore } from "../project-persistence/index.js";
import type { StorageLike } from "../project-persistence/index.js";
import { createEditorWorkflowController } from "./workflow-controller.js";

describe("editor workflow controller", () => {
  it("restores parameter and reload summary after commit, save, and load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    first.commitCreateParameter(createParameterCommand("smile"));
    const saved = first.saveProject();

    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(saved.status).toBe("saved");
    expect(loaded.status).toBe("loaded");
    expect(second.state.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parameterId: "param_workflow_smile",
        displayName: "Workflow Smile"
      })
    ]));
    expect(second.state.reload).toMatchObject({
      status: "reloaded",
      packageRevision: 1,
      parameterCount: second.state.parameters.length,
      parameterIds: expect.arrayContaining(["param_workflow_smile"])
    });
    expect(second.state.operationLog.entryCount).toBe(1);
    expect(second.state.generatedEvidence.validationReportArtifactPaths).toEqual(
      expect.arrayContaining([
        "validation/reports/val_editor_workflow_create_parameter_smile_baseline.validation.json",
        "validation/reports/val_editor_workflow_create_parameter_smile_candidate.validation.json"
      ])
    );
  });

  it("commits a generated drawable preset and restores it after save and load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    const commit = first.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const saved = first.saveProject();
    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(commit.status).toBe("committed");
    expect(commit.finalPersistenceResult.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh"
    ]);
    expect(first.state.operationLog.entryCount).toBe(2);
    expect(first.state.drawables).toEqual(expect.arrayContaining([
      expect.objectContaining({
        drawableId: "draw_workflow_star",
        displayName: "Workflow Star",
        meshId: "mesh_workflow_star",
        vertexCount: 4,
        triangleCount: 2
      })
    ]));
    expect(first.viewModel.drawableAuthoring).toMatchObject({
      canSubmitCreateDrawable: true,
      drawableCountLabel: "2 drawables",
      resultLabel: "Drawable preset committed"
    });
    expect(first.previewProjection?.drawables.map((drawable) => drawable.drawableId)).toContain(
      "draw_workflow_star"
    );
    expect(saved.snapshot.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh"
    ]);
    expect(saved.snapshot.packageFilePaths).toEqual(expect.arrayContaining([
      "model/drawables.json",
      "model/meshes.json",
      "operations/log.jsonl"
    ]));
    expect(loaded.status).toBe("loaded");
    expect(drawableIds(second)).toEqual(expect.arrayContaining(["draw_workflow_star"]));
    expect(second.state.operationLog.entryCount).toBe(2);
    expect(second.state.reload).toMatchObject({
      status: "reloaded",
      packageRevision: 2,
      drawableCount: 2,
      drawableIds: expect.arrayContaining(["draw_workflow_star"])
    });
  });

  it("toggles drawable visibility, reorders layers, and restores layer state after save and load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    first.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const hidden = first.toggleDrawableRuntimeVisibility("draw_body");
    const moved = first.moveDrawableLayer("draw_body", "up");
    const saved = first.saveProject();
    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(hidden.status).toBe("committed");
    expect(moved.status).toBe("committed");
    expect(first.state.drawables.map((drawable) => ({
      drawableId: drawable.drawableId,
      visible: drawable.visible,
      baseDrawOrder: drawable.baseDrawOrder,
      orderIndex: drawable.orderIndex,
      canMoveLayerUp: drawable.canMoveLayerUp,
      canMoveLayerDown: drawable.canMoveLayerDown
    }))).toEqual([
      {
        drawableId: "draw_workflow_star",
        visible: true,
        baseDrawOrder: 0,
        orderIndex: 0,
        canMoveLayerUp: true,
        canMoveLayerDown: false
      },
      {
        drawableId: "draw_body",
        visible: false,
        baseDrawOrder: 1,
        orderIndex: 1,
        canMoveLayerUp: false,
        canMoveLayerDown: true
      }
    ]);
    expect(first.state.operationLog.entryCount).toBe(4);
    expect(first.viewModel.drawableLayers).toMatchObject({
      hasMultipleDrawables: true,
      layerCountLabel: "2 layers",
      lastLayerOperationLabel: "setDrawOrder committed",
      orderedDrawables: [
        {
          drawableId: "draw_workflow_star",
          runtimeVisibilityLabel: "Visible",
          canMoveUp: true,
          canMoveDown: false
        },
        {
          drawableId: "draw_body",
          runtimeVisibilityLabel: "Hidden",
          canMoveUp: false,
          canMoveDown: true
        }
      ]
    });
    expect(first.previewProjection).toMatchObject({
      drawList: ["draw_workflow_star"],
      visibleDrawableCount: 1
    });
    expect(first.previewProjection?.drawables).toEqual(expect.arrayContaining([
      expect.objectContaining({
        drawableId: "draw_body",
        visible: false
      })
    ]));
    expect(saved.snapshot.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh",
      "setRuntimeVisibility",
      "setDrawOrder"
    ]);
    expect(saved.snapshot.document.model.drawables.drawables).toContainEqual(
      expect.objectContaining({
        drawableId: "draw_body",
        runtimeVisibility: false,
        baseDrawOrder: 1
      })
    );
    expect(saved.snapshot.document.model.drawOrder.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          drawableId: "draw_workflow_star",
          baseDrawOrder: 0,
          stableOrder: 0
        }),
        expect.objectContaining({
          drawableId: "draw_body",
          baseDrawOrder: 1,
          stableOrder: 1
        })
      ])
    );
    expect(loaded.status).toBe("loaded");
    expect(second.state.drawables.map((drawable) => ({
      drawableId: drawable.drawableId,
      visible: drawable.visible,
      baseDrawOrder: drawable.baseDrawOrder,
      orderIndex: drawable.orderIndex
    }))).toEqual([
      {
        drawableId: "draw_workflow_star",
        visible: true,
        baseDrawOrder: 0,
        orderIndex: 0
      },
      {
        drawableId: "draw_body",
        visible: false,
        baseDrawOrder: 1,
        orderIndex: 1
      }
    ]);
    expect(second.previewProjection).toMatchObject({
      drawList: ["draw_workflow_star"],
      visibleDrawableCount: 1
    });
    expect(second.previewProjection?.drawables).toEqual(expect.arrayContaining([
      expect.objectContaining({
        drawableId: "draw_body",
        visible: false
      })
    ]));
  });

  it("nudges an editable mesh vertex and restores vertex coordinates after save and load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    first.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const selectedMesh = first.viewModel.meshEdit.selectedMesh;
    const vertex = first.viewModel.meshEdit.editableVertices[0];
    if (selectedMesh === null || vertex === undefined) {
      throw new Error("Expected generated drawable mesh to expose an editable vertex.");
    }

    const nudged = first.nudgeMeshVertex(vertex.nudgeCommands.right);
    const saved = first.saveProject();
    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(selectedMesh).toMatchObject({
      meshId: "mesh_workflow_star",
      drawableId: "draw_workflow_star"
    });
    expect(nudged.status).toBe("committed");
    expect(first.state.meshEdit.editableVertices[0]).toMatchObject({
      vertexId: "vtx_workflow_star_0_0",
      position: { x: 17, y: 24 }
    });
    expect(first.viewModel.meshEdit).toMatchObject({
      canNudgeSelectedMesh: true,
      lastMeshEditResultLabel: "moveMeshVertex committed"
    });
    expect(saved.snapshot.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh",
      "moveMeshVertex"
    ]);
    expect(saved.snapshot.packageFileSet.find((entry) => entry.path === "operations/log.jsonl")?.text).toContain(
      "moveMeshVertex"
    );
    expect(findMeshVertex(saved.snapshot.document, "mesh_workflow_star", 0)).toEqual({ x: 17, y: 24 });
    expect(loaded.status).toBe("loaded");
    expect(second.state.operationLog.entryCount).toBe(3);
    expect(second.state.meshEdit.selectedMesh).toMatchObject({
      meshId: "mesh_workflow_star",
      drawableId: "draw_workflow_star"
    });
    expect(second.state.meshEdit.editableVertices[0]).toMatchObject({
      vertexId: "vtx_workflow_star_0_0",
      position: { x: 17, y: 24 }
    });
  });

  it("does not commit an operation when a layer move is not available", () => {
    const workflow = createWorkflow(createMemoryStorage());

    expect(workflow.moveDrawableLayer("draw_body", "down")).toEqual({
      status: "not_movable",
      drawableId: "draw_body",
      direction: "down"
    });
    expect(workflow.moveDrawableLayer("draw_missing", "up")).toEqual({
      status: "not_found",
      drawableId: "draw_missing"
    });
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.latestSessionPersistenceResult).toBeNull();
  });

  it("keeps committed drawable state visible when a duplicate preset create is rejected", () => {
    const workflow = createWorkflow(createMemoryStorage());
    const command = createDrawablePresetCommand("star");

    workflow.commitCreateDrawablePreset(command);
    const rejected = workflow.commitCreateDrawablePreset({
      ...command,
      createOperationId: "op_workflow_create_drawable_star_duplicate",
      generateOperationId: "op_workflow_generate_mesh_star_duplicate"
    });

    expect(rejected.status).toBe("rejected");
    expect(rejected.generateMesh).toBeNull();
    expect(workflow.state.pendingCreateDrawable.status).toBe("rejected");
    expect(workflow.state.drawables).toEqual(expect.arrayContaining([
      expect.objectContaining({
        drawableId: "draw_workflow_star",
        meshId: "mesh_workflow_star"
      })
    ]));
    expect(workflow.state.operationLog.entryCount).toBe(2);
    expect(workflow.viewModel.drawableAuthoring).toMatchObject({
      drawableCountLabel: "2 drawables",
      resultLabel: "Drawable preset rejected with 2 diagnostics"
    });
    expect(workflow.previewProjection?.drawables.map((drawable) => drawable.drawableId)).toContain(
      "draw_workflow_star"
    );
  });

  it("appends operation log entries after loading a persisted project", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);
    first.commitCreateParameter(createParameterCommand("smile"));
    first.saveProject();

    const second = createWorkflow(storage);
    second.loadProject();
    const commit = second.commitCreateParameter(createParameterCommand("brow"));

    expect(commit.operationLogEntries.map((entry) => entry.operationId)).toEqual([
      "op_workflow_create_parameter_smile",
      "op_workflow_create_parameter_brow"
    ]);
    expect(commit.operationLogJsonl.trim().split("\n")).toHaveLength(2);
    expect(second.state.operationLog.entryCount).toBe(2);
    expect(parameterIds(second)).toEqual(expect.arrayContaining([
      "param_workflow_smile",
      "param_workflow_brow"
    ]));
  });

  it("sets and resets preview parameter values without committing operations", () => {
    const workflow = createWorkflow(createMemoryStorage());
    workflow.commitCreateParameter(createParameterCommand("smile"));
    const sessionResultBeforePreview = workflow.latestSessionPersistenceResult;

    const set = workflow.setPreviewParameterValue("param_workflow_smile", 0.75);

    expect(set).toEqual({
      status: "updated",
      parameterId: "param_workflow_smile",
      requestedValue: 0.75,
      currentValue: 0.75
    });
    expect(workflow.state.previewParameters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parameterId: "param_workflow_smile",
        defaultValue: 0,
        currentValue: 0.75
      })
    ]));
    expect(workflow.viewModel.previewControls.parameterControls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parameterId: "param_workflow_smile",
        currentValue: 0.75,
        valueLabel: "Workflow Smile: 0.75"
      })
    ]));
    expect(workflow.latestSessionPersistenceResult).toBe(sessionResultBeforePreview);
    expect(workflow.state.operationLog.entryCount).toBe(1);

    const reset = workflow.resetPreviewParameterValues();

    expect(reset).toEqual({
      status: "reset",
      parameterCount: workflow.state.previewParameters.length
    });
    expect(workflow.state.previewParameters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parameterId: "param_workflow_smile",
        currentValue: 0
      })
    ]));
    expect(workflow.state.operationLog.entryCount).toBe(1);
  });

  it("keeps preview parameter updates out of package documents and operation logs", () => {
    const workflow = createWorkflow(createMemoryStorage());
    const commit = workflow.commitCreateParameter(createParameterCommand("smile"));

    workflow.setPreviewParameterValue("param_workflow_smile", 0.6);
    const saved = workflow.saveProject();

    expect(saved.snapshot.operationLogJsonl).toBe(commit.operationLogJsonl);
    expect(saved.snapshot.document.model.parameters.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parameterId: "param_workflow_smile",
        default: 0
      })
    ]));
    expect(JSON.stringify(saved.snapshot.document)).not.toContain("0.6");
    expect(saved.snapshot.packageRevision).toBe(commit.packageRevisionAfterCommit);
    expect(workflow.state.operationLog.entryCount).toBe(1);
  });

  it("initializes preview parameter values from persisted package defaults on load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);
    first.commitCreateParameter(createParameterCommand("smile"));
    first.setPreviewParameterValue("param_workflow_smile", 0.9);
    first.saveProject();

    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(loaded.status).toBe("loaded");
    expect(second.state.previewParameters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parameterId: "param_workflow_smile",
        defaultValue: 0,
        currentValue: 0
      })
    ]));
  });

  it("rejects missing and invalid preview parameter updates", () => {
    const workflow = createWorkflow(createMemoryStorage());

    expect(workflow.setPreviewParameterValue("param_missing", 0.5)).toEqual({
      status: "not_found",
      parameterId: "param_missing",
      requestedValue: 0.5
    });
    expect(workflow.setPreviewParameterValue("param_missing", Number.NaN)).toEqual({
      status: "invalid_value",
      parameterId: "param_missing",
      requestedValue: Number.NaN
    });
  });

  it("clears persisted state and returns to the sample package on reset", () => {
    const storage = createMemoryStorage();
    const workflow = createWorkflow(storage);
    workflow.commitCreateParameter(createParameterCommand("smile"));
    workflow.saveProject();

    const reset = workflow.resetToSamplePackage();

    expect(reset.status).toBe("reset");
    expect(workflow.state.loadedPackage?.packageId).toBe("pkg_editor_browser_sample");
    expect(workflow.state.revision.packageRevision).toBe(0);
    expect(parameterIds(workflow)).not.toContain("param_workflow_smile");
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.state.reload.status).toBe("not_reloaded");
    expect(storage.getItem(reset.clearResult.storageKey)).toBeNull();
  });

  it("dry-runs deterministic AI createParameter and leaves package state unmutated", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    const initialParameters = workflow.state.parameters;

    const dryRun = await workflow.dryRunAiCreateParameterCommand();

    expect(dryRun.status).toBe("pending_approval");
    expect(dryRun.response).toMatchObject({
      status: "ok",
      command: "dryRunOperation",
      payload: {
        operationResult: {
          status: "dry_run",
          operationId: "op_editor_ai_create_parameter_r0_1"
        }
      }
    });
    expect(workflow.state.parameters).toEqual(initialParameters);
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.viewModel.aiApproval).toMatchObject({
      status: "pending_approval",
      latestDryRunCommandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
      latestDryRunOperationId: "op_editor_ai_create_parameter_r0_1",
      canApproveLatestDryRun: true,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: true
    });
  });

  it("rejects and clears a pending AI dry-run without mutating package state", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    const initialParameters = workflow.state.parameters;
    await workflow.dryRunAiCreateParameterCommand();

    const rejected = workflow.rejectLatestAiDryRun();

    expect(rejected.status).toBe("cleared");
    expect(workflow.state.parameters).toEqual(initialParameters);
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.viewModel.aiApproval).toMatchObject({
      status: "idle",
      latestDryRunCommandId: null,
      latestDryRunOperationId: null,
      canApproveLatestDryRun: false,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: false
    });
  });

  it("approves and commits an AI dry-run through operation-core", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    await workflow.dryRunAiCreateParameterCommand();

    const approval = workflow.approveLatestAiDryRun();
    const committed = await workflow.commitApprovedAiOperation();

    expect(approval.status).toBe("approved");
    expect(committed.status).toBe("committed");
    expect(committed.response).toMatchObject({
      status: "ok",
      command: "commitOperation",
      payload: {
        operationResult: {
          status: "committed",
          operationId: "op_editor_ai_create_parameter_r0_1"
        }
      }
    });
    expect(parameterIds(workflow)).toEqual(expect.arrayContaining(["param_editor_ai_r0_1"]));
    expect(workflow.state.operationLog).toMatchObject({
      entryCount: 1,
      latestEntry: expect.objectContaining({
        operationId: "op_editor_ai_create_parameter_r0_1",
        operationType: "createParameter",
        surface: "structuredApi"
      })
    });
    expect(workflow.viewModel.aiApproval).toMatchObject({
      status: "idle",
      canApproveLatestDryRun: false,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: false
    });
  });

  it("does not let stale approval survive reset", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    await workflow.dryRunAiCreateParameterCommand();
    workflow.approveLatestAiDryRun();

    workflow.resetToSamplePackage();
    const committed = await workflow.commitApprovedAiOperation();

    expect(committed.status).toBe("no_approved_operation");
    expect(parameterIds(workflow)).not.toContain("param_editor_ai_r0_1");
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.viewModel.aiApproval.status).toBe("idle");
    expect(workflow.viewModel.aiApproval.transcriptEntries).toEqual([]);
  });

  it("does not let pending approval survive an empty load", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    const initialParameters = workflow.state.parameters;
    await workflow.dryRunAiCreateParameterCommand();

    const loaded = workflow.loadProject();

    expect(loaded.status).toBe("empty");
    expect(workflow.viewModel.aiApproval.status).toBe("idle");
    expect(workflow.viewModel.aiApproval.transcriptEntries).toEqual([]);
    expect(workflow.state.parameters).toEqual(initialParameters);
    expect(workflow.state.operationLog.entryCount).toBe(0);
  });

  it("summarizes AI command and approval transcript entries for the view model", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    await workflow.dryRunAiCreateParameterCommand();

    workflow.approveLatestAiDryRun();

    expect(workflow.viewModel.aiApproval.transcriptEntries).toEqual([
      expect.objectContaining({
        entryType: "command",
        commandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        command: "dryRunOperation",
        status: "ok",
        operationId: "op_editor_ai_create_parameter_r0_1",
        evidenceCount: 6
      }),
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        approvalStatus: "approved",
        operationId: "op_editor_ai_create_parameter_r0_1",
        evidenceCount: 0
      })
    ]);
  });

  it("saves a non-empty AI transcript and restores it into the loaded view model", async () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    await first.dryRunAiCreateParameterCommand();
    first.approveLatestAiDryRun();
    const saved = first.saveProject();

    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(saved.storeResult.project.aiCommandTranscript.entries).toEqual([
      expect.objectContaining({
        entryType: "command",
        commandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        command: "dryRunOperation",
        status: "ok",
        operationId: "op_editor_ai_create_parameter_r0_1"
      }),
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        approvalStatus: "approved",
        operationId: "op_editor_ai_create_parameter_r0_1"
      })
    ]);
    expect(loaded.status).toBe("loaded");
    expect(second.viewModel.aiApproval).toMatchObject({
      status: "idle",
      canApproveLatestDryRun: false,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: false
    });
    expect(second.viewModel.aiApproval.transcriptEntries).toEqual([
      expect.objectContaining({
        entryType: "command",
        commandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        command: "dryRunOperation",
        status: "ok",
        operationId: "op_editor_ai_create_parameter_r0_1"
      }),
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        approvalStatus: "approved",
        operationId: "op_editor_ai_create_parameter_r0_1"
      })
    ]);
  });

  it("loads AI transcript history without restoring actionable approval state", async () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);
    await first.dryRunAiCreateParameterCommand();
    first.approveLatestAiDryRun();
    first.saveProject();

    const second = createWorkflow(storage);
    second.loadProject();

    const approval = second.approveLatestAiDryRun();
    const commit = await second.commitApprovedAiOperation();

    expect(second.viewModel.aiApproval.transcriptEntries).toHaveLength(2);
    expect(approval.status).toBe("no_pending_dry_run");
    expect(commit.status).toBe("no_approved_operation");
    expect(second.viewModel.aiApproval).toMatchObject({
      status: "idle",
      canApproveLatestDryRun: false,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: false
    });
    expect(parameterIds(second)).not.toContain("param_editor_ai_r0_1");
    expect(second.state.operationLog.entryCount).toBe(0);
  });
});

const createWorkflow = (storage: StorageLike) =>
  createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage,
      now: () => new Date("2026-05-29T04:00:00.000Z")
    }),
    now: () => new Date("2026-05-29T04:00:00.000Z")
  });

const parameterIds = (
  workflow: ReturnType<typeof createEditorWorkflowController>
): readonly string[] => workflow.state.parameters.map((parameter) => parameter.parameterId);

const drawableIds = (
  workflow: ReturnType<typeof createEditorWorkflowController>
): readonly string[] => workflow.state.drawables.map((drawable) => drawable.drawableId);

const findMeshVertex = (
  document: PackageDocumentDto,
  meshId: string,
  vertexIndex: number
) => document.model.meshes.meshes.find((mesh) => mesh.meshId === meshId)?.vertices[vertexIndex];

const createParameterCommand = (name: "smile" | "brow") => ({
  operationId: `op_workflow_create_parameter_${name}`,
  parameterId: `param_workflow_${name}`,
  displayName: `Workflow ${capitalize(name)}`,
  semanticRole: name === "smile" ? "mouth" : "brow",
  projectPresetAlias: `private-workflow-${name}-control`,
  min: 0,
  max: 1,
  defaultValue: 0,
  recommendedUiStep: 0.01
} as const);

const createDrawablePresetCommand = (name: "star") => ({
  createOperationId: `op_workflow_create_drawable_${name}`,
  generateOperationId: `op_workflow_generate_mesh_${name}`,
  displayName: `Workflow ${capitalize(name)}`,
  sourceAssetId: "src_generated",
  sourceLayerId: "layer_body",
  partId: "part_root",
  initialBounds: { x: 16, y: 24, width: 24, height: 24 },
  meshMethod: "auto-grid-v1",
  densityHint: "low"
} as const);

const capitalize = (text: string): string =>
  `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;

const createMemoryStorage = (
  entries: readonly (readonly [string, string])[] = []
): StorageLike => {
  const values = new Map(entries);

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
