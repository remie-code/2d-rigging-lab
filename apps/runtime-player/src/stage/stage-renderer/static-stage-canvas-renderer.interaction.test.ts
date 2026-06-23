import { describe, expect, it } from "vitest";

import { shouldHandleStageViewInteraction } from "./static-stage-canvas-renderer";

describe("shouldHandleStageViewInteraction", () => {
  it("allows pan and zoom only when rendering is active and interactions are enabled", () => {
    expect(
      shouldHandleStageViewInteraction({
        disposed: false,
        viewInteractionEnabled: true,
        hasRenderInput: true
      })
    ).toBe(true);
  });

  it("blocks pan and zoom while arrange mode has disabled view interactions", () => {
    expect(
      shouldHandleStageViewInteraction({
        disposed: false,
        viewInteractionEnabled: false,
        hasRenderInput: true
      })
    ).toBe(false);
  });

  it("blocks pan and zoom without a rendered model or after disposal", () => {
    expect(
      shouldHandleStageViewInteraction({
        disposed: false,
        viewInteractionEnabled: true,
        hasRenderInput: false
      })
    ).toBe(false);
    expect(
      shouldHandleStageViewInteraction({
        disposed: true,
        viewInteractionEnabled: true,
        hasRenderInput: true
      })
    ).toBe(false);
  });
});
