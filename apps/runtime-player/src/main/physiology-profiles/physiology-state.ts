import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type {
  PhysiologyProfileStatus,
  PhysiologySectionId,
  PhysiologySectionStatus,
  PhysiologyStatus,
  PhysiologyToneOverrides
} from "../../preload/physiology-bridge-contract";
import type { PhysiologyConfig } from "../physiology";
import {
  createPhysiologyRuntimeExportIdentity
} from "./physiology-export-identity";
import type {
  PhysiologyProfileDocument,
  PhysiologyRuntimeExportIdentity
} from "./physiology-profile-document";
import { physiologyProfileSchemaVersion } from "./physiology-profile-document";
import type {
  PhysiologyProfileStoreLoadResult
} from "./physiology-profile-store";
import {
  DEFAULT_STAGE_PRESENCE_ENABLED,
  DEFAULT_STAGE_PRESENCE_STRENGTH,
  PHYSIOLOGY_SECTION_TONE_FIELDS,
  physiologyOverridesToConfig,
  resolveEffectiveSectionTones,
  sectionHasOverride
} from "./physiology-tone-config";

const PHYSIOLOGY_SECTION_IDS: readonly PhysiologySectionId[] = [
  "blink",
  "gaze",
  "head",
  "posture",
  "speech",
  "stagePresence"
];

export type RuntimePlayerPhysiologyStateOptions = {
  readonly nowMs?: () => number;
  /**
   * Whether this host HAS a physiology subsystem — DATA from the composition seam
   * (Autonomous = true, Tracking = false), read lazily so the composition root can
   * set the backing value after it composes the subsystem. Never a role query.
   */
  readonly isAvailable?: () => boolean;
};

export type RuntimePlayerPhysiologyProfileSnapshot = {
  readonly identity: PhysiologyRuntimeExportIdentity;
  readonly profile: PhysiologyProfileDocument;
  readonly revision: number;
};

/**
 * Physiology profile / tone state (C3 Domain C). A parallel copy of the Dynamics
 * Tune state shape (裁定4, not shared). Owns the sparse tone override map and is the
 * SOURCE for the config provider the Autonomous Host heart reads: `getPhysiologyConfig`
 * returns a STABLE reference until a knob moves (revision bump), so the heart rebuilds
 * only on change (ツマミ即時反映, 裁定3). The base is always the full universal grammar,
 * so the body is alive「設定なしで視線・頭・姿勢が生きる」.
 */
export class RuntimePlayerPhysiologyState {
  private readonly nowMs: () => number;
  private readonly isAvailable: () => boolean;
  private runtimeExportPayload: RuntimeExportLoadedPayload | null = null;
  private profileIdentity: PhysiologyRuntimeExportIdentity | null = null;
  private profileCreatedAtIso: string | null = null;
  private profileUpdatedAtIso: string | null = null;
  private profileStatus: PhysiologyProfileStatus = createProfileStatus(
    "unavailable",
    "Runtime Export required"
  );
  private overrides: PhysiologyToneOverrides = {};
  private updatedAtMs: number;
  private revision = 0;
  private cachedConfig: PhysiologyConfig | null = null;
  private cachedConfigRevision = -1;

  constructor(options: RuntimePlayerPhysiologyStateOptions = {}) {
    this.nowMs = options.nowMs ?? Date.now;
    this.isAvailable = options.isAvailable ?? (() => true);
    this.updatedAtMs = this.nowMs();
  }

  setRuntimeExportPayload(
    payload: RuntimeExportLoadedPayload,
    profileLoadResult?: PhysiologyProfileStoreLoadResult
  ): PhysiologyStatus {
    this.runtimeExportPayload = payload;
    this.profileIdentity =
      profileLoadResult?.identity ??
      createPhysiologyRuntimeExportIdentity(payload);
    this.profileCreatedAtIso = null;
    this.profileUpdatedAtIso = null;
    this.overrides = {};
    this.profileStatus = createProfileStatus(
      "default",
      "No saved profile; using universal physiology"
    );

    if (profileLoadResult !== undefined) {
      this.applyProfileLoadResult(profileLoadResult);
    }

    this.bumpRevision();

    return this.getStatus();
  }

