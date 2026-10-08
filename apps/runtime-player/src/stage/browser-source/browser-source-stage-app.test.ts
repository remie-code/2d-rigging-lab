import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BrowserSourceStageSurface } from "./browser-source-stage-app";

describe("BrowserSourceStageSurface", () => {
  it("renders a model-only transparent Stage surface", () => {
    const markup = renderToStaticMarkup(
      createElement(BrowserSourceStageSurface, {
        renderStatus: "idle"
      })
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("browser-source-stage-shell");
    expect(markup).toContain("browser-source-stage-canvas");
    expect(markup).toContain("<canvas");
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("diagnostic");
    expect(markup).not.toContain("setup");
  });
});
