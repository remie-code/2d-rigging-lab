import { mountEditorApp } from "./app/editor-app.js";

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("Editor app root element was not found.");
}

mountEditorApp(appRoot);
