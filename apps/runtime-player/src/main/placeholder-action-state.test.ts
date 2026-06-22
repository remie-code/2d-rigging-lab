import { describe, expect, it } from "vitest";

import {
  createPlaceholderResult,
  createStageStatus,
  createStartupStatus,
  isRuntimePlayerPlaceholderAction
} from "./placeholder-action-state";

describe("Runtime Player Wave1 placeholder state", () => {
  it("reports no loaded Runtime Export and no active input", () => {
    const status = createStartupStatus();

    expect(status.runtimeExport).toEqual({
      status: "empty",
      loaded: false,
      statusLabel: "No Runtime Export loaded"
    });
    expect(status.input).toEqual({
      sourceLabel: "iFacialMocap",
      transportLabel: "UDP",
      receivePort: 49983,
      connectionState: "not-connected"
    });
  });

  it("reports Stage as a transparent placeholder target", () => {
    expect(createStageStatus()).toEqual({
      windowState: "created",
      transparent: true,
      captureTarget: true,
      placeholderLabel: "Transparent Stage placeholder"
    });
  });

  it("keeps placeholder feedback deterministic", () => {
    expect(createPlaceholderResult("open-settings")).toEqual({
      action: "open-settings",
      handled: false,
      message: "Settings are visible as a Wave1 placeholder only.",
      atIso: "1970-01-01T00:00:00.000Z"
    });
  });

  it("accepts only declared placeholder actions", () => {
    expect(isRuntimePlayerPlaceholderAction("connect-input")).toBe(true);
    expect(isRuntimePlayerPlaceholderAction("open-runtime-export")).toBe(false);
    expect(isRuntimePlayerPlaceholderAction("read-runtime-export")).toBe(false);
  });
});
