import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  RuntimePlayerMappingProfileStatus,
  RuntimePlayerMappingRuntimeExportRef,
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingSlotUpdateRequest,
  RuntimePlayerMappingStatus
} from "../../preload/model-mapping-bridge-contract";
import {
  createModelMappingRuntimeExportIdentity
} from "../model-mapping-profiles/model-mapping-export-identity";
import type {
  ModelMappingProfileDocument,
  ModelMappingRuntimeExportIdentity
} from "../model-mapping-profiles/model-mapping-profile-document";
import {
  createModelMappingProfileDocument,
  restoreModelMappingProfileSlots
} from "../model-mapping-profiles/model-mapping-profile-slots";
import type {
  ModelMappingProfileStoreLoadResult
} from "../model-mapping-profiles/model-mapping-profile-store";
import { createAutoMappingSlots } from "./runtime-export-auto-mapping";

export type RuntimePlayerLiveMappingStateOptions = {
  readonly nowMs?: () => number;
};

export type RuntimePlayerMappingProfileSnapshot = {
  readonly identity: ModelMappingRuntimeExportIdentity;
  readonly profile: ModelMappingProfileDocument;
  readonly revision: number;
};

export class RuntimePlayerLiveMappingState {
  private readonly nowMs: () => number;
  private runtimeExportPayload: RuntimeExportLoadedPayload | null = null;
  private profileIdentity: ModelMappingRuntimeExportIdentity | null = null;
  private profileCreatedAtIso: string | null = null;
  private profileUpdatedAtIso: string | null = null;
  private profileStatus: RuntimePlayerMappingProfileStatus =
    createProfileStatus("unavailable", "Runtime Export required");
  private slots: readonly RuntimePlayerMappingSlot[] = [];
  private updatedAtMs: number;
  private revision = 0;

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

