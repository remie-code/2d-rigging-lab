import type { ReactElement } from "react";
import {
  Activity,
  Check,
  Crosshair,
  LocateFixed,
  RefreshCcw
} from "lucide-react";

import {
  EmptySubsystemNotice,
  IconTextButton,
  Panel,
  StatusPill,
  StatusRow
} from "./control-window-components";
import type {
  RuntimePlayerInputStatus
} from "../preload/input-bridge-contract";
import type {
  RuntimePlayerBrowserSourceStatus
} from "../preload/browser-source-status-contract";
import type {
  RuntimePlayerStageMotionSettingsUpdate,
  RuntimePlayerStageStateSnapshot
} from "../preload/runtime-player-bridge-contract";
import type {
  RuntimeExportStatus
} from "../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerVariantControllerStatus,
  RuntimePlayerVariantControlGroup
} from "../preload/runtime-variant-bridge-contract";

export function LiveControllerPage({
  variantStatus,
  runtimeExportStatus,
  inputStatus,
  browserSourceStatus,
  stageState,
  lookForwardAvailable,
  drivenByPhysiology = false,
  onSelectSingleVariant,
  onToggleMultiVariant,
  onResetVariants,
  onLookForward,
  onCenterModel,
  onUpdateStageMotionSettings,
  onOpenPhysiology = () => undefined
}: {
  readonly variantStatus: RuntimePlayerVariantControllerStatus | null;
  readonly runtimeExportStatus: RuntimeExportStatus | null;
  readonly inputStatus: RuntimePlayerInputStatus | null;
  readonly browserSourceStatus: RuntimePlayerBrowserSourceStatus | null;
  readonly stageState: RuntimePlayerStageStateSnapshot | null;
  readonly lookForwardAvailable: boolean;
  /**
   * DATA: Stage presence is driven by Physiology on this host (Autonomous Host).
   * Optional so tracking-host tests keep their existing call sites; the app always
   * supplies it. Defaults to the tracking path (false).
   */
  readonly drivenByPhysiology?: boolean;
  readonly onSelectSingleVariant: (
    group: RuntimePlayerVariantControlGroup,
    variantId: string
  ) => void;
  readonly onToggleMultiVariant: (
    group: RuntimePlayerVariantControlGroup,
    variantId: string,
    active: boolean
  ) => void;
  readonly onResetVariants: () => void;
  readonly onLookForward: () => void;
  readonly onCenterModel: () => void;
  readonly onUpdateStageMotionSettings: (
    update: RuntimePlayerStageMotionSettingsUpdate
  ) => void;
  readonly onOpenPhysiology?: () => void;
}): ReactElement {
  const stageMotionEnabled =
    stageState?.stageMotion.settings.enabled ?? false;

  return (
    <div className="grid gap-4">
      <Panel title="Status">
        <div className="grid gap-2 lg:grid-cols-3">
          <StatusRow
            label="Model"
            value={formatModelStatus(runtimeExportStatus)}
          />
          <StatusRow label="Input" value={formatInputStatus(inputStatus)} />
          <StatusRow
            label="Browser Source"
            value={formatBrowserSourceStatus(browserSourceStatus)}
          />
        </div>
      </Panel>

      <Panel title="Variants">
        {renderVariantBody({
          variantStatus,
          onSelectSingleVariant,
          onToggleMultiVariant
        })}
        <div className="mt-3 flex flex-wrap gap-2">
          <IconTextButton
            icon={RefreshCcw}
            label="Reset to Model Default"
            onClick={onResetVariants}
            variant="secondary"
            disabled={!variantStatus?.controlsEnabled}
          />
        </div>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title="Recenter">
          <IconTextButton
            icon={Crosshair}
            label="Look Forward"
            onClick={onLookForward}
            variant="primary"
            disabled={!lookForwardAvailable}
          />
        </Panel>

        <Panel title="Motion Safety">
          {drivenByPhysiology ? (
            // Degraded解消 (UX §3): the Stage Motion toggle is押せるが効かない on the
            // Autonomous Host (input null で毎tick reset). Show the品位ある一文 and
            // route to Physiology (別意味論の生理駆動Stage) instead. DATA-driven.
            <EmptySubsystemNotice
              title="Driven by Physiology"
              message="Stage presence is driven by Physiology on this host."
              action={{ label: "Open Physiology", onClick: onOpenPhysiology }}
            />
          ) : (
            <button
              type="button"
              aria-label="Toggle Stage Motion"
              aria-pressed={stageMotionEnabled}
              disabled={stageState === null}
              onClick={() =>
                onUpdateStageMotionSettings({
                  enabled: !stageMotionEnabled
                })
              }
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                stageMotionEnabled
                  ? "border-teal-500 bg-teal-500 text-neutral-950 hover:bg-teal-400"
                  : "border-neutral-700 bg-neutral-900 text-neutral-100 hover:border-teal-500/70 hover:text-teal-100"
              }`}
            >
              <Activity aria-hidden="true" className="size-4 shrink-0" />
              <span>Stage Motion {stageMotionEnabled ? "On" : "Off"}</span>
            </button>
          )}
        </Panel>

        <Panel title="View Recovery">
          <IconTextButton
            icon={LocateFixed}
            label="Center Model"
            onClick={onCenterModel}
            variant="secondary"
            disabled={stageState?.stageWindow.windowState === "destroyed"}
          />
        </Panel>
      </section>
    </div>
  );
}

function renderVariantBody(input: {
  readonly variantStatus: RuntimePlayerVariantControllerStatus | null;
  readonly onSelectSingleVariant: (
    group: RuntimePlayerVariantControlGroup,
    variantId: string
  ) => void;
  readonly onToggleMultiVariant: (
    group: RuntimePlayerVariantControlGroup,
    variantId: string,
    active: boolean
  ) => void;
}): ReactElement {
  if (input.variantStatus === null) {
    return (
      <div className="rounded-md border border-neutral-800 bg-[#111312] p-3 text-sm text-neutral-300">
        Checking Variant state.
      </div>
    );
  }

  if (input.variantStatus.state === "legacy-export") {
    return (
      <div className="grid gap-3">
        <VariantStatusNotice status={input.variantStatus} />
        {input.variantStatus.groups.map((group) => (
          <VariantGroupControls
            key={group.variantGroupId}
            group={group}
            disabled
            onSelectSingleVariant={input.onSelectSingleVariant}
            onToggleMultiVariant={input.onToggleMultiVariant}
          />
        ))}
      </div>
    );
  }

  if (input.variantStatus.groups.length === 0) {
    return <VariantStatusNotice status={input.variantStatus} />;
  }

  return (
    <div className="grid gap-3">
      {input.variantStatus.groups.map((group) => (
        <VariantGroupControls
          key={group.variantGroupId}
          group={group}
          disabled={!input.variantStatus?.controlsEnabled}
          onSelectSingleVariant={input.onSelectSingleVariant}
          onToggleMultiVariant={input.onToggleMultiVariant}
        />
      ))}
    </div>
  );
}

function VariantStatusNotice({
  status
}: {
  readonly status: RuntimePlayerVariantControllerStatus;
}): ReactElement {
  return (
    <div className="rounded-md border border-neutral-800 bg-[#111312] p-3 text-sm text-neutral-300">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={status.state === "ready" ? "teal" : "amber"}>
          {status.statusLabel}
        </StatusPill>
      </div>
      {status.guidance === null ? null : (
        <p className="mt-2 text-xs text-neutral-400">{status.guidance}</p>
      )}
    </div>
  );
}

function VariantGroupControls({
  group,
  disabled,
  onSelectSingleVariant,
  onToggleMultiVariant
}: {
  readonly group: RuntimePlayerVariantControlGroup;
  readonly disabled: boolean;
  readonly onSelectSingleVariant: (
    group: RuntimePlayerVariantControlGroup,
    variantId: string
  ) => void;
  readonly onToggleMultiVariant: (
    group: RuntimePlayerVariantControlGroup,
    variantId: string,
    active: boolean
  ) => void;
}): ReactElement {
  return (
    <section className="grid gap-2 border-t border-neutral-800 pt-3 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h3 className="min-w-0 text-sm font-semibold text-neutral-100">
          {group.displayName}
        </h3>
        <StatusPill tone="neutral">
          {group.mode === "singleSelect" ? "Single" : "Multi"}
        </StatusPill>
      </div>
      <div className="flex flex-wrap gap-2">
        {group.variants.map((variant) => (
          <button
            type="button"
            key={variant.variantId}
            aria-label={`${group.displayName} ${variant.displayName}`}
            aria-pressed={variant.active}
            disabled={disabled}
            onClick={() => {
              if (group.mode === "singleSelect") {
                onSelectSingleVariant(group, variant.variantId);
                return;
              }

              onToggleMultiVariant(group, variant.variantId, !variant.active);
            }}
            className={`inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
              variant.active
                ? "border-teal-500 bg-teal-500 text-neutral-950"
                : "border-neutral-700 bg-neutral-900 text-neutral-100 hover:border-teal-500/70 hover:text-teal-100"
            }`}
          >
            {variant.active ? (
              <Check aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <span
                aria-hidden="true"
                className="size-4 shrink-0 rounded-full border border-neutral-500"
              />
            )}
            <span>{variant.displayName}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function formatModelStatus(status: RuntimeExportStatus | null): string {
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

function formatInputStatus(status: RuntimePlayerInputStatus | null): string {
  if (status === null) {
    return "Checking";
  }

  if (status.connectionState === "receiving") {
    return status.estimatedFps === undefined
      ? "Live"
      : `Live ${Math.round(status.estimatedFps)} fps`;
  }

  if (status.connectionState === "listening") {
    return "Listening";
  }

  if (status.connectionState === "stale") {
    return "Stale";
  }

  if (status.connectionState === "error") {
    return "Error";
  }

  return "Not connected";
}

function formatBrowserSourceStatus(
  status: RuntimePlayerBrowserSourceStatus | null
): string {
  if (status === null) {
    return "Checking";
  }

  if (status.connectedClientCount > 0) {
    return `${status.connectedClientCount} client${
      status.connectedClientCount === 1 ? "" : "s"
    }`;
  }

  if (status.state === "running") {
    return "No client";
  }

  return status.statusLabel;
}
