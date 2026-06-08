import { Eye, EyeOff, Folder, Layers } from "lucide-react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import { cn } from "../../lib/class-name";
import { WorkspacePanel } from "./panel-frame";

export function StructureTreePanel() {
  const { selectDrawable, selectPart, structureRows } = useEditorSession();

  return (
    <WorkspacePanel className="h-full" overline="Hierarchy" title="Parts / Structure Tree">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3" data-testid="parts-tree">
        {structureRows.map((row) => (
          <button
            className={cn(
              "grid min-h-8 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border px-2 py-1 text-left transition",
              row.selected
                ? "border-teal-500/80 bg-teal-950/35"
                : "border-neutral-800 bg-neutral-950/50 hover:border-neutral-700"
            )}
            data-testid={row.selected ? "parts-tree-selected-row" : undefined}
            key={`${row.kind}-${row.id}`}
            onClick={() => {
              if (row.kind === "part") {
                selectPart(row.id);
                return;
              }

              selectDrawable(row.id);
            }}
            style={{ marginLeft: `${row.depth * 14}px` }}
            title={`${row.name} - ${row.detail}`}
            type="button"
          >
            <span className="flex size-6 items-center justify-center rounded border border-neutral-800 bg-neutral-900 text-neutral-400">
              {row.kind === "drawable" && row.hidden ? (
                <EyeOff aria-hidden="true" size={14} strokeWidth={1.8} />
              ) : row.kind === "drawable" ? (
                <Eye aria-hidden="true" size={14} strokeWidth={1.8} />
              ) : row.depth === 0 ? (
                <Layers aria-hidden="true" size={14} strokeWidth={1.8} />
              ) : (
                <Folder aria-hidden="true" size={14} strokeWidth={1.8} />
              )}
            </span>
            <span className="min-w-0 truncate text-sm font-medium text-neutral-100">
              {row.name}
            </span>
          </button>
        ))}
      </div>
    </WorkspacePanel>
  );
}
