import type { TrackingVector3 } from "../../preload/input-tracking-frame-contract";

export const inputProfileDocumentSchemaVersion =
  "runtime-player-input-profiles-v1";

/**
 * The six calibration labels captured for vowel lipsync: the neutral rest pose
 * plus the five Japanese vowels (design §4 "中立→あ→い→う→え→お").
 */
export type InputProfileVowelLabel = "neutral" | "a" | "i" | "u" | "e" | "o";

export const inputProfileVowelLabels: readonly InputProfileVowelLabel[] = [
  "neutral",
  "a",
  "i",
  "u",
  "e",
  "o"
];

export type InputProfileAxis = "x" | "y" | "z";

export type InputProfileDirection = -1 | 1;

export type InputProfileLearnedSign = {
  readonly axis: InputProfileAxis;
  readonly direction: InputProfileDirection;
};

export type InputProfileCalibration = {
  readonly headRotationEulerDeg: {
    readonly neutral: TrackingVector3;
    readonly min: TrackingVector3;
    readonly max: TrackingVector3;
    readonly learnedSigns: {
      readonly faceLeft?: InputProfileLearnedSign;
      readonly faceRight?: InputProfileLearnedSign;
      readonly lookUp?: InputProfileLearnedSign;
      readonly lookDown?: InputProfileLearnedSign;
      readonly tiltLeft?: InputProfileLearnedSign;
      readonly tiltRight?: InputProfileLearnedSign;
    };
  };
  readonly headPositionRaw?: {
    readonly neutral: TrackingVector3;
    readonly min: TrackingVector3;
    readonly max: TrackingVector3;
    readonly learnedSigns: {
      readonly bodyLeft?: InputProfileLearnedSign;
      readonly bodyRight?: InputProfileLearnedSign;
      readonly bodyNear?: InputProfileLearnedSign;
      readonly bodyFar?: InputProfileLearnedSign;
    };
  };
  readonly eyes: {
    readonly neutral: TrackingVector3;
    readonly min: TrackingVector3;
    readonly max: TrackingVector3;
    readonly blinkLeftMin: number;
    readonly blinkLeftMax: number;
    readonly blinkRightMin: number;
    readonly blinkRightMax: number;
    readonly learnedSigns: {
      readonly eyesLeft?: InputProfileLearnedSign;
      readonly eyesRight?: InputProfileLearnedSign;
      readonly eyesUp?: InputProfileLearnedSign;
      readonly eyesDown?: InputProfileLearnedSign;
    };
  };
  readonly mouth: {
    readonly jawOpenMin: number;
    readonly jawOpenMax: number;
    readonly smileMin: number;
    readonly smileMax: number;
  };
  /**
   * Optional per-user vowel reference poses for lipsync (design §4). Vowel
   * references are a property of the user's face, so they live in the input
   * profile alongside the other calibration. When absent the estimator falls
   * back to the bundled default reference vectors.
   */
  readonly vowels?: InputProfileVowelCalibration;
};

/**
 * Persisted vowel calibration (wave107 Domain B seam ruling, design §4).
 *
 * We persist the RAW blendshape mean vectors (all ARKit dimensions) per label
 * plus capture metadata — NOT the estimator's 8-dimension reduced references.
 * Keeping the raw one-shot measurement lets a future estimator revision change
 * its dimension selection / weights without forcing users to re-calibrate. The
 * reduction to the estimator's `VowelReferenceVectors` (8 dims, L/R averaged) is
 * performed by the boundary adapter in `input-profile-vowel-references.ts`.
 *
 * `samples` maps each label to a dictionary of ARKit blendshape name → mean
 * value over the capture window (the `mean` output of `summarizeVowelSamples`,
 * mirroring `capture-vowel-frames.ts` `summarizeSamples`). Capture meta records
 * how the window was sampled.
 */
export type InputProfileVowelCalibration = {
  readonly samples: Readonly<Record<InputProfileVowelLabel, InputProfileVowelBlendshapeMeans>>;
  readonly capturedAtIso?: string;
  readonly windowFrameCount?: number;
  readonly windowDurationMs?: number;
};

/** ARKit blendshape name → mean value over the capture window. */
export type InputProfileVowelBlendshapeMeans = Readonly<Record<string, number>>;

export type InputProfile = {
  readonly profileId: string;
  readonly displayName: string;
  readonly source: "ifacialmocap";
  readonly transport: "udp";
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
  readonly calibration: InputProfileCalibration;
};

export type InputProfileDocument = {
  readonly schemaVersion: typeof inputProfileDocumentSchemaVersion;
  readonly activeProfileId?: string;
  readonly profiles: readonly InputProfile[];
};

export function createEmptyInputProfileDocument(): InputProfileDocument {
  return {
    schemaVersion: inputProfileDocumentSchemaVersion,
    profiles: []
  };
}
