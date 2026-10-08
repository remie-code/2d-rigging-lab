import type { ReactElement, ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clipboard,
  ClipboardCheck,
  ClipboardX
} from "lucide-react";

import type {
  RuntimePlayerInputDiagnosticsSnapshot,
  RuntimePlayerInputHandshakeDiagnostics,
  RuntimePlayerInputParsedFrameSnapshot,
  RuntimePlayerInputRemoteEndpoint,
  RuntimePlayerInputStatus
} from "../preload/input-bridge-contract";
import type { TrackingVector3 } from "../preload/input-tracking-frame-contract";

export type InputDiagnosticsCopyState = "idle" | "copied" | "error";

export function InputDiagnosticsPanel({
  status,
  diagnostics,
  expanded,
  copyState,
  onToggleExpanded,
  onCopyDiagnostics
}: {
  readonly status: RuntimePlayerInputStatus | null;
  readonly diagnostics: RuntimePlayerInputDiagnosticsSnapshot | null;
  readonly expanded: boolean;
  readonly copyState: InputDiagnosticsCopyState;
  readonly onToggleExpanded: () => void;
  readonly onCopyDiagnostics: () => void;
}): ReactElement {
  const snapshot = diagnostics ?? status?.diagnostics ?? null;
  const parsedFrame = snapshot?.parsedFrame;

  return (
    <section className="rounded-md border border-neutral-800 bg-[#151716]">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="inline-flex min-h-10 min-w-0 items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 text-sm font-semibold text-neutral-100 hover:border-neutral-600"
        >
          {expanded ? (
            <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
          )}
          <span className="truncate">Debug / Diagnostics</span>
        </button>
        <button
          type="button"
          onClick={onCopyDiagnostics}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm font-semibold text-neutral-100 hover:border-teal-500/70 hover:text-teal-100"
        >
          {copyState === "copied" ? (
            <ClipboardCheck aria-hidden="true" className="size-4 shrink-0" />
          ) : copyState === "error" ? (
            <ClipboardX aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <Clipboard aria-hidden="true" className="size-4 shrink-0" />
          )}
          <span className="truncate">{getCopyLabel(copyState)}</span>
        </button>
      </div>

      {expanded ? (
        <div className="grid gap-4 border-t border-neutral-800 p-4">
          <DiagnosticsGrid>
            <DiagnosticsRow
              label="State"
              value={formatConnectionState(status)}
            />
            <DiagnosticsRow label="Transport" value={status?.transportLabel ?? "UDP"} />
            <DiagnosticsRow
              label="Receive port"
              value={status === null ? "49983" : String(status.receivePort)}
            />
            <DiagnosticsRow
              label="Local IP"
              value={formatLocalIpCandidates(status)}
            />
            <DiagnosticsRow
              label="iPhone IP"
              value={status?.iphoneHost ?? "None"}
            />
            <DiagnosticsRow
              label="Handshake"
              value={formatHandshake(snapshot?.handshake)}
            />
            <DiagnosticsRow label="Remote" value={formatRemote(status?.remote)} />
            <DiagnosticsRow
              label="Packets"
              value={status === null ? "0" : String(status.packetCount)}
            />
            <DiagnosticsRow label="FPS" value={formatFps(status?.estimatedFps)} />
            <DiagnosticsRow
              label="Last packet"
              value={formatLastPacket(status)}
            />
            <DiagnosticsRow
              label="Malformed"
              value={String(snapshot?.parser?.malformedSegmentCount ?? 0)}
            />
            <DiagnosticsRow
              label="Updated"
              value={snapshot?.updatedAtIso ?? "No diagnostics yet"}
            />
          </DiagnosticsGrid>

          <DiagnosticsBlock title="Raw Frame Sample">
            <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-md border border-neutral-800 bg-neutral-950 p-3 text-xs leading-5 text-neutral-300">
              {snapshot?.rawFrameSample ?? "No frame received"}
            </pre>
          </DiagnosticsBlock>

          <DiagnosticsBlock title="Parsed Frame">
            <DiagnosticsGrid>
              <DiagnosticsRow
                label="Blendshapes"
                value={formatBlendshapeCount(parsedFrame)}
              />
              <DiagnosticsRow
                label="Head rotation"
                value={formatVector(parsedFrame?.headRotationEulerDeg)}
              />
              <DiagnosticsRow
                label="Head position"
                value={formatVector(parsedFrame?.headPositionRaw)}
              />
              <DiagnosticsRow
                label="Left eye"
                value={formatVector(parsedFrame?.leftEyeEulerDeg)}
              />
              <DiagnosticsRow
                label="Right eye"
                value={formatVector(parsedFrame?.rightEyeEulerDeg)}
              />
            </DiagnosticsGrid>
            <BlendshapeList parsedFrame={parsedFrame} />
          </DiagnosticsBlock>

          <DiagnosticsBlock title="Normalized Tracking Frame">
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-neutral-800 bg-neutral-950 p-3 text-xs leading-5 text-neutral-300">
              {snapshot?.trackingFrame === undefined
                ? "No normalized frame"
                : JSON.stringify(snapshot.trackingFrame, null, 2)}
            </pre>
          </DiagnosticsBlock>

          <DiagnosticsMessages
            title="Parser Warnings"
            messages={snapshot?.parser?.parseWarnings ?? []}
            fallback={snapshot?.parser?.lastParseError ?? "None"}
          />
          <DiagnosticsMessages
            title="Normalization Warnings"
            messages={snapshot?.normalizationWarnings ?? []}
            fallback="None"
          />
        </div>
      ) : null}
    </section>
  );
}

