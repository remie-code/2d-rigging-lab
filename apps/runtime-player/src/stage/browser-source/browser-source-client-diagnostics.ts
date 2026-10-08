import type {
  RuntimePlayerBrowserSourceClientDiagnostic
} from "../../preload/browser-source-status-contract";

export type BrowserSourceClientDiagnosticReport = Omit<
  RuntimePlayerBrowserSourceClientDiagnostic,
  "reportedAtIso"
>;

export type BrowserSourceClientDiagnosticReporter = (
  diagnostic: BrowserSourceClientDiagnosticReport
) => void;

export function reportBrowserSourceClientDiagnostic(
  diagnostic: BrowserSourceClientDiagnosticReport
): void {
  const reporter =
    globalThis.window?.__RUNTIME_PLAYER_BROWSER_SOURCE_REPORT_DIAGNOSTIC__;

  if (typeof reporter !== "function") {
    return;
  }

  reporter(diagnostic);
}
