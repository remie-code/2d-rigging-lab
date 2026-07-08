import type { TrackingFrame } from "../../preload/input-tracking-frame-contract";

/**
 * Vowel lipsync estimator (design: discussion/design/vowel-lipsync-mapping.md §2).
 *
 * iFacialMocap sends ARKit blendshapes with no vowel channel. This module
 * classifies the current mouth shape into one of five Japanese vowels (a/i/u/e/o)
 * by nearest-reference in an 8-dimensional feature space, and reports a continuous
 * intensity `w` for that winner. Relative-magnitude distance (not cosine similarity)
 * is required because "e" is a shrunken "a": the delta vectors point the same
 * direction and differ only in magnitude, so a direction-only metric cannot tell
 * them apart (design §2.2).
 */

export type VowelLabel = "a" | "i" | "u" | "e" | "o";

export const vowelLabels: readonly VowelLabel[] = ["a", "i", "u", "e", "o"];

/**
 * The 8 mouth features used for classification (design §2.1). Left/right ARKit
 * shapes are averaged into a single symmetric feature.
 */
export type VowelFeatureVector = {
  readonly jawOpen: number;
  readonly mouthFunnel: number;
  readonly mouthPucker: number;
  readonly mouthClose: number;
  readonly mouthSmile: number;
  readonly mouthStretch: number;
  readonly mouthLowerDown: number;
  readonly mouthUpperUp: number;
};

/**
 * Reference feature vectors: neutral rest pose plus the five vowel poses.
 * The estimator compares the live delta (current − neutral) against each
 * vowel's delta (vowel − neutral).
 */
export type VowelReferenceVectors = {
  readonly neutral: VowelFeatureVector;
  readonly a: VowelFeatureVector;
  readonly i: VowelFeatureVector;
  readonly u: VowelFeatureVector;
  readonly e: VowelFeatureVector;
  readonly o: VowelFeatureVector;
};

/**
 * Normalized vowel-blend estimate (design vowel-lipsync-shape-blend §2.1).
 *
 * `s` is the overall mouth-open intensity `s = activity / (activity + d_min)`
 * (0 at rest, → 1 near a vowel reference). `weightByVowel` is the softmax blend
 * over the five vowels, normalized to sum to 1 (per-vowel strength already folded
 * in as a pre-normalization bias — see `computeVowelBlend`). The mapping layer
 * emits `s × weightByVowel[v]` per vowel (Σ = s) and `mouth_open = s`. When gated
 * below the activity threshold `s = 0` and every weight is 0 (mouth closed).
 */
export type VowelEstimate = {
  readonly s: number;
  readonly weightByVowel: Readonly<Record<VowelLabel, number>>;
};

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

/**
 * Per-dimension weights for the classification distance metric (design §2.2, §7).
 *
 * Derivation: with unit weights the raw ARKit deltas already separate all six
 * reference labels correctly with healthy margins (smallest inter-reference
 * margin 0.167 for i/e), so no per-dimension reweighting is required.
 * Source data: test_data/iFaceMocap/vowels/vowel-captures.json (captured 2026-07-06).
 */
export const vowelDimensionWeights: VowelFeatureVector = {
  jawOpen: 1,
  mouthFunnel: 1,
  mouthPucker: 1,
  mouthClose: 1,
  mouthSmile: 1,
  mouthStretch: 1,
  mouthLowerDown: 1,
  mouthUpperUp: 1
};

/**
 * Gate threshold on the weighted activity (distance of the live delta from the
 * neutral reference). Below this the mouth is treated as at rest and all vowels
 * are suppressed (design §2.3 gate).
 *
 * Derivation: neutral activity is 0.0 and the least-open vowel ("i") sits at
 * 0.318; a threshold of 0.15 cleanly separates rest from every vowel pose while
 * still gating the near-neutral tail.
 * Source data: test_data/iFaceMocap/vowels/vowel-captures.json (captured 2026-07-06).
 */
export const vowelGateActivityThreshold = 0.15;

/**
 * Softmax temperature factor `k` (design vowel-lipsync-shape-blend §2.2).
 *
 * The blend temperature is `τ = k × (median pairwise inter-vowel distance)`, so
 * the sharpness is anchored to the calibrated reference geometry and stays
 * portable across users/calibrations. `k = 0.30` sits in the design's 0.25–0.35
 * range (measured τ ≈ 0.13–0.18 for the bundled references, median ≈ 0.51).
 * Smaller τ sharpens toward argmax (Wave22 single-winner backward compat);
 * larger τ mixes more. Source data:
 * test_data/iFaceMocap/vowels/vowel-captures.json (captured 2026-07-06).
 */
export const vowelBlendTemperatureFactor = 0.3;

