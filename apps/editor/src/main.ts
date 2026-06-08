import "./styles.css";
import { createEditorRoot } from "./editor-root";

const appContainer = document.querySelector<HTMLElement>("#app");

if (!appContainer) {
  throw new Error("Editor container was not found.");
}

appContainer.replaceChildren(createEditorRoot());
