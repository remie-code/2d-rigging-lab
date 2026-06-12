import { GitBranch, Layers, Link2, Spline } from "lucide-react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import { cn } from "../../lib/class-name";

export function DeformerTreeView() {
  const {
    deformerRows,
    rigDraft,
    selectDrawable,
    selectRigControl
  } = useEditorSession();

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto p-2"
      data-testid="deformer-tree"
      role="tree"
    >
      {rigDraft === null ? null : (
        <div
          className="mb-1 rounded-md border border-amber-500/60 bg-amber-950/20 px-2 py-2 text-xs text-amber-100"
          data-testid="deformer-tree-draft-summary"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Spline aria-hidden="true" size={14} strokeWidth={1.8} />
            Draft Warp Deformer
          </div>
          <div className="mt-1 text-amber-100/80">{rigDraft.displayName}</div>
        </div>
      )}
      {deformerRows.length === 0 ? (
        <div
          className="rounded-md border border-neutral-800 bg-neutral-950/45 p-3 text-xs text-neutral-400"
          data-testid="deformer-tree-empty"
        >
          No Warp Deformers
        </div>
      ) : (
        deformerRows.map((row) =>
          row.kind === "warpDeformer" ? (
            <button
              className={cn(
                "grid min-h-8 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2 py-1 text-left transition",
                row.selected
                  ? "border-teal-500/80 bg-teal-950/35"
                  : "border-neutral-800 bg-neutral-950/45 hover:border-neutral-700"
              )}
              data-row-kind="warp-deformer"
              data-row-id={row.rigControlId}
              data-testid={row.selected ? "deformer-tree-selected-row" : "deformer-tree-row"}
              key={`deformer:${row.rigControlId}`}
              onClick={() => selectRigControl(row.rigControlId)}
              role="treeitem"
              style={{ marginLeft: `${row.depth * 14}px` }}
              title={`${row.displayName} - ${row.detail}`}
              type="button"
            >
              <span className="flex size-5 shrink-0 items-center justify-center text-teal-300">
                <Spline aria-hidden="true" size={14} strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-neutral-100">
                  {row.displayName}
                </span>
                <span className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-[11px] text-neutral-500">
                  <GitBranch aria-hidden="true" size={11} strokeWidth={1.8} />
                  {row.transformLabel}
                </span>
              </span>
              <span className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium uppercase text-neutral-400">
                {row.childRigControlCount + row.childDrawableCount}
              </span>
            </button>
          ) : (
            <button
              className={cn(
                "grid min-h-8 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950/30 px-2 py-1 text-left transition hover:border-neutral-700",
                row.selected ? "border-amber-500/80 bg-amber-950/25" : ""
              )}
              data-row-kind="bound-drawable-ref"
              data-row-id={row.drawableId}
              data-testid="deformer-tree-drawable-ref"
              key={`drawable-ref:${row.parentRigControlId}:${row.drawableId}`}
              onClick={() => selectDrawable(row.drawableId)}
              role="treeitem"
              style={{ marginLeft: `${row.depth * 14}px` }}
              title={`${row.displayName} - ${row.detail}`}
              type="button"
            >
              <span className="flex size-5 shrink-0 items-center justify-center text-neutral-500">
                <Link2 aria-hidden="true" size={13} strokeWidth={1.8} />
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <Layers
                  aria-hidden="true"
                  className="shrink-0 text-amber-300/80"
                  size={13}
                  strokeWidth={1.8}
                />
                <span className="truncate text-sm font-medium text-neutral-300">
                  {row.displayName}
                </span>
              </span>
            </button>
          )
        )
      )}
    </div>
  );
}
