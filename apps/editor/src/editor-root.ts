import { createAuthoringWorkspace } from "./workspace-shell";

export function createEditorRoot(): HTMLElement {
  const root = document.createElement("div");
  root.className = "editor-root";
  root.append(createAuthoringWorkspace());

  return root;
}
