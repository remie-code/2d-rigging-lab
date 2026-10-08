import {
  runtimePlayerBrowserSourceProtocolVersion
} from "../../preload/browser-source-transport-contract";
import type {
  BrowserSourceStageClientAssets
} from "./browser-source-stage-client-assets";

export function createBrowserSourceStageShellHtml(input: {
  readonly webSocketPath: string;
  readonly runtimeExportStatusPath: string;
  readonly runtimeExportPayloadPath: string;
  readonly clientDiagnosticsPath: string;
  readonly clientAssets?: BrowserSourceStageClientAssets;
}): string {
  const config = toInlineJson({
    protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
    webSocketPath: input.webSocketPath,
    runtimeExportStatusPath: input.runtimeExportStatusPath,
    runtimeExportPayloadPath: input.runtimeExportPayloadPath,
    clientDiagnosticsPath: input.clientDiagnosticsPath
  });

  return [
    "<!doctype html>",
    '<html lang="en" class="browser-source-stage-document">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    "<title>Runtime Player Browser Source Stage</title>",
    ...createClientAssetHeadTags(input.clientAssets),
    "<style>",
    "html.browser-source-stage-document,",
    "html.browser-source-stage-document body.browser-source-stage-body,",
    "html.browser-source-stage-document body.browser-source-stage-body #runtime-player-browser-source-root {",
    "  width: 100%;",
    "  height: 100%;",
    "  margin: 0;",
    "  overflow: hidden;",
    "  background: transparent;",
    "}",
    "html.browser-source-stage-document body.browser-source-stage-body {",
    "  pointer-events: none;",
    "}",
    "</style>",
    "</head>",
    '<body class="browser-source-stage-body">',
    '<div id="runtime-player-browser-source-root" aria-hidden="true"></div>',
    "<script>",
    `window.__RUNTIME_PLAYER_BROWSER_SOURCE__ = ${config};`,
    ...createClientDiagnosticBootstrapScript(),
    "</script>",
    ...createReactRefreshPreambleTags(input.clientAssets),
    ...createClientAssetBodyTags(input.clientAssets),
    "</body>",
    "</html>"
  ].join("\n");
}

function createClientAssetHeadTags(
  assets: BrowserSourceStageClientAssets | undefined
): readonly string[] {
  if (assets === undefined) {
    return [];
  }

  return [
    ...assets.modulePreloadHrefs.map((href) =>
      `<link rel="modulepreload" crossorigin href="${escapeHtmlAttribute(href)}" />`
    ),
    ...assets.stylesheetHrefs.map((href) =>
      `<link rel="stylesheet" crossorigin href="${escapeHtmlAttribute(href)}" />`
    )
  ];
}

function createClientAssetBodyTags(
  assets: BrowserSourceStageClientAssets | undefined
): readonly string[] {
  if (assets === undefined || assets.scriptSrcs.length === 0) {
    return [];
  }

  return [
    "<script>",
    "(function () {",
    "  var report = window.__RUNTIME_PLAYER_BROWSER_SOURCE_REPORT_DIAGNOSTIC__;",
    "  if (typeof report === \"function\") {",
    "    report({ event: \"module-script-tag-injected\" });",
    "  }",
    "}());",
    "</script>",
    ...assets.scriptSrcs.map((src) =>
      `<script type="module" crossorigin src="${escapeHtmlAttribute(src)}"></script>`
    )
  ];
}

function createReactRefreshPreambleTags(
  assets: BrowserSourceStageClientAssets | undefined
): readonly string[] {
  if (assets?.reactRefreshPreambleSrc === undefined ||
    assets.reactRefreshPreambleSrc === null) {
    return [];
  }

  const source = toInlineJson(assets.reactRefreshPreambleSrc);

  return [
    '<script type="module">',
    `import RefreshRuntime from ${source};`,
    "RefreshRuntime.injectIntoGlobalHook(window);",
    "window.$RefreshReg$ = function () {};",
    "window.$RefreshSig$ = function () {",
    "  return function (type) {",
    "    return type;",
    "  };",
    "};",
    "window.__vite_plugin_react_preamble_installed__ = true;",
    "</script>"
  ];
}

function createClientDiagnosticBootstrapScript(): readonly string[] {
  return [
    "(function () {",
    "  var config = window.__RUNTIME_PLAYER_BROWSER_SOURCE__;",
    "  var diagnosticPath = config && config.clientDiagnosticsPath;",
    "  var previousOnError = window.onerror;",
    "  function toMessage(value) {",
    "    if (value instanceof Error && typeof value.message === \"string\") {",
    "      return value.message;",
    "    }",
    "    if (typeof value === \"string\") {",
    "      return value;",
    "    }",
    "    if (value === null || value === undefined) {",
    "      return null;",
    "    }",
    "    return String(value);",
    "  }",
    "  function toPosition(value) {",
    "    return typeof value === \"number\" && isFinite(value) ? value : null;",
    "  }",
    "  function report(diagnostic) {",
    "    if (!diagnostic || typeof diagnostic.event !== \"string\") {",
    "      return;",
    "    }",
    "    if (typeof diagnosticPath !== \"string\" || typeof fetch !== \"function\") {",
    "      return;",
    "    }",
    "    try {",
    "      fetch(diagnosticPath, {",
    "        method: \"POST\",",
    "        headers: { \"Content-Type\": \"application/json\" },",
    "        body: JSON.stringify({",
    "          event: diagnostic.event,",
    "          message: toMessage(diagnostic.message),",
    "          source: typeof diagnostic.source === \"string\" ? diagnostic.source : null,",
    "          line: toPosition(diagnostic.line),",
    "          column: toPosition(diagnostic.column)",
    "        }),",
    "        keepalive: true",
    "      }).catch(function () {});",
    "    } catch (_error) {",
    "      return;",
    "    }",
    "  }",
    "  window.__RUNTIME_PLAYER_BROWSER_SOURCE_REPORT_DIAGNOSTIC__ = report;",
    "  window.onerror = function (message, source, line, column, error) {",
    "    report({",
    "      event: \"window-error\",",
    "      message: toMessage(error) || toMessage(message),",
    "      source: typeof source === \"string\" ? source : null,",
    "      line: toPosition(line),",
    "      column: toPosition(column)",
    "    });",
    "    if (typeof previousOnError === \"function\") {",
    "      return previousOnError.apply(this, arguments);",
    "    }",
    "    return false;",
    "  };",
    "  window.addEventListener(\"unhandledrejection\", function (event) {",
    "    report({",
    "      event: \"unhandled-rejection\",",
    "      message: toMessage(event && event.reason)",
    "    });",
    "  });",
    "  report({ event: \"html-inline-boot\" });",
    "}());"
  ];
}

function toInlineJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
