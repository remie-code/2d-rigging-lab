import { AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";
import { useMemo } from "react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import {
  createEditorDiagnosticsProjection,
  type EditorDiagnosticCategory,
  type EditorDiagnosticDetails,
  type EditorDiagnosticItem,
  type EditorDiagnosticsProjection
} from "../../features/editor-session/model/editor-diagnostics-state";
import { cn } from "../../lib/class-name";
import { useEditorUiStore } from "../../state/editor-ui-store";
import { IconButton } from "../../ui/icon-button";
import { resolveEditorDiagnosticJumpCommands } from "./diagnostics-jump-actions";

const categoryLabels: Record<EditorDiagnosticCategory, string> = {
  mesh: "Mesh",
  references: "References",
  dynamics: "Dynamics"
};

const categoryOrder: readonly EditorDiagnosticCategory[] = ["mesh", "references", "dynamics"];

export function DiagnosticsScreen() {
  const {
    selectDeformerTreeTarget,
    selectDrawable,
    session,
    setActiveParameterId,
    setDynamicsToolPreviewGroupId
  } = useEditorSession();
  const setActiveEntry = useEditorUiStore((state) => state.setActiveEntry);
  const setActiveTool = useEditorUiStore((state) => state.setActiveTool);
  const projection = useMemo(() => createEditorDiagnosticsProjection(session), [session]);
  const groupedItems = useMemo(() => groupDiagnosticsByCategory(projection), [projection]);

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-neutral-800 bg-[#111110]"
      data-testid="diagnostics-screen"
    >
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconButton
            className="size-8 shrink-0"
            label="Back to Authoring Workspace"
            onClick={() => setActiveEntry("import")}
            tooltipSide="bottom"
          >
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
          </IconButton>
          <div className="h-6 w-px shrink-0 bg-neutral-800" />
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-amber-700/70 bg-amber-950/30 text-amber-100">
            <ShieldCheck aria-hidden="true" size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase text-neutral-500">
              Validation / Diagnostics
            </div>
            <h1 className="truncate text-sm font-semibold text-neutral-50">
              Deterministic warning list
            </h1>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded border px-2.5 py-1 text-xs font-semibold",
            projection.warningItemCount === 0
              ? "border-emerald-800/70 bg-emerald-950/30 text-emerald-200"
              : "border-amber-700/70 bg-amber-950/35 text-amber-100"
          )}
          data-testid="diagnostics-warning-count"
        >
          {projection.warningItemCount} warning{projection.warningItemCount === 1 ? "" : "s"}
        </span>
      </div>

      {projection.items.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div
            className="max-w-md rounded-md border border-neutral-800 bg-neutral-950/45 px-4 py-5 text-center"
            data-testid="diagnostics-empty-state"
          >
            <div className="text-sm font-semibold text-neutral-100">
              No deterministic warnings
            </div>
            <p className="mt-2 text-xs leading-5 text-neutral-400">
              The current editor session has no deterministic mesh, reference, or dynamics
              warnings.
            </p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="grid gap-4">
            {categoryOrder.map((category) => {
              const items = groupedItems[category] ?? [];
              if (items.length === 0) {
                return null;
              }

              return (
                <section
                  className="rounded-md border border-neutral-800 bg-neutral-950/30"
                  data-diagnostics-category={category}
                  data-testid="diagnostics-category"
                  key={category}
                >
                  <div className="flex min-h-10 items-center justify-between gap-3 border-b border-neutral-800 px-3 py-2">
                    <h2 className="text-xs font-semibold uppercase text-neutral-300">
                      {categoryLabels[category]}
                    </h2>
                    <span className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium uppercase text-neutral-400">
                      {items.length}
                    </span>
                  </div>
                  <div className="divide-y divide-neutral-800">
                    {items.map((item) => {
                      const commands = resolveEditorDiagnosticJumpCommands(item);

                      return (
                        <article
                          className="grid gap-3 px-3 py-3 xl:grid-cols-[minmax(0,1fr)_auto]"
                          data-diagnostic-code={item.code}
                          data-testid="diagnostics-row"
                          key={item.id}
                        >
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-start gap-2">
                              <AlertTriangle
                                aria-hidden="true"
                                className="mt-0.5 shrink-0 text-amber-300"
                                size={15}
                                strokeWidth={1.9}
                              />
                              <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-neutral-100">
                                  {item.title}
                                </h3>
                                <div className="mt-1 text-xs text-neutral-500">
                                  {categoryLabels[item.category]} / {formatDiagnosticTarget(item)}
                                </div>
                                <p className="mt-2 text-xs leading-5 text-neutral-300">
                                  {item.message}
                                </p>
                              </div>
                            </div>
                            <DiagnosticDetails details={item.details} />
                          </div>
                          <div className="flex flex-wrap items-start justify-end gap-2">
                            {commands.length === 0 ? (
                              <span
                                className="rounded border border-neutral-800 bg-neutral-950 px-2.5 py-1.5 text-xs font-medium text-neutral-500"
                                data-testid="diagnostics-row-no-jump"
                              >
                                No safe jump target
                              </span>
                            ) : (
                              commands.map((command) => (
                                <button
                                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-amber-600/70 bg-amber-950/30 px-3 text-xs font-semibold text-amber-100 transition hover:border-amber-400 hover:bg-amber-900/35"
                                  data-testid="diagnostics-jump-action"
                                  key={`${item.id}:${command.kind}:${command.target.kind}:${command.target.id}`}
                                  onClick={() =>
                                    command.run({
                                      selectDeformerTreeTarget,
                                      selectDrawable,
                                      setActiveEntry,
                                      setActiveParameterId,
                                      setActiveTool,
                                      setDynamicsToolPreviewGroupId
                                    })
                                  }
                                  type="button"
                                >
                                  {command.label}
                                </button>
                              ))
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function groupDiagnosticsByCategory(
  projection: EditorDiagnosticsProjection
): Partial<Record<EditorDiagnosticCategory, readonly EditorDiagnosticItem[]>> {
  return categoryOrder.reduce<Partial<Record<EditorDiagnosticCategory, EditorDiagnosticItem[]>>>(
    (groups, category) => {
      const items = projection.items.filter((item) => item.category === category);
      if (items.length > 0) {
        groups[category] = items;
      }
      return groups;
    },
    {}
  );
}

function DiagnosticDetails({ details }: { readonly details?: EditorDiagnosticDetails }) {
  if (details === undefined || Object.keys(details).length === 0) {
    return null;
  }

  return (
    <dl
      className="mt-3 grid gap-1 rounded border border-neutral-800 bg-neutral-950/55 px-2 py-2 text-[11px] text-neutral-400 sm:grid-cols-[max-content_minmax(0,1fr)]"
      data-testid="diagnostics-details"
    >
      {Object.entries(details).map(([key, value]) => (
        <div className="contents" key={key}>
          <dt className="font-medium text-neutral-500">{key}</dt>
          <dd className="min-w-0 break-words text-neutral-300">{formatDiagnosticDetail(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatDiagnosticTarget(item: EditorDiagnosticItem): string {
  const label = item.target.label ?? item.target.id;
  return `${item.target.kind} ${label}`;
}

function formatDiagnosticDetail(value: string | readonly string[]): string {
  return Array.isArray(value) ? value.join(", ") : value;
}
