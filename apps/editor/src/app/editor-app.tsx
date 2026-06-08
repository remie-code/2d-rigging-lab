import { FoundationWorkspace } from "../workspace/foundation-workspace";
import { TooltipProvider } from "../ui/tooltip";

export function EditorApp() {
  return (
    <TooltipProvider>
      <FoundationWorkspace />
    </TooltipProvider>
  );
}
