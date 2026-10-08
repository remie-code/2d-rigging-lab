import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ControlWindowApp } from "./control-window-app";
import "../styles/global.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Runtime Player Control root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ControlWindowApp />
  </StrictMode>
);
