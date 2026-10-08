import { describe, expect, it } from "vitest";

import {
  LocalPreviewLiveRenderSuspensionPolicy,
  type LocalPreviewLiveRenderSuspensionState,
  type LocalPreviewLiveRenderSuspensionTimers
} from "./local-preview-live-render-suspension";

describe("LocalPreviewLiveRenderSuspensionPolicy", () => {
  it("keeps local preview live rendering active while no Browser Source client is connected", () => {
    const states: LocalPreviewLiveRenderSuspensionState[] = [];
    const policy = new LocalPreviewLiveRenderSuspensionPolicy({
      onStateChanged: (state) => states.push(state)
    });

    policy.updateConnectedClientCount(0);

    expect(policy.getState()).toStrictEqual({
      connectedClientCount: 0,
      suspended: false,
      resumePending: false
    });
    expect(states).toEqual([]);
  });

  it("suspends immediately when one or more Browser Source clients connect", () => {
    const states: LocalPreviewLiveRenderSuspensionState[] = [];
    const policy = new LocalPreviewLiveRenderSuspensionPolicy({
      onStateChanged: (state) => states.push(state)
    });

    policy.updateConnectedClientCount(1);
    policy.updateConnectedClientCount(2);

    expect(policy.isSuspended()).toBe(true);
    expect(states).toEqual([
      {
        connectedClientCount: 1,
        suspended: true,
        resumePending: false
      }
    ]);
  });

  it("resumes only after the zero-client grace period completes", () => {
    const timers = createManualTimers();
    const states: LocalPreviewLiveRenderSuspensionState[] = [];
    const policy = new LocalPreviewLiveRenderSuspensionPolicy({
      resumeGraceMs: 2000,
      timers,
      onStateChanged: (state) => states.push(state)
    });

    policy.updateConnectedClientCount(1);
    policy.updateConnectedClientCount(0);

    expect(policy.getState()).toStrictEqual({
      connectedClientCount: 0,
      suspended: true,
      resumePending: true
    });

    timers.runNext();

    expect(policy.getState()).toStrictEqual({
      connectedClientCount: 0,
      suspended: false,
      resumePending: false
    });
    expect(states.at(-1)).toStrictEqual({
      connectedClientCount: 0,
      suspended: false,
      resumePending: false
    });
  });

  it("cancels a pending resume when a reconnect happens during the grace period", () => {
    const timers = createManualTimers();
    const states: LocalPreviewLiveRenderSuspensionState[] = [];
    const policy = new LocalPreviewLiveRenderSuspensionPolicy({
      resumeGraceMs: 2000,
      timers,
      onStateChanged: (state) => states.push(state)
    });

    policy.updateConnectedClientCount(1);
    policy.updateConnectedClientCount(0);
    policy.updateConnectedClientCount(1);
    timers.runNext();

    expect(policy.getState()).toStrictEqual({
      connectedClientCount: 1,
      suspended: true,
      resumePending: false
    });
    expect(states.filter((state) => !state.suspended)).toEqual([]);
  });
});

function createManualTimers(): LocalPreviewLiveRenderSuspensionTimers & {
  readonly runNext: () => void;
} {
  let nextHandle = 1;
  const timeouts = new Map<number, () => void>();

  return {
    setTimeout: (callback) => {
      const handle = nextHandle;
      nextHandle += 1;
      timeouts.set(handle, callback);
      return handle;
    },
    clearTimeout: (handle) => {
      timeouts.delete(Number(handle));
    },
    runNext: () => {
      const entry = timeouts.entries().next().value;
      if (entry === undefined) {
        return;
      }

      const [handle, callback] = entry;
      timeouts.delete(handle);
      callback();
    }
  };
}
