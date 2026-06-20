import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  LayoutGrid,
  ShieldCheck
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  assembleRuntimeExport,
  preflightRuntimeExport
} from "@private-2d-rigging-lab/authoring-core";

import { useEditorSession } from "../../features/editor-session/editor-session-context";
import { createEditorDiagnosticsProjection } from "../../features/editor-session/model/editor-diagnostics-state";
import { writeRuntimeExportToPickedDirectory } from "../../features/runtime-export/model/runtime-export-directory";
import {
  createRuntimeExportCheckingTaskState,
  createRuntimeExportFailedTaskState,
  createRuntimeExportPreflightCheckRows,
  createRuntimeExportTaskState,
  formatRuntimeExportDirectoryAccessReason,
  formatRuntimeExportTargetSummaryLabel,
  formatRuntimeExportValidateWarningLabel,
  type RuntimeExportTaskState
} from "../../features/runtime-export/model/runtime-export-task-state";
import {
  detectWorkspaceDirectoryAccess,
  type WorkspaceDirectoryAccessCapability
} from "../../features/workspace-storage/model/workspace-directory-io";
import { cn } from "../../lib/class-name";
import { useEditorUiStore } from "../../state/editor-ui-store";
import { IconButton } from "../../ui/icon-button";

export type RuntimeExportWriteStatus =
  | { readonly status: "idle" }
  | { readonly status: "exporting" }
  | { readonly status: "exported"; readonly message: string }
  | { readonly status: "failed"; readonly message: string };

export interface RuntimeExportTaskViewProps {
  readonly directoryAccess: WorkspaceDirectoryAccessCapability;
  readonly exportStatus: RuntimeExportWriteStatus;
  readonly onBack: () => void;
  readonly onExport: () => void;
  readonly onOpenTextureAtlas: () => void;
  readonly onOpenValidate: () => void;
  readonly state: RuntimeExportTaskState;
}

