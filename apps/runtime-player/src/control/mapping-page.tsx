import type { ReactElement } from "react";
import { FolderOpen, Plug, RefreshCw, SlidersHorizontal } from "lucide-react";

import {
  IconTextButton,
  Panel,
  StatusPill,
  StatusRow
} from "./control-window-components";
import {
  getAutoMappingLabel,
  getInputConnectionLabel,
  getLiveReadinessLabel,
  getProfileStatusLabel,
  getRuntimeExportLoadedLabel
} from "./control-window-formatters";
import type {
  RuntimePlayerInputStatus
} from "../preload/input-bridge-contract";
import type {
  RuntimePlayerInputProfileStatus
} from "../preload/input-profile-bridge-contract";
import type {
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingSlotUpdateRequest,
  RuntimePlayerMappingStatus
} from "../preload/model-mapping-bridge-contract";
import type {
  RuntimeExportStatus
} from "../preload/runtime-export-bridge-contract";

export function MappingPage({
  runtimeExportStatus,
  inputStatus,
  profileStatus,
  mappingStatus,
  onOpenRuntimeExport,
  onConnectInput,
  onStartCalibration,
  onAutoMap,
  onUpdateSlot
}: {
  readonly runtimeExportStatus: RuntimeExportStatus | null;
  readonly inputStatus: RuntimePlayerInputStatus | null;
  readonly profileStatus: RuntimePlayerInputProfileStatus | null;
  readonly mappingStatus: RuntimePlayerMappingStatus | null;
  readonly onOpenRuntimeExport: () => void;
  readonly onConnectInput: () => void;
  readonly onStartCalibration: () => void;
  readonly onAutoMap: () => void;
  readonly onUpdateSlot: (request: RuntimePlayerMappingSlotUpdateRequest) => void;
}): ReactElement {
  return (
    <div className="grid gap-4">
      <Panel title="Mapping Readiness">
        <StatusRow
          label="Runtime Export"
          value={getRuntimeExportLoadedLabel(runtimeExportStatus)}
        />
        <StatusRow
          label="Input"
          value={getInputConnectionLabel(inputStatus)}
        />
        <StatusRow
          label="Input Profile"
          value={getProfileStatusLabel(profileStatus)}
        />
        <StatusRow
          label="Live"
          value={getLiveReadinessLabel({
            runtimeExportStatus,
            inputStatus,
            profileStatus,
            mappingStatus
          })}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <IconTextButton
            icon={FolderOpen}
            label="Open Runtime Export"
            onClick={onOpenRuntimeExport}
            variant="secondary"
          />
          <IconTextButton
            icon={Plug}
            label="Connect Input"
            onClick={onConnectInput}
            variant="ghost"
          />
          <IconTextButton
            icon={SlidersHorizontal}
            label="Start Calibration"
            onClick={onStartCalibration}
            variant="ghost"
          />
          <IconTextButton
            icon={RefreshCw}
            label="Auto Map"
            onClick={onAutoMap}
            variant="ghost"
            disabled={runtimeExportStatus?.status !== "loaded"}
          />
        </div>
      </Panel>

      <Panel title="Semantic Slots">
        <StatusRow label="Auto Mapping" value={getAutoMappingLabel(mappingStatus)} />
        <div className="mt-3 grid gap-3">
          {groupMappingSlots(mappingStatus).map((group) => (
            <section key={group.label} className="grid gap-2">
              <h3 className="text-xs font-semibold uppercase text-neutral-500">
                {group.label}
              </h3>
              <div className="grid gap-2">
                {group.slots.map((slot) => (
                  <MappingSlotRow
                    key={slot.slotId}
                    slot={slot}
                    onUpdateSlot={onUpdateSlot}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function MappingSlotRow({
  slot,
  onUpdateSlot
}: {
  readonly slot: RuntimePlayerMappingSlot;
  readonly onUpdateSlot: (request: RuntimePlayerMappingSlotUpdateRequest) => void;
}): ReactElement {
  return (
    <div className="grid gap-3 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-3 text-sm xl:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_auto_auto_minmax(10rem,14rem)] xl:items-center">
      <div className="min-w-0">
        <div className="font-medium text-neutral-100">{slot.label}</div>
        <div className="mt-1 text-xs text-neutral-500">
          {slot.target?.projectPresetAlias ?? "No target alias"}
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate font-medium text-neutral-200">
          {slot.target?.displayName ?? "Unmapped"}
        </div>
        <div className="mt-1 text-xs text-neutral-500">
          {slot.target?.parameterId ?? "Missing target parameter"}
        </div>
      </div>
      <StatusPill tone={getSlotPillTone(slot)}>
        {getSlotPillLabel(slot)}
      </StatusPill>
      <label className="inline-flex min-h-8 items-center gap-2 text-xs font-semibold text-neutral-200">
        <input
          type="checkbox"
          checked={slot.enabled}
          disabled={slot.target === null}
          onChange={(event) =>
            onUpdateSlot({
              slotId: slot.slotId,
              enabled: event.currentTarget.checked
            })
          }
          className="size-4 accent-teal-400"
        />
        Enabled
      </label>
      <div className="grid gap-2 sm:grid-cols-[auto_minmax(8rem,1fr)] sm:items-center xl:grid-cols-1">
        <label className="inline-flex min-h-8 items-center gap-2 text-xs font-semibold text-neutral-200">
          <input
            type="checkbox"
            checked={slot.invert}
            disabled={slot.target === null}
            onChange={(event) =>
              onUpdateSlot({
                slotId: slot.slotId,
                invert: event.currentTarget.checked
              })
            }
            className="size-4 accent-teal-400"
          />
          Invert
        </label>
        <label className="grid gap-1 text-xs font-semibold text-neutral-200">
          <span>Strength {Math.round(slot.strength * 100)}%</span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={slot.strength}
            disabled={slot.target === null || !slot.enabled}
            onChange={(event) =>
              onUpdateSlot({
                slotId: slot.slotId,
                strength: Number(event.currentTarget.value)
              })
            }
            className="w-full accent-teal-400"
          />
        </label>
      </div>
    </div>
  );
}

function groupMappingSlots(
  status: RuntimePlayerMappingStatus | null
): readonly {
  readonly label: string;
  readonly slots: readonly RuntimePlayerMappingSlot[];
}[] {
  const slots = status?.slots ?? [];

  return [
    {
      label: "Head",
      slots: slots.filter((slot) => slot.group === "head")
    },
    {
      label: "Eyes",
      slots: slots.filter((slot) => slot.group === "eyes")
    },
    {
      label: "Mouth",
      slots: slots.filter((slot) => slot.group === "mouth")
    }
  ].filter((group) => group.slots.length > 0);
}

function getSlotPillTone(
  slot: RuntimePlayerMappingSlot
): "amber" | "teal" | "red" | "neutral" {
  if (slot.target === null) {
    return "amber";
  }

  return slot.enabled ? "teal" : "neutral";
}

function getSlotPillLabel(slot: RuntimePlayerMappingSlot): string {
  if (slot.target === null) {
    return "Missing";
  }

  return slot.enabled ? "Mapped" : "Off";
}
