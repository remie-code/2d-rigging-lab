import { describe, expect, it } from "vitest";

import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
import {
  computeVowelBlend,
  computeVowelBlendTemperature,
  defaultVowelReferenceVectors,
  extractVowelFeatureVector,
  RuntimePlayerVowelLipsyncState,
  vowelBlendTemperatureFactor,
  vowelLabels,
  type VowelEstimate,
  type VowelFeatureVector,
  type VowelLabel,
  type VowelReferenceVectors
} from "./vowel-lipsync-estimator";
// Primary capture (2026-07-06). resolveJsonModule is enabled in tsconfig; the
// per-label blendshape means are the fixtures for the capture-replay test.
import vowelCaptures from "../../../../../test_data/iFaceMocap/vowels/vowel-captures.json";

type CaptureBlendshape = { readonly mean: number };
type CaptureLabel = {
  readonly blendshapes: Readonly<Record<string, CaptureBlendshape>>;
};

const captureLabels = vowelCaptures.labels as Readonly<
  Record<string, CaptureLabel>
>;

function meanBlendshapes(label: string): Readonly<Record<string, number>> {
  const source = captureLabels[label];
  if (source === undefined) {
    throw new Error(`Missing capture label: ${label}`);
  }

  const blendshapes: Record<string, number> = {};
  for (const [name, value] of Object.entries(source.blendshapes)) {
    blendshapes[name] = value.mean;
  }

  return blendshapes;
}

function frameFromBlendshapes(
  blendshapes: Readonly<Record<string, number>>
): TrackingFrame {
  return {
    source: "ifacialmocap",
    timestampMs: 0,
    transport: "udp",
    blendshapes,
    head: {}
  };
}

function estimateVowel(
  blendshapes: Readonly<Record<string, number>>,
  strengthByVowel?: Readonly<Record<VowelLabel, number>>
): VowelEstimate {
  const state = new RuntimePlayerVowelLipsyncState();
  return state.estimate({
    features: extractVowelFeatureVector(frameFromBlendshapes(blendshapes)),
    references: defaultVowelReferenceVectors,
    ...(strengthByVowel === undefined ? {} : { strengthByVowel })
  });
}

/** Argmax of the normalized blend, or null when gated (s = 0). */
function dominantVowel(estimate: VowelEstimate): VowelLabel | null {
  if (estimate.s === 0) {
    return null;
  }

  let best: VowelLabel = "a";
  let bestWeight = Number.NEGATIVE_INFINITY;
  for (const label of vowelLabels) {
    if (estimate.weightByVowel[label] > bestWeight) {
      bestWeight = estimate.weightByVowel[label];
      best = label;
    }
  }

  return best;
}

function sumWeights(estimate: VowelEstimate): number {
  return vowelLabels.reduce(
    (total, label) => total + estimate.weightByVowel[label],
    0
  );
}

/** Component-wise average of two reference vowels → a midpoint feature vector. */
function midpointFeatures(
  references: VowelReferenceVectors,
  v1: VowelLabel,
  v2: VowelLabel
): VowelFeatureVector {
  const a = references[v1];
  const b = references[v2];
  return {
    jawOpen: (a.jawOpen + b.jawOpen) / 2,
    mouthFunnel: (a.mouthFunnel + b.mouthFunnel) / 2,
    mouthPucker: (a.mouthPucker + b.mouthPucker) / 2,
    mouthClose: (a.mouthClose + b.mouthClose) / 2,
    mouthSmile: (a.mouthSmile + b.mouthSmile) / 2,
    mouthStretch: (a.mouthStretch + b.mouthStretch) / 2,
    mouthLowerDown: (a.mouthLowerDown + b.mouthLowerDown) / 2,
    mouthUpperUp: (a.mouthUpperUp + b.mouthUpperUp) / 2
  };
}

