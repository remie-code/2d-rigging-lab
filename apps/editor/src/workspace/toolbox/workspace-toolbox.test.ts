import { DynamicsGroupIdSchema, ParameterIdSchema } from "@private-2d-rigging-lab/contracts";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEmptyAuthoringSession } from "../../features/editor-session/model/empty-authoring-session";
import { WorkspaceToolbox } from "./workspace-toolbox";

const toolboxTestState = vi.hoisted(() => ({
  editorSession: {
    openPsdImport: vi.fn(),
    psdImportOpen: false,
    session: undefined as unknown
  },
  uiStore: {
    activeEntry: "workspace",
    activeTool: "select",
    setActiveEntry: vi.fn(),
    setActiveTool: vi.fn()
  },
  iconButtons: [] as Array<{
    readonly label: string;
    readonly onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
    readonly pressed?: boolean;
  }>
}));

vi.mock("../../features/editor-session/editor-session-context", () => ({
  useEditorSession: () => toolboxTestState.editorSession
}));

vi.mock("../../state/editor-ui-store", () => ({
  useEditorUiStore: (
    selector: (state: typeof toolboxTestState.uiStore) => unknown
  ) => selector(toolboxTestState.uiStore)
}));

vi.mock("../../ui/icon-button", () => ({
  IconButton: ({
    children,
    label,
    onClick,
    pressed
  }: {
    readonly children: ReactNode;
    readonly label: string;
    readonly onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
    readonly pressed?: boolean;
  }) => {
    toolboxTestState.iconButtons.push({
      label,
      ...(onClick === undefined ? {} : { onClick }),
      ...(pressed === undefined ? {} : { pressed })
    });

    return createElement(
      "button",
      {
        "aria-label": label,
        "aria-pressed": pressed,
        type: "button"
      },
      children
    );
  }
}));

describe("WorkspaceToolbox diagnostics badge", () => {
  beforeEach(() => {
    toolboxTestState.editorSession.openPsdImport.mockClear();
    toolboxTestState.editorSession.psdImportOpen = false;
    toolboxTestState.editorSession.session = createEmptyAuthoringSession();
    toolboxTestState.iconButtons.splice(0, toolboxTestState.iconButtons.length);
    toolboxTestState.uiStore.activeEntry = "workspace";
    toolboxTestState.uiStore.activeTool = "select";
    toolboxTestState.uiStore.setActiveEntry.mockClear();
    toolboxTestState.uiStore.setActiveTool.mockClear();
  });

  it("renders no Validate warning badge when diagnostics are empty", () => {
    const markup = renderToStaticMarkup(createElement(WorkspaceToolbox));

    expect(markup).not.toContain('data-testid="diagnostics-warning-badge"');
  });

  it("renders the Validate warning badge when diagnostics have warnings", () => {
    toolboxTestState.editorSession.session = createToolboxWarningSession();

    const markup = renderToStaticMarkup(createElement(WorkspaceToolbox));

    expect(markup).toContain('data-testid="diagnostics-warning-badge"');
    expect(markup).toContain('aria-label="2 validation warnings"');
    expect(markup).toContain(">2</span>");
  });

  it("keeps Import PSD as an action and removes Project Storage from the Toolbox", () => {
    const markup = renderToStaticMarkup(createElement(WorkspaceToolbox));

    expect(markup).toContain('aria-label="Import PSD"');
    expect(markup).toContain('aria-label="Runtime Export"');
    expect(markup).not.toContain("Project Storage");

    findIconButton("Import PSD").onClick?.({} as never);

    expect(toolboxTestState.editorSession.openPsdImport).toHaveBeenCalledTimes(1);
    expect(toolboxTestState.uiStore.setActiveEntry).not.toHaveBeenCalled();
  });

  it("opens the Runtime Export task from the Toolbox", () => {
    renderToStaticMarkup(createElement(WorkspaceToolbox));

    findIconButton("Runtime Export").onClick?.({} as never);

    expect(toolboxTestState.uiStore.setActiveEntry).toHaveBeenCalledTimes(1);
    expect(toolboxTestState.uiStore.setActiveEntry).toHaveBeenCalledWith("runtimeExport");
    expect(toolboxTestState.editorSession.openPsdImport).not.toHaveBeenCalled();
  });

  it("opens the Variants task from the Toolbox", () => {
    renderToStaticMarkup(createElement(WorkspaceToolbox));

    findIconButton("Variants").onClick?.({} as never);

    expect(toolboxTestState.uiStore.setActiveEntry).toHaveBeenCalledTimes(1);
    expect(toolboxTestState.uiStore.setActiveEntry).toHaveBeenCalledWith("variants");
    expect(toolboxTestState.editorSession.openPsdImport).not.toHaveBeenCalled();
  });
});

function findIconButton(label: string) {
  const button = toolboxTestState.iconButtons.find((candidate) => candidate.label === label);
  if (button === undefined) {
    throw new Error(`IconButton "${label}" was not rendered.`);
  }

  return button;
}

function createToolboxWarningSession() {
  const session = createEmptyAuthoringSession();
  const missingDriverId = ParameterIdSchema.parse("param_toolbox_badge_missing_driver");
  const missingOutputId = ParameterIdSchema.parse("param_toolbox_badge_missing_output");
  session.graph.dynamicsGroups.push({
    dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_toolbox_badge"),
    displayName: "Toolbox Badge Dynamics",
    enabled: true,
    presetId: "hair",
    inputs: [
      {
        parameterId: missingDriverId,
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
        parameterId: missingOutputId,
        kind: "angle",
        strength: 10,
        invert: false,
        limit: 15
      }
    ]
  });

  return session;
}
