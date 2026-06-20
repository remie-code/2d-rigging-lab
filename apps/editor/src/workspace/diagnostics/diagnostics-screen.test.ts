import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  ButtonHTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode
} from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DiagnosticsScreen } from "./diagnostics-screen";
import { createEmptyAuthoringSession } from "../../features/editor-session/model/empty-authoring-session";
import { TooltipProvider } from "../../ui/tooltip";
import { AuthoringWorkspaceContent } from "../authoring-workspace";

const diagnosticsScreenTestState = vi.hoisted(() => ({
  editorSession: undefined as unknown,
  iconButtons: [] as Array<{
    readonly disabled: boolean;
    readonly label: string;
    readonly onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
    readonly pressed?: boolean;
  }>,
  uiStore: {
    activeEntry: "validate",
    activeTool: "select",
    setActiveEntry: vi.fn(),
    setActiveTool: vi.fn(),
    surfaceLabel: "Diagnostics test surface"
  }
}));

vi.mock("../../features/editor-session/editor-session-context", async () => {
  const actual = await vi.importActual<
    typeof import("../../features/editor-session/editor-session-context")
  >("../../features/editor-session/editor-session-context");

  return {
    ...actual,
    useEditorSession: () => diagnosticsScreenTestState.editorSession
  };
});

vi.mock("../../state/editor-ui-store", async () => {
  const actual = await vi.importActual<typeof import("../../state/editor-ui-store")>(
    "../../state/editor-ui-store"
  );

  return {
    ...actual,
    useEditorUiStore: (
      selector: (state: {
        readonly activeEntry: string;
        readonly activeTool: string;
        readonly setActiveEntry: (entry: string) => void;
        readonly setActiveTool: (tool: string) => void;
        readonly surfaceLabel: string;
      }) => unknown
    ) => selector(diagnosticsScreenTestState.uiStore)
  };
});

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
    diagnosticsScreenTestState.iconButtons.push({
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

const PART_ROOT = PartIdSchema.parse("part_diagnostics_root");
const DRAWABLE_ID = DrawableIdSchema.parse("draw_diagnostics_missing_mesh");
const MESH_ID = MeshIdSchema.parse("mesh_diagnostics_missing");
const TEXTURE_ID = TextureIdSchema.parse("tex_diagnostics");
const SOURCE_ASSET_ID = SourceAssetIdSchema.parse("src_diagnostics");
const PROVENANCE_ID = ProvenanceIdSchema.parse("prov_diagnostics");
const RIG_CONTROL_ID = RigControlIdSchema.parse("rig_diagnostics_parent");
const PARAMETER_DRIVER_ID = ParameterIdSchema.parse("param_diagnostics_driver");
const PARAMETER_OUTPUT_ID = ParameterIdSchema.parse("param_diagnostics_output");
const DYNAMICS_GROUP_ID = DynamicsGroupIdSchema.parse("dyn_diagnostics_group");
const DYNAMICS_GROUP_SECOND_ID = DynamicsGroupIdSchema.parse("dyn_diagnostics_group_second");
const KEYFORM_SET_ID = KeyformSetIdSchema.parse("keyset_diagnostics_output_opacity");

describe("DiagnosticsScreen", () => {
  beforeEach(() => {
    diagnosticsScreenTestState.editorSession = createEditorSessionMock(
      createEmptyAuthoringSession()
    );
    diagnosticsScreenTestState.uiStore.setActiveEntry.mockClear();
    diagnosticsScreenTestState.uiStore.setActiveTool.mockClear();
    diagnosticsScreenTestState.iconButtons.length = 0;
  });

  it("renders an empty read-only state when there are no deterministic warnings", () => {
    const markup = renderToStaticMarkup(createElement(DiagnosticsScreen));

    expect(markup).toContain('data-testid="diagnostics-screen"');
    expect(markup).toContain("No deterministic warnings");
    expect(markup).toContain("0 warnings");
    expect(markup).not.toContain('data-testid="diagnostics-jump-action"');
    expect(markup).not.toMatch(/auto[- ]?fix/i);
    expect(markup).not.toMatch(/repair/i);
    expect(markup).not.toContain("<input");
  });

  it("lists deterministic warning rows with category, target, message, details, and jump buttons", () => {
    diagnosticsScreenTestState.editorSession = createEditorSessionMock(
      createDiagnosticsWarningSession()
    );

    const markup = renderToStaticMarkup(createElement(DiagnosticsScreen));

    expect(markup).toContain('data-testid="diagnostics-category"');
    expect(markup).toContain("Mesh");
    expect(markup).toContain("Dynamics");
    expect(markup).toContain("Drawable mesh is missing");
    expect(markup).toContain("Dynamics output keyform is missing");
    expect(markup).toContain("draw_diagnostics_missing_mesh");
    expect(markup).toContain("dyn_diagnostics_group");
    expect(markup).toContain('data-testid="diagnostics-details"');
    expect(markup).toContain('data-testid="diagnostics-jump-action"');
    expect(markup).not.toMatch(/auto[- ]?fix/i);
    expect(markup).not.toMatch(/repair/i);
    expect(markup).not.toContain("<input");
  });

  it("renders one jump button per duplicate Dynamics output owner", () => {
    diagnosticsScreenTestState.editorSession = createEditorSessionMock(
      createDuplicateDynamicsOutputSession()
    );

    const markup = renderToStaticMarkup(createElement(DiagnosticsScreen));

    expect(markup).toContain("Dynamics output is owned by multiple groups");
    expect(markup).toContain("Open Dynamics Group: Diagnostics Dynamics A");
    expect(markup).toContain("Open Dynamics Group: Diagnostics Dynamics B");
    expect(countOccurrences(markup, 'data-testid="diagnostics-row"')).toBe(1);
    expect(countOccurrences(markup, 'data-testid="diagnostics-jump-action"')).toBe(2);
  });

  it("opens the dedicated Diagnostics screen from the validate workspace entry without Parameter Bar", () => {
    const markup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(AuthoringWorkspaceContent, { activeEntry: "validate" })
      )
    );

    expect(markup).toContain('data-testid="diagnostics-screen"');
    expect(markup).toContain("Validation / Diagnostics");
    expect(markup).not.toContain('data-testid="canvas-preview-panel"');
    expect(markup).not.toContain('data-testid="viewer-runtime-screen"');
    expect(markup).not.toContain("Parameter Bar");
  });

  it("returns to Authoring Workspace through the Back action without opening PSD import", () => {
    const editorSession = createEditorSessionMock(createEmptyAuthoringSession());
    diagnosticsScreenTestState.editorSession = editorSession;

    const markup = renderToStaticMarkup(createElement(DiagnosticsScreen));
    findIconButton("Back to Authoring Workspace").onClick?.(
      {} as ReactMouseEvent<HTMLButtonElement>
    );

    expect(markup).toContain('aria-label="Back to Authoring Workspace"');
    expect(markup.indexOf('aria-label="Back to Authoring Workspace"')).toBeLessThan(
      markup.indexOf("Validation / Diagnostics")
    );
    expect(diagnosticsScreenTestState.uiStore.setActiveEntry).toHaveBeenCalledTimes(1);
    expect(diagnosticsScreenTestState.uiStore.setActiveEntry).toHaveBeenCalledWith("workspace");
    expect(diagnosticsScreenTestState.uiStore.setActiveTool).not.toHaveBeenCalled();
    expect(editorSession.openPsdImport).not.toHaveBeenCalled();
  });
});

