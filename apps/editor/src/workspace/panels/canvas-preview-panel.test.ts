import { describe, expect, it } from "vitest";

import { isCanvasAuthoringSelectionEnabled } from "./canvas-preview-panel";

describe("CanvasPreviewPanel tool gating", () => {
  it("disables authoring selection in Dynamics mode while preserving other tools", () => {
    expect(isCanvasAuthoringSelectionEnabled("select")).toBe(true);
    expect(isCanvasAuthoringSelectionEnabled("mesh")).toBe(true);
    expect(isCanvasAuthoringSelectionEnabled("rig")).toBe(true);
    expect(isCanvasAuthoringSelectionEnabled("dynamics")).toBe(false);
  });
});
