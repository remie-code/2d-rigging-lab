import type {
  ButtonHTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode
} from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DynamicsGroupIdSchema, ParameterIdSchema } from "@private-2d-rigging-lab/contracts";

import { createEmptyAuthoringSession } from "../features/editor-session/model/empty-authoring-session";

const appBarTestState = vi.hoisted(() => ({
  editorSession: {
    canUndo: false,
    canRedo: false,
    createWorkspace: vi.fn(),
    hasOpenWorkspace: true,
    openWorkspace: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    saveWorkspaceAs: vi.fn(),
    saveProject: vi.fn(),
    session: undefined as unknown,
    workspaceIdentityLabel: "Loaded workspace · rev 7",
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
  }>,
  activeEntry: "workspace",
  setActiveEntry: vi.fn(),
  surfaceLabel: "Mock Surface"
}));

vi.mock("../features/editor-session/editor-session-context", () => ({
  useEditorSession: () => appBarTestState.editorSession
}));

vi.mock("../state/editor-ui-store", () => ({
  useEditorUiStore: (
    selector: (state: {
      readonly surfaceLabel: string;
      readonly activeEntry: string;
      readonly setActiveEntry: (entry: string) => void;
    }) => unknown
  ) =>
    selector({
      surfaceLabel: appBarTestState.surfaceLabel,
      activeEntry: appBarTestState.activeEntry,
      setActiveEntry: appBarTestState.setActiveEntry
    })
}));

vi.mock("../ui/icon-button", () => ({
  IconButton: ({
    children,
    disabled,
    label,
    onClick
  }: {
    readonly children: ReactNode;
    readonly disabled?: boolean;
    readonly label: string;
    readonly onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  }) => {
    appBarTestState.iconButtons.push({
      disabled: disabled === true,
      label,
      ...(onClick === undefined ? {} : { onClick })
    });

    return createElement(
      "button",
      {
        "aria-label": label,
        disabled
      },
      children
    );
  }
}));

import { AppBar } from "./app-bar";

