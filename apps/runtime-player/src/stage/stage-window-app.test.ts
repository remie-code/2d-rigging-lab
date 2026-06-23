import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StageArrangeOverlay } from "./stage-window-app";

describe("StageArrangeOverlay", () => {
  it("renders nothing in normal Stage mode", () => {
    expect(
      renderToStaticMarkup(
        createElement(StageArrangeOverlay, { enabled: false })
      )
    ).toBe("");
  });

  it("renders only a drag handle while arrange mode is enabled", () => {
    const markup = renderToStaticMarkup(
      createElement(StageArrangeOverlay, { enabled: true })
    );

    expect(markup).toContain("stage-arrange-overlay");
    expect(markup).toContain("stage-arrange-handle");
    expect(markup).not.toContain("<button");
  });
});
