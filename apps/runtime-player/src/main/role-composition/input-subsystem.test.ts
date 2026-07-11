import { describe, expect, it, vi } from "vitest";

import { DEFAULT_PHYSIOLOGY_CONFIG, type PhysiologyConfig } from "../physiology";
import { deriveStagePresenceStageMotionSettings } from "../presence/stage-presence-drive";
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

function createFakeHeart() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    isRunning: vi.fn(() => false),
    getLatestStageMotionSignal: vi.fn(() => ({
      horizontal: 0.5,
      depth: -0.5,
      timestampMs: 1234
    }))
  };
}

function createDependencies(): {
  readonly deps: RuntimePlayerInputSubsystemDependencies;
  readonly registerInputBridgeHandlers: ReturnType<typeof vi.fn>;
  readonly registerInputProfileBridgeHandlers: ReturnType<typeof vi.fn>;
  readonly registerModelMappingBridgeHandlers: ReturnType<typeof vi.fn>;
  readonly liveParametersClear: ReturnType<typeof vi.fn>;
  readonly createAutonomousFrameHeart: ReturnType<typeof vi.fn>;
  readonly heart: ReturnType<typeof createFakeHeart>;
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
  const heart = createFakeHeart();
  const createAutonomousFrameHeart = vi.fn(() => heart);

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
      registerModelMappingBridgeHandlers as never,
    createAutonomousFrameHeart: createAutonomousFrameHeart as never
  } satisfies RuntimePlayerInputSubsystemDependencies;

  return {
    deps,
    registerInputBridgeHandlers,
    registerInputProfileBridgeHandlers,
    registerModelMappingBridgeHandlers,
    liveParametersClear,
    createAutonomousFrameHeart,
    heart
  };
}

