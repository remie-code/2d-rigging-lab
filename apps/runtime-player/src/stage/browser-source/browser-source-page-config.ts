import {
  runtimePlayerBrowserSourceProtocolVersion
} from "../../preload/browser-source-transport-contract";
import type {
  RuntimePlayerBrowserSourceClientDiagnostic
} from "../../preload/browser-source-status-contract";

export type BrowserSourcePageConfig = {
  readonly protocolVersion: typeof runtimePlayerBrowserSourceProtocolVersion;
  readonly webSocketPath: string;
  readonly runtimeExportStatusPath: string;
  readonly runtimeExportPayloadPath: string;
  readonly clientDiagnosticsPath: string;
};

export type BrowserSourceLocation = {
  readonly origin: string;
  readonly protocol: string;
};

declare global {
  interface Window {
    __RUNTIME_PLAYER_BROWSER_SOURCE__?: unknown;
    __RUNTIME_PLAYER_BROWSER_SOURCE_REPORT_DIAGNOSTIC__?: (
      diagnostic: Omit<
        RuntimePlayerBrowserSourceClientDiagnostic,
        "reportedAtIso"
      >
    ) => void;
  }
}

export function readBrowserSourcePageConfig(
  value: unknown
): BrowserSourcePageConfig | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.protocolVersion !== runtimePlayerBrowserSourceProtocolVersion ||
    typeof value.webSocketPath !== "string" ||
    typeof value.runtimeExportStatusPath !== "string" ||
    typeof value.runtimeExportPayloadPath !== "string" ||
    typeof value.clientDiagnosticsPath !== "string"
  ) {
    return null;
  }

  return {
    protocolVersion: runtimePlayerBrowserSourceProtocolVersion,
    webSocketPath: value.webSocketPath,
    runtimeExportStatusPath: value.runtimeExportStatusPath,
    runtimeExportPayloadPath: value.runtimeExportPayloadPath,
    clientDiagnosticsPath: value.clientDiagnosticsPath
  };
}

export function readBrowserSourcePageWindowConfig(): BrowserSourcePageConfig | null {
  return readBrowserSourcePageConfig(
    globalThis.window?.__RUNTIME_PLAYER_BROWSER_SOURCE__
  );
}

export function createBrowserSourceHttpUrl(
  path: string,
  location: BrowserSourceLocation = globalThis.location
): string {
  return new URL(path, location.origin).toString();
}

export function createBrowserSourceWebSocketUrl(
  path: string,
  location: BrowserSourceLocation = globalThis.location
): string {
  const url = new URL(path, location.origin);
  url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
