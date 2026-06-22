import type {
  RuntimePlayerInputCalibrationMode,
  RuntimePlayerInputCalibrationPromptKey,
  RuntimePlayerInputCalibrationPromptSnapshot,
  RuntimePlayerInputCalibrationSectionKey,
  RuntimePlayerInputCalibrationSnapshot
} from "../../preload/input-profile-bridge-contract";
import type {
  TrackingFrame,
  TrackingVector3
} from "../../preload/input-tracking-frame-contract";
import type {
  InputProfile,
  InputProfileAxis,
  InputProfileCalibration,
  InputProfileDirection,
  InputProfileLearnedSign
} from "./input-profile-document";
import {
  getCalibrationPromptKeysForSections,
  inputProfileCalibrationSectionKeys
} from "./input-profile-calibration-sections";

const directionalSampleThresholdDeg = 5;
const eyeDirectionalSampleThresholdDeg = 3;
const positionSampleThresholdRaw = 0.05;
const blinkSampleThreshold = 0.35;
const mouthOpenSampleThreshold = 0.2;
const smileSampleThreshold = 0.18;
const stableSamplesRequired = 2;
const fullCalibrationPromptKeys = getCalibrationPromptKeysForSections(
  inputProfileCalibrationSectionKeys
);

type CalibrationPromptDefinition = {
  readonly key: RuntimePlayerInputCalibrationPromptKey;
  readonly label: string;
  readonly requiredSampleCount: number;
};

type PromptState = RuntimePlayerInputCalibrationPromptSnapshot & {
  readonly stableDirection?: InputProfileDirection;
};

type CalibrationFeatureValues = {
  readonly headRotationEulerDeg: TrackingVector3;
  readonly headPositionRaw: TrackingVector3 | null;
  readonly eyeEulerDeg: TrackingVector3;
  readonly blinkLeft: number;
  readonly blinkRight: number;
  readonly jawOpen: number;
  readonly mouthSmile: number;
};

type CalibrationRangeState = {
  headMin: TrackingVector3;
  headMax: TrackingVector3;
  headPositionMin: TrackingVector3 | null;
  headPositionMax: TrackingVector3 | null;
  eyeMin: TrackingVector3;
  eyeMax: TrackingVector3;
  blinkLeftMin: number;
  blinkLeftMax: number;
  blinkRightMin: number;
  blinkRightMax: number;
  jawOpenMin: number;
  jawOpenMax: number;
  smileMin: number;
  smileMax: number;
};

type MutableHeadLearnedSigns = {
  faceLeft?: InputProfileLearnedSign;
  faceRight?: InputProfileLearnedSign;
  lookUp?: InputProfileLearnedSign;
  lookDown?: InputProfileLearnedSign;
  tiltLeft?: InputProfileLearnedSign;
  tiltRight?: InputProfileLearnedSign;
};

type MutableEyeLearnedSigns = {
  eyesLeft?: InputProfileLearnedSign;
  eyesRight?: InputProfileLearnedSign;
  eyesUp?: InputProfileLearnedSign;
  eyesDown?: InputProfileLearnedSign;
};

type MutableHeadPositionLearnedSigns = {
  bodyLeft?: InputProfileLearnedSign;
  bodyRight?: InputProfileLearnedSign;
};

const calibrationPromptDefinitions = [
  { key: "look-forward", label: "Look forward", requiredSampleCount: 1 },
  { key: "face-left", label: "Turn face left", requiredSampleCount: stableSamplesRequired },
  { key: "face-right", label: "Turn face right", requiredSampleCount: stableSamplesRequired },
  { key: "look-up", label: "Look up", requiredSampleCount: stableSamplesRequired },
  { key: "look-down", label: "Look down", requiredSampleCount: stableSamplesRequired },
  { key: "tilt-left", label: "Tilt left", requiredSampleCount: stableSamplesRequired },
  { key: "tilt-right", label: "Tilt right", requiredSampleCount: stableSamplesRequired },
  { key: "eyes-left", label: "Eyes left", requiredSampleCount: stableSamplesRequired },
  { key: "eyes-right", label: "Eyes right", requiredSampleCount: stableSamplesRequired },
  { key: "eyes-up", label: "Eyes up", requiredSampleCount: stableSamplesRequired },
  { key: "eyes-down", label: "Eyes down", requiredSampleCount: stableSamplesRequired },
  { key: "blink", label: "Blink", requiredSampleCount: stableSamplesRequired },
  { key: "open-mouth", label: "Open mouth", requiredSampleCount: stableSamplesRequired },
  { key: "smile", label: "Smile", requiredSampleCount: stableSamplesRequired },
  { key: "head-position-left", label: "Move upper body left", requiredSampleCount: stableSamplesRequired },
  { key: "head-position-right", label: "Move upper body right", requiredSampleCount: stableSamplesRequired }
] as const satisfies readonly CalibrationPromptDefinition[];

