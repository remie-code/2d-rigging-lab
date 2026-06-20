import {
  ChevronDown,
  Download,
  FileInput,
  FolderOpen,
  FolderPlus,
  PanelLeft,
  Redo2,
  Save,
  SaveAll,
  Undo2
} from "lucide-react";
import { useMemo, useRef, type ChangeEvent, type MutableRefObject, type ReactNode } from "react";

import { StatusBadge } from "../components/status-badge";
import { useEditorSession } from "../features/editor-session/editor-session-context";
import { createEditorDiagnosticsProjection } from "../features/editor-session/model/editor-diagnostics-state";
import { isWorkspaceStorageBusy } from "../features/workspace-storage/model/workspace-storage-state";
import { cn } from "../lib/class-name";
import { useEditorUiStore } from "../state/editor-ui-store";
import { IconButton } from "../ui/icon-button";
import { DiagnosticsWarningBadge } from "./diagnostics/diagnostics-warning-badge";

export function AppBar() {
  const surfaceLabel = useEditorUiStore((state) => state.surfaceLabel);
  const activeEntry = useEditorUiStore((state) => state.activeEntry);
  const {
    canRedo,
    canUndo,
    createWorkspace,
    exportPortableProject,
    hasOpenWorkspace,
    openProjectFile,
    projectStorage,
    redo,
    saveProject,
    saveWorkspaceAs,
    session,
    openWorkspace,
    undo,
    workspaceIdentityLabel,
    workspaceSaveStatusLabel,
    workspaceStorage
  } = useEditorSession();
  const openProjectInputRef = useRef<HTMLInputElement | null>(null);
  const storageBusy =
    isWorkspaceStorageBusy(workspaceStorage) ||
    projectStorage.status === "loading" ||
    projectStorage.status === "saving";
  const workspaceUnsupported = workspaceStorage.status === "unsupported";
  const workspaceModeLabel =
    activeEntry === "viewer" ? "Viewer / Runtime View" : "Authoring Workspace";
  const diagnosticsWarningCount = useMemo(
    () => createEditorDiagnosticsProjection(session).warningItemCount,
    [session]
  );
  const showDiagnosticsBadge = activeEntry !== "viewer" && diagnosticsWarningCount > 0;

  const handleOpenProjectFile = createOpenProjectFileChangeHandler(openProjectFile);

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-neutral-800 bg-[#151514] px-4">
      <div className="flex min-w-0 shrink-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-teal-700/60 bg-teal-950/40 text-teal-100">
          <PanelLeft aria-hidden="true" size={19} strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-neutral-50">
            Private 2D Rigging Lab
          </div>
          <div className="truncate text-xs text-neutral-400">{workspaceModeLabel}</div>
        </div>
      </div>

      {!hasOpenWorkspace ? (
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
          <input
            accept="application/json,.json"
            aria-label="Import Portable JSON file"
            className="sr-only"
            onChange={handleOpenProjectFile}
            ref={openProjectInputRef}
            type="file"
          />
          <WorkspaceActionButton
            disabled={storageBusy || workspaceUnsupported}
            icon={<FolderPlus aria-hidden="true" size={15} strokeWidth={1.8} />}
            label="Create Workspace"
            onClick={() => {
              void createWorkspace();
            }}
          />
          <WorkspaceActionButton
            disabled={storageBusy || workspaceUnsupported}
            icon={<FolderOpen aria-hidden="true" size={15} strokeWidth={1.8} />}
            label="Open Workspace"
            onClick={() => {
              void openWorkspace();
            }}
          />
          <WorkspaceActionButton
            disabled={storageBusy}
            icon={<FileInput aria-hidden="true" size={15} strokeWidth={1.8} />}
            label="Import Portable JSON"
            onClick={() => openProjectInputRef.current?.click()}
          />
        </div>
      ) : (
        <>
          <div className="ml-auto hidden min-w-0 shrink-0 items-center gap-2 md:flex">
            <StatusBadge tone="ready">{workspaceIdentityLabel}</StatusBadge>
            <StatusBadge tone={workspaceSaveStatusLabel === "Saved" ? "ready" : "neutral"}>
              {workspaceSaveStatusLabel}
            </StatusBadge>
            {showDiagnosticsBadge ? (
              <span className="relative">
                <StatusBadge tone="neutral">Validate</StatusBadge>
                <DiagnosticsWarningBadge
                  className="absolute -right-2 -top-2"
                  count={diagnosticsWarningCount}
                />
              </span>
            ) : null}
            <StatusBadge tone="neutral">{surfaceLabel}</StatusBadge>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <IconButton
              className="disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 disabled:hover:border-neutral-800 disabled:hover:bg-neutral-950 disabled:hover:text-neutral-600"
              disabled={!canUndo}
              label="Undo"
              onClick={undo}
              tooltipSide="bottom"
            >
              <Undo2 aria-hidden="true" size={18} strokeWidth={1.8} />
            </IconButton>
            <IconButton
              className="disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600 disabled:hover:border-neutral-800 disabled:hover:bg-neutral-950 disabled:hover:text-neutral-600"
              disabled={!canRedo}
              label="Redo"
              onClick={redo}
              tooltipSide="bottom"
            >
              <Redo2 aria-hidden="true" size={18} strokeWidth={1.8} />
            </IconButton>
            <IconButton
              disabled={storageBusy}
              label="Save Workspace"
              onClick={() => {
                void saveProject();
              }}
              tooltipSide="bottom"
            >
              <Save aria-hidden="true" size={18} strokeWidth={1.8} />
            </IconButton>
            <WorkspaceMenu
              busy={storageBusy}
              createWorkspace={createWorkspace}
              exportPortableProject={exportPortableProject}
              importInputRef={openProjectInputRef}
              onImportFileChange={handleOpenProjectFile}
              openWorkspace={openWorkspace}
              saveProject={saveProject}
              saveWorkspaceAs={saveWorkspaceAs}
            />
          </div>
        </>
      )}
    </header>
  );
}

