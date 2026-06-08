import { Crosshair, Layers } from "lucide-react";

import { WorkspacePanel } from "./panel-frame";

export function CanvasPreviewPanel() {
  return (
    <WorkspacePanel className="bg-[#141516]" overline="Stage" title="Canvas / Preview">
      <div className="relative min-h-[360px] flex-1 overflow-hidden bg-[linear-gradient(#252525_1px,transparent_1px),linear-gradient(90deg,#252525_1px,transparent_1px)] bg-[size:24px_24px]">
        <div className="absolute inset-6 rounded-md border border-dashed border-neutral-700 bg-neutral-950/35" />
        <div className="absolute left-1/2 top-1/2 flex size-64 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-teal-700/40 bg-teal-950/10">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-md border border-neutral-700 bg-neutral-950 text-teal-100">
              <Layers aria-hidden="true" size={22} strokeWidth={1.8} />
            </span>
            <div>
              <div className="text-sm font-semibold text-neutral-100">No artwork loaded</div>
              <div className="mt-1 max-w-44 text-xs leading-5 text-neutral-400">
                Preview and edit overlays appear here.
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950/85 px-2 py-1 text-xs text-neutral-400">
          <Crosshair aria-hidden="true" size={14} strokeWidth={1.8} />
          <span>Origin centered</span>
        </div>
      </div>
    </WorkspacePanel>
  );
}
