import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createBrowserSourceStageShellHtml } from "./browser-source-stage-shell";

describe("createBrowserSourceStageShellHtml", () => {
  it("keeps the Browser Source shell transparent and attaches client assets after config", () => {
    const html = createBrowserSourceStageShellHtml({
      webSocketPath: "/ws?token=test",
      runtimeExportStatusPath: "/runtime-export/status?token=test",
      runtimeExportPayloadPath: "/runtime-export/payload?token=test",
      clientDiagnosticsPath: "/browser-source/client-diagnostics?token=test",
      clientAssets: {
        modulePreloadHrefs: [
          "/browser-source-assets/global.js?token=test"
        ],
        stylesheetHrefs: [
          "/browser-source-assets/global.css?token=test"
        ],
        reactRefreshPreambleSrc: null,
        scriptSrcs: [
          "/browser-source-assets/browser-source-stage.js?token=test"
        ]
      }
    });

    expect(html).toContain(
      '<html lang="en" class="browser-source-stage-document">'
    );
    expect(html).toContain('<body class="browser-source-stage-body">');
    expect(html).toContain("runtime-player-browser-source-root");
    expect(html).toContain("html.browser-source-stage-document");
    expect(html).toContain("body.browser-source-stage-body");
    expect(html).toContain("background: transparent");
    expect(html).toContain("window.__RUNTIME_PLAYER_BROWSER_SOURCE__");
    expect(html).toContain("html-inline-boot");
    expect(html).toContain("window.onerror");
    expect(html).toContain("unhandledrejection");
    expect(html).toContain("module-script-tag-injected");
    expect(html).toContain('rel="modulepreload"');
    expect(html).toContain('rel="stylesheet"');
    expect(html).toContain('type="module"');
    expect(html.indexOf("window.__RUNTIME_PLAYER_BROWSER_SOURCE__"))
      .toBeLessThan(html.indexOf("browser-source-stage.js"));
    expect(html.indexOf("html-inline-boot"))
      .toBeLessThan(html.indexOf("browser-source-stage.js"));
    expect(html.indexOf("module-script-tag-injected"))
      .toBeLessThan(html.indexOf("browser-source-stage.js"));
    expect(html).not.toContain("__vite_plugin_react_preamble_installed__");
    expect(html).not.toContain("<button");
  });

  it("keeps Browser Source transparent after class-scoped global CSS is loaded", () => {
    const css = readFileSync(
      new URL("../../styles/global.css", import.meta.url),
      "utf8"
    );

    expect(css).toContain("html.browser-source-stage-document");
    expect(css).toContain(
      "html.browser-source-stage-document body.browser-source-stage-body"
    );
    expect(css).toContain("background-color: transparent");
    expect(css).not.toContain(
      "body {\n  background: transparent"
    );
  });

  it("injects the dev React Refresh preamble before module client scripts", () => {
    const html = createBrowserSourceStageShellHtml({
      webSocketPath: "/ws?token=test",
      runtimeExportStatusPath: "/runtime-export/status?token=test",
      runtimeExportPayloadPath: "/runtime-export/payload?token=test",
      clientDiagnosticsPath: "/browser-source/client-diagnostics?token=test",
      clientAssets: {
        modulePreloadHrefs: [],
        stylesheetHrefs: [],
        reactRefreshPreambleSrc: "/browser-source-dev-assets/@react-refresh",
        scriptSrcs: [
          "/browser-source-dev-assets/stage/browser-source/browser-source-stage-entry.tsx"
        ]
      }
    });

    expect(html).toContain(
      'import RefreshRuntime from "/browser-source-dev-assets/@react-refresh";'
    );
    expect(html).toContain(
      "window.__vite_plugin_react_preamble_installed__ = true;"
    );
    expect(html).not.toContain("http://127.0.0.1:5173");
    expect(html.indexOf("__vite_plugin_react_preamble_installed__"))
      .toBeLessThan(html.indexOf("browser-source-stage-entry.tsx"));
  });
});
