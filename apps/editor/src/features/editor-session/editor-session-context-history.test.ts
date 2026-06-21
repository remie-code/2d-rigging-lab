import type {
  AuthoringSession,
  DrawableGeneratedMeshResult,
  RegisterAuthoringSessionBinaryBytesInput
} from "@private-2d-rigging-lab/authoring-core";
import {
  createInitialAuthoringRevision,
  exportAuthoringSessionPortableBundle,
  registerAuthoringSessionBinaryBytes
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  TriangleIdSchema,
  type MeshId,
  type ParameterId,
  type RectDto,
  type RigControlId
} from "@private-2d-rigging-lab/contracts";
import {
  PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
  type PsdAdapterLayerMaterializationEvidenceDto,
  type PsdAdapterParserEvidenceDto,
  type PsdAdapterResultDto
} from "@private-2d-rigging-lab/operation-core";
import {
  getLive2dPerformanceStats,
  resetLive2dPerformanceStats
} from "@private-2d-rigging-lab/render-core";
import type {
  BrowserPsdMaterializedLayerBytes,
  BrowserPsdParserInput,
  BrowserPsdParserResult
} from "../../editor-workflow/browser-psd-parser-adapter";
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import {
  EditorSessionProvider,
  logMeshGenerationPreviewDebug,
  type DirtyWorkspaceReplacementConfirmation,
  useEditorSession
} from "./editor-session-context";
import { ROOT_PART_ID, createEmptyAuthoringSession } from "./model/empty-authoring-session";
import type { DeformerTreeSelectionTarget } from "./model/editor-selection";
import { createPsdImportPlan } from "../psd-import/model/psd-import-planner";
import {
  createFakeWorkspaceDirectoryHandle,
  type FakeWorkspaceDirectoryHandle
} from "../workspace-storage/model/fake-workspace-directory";
import {
  createEditorWorkspace,
  type WorkspaceDirectoryPicker
} from "../workspace-storage/model/workspace-session-storage";
import {
  createTextureAtlasTaskPreviewState
} from "../../workspace/atlas/atlas-task-projection";

const parsePsdForEditorImportMock = vi.hoisted(() => vi.fn());

vi.mock("../../editor-workflow/browser-psd-parser-adapter", () => ({
  createPsdSourceAssetId: (planToken: string) => `src_${planToken}`,
  parsePsdForEditorImport: parsePsdForEditorImportMock
}));

type EditorSessionContextSnapshot = ReturnType<typeof useEditorSession>;
type FakeNode = FakeElement | FakeTextNode;
type BinaryAssetReference = RegisterAuthoringSessionBinaryBytesInput["binaryAssetRef"];

const CUSTOM_PARAMETER_ID = ParameterIdSchema.parse("param_custom_history");
const ROTATION_PARAMETER_ID = ParameterIdSchema.parse("param_rotation_selection_x");
const ROTATION_RIG_CONTROL_ID = RigControlIdSchema.parse("rig_rotation_selection");
const ROTATION_PART_ID = PartIdSchema.parse("part_rotation_selection");
const DYNAMICS_HISTORY_GROUP_ID = DynamicsGroupIdSchema.parse("dyn_history_sway");
const DYNAMICS_HISTORY_DRIVER_ID = ParameterIdSchema.parse("param_history_driver_x");
const DYNAMICS_HISTORY_OUTPUT_ID = ParameterIdSchema.parse("param_history_output_sway");
const DYNAMICS_PRESET_HISTORY_GROUP_ID = DynamicsGroupIdSchema.parse("dyn_preset_history_sway");
const DYNAMICS_PRESET_HISTORY_DRIVER_ID = ParameterIdSchema.parse("param_face_angle_x");
const DYNAMICS_PRESET_HISTORY_OUTPUT_ID = ParameterIdSchema.parse("param_hair_front_sway_x");
const DYNAMICS_UPDATED_PRESET_HISTORY_DRIVER_ID = ParameterIdSchema.parse("param_body_angle_x");
const DYNAMICS_UPDATED_PRESET_HISTORY_OUTPUT_ID = ParameterIdSchema.parse("param_hair_side_sway_x");
const LOADED_CHILD_PART_ID = PartIdSchema.parse("part_loaded_child");
const LOADED_DRAWABLE_ID = DrawableIdSchema.parse("draw_loaded_child");
const BATCH_PART_ID = PartIdSchema.parse("part_mesh_batch");
const BATCH_DRAW_EMPTY_A = DrawableIdSchema.parse("draw_mesh_batch_empty_a");
const BATCH_DRAW_EXISTING = DrawableIdSchema.parse("draw_mesh_batch_existing");
const BATCH_DRAW_EMPTY_B = DrawableIdSchema.parse("draw_mesh_batch_empty_b");
const BATCH_MESH_EMPTY_A = MeshIdSchema.parse("mesh_mesh_batch_empty_a");
const BATCH_MESH_EXISTING = MeshIdSchema.parse("mesh_mesh_batch_existing");
const BATCH_MESH_EMPTY_B = MeshIdSchema.parse("mesh_mesh_batch_empty_b");
const WRAP_ROOT_RIG_CONTROL_ID = RigControlIdSchema.parse("rig_wrap_existing_root");
const WRAP_CREATED_ROTATION_ID = RigControlIdSchema.parse("rig_2_selected_rotation_deformer");
const MESH_APPLY_AUTO_REFIT_WARP_ID = RigControlIdSchema.parse("rig_mesh_apply_auto_refit");
const TRANSIENT_DRAFT_DRAWABLE_ID = DrawableIdSchema.parse("draw_provider_fixture");
const TEXTURE_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const TEXTURE_BYTES_SHA256_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const PSD_WRITE_LAYER_ID = "psd:root/layer[write-once]";
const PSD_WRITE_GROUP_ID = "psd:root/group[write-once]";
const PSD_WRITE_BYTES = new Uint8Array([
  255, 0, 0, 255,
  0, 255, 0, 255,
  0, 0, 255, 255,
  255, 255, 255, 255
]);
const PSD_SOURCE_DIGEST = {
  algorithm: "sha256" as const,
  hex: "abababababababababababababababababababababababababababababababab"
};
const PSD_PARSER_EVIDENCE: PsdAdapterParserEvidenceDto = {
  evidenceKind: "psd-parser-evidence-v1",
  parserName: "provider-write-once-parser",
  parserPackageName: "provider-write-once-parser",
  parserVersion: "0.0.0",
  adapterName: "provider-write-once-adapter",
  adapterVersion: "0.0.0",
  runtime: "browser",
  privateShapePolicy: "parser-private-shape-excluded-v1"
};
const ATLAS_SOURCE_PART_ID = PartIdSchema.parse("part_atlas_write_once");
const ATLAS_SOURCE_DRAWABLE_ID = DrawableIdSchema.parse("draw_atlas_write_once");
const ATLAS_SOURCE_MESH_ID = MeshIdSchema.parse("mesh_atlas_write_once");
const ATLAS_SOURCE_TEXTURE_ID = TextureIdSchema.parse("tex_atlas_write_once_source");
const ATLAS_SOURCE_ASSET_ID = SourceAssetIdSchema.parse("src_atlas_write_once");
const ATLAS_SOURCE_PROVENANCE_ID = ProvenanceIdSchema.parse("prov_atlas_write_once");
const ATLAS_SOURCE_BYTES = new Uint8Array([
  255, 0, 0, 255,
  255, 0, 0, 255,
  255, 0, 0, 255,
  255, 0, 0, 255
]);

