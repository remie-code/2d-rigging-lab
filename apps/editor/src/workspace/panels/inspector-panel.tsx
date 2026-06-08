import { SlidersHorizontal } from "lucide-react";

import { inspectorSections } from "../workspace-data";
import { WorkspacePanel } from "./panel-frame";

export function InspectorPanel() {
  return (
    <WorkspacePanel overline="Context" title="Inspector">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3">
        <div className="rounded-md border border-neutral-800 bg-neutral-950/50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
            <SlidersHorizontal aria-hidden="true" size={16} strokeWidth={1.8} />
            Selection controls
          </div>
          <p className="mt-2 text-xs leading-5 text-neutral-400">
            Editable fields will follow the active tool and selected row.
          </p>
        </div>

        {inspectorSections.map((section) => (
          <section className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3" key={section.title}>
            <h3 className="text-xs font-semibold uppercase text-neutral-500">{section.title}</h3>
            <div className="mt-2 divide-y divide-neutral-800">
              {section.rows.map(([label, value]) => (
                <div className="flex min-h-8 items-center justify-between gap-3 py-1.5" key={label}>
                  <span className="text-xs text-neutral-500">{label}</span>
                  <span className="truncate text-xs font-medium text-neutral-200">{value}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </WorkspacePanel>
  );
}