const calibrationPromptDefinitionsByKey = new Map<
  RuntimePlayerInputCalibrationPromptKey,
  CalibrationPromptDefinition
>(
  calibrationPromptDefinitions.map((definition) => [
    definition.key,
    definition
  ] as const)
);

export type InputProfileCalibrationSessionOptions = {
  readonly sessionId: string;
  readonly displayName: string;
  readonly mode?: RuntimePlayerInputCalibrationMode;
  readonly section?: RuntimePlayerInputCalibrationSectionKey;
  readonly targetProfileId?: string;
  readonly promptKeys?: readonly RuntimePlayerInputCalibrationPromptKey[];
  readonly startedAtMs: number;
};

export type InputProfileCalibrationRecordResult = {
  readonly recorded: boolean;
  readonly message: string;
  readonly snapshot: RuntimePlayerInputCalibrationSnapshot;
};

export type InputProfileCalibrationAdvanceResult = {
  readonly advanced: boolean;
  readonly message: string;
  readonly snapshot: RuntimePlayerInputCalibrationSnapshot;
};

export class InputProfileCalibrationSession {
  private readonly sessionId: string;
  private readonly displayName: string;
  private readonly mode: RuntimePlayerInputCalibrationMode;
  private readonly section: RuntimePlayerInputCalibrationSectionKey | undefined;
  private readonly targetProfileId: string | undefined;
  private readonly startedAtIso: string;
  private readonly prompts: PromptState[];
  private currentPromptIndex = 0;
  private neutral: CalibrationFeatureValues | null = null;
  private range: CalibrationRangeState | null = null;
  private readonly headLearnedSigns: MutableHeadLearnedSigns = {};
  private readonly eyeLearnedSigns: MutableEyeLearnedSigns = {};
  private readonly headPositionLearnedSigns: MutableHeadPositionLearnedSigns = {};

  constructor(options: InputProfileCalibrationSessionOptions) {
    this.sessionId = options.sessionId;
    this.displayName = options.displayName;
    this.mode = options.mode ?? "full";
    this.section = options.section;
    this.targetProfileId = options.targetProfileId;
    this.startedAtIso = new Date(options.startedAtMs).toISOString();
    this.prompts = (options.promptKeys ?? fullCalibrationPromptKeys).map(
      (promptKey) => {
        const definition = calibrationPromptDefinitionsByKey.get(promptKey);

        if (definition === undefined) {
          throw new Error(`Unsupported calibration prompt: ${promptKey}`);
        }

        return {
          key: definition.key,
          label: definition.label,
          status: "waiting",
          sampleCount: 0,
          requiredSampleCount: definition.requiredSampleCount,
          message: "Waiting for sample."
        };
      }
    );
  }

  getSnapshot(): RuntimePlayerInputCalibrationSnapshot {
    const completedPromptCount = this.prompts.filter(
      (prompt) => prompt.status === "ok"
    ).length;

    return {
      sessionId: this.sessionId,
      displayName: this.displayName,
      mode: this.mode,
      ...(this.section === undefined ? {} : { section: this.section }),
      ...(this.targetProfileId === undefined
        ? {}
        : { targetProfileId: this.targetProfileId }),
      startedAtIso: this.startedAtIso,
      currentPromptIndex: this.currentPromptIndex,
      currentPrompt: this.prompts[this.currentPromptIndex] ?? null,
      prompts: this.prompts.map(toPromptSnapshot),
      completedPromptCount,
      totalPromptCount: this.prompts.length,
      canFinish: completedPromptCount === this.prompts.length
    };
  }

