import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  ipcMainHandle: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: electronMocks.ipcMainHandle
  }
}));

import { physiologyBridgeChannels } from "../preload/physiology-bridge-channels";
import type {
  PhysiologyActionResult,
  PhysiologyStatus
} from "../preload/physiology-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../preload/runtime-export-bridge-contract";
import { registerPhysiologyBridgeHandlers } from "./physiology-bridge-handlers";
import { PhysiologyProfileStore } from "./physiology-profiles/physiology-profile-store";
import { RuntimePlayerPhysiologyState } from "./physiology-profiles/physiology-state";
import {
  ARTICULATION_FLOOR_CRISP,
  DEFAULT_TONE
} from "./physiology-profiles/physiology-tone-config";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";

type IpcHandler = (event?: unknown, ...args: unknown[]) => unknown;

let handlers: Map<string, IpcHandler>;

beforeEach(() => {
  handlers = new Map();
  electronMocks.ipcMainHandle.mockReset();
  electronMocks.ipcMainHandle.mockImplementation(
    (channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    }
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("registerPhysiologyBridgeHandlers", () => {
  it("reports physiology absence as data on the Tracking Host (available:false)", async () => {
    // The Tracking Host body is driven by tracking; the bridge reports absence as
    // DATA sourced from the state's availability seam — no `if (role === ...)`.
    const trackingState = new RuntimePlayerPhysiologyState({
      isAvailable: () => false
    });
    registerPhysiologyBridgeHandlers({
      windows: createFakeWindows(),
      physiologyState: trackingState
    });

    const status = await invokeHandler<Promise<PhysiologyStatus>>(
      physiologyBridgeChannels.getStatus
    );

    expect(status.available).toBe(false);
    expect(status.status).toBe("unavailable");
  });

  it("reports physiology present on the Autonomous Host (available:true)", async () => {
    const autonomousState = new RuntimePlayerPhysiologyState({
      isAvailable: () => true
    });
    registerPhysiologyBridgeHandlers({
      windows: createFakeWindows(),
      physiologyState: autonomousState
    });

    const status = await invokeHandler<Promise<PhysiologyStatus>>(
      physiologyBridgeChannels.getStatus
    );

    expect(status.available).toBe(true);
  });

  it("debounces auto-save of quality-word tone edits after mutating state", async () => {
    vi.useFakeTimers();

    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-physiology-bridge-")
    );
    const payload = createPayload();
    const profileStore = new CountingPhysiologyProfileStore({ userDataPath });
    const physiologyState = new RuntimePlayerPhysiologyState({
      nowMs: () => Date.parse("2026-07-01T03:00:00.000Z")
    });
    const registration = registerPhysiologyBridgeHandlers({
      windows: createFakeWindows(),
      physiologyState,
      profileStore,
      profileSaveDebounceMs: 25
    });

    await registration.setRuntimeExportPayload(payload);

    const updateResult = await invokeHandler<Promise<PhysiologyActionResult>>(
      physiologyBridgeChannels.updateTone,
      { section: "gaze", field: "dwell", tone: 0.9 }
    );

    expect(updateResult.result).toBe("ok");
    expect(updateResult.status.profileStatus.kind).toBe("unsaved");

    await vi.advanceTimersByTimeAsync(25);
    await profileStore.waitForSaveCount(1);

    const saved = await profileStore.loadProfile(payload);
    expect(saved.state).toBe("loaded");
    expect(saved.profile?.overrides).toEqual({ gaze: { dwell: 0.9 } });
  });

  it("accepts the page's Stage Presence Strength request end-to-end (F1 regression)", async () => {
    // The masking gap: the page fires Strength through the generic updateTone shape,
    // but the state used to reject it. Drive the REAL state through the bridge with
    // the page's exact request shape — it must NOT be a validation-error and must
    // reach the config Domain D reads.
    const physiologyState = new RuntimePlayerPhysiologyState();
    const registration = registerPhysiologyBridgeHandlers({
      windows: createFakeWindows(),
      physiologyState
    });
    await registration.setRuntimeExportPayload(createPayload());

    const result = await invokeHandler<Promise<PhysiologyActionResult>>(
      physiologyBridgeChannels.updateTone,
      { section: "stagePresence", field: "strength", tone: 0.7 }
    );

    expect(result.result).toBe("ok");
    const stage = result.status.sections.find(
      (section) => section.section === "stagePresence"
    );
    expect(stage?.tones.strength).toBe(0.7);
    expect(physiologyState.getPhysiologyConfig().stagePresence?.strength).toBe(
      0.7
    );
  });

  it("accepts the page's Speech Articulation update end-to-end (F Domain hotfix)", async () => {
    // The reported bug: the Physiology Speech section fires updateTone with section
    // "speech", but the bridge validation whitelist had dropped "speech" and rejected
    // it as "Physiology section is not a known section." Drive the REAL state through the
    // bridge with the page's exact request shape — it must NOT be a validation-error and
    // the crispest Articulation floor must reach the config seam the speech evaluator reads.
    const physiologyState = new RuntimePlayerPhysiologyState();
    const registration = registerPhysiologyBridgeHandlers({
      windows: createFakeWindows(),
      physiologyState
    });
    await registration.setRuntimeExportPayload(createPayload());

    const result = await invokeHandler<Promise<PhysiologyActionResult>>(
      physiologyBridgeChannels.updateTone,
      { section: "speech", field: "articulation", tone: 1 }
    );

    expect(result.result).toBe("ok");
    const speech = result.status.sections.find(
      (section) => section.section === "speech"
    );
    expect(speech?.hasOverride).toBe(true);
    expect(speech?.tones.articulation).toBe(1);
    expect(physiologyState.getPhysiologyConfig().speech?.articulationFloor).toBe(
      ARTICULATION_FLOOR_CRISP
    );
  });

  it("resets the Speech section end-to-end (F Domain hotfix)", async () => {
    // Reset Speech was rejected by the same whitelist gap. After a real Articulation
    // edit, the reset request must be accepted and clear the section back to default.
    const physiologyState = new RuntimePlayerPhysiologyState();
    const registration = registerPhysiologyBridgeHandlers({
      windows: createFakeWindows(),
      physiologyState
    });
    await registration.setRuntimeExportPayload(createPayload());

    await invokeHandler<Promise<PhysiologyActionResult>>(
      physiologyBridgeChannels.updateTone,
      { section: "speech", field: "articulation", tone: 1 }
    );

    const resetResult = await invokeHandler<Promise<PhysiologyActionResult>>(
      physiologyBridgeChannels.resetSection,
      { section: "speech" }
    );

    expect(resetResult.result).toBe("ok");
    const speech = resetResult.status.sections.find(
      (section) => section.section === "speech"
    );
    expect(speech?.hasOverride).toBe(false);
    expect(speech?.tones.articulation).toBe(DEFAULT_TONE);
  });

  it("coalesces multiple edits within the debounce window into a single save", async () => {
    vi.useFakeTimers();

    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-physiology-bridge-")
    );
    const payload = createPayload();
    const profileStore = new CountingPhysiologyProfileStore({ userDataPath });
    const physiologyState = new RuntimePlayerPhysiologyState({
      nowMs: () => Date.parse("2026-07-01T03:00:00.000Z")
    });
    const registration = registerPhysiologyBridgeHandlers({
      windows: createFakeWindows(),
      physiologyState,
      profileStore,
      profileSaveDebounceMs: 25
    });
    await registration.setRuntimeExportPayload(payload);

    // Three rapid edits inside one debounce window — each reschedules the timer.
    await invokeHandler<Promise<PhysiologyActionResult>>(
      physiologyBridgeChannels.updateTone,
      { section: "gaze", field: "dwell", tone: 0.6 }
    );
    await invokeHandler<Promise<PhysiologyActionResult>>(
      physiologyBridgeChannels.updateTone,
      { section: "gaze", field: "dwell", tone: 0.7 }
    );
    await invokeHandler<Promise<PhysiologyActionResult>>(
      physiologyBridgeChannels.updateTone,
      { section: "gaze", field: "dwell", tone: 0.8 }
    );

    await vi.advanceTimersByTimeAsync(25);
    await profileStore.waitForSaveCount(1);

    // One coalesced save, carrying only the final value (rules out a per-edit save).
    expect(profileStore.saveCount).toBe(1);
    const saved = await profileStore.loadProfile(payload);
    expect(saved.profile?.overrides).toEqual({ gaze: { dwell: 0.8 } });
  });

  it("rejects an unknown section/field as a validation error", async () => {
    const physiologyState = new RuntimePlayerPhysiologyState();
    const registration = registerPhysiologyBridgeHandlers({
      windows: createFakeWindows(),
      physiologyState
    });
    await registration.setRuntimeExportPayload(createPayload());

    const result = await invokeHandler<Promise<PhysiologyActionResult>>(
      physiologyBridgeChannels.updateTone,
      { section: "nope", field: "dwell", tone: 0.5 }
    );

    expect(result.result).toBe("validation-error");
  });
});

class CountingPhysiologyProfileStore extends PhysiologyProfileStore {
  private readonly saveWaiters: Array<() => void> = [];
  saveCount = 0;

  override async saveProfile(
    input: Parameters<PhysiologyProfileStore["saveProfile"]>[0]
  ): Promise<string> {
    const profileFilePath = await super.saveProfile(input);
    this.saveCount += 1;
    this.saveWaiters.splice(0).forEach((resolve) => resolve());

    return profileFilePath;
  }

  async waitForSaveCount(expectedSaveCount: number): Promise<void> {
    while (this.saveCount < expectedSaveCount) {
      await new Promise<void>((resolve) => {
        this.saveWaiters.push(resolve);
      });
    }
  }
}

function invokeHandler<TResult>(channel: string, ...args: unknown[]): TResult {
  const handler = handlers.get(channel);
  expect(handler).toBeTypeOf("function");
  return handler?.({}, ...args) as TResult;
}

function createFakeWindows(): RuntimePlayerWindowSet {
  return {
    controlWindow:
      createFakeWindow() as unknown as RuntimePlayerWindowSet["controlWindow"],
    stageWindow:
      createFakeWindow() as unknown as RuntimePlayerWindowSet["stageWindow"]
  };
}

function createFakeWindow() {
  return {
    webContents: {
      isDestroyed: vi.fn(() => false),
      send: vi.fn()
    },
    isDestroyed: vi.fn(() => false)
  };
}

function createPayload(): RuntimeExportLoadedPayload {
  const sourcePackage = {
    packageId: "pkg_physiology_bridge_test",
    packageDisplayName: "Physiology Bridge Test",
    packageRevision: 1,
    packageHash: "sha256:physiology-bridge-test"
  };

  return {
    artifacts: {
      manifest: { sourcePackage, texturePages: [] },
      model: { sourcePackage, parameters: [] },
      atlas: {}
    },
    summary: {
      packageId: sourcePackage.packageId,
      packageRevision: sourcePackage.packageRevision,
      modelDisplayName: sourcePackage.packageDisplayName
    },
    loadedAtIso: "2026-07-01T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}
