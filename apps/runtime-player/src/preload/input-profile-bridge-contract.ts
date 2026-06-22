import type {
  TrackingInputSource,
  TrackingInputTransport,
  TrackingVector3
} from "./input-tracking-frame-contract";

export type RuntimePlayerInputProfileMode =
  | "missing"
  | "saved"
  | "temporary-defaults"
  | "load-warning";

export type RuntimePlayerInputProfileStorageState =
  | "missing"
  | "loaded"
  | "read-failed";

export type RuntimePlayerInputProfileSummary = {
  readonly profileId: string;
  readonly displayName: string;
  readonly source: TrackingInputSource;
  readonly transport: TrackingInputTransport;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
  readonly rangeStatus: "default" | "calibrated";
  readonly calibrationSections: readonly RuntimePlayerInputCalibrationSectionStatus[];
};

export type RuntimePlayerInputSessionNeutralSnapshot = {
  readonly capturedAtIso: string;
  readonly frameTimestampMs: number;
  readonly headRotationEulerDeg?: TrackingVector3;
  readonly headPositionRaw?: TrackingVector3;
  readonly leftEyeEulerDeg?: TrackingVector3;
  readonly rightEyeEulerDeg?: TrackingVector3;
  readonly jawOpen?: number;
  readonly mouthSmile?: number;
};

export type RuntimePlayerInputCalibrationPromptKey =
  | "look-forward"
  | "face-left"
  | "face-right"
  | "look-up"
  | "look-down"
  | "tilt-left"
  | "tilt-right"
  | "eyes-left"
  | "eyes-right"
  | "eyes-up"
  | "eyes-down"
  | "blink"
  | "open-mouth"
  | "smile"
  | "head-position-left"
  | "head-position-right";

export type RuntimePlayerInputCalibrationMode =
  | "full"
  | "missing-only"
  | "section";

export type RuntimePlayerInputCalibrationSectionKey =
  | "head-rotation"
  | "eyes-mouth"
  | "head-position";

export type RuntimePlayerInputCalibrationSectionReadiness =
  | "ready"
  | "missing";

export type RuntimePlayerInputCalibrationSectionStatus = {
  readonly key: RuntimePlayerInputCalibrationSectionKey;
  readonly label: string;
  readonly status: RuntimePlayerInputCalibrationSectionReadiness;
};

export type RuntimePlayerInputCalibrationPromptStatus =
  | "waiting"
  | "needs-more"
  | "ok";

export type RuntimePlayerInputCalibrationPromptSnapshot = {
  readonly key: RuntimePlayerInputCalibrationPromptKey;
  readonly label: string;
  readonly status: RuntimePlayerInputCalibrationPromptStatus;
  readonly sampleCount: number;
  readonly requiredSampleCount: number;
  readonly message: string;
};

export type RuntimePlayerInputCalibrationSnapshot = {
  readonly sessionId: string;
  readonly displayName: string;
  readonly mode: RuntimePlayerInputCalibrationMode;
  readonly section?: RuntimePlayerInputCalibrationSectionKey;
  readonly targetProfileId?: string;
  readonly startedAtIso: string;
  readonly currentPromptIndex: number;
  readonly currentPrompt:
    | RuntimePlayerInputCalibrationPromptSnapshot
    | null;
  readonly prompts: readonly RuntimePlayerInputCalibrationPromptSnapshot[];
  readonly completedPromptCount: number;
  readonly totalPromptCount: number;
  readonly canFinish: boolean;
};

export type RuntimePlayerInputProfileStatus = {
  readonly source: "ifacialmocap";
  readonly transport: "udp";
  readonly profileMode: RuntimePlayerInputProfileMode;
  readonly activeProfileId?: string;
  readonly activeProfile: RuntimePlayerInputProfileSummary | null;
  readonly profiles: readonly RuntimePlayerInputProfileSummary[];
  readonly storage: {
    readonly state: RuntimePlayerInputProfileStorageState;
    readonly warningMessages: readonly string[];
  };
  readonly temporaryDefaultsActive: boolean;
  readonly sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null;
  readonly calibration: RuntimePlayerInputCalibrationSnapshot | null;
};

export type RuntimePlayerInputProfileActionResultKind =
  | "ok"
  | "unavailable"
  | "validation-error";

export type RuntimePlayerInputProfileActionResult = {
  readonly result: RuntimePlayerInputProfileActionResultKind;
  readonly message: string;
  readonly status: RuntimePlayerInputProfileStatus;
};

export type RuntimePlayerInputProfileStartCalibrationRequest = {
  readonly displayName?: string;
  readonly mode?: RuntimePlayerInputCalibrationMode;
  readonly section?: RuntimePlayerInputCalibrationSectionKey;
};

export type RuntimePlayerInputProfileFinishCalibrationRequest = {
  readonly displayName?: string;
};

export type RuntimePlayerInputProfileSetActiveRequest = {
  readonly profileId: string;
};

export type RuntimePlayerInputProfileApi = {
  readonly getStatus: () => Promise<RuntimePlayerInputProfileStatus>;
  readonly setActiveProfile: (
    request: RuntimePlayerInputProfileSetActiveRequest
  ) => Promise<RuntimePlayerInputProfileActionResult>;
  readonly useTemporaryDefaults: () => Promise<RuntimePlayerInputProfileActionResult>;
  readonly lookForward: () => Promise<RuntimePlayerInputProfileActionResult>;
  readonly startCalibration: (
    request?: RuntimePlayerInputProfileStartCalibrationRequest
  ) => Promise<RuntimePlayerInputProfileActionResult>;
  readonly cancelCalibration: () => Promise<RuntimePlayerInputProfileActionResult>;
  readonly recordCalibrationSample: () => Promise<RuntimePlayerInputProfileActionResult>;
  readonly advanceCalibrationPrompt: () => Promise<RuntimePlayerInputProfileActionResult>;
  readonly finishCalibration: (
    request?: RuntimePlayerInputProfileFinishCalibrationRequest
  ) => Promise<RuntimePlayerInputProfileActionResult>;
  readonly onStatusChanged: (
    callback: (status: RuntimePlayerInputProfileStatus) => void
  ) => () => void;
};
