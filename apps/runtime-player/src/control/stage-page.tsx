import type { ReactElement } from "react";
import {
  Copy,
  Crosshair,
  FolderOpen,
  Monitor,
  MousePointer2,
  Move,
  Pin,
  RefreshCcw
} from "lucide-react";

import {
  ErrorNotice,
  IconTextButton,
  Panel,
  StatusRow
} from "./control-window-components";
import {
  formatControlNumber,
  getRuntimeExportDirectoryLabel
} from "./control-window-formatters";
import { BrowserSourceOutputPanel } from "./browser-source-output-panel";
import type {
  RuntimePlayerStageStateSnapshot,
  RuntimePlayerWindowBounds
} from "../preload/runtime-player-bridge-contract";
import type {
  RuntimePlayerBrowserSourceStatus
} from "../preload/browser-source-status-contract";
import type { RuntimeExportStatus } from "../preload/runtime-export-bridge-contract";

export function StagePage({
  stageState,
  runtimeExportStatus,
  browserSourceStatus,
  onFocusStage,
  onResetView,
  onCenterModel,
  onSetArrangeMode,
  onSetClickThrough,
  onSetAlwaysOnTop,
  onCopyBrowserSourceUrl,
  onCopyWindowTitle,
  onOpenRuntimeExport,
  onRetryRuntimeExportRestore
}: {
  readonly stageState: RuntimePlayerStageStateSnapshot | null;
  readonly runtimeExportStatus: RuntimeExportStatus | null;
  readonly browserSourceStatus: RuntimePlayerBrowserSourceStatus | null;
  readonly onFocusStage: () => void;
  readonly onResetView: () => void;
  readonly onCenterModel: () => void;
  readonly onSetArrangeMode: (enabled: boolean) => void;
  readonly onSetClickThrough: (enabled: boolean) => void;
  readonly onSetAlwaysOnTop: (enabled: boolean) => void;
  readonly onCopyBrowserSourceUrl: () => void;
  readonly onCopyWindowTitle: () => void;
  readonly onOpenRuntimeExport: () => void;
  readonly onRetryRuntimeExportRestore: () => void;
}): ReactElement {
  const bounds = stageState?.stageWindow.bounds ?? null;
  const transform = stageState?.stageView.transform ?? null;
  const persistence = stageState?.persistence ?? null;
  const capture = stageState?.capture ?? null;
  const restoreFailed =
    runtimeExportStatus?.status === "error" &&
    (runtimeExportStatus.operation === "startup-restore" ||
      runtimeExportStatus.operation === "retry-restore");

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Stage Window">
          <StatusRow
            label="Status"
            value={formatStageWindowStatus(stageState)}
          />
          <StatusRow label="Position" value={formatBoundsPosition(bounds)} />
          <StatusRow label="Size" value={formatBoundsSize(bounds)} />
          <StatusRow
            label="Render"
            value={stageState?.stageView.renderStatus.statusLabel ?? "Checking"}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <IconTextButton
              icon={Monitor}
              label="Focus Stage"
              onClick={onFocusStage}
              variant="secondary"
            />
            <IconTextButton
              icon={Move}
              label={
                capture?.arrangeModeEnabled
                  ? "Stop Arranging"
                  : "Arrange Stage"
              }
              onClick={() =>
                onSetArrangeMode(!(capture?.arrangeModeEnabled ?? false))
              }
              variant={capture?.arrangeModeEnabled ? "primary" : "ghost"}
              disabled={stageState?.stageWindow.windowState === "destroyed"}
            />
          </div>
        </Panel>

        <Panel title="View">
          <StatusRow
            label="Zoom"
            value={
              transform === null
                ? "Checking"
                : `${Math.round(transform.zoomScale * 100)}%`
            }
          />
          <StatusRow
            label="Pan"
            value={
              transform === null
                ? "Checking"
                : `x ${formatControlNumber(transform.pan.x)} / y ${formatControlNumber(transform.pan.y)}`
            }
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <IconTextButton
              icon={RefreshCcw}
              label="Reset View"
              onClick={onResetView}
              variant="secondary"
            />
            <IconTextButton
              icon={Crosshair}
              label="Center Model"
              onClick={onCenterModel}
              variant="ghost"
            />
          </div>
        </Panel>
      </section>

      <BrowserSourceOutputPanel
        status={browserSourceStatus}
        onCopyUrl={onCopyBrowserSourceUrl}
      />

      <Panel title="Local Preview / Fallback">
        <StatusRow
          label="Stage Window"
          value={formatStageWindowStatus(stageState)}
        />
        <StatusRow
          label="Runtime Export"
          value={formatRuntimeExportCaptureStatus(runtimeExportStatus)}
        />
        <StatusRow
          label="Model"
          value={formatModelVisibility(stageState)}
        />
        <StatusRow label="Background" value="Transparent" />
        <StatusRow
          label="Stage UI"
          value={formatStageUi(capture)}
        />
        <StatusRow
          label="Window Title"
          value={capture?.windowTitle ?? "Runtime Player Stage"}
        />
        <StatusRow
          label="Click-through"
          value={capture?.clickThroughEnabled ? "On" : "Off"}
        />
        <StatusRow
          label="Always on top"
          value={capture?.alwaysOnTopEnabled ? "On" : "Off"}
        />
        <div className="mt-2 rounded-md border border-neutral-800 bg-[#111312] p-3 text-xs text-neutral-300">
          Native Stage Window controls remain available for local preview and
          fallback capture setup.
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <IconTextButton
            icon={MousePointer2}
            label={
              capture?.clickThroughEnabled
                ? "Disable Click-through"
                : "Enable Click-through"
            }
            onClick={() =>
              onSetClickThrough(!(capture?.clickThroughEnabled ?? false))
            }
            variant={capture?.clickThroughEnabled ? "primary" : "secondary"}
            disabled={stageState?.stageWindow.windowState === "destroyed"}
          />
          <IconTextButton
            icon={Pin}
            label={
              capture?.alwaysOnTopEnabled
                ? "Disable Always on Top"
                : "Enable Always on Top"
            }
            onClick={() =>
              onSetAlwaysOnTop(!(capture?.alwaysOnTopEnabled ?? false))
            }
            variant={capture?.alwaysOnTopEnabled ? "primary" : "ghost"}
            disabled={stageState?.stageWindow.windowState === "destroyed"}
          />
          <IconTextButton
            icon={Copy}
            label="Copy Window Title"
            onClick={onCopyWindowTitle}
            variant="ghost"
          />
        </div>
      </Panel>

      <Panel title="Auto Save">
        <StatusRow
          label="Status"
          value={persistence?.statusLabel ?? "Checking"}
        />
        <StatusRow
          label="Updated"
          value={persistence?.updatedAtIso ?? "Checking"}
        />
        <StatusRow
          label="Storage"
          value={persistence?.storageLabel ?? "window-state/runtime-player.json"}
        />
        {persistence !== null && persistence.warningMessages.length > 0 ? (
          <ErrorNotice
            title="Stage state persistence warning"
            details={persistence.warningMessages}
          />
        ) : null}
      </Panel>

      <Panel title="Startup">
        <StatusRow
          label="Runtime Export"
          value={formatRuntimeExportStartupStatus(runtimeExportStatus)}
        />
        <StatusRow
          label="Last Export"
          value={getRuntimeExportDirectoryLabel(runtimeExportStatus)}
        />
        <StatusRow
          label="Storage"
          value="startup-state/runtime-player-startup.json"
        />
        {restoreFailed ? (
          <ErrorNotice
            title={runtimeExportStatus.error.message}
            details={runtimeExportStatus.error.details}
          />
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {restoreFailed ? (
            <IconTextButton
              icon={RefreshCcw}
              label="Retry Restore"
              onClick={onRetryRuntimeExportRestore}
              variant="secondary"
            />
          ) : null}
          <IconTextButton
            icon={FolderOpen}
            label={
              runtimeExportStatus?.status === "loaded"
                ? "Open Different Export"
                : runtimeExportStatus?.status === "error"
                  ? "Open New Export"
                  : "Open Runtime Export"
            }
            onClick={onOpenRuntimeExport}
            variant={runtimeExportStatus?.status === "loaded" ? "secondary" : "primary"}
            disabled={runtimeExportStatus?.status === "loading"}
          />
        </div>
      </Panel>
    </div>
  );
}

function formatRuntimeExportCaptureStatus(
  status: RuntimeExportStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  if (status.status === "loaded") {
    return "Loaded";
  }

  if (status.status === "loading") {
    return "Loading";
  }

  if (status.status === "error") {
    return "Load failed";
  }

  return "Not loaded";
}

function formatModelVisibility(
  stageState: RuntimePlayerStageStateSnapshot | null
): string {
  const renderStatus = stageState?.stageView.renderStatus.status;

  if (renderStatus === "ready" || renderStatus === "warning") {
    return "Visible";
  }

  if (renderStatus === "error") {
    return "Render error";
  }

  return "Not visible";
}

function formatStageUi(
  capture: RuntimePlayerStageStateSnapshot["capture"] | null
): string {
  if (capture?.stageUi === "arrange-overlay-visible") {
    return "Arrange overlay visible";
  }

  return "Hidden / model only";
}

function formatRuntimeExportStartupStatus(
  status: RuntimeExportStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  if (status.status === "loading") {
    return status.operation === "startup-restore" ||
      status.operation === "retry-restore"
      ? "Restoring"
      : "Loading";
  }

  if (status.status === "loaded") {
    return status.operation === "startup-restore" ||
      status.operation === "retry-restore"
      ? "Restored"
      : "Loaded";
  }

  if (status.status === "error") {
    return status.operation === "startup-restore" ||
      status.operation === "retry-restore"
      ? "Restore failed"
      : "Load failed";
  }

  return "Not set";
}

function formatStageWindowStatus(
  stageState: RuntimePlayerStageStateSnapshot | null
): string {
  if (stageState === null) {
    return "Checking";
  }

  return stageState.stageWindow.windowState === "created"
    ? "Open"
    : "Unavailable";
}

function formatBoundsPosition(bounds: RuntimePlayerWindowBounds | null): string {
  if (bounds === null) {
    return "Checking";
  }

  return `x ${bounds.x} / y ${bounds.y}`;
}

function formatBoundsSize(bounds: RuntimePlayerWindowBounds | null): string {
  if (bounds === null) {
    return "Checking";
  }

  return `${bounds.width} x ${bounds.height}`;
}