describe("EditorSessionProvider history integration", () => {
  it("includes v6 adaptive contour diagnostics in mesh preview debug logs", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      logMeshGenerationPreviewDebug({
        session: {
          graph: {
            drawables: [
              {
                drawableId: DrawableIdSchema.parse("draw_body"),
                displayName: "Body"
              }
            ]
          }
        } as AuthoringSession,
        drawableId: DrawableIdSchema.parse("draw_body"),
        presetId: "standard",
        method: "auto-outline-v6d-adaptive-contour-constrainautor",
        densityHint: "medium",
        generated: createGeneratedMeshResultWithAdaptiveContourDiagnostics()
      });

      expect(info).toHaveBeenCalledTimes(1);
      expect(info.mock.calls[0]?.[1]).toMatchObject({
        constrainautorDiagnostics: {
          constraintEdgeCount: 24,
          missingConstraintEdgeCount: 0
        },
        adaptiveDensityDiagnostics: {
          resolvedBoundarySpacing: 12,
          resolvedMaxBoundaryVertices: 128
        },
        multiIslandDiagnostics: {
          rawAlphaComponentCount: 2,
          keptIslandCount: 1,
          generatedIslandCount: 1,
          skippedTinyNoiseIslandCount: 1,
          skippedTinyNoisePixelCount: 2,
          localizedFallbackCount: 0
        }
      });
      expect(warn).not.toHaveBeenCalled();
    } finally {
      info.mockRestore();
      warn.mockRestore();
    }
  });

  it("records one committed provider action as one Undo entry under StrictMode", async () => {
    const harness = await renderEditorSessionProbe();

    try {
      expect(harness.context().canUndo).toBe(false);

      await act(async () => {
        const result = harness.context().createCustomParameter(createCustomParameterPayload());
        expect(result.committed).toBe(true);
      });

      expect(hasCustomParameter(harness.context())).toBe(true);
      expect(harness.context().canUndo).toBe(true);
      expect(harness.context().canRedo).toBe(false);

      await act(async () => {
        harness.context().undo();
      });

      expect(hasCustomParameter(harness.context())).toBe(false);
      expect(harness.context().canUndo).toBe(false);
      expect(harness.context().canRedo).toBe(true);

      await act(async () => {
        harness.context().redo();
      });

      expect(hasCustomParameter(harness.context())).toBe(true);
      expect(harness.context().canUndo).toBe(true);
      expect(harness.context().canRedo).toBe(false);
    } finally {
      await harness.cleanup();
    }
  });

  it("keeps history binary pressure counters default-off and enables them with the existing perf flag", async () => {
    delete (globalThis as Live2dPerformanceTestGlobal).__LIVE2D_PERF__;
    resetLive2dPerformanceStats();
    const disabledHarness = await renderEditorSessionProbe({
      initialSession: createTextureBundleSession()
    });

    try {
      await act(async () => {
        const result = disabledHarness.context().createCustomParameter(createCustomParameterPayload());
        expect(result.committed).toBe(true);
      });

      expect(getLive2dPerformanceStats()).toBeUndefined();
    } finally {
      await disabledHarness.cleanup();
    }

    (globalThis as Live2dPerformanceTestGlobal).__LIVE2D_PERF__ = true;
    resetLive2dPerformanceStats();
    const enabledHarness = await renderEditorSessionProbe({
      initialSession: createTextureBundleSession()
    });

    try {
      await act(async () => {
        const result = enabledHarness.context().createCustomParameter(createCustomParameterPayload());
        expect(result.committed).toBe(true);
      });

      expect(getLive2dPerformanceStats()?.counters).toMatchObject({
        "editorHistory.samples": 1,
        "editorHistory.undoDepth": 1,
        "editorHistory.redoDepth": 0,
        "editorHistory.currentBinaryAssetCount": 1,
        "editorHistory.currentBinaryBytes": TEXTURE_BYTES.byteLength,
        "editorHistory.estimatedDeepClonedHistoryBinaryBytes": TEXTURE_BYTES.byteLength * 2,
        "editorHistory.estimatedRetainedSharedHistoryBinaryBytes": TEXTURE_BYTES.byteLength,
        "editorHistory.estimatedAvoidedDuplicateHistoryBinaryBytes": TEXTURE_BYTES.byteLength,
        "editorHistory.retainedSharingRatioBasisPoints": 5000
      });
    } finally {
      delete (globalThis as Live2dPerformanceTestGlobal).__LIVE2D_PERF__;
      resetLive2dPerformanceStats();
      await enabledHarness.cleanup();
    }
  });

  it("rejects PSD import and editing commands before a workspace is open", async () => {
    const harness = await renderEditorSessionProbe({ initialWorkspaceOpen: false });

    try {
      await act(async () => {
        harness.context().openPsdImport();
      });

      expect(harness.context().psdImportOpen).toBe(false);
      expect(harness.context().workspaceStorage).toMatchObject({
        status: "no-workspace",
        errorCode: "workspace.required"
      });
      expect(harness.context().workspaceStorage.message).toContain(
        "Create or open a workspace"
      );

      const result = await act(async () =>
        harness.context().createCustomParameter(createCustomParameterPayload())
      );

      expect(result.committed).toBe(false);
      expect(result.diagnostics[0]).toMatchObject({
        checkId: "workspace.required",
        severity: "error"
      });
      expect(hasCustomParameter(harness.context())).toBe(false);
    } finally {
      await harness.cleanup();
    }
  });

  it("does not dirty history for active parameter scrub or reset", async () => {
    const harness = await renderEditorSessionProbe();

    try {
      const activeParameterId = requireActiveParameterId(harness.context());

      await act(async () => {
        harness.context().setActiveParameterValue(1);
      });

      expect(harness.context().parameterValues[activeParameterId]).toBe(1);
      expect(harness.context().canUndo).toBe(false);
      expect(harness.context().canRedo).toBe(false);

      const parameterValuesAfterFirstScrub = harness.context().parameterValues;
      await act(async () => {
        harness.context().setActiveParameterValue(1);
      });

      expect(harness.context().parameterValues).toBe(parameterValuesAfterFirstScrub);
      expect(harness.context().canUndo).toBe(false);
      expect(harness.context().canRedo).toBe(false);

      await act(async () => {
        harness.context().resetActiveParameterValue();
      });

      expect(harness.context().canUndo).toBe(false);
      expect(harness.context().canRedo).toBe(false);

      await act(async () => {
        const result = harness.context().createCustomParameter(createCustomParameterPayload());
        expect(result.committed).toBe(true);
      });

      expect(harness.context().canUndo).toBe(true);

      await act(async () => {
        harness.context().undo();
      });

      expect(harness.context().canUndo).toBe(false);
      expect(harness.context().canRedo).toBe(true);
    } finally {
      await harness.cleanup();
    }
  });

  it("records Dynamics create/update/delete while preview state stays out of history", async () => {
    const harness = await renderEditorSessionProbe({
      initialSession: createDynamicsHistorySession()
    });

    try {
      await act(async () => {
        const result = harness.context().createDynamicsGroup(createDynamicsHistoryPayload());
        expect(result.committed).toBe(true);
      });

      expect(harness.context().session.graph.dynamicsGroups).toHaveLength(1);
      expect(harness.context().canUndo).toBe(true);

      await act(async () => {
        harness.context().setDynamicsToolPreviewGroupId(DYNAMICS_HISTORY_GROUP_ID);
        harness.context().setDynamicsToolPreviewDriverValue(
          DYNAMICS_HISTORY_GROUP_ID,
          DYNAMICS_HISTORY_DRIVER_ID,
          30
        );
        harness.context().resetDynamicsToolPreviewSimulation(DYNAMICS_HISTORY_GROUP_ID);
      });

      expect(harness.context().dynamicsToolPreview.selectedGroupId).toBe(DYNAMICS_HISTORY_GROUP_ID);
      expect(harness.context().canUndo).toBe(true);

      await act(async () => {
        harness.context().undo();
      });

      expect(harness.context().session.graph.dynamicsGroups).toHaveLength(0);
      expect(harness.context().canUndo).toBe(false);
      expect(harness.context().canRedo).toBe(true);

      await act(async () => {
        harness.context().redo();
      });

      await act(async () => {
        const result = harness.context().updateDynamicsGroup({
          dynamicsGroupId: DYNAMICS_HISTORY_GROUP_ID,
          displayName: "History Sway Updated"
        });
        expect(result.committed).toBe(true);
      });

      expect(harness.context().session.graph.dynamicsGroups[0]?.displayName)
        .toBe("History Sway Updated");

      await act(async () => {
        const result = harness.context().deleteDynamicsGroup({
          dynamicsGroupId: DYNAMICS_HISTORY_GROUP_ID
        });
        expect(result.committed).toBe(true);
      });

      expect(harness.context().session.graph.dynamicsGroups).toHaveLength(0);

      await act(async () => {
        harness.context().undo();
      });

      expect(harness.context().session.graph.dynamicsGroups[0]?.displayName)
        .toBe("History Sway Updated");
    } finally {
      await harness.cleanup();
    }
  });

  it("keeps Dynamics preview animation ticks out of history while coefficient commits stay undoable", async () => {
    const initialSession = createDynamicsHistorySession();
    initialSession.graph.dynamicsGroups.push(createDynamicsHistoryPayload());
    const harness = await renderEditorSessionProbe({ initialSession });

    try {
      expect(harness.context().canUndo).toBe(false);

      await act(async () => {
        harness.context().setDynamicsToolPreviewGroupId(DYNAMICS_HISTORY_GROUP_ID);
        harness.context().setDynamicsToolPreviewDriverValue(
          DYNAMICS_HISTORY_GROUP_ID,
          DYNAMICS_HISTORY_DRIVER_ID,
          30
        );
        harness.context().advanceDynamicsToolPreviewSimulation(
          DYNAMICS_HISTORY_GROUP_ID,
          16.6666667
        );
        harness.context().advanceDynamicsToolPreviewSimulation(
          DYNAMICS_HISTORY_GROUP_ID,
          16.6666667
        );
      });

      expect(harness.context().dynamicsToolPreview.simulationStatesByGroupId[
        DYNAMICS_HISTORY_GROUP_ID
      ]?.tick).toBe(2);
      expect(harness.context().canUndo).toBe(false);
      expect(harness.context().canRedo).toBe(false);

      await act(async () => {
        const result = harness.context().updateDynamicsGroup({
          dynamicsGroupId: DYNAMICS_HISTORY_GROUP_ID,
          pendulums: [
            {
              length: 0.9,
              sway: 0.5,
              reactionSpeed: 10,
              convergenceSpeed: 6
            }
          ],
          outputs: [
            {
              parameterId: DYNAMICS_HISTORY_OUTPUT_ID,
              kind: "angle",
              strength: 8,
              invert: false,
              limit: 12
            }
          ]
        });
        expect(result.committed).toBe(true);
      });

      expect(harness.context().canUndo).toBe(true);
      expect(harness.context().session.graph.dynamicsGroups[0]?.outputs[0]?.strength).toBe(8);

      await act(async () => {
        harness.context().undo();
      });

      expect(harness.context().session.graph.dynamicsGroups[0]?.outputs[0]?.strength).toBe(10);
    } finally {
      await harness.cleanup();
    }
  });

  it("commits Dynamics create and apply with initialized preset parameter candidates", async () => {
    const harness = await renderEditorSessionProbe({
      initialSession: createEmptyAuthoringSession()
    });

    try {
      expect(harness.context().session.graph.parameters).toEqual([]);

      await act(async () => {
        const result = harness.context().createDynamicsGroup(createPresetDynamicsHistoryPayload());
        expect(result.committed).toBe(true);
      });

      expect(harness.context().session.graph.parameters).toEqual([]);
      expect(harness.context().session.graph.dynamicsGroups[0]).toMatchObject({
        dynamicsGroupId: DYNAMICS_PRESET_HISTORY_GROUP_ID,
        inputs: [{ parameterId: DYNAMICS_PRESET_HISTORY_DRIVER_ID }],
        outputs: [{ parameterId: DYNAMICS_PRESET_HISTORY_OUTPUT_ID }]
      });

      await act(async () => {
        const result = harness.context().updateDynamicsGroup(createUpdatedPresetDynamicsHistoryPayload());
        expect(result.committed).toBe(true);
      });

      expect(harness.context().session.graph.parameters).toEqual([]);
      expect(harness.context().session.graph.dynamicsGroups[0]).toMatchObject({
        dynamicsGroupId: DYNAMICS_PRESET_HISTORY_GROUP_ID,
        inputs: [{ parameterId: DYNAMICS_UPDATED_PRESET_HISTORY_DRIVER_ID }],
        outputs: [{ parameterId: DYNAMICS_UPDATED_PRESET_HISTORY_OUTPUT_ID }]
      });
      expect(harness.context().canUndo).toBe(true);
    } finally {
      await harness.cleanup();
    }
  });

  it("preserves selected Rotation Deformer through context edits, undo, and redo", async () => {
    const harness = await renderEditorSessionProbe({
      initialSession: createRotationSelectionSession()
    });

    try {
      await act(async () => {
        harness.context().selectRigControl(ROTATION_RIG_CONTROL_ID);
      });
      expect(harness.context().selection).toEqual({
        kind: "rigControl",
        id: ROTATION_RIG_CONTROL_ID
      });

      await act(async () => {
        harness.context().updateRigControl({
          rigControlId: ROTATION_RIG_CONTROL_ID,
          pivot: { x: 24, y: 32 },
          restAngleDegrees: 12
        });
      });
      expect(harness.context().selection).toEqual({
        kind: "rigControl",
        id: ROTATION_RIG_CONTROL_ID
      });
      expect(readRotationSelectionRigControl(harness.context().session)).toMatchObject({
        pivot: { x: 24, y: 32 },
        restAngleDegrees: 12
      });

      await act(async () => {
        harness.context().undo();
      });
      expect(harness.context().selection).toEqual({
        kind: "rigControl",
        id: ROTATION_RIG_CONTROL_ID
      });
      expect(readRotationSelectionRigControl(harness.context().session)).toMatchObject({
        pivot: { x: 16, y: 16 },
        restAngleDegrees: 0
      });

      await act(async () => {
        harness.context().redo();
      });
      expect(harness.context().selection).toEqual({
        kind: "rigControl",
        id: ROTATION_RIG_CONTROL_ID
      });
      expect(readRotationSelectionRigControl(harness.context().session)).toMatchObject({
        pivot: { x: 24, y: 32 },
        restAngleDegrees: 12
      });

      await act(async () => {
        harness.context().editKeyformKey({
          action: "updateCurrent",
          target: { kind: "rigControl", id: ROTATION_RIG_CONTROL_ID },
          targetProperty: "angleDegrees",
          parameterId: ROTATION_PARAMETER_ID,
          keyValue: 0,
          interpolation: "linear-1d-v1",
          statePatch: {
            propertyPath: "angleDegrees",
            value: -25
          }
        });
      });
      expect(harness.context().selection).toEqual({
        kind: "rigControl",
        id: ROTATION_RIG_CONTROL_ID
      });
      expect(readRotationSelectionAngleKey(harness.context().session)).toBe(-25);

      await act(async () => {
        harness.context().undo();
      });
      expect(harness.context().selection).toEqual({
        kind: "rigControl",
        id: ROTATION_RIG_CONTROL_ID
      });
      expect(readRotationSelectionAngleKey(harness.context().session)).toBe(5);

      await act(async () => {
        harness.context().redo();
      });
      expect(harness.context().selection).toEqual({
        kind: "rigControl",
        id: ROTATION_RIG_CONTROL_ID
      });
      expect(readRotationSelectionAngleKey(harness.context().session)).toBe(-25);
    } finally {
      await harness.cleanup();
    }
  });

  it("marks the current workspace saved after workspace save", async () => {
    const workspaceDirectory = createFakeWorkspaceDirectoryHandle({
      name: "history-save.ail2d-workspace"
    });
    const harness = await renderEditorSessionProbe({
      initialWorkspaceDirectory: workspaceDirectory
    });

    try {
      await act(async () => {
        const result = harness.context().createCustomParameter(createCustomParameterPayload());
        expect(result.committed).toBe(true);
      });

      expect(harness.context().session.dirty).toBe(true);
      expect(harness.context().projectSaveStatusLabel).toBe("Unsaved changes");

      await act(async () => {
        await harness.context().saveProject();
      });

      expect(harness.context().session.dirty).toBe(false);
      expect(harness.context().workspaceStorage.status).toBe("saved");
      expect(harness.context().projectSaveStatusLabel).toBe("Saved");
      expect(workspaceDirectory.readTextFile("workspace.json")).toContain(
        "directory-workspace-v1"
      );
      expect(workspaceDirectory.readTextFile("model/parameters.json")).toContain(
        "param_custom_history"
      );
    } finally {
      await harness.cleanup();
    }
  });

  it("cancels opening another workspace when dirty replacement is canceled", async () => {
    const currentDirectory = createFakeWorkspaceDirectoryHandle({
      name: "current.ail2d-workspace"
    });
    const nextDirectory = createFakeWorkspaceDirectoryHandle({
      name: "next.ail2d-workspace"
    });
    const picker: WorkspaceDirectoryPicker = {
      pickDirectory: vi.fn(async () => nextDirectory)
    };
    const confirmDirtyWorkspaceReplacement = vi.fn(async () => "cancel" as const);
    const harness = await renderEditorSessionProbe({
      confirmDirtyWorkspaceReplacement,
      initialWorkspaceDirectory: currentDirectory,
      workspaceDirectoryPicker: picker
    });

    try {
      await act(async () => {
        const result = harness.context().createCustomParameter(createCustomParameterPayload());
        expect(result.committed).toBe(true);
      });

      await act(async () => {
        await harness.context().openWorkspace();
      });

      expect(confirmDirtyWorkspaceReplacement).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "open-workspace" })
      );
      expect(picker.pickDirectory).not.toHaveBeenCalled();
      expect(hasCustomParameter(harness.context())).toBe(true);
      expect(harness.context().workspaceIdentityLabel).toContain("current.ail2d-workspace");
    } finally {
      await harness.cleanup();
    }
  });

  it("saves the dirty workspace before opening another workspace", async () => {
    const currentDirectory = createFakeWorkspaceDirectoryHandle({
      name: "current-save-open.ail2d-workspace"
    });
    const nextDirectory = createFakeWorkspaceDirectoryHandle({
      name: "next-open.ail2d-workspace"
    });
    await createEditorWorkspace({
      session: createLoadedProjectSession(),
      picker: { pickDirectory: async () => nextDirectory }
    });
    const picker: WorkspaceDirectoryPicker = {
      pickDirectory: vi.fn(async () => nextDirectory)
    };
    const confirmDirtyWorkspaceReplacement = vi.fn(async () => "save-and-open" as const);
    const harness = await renderEditorSessionProbe({
      confirmDirtyWorkspaceReplacement,
      initialWorkspaceDirectory: currentDirectory,
      workspaceDirectoryPicker: picker
    });

    try {
      await act(async () => {
        const result = harness.context().createCustomParameter(createCustomParameterPayload());
        expect(result.committed).toBe(true);
      });

      await act(async () => {
        await harness.context().openWorkspace();
      });

      expect(confirmDirtyWorkspaceReplacement).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "open-workspace" })
      );
      expect(picker.pickDirectory).toHaveBeenCalledTimes(1);
      expect(currentDirectory.readTextFile("model/parameters.json")).toContain(
        "param_custom_history"
      );
      expect(harness.context().session.packageIdentity.packageDisplayName).toBe("Loaded Project");
      expect(harness.context().workspaceIdentityLabel).toContain("next-open.ail2d-workspace");
    } finally {
      await harness.cleanup();
    }
  });

  it("cancels Portable JSON import replacement when dirty replacement is canceled", async () => {
    const currentDirectory = createFakeWorkspaceDirectoryHandle({
      name: "current-import-cancel.ail2d-workspace"
    });
    const importedDirectory = createFakeWorkspaceDirectoryHandle({
      name: "imported-portable.ail2d-workspace"
    });
    const picker: WorkspaceDirectoryPicker = {
      pickDirectory: vi.fn(async () => importedDirectory)
    };
    const confirmDirtyWorkspaceReplacement = vi.fn(async () => "cancel" as const);
    const loadedBundle = await exportAuthoringSessionPortableBundle({
      session: createLoadedProjectSession(),
      updatedAt: "2026-06-20T00:00:00.000Z"
    });
    const harness = await renderEditorSessionProbe({
      confirmDirtyWorkspaceReplacement,
      initialWorkspaceDirectory: currentDirectory,
      workspaceDirectoryPicker: picker
    });

    try {
      await act(async () => {
        const result = harness.context().createCustomParameter(createCustomParameterPayload());
        expect(result.committed).toBe(true);
      });

      await act(async () => {
        await harness.context().openProjectFromPortableBundle(loadedBundle.bundleJson, {
          fileName: "loaded.portable-project.json"
        });
      });

      expect(confirmDirtyWorkspaceReplacement).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "import-portable-json" })
      );
      expect(picker.pickDirectory).not.toHaveBeenCalled();
      expect(hasCustomParameter(harness.context())).toBe(true);
      expect(harness.context().session.packageIdentity.packageDisplayName).toBe("Untitled model");
    } finally {
      await harness.cleanup();
    }
  });

  it("writes PSD import raw RGBA to the workspace once and later Save skips it", async () => {
    parsePsdForEditorImportMock.mockReset();
    parsePsdForEditorImportMock.mockImplementation(async (input: BrowserPsdParserInput) =>
      createPsdWriteOnceParserResult(input)
    );
    const workspaceDirectory = createFakeWorkspaceDirectoryHandle({
      name: "psd-write-once.ail2d-workspace"
    });
    const plan = await createPsdImportPlan({
      fileName: "write-once.psd",
      bytes: new ArrayBuffer(16),
      destination: {
        parentPartId: ROOT_PART_ID,
        label: "Project Root"
      },
      packageRevision: 0
    });
    const rawRgbaPath = plan.materializedLayerBytes[0]?.binaryAssetRef.packageRelativePath;
    if (rawRgbaPath === undefined) {
      throw new Error("Expected PSD import plan to include materialized raw RGBA bytes.");
    }
    const harness = await renderEditorSessionProbe({
      initialWorkspaceDirectory: workspaceDirectory
    });

    try {
      await act(async () => {
        harness.context().commitPsdImport(plan);
        await waitForCondition(
          () => workspaceDirectory.getWriteCount(rawRgbaPath) === 1,
          `Expected ${rawRgbaPath} to be written once after PSD import.`
        );
      });

      expect(workspaceDirectory.readBinaryFile(rawRgbaPath)).toEqual(
        plan.materializedLayerBytes[0]?.bytes
      );
      expect(workspaceDirectory.getWriteCount(rawRgbaPath)).toBe(1);

      await act(async () => {
        await harness.context().saveProject();
      });

      expect(workspaceDirectory.getWriteCount(rawRgbaPath)).toBe(1);
    } finally {
      await harness.cleanup();
      parsePsdForEditorImportMock.mockReset();
    }
  });

  it("writes Texture Atlas generated raw RGBA to the workspace once and later Save skips it", async () => {
    const workspaceDirectory = createFakeWorkspaceDirectoryHandle({
      name: "atlas-write-once.ail2d-workspace"
    });
    const initialSession = await createAtlasWriteOnceSession();
    const previewState = createTextureAtlasTaskPreviewState({
      session: initialSession,
      editorHiddenPartIds: new Set(),
      settings: {
        pageSize: 8,
        paddingPixels: 1,
        edgeExtrusionEnabled: true
      }
    });
    if (previewState.preview.status !== "ready") {
      throw new Error("Expected Texture Atlas preview to be ready.");
    }
    const harness = await renderEditorSessionProbe({
      initialSession,
      initialWorkspaceDirectory: workspaceDirectory
    });

    try {
      const result = await act(async () =>
        harness.context().applyTextureAtlasPreview(previewState.preview)
      );

      expect(result.committed).toBe(true);
      if (!result.committed) {
        throw new Error("Expected Texture Atlas Apply to commit.");
      }
      const rawRgbaPath = getGeneratedAtlasRawRgbaPath(result.session);

      expect(workspaceDirectory.getWriteCount(rawRgbaPath)).toBe(1);

      await act(async () => {
        await harness.context().saveProject();
      });

      expect(workspaceDirectory.getWriteCount(rawRgbaPath)).toBe(1);
    } finally {
      await harness.cleanup();
    }
  });

  it("loads a portable bundle by replacing session and clearing transient editor state", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const currentWorkspaceDirectory = createFakeWorkspaceDirectoryHandle({
      name: "current-loaded-portable.ail2d-workspace"
    });
    const importedWorkspaceDirectory = createFakeWorkspaceDirectoryHandle({
      name: "loaded-portable.ail2d-workspace"
    });
    const harness = await renderEditorSessionProbe({
      confirmDirtyWorkspaceReplacement: async () => "save-and-open" as const,
      initialSession: createTextureBundleSession(),
      initialWorkspaceDirectory: currentWorkspaceDirectory,
      workspaceDirectoryPicker: {
        pickDirectory: async () => importedWorkspaceDirectory
      }
    });

    try {
      const activeParameterId = requireActiveParameterId(harness.context());

      await act(async () => {
        harness.context().selectPart(PartIdSchema.parse("part_root"));
        harness.context().togglePartCollapse(PartIdSchema.parse("part_root"));
        harness.context().togglePartEditorVisibility(PartIdSchema.parse("part_root"));
        harness.context().openPsdImport();
        harness.context().setActiveParameterValue(1);
        const result = harness.context().createCustomParameter(createCustomParameterPayload());
        expect(result.committed).toBe(true);
        harness.context().startWarpDeformerDraftForDrawable(TRANSIENT_DRAFT_DRAWABLE_ID);
        harness.context().previewMeshDraft(TRANSIENT_DRAFT_DRAWABLE_ID, "standard");
      });

      expect(harness.context().selection).toEqual({
        kind: "drawable",
        id: TRANSIENT_DRAFT_DRAWABLE_ID
      });
      expect(harness.context().psdImportOpen).toBe(true);
      expect(harness.context().parameterValues[activeParameterId]).toBe(1);
      expect(harness.context().collapsedPartIds.has(PartIdSchema.parse("part_root"))).toBe(true);
      expect(harness.context().editorHiddenPartIds.has(PartIdSchema.parse("part_root"))).toBe(true);
      expect(harness.context().meshDraft).toMatchObject({
        drawableId: TRANSIENT_DRAFT_DRAWABLE_ID,
        presetId: "standard"
      });
      expect(harness.context().rigDraft).toMatchObject({
        childDrawableIds: [TRANSIENT_DRAFT_DRAWABLE_ID]
      });
      expect(harness.context().canUndo).toBe(true);

      await act(async () => {
        harness.context().createRotationDeformerForDrawable(
          DrawableIdSchema.parse("draw_missing_operation_feedback")
        );
        const duplicatePresetResult = harness.context().createCustomParameter({
          parameterId: ParameterIdSchema.parse("param_face_angle_x"),
          displayName: "Duplicate Preset",
          valueSource: "authoredInput",
          min: -1,
          default: 0,
          max: 1,
          recommendedUiStep: 0.01
        });
        expect(duplicatePresetResult.committed).toBe(false);
      });

      expect(harness.context().rigOperationFeedback).toBe(
        "Rotation Deformer could not be created for the selected Drawable."
      );
      expect(harness.context().parameterOperationFeedback).not.toBeNull();

      const loadedBundle = await exportAuthoringSessionPortableBundle({
        session: createLoadedProjectSession(),
        editorHiddenPartIds: [LOADED_CHILD_PART_ID],
        updatedAt: "2026-06-15T02:00:00.000Z"
      });

      await act(async () => {
        await harness.context().openProjectFromPortableBundle(loadedBundle.bundleJson, {
          fileName: "loaded-project.portable-project.json"
        });
      });

      expect(harness.context().session.packageIdentity.packageDisplayName).toBe(
        "Loaded Project"
      );
      expect(harness.context().hasOpenWorkspace).toBe(true);
      expect(harness.context().workspaceStorage.status).toBe("saved");
      expect(importedWorkspaceDirectory.readTextFile("workspace.json")).toContain(
        "directory-workspace-v1"
      );
      expect(importedWorkspaceDirectory.readTextFile("manifest.json")).toContain(
        "Loaded Project"
      );
      expect(harness.context().session.graph.parameters.map((parameter) => parameter.parameterId))
        .toEqual([ParameterIdSchema.parse("param_loaded_wave72")]);
      expect(harness.context().selection).toBeNull();
      expect(harness.context().psdImportOpen).toBe(false);
      expect(harness.context().parameterValues).toEqual({});
      expect(harness.context().meshDraft).toBeNull();
      expect(harness.context().meshGenerationDiagnostic).toBeNull();
      expect(harness.context().rigDraft).toBeNull();
      expect(harness.context().rigOperationFeedback).toBeNull();
      expect(harness.context().parameterOperationFeedback).toBeNull();
      expect(harness.context().collapsedPartIds.has(LOADED_CHILD_PART_ID)).toBe(true);
      expect(harness.context().collapsedPartIds.has(PartIdSchema.parse("part_root"))).toBe(false);
      expect(harness.context().editorHiddenPartIds.has(LOADED_CHILD_PART_ID)).toBe(true);
      expect(harness.context().editorHiddenPartIds.has(PartIdSchema.parse("part_root"))).toBe(false);
      expect(harness.context().canUndo).toBe(false);
      expect(harness.context().canRedo).toBe(false);
      expect(harness.context().projectStorage.status).toBe("loaded");
      expect(harness.context().projectStorage.fileName).toBe(
        "loaded-project.portable-project.json"
      );
    } finally {
      warn.mockRestore();
      await harness.cleanup();
    }
  });

  it("keeps mesh generation failure diagnostics transient and clears them on cancel", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const harness = await renderEditorSessionProbe();

    try {
      await act(async () => {
        harness.context().previewMeshDraft(
          DrawableIdSchema.parse("draw_missing_mesh_diagnostic"),
          "standard"
        );
      });

      expect(harness.context().meshDrafts).toEqual([]);
      expect(harness.context().meshGenerationDiagnostic).toMatchObject({
        kind: "generationFailed",
        drawableId: DrawableIdSchema.parse("draw_missing_mesh_diagnostic"),
        presetId: "standard",
        method: "auto-outline-v6d-adaptive-contour-constrainautor",
        failureReason: "createGeneratedMeshForDrawable returned no preview result."
      });

      await act(async () => {
        harness.context().cancelMeshDraft();
      });

      expect(harness.context().meshGenerationDiagnostic).toBeNull();
    } finally {
      warn.mockRestore();
      await harness.cleanup();
    }
  });

  it("previews, applies, and cancels batch mesh drafts only for eligible Drawables", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const harness = await renderEditorSessionProbe({
      initialSession: createBatchMeshSession()
    });

    try {
      await selectBatchDrawables(harness.context);

      await act(async () => {
        harness.context().previewMeshDrafts(
          [BATCH_DRAW_EMPTY_A, BATCH_DRAW_EXISTING, BATCH_DRAW_EMPTY_B],
          "standard"
        );
      });

      expect(harness.context().meshDraft).toMatchObject({
        drawableId: BATCH_DRAW_EMPTY_A,
        meshDrafts: [
          expect.objectContaining({ drawableId: BATCH_DRAW_EMPTY_A }),
          expect.objectContaining({ drawableId: BATCH_DRAW_EMPTY_B })
        ]
      });
      expect(harness.context().meshDrafts.map((draft) => draft.drawableId)).toEqual([
        BATCH_DRAW_EMPTY_A,
        BATCH_DRAW_EMPTY_B
      ]);

      await act(async () => {
        harness.context().cancelMeshDraft();
      });
      expect(harness.context().meshDrafts).toEqual([]);

      await act(async () => {
        harness.context().previewMeshDrafts(
          [BATCH_DRAW_EMPTY_A, BATCH_DRAW_EXISTING, BATCH_DRAW_EMPTY_B],
          "standard"
        );
      });
      const existingMeshBefore = structuredClone(
        requireMesh(harness.context().session, BATCH_MESH_EXISTING)
      );

      await act(async () => {
        harness.context().applyMeshDraft();
      });

      expect(harness.context().meshDrafts).toEqual([]);
      expect(requireMesh(harness.context().session, BATCH_MESH_EMPTY_A).triangles.length).toBeGreaterThan(0);
      expect(requireMesh(harness.context().session, BATCH_MESH_EMPTY_B).triangles.length).toBeGreaterThan(0);
      expect(requireMesh(harness.context().session, BATCH_MESH_EXISTING)).toEqual(existingMeshBefore);
    } finally {
      info.mockRestore();
      warn.mockRestore();
      await harness.cleanup();
    }
  });

  it("deletes the selected Deformer, clears selection, and keeps delete undoable and redoable", async () => {
    const harness = await renderEditorSessionProbe({
      initialSession: createRotationSelectionSession(),
      initialSelection: {
        kind: "rigControl",
        id: ROTATION_RIG_CONTROL_ID
      }
    });

    try {
      expect(harness.context().selection).toEqual({
        kind: "rigControl",
        id: ROTATION_RIG_CONTROL_ID
      });

      await act(async () => {
        harness.context().deleteRigControl(ROTATION_RIG_CONTROL_ID);
      });

      expect(harness.context().selection).toBeNull();
      expect(findRigControl(harness.context().session, ROTATION_RIG_CONTROL_ID)).toBeUndefined();
      expect(harness.context().canUndo).toBe(true);

      await act(async () => {
        harness.context().undo();
      });

      expect(findRigControl(harness.context().session, ROTATION_RIG_CONTROL_ID)).toBeDefined();
      expect(harness.context().canRedo).toBe(true);

      await act(async () => {
        harness.context().redo();
      });

      expect(findRigControl(harness.context().session, ROTATION_RIG_CONTROL_ID)).toBeUndefined();
      expect(harness.context().selection).toBeNull();
    } finally {
      await harness.cleanup();
    }
  });

  it("selects the actual suffixed rig control after duplicate display-name creation", async () => {
    const harness = await renderEditorSessionProbe({
      initialSession: createDuplicateDisplayNameDrawableSession()
    });

    try {
      await act(async () => {
        harness.context().createRotationDeformerForDrawable(BATCH_DRAW_EMPTY_A);
      });
      expect(harness.context().selection).toEqual({
        kind: "rigControl",
        id: RigControlIdSchema.parse("rig_twin_rotation_deformer")
      });

      await act(async () => {
        harness.context().selectDrawable(BATCH_DRAW_EMPTY_B);
        harness.context().createRotationDeformerForDrawable(BATCH_DRAW_EMPTY_B);
      });

      expect(harness.context().selection).toEqual({
        kind: "rigControl",
        id: RigControlIdSchema.parse("rig_twin_rotation_deformer_2")
      });
      expect(findRigControl(
        harness.context().session,
        RigControlIdSchema.parse("rig_twin_rotation_deformer_2")
      )).toMatchObject({
        displayName: "Twin Rotation Deformer",
        childDrawableIds: [BATCH_DRAW_EMPTY_B]
      });
    } finally {
      await harness.cleanup();
    }
  });

  it("auto-refits an unkeyed Warp ancestor after Mesh Apply and clears drafts", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const harness = await renderEditorSessionProbe({
      initialSession: createBatchMeshSessionWithAutoRefitWarp()
    });

    try {
      await act(async () => {
        harness.context().selectDrawable(BATCH_DRAW_EMPTY_A);
        harness.context().previewMeshDraft(BATCH_DRAW_EMPTY_A, "standard");
      });
      expect(harness.context().meshDraft).toMatchObject({
        drawableId: BATCH_DRAW_EMPTY_A,
        presetId: "standard"
      });

      await act(async () => {
        harness.context().applyMeshDraft();
      });

      expect(harness.context().meshDrafts).toEqual([]);
      expect(requireMesh(harness.context().session, BATCH_MESH_EMPTY_A).triangles.length)
        .toBeGreaterThan(0);
      expect(rectContainsVertices(
        getWarpDomain(harness.context().session, MESH_APPLY_AUTO_REFIT_WARP_ID),
        requireMesh(harness.context().session, BATCH_MESH_EMPTY_A).vertices
      )).toBe(true);
    } finally {
      info.mockRestore();
      warn.mockRestore();
      await harness.cleanup();
    }
  });

  it("selects the created wrapper after Deformer Tree wrap-selected Rig create", async () => {
    const harness = await renderEditorSessionProbe({
      initialSession: createDeformerTreeWrapProviderSession()
    });
    const visibleTargets: readonly DeformerTreeSelectionTarget[] = [
      {
        kind: "rigControl",
        rigControlId: WRAP_ROOT_RIG_CONTROL_ID
      },
      {
        kind: "poolDrawable",
        drawableId: BATCH_DRAW_EMPTY_A
      }
    ];

    try {
      await act(async () => {
        harness.context().selectDeformerTreeTarget(visibleTargets[0]!, { visibleTargets });
      });
      await act(async () => {
        harness.context().selectDeformerTreeTarget(visibleTargets[1]!, {
          toggle: true,
          visibleTargets
        });
      });
      expect(harness.context().selection).toEqual({
        kind: "deformerTreeSet",
        targets: visibleTargets
      });

      await act(async () => {
        harness.context().createRotationDeformerForDeformerTreeSelection();
      });

      expect(harness.context().selection).toEqual({
        kind: "rigControl",
        id: WRAP_CREATED_ROTATION_ID
      });
      expect(harness.context().session.graph.rigControlRootIds).toEqual([
        WRAP_CREATED_ROTATION_ID
      ]);
      expect(
        harness.context().session.graph.rigControls.find(
          (candidate) => candidate.rigControlId === WRAP_CREATED_ROTATION_ID
        )
      ).toMatchObject({
        childDrawableIds: [BATCH_DRAW_EMPTY_A],
        childRigControlIds: [WRAP_ROOT_RIG_CONTROL_ID]
      });
      expect(
        harness.context().session.graph.rigControls.find(
          (candidate) => candidate.rigControlId === WRAP_ROOT_RIG_CONTROL_ID
        )
      ).toMatchObject({
        parentId: WRAP_CREATED_ROTATION_ID
      });
    } finally {
      await harness.cleanup();
    }
  });

  it("preserves the current session and reports invalid bundle import errors", async () => {
    const harness = await renderEditorSessionProbe();

    try {
      const initialSession = harness.context().session;

      await act(async () => {
        await harness.context().openProjectFromPortableBundle("{", {
          fileName: "invalid.portable-project.json"
        });
      });

      expect(harness.context().session).toBe(initialSession);
      expect(harness.context().projectStorage).toMatchObject({
        status: "error",
        lastAction: "open",
        fileName: "invalid.portable-project.json",
        errorCode: "invalidBundle"
      });
      expect(harness.context().projectStorage.issues).toEqual([
        expect.objectContaining({ code: "portableBundle.json.invalid" })
      ]);
    } finally {
      await harness.cleanup();
    }
  });

  it("preserves the current session and reports missing payload import errors", async () => {
    const harness = await renderEditorSessionProbe();

    try {
      const initialSession = harness.context().session;
      const exported = await exportAuthoringSessionPortableBundle({
        session: createTextureBundleSession()
      });
      const bundle = JSON.parse(exported.bundleJson) as { binaryPayloads: unknown[] };
      bundle.binaryPayloads = [];

      await act(async () => {
        await harness.context().openProjectFromPortableBundle(JSON.stringify(bundle), {
          fileName: "missing-payload.portable-project.json"
        });
      });

      expect(harness.context().session).toBe(initialSession);
      expect(harness.context().projectStorage).toMatchObject({
        status: "error",
        lastAction: "open",
        fileName: "missing-payload.portable-project.json",
        errorCode: "missingBytes"
      });
      expect(harness.context().projectStorage.issues).toEqual([
        expect.objectContaining({
          code: "portableBundle.binaryPayload.missing",
          targetPath: "/binaryPayloads"
        })
      ]);
    } finally {
      await harness.cleanup();
    }
  });

  it("preserves the current session and reports digest mismatch import errors", async () => {
    const harness = await renderEditorSessionProbe();

    try {
      const initialSession = harness.context().session;
      const exported = await exportAuthoringSessionPortableBundle({
        session: createTextureBundleSession()
      });
      const bundle = JSON.parse(exported.bundleJson) as {
        binaryPayloads: Array<{ payloadBase64: string }>;
      };
      const firstPayload = bundle.binaryPayloads[0];
      if (firstPayload === undefined) {
        throw new Error("Expected provider test bundle payload.");
      }
      firstPayload.payloadBase64 = "YWJk";

      await act(async () => {
        await harness.context().openProjectFromPortableBundle(JSON.stringify(bundle), {
          fileName: "digest-mismatch.portable-project.json"
        });
      });

      expect(harness.context().session).toBe(initialSession);
      expect(harness.context().projectStorage).toMatchObject({
        status: "error",
        lastAction: "open",
        fileName: "digest-mismatch.portable-project.json",
        errorCode: "digestMismatch"
      });
      expect(harness.context().projectStorage.issues).toEqual([
        expect.objectContaining({
          code: "portableBundle.digest.mismatch",
          targetPath: "/binaryPayloads/0"
        })
      ]);
    } finally {
      await harness.cleanup();
    }
  });
});

