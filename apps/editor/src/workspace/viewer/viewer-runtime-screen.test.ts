import {
  createVariantVisibilityPredicate,
  createInitialAuthoringRevision,
  type AuthoringSession
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
  type DrawableId,
  type RectDto,
  type TextureId
} from "@private-2d-rigging-lab/contracts";
import {
  getLive2dPerformanceStats,
  resetLive2dPerformanceStats
} from "@private-2d-rigging-lab/render-core";
import type {
  ButtonHTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode
} from "react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const viewerRuntimeTestState = vi.hoisted(() => ({
  editorSession: {
    canRedo: false,
    canUndo: false,
    createWorkspace: vi.fn(),
    editorHiddenPartIds: new Set(),
    exportPortableProject: vi.fn(),
    hasOpenWorkspace: true,
    openProjectFile: vi.fn(),
    openPsdImport: vi.fn(),
    openWorkspace: vi.fn(),
    parameterValues: {},
    projectIdentityLabel: "Viewer Fixture · rev 7",
    projectSaveStatusLabel: "Saved",
    projectStorage: {
      status: "idle"
    },
    redo: vi.fn(),
    resetActiveParameterValue: vi.fn(),
    saveWorkspaceAs: vi.fn(),
    saveProject: vi.fn(),
    selectDrawable: vi.fn(),
    session: undefined as unknown as AuthoringSession,
    setActiveParameterValue: vi.fn(),
    undo: vi.fn(),
    workspaceIdentityLabel: "Viewer Fixture · rev 7",
    workspaceSaveStatusLabel: "Saved",
    workspaceStorage: {
      status: "saved",
      message: "Workspace ready."
    }
  },
  iconButtons: [] as Array<{
    readonly disabled: boolean;
    readonly label: string;
    readonly onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
    readonly pressed?: boolean;
  }>,
  uiStore: {
    activeEntry: "viewer",
    setActiveEntry: vi.fn(),
    surfaceLabel: "Viewer test surface"
  }
}));

vi.mock("../../features/editor-session/editor-session-context", () => ({
  useEditorSession: () => viewerRuntimeTestState.editorSession
}));

vi.mock("../../state/editor-ui-store", () => ({
  useEditorUiStore: (
    selector: (state: {
      readonly activeEntry: string;
      readonly setActiveEntry: (entry: string) => void;
      readonly surfaceLabel: string;
    }) => unknown
  ) =>
    selector({
      activeEntry: viewerRuntimeTestState.uiStore.activeEntry,
      setActiveEntry: viewerRuntimeTestState.uiStore.setActiveEntry,
      surfaceLabel: viewerRuntimeTestState.uiStore.surfaceLabel
    })
}));

vi.mock("../../ui/icon-button", () => ({
  IconButton: ({
    children,
    disabled,
    label,
    onClick,
    pressed
  }: {
    readonly children: ReactNode;
    readonly disabled?: boolean;
    readonly label: string;
    readonly onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
    readonly pressed?: boolean;
  }) => {
    viewerRuntimeTestState.iconButtons.push({
      disabled: disabled === true,
      label,
      ...(onClick === undefined ? {} : { onClick }),
      ...(pressed === undefined ? {} : { pressed })
    });

    return createElement(
      "button",
      {
        "aria-label": label,
        "aria-pressed": pressed,
        disabled
      },
      children
    );
  }
}));

vi.mock("../../features/psd-import/components/psd-import-modal", () => ({
  PsdImportModal: () => createElement("div", { "data-testid": "mock-psd-import-modal" })
}));

vi.mock("./viewer-clean-stage", () => ({
  renderViewerCleanStageProjection: vi.fn()
}));

import { AppBar } from "../app-bar";
import { AuthoringWorkspaceContent } from "../authoring-workspace";
import { screenToCanvasPoint } from "../canvas/canvas-projection";
import {
  createViewerRuntimeCleanStageProjection,
  panViewerStageView,
  returnToAuthoringWorkspace,
  zoomViewerStageViewAtPoint,
  ViewerRuntimeScreen
} from "./viewer-runtime-screen";
import { createInitialRuntimeControlsState } from "./runtime-controls-state";
import {
  createViewerRuntimeInitialState,
  createViewerRuntimePlaybackModel,
  createViewerRuntimeReusableParameterValues,
  evaluateViewerRuntimePlaybackFrame,
  VIEWER_RUNTIME_FIXED_STEP_MS
} from "./viewer-runtime-playback";

type Live2dPerformanceTestGlobal = typeof globalThis & {
  __LIVE2D_PERF__?: boolean;
};

const PART_ROOT = PartIdSchema.parse("part_viewer_screen_root");
const PART_FACE = PartIdSchema.parse("part_viewer_screen_face");
const DRAW_FACE = DrawableIdSchema.parse("draw_viewer_screen_face");
const DRAW_EXPRESSION_DEFAULT = DrawableIdSchema.parse("draw_viewer_screen_expression_default");
const DRAW_EXPRESSION_ALT = DrawableIdSchema.parse("draw_viewer_screen_expression_alt");
const DRAW_ACCESSORY = DrawableIdSchema.parse("draw_viewer_screen_accessory");
const MESH_FACE = MeshIdSchema.parse("mesh_viewer_screen_face");
const MESH_EXPRESSION_DEFAULT = MeshIdSchema.parse("mesh_viewer_screen_expression_default");
const MESH_EXPRESSION_ALT = MeshIdSchema.parse("mesh_viewer_screen_expression_alt");
const MESH_ACCESSORY = MeshIdSchema.parse("mesh_viewer_screen_accessory");
const TEX_FACE = TextureIdSchema.parse("tex_viewer_screen_face");
const TEX_EXPRESSION_DEFAULT = TextureIdSchema.parse("tex_viewer_screen_expression_default");
const TEX_EXPRESSION_ALT = TextureIdSchema.parse("tex_viewer_screen_expression_alt");
const TEX_ACCESSORY = TextureIdSchema.parse("tex_viewer_screen_accessory");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_viewer_screen_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_viewer_screen_fixture");
const FACE_ANGLE_X = ParameterIdSchema.parse("param_face_angle_x");
const HAIR_SWAY_X = ParameterIdSchema.parse("param_viewer_hair_sway_x");
const DYNAMICS_GROUP = DynamicsGroupIdSchema.parse("dyn_viewer_hair_sway_x");
const RIG_FACE_WARP = RigControlIdSchema.parse("rig_viewer_screen_face_warp");
const GROUP_EXPRESSION = "vgrp_viewer_screen_expression";
const GROUP_ACCESSORY = "vgrp_viewer_screen_accessory";
const VAR_EXPRESSION_DEFAULT = "var_viewer_screen_expression_default";
const VAR_EXPRESSION_ALT = "var_viewer_screen_expression_alt";
const VAR_ACCESSORY = "var_viewer_screen_accessory";

