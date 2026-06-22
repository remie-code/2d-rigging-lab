import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  AlertTriangle,
  Bug,
  Crosshair,
  FolderOpen,
  Loader2,
  Monitor,
  Plug,
  RotateCcw,
  Settings,
  Unplug,
  WifiOff
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type {
  RuntimePlayerPlaceholderAction,
  RuntimePlayerStartupStatus
} from "../preload/runtime-player-bridge-contract";
import type {
  RuntimeExportOpenDirectoryResult,
  RuntimeExportStatus
} from "../preload/runtime-export-bridge-contract";

const pendingStatusLabel = "Checking Runtime Player shell";

type ControlFeedback = {
  readonly message: string;
  readonly tone: "neutral" | "success" | "error";
};

export function ControlWindowApp(): ReactElement {
  const [startupStatus, setStartupStatus] =
    useState<RuntimePlayerStartupStatus | null>(null);
  const [runtimeExportStatus, setRuntimeExportStatus] =
    useState<RuntimeExportStatus | null>(null);
  const [feedback, setFeedback] = useState<ControlFeedback | null>(null);

  useEffect(() => {
    let active = true;

    window.runtimePlayer.getStartupStatus().then((status) => {
      if (active) {
        setStartupStatus(status);
        setRuntimeExportStatus(status.runtimeExport);
      }
    });

    window.runtimePlayer.runtimeExport.getStatus().then((status) => {
      if (active) {
        setRuntimeExportStatus(status);
      }
    });

    const unsubscribeRuntimeExport =
      window.runtimePlayer.runtimeExport.onStatusChanged((status) => {
        if (active) {
          setRuntimeExportStatus(status);
        }
      });

    return () => {
      active = false;
      unsubscribeRuntimeExport();
    };
  }, []);

  async function runPlaceholderAction(
    action: RuntimePlayerPlaceholderAction
  ): Promise<void> {
    const result =
      action === "focus-stage"
        ? await window.runtimePlayer.focusStage()
        : action === "reset-stage-position"
          ? await window.runtimePlayer.resetStagePosition()
          : await window.runtimePlayer.performPlaceholderAction(action);

    setFeedback({
      message: result.message,
      tone: "neutral"
    });
  }

  async function openRuntimeExportDirectory(): Promise<void> {
    const result = await window.runtimePlayer.runtimeExport.openDirectory();

    setFeedback(createRuntimeExportFeedback(result));
  }

  const runtimeExportStatusLabel =
    runtimeExportStatus?.statusLabel ?? pendingStatusLabel;
  const inputStatus =
    startupStatus?.input.connectionState === "not-connected"
      ? "Not connected"
      : "Checking";
  const stageStatus =
    startupStatus?.stage.windowState === "created" ? "Created" : "Checking";
  const loadedRuntimeExport = runtimeExportStatus?.status === "loaded"
    ? runtimeExportStatus
    : null;
  const erroredRuntimeExport = runtimeExportStatus?.status === "error"
    ? runtimeExportStatus
    : null;
  const runtimeExportDirectory = getRuntimeExportDirectoryLabel(runtimeExportStatus);
  const runtimeExportLoadedLabel = getRuntimeExportLoadedLabel(runtimeExportStatus);
  const runtimeExportTone = runtimeExportStatus?.status === "loaded"
    ? "teal"
    : runtimeExportStatus?.status === "error"
      ? "red"
      : "amber";

  return (
    <main className="min-h-screen bg-[#101214] text-neutral-100">
      <header className="flex min-h-16 items-center gap-4 border-b border-neutral-800 bg-[#151716] px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-teal-600/60 bg-teal-950/50 text-teal-100">
            <Monitor aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-neutral-50">
              Runtime Player
            </h1>
            <p className="truncate text-xs text-neutral-400">
              Runtime Export: {runtimeExportStatusLabel}
            </p>
          </div>
        </div>
        <StatusPill tone="amber">{inputStatus}</StatusPill>
        <StatusPill tone={runtimeExportTone}>
          {runtimeExportLoadedLabel}
        </StatusPill>
        <StatusPill tone="teal">Stage {stageStatus}</StatusPill>
        <IconTextButton
          icon={Settings}
          label="Settings"
          onClick={() => void runPlaceholderAction("open-settings")}
          variant="ghost"
        />
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-5">
        <section className="grid gap-4 rounded-md border border-neutral-800 bg-[#181a19] p-5 shadow-2xl shadow-black/20 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="flex min-w-0 flex-col justify-center">
            <p className="text-xs font-semibold uppercase text-teal-300">
              Open Runtime Export
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal text-neutral-50">
              Open Runtime Export
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">
              Select a directory containing{" "}
              <span className="font-semibold">runtime-export.json</span>{" "}
              generated by the Editor.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <IconTextButton
                icon={runtimeExportStatus?.status === "loading" ? Loader2 : FolderOpen}
                label={
                  runtimeExportStatus?.status === "loaded"
                    ? "Open Different Export"
                    : runtimeExportStatus?.status === "loading"
                      ? "Opening Runtime Export"
                      : "Open Runtime Export"
                }
                onClick={() => void openRuntimeExportDirectory()}
                variant="primary"
                disabled={runtimeExportStatus?.status === "loading"}
              />
              <span className="text-xs text-neutral-500">
                Previous export restore is reserved for a later wave.
              </span>
            </div>
          </div>
          <div className="grid content-center gap-3 rounded-md border border-neutral-800 bg-[#111312] p-4">
            <StatusRow label="Runtime Export" value={runtimeExportStatusLabel} />
            <StatusRow label="Directory" value={runtimeExportDirectory} />
            <StatusRow label="Stage Window" value={stageStatus} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Runtime Export Status">
            <StatusRow label="Loaded" value={runtimeExportLoadedLabel} />
            <StatusRow label="Directory" value={runtimeExportDirectory} />
            <StatusRow
              label="Mode"
              value={
                loadedRuntimeExport
                  ? "Validated Runtime Export v0"
                  : "Waiting for Runtime Export"
              }
            />
            {loadedRuntimeExport ? (
              <>
                <StatusRow
                  label="Model"
                  value={loadedRuntimeExport.summary.modelDisplayName}
                />
                <StatusRow
                  label="Texture"
                  value={`${loadedRuntimeExport.summary.texturePage.width} x ${loadedRuntimeExport.summary.texturePage.height}`}
                />
                <StatusRow
                  label="Drawables"
                  value={`${loadedRuntimeExport.summary.drawableCount} drawables / ${loadedRuntimeExport.summary.meshCount} meshes`}
                />
              </>
            ) : null}
            {erroredRuntimeExport ? (
              <ErrorNotice
                title={erroredRuntimeExport.error.message}
                details={erroredRuntimeExport.error.details}
              />
            ) : null}
          </Panel>

          <Panel title="Input Source">
            <StatusRow label="Source" value="iFacialMocap" />
            <StatusRow label="Transport" value="UDP" />
            <StatusRow label="Receive port" value="49983" />
            <div className="mt-4 flex flex-wrap gap-2">
              <IconTextButton
                icon={Plug}
                label="Connect"
                onClick={() => void runPlaceholderAction("connect-input")}
                variant="secondary"
              />
              <IconTextButton
                icon={Unplug}
                label="Disconnect"
                onClick={() => void runPlaceholderAction("disconnect-input")}
                variant="ghost"
              />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
              <WifiOff aria-hidden="true" className="size-4 text-amber-300" />
              Network receive is not active in this wave.
            </div>
          </Panel>

          <Panel title="Calibration">
            <StatusRow label="Look direction" value="Not calibrated" />
            <StatusRow label="Tracking" value="Not connected" />
            <div className="mt-4">
              <IconTextButton
                icon={Crosshair}
                label="Look Forward"
                onClick={() => void runPlaceholderAction("look-forward")}
                variant="secondary"
              />
            </div>
          </Panel>

          <Panel title="Stage">
            <StatusRow label="Window" value={stageStatus} />
            <StatusRow label="Transparent" value="On" />
            <StatusRow label="Capture target" value="Stage Window" />
            <div className="mt-4 flex flex-wrap gap-2">
              <IconTextButton
                icon={Monitor}
                label="Focus Stage"
                onClick={() => void runPlaceholderAction("focus-stage")}
                variant="secondary"
              />
              <IconTextButton
                icon={RotateCcw}
                label="Reset Stage Position"
                onClick={() =>
                  void runPlaceholderAction("reset-stage-position")
                }
                variant="ghost"
              />
            </div>
          </Panel>
        </section>

        <section className="flex flex-col gap-3 rounded-md border border-neutral-800 bg-[#151716] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-100">
              Debug
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Developer diagnostics placeholder.
            </p>
          </div>
          <IconTextButton
            icon={Bug}
            label="Debug"
            onClick={() => void runPlaceholderAction("open-debug")}
            variant="ghost"
          />
        </section>

        <div
          aria-live="polite"
          className={`min-h-10 rounded-md border px-4 py-3 text-sm ${getFeedbackClass(feedback?.tone ?? "neutral")}`}
        >
          {feedback
            ? feedback.message
            : "Runtime Player Wave1 shell is ready."}
        </div>
      </div>
    </main>
  );
}