export function RuntimeExportTaskScreen() {
  const { session } = useEditorSession();
  const setActiveEntry = useEditorUiStore((state) => state.setActiveEntry);
  const validateWarningCount = useMemo(
    () => createEditorDiagnosticsProjection(session).warningItemCount,
    [session]
  );
  const [taskState, setTaskState] = useState<RuntimeExportTaskState>(() =>
    createRuntimeExportCheckingTaskState(session)
  );
  const [exportStatus, setExportStatus] = useState<RuntimeExportWriteStatus>({
    status: "idle"
  });
  const directoryAccess = detectWorkspaceDirectoryAccess();

  useEffect(() => {
    let cancelled = false;
    setTaskState(createRuntimeExportCheckingTaskState(session));
    setExportStatus({ status: "idle" });

    void preflightRuntimeExport(session, { validateWarningCount })
      .then((preflight) => {
        if (!cancelled) {
          setTaskState(createRuntimeExportTaskState({ session, preflight }));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setTaskState(createRuntimeExportFailedTaskState({ session, error }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, validateWarningCount]);

  const exportRuntime = async () => {
    if (taskState.status !== "ready" || !directoryAccess.supported) {
      return;
    }

    setExportStatus({ status: "exporting" });

    try {
      const assembly = await assembleRuntimeExport(session, {
        createdAt: new Date().toISOString(),
        validateWarningCount
      });

      if (assembly.status === "blocked") {
        setTaskState(createRuntimeExportTaskState({
          session,
          preflight: assembly.preflight
        }));
        setExportStatus({
          status: "failed",
          message: assembly.preflight.blockers[0]?.message ?? "Runtime Export is blocked."
        });
        return;
      }

      const result = await writeRuntimeExportToPickedDirectory({
        fileSet: assembly.fileSet
      });

      setExportStatus({
        status: "exported",
        message:
          `Exported ${result.totalFileCount} files: ${result.textFileCount} JSON files and ${result.texturePageCount} raw RGBA texture page.`
      });
    } catch (error) {
      setExportStatus({
        status: "failed",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  };

  return (
    <RuntimeExportTaskView
      directoryAccess={directoryAccess}
      exportStatus={exportStatus}
      onBack={() => setActiveEntry("workspace")}
      onExport={() => {
        void exportRuntime();
      }}
      onOpenTextureAtlas={() => setActiveEntry("atlas")}
      onOpenValidate={() => setActiveEntry("validate")}
      state={taskState}
    />
  );
}

export function RuntimeExportTaskView({
  directoryAccess,
  exportStatus,
  onBack,
  onExport,
  onOpenTextureAtlas,
  onOpenValidate,
  state
}: RuntimeExportTaskViewProps) {
  const directoryUnavailableReason = formatRuntimeExportDirectoryAccessReason(directoryAccess);
  const exportDisabled =
    state.status !== "ready" ||
    !directoryAccess.supported ||
    exportStatus.status === "exporting";
  const actionLabel = exportStatus.status === "exporting" ? "Exporting" : "Export Runtime";

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-neutral-800 bg-[#111110]"
      data-runtime-export-state={state.status}
      data-testid="runtime-export-task-screen"
    >
      <header className="flex min-h-14 items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconButton
            className="size-8 shrink-0"
            label="Back to Authoring Workspace"
            onClick={onBack}
            tooltipSide="bottom"
          >
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
          </IconButton>
          <div className="h-6 w-px shrink-0 bg-neutral-800" />
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-emerald-700/70 bg-emerald-950/30 text-emerald-100">
            <Download aria-hidden="true" size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase text-neutral-500">
              Runtime Export
            </div>
            <h1 className="truncate text-sm font-semibold text-neutral-50">
              Directory Runtime Artifact
            </h1>
          </div>
        </div>
        <RuntimeExportActionButton
          dataTestId="runtime-export-action"
          disabled={exportDisabled}
          icon={<Download aria-hidden="true" size={15} strokeWidth={1.8} />}
          label={actionLabel}
          onClick={onExport}
          tone="emerald"
        />
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(22rem,1fr)_minmax(18rem,42%)] overflow-hidden xl:grid-cols-[minmax(0,1fr)_390px] xl:grid-rows-1">
        <main className="min-h-0 overflow-auto bg-[#131312] p-4">
          <div className="grid gap-4">
            <ReadinessPanel
              onOpenTextureAtlas={onOpenTextureAtlas}
              onOpenValidate={onOpenValidate}
              state={state}
            />
            <OutputPanel directoryUnavailableReason={directoryUnavailableReason} />
            <PreflightPanel state={state} />
            <ExportStatusMessage status={exportStatus} />
          </div>
        </main>
        <RuntimeExportSidebar
          onOpenValidate={onOpenValidate}
          state={state}
        />
      </div>
    </section>
  );
}

function ReadinessPanel({
  onOpenTextureAtlas,
  onOpenValidate,
  state
}: {
  readonly onOpenTextureAtlas: () => void;
  readonly onOpenValidate: () => void;
  readonly state: RuntimeExportTaskState;
}) {
  const blockedAction = state.status === "blocked" || state.status === "failed"
    ? state.primaryAction
    : null;

  return (
    <section
      className={cn(
        "rounded-md border px-4 py-4",
        state.status === "ready"
          ? "border-emerald-800/70 bg-emerald-950/20"
          : state.status === "checking"
            ? "border-neutral-800 bg-neutral-950/35"
            : "border-amber-700/70 bg-amber-950/20"
      )}
      data-testid="runtime-export-readiness"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={cn(
              "inline-flex min-h-6 items-center rounded border px-2 text-[11px] font-semibold uppercase",
              state.status === "ready"
                ? "border-emerald-700/70 bg-emerald-950/40 text-emerald-100"
                : state.status === "checking"
                  ? "border-neutral-700 bg-neutral-950 text-neutral-300"
                  : "border-amber-700/70 bg-amber-950/40 text-amber-100"
            )}
            data-testid="runtime-export-readiness-badge"
          >
            {state.status === "ready"
              ? "Ready"
              : state.status === "checking"
                ? "Checking"
                : "Blocked"}
          </div>
          <h2 className="mt-3 text-base font-semibold text-neutral-50">{state.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">{state.message}</p>
          <div className="mt-3 text-xs font-medium text-neutral-500">
            {formatRuntimeExportTargetSummaryLabel(state)}
          </div>
        </div>
        {blockedAction === null ? null : blockedAction === "textureAtlas" ? (
          <RuntimeExportActionButton
            dataTestId="runtime-export-open-atlas"
            icon={<LayoutGrid aria-hidden="true" size={15} strokeWidth={1.8} />}
            label="Open Texture Atlas"
            onClick={onOpenTextureAtlas}
            tone="teal"
          />
        ) : (
          <RuntimeExportActionButton
            dataTestId="runtime-export-open-validate"
            icon={<ShieldCheck aria-hidden="true" size={15} strokeWidth={1.8} />}
            label="Open Validate"
            onClick={onOpenValidate}
            tone="amber"
          />
        )}
      </div>
      {state.status !== "blocked" || state.blockers.length === 0 ? null : (
        <ul className="mt-4 divide-y divide-neutral-800 overflow-hidden rounded border border-neutral-800">
          {state.blockers.map((blocker) => (
            <li
              className="bg-neutral-950/35 px-3 py-2 text-xs"
              data-runtime-export-blocker-code={blocker.code}
              data-testid="runtime-export-blocker-row"
              key={`${blocker.code}:${blocker.targetPath}`}
            >
              <div className="font-semibold text-amber-100">{blocker.message}</div>
              <div className="mt-1 break-words font-mono text-[11px] text-neutral-500">
                {blocker.targetPath}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OutputPanel({
  directoryUnavailableReason
}: {
  readonly directoryUnavailableReason: string | null;
}) {
  return (
    <section className="rounded-md border border-neutral-800 bg-neutral-950/35 px-4 py-4">
      <h2 className="text-sm font-semibold text-neutral-100">Output</h2>
      <div className="mt-3 grid gap-2 text-xs text-neutral-300 sm:grid-cols-3">
        <FormatChip label="Directory export" />
        <FormatChip label="raw RGBA atlas page" />
        <FormatChip label="materialized runtime graph" />
      </div>
      {directoryUnavailableReason === null ? null : (
        <div
          className="mt-3 rounded border border-amber-700/70 bg-amber-950/25 px-3 py-2 text-xs font-semibold text-amber-100"
          data-testid="runtime-export-directory-unavailable"
        >
          {directoryUnavailableReason}
        </div>
      )}
    </section>
  );
}

function PreflightPanel({ state }: { readonly state: RuntimeExportTaskState }) {
  const rows = createRuntimeExportPreflightCheckRows(state);

  return (
    <section className="rounded-md border border-neutral-800 bg-neutral-950/35 px-4 py-4">
      <h2 className="text-sm font-semibold text-neutral-100">Preflight</h2>
      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <div
            className="grid gap-2 rounded border border-neutral-800 bg-neutral-950/45 px-3 py-2 text-xs sm:grid-cols-[9rem_6rem_minmax(0,1fr)]"
            data-runtime-export-check-status={row.status}
            data-testid="runtime-export-preflight-row"
            key={row.id}
          >
            <div className="font-semibold text-neutral-200">{row.label}</div>
            <div
              className={cn(
                "w-fit rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                row.status === "ready"
                  ? "border-emerald-800/70 bg-emerald-950/30 text-emerald-200"
                  : row.status === "blocked"
                    ? "border-amber-700/70 bg-amber-950/30 text-amber-100"
                    : "border-neutral-700 bg-neutral-900 text-neutral-400"
              )}
            >
              {row.status}
            </div>
            <div className="min-w-0 break-words text-neutral-400">{row.message}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RuntimeExportSidebar({
  onOpenValidate,
  state
}: {
  readonly onOpenValidate: () => void;
  readonly state: RuntimeExportTaskState;
}) {
  const summary = state.targetSummary;
  const validateWarningLabel = formatRuntimeExportValidateWarningLabel(state.warnings);
  const hasValidateWarnings = state.warnings.length > 0;

  return (
    <aside className="min-h-0 overflow-auto border-t border-neutral-800 bg-[#171716] xl:border-l xl:border-t-0">
      <section className="border-b border-neutral-800 p-3">
        <h2 className="text-xs font-semibold uppercase text-neutral-500">Target Summary</h2>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <SummaryMetric
            label="Included"
            testId="runtime-export-included-count"
            value={summary?.includedDrawableCount ?? 0}
          />
          <SummaryMetric
            label="Excluded"
            testId="runtime-export-excluded-count"
            value={summary?.excludedUnboundDrawableCount ?? 0}
          />
          <SummaryMetric
            label="Validate"
            testId="runtime-export-validate-warning-count"
            value={summary?.validateWarningCount ?? 0}
          />
        </dl>
        <dl className="mt-3 grid gap-1.5 text-xs">
          <InlineMetric label="Atlas page" value={state.atlasPageSizeLabel} />
          <InlineMetric label="Atlas pages" value={String(summary?.atlasPageCount ?? 0)} />
          <InlineMetric label="Texture pages" value={String(summary?.texturePageCount ?? 0)} />
          <InlineMetric label="Excluded reason" value="Drawable Pool entries are not exported" />
        </dl>
        <div
          className={cn(
            "mt-3 rounded border px-3 py-2 text-xs font-semibold",
            hasValidateWarnings
              ? "border-amber-700/70 bg-amber-950/25 text-amber-100"
              : "border-neutral-800 bg-neutral-950/45 text-neutral-500"
          )}
          data-testid="runtime-export-validate-warning"
        >
          <div className="flex items-start gap-2">
            {hasValidateWarnings ? (
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-amber-300"
                size={14}
                strokeWidth={1.9}
              />
            ) : (
              <CheckCircle2
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-neutral-500"
                size={14}
                strokeWidth={1.9}
              />
            )}
            <div className="min-w-0">
              <div>{validateWarningLabel}</div>
              {hasValidateWarnings ? (
                <button
                  className="mt-2 inline-flex h-7 items-center gap-2 rounded border border-amber-700/70 bg-amber-950/35 px-2 text-xs font-semibold text-amber-100 transition hover:border-amber-400"
                  data-testid="runtime-export-warning-open-validate"
                  onClick={onOpenValidate}
                  type="button"
                >
                  <ShieldCheck aria-hidden="true" size={13} strokeWidth={1.8} />
                  <span>Open Validate</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="p-3">
        <h2 className="text-xs font-semibold uppercase text-neutral-500">Format</h2>
        <dl className="mt-3 grid gap-1.5 text-xs">
          <InlineMetric label="Manifest" value="runtime-export.json" />
          <InlineMetric label="Model" value="runtime/model.json" />
          <InlineMetric label="Atlas" value="runtime/atlas.json" />
          <InlineMetric label="Texture" value="assets/textures/atlas_page_0.raw-rgba" />
          <InlineMetric label="v0 scope" value="Directory only, single atlas page" />
        </dl>
      </section>
    </aside>
  );
}

function SummaryMetric({
  label,
  testId,
  value
}: {
  readonly label: string;
  readonly testId: string;
  readonly value: number;
}) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/45 px-2 py-2">
      <dt className="text-[10px] font-semibold uppercase text-neutral-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-neutral-100" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function InlineMetric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="grid grid-cols-[7.25rem_1fr] gap-2 border-b border-neutral-900 py-1">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-neutral-200">{value}</dd>
    </div>
  );
}

function FormatChip({ label }: { readonly label: string }) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/45 px-2.5 py-2 font-semibold text-neutral-200">
      {label}
    </div>
  );
}

function ExportStatusMessage({ status }: { readonly status: RuntimeExportWriteStatus }) {
  if (status.status === "idle") {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded border px-4 py-3 text-sm font-semibold",
        status.status === "exported"
          ? "border-emerald-700/70 bg-emerald-950/30 text-emerald-100"
          : status.status === "exporting"
            ? "border-neutral-700 bg-neutral-950/50 text-neutral-300"
            : "border-rose-700/70 bg-rose-950/30 text-rose-100"
      )}
      data-testid="runtime-export-status"
    >
      {status.status === "exporting" ? "Writing Runtime Export directory." : status.message}
    </div>
  );
}

function RuntimeExportActionButton({
  dataTestId,
  disabled,
  icon,
  label,
  onClick,
  tone
}: {
  readonly dataTestId: string;
  readonly disabled?: boolean;
  readonly icon: ReactNode;
  readonly label: string;
  readonly onClick: () => void;
  readonly tone: "amber" | "emerald" | "teal";
}) {
  return (
    <button
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-2 rounded border px-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600",
        tone === "emerald"
          ? "border-emerald-700/70 bg-emerald-950/40 text-emerald-100 hover:border-emerald-400"
          : tone === "teal"
            ? "border-teal-700/70 bg-teal-950/40 text-teal-100 hover:border-teal-400"
            : "border-amber-700/70 bg-amber-950/40 text-amber-100 hover:border-amber-400"
      )}
      data-testid={dataTestId}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