describe("ViewerRuntimeScreen integration", () => {
  beforeEach(() => {
    viewerRuntimeTestState.editorSession.canRedo = false;
    viewerRuntimeTestState.editorSession.canUndo = false;
    viewerRuntimeTestState.editorSession.editorHiddenPartIds = new Set();
    viewerRuntimeTestState.editorSession.openProjectFile.mockClear();
    viewerRuntimeTestState.editorSession.openPsdImport.mockClear();
    viewerRuntimeTestState.editorSession.parameterValues = {};
    viewerRuntimeTestState.editorSession.projectIdentityLabel = "Viewer Fixture · rev 7";
    viewerRuntimeTestState.editorSession.projectSaveStatusLabel = "Saved";
    viewerRuntimeTestState.editorSession.projectStorage.status = "idle";
    viewerRuntimeTestState.editorSession.redo.mockClear();
    viewerRuntimeTestState.editorSession.resetActiveParameterValue.mockClear();
    viewerRuntimeTestState.editorSession.saveProject.mockClear();
    viewerRuntimeTestState.editorSession.selectDrawable.mockClear();
    viewerRuntimeTestState.editorSession.session = createRuntimeScreenSession();
    viewerRuntimeTestState.editorSession.setActiveParameterValue.mockClear();
    viewerRuntimeTestState.editorSession.undo.mockClear();
    viewerRuntimeTestState.iconButtons.splice(0, viewerRuntimeTestState.iconButtons.length);
    viewerRuntimeTestState.uiStore.activeEntry = "viewer";
    viewerRuntimeTestState.uiStore.setActiveEntry.mockClear();
    delete (globalThis as Live2dPerformanceTestGlobal).__LIVE2D_PERF__;
    resetLive2dPerformanceStats();
  });

  it("renders the dedicated Viewer screen from the viewer active entry and suppresses ParameterBar", () => {
    const markup = renderToStaticMarkup(
      createElement(AuthoringWorkspaceContent, { activeEntry: "viewer" })
    );
    const viewerMarkup = renderToStaticMarkup(createElement(ViewerRuntimeScreen));

    expect(markup).toContain('data-testid="viewer-runtime-screen"');
    expect(viewerMarkup).not.toContain("Viewer / Runtime View");
    expect(viewerMarkup).toContain("Clean Stage");
    expect(viewerMarkup).toContain("Finished Model Preview");
    expect(markup).toContain("Runtime Controls");
    expect(markup).toContain('data-testid="viewer-render-source-mode"');
    expect(markup).toContain("Original");
    expect(markup).toContain("Atlas Runtime");
    expect(markup).not.toContain('data-testid="viewer-variants-section"');
    expect(markup).toContain("Apply a texture atlas first.");
    expect(markup.indexOf('data-testid="viewer-render-source-mode"')).toBeLessThan(
      markup.indexOf('aria-label="Search parameters"')
    );
    expect(markup).toContain("Motion / Physics");
    expect(markup).toContain("Not configured");
    expect(viewerMarkup).toContain('aria-label="Back to Authoring Workspace"');
    expect(viewerMarkup.indexOf('aria-label="Back to Authoring Workspace"')).toBeLessThan(
      viewerMarkup.indexOf("Clean Stage")
    );
    expect(viewerMarkup).not.toContain("Reset pose");
    expect(markup).not.toContain("Parameter Bar");
    expect(markup).not.toContain('data-testid="canvas-preview-panel"');
    expect(markup).not.toContain("Add Keyform");
    expect(markup).not.toContain("Update Keyform");
    expect(markup).not.toContain("Delete Keyform");
    expect(markup).not.toContain("Mesh overlay");
    expect(markup).not.toContain("Deformer overlay");
    expect(markup).not.toContain("Screenshot");
    expect(viewerMarkup).not.toContain("Export");
    expect(markup).not.toContain("Compare");
    expect(markup).not.toContain("Favorite");
    expect(markup).not.toContain("Group");
  });

  it("renders Viewer Variants collapsed between render source and parameter search", () => {
    viewerRuntimeTestState.editorSession.session = createRuntimeScreenSessionWithVariants();

    const markup = renderToStaticMarkup(createElement(ViewerRuntimeScreen));

    expect(markup).toContain('data-testid="viewer-variants-section"');
    expect(markup.indexOf('data-testid="viewer-render-source-mode"')).toBeLessThan(
      markup.indexOf('data-testid="viewer-variants-section"')
    );
    expect(markup.indexOf('data-testid="viewer-variants-section"')).toBeLessThan(
      markup.indexOf('aria-label="Search parameters"')
    );
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("Expression: Happy");
    expect(markup).toContain("Accessory: None");
    expect(markup).not.toContain('data-testid="viewer-variants-expanded-controls"');
  });

  it("does not surface diagnostics warnings or badges in the Viewer route", () => {
    viewerRuntimeTestState.editorSession.session =
      createRuntimeScreenSessionWithDiagnosticsWarning();

    const markup = renderToStaticMarkup(
      createElement(AuthoringWorkspaceContent, { activeEntry: "viewer" })
    );

    expect(markup).toContain('data-testid="viewer-runtime-screen"');
    expect(markup).not.toContain('data-testid="diagnostics-warning-badge"');
    expect(markup).not.toContain('data-testid="diagnostics-screen"');
    expect(markup).not.toContain("Deterministic warning list");
    expect(markup).not.toMatch(/validation warning/i);
  });

  it("returns to Authoring Workspace through the Back action without authoring state mutation", () => {
    renderToStaticMarkup(createElement(ViewerRuntimeScreen));

    findIconButton("Back to Authoring Workspace").onClick?.(
      {} as ReactMouseEvent<HTMLButtonElement>
    );

    expect(viewerRuntimeTestState.uiStore.setActiveEntry).toHaveBeenCalledTimes(1);
    expect(viewerRuntimeTestState.uiStore.setActiveEntry).toHaveBeenCalledWith("workspace");
    expect(viewerRuntimeTestState.editorSession.setActiveParameterValue).not.toHaveBeenCalled();
    expect(viewerRuntimeTestState.editorSession.resetActiveParameterValue).not.toHaveBeenCalled();
    expect(viewerRuntimeTestState.editorSession.selectDrawable).not.toHaveBeenCalled();
  });

  it("does not duplicate Viewer navigation in the AppBar", () => {
    renderToStaticMarkup(createElement(AppBar));

    expect(
      viewerRuntimeTestState.iconButtons.some((button) => button.label === "Viewer")
    ).toBe(false);
    expect(viewerRuntimeTestState.editorSession.openPsdImport).not.toHaveBeenCalled();
  });

  it("keeps Viewer navigation in workspace-internal surfaces instead of the AppBar", () => {
    viewerRuntimeTestState.uiStore.activeEntry = "viewer";

    renderToStaticMarkup(createElement(AppBar));

    expect(
      viewerRuntimeTestState.iconButtons.some((button) => button.label === "Viewer")
    ).toBe(false);
  });

  it("feeds Runtime Controls overrides into the Clean Stage projection without mutating authoring values", () => {
    const session = createRuntimeScreenSession();
    const authoringParameterValues = Object.freeze({
      [FACE_ANGLE_X]: -30
    });
    const authoringOnly = createViewerRuntimeCleanStageProjection({
      authoringParameterValues,
      runtimeControlsState: createInitialRuntimeControlsState(),
      session
    });
    const runtimeOverride = createViewerRuntimeCleanStageProjection({
      authoringParameterValues,
      runtimeControlsState: {
        parameterOverrides: {
          [FACE_ANGLE_X]: 30
        },
        search: ""
      },
      session
    });

    expect(requireDrawable(authoringOnly.projection, DRAW_FACE).bounds.x).toBe(-12);
    expect(requireDrawable(runtimeOverride.projection, DRAW_FACE).bounds.x).toBe(12);
    expect(runtimeOverride.parameterValues[FACE_ANGLE_X]).toBe(30);
    expect(authoringParameterValues[FACE_ANGLE_X]).toBe(-30);
  });

  it("falls back to Original projection when selected Atlas Runtime is unavailable", () => {
    const session = createRuntimeScreenSession();
    const projection = createViewerRuntimeCleanStageProjection({
      authoringParameterValues: {},
      renderSourceMode: "atlasRuntime",
      runtimeControlsState: createInitialRuntimeControlsState(),
      session
    });

    expect(projection.requestedRenderSourceMode).toBe("atlasRuntime");
    expect(projection.renderSourceMode).toBe("original");
    expect(projection.atlasRuntimeAvailability).toMatchObject({
      status: "unavailable",
      code: "missingLayout",
      disabledReason: "Apply a texture atlas first."
    });
    expect(requireDrawable(projection.projection, DRAW_FACE).textureId).toBe(TEX_FACE);
  });

  it("applies Project default Variant selection to the Viewer Original projection", () => {
    const session = createRuntimeScreenSessionWithVariants();
    const beforeSession = JSON.stringify(session);
    const variantVisibilityPredicate = createVariantVisibilityPredicate({
      variantGroups: session.graph.variantGroups ?? []
    });

    const projection = createViewerRuntimeCleanStageProjection({
      authoringParameterValues: {},
      runtimeControlsState: createInitialRuntimeControlsState(),
      session,
      variantVisibilityPredicate
    });

    expect(requireDrawable(projection.projection, DRAW_FACE).visible).toBe(true);
    expect(requireDrawable(projection.projection, DRAW_EXPRESSION_DEFAULT).visible).toBe(true);
    expect(requireDrawable(projection.projection, DRAW_EXPRESSION_ALT).visible).toBe(false);
    expect(requireDrawable(projection.projection, DRAW_ACCESSORY).visible).toBe(false);
    expect(projection.projection.drawables.filter((drawable) => drawable.visible).length).toBe(2);
    expect(session.dirty).toBe(false);
    expect(JSON.stringify(session)).toBe(beforeSession);
  });

  it("keeps Variant-neutral drawables controlled by existing visibility predicates", () => {
    const session = createRuntimeScreenSessionWithVariants();
    const variantVisibilityPredicate = createVariantVisibilityPredicate({
      variantGroups: session.graph.variantGroups ?? []
    });
    const visibleProjection = createViewerRuntimeCleanStageProjection({
      authoringParameterValues: {},
      editorHiddenPartIds: new Set(),
      runtimeControlsState: createInitialRuntimeControlsState(),
      session,
      variantVisibilityPredicate
    });
    const hiddenPartProjection = createViewerRuntimeCleanStageProjection({
      authoringParameterValues: {},
      editorHiddenPartIds: new Set([PART_FACE]),
      runtimeControlsState: createInitialRuntimeControlsState(),
      session,
      variantVisibilityPredicate
    });

    expect(requireDrawable(visibleProjection.projection, DRAW_FACE).visible).toBe(true);
    expect(requireDrawable(hiddenPartProjection.projection, DRAW_FACE).visible).toBe(false);
    expect(requireDrawable(hiddenPartProjection.projection, DRAW_EXPRESSION_DEFAULT).visible).toBe(
      false
    );
  });

  it("advances Viewer Dynamics over runtime frames and keeps motion after driver stops", () => {
    const session = createRuntimeScreenSessionWithDynamics();
    const model = createViewerRuntimePlaybackModel(session);
    const initialState = createViewerRuntimeInitialState(model, {
      [FACE_ANGLE_X]: 0
    });
    const firstFrame = evaluateViewerRuntimePlaybackFrame({
      authoredParameterValues: {
        [FACE_ANGLE_X]: 30
      },
      deltaTimeMs: 16.6666667,
      frameIndex: 1,
      model,
      previousState: initialState
    });
    let settledFrame = firstFrame;

    for (let frameIndex = 2; frameIndex <= 121; frameIndex += 1) {
      settledFrame = evaluateViewerRuntimePlaybackFrame({
        authoredParameterValues: {
          [FACE_ANGLE_X]: 30
        },
        deltaTimeMs: 16.6666667,
        frameIndex,
        model,
        previousState: settledFrame.nextState
      });
    }

    const firstState = firstFrame.nextState.dynamicsGroups[DYNAMICS_GROUP];
    const settledState = settledFrame.nextState.dynamicsGroups[DYNAMICS_GROUP];
    expect(firstState?.tick).toBe(1);
    expect(settledState?.tick).toBe(121);
    expect(firstFrame.parameterValues[HAIR_SWAY_X]).not.toBe(0);

    // §3.7: the max particle speed (|x − px|) decays as the chain settles.
    const maxParticleSpeed = (
      state: typeof settledState
    ): number =>
      Math.max(
        ...(state?.particles ?? []).map((particle) =>
          Math.hypot(particle.x - particle.px, particle.y - particle.py)
        ),
        0
      );
    expect(maxParticleSpeed(settledState)).toBeLessThan(maxParticleSpeed(firstState));
  });

  it("reuses active Viewer Runtime frame parameter values for Clean Stage projection", () => {
    (globalThis as Live2dPerformanceTestGlobal).__LIVE2D_PERF__ = true;
    resetLive2dPerformanceStats();
    const session = createRuntimeScreenSessionWithDynamics();
    const model = createViewerRuntimePlaybackModel(session);
    const authoredParameterValues = {
      [FACE_ANGLE_X]: 30
    };
    const activeFrame = evaluateViewerRuntimePlaybackFrame({
      authoredParameterValues,
      deltaTimeMs: VIEWER_RUNTIME_FIXED_STEP_MS,
      frameIndex: 1,
      model,
      previousState: createViewerRuntimeInitialState(model, {
        [FACE_ANGLE_X]: 0
      })
    });
    const reusedProjection = createViewerRuntimeCleanStageProjection({
      authoringParameterValues: authoredParameterValues,
      runtimeControlsState: createInitialRuntimeControlsState(),
      runtimePlaybackModel: model,
      runtimePlaybackState: activeFrame.nextState,
      runtimeReusableParameterValues: createViewerRuntimeReusableParameterValues({
        authoredParameterValues,
        model,
        parameterValues: activeFrame.parameterValues,
        state: activeFrame.nextState
      }),
      session
    });
    const statsAfterReuse = getLive2dPerformanceStats();

    expect(statsAfterReuse?.counters).toMatchObject({
      "viewer.runtimeFrame.evaluations": 1,
      "viewer.runtimeFrame.deltaZeroReevaluationSkipped": 1
    });
    expect(
      statsAfterReuse?.counters["viewer.runtimeFrame.deltaZeroReevaluationFallback"]
    ).toBeUndefined();
    expect(statsAfterReuse?.timings["viewer.runtimeFrame.ms"]?.count).toBe(1);
    expect(statsAfterReuse?.timings["viewer.cleanStageProjection.ms"]?.count).toBe(1);
    expect(reusedProjection.parameterValues[HAIR_SWAY_X]).toBe(
      activeFrame.parameterValues[HAIR_SWAY_X]
    );

    const fallbackProjection = createViewerRuntimeCleanStageProjection({
      authoringParameterValues: authoredParameterValues,
      runtimeControlsState: createInitialRuntimeControlsState(),
      runtimePlaybackModel: model,
      runtimePlaybackState: activeFrame.nextState,
      session
    });

    expect(reusedProjection.parameterValues).toEqual(fallbackProjection.parameterValues);
    expect(requireDrawable(reusedProjection.projection, DRAW_FACE).bounds).toEqual(
      requireDrawable(fallbackProjection.projection, DRAW_FACE).bounds
    );
    expect(getLive2dPerformanceStats()?.counters).toMatchObject({
      "viewer.runtimeFrame.evaluations": 2,
      "viewer.runtimeFrame.deltaZeroReevaluationSkipped": 1,
      "viewer.runtimeFrame.deltaZeroReevaluationFallback": 1
    });
  });

  it("falls back to zero-delta evaluation when the reusable Viewer Runtime frame is stale", () => {
    const oldSession = createRuntimeScreenSessionWithDynamics();
    const oldModel = createViewerRuntimePlaybackModel(oldSession);
    const authoredParameterValues = {
      [FACE_ANGLE_X]: 30
    };
    const activeFrame = evaluateViewerRuntimePlaybackFrame({
      authoredParameterValues,
      deltaTimeMs: VIEWER_RUNTIME_FIXED_STEP_MS,
      frameIndex: 1,
      model: oldModel,
      previousState: createViewerRuntimeInitialState(oldModel, {
        [FACE_ANGLE_X]: 0
      })
    });
    const staleReusableValues = createViewerRuntimeReusableParameterValues({
      authoredParameterValues,
      model: oldModel,
      parameterValues: activeFrame.parameterValues,
      state: activeFrame.nextState
    });
    const nextSession = createRuntimeScreenSessionWithDynamics({
      packageId: PackageIdSchema.parse("pkg_viewer_runtime_screen_fixture_stale_reuse"),
      packageRevision: 1
    });
    const nextModel = createViewerRuntimePlaybackModel(nextSession);
    (globalThis as Live2dPerformanceTestGlobal).__LIVE2D_PERF__ = true;
    resetLive2dPerformanceStats();

    const projection = createViewerRuntimeCleanStageProjection({
      authoringParameterValues: {},
      runtimeControlsState: createInitialRuntimeControlsState(),
      runtimePlaybackModel: nextModel,
      runtimePlaybackState: activeFrame.nextState,
      runtimeReusableParameterValues: staleReusableValues,
      session: nextSession
    });

    expect(projection.parameterValues[HAIR_SWAY_X]).toBe(0);
    expect(getLive2dPerformanceStats()?.counters).toMatchObject({
      "viewer.runtimeFrame.evaluations": 1,
      "viewer.runtimeFrame.deltaZeroReevaluationFallback": 1
    });
    expect(
      getLive2dPerformanceStats()?.counters[
        "viewer.runtimeFrame.deltaZeroReevaluationSkipped"
      ]
    ).toBeUndefined();
  });

  it("keeps no-dynamics Clean Stage projection off the runtime evaluation path", () => {
    (globalThis as Live2dPerformanceTestGlobal).__LIVE2D_PERF__ = true;
    resetLive2dPerformanceStats();
    const projection = createViewerRuntimeCleanStageProjection({
      authoringParameterValues: {
        [FACE_ANGLE_X]: -30
      },
      runtimeControlsState: createInitialRuntimeControlsState(),
      session: createRuntimeScreenSession()
    });

    expect(requireDrawable(projection.projection, DRAW_FACE).bounds.x).toBe(-12);
    expect(getLive2dPerformanceStats()?.timings["viewer.cleanStageProjection.ms"]?.count).toBe(1);
    expect(
      getLive2dPerformanceStats()?.counters["viewer.runtimeFrame.evaluations"]
    ).toBeUndefined();
    expect(
      getLive2dPerformanceStats()?.counters[
        "viewer.runtimeFrame.deltaZeroReevaluationFallback"
      ]
    ).toBeUndefined();
  });

  it("keeps Viewer runtime performance instrumentation disabled by default", () => {
    const session = createRuntimeScreenSessionWithDynamics();
    const model = createViewerRuntimePlaybackModel(session);
    const authoredParameterValues = {
      [FACE_ANGLE_X]: 30
    };
    const activeFrame = evaluateViewerRuntimePlaybackFrame({
      authoredParameterValues,
      deltaTimeMs: VIEWER_RUNTIME_FIXED_STEP_MS,
      frameIndex: 1,
      model,
      previousState: createViewerRuntimeInitialState(model, {
        [FACE_ANGLE_X]: 0
      })
    });

    createViewerRuntimeCleanStageProjection({
      authoringParameterValues: authoredParameterValues,
      runtimeControlsState: createInitialRuntimeControlsState(),
      runtimePlaybackModel: model,
      runtimePlaybackState: activeFrame.nextState,
      runtimeReusableParameterValues: createViewerRuntimeReusableParameterValues({
        authoredParameterValues,
        model,
        parameterValues: activeFrame.parameterValues,
        state: activeFrame.nextState
      }),
      session
    });

    expect(getLive2dPerformanceStats()).toBeUndefined();
  });

  it("injects Dynamics output offsets into the Viewer Clean Stage before keyform evaluation", () => {
    const session = createRuntimeScreenSessionWithDynamics();
    const model = createViewerRuntimePlaybackModel(session);
    // §3.2 pin under FACE_ANGLE_X = 30 (φ = 30°) with rootOffset (5,0): P = R(30°)·(5,0).
    // Place the single chain particle directly below the pin so the chain hangs straight down
    // (θ_world = 0). §3.5: θ_local = θ_world − φ = −30°, output scale 1 → offset = clamp(−30, ±10)
    // = −10. HAIR_SWAY_X keyform maps −10 → warp offset −4, so bounds.x = −4.
    const pinX = 5 * Math.cos(Math.PI / 6);
    const pinY = 5 * Math.sin(Math.PI / 6);
    const restParticle = { x: pinX, y: pinY + 10, px: pinX, py: pinY + 10 };
    const runtimeState = {
      ...createViewerRuntimeInitialState(model, {
        [FACE_ANGLE_X]: 0
      }),
      dynamicsGroups: {
        [DYNAMICS_GROUP]: {
          particles: [restParticle],
          tick: 4,
          resetCounter: 1
        }
      }
    };
    const projection = createViewerRuntimeCleanStageProjection({
      authoringParameterValues: {},
      runtimeControlsState: {
        parameterOverrides: {
          [FACE_ANGLE_X]: 30,
          [HAIR_SWAY_X]: 9
        },
        search: ""
      },
      runtimePlaybackModel: model,
      runtimePlaybackState: runtimeState,
      session
    });

    expect(projection.baseParameterValues[FACE_ANGLE_X]).toBe(30);
    // Dynamics owns HAIR_SWAY_X, so the manual override (9) is ignored.
    expect(projection.baseParameterValues[HAIR_SWAY_X]).toBeUndefined();
    expect(projection.parameterValues[HAIR_SWAY_X]).toBe(-10);
    expect(requireDrawable(projection.projection, DRAW_FACE).bounds.x).toBe(-4);
  });

  it("resets Viewer simulation state without changing Runtime Controls overrides", () => {
    const session = createRuntimeScreenSessionWithDynamics();
    const model = createViewerRuntimePlaybackModel(session);
    const runtimeControlsState = Object.freeze({
      parameterOverrides: {
        [FACE_ANGLE_X]: 30
      },
      search: ""
    });
    const projection = createViewerRuntimeCleanStageProjection({
      authoringParameterValues: {},
      runtimeControlsState,
      runtimePlaybackModel: model,
      session
    });
    const resetState = createViewerRuntimeInitialState(
      model,
      projection.baseParameterValues,
      "manualCommand"
    );

    // §3.4 reset: particles aligned straight below the pin with zero velocity (x === px, y === py).
    const resetGroupState = resetState.dynamicsGroups[DYNAMICS_GROUP];
    expect(resetGroupState?.tick).toBe(0);
    expect(resetGroupState?.particles).toHaveLength(1);
    for (const particle of resetGroupState?.particles ?? []) {
      expect(particle.x).toBe(particle.px);
      expect(particle.y).toBe(particle.py);
    }
    expect(runtimeControlsState.parameterOverrides[FACE_ANGLE_X]).toBe(30);
    expect(session.dirty).toBe(false);
  });

  it("discards stale Dynamics state when a new project reuses a Dynamics Group id", () => {
    const oldSession = createRuntimeScreenSessionWithDynamics();
    const oldModel = createViewerRuntimePlaybackModel(oldSession);
    const staleParticle = { x: 7, y: 3, px: 6.5, py: 2 };
    const staleState = {
      ...createViewerRuntimeInitialState(oldModel, {
        [FACE_ANGLE_X]: 0
      }),
      dynamicsGroups: {
        [DYNAMICS_GROUP]: {
          particles: [staleParticle],
          tick: 99,
          resetCounter: 4
        }
      }
    };
    const nextSession = createRuntimeScreenSessionWithDynamics({
      packageId: PackageIdSchema.parse("pkg_viewer_runtime_screen_fixture_next"),
      packageRevision: 1
    });
    const nextModel = createViewerRuntimePlaybackModel(nextSession);
    const evaluated = evaluateViewerRuntimePlaybackFrame({
      authoredParameterValues: {
        [FACE_ANGLE_X]: 0
      },
      deltaTimeMs: 0,
      frameIndex: 1,
      model: nextModel,
      previousState: staleState
    });
    const projection = createViewerRuntimeCleanStageProjection({
      authoringParameterValues: {},
      runtimeControlsState: createInitialRuntimeControlsState(),
      runtimePlaybackModel: nextModel,
      runtimePlaybackState: staleState,
      session: nextSession
    });

    // The stale particle (velocity x ≠ px) is discarded; the fresh state resets straight-down with
    // zero velocity.
    const freshGroupState = evaluated.nextState.dynamicsGroups[DYNAMICS_GROUP];
    expect(freshGroupState?.tick).toBe(0);
    expect(freshGroupState?.particles).toHaveLength(1);
    for (const particle of freshGroupState?.particles ?? []) {
      expect(particle.x).toBe(particle.px);
      expect(particle.y).toBe(particle.py);
    }
    expect(freshGroupState?.particles[0]).not.toEqual(staleParticle);
    expect(projection.parameterValues[HAIR_SWAY_X]).toBe(0);
  });

  it("stops the Viewer Dynamics playback loop after settled state", async () => {
    const animationFrame = installAnimationFrameMock();
    viewerRuntimeTestState.editorSession.session = createRuntimeScreenSessionWithDynamics();
    viewerRuntimeTestState.editorSession.parameterValues = {};
    const harness = await renderViewerRuntimeScreenInteractive();

    try {
      expect(animationFrame.pendingCount()).toBe(1);

      const flushedFrameCount = await flushAnimationFramesUntilIdle(animationFrame, 180);
      expect(flushedFrameCount).toBeGreaterThanOrEqual(36);
      expect(animationFrame.pendingCount()).toBe(0);

      const requestCountAtIdle = getAnimationFrameRequestCount();
      await flushAnimationFrames(animationFrame, 4);

      expect(animationFrame.pendingCount()).toBe(0);
      expect(getAnimationFrameRequestCount()).toBe(requestCountAtIdle);
    } finally {
      await harness.cleanup();
      animationFrame.restore();
    }
  });

  it("restarts Viewer Dynamics playback from idle when a driver value changes", async () => {
    const animationFrame = installAnimationFrameMock();
    viewerRuntimeTestState.editorSession.session = createRuntimeScreenSessionWithDynamics();
    viewerRuntimeTestState.editorSession.parameterValues = {};
    const harness = await renderViewerRuntimeScreenInteractive();

    try {
      await flushAnimationFramesUntilIdle(animationFrame, 180);
      expect(animationFrame.pendingCount()).toBe(0);
      expect(getViewerCanvasFirstDrawableBoundsX(harness.container)).toBe(0);
      const requestCountAtIdle = getAnimationFrameRequestCount();

      viewerRuntimeTestState.editorSession.parameterValues = {
        [FACE_ANGLE_X]: 30
      };
      await harness.render();

      expect(animationFrame.pendingCount()).toBe(1);
      await flushAnimationFrames(animationFrame, 8);

      expect(getAnimationFrameRequestCount()).toBeGreaterThan(requestCountAtIdle + 1);
      expect(getViewerCanvasFirstDrawableBoundsX(harness.container)).not.toBe(0);
      expect(animationFrame.pendingCount()).toBe(1);

      await flushAnimationFramesUntilIdle(animationFrame, 360);
      expect(animationFrame.pendingCount()).toBe(0);
    } finally {
      await harness.cleanup();
      animationFrame.restore();
    }
  });

  it("restarts Reset simulation while preserving Runtime Controls overrides", async () => {
    const animationFrame = installAnimationFrameMock();
    viewerRuntimeTestState.editorSession.session = createRuntimeScreenSessionWithDynamics();
    viewerRuntimeTestState.editorSession.parameterValues = {};
    const harness = await renderViewerRuntimeScreenInteractive();

    try {
      await flushAnimationFramesUntilIdle(animationFrame, 180);
      await changeFakeInputValue(
        getFakeElementByAttribute(harness.container, "aria-label", "Face Angle X value"),
        "30"
      );
      expect(
        getFakeElementByAttribute(harness.container, "aria-label", "Face Angle X value").value
      ).toBe("30");
      expect(animationFrame.pendingCount()).toBe(1);
      const requestCountBeforeReset = getAnimationFrameRequestCount();

      await clickTestId(harness.container, "viewer-reset-simulation");

      expect(
        getFakeElementByAttribute(harness.container, "aria-label", "Face Angle X value").value
      ).toBe("30");
      expect(animationFrame.pendingCount()).toBe(1);
      expect(getAnimationFrameRequestCount()).toBeGreaterThan(requestCountBeforeReset);

      await flushAnimationFrames(animationFrame, 2);
      expect(
        getFakeElementByAttribute(harness.container, "aria-label", "Face Angle X value").value
      ).toBe("30");
    } finally {
      await harness.cleanup();
      animationFrame.restore();
    }
  });

  it("resets incompatible Viewer playback state when the runtime session identity changes", async () => {
    const animationFrame = installAnimationFrameMock();
    viewerRuntimeTestState.editorSession.session = createRuntimeScreenSessionWithDynamics();
    viewerRuntimeTestState.editorSession.parameterValues = {
      [FACE_ANGLE_X]: 30
    };
    const harness = await renderViewerRuntimeScreenInteractive();

    try {
      await flushAnimationFrames(animationFrame, 8);
      expect(getViewerCanvasFirstDrawableBoundsX(harness.container)).not.toBe(0);

      viewerRuntimeTestState.editorSession.session = createRuntimeScreenSessionWithDynamics({
        packageId: PackageIdSchema.parse("pkg_viewer_runtime_screen_fixture_changed"),
        packageRevision: 1
      });
      viewerRuntimeTestState.editorSession.parameterValues = {};
      await harness.render();

      expect(getViewerCanvasFirstDrawableBoundsX(harness.container)).toBe(0);
      expect(animationFrame.pendingCount()).toBe(1);

      await flushAnimationFrames(animationFrame, 1);
      expect(getViewerCanvasFirstDrawableBoundsX(harness.container)).toBe(0);
    } finally {
      await harness.cleanup();
      animationFrame.restore();
    }
  });

  it("does not start the Viewer playback loop when Dynamics Groups are absent", async () => {
    const animationFrame = installAnimationFrameMock();
    viewerRuntimeTestState.editorSession.session = createRuntimeScreenSession();
    viewerRuntimeTestState.editorSession.parameterValues = {};
    const harness = await renderViewerRuntimeScreenInteractive();

    try {
      expect(animationFrame.pendingCount()).toBe(0);
      expect(getAnimationFrameRequestCount()).toBe(0);
    } finally {
      await harness.cleanup();
      animationFrame.restore();
    }
  });

  it("switches Viewer-local Variants and resets them without mutating Project state", async () => {
    const session = createRuntimeScreenSessionWithVariants();
    const beforeVariantGroups = structuredClone(session.graph.variantGroups);
    viewerRuntimeTestState.editorSession.session = session;
    viewerRuntimeTestState.editorSession.parameterValues = {};
    const harness = await renderViewerRuntimeScreenInteractive();

    try {
      expect(getViewerCanvasVisibleDrawableCount(harness.container)).toBe(2);
      expect(getViewerVariantsSummary(harness.container)).toContain("Expression: Happy");
      expect(getViewerVariantsSummary(harness.container)).toContain("Accessory: None");
      expect(
        getFakeElementByAttribute(harness.container, "data-testid", "viewer-variants-toggle")
          .getAttribute("aria-expanded")
      ).toBe("false");

      await clickTestId(harness.container, "viewer-variants-toggle");
      expect(
        getFakeElementByAttribute(
          harness.container,
          "data-testid",
          "viewer-variants-expanded-controls"
        )
      ).toBeDefined();

      await clickFakeElementByAttribute(
        harness.container,
        "aria-label",
        "Select Sad in Expression"
      );
      expect(getViewerVariantsSummary(harness.container)).toContain("Expression: Sad");
      expect(getViewerCanvasVisibleDrawableCount(harness.container)).toBe(2);

      await clickFakeElementByAttribute(
        harness.container,
        "aria-label",
        "Toggle Glasses in Accessory"
      );
      expect(getViewerVariantsSummary(harness.container)).toContain("Accessory: Glasses");
      expect(getViewerCanvasVisibleDrawableCount(harness.container)).toBe(3);

      await clickTestId(harness.container, "viewer-reset-variants");
      expect(getViewerVariantsSummary(harness.container)).toContain("Expression: Happy");
      expect(getViewerVariantsSummary(harness.container)).toContain("Accessory: None");
      expect(getViewerCanvasVisibleDrawableCount(harness.container)).toBe(2);
      expect(session.graph.variantGroups).toEqual(beforeVariantGroups);
      expect(session.dirty).toBe(false);
      expect(viewerRuntimeTestState.editorSession.saveProject).not.toHaveBeenCalled();
    } finally {
      await harness.cleanup();
    }
  });

  it("passes editor Parts Container visibility into the Clean Stage projection", () => {
    const session = createRuntimeScreenSession();
    const visibleProjection = createViewerRuntimeCleanStageProjection({
      authoringParameterValues: {},
      editorHiddenPartIds: new Set(),
      runtimeControlsState: createInitialRuntimeControlsState(),
      session
    });
    const hiddenPartProjection = createViewerRuntimeCleanStageProjection({
      authoringParameterValues: {},
      editorHiddenPartIds: new Set([PART_FACE]),
      runtimeControlsState: createInitialRuntimeControlsState(),
      session
    });
    const hiddenAncestorProjection = createViewerRuntimeCleanStageProjection({
      authoringParameterValues: {},
      editorHiddenPartIds: new Set([PART_ROOT]),
      runtimeControlsState: createInitialRuntimeControlsState(),
      session
    });

    expect(requireDrawable(visibleProjection.projection, DRAW_FACE).visible).toBe(true);
    expect(requireDrawable(hiddenPartProjection.projection, DRAW_FACE).visible).toBe(false);
    expect(requireDrawable(hiddenAncestorProjection.projection, DRAW_FACE).visible).toBe(false);
  });

  it("projects Viewer-local wheel zoom and drag pan without mutating project state", () => {
    const session = createRuntimeScreenSession();
    const beforeSession = JSON.stringify(session);
    const view = {
      zoom: 1,
      pan: { x: 0, y: 0 }
    };
    const localPoint = { x: 80, y: 48 };

    const zoomed = zoomViewerStageViewAtPoint({
      deltaY: -120,
      localPoint,
      view
    });
    const panned = panViewerStageView(zoomed, { x: 12, y: -7 });
    const beforeCanvasPoint = screenToCanvasPoint(localPoint, view);
    const zoomedCanvasPoint = screenToCanvasPoint(localPoint, zoomed);

    expect(zoomed.zoom).toBeGreaterThan(view.zoom);
    expect(zoomedCanvasPoint.x).toBeCloseTo(beforeCanvasPoint.x);
    expect(zoomedCanvasPoint.y).toBeCloseTo(beforeCanvasPoint.y);
    expect(panned.pan).toEqual({
      x: zoomed.pan.x + 12,
      y: zoomed.pan.y - 7
    });
    expect(JSON.stringify(session)).toBe(beforeSession);
    expect(view).toEqual({
      zoom: 1,
      pan: { x: 0, y: 0 }
    });
    expect(viewerRuntimeTestState.editorSession.setActiveParameterValue).not.toHaveBeenCalled();
    expect(viewerRuntimeTestState.editorSession.selectDrawable).not.toHaveBeenCalled();
  });

  it("keeps the Back helper scoped to activeEntry only", () => {
    returnToAuthoringWorkspace(viewerRuntimeTestState.uiStore.setActiveEntry);

    expect(viewerRuntimeTestState.uiStore.setActiveEntry).toHaveBeenCalledWith("workspace");
  });
});

