import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { InspectorPanel } from "./inspector-panel";
import { createEmptyAuthoringSession } from "../../features/editor-session/model/empty-authoring-session";
import {
  createDynamicsToolPreviewEvaluation,
  createInitialDynamicsToolPreviewState
} from "../../features/editor-session/model/dynamics-tool-state";

const editorSessionMock = vi.hoisted(() => ({ current: undefined as unknown }));
const editorUiStoreMock = vi.hoisted(() => ({
  current: {
    activeTool: "dynamics" as "select" | "mesh" | "rig" | "dynamics"
  }
}));

vi.mock("../../features/editor-session/editor-session-context", () => ({
  useEditorSession: () => editorSessionMock.current
}));

vi.mock("../../state/editor-ui-store", () => ({
  useEditorUiStore: (selector: (state: typeof editorUiStoreMock.current) => unknown) =>
    selector(editorUiStoreMock.current)
}));

describe("InspectorPanel Dynamics mode", () => {
  it("renders the Dynamics Tool Inspector for the dynamics active tool", () => {
    const session = createEmptyAuthoringSession();
    const preview = createInitialDynamicsToolPreviewState();
    editorUiStoreMock.current.activeTool = "dynamics";
    editorSessionMock.current = {
      createDynamicsGroup: vi.fn(),
      deleteDynamicsGroup: vi.fn(),
      dynamicsToolPreview: preview,
      dynamicsToolPreviewEvaluation: createDynamicsToolPreviewEvaluation(session, preview),
      inspector: {
        kind: "Project",
        title: "Project",
        rows: []
      },
      resetDynamicsToolPreviewSimulation: vi.fn(),
      session,
      setDynamicsToolPreviewDriverValue: vi.fn(),
      setDynamicsToolPreviewGroupId: vi.fn(),
      updateDynamicsGroup: vi.fn()
    };

    const markup = renderToStaticMarkup(createElement(InspectorPanel));

    expect(markup).toContain('data-testid="dynamics-tool-inspector"');
    expect(markup).toContain("Dynamics Tool");
  });
});
