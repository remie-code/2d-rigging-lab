import type {
  RuntimePlayerInputConnectRequest,
  RuntimePlayerInputConnectionState,
  RuntimePlayerInputDiagnosticsCopyPayload,
  RuntimePlayerInputDiagnosticsSnapshot,
  RuntimePlayerInputHandshakeDiagnostics,
  RuntimePlayerInputParsedFrameSnapshot,
  RuntimePlayerInputRemoteEndpoint,
  RuntimePlayerInputStatus
} from "../preload/input-bridge-contract";
import type { RuntimePlayerInputSessionNeutralSnapshot } from "../preload/input-profile-bridge-contract";
import type { TrackingFrame } from "../preload/input-tracking-frame-contract";
import { parseIFacialMocapFrame } from "./input-adapters/ifacialmocap/ifacialmocap-frame-parser";
import { normalizeIFacialMocapParsedFrame } from "./input-adapters/ifacialmocap/ifacialmocap-normalizer";
import type { IFacialMocapParsedFrame } from "./input-adapters/ifacialmocap/ifacialmocap-parsed-frame";
import { IFACIALMOCAP_DEFAULT_UDP_PORT } from "./input-adapters/ifacialmocap/ifacialmocap-udp-start-request";
import { getRuntimePlayerLocalIpCandidates } from "./input-local-ip-candidates";

const stalePacketAgeMs = 1000;
const fpsWindowMs = 2000;
const rawFrameSampleMaxLength = 512;

export type RuntimePlayerInputSessionConfig = Required<
  Pick<RuntimePlayerInputConnectRequest, "source" | "transport" | "receivePort">
> &
  Pick<RuntimePlayerInputConnectRequest, "iphoneHost">;

export type RuntimePlayerInputSessionStateOptions = {
  readonly nowMs?: () => number;
  readonly getLocalIpCandidates?: () => readonly string[];
};

export class RuntimePlayerInputSessionState {
  private readonly nowMs: () => number;
  private readonly getLocalIpCandidates: () => readonly string[];
  private connectionState: RuntimePlayerInputConnectionState = "idle";
  private receivePort = IFACIALMOCAP_DEFAULT_UDP_PORT;
  private iphoneHost: string | undefined;
  private remote: RuntimePlayerInputRemoteEndpoint | undefined;
  private lastPacketAtMs: number | undefined;
  private lastPacketAtIso: string | undefined;
  private packetCount = 0;
  private estimatedFps: number | undefined;
  private errorMessage: string | undefined;
  private diagnostics: RuntimePlayerInputDiagnosticsSnapshot = {};
  private latestRawFrame: string | undefined;
  private latestTrackingFrame: TrackingFrame | undefined;
  private sessionNeutral: RuntimePlayerInputSessionNeutralSnapshot | null = null;
  private readonly packetTimestampsMs: number[] = [];

  constructor(options: RuntimePlayerInputSessionStateOptions = {}) {
    this.nowMs = options.nowMs ?? Date.now;
    this.getLocalIpCandidates =
      options.getLocalIpCandidates ?? getRuntimePlayerLocalIpCandidates;
  }

  getStatus(nowMs = this.nowMs()): RuntimePlayerInputStatus {
    const connectionState = this.getConnectionState(nowMs);

    return {
      source: "ifacialmocap",
      sourceLabel: "iFacialMocap",
      transport: "udp",
      transportLabel: "UDP",
      receivePort: this.receivePort,
      connectionState,
      localIpCandidates: this.getLocalIpCandidates(),
      packetCount: this.packetCount,
      diagnostics: this.diagnostics,
      ...(this.iphoneHost === undefined ? {} : { iphoneHost: this.iphoneHost }),
      ...(this.remote === undefined ? {} : { remote: this.remote }),
      ...(this.lastPacketAtIso === undefined
        ? {}
        : { lastPacketAtIso: this.lastPacketAtIso }),
      ...(this.lastPacketAtMs === undefined
        ? {}
        : { lastPacketAgeMs: Math.max(0, Math.round(nowMs - this.lastPacketAtMs)) }),
      ...(this.estimatedFps === undefined
        ? {}
        : { estimatedFps: this.estimatedFps }),
      ...(this.errorMessage === undefined
        ? {}
        : { errorMessage: this.errorMessage })
    };
  }

  getDiagnostics(): RuntimePlayerInputDiagnosticsSnapshot {
    return this.diagnostics;
  }

  getLatestTrackingFrame(): TrackingFrame | null {
    return this.latestTrackingFrame ?? null;
  }

  getSessionNeutral(): RuntimePlayerInputSessionNeutralSnapshot | null {
    return this.sessionNeutral;
  }

