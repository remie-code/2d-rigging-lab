import { describe, expect, it } from "vitest";

import {
  composeRuntimePlayerControlWindowTitle,
  composeRuntimePlayerStageWindowTitle,
  composeRuntimePlayerTrayTooltip
} from "./window-title";

describe("Runtime Player window title composition", () => {
  it("includes the role in the Control window title", () => {
    expect(
      composeRuntimePlayerControlWindowTitle({ role: "trackingHost" })
    ).toBe("Runtime Player — Tracking Host");
    expect(
      composeRuntimePlayerControlWindowTitle({ role: "autonomousHost" })
    ).toBe("Runtime Player — Autonomous Host");
  });

  it("includes the role in the Stage window title", () => {
    expect(
      composeRuntimePlayerStageWindowTitle({ role: "autonomousHost" })
    ).toBe("Runtime Player Stage — Autonomous Host");
  });

  it("weaves the loaded model name after the role", () => {
    expect(
      composeRuntimePlayerControlWindowTitle({
        role: "trackingHost",
        modelName: "Aqua"
      })
    ).toBe("Runtime Player — Tracking Host — Aqua");
    expect(
      composeRuntimePlayerStageWindowTitle({
        role: "trackingHost",
        modelName: "Aqua"
      })
    ).toBe("Runtime Player Stage — Tracking Host — Aqua");
  });

  it("omits blank model names and falls back to the plain base when role is null", () => {
    expect(
      composeRuntimePlayerControlWindowTitle({
        role: "trackingHost",
        modelName: "   "
      })
    ).toBe("Runtime Player — Tracking Host");
    expect(
      composeRuntimePlayerControlWindowTitle({ role: null })
    ).toBe("Runtime Player");
    expect(composeRuntimePlayerStageWindowTitle({ role: null })).toBe(
      "Runtime Player Stage"
    );
  });

  it("formats the tray tooltip as 'Runtime Player — <role> / <model>'", () => {
    expect(
      composeRuntimePlayerTrayTooltip({ role: "trackingHost" })
    ).toBe("Runtime Player — Tracking Host");
    expect(
      composeRuntimePlayerTrayTooltip({
        role: "autonomousHost",
        modelName: "Aqua"
      })
    ).toBe("Runtime Player — Autonomous Host / Aqua");
    expect(composeRuntimePlayerTrayTooltip({ role: null })).toBe(
      "Runtime Player"
    );
  });
});
