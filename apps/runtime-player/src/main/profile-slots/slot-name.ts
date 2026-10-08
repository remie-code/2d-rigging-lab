/**
 * Profile-slot name validation.
 *
 * Slot names become a single path segment under `<userData>/slots/<slotName>`,
 * so they must be a machine-readable token that can never escape that segment.
 * This is a pure function; it performs no filesystem access.
 */

export const runtimePlayerSlotNameMaxLength = 64;

/**
 * Start with an alphanumeric, then alphanumerics / underscore / hyphen only.
 *
 * Deliberately excludes: whitespace, dots (so `.` and `..` traversal are
 * impossible), path separators (`/`, `\`), drive/scheme colons, and any other
 * character usable for path injection.
 */
const slotNamePattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

const windowsReservedSlotNames = new Set<string>([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`)
]);

export type RuntimePlayerSlotNameValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

export function validateRuntimePlayerSlotName(
  slotName: unknown
): RuntimePlayerSlotNameValidation {
  if (typeof slotName !== "string" || slotName.length === 0) {
    return { ok: false, reason: "Profile slot name must be a non-empty string." };
  }

  if (slotName.length > runtimePlayerSlotNameMaxLength) {
    return {
      ok: false,
      reason: `Profile slot name must be at most ${runtimePlayerSlotNameMaxLength} characters.`
    };
  }

  if (/\s/.test(slotName)) {
    return {
      ok: false,
      reason: "Profile slot name must not contain whitespace."
    };
  }

  if (!slotNamePattern.test(slotName)) {
    return {
      ok: false,
      reason:
        "Profile slot name must start with a letter or digit and use only letters, digits, '-' or '_'."
    };
  }

  if (windowsReservedSlotNames.has(slotName.toLowerCase())) {
    return {
      ok: false,
      reason: "Profile slot name must not be a reserved device name."
    };
  }

  return { ok: true };
}

export function isValidRuntimePlayerSlotName(slotName: unknown): boolean {
  return validateRuntimePlayerSlotName(slotName).ok;
}
