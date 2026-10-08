import type { TrackingFrame } from "../../../preload/input-tracking-frame-contract";
import type { IFacialMocapParsedFrame } from "./ifacialmocap-parsed-frame";

const defaultRawFrameSampleMaxLength = 512;

export type IFacialMocapNormalizerOptions = {
  readonly rawFrameSampleMaxLength?: number;
};

export type IFacialMocapNormalizerDiagnostics = {
  readonly normalizationWarnings: readonly string[];
};

export type IFacialMocapNormalizationResult = {
  readonly trackingFrame: TrackingFrame;
  readonly diagnostics: IFacialMocapNormalizerDiagnostics;
};

export function normalizeIFacialMocapParsedFrame(
  parsedFrame: IFacialMocapParsedFrame,
  options: IFacialMocapNormalizerOptions = {}
): IFacialMocapNormalizationResult {
  const normalizationWarnings: string[] = [];
  const blendshapes = normalizeBlendshapes(
    parsedFrame.blendshapes,
    normalizationWarnings
  );
  const debug = createTrackingFrameDebug(
    parsedFrame,
    normalizationWarnings,
    options.rawFrameSampleMaxLength ?? defaultRawFrameSampleMaxLength
  );
  const trackingFrame: TrackingFrame = {
    source: "ifacialmocap",
    timestampMs: parsedFrame.timestampMs,
    transport: "udp",
    blendshapes,
    head: createTrackingHead(parsedFrame),
    debug,
    ...(parsedFrame.sequence === undefined
      ? {}
      : { sequence: parsedFrame.sequence }),
    ...createTrackingEyes(parsedFrame)
  };

  return {
    trackingFrame,
    diagnostics: {
      normalizationWarnings
    }
  };
}

function normalizeBlendshapes(
  blendshapes: Readonly<Record<string, number>>,
  normalizationWarnings: string[]
): Record<string, number> {
  const normalizedBlendshapes: Record<string, number> = {};

  for (const [name, value] of Object.entries(blendshapes)) {
    normalizedBlendshapes[name] = normalizeBlendshapeValue(
      name,
      value,
      normalizationWarnings
    );
  }

  return normalizedBlendshapes;
}

function normalizeBlendshapeValue(
  name: string,
  value: number,
  normalizationWarnings: string[]
): number {
  const normalizedValue = value / 100;
  const clampedValue = Math.min(1, Math.max(0, normalizedValue));

  if (clampedValue !== normalizedValue) {
    normalizationWarnings.push(
      `Blendshape ${name} value ${value} normalized to ${normalizedValue} and was clamped to ${clampedValue}.`
    );
  }

  return clampedValue;
}

function createTrackingHead(
  parsedFrame: IFacialMocapParsedFrame
): TrackingFrame["head"] {
  if (parsedFrame.head === undefined) {
    return {};
  }

  return {
    rotationEulerDeg: parsedFrame.head.rotationEulerDeg,
    positionRaw: parsedFrame.head.positionRaw
  };
}

function createTrackingEyes(
  parsedFrame: IFacialMocapParsedFrame
): Pick<TrackingFrame, "eyes"> | Record<string, never> {
  if (
    parsedFrame.eyes?.left === undefined &&
    parsedFrame.eyes?.right === undefined
  ) {
    return {};
  }

  return {
    eyes: {
      ...(parsedFrame.eyes.left === undefined
        ? {}
        : { leftEulerDeg: parsedFrame.eyes.left.rotationEulerDeg }),
      ...(parsedFrame.eyes.right === undefined
        ? {}
        : { rightEulerDeg: parsedFrame.eyes.right.rotationEulerDeg })
    }
  };
}

function createTrackingFrameDebug(
  parsedFrame: IFacialMocapParsedFrame,
  normalizationWarnings: readonly string[],
  rawFrameSampleMaxLength: number
): NonNullable<TrackingFrame["debug"]> {
  return {
    rawFrameSample: truncateRawFrameSample(
      parsedFrame.rawFrame,
      rawFrameSampleMaxLength
    ),
    malformedSegmentCount: parsedFrame.diagnostics.malformedSegmentCount,
    ...(parsedFrame.diagnostics.parseWarnings.length === 0
      ? {}
      : { parseWarnings: parsedFrame.diagnostics.parseWarnings }),
    ...(parsedFrame.diagnostics.lastParseError === undefined
      ? {}
      : { lastParseError: parsedFrame.diagnostics.lastParseError }),
    ...(normalizationWarnings.length === 0
      ? {}
      : { normalizationWarnings })
  };
}

function truncateRawFrameSample(
  rawFrame: string,
  rawFrameSampleMaxLength: number
): string {
  if (rawFrame.length <= rawFrameSampleMaxLength) {
    return rawFrame;
  }

  if (rawFrameSampleMaxLength <= 3) {
    return rawFrame.slice(0, rawFrameSampleMaxLength);
  }

  return `${rawFrame.slice(0, rawFrameSampleMaxLength - 3)}...`;
}