function findIconButton(label: string) {
  const button = viewerRuntimeTestState.iconButtons.find(
    (candidate) => candidate.label === label
  );
  if (button === undefined) {
    throw new Error(`IconButton "${label}" was not rendered.`);
  }

  return button;
}

function requireDrawable(
  projection: ReturnType<typeof createViewerRuntimeCleanStageProjection>["projection"],
  drawableId: DrawableId
) {
  const drawable = projection.drawables.find((candidate) => candidate.drawableId === drawableId);
  if (drawable === undefined) {
    throw new Error(`Expected drawable ${drawableId}.`);
  }

  return drawable;
}

function createRuntimeScreenSession(
  options: {
    readonly packageId?: ReturnType<typeof PackageIdSchema.parse>;
    readonly packageRevision?: number;
  } = {}
): AuthoringSession {
  return {
    packageIdentity: {
      packageId: options.packageId ?? PackageIdSchema.parse("pkg_viewer_runtime_screen_fixture"),
      packageDisplayName: "Viewer Fixture",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: options.packageRevision ?? 7,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { height: 160, width: 160 },
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
          displayName: "Face",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_FACE],
          children: [{ kind: "drawable", drawableId: DRAW_FACE }]
        }
      ],
      drawables: [createDrawable(DRAW_FACE, MESH_FACE, TEX_FACE, "Face")],
      meshes: [createMesh(MESH_FACE, DRAW_FACE, { height: 100, width: 100, x: 0, y: 0 })],
      parameters: [],
      keyformSets: [
        {
          keyformSetId: KeyformSetIdSchema.parse("keyset_viewer_screen_face_warp_offsets"),
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
            { value: -30, statePatch: createOffsets(4, -12, 0) },
            { value: 0, statePatch: createOffsets(4, 0, 0) },
            { value: 30, statePatch: createOffsets(4, 12, 0) }
          ]
        }
      ],
      rigControls: [
        {
          kind: "warpLattice2d",
          rigControlId: RIG_FACE_WARP,
          displayName: "Face Warp",
          partId: PART_FACE,
          childDrawableIds: [DRAW_FACE],
          childRigControlIds: [],
          bindSpace: "rigControlLocalRest",
          domainBounds: { height: 100, width: 100, x: 0, y: 0 },
          latticeColumns: 2,
          latticeRows: 2,
          restControlPoints: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 0, y: 100 },
            { x: 100, y: 100 }
          ],
          interpolationMethod: "bilinear-grid-v1",
          enabled: true
        }
      ],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [{ drawableId: DRAW_FACE, baseDrawOrder: 0, stableOrder: 0 }],
      rigControlRootIds: [RIG_FACE_WARP],
      stableOrder: [PART_ROOT, PART_FACE, DRAW_FACE],
      sourceAssets: [],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          {
            textureId: TEX_FACE,
            filePath: "assets/textures/viewer-runtime-screen-face.rgba",
            sourceAssetId: SOURCE_ASSET,
            sourceLayerId: "layer_viewer_runtime_screen_face",
            provenanceId: PROVENANCE
          }
        ]
      },
      provenanceRecords: [],
      rightsRecords: []
    }
  } as AuthoringSession;
}