  clearRuntimeExport(): PhysiologyStatus {
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

  updateTone(request: {
    readonly section: PhysiologySectionId;
    readonly field: string;
    readonly tone: number;
  }): PhysiologyStatus {
    this.assertRuntimeExportReady();
    this.assertToneField(request.section, request.field);

    const tone = clampUnit(request.tone);
    if (request.section === "stagePresence") {
      // Stage Presence exposes a single tone slider (Strength); its override lives
      // alongside the `enabled` toggle in a heterogeneous record, so write it here
      // rather than through the numeric-family helper. assertToneField already
      // guarantees the field is "strength". enabled is preserved by the spread.
      this.overrides = {
        ...this.overrides,
        stagePresence: { ...this.overrides.stagePresence, strength: tone }
      };
    } else {
      const family = readNumericFamily(this.overrides, request.section);
      this.overrides = writeNumericFamily(this.overrides, request.section, {
        ...family,
        [request.field]: tone
      });
    }
    this.bumpRevision();

    return this.getStatus();
  }

  setStagePresenceEnabled(enabled: boolean): PhysiologyStatus {
    this.assertRuntimeExportReady();

    this.overrides = {
      ...this.overrides,
      stagePresence: {
        ...this.overrides.stagePresence,
        enabled
      }
    };
    this.bumpRevision();

    return this.getStatus();
  }

  resetSection(section: PhysiologySectionId): PhysiologyStatus {
    this.assertRuntimeExportReady();

    const nextOverrides: PhysiologyToneOverrides = { ...this.overrides };
    delete (nextOverrides as Record<string, unknown>)[section];
    this.overrides = nextOverrides;
    this.bumpRevision();

    return this.getStatus();
  }

  canSaveProfile(): boolean {
    return this.runtimeExportPayload !== null && this.profileIdentity !== null;
  }

  needsProfileSave(): boolean {
    return (
      this.profileStatus.kind === "unsaved" ||
      this.profileStatus.kind === "saving" ||
      this.profileStatus.kind === "save-failed"
    );
  }

  markProfileUnsaved(): PhysiologyStatus {
    if (!this.canSaveProfile()) {
      return this.getStatus();
    }

    this.profileStatus = createProfileStatus("unsaved", "Unsaved changes");
    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  markProfileSaving(): PhysiologyStatus {
    if (!this.canSaveProfile()) {
      return this.getStatus();
    }

    this.profileStatus = createProfileStatus("saving", "Saving...");
    this.updatedAtMs = this.nowMs();

    return this.getStatus();
  }

  markProfileSaved(input: {
    readonly revision: number;
    readonly updatedAtIso: string;
  }): PhysiologyStatus {
    if (!this.canSaveProfile()) {
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

  markProfileSaveFailed(message: string): PhysiologyStatus {
    if (!this.canSaveProfile()) {
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

  createProfileSnapshot(
    updatedAtIso: string
  ): RuntimePlayerPhysiologyProfileSnapshot | null {
    if (this.profileIdentity === null || this.runtimeExportPayload === null) {
      return null;
    }

    const createdAtIso = this.profileCreatedAtIso ?? updatedAtIso;
    const identity = this.profileIdentity;

    return {
      identity,
      profile: {
        schemaVersion: physiologyProfileSchemaVersion,
        createdAtIso,
        updatedAtIso,
        exportIdentity: {
          packageId: identity.packageId,
          packageRevision: identity.packageRevision,
          ...(identity.packageHash === undefined
            ? {}
            : { packageHash: identity.packageHash }),
          fingerprint: identity.fingerprint
        },
        overrides: this.overrides
      },
      revision: this.revision
    };
  }

  /**
   * The config provider source (ツマミ即時反映, 裁定3). Returns a STABLE reference while
   * the overrides are unchanged (cached by revision) and a NEW object when a knob
   * moves — exactly the reference contract the heart's rebuild-on-change relies on.
   */
  getPhysiologyConfig(): PhysiologyConfig {
    if (this.cachedConfig === null || this.cachedConfigRevision !== this.revision) {
      this.cachedConfig = physiologyOverridesToConfig(this.overrides);
      this.cachedConfigRevision = this.revision;
    }
    return this.cachedConfig;
  }

  getStatus(): PhysiologyStatus {
    const available = this.isAvailable();
    const ready = this.runtimeExportPayload !== null;
    const sections = PHYSIOLOGY_SECTION_IDS.map((section) =>
      this.createSectionStatus(section)
    );
    const overriddenSectionCount = sections.filter(
      (section) => section.hasOverride
    ).length;

    return {
      available,
      status: ready ? "ready" : "unavailable",
      statusLabel: ready
        ? `Physiology sections ${overriddenSectionCount} / ${sections.length} tuned`
        : "Runtime Export required",
      runtimeExport:
        this.runtimeExportPayload === null
          ? null
          : {
              packageId: this.runtimeExportPayload.summary.packageId,
              packageRevision:
                this.runtimeExportPayload.summary.packageRevision,
              loadedAtIso: this.runtimeExportPayload.loadedAtIso,
              modelDisplayName:
                this.runtimeExportPayload.summary.modelDisplayName
            },
      profileStatus: this.profileStatus,
      sections,
      overriddenSectionCount,
      revision: this.revision,
      updatedAtIso: new Date(this.updatedAtMs).toISOString()
    };
  }

  private createSectionStatus(
    section: PhysiologySectionId
  ): PhysiologySectionStatus {
    const tones = resolveEffectiveSectionTones(section, this.overrides);
    const hasOverride = sectionHasOverride(section, this.overrides);

    if (section === "stagePresence") {
      return {
        section,
        hasOverride,
        tones,
        stagePresenceEnabled:
          this.overrides.stagePresence?.enabled ??
          DEFAULT_STAGE_PRESENCE_ENABLED
      };
    }

    return { section, hasOverride, tones };
  }

  private applyProfileLoadResult(
    loadResult: PhysiologyProfileStoreLoadResult
  ): void {
    if (loadResult.state === "missing") {
      this.profileStatus = createProfileStatus(
        "default",
        "No saved profile; using universal physiology"
      );
      return;
    }

    if (loadResult.state === "read-failed" || loadResult.profile === null) {
      // Stale / unreadable (裁定4: schemaVersion reject or fingerprint mismatch).
      // The knobs fall back to the universal defaults; nothing is silently applied.
      this.profileStatus = createProfileStatus(
        loadResult.warningMessages.some((message) =>
          message.includes("schema version")
        )
          ? "stale"
          : "load-warning",
        "Profile ignored; using universal physiology",
        loadResult.warningMessages
      );
      return;
    }

    this.overrides = loadResult.profile.overrides;
    this.profileCreatedAtIso = loadResult.profile.createdAtIso;
    this.profileUpdatedAtIso = loadResult.profile.updatedAtIso;
    this.profileStatus =
      loadResult.warningMessages.length > 0
        ? createProfileStatus(
            "stale",
            "Profile restored with warnings",
            loadResult.warningMessages,
            loadResult.profile.updatedAtIso
          )
        : createProfileStatus(
            "restored",
            "Profile restored",
            [],
            loadResult.profile.updatedAtIso
          );
  }

  private assertRuntimeExportReady(): void {
    if (this.runtimeExportPayload === null) {
      throw new Error("Open a Runtime Export before tuning physiology.");
    }
  }

  private assertToneField(
    section: PhysiologySectionId,
    field: string
  ): void {
    // Every section (including stagePresence, whose only slider is Strength) has an
    // entry in PHYSIOLOGY_SECTION_TONE_FIELDS; unknown fields are rejected.
    if (!PHYSIOLOGY_SECTION_TONE_FIELDS[section].includes(field)) {
      throw new Error(
        `Physiology field ${section}.${field} is not a known slider.`
      );
    }
  }

  private bumpRevision(): void {
    this.revision += 1;
    this.updatedAtMs = this.nowMs();
  }
}

function readNumericFamily(
  overrides: PhysiologyToneOverrides,
  section: PhysiologySectionId
): Readonly<Record<string, number>> {
  return (overrides[section] ?? {}) as Readonly<Record<string, number>>;
}

function writeNumericFamily(
  overrides: PhysiologyToneOverrides,
  section: PhysiologySectionId,
  family: Readonly<Record<string, number>>
): PhysiologyToneOverrides {
  return {
    ...overrides,
    [section]: family
  };
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
}

function createProfileStatus(
  kind: PhysiologyProfileStatus["kind"],
  label: string,
  warningMessages: readonly string[] = [],
  updatedAtIso?: string
): PhysiologyProfileStatus {
  return {
    kind,
    label,
    warningMessages,
    ...(updatedAtIso === undefined ? {} : { updatedAtIso })
  };
}