export const createOpenProjectFileChangeHandler =
  (openProjectFile: (file: File) => Promise<void>) =>
  (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file === undefined) {
      return;
    }

    void openProjectFile(file);
  };

function WorkspaceMenu({
  busy,
  createWorkspace,
  exportPortableProject,
  importInputRef,
  onImportFileChange,
  openWorkspace,
  saveProject,
  saveWorkspaceAs
}: {
  readonly busy: boolean;
  readonly createWorkspace: () => Promise<void>;
  readonly exportPortableProject: () => Promise<void>;
  readonly importInputRef: MutableRefObject<HTMLInputElement | null>;
  readonly onImportFileChange: ReturnType<typeof createOpenProjectFileChangeHandler>;
  readonly openWorkspace: () => Promise<void>;
  readonly saveProject: () => Promise<void>;
  readonly saveWorkspaceAs: () => Promise<void>;
}) {
  return (
    <details className="relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950 px-2.5 text-xs font-semibold text-neutral-200 transition hover:border-amber-500/70 hover:text-amber-100">
        <span>Workspace</span>
        <ChevronDown aria-hidden="true" size={15} strokeWidth={1.8} />
      </summary>
      <div className="absolute right-0 z-20 mt-2 grid w-56 gap-1 rounded-md border border-neutral-800 bg-[#151514] p-2 shadow-xl">
        <input
          accept="application/json,.json"
          aria-label="Import Portable JSON file"
          className="sr-only"
          onChange={onImportFileChange}
          ref={importInputRef}
          type="file"
        />
        <WorkspaceMenuButton
          disabled={busy}
          icon={<Save aria-hidden="true" size={15} strokeWidth={1.8} />}
          label="Save"
          onClick={() => {
            void saveProject();
          }}
        />
        <WorkspaceMenuButton
          disabled={busy}
          icon={<SaveAll aria-hidden="true" size={15} strokeWidth={1.8} />}
          label="Save As..."
          onClick={() => {
            void saveWorkspaceAs();
          }}
        />
        <WorkspaceMenuButton
          disabled={busy}
          icon={<FolderOpen aria-hidden="true" size={15} strokeWidth={1.8} />}
          label="Open Workspace..."
          onClick={() => {
            void openWorkspace();
          }}
        />
        <WorkspaceMenuButton
          disabled={busy}
          icon={<FolderPlus aria-hidden="true" size={15} strokeWidth={1.8} />}
          label="Create Workspace..."
          onClick={() => {
            void createWorkspace();
          }}
        />
        <div className="my-1 h-px bg-neutral-800" />
        <WorkspaceMenuButton
          disabled={busy}
          icon={<Download aria-hidden="true" size={15} strokeWidth={1.8} />}
          label="Export Portable JSON..."
          onClick={() => {
            void exportPortableProject();
          }}
        />
        <WorkspaceMenuButton
          disabled={busy}
          icon={<FileInput aria-hidden="true" size={15} strokeWidth={1.8} />}
          label="Import Portable JSON..."
          onClick={() => importInputRef.current?.click()}
        />
      </div>
    </details>
  );
}

function WorkspaceActionButton({
  disabled,
  icon,
  label,
  onClick
}: {
  readonly disabled?: boolean;
  readonly icon: ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-teal-700/70 bg-teal-950/35 px-2.5 text-xs font-semibold text-teal-100 transition hover:border-teal-400",
        "disabled:cursor-not-allowed disabled:border-neutral-800 disabled:bg-neutral-950 disabled:text-neutral-600"
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function WorkspaceMenuButton({
  disabled,
  icon,
  label,
  onClick
}: {
  readonly disabled?: boolean;
  readonly icon: ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      className="inline-flex h-8 items-center gap-2 rounded px-2 text-left text-xs font-medium text-neutral-200 transition hover:bg-neutral-800/80 hover:text-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-600 disabled:hover:bg-transparent"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