function DiagnosticsGrid({
  children
}: {
  readonly children: ReactNode;
}): ReactElement {
  return (
    <dl className="grid gap-2 md:grid-cols-2">
      {children}
    </dl>
  );
}

function DiagnosticsRow({
  label,
  value
}: {
  readonly label: string;
  readonly value: string;
}): ReactElement {
  return (
    <div className="grid grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)] gap-3 text-sm">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-neutral-100">{value}</dd>
    </div>
  );
}

function DiagnosticsBlock({
  title,
  children
}: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <section className="grid gap-3">
      <h3 className="text-xs font-semibold uppercase text-neutral-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DiagnosticsMessages({
  title,
  messages,
  fallback
}: {
  readonly title: string;
  readonly messages: readonly string[];
  readonly fallback: string;
}): ReactElement {
  return (
    <DiagnosticsBlock title={title}>
      {messages.length > 0 ? (
        <ul className="grid max-h-40 gap-1 overflow-auto rounded-md border border-neutral-800 bg-neutral-950 p-3 text-xs leading-5 text-amber-100">
          {messages.map((message) => (
            <li key={message} className="break-words">
              {message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-400">
          {fallback}
        </p>
      )}
    </DiagnosticsBlock>
  );
}

function BlendshapeList({
  parsedFrame
}: {
  readonly parsedFrame: RuntimePlayerInputParsedFrameSnapshot | undefined;
}): ReactElement {
  if (parsedFrame === undefined || parsedFrame.blendshapes.length === 0) {
    return (
      <p className="rounded-md border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-400">
        No blendshapes parsed
      </p>
    );
  }

  return (
    <div className="grid max-h-60 grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-2 overflow-auto rounded-md border border-neutral-800 bg-neutral-950 p-3">
      {parsedFrame.blendshapes.map((blendshape) => (
        <div
          key={blendshape.name}
          className="grid grid-cols-[minmax(0,1fr)_4rem] gap-2 text-xs"
        >
          <span className="min-w-0 truncate text-neutral-300">
            {blendshape.name}
          </span>
          <span className="text-right tabular-nums text-neutral-100">
            {formatNumber(blendshape.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function getCopyLabel(copyState: InputDiagnosticsCopyState): string {
  if (copyState === "copied") {
    return "Copied";
  }

  if (copyState === "error") {
    return "Copy failed";
  }

  return "Copy diagnostics";
}

function formatConnectionState(status: RuntimePlayerInputStatus | null): string {
  if (status === null) {
    return "Checking";
  }

  return status.connectionState;
}

function formatLocalIpCandidates(
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

function formatHandshake(
  handshake: RuntimePlayerInputHandshakeDiagnostics | undefined
): string {
  if (handshake === undefined) {
    return "None";
  }

  const target = handshake.target === undefined
    ? ""
    : ` to ${formatRemote(handshake.target)}`;

  if (handshake.result === "error") {
    return `error${target}: ${handshake.errorMessage ?? "unknown error"}`;
  }

  return `${handshake.result}${target}`;
}

function formatRemote(
  remote: RuntimePlayerInputRemoteEndpoint | undefined
): string {
  return remote === undefined ? "None" : `${remote.address}:${remote.port}`;
}

function formatFps(fps: number | undefined): string {
  return fps === undefined ? "Unknown" : `${formatNumber(fps)} fps`;
}

function formatLastPacket(status: RuntimePlayerInputStatus | null): string {
  if (status?.lastPacketAgeMs === undefined) {
    return "None";
  }

  return `${status.lastPacketAgeMs} ms ago`;
}

function formatBlendshapeCount(
  parsedFrame: RuntimePlayerInputParsedFrameSnapshot | undefined
): string {
  if (parsedFrame === undefined) {
    return "0";
  }

  return String(parsedFrame.blendshapeCount);
}

function formatVector(vector: TrackingVector3 | undefined): string {
  if (vector === undefined) {
    return "None";
  }

  return `x ${formatNumber(vector.x)}, y ${formatNumber(vector.y)}, z ${formatNumber(vector.z)}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}