/**
 * Default reference vectors bundled for users who have not calibrated their own
 * vowels. Values are the per-label blendshape means from the primary capture,
 * reduced to the 8 classification features (L/R averaged).
 *
 * Source: test_data/iFaceMocap/vowels/vowel-captures.json (captured 2026-07-06,
 * user's own speech, ~90-frame window mean per label). Baked in so the estimator
 * never reads JSON at runtime; see design §2.2 / §6 "既定参照".
 */
export const defaultVowelReferenceVectors: VowelReferenceVectors = {
  neutral: {
    jawOpen: 0.0448,
    mouthFunnel: 0.02,
    mouthPucker: 0.04,
    mouthClose: 0.0588,
    mouthSmile: 0.036,
    mouthStretch: 0.0794,
    mouthLowerDown: 0.065,
    mouthUpperUp: 0.02
  },
  a: {
    jawOpen: 0.6068,
    mouthFunnel: 0.14,
    mouthPucker: 0.0622,
    mouthClose: 0.1292,
    mouthSmile: 0.0044,
    mouthStretch: 0.2943,
    mouthLowerDown: 0.6024,
    mouthUpperUp: 0.1
  },
  i: {
    jawOpen: 0.1102,
    mouthFunnel: 0.09,
    mouthPucker: 0.03,
    mouthClose: 0.07,
    mouthSmile: 0.1232,
    mouthStretch: 0.1426,
    mouthLowerDown: 0.3339,
    mouthUpperUp: 0.1078
  },
  u: {
    jawOpen: 0.1501,
    mouthFunnel: 0.4659,
    mouthPucker: 0.3961,
    mouthClose: 0.1483,
    mouthSmile: 0.0023,
    mouthStretch: 0.1238,
    mouthLowerDown: 0.1624,
    mouthUpperUp: 0.0466
  },
  e: {
    jawOpen: 0.2356,
    mouthFunnel: 0.1163,
    mouthPucker: 0.0565,
    mouthClose: 0.1164,
    mouthSmile: 0.0496,
    mouthStretch: 0.1571,
    mouthLowerDown: 0.3015,
    mouthUpperUp: 0.0642
  },
  o: {
    jawOpen: 0.2704,
    mouthFunnel: 0.1918,
    mouthPucker: 0.1888,
    mouthClose: 0.226,
    mouthSmile: 0,
    mouthStretch: 0.1279,
    mouthLowerDown: 0.1766,
    mouthUpperUp: 0.038
  }
};

/**
 * Extract the 8 mouth features from a raw tracking frame (design §2.1).
 * Missing blendshapes are treated as 0 (ARKit omits inactive channels).
 */
export function extractVowelFeatureVector(
  frame: TrackingFrame
): VowelFeatureVector {
  const blendshapes = frame.blendshapes;

  return {
    jawOpen: readShape(blendshapes.jawOpen),
    mouthFunnel: readShape(blendshapes.mouthFunnel),
    mouthPucker: readShape(blendshapes.mouthPucker),
    mouthClose: readShape(blendshapes.mouthClose),
    mouthSmile: averageShape(
      blendshapes.mouthSmile_L,
      blendshapes.mouthSmile_R
    ),
    mouthStretch: averageShape(
      blendshapes.mouthStretch_L,
      blendshapes.mouthStretch_R
    ),
    mouthLowerDown: averageShape(
      blendshapes.mouthLowerDown_L,
      blendshapes.mouthLowerDown_R
    ),
    mouthUpperUp: averageShape(
      blendshapes.mouthUpperUp_L,
      blendshapes.mouthUpperUp_R
    )
  };
}

type VowelScores = {
  readonly winner: VowelLabel;
  readonly winnerDistance: number;
  readonly activity: number;
  readonly distanceByVowel: Readonly<Record<VowelLabel, number>>;
};

/**
 * Score the live features against every reference and return the raw nearest
 * vowel, its distance, the activity (distance from neutral), and per-vowel
 * distances. This is the pre-hysteresis classification (design §2.2/§2.3).
 */
function scoreVowels(
  features: VowelFeatureVector,
  references: VowelReferenceVectors
): VowelScores {
  const delta = subtract(features, references.neutral);
  const distanceByVowel = {
    a: weightedDistance(delta, subtract(references.a, references.neutral)),
    i: weightedDistance(delta, subtract(references.i, references.neutral)),
    u: weightedDistance(delta, subtract(references.u, references.neutral)),
    e: weightedDistance(delta, subtract(references.e, references.neutral)),
    o: weightedDistance(delta, subtract(references.o, references.neutral))
  } as const;

  let winner: VowelLabel = "a";
  let winnerDistance = Number.POSITIVE_INFINITY;
  for (const label of vowelLabels) {
    const distance = distanceByVowel[label];
    if (distance < winnerDistance) {
      winnerDistance = distance;
      winner = label;
    }
  }

  const activity = weightedDistance(delta, zeroDelta);

  return { winner, winnerDistance, activity, distanceByVowel };
}

