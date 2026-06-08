import { toolboxSections } from "../workspace-data";
import { useEditorSession } from "../../features/editor-session/editor-session-context";
import { cn } from "../../lib/class-name";
import {
  useEditorUiStore,
  type WorkspaceEntryId,
  type WorkspaceToolId
} from "../../state/editor-ui-store";
import { IconButton } from "../../ui/icon-button";

export function WorkspaceToolbox({ layout = "vertical" }: { layout?: "horizontal" | "vertical" }) {
  const activeTool = useEditorUiStore((state) => state.activeTool);
  const activeEntry = useEditorUiStore((state) => state.activeEntry);
  const setActiveTool = useEditorUiStore((state) => state.setActiveTool);
  const setActiveEntry = useEditorUiStore((state) => state.setActiveEntry);
  const { openPsdImport } = useEditorSession();
  const horizontal = layout === "horizontal";

  const activateEntry = (entry: WorkspaceEntryId) => {
    setActiveEntry(entry);
    if (entry === "import") {
      openPsdImport();
    }
  };

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 gap-3 bg-[#121211]",
        horizontal
          ? "items-center overflow-x-auto border-b border-neutral-800 px-3 py-2"
          : "flex-col items-center overflow-y-auto border-r border-neutral-800 px-2 py-3"
      )}
    >
      <div className="shrink-0 text-[11px] font-semibold uppercase text-neutral-500">Toolbox</div>
      {toolboxSections.map((section) => (
        <div
          className={cn(
            "flex items-center gap-2 border-neutral-800",
            horizontal ? "flex-row border-l pl-3" : "flex-col border-t pt-3"
          )}
          key={section.label}
        >
          <div className="sr-only">{section.label}</div>
          {section.items.map((item) => {
            const Icon = item.icon;
            const pressed =
              item.kind === "tool"
                ? activeTool === item.id
                : activeEntry === item.id;

            return (
              <IconButton
                key={item.id}
                label={item.label}
                onClick={() => {
                  if (item.kind === "tool") {
                    setActiveTool(item.id as WorkspaceToolId);
                    return;
                  }

                  activateEntry(item.id as WorkspaceEntryId);
                }}
                pressed={pressed}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
              </IconButton>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