  recordSample(frame: TrackingFrame | null): InputProfileCalibrationRecordResult {
    const prompt = this.prompts[this.currentPromptIndex];

    if (prompt === undefined) {
      return {
        recorded: false,
        message: "Calibration already has all prompts recorded.",
        snapshot: this.getSnapshot()
      };
    }

    if (frame === null) {
      this.updatePrompt(prompt.key, {
        status: "needs-more",
        message: "No tracking frame is available."
      });

      return {
        recorded: false,
        message: "No tracking frame is available.",
        snapshot: this.getSnapshot()
      };
    }

    const values = readCalibrationFeatureValues(frame);

    if (prompt.key === "look-forward") {
      this.neutral = values;
      this.range = createInitialRange(values);
      this.updatePrompt(prompt.key, {
        status: "ok",
        sampleCount: 1,
        message: "Forward neutral recorded."
      });

      return {
        recorded: true,
        message: "Forward neutral recorded.",
        snapshot: this.getSnapshot()
      };
    }

    if (this.neutral === null || this.range === null) {
      this.updatePrompt(prompt.key, {
        status: "needs-more",
        message: "Record look forward before this prompt."
      });

      return {
        recorded: false,
        message: "Record look forward before this prompt.",
        snapshot: this.getSnapshot()
      };
    }

    this.range = expandRange(this.range, values);

    const evaluation = evaluatePromptSample(prompt.key, values, this.neutral);

    if (!evaluation.accepted) {
      this.updatePrompt(prompt.key, {
        status: "needs-more",
        message: evaluation.message
      });

      return {
        recorded: false,
        message: evaluation.message,
        snapshot: this.getSnapshot()
      };
    }

    const nextSampleCount =
      prompt.stableDirection === evaluation.direction ||
      prompt.stableDirection === undefined
        ? prompt.sampleCount + 1
        : 1;
    const complete = nextSampleCount >= prompt.requiredSampleCount;

    this.recordLearnedSign(prompt.key, evaluation.learnedSign);
    this.updatePrompt(prompt.key, {
      status: complete ? "ok" : "needs-more",
      sampleCount: nextSampleCount,
      stableDirection: evaluation.direction,
      message: complete
        ? "Prompt recorded."
        : `Hold the movement briefly (${nextSampleCount}/${prompt.requiredSampleCount}).`
    });

    return {
      recorded: complete,
      message: complete
        ? "Prompt recorded."
        : "Stable sample recorded; hold briefly.",
      snapshot: this.getSnapshot()
    };
  }

  advancePrompt(): InputProfileCalibrationAdvanceResult {
    const prompt = this.prompts[this.currentPromptIndex];

    if (prompt === undefined) {
      return {
        advanced: false,
        message: "Calibration already has all prompts recorded.",
        snapshot: this.getSnapshot()
      };
    }

    if (prompt.status !== "ok") {
      return {
        advanced: false,
        message: "Current prompt still needs more samples.",
        snapshot: this.getSnapshot()
      };
    }

    if (this.currentPromptIndex >= this.prompts.length - 1) {
      return {
        advanced: false,
        message: "Calibration is ready to finish.",
        snapshot: this.getSnapshot()
      };
    }

    this.currentPromptIndex += 1;

    return {
      advanced: true,
      message: "Advanced to the next calibration prompt.",
      snapshot: this.getSnapshot()
    };
  }

  createProfile(input: {
    readonly profileId: string;
    readonly displayName: string;
    readonly createdAtIso: string;
  }): InputProfile {
    const snapshot = this.getSnapshot();

    if (!snapshot.canFinish || this.neutral === null || this.range === null) {
      throw new Error("Calibration cannot finish until every prompt is recorded.");
    }

    if (!this.hasFullProfilePrompts()) {
      throw new Error("Partial calibration cannot create a new input profile.");
    }

    return {
      profileId: input.profileId,
      displayName: input.displayName,
      source: "ifacialmocap",
      transport: "udp",
      createdAtIso: input.createdAtIso,
      updatedAtIso: input.createdAtIso,
      calibration: {
        headRotationEulerDeg: {
          neutral: this.neutral.headRotationEulerDeg,
          min: this.range.headMin,
          max: this.range.headMax,
          learnedSigns: this.headLearnedSigns
        },
        headPositionRaw: this.createHeadPositionCalibration(),
        eyes: {
          neutral: this.neutral.eyeEulerDeg,
          min: this.range.eyeMin,
          max: this.range.eyeMax,
          blinkLeftMin: this.range.blinkLeftMin,
          blinkLeftMax: this.range.blinkLeftMax,
          blinkRightMin: this.range.blinkRightMin,
          blinkRightMax: this.range.blinkRightMax,
          learnedSigns: this.eyeLearnedSigns
        },
        mouth: {
          jawOpenMin: this.range.jawOpenMin,
          jawOpenMax: this.range.jawOpenMax,
          smileMin: this.range.smileMin,
          smileMax: this.range.smileMax
        }
      }
    };
  }

