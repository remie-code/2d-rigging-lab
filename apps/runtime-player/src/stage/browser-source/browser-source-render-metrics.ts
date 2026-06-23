import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";

export type BrowserSourceRenderMetricSnapshot = {
  readonly fps: number | null;
  readonly frameAgeMs: number | null;
};

export class BrowserSourceRenderMetrics {
  #lastSourceFrameTimestampMs: number | null = null;
  #latestProducedAtMs: number | null = null;
  #fps: number | null = null;

  recordLiveParameterFrame(frame: RuntimePlayerLiveParameterFrame): void {
    if (this.#lastSourceFrameTimestampMs !== null) {
      const deltaMs = frame.sourceFrameTimestampMs - this.#lastSourceFrameTimestampMs;
      if (deltaMs > 0) {
        this.#fps = Math.round((1000 / deltaMs) * 10) / 10;
      }
    }

    this.#lastSourceFrameTimestampMs = frame.sourceFrameTimestampMs;
    const producedAtMs = Date.parse(frame.producedAtIso);
    this.#latestProducedAtMs = Number.isFinite(producedAtMs)
      ? producedAtMs
      : null;
  }

  clear(): void {
    this.#lastSourceFrameTimestampMs = null;
    this.#latestProducedAtMs = null;
    this.#fps = null;
  }

  snapshot(nowMs: number): BrowserSourceRenderMetricSnapshot {
    return {
      fps: this.#fps,
      frameAgeMs: this.#latestProducedAtMs === null
        ? null
        : Math.max(0, Math.round(nowMs - this.#latestProducedAtMs))
    };
  }
}