/**
 * Blend intensity `s = activity / (activity + d_min)` clamped to 0..1
 * (design vowel-lipsync-shape-blend §2.4). `activity` = distance of the live
 * delta from neutral; `d_min` = **raw argmax nearest-vowel distance** (NOT a
 * hysteresis winner distance). 0 near neutral, → 1 near a vowel reference. As
 * τ→0 this collapses to Wave22's `w` (single-winner backward compat).
 */
function computeIntensity(activity: number, dMin: number): number {
  const denominator = activity + dMin;
  if (denominator <= 0) {
    return 0;
  }

  return clamp01(activity / denominator);
}

/**
 * Median of the pairwise `weightedDistance` between the five calibrated vowel
 * deltas `Δ_v = subtract(references.v, references.neutral)` (design §2.2/§6).
 * Ten pairs → median is the mean of the 5th/6th order statistics. Used to derive
 * the blend temperature `τ = k × median`; computed once per reference set and
 * cached by the estimator (never per frame).
 */
export function computeVowelBlendTemperature(
  references: VowelReferenceVectors
): number {
  const deltas = vowelLabels.map((label) =>
    subtract(references[label], references.neutral)
  );

  const distances: number[] = [];
  for (let i = 0; i < deltas.length; i += 1) {
    for (let j = i + 1; j < deltas.length; j += 1) {
      distances.push(weightedDistance(deltas[i]!, deltas[j]!));
    }
  }

  distances.sort((a, b) => a - b);
  const mid = distances.length / 2;
  const median =
    distances.length % 2 === 0
      ? (distances[mid - 1]! + distances[mid]!) / 2
      : distances[Math.floor(mid)]!;

  return vowelBlendTemperatureFactor * median;
}

/**
 * Softmax vowel blend (design §2.1 stages ①②③). Given per-vowel classification
 * distances, per-vowel strength bias, and the temperature τ, produces the
 * normalized weight vector (Σ = 1 when any mass survives):
 *
 *   raw_v = exp(−(d_v − d_min) / τ)     ① softmax (d_min subtracted for
 *                                          numerical stability; a common factor
 *                                          that cancels under normalization)
 *   biased_v = raw_v × strength_v       ② per-vowel pre-normalization bias
 *   weight_v = biased_v / Σ_j biased_j  ③ normalize to a convex blend
 *
 * strength is applied here ONCE (the mapping layer must NOT reapply it at the
 * tail). `strength_v = 0` drops that vowel from the blend. As τ→0 the nearest
 * vowel's weight → 1 and the rest → 0 (single-winner backward compat). If every
 * strength is 0 (or τ ≤ 0 with no unique nearest) the result is all zeros.
 */
export function computeVowelBlend(
  distanceByVowel: Readonly<Record<VowelLabel, number>>,
  strengthByVowel: Readonly<Record<VowelLabel, number>>,
  tau: number
): Record<VowelLabel, number> {
  let minDistance = Number.POSITIVE_INFINITY;
  for (const label of vowelLabels) {
    if (distanceByVowel[label] < minDistance) {
      minDistance = distanceByVowel[label];
    }
  }

  const biased: Record<VowelLabel, number> = { a: 0, i: 0, u: 0, e: 0, o: 0 };
  let sum = 0;
  for (const label of vowelLabels) {
    const raw =
      tau > 0
        ? Math.exp(-(distanceByVowel[label] - minDistance) / tau)
        : distanceByVowel[label] <= minDistance
          ? 1
          : 0;
    const value = raw * Math.max(0, strengthByVowel[label]);
    biased[label] = value;
    sum += value;
  }

  const weights: Record<VowelLabel, number> = { a: 0, i: 0, u: 0, e: 0, o: 0 };
  if (sum > 0) {
    for (const label of vowelLabels) {
      weights[label] = biased[label] / sum;
    }
  }

  return weights;
}

/**
 * Per-frame estimator state (design vowel-lipsync-shape-blend §3). The blend is
 * memoryless (no hysteresis — a continuous convex blend has no discrete winner
 * to debounce), so the only persistent state is the cached blend temperature τ:
 * `τ = k × median(inter-vowel distance)` is derived once per reference set and
 * reused every frame. Mirrors RuntimePlayerBodyFollowState (class + reset()) so
 * it can be injected and unit-tested deterministically.
 */
export class RuntimePlayerVowelLipsyncState {
  private cachedReferences: VowelReferenceVectors | null = null;
  private cachedTemperature = 0;

