import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  runtimePlayerEffectiveDynamicsTuningSchemaVersion,
  type RuntimePlayerDynamicsTuningGroupOverride,
  type RuntimePlayerDynamicsTuningGroupResetRequest,
  type RuntimePlayerDynamicsTuningGroupUpdateRequest,
  type RuntimePlayerDynamicsTuningProfileStatus,
  type RuntimePlayerDynamicsTuningStatus,
  type RuntimePlayerEffectiveDynamicsTuningProfile
} from "../../preload/dynamics-tuning-bridge-contract";
import {
  createDynamicsTuningRuntimeExportIdentity
} from "./dynamics-tuning-export-identity";
import type {
  DynamicsTuningProfileDocument,
  DynamicsTuningRuntimeExportIdentity
} from "./dynamics-tuning-profile-document";
import {
  createDynamicsTuningGroupStatuses,
  createDynamicsTuningProfileDocument,
  restoreDynamicsTuningProfileGroups,
  sanitizeGroupOverride,
  sanitizeGroupOverrides
} from "./dynamics-tuning-profile-groups";
import type {
  DynamicsTuningProfileStoreLoadResult
} from "./dynamics-tuning-profile-store";

export type RuntimePlayerDynamicsTuningStateOptions = {
  readonly nowMs?: () => number;
};

export type RuntimePlayerDynamicsTuningProfileSnapshot = {
  readonly identity: DynamicsTuningRuntimeExportIdentity;
  readonly profile: DynamicsTuningProfileDocument;
  readonly revision: number;
};

export class RuntimePlayerDynamicsTuningState {
  private readonly nowMs: () => number;
  private runtimeExportPayload: RuntimeExportLoadedPayload | null = null;
  private profileIdentity: DynamicsTuningRuntimeExportIdentity | null = null;
  private profileCreatedAtIso: string | null = null;
  private profileUpdatedAtIso: string | null = null;
  private profileStatus: RuntimePlayerDynamicsTuningProfileStatus =
    createProfileStatus("unavailable", "Runtime Export required");
  private overrides: Readonly<Record<string, RuntimePlayerDynamicsTuningGroupOverride>> =
    {};
  private updatedAtMs: number;
  private revision = 0;

  constructor(options: RuntimePlayerDynamicsTuningStateOptions = {}) {
    this.nowMs = options.nowMs ?? Date.now;
    this.updatedAtMs = this.nowMs();
  }

  setRuntimeExportPayload(
    payload: RuntimeExportLoadedPayload,
    profileLoadResult?: DynamicsTuningProfileStoreLoadResult
  ): RuntimePlayerDynamicsTuningStatus {
    this.runtimeExportPayload = payload;
    this.profileIdentity = profileLoadResult?.identity ??
      createDynamicsTuningRuntimeExportIdentity(payload);
    this.profileCreatedAtIso = null;
    this.profileUpdatedAtIso = null;
    this.overrides = {};
    this.profileStatus = createProfileStatus(
      "default",
      "No saved profile; using exported dynamics"
    );

    if (profileLoadResult !== undefined) {
      this.applyProfileLoadResult({
        payload,
        profileLoadResult
      });
    }

    this.bumpRevision();

    return this.getStatus();
  }

  clearRuntimeExport(): RuntimePlayerDynamicsTuningStatus {
    this.runtimeExportPayload = null;
    this.profileIdentity = null;
    this.profileCreatedAtIso = null;
    this.profileUpdatedAtIso = null;
    this.overrides = {};
    this.profileStatus = createProfileStatus(
      "unavailable",
      "Runtime Export required"
    );
    this.bumpRevision();

    return this.getStatus();
  }

  updateGroup(
    request: RuntimePlayerDynamicsTuningGroupUpdateRequest
  ): RuntimePlayerDynamicsTuningStatus {
    this.assertRuntimeExportReady();
    this.assertGroupExists(request.groupId);

    const nextOverride = sanitizeGroupOverride({
      ...(this.overrides[request.groupId] ?? {}),
      ...request
    });

    this.overrides = sanitizeGroupOverrides({
      ...this.overrides,
      [request.groupId]: nextOverride
    });
    this.bumpRevision();

    return this.getStatus();
  }

  resetGroup(
    request: RuntimePlayerDynamicsTuningGroupResetRequest
  ): RuntimePlayerDynamicsTuningStatus {
    this.assertRuntimeExportReady();
    this.assertGroupExists(request.groupId);

    const nextOverrides = { ...this.overrides };
    delete nextOverrides[request.groupId];
    this.overrides = nextOverrides;
    this.bumpRevision();

    return this.getStatus();
  }

  canSaveTuningProfile(): boolean {
    return this.runtimeExportPayload !== null && this.profileIdentity !== null;
  }

  needsTuningProfileSave(): boolean {
    return (
      this.profileStatus.kind === "unsaved" ||
      this.profileStatus.kind === "saving" ||
      this.profileStatus.kind === "save-failed"
    );
  }