function Probe({
  onRender
}: {
  readonly onRender: (context: EditorSessionContextSnapshot) => void;
}) {
  onRender(useEditorSession());
  return null;
}

async function renderEditorSessionProbe(options: {
  readonly confirmDirtyWorkspaceReplacement?: DirtyWorkspaceReplacementConfirmation;
  readonly initialSelection?: EditorSessionContextSnapshot["selection"];
  readonly initialSession?: AuthoringSession;
  readonly initialWorkspaceDirectory?: FakeWorkspaceDirectoryHandle;
  readonly initialWorkspaceOpen?: boolean;
  readonly workspaceDirectoryPicker?: WorkspaceDirectoryPicker;
} = {}): Promise<{
  readonly cleanup: () => Promise<void>;
  readonly context: () => EditorSessionContextSnapshot;
}> {
  const fakeRoot = createFakeDomRoot();
  let context: EditorSessionContextSnapshot | null = null;
  let reactRoot: Root | null = null;

  reactRoot = createRoot(fakeRoot.container as unknown as Element);
  await act(async () => {
    reactRoot?.render(
      createElement(
        StrictMode,
        null,
        createElement(
          EditorSessionProvider,
          {
            ...(options.confirmDirtyWorkspaceReplacement === undefined
              ? {}
              : { confirmDirtyWorkspaceReplacement: options.confirmDirtyWorkspaceReplacement }),
            initialWorkspaceOpen: options.initialWorkspaceOpen ?? true,
            ...(options.initialSelection === undefined
              ? {}
              : { initialSelection: options.initialSelection }),
            ...(options.initialSession === undefined
              ? {}
              : { initialSession: options.initialSession }),
            ...(options.initialWorkspaceDirectory === undefined
              ? {}
              : { initialWorkspaceDirectory: options.initialWorkspaceDirectory }),
            ...(options.workspaceDirectoryPicker === undefined
              ? {}
              : { workspaceDirectoryPicker: options.workspaceDirectoryPicker })
          },
          createElement(Probe, {
            onRender: (nextContext) => {
              context = nextContext;
            }
          })
        )
      )
    );
  });

  return {
    context: () => {
      if (context === null) {
        throw new Error("Editor session context was not rendered.");
      }

      return context;
    },
    cleanup: async () => {
      await act(async () => {
        reactRoot?.unmount();
      });
      fakeRoot.restore();
    }
  };
}

