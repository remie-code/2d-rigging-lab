import { SlidersHorizontal } from "lucide-react";

export function ParameterBar() {
  return (
    <section className="flex shrink-0 flex-wrap items-center gap-3 border-t border-neutral-800 bg-[#151514] px-4 py-3">
      <div className="flex min-w-44 items-center gap-2 text-sm font-semibold text-neutral-100">
        <SlidersHorizontal aria-hidden="true" size={17} strokeWidth={1.8} />
        <span>Parameter Bar</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="min-w-24 text-xs text-neutral-500">Active</span>
        <span className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs font-medium text-neutral-300">
          None selected
        </span>
        <input
          aria-label="Parameter value"
          className="h-2 min-w-32 flex-1 accent-teal-500"
          disabled
          max="100"
          min="0"
          type="range"
          value="50"
        />
        <span className="w-14 text-right text-xs text-neutral-500">0.50</span>
      </div>
    </section>
  );
}
