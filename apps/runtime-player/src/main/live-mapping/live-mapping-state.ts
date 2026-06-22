import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerMappingRuntimeExportRef,
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingSlotUpdateRequest,
  RuntimePlayerMappingStatus
} from "../../preload/model-mapping-bridge-contract";
import { createAutoMappingSlots } from "./runtime-export-auto-mapping";

export type RuntimePlayerLiveMappingStateOptions = {
  readonly nowMs?: () => number;
};

export class RuntimePlayerLiveMappingState {
  private readonly nowMs: () => number;
  private runtimeExportPayload: RuntimeExportLoadedPayload | null = null;
  private slots: readonly RuntimePlayerMappingSlot[] = [];
  private updatedAtMs: number;

  constructor(options: RuntimePlayerLiveMappingStateOptions = {}) {
    this.nowMs = options.nowMs ?? Date.now;
    this.updatedAtMs = this.nowMs();
  }

  getRuntimeExportPayload(): RuntimeExportLoadedPayload | null {
    return this.runtimeExportPayload;
  }

  getSlots(): readonly RuntimePlayerMappingSlot[] {
    return this.slots;
  }

  setRuntimeExportPayload(payload: RuntimeExportLoadedPayload): RuntimePlayerMappingStatus {
    this.runtimeExportPayload = payload;
    this.slots = createAutoMappingSlots(payload);
    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  clearRuntimeExport(): RuntimePlayerMappingStatus {
    this.runtimeExportPayload = null;
    this.slots = [];
    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  regenerateAutoMapping(): RuntimePlayerMappingStatus | null {
    if (this.runtimeExportPayload === null) {
      return null;
    }

    this.slots = createAutoMappingSlots(this.runtimeExportPayload);
    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  updateSlot(
    request: RuntimePlayerMappingSlotUpdateRequest
  ): RuntimePlayerMappingStatus {
    this.slots = this.slots.map((slot) => {
      if (slot.slotId !== request.slotId) {
        return slot;
      }

      const enabled = request.enabled ?? slot.enabled;
      const invert = request.invert ?? slot.invert;
      const strength = request.strength ?? slot.strength;

      return {
        ...slot,
        enabled,
        invert,
        strength,
        status: slot.target === null
          ? "missing-target"
          : enabled
            ? "mapped"
            : "disabled"
      };
    });
    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  getStatus(): RuntimePlayerMappingStatus {
    const mappedSlotCount = this.slots.filter((slot) =>
      slot.target !== null
    ).length;
    const enabledSlotCount = this.slots.filter((slot) =>
      slot.target !== null && slot.enabled
    ).length;
    const missingSlotCount = this.slots.filter((slot) =>
      slot.target === null
    ).length;

    return {
      status: this.runtimeExportPayload === null ? "unavailable" : "ready",
      statusLabel: this.runtimeExportPayload === null
        ? "Runtime Export required"
        : `Auto mapped ${mappedSlotCount} / ${this.slots.length}`,
      runtimeExport: this.runtimeExportPayload === null
        ? null
        : createRuntimeExportRef(this.runtimeExportPayload),
      slots: this.slots,
      mappedSlotCount,
      enabledSlotCount,
      missingSlotCount,
      updatedAtIso: new Date(this.updatedAtMs).toISOString()
    };
  }
}

export function createRuntimeExportRef(
  payload: RuntimeExportLoadedPayload
): RuntimePlayerMappingRuntimeExportRef {
  return {
    packageId: payload.summary.packageId,
    packageRevision: payload.summary.packageRevision,
    loadedAtIso: payload.loadedAtIso,
    modelDisplayName: payload.summary.modelDisplayName
  };
}
