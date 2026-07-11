import type {
  PhysiologySectionId,
  PhysiologySectionResetRequest,
  PhysiologyStagePresenceEnabledRequest,
  PhysiologyToneUpdateRequest
} from "../preload/physiology-bridge-contract";

const PHYSIOLOGY_SECTION_IDS: ReadonlySet<string> = new Set<PhysiologySectionId>([
  "blink",
  "gaze",
  "head",
  "posture",
  "stagePresence"
]);

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
  if (typeof value !== "string" || !PHYSIOLOGY_SECTION_IDS.has(value)) {
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
