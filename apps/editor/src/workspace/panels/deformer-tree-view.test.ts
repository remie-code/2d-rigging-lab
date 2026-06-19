import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DeformerTreeView } from "./deformer-tree-view";

const editorSessionMock = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("../../features/editor-session/editor-session-context", () => ({
  useEditorSession: () => editorSessionMock.current
}));

describe("DeformerTreeView diagnostics", () => {
  it("renders a compact warning icon for bound Drawable warnings", () => {
    editorSessionMock.current = {
      bindDrawableToRigControl: vi.fn(),
      deformerRows: [
        {
          kind: "warpDeformer",
          rigControlId: "rig_parent",
          depth: 0,
          displayName: "Parent Warp",
          detail: "Warp Deformer",
          selected: false,
          childDrawableCount: 1,
          childRigControlCount: 0,
          keyformSetCount: 0,
          keyformKeyCount: 0,
          transformLabel: "5 x 5 control points",
          bezierLabel: "3 x 3 control points",
          legacyDefaulted: false
        },
        {
          kind: "drawableRef",
          drawableId: "draw_warned",
          parentRigControlId: "rig_parent",
          depth: 1,
          displayName: "Warned Drawable",
          detail: "Bound Drawable reference",
          selected: false,
          warning: {
            count: 1,
            label: "This Drawable is used by a Deformer or keyform target, but its mesh is missing.",
            codes: ["mesh.drawableMeshMissing"]
          }
        }
      ],
      drawablePoolItems: [],
      moveDrawableRigControlBinding: vi.fn(),
      reparentRigControl: vi.fn(),
      rigDraft: null,
      rigOperationFeedback: null,
      selectDeformerTreeTarget: vi.fn()
    };

    const markup = renderToStaticMarkup(createElement(DeformerTreeView));

    expect(markup).toContain('data-testid="deformer-tree-warning-icon"');
    expect(markup).toContain('data-warning-count="1"');
    expect(markup).toContain("This Drawable is used by a Deformer or keyform target");
  });
});
