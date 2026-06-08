import { Eye, FolderOpen, PanelLeft, Save } from "lucide-react";

import { StatusBadge } from "../components/status-badge";
import { useEditorSession } from "../features/editor-session/editor-session-context";
import { cn } from "../lib/class-name";
import { useEditorUiStore, type WorkspaceEntryId } from "../state/editor-ui-store";
import { IconButton } from "../ui/icon-button";
import { taskEntries } from "./workspace-data";

export function AppBar() {
  const surfaceLabel = useEditorUiStore((state) => state.surfaceLabel);
  const activeEntry = useEditorUiStore((state) => state.activeEntry);
  const setActiveEntry = useEditorUiStore((state) => state.setActiveEntry);
  const { openPsdImport } = useEditorSession();

  const activateEntry = (entry: WorkspaceEntryId) => {
    setActiveEntry(entry);
    if (entry === "import") {
      openPsdImport();
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-neutral-800 bg-[#151514] px-4">
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-teal-700/60 bg-teal-950/40 text-teal-100">
          <PanelLeft aria-hidden="true" size={19} strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-50">
            Private 2D Rigging Lab
          </div>
          <div className="truncate text-xs text-neutral-400">Authoring Workspace</div>
        </div>
      </div>

      <nav
        aria-label="Task and view entry points"
        className="hidden min-w-0 flex-1 items-center justify-start gap-2 overflow-x-auto xl:flex"
      >
        {taskEntries.map((entry) => {
          const Icon = entry.icon;
          const selected = activeEntry === entry.id;

          return (
            <button
              aria-pressed={selected}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition",
                "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-amber-500/60 hover:text-amber-100",
                selected && "border-amber-500/70 bg-amber-950/30 text-amber-100"
              )}
              key={entry.id}
              onClick={() => activateEntry(entry.id as WorkspaceEntryId)}
              type="button"
            >
              <Icon aria-hidden="true" size={15} strokeWidth={1.8} />
              <span>{entry.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="ml-auto hidden min-w-0 shrink-0 items-center gap-2 md:flex">
        <StatusBadge tone="ready">Untitled model</StatusBadge>
        <StatusBadge tone="neutral">{surfaceLabel}</StatusBadge>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <IconButton label="Open project" tooltipSide="bottom">
          <FolderOpen aria-hidden="true" size={18} strokeWidth={1.8} />
        </IconButton>
        <IconButton label="Save project" tooltipSide="bottom">
          <Save aria-hidden="true" size={18} strokeWidth={1.8} />
        </IconButton>
        <IconButton label="Viewer" tooltipSide="bottom">
          <Eye aria-hidden="true" size={18} strokeWidth={1.8} />
        </IconButton>
      </div>
    </header>
  );
}
