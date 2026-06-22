import type { ReactElement } from "react";
import { Crosshair, FolderOpen, Plug, SlidersHorizontal } from "lucide-react";

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

export function OverviewPage({
  runtimeExportStatus,
  inputStatus,
  profileStatus,
  mappingStatus,
  stageViewStatus,
  stageWindowStatus,
  onOpenRuntimeExport,
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
  readonly onOpenRuntimeExport: () => void;
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

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Runtime Export">
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
          {erroredRuntimeExport ? (
            <ErrorNotice
              title={erroredRuntimeExport.error.message}
              details={erroredRuntimeExport.error.details}
            />
          ) : null}
          <div className="mt-4">
            <IconTextButton
              icon={FolderOpen}
              label={
                runtimeExportStatus?.status === "loaded"
                  ? "Open Different Export"
                  : "Open Runtime Export"
              }
              onClick={onOpenRuntimeExport}
              variant="primary"
              disabled={runtimeExportStatus?.status === "loading"}
            />
          </div>
        </Panel>

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
