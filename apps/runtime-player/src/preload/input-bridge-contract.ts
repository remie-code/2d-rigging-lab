import type {
  TrackingFrame,
  TrackingInputSource,
  TrackingInputTransport,
  TrackingVector3
} from "./input-tracking-frame-contract";

export type RuntimePlayerInputConnectionState =
  | "idle"
  | "listening"
  | "receiving"
  | "stale"
  | "error";

export type RuntimePlayerInputConnectRequest = {
  readonly source?: TrackingInputSource;
  readonly transport?: TrackingInputTransport;
  readonly receivePort?: number;
  readonly iphoneHost?: string;
};

export type RuntimePlayerInputRemoteEndpoint = {
  readonly address: string;
  readonly port: number;
};

export type RuntimePlayerInputBlendshapeSnapshot = {
  readonly name: string;
  readonly value: number;
};

export type RuntimePlayerInputParsedFrameSnapshot = {
  readonly blendshapeCount: number;
  readonly blendshapes: readonly RuntimePlayerInputBlendshapeSnapshot[];
  readonly headRotationEulerDeg?: TrackingVector3;
  readonly headPositionRaw?: TrackingVector3;
  readonly leftEyeEulerDeg?: TrackingVector3;
  readonly rightEyeEulerDeg?: TrackingVector3;
};

export type RuntimePlayerInputParserDiagnostics = {
  readonly malformedSegmentCount: number;
  readonly parseWarnings: readonly string[];
  readonly lastParseError?: string;
};

export type RuntimePlayerInputHandshakeResult =
  | "not-attempted"
  | "pending"
  | "sent"
  | "error";

export type RuntimePlayerInputHandshakeDiagnostics = {
  readonly attempted: boolean;
  readonly result: RuntimePlayerInputHandshakeResult;
  readonly target?: RuntimePlayerInputRemoteEndpoint;
  readonly requestLabel?: string;
  readonly requestMessage?: string;
  readonly attemptedAtIso?: string;
  readonly completedAtIso?: string;
  readonly errorMessage?: string;
};

export type RuntimePlayerInputDiagnosticsSnapshot = {
  readonly updatedAtIso?: string;
  readonly rawFrameSample?: string;
  readonly parsedFrame?: RuntimePlayerInputParsedFrameSnapshot;
  readonly trackingFrame?: TrackingFrame;
  readonly parser?: RuntimePlayerInputParserDiagnostics;
  readonly normalizationWarnings?: readonly string[];
  readonly handshake?: RuntimePlayerInputHandshakeDiagnostics;
};

export type RuntimePlayerInputStatus = {
  readonly source: TrackingInputSource;
  readonly sourceLabel: "iFacialMocap";
  readonly transport: TrackingInputTransport;
  readonly transportLabel: "UDP";
  readonly receivePort: number;
  readonly iphoneHost?: string;
  readonly connectionState: RuntimePlayerInputConnectionState;
  readonly localIpCandidates: readonly string[];
  readonly remote?: RuntimePlayerInputRemoteEndpoint;
  readonly lastPacketAtIso?: string;
  readonly lastPacketAgeMs?: number;
  readonly packetCount: number;
  readonly estimatedFps?: number;
  readonly errorMessage?: string;
  readonly diagnostics: RuntimePlayerInputDiagnosticsSnapshot;
};

export type RuntimePlayerInputDiagnosticsCopyPayload = {
  readonly copiedAtIso: string;
  readonly status: RuntimePlayerInputStatus;
  readonly diagnostics: RuntimePlayerInputDiagnosticsSnapshot;
  readonly latestRawFrame?: string;
  readonly latestRawFrameLength?: number;
};

export type RuntimePlayerInputApi = {
  readonly getStatus: () => Promise<RuntimePlayerInputStatus>;
  readonly connect: (
    request?: RuntimePlayerInputConnectRequest
  ) => Promise<RuntimePlayerInputStatus>;
  readonly disconnect: () => Promise<RuntimePlayerInputStatus>;
  readonly getDiagnostics: () => Promise<RuntimePlayerInputDiagnosticsSnapshot>;
  readonly copyDiagnostics: () => Promise<RuntimePlayerInputDiagnosticsCopyPayload>;
  readonly onStatusChanged: (
    callback: (status: RuntimePlayerInputStatus) => void
  ) => () => void;
  readonly onDiagnosticsChanged: (
    callback: (diagnostics: RuntimePlayerInputDiagnosticsSnapshot) => void
  ) => () => void;
};
