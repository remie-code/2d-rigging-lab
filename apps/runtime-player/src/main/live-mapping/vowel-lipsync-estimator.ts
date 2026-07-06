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

export type VowelEstimate = {
  readonly winner: VowelLabel | null;
  readonly weight: number;
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
 * Hysteresis margin: a challenger vowel must beat the current winner's distance
 * by at least this much (i.e. be this much closer) before it is allowed to take
 * over (design §2.3 hysteresis).
 *
 * Derivation: during "u" the ARKit funnel/pucker channels swing wildly
 * (mouthFunnel 0.31..0.71, mouthPucker 0.25..0.61). At the low-funnel/low-pucker
 * corner the raw nearest reference flips to "o" by only 0.017. A margin of 0.05
 * absorbs that flip so "u" is held. Source data:
 * test_data/iFaceMocap/vowels/vowel-captures.json (captured 2026-07-06).
 */
export const vowelHysteresisMargin = 0.05;

/**
 * Hysteresis frame count: a challenger must remain the margin-dominant candidate
 * for this many consecutive frames before the winner changes (design §2.3).
 * Three frames (~50ms at 60fps) rejects single-frame ARKit spikes without adding
 * perceptible latency.
 */
export const vowelHysteresisFrames = 3;

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
 * Intensity `w = d(Δ, neutral) / (d(Δ, neutral) + d(Δ, nearest vowel))`
 * clamped to 0..1 (design §2.3). 0 near neutral, → 1 near a vowel reference.
 */
function computeIntensity(activity: number, winnerDistance: number): number {
  const denominator = activity + winnerDistance;
  if (denominator <= 0) {
    return 0;
  }

  return clamp01(activity / denominator);
}

/**
 * Per-frame estimator state (design §2.3): holds the confirmed winner plus a
 * candidate/streak counter for hysteresis. Mirrors RuntimePlayerBodyFollowState
 * (class + reset()) so it can be injected and unit-tested deterministically.
 */
export class RuntimePlayerVowelLipsyncState {
  private confirmedWinner: VowelLabel | null = null;
  private candidate: VowelLabel | null = null;
  private candidateStreak = 0;

  reset(): void {
    this.confirmedWinner = null;
    this.candidate = null;
    this.candidateStreak = 0;
  }

  /**
   * Advance the estimator by one frame and return the confirmed winner + its
   * intensity. Returns { winner: null, weight: 0 } when gated below the activity
   * threshold or before any winner is confirmed.
   */
  estimate(input: {
    readonly features: VowelFeatureVector;
    readonly references: VowelReferenceVectors;
  }): VowelEstimate {
    const scores = scoreVowels(input.features, input.references);

    // Gate: below the activity threshold the mouth is at rest. Clear state so a
    // fresh vowel must re-confirm through hysteresis rather than snapping back.
    if (scores.activity < vowelGateActivityThreshold) {
      this.confirmedWinner = null;
      this.candidate = null;
      this.candidateStreak = 0;
      return emptyEstimate;
    }

    this.updateConfirmedWinner(scores);

    if (this.confirmedWinner === null) {
      return emptyEstimate;
    }

    const winnerDistance = scores.distanceByVowel[this.confirmedWinner];
    const weight = computeIntensity(scores.activity, winnerDistance);

    return { winner: this.confirmedWinner, weight };
  }

  private updateConfirmedWinner(scores: VowelScores): void {
    // First confirmation after a gate: adopt the raw nearest vowel immediately.
    if (this.confirmedWinner === null) {
      this.confirmedWinner = scores.winner;
      this.candidate = null;
      this.candidateStreak = 0;
      return;
    }

    if (scores.winner === this.confirmedWinner) {
      this.candidate = null;
      this.candidateStreak = 0;
      return;
    }

    // A different vowel is closest. It may only take over if it beats the current
    // winner by the hysteresis margin for N consecutive frames (design §2.3).
    const currentWinnerDistance =
      scores.distanceByVowel[this.confirmedWinner];
    const challengerDistance = scores.distanceByVowel[scores.winner];
    const marginDominant =
      currentWinnerDistance - challengerDistance >= vowelHysteresisMargin;

    if (!marginDominant) {
      this.candidate = null;
      this.candidateStreak = 0;
      return;
    }

    if (this.candidate === scores.winner) {
      this.candidateStreak += 1;
    } else {
      this.candidate = scores.winner;
      this.candidateStreak = 1;
    }

    if (this.candidateStreak >= vowelHysteresisFrames) {
      this.confirmedWinner = scores.winner;
      this.candidate = null;
      this.candidateStreak = 0;
    }
  }
}

const emptyEstimate: VowelEstimate = { winner: null, weight: 0 };

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
