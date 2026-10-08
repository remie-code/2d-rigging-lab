import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { StageWindowApp } from "./stage-window-app";
import "../styles/global.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Runtime Player Stage root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <StageWindowApp />
  </StrictMode>
);