function createCustomParameterPayload() {
  return {
    parameterId: CUSTOM_PARAMETER_ID,
    displayName: "Custom History",
    valueSource: "authoredInput" as const,
    min: 0,
    default: 0,
    max: 1,
    recommendedUiStep: 0.01
  };
}

function hasCustomParameter(context: EditorSessionContextSnapshot): boolean {
  return context.session.graph.parameters.some(
    (parameter) => parameter.parameterId === CUSTOM_PARAMETER_ID
  );
}

function createDynamicsHistorySession(): AuthoringSession {
  const session = createEmptyAuthoringSession();
  session.graph.parameters.push(
    {
      parameterId: DYNAMICS_HISTORY_DRIVER_ID,
      displayName: "History Driver X",
      valueSource: "authoredInput",
      min: -30,
      default: 0,
      max: 30,
      recommendedUiStep: 1
    },
    {
      parameterId: DYNAMICS_HISTORY_OUTPUT_ID,
      displayName: "History Output Sway",
      valueSource: "authoredInput",
      min: -20,
      default: 0,
      max: 20,
      recommendedUiStep: 0.1
    }
  );
  return session;
}

function createDynamicsHistoryPayload() {
  return {
    dynamicsGroupId: DYNAMICS_HISTORY_GROUP_ID,
    displayName: "History Sway",
    enabled: true,
    presetId: "hair",
    inputs: [
      {
        parameterId: DYNAMICS_HISTORY_DRIVER_ID,
        kind: "angle" as const,
        influencePercent: 100,
        invert: false,
        normalization: {
          min: -30,
          center: 0,
          max: 30
        }
      }
    ],
    pendulums: [
      {
        length: 0.8,
        sway: 0.7,
        reactionSpeed: 12,
        convergenceSpeed: 4
      }
    ],
    outputs: [
      {
        parameterId: DYNAMICS_HISTORY_OUTPUT_ID,
        kind: "angle" as const,
        strength: 10,
        invert: false,
        limit: 20
      }
    ]
  };
}

