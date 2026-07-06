import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";
import {
  extractVowelFeatureVector,
  type VowelFeatureVector,
  type VowelReferenceVectors
} from "../live-mapping/vowel-lipsync-estimator";
import {
  inputProfileVowelLabels,
  type InputProfileVowelBlendshapeMeans,
  type InputProfileVowelCalibration,
  type InputProfileVowelLabel
} from "./input-profile-document";

/**
 * Boundary adapter (wave107 Domain B seam ruling, design §4).
 *
 * The persistent form of vowel calibration holds RAW ARKit blendshape mean
 * vectors per label (all dimensions). The estimator consumes the 8-dimension
 * reduced `VowelReferenceVectors` (Domain A). This module performs that
 * reduction at the input→live-mapping boundary, leaving the live-mapping types
 * and reference resolution untouched.
 *
 * The reduction MUST match the estimator's `extractVowelFeatureVector` rule
 * (jawOpen/mouthFunnel/mouthPucker/mouthClose passed through; mouthSmile/
 * mouthStretch/mouthLowerDown/mouthUpperUp are L/R averaged). To guarantee the
 * rule stays identical we build a minimal tracking-frame from each label's mean
 * dictionary and reuse `extractVowelFeatureVector` directly rather than
 * re-implementing the reduction here.
 */
export function convertInputProfileVowelCalibrationToReferences(
  calibration: InputProfileVowelCalibration
): VowelReferenceVectors {
  return {
    neutral: reduceVowelBlendshapeMeans(calibration.samples.neutral),
    a: reduceVowelBlendshapeMeans(calibration.samples.a),
    i: reduceVowelBlendshapeMeans(calibration.samples.i),
    u: reduceVowelBlendshapeMeans(calibration.samples.u),
    e: reduceVowelBlendshapeMeans(calibration.samples.e),
    o: reduceVowelBlendshapeMeans(calibration.samples.o)
  };
}

/**
 * Reduce one label's raw blendshape means to the estimator's 8-dimension
 * feature vector, reusing `extractVowelFeatureVector` so the reduction rule is
 * provably identical to the estimator's.
 */
export function reduceVowelBlendshapeMeans(
  means: InputProfileVowelBlendshapeMeans
): VowelFeatureVector {
  return extractVowelFeatureVector(createBlendshapeOnlyFrame(means));
}

/** Labels missing from `samples` make the calibration unusable (must have all six). */
export function hasAllVowelLabels(
  samples: Partial<Record<InputProfileVowelLabel, InputProfileVowelBlendshapeMeans>>
): samples is Record<InputProfileVowelLabel, InputProfileVowelBlendshapeMeans> {
  return inputProfileVowelLabels.every((label) => samples[label] !== undefined);
}

function createBlendshapeOnlyFrame(
  blendshapes: InputProfileVowelBlendshapeMeans
): TrackingFrame {
  return {
    source: "ifacialmocap",
    transport: "udp",
    timestampMs: 0,
    blendshapes,
    head: {}
  };
}