function createEditorSessionMock(session: AuthoringSession) {
  return {
    canRedo: false,
    canUndo: false,
    closePsdImport: vi.fn(),
    commitPsdImport: vi.fn(),
    createWorkspace: vi.fn(),
    exportPortableProject: vi.fn(),
    hasOpenWorkspace: true,
    openProjectFile: vi.fn(),
    openPsdImport: vi.fn(),
    openWorkspace: vi.fn(),
    projectIdentityLabel: "Diagnostics Fixture",
    projectSaveStatusLabel: "Saved",
    projectStorage: {
      status: "idle"
    },
    psdImportOpen: false,
    redo: vi.fn(),
    resolvePsdImportDestination: vi.fn(() => ({
      label: "Diagnostics Root",
      parentPartId: PART_ROOT
    })),
    saveWorkspaceAs: vi.fn(),
    saveProject: vi.fn(),
    selectDeformerTreeTarget: vi.fn(),
    selectDrawable: vi.fn(),
    session,
    setActiveParameterId: vi.fn(),
    setDynamicsToolPreviewGroupId: vi.fn(),
    undo: vi.fn(),
    workspaceIdentityLabel: "Diagnostics Fixture",
    workspaceSaveStatusLabel: "Saved",
    workspaceStorage: {
      status: "saved",
      message: "Workspace ready."
    }
  };
}

