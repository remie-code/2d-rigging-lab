import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { StructureTreePanel } from "./structure-tree-panel";

const editorSessionMock = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("../../features/editor-session/editor-session-context", () => ({
  useEditorSession: () => editorSessionMock.current
}));

describe("StructureTreePanel diagnostics", () => {
  it("renders a compact warning icon for Parts Tree drawable warnings", () => {
    editorSessionMock.current = {
      moveStructureChild: vi.fn(),
      selectDrawable: vi.fn(),
      selectPart: vi.fn(),
      session: { graph: { parts: [], drawables: [] } },
      structureRows: [
        {
          id: "draw_warned",
          kind: "drawable",
          depth: 0,
          parentPartId: "part_root",
          name: "Warned Drawable",
          detail: "Drawable",
          tone: "amber",
          selected: false,
          hidden: false,
          effectiveHidden: false,
          canToggleVisibility: true,
          draggable: true,
          runtimeVisible: true,
          order: 0,
          warning: {
            count: 1,
            label: "This Drawable is used by a Deformer or keyform target, but its mesh is missing.",
            codes: ["mesh.drawableMeshMissing"]
          }
        }
      ],
      togglePartCollapse: vi.fn(),
      togglePartEditorVisibility: vi.fn(),
      setDrawableRuntimeVisibility: vi.fn()
    };

    const markup = renderToStaticMarkup(createElement(StructureTreePanel));

    expect(markup).toContain('data-testid="parts-tree-warning-icon"');
    expect(markup).toContain('data-warning-count="1"');
    expect(markup).toContain("This Drawable is used by a Deformer or keyform target");
  });
});
