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
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  type ParameterId
} from "@private-2d-rigging-lab/contracts";
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import {
  EditorSessionProvider,
  logMeshGenerationPreviewDebug,
  useEditorSession
} from "./editor-session-context";

type EditorSessionContextSnapshot = ReturnType<typeof useEditorSession>;
type FakeNode = FakeElement | FakeTextNode;
type BinaryAssetReference = RegisterAuthoringSessionBinaryBytesInput["binaryAssetRef"];

const CUSTOM_PARAMETER_ID = ParameterIdSchema.parse("param_custom_history");
const ROTATION_PARAMETER_ID = ParameterIdSchema.parse("param_rotation_selection_x");
const ROTATION_RIG_CONTROL_ID = RigControlIdSchema.parse("rig_rotation_selection");
const ROTATION_PART_ID = PartIdSchema.parse("part_rotation_selection");
const LOADED_CHILD_PART_ID = PartIdSchema.parse("part_loaded_child");
const LOADED_DRAWABLE_ID = DrawableIdSchema.parse("draw_loaded_child");
const TRANSIENT_DRAFT_DRAWABLE_ID = DrawableIdSchema.parse("draw_provider_fixture");
const TEXTURE_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const TEXTURE_BYTES_SHA256_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("EditorSessionProvider history integration", () => {
  it("includes v6 adaptive contour diagnostics in mesh preview debug logs", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

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
        }
      });
    } finally {
      info.mockRestore();
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

  it("marks the current project saved after portable bundle save", async () => {
    const harness = await renderEditorSessionProbe();

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
      expect(harness.context().projectStorage.status).toBe("saved");
      expect(harness.context().projectSaveStatusLabel).toBe("Saved");
      expect(harness.context().projectStorage.binaryPayloadCount).toBe(0);
    } finally {
      await harness.cleanup();
    }
  });

  it("loads a portable bundle by replacing session and clearing transient editor state", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const harness = await renderEditorSessionProbe({
      initialSession: createTextureBundleSession()
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
      expect(harness.context().session.graph.parameters.map((parameter) => parameter.parameterId))
        .toEqual([ParameterIdSchema.parse("param_loaded_wave72")]);
      expect(harness.context().selection).toBeNull();
      expect(harness.context().psdImportOpen).toBe(false);
      expect(harness.context().parameterValues).toEqual({});
      expect(harness.context().meshDraft).toBeNull();
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
  readonly initialSession?: AuthoringSession;
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
          options.initialSession === undefined
            ? null
            : { initialSession: options.initialSession },
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

function createGeneratedMeshResultWithAdaptiveContourDiagnostics(): DrawableGeneratedMeshResult {
  return {
    source: "outline-v6d-adaptive-contour-constrainautor-rgba",
    mesh: {
      meshId: "mesh_body",
      drawableId: "draw_body",
      vertices: [],
      uvs: [],
      triangles: [],
      vertexStableIds: [],
      triangleStableIds: [],
      topologyRevision: 0,
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      generationProvenanceId: "prov_generate_body"
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
