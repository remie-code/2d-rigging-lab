import type { TrackingVector3 } from "../../preload/input-tracking-frame-contract";

export const inputProfileDocumentSchemaVersion =
  "runtime-player-input-profiles-v1";

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
};

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
