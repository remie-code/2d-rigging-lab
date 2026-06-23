import type { ReactElement } from "react";
import {
  Activity,
  Crosshair,
  Play,
  RefreshCcw,
  Save,
  StepForward,
  SlidersHorizontal,
  Unplug,
  X
} from "lucide-react";

import {
  ErrorNotice,
  IconTextButton,
  Panel,
  StatusPill,
  StatusRow
} from "./control-window-components";
import {
  formatInputFps,
  formatInputLastPacket,
  formatInputLocalIps,
  formatInputRemote,
  getInputActivityLabel,
  getInputConnectionLabel,
  getProfileStatusLabel,
  isInputReceiverActive
} from "./control-window-formatters";
import type { RuntimePlayerInputStatus } from "../preload/input-bridge-contract";
import type {
  RuntimePlayerInputCalibrationSectionStatus,
  RuntimePlayerInputProfileStartCalibrationRequest,
  RuntimePlayerInputCalibrationPromptSnapshot,
  RuntimePlayerInputProfileStatus
} from "../preload/input-profile-bridge-contract";

export function InputPage({
  inputStatus,
  profileStatus,
  receivePortInput,
  iphoneHostInput,
  inputBusy,
  calibrationName,
  lookForwardAvailable,
  onReceivePortInputChange,
  onIphoneHostInputChange,
  onConnectInput,
  onDisconnectInput,
  onLookForward,
  onSetActiveProfile,
  onUseTemporaryDefaults,
  onStartCalibration,
  onCancelCalibration,
  onRecordCalibrationSample,
  onAdvanceCalibrationPrompt,
  onFinishCalibration,
  onCalibrationNameChange
}: {
  readonly inputStatus: RuntimePlayerInputStatus | null;
  readonly profileStatus: RuntimePlayerInputProfileStatus | null;
  readonly receivePortInput: string;
  readonly iphoneHostInput: string;
  readonly inputBusy: boolean;
  readonly calibrationName: string;
  readonly lookForwardAvailable: boolean;
  readonly onReceivePortInputChange: (value: string) => void;
  readonly onIphoneHostInputChange: (value: string) => void;
  readonly onConnectInput: () => void;
  readonly onDisconnectInput: () => void;
  readonly onLookForward: () => void;
  readonly onSetActiveProfile: (profileId: string) => void;
  readonly onUseTemporaryDefaults: () => void;
  readonly onStartCalibration: (
    request?: RuntimePlayerInputProfileStartCalibrationRequest
  ) => void;
  readonly onCancelCalibration: () => void;
  readonly onRecordCalibrationSample: () => void;
  readonly onAdvanceCalibrationPrompt: () => void;
  readonly onFinishCalibration: () => void;
  readonly onCalibrationNameChange: (value: string) => void;
}): ReactElement {
  const inputActive = isInputReceiverActive(inputStatus);
  const inputDisconnectEnabled =
    inputStatus !== null && inputStatus.connectionState !== "idle";
  const calibration = profileStatus?.calibration ?? null;
  const activeProfile = profileStatus?.activeProfile ?? null;
  const calibrationSections = activeProfile?.calibrationSections ?? [];
  const hasMissingCalibrationSection = calibrationSections.some(
    (section) => section.status === "missing"
  );
  const headPositionLeftRightReady = calibrationSections.some(
    (section) =>
      section.key === "head-position-left-right" && section.status === "ready"
  );
  const missingOnlyDisabled =
    activeProfile !== null && !hasMissingCalibrationSection;
  const canUpdateSavedProfile =
    profileStatus?.profileMode === "saved" &&
    activeProfile !== null &&
    !profileStatus.temporaryDefaultsActive;

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Source">
          <StatusRow label="Source" value="iFacialMocap" />
          <StatusRow label="Transport" value="UDP" />
          <StatusRow
            label="Connection"
            value={getInputConnectionLabel(inputStatus)}
          />
          <StatusRow label="Local IP" value={formatInputLocalIps(inputStatus)} />
          <StatusRow label="Remote" value={formatInputRemote(inputStatus)} />
          <StatusRow label="FPS" value={formatInputFps(inputStatus)} />
          <StatusRow
            label="Last packet"
            value={formatInputLastPacket(inputStatus)}
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
                onChange={(event) =>
                  onReceivePortInputChange(event.target.value)
                }
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
                onChange={(event) =>
                  onIphoneHostInputChange(event.target.value)
                }
                disabled={inputActive || inputBusy}
                placeholder="Optional"
                className="min-h-10 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-teal-500 disabled:opacity-60"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <IconTextButton
              icon={Activity}
              label={inputBusy ? "Connecting" : "Connect"}
              onClick={onConnectInput}
              variant="secondary"
              disabled={inputBusy || inputActive}
            />
            <IconTextButton
              icon={Unplug}
              label="Disconnect"
              onClick={onDisconnectInput}
              variant="ghost"
              disabled={inputBusy || !inputDisconnectEnabled}
            />
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
            <Activity aria-hidden="true" className="size-4 text-teal-300" />
            <span>{getInputActivityLabel(inputStatus)}</span>
          </div>
        </Panel>

        <Panel title="Input Profile">
          <StatusRow label="Profile" value={getProfileStatusLabel(profileStatus)} />
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
          {profileStatus?.temporaryDefaultsActive ? (
            <StatusPill tone="amber">Temporary</StatusPill>
          ) : null}
          {profileStatus?.storage.warningMessages.length ? (
            <ErrorNotice
              title="Input profile warning"
              details={profileStatus.storage.warningMessages}
            />
          ) : null}
          {profileStatus !== null && profileStatus.profiles.length > 0 ? (
            <label className="mt-3 grid gap-1 text-sm">
              <span className="text-xs font-semibold text-neutral-500">
                Saved profile
              </span>
              <select
                value={profileStatus.activeProfileId ?? ""}
                onChange={(event) => onSetActiveProfile(event.target.value)}
                className="min-h-10 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-neutral-100 outline-none focus:border-teal-500"
              >
                {profileStatus.profiles.map((profile) => (
                  <option key={profile.profileId} value={profile.profileId}>
                    {profile.displayName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {calibrationSections.length > 0 ? (
            <div className="mt-3 grid gap-2">
              <p className="text-xs font-semibold text-neutral-500">
                Calibration sections
              </p>
              {calibrationSections.map((section) => (
                <CalibrationSectionRow
                  key={section.key}
                  section={section}
                  canUpdateSection={
                    canUpdateSavedProfile &&
                    (
                      section.key !== "head-position-near-far" ||
                      headPositionLeftRightReady
                    )
                  }
                  onCalibrateSection={() =>
                    onStartCalibration({
                      mode: "section",
                      section: section.key
                    })
                  }
                />
              ))}
            </div>
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
              icon={Play}
              label="Run Missing Only"
              onClick={() =>
                onStartCalibration({
                  mode: "missing-only"
                })
              }
              variant="secondary"
              disabled={missingOnlyDisabled}
            />
            <IconTextButton
              icon={RefreshCcw}
              label="Full Calibration"
              onClick={() =>
                onStartCalibration({
                  mode: "full"
                })
              }
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
      </section>

      {calibration !== null ? (
        <Panel title="Input Calibration">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-semibold text-neutral-500">
              Profile name
            </span>
            <input
              type="text"
              value={calibrationName}
              onChange={(event) => onCalibrationNameChange(event.target.value)}
              className="min-h-10 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-neutral-100 outline-none focus:border-teal-500"
            />
          </label>
          <StatusRow
            label="Progress"
            value={`${calibration.completedPromptCount} / ${calibration.totalPromptCount}`}
          />
          <StatusRow
            label="Current prompt"
            value={calibration.currentPrompt?.label ?? "Ready to finish"}
          />
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {calibration.prompts.map((prompt) => (
              <CalibrationPromptRow key={prompt.key} prompt={prompt} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <IconTextButton
              icon={Activity}
              label="Record Sample"
              onClick={onRecordCalibrationSample}
              variant="secondary"
              disabled={!lookForwardAvailable}
            />
            <IconTextButton
              icon={StepForward}
              label="Next Prompt"
              onClick={onAdvanceCalibrationPrompt}
              variant="ghost"
            />
            <IconTextButton
              icon={Save}
              label="Save Profile"
              onClick={onFinishCalibration}
              variant="primary"
              disabled={!calibration.canFinish}
            />
            <IconTextButton
              icon={X}
              label="Cancel"
              onClick={onCancelCalibration}
              variant="ghost"
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function CalibrationSectionRow({
  section,
  canUpdateSection,
  onCalibrateSection
}: {
  readonly section: RuntimePlayerInputCalibrationSectionStatus;
  readonly canUpdateSection: boolean;
  readonly onCalibrateSection: () => void;
}): ReactElement {
  const tone = section.status === "ready" ? "teal" : "amber";
  const showHeadPositionAction =
    section.key === "head-position-left-right" ||
    section.key === "head-position-near-far";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm">
      <p className="min-w-0 truncate font-medium text-neutral-100">
        {section.label}
      </p>
      <StatusPill tone={tone}>
        {section.status === "ready" ? "Ready" : "Missing"}
      </StatusPill>
      {showHeadPositionAction ? (
        <IconTextButton
          icon={RefreshCcw}
          label={section.status === "ready" ? "Recalibrate" : "Calibrate"}
          onClick={onCalibrateSection}
          variant="ghost"
          disabled={!canUpdateSection}
        />
      ) : null}
    </div>
  );
}

function CalibrationPromptRow({
  prompt
}: {
  readonly prompt: RuntimePlayerInputCalibrationPromptSnapshot;
}): ReactElement {
  const tone =
    prompt.status === "ok"
      ? "teal"
      : prompt.status === "needs-more"
        ? "amber"
        : "neutral";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium text-neutral-100">{prompt.label}</p>
        <p className="truncate text-xs text-neutral-500">{prompt.message}</p>
      </div>
      <StatusPill tone={tone}>
        {prompt.status === "ok"
          ? "ok"
          : `${prompt.sampleCount}/${prompt.requiredSampleCount}`}
      </StatusPill>
    </div>
  );
}
