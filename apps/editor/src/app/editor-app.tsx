import { FoundationWorkspace } from "../workspace/foundation-workspace";
import { TooltipProvider } from "../ui/tooltip";
import { EditorSessionProvider } from "../features/editor-session/editor-session-context";

export function EditorApp() {
  return (
    <TooltipProvider>
      <EditorSessionProvider>
        <FoundationWorkspace />
      </EditorSessionProvider>
    </TooltipProvider>
  );
}
