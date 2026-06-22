import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Crosshair,
  FolderOpen,
  Loader2,
  Monitor,
  Plug,
  RotateCcw,
  Settings,
  Unplug
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  InputDiagnosticsPanel,
  type InputDiagnosticsCopyState
} from "./input-diagnostics-panel";
import type {
  RuntimePlayerPlaceholderAction,
  RuntimePlayerStageViewStatus,
  RuntimePlayerStartupStatus
} from "../preload/runtime-player-bridge-contract";
import type {
  RuntimePlayerInputDiagnosticsSnapshot,
  RuntimePlayerInputStatus
} from "../preload/input-bridge-contract";
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
  const [inputSourceStatus, setInputSourceStatus] =
    useState<RuntimePlayerInputStatus | null>(null);
  const [inputDiagnostics, setInputDiagnostics] =
    useState<RuntimePlayerInputDiagnosticsSnapshot | null>(null);
  const [stageViewStatus, setStageViewStatus] =
    useState<RuntimePlayerStageViewStatus | null>(null);
  const [feedback, setFeedback] = useState<ControlFeedback | null>(null);
  const [receivePortInput, setReceivePortInput] = useState("49983");
  const [iphoneHostInput, setIphoneHostInput] = useState("");
  const [inputBusy, setInputBusy] = useState(false);
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(false);
  const [copyDiagnosticsState, setCopyDiagnosticsState] =
    useState<InputDiagnosticsCopyState>("idle");

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
    window.runtimePlayer.stageView.getStatus().then((status) => {
      if (active) {
        setStageViewStatus(status);
      }
    });
    window.runtimePlayer.input.getStatus().then((status) => {
      if (active) {
        setInputSourceStatus(status);
        setInputDiagnostics(status.diagnostics);
        setReceivePortInput(String(status.receivePort));
        setIphoneHostInput(status.iphoneHost ?? "");
      }
    });
    window.runtimePlayer.input.getDiagnostics().then((diagnostics) => {
      if (active) {
        setInputDiagnostics(diagnostics);
      }
    });

    const unsubscribeRuntimeExport =
      window.runtimePlayer.runtimeExport.onStatusChanged((status) => {
        if (active) {
          setRuntimeExportStatus(status);
        }
      });
    const unsubscribeStageView =
      window.runtimePlayer.stageView.onStatusChanged((status) => {
        if (active) {
          setStageViewStatus(status);
        }
      });
    const unsubscribeInputStatus =
      window.runtimePlayer.input.onStatusChanged((status) => {
        if (active) {
          setInputSourceStatus(status);
          setInputDiagnostics(status.diagnostics);
        }
      });
    const unsubscribeInputDiagnostics =
      window.runtimePlayer.input.onDiagnosticsChanged((diagnostics) => {
        if (active) {
          setInputDiagnostics(diagnostics);
        }
      });

    return () => {
      active = false;
      unsubscribeRuntimeExport();
      unsubscribeStageView();
      unsubscribeInputStatus();
      unsubscribeInputDiagnostics();
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

  async function connectInputSource(): Promise<void> {
    const receivePort = parseReceivePortInput(receivePortInput);

    if (receivePort === null) {
      setFeedback({
        message: "Receive port must be an integer from 1 to 65535.",
        tone: "error"
      });
      return;
    }

    setInputBusy(true);
    setFeedback(null);

    try {
      const status = await window.runtimePlayer.input.connect({
        receivePort,
        iphoneHost: iphoneHostInput.trim()
      });
      setInputSourceStatus(status);
      setInputDiagnostics(status.diagnostics);
      setFeedback({
        message: getInputConnectFeedback(status),
        tone: status.connectionState === "error" ? "error" : "success"
      });
    } catch (error) {
      setFeedback({
        message: getErrorMessage(error),
        tone: "error"
      });
    } finally {
      setInputBusy(false);
    }
  }

  async function disconnectInputSource(): Promise<void> {
    setInputBusy(true);
    setFeedback(null);

    try {
      const status = await window.runtimePlayer.input.disconnect();
      setInputSourceStatus(status);
      setInputDiagnostics(status.diagnostics);
      setFeedback({
        message: "Input receiver stopped.",
        tone: "neutral"
      });
    } catch (error) {
      setFeedback({
        message: getErrorMessage(error),
        tone: "error"
      });
    } finally {
      setInputBusy(false);
    }
  }

  async function copyInputDiagnostics(): Promise<void> {
    try {
      const payload = await window.runtimePlayer.input.copyDiagnostics();
      await writeClipboardText(JSON.stringify(payload, null, 2));
      setCopyDiagnosticsState("copied");
      setFeedback({
        message: "Input diagnostics copied.",
        tone: "success"
      });
    } catch (error) {
      setCopyDiagnosticsState("error");
      setFeedback({
        message: getErrorMessage(error),
        tone: "error"
      });
    }
  }

  const runtimeExportStatusLabel =
    runtimeExportStatus?.statusLabel ?? pendingStatusLabel;
  const stageWindowStatus =
    startupStatus?.stage.windowState === "created" ? "Created" : "Checking";
  const stageViewStatusLabel =
    stageViewStatus?.statusLabel ?? "Checking Stage";
  const stageViewStatusMessage =
    stageViewStatus?.message ?? "Checking Stage render status.";
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
  const inputActive = isInputReceiverActive(inputSourceStatus);
  const inputDisconnectEnabled =
    inputSourceStatus !== null && inputSourceStatus.connectionState !== "idle";

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
        <StatusPill tone={getInputStatusPillTone(inputSourceStatus)}>
          {getInputStatusPillLabel(inputSourceStatus)}
        </StatusPill>
        <StatusPill tone={runtimeExportTone}>
          {runtimeExportLoadedLabel}
        </StatusPill>
        <StatusPill tone={getStageViewPillTone(stageViewStatus)}>
          Stage {getStageViewPillLabel(stageViewStatus, stageWindowStatus)}
        </StatusPill>
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
            <StatusRow label="Stage Window" value={stageWindowStatus} />
            <StatusRow label="Stage Render" value={stageViewStatusLabel} />
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
            <StatusRow
              label="Connection"
              value={getInputConnectionLabel(inputSourceStatus)}
            />
            <StatusRow
              label="Local IP"
              value={formatInputLocalIps(inputSourceStatus)}
            />
            <StatusRow
              label="Remote"
              value={formatInputRemote(inputSourceStatus)}
            />
            <StatusRow label="FPS" value={formatInputFps(inputSourceStatus)} />
            <StatusRow
              label="Last packet"
              value={formatInputLastPacket(inputSourceStatus)}
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-semibold text-neutral-500">
                  Receive port
                </span>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={receivePortInput}
                  onChange={(event) => setReceivePortInput(event.target.value)}
                  disabled={inputActive || inputBusy}
                  className="min-h-10 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-neutral-100 outline-none focus:border-teal-500 disabled:opacity-60"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-xs font-semibold text-neutral-500">
                  iPhone IP
                </span>
                <input
                  type="text"
                  value={iphoneHostInput}
                  onChange={(event) => setIphoneHostInput(event.target.value)}
                  disabled={inputActive || inputBusy}
                  placeholder="Optional"
                  className="min-h-10 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-teal-500 disabled:opacity-60"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <IconTextButton
                icon={inputBusy ? Loader2 : Plug}
                label={inputBusy ? "Connecting" : "Connect"}
                onClick={() => void connectInputSource()}
                variant="secondary"
                disabled={inputBusy || inputActive}
              />
              <IconTextButton
                icon={Unplug}
                label="Disconnect"
                onClick={() => void disconnectInputSource()}
                variant="ghost"
                disabled={inputBusy || !inputDisconnectEnabled}
              />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
              <Activity aria-hidden="true" className="size-4 text-teal-300" />
              <span>{getInputActivityLabel(inputSourceStatus)}</span>
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
            <StatusRow label="Window" value={stageWindowStatus} />
            <StatusRow label="Render" value={stageViewStatusLabel} />
            <StatusRow label="Message" value={stageViewStatusMessage} />
            <StatusRow label="Transparent" value="On" />
            <StatusRow label="Capture target" value="Stage Window" />
            {shouldShowStageStatusNotice(stageViewStatus) ? (
              <StageStatusNotice status={stageViewStatus} />
            ) : null}
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

        <InputDiagnosticsPanel
          status={inputSourceStatus}
          diagnostics={inputDiagnostics}
          expanded={diagnosticsExpanded}
          copyState={copyDiagnosticsState}
          onToggleExpanded={() => setDiagnosticsExpanded((value) => !value)}
          onCopyDiagnostics={() => void copyInputDiagnostics()}
        />

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

function parseReceivePortInput(value: string): number | null {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return port;
}

function getInputConnectFeedback(status: RuntimePlayerInputStatus): string {
  if (status.connectionState === "error") {
    return status.errorMessage ?? "Input receiver failed to start.";
  }

  if (status.iphoneHost !== undefined) {
    const handshake = status.diagnostics.handshake;
    if (handshake?.result === "error") {
      return `Listening on UDP ${status.receivePort}; start request failed: ${handshake.errorMessage ?? "unknown error"}.`;
    }

    if (handshake?.result === "sent") {
      return `Listening on UDP ${status.receivePort}; start request sent to ${status.iphoneHost}.`;
    }

    return `Listening on UDP ${status.receivePort}; start request pending for ${status.iphoneHost}.`;
  }

  return `Listening on UDP ${status.receivePort}.`;
}

function isInputReceiverActive(
  status: RuntimePlayerInputStatus | null
): boolean {
  return (
    status?.connectionState === "listening" ||
    status?.connectionState === "receiving" ||
    status?.connectionState === "stale"
  );
}

function getInputStatusPillTone(
  status: RuntimePlayerInputStatus | null
): "amber" | "teal" | "red" {
  if (status?.connectionState === "receiving") {
    return "teal";
  }

  if (status?.connectionState === "error") {
    return "red";
  }

  return "amber";
}

function getInputStatusPillLabel(
  status: RuntimePlayerInputStatus | null
): string {
  if (status === null) {
    return "Input checking";
  }

  if (status.connectionState === "receiving") {
    return "Input receiving";
  }

  if (status.connectionState === "listening") {
    return "Input listening";
  }

  if (status.connectionState === "stale") {
    return "Input stale";
  }

  if (status.connectionState === "error") {
    return "Input error";
  }

  return "Input idle";
}

function getInputConnectionLabel(
  status: RuntimePlayerInputStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  if (status.connectionState === "error") {
    return status.errorMessage ?? "Error";
  }

  return status.connectionState;
}

function formatInputLocalIps(
  status: RuntimePlayerInputStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  if (status.localIpCandidates.length === 0) {
    return "None detected";
  }

  return status.localIpCandidates.join(", ");
}

function formatInputRemote(status: RuntimePlayerInputStatus | null): string {
  if (status?.remote === undefined) {
    return "None";
  }

  return `${status.remote.address}:${status.remote.port}`;
}

function formatInputFps(status: RuntimePlayerInputStatus | null): string {
  if (status?.estimatedFps === undefined) {
    return "Unknown";
  }

  return `${formatControlNumber(status.estimatedFps)} fps`;
}

function formatInputLastPacket(
  status: RuntimePlayerInputStatus | null
): string {
  if (status?.lastPacketAgeMs === undefined) {
    return "None";
  }

  return `${status.lastPacketAgeMs} ms ago`;
}

function getInputActivityLabel(status: RuntimePlayerInputStatus | null): string {
  if (status === null) {
    return "Checking input receiver.";
  }

  if (status.connectionState === "listening") {
    return "Listening for iFacialMocap UDP packets.";
  }

  if (status.connectionState === "receiving") {
    return `${status.packetCount} packets received.`;
  }

  if (status.connectionState === "stale") {
    return "No recent packet received.";
  }

  if (status.connectionState === "error") {
    return status.errorMessage ?? "Input receiver error.";
  }

  return "Receiver is idle.";
}

function formatControlNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText !== undefined) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.append(textArea);
  textArea.focus();
  textArea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Clipboard write failed.");
    }
  } finally {
    textArea.remove();
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function getStageViewPillTone(
  status: RuntimePlayerStageViewStatus | null
): "amber" | "teal" | "red" {
  if (status?.tone === "success") {
    return "teal";
  }

  if (status?.tone === "error") {
    return "red";
  }

  return "amber";
}

function getStageViewPillLabel(
  status: RuntimePlayerStageViewStatus | null,
  windowStatus: string
): string {
  if (status?.status === "ready") {
    return "Ready";
  }

  if (status?.status === "warning") {
    return "Diagnostics";
  }

  if (status?.status === "error") {
    return "Error";
  }

  if (status?.status === "empty") {
    return "Empty";
  }

  return windowStatus;
}

function shouldShowStageStatusNotice(
  status: RuntimePlayerStageViewStatus | null
): status is RuntimePlayerStageViewStatus {
  return status !== null && (
    status.tone === "warning" ||
    status.tone === "error" ||
    status.details.length > 0
  );
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

function StageStatusNotice({
  status
}: {
  readonly status: RuntimePlayerStageViewStatus;
}): ReactElement {
  const toneClass =
    status.tone === "error"
      ? "border-red-900 bg-red-950/25 text-red-100"
      : status.tone === "warning"
        ? "border-amber-800 bg-amber-950/25 text-amber-100"
        : status.tone === "success"
          ? "border-teal-800 bg-teal-950/25 text-teal-100"
          : "border-neutral-800 bg-[#111312] text-neutral-300";

  return (
    <div className={`mt-2 rounded-md border p-3 text-sm ${toneClass}`}>
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{status.message}</p>
          {status.details.length > 0 ? (
            <ul className="mt-2 grid gap-1 text-xs opacity-85">
              {status.details.slice(0, 4).map((detail) => (
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