function createRuntimeExportFeedback(
  result: RuntimeExportOpenDirectoryResult
): ControlFeedback {
  if (result.result === "canceled") {
    return {
      message: "Runtime Export selection canceled.",
      tone: "neutral"
    };
  }

  if (result.result === "loaded") {
    return {
      message: `Runtime Export loaded: ${result.runtimeExport.summary.modelDisplayName}`,
      tone: "success"
    };
  }

  return {
    message: result.runtimeExport.error.message,
    tone: "error"
  };
}

function getRuntimeExportDirectoryLabel(
  status: RuntimeExportStatus | null
): string {
  if (
    status?.status === "loaded" ||
    status?.status === "loading" ||
    status?.status === "error"
  ) {
    return status.directoryPath;
  }

  return "None selected";
}

function getRuntimeExportLoadedLabel(
  status: RuntimeExportStatus | null
): string {
  if (status?.status === "loaded") {
    return "Loaded";
  }

  if (status?.status === "loading") {
    return "Loading";
  }

  if (status?.status === "error") {
    return "Error";
  }

  return "No";
}

function getFeedbackClass(tone: ControlFeedback["tone"]): string {
  if (tone === "success") {
    return "border-teal-800 bg-teal-950/35 text-teal-100";
  }

  if (tone === "error") {
    return "border-red-900 bg-red-950/30 text-red-100";
  }

  return "border-neutral-800 bg-[#111312] text-neutral-300";
}