function createPresetDynamicsHistoryPayload() {
  return {
    dynamicsGroupId: DYNAMICS_PRESET_HISTORY_GROUP_ID,
    displayName: "Preset History Sway",
    enabled: true,
    presetId: "hair",
    inputs: [
      {
        parameterId: DYNAMICS_PRESET_HISTORY_DRIVER_ID,
        kind: "angle" as const,
        influencePercent: 100,
        invert: false,
        normalization: {
          min: -30,
          center: 0,
          max: 30
        }
      }
    ],
    pendulums: [
      {
        length: 0.8,
        sway: 0.7,
        reactionSpeed: 12,
        convergenceSpeed: 4
      }
    ],
    outputs: [
      {
        parameterId: DYNAMICS_PRESET_HISTORY_OUTPUT_ID,
        kind: "angle" as const,
        strength: 10,
        invert: false,
        limit: 20
      }
    ]
  };
}

function createUpdatedPresetDynamicsHistoryPayload() {
  return {
    dynamicsGroupId: DYNAMICS_PRESET_HISTORY_GROUP_ID,
    displayName: "Preset History Sway Updated",
    enabled: true,
    presetId: "hair",
    inputs: [
      {
        parameterId: DYNAMICS_UPDATED_PRESET_HISTORY_DRIVER_ID,
        kind: "angle" as const,
        influencePercent: 50,
        invert: true,
        normalization: {
          min: -10,
          center: 0,
          max: 10
        }
      }
    ],
    pendulums: [
      {
        length: 0.8,
        sway: 0.7,
        reactionSpeed: 12,
        convergenceSpeed: 4
      }
    ],
    outputs: [
      {
        parameterId: DYNAMICS_UPDATED_PRESET_HISTORY_OUTPUT_ID,
        kind: "angle" as const,
        strength: 5,
        invert: true,
        limit: 10
      }
    ]
  };
}

function createRotationSelectionSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_rotation_selection_provider"),
      packageDisplayName: "Rotation Selection Provider",
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
          partId: ROTATION_PART_ID,
          displayName: "Rotation Part",
          childPartIds: [],
          drawableIds: []
        }
      ],
      drawables: [],
      meshes: [],
      parameters: [
        {
          parameterId: ROTATION_PARAMETER_ID,
          displayName: "Rotation Selection X",
          valueSource: "authoredInput",
          min: -30,
          default: 0,
          max: 30,
          recommendedUiStep: 1
        }
      ],
      keyformSets: [
        {
          keyformSetId: KeyformSetIdSchema.parse(
            "keyset_rigcontrol_rig_rotation_selection_angledegrees_rotation_selection_x"
          ),
          target: {
            kind: "rigControl",
            id: ROTATION_RIG_CONTROL_ID,
            property: "angleDegrees"
          },
          parameterId: ROTATION_PARAMETER_ID,
          evaluator: "linear-1d-v1",
          interpolation: "linear-1d-v1",
          compositionMode: "replace",
          compositionOrder: 0,
          keys: [
            {
              value: 0,
              statePatch: 5
            }
          ]
        }
      ],
      rigControls: [
        {
          kind: "rotation2d",
          rigControlId: ROTATION_RIG_CONTROL_ID,
          displayName: "Rotation Selection",
          partId: ROTATION_PART_ID,
          childDrawableIds: [],
          childRigControlIds: [],
          opacityMultiplier: 1,
          pivot: { x: 16, y: 16 },
          restAngleDegrees: 0,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        }
      ],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [],
      rigControlRootIds: [ROTATION_RIG_CONTROL_ID],
      stableOrder: [ROTATION_PART_ID, ROTATION_PARAMETER_ID, ROTATION_RIG_CONTROL_ID],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}

function readRotationSelectionRigControl(session: AuthoringSession) {
  const rigControl = session.graph.rigControls.find(
    (candidate) => candidate.rigControlId === ROTATION_RIG_CONTROL_ID
  );
  if (rigControl?.kind !== "rotation2d") {
    throw new Error("Expected Rotation selection rig control.");
  }

  return rigControl;
}

function readRotationSelectionAngleKey(session: AuthoringSession): number {
  const key = session.graph.keyformSets
    .find(
      (candidate) =>
        candidate.target.kind === "rigControl" &&
        candidate.target.id === ROTATION_RIG_CONTROL_ID &&
        candidate.target.property === "angleDegrees"
    )
    ?.keys.find(
      (candidate) =>
        "value" in candidate &&
        candidate.value === 0 &&
        typeof candidate.statePatch === "number"
    );
  if (key === undefined || typeof key.statePatch !== "number") {
    throw new Error("Expected Rotation selection angle key.");
  }

  return key.statePatch;
}

async function selectBatchDrawables(
  context: () => EditorSessionContextSnapshot
): Promise<void> {
  await act(async () => {
    context().selectDrawable(BATCH_DRAW_EMPTY_A);
  });
  await act(async () => {
    context().selectDrawable(BATCH_DRAW_EXISTING, { toggle: true });
  });
  await act(async () => {
    context().selectDrawable(BATCH_DRAW_EMPTY_B, { toggle: true });
  });

  expect(context().selection).toEqual({
    kind: "drawableSet",
    ids: [BATCH_DRAW_EMPTY_A, BATCH_DRAW_EXISTING, BATCH_DRAW_EMPTY_B]
  });
}

function requireMesh(session: AuthoringSession, meshId: MeshId) {
  const mesh = session.graph.meshes.find((candidate) => candidate.meshId === meshId);
  if (mesh === undefined) {
    throw new Error(`Expected mesh ${meshId}.`);
  }

  return mesh;
}

function findRigControl(session: AuthoringSession, rigControlId: RigControlId) {
  return session.graph.rigControls.find((candidate) => candidate.rigControlId === rigControlId);
}

function getWarpDomain(
  session: AuthoringSession,
  rigControlId: RigControlId
): RectDto {
  const rigControl = findRigControl(session, rigControlId);
  if (rigControl?.kind !== "warpLattice2d") {
    throw new Error(`Expected Warp Deformer ${rigControlId}.`);
  }

  return rigControl.domainBounds;
}

function rectContainsVertices(
  rect: RectDto,
  vertices: readonly { readonly x: number; readonly y: number }[]
): boolean {
  return vertices.every(
    (vertex) =>
      vertex.x >= rect.x &&
      vertex.y >= rect.y &&
      vertex.x <= rect.x + rect.width &&
      vertex.y <= rect.y + rect.height
  );
}

function createBatchMeshSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_batch_mesh_provider"),
      packageDisplayName: "Batch Mesh Provider",
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
          partId: BATCH_PART_ID,
          displayName: "Batch Mesh Part",
          childPartIds: [],
          drawableIds: [BATCH_DRAW_EMPTY_A, BATCH_DRAW_EXISTING, BATCH_DRAW_EMPTY_B],
          children: [
            { kind: "drawable", drawableId: BATCH_DRAW_EMPTY_A },
            { kind: "drawable", drawableId: BATCH_DRAW_EXISTING },
            { kind: "drawable", drawableId: BATCH_DRAW_EMPTY_B }
          ]
        }
      ],
      drawables: [
        createBatchDrawable(BATCH_DRAW_EMPTY_A, BATCH_MESH_EMPTY_A, "Empty A", 0),
        createBatchDrawable(BATCH_DRAW_EXISTING, BATCH_MESH_EXISTING, "Existing", 1),
        createBatchDrawable(BATCH_DRAW_EMPTY_B, BATCH_MESH_EMPTY_B, "Empty B", 2)
      ],
      meshes: [
        createEmptyBatchMesh(BATCH_MESH_EMPTY_A, BATCH_DRAW_EMPTY_A, 0),
        createGeneratedBatchMesh(BATCH_MESH_EXISTING, BATCH_DRAW_EXISTING, 40),
        createEmptyBatchMesh(BATCH_MESH_EMPTY_B, BATCH_DRAW_EMPTY_B, 80)
      ],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [
        { drawableId: BATCH_DRAW_EMPTY_A, baseDrawOrder: 0, stableOrder: 0 },
        { drawableId: BATCH_DRAW_EXISTING, baseDrawOrder: 1, stableOrder: 1 },
        { drawableId: BATCH_DRAW_EMPTY_B, baseDrawOrder: 2, stableOrder: 2 }
      ],
      rigControlRootIds: [],
      stableOrder: [
        BATCH_PART_ID,
        BATCH_DRAW_EMPTY_A,
        BATCH_DRAW_EXISTING,
        BATCH_DRAW_EMPTY_B
      ],
      sourceAssets: [],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          createBatchTexture("empty-a", BATCH_DRAW_EMPTY_A),
          createBatchTexture("existing", BATCH_DRAW_EXISTING),
          createBatchTexture("empty-b", BATCH_DRAW_EMPTY_B)
        ]
      },
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}

function createDuplicateDisplayNameDrawableSession(): AuthoringSession {
  const session = createBatchMeshSession();
  session.graph.drawables = session.graph.drawables.map((drawable) =>
    drawable.drawableId === BATCH_DRAW_EMPTY_A || drawable.drawableId === BATCH_DRAW_EMPTY_B
      ? { ...drawable, displayName: "Twin" }
      : drawable
  );

  return session;
}

function createBatchMeshSessionWithAutoRefitWarp(): AuthoringSession {
  const session = createBatchMeshSession();
  session.graph.rigControls = [
    {
      kind: "warpLattice2d",
      rigControlId: MESH_APPLY_AUTO_REFIT_WARP_ID,
      displayName: "Mesh Apply Auto Refit",
      childDrawableIds: [BATCH_DRAW_EMPTY_A],
      childRigControlIds: [],
      opacityMultiplier: 1,
      bindSpace: "rigControlLocalRest",
      domainBounds: { x: 0, y: 0, width: 1, height: 1 },
      latticeColumns: 2,
      latticeRows: 2,
      restControlPoints: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 }
      ],
      interpolationMethod: "bilinear-grid-v1",
      enabled: true
    }
  ];
  session.graph.rigControlRootIds = [MESH_APPLY_AUTO_REFIT_WARP_ID];
  session.graph.stableOrder = [...session.graph.stableOrder, MESH_APPLY_AUTO_REFIT_WARP_ID];

  return session;
}

function createDeformerTreeWrapProviderSession(): AuthoringSession {
  const session = createBatchMeshSession();
  session.graph.rigControls = [
    {
      kind: "rotation2d",
      rigControlId: WRAP_ROOT_RIG_CONTROL_ID,
      displayName: "Wrap Existing Root",
      childDrawableIds: [BATCH_DRAW_EXISTING],
      childRigControlIds: [],
      opacityMultiplier: 1,
      pivot: { x: 52, y: 12 },
      restAngleDegrees: 0,
      restTranslation: { x: 0, y: 0 },
      restScale: { x: 1, y: 1 },
      enabled: true
    }
  ];
  session.graph.rigControlRootIds = [WRAP_ROOT_RIG_CONTROL_ID];
  session.graph.stableOrder = [...session.graph.stableOrder, WRAP_ROOT_RIG_CONTROL_ID];

  return session;
}

function createBatchDrawable(
  drawableId: typeof BATCH_DRAW_EMPTY_A,
  meshId: typeof BATCH_MESH_EMPTY_A,
  displayName: string,
  baseDrawOrder: number
) {
  const token = String(drawableId).replace(/^draw_/, "");

  return {
    drawableId,
    displayName,
    partId: BATCH_PART_ID,
    sourceAssetId: SourceAssetIdSchema.parse("src_batch_mesh"),
    textureId: TextureIdSchema.parse(`tex_${token}`),
    meshId,
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder,
    sourceProvenanceId: ProvenanceIdSchema.parse("prov_batch_mesh")
  };
}

function createEmptyBatchMesh(
  meshId: typeof BATCH_MESH_EMPTY_A,
  drawableId: typeof BATCH_DRAW_EMPTY_A,
  x: number
) {
  return {
    meshId,
    drawableId,
    vertices: [],
    uvs: [],
    triangles: [],
    vertexStableIds: [],
    triangleStableIds: [],
    topologyRevision: 0,
    bounds: { x, y: 0, width: 24, height: 24 },
    generationProvenanceId: ProvenanceIdSchema.parse("prov_batch_mesh")
  };
}

function createGeneratedBatchMesh(
  meshId: typeof BATCH_MESH_EMPTY_A,
  drawableId: typeof BATCH_DRAW_EMPTY_A,
  x: number
) {
  return {
    ...createEmptyBatchMesh(meshId, drawableId, x),
    vertices: [
      { x, y: 0 },
      { x: x + 24, y: 0 },
      { x, y: 24 }
    ],
    uvs: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ],
    triangles: [[0, 1, 2]] as [number, number, number][],
    vertexStableIds: ["vtx_0", "vtx_1", "vtx_2"],
    topologyRevision: 1
  };
}

