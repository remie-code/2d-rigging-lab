import type {
  ButtonHTMLAttributes,
  ChangeEvent as ReactChangeEvent,
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
    openProjectFile: vi.fn(),
    openPsdImport: vi.fn(),
    projectIdentityLabel: "Loaded model · rev 7",
    projectSaveStatusLabel: "Saved",
    projectStorage: {
      status: "idle"
    },
    undo: vi.fn(),
    redo: vi.fn(),
    saveProject: vi.fn(),
    session: undefined as unknown
  },
  iconButtons: [] as Array<{
    readonly disabled: boolean;
    readonly label: string;
    readonly onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  }>,
  activeEntry: "import",
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

import { AppBar, createOpenProjectFileChangeHandler } from "./app-bar";

describe("AppBar history controls", () => {
  beforeEach(() => {
    appBarTestState.activeEntry = "import";
    appBarTestState.editorSession.canUndo = false;
    appBarTestState.editorSession.canRedo = false;
    appBarTestState.editorSession.projectIdentityLabel = "Loaded model · rev 7";
    appBarTestState.editorSession.projectSaveStatusLabel = "Saved";
    appBarTestState.editorSession.projectStorage.status = "idle";
    appBarTestState.editorSession.session = createEmptyAuthoringSession();
    appBarTestState.editorSession.openProjectFile.mockClear();
    appBarTestState.editorSession.openPsdImport.mockClear();
    appBarTestState.editorSession.undo.mockClear();
    appBarTestState.editorSession.redo.mockClear();
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

  it("renders project identity/save status from session storage state", () => {
    const markup = renderToStaticMarkup(createElement(AppBar));

    expect(markup).toContain("Loaded model · rev 7");
    expect(markup).toContain("Saved");
    expect(markup).not.toContain("Untitled model");
  });

  it("wires Save Project to the portable project save action", () => {
    renderToStaticMarkup(createElement(AppBar));

    const saveButton = findIconButton("Save project");
    expect(saveButton.disabled).toBe(false);

    saveButton.onClick?.({} as ReactMouseEvent<HTMLButtonElement>);

    expect(appBarTestState.editorSession.saveProject).toHaveBeenCalledTimes(1);
  });

  it("renders Open Project file input and disables storage buttons while busy", () => {
    appBarTestState.editorSession.projectStorage.status = "loading";

    const markup = renderToStaticMarkup(createElement(AppBar));

    expect(markup).toContain("Open portable project bundle file");
    expect(findIconButton("Open project").disabled).toBe(true);
    expect(findIconButton("Save project").disabled).toBe(true);
  });

  it("passes the selected portable project File from the hidden input to openProjectFile", () => {
    const file = new File(["{}"], "loaded.portable-project.json", {
      type: "application/json"
    });
    const input = {
      files: [file],
      value: "C:\\fakepath\\loaded.portable-project.json"
    };
    const handler = createOpenProjectFileChangeHandler(
      appBarTestState.editorSession.openProjectFile
    );

    handler({
      currentTarget: input
    } as unknown as ReactChangeEvent<HTMLInputElement>);

    expect(appBarTestState.editorSession.openProjectFile).toHaveBeenCalledTimes(1);
    expect(appBarTestState.editorSession.openProjectFile).toHaveBeenCalledWith(file);
    expect(input.value).toBe("");
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