  markTuningProfileUnsaved(): RuntimePlayerDynamicsTuningStatus {
    if (!this.canSaveTuningProfile()) {
      return this.getStatus();
    }

    this.profileStatus = createProfileStatus("unsaved", "Unsaved changes");
    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  markTuningProfileSaving(): RuntimePlayerDynamicsTuningStatus {
    if (!this.canSaveTuningProfile()) {
      return this.getStatus();
    }

    this.profileStatus = createProfileStatus("saving", "Saving...");
    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  markTuningProfileSaved(input: {
    readonly revision: number;
    readonly updatedAtIso: string;
  }): RuntimePlayerDynamicsTuningStatus {
    if (!this.canSaveTuningProfile()) {
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
      this.profileStatus = createProfileStatus("unsaved", "Unsaved changes");
    }

    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  markTuningProfileSaveFailed(
    message: string
  ): RuntimePlayerDynamicsTuningStatus {
    if (!this.canSaveTuningProfile()) {
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

  createTuningProfileSnapshot(
    updatedAtIso: string
  ): RuntimePlayerDynamicsTuningProfileSnapshot | null {
    if (this.profileIdentity === null || this.runtimeExportPayload === null) {
      return null;
    }

    const createdAtIso = this.profileCreatedAtIso ?? updatedAtIso;

    return {
      identity: this.profileIdentity,
      profile: createDynamicsTuningProfileDocument({
        identity: this.profileIdentity,
        groups: this.overrides,
        createdAtIso,
        updatedAtIso
      }),
      revision: this.revision
    };
  }

  getEffectiveProfile(): RuntimePlayerEffectiveDynamicsTuningProfile | null {
    if (this.profileIdentity === null || this.runtimeExportPayload === null) {
      return null;
    }

    return {
      schemaVersion: runtimePlayerEffectiveDynamicsTuningSchemaVersion,
      revision: this.revision,
      fingerprint: this.profileIdentity.fingerprint,
      updatedAtIso: new Date(this.updatedAtMs).toISOString(),
      exportIdentity: {
        packageId: this.profileIdentity.packageId,
        packageRevision: this.profileIdentity.packageRevision,
        ...(this.profileIdentity.packageHash === undefined
          ? {}
          : { packageHash: this.profileIdentity.packageHash }),
        parameterSignatureHash: this.profileIdentity.parameterSignatureHash
      },
      dynamicsSignatureHash: this.profileIdentity.dynamicsSignatureHash,
      groups: sanitizeGroupOverrides(this.overrides)
    };
  }

  getStatus(): RuntimePlayerDynamicsTuningStatus {
    const groups = this.runtimeExportPayload === null
      ? []
      : createDynamicsTuningGroupStatuses({
          payload: this.runtimeExportPayload,
          overrides: this.overrides
        });
    const overriddenGroupCount = groups.filter((group) =>
      group.hasOverride
    ).length;

    return {
      status: this.runtimeExportPayload === null ? "unavailable" : "ready",
      statusLabel: this.runtimeExportPayload === null
        ? "Runtime Export required"
        : `Dynamics groups ${overriddenGroupCount} / ${groups.length} tuned`,
      runtimeExport: this.runtimeExportPayload === null
        ? null
        : {
            packageId: this.runtimeExportPayload.summary.packageId,
            packageRevision: this.runtimeExportPayload.summary.packageRevision,
            loadedAtIso: this.runtimeExportPayload.loadedAtIso,
            modelDisplayName:
              this.runtimeExportPayload.summary.modelDisplayName
          },
      profileStatus: this.profileStatus,
      groups,
      dynamicsGroupCount: groups.length,
      overriddenGroupCount,
      dynamicsSignatureHash: this.profileIdentity?.dynamicsSignatureHash ?? null,
      tuningRevision: this.revision,
      effectiveProfile: this.getEffectiveProfile(),
      updatedAtIso: new Date(this.updatedAtMs).toISOString()
    };
  }

  private applyProfileLoadResult(input: {
    readonly payload: RuntimeExportLoadedPayload;
    readonly profileLoadResult: DynamicsTuningProfileStoreLoadResult;
  }): void {
    const loadResult = input.profileLoadResult;

    if (loadResult.state === "missing") {
      this.profileStatus = createProfileStatus(
        "default",
        "No saved profile; using exported dynamics"
      );
      return;
    }

    if (loadResult.state === "read-failed" || loadResult.profile === null) {
      this.profileStatus = createProfileStatus(
        "load-warning",
        "Profile load failed; using exported dynamics",
        loadResult.warningMessages
      );
      return;
    }

    if (
      loadResult.profile.dynamicsSignatureHash !==
      loadResult.identity.dynamicsSignatureHash
    ) {
      this.profileStatus = createProfileStatus(
        "stale",
        "Profile ignored; dynamics changed",
        [
          ...loadResult.warningMessages,
          "Dynamics tuning profile signature does not match the selected Runtime Export."
        ],
        loadResult.profile.updatedAtIso
      );
      return;
    }

    const restoreResult = restoreDynamicsTuningProfileGroups({
      payload: input.payload,
      profile: loadResult.profile
    });
    const warningMessages = [
      ...loadResult.warningMessages,
      ...restoreResult.warningMessages
    ];

    this.overrides = restoreResult.overrides;
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
          `Profile restored (${restoreResult.restoredGroupCount} groups)`,
          [],
          loadResult.profile.updatedAtIso
        );
  }

  private assertRuntimeExportReady(): void {
    if (this.runtimeExportPayload === null) {
      throw new Error("Open a Runtime Export before tuning dynamics.");
    }
  }

  private assertGroupExists(groupId: string): void {
    const hasGroup = this.runtimeExportPayload?.artifacts.model.dynamicsGroups
      .some((group) => group.dynamicsGroupId === groupId) ?? false;

    if (!hasGroup) {
      throw new Error("Dynamics tuning group was not found in this Runtime Export.");
    }
  }

  private bumpRevision(): void {
    this.revision += 1;
    this.updatedAtMs = this.nowMs();
  }
}

function createProfileStatus(
  kind: RuntimePlayerDynamicsTuningProfileStatus["kind"],
  label: string,
  warningMessages: readonly string[] = [],
  updatedAtIso?: string
): RuntimePlayerDynamicsTuningProfileStatus {
  return {
    kind,
    label,
    warningMessages,
    ...(updatedAtIso === undefined ? {} : { updatedAtIso })
  };
}
