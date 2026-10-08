import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
import type { InputProfileVowelBlendshapeMeans } from "./input-profile-document";

/**
 * Window-mean sampling for vowel calibration (design §4 "窓平均採取").
 *
 * Ported from `apps/runtime-player/tools/capture-vowel-frames.ts`
 * `summarizeSamples` (which aggregates raw iFacialMocap frame STRINGS because
 * the CLI receives them over UDP). Inside the player we already hold normalized
 * `TrackingFrame`s, so this variant aggregates the parsed numeric blendshape
 * dictionaries directly. It computes per-blendshape mean/min/max plus the frame
 * count over the window, matching the CLI's rounding (round4).
 */

const roundingScale = 10000;

export type VowelBlendshapeStat = {
  readonly mean: number;
  readonly min: number;
  readonly max: number;
};

export type VowelWindowSummary = {
  readonly frameCount: number;
  readonly blendshapes: Readonly<Record<string, VowelBlendshapeStat>>;
};

type MutableBlendshapeStat = {
  sum: number;
  min: number;
  max: number;
  count: number;
};

/**
 * Aggregate a window of tracking frames into per-blendshape mean/min/max and a
 * frame count. Returns `null` for an empty window (no frames to summarize).
 */
export function summarizeVowelWindow(
  frames: readonly TrackingFrame[]
): VowelWindowSummary | null {
  if (frames.length === 0) {
    return null;
  }

  const stats = new Map<string, MutableBlendshapeStat>();

  for (const frame of frames) {
    for (const [name, value] of Object.entries(frame.blendshapes)) {
      const entry = stats.get(name);

      if (entry === undefined) {
        stats.set(name, { sum: value, min: value, max: value, count: 1 });
      } else {
        entry.sum += value;
        entry.min = Math.min(entry.min, value);
        entry.max = Math.max(entry.max, value);
        entry.count += 1;
      }
    }
  }

  const blendshapes: Record<string, VowelBlendshapeStat> = {};
  for (const [name, entry] of [...stats.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    blendshapes[name] = {
      mean: round4(entry.sum / entry.count),
      min: round4(entry.min),
      max: round4(entry.max)
    };
  }

  return {
    frameCount: frames.length,
    blendshapes
  };
}

/** Project a window summary to the persisted mean-only vector for one label. */
export function toVowelBlendshapeMeans(
  summary: VowelWindowSummary
): InputProfileVowelBlendshapeMeans {
  const means: Record<string, number> = {};

  for (const [name, stat] of Object.entries(summary.blendshapes)) {
    means[name] = stat.mean;
  }

  return means;
}

function round4(value: number): number {
  return Math.round(value * roundingScale) / roundingScale;
}
