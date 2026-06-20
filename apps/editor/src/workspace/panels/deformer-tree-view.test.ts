import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DrawableIdSchema, RigControlIdSchema } from "@private-2d-rigging-lab/contracts";

import { DeformerTreeView, createVisibleDeformerRows } from "./deformer-tree-view";
import type { DeformerTreeRow } from "../../features/editor-session/model/rig-tool-state";

const editorSessionMock = vi.hoisted(() => ({ current: undefined as unknown }));

const RIG_PARENT = RigControlIdSchema.parse("rig_parent");
const RIG_CHILD = RigControlIdSchema.parse("rig_child");
const RIG_SIBLING = RigControlIdSchema.parse("rig_sibling");
const DRAW_PARENT = DrawableIdSchema.parse("draw_parent");
const DRAW_CHILD = DrawableIdSchema.parse("draw_child");

vi.mock("../../features/editor-session/editor-session-context", () => ({
  useEditorSession: () => editorSessionMock.current
}));

describe("DeformerTreeView collapse state", () => {
  it("renders disclosure controls only for Deformers with visible children", () => {
    editorSessionMock.current = {
      bindDrawableToRigControl: vi.fn(),
      deformerRows: [
        createWarpRow({
          rigControlId: RIG_PARENT,
          displayName: "Parent Warp",
          depth: 0,
          childRigControlCount: 1
        }),
        createWarpRow({
          rigControlId: RIG_CHILD,
          parentRigControlId: RIG_PARENT,
          displayName: "Child Warp",
          depth: 1
        })
      ],
      drawablePoolItems: [],
      moveDrawableRigControlBinding: vi.fn(),
      reparentRigControl: vi.fn(),
      rigDraft: null,
      rigOperationFeedback: null,
      selectDeformerTreeTarget: vi.fn()
    };

    const markup = renderToStaticMarkup(createElement(DeformerTreeView));

    expect(markup.match(/data-testid="deformer-tree-deformer-toggle"/g)).toHaveLength(1);
    expect(markup).toContain('aria-label="Collapse Parent Warp"');
    expect(markup).not.toContain('aria-label="Collapse Child Warp"');
  });

  it("filters descendants under collapsed Deformers while leaving source rows intact", () => {
    const rows = [
      createWarpRow({
        rigControlId: RIG_PARENT,
        displayName: "Parent Warp",
        depth: 0,
        childRigControlCount: 1,
        childDrawableCount: 1
      }),
      createWarpRow({
        rigControlId: RIG_CHILD,
        parentRigControlId: RIG_PARENT,
        displayName: "Child Warp",
        depth: 1,
        childDrawableCount: 1,
        selected: true
      }),
      {
        kind: "drawableRef",
        drawableId: DRAW_CHILD,
        parentRigControlId: RIG_CHILD,
        depth: 2,
        displayName: "Child Drawable",
        detail: "Bound Drawable reference",
        selected: true
      },
      {
        kind: "drawableRef",
        drawableId: DRAW_PARENT,
        parentRigControlId: RIG_PARENT,
        depth: 1,
        displayName: "Parent Drawable",
        detail: "Bound Drawable reference",
        selected: false
      },
      createWarpRow({
        rigControlId: RIG_SIBLING,
        displayName: "Sibling Warp",
        depth: 0
      })
    ] satisfies readonly DeformerTreeRow[];

    const visibleRows = createVisibleDeformerRows(rows, new Set([RIG_PARENT]));

    expect(visibleRows.map((row) => row.displayName)).toEqual([
      "Parent Warp",
      "Sibling Warp"
    ]);
    expect(rows[1]?.selected).toBe(true);
    expect(rows[2]?.selected).toBe(true);
  });
});

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

function createWarpRow(input: {
  readonly rigControlId: typeof RIG_PARENT;
  readonly parentRigControlId?: typeof RIG_PARENT;
  readonly displayName: string;
  readonly depth: number;
  readonly selected?: boolean;
  readonly childDrawableCount?: number;
  readonly childRigControlCount?: number;
}): Extract<DeformerTreeRow, { readonly kind: "warpDeformer" }> {
  return {
    kind: "warpDeformer",
    rigControlId: input.rigControlId,
    depth: input.depth,
    displayName: input.displayName,
    detail: "Warp Deformer",
    selected: input.selected ?? false,
    ...(input.parentRigControlId === undefined
      ? {}
      : { parentRigControlId: input.parentRigControlId }),
    childDrawableCount: input.childDrawableCount ?? 0,
    childRigControlCount: input.childRigControlCount ?? 0,
    keyformSetCount: 0,
    keyformKeyCount: 0,
    transformLabel: "5 x 5 control points",
    bezierLabel: "3 x 3 control points",
    legacyDefaulted: false
  };
}
