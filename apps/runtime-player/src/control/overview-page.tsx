import type { ReactElement } from "react";
import {
  Activity,
  Crosshair,
  FolderOpen,
  Plug,
  PlugZap,
  RefreshCcw,
  SlidersHorizontal
} from "lucide-react";

import {
  ErrorNotice,
  IconTextButton,
  Panel,
  StageStatusNotice,
  StatusRow
} from "./control-window-components";
import {
  formatInputFps,
  formatInputLastPacket,
  formatInputRemote,
  getAutoMappingLabel,
  getInputConnectionLabel,
  getLiveReadinessLabel,
  getMappingProfileLabel,
  getProfileStatusLabel,
  getRuntimeExportDirectoryLabel,
  getRuntimeExportLoadedLabel,
  shouldShowStageStatusNotice
} from "./control-window-formatters";
import type { ControlWindowPage } from "./control-window-shell";
import type {
  RuntimePlayerInputStatus
} from "../preload/input-bridge-contract";
import type {
  RuntimePlayerInputProfileStatus
} from "../preload/input-profile-bridge-contract";
import type {
  RuntimePlayerStageViewStatus
} from "../preload/runtime-player-bridge-contract";
import type {
  RuntimePlayerMappingStatus
} from "../preload/model-mapping-bridge-contract";
import type {
  RuntimeExportStatus
} from "../preload/runtime-export-bridge-contract";
import type {
  PhysiologyStatus
} from "../preload/physiology-bridge-contract";
import type {
  RuntimePlayerControlChannelStatus
} from "../preload/channel-bridge-contract";

