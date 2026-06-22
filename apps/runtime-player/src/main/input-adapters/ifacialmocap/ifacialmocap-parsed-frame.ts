import type { TrackingVector3 } from "../../../preload/input-tracking-frame-contract";

export type IFacialMocapHeadFrame = {
  readonly rotationEulerDeg: TrackingVector3;
  readonly positionRaw: TrackingVector3;
};

export type IFacialMocapEyeFrame = {
  readonly rotationEulerDeg: TrackingVector3;
};

export type IFacialMocapParserDiagnostics = {
  readonly malformedSegmentCount: number;
  readonly parseWarnings: readonly string[];
  readonly lastParseError?: string;
};

export type IFacialMocapParsedFrame = {
  readonly source: "ifacialmocap";
  readonly timestampMs: number;
  readonly sequence?: number;
  readonly rawFrame: string;
  readonly sendDataVersion?: string;
  readonly blendshapes: Readonly<Record<string, number>>;
  readonly head?: IFacialMocapHeadFrame;
  readonly eyes?: {
    readonly left?: IFacialMocapEyeFrame;
    readonly right?: IFacialMocapEyeFrame;
  };
  readonly diagnostics: IFacialMocapParserDiagnostics;
};
