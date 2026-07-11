/**
 * Physiology bridge contract (C3 Domain C, UX c3-physiology-profile.md). The
 * renderer-facing surface for the Physiology page. Everything crossing to the
 * renderer is QUALITY-WORD (質感語) config + status — never a seed, raw slot, or
 * private path (wave-plan §9 sanitization boundary). Slider values are normalized
 * "tone" numbers in [0, 1]; the mapping onto the internal physiology schema
 * (ms / Hz / probability) lives entirely in the main-process mapping layer
 * (design §6), never here and never in the UI (UX §3「工学数字は一切出さない」).
 */

/** Stored profile schema literal. A mismatch is rejected outright (裁定4 stale). */
export const runtimePlayerPhysiologyProfileSchemaVersion =
  "runtime-player-physiology-profile-v1" as const;

export type PhysiologySectionId =
  | "blink"
  | "gaze"
  | "head"
  | "posture"
  | "stagePresence";

export type PhysiologyBlinkToneField =
  | "frequency"
  | "calmness"
  | "crispness"
  | "quirk";
export type PhysiologyGazeToneField =
  | "cameraFocus"
  | "restlessness"
  | "dwell";
export type PhysiologyHeadToneField = "sway" | "follow";
export type PhysiologyPostureToneField = "drift" | "restlessness";
export type PhysiologyStagePresenceToneField = "strength";

/**
 * The sparse per-family override the profile persists and the state applies over
 * the universal defaults. Numbers are tones in [0, 1]. `stagePresence` carries the
 * toggle (既定 Off) plus its strength tone; the actual drive of Stage Presence
 * (posture signal → Stage transform) is Domain D — this contract only carries the
 * config field + UI state.
 */
export type PhysiologyToneOverrides = {
  readonly blink?: Readonly<Partial<Record<PhysiologyBlinkToneField, number>>>;
  readonly gaze?: Readonly<Partial<Record<PhysiologyGazeToneField, number>>>;
  readonly head?: Readonly<Partial<Record<PhysiologyHeadToneField, number>>>;
  readonly posture?: Readonly<
    Partial<Record<PhysiologyPostureToneField, number>>
  >;
  readonly stagePresence?: {
    readonly enabled?: boolean;
    readonly strength?: number;
  };
};

export type PhysiologyProfileStatusKind =
  | "unavailable"
  | "default"
  | "restored"
  | "stale"
  | "unsaved"
  | "saving"
  | "saved"
  | "save-failed"
  | "load-warning";

export type PhysiologyProfileStatus = {
  readonly kind: PhysiologyProfileStatusKind;
  readonly label: string;
  readonly warningMessages: readonly string[];
  readonly updatedAtIso?: string;
};

export type PhysiologyRuntimeExportRef = {
  readonly packageId: string;
  readonly packageRevision: number;
  readonly loadedAtIso: string;
  readonly modelDisplayName: string;
};

export type PhysiologySectionStatus = {
  readonly section: PhysiologySectionId;
  /** Any exposed slider in this section deviates from its universal default. */
  readonly hasOverride: boolean;
  /** Effective tone per exposed field (default merged with override), [0, 1]. */
  readonly tones: Readonly<Record<string, number>>;
  /** Stage Presence only: the toggle state (既定 Off). */
  readonly stagePresenceEnabled?: boolean;
};

export type PhysiologyStatus = {
  /**
   * Whether this host HAS a physiology subsystem — expressed as DATA, not a role
   * query (wave-plan §6/§9). The Autonomous Host drives a physiology generator
   * (available = true); the Tracking Host's body is driven by tracking
   * (available = false → the renderer shows the one-line tracking empty page,
   * UX §6.2). Neither renderer nor main writes `if (role === ...)`.
   */
  readonly available: boolean;
  readonly status: "unavailable" | "ready";
  readonly statusLabel: string;
  readonly runtimeExport: PhysiologyRuntimeExportRef | null;
  readonly profileStatus: PhysiologyProfileStatus;
  readonly sections: readonly PhysiologySectionStatus[];
  readonly overriddenSectionCount: number;
  readonly revision: number;
  readonly updatedAtIso: string;
};

export type PhysiologyToneUpdateRequest = {
  readonly section: PhysiologySectionId;
  readonly field: string;
  readonly tone: number;
};

export type PhysiologyStagePresenceEnabledRequest = {
  readonly enabled: boolean;
};

export type PhysiologySectionResetRequest = {
  readonly section: PhysiologySectionId;
};

export type PhysiologyActionResultKind =
  | "ok"
  | "unavailable"
  | "save-failed"
  | "validation-error";

export type PhysiologyActionResult = {
  readonly result: PhysiologyActionResultKind;
  readonly message: string;
  readonly status: PhysiologyStatus;
};

export type RuntimePlayerPhysiologyApi = {
  readonly getStatus: () => Promise<PhysiologyStatus>;
  readonly updateTone: (
    request: PhysiologyToneUpdateRequest
  ) => Promise<PhysiologyActionResult>;
  readonly setStagePresenceEnabled: (
    request: PhysiologyStagePresenceEnabledRequest
  ) => Promise<PhysiologyActionResult>;
  readonly resetSection: (
    request: PhysiologySectionResetRequest
  ) => Promise<PhysiologyActionResult>;
  readonly retryProfileSave: () => Promise<PhysiologyActionResult>;
  readonly onStatusChanged: (
    callback: (status: PhysiologyStatus) => void
  ) => () => void;
};
