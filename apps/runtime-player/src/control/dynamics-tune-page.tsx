import type { ReactElement } from "react";
import { RefreshCw, RotateCcw, SlidersHorizontal } from "lucide-react";

import {
  ErrorNotice,
  IconTextButton,
  Panel,
  StatusPill,
  StatusRow
} from "./control-window-components";
import { formatControlNumber } from "./control-window-formatters";
import type {
  RuntimePlayerDynamicsTuningGroupStatus,
  RuntimePlayerDynamicsTuningGroupUpdateRequest,
  RuntimePlayerDynamicsTuningParameterRef,
  RuntimePlayerDynamicsTuningStatus,
  RuntimePlayerDynamicsTuningValues
} from "../preload/dynamics-tuning-bridge-contract";

type DynamicsTuneNumericField =
  | "strength"
  | "limit"
  | "length"
  | "sway"
  | "reactionSpeed"
  | "convergenceSpeed";

type DynamicsTuneSliderSpec = {
  readonly field: DynamicsTuneNumericField;
  readonly label: string;
  readonly ariaLabel: string;
  readonly defaultMax: number;
  readonly min: number;
  readonly step: number;
};

const dynamicsTuneSliderSpecs: readonly DynamicsTuneSliderSpec[] = [
  {
    field: "strength",
    label: "Strength",
    ariaLabel: "Strength",
    defaultMax: 2,
    min: 0,
    step: 0.05
  },
  {
    field: "limit",
    label: "Limit",
    ariaLabel: "Limit",
    defaultMax: 2,
    min: 0,
    step: 0.05
  },
  {
    field: "length",
    label: "Length",
    ariaLabel: "Length",
    defaultMax: 5,
    min: 0.05,
    step: 0.05
  },
  {
    field: "sway",
    label: "Sway",
    ariaLabel: "Sway",
    defaultMax: 2,
    min: 0,
    step: 0.05
  },
  {
    field: "reactionSpeed",
    label: "Reaction",
    ariaLabel: "Reaction",
    defaultMax: 30,
    min: 0,
    step: 0.1
  },
  {
    field: "convergenceSpeed",
    label: "Convergence",
    ariaLabel: "Convergence",
    defaultMax: 30,
    min: 0,
    step: 0.1
  }
];

export function DynamicsTunePage({
  dynamicsStatus,
  onUpdateGroup,
  onResetGroup,
  onRetryProfileSave
}: {
  readonly dynamicsStatus: RuntimePlayerDynamicsTuningStatus | null;
  readonly onUpdateGroup: (
    request: RuntimePlayerDynamicsTuningGroupUpdateRequest
  ) => void;
  readonly onResetGroup: (groupId: string) => void;
  readonly onRetryProfileSave: () => void;
}): ReactElement {
  const statusLabel = dynamicsStatus?.profileStatus.label ?? "Checking";
  const groupCount = dynamicsStatus?.dynamicsGroupCount ?? 0;

  return (
    <div className="grid gap-4">
      <Panel title="Dynamics Tune">
        <StatusRow
          label="Runtime Export"
          value={dynamicsStatus?.runtimeExport?.modelDisplayName ?? "Not loaded"}
        />
        <StatusRow label="Profile" value={statusLabel} />
        <StatusRow
          label="Groups"
          value={
            dynamicsStatus === null
              ? "Checking"
              : `${dynamicsStatus.overriddenGroupCount} / ${groupCount} tuned`
          }
        />
        <StatusRow label="Persistence" value="Automatic" />
        {dynamicsStatus?.profileStatus.warningMessages.length ? (
          <ErrorNotice
            title="Dynamics tuning profile warning"
            details={dynamicsStatus.profileStatus.warningMessages}
          />
        ) : null}
        {dynamicsStatus?.profileStatus.kind === "save-failed" ? (
          <div className="mt-4">
            <IconTextButton
              icon={RefreshCw}
              label="Retry"
              onClick={onRetryProfileSave}
              variant="secondary"
            />
          </div>
        ) : null}
      </Panel>

      {renderDynamicsTuneContent({
        dynamicsStatus,
        onUpdateGroup,
        onResetGroup
      })}
    </div>
  );
}

