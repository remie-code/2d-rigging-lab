import type { ReactElement } from "react";
import { Crosshair } from "lucide-react";

import {
  EmptySubsystemNotice,
  Panel,
  StatusPill,
  StatusRow
} from "./control-window-components";
import { formatControlNumber } from "./control-window-formatters";
import type {
  RuntimePlayerInputProfileStatus
} from "../preload/input-profile-bridge-contract";
import type {
  RuntimePlayerStageMotionSettings,
  RuntimePlayerStageMotionSettingsUpdate
} from "../preload/runtime-player-bridge-contract";

export function StageMotionPanel({
  settings,
  persistenceLabel,
  inputProfileStatus,
  drivenByPhysiology,
  onUpdateSettings,
  onStartDepthScaleCalibration
}: {
  readonly settings: RuntimePlayerStageMotionSettings | null;
  readonly persistenceLabel: string;
  readonly inputProfileStatus: RuntimePlayerInputProfileStatus | null;
  /** DATA: Stage presence is driven by Physiology on this host (Autonomous Host). */
  readonly drivenByPhysiology: boolean;
  readonly onUpdateSettings: (
    update: RuntimePlayerStageMotionSettingsUpdate
  ) => void;
  readonly onStartDepthScaleCalibration: () => void;
}): ReactElement {
  // Degraded解消 (UX §3): on the Autonomous Host the tracking-driven Stage Motion
  // sliders are inert (押せるが効かない). Show the品位ある一文 instead. DATA-driven.
  if (drivenByPhysiology) {
    return (
      <Panel title="Stage Motion">
        <EmptySubsystemNotice
          title="Driven by Physiology"
          message="Stage presence is driven by Physiology on this host."
        />
      </Panel>
    );
  }

  const disabled = settings === null;
  const depthCalibration = getDepthScaleCalibrationState(inputProfileStatus);
  const horizontal = settings?.horizontal ?? {
    strengthPx: 0,
    limitPx: 0,
    invert: false
  };
  const scale = settings?.scale ?? {
    strength: 0,
    limit: 0,
    invert: false
  };

  return (
    <Panel title="Stage Motion">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center xl:grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_auto]">
        <StageMotionCheckbox
          label="Enabled"
          ariaLabel="Stage Motion Enabled"
          checked={settings?.enabled ?? false}
          disabled={disabled}
          onChange={(enabled) => onUpdateSettings({ enabled })}
        />
        <StatusRow label="Auto Save" value={persistenceLabel} />
      </div>

      <div className="grid gap-3 2xl:grid-cols-3">
        <section className="grid gap-2 border-t border-neutral-800 pt-3">
          <h3 className="text-xs font-semibold uppercase text-neutral-500">
            Horizontal Follow
          </h3>
          <StageMotionSlider
            label="Strength"
            ariaLabel="Stage Motion Horizontal Follow Strength"
            value={horizontal.strengthPx}
            min={0}
            max={300}
            step={5}
            disabled={disabled}
            formatValue={(value) => `${formatControlNumber(value)} px`}
            onChange={(strengthPx) =>
              onUpdateSettings({
                horizontal: {
                  strengthPx
                }
              })
            }
          />
          <StageMotionSlider
            label="Limit"
            ariaLabel="Stage Motion Horizontal Follow Limit"
            value={horizontal.limitPx}
            min={0}
            max={500}
            step={5}
            disabled={disabled}
            formatValue={(value) => `${formatControlNumber(value)} px`}
            onChange={(limitPx) =>
              onUpdateSettings({
                horizontal: {
                  limitPx
                }
              })
            }
          />
          <StageMotionCheckbox
            label="Invert"
            ariaLabel="Stage Motion Horizontal Follow Invert"
            checked={horizontal.invert}
            disabled={disabled}
            onChange={(invert) =>
              onUpdateSettings({
                horizontal: {
                  invert
                }
              })
            }
          />
        </section>

        <section className="grid gap-2 border-t border-neutral-800 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-semibold uppercase text-neutral-500">
              Depth Scale
            </h3>
            <StatusPill tone={depthCalibration.tone}>
              {depthCalibration.label}
            </StatusPill>
          </div>
          {depthCalibration.missing ? (
            <button
              type="button"
              aria-label="Calibrate Depth Scale in Input"
              onClick={onStartDepthScaleCalibration}
              disabled={depthCalibration.actionDisabled}
              className="inline-flex min-h-8 w-fit items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-2.5 text-xs font-semibold text-neutral-100 transition hover:border-teal-500/70 hover:text-teal-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Crosshair aria-hidden="true" className="size-3.5 shrink-0" />
              <span>Calibrate in Input</span>
            </button>
          ) : null}
          <StageMotionSlider
            label="Strength"
            ariaLabel="Stage Motion Depth Scale Strength"
            value={scale.strength}
            min={0}
            max={0.3}
            step={0.01}
            disabled={disabled}
            formatValue={formatScalePercent}
            onChange={(strength) =>
              onUpdateSettings({
                scale: {
                  strength
                }
              })
            }
          />
          <StageMotionSlider
            label="Limit"
            ariaLabel="Stage Motion Depth Scale Limit"
            value={scale.limit}
            min={0}
            max={0.5}
            step={0.01}
            disabled={disabled}
            formatValue={formatScalePercent}
            onChange={(limit) =>
              onUpdateSettings({
                scale: {
                  limit
                }
              })
            }
          />
          <StageMotionCheckbox
            label="Invert"
            ariaLabel="Stage Motion Depth Scale Invert"
            checked={scale.invert}
            disabled={disabled}
            onChange={(invert) =>
              onUpdateSettings({
                scale: {
                  invert
                }
              })
            }
          />
        </section>

        <section className="grid gap-2 border-t border-neutral-800 pt-3">
          <h3 className="text-xs font-semibold uppercase text-neutral-500">
            Stabilization
          </h3>
          <StageMotionSlider
            label="Dead zone"
            ariaLabel="Stage Motion Stabilization Dead Zone"
            value={settings?.deadZone ?? 0}
            min={0}
            max={0.2}
            step={0.01}
            disabled={disabled}
            formatValue={(value) => value.toFixed(2)}
            onChange={(deadZone) =>
              onUpdateSettings({
                deadZone
              })
            }
          />
          <StageMotionSlider
            label="Reaction"
            ariaLabel="Stage Motion Stabilization Reaction"
            value={settings?.reaction ?? 0}
            min={0}
            max={20}
            step={0.5}
            disabled={disabled}
            formatValue={formatControlNumber}
            onChange={(reaction) =>
              onUpdateSettings({
                reaction
              })
            }
          />
        </section>
      </div>
    </Panel>
  );
}

