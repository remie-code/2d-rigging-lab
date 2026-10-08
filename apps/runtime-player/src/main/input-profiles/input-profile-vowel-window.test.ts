import { describe, expect, it } from "vitest";

import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
import {
  summarizeVowelWindow,
  toVowelBlendshapeMeans
} from "./input-profile-vowel-window";

function frame(blendshapes: Record<string, number>): TrackingFrame {
  return {
    source: "ifacialmocap",
    transport: "udp",
    timestampMs: 0,
    blendshapes,
    head: {}
  };
}

describe("summarizeVowelWindow", () => {
  it("computes per-blendshape mean/min/max and the frame count over a window", () => {
    const summary = summarizeVowelWindow([
      frame({ jawOpen: 0.2, mouthFunnel: 0.1 }),
      frame({ jawOpen: 0.4, mouthFunnel: 0.5 }),
      frame({ jawOpen: 0.6, mouthFunnel: 0.3 })
    ]);

    expect(summary).not.toBeNull();
    expect(summary?.frameCount).toBe(3);
    expect(summary?.blendshapes.jawOpen).toEqual({
      mean: 0.4,
      min: 0.2,
      max: 0.6
    });
    expect(summary?.blendshapes.mouthFunnel).toEqual({
      mean: 0.3,
      min: 0.1,
      max: 0.5
    });
  });

  it("rounds means to four decimals like the capture tool", () => {
    const summary = summarizeVowelWindow([
      frame({ jawOpen: 0.1 }),
      frame({ jawOpen: 0.2 }),
      frame({ jawOpen: 0.2 })
    ]);

    // (0.1 + 0.2 + 0.2) / 3 = 0.16666... -> round4
    expect(summary?.blendshapes.jawOpen?.mean).toBe(0.1667);
  });

  it("returns null for an empty window", () => {
    expect(summarizeVowelWindow([])).toBeNull();
  });

  it("projects a summary to a mean-only vector", () => {
    const summary = summarizeVowelWindow([
      frame({ jawOpen: 0.2, mouthPucker: 0.4 }),
      frame({ jawOpen: 0.4, mouthPucker: 0.6 })
    ]);

    expect(summary).not.toBeNull();
    expect(toVowelBlendshapeMeans(summary!)).toEqual({
      jawOpen: 0.3,
      mouthPucker: 0.5
    });
  });
});