  createUpdatedProfile(input: {
    readonly profile: InputProfile;
    readonly updatedAtIso: string;
  }): InputProfile {
    const snapshot = this.getSnapshot();

    if (!snapshot.canFinish || this.neutral === null || this.range === null) {
      throw new Error("Calibration cannot finish until every prompt is recorded.");
    }

    if (!this.hasPrompt("head-position-left") || !this.hasPrompt("head-position-right")) {
      throw new Error("Only head position section updates are supported.");
    }

    return {
      ...input.profile,
      updatedAtIso: input.updatedAtIso,
      calibration: {
        ...input.profile.calibration,
        headPositionRaw: this.createHeadPositionCalibration()
      }
    };
  }

  getTargetProfileId(): string | undefined {
    return this.targetProfileId;
  }

  private createHeadPositionCalibration(): NonNullable<
    InputProfileCalibration["headPositionRaw"]
  > {
    if (
      this.neutral?.headPositionRaw === null ||
      this.neutral?.headPositionRaw === undefined ||
      this.range?.headPositionMin === null ||
      this.range?.headPositionMin === undefined ||
      this.range.headPositionMax === null ||
      this.range.headPositionMax === undefined ||
      this.headPositionLearnedSigns.bodyLeft === undefined ||
      this.headPositionLearnedSigns.bodyRight === undefined
    ) {
      throw new Error("Head position calibration is incomplete.");
    }

    return {
      neutral: this.neutral.headPositionRaw,
      min: this.range.headPositionMin,
      max: this.range.headPositionMax,
      learnedSigns: this.headPositionLearnedSigns
    };
  }

  private hasFullProfilePrompts(): boolean {
    return fullCalibrationPromptKeys.every((promptKey) =>
      this.hasPrompt(promptKey)
    );
  }

  private hasPrompt(promptKey: RuntimePlayerInputCalibrationPromptKey): boolean {
    return this.prompts.some((prompt) => prompt.key === promptKey);
  }

  private recordLearnedSign(
    promptKey: RuntimePlayerInputCalibrationPromptKey,
    learnedSign: InputProfileLearnedSign | null
  ): void {
    if (learnedSign === null) {
      return;
    }

    switch (promptKey) {
      case "face-left":
        this.headLearnedSigns.faceLeft = learnedSign;
        return;
      case "face-right":
        this.headLearnedSigns.faceRight = learnedSign;
        return;
      case "look-up":
        this.headLearnedSigns.lookUp = learnedSign;
        return;
      case "look-down":
        this.headLearnedSigns.lookDown = learnedSign;
        return;
      case "tilt-left":
        this.headLearnedSigns.tiltLeft = learnedSign;
        return;
      case "tilt-right":
        this.headLearnedSigns.tiltRight = learnedSign;
        return;
      case "eyes-left":
        this.eyeLearnedSigns.eyesLeft = learnedSign;
        return;
      case "eyes-right":
        this.eyeLearnedSigns.eyesRight = learnedSign;
        return;
      case "eyes-up":
        this.eyeLearnedSigns.eyesUp = learnedSign;
        return;
      case "eyes-down":
        this.eyeLearnedSigns.eyesDown = learnedSign;
        return;
      case "head-position-left":
        this.headPositionLearnedSigns.bodyLeft = learnedSign;
        return;
      case "head-position-right":
        this.headPositionLearnedSigns.bodyRight = learnedSign;
        return;
      default:
        return;
    }
  }

  private updatePrompt(
    promptKey: RuntimePlayerInputCalibrationPromptKey,
    update: Partial<PromptState>
  ): void {
    const index = this.prompts.findIndex((prompt) => prompt.key === promptKey);

    if (index < 0) {
      return;
    }

    const currentPrompt = this.prompts[index]!;
    this.prompts[index] = {
      ...currentPrompt,
      ...update
    };
  }
}

