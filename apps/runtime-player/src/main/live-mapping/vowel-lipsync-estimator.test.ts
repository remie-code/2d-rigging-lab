import { describe, expect, it } from "vitest";

import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
import {
  defaultVowelReferenceVectors,
  extractVowelFeatureVector,
  RuntimePlayerVowelLipsyncState,
  vowelHysteresisFrames,
  vowelLabels,
  type VowelFeatureVector,
  type VowelLabel
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

function estimateOnce(
  blendshapes: Readonly<Record<string, number>>
): VowelLabel | null {
  const state = new RuntimePlayerVowelLipsyncState();
  return state.estimate({
    features: extractVowelFeatureVector(frameFromBlendshapes(blendshapes)),
    references: defaultVowelReferenceVectors
  }).winner;
}

describe("vowel lipsync estimator", () => {
  it("classifies each captured vowel mean to its own label and neutral to null", () => {
    expect(estimateOnce(meanBlendshapes("neutral"))).toBeNull();
    expect(estimateOnce(meanBlendshapes("a"))).toBe("a");
    expect(estimateOnce(meanBlendshapes("i"))).toBe("i");
    expect(estimateOnce(meanBlendshapes("u"))).toBe("u");
    expect(estimateOnce(meanBlendshapes("e"))).toBe("e");
    expect(estimateOnce(meanBlendshapes("o"))).toBe("o");
  });

  it("returns intensity ~1 at a captured vowel mean and 0 at neutral", () => {
    const state = new RuntimePlayerVowelLipsyncState();
    const aEstimate = state.estimate({
      features: extractVowelFeatureVector(
        frameFromBlendshapes(meanBlendshapes("a"))
      ),
      references: defaultVowelReferenceVectors
    });
    expect(aEstimate.winner).toBe("a");
    expect(aEstimate.weight).toBeGreaterThan(0.99);

    const neutralState = new RuntimePlayerVowelLipsyncState();
    const neutralEstimate = neutralState.estimate({
      features: extractVowelFeatureVector(
        frameFromBlendshapes(meanBlendshapes("neutral"))
      ),
      references: defaultVowelReferenceVectors
    });
    expect(neutralEstimate.winner).toBeNull();
    expect(neutralEstimate.weight).toBe(0);
  });

  it("holds 'u' at the mouthFunnel/mouthPucker corner points via hysteresis", () => {
    // During "u" the ARKit funnel/pucker channels swing wildly (funnel
    // 0.31..0.71, pucker 0.25..0.61). The low-funnel/low-pucker corner is the
    // adversarial one: raw argmax flips to "o" by a razor-thin margin. With "u"
    // already confirmed, hysteresis must keep it on "u".
    const uMean = meanBlendshapes("u");
    const corners: readonly Readonly<Record<string, number>>[] = [
      { ...uMean, mouthFunnel: 0.31, mouthPucker: 0.25 },
      { ...uMean, mouthFunnel: 0.71, mouthPucker: 0.61 },
      { ...uMean, mouthFunnel: 0.31, mouthPucker: 0.61 },
      { ...uMean, mouthFunnel: 0.71, mouthPucker: 0.25 }
    ];

    for (const corner of corners) {
      const state = new RuntimePlayerVowelLipsyncState();
      // Confirm "u" from its mean, then feed the corner for several frames.
      state.estimate({
        features: extractVowelFeatureVector(frameFromBlendshapes(uMean)),
        references: defaultVowelReferenceVectors
      });

      let winner: VowelLabel | null = "u";
      for (let frame = 0; frame < vowelHysteresisFrames + 2; frame += 1) {
        winner = state.estimate({
          features: extractVowelFeatureVector(frameFromBlendshapes(corner)),
          references: defaultVowelReferenceVectors
        }).winner;
      }

      expect(winner).toBe("u");
    }
  });

  it("gates all vowels to null at the neutral rest pose", () => {
    const state = new RuntimePlayerVowelLipsyncState();
    const estimate = state.estimate({
      features: extractVowelFeatureVector(
        frameFromBlendshapes(meanBlendshapes("neutral"))
      ),
      references: defaultVowelReferenceVectors
    });

    expect(estimate.winner).toBeNull();
    expect(estimate.weight).toBe(0);
  });

  it("reports at most one winner across every captured vowel", () => {
    for (const label of vowelLabels) {
      const winner = estimateOnce(meanBlendshapes(label));
      expect(winner === null || vowelLabels.includes(winner)).toBe(true);
    }
  });

  it("resets confirmed winner and hysteresis streak on reset()", () => {
    const state = new RuntimePlayerVowelLipsyncState();
    state.estimate({
      features: extractVowelFeatureVector(
        frameFromBlendshapes(meanBlendshapes("a"))
      ),
      references: defaultVowelReferenceVectors
    });
    state.reset();

    // After reset, the first non-gated frame adopts the raw nearest vowel
    // immediately (no stale "a" carried over).
    const winner = state.estimate({
      features: extractVowelFeatureVector(
        frameFromBlendshapes(meanBlendshapes("u"))
      ),
      references: defaultVowelReferenceVectors
    }).winner;
    expect(winner).toBe("u");
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
