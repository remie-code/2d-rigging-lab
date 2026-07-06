import { describe, expect, it } from "vitest";

import {
  defaultVowelReferenceVectors,
  vowelLabels,
  type VowelFeatureVector
} from "../live-mapping/vowel-lipsync-estimator";
import type {
  InputProfileVowelBlendshapeMeans,
  InputProfileVowelCalibration,
  InputProfileVowelLabel
} from "./input-profile-document";
import { convertInputProfileVowelCalibrationToReferences } from "./input-profile-vowel-references";
// Primary capture (2026-07-06). resolveJsonModule is enabled in tsconfig; the
// per-label blendshape means are the raw persisted vectors the adapter reduces.
import vowelCaptures from "../../../../../test_data/iFaceMocap/vowels/vowel-captures.json";

type CaptureBlendshape = { readonly mean: number };
type CaptureLabel = {
  readonly blendshapes: Readonly<Record<string, CaptureBlendshape>>;
};

const captureLabels = vowelCaptures.labels as Readonly<
  Record<string, CaptureLabel>
>;

const referenceLabels: readonly InputProfileVowelLabel[] = [
  "neutral",
  ...vowelLabels
];

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

function rawMeansFor(label: string): InputProfileVowelBlendshapeMeans {
  const source = captureLabels[label];
  if (source === undefined) {
    throw new Error(`Missing capture label: ${label}`);
  }

  const means: Record<string, number> = {};
  for (const [name, value] of Object.entries(source.blendshapes)) {
    means[name] = value.mean;
  }

  return means;
}

function calibrationFromCaptures(): InputProfileVowelCalibration {
  const samples = {} as Record<
    InputProfileVowelLabel,
    InputProfileVowelBlendshapeMeans
  >;
  for (const label of referenceLabels) {
    samples[label] = rawMeansFor(label);
  }

  return { samples };
}

describe("convertInputProfileVowelCalibrationToReferences", () => {
  it("reduces raw capture means to the same 8-dim references as the Domain A default fixtures", () => {
    const references = convertInputProfileVowelCalibrationToReferences(
      calibrationFromCaptures()
    );

    for (const label of referenceLabels) {
      const produced = references[label];
      const expected = defaultVowelReferenceVectors[label];

      for (const key of featureKeys) {
        // Domain A baked its constants with round4; the adapter averages L/R
        // without rounding, so the two agree only up to that rounding scale
        // (half-ULP of round4 ~= 5e-5, plus FP noise). A 1e-4 bound tightly
        // proves the reduction RULE (pass-through + L/R average) matches the
        // estimator's while absorbing binary-float representation error.
        expect(Math.abs(produced[key] - expected[key])).toBeLessThan(1e-4);
      }
    }
  });

  it("applies the L/R-average reduction rule for symmetric features", () => {
    const calibration: InputProfileVowelCalibration = {
      samples: buildUniformSamples({
        jawOpen: 0.4,
        mouthFunnel: 0.1,
        mouthPucker: 0.2,
        mouthClose: 0.3,
        mouthSmile_L: 0.6,
        mouthSmile_R: 0.2,
        mouthStretch_L: 0.5,
        mouthStretch_R: 0.1,
        mouthLowerDown_L: 0.44,
        mouthLowerDown_R: 0.4,
        mouthUpperUp_L: 0.12,
        mouthUpperUp_R: 0.08
      })
    };

    const reduced = convertInputProfileVowelCalibrationToReferences(calibration)
      .a;

    const expected: VowelFeatureVector = {
      jawOpen: 0.4,
      mouthFunnel: 0.1,
      mouthPucker: 0.2,
      mouthClose: 0.3,
      mouthSmile: 0.4, // (0.6 + 0.2) / 2
      mouthStretch: 0.3, // (0.5 + 0.1) / 2
      mouthLowerDown: 0.42, // (0.44 + 0.4) / 2
      mouthUpperUp: 0.1 // (0.12 + 0.08) / 2
    };
    for (const key of featureKeys) {
      expect(reduced[key]).toBeCloseTo(expected[key], 10);
    }
  });
});

function buildUniformSamples(
  means: InputProfileVowelBlendshapeMeans
): Record<InputProfileVowelLabel, InputProfileVowelBlendshapeMeans> {
  const samples = {} as Record<
    InputProfileVowelLabel,
    InputProfileVowelBlendshapeMeans
  >;
  for (const label of referenceLabels) {
    samples[label] = means;
  }

  return samples;
}