  captureLookForward(
    nowMs = this.nowMs()
  ):
    | {
        readonly result: "captured";
        readonly neutral: RuntimePlayerInputSessionNeutralSnapshot;
      }
    | {
        readonly result: "unavailable";
        readonly message: string;
      } {
    if (this.latestTrackingFrame === undefined) {
      return {
        result: "unavailable",
        message: "Look Forward needs a received tracking frame."
      };
    }

    const neutral = createSessionNeutralSnapshot(
      this.latestTrackingFrame,
      nowMs
    );
    this.sessionNeutral = neutral;

    return {
      result: "captured",
      neutral
    };
  }

  createDiagnosticsCopyPayload(
    copiedAtMs = this.nowMs()
  ): RuntimePlayerInputDiagnosticsCopyPayload {
    const copiedAtIso = new Date(copiedAtMs).toISOString();

    return {
      copiedAtIso,
      status: this.getStatus(copiedAtMs),
      diagnostics: this.getDiagnostics(),
      ...(this.latestRawFrame === undefined
        ? {}
        : {
            latestRawFrame: this.latestRawFrame,
            latestRawFrameLength: this.latestRawFrame.length
          })
    };
  }

  setListening(
    config: RuntimePlayerInputSessionConfig,
    nowMs = this.nowMs()
  ): RuntimePlayerInputStatus {
    this.connectionState = "listening";
    this.receivePort = config.receivePort;
    this.iphoneHost = config.iphoneHost;
    this.remote = undefined;
    this.lastPacketAtMs = undefined;
    this.lastPacketAtIso = undefined;
    this.packetCount = 0;
    this.estimatedFps = undefined;
    this.errorMessage = undefined;
    this.latestRawFrame = undefined;
    this.latestTrackingFrame = undefined;
    this.packetTimestampsMs.splice(0);
    this.diagnostics = {
      updatedAtIso: new Date(nowMs).toISOString(),
      handshake: config.iphoneHost === undefined
        ? {
            attempted: false,
            result: "not-attempted"
          }
        : {
            attempted: true,
            result: "pending"
          }
    };

    return this.getStatus(nowMs);
  }

  setHandshakeDiagnostics(
    handshake: RuntimePlayerInputHandshakeDiagnostics,
    nowMs = this.nowMs()
  ): RuntimePlayerInputStatus {
    this.diagnostics = {
      ...this.diagnostics,
      updatedAtIso: new Date(nowMs).toISOString(),
      handshake
    };

    return this.getStatus(nowMs);
  }

  setIdle(nowMs = this.nowMs()): RuntimePlayerInputStatus {
    this.connectionState = "idle";
    this.errorMessage = undefined;
    this.diagnostics = {
      ...this.diagnostics,
      updatedAtIso: new Date(nowMs).toISOString()
    };

    return this.getStatus(nowMs);
  }

  setError(errorMessage: string, nowMs = this.nowMs()): RuntimePlayerInputStatus {
    this.connectionState = "error";
    this.errorMessage = errorMessage;
    this.diagnostics = {
      ...this.diagnostics,
      updatedAtIso: new Date(nowMs).toISOString()
    };

    return this.getStatus(nowMs);
  }

  recordReceivedFrame(input: {
    readonly rawFrame: string;
    readonly remote: RuntimePlayerInputRemoteEndpoint;
    readonly receivedAtMs?: number;
  }): RuntimePlayerInputStatus {
    const receivedAtMs = input.receivedAtMs ?? this.nowMs();
    const sequence = this.packetCount + 1;
    this.connectionState = "receiving";
    this.errorMessage = undefined;
    this.remote = input.remote;
    this.lastPacketAtMs = receivedAtMs;
    this.lastPacketAtIso = new Date(receivedAtMs).toISOString();
    this.packetCount = sequence;
    this.latestRawFrame = input.rawFrame;
    this.recordPacketTimestamp(receivedAtMs);

    const parsedFrame = parseIFacialMocapFrame(input.rawFrame, {
      timestampMs: receivedAtMs,
      sequence
    });
    const normalization = normalizeIFacialMocapParsedFrame(parsedFrame, {
      rawFrameSampleMaxLength
    });
    this.latestTrackingFrame = normalization.trackingFrame;
    this.diagnostics = this.createDiagnosticsSnapshot({
      parsedFrame,
      trackingFrame: normalization.trackingFrame,
      normalizationWarnings: normalization.diagnostics.normalizationWarnings,
      receivedAtMs
    });

    return this.getStatus(receivedAtMs);
  }

  private getConnectionState(
    nowMs: number
  ): RuntimePlayerInputConnectionState {
    if (
      this.connectionState === "receiving" &&
      this.lastPacketAtMs !== undefined &&
      nowMs - this.lastPacketAtMs > stalePacketAgeMs
    ) {
      return "stale";
    }

    return this.connectionState;
  }