  setRuntimeExportPayload(
    payload: RuntimeExportLoadedPayload,
    profileLoadResult?: ModelMappingProfileStoreLoadResult
  ): RuntimePlayerMappingStatus {
    this.runtimeExportPayload = payload;
    const autoSlots = createAutoMappingSlots(payload);
    const identity = profileLoadResult?.identity ??
      createModelMappingRuntimeExportIdentity(payload);
    this.profileIdentity = identity;
    this.profileCreatedAtIso = null;
    this.profileUpdatedAtIso = null;
    this.slots = autoSlots;
    this.profileStatus = createProfileStatus(
      "auto-mapped",
      "No saved profile; using Auto Map"
    );

    if (profileLoadResult !== undefined) {
      this.applyProfileLoadResult({
        payload,
        autoSlots,
        profileLoadResult
      });
    }

    this.revision += 1;
    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  clearRuntimeExport(): RuntimePlayerMappingStatus {
    this.runtimeExportPayload = null;
    this.profileIdentity = null;
    this.profileCreatedAtIso = null;
    this.profileUpdatedAtIso = null;
    this.profileStatus = createProfileStatus(
      "unavailable",
      "Runtime Export required"
    );
    this.slots = [];
    this.revision += 1;
    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  regenerateAutoMapping(): RuntimePlayerMappingStatus | null {
    if (this.runtimeExportPayload === null) {
      return null;
    }

    this.slots = createAutoMappingSlots(this.runtimeExportPayload);
    this.revision += 1;
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
      const smoothing = request.smoothing ?? slot.smoothing;
      const bodyRotationStrength =
        request.bodyRotationStrength ?? slot.bodyRotationStrength;
      const bodyPositionStrength =
        request.bodyPositionStrength ?? slot.bodyPositionStrength;
      const bodyRotationInvert =
        request.bodyRotationInvert ?? slot.bodyRotationInvert;
      const bodyPositionInvert =
        request.bodyPositionInvert ?? slot.bodyPositionInvert;

      return {
        ...slot,
        enabled,
        invert,
        strength,
        ...(smoothing === undefined ? {} : { smoothing }),
        ...(bodyRotationStrength === undefined
          ? {}
          : { bodyRotationStrength }),
        ...(bodyPositionStrength === undefined
          ? {}
          : { bodyPositionStrength }),
        ...(bodyRotationInvert === undefined ? {} : { bodyRotationInvert }),
        ...(bodyPositionInvert === undefined ? {} : { bodyPositionInvert }),
        status: slot.target === null
          ? "missing-target"
          : enabled
            ? "mapped"
            : "disabled"
      };
    });
    this.revision += 1;
    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  canSaveMappingProfile(): boolean {
    return this.runtimeExportPayload !== null && this.profileIdentity !== null;
  }

  needsMappingProfileSave(): boolean {
    return (
      this.profileStatus.kind === "unsaved" ||
      this.profileStatus.kind === "saving" ||
      this.profileStatus.kind === "save-failed"
    );
  }

  markMappingProfileUnsaved(): RuntimePlayerMappingStatus {
    if (!this.canSaveMappingProfile()) {
      return this.getStatus();
    }

    this.profileStatus = createProfileStatus("unsaved", "Unsaved changes");
    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  markMappingProfileSaving(): RuntimePlayerMappingStatus {
    if (!this.canSaveMappingProfile()) {
      return this.getStatus();
    }

    this.profileStatus = createProfileStatus("saving", "Saving...");
    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  markMappingProfileSaved(input: {
    readonly revision: number;
    readonly updatedAtIso: string;
  }): RuntimePlayerMappingStatus {
    if (!this.canSaveMappingProfile()) {
      return this.getStatus();
    }

    this.profileCreatedAtIso = this.profileCreatedAtIso ?? input.updatedAtIso;
    this.profileUpdatedAtIso = input.updatedAtIso;

    if (input.revision === this.revision) {
      this.profileStatus = createProfileStatus(
        "saved",
        "Saved",
        [],
        input.updatedAtIso
      );
    } else {
      this.profileStatus = createProfileStatus(
        "unsaved",
        "Unsaved changes"
      );
    }

    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  markMappingProfileSaveFailed(
    message: string
  ): RuntimePlayerMappingStatus {
    if (!this.canSaveMappingProfile()) {
      return this.getStatus();
    }

    this.profileStatus = createProfileStatus(
      "save-failed",
      "Save failed",
      [message],
      this.profileUpdatedAtIso ?? undefined
    );
    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  createMappingProfileSnapshot(
    updatedAtIso: string
  ): RuntimePlayerMappingProfileSnapshot | null {
    if (this.profileIdentity === null || this.runtimeExportPayload === null) {
      return null;
    }

    const createdAtIso = this.profileCreatedAtIso ?? updatedAtIso;

    return {
      identity: this.profileIdentity,
      profile: createModelMappingProfileDocument({
        identity: this.profileIdentity,
        slots: this.slots,
        createdAtIso,
        updatedAtIso
      }),
      revision: this.revision
    };
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
      profileStatus: this.profileStatus,
      slots: this.slots,
      mappedSlotCount,
      enabledSlotCount,
      missingSlotCount,
      updatedAtIso: new Date(this.updatedAtMs).toISOString()
    };
  }

  private applyProfileLoadResult(input: {
    readonly payload: RuntimeExportLoadedPayload;
    readonly autoSlots: readonly RuntimePlayerMappingSlot[];
    readonly profileLoadResult: ModelMappingProfileStoreLoadResult;
  }): void {
    const loadResult = input.profileLoadResult;

    if (loadResult.state === "missing") {
      this.profileStatus = createProfileStatus(
        "auto-mapped",
        "No saved profile; using Auto Map"
      );
      return;
    }

    if (loadResult.state === "read-failed" || loadResult.profile === null) {
      this.profileStatus = createProfileStatus(
        "load-warning",
        "Profile load failed; using Auto Map",
        loadResult.warningMessages
      );
      return;
    }

    const restoreResult = restoreModelMappingProfileSlots({
      payload: input.payload,
      autoSlots: input.autoSlots,
      profile: loadResult.profile
    });
    const warningMessages = [
      ...loadResult.warningMessages,
      ...restoreResult.warningMessages
    ];

    this.slots = restoreResult.slots;
    this.profileCreatedAtIso = loadResult.profile.createdAtIso;
    this.profileUpdatedAtIso = loadResult.profile.updatedAtIso;
    this.profileStatus = warningMessages.length > 0
      ? createProfileStatus(
          "stale",
          "Profile restored with warnings",
          warningMessages,
          loadResult.profile.updatedAtIso
        )
      : createProfileStatus(
          "restored",
          `Profile restored (${restoreResult.restoredSlotCount} slots)`,
          [],
          loadResult.profile.updatedAtIso
        );
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

function createProfileStatus(
  kind: RuntimePlayerMappingProfileStatus["kind"],
  label: string,
  warningMessages: readonly string[] = [],
  updatedAtIso?: string
): RuntimePlayerMappingProfileStatus {
  return {
    kind,
    label,
    warningMessages,
    ...(updatedAtIso === undefined ? {} : { updatedAtIso })
  };
}
