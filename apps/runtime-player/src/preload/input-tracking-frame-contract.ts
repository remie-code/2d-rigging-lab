export type TrackingInputSource = "ifacialmocap";

export type TrackingInputTransport = "udp";

export type TrackingVector3 = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type TrackingFrameDebug = {
  readonly rawFrameSample?: string;
  readonly malformedSegmentCount?: number;
  readonly parseWarnings?: readonly string[];
  readonly lastParseError?: string;
  readonly normalizationWarnings?: readonly string[];
};

export type TrackingFrame = {
  readonly source: "ifacialmocap";
  readonly timestampMs: number;
  readonly sequence?: number;
  readonly transport: "udp";
  readonly blendshapes: Readonly<Record<string, number>>;
  readonly head: {
    readonly rotationEulerDeg?: TrackingVector3;
    readonly positionRaw?: TrackingVector3;
  };
  readonly eyes?: {
    readonly leftEulerDeg?: TrackingVector3;
    readonly rightEulerDeg?: TrackingVector3;
  };
  readonly debug?: TrackingFrameDebug;
};
