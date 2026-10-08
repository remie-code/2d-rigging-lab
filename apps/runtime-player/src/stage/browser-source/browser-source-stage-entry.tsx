import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { BrowserSourceStageApp } from "./browser-source-stage-app";
import { reportBrowserSourceClientDiagnostic } from "./browser-source-client-diagnostics";
import "../../styles/global.css";

reportBrowserSourceClientDiagnostic({
  event: "module-entry-started",
  message: null,
  source: null,
  line: null,
  column: null
});

const rootElement = document.getElementById("runtime-player-browser-source-root");

if (!rootElement) {
  throw new Error("Runtime Player Browser Source root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserSourceStageApp />
  </StrictMode>
);