function evaluatePromptSample(
  promptKey: RuntimePlayerInputCalibrationPromptKey,
  values: CalibrationFeatureValues,
  neutral: CalibrationFeatureValues
):
  | {
      readonly accepted: true;
      readonly direction: InputProfileDirection;
      readonly learnedSign: InputProfileLearnedSign | null;
    }
  | {
      readonly accepted: false;
      readonly message: string;
    } {
  switch (promptKey) {
    case "face-left":
    case "face-right":
      return evaluateDirectionalSample(
        values.headRotationEulerDeg.y - neutral.headRotationEulerDeg.y,
        "y",
        directionalSampleThresholdDeg
      );
    case "look-up":
    case "look-down":
      return evaluateDirectionalSample(
        values.headRotationEulerDeg.x - neutral.headRotationEulerDeg.x,
        "x",
        directionalSampleThresholdDeg
      );
    case "tilt-left":
    case "tilt-right":
      return evaluateDirectionalSample(
        values.headRotationEulerDeg.z - neutral.headRotationEulerDeg.z,
        "z",
        directionalSampleThresholdDeg
      );
    case "eyes-left":
    case "eyes-right":
      return evaluateDirectionalSample(
        values.eyeEulerDeg.y - neutral.eyeEulerDeg.y,
        "y",
        eyeDirectionalSampleThresholdDeg
      );
    case "eyes-up":
    case "eyes-down":
      return evaluateDirectionalSample(
        values.eyeEulerDeg.x - neutral.eyeEulerDeg.x,
        "x",
        eyeDirectionalSampleThresholdDeg
      );
    case "head-position-left":
    case "head-position-right":
      if (values.headPositionRaw === null || neutral.headPositionRaw === null) {
        return {
          accepted: false,
          message: "Head position is not available in the tracking frame."
        };
      }

      return evaluateDirectionalSample(
        values.headPositionRaw.x - neutral.headPositionRaw.x,
        "x",
        positionSampleThresholdRaw
      );
    case "blink":
      return evaluateActivationSample(
        (values.blinkLeft + values.blinkRight) / 2,
        (neutral.blinkLeft + neutral.blinkRight) / 2,
        blinkSampleThreshold,
        "Blink value did not cross the v0 threshold."
      );
    case "open-mouth":
      return evaluateActivationSample(
        values.jawOpen,
        neutral.jawOpen,
        mouthOpenSampleThreshold,
        "Mouth open did not cross the v0 threshold."
      );
    case "smile":
      return evaluateActivationSample(
        values.mouthSmile,
        neutral.mouthSmile,
        smileSampleThreshold,
        "Smile did not cross the v0 threshold."
      );
    case "look-forward":
      return {
        accepted: false,
        message: "Look forward prompt is recorded separately."
      };
  }
}

function evaluateDirectionalSample(
  delta: number,
  axis: InputProfileAxis,
  threshold: number
):
  | {
      readonly accepted: true;
      readonly direction: InputProfileDirection;
      readonly learnedSign: InputProfileLearnedSign;
    }
  | {
      readonly accepted: false;
      readonly message: string;
    } {
  if (Math.abs(delta) < threshold) {
    return {
      accepted: false,
      message: "Movement did not cross the v0 threshold."
    };
  }

  const direction = delta < 0 ? -1 : 1;

  return {
    accepted: true,
    direction,
    learnedSign: { axis, direction }
  };
}

function evaluateActivationSample(
  value: number,
  neutralValue: number,
  threshold: number,
  failureMessage: string
):
  | {
      readonly accepted: true;
      readonly direction: InputProfileDirection;
      readonly learnedSign: null;
    }
  | {
      readonly accepted: false;
      readonly message: string;
    } {
  if (threshold === Number.POSITIVE_INFINITY) {
    const blinkDelta = value - neutralValue;

    if (blinkDelta < blinkSampleThreshold) {
      return {
        accepted: false,
        message: failureMessage
      };
    }

    return {
      accepted: true,
      direction: 1,
      learnedSign: null
    };
  }

  if (value - neutralValue < threshold) {
    return {
      accepted: false,
      message: failureMessage
    };
  }

  return {
    accepted: true,
    direction: 1,
    learnedSign: null
  };
}

function readCalibrationFeatureValues(
  frame: TrackingFrame
): CalibrationFeatureValues {
  return {
    headRotationEulerDeg:
      frame.head.rotationEulerDeg ?? createZeroVector3(),
    headPositionRaw: frame.head.positionRaw ?? null,
    eyeEulerDeg: averageEyeEuler(frame),
    blinkLeft: readBlendshape(frame, "eyeBlink_L"),
    blinkRight: readBlendshape(frame, "eyeBlink_R"),
    jawOpen: readBlendshape(frame, "jawOpen"),
    mouthSmile: averageBlendshapes(frame, "mouthSmile_L", "mouthSmile_R")
  };
}

