export interface Live2dPerformanceTimingStats {
  readonly count: number;
  readonly totalMs: number;
  readonly maxMs: number;
}

export interface Live2dPerformanceStats {
  readonly counters: Record<string, number>;
  readonly timings: Record<string, Live2dPerformanceTimingStats>;
}

type Live2dPerformanceGlobal = typeof globalThis & {
  __LIVE2D_PERF__?: boolean;
  __LIVE2D_PERF_STATS__?: Live2dPerformanceStats;
  localStorage?: {
    readonly getItem: (key: string) => string | null;
  };
  performance?: {
    readonly now: () => number;
  };
};

export const LIVE2D_PERFORMANCE_DEV_FLAG =
  'Enable with globalThis.__LIVE2D_PERF__ === true or localStorage.live2dPerf === "1".';

export const isLive2dPerformanceEnabled = (): boolean => {
  const globalScope = globalThis as Live2dPerformanceGlobal;
  if (globalScope.__LIVE2D_PERF__ === true) {
    return true;
  }

  try {
    return globalScope.localStorage?.getItem("live2dPerf") === "1";
  } catch {
    return false;
  }
};

export const getLive2dPerformanceStats = (): Live2dPerformanceStats | undefined =>
  (globalThis as Live2dPerformanceGlobal).__LIVE2D_PERF_STATS__;

export const resetLive2dPerformanceStats = (): void => {
  delete (globalThis as Live2dPerformanceGlobal).__LIVE2D_PERF_STATS__;
};

export const recordLive2dPerformanceCounter = (
  counterName: string,
  amount = 1
): void => {
  if (!isLive2dPerformanceEnabled()) {
    return;
  }

  const stats = ensureLive2dPerformanceStats();
  stats.counters[counterName] = (stats.counters[counterName] ?? 0) + amount;
};

export const startLive2dPerformanceTiming = (): number | null => {
  if (!isLive2dPerformanceEnabled()) {
    return null;
  }

  return readPerformanceNow();
};

export const recordLive2dPerformanceTiming = (
  timingName: string,
  startMs: number | null
): void => {
  if (startMs === null || !isLive2dPerformanceEnabled()) {
    return;
  }

  const durationMs = Math.max(0, readPerformanceNow() - startMs);
  const stats = ensureLive2dPerformanceStats();
  const current = stats.timings[timingName] ?? {
    count: 0,
    totalMs: 0,
    maxMs: 0
  };

  stats.timings[timingName] = {
    count: current.count + 1,
    totalMs: current.totalMs + durationMs,
    maxMs: Math.max(current.maxMs, durationMs)
  };
};

function ensureLive2dPerformanceStats(): Live2dPerformanceStats {
  const globalScope = globalThis as Live2dPerformanceGlobal;
  const stats = globalScope.__LIVE2D_PERF_STATS__ ?? {
    counters: {},
    timings: {}
  };
  globalScope.__LIVE2D_PERF_STATS__ = stats;
  return stats;
}

function readPerformanceNow(): number {
  const now = (globalThis as Live2dPerformanceGlobal).performance?.now;
  return now === undefined ? Date.now() : now();
}
