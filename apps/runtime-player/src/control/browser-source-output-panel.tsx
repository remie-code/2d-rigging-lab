import type { ReactElement } from "react";
import { Copy } from "lucide-react";

import {
  ErrorNotice,
  IconTextButton,
  Panel,
  StatusRow
} from "./control-window-components";
import { formatControlNumber } from "./control-window-formatters";
import type {
  RuntimePlayerBrowserSourceClientDiagnostic,
  RuntimePlayerBrowserSourceRendererDiagnostics,
  RuntimePlayerBrowserSourceStatus
} from "../preload/browser-source-status-contract";

export function BrowserSourceOutputPanel({
  status,
  onCopyUrl
}: {
  readonly status: RuntimePlayerBrowserSourceStatus | null;
  readonly onCopyUrl: () => void;
}): ReactElement {
  const diagnostics = status?.latestRendererDiagnostics ?? null;
  const errorDetails =
    status?.state === "error" && status.errorMessage !== null
      ? [status.errorMessage]
      : [];

  return (
    <Panel title="Browser Source Output">
      <StatusRow label="URL" value={formatBrowserSourceUrl(status)} />
      <StatusRow label="Server" value={formatBrowserSourceServer(status)} />
      <StatusRow label="Bind Address" value={formatBindAddress(status)} />
      <StatusRow label="Port" value={formatBrowserSourcePort(status)} />
      <StatusRow label="URL Token" value={formatUrlToken(status)} />
      <StatusRow
        label="Recommended OBS Size"
        value={formatRecommendedObsSize(status)}
      />
      <StatusRow label="Clients" value={formatConnectedClients(status)} />
      <StatusRow
        label="Local Preview"
        value={formatLocalPreviewLiveRendering(status)}
      />
      <StatusRow
        label="Stage Request"
        value={formatStageRequest(status)}
      />
      <StatusRow
        label="Asset Request"
        value={formatAssetRequest(status)}
      />
      <StatusRow label="WS Request" value={formatWsRequest(status)} />
      <StatusRow
        label="Client Boot"
        value={formatClientDiagnostic(status)}
      />
      <StatusRow
        label="Runtime Export"
        value={formatRuntimeExport(status)}
      />
      <StatusRow label="Latest Frame" value={formatLatestFrame(status)} />
      <StatusRow
        label="Client Heartbeat"
        value={formatClientHeartbeat(status)}
      />
      <StatusRow
        label="Server Heartbeat"
        value={formatServerHeartbeat(status)}
      />
      <StatusRow
        label="Renderer"
        value={formatRendererStatus(diagnostics)}
      />
      <StatusRow label="WebGL2" value={formatWebgl2(diagnostics)} />
      <StatusRow
        label="Browser Export"
        value={formatBrowserRuntimeExport(diagnostics)}
      />
      <StatusRow label="Frame Age" value={formatFrameAge(diagnostics)} />
      <StatusRow
        label="Live Source Timestamp FPS"
        value={formatBrowserSourceTimestampFps(diagnostics)}
      />
      <StatusRow
        label="Render Count"
        value={formatBrowserRenderCount(diagnostics)}
      />
      <StatusRow
        label="rAF Delta"
        value={formatBrowserRafDelta(diagnostics)}
      />
      <StatusRow
        label="Render Duration"
        value={formatBrowserRenderDuration(diagnostics)}
      />
      {errorDetails.length > 0 ? (
        <ErrorNotice title="Browser Source server error" details={errorDetails} />
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <IconTextButton
          icon={Copy}
          label="Copy URL"
          onClick={onCopyUrl}
          variant="secondary"
        />
      </div>
      <div className="mt-2 rounded-md border border-neutral-800 bg-[#111312] p-3 text-xs text-neutral-300">
        <p className="font-semibold text-neutral-100">
          OBS Browser Source setup
        </p>
        <ul className="mt-2 grid gap-1">
          <li>Add a Browser Source and paste the URL.</li>
          <li>Set width, height, and FPS for the stage.</li>
          <li>Keep transparent background/custom CSS behavior enabled.</li>
          <li>Leave shutdown and refresh lifecycle options off while testing.</li>
        </ul>
      </div>
    </Panel>
  );
}

function formatBrowserSourceUrl(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  return status.browserSourceUrl ?? "URL unavailable";
}

function formatBrowserSourceServer(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  const stateLabel =
    status.state === "running"
      ? "Running"
      : status.state === "starting"
        ? "Starting"
        : status.state === "error"
          ? "Error"
          : "Stopped";

  return `${stateLabel} - ${status.statusLabel}`;
}

function formatBindAddress(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  return status?.bindAddress ?? "Checking";
}

function formatBrowserSourcePort(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  return status.port === null ? "Unavailable" : String(status.port);
}

function formatUrlToken(status: RuntimePlayerBrowserSourceStatus | null): string {
  if (status === null) {
    return "Checking";
  }

  return status.browserSourceUrl === null ? "URL unavailable" : "Included in URL";
}

function formatRecommendedObsSize(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  const bounds = status.stageDisplayState.stageWindow.bounds;
  if (bounds === null) {
    return "Stage Window size unavailable";
  }

  return `${bounds.width} x ${bounds.height}`;
}

function formatConnectedClients(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  if (status.connectedClientCount === 0) {
    return "No Browser Source client connected";
  }

  if (status.connectedClientCount === 1) {
    return "1 connected client";
  }

  return `${status.connectedClientCount} connected clients`;
}

function formatLocalPreviewLiveRendering(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  return status.connectedClientCount > 0
    ? "Live rendering suspended while Browser Source is connected"
    : "Live rendering active";
}

function formatStageRequest(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  const request = status.requestDiagnostics.lastStageRequest;
  if (request === null) {
    return "Not requested";
  }

  return `${formatStatusWord(request.statusLabel)} (${request.statusCode}) at ${
    request.requestedAtIso
  }`;
}

function formatAssetRequest(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  const request = status.requestDiagnostics.lastAssetRequest;
  if (request === null) {
    return "Not requested";
  }

  return `${formatStatusWord(request.routeKind)} ${formatStatusWord(
    request.statusLabel
  )} (${request.statusCode}) at ${request.requestedAtIso}`;
}

function formatWsRequest(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  const diagnostics = status.requestDiagnostics;
  if (
    status.connectedClientCount > 0 &&
    diagnostics.lastWsConnectedAtIso !== null
  ) {
    return `Connected at ${diagnostics.lastWsConnectedAtIso}`;
  }

  if (diagnostics.lastWsDisconnectedAtIso !== null) {
    return `Disconnected at ${diagnostics.lastWsDisconnectedAtIso}`;
  }

  if (diagnostics.lastWsConnectedAtIso !== null) {
    return `Last connected at ${diagnostics.lastWsConnectedAtIso}`;
  }

  if (diagnostics.lastWsUpgradeRejected !== null) {
    const reject = diagnostics.lastWsUpgradeRejected;
    return `Rejected ${formatStatusWord(reject.reason)} (${
      reject.statusCode
    }) at ${reject.rejectedAtIso}`;
  }

  return "No WebSocket attempt";
}

function formatClientDiagnostic(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  const diagnostic = status.latestClientDiagnostic;
  if (diagnostic === null) {
    return "No boot/client diagnostic";
  }

  const message =
    diagnostic.message === null || diagnostic.message.length === 0
      ? ""
      : ` - ${diagnostic.message}`;
  const source = formatClientDiagnosticSource(diagnostic);

  return `${formatStatusWord(diagnostic.event)} at ${
    diagnostic.reportedAtIso
  }${source}${message}`;
}

function formatClientDiagnosticSource(
  diagnostic: RuntimePlayerBrowserSourceClientDiagnostic
): string {
  if (diagnostic.source === null || diagnostic.source.length === 0) {
    return "";
  }

  const line =
    diagnostic.line === null
      ? ""
      : `:${diagnostic.line}${diagnostic.column === null
        ? ""
        : `:${diagnostic.column}`}`;

  return ` from ${diagnostic.source}${line}`;
}

function formatRuntimeExport(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  const modelName = status.runtimeExport.summary?.modelDisplayName;
  return modelName === undefined
    ? status.runtimeExport.statusLabel
    : `${status.runtimeExport.statusLabel}: ${modelName}`;
}

function formatLatestFrame(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  if (status.latestFrame === null) {
    return "No live frame";
  }

  return `#${status.latestFrame.sequence} at ${status.latestFrame.producedAtIso}`;
}

function formatClientHeartbeat(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  if (status.lastClientHeartbeatAtIso !== null) {
    return status.lastClientHeartbeatAtIso;
  }

  return status.connectedClientCount > 0
    ? "Waiting for client heartbeat"
    : "No client heartbeat";
}

function formatServerHeartbeat(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  return status.lastServerHeartbeatAtIso ?? "No server heartbeat";
}

function formatRendererStatus(
  diagnostics: RuntimePlayerBrowserSourceRendererDiagnostics | null
): string {
  if (diagnostics === null) {
    return "No client diagnostics";
  }

  const label = formatStatusWord(diagnostics.renderStatus);

  return diagnostics.message === null || diagnostics.message.length === 0
    ? label
    : `${label}: ${diagnostics.message}`;
}

function formatWebgl2(
  diagnostics: RuntimePlayerBrowserSourceRendererDiagnostics | null
): string {
  if (diagnostics === null) {
    return "No client diagnostics";
  }

  return formatStatusWord(diagnostics.webgl2Available);
}

function formatBrowserRuntimeExport(
  diagnostics: RuntimePlayerBrowserSourceRendererDiagnostics | null
): string {
  if (diagnostics === null) {
    return "No client diagnostics";
  }

  return diagnostics.runtimeExportLoaded
    ? "Loaded in Browser Source"
    : "Not loaded in Browser Source";
}

function formatFrameAge(
  diagnostics: RuntimePlayerBrowserSourceRendererDiagnostics | null
): string {
  if (diagnostics === null) {
    return "No client diagnostics";
  }

  return diagnostics.frameAgeMs === null
    ? "Unknown"
    : `${Math.max(0, Math.round(diagnostics.frameAgeMs))} ms`;
}

function formatBrowserSourceTimestampFps(
  diagnostics: RuntimePlayerBrowserSourceRendererDiagnostics | null
): string {
  if (diagnostics === null) {
    return "No client diagnostics";
  }

  const sourceFps = diagnostics.sourceFps ?? diagnostics.fps;

  return sourceFps === null
    ? "Unknown"
    : `${formatControlNumber(sourceFps)} fps`;
}

function formatBrowserRenderCount(
  diagnostics: RuntimePlayerBrowserSourceRendererDiagnostics | null
): string {
  if (diagnostics === null) {
    return "No client diagnostics";
  }

  return diagnostics.renderMetrics === undefined ||
    diagnostics.renderMetrics === null
    ? "Unknown"
    : String(diagnostics.renderMetrics.renderCount);
}

function formatBrowserRafDelta(
  diagnostics: RuntimePlayerBrowserSourceRendererDiagnostics | null
): string {
  if (diagnostics === null) {
    return "No client diagnostics";
  }

  const value = diagnostics.renderMetrics?.lastRafDeltaMs;
  return value === undefined || value === null
    ? "Unknown"
    : `${formatControlNumber(value)} ms`;
}

function formatBrowserRenderDuration(
  diagnostics: RuntimePlayerBrowserSourceRendererDiagnostics | null
): string {
  if (diagnostics === null) {
    return "No client diagnostics";
  }

  const value = diagnostics.renderMetrics?.lastRenderDurationMs;
  return value === undefined || value === null
    ? "Unknown"
    : `${formatControlNumber(value)} ms`;
}

function formatStatusWord(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
