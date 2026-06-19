import {
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
import type {
  ButtonHTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode
} from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const viewerRuntimeTestState = vi.hoisted(() => ({
  editorSession: {
    canRedo: false,
    canUndo: false,
    editorHiddenPartIds: new Set(),
    openProjectFile: vi.fn(),
    openPsdImport: vi.fn(),
    parameterValues: {},
    projectIdentityLabel: "Viewer Fixture · rev 7",
    projectSaveStatusLabel: "Saved",
    projectStorage: {
      status: "idle"
    },
    redo: vi.fn(),
    resetActiveParameterValue: vi.fn(),
    saveProject: vi.fn(),
    selectDrawable: vi.fn(),
    session: undefined as unknown as AuthoringSession,
    setActiveParameterValue: vi.fn(),
    undo: vi.fn()
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
  evaluateViewerRuntimePlaybackFrame
} from "./viewer-runtime-playback";

const PART_ROOT = PartIdSchema.parse("part_viewer_screen_root");
const PART_FACE = PartIdSchema.parse("part_viewer_screen_face");
const DRAW_FACE = DrawableIdSchema.parse("draw_viewer_screen_face");
const MESH_FACE = MeshIdSchema.parse("mesh_viewer_screen_face");
const TEX_FACE = TextureIdSchema.parse("tex_viewer_screen_face");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_viewer_screen_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_viewer_screen_fixture");
const FACE_ANGLE_X = ParameterIdSchema.parse("param_face_angle_x");
const HAIR_SWAY_X = ParameterIdSchema.parse("param_viewer_hair_sway_x");
const DYNAMICS_GROUP = DynamicsGroupIdSchema.parse("dyn_viewer_hair_sway_x");
const RIG_FACE_WARP = RigControlIdSchema.parse("rig_viewer_screen_face_warp");

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
    expect(markup).not.toContain("Export");
    expect(markup).not.toContain("Compare");
    expect(markup).not.toContain("Favorite");
    expect(markup).not.toContain("Group");
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
    expect(viewerRuntimeTestState.uiStore.setActiveEntry).toHaveBeenCalledWith("import");
    expect(viewerRuntimeTestState.editorSession.setActiveParameterValue).not.toHaveBeenCalled();
    expect(viewerRuntimeTestState.editorSession.resetActiveParameterValue).not.toHaveBeenCalled();
    expect(viewerRuntimeTestState.editorSession.selectDrawable).not.toHaveBeenCalled();
  });

  it("wires the right-side AppBar Viewer icon to the viewer active entry", () => {
    viewerRuntimeTestState.uiStore.activeEntry = "import";

    renderToStaticMarkup(createElement(AppBar));

    const viewerButton = findIconButton("Viewer");
    viewerButton.onClick?.({} as ReactMouseEvent<HTMLButtonElement>);

    expect(viewerRuntimeTestState.uiStore.setActiveEntry).toHaveBeenCalledTimes(1);
    expect(viewerRuntimeTestState.uiStore.setActiveEntry).toHaveBeenCalledWith("viewer");
    expect(viewerRuntimeTestState.editorSession.openPsdImport).not.toHaveBeenCalled();
  });

  it("marks the right-side AppBar Viewer icon pressed when Viewer is active", () => {
    viewerRuntimeTestState.uiStore.activeEntry = "viewer";

    renderToStaticMarkup(createElement(AppBar));

    expect(findIconButton("Viewer").pressed).toBe(true);
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
    expect(Math.abs(settledState?.angularVelocity ?? 0)).toBeLessThan(
      Math.abs(firstState?.angularVelocity ?? 0)
    );
    expect(Math.abs((settledState?.angle ?? 0) - 1)).toBeLessThan(
      Math.abs((firstState?.angle ?? 0) - 1)
    );
  });

  it("injects Dynamics output offsets into the Viewer Clean Stage before keyform evaluation", () => {
    const session = createRuntimeScreenSessionWithDynamics();
    const model = createViewerRuntimePlaybackModel(session);
    const runtimeState = {
      ...createViewerRuntimeInitialState(model, {
        [FACE_ANGLE_X]: 0
      }),
      dynamicsGroups: {
        [DYNAMICS_GROUP]: {
          angle: 0.5,
          angularVelocity: 0,
          previousSource: 0,
          previousSourceVelocity: 0,
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
    expect(projection.baseParameterValues[HAIR_SWAY_X]).toBeUndefined();
    expect(projection.parameterValues[HAIR_SWAY_X]).toBe(5);
    expect(requireDrawable(projection.projection, DRAW_FACE).bounds.x).toBe(2);
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

    expect(resetState.dynamicsGroups[DYNAMICS_GROUP]).toMatchObject({
      angle: 1,
      angularVelocity: 0,
      previousSource: 1,
      previousSourceVelocity: 0,
      tick: 0
    });
    expect(runtimeControlsState.parameterOverrides[FACE_ANGLE_X]).toBe(30);
    expect(session.dirty).toBe(false);
  });

  it("discards stale Dynamics state when a new project reuses a Dynamics Group id", () => {
    const oldSession = createRuntimeScreenSessionWithDynamics();
    const oldModel = createViewerRuntimePlaybackModel(oldSession);
    const staleState = {
      ...createViewerRuntimeInitialState(oldModel, {
        [FACE_ANGLE_X]: 0
      }),
      dynamicsGroups: {
        [DYNAMICS_GROUP]: {
          angle: 0.75,
          angularVelocity: 3,
          previousSource: 0.5,
          previousSourceVelocity: 2,
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

    expect(evaluated.nextState.dynamicsGroups[DYNAMICS_GROUP]).toMatchObject({
      angle: 0,
      angularVelocity: 0,
      previousSource: 0,
      previousSourceVelocity: 0,
      tick: 0
    });
    expect(evaluated.nextState.dynamicsGroups[DYNAMICS_GROUP]).not.toMatchObject({
      angle: 0.75,
      angularVelocity: 3,
      previousSource: 0.5,
      previousSourceVelocity: 2
    });
    expect(projection.parameterValues[HAIR_SWAY_X]).toBe(0);
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

    expect(viewerRuntimeTestState.uiStore.setActiveEntry).toHaveBeenCalledWith("import");
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
        length: 1,
        sway: 0.05,
        reactionSpeed: 8,
        convergenceSpeed: 10
      }
    ],
    outputs: [
      {
        parameterId: HAIR_SWAY_X,
        kind: "angle",
        strength: 10,
        invert: false,
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