function StageMotionSlider({
  label,
  ariaLabel,
  value,
  min,
  max,
  step,
  disabled,
  formatValue,
  onChange
}: {
  readonly label: string;
  readonly ariaLabel: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly disabled: boolean;
  readonly formatValue: (value: number) => string;
  readonly onChange: (value: number) => void;
}): ReactElement {
  return (
    <label className="grid gap-1 text-xs font-semibold text-neutral-200">
      <span className="flex min-w-0 items-center justify-between gap-3">
        <span>{label}</span>
        <span className="shrink-0 text-neutral-400">{formatValue(value)}</span>
      </span>
      <input
        type="range"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="w-full accent-teal-400"
      />
    </label>
  );
}

function StageMotionCheckbox({
  label,
  ariaLabel,
  checked,
  disabled,
  onChange
}: {
  readonly label: string;
  readonly ariaLabel: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (checked: boolean) => void;
}): ReactElement {
  return (
    <label className="inline-flex min-h-8 items-center gap-2 text-xs font-semibold text-neutral-200">
      <input
        type="checkbox"
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="size-4 accent-teal-400"
      />
      {label}
    </label>
  );
}

type DepthScaleCalibrationState = {
  readonly label: string;
  readonly tone: "amber" | "teal" | "neutral";
  readonly missing: boolean;
  readonly actionDisabled: boolean;
};

function getDepthScaleCalibrationState(
  status: RuntimePlayerInputProfileStatus | null
): DepthScaleCalibrationState {
  if (status === null) {
    return {
      label: "Checking",
      tone: "neutral",
      missing: false,
      actionDisabled: true
    };
  }

  const nearFarSection = status.activeProfile?.calibrationSections.find(
    (section) => section.key === "head-position-near-far"
  );

  if (nearFarSection?.status === "ready") {
    return {
      label: "Ready",
      tone: "teal",
      missing: false,
      actionDisabled: false
    };
  }

  return {
    label: status.activeProfile === null ? "No profile" : "Missing",
    tone: "amber",
    missing: true,
    actionDisabled: false
  };
}

function formatScalePercent(value: number): string {
  return `${formatControlNumber(value * 100)}%`;
}
