import { describe, expect, it } from "vitest";

import { RuntimePlayerInputDiagnosticsThrottle } from "./input-diagnostics-throttle";

type ScheduledTimer = {
  readonly callback: () => void;
  readonly delayMs: number;
  canceled: boolean;
};

describe("Runtime Player input diagnostics throttle", () => {
  it("emits immediately and schedules packet-rate updates at most every 100ms", () => {
    let now = 0;
    const emittedAt: number[] = [];
    const timers: ScheduledTimer[] = [];
    const throttle = new RuntimePlayerInputDiagnosticsThrottle({
      minimumIntervalMs: 100,
      nowMs: () => now,
      emit: () => emittedAt.push(now),
      setTimeoutFn: (callback, delayMs) => {
        const timer = { callback, delayMs, canceled: false };
        timers.push(timer);
        return timer;
      },
      clearTimeoutFn: (handle) => {
        (handle as ScheduledTimer).canceled = true;
      }
    });

    throttle.request();
    now = 20;
    throttle.request();
    now = 40;
    throttle.request();

    expect(emittedAt).toEqual([0]);
    expect(timers).toHaveLength(1);
    expect(timers[0]?.delayMs).toBe(80);

    now = 100;
    timers[0]?.callback();

    expect(emittedAt).toEqual([0, 100]);
  });

  it("can cancel a pending trailing diagnostics update", () => {
    let now = 0;
    const emittedAt: number[] = [];
    const timers: ScheduledTimer[] = [];
    const throttle = new RuntimePlayerInputDiagnosticsThrottle({
      nowMs: () => now,
      emit: () => emittedAt.push(now),
      setTimeoutFn: (callback, delayMs) => {
        const timer = { callback, delayMs, canceled: false };
        timers.push(timer);
        return timer;
      },
      clearTimeoutFn: (handle) => {
        (handle as ScheduledTimer).canceled = true;
      }
    });

    throttle.request();
    now = 10;
    throttle.request();
    throttle.cancel();

    expect(timers[0]?.canceled).toBe(true);
    expect(emittedAt).toEqual([0]);
  });
});