function averageEyeEuler(frame: TrackingFrame): TrackingVector3 {
  const left = frame.eyes?.leftEulerDeg;
  const right = frame.eyes?.rightEulerDeg;

  if (left !== undefined && right !== undefined) {
    return {
      x: (left.x + right.x) / 2,
      y: (left.y + right.y) / 2,
      z: (left.z + right.z) / 2
    };
  }

  return left ?? right ?? createZeroVector3();
}

function averageBlendshapes(
  frame: TrackingFrame,
  leftName: string,
  rightName: string
): number {
  const left = frame.blendshapes[leftName];
  const right = frame.blendshapes[rightName];

  if (left !== undefined && right !== undefined) {
    return (left + right) / 2;
  }

  return left ?? right ?? 0;
}

function readBlendshape(frame: TrackingFrame, name: string): number {
  return frame.blendshapes[name] ?? 0;
}

function createInitialRange(
  values: CalibrationFeatureValues
): CalibrationRangeState {
  return {
    headMin: values.headRotationEulerDeg,
    headMax: values.headRotationEulerDeg,
    headPositionMin: values.headPositionRaw,
    headPositionMax: values.headPositionRaw,
    eyeMin: values.eyeEulerDeg,
    eyeMax: values.eyeEulerDeg,
    blinkLeftMin: values.blinkLeft,
    blinkLeftMax: values.blinkLeft,
    blinkRightMin: values.blinkRight,
    blinkRightMax: values.blinkRight,
    jawOpenMin: values.jawOpen,
    jawOpenMax: values.jawOpen,
    smileMin: values.mouthSmile,
    smileMax: values.mouthSmile
  };
}

function expandRange(
  range: CalibrationRangeState,
  values: CalibrationFeatureValues
): CalibrationRangeState {
  return {
    headMin: minVector3(range.headMin, values.headRotationEulerDeg),
    headMax: maxVector3(range.headMax, values.headRotationEulerDeg),
    headPositionMin: minOptionalVector3(
      range.headPositionMin,
      values.headPositionRaw
    ),
    headPositionMax: maxOptionalVector3(
      range.headPositionMax,
      values.headPositionRaw
    ),
    eyeMin: minVector3(range.eyeMin, values.eyeEulerDeg),
    eyeMax: maxVector3(range.eyeMax, values.eyeEulerDeg),
    blinkLeftMin: Math.min(range.blinkLeftMin, values.blinkLeft),
    blinkLeftMax: Math.max(range.blinkLeftMax, values.blinkLeft),
    blinkRightMin: Math.min(range.blinkRightMin, values.blinkRight),
    blinkRightMax: Math.max(range.blinkRightMax, values.blinkRight),
    jawOpenMin: Math.min(range.jawOpenMin, values.jawOpen),
    jawOpenMax: Math.max(range.jawOpenMax, values.jawOpen),
    smileMin: Math.min(range.smileMin, values.mouthSmile),
    smileMax: Math.max(range.smileMax, values.mouthSmile)
  };
}

function minOptionalVector3(
  left: TrackingVector3 | null,
  right: TrackingVector3 | null
): TrackingVector3 | null {
  if (left === null) {
    return right;
  }

  if (right === null) {
    return left;
  }

  return minVector3(left, right);
}

function maxOptionalVector3(
  left: TrackingVector3 | null,
  right: TrackingVector3 | null
): TrackingVector3 | null {
  if (left === null) {
    return right;
  }

  if (right === null) {
    return left;
  }

  return maxVector3(left, right);
}

function minVector3(left: TrackingVector3, right: TrackingVector3): TrackingVector3 {
  return {
    x: Math.min(left.x, right.x),
    y: Math.min(left.y, right.y),
    z: Math.min(left.z, right.z)
  };
}

function maxVector3(left: TrackingVector3, right: TrackingVector3): TrackingVector3 {
  return {
    x: Math.max(left.x, right.x),
    y: Math.max(left.y, right.y),
    z: Math.max(left.z, right.z)
  };
}

function createZeroVector3(): TrackingVector3 {
  return { x: 0, y: 0, z: 0 };
}

function toPromptSnapshot(
  prompt: PromptState
): RuntimePlayerInputCalibrationPromptSnapshot {
  return {
    key: prompt.key,
    label: prompt.label,
    status: prompt.status,
    sampleCount: prompt.sampleCount,
    requiredSampleCount: prompt.requiredSampleCount,
    message: prompt.message
  };
}