function createBatchTexture(name: string, drawableId: typeof BATCH_DRAW_EMPTY_A) {
  const textureId = createBatchDrawable(
    drawableId,
    BATCH_MESH_EMPTY_A,
    name,
    0
  ).textureId;

  return {
    textureId,
    filePath: `assets/textures/${name}.rgba`,
    sourceAssetId: SourceAssetIdSchema.parse("src_batch_mesh"),
    provenanceId: ProvenanceIdSchema.parse("prov_batch_mesh")
  };
}

function createLoadedProjectSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_loaded_project"),
      packageDisplayName: "Loaded Project",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 2,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 512, height: 512 },
      parts: [
        {
          partId: PartIdSchema.parse("part_root"),
          displayName: "Loaded Root",
          childPartIds: [LOADED_CHILD_PART_ID],
          drawableIds: [],
          children: [{ kind: "part", partId: LOADED_CHILD_PART_ID }]
        },
        {
          partId: LOADED_CHILD_PART_ID,
          displayName: "Loaded Child",
          parentPartId: PartIdSchema.parse("part_root"),
          childPartIds: [],
          drawableIds: [LOADED_DRAWABLE_ID],
          children: [{ kind: "drawable", drawableId: LOADED_DRAWABLE_ID }]
        }
      ],
      drawables: [
        {
          drawableId: LOADED_DRAWABLE_ID,
          displayName: "Loaded Child Drawable",
          partId: LOADED_CHILD_PART_ID,
          sourceAssetId: SourceAssetIdSchema.parse("src_loaded_child"),
          textureId: TextureIdSchema.parse("tex_loaded_child"),
          meshId: MeshIdSchema.parse("mesh_loaded_child"),
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_loaded_child")
        }
      ],
      meshes: [],
      parameters: [
        {
          parameterId: ParameterIdSchema.parse("param_loaded_wave72"),
          displayName: "Loaded Wave72",
          valueSource: "authoredInput",
          min: -1,
          default: 0,
          max: 1,
          recommendedUiStep: 0.01
        }
      ],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [
        {
          drawableId: LOADED_DRAWABLE_ID,
          baseDrawOrder: 0,
          stableOrder: 0
        }
      ],
      rigControlRootIds: [],
      stableOrder: ["part_root", LOADED_CHILD_PART_ID, LOADED_DRAWABLE_ID, "param_loaded_wave72"],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}

function createTextureBundleSession(): AuthoringSession {
  const binaryAssetRef = createBinaryAssetReference();
  const session: AuthoringSession = {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_provider_error_fixture"),
      packageDisplayName: "Provider Error Fixture",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 1,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 64, height: 64 },
      parts: [
        {
          partId: PartIdSchema.parse("part_root"),
          displayName: "Root",
          childPartIds: [],
          drawableIds: [TRANSIENT_DRAFT_DRAWABLE_ID]
        }
      ],
      drawables: [
        {
          drawableId: TRANSIENT_DRAFT_DRAWABLE_ID,
          displayName: "Provider Fixture",
          partId: PartIdSchema.parse("part_root"),
          sourceAssetId: SourceAssetIdSchema.parse("src_provider_fixture"),
          textureId: TextureIdSchema.parse("tex_provider_fixture"),
          meshId: MeshIdSchema.parse("mesh_provider_fixture"),
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_provider_fixture")
        }
      ],
      meshes: [
        {
          meshId: MeshIdSchema.parse("mesh_provider_fixture"),
          drawableId: TRANSIENT_DRAFT_DRAWABLE_ID,
          vertices: [
            { x: 0, y: 0 },
            { x: 8, y: 0 },
            { x: 0, y: 8 }
          ],
          uvs: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          triangles: [[0, 1, 2]],
          vertexStableIds: [],
          triangleStableIds: [],
          topologyRevision: 1,
          bounds: { x: 0, y: 0, width: 8, height: 8 },
          generationProvenanceId: ProvenanceIdSchema.parse("prov_provider_fixture")
        }
      ],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [
        {
          drawableId: TRANSIENT_DRAFT_DRAWABLE_ID,
          baseDrawOrder: 0,
          stableOrder: 0
        }
      ],
      rigControlRootIds: [],
      stableOrder: ["part_root", TRANSIENT_DRAFT_DRAWABLE_ID, "mesh_provider_fixture"],
      sourceAssets: [
        {
          sourceAssetId: SourceAssetIdSchema.parse("src_provider_fixture"),
          kind: "generated-fixture-v1",
          filePath: "assets/sources/provider-fixture.json",
          contentHash: "sha256:provider-fixture",
          importProfile: "split-png-fallback-v1",
          layers: [],
          diagnostics: []
        }
      ],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          {
            textureId: TextureIdSchema.parse("tex_provider_fixture"),
            filePath: "assets/textures/provider-fixture.png",
            sourceAssetId: SourceAssetIdSchema.parse("src_provider_fixture"),
            sourceLayerId: "layer_provider_fixture",
            provenanceId: ProvenanceIdSchema.parse("prov_provider_fixture"),
            binaryAssetRef
          }
        ]
      },
      provenanceRecords: [
        {
          provenanceId: ProvenanceIdSchema.parse("prov_provider_fixture"),
          assetId: "tex_provider_fixture",
          assetKind: "texture",
          filePath: "assets/textures/provider-fixture.png",
          contentHash: `sha256:${TEXTURE_BYTES_SHA256_HEX}`,
          creator: "test fixture",
          license: "private-local",
          redistributionAllowed: false,
          aiUsed: false,
          transformHistory: [],
          relatedOperationIds: []
        }
      ],
      rightsRecords: [
        {
          assetId: "rights_provider_fixture",
          rightsStatus: "cleared",
          license: "private-local",
          redistributionAllowed: false
        }
      ]
    }
  };

  registerAuthoringSessionBinaryBytes(session, {
    binaryAssetRef,
    bytes: TEXTURE_BYTES,
    role: "texture-raster-v1",
    sourceAssetId: SourceAssetIdSchema.parse("src_provider_fixture"),
    textureId: TextureIdSchema.parse("tex_provider_fixture")
  });

  return session;
}

function createBinaryAssetReference(): BinaryAssetReference {
  return {
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: "bin_provider_fixture_texture",
    packageRelativePath: "assets/textures/provider-fixture.png",
    digest: {
      algorithm: "sha256",
      hex: TEXTURE_BYTES_SHA256_HEX
    },
    byteLength: TEXTURE_BYTES.byteLength,
    mediaType: "image/png; pixelFormat=rgba8",
    storageStatus: "stored-package-local-v1",
    provenanceId: ProvenanceIdSchema.parse("prov_provider_fixture"),
    rightsAssetId: "rights_provider_fixture"
  } as BinaryAssetReference;
}

async function createPsdWriteOnceParserResult(
  input: BrowserPsdParserInput
): Promise<BrowserPsdParserResult> {
  const materialization = await createPsdWriteOnceMaterialization(input);
  const layerBytes = createPsdWriteOnceLayerBytes(materialization);

  return {
    adapterResult: createPsdWriteOnceAdapterResult(materialization),
    materializedLayerBytes: [layerBytes],
    sourceDigest: PSD_SOURCE_DIGEST,
    sourceByteLength: input.bytes.byteLength,
    sourceFilePath: `assets/sources/private/${input.planToken}/${input.fileName}`
  };
}

function createPsdWriteOnceAdapterResult(
  materialization: PsdAdapterLayerMaterializationEvidenceDto
): PsdAdapterResultDto {
  return {
    schemaVersion: "psd-adapter-result-v1",
    sourceProfile: "layered-character-psd-profile-v1",
    adapterName: "provider-write-once-adapter",
    adapterVersion: "0.0.0",
    intakeKind: "realPsdParseResult",
    parser: PSD_PARSER_EVIDENCE,
    canvas: {
      width: 2,
      height: 2,
      bounds: { x: 0, y: 0, width: 2, height: 2 }
    },
    sourceGroups: [
      {
        sourceGroupId: "psd:root",
        originalName: "Write Once Import",
        normalizedName: "write once import",
        groupPath: ["Write Once Import"],
        sourceOrder: 0,
        visibleInSource: true,
        localVisibleInSource: true,
        effectiveVisibleInSource: true,
        opacityInSource: 1,
        bounds: { x: 0, y: 0, width: 2, height: 2 },
        unsupportedFeatures: []
      },
      {
        sourceGroupId: PSD_WRITE_GROUP_ID,
        originalName: "Write Once Group",
        normalizedName: "write once group",
        parentGroupId: "psd:root",
        groupPath: ["Write Once Import", "Write Once Group"],
        sourceOrder: 1,
        visibleInSource: true,
        localVisibleInSource: true,
        effectiveVisibleInSource: true,
        opacityInSource: 1,
        bounds: { x: 0, y: 0, width: 2, height: 2 },
        unsupportedFeatures: []
      }
    ],
    sourceLayers: [
      {
        sourceLayerId: PSD_WRITE_LAYER_ID,
        originalName: "Write Once",
        normalizedName: "write once",
        parentGroupId: PSD_WRITE_GROUP_ID,
        groupPath: ["Write Once Import", "Write Once Group"],
        sourceOrder: 2,
        bounds: { x: 0, y: 0, width: 2, height: 2 },
        visibleInSource: true,
        localVisibleInSource: true,
        effectiveVisibleInSource: true,
        opacityInSource: 1,
        role: "editableLayer",
        unsupportedFeatures: []
      }
    ],
    unsupportedFeatures: [],
    materializationEvidence: [materialization],
    diagnostics: []
  };
}

