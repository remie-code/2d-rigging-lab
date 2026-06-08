import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  FileInput,
  Folder,
  Image,
  Loader2
} from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";

import { useEditorSession } from "../../editor-session/editor-session-context";
import { cn } from "../../../lib/class-name";
import { Tooltip } from "../../../ui/tooltip";
import { createPsdImportPlan } from "../model/psd-import-planner";
import type { PsdImportPlan, PsdImportReviewRow } from "../model/psd-import-types";

type PsdImportTaskState =
  | { readonly status: "file-not-selected" }
  | { readonly status: "parsing"; readonly fileName: string }
  | { readonly status: "review"; readonly plan: PsdImportPlan }
  | { readonly status: "importing"; readonly plan: PsdImportPlan }
  | { readonly status: "error"; readonly message: string };

export function PsdImportModal() {
  const {
    closePsdImport,
    commitPsdImport,
    psdImportOpen,
    resolvePsdImportDestination,
    session
  } = useEditorSession();
  const [taskState, setTaskState] = useState<PsdImportTaskState>({
    status: "file-not-selected"
  });

  useEffect(() => {
    if (psdImportOpen) {
      setTaskState({ status: "file-not-selected" });
    }
  }, [psdImportOpen]);

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file === undefined) {
      return;
    }

    setTaskState({ status: "parsing", fileName: file.name });

    try {
      const bytes = await file.arrayBuffer();
      const plan = await createPsdImportPlan({
        fileName: file.name,
        bytes,
        destination: resolvePsdImportDestination(),
        packageRevision: session.packageRevision
      });
      setTaskState({ status: "review", plan });
    } catch {
      setTaskState({
        status: "error",
        message: "Import review could not be prepared for this PSD."
      });
    } finally {
      event.target.value = "";
    }
  };

  const reviewPlan =
    taskState.status === "review" || taskState.status === "importing"
      ? taskState.plan
      : undefined;
  const canImport = taskState.status === "review" && !taskState.plan.hasIssues;

  const handleImport = () => {
    if (!canImport) {
      return;
    }

    setTaskState({ status: "importing", plan: taskState.plan });
    try {
      commitPsdImport(taskState.plan);
    } catch {
      setTaskState({
        status: "error",
        message: "Import could not be committed into the workspace."
      });
    }
  };

  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (!open) {
          closePsdImport();
        }
      }}
      open={psdImportOpen}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-black/65" />
        <Dialog.Content
          aria-describedby="psd-import-description"
          className="fixed left-1/2 top-1/2 z-40 flex h-[min(760px,calc(100vh-32px))] max-h-[calc(100vh-32px)] w-[min(1120px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-md border border-neutral-700 bg-[#141413] text-neutral-100 shadow-2xl shadow-black/50"
        >
          <header className="border-b border-neutral-800 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
                  <FileInput aria-hidden="true" size={18} strokeWidth={1.8} />
                  Import PSD
                </Dialog.Title>
                <Dialog.Description
                  className="mt-1 text-xs text-neutral-400"
                  id="psd-import-description"
                >
                  Prepare a Parts structure from a local PSD file.
                </Dialog.Description>
              </div>
              {reviewPlan === undefined ? null : (
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-neutral-400">
                  <span className="max-w-56 truncate rounded border border-neutral-800 bg-neutral-950 px-2 py-1">
                    {reviewPlan.fileName}
                  </span>
                  <span className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1">
                    Destination: {reviewPlan.destination.label}
                  </span>
                </div>
              )}
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
            {taskState.status === "file-not-selected" ? (
              <FileSelectionState onFileSelected={handleFileSelected} />
            ) : null}
            {taskState.status === "parsing" ? (
              <BusyState fileName={taskState.fileName} label="Preparing import review" />
            ) : null}
            {taskState.status === "review" || taskState.status === "importing" ? (
              <ReviewState importing={taskState.status === "importing"} plan={taskState.plan} />
            ) : null}
            {taskState.status === "error" ? <ErrorState message={taskState.message} /> : null}
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-800 px-5 py-4">
            <button
              className="inline-flex h-9 items-center justify-center rounded-md border border-neutral-700 bg-neutral-950 px-4 text-sm font-medium text-neutral-200 transition hover:border-neutral-500"
              onClick={closePsdImport}
              type="button"
            >
              Cancel
            </button>
            <button
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-semibold transition",
                canImport
                  ? "border-teal-600 bg-teal-700 text-white hover:bg-teal-600"
                  : "cursor-not-allowed border-neutral-800 bg-neutral-900 text-neutral-500"
              )}
              disabled={!canImport}
              onClick={handleImport}
              type="button"
            >
              Import
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FileSelectionState({
  onFileSelected
}: {
  readonly onFileSelected: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <section className="grid min-h-[420px] place-items-center rounded-md border border-dashed border-neutral-700 bg-neutral-950/30 p-6">
      <label className="flex w-full max-w-md cursor-pointer flex-col items-center gap-4 rounded-md border border-neutral-800 bg-neutral-950/70 p-6 text-center transition hover:border-teal-600/70">
        <span className="flex size-12 items-center justify-center rounded-md border border-teal-700/50 bg-teal-950/40 text-teal-100">
          <FileInput aria-hidden="true" size={22} strokeWidth={1.8} />
        </span>
        <span className="text-sm font-semibold text-neutral-100">Select a PSD file</span>
        <span className="text-xs leading-5 text-neutral-400">
          The file is parsed in the browser for this import review.
        </span>
        <input
          accept=".psd,image/vnd.adobe.photoshop"
          aria-label="PSD file"
          className="sr-only"
          onChange={onFileSelected}
          type="file"
        />
      </label>
    </section>
  );
}

