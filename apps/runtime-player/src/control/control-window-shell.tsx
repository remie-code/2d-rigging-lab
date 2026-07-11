import type { ReactElement, ReactNode } from "react";
import { Crosshair, FolderOpen, Monitor } from "lucide-react";

import { IconTextButton, StatusPill } from "./control-window-components";
import type { RuntimePlayerHostRoleIdentity } from "../preload/runtime-player-bridge-contract";

/**
 * Display-only accent styling per role id. Text + colour double-encoding
 * (c1-role-skeleton §7.2): the label carries the meaning, the colour helps in
 * peripheral vision. This is a static style lookup, not a behavioural branch.
 */
const roleBadgeAccentClassName: Record<
  RuntimePlayerHostRoleIdentity["id"],
  string
> = {
  trackingHost: "border-teal-500/60 bg-teal-950/60 text-teal-200",
  autonomousHost: "border-violet-500/60 bg-violet-950/60 text-violet-200"
};

export function ControlWindowRoleBadge({
  role
}: {
  readonly role: RuntimePlayerHostRoleIdentity;
}): ReactElement {
  return (
    <span
      className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${roleBadgeAccentClassName[role.id]}`}
    >
      {role.label}
    </span>
  );
}

export type ControlWindowPage =
  | "overview"
  | "live-controller"
  | "input"
  | "mapping"
  | "dynamics-tune"
  | "physiology"
  | "stage"
  | "performance-diagnostics";

const controlWindowPages: readonly {
  readonly id: ControlWindowPage;
  readonly label: string;
}[] = [
  { id: "overview", label: "Overview" },
  { id: "live-controller", label: "Live Controller" },
  { id: "input", label: "Input" },
  { id: "mapping", label: "Mapping" },
  { id: "dynamics-tune", label: "Dynamics Tune" },
  { id: "physiology", label: "Physiology" },
  { id: "stage", label: "Stage" },
  { id: "performance-diagnostics", label: "Performance Diagnostics" }
];

export function ControlWindowShell({
  activePage,
  children,
  role = null,
  runtimeExportLabel,
  runtimeExportTone,
  inputLabel,
  inputTone,
  profileLabel,
  profileTone,
  liveLabel,
  onSelectPage,
  onOpenRuntimeExport,
  onLookForward,
  onFocusStage,
  lookForwardDisabled,
  runtimeExportBusy
}: {
  readonly activePage: ControlWindowPage;
  readonly children: ReactNode;
  readonly role?: RuntimePlayerHostRoleIdentity | null;
  readonly runtimeExportLabel: string;
  readonly runtimeExportTone: "amber" | "teal" | "red";
  readonly inputLabel: string;
  readonly inputTone: "amber" | "teal" | "red";
  readonly profileLabel: string;
  readonly profileTone: "amber" | "teal" | "red";
  readonly liveLabel: string;
  readonly onSelectPage: (page: ControlWindowPage) => void;
  readonly onOpenRuntimeExport: () => void;
  readonly onLookForward: () => void;
  readonly onFocusStage: () => void;
  readonly lookForwardDisabled: boolean;
  readonly runtimeExportBusy: boolean;
}): ReactElement {
  return (
    <main className="min-h-screen bg-[#101214] text-neutral-100">
      <header className="border-b border-neutral-800 bg-[#151716] px-5 py-4">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {role === null ? null : <ControlWindowRoleBadge role={role} />}
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-teal-600/60 bg-teal-950/50 text-teal-100">
              <Monitor aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-neutral-50">
                Runtime Player
              </h1>
              <div className="mt-1 flex flex-wrap gap-2">
                <StatusPill tone={runtimeExportTone}>
                  Model {runtimeExportLabel}
                </StatusPill>
                <StatusPill tone={inputTone}>{inputLabel}</StatusPill>
                <StatusPill tone={profileTone}>{profileLabel}</StatusPill>
                <StatusPill tone="neutral">Live {liveLabel}</StatusPill>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <IconTextButton
              icon={FolderOpen}
              label={runtimeExportBusy ? "Opening" : "Open Export"}
              onClick={onOpenRuntimeExport}
              variant="primary"
              disabled={runtimeExportBusy}
            />
            <IconTextButton
              icon={Crosshair}
              label="Look Forward"
              onClick={onLookForward}
              variant="secondary"
              disabled={lookForwardDisabled}
            />
            <IconTextButton
              icon={Monitor}
              label="Focus Stage"
              onClick={onFocusStage}
              variant="ghost"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav className="flex gap-2 overflow-auto lg:block lg:overflow-visible">
          {controlWindowPages.map((page) => (
            <button
              type="button"
              key={page.id}
              onClick={() => onSelectPage(page.id)}
              className={`min-h-10 shrink-0 rounded-md border px-3 text-left text-sm font-semibold transition lg:mb-2 lg:w-full ${
                activePage === page.id
                  ? "border-teal-500 bg-teal-950/45 text-teal-100"
                  : "border-neutral-800 bg-[#151716] text-neutral-300 hover:border-neutral-600 hover:text-neutral-50"
              }`}
            >
              {page.label}
            </button>
          ))}
        </nav>
        <div className="grid min-w-0 gap-4">{children}</div>
      </div>
    </main>
  );
}