async function createPsdWriteOnceMaterialization(
  input: BrowserPsdParserInput
): Promise<PsdAdapterLayerMaterializationEvidenceDto> {
  const digest = {
    algorithm: "sha256" as const,
    hex: await computeTestSha256Hex(PSD_WRITE_BYTES)
  };
  const binaryAssetRef: NonNullable<PsdAdapterLayerMaterializationEvidenceDto["binaryAssetRef"]> = {
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_${input.planToken}_write_once_rgba`,
    packageRelativePath: `assets/textures/psd/${input.planToken}/write_once.raw-rgba`,
    digest,
    byteLength: PSD_WRITE_BYTES.byteLength,
    mediaType: PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
    storageStatus: "stored-package-local-v1",
    provenanceId: ProvenanceIdSchema.parse(`prov_${input.planToken}_write_once`),
    rightsAssetId: input.sourceAssetId
  };

  return {
    evidenceKind: "psd-layer-materialization-evidence-v1",
    materializationId: `mat_${input.planToken}_write_once`,
    sourceLayerRef: {
      sourceAssetId: input.sourceAssetId,
      sourceLayerId: PSD_WRITE_LAYER_ID,
      sourceLayerName: "Write Once",
      sourceLayerPath: ["Write Once Import", "Write Once Group", "Write Once"]
    },
    mediaType: PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
    byteLength: PSD_WRITE_BYTES.byteLength,
    digest,
    width: 2,
    height: 2,
    binaryAssetRef,
    provenance: {
      sourceFilePath: input.fileName,
      sourceDigest: PSD_SOURCE_DIGEST,
      sourceByteLength: input.bytes.byteLength,
      sourceMediaType: "image/vnd.adobe.photoshop",
      privacyLabel: "packageLocalAsset",
      publicDistribution: "notPublicDistributable",
      generatedBy: "provider-write-once-adapter",
      publicDemoAsset: false
    },
    parser: PSD_PARSER_EVIDENCE,
    extraction: {
      extractionKind: "selectedLayerRasterV1",
      optionsSchemaVersion: "psd-layer-extraction-options-v1",
      options: {
        channelOrder: "rgba",
        includeEffects: false,
        includeHiddenLayers: false,
        composeWithOtherLayers: false,
        layerSelection: PSD_WRITE_LAYER_ID
      }
    }
  };
}

function createPsdWriteOnceLayerBytes(
  materialization: PsdAdapterLayerMaterializationEvidenceDto
): BrowserPsdMaterializedLayerBytes {
  if (materialization.binaryAssetRef === undefined) {
    throw new Error("Expected materialized PSD layer binary asset ref.");
  }

  return {
    sourceLayerId: PSD_WRITE_LAYER_ID,
    materializationId: materialization.materializationId,
    binaryAssetRef: materialization.binaryAssetRef,
    width: 2,
    height: 2,
    bytes: PSD_WRITE_BYTES
  };
}

async function createAtlasWriteOnceSession(): Promise<AuthoringSession> {
  const session = createEmptyAuthoringSession();
  const binaryAssetRef = await createAtlasSourceBinaryAssetReference();

  session.graph.parts[0] = {
    ...session.graph.parts[0]!,
    childPartIds: [ATLAS_SOURCE_PART_ID],
    children: [{ kind: "part", partId: ATLAS_SOURCE_PART_ID }]
  };
  session.graph.parts.push({
    partId: ATLAS_SOURCE_PART_ID,
    displayName: "Atlas Write Once",
    parentPartId: ROOT_PART_ID,
    childPartIds: [],
    drawableIds: [ATLAS_SOURCE_DRAWABLE_ID],
    children: [{ kind: "drawable", drawableId: ATLAS_SOURCE_DRAWABLE_ID }]
  });
  session.graph.drawables.push({
    drawableId: ATLAS_SOURCE_DRAWABLE_ID,
    displayName: "Atlas Source",
    partId: ATLAS_SOURCE_PART_ID,
    sourceAssetId: ATLAS_SOURCE_ASSET_ID,
    textureId: ATLAS_SOURCE_TEXTURE_ID,
    meshId: ATLAS_SOURCE_MESH_ID,
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: 0,
    sourceProvenanceId: ATLAS_SOURCE_PROVENANCE_ID
  });
  session.graph.meshes.push({
    meshId: ATLAS_SOURCE_MESH_ID,
    drawableId: ATLAS_SOURCE_DRAWABLE_ID,
    vertices: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 2 }
    ],
    uvs: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ],
    triangles: [[0, 1, 2]],
    vertexStableIds: ["vtx_atlas_write_once_0", "vtx_atlas_write_once_1", "vtx_atlas_write_once_2"],
    triangleStableIds: [TriangleIdSchema.parse("tri_atlas_write_once_0")],
    topologyRevision: 1,
    bounds: { x: 0, y: 0, width: 2, height: 2 },
    generationProvenanceId: ATLAS_SOURCE_PROVENANCE_ID
  });
  session.graph.drawOrder.push({
    drawableId: ATLAS_SOURCE_DRAWABLE_ID,
    baseDrawOrder: 0,
    stableOrder: 0
  });
  session.graph.stableOrder.push(
    ATLAS_SOURCE_PART_ID,
    ATLAS_SOURCE_DRAWABLE_ID,
    ATLAS_SOURCE_MESH_ID
  );
  session.graph.sourceAssets.push({
    sourceAssetId: ATLAS_SOURCE_ASSET_ID,
    kind: "generated-fixture-v1",
    filePath: "assets/sources/generated/atlas-write-once.json",
    contentHash: "sha256:atlas-write-once",
    importProfile: "split-png-fallback-v1",
    layers: [],
    diagnostics: []
  });
  session.graph.textureAtlas = {
    schemaVersion: "texture-atlas-v1",
    textures: [
      {
        textureId: ATLAS_SOURCE_TEXTURE_ID,
        filePath: binaryAssetRef.packageRelativePath,
        sourceAssetId: ATLAS_SOURCE_ASSET_ID,
        sourceLayerId: "layer_atlas_write_once",
        provenanceId: ATLAS_SOURCE_PROVENANCE_ID,
        dimensions: { width: 2, height: 2, pixelFormat: "rgba8" },
        binaryAssetRef
      }
    ]
  };
  session.graph.provenanceRecords.push({
    provenanceId: ATLAS_SOURCE_PROVENANCE_ID,
    assetId: ATLAS_SOURCE_TEXTURE_ID,
    assetKind: "texture",
    filePath: binaryAssetRef.packageRelativePath,
    contentHash: `sha256:${binaryAssetRef.digest.hex}`,
    creator: "test fixture",
    license: "private-local",
    redistributionAllowed: false,
    aiUsed: false,
    transformHistory: [],
    relatedOperationIds: []
  });
  session.graph.rightsRecords.push({
    assetId: ATLAS_SOURCE_ASSET_ID,
    rightsStatus: "cleared",
    license: "private-local",
    redistributionAllowed: false
  });
  registerAuthoringSessionBinaryBytes(session, {
    binaryAssetRef,
    bytes: ATLAS_SOURCE_BYTES,
    role: "texture-raster-v1",
    sourceAssetId: ATLAS_SOURCE_ASSET_ID,
    textureId: ATLAS_SOURCE_TEXTURE_ID
  });

  return session;
}

async function createAtlasSourceBinaryAssetReference(): Promise<BinaryAssetReference> {
  return {
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: "bin_atlas_write_once_source_rgba",
    packageRelativePath: "assets/textures/atlas-write-once-source.raw-rgba",
    digest: {
      algorithm: "sha256",
      hex: await computeTestSha256Hex(ATLAS_SOURCE_BYTES)
    },
    byteLength: ATLAS_SOURCE_BYTES.byteLength,
    mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
    storageStatus: "stored-package-local-v1",
    provenanceId: ATLAS_SOURCE_PROVENANCE_ID,
    rightsAssetId: ATLAS_SOURCE_ASSET_ID
  } as BinaryAssetReference;
}

function getGeneratedAtlasRawRgbaPath(session: AuthoringSession): string {
  const atlasTextureId = session.graph.textureAtlas?.layoutSummary?.atlasTextureId;
  const texture = session.graph.textureAtlas?.textures.find(
    (candidate) => candidate.textureId === atlasTextureId
  );
  const path = texture?.binaryAssetRef?.packageRelativePath;
  if (path === undefined) {
    throw new Error("Expected generated Texture Atlas binary asset path.");
  }

  return path;
}

async function computeTestSha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto?.subtle?.digest("SHA-256", bytes);
  if (digest === undefined) {
    throw new Error("SHA-256 digest support is required for this test.");
  }

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function waitForCondition(check: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (check()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  throw new Error(message);
}

function createGeneratedMeshResultWithAdaptiveContourDiagnostics(): DrawableGeneratedMeshResult {
  return {
    source: "outline-v6d-adaptive-contour-constrainautor-rgba",
    mesh: {
      meshId: MeshIdSchema.parse("mesh_body"),
      drawableId: DrawableIdSchema.parse("draw_body"),
      vertices: [],
      uvs: [],
      triangles: [],
      vertexStableIds: [],
      triangleStableIds: [],
      topologyRevision: 0,
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      generationProvenanceId: ProvenanceIdSchema.parse("prov_generate_body")
    },
    qualityMetrics: {
      maxEdgeLength: 0,
      maxTriangleArea: 0,
      minAngleDegrees: 0,
      maxVertexValence: 0,
      refinementIterationCount: 0,
      triangulationMode: "v6d-adaptive-contour-constrainautor",
      v6Metrics: {
        algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
        methodId: "auto-outline-v6d-adaptive-contour-constrainautor",
        backendId: "v6d-adaptive-contour-constrainautor",
        backendImplementationStatus: "implemented",
        requestedSourceId: "outline-v6d-adaptive-contour-constrainautor-rgba",
        actualSourceId: "outline-v6d-adaptive-contour-constrainautor-rgba",
        outputKind: "backend-output",
        preset: "medium",
        fallbackSteps: [],
        vertexCount: 0,
        triangleCount: 0,
        boundaryVertexCount: 0,
        interiorVertexCount: 0,
        alphaBoundsAvailable: true,
        contourLoopCount: 1,
        holeLikeRegionCount: 0,
        removedTriangleCount: 0,
        outsideOrCrossingTriangleCount: 0,
        multiIslandHandling: "supported",
        holeHandling: "supported",
        provenance: [],
        constrainautorDiagnostics: {
          dependencyGateStatus: "available",
          constraintEdgeCount: 24,
          preservedConstraintEdgeCount: 24,
          missingConstraintEdgeCount: 0,
          constraintRecoveryFailed: false,
          outsideTriangleCount: 0
        },
        adaptiveDensityDiagnostics: {
          adaptiveDensityReferenceArea: 73_936,
          adaptiveDensityEffectiveArea: 73_936,
          adaptiveDensityAreaRatio: 1,
          adaptiveDensityClampedAreaRatio: 1,
          adaptiveDensitySpacingScale: 1,
          adaptiveDensityVertexScale: 1,
          adaptiveDensityBoundaryCapScale: 1,
          resolvedBoundarySpacing: 12,
          resolvedInteriorSpacing: 10,
          resolvedMaxBoundaryVertices: 128,
          resolvedMaxInteriorVertices: 32,
          resolvedInteriorBoundaryClearance: 1.1
        },
        multiIslandDiagnostics: {
          rawAlphaComponentCount: 2,
          keptIslandCount: 1,
          generatedIslandCount: 1,
          backendGeneratedIslandCount: 1,
          skippedTinyNoiseIslandCount: 1,
          skippedTinyNoisePixelCount: 2,
          rawOpaquePixelCount: 122,
          largestComponentPixelCount: 120,
          localizedFallbackCount: 0,
          localizedFallbackReasons: [],
          islands: [
            {
              componentOrder: 0,
              pixelCount: 120,
              bounds: { minX: 2, minY: 2, maxX: 13, maxY: 11 },
              handling: "generated"
            },
            {
              componentOrder: 1,
              pixelCount: 2,
              bounds: { minX: 18, minY: 1, maxX: 19, maxY: 1 },
              handling: "skipped-tiny-noise"
            }
          ]
        }
      }
    }
  } as DrawableGeneratedMeshResult;
}

function requireActiveParameterId(context: EditorSessionContextSnapshot): ParameterId {
  if (context.activeParameterId === null) {
    throw new Error("Expected an initialized active parameter.");
  }

  return context.activeParameterId;
}

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

type Live2dPerformanceTestGlobal = typeof globalThis & {
  __LIVE2D_PERF__?: boolean;
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
