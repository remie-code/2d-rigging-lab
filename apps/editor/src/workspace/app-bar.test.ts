import type {
  ButtonHTMLAttributes,
  ChangeEvent as ReactChangeEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode
} from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    saveProject: vi.fn()
  },
  iconButtons: [] as Array<{
    readonly disabled: boolean;
    readonly label: string;
    readonly onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  }>,
  setActiveEntry: vi.fn()
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
      surfaceLabel: "Mock Surface",
      activeEntry: "canvas",
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
    appBarTestState.editorSession.canUndo = false;
    appBarTestState.editorSession.canRedo = false;
    appBarTestState.editorSession.projectIdentityLabel = "Loaded model · rev 7";
    appBarTestState.editorSession.projectSaveStatusLabel = "Saved";
    appBarTestState.editorSession.projectStorage.status = "idle";
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
