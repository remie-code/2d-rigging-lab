import { taskEntries } from "./workspace-data";
import { useEditorSession } from "../features/editor-session/editor-session-context";
import { useEditorUiStore, type WorkspaceEntryId } from "../state/editor-ui-store";
import { cn } from "../lib/class-name";

export function TaskViewEntryBar() {
  const activeEntry = useEditorUiStore((state) => state.activeEntry);
  const setActiveEntry = useEditorUiStore((state) => state.setActiveEntry);
  const { openPsdImport } = useEditorSession();

  const activateEntry = (entry: string) => {
    if (entry === "import") {
      openPsdImport();
      return;
    }

    setActiveEntry(entry as WorkspaceEntryId);
  };

  return (
    <section className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-800 bg-[#111110] px-4 py-2">
      <div className="mr-2 text-xs font-semibold uppercase text-neutral-500">
        Task / View Entry Points
      </div>
      {taskEntries.map((entry) => {
        const Icon = entry.icon;
        const selected = activeEntry === entry.id;

        return (
          <button
            aria-pressed={selected}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition",
              "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-amber-500/60 hover:text-amber-100",
              selected && "border-amber-500/70 bg-amber-950/30 text-amber-100"
            )}
            key={entry.id}
            onClick={() => activateEntry(entry.id)}
            type="button"
          >
            <Icon aria-hidden="true" size={15} strokeWidth={1.8} />
            <span>{entry.label}</span>
          </button>
        );
      })}
    </section>
  );
}
