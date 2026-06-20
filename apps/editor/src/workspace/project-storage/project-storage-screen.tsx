import { AlertTriangle, CheckCircle2, Download, FolderOpen, X } from "lucide-react";
import { useRef, type ChangeEvent } from "react";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import { cn } from "../../lib/class-name";
import { useEditorUiStore } from "../../state/editor-ui-store";

export function ProjectStorageScreen() {
  const {
    exportPortableProject,
    openProjectFile,
    projectIdentityLabel,
    projectSaveStatusLabel,
    projectStorage,
    session
  } = useEditorSession();
  const setActiveEntry = useEditorUiStore((state) => state.setActiveEntry);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const busy = projectStorage.status === "loading" || projectStorage.status === "saving";

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file === undefined) {
      return;
    }

    void openProjectFile(file);
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-neutral-800 bg-[#151514]">
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-neutral-800 px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-neutral-50">Portable JSON</h1>
          <p className="truncate text-xs text-neutral-500">{projectIdentityLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            accept="application/json,.json"
            aria-label="Import Portable JSON file"
            className="sr-only"
            onChange={handleFileChange}
            ref={inputRef}
            type="file"
          />
          <button
            className="inline-flex h-8 items-center gap-2 rounded border border-teal-700/70 bg-teal-950/40 px-2.5 text-xs font-semibold text-teal-100 transition hover:border-teal-400 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            <FolderOpen aria-hidden="true" size={15} strokeWidth={1.8} />
            Import Portable JSON
          </button>
          <button
            className="inline-flex h-8 items-center gap-2 rounded border border-emerald-700/70 bg-emerald-950/40 px-2.5 text-xs font-semibold text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600"
            disabled={busy}
            onClick={() => {
              void exportPortableProject();
            }}
            type="button"
          >
            <Download aria-hidden="true" size={15} strokeWidth={1.8} />
            Export Portable JSON
          </button>
          <button
            aria-label="Close Portable JSON"
            className="inline-flex size-8 items-center justify-center rounded border border-neutral-800 bg-neutral-950 text-neutral-300 transition hover:border-amber-500/70 hover:text-amber-100"
            onClick={() => setActiveEntry("workspace")}
            type="button"
          >
            <X aria-hidden="true" size={16} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto xl:grid-cols-[minmax(420px,0.9fr)_minmax(520px,1.1fr)]">
        <section className="border-b border-neutral-800 p-4 xl:border-b-0 xl:border-r">
          <h2 className="text-xs font-semibold uppercase text-neutral-500">Current Project</h2>
          <dl className="mt-3 grid gap-2 text-xs">
            <ProjectStorageRow label="Name" value={session.packageIdentity.packageDisplayName} />
            <ProjectStorageRow label="Package" value={session.packageIdentity.packageId} />
            <ProjectStorageRow label="Revision" value={String(session.packageRevision)} />
            <ProjectStorageRow label="Save state" value={projectSaveStatusLabel} />
            <ProjectStorageRow
              label="Binary assets"
              value={String(session.binaryAssets?.fileEntries.length ?? 0)}
            />
          </dl>
        </section>

        <section className="min-h-0 overflow-auto p-4">
          <div className="flex items-start gap-3">
            <StatusIcon status={projectStorage.status} />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-neutral-100">
                {formatStorageStatus(projectStorage.status)}
              </h2>
              <p className="mt-1 text-xs text-neutral-400">{projectStorage.message}</p>
            </div>
          </div>

          <dl className="mt-4 grid gap-2 text-xs md:grid-cols-2">
            <ProjectStorageRow
              label="Operation"
              value={projectStorage.lastAction ?? "none"}
            />
            <ProjectStorageRow label="File" value={projectStorage.fileName ?? "none"} />
            <ProjectStorageRow
              label="Bundle bytes"
              value={
                projectStorage.binaryPayloadCount === null
                  ? "none"
                  : String(projectStorage.binaryPayloadCount)
              }
            />
            <ProjectStorageRow
              label="Loaded bytes"
              value={
                projectStorage.binaryFileCount === null
                  ? "none"
                  : String(projectStorage.binaryFileCount)
              }
            />
          </dl>

          {projectStorage.status === "error" ? (
            <section className="mt-4 border-t border-rose-900/70 pt-3">
              <div className="text-xs font-semibold uppercase text-rose-200">
                {projectStorage.errorCode ?? "storage error"}
              </div>
              <ul className="mt-2 divide-y divide-rose-950/80 border border-rose-900/70 bg-rose-950/20 text-xs text-rose-100">
                {projectStorage.issues.length === 0 ? (
                  <li className="px-3 py-2">{projectStorage.message}</li>
                ) : (
                  projectStorage.issues.map((issue, index) => (
                    <li className="px-3 py-2" key={`${issue.code}-${index}`}>
                      <div className="font-medium">{issue.code}</div>
                      <div className="mt-1 text-rose-100/80">{issue.message}</div>
                      {issue.targetPath === undefined ? null : (
                        <div className="mt-1 font-mono text-[11px] text-rose-100/70">
                          {issue.targetPath}
                        </div>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </section>
          ) : null}
        </section>
      </div>
    </section>
  );
}

function ProjectStorageRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="grid min-h-8 grid-cols-[7rem_1fr] gap-3 border-b border-neutral-900 py-1.5">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-neutral-200">{value}</dd>
    </div>
  );
}

function StatusIcon({ status }: { readonly status: ReturnType<typeof useEditorSession>["projectStorage"]["status"] }) {
  const error = status === "error";
  const completed = status === "saved" || status === "loaded";
  const Icon = error ? AlertTriangle : CheckCircle2;

  return (
    <span
      className={cn(
        "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded border",
        error
          ? "border-rose-800/70 bg-rose-950/30 text-rose-200"
          : completed
            ? "border-emerald-700/70 bg-emerald-950/30 text-emerald-200"
            : "border-neutral-800 bg-neutral-950 text-neutral-400"
      )}
    >
      <Icon aria-hidden="true" size={17} strokeWidth={1.8} />
    </span>
  );
}

function formatStorageStatus(status: ReturnType<typeof useEditorSession>["projectStorage"]["status"]): string {
  switch (status) {
    case "saving":
      return "Saving";
    case "saved":
      return "Saved";
    case "loading":
      return "Opening";
    case "loaded":
      return "Opened";
    case "error":
      return "Storage Error";
    case "idle":
      return "Ready";
  }
}