function createDiagnosticsWarningSession(): AuthoringSession {
  const session = createEmptyAuthoringSession();
  session.graph.parts[0] = {
    partId: PART_ROOT,
    displayName: "Diagnostics Root",
    childPartIds: [],
    drawableIds: [DRAWABLE_ID],
    children: [{ kind: "drawable", drawableId: DRAWABLE_ID }]
  };
  session.graph.stableOrder = [PART_ROOT, DRAWABLE_ID];
  session.graph.drawables.push({
    drawableId: DRAWABLE_ID,
    displayName: "Missing Mesh Drawable",
    partId: PART_ROOT,
    sourceAssetId: SOURCE_ASSET_ID,
    textureId: TEXTURE_ID,
    meshId: MESH_ID,
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: 0,
    sourceProvenanceId: PROVENANCE_ID
  });
  session.graph.drawOrder.push({
    drawableId: DRAWABLE_ID,
    baseDrawOrder: 0,
    stableOrder: 0
  });
  session.graph.rigControls.push({
    kind: "rotation2d",
    rigControlId: RIG_CONTROL_ID,
    displayName: "Diagnostics Parent",
    partId: PART_ROOT,
    childDrawableIds: [DRAWABLE_ID],
    childRigControlIds: [],
    opacityMultiplier: 1,
    pivot: { x: 0, y: 0 },
    restAngleDegrees: 0,
    restTranslation: { x: 0, y: 0 },
    restScale: { x: 1, y: 1 },
    enabled: true
  });
  session.graph.rigControlRootIds = [RIG_CONTROL_ID];
  session.graph.parameters.push(
    {
      parameterId: PARAMETER_DRIVER_ID,
      displayName: "Diagnostics Driver",
      valueSource: "authoredInput",
      min: -30,
      default: 0,
      max: 30,
      recommendedUiStep: 1
    },
    {
      parameterId: PARAMETER_OUTPUT_ID,
      displayName: "Diagnostics Output",
      valueSource: "authoredInput",
      min: -10,
      default: 0,
      max: 10,
      recommendedUiStep: 0.1
    }
  );
  session.graph.dynamicsGroups.push({
    dynamicsGroupId: DYNAMICS_GROUP_ID,
    displayName: "Diagnostics Dynamics",
    enabled: true,
    presetId: "hair",
    inputs: [
      {
        parameterId: PARAMETER_DRIVER_ID,
        kind: "angle",
        influencePercent: 100,
        invert: false,
        normalization: { min: -30, center: 0, max: 30 }
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
        parameterId: PARAMETER_OUTPUT_ID,
        kind: "angle",
        strength: 10,
        invert: false,
        limit: 15
      }
    ]
  });

  return session;
}

function createDuplicateDynamicsOutputSession(): AuthoringSession {
  const session = createEmptyAuthoringSession();
  session.graph.parts[0] = {
    partId: PART_ROOT,
    displayName: "Diagnostics Root",
    childPartIds: [],
    drawableIds: [DRAWABLE_ID],
    children: [{ kind: "drawable", drawableId: DRAWABLE_ID }]
  };
  session.graph.stableOrder = [PART_ROOT, DRAWABLE_ID];
  session.graph.drawables.push({
    drawableId: DRAWABLE_ID,
    displayName: "Keyed Drawable",
    partId: PART_ROOT,
    sourceAssetId: SOURCE_ASSET_ID,
    textureId: TEXTURE_ID,
    meshId: MESH_ID,
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: 0,
    sourceProvenanceId: PROVENANCE_ID
  });
  session.graph.meshes.push({
    meshId: MESH_ID,
    drawableId: DRAWABLE_ID,
    vertices: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 }
    ],
    uvs: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ],
    triangles: [[0, 1, 2]],
    vertexStableIds: ["vtx_a", "vtx_b", "vtx_c"],
    bounds: { x: 0, y: 0, width: 10, height: 10 },
    generationProvenanceId: PROVENANCE_ID
  });
  session.graph.drawOrder.push({
    drawableId: DRAWABLE_ID,
    baseDrawOrder: 0,
    stableOrder: 0
  });
  session.graph.parameters.push(
    {
      parameterId: PARAMETER_DRIVER_ID,
      displayName: "Diagnostics Driver",
      valueSource: "authoredInput",
      min: -30,
      default: 0,
      max: 30,
      recommendedUiStep: 1
    },
    {
      parameterId: PARAMETER_OUTPUT_ID,
      displayName: "Diagnostics Output",
      valueSource: "authoredInput",
      min: -10,
      default: 0,
      max: 10,
      recommendedUiStep: 0.1
    }
  );
  session.graph.keyformSets.push({
    keyformSetId: KEYFORM_SET_ID,
    target: {
      kind: "drawable",
      id: DRAWABLE_ID,
      property: "opacity"
    },
    parameterId: PARAMETER_OUTPUT_ID,
    evaluator: "linear-1d-v1",
    interpolation: "linear-1d-v1",
    compositionMode: "replace",
    compositionOrder: 0,
    keys: [
      {
        value: 0,
        statePatch: 1
      }
    ]
  });
  session.graph.dynamicsGroups.push(
    createDiagnosticsDynamicsGroup(DYNAMICS_GROUP_ID, "Diagnostics Dynamics A"),
    createDiagnosticsDynamicsGroup(DYNAMICS_GROUP_SECOND_ID, "Diagnostics Dynamics B")
  );

  return session;
}

function createDiagnosticsDynamicsGroup(
  dynamicsGroupId: typeof DYNAMICS_GROUP_ID,
  displayName: string
) {
  return {
    dynamicsGroupId,
    displayName,
    enabled: true,
    presetId: "hair",
    inputs: [
      {
        parameterId: PARAMETER_DRIVER_ID,
        kind: "angle" as const,
        influencePercent: 100,
        invert: false,
        normalization: { min: -30, center: 0, max: 30 }
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
        parameterId: PARAMETER_OUTPUT_ID,
        kind: "angle" as const,
        strength: 10,
        invert: false,
        limit: 15
      }
    ]
  };
}

function countOccurrences(value: string, pattern: string): number {
  return value.split(pattern).length - 1;
}

function findIconButton(label: string) {
  const button = diagnosticsScreenTestState.iconButtons.find((candidate) => candidate.label === label);
  if (button === undefined) {
    throw new Error(`Expected IconButton ${label}.`);
  }

  return button;
}