function BusyState({ fileName, label }: { readonly fileName: string; readonly label: string }) {
  return (
    <section className="grid min-h-[420px] place-items-center rounded-md border border-neutral-800 bg-neutral-950/30 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 aria-hidden="true" className="animate-spin text-teal-300" size={28} />
        <div className="text-sm font-semibold text-neutral-100">{label}</div>
        <div className="max-w-sm truncate text-xs text-neutral-400">{fileName}</div>
      </div>
    </section>
  );
}

function ReviewState({
  importing,
  plan
}: {
  readonly importing: boolean;
  readonly plan: PsdImportPlan;
}) {
  return (
    <section
      className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"
      data-testid="psd-import-review"
    >
      <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-neutral-800 bg-neutral-950/35">
        <div className="border-b border-neutral-800 px-3 py-2">
          <h3 className="text-sm font-semibold text-neutral-100">Planned Parts Structure</h3>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div className="space-y-2">
            {plan.reviewRows.map((row) => (
              <ReviewRow key={row.id} row={row} />
            ))}
          </div>
        </div>
      </div>

      <aside className="flex min-h-0 flex-col rounded-md border border-neutral-800 bg-neutral-950/35">
        <div className="border-b border-neutral-800 px-3 py-2">
          <h3 className="text-sm font-semibold text-neutral-100">PSD Preview</h3>
        </div>
        <div
          className="grid flex-1 place-items-center p-5"
          data-testid="psd-import-preview-placeholder"
        >
          <div className="flex max-w-56 flex-col items-center gap-3 text-center text-neutral-400">
            <span className="flex size-12 items-center justify-center rounded-md border border-neutral-700 bg-neutral-950 text-neutral-300">
              <Image aria-hidden="true" size={22} strokeWidth={1.8} />
            </span>
            <span className="text-sm font-medium text-neutral-200">Preview placeholder</span>
          </div>
        </div>
      </aside>

      {importing ? (
        <div className="lg:col-span-2">
          <BusyState fileName={plan.fileName} label="Importing into workspace" />
        </div>
      ) : null}
    </section>
  );
}

function ReviewRow({ row }: { readonly row: PsdImportReviewRow }) {
  const Icon =
    row.kind === "Part Container" ? Folder : row.kind === "Hidden Drawable" ? EyeOff : Eye;

  return (
    <div
      className="grid min-h-9 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950/60 px-2 py-1.5"
      style={{ marginLeft: `${row.depth * 18}px` }}
      title={`${row.kind}: ${row.name}`}
    >
      <span
        aria-label={row.kind}
        className="flex size-6 items-center justify-center rounded border border-neutral-800 bg-neutral-900 text-neutral-400"
      >
        <Icon aria-hidden="true" size={14} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 truncate text-sm font-medium text-neutral-100">{row.name}</div>
      {row.hasIssue ? (
        <Tooltip label={row.issueTooltip ?? "This row needs attention before import."} side="left">
          <span className="inline-flex h-6 items-center gap-1 rounded border border-amber-600/70 bg-amber-950/50 px-2 text-xs font-semibold text-amber-200">
            <AlertTriangle aria-hidden="true" size={13} strokeWidth={1.8} />
            Issue
          </span>
        </Tooltip>
      ) : null}
    </div>
  );
}

function ErrorState({ message }: { readonly message: string }) {
  return (
    <section className="grid min-h-[420px] place-items-center rounded-md border border-neutral-800 bg-neutral-950/30 p-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-md border border-amber-700/60 bg-amber-950/40 text-amber-200">
          <AlertTriangle aria-hidden="true" size={22} strokeWidth={1.8} />
        </span>
        <div className="text-sm font-semibold text-neutral-100">{message}</div>
      </div>
    </section>
  );
}