describe("vowel lipsync estimator (shape blend)", () => {
  it("makes each captured vowel mean its own dominant weight and gates neutral", () => {
    expect(dominantVowel(estimateVowel(meanBlendshapes("neutral")))).toBeNull();
    for (const label of vowelLabels) {
      expect(dominantVowel(estimateVowel(meanBlendshapes(label)))).toBe(label);
    }
  });

  it("normalizes the blend to sum ~1 with a dominant self-weight at each vowel", () => {
    for (const label of vowelLabels) {
      const estimate = estimateVowel(meanBlendshapes(label));
      expect(sumWeights(estimate)).toBeCloseTo(1, 6);
      // Self vowel is clearly dominant at its own reference point.
      expect(estimate.weightByVowel[label]).toBeGreaterThan(0.5);
      for (const other of vowelLabels) {
        if (other !== label) {
          expect(estimate.weightByVowel[label]).toBeGreaterThan(
            estimate.weightByVowel[other]
          );
        }
      }
      // s ≈ 1 at a reference point (winnerDistance ≈ 0).
      expect(estimate.s).toBeGreaterThan(0.9);
    }
  });

  it("distributes a midpoint input across 2-3 vowels summing to ~1 (え混入許容)", () => {
    const state = new RuntimePlayerVowelLipsyncState();
    const estimate = state.estimate({
      features: midpointFeatures(defaultVowelReferenceVectors, "a", "i"),
      references: defaultVowelReferenceVectors
    });

    expect(sumWeights(estimate)).toBeCloseTo(1, 6);
    // Both endpoints carry meaningful mass at their midpoint.
    expect(estimate.weightByVowel.a).toBeGreaterThan(0.1);
    expect(estimate.weightByVowel.i).toBeGreaterThan(0.1);
    // A benign spread concentrated on 2-3 vowels (design §6: at the a↔i midpoint
    // "え" carries the most mass with "お" a small benign tail ≈ 0.11; the
    // meaningful (> 0.15) share is 2-3 vowels).
    const active = vowelLabels.filter(
      (label) => estimate.weightByVowel[label] > 0.15
    );
    expect(active.length).toBeGreaterThanOrEqual(2);
    expect(active.length).toBeLessThanOrEqual(3);
    // The box stays open through the transition (s does not collapse).
    expect(estimate.s).toBeGreaterThan(0.5);
  });

  it("gates all vowels to zero (s = 0) at the neutral rest pose", () => {
    const estimate = estimateVowel(meanBlendshapes("neutral"));
    expect(estimate.s).toBe(0);
    for (const label of vowelLabels) {
      expect(estimate.weightByVowel[label]).toBe(0);
    }
  });

  it("applies per-vowel strength as a pre-normalization bias (once, sum ~1)", () => {
    const baseline = estimateVowel(meanBlendshapes("a"));
    // Raising "i" strength lifts its relative share while the blend stays normalized.
    const iBoosted = estimateVowel(meanBlendshapes("a"), {
      a: 1,
      i: 4,
      u: 1,
      e: 1,
      o: 1
    });
    expect(iBoosted.weightByVowel.i).toBeGreaterThan(baseline.weightByVowel.i);
    expect(sumWeights(iBoosted)).toBeCloseTo(1, 6);
    // s is strength-independent (uses raw argmax distance, not the biased blend).
    expect(iBoosted.s).toBeCloseTo(baseline.s, 6);
  });

  it("drops a vowel from the blend when its strength is 0 (sum stays ~1)", () => {
    const estimate = estimateVowel(meanBlendshapes("i"), {
      a: 1,
      i: 1,
      u: 1,
      e: 0,
      o: 1
    });
    expect(estimate.weightByVowel.e).toBe(0);
    expect(sumWeights(estimate)).toBeCloseTo(1, 6);
  });

  it("collapses to a single winner as τ → 0 (Wave22 backward compat)", () => {
    const distances: Record<VowelLabel, number> = {
      a: 0.0,
      i: 0.3,
      u: 0.5,
      e: 0.2,
      o: 0.4
    };
    const uniform: Record<VowelLabel, number> = {
      a: 1,
      i: 1,
      u: 1,
      e: 1,
      o: 1
    };
    const blend = computeVowelBlend(distances, uniform, 1e-4);
    expect(blend.a).toBeCloseTo(1, 6);
    for (const label of ["i", "u", "e", "o"] as const) {
      expect(blend[label]).toBeCloseTo(0, 6);
    }
  });

  it("derives τ = k × median inter-vowel distance from the references", () => {
    const deltas = vowelLabels.map((label) => ({
      jawOpen:
        defaultVowelReferenceVectors[label].jawOpen -
        defaultVowelReferenceVectors.neutral.jawOpen,
      mouthFunnel:
        defaultVowelReferenceVectors[label].mouthFunnel -
        defaultVowelReferenceVectors.neutral.mouthFunnel,
      mouthPucker:
        defaultVowelReferenceVectors[label].mouthPucker -
        defaultVowelReferenceVectors.neutral.mouthPucker,
      mouthClose:
        defaultVowelReferenceVectors[label].mouthClose -
        defaultVowelReferenceVectors.neutral.mouthClose,
      mouthSmile:
        defaultVowelReferenceVectors[label].mouthSmile -
        defaultVowelReferenceVectors.neutral.mouthSmile,
      mouthStretch:
        defaultVowelReferenceVectors[label].mouthStretch -
        defaultVowelReferenceVectors.neutral.mouthStretch,
      mouthLowerDown:
        defaultVowelReferenceVectors[label].mouthLowerDown -
        defaultVowelReferenceVectors.neutral.mouthLowerDown,
      mouthUpperUp:
        defaultVowelReferenceVectors[label].mouthUpperUp -
        defaultVowelReferenceVectors.neutral.mouthUpperUp
    }));
    const featureKeys: readonly (keyof VowelFeatureVector)[] = [
      "jawOpen",
      "mouthFunnel",
      "mouthPucker",
      "mouthClose",
      "mouthSmile",
      "mouthStretch",
      "mouthLowerDown",
      "mouthUpperUp"
    ];
    const distances: number[] = [];
    for (let i = 0; i < deltas.length; i += 1) {
      for (let j = i + 1; j < deltas.length; j += 1) {
        const di = deltas[i]!;
        const dj = deltas[j]!;
        let sum = 0;
        for (const key of featureKeys) {
          const diff = di[key] - dj[key];
          sum += diff * diff;
        }
        distances.push(Math.sqrt(sum));
      }
    }
    distances.sort((a, b) => a - b);
    const median = (distances[4]! + distances[5]!) / 2;

    const tau = computeVowelBlendTemperature(defaultVowelReferenceVectors);
    expect(tau).toBeCloseTo(vowelBlendTemperatureFactor * median, 9);
    // Sanity: measured τ sits in the design's 0.13–0.18 band (§6).
    expect(tau).toBeGreaterThan(0.12);
    expect(tau).toBeLessThan(0.18);
  });

  it("re-derives τ after reset() and keeps estimating", () => {
    const state = new RuntimePlayerVowelLipsyncState();
    const before = state.estimate({
      features: extractVowelFeatureVector(
        frameFromBlendshapes(meanBlendshapes("a"))
      ),
      references: defaultVowelReferenceVectors
    });
    state.reset();
    const after = state.estimate({
      features: extractVowelFeatureVector(
        frameFromBlendshapes(meanBlendshapes("a"))
      ),
      references: defaultVowelReferenceVectors
    });

    expect(after.s).toBeCloseTo(before.s, 9);
    expect(after.weightByVowel.a).toBeCloseTo(before.weightByVowel.a, 9);
  });

  it("extracts symmetric features by averaging left/right blendshapes", () => {
    const features: VowelFeatureVector = extractVowelFeatureVector(
      frameFromBlendshapes({
        jawOpen: 0.5,
        mouthSmile_L: 0.2,
        mouthSmile_R: 0.4
      })
    );

    expect(features.jawOpen).toBe(0.5);
    expect(features.mouthSmile).toBeCloseTo(0.3, 6);
    // Missing blendshapes read as 0.
    expect(features.mouthFunnel).toBe(0);
  });
});