function createRuntimeScreenSessionWithVariants(): AuthoringSession {
  const session = createRuntimeScreenSession();
  const facePart = session.graph.parts.find((part) => part.partId === PART_FACE);
  if (facePart === undefined) {
    throw new Error("Expected face part.");
  }

  facePart.drawableIds.push(DRAW_EXPRESSION_DEFAULT, DRAW_EXPRESSION_ALT, DRAW_ACCESSORY);
  facePart.children?.push(
    { kind: "drawable", drawableId: DRAW_EXPRESSION_DEFAULT },
    { kind: "drawable", drawableId: DRAW_EXPRESSION_ALT },
    { kind: "drawable", drawableId: DRAW_ACCESSORY }
  );
  session.graph.drawables.push(
    createDrawable(
      DRAW_EXPRESSION_DEFAULT,
      MESH_EXPRESSION_DEFAULT,
      TEX_EXPRESSION_DEFAULT,
      "Happy"
    ),
    createDrawable(DRAW_EXPRESSION_ALT, MESH_EXPRESSION_ALT, TEX_EXPRESSION_ALT, "Sad"),
    createDrawable(DRAW_ACCESSORY, MESH_ACCESSORY, TEX_ACCESSORY, "Glasses")
  );
  session.graph.meshes.push(
    createMesh(MESH_EXPRESSION_DEFAULT, DRAW_EXPRESSION_DEFAULT, {
      height: 20,
      width: 20,
      x: 16,
      y: 16
    }),
    createMesh(MESH_EXPRESSION_ALT, DRAW_EXPRESSION_ALT, {
      height: 20,
      width: 20,
      x: 40,
      y: 16
    }),
    createMesh(MESH_ACCESSORY, DRAW_ACCESSORY, {
      height: 12,
      width: 36,
      x: 30,
      y: 42
    })
  );
  session.graph.drawOrder.push(
    { drawableId: DRAW_EXPRESSION_DEFAULT, baseDrawOrder: 1, stableOrder: 1 },
    { drawableId: DRAW_EXPRESSION_ALT, baseDrawOrder: 2, stableOrder: 2 },
    { drawableId: DRAW_ACCESSORY, baseDrawOrder: 3, stableOrder: 3 }
  );
  session.graph.stableOrder.push(
    DRAW_EXPRESSION_DEFAULT,
    DRAW_EXPRESSION_ALT,
    DRAW_ACCESSORY
  );
  session.graph.textureAtlas?.textures.push(
    createRuntimeScreenTexture(TEX_EXPRESSION_DEFAULT, "expression-default"),
    createRuntimeScreenTexture(TEX_EXPRESSION_ALT, "expression-alt"),
    createRuntimeScreenTexture(TEX_ACCESSORY, "accessory")
  );
  session.graph.variantGroups = [
    {
      variantGroupId: GROUP_EXPRESSION as never,
      displayName: "Expression",
      mode: "singleSelect",
      variants: [
        { variantId: VAR_EXPRESSION_DEFAULT as never, displayName: "Happy" },
        { variantId: VAR_EXPRESSION_ALT as never, displayName: "Sad" }
      ],
      targetDrawableIds: [DRAW_EXPRESSION_DEFAULT, DRAW_EXPRESSION_ALT],
      memberships: [
        {
          drawableId: DRAW_EXPRESSION_DEFAULT,
          variantIds: [VAR_EXPRESSION_DEFAULT as never]
        },
        {
          drawableId: DRAW_EXPRESSION_ALT,
          variantIds: [VAR_EXPRESSION_ALT as never]
        }
      ],
      defaultActive: {
        kind: "singleSelect",
        variantId: VAR_EXPRESSION_DEFAULT as never
      }
    },
    {
      variantGroupId: GROUP_ACCESSORY as never,
      displayName: "Accessory",
      mode: "multiToggle",
      variants: [{ variantId: VAR_ACCESSORY as never, displayName: "Glasses" }],
      targetDrawableIds: [DRAW_ACCESSORY],
      memberships: [
        {
          drawableId: DRAW_ACCESSORY,
          variantIds: [VAR_ACCESSORY as never]
        }
      ],
      defaultActive: {
        kind: "multiToggle",
        variantIds: []
      }
    }
  ];

  return session;
}