describe("AppBar history controls", () => {
  beforeEach(() => {
    appBarTestState.activeEntry = "workspace";
    appBarTestState.editorSession.canUndo = false;
    appBarTestState.editorSession.canRedo = false;
    appBarTestState.editorSession.hasOpenWorkspace = true;
    appBarTestState.editorSession.workspaceIdentityLabel = "Loaded workspace · rev 7";
    appBarTestState.editorSession.workspaceSaveStatusLabel = "Saved";
    appBarTestState.editorSession.workspaceStorage.status = "saved";
    appBarTestState.editorSession.workspaceStorage.message = "Workspace ready.";
    appBarTestState.editorSession.session = createEmptyAuthoringSession();
    appBarTestState.editorSession.createWorkspace.mockClear();
    appBarTestState.editorSession.openWorkspace.mockClear();
    appBarTestState.editorSession.undo.mockClear();
    appBarTestState.editorSession.redo.mockClear();
    appBarTestState.editorSession.saveWorkspaceAs.mockClear();
    appBarTestState.editorSession.saveProject.mockClear();
    appBarTestState.iconButtons.splice(0, appBarTestState.iconButtons.length);
    appBarTestState.setActiveEntry.mockClear();
  });

  it("renders Undo and Redo icon buttons disabled before an edit commit", () => {
    const markup = renderToStaticMarkup(createElement(AppBar));

    expect(buttonMarkup(markup, "Undo")).toContain("disabled");
    expect(buttonMarkup(markup, "Redo")).toContain("disabled");
    expect(findIconButton("Undo").disabled).toBe(true);
    expect(findIconButton("Redo").disabled).toBe(true);
  });

  it("enables Undo and Redo from session state and wires clicks to history actions", () => {
    appBarTestState.editorSession.canUndo = true;
    appBarTestState.editorSession.canRedo = true;

    renderToStaticMarkup(createElement(AppBar));

    const undoButton = findIconButton("Undo");
    const redoButton = findIconButton("Redo");

    expect(undoButton.disabled).toBe(false);
    expect(redoButton.disabled).toBe(false);

    undoButton.onClick?.({} as ReactMouseEvent<HTMLButtonElement>);
    redoButton.onClick?.({} as ReactMouseEvent<HTMLButtonElement>);

    expect(appBarTestState.editorSession.undo).toHaveBeenCalledTimes(1);
    expect(appBarTestState.editorSession.redo).toHaveBeenCalledTimes(1);
  });

  it("renders workspace identity/save status from workspace state", () => {
    const markup = renderToStaticMarkup(createElement(AppBar));

    expect(markup).toContain("Loaded workspace · rev 7");
    expect(markup).toContain("Saved");
    expect(markup).not.toContain("Untitled model");
  });

  it("wires Save Workspace to the workspace save action", () => {
    renderToStaticMarkup(createElement(AppBar));

    const saveButton = findIconButton("Save Workspace");
    expect(saveButton.disabled).toBe(false);

    saveButton.onClick?.({} as ReactMouseEvent<HTMLButtonElement>);

    expect(appBarTestState.editorSession.saveProject).toHaveBeenCalledTimes(1);
  });

  it("disables Save Workspace while workspace storage is busy", () => {
    appBarTestState.editorSession.workspaceStorage.status = "saving";

    renderToStaticMarkup(createElement(AppBar));

    expect(findIconButton("Save Workspace").disabled).toBe(true);
  });

  it("starts in the Workspace Gate header when no workspace is open", () => {
    appBarTestState.editorSession.hasOpenWorkspace = false;
    appBarTestState.editorSession.workspaceStorage.status = "no-workspace";

    const markup = renderToStaticMarkup(createElement(AppBar));

    expect(markup).toContain("Create Workspace");
    expect(markup).toContain("Open Workspace");
    expect(markup).not.toContain("Save Workspace");
    expect(markup).not.toContain("Parameters");
    expect(markup).not.toContain("Texture Atlas");
    expect(markup).not.toContain("Viewer");
  });

  it("renders the Validate warning badge from diagnostics count outside Viewer", () => {
    appBarTestState.editorSession.session = createAppBarWarningSession();

    const markup = renderToStaticMarkup(createElement(AppBar));

    expect(markup).toContain('data-testid="diagnostics-warning-badge"');
    expect(markup).toContain('aria-label="2 validation warnings"');
    expect(markup).toContain(">2</span>");
  });

  it("hides the Validate warning badge when diagnostics are empty or Viewer is active", () => {
    const emptyMarkup = renderToStaticMarkup(createElement(AppBar));
    expect(emptyMarkup).not.toContain('data-testid="diagnostics-warning-badge"');

    appBarTestState.activeEntry = "viewer";
    appBarTestState.editorSession.session = createAppBarWarningSession();
    const viewerMarkup = renderToStaticMarkup(createElement(AppBar));

    expect(viewerMarkup).not.toContain('data-testid="diagnostics-warning-badge"');
  });
});

function buttonMarkup(markup: string, label: string): string {
  const match = markup.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`));
  if (match === null) {
    throw new Error(`Button with aria-label "${label}" was not rendered.`);
  }

  return match[0];
}

function findIconButton(label: string) {
  const button = appBarTestState.iconButtons.find((candidate) => candidate.label === label);
  if (button === undefined) {
    throw new Error(`IconButton "${label}" was not rendered.`);
  }

  return button;
}

function createAppBarWarningSession() {
  const session = createEmptyAuthoringSession();
  const missingDriverId = ParameterIdSchema.parse("param_app_bar_badge_missing_driver");
  const missingOutputId = ParameterIdSchema.parse("param_app_bar_badge_missing_output");
  session.graph.dynamicsGroups.push({
    dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_app_bar_badge"),
    displayName: "Badge Dynamics",
    enabled: true,
    presetId: "hair",
    inputs: [
      {
        parameterId: missingDriverId,
        kind: "angle",
        scale: 1}
    ],
    chain: {
      rootOffset: { x: 0, y: 0 },
      segmentLengths: [14],
      damping: 2.5,
      gravityScale: 1
    },
    outputs: [
      {
        parameterId: missingOutputId,
        segmentIndex: 1,
        scale: 1,
        limit: 15
      }
    ]
  });

  return session;
}