function renderDynamicsTuneContent(input: {
  readonly dynamicsStatus: RuntimePlayerDynamicsTuningStatus | null;
  readonly onUpdateGroup: (
    request: RuntimePlayerDynamicsTuningGroupUpdateRequest
  ) => void;
  readonly onResetGroup: (groupId: string) => void;
}): ReactElement {
  if (input.dynamicsStatus === null) {
    return (
      <Panel title="Dynamics Groups">
        <EmptyDynamicsTuneState
          title="Checking dynamics tuning"
          message="Runtime Player is loading the dynamics tuning bridge status."
        />
      </Panel>
    );
  }

  if (input.dynamicsStatus.status === "unavailable") {
    return (
      <Panel title="Dynamics Groups">
        <EmptyDynamicsTuneState
          title="Runtime Export required"
          message="Open a Runtime Export to tune exported Dynamics Groups in Player."
        />
      </Panel>
    );
  }

  if (input.dynamicsStatus.groups.length === 0) {
    return (
      <Panel title="Dynamics Groups">
        <EmptyDynamicsTuneState
          title="No exported dynamics"
          message="This Runtime Export does not contain Dynamics Groups to tune."
        />
      </Panel>
    );
  }

  return (
    <Panel title="Dynamics Groups">
      <div className="grid gap-3">
        {input.dynamicsStatus.groups.map((group) => (
          <DynamicsTuneGroupCard
            key={group.groupId}
            group={group}
            onUpdateGroup={input.onUpdateGroup}
            onResetGroup={input.onResetGroup}
          />
        ))}
      </div>
    </Panel>
  );
}

function DynamicsTuneGroupCard({
  group,
  onUpdateGroup,
  onResetGroup
}: {
  readonly group: RuntimePlayerDynamicsTuningGroupStatus;
  readonly onUpdateGroup: (
    request: RuntimePlayerDynamicsTuningGroupUpdateRequest
  ) => void;
  readonly onResetGroup: (groupId: string) => void;
}): ReactElement {
  const effectiveValues = group.effectiveValues;

  return (
    <section className="grid gap-3 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-neutral-100">
              {group.displayName}
            </h3>
            <StatusPill tone={effectiveValues.enabled ? "teal" : "neutral"}>
              {effectiveValues.enabled ? "Enabled" : "Disabled"}
            </StatusPill>
            <StatusPill tone={group.hasOverride ? "amber" : "neutral"}>
              {group.hasOverride ? "Tuned" : "Export defaults"}
            </StatusPill>
          </div>
          <p className="mt-1 truncate text-xs text-neutral-500">
            {formatGroupParameterCounts(group)}
          </p>
        </div>
        <label className="inline-flex min-h-8 items-center gap-2 text-xs font-semibold text-neutral-200">
          <input
            type="checkbox"
            aria-label={`Dynamics Tune ${group.displayName} Enabled`}
            checked={effectiveValues.enabled}
            onChange={(event) =>
              onUpdateGroup({
                groupId: group.groupId,
                enabled: event.currentTarget.checked
              })
            }
            className="size-4 accent-teal-400"
          />
          Enabled
        </label>
        <IconTextButton
          icon={RotateCcw}
          label={`Reset ${group.displayName}`}
          onClick={() => onResetGroup(group.groupId)}
          variant="ghost"
          disabled={!group.hasOverride}
        />
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <ParameterSummary label="Inputs" refs={group.inputSummary} />
        <ParameterSummary label="Outputs" refs={group.outputSummary} />
      </div>

      <div className="grid gap-3 border-t border-neutral-800 pt-3 md:grid-cols-2 xl:grid-cols-3">
        {dynamicsTuneSliderSpecs.map((spec) => (
          <DynamicsTuneSlider
            key={spec.field}
            spec={spec}
            group={group}
            onUpdateGroup={onUpdateGroup}
          />
        ))}
      </div>

      {group.warningMessages.length > 0 ? (
        <ErrorNotice
          title="Dynamics group warning"
          details={group.warningMessages}
        />
      ) : null}
    </section>
  );
}

