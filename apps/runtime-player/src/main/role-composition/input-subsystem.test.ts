import { describe, expect, it, vi } from "vitest";

import {
  composeRuntimePlayerInputSubsystem,
  runtimePlayerInputSubsystemComposers,
  type RuntimePlayerInputSubsystemDependencies
} from "./input-subsystem";

/**
 * These tests pin the single composition-root role selection: the Tracking Host
 * assembles the three input registrars; the Autonomous Host assembles none (no
 * UDP receiver / input registrars exist in its composition).
 */

function createFakeInputBridgeRegistration() {
  return {
    state: {
      getLatestTrackingFrame: vi.fn(() => null),
      getSessionNeutral: vi.fn(() => null)
    },
    disconnect: vi.fn(async () => ({}))
  };
}

function createFakeModelMappingRegistration() {
  return {
    publishStatus: vi.fn(),
    setRuntimeExportPayload: vi.fn(async () => ({})),
    clearRuntimeExport: vi.fn(() => ({})),
    flushPendingProfileSave: vi.fn(async () => {}),
    publishLatestParameterFrame: vi.fn(async () => {}),
    clearLiveParameterFrame: vi.fn()
  };
}

function createDependencies(): {
  readonly deps: RuntimePlayerInputSubsystemDependencies;
  readonly registerInputBridgeHandlers: ReturnType<typeof vi.fn>;
  readonly registerInputProfileBridgeHandlers: ReturnType<typeof vi.fn>;
  readonly registerModelMappingBridgeHandlers: ReturnType<typeof vi.fn>;
  readonly liveParametersClear: ReturnType<typeof vi.fn>;
} {
  const registerInputBridgeHandlers = vi.fn(() =>
    createFakeInputBridgeRegistration()
  );
  const registerInputProfileBridgeHandlers = vi.fn(() => ({
    getActiveInputProfile: vi.fn(async () => null)
  }));
  const registerModelMappingBridgeHandlers = vi.fn(() =>
    createFakeModelMappingRegistration()
  );
  const liveParametersClear = vi.fn();

  const deps = {
    windows: {} as never,
    userDataPath: "/tmp/slot",
    liveMappingState: {} as never,
    bodyFollowState: { reset: vi.fn() } as never,
    vowelLipsyncState: { reset: vi.fn() } as never,
    modelMappingProfileStore: {} as never,
    liveParameters: { clear: liveParametersClear } as never,
    resetStageMotion: vi.fn(),
    requestStageMotionRepublish: vi.fn(),
    registerInputBridgeHandlers:
      registerInputBridgeHandlers as never,
    registerInputProfileBridgeHandlers:
      registerInputProfileBridgeHandlers as never,
    registerModelMappingBridgeHandlers:
      registerModelMappingBridgeHandlers as never
  } satisfies RuntimePlayerInputSubsystemDependencies;

  return {
    deps,
    registerInputBridgeHandlers,
    registerInputProfileBridgeHandlers,
    registerModelMappingBridgeHandlers,
    liveParametersClear
  };
}

describe("Runtime Player input subsystem composition", () => {
  it("exposes exactly one composer per host role", () => {
    expect(Object.keys(runtimePlayerInputSubsystemComposers).sort()).toEqual([
      "autonomousHost",
      "trackingHost"
    ]);
  });

  it("Tracking Host assembles the three input registrars", () => {
    const harness = createDependencies();

    const subsystem = composeRuntimePlayerInputSubsystem(
      "trackingHost",
      harness.deps
    );

    expect(subsystem.usesTrackingInput).toBe(true);
    expect(harness.registerInputBridgeHandlers).toHaveBeenCalledTimes(1);
    expect(harness.registerInputProfileBridgeHandlers).toHaveBeenCalledTimes(1);
    expect(harness.registerModelMappingBridgeHandlers).toHaveBeenCalledTimes(1);
  });

  it("Autonomous Host assembles no input registrars (no UDP / tracking path)", () => {
    const harness = createDependencies();

    const subsystem = composeRuntimePlayerInputSubsystem(
      "autonomousHost",
      harness.deps
    );

    expect(subsystem.usesTrackingInput).toBe(false);
    expect(harness.registerInputBridgeHandlers).not.toHaveBeenCalled();
    expect(harness.registerInputProfileBridgeHandlers).not.toHaveBeenCalled();
    expect(harness.registerModelMappingBridgeHandlers).not.toHaveBeenCalled();
  });

  it("Autonomous Host subsystem is inert (static display seams)", async () => {
    const harness = createDependencies();

    const subsystem = composeRuntimePlayerInputSubsystem(
      "autonomousHost",
      harness.deps
    );

    expect(subsystem.getLatestTrackingFrame()).toBeNull();
    expect(subsystem.getSessionNeutral()).toBeNull();
    await expect(subsystem.getActiveInputProfile()).resolves.toBeNull();
    await expect(subsystem.flushPendingProfileSave()).resolves.toBeUndefined();
    await expect(subsystem.disconnect()).resolves.toBeUndefined();

    // Clearing live parameters still flushes the shared registration so no stale
    // frame lingers, matching the historical pre-mapping default.
    subsystem.clearLiveParameterFrame();
    expect(harness.liveParametersClear).toHaveBeenCalledTimes(1);
  });
});