export function OverviewPage({
  runtimeExportStatus,
  inputStatus,
  profileStatus,
  mappingStatus,
  stageViewStatus,
  stageWindowStatus,
  physiologyStatus,
  channelStatus,
  providesPhysiology,
  providesChannel,
  onOpenRuntimeExport,
  onRetryRuntimeExportRestore,
  onConnectInput,
  onLookForward,
  onStartCalibration,
  onUseTemporaryDefaults,
  onSelectPage,
  inputBusy,
  lookForwardAvailable
}: {
  readonly runtimeExportStatus: RuntimeExportStatus | null;
  readonly inputStatus: RuntimePlayerInputStatus | null;
  readonly profileStatus: RuntimePlayerInputProfileStatus | null;
  readonly mappingStatus: RuntimePlayerMappingStatus | null;
  readonly stageViewStatus: RuntimePlayerStageViewStatus | null;
  readonly stageWindowStatus: string;
  readonly physiologyStatus: PhysiologyStatus | null;
  readonly channelStatus: RuntimePlayerControlChannelStatus | null;
  /** DATA: this host drives a physiology subsystem (Autonomous Host). */
  readonly providesPhysiology: boolean;
  /** DATA: this host owns a control channel subsystem (Autonomous Host). */
  readonly providesChannel: boolean;
  readonly onOpenRuntimeExport: () => void;
  readonly onRetryRuntimeExportRestore: () => void;
  readonly onConnectInput: () => void;
  readonly onLookForward: () => void;
  readonly onStartCalibration: () => void;
  readonly onUseTemporaryDefaults: () => void;
  readonly onSelectPage: (page: ControlWindowPage) => void;
  readonly inputBusy: boolean;
  readonly lookForwardAvailable: boolean;
}): ReactElement {
  const erroredRuntimeExport = runtimeExportStatus?.status === "error"
    ? runtimeExportStatus
    : null;
  const restoreFailed =
    erroredRuntimeExport?.operation === "startup-restore" ||
    erroredRuntimeExport?.operation === "retry-restore";

  const modelPanel = (
    <ModelOverviewPanel
      runtimeExportStatus={runtimeExportStatus}
      erroredRuntimeExport={erroredRuntimeExport}
      restoreFailed={restoreFailed}
      onOpenRuntimeExport={onOpenRuntimeExport}
      onRetryRuntimeExportRestore={onRetryRuntimeExportRestore}
    />
  );

  // Autonomous Host Overview (UX §2): the设計済みの姿 = Model / Physiology / Channel
  // cards, chosen by subsystem-availability DATA (providesPhysiology / providesChannel),
  // not a role query. The Tracking Host keeps its existing 4-panel layout below (no
  // channel card, since the subsystem is absent).
  if (providesPhysiology) {
    return (
      <div className="grid gap-4">
        <section className="grid gap-4 lg:grid-cols-2">
          {modelPanel}
          <PhysiologyOverviewPanel
            physiologyStatus={physiologyStatus}
            onSelectPage={onSelectPage}
          />
        </section>
        {providesChannel ? (
          <ChannelOverviewPanel
            channelStatus={channelStatus}
            onSelectPage={onSelectPage}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 lg:grid-cols-2">
        {modelPanel}

        <Panel title="Input Source">
          <StatusRow
            label="Connection"
            value={getInputConnectionLabel(inputStatus)}
          />
          <StatusRow label="FPS" value={formatInputFps(inputStatus)} />
          <StatusRow
            label="Last packet"
            value={formatInputLastPacket(inputStatus)}
          />
          <StatusRow label="Remote" value={formatInputRemote(inputStatus)} />
          <div className="mt-4">
            <IconTextButton
              icon={Plug}
              label={inputBusy ? "Connecting" : "Connect Input"}
              onClick={onConnectInput}
              variant="secondary"
              disabled={inputBusy || inputStatus?.connectionState === "receiving"}
            />
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Input Profile">
          <StatusRow
            label="Profile"
            value={getProfileStatusLabel(profileStatus)}
          />
          <StatusRow
            label="Range"
            value={profileStatus?.activeProfile?.rangeStatus ?? "Not calibrated"}
          />
          <StatusRow
            label="Neutral"
            value={
              profileStatus?.sessionNeutral === null ||
              profileStatus === null
                ? "Not set"
                : profileStatus.sessionNeutral.capturedAtIso
            }
          />
          {profileStatus?.storage.warningMessages.length ? (
            <ErrorNotice
              title="Input profile warning"
              details={profileStatus.storage.warningMessages}
            />
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <IconTextButton
              icon={Crosshair}
              label="Look Forward"
              onClick={onLookForward}
              variant="secondary"
              disabled={!lookForwardAvailable}
            />
            <IconTextButton
              icon={Crosshair}
              label="Start Calibration"
              onClick={onStartCalibration}
              variant="ghost"
            />
            <IconTextButton
              icon={SlidersHorizontal}
              label="Use Temporary Defaults"
              onClick={onUseTemporaryDefaults}
              variant="ghost"
            />
          </div>
        </Panel>

        <Panel title="Mapping / Live">
          <StatusRow
            label="Readiness"
            value={getLiveReadinessLabel({
            runtimeExportStatus,
            inputStatus,
            profileStatus,
            mappingStatus
          })}
        />
          <StatusRow label="Auto Mapping" value={getAutoMappingLabel(mappingStatus)} />
          <StatusRow
            label="Mapping Profile"
            value={getMappingProfileLabel(mappingStatus)}
          />
          <StatusRow label="Stage Window" value={stageWindowStatus} />
          <StatusRow
            label="Stage Render"
            value={stageViewStatus?.statusLabel ?? "Checking Stage"}
          />
          {shouldShowStageStatusNotice(stageViewStatus) ? (
            <StageStatusNotice status={stageViewStatus} />
          ) : null}
          <div className="mt-4">
            <IconTextButton
              icon={SlidersHorizontal}
              label="Open Mapping"
              onClick={() => onSelectPage("mapping")}
              variant="secondary"
            />
          </div>
        </Panel>
      </section>
    </div>
  );
}

function ModelOverviewPanel({
  runtimeExportStatus,
  erroredRuntimeExport,
  restoreFailed,
  onOpenRuntimeExport,
  onRetryRuntimeExportRestore
}: {
  readonly runtimeExportStatus: RuntimeExportStatus | null;
  readonly erroredRuntimeExport: RuntimeExportStatus | null;
  readonly restoreFailed: boolean;
  readonly onOpenRuntimeExport: () => void;
  readonly onRetryRuntimeExportRestore: () => void;
}): ReactElement {
  return (
    <Panel title="Model">
      <StatusRow
        label="Loaded"
        value={getRuntimeExportLoadedLabel(runtimeExportStatus)}
      />
      <StatusRow
        label="Directory"
        value={getRuntimeExportDirectoryLabel(runtimeExportStatus)}
      />
      {runtimeExportStatus?.status === "loaded" ? (
        <>
          <StatusRow
            label="Model"
            value={runtimeExportStatus.summary.modelDisplayName}
          />
          <StatusRow
            label="Drawables"
            value={`${runtimeExportStatus.summary.drawableCount} drawables / ${runtimeExportStatus.summary.meshCount} meshes`}
          />
        </>
      ) : null}
      {erroredRuntimeExport !== null &&
      erroredRuntimeExport.status === "error" ? (
        <ErrorNotice
          title={erroredRuntimeExport.error.message}
          details={erroredRuntimeExport.error.details}
        />
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {restoreFailed ? (
          <IconTextButton
            icon={RefreshCcw}
            label="Retry Restore"
            onClick={onRetryRuntimeExportRestore}
            variant="secondary"
            disabled={runtimeExportStatus?.status === "loading"}
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
          variant="primary"
          disabled={runtimeExportStatus?.status === "loading"}
        />
      </div>
    </Panel>
  );
}

function PhysiologyOverviewPanel({
  physiologyStatus,
  onSelectPage
}: {
  readonly physiologyStatus: PhysiologyStatus | null;
  readonly onSelectPage: (page: ControlWindowPage) => void;
}): ReactElement {
  return (
    <Panel title="Physiology">
      <StatusRow
        label="Subsystem"
        value={physiologyStatus === null ? "Checking" : "Present"}
      />
      <StatusRow
        label="State"
        value={formatPhysiologyStateLabel(physiologyStatus)}
      />
      <StatusRow
        label="Runtime Export"
        value={physiologyStatus?.runtimeExport?.modelDisplayName ?? "Not loaded"}
      />
      <div className="mt-4">
        <IconTextButton
          icon={Activity}
          label="Open Physiology"
          onClick={() => onSelectPage("physiology")}
          variant="secondary"
        />
      </div>
    </Panel>
  );
}

function ChannelOverviewPanel({
  channelStatus,
  onSelectPage
}: {
  readonly channelStatus: RuntimePlayerControlChannelStatus | null;
  readonly onSelectPage: (page: ControlWindowPage) => void;
}): ReactElement {
  return (
    <Panel title="Channel">
      <StatusRow label="Status" value={formatChannelStateLabel(channelStatus)} />
      <StatusRow
        label="Active overlays"
        value={
          channelStatus === null
            ? "Checking"
            : String(channelStatus.activeOverlays.length)
        }
      />
      <div className="mt-4">
        <IconTextButton
          icon={PlugZap}
          label="Open Channel"
          onClick={() => onSelectPage("channel")}
          variant="secondary"
        />
      </div>
    </Panel>
  );
}

function formatPhysiologyStateLabel(
  status: PhysiologyStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  return status.status === "ready" ? "Driving" : "Awaiting Runtime Export";
}

function formatChannelStateLabel(
  status: RuntimePlayerControlChannelStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  const connection = status.connection;
  if (connection.kind === "connected") {
    return `Connected (protocol ${connection.protocolVersion})`;
  }

  if (connection.kind === "open") {
    return "Open — no client connected";
  }

  return "Closed";
}
