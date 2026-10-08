import { describe, expect, it } from "vitest";

import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import { canApplyLiveParameterFrame } from "./stage-live-parameter-frame-match";

describe("Stage live parameter frame matching", () => {
  it("rejects frames while no Runtime Export payload is loaded", () => {
    expect(canApplyLiveParameterFrame(createFrame(), null)).toBe(false);
  });

  it("accepts only frames for the currently loaded Runtime Export identity", () => {
    const payload = createPayload();

    expect(canApplyLiveParameterFrame(createFrame(), payload)).toBe(true);
    expect(canApplyLiveParameterFrame(createFrame({
      packageId: "pkg_other"
    }), payload)).toBe(false);
    expect(canApplyLiveParameterFrame(createFrame({
      packageRevision: 2
    }), payload)).toBe(false);
    expect(canApplyLiveParameterFrame(createFrame({
      loadedAtIso: "2026-06-22T00:00:01.000Z"
    }), payload)).toBe(false);
  });
});

function createPayload(): RuntimeExportLoadedPayload {
  return {
    summary: {
      packageId: "pkg_stage_live_match",
      packageRevision: 1
    },
    loadedAtIso: "2026-06-22T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}

function createFrame(
  overrides: Partial<RuntimePlayerLiveParameterFrame["runtimeExport"]> = {}
): RuntimePlayerLiveParameterFrame {
  return {
    schemaVersion: "runtime-player-live-parameter-frame-v1",
    runtimeExport: {
      packageId: overrides.packageId ?? "pkg_stage_live_match",
      packageRevision: overrides.packageRevision ?? 1,
      loadedAtIso: overrides.loadedAtIso ?? "2026-06-22T00:00:00.000Z"
    },
    sequence: 1,
    producedAtIso: "2026-06-22T00:00:00.050Z",
    sourceFrameTimestampMs: 50,
    parameterValues: {
      param_face_angle_x: 1
    }
  };
}
