import { Eye, FolderOpen, PanelLeft, Save } from "lucide-react";

import { StatusBadge } from "../components/status-badge";
import { useEditorUiStore } from "../state/editor-ui-store";
import { IconButton } from "../ui/icon-button";

export function AppBar() {
  const surfaceLabel = useEditorUiStore((state) => state.surfaceLabel);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-800 bg-[#151514] px-4">
      <div className="flex min-w-0 items-center gap-3">
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

      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <StatusBadge tone="ready">Untitled model</StatusBadge>
        <StatusBadge tone="neutral">{surfaceLabel}</StatusBadge>
      </div>

      <div className="flex items-center gap-2">
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