function Panel({
  title,
  children
}: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <section className="rounded-md border border-neutral-800 bg-[#151716] p-4">
      <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>
      <div className="mt-4 grid gap-2">{children}</div>
    </section>
  );
}

function StatusRow({
  label,
  value
}: {
  readonly label: string;
  readonly value: string;
}): ReactElement {
  return (
    <div className="grid grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] gap-3 text-sm">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 truncate font-medium text-neutral-100">{value}</dd>
    </div>
  );
}

function ErrorNotice({
  title,
  details
}: {
  readonly title: string;
  readonly details: readonly string[];
}): ReactElement {
  return (
    <div className="mt-2 rounded-md border border-red-900 bg-red-950/25 p-3 text-sm text-red-100">
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          {details.length > 0 ? (
            <ul className="mt-2 grid gap-1 text-xs text-red-200/80">
              {details.slice(0, 3).map((detail) => (
                <li key={detail} className="break-words">
                  {detail}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  children,
  tone
}: {
  readonly children: ReactNode;
  readonly tone: "amber" | "teal" | "red";
}): ReactElement {
  const toneClass =
    tone === "teal"
      ? "border-teal-700/60 bg-teal-950/40 text-teal-100"
      : tone === "red"
        ? "border-red-800/70 bg-red-950/40 text-red-100"
      : "border-amber-700/60 bg-amber-950/40 text-amber-100";

  return (
    <span
      className={`hidden shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold sm:inline-flex ${toneClass}`}
    >
      {children}
    </span>
  );
}

function IconTextButton({
  icon: Icon,
  label,
  onClick,
  variant,
  disabled = false
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onClick: () => void;
  readonly variant: "primary" | "secondary" | "ghost";
  readonly disabled?: boolean;
}): ReactElement {
  const variantClass =
    variant === "primary"
      ? "border-teal-500 bg-teal-500 text-neutral-950 hover:bg-teal-400"
      : variant === "secondary"
        ? "border-neutral-700 bg-neutral-900 text-neutral-100 hover:border-teal-500/70 hover:text-teal-100"
        : "border-neutral-800 bg-transparent text-neutral-300 hover:border-neutral-600 hover:text-neutral-50";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={disabled}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClass}`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}