function createRuntimeScreenSessionWithDynamics(
  options: {
    readonly packageId?: ReturnType<typeof PackageIdSchema.parse>;
    readonly packageRevision?: number;
  } = {}
): AuthoringSession {
  const session = createRuntimeScreenSession(options);
  session.graph.parameters.push({
    parameterId: HAIR_SWAY_X,
    displayName: "Hair Sway X",
    valueSource: "authoredInput",
    min: -10,
    default: 0,
    max: 10,
    recommendedUiStep: 0.1,
    kind: "custom",
    parameterType: "scalar",
    group: "custom",
    lockedFields: []
  });
  session.graph.keyformSets.push({
    keyformSetId: KeyformSetIdSchema.parse("keyset_viewer_screen_hair_sway_offsets"),
    target: {
      kind: "rigControl",
      id: RIG_FACE_WARP,
      property: "controlPointOffsets"
    },
    parameterId: HAIR_SWAY_X,
    evaluator: "linear-1d-v1",
    interpolation: "linear-1d-v1",
    compositionMode: "replace",
    compositionOrder: 1,
    keys: [
      { value: -10, statePatch: createOffsets(4, -4, 0) },
      { value: 0, statePatch: createOffsets(4, 0, 0) },
      { value: 10, statePatch: createOffsets(4, 4, 0) }
    ]
  });
  session.graph.dynamicsGroups.push({
    dynamicsGroupId: DYNAMICS_GROUP,
    displayName: "Viewer Hair Sway X",
    enabled: true,
    presetId: "hair",
    inputs: [
      {
        parameterId: FACE_ANGLE_X,
        kind: "angle",
        scale: 1
      }
    ],
    // rootOffset != 0 gives the angle driver a lever arm (§3.6) so the chain is excited and settles.
    chain: {
      rootOffset: { x: 5, y: 0 },
      segmentLengths: [10],
      damping: 4,
      gravityScale: 1
    },
    // scale 1 (unit/deg) maps θ_local 1:1 to the output offset, clamped to ±10.
    outputs: [
      {
        parameterId: HAIR_SWAY_X,
        segmentIndex: 1,
        scale: 1,
        limit: 10
      }
    ]
  });

  return session;
}