  reset(): void {
    this.cachedReferences = null;
    this.cachedTemperature = 0;
  }

  /**
   * Advance the estimator by one frame and return the normalized vowel blend +
   * intensity `s`. Returns `{ s: 0, weightByVowel: 0… }` when gated below the
   * activity threshold (mouth at rest). `strengthByVowel` are the per-vowel
   * pre-normalization biases supplied by the mapping layer (default 1 each);
   * they are applied ONCE inside the blend and must NOT be reapplied downstream.
   */
  estimate(input: {
    readonly features: VowelFeatureVector;
    readonly references: VowelReferenceVectors;
    readonly strengthByVowel?: Readonly<Record<VowelLabel, number>>;
  }): VowelEstimate {
    const scores = scoreVowels(input.features, input.references);

    // Gate: below the activity threshold the mouth is at rest → s = 0, all
    // vowels 0 (box closes, design §2.4 / §3.1 gate).
    if (scores.activity < vowelGateActivityThreshold) {
      return gatedEstimate;
    }

    const tau = this.resolveTemperature(input.references);
    const weightByVowel = computeVowelBlend(
      scores.distanceByVowel,
      input.strengthByVowel ?? defaultStrengthByVowel,
      tau
    );
    // s uses the RAW argmax nearest distance (design §2.4 / invariant), not a
    // per-vowel or hysteresis distance.
    const s = computeIntensity(scores.activity, scores.winnerDistance);

    return { s, weightByVowel };
  }

  /**
   * Resolve the cached blend temperature, recomputing the median only when the
   * reference set actually changes (identity fast-path for the bundled default;
   * content comparison for calibrated references, which are rebuilt each frame
   * as fresh objects). Never recomputes per frame for a stable reference set.
   */
  private resolveTemperature(references: VowelReferenceVectors): number {
    if (
      this.cachedReferences === null ||
      !referencesEqual(this.cachedReferences, references)
    ) {
      this.cachedTemperature = computeVowelBlendTemperature(references);
      this.cachedReferences = references;
    }

    return this.cachedTemperature;
  }
}

const zeroWeights: Readonly<Record<VowelLabel, number>> = {
  a: 0,
  i: 0,
  u: 0,
  e: 0,
  o: 0
};

const gatedEstimate: VowelEstimate = { s: 0, weightByVowel: zeroWeights };

const defaultStrengthByVowel: Readonly<Record<VowelLabel, number>> = {
  a: 1,
  i: 1,
  u: 1,
  e: 1,
  o: 1
};

function referencesEqual(
  a: VowelReferenceVectors,
  b: VowelReferenceVectors
): boolean {
  if (a === b) {
    return true;
  }

  const labels: readonly (keyof VowelReferenceVectors)[] = [
    "neutral",
    "a",
    "i",
    "u",
    "e",
    "o"
  ];
  for (const label of labels) {
    const va = a[label];
    const vb = b[label];
    for (const key of featureKeys) {
      if (va[key] !== vb[key]) {
        return false;
      }
    }
  }

  return true;
}

const zeroDelta: VowelFeatureVector = {
  jawOpen: 0,
  mouthFunnel: 0,
  mouthPucker: 0,
  mouthClose: 0,
  mouthSmile: 0,
  mouthStretch: 0,
  mouthLowerDown: 0,
  mouthUpperUp: 0
};

function subtract(
  a: VowelFeatureVector,
  b: VowelFeatureVector
): VowelFeatureVector {
  return {
    jawOpen: a.jawOpen - b.jawOpen,
    mouthFunnel: a.mouthFunnel - b.mouthFunnel,
    mouthPucker: a.mouthPucker - b.mouthPucker,
    mouthClose: a.mouthClose - b.mouthClose,
    mouthSmile: a.mouthSmile - b.mouthSmile,
    mouthStretch: a.mouthStretch - b.mouthStretch,
    mouthLowerDown: a.mouthLowerDown - b.mouthLowerDown,
    mouthUpperUp: a.mouthUpperUp - b.mouthUpperUp
  };
}

function weightedDistance(
  a: VowelFeatureVector,
  b: VowelFeatureVector
): number {
  let sum = 0;
  for (const key of featureKeys) {
    const weight = vowelDimensionWeights[key];
    const diff = (a[key] - b[key]) * weight;
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

function readShape(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0;
}

function averageShape(
  left: number | undefined,
  right: number | undefined
): number {
  const hasLeft = left !== undefined && Number.isFinite(left);
  const hasRight = right !== undefined && Number.isFinite(right);

  if (hasLeft && hasRight) {
    return ((left as number) + (right as number)) / 2;
  }

  if (hasLeft) {
    return left as number;
  }

  if (hasRight) {
    return right as number;
  }

  return 0;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 1);
}