function createFakeRuntimeExportPayload(
  overrides: Partial<{
    packageId: string;
    packageRevision: number;
    loadedAtIso: string;
  }> = {}
) {
  return {
    artifacts: {
      model: {
        inputManifest: {
          externalInputParameterIds: [],
          computedDynamicsOutputParameterIds: [],
          hiddenDirectControlParameterIds: []
        },
        parameters: []
      }
    },
    summary: {
      packageId: overrides.packageId ?? "pkg-alpha",
      packageRevision: overrides.packageRevision ?? 1
    },
    loadedAtIso: overrides.loadedAtIso ?? "2026-07-10T00:00:00.000Z"
  } as never;
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

  it("Tracking Host has no frame heart / generator (blink is tracking-driven)", async () => {
    const harness = createDependencies();

    const subsystem = composeRuntimePlayerInputSubsystem(
      "trackingHost",
      harness.deps
    );

    // The generator + frame heart are Autonomous-Host-only. The tracking
    // composer must never construct one, and loading a Runtime Export on the
    // tracking host must not start a heartbeat.
    expect(harness.createAutonomousFrameHeart).not.toHaveBeenCalled();
    await subsystem.setRuntimeExportPayload(
      createFakeRuntimeExportPayload()
    );
    subsystem.clearRuntimeExport();
    await subsystem.disconnect();
    expect(harness.createAutonomousFrameHeart).not.toHaveBeenCalled();
    expect(harness.heart.start).not.toHaveBeenCalled();
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

  it("Autonomous Host keeps the static tracking-side seams", async () => {
    const harness = createDependencies();

    const subsystem = composeRuntimePlayerInputSubsystem(
      "autonomousHost",
      harness.deps
    );

    expect(subsystem.getLatestTrackingFrame()).toBeNull();
    expect(subsystem.getSessionNeutral()).toBeNull();
    await expect(subsystem.getActiveInputProfile()).resolves.toBeNull();
    await expect(subsystem.flushPendingProfileSave()).resolves.toBeUndefined();
    // publishLatestParameterFrame stays a no-op: the heart is the sole frame
    // source, so the load handler's void publishLatestParameterFrame() cannot
    // race the heartbeat.
    await expect(subsystem.publishLatestParameterFrame()).resolves.toBeUndefined();

    // Clearing live parameters still flushes the shared registration so no stale
    // frame lingers, matching the historical pre-mapping default.
    subsystem.clearLiveParameterFrame();
    expect(harness.liveParametersClear).toHaveBeenCalledTimes(1);
  });

  it("Autonomous Host starts the frame heart on load and stops it on unload/quit", async () => {
    const harness = createDependencies();

    const subsystem = composeRuntimePlayerInputSubsystem(
      "autonomousHost",
      harness.deps
    );

    // Exactly one heart is constructed for the composition, wired to the shared
    // publishFrame seam (sanitization boundary preserved). No config provider is
    // in these deps, so the config seam forwards `undefined` (heart falls back to
    // the universal-default config = C2 behavior).
    expect(harness.createAutonomousFrameHeart).toHaveBeenCalledTimes(1);
    expect(harness.createAutonomousFrameHeart.mock.calls[0]?.[0]).toEqual({
      liveParameters: harness.deps.liveParameters,
      getPhysiologyConfig: undefined
    });

    // Load = heartbeat start, with auto-mapping slots and a non-exposed seed.
    await subsystem.setRuntimeExportPayload(
      createFakeRuntimeExportPayload({ packageId: "pkg-x", packageRevision: 2 })
    );
    expect(harness.heart.start).toHaveBeenCalledTimes(1);
    const startArg = harness.heart.start.mock.calls[0]?.[0];
    expect(startArg.payload.summary.packageId).toBe("pkg-x");
    expect(Array.isArray(startArg.slots)).toBe(true);
    expect(startArg.slots.length).toBe(16); // all semantic slots (unmapped ⇒ silent)
    expect(typeof startArg.seed).toBe("number");

    // Unload stops the heart (timer disposed).
    subsystem.clearRuntimeExport();
    expect(harness.heart.stop).toHaveBeenCalledTimes(1);

    // Quit stops the heart too (no timer leak, quit never blocked).
    await subsystem.disconnect();
    expect(harness.heart.stop).toHaveBeenCalledTimes(2);
  });

  it("Autonomous Host forwards the physiology config provider to the heart (裁定3)", () => {
    const harness = createDependencies();
    const physiologyConfigProvider = vi.fn(() => DEFAULT_PHYSIOLOGY_CONFIG);

    composeRuntimePlayerInputSubsystem("autonomousHost", {
      ...harness.deps,
      physiologyConfigProvider
    });

    // The config seam reaches the heart only through the autonomous composer.
    expect(harness.createAutonomousFrameHeart.mock.calls[0]?.[0]).toEqual({
      liveParameters: harness.deps.liveParameters,
      getPhysiologyConfig: physiologyConfigProvider
    });
  });

  it("Tracking Host ignores the physiology config provider (role差は合成テーブル1点)", () => {
    const harness = createDependencies();
    const physiologyConfigProvider = vi.fn(() => DEFAULT_PHYSIOLOGY_CONFIG);

    composeRuntimePlayerInputSubsystem("trackingHost", {
      ...harness.deps,
      physiologyConfigProvider
    });

    // The tracking composer builds no heart and never reads the provider.
    expect(harness.createAutonomousFrameHeart).not.toHaveBeenCalled();
    expect(physiologyConfigProvider).not.toHaveBeenCalled();
  });

  it("Autonomous Host restart (load→load) re-starts the same heart (no second heart)", async () => {
    const harness = createDependencies();

    const subsystem = composeRuntimePlayerInputSubsystem(
      "autonomousHost",
      harness.deps
    );

    await subsystem.setRuntimeExportPayload(createFakeRuntimeExportPayload());
    await subsystem.setRuntimeExportPayload(
      createFakeRuntimeExportPayload({ loadedAtIso: "2026-07-10T00:01:00.000Z" })
    );

    // One heart instance; start called per load (the heart disposes its own
    // prior timer internally — see autonomous-frame-heart.test.ts).
    expect(harness.createAutonomousFrameHeart).toHaveBeenCalledTimes(1);
    expect(harness.heart.start).toHaveBeenCalledTimes(2);
  });

  // --- C3 Domain D: Stage Presence supply seam --------------------------------

  it("Tracking Host never drives Stage Presence (getStageMotionDrive → null)", () => {
    const harness = createDependencies();
    const physiologyConfigProvider = vi.fn(
      (): PhysiologyConfig => ({
        ...DEFAULT_PHYSIOLOGY_CONFIG,
        stagePresence: { enabled: true, strength: 1 }
      })
    );

    const subsystem = composeRuntimePlayerInputSubsystem("trackingHost", {
      ...harness.deps,
      physiologyConfigProvider
    });

    // The role difference is expressed HERE as data: the tracking subsystem returns
    // null so the composition root keeps its existing head-position Stage Motion.
    expect(subsystem.getStageMotionDrive()).toBeNull();
  });

  it("Autonomous Host supplies a Stage Presence drive from posture + config (Domain D)", () => {
    const harness = createDependencies();
    const physiologyConfigProvider = vi.fn(
      (): PhysiologyConfig => ({
        ...DEFAULT_PHYSIOLOGY_CONFIG,
        stagePresence: { enabled: true, strength: 1 }
      })
    );

    const subsystem = composeRuntimePlayerInputSubsystem("autonomousHost", {
      ...harness.deps,
      physiologyConfigProvider
    });

    const drive = subsystem.getStageMotionDrive();
    expect(drive).not.toBeNull();
    // Posture signal from the heart (body-x → horizontal, body-z → depth).
    expect(drive?.horizontalInput).toBe(0.5);
    expect(drive?.depthInput).toBe(-0.5);
    expect(drive?.timestampMs).toBe(1234);
    // Settings derived from the Physiology stagePresence config, NOT window-state.
    expect(drive?.settings).toEqual(
      deriveStagePresenceStageMotionSettings({ enabled: true, strength: 1 })
    );
    expect(harness.heart.getLatestStageMotionSignal).toHaveBeenCalled();
  });

  it("Autonomous Host still supplies a (disabled) drive when Stage Presence is off", () => {
    const harness = createDependencies();
    const physiologyConfigProvider = vi.fn(
      (): PhysiologyConfig => ({
        ...DEFAULT_PHYSIOLOGY_CONFIG,
        stagePresence: { enabled: false, strength: 0.3 }
      })
    );

    const subsystem = composeRuntimePlayerInputSubsystem("autonomousHost", {
      ...harness.deps,
      physiologyConfigProvider
    });

    // Off is carried in settings.enabled (the runtime returns base for it); the seam
    // still expresses「Autonomous drives Stage Presence」as data.
    expect(subsystem.getStageMotionDrive()?.settings.enabled).toBe(false);
  });

  it("Autonomous Host returns null drive with no physiology config provider", () => {
    const harness = createDependencies();

    const subsystem = composeRuntimePlayerInputSubsystem(
      "autonomousHost",
      harness.deps
    );

    // Without a provider there is no stagePresence field → Stage Motion stays inert
    // exactly as before Domain D (no regression for compositions lacking a state).
    expect(subsystem.getStageMotionDrive()).toBeNull();
  });
});