function createRuntimeScreenSessionWithDiagnosticsWarning(): AuthoringSession {
  const session = createRuntimeScreenSessionWithDynamics();
  session.graph.keyformSets = session.graph.keyformSets.filter(
    (keyformSet) =>
      keyformSet.evaluator !== "linear-1d-v1" ||
      keyformSet.parameterId !== HAIR_SWAY_X
  );

  return session;
}

function createRuntimeScreenTexture(textureId: TextureId, token: string) {
  return {
    textureId,
    filePath: `assets/textures/viewer-runtime-screen-${token}.rgba`,
    sourceAssetId: SOURCE_ASSET,
    sourceLayerId: `layer_viewer_runtime_screen_${token}`,
    provenanceId: PROVENANCE
  };
}

function createDrawable(
  drawableId: DrawableId,
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  textureId: TextureId,
  displayName: string
) {
  return {
    drawableId,
    displayName,
    partId: PART_FACE,
    sourceAssetId: SOURCE_ASSET,
    textureId,
    meshId,
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: 0,
    sourceProvenanceId: PROVENANCE
  };
}

function createMesh(
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  drawableId: DrawableId,
  bounds: RectDto
) {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;

  return {
    meshId,
    drawableId,
    vertices: [
      { x: bounds.x, y: bounds.y },
      { x: right, y: bounds.y },
      { x: right, y: bottom },
      { x: bounds.x, y: bottom }
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
    ] as [number, number, number][],
    vertexStableIds: ["vtx_0", "vtx_1", "vtx_2", "vtx_3"],
    bounds,
    generationProvenanceId: PROVENANCE
  };
}

