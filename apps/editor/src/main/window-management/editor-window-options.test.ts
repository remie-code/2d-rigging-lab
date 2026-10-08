import { describe, expect, it } from "vitest";

import {
  createEditorWindowOptions,
  editorWindowDefaultBounds
} from "./editor-window-options";
import {
  getEditorRendererDevUrl,
  getEditorRendererHtmlFilePath
} from "./renderer-entry";

describe("Editor BrowserWindow options", () => {
  it("keeps the editor window isolated with the WS1 security posture", () => {
    const options = createEditorWindowOptions("preload-placeholder.mjs");

    expect(options.title).toBe("Private 2D Rigging Lab");
    expect(options.show).toBe(false);
    expect(options.width).toBe(editorWindowDefaultBounds.width);
    expect(options.height).toBe(editorWindowDefaultBounds.height);
    expect(options.webPreferences).toMatchObject({
      preload: "preload-placeholder.mjs",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    });
  });

  it("applies restored bounds while clamping to window minimums", () => {
    const options = createEditorWindowOptions("preload-placeholder.mjs", {
      x: 40,
      y: 60,
      width: 100,
      height: 100
    });

    expect(options).toMatchObject({
      x: 40,
      y: 60,
      width: editorWindowDefaultBounds.minWidth,
      height: editorWindowDefaultBounds.minHeight,
      minWidth: editorWindowDefaultBounds.minWidth,
      minHeight: editorWindowDefaultBounds.minHeight
    });
  });

  it("keeps restored bounds above minimums when large enough", () => {
    const options = createEditorWindowOptions("preload-placeholder.mjs", {
      x: 100,
      y: 120,
      width: 1600,
      height: 1000
    });

    expect(options).toMatchObject({
      x: 100,
      y: 120,
      width: 1600,
      height: 1000
    });
  });

  it("resolves the single renderer entry for dev and production", () => {
    expect(getEditorRendererDevUrl("http://127.0.0.1:5173/")).toBe(
      "http://127.0.0.1:5173/"
    );
    expect(getEditorRendererDevUrl(undefined)).toBeUndefined();
    expect(getEditorRendererHtmlFilePath()).toContain("renderer");
    expect(getEditorRendererHtmlFilePath()).toContain("index.html");
  });
});
