import type {
  PhysiologySectionId,
  PhysiologySectionResetRequest,
  PhysiologyStagePresenceEnabledRequest,
  PhysiologyToneUpdateRequest
} from "../preload/physiology-bridge-contract";

/**
 * Exhaustive presence map for the section-id whitelist (C6 Domain F hotfix). Keying a
 * Record by the contract union `PhysiologySectionId` makes TypeScript REQUIRE every
 * member — adding a new section to the union without listing it here is a COMPILE error.
 * This closes the drift that hid the「speech」regression: the previous hand-written
 * `new Set<PhysiologySectionId>([...])` constrained each element's TYPE but never
 * enforced that ALL union members were present, so `speech` silently fell out of the
 * whitelist while still compiling. The runtime whitelist is DERIVED from these keys, so
 * there is exactly one place to keep in sync and the compiler enforces completeness.
 */
const PHYSIOLOGY_SECTION_ID_PRESENCE: Readonly<
  Record<PhysiologySectionId, true>
> = {
  blink: true,
  gaze: true,
  head: true,
  posture: true,
  speech: true,
  stagePresence: true
};

/** Section ids accepted by the bridge. Exported so the drift-guard test can reconcile it. */
export const PHYSIOLOGY_SECTION_ID_WHITELIST: ReadonlySet<string> =
  new Set<string>(Object.keys(PHYSIOLOGY_SECTION_ID_PRESENCE));

export function readPhysiologyToneUpdateRequest(
  value: unknown
): PhysiologyToneUpdateRequest {
  if (!isRecord(value)) {
    throw new Error("Physiology tone update request must be an object.");
  }

  return {
    section: readSection(value.section),
    field: readField(value.field),
    tone: readTone(value.tone)
  };
}

export function readPhysiologyStagePresenceEnabledRequest(
  value: unknown
): PhysiologyStagePresenceEnabledRequest {
  if (!isRecord(value)) {
    throw new Error(
      "Physiology stage presence request must be an object."
    );
  }

  if (typeof value.enabled !== "boolean") {
    throw new Error("Physiology stage presence enabled must be boolean.");
  }

  return { enabled: value.enabled };
}

export function readPhysiologySectionResetRequest(
  value: unknown
): PhysiologySectionResetRequest {
  if (!isRecord(value)) {
    throw new Error("Physiology section reset request must be an object.");
  }

  return { section: readSection(value.section) };
}

function readSection(value: unknown): PhysiologySectionId {
  if (typeof value !== "string" || !PHYSIOLOGY_SECTION_ID_WHITELIST.has(value)) {
    throw new Error("Physiology section is not a known section.");
  }

  return value as PhysiologySectionId;
}

function readField(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Physiology field must be a non-empty string.");
  }

  return value.trim();
}

function readTone(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Physiology tone must be a finite number.");
  }

  return Math.min(Math.max(value, 0), 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
