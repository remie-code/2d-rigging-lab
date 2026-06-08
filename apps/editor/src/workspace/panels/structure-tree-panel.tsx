import { ChevronRight, Layers } from "lucide-react";

import { cn } from "../../lib/class-name";
import { structureRows } from "../workspace-data";
import { WorkspacePanel } from "./panel-frame";

const toneClassName = {
  amber: "bg-amber-500",
  neutral: "bg-neutral-500",
  teal: "bg-teal-500"
} as const;

export function StructureTreePanel() {
  return (
    <WorkspacePanel overline="Hierarchy" title="Parts / Structure Tree">
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3">
        {structureRows.map((row) => (
          <div
            className="grid min-h-11 grid-cols-[auto_1fr] items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950/50 px-2 py-2"
            key={`${row.depth}-${row.name}`}
            style={{ marginLeft: `${row.depth * 14}px` }}
          >
            <span className="flex size-7 items-center justify-center rounded border border-neutral-800 bg-neutral-900 text-neutral-400">
              {row.depth === 0 ? (
                <Layers aria-hidden="true" size={15} strokeWidth={1.8} />
              ) : (
                <ChevronRight aria-hidden="true" size={15} strokeWidth={1.8} />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-neutral-100">{row.name}</span>
              <span className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                <span className={cn("size-1.5 rounded-full", toneClassName[row.tone])} />
                <span className="truncate">{row.detail}</span>
              </span>
            </span>
          </div>
        ))}
      </div>
    </WorkspacePanel>
  );
}
