import { describe, expect, it } from "vitest";

import {
  isValidRuntimePlayerSlotName,
  runtimePlayerSlotNameMaxLength,
  validateRuntimePlayerSlotName
} from "./slot-name";

describe("validateRuntimePlayerSlotName", () => {
  it("accepts the role default slot names", () => {
    expect(validateRuntimePlayerSlotName("tracking-default").ok).toBe(true);
    expect(validateRuntimePlayerSlotName("autonomous-default").ok).toBe(true);
  });

  it("accepts machine-readable custom names", () => {
    for (const name of ["custom", "custom_1", "Slot-2", "a", "z9_-x"]) {
      expect(isValidRuntimePlayerSlotName(name)).toBe(true);
    }
  });

  it("rejects empty and non-string names", () => {
    expect(validateRuntimePlayerSlotName("").ok).toBe(false);
    expect(validateRuntimePlayerSlotName(undefined).ok).toBe(false);
    expect(validateRuntimePlayerSlotName(42).ok).toBe(false);
  });

  it("rejects whitespace", () => {
    for (const name of ["has space", "tab\tname", "trailing ", " leading"]) {
      expect(isValidRuntimePlayerSlotName(name)).toBe(false);
    }
  });

  it("rejects path-injection attempts", () => {
    for (const name of [
      "..",
      ".",
      "../evil",
      "a/b",
      "a\\b",
      "/abs",
      "C:name",
      "slots/../secret",
      ".hidden",
      "-leading",
      "with.dot"
    ]) {
      expect(isValidRuntimePlayerSlotName(name)).toBe(false);
    }
  });

  it("rejects Windows reserved device names case-insensitively", () => {
    for (const name of ["con", "CON", "nul", "com1", "LPT9", "aux", "prn"]) {
      expect(isValidRuntimePlayerSlotName(name)).toBe(false);
    }
  });

  it("rejects names longer than the maximum length", () => {
    const tooLong = "a".repeat(runtimePlayerSlotNameMaxLength + 1);
    expect(isValidRuntimePlayerSlotName(tooLong)).toBe(false);
    expect(
      isValidRuntimePlayerSlotName("a".repeat(runtimePlayerSlotNameMaxLength))
    ).toBe(true);
  });
});
