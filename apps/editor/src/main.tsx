import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { EditorApp } from "./app/editor-app";
import "./styles/global.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Editor root element was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <EditorApp />
  </StrictMode>
);