function createOffsets(count: number, x: number, y: number) {
  return Array.from({ length: count }, () => ({ x, y }));
}

async function renderViewerRuntimeScreenInteractive(): Promise<{
  readonly cleanup: () => Promise<void>;
  readonly container: FakeElement;
  readonly render: () => Promise<void>;
}> {
  const fakeRoot = createFakeDomRoot();
  let reactRoot: Root | null = createRoot(fakeRoot.container as unknown as Element);
  const render = async () => {
    await act(async () => {
      reactRoot?.render(createElement(ViewerRuntimeScreen));
    });
  };

  await render();

  return {
    container: fakeRoot.container,
    render,
    cleanup: async () => {
      await act(async () => {
        reactRoot?.unmount();
      });
      reactRoot = null;
      fakeRoot.restore();
    }
  };
}

async function clickTestId(root: FakeElement, testId: string): Promise<void> {
  const element = getFakeElementByAttribute(root, "data-testid", testId);
  await act(async () => {
    getFakeReactProps(element).onClick?.();
  });
}

async function changeFakeInputValue(element: FakeElement, value: string): Promise<void> {
  element.value = value;
  await act(async () => {
    getFakeReactProps(element).onChange?.({ currentTarget: element });
  });
}

async function flushAnimationFrames(
  animationFrame: InstalledAnimationFrameMock,
  maxFrameCount: number
): Promise<number> {
  let flushedFrameCount = 0;
  for (let frameIndex = 0; frameIndex < maxFrameCount; frameIndex += 1) {
    if (animationFrame.pendingCount() === 0) {
      break;
    }

    await act(async () => {
      animationFrame.flushNext((frameIndex + 1) * VIEWER_RUNTIME_FIXED_STEP_MS);
    });
    flushedFrameCount += 1;
  }

  return flushedFrameCount;
}