  private recordPacketTimestamp(receivedAtMs: number): void {
    this.packetTimestampsMs.push(receivedAtMs);

    while (
      this.packetTimestampsMs.length > 0 &&
      receivedAtMs - this.packetTimestampsMs[0]! > fpsWindowMs
    ) {
      this.packetTimestampsMs.shift();
    }

    this.estimatedFps = calculateEstimatedFps(this.packetTimestampsMs);
  }

  private createDiagnosticsSnapshot(input: {
    readonly parsedFrame: IFacialMocapParsedFrame;
    readonly trackingFrame: TrackingFrame;
    readonly normalizationWarnings: readonly string[];
    readonly receivedAtMs: number;
  }): RuntimePlayerInputDiagnosticsSnapshot {
    return {
      updatedAtIso: new Date(input.receivedAtMs).toISOString(),
      rawFrameSample: truncateRawFrameSample(input.parsedFrame.rawFrame),
      parsedFrame: createParsedFrameSnapshot(input.parsedFrame),
      trackingFrame: input.trackingFrame,
      parser: input.parsedFrame.diagnostics,
      normalizationWarnings: input.normalizationWarnings,
      ...(this.diagnostics.handshake === undefined
        ? {}
        : { handshake: this.diagnostics.handshake })
    };
  }
}

function calculateEstimatedFps(packetTimestampsMs: readonly number[]): number | undefined {
  if (packetTimestampsMs.length < 2) {
    return undefined;
  }

  const first = packetTimestampsMs[0]!;
  const last = packetTimestampsMs[packetTimestampsMs.length - 1]!;
  const elapsedMs = last - first;

  if (elapsedMs <= 0) {
    return undefined;
  }

  return Math.round(((packetTimestampsMs.length - 1) * 1000 / elapsedMs) * 10) / 10;
}

function createParsedFrameSnapshot(
  parsedFrame: IFacialMocapParsedFrame
): RuntimePlayerInputParsedFrameSnapshot {
  return {
    blendshapeCount: Object.keys(parsedFrame.blendshapes).length,
    blendshapes: Object.entries(parsedFrame.blendshapes)
      .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
      .map(([name, value]) => ({ name, value })),
    ...(parsedFrame.head?.rotationEulerDeg === undefined
      ? {}
      : { headRotationEulerDeg: parsedFrame.head.rotationEulerDeg }),
    ...(parsedFrame.head?.positionRaw === undefined
      ? {}
      : { headPositionRaw: parsedFrame.head.positionRaw }),
    ...(parsedFrame.eyes?.left?.rotationEulerDeg === undefined
      ? {}
      : { leftEyeEulerDeg: parsedFrame.eyes.left.rotationEulerDeg }),
    ...(parsedFrame.eyes?.right?.rotationEulerDeg === undefined
      ? {}
      : { rightEyeEulerDeg: parsedFrame.eyes.right.rotationEulerDeg })
  };
}

function truncateRawFrameSample(rawFrame: string): string {
  if (rawFrame.length <= rawFrameSampleMaxLength) {
    return rawFrame;
  }

  return `${rawFrame.slice(0, rawFrameSampleMaxLength - 3)}...`;
}

function createSessionNeutralSnapshot(
  frame: TrackingFrame,
  capturedAtMs: number
): RuntimePlayerInputSessionNeutralSnapshot {
  return {
    capturedAtIso: new Date(capturedAtMs).toISOString(),
    frameTimestampMs: frame.timestampMs,
    ...(frame.head.rotationEulerDeg === undefined
      ? {}
      : { headRotationEulerDeg: frame.head.rotationEulerDeg }),
    ...(frame.eyes?.leftEulerDeg === undefined
      ? {}
      : { leftEyeEulerDeg: frame.eyes.leftEulerDeg }),
    ...(frame.eyes?.rightEulerDeg === undefined
      ? {}
      : { rightEyeEulerDeg: frame.eyes.rightEulerDeg }),
    ...readOptionalBlendshape(frame, "jawOpen", "jawOpen"),
    ...readOptionalMouthSmile(frame)
  };
}

function readOptionalBlendshape<TKey extends "jawOpen">(
  frame: TrackingFrame,
  blendshapeName: string,
  outputKey: TKey
): Partial<Record<TKey, number>> {
  const value = frame.blendshapes[blendshapeName];

  return value === undefined ? {} : { [outputKey]: value } as Record<TKey, number>;
}

function readOptionalMouthSmile(
  frame: TrackingFrame
): Pick<RuntimePlayerInputSessionNeutralSnapshot, "mouthSmile"> | Record<string, never> {
  const leftSmile = frame.blendshapes.mouthSmile_L;
  const rightSmile = frame.blendshapes.mouthSmile_R;

  if (leftSmile !== undefined && rightSmile !== undefined) {
    return {
      mouthSmile: (leftSmile + rightSmile) / 2
    };
  }

  if (leftSmile !== undefined || rightSmile !== undefined) {
    return {
      mouthSmile: leftSmile ?? rightSmile ?? 0
    };
  }

  return {};
}
