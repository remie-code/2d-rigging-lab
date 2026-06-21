import { describe, expect, it } from "vitest";

import {
  controlWindowDefaultBounds,
  createControlWindowOptions,
  createStageWindowOptions,
  stageWindowDefaultBounds
} from "./browser-window-options";
import {
  getRendererDevUrl,
  getRendererHtmlFilePath
} from "./renderer-entry-url";

describe("Runtime Player BrowserWindow options", () => {
  it("keeps the Control Window as an isolated operation window", () => {
    const options = createControlWindowOptions("preload-placeholder.mjs");

    expect(options.title).toBe("Runtime Player");
    expect(options.show).toBe(false);
    expect(options.width).toBe(controlWindowDefaultBounds.width);
    expect(options.webPreferences).toMatchObject({
      preload: "preload-placeholder.mjs",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    });
  });

  it("keeps the Stage Window transparent and capture-oriented", () => {
    const options = createStageWindowOptions("preload-placeholder.mjs");

    expect(options.title).toBe("Runtime Player Stage");
    expect(options.show).toBe(false);
    expect(options.frame).toBe(false);
    expect(options.transparent).toBe(true);
    expect(options.hasShadow).toBe(false);
    expect(options.backgroundColor).toBe("#00000000");
    expect(options.width).toBe(stageWindowDefaultBounds.width);
    expect(options.webPreferences).toMatchObject({
      preload: "preload-placeholder.mjs",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    });
  });

  it("resolves separate renderer entries for Control and Stage", () => {
    expect(
      getRendererDevUrl("control", "http://127.0.0.1:5173/")
    ).toBe("http://127.0.0.1:5173/control/index.html");
    expect(getRendererHtmlFilePath("stage")).toContain("renderer");
    expect(getRendererHtmlFilePath("stage")).toContain("stage");
    expect(getRendererHtmlFilePath("stage")).toContain("index.html");
  });
});