async function flushAnimationFramesUntilIdle(
  animationFrame: InstalledAnimationFrameMock,
  maxFrameCount: number
): Promise<number> {
  const flushedFrameCount = await flushAnimationFrames(animationFrame, maxFrameCount);
  if (animationFrame.pendingCount() !== 0) {
    throw new Error(`Expected rAF loop to become idle within ${maxFrameCount} frames.`);
  }

  return flushedFrameCount;
}

function getAnimationFrameRequestCount(): number {
  return vi.mocked(globalThis.requestAnimationFrame).mock.calls.length;
}

function getViewerCanvasFirstDrawableBoundsX(root: FakeElement): number {
  const rawValue = getFakeElementByAttribute(
    root,
    "data-testid",
    "viewer-clean-stage-canvas"
  ).getAttribute("data-first-drawable-bounds-x");
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new Error(`Expected finite first drawable x, got ${rawValue ?? "null"}.`);
  }

  return value;
}

function getViewerCanvasVisibleDrawableCount(root: FakeElement): number {
  const rawValue = getFakeElementByAttribute(
    root,
    "data-testid",
    "viewer-clean-stage-canvas"
  ).getAttribute("data-visible-drawable-count");
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new Error(`Expected finite visible count, got ${rawValue ?? "null"}.`);
  }

  return value;
}

function getViewerVariantsSummary(root: FakeElement): string {
  return getFakeElementByAttribute(
    root,
    "data-testid",
    "viewer-variants-summary"
  ).textContent;
}

async function clickFakeElementByAttribute(
  root: FakeElement,
  attributeName: string,
  attributeValue: string
): Promise<void> {
  await act(async () => {
    getFakeReactProps(
      getFakeElementByAttribute(root, attributeName, attributeValue)
    ).onClick?.();
  });
}

type FakeReactProps = {
  readonly onChange?: (event: { readonly currentTarget: FakeElement }) => void;
  readonly onClick?: () => void;
};

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
  disabled = false;
  max = "";
  min = "";
  namespaceURI = "http://www.w3.org/1999/xhtml";
  nodeValue: string | null = null;
  parentNode: FakeElement | null = null;
  selected = false;
  tabIndex = 0;
  type = "";
  value = "";

  private readonly attributes = new Map<string, string>();
  private readonly pointerCaptures = new Set<number>();

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

  get options(): FakeElement[] {
    return this.childNodes.filter(
      (child): child is FakeElement => child instanceof FakeElement && child.localName === "option"
    );
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
    const normalized = String(value);
    this.attributes.set(name, normalized);
    if (name === "value") {
      this.value = normalized;
    } else if (name === "min") {
      this.min = normalized;
    } else if (name === "max") {
      this.max = normalized;
    } else if (name === "type") {
      this.type = normalized;
    } else if (name === "disabled") {
      this.disabled = true;
    } else if (name === "selected") {
      this.selected = true;
    } else if (name === "tabindex") {
      this.tabIndex = Number(normalized);
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name === "disabled" || name === "selected") {
      this[name] = false;
    }
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

  focus(): void {
    this.ownerDocument.activeElement = this;
  }

  getBoundingClientRect(): Pick<DOMRect, "left" | "top" | "width" | "height"> {
    return {
      left: 0,
      top: 0,
      width: 100,
      height: 100
    };
  }

  setPointerCapture(pointerId: number): void {
    this.pointerCaptures.add(pointerId);
  }

  releasePointerCapture(pointerId: number): void {
    this.pointerCaptures.delete(pointerId);
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.pointerCaptures.has(pointerId);
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
    readonly clearTimeout: typeof globalThis.clearTimeout;
    readonly setTimeout: typeof globalThis.setTimeout;
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
      HTMLIFrameElement: class HTMLIFrameElement {},
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      setTimeout: globalThis.setTimeout.bind(globalThis)
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

function getFakeElementByAttribute(
  root: FakeElement,
  attributeName: string,
  attributeValue: string
): FakeElement {
  const element = findFakeElements(
    root,
    (candidate) => candidate.getAttribute(attributeName) === attributeValue
  )[0];
  if (element === undefined) {
    throw new Error(`Element with ${attributeName}="${attributeValue}" was not rendered.`);
  }

  return element;
}

function findFakeElements(
  root: FakeElement,
  predicate: (element: FakeElement) => boolean
): FakeElement[] {
  const matches: FakeElement[] = [];
  if (predicate(root)) {
    matches.push(root);
  }

  root.childNodes.forEach((child) => {
    if (child instanceof FakeElement) {
      matches.push(...findFakeElements(child, predicate));
    }
  });

  return matches;
}

function getFakeReactProps(element: FakeElement): FakeReactProps {
  const key = Object.keys(element).find((candidate) => candidate.startsWith("__reactProps$"));
  if (key === undefined) {
    return {};
  }

  return (element as unknown as Record<string, FakeReactProps>)[key] ?? {};
}

interface InstalledAnimationFrameMock {
  readonly flushNext: (timestamp?: number) => void;
  readonly pendingCount: () => number;
  readonly restore: () => void;
}

function installAnimationFrameMock(): InstalledAnimationFrameMock {
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  const previousCancelAnimationFrame = globalThis.cancelAnimationFrame;
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextFrameId = 1;

  globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    const frameId = nextFrameId;
    nextFrameId += 1;
    callbacks.set(frameId, callback);
    return frameId;
  });
  globalThis.cancelAnimationFrame = vi.fn((frameId: number) => {
    callbacks.delete(frameId);
  });

  return {
    flushNext: (timestamp = 0) => {
      const entry = callbacks.entries().next().value;
      if (entry === undefined) {
        return;
      }

      const [frameId, callback] = entry;
      callbacks.delete(frameId);
      callback(timestamp);
    },
    pendingCount: () => callbacks.size,
    restore: () => {
      globalThis.requestAnimationFrame = previousRequestAnimationFrame;
      globalThis.cancelAnimationFrame = previousCancelAnimationFrame;
    }
  };
}