function ParameterSummary({
  label,
  refs
}: {
  readonly label: string;
  readonly refs: readonly RuntimePlayerDynamicsTuningParameterRef[];
}): ReactElement {
  return (
    <div className="rounded-md border border-neutral-800 bg-[#111312] px-3 py-2 text-xs">
      <p className="font-semibold uppercase text-neutral-500">{label}</p>
      <p className="mt-1 min-h-5 break-words text-neutral-200">
        {formatParameterRefs(refs)}
      </p>
    </div>
  );
}

function DynamicsTuneSlider({
  spec,
  group,
  onUpdateGroup
}: {
  readonly spec: DynamicsTuneSliderSpec;
  readonly group: RuntimePlayerDynamicsTuningGroupStatus;
  readonly onUpdateGroup: (
    request: RuntimePlayerDynamicsTuningGroupUpdateRequest
  ) => void;
}): ReactElement {
  const value = group.effectiveValues[spec.field];
  const exportedValue = group.exportedValues[spec.field];
  const range = createSliderRange({
    spec,
    value,
    exportedValue
  });

  return (
    <label className="grid gap-1 text-xs font-semibold text-neutral-200">
      <span className="flex min-w-0 items-center justify-between gap-3">
        <span>{spec.label}</span>
        <span className="shrink-0 text-neutral-400">
          {formatTuningNumber(value)}
        </span>
      </span>
      <input
        type="range"
        aria-label={`Dynamics Tune ${group.displayName} ${spec.ariaLabel}`}
        min={range.min}
        max={range.max}
        step={spec.step}
        value={value}
        disabled={!group.effectiveValues.enabled}
        onChange={(event) =>
          onUpdateGroup(createGroupNumberUpdate({
            groupId: group.groupId,
            field: spec.field,
            value: Number(event.currentTarget.value)
          }))
        }
        className="w-full accent-teal-400"
      />
      <span className="text-[0.68rem] font-medium text-neutral-500">
        Export default {formatTuningNumber(exportedValue)}
      </span>
    </label>
  );
}

function EmptyDynamicsTuneState({
  title,
  message
}: {
  readonly title: string;
  readonly message: string;
}): ReactElement {
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-100">{title}</p>
          <p className="mt-1 text-sm text-neutral-400">{message}</p>
        </div>
      </div>
    </div>
  );
}

function createGroupNumberUpdate(input: {
  readonly groupId: string;
  readonly field: DynamicsTuneNumericField;
  readonly value: number;
}): RuntimePlayerDynamicsTuningGroupUpdateRequest {
  return {
    groupId: input.groupId,
    [input.field]: input.value
  };
}

function createSliderRange(input: {
  readonly spec: DynamicsTuneSliderSpec;
  readonly value: number;
  readonly exportedValue: number;
}): {
  readonly min: number;
  readonly max: number;
} {
  const min = Math.min(input.spec.min, input.value, input.exportedValue);
  const max = Math.max(
    input.spec.defaultMax,
    input.value,
    input.exportedValue
  );

  return {
    min: roundSliderBoundary(min),
    max: roundSliderBoundary(max <= min ? min + input.spec.step : max)
  };
}

function formatParameterRefs(
  refs: readonly RuntimePlayerDynamicsTuningParameterRef[]
): string {
  if (refs.length === 0) {
    return "None";
  }

  const visible = refs.slice(0, 3).map(formatParameterRef);
  if (refs.length <= visible.length) {
    return visible.join(", ");
  }

  return `${visible.join(", ")} +${refs.length - visible.length} more`;
}

function formatParameterRef(
  ref: RuntimePlayerDynamicsTuningParameterRef
): string {
  const name = ref.displayName ?? ref.parameterId;

  return `${name} (${ref.kind})`;
}

function formatGroupParameterCounts(
  group: RuntimePlayerDynamicsTuningGroupStatus
): string {
  return `${formatParameterCount(group.inputSummary.length, "input")} / ${formatParameterCount(group.outputSummary.length, "output")}`;
}

function formatParameterCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function formatTuningNumber(value: number): string {
  if (Math.abs(value) < 100) {
    return formatControlNumber(Math.round(value * 10) / 10);
  }

  return formatControlNumber(value);
}

function roundSliderBoundary(value: number): number {
  return Math.round(value * 100) / 100;
}
