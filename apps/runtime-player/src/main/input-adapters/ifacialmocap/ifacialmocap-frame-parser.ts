import type { TrackingVector3 } from "../../../preload/input-tracking-frame-contract";
import type {
  IFacialMocapEyeFrame,
  IFacialMocapHeadFrame,
  IFacialMocapParsedFrame,
  IFacialMocapParserDiagnostics
} from "./ifacialmocap-parsed-frame";

const tcpFrameDelimiter = "___iFacialMocap";
const headSegmentPrefixes = ["=head#", "head#"] as const;
const rightEyeSegmentPrefix = "rightEye#";
const leftEyeSegmentPrefix = "leftEye#";
const sendDataVersionPrefix = "sendDataVersion=";

export type IFacialMocapFrameParserOptions = {
  readonly timestampMs?: number;
  readonly sequence?: number;
};

type MutableParserDiagnostics = {
  malformedSegmentCount: number;
  parseWarnings: string[];
  lastParseError?: string;
};

type ParsedFrameAccumulator = {
  sendDataVersion?: string;
  head?: IFacialMocapHeadFrame;
  leftEye?: IFacialMocapEyeFrame;
  rightEye?: IFacialMocapEyeFrame;
};

export function parseIFacialMocapFrame(
  rawFrame: string,
  options: IFacialMocapFrameParserOptions = {}
): IFacialMocapParsedFrame {
  const diagnostics: MutableParserDiagnostics = {
    malformedSegmentCount: 0,
    parseWarnings: []
  };
  const blendshapes: Record<string, number> = {};
  const accumulator: ParsedFrameAccumulator = {};
  const frameText = stripTcpFrameDelimiter(rawFrame.trim());
  const segments = frameText
    .split("|")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    recordMalformedSegment(
      diagnostics,
      rawFrame,
      "iFacialMocap frame did not contain any parseable segments"
    );
  }

  for (const segment of segments) {
    parseSegment(segment, blendshapes, accumulator, diagnostics);
  }

  return createParsedFrame({
    rawFrame,
    options,
    blendshapes,
    accumulator,
    diagnostics
  });
}

function parseSegment(
  segment: string,
  blendshapes: Record<string, number>,
  accumulator: ParsedFrameAccumulator,
  diagnostics: MutableParserDiagnostics
): void {
  if (segment.startsWith(sendDataVersionPrefix)) {
    parseSendDataVersion(segment, accumulator, diagnostics);
    return;
  }

  const headPrefix = headSegmentPrefixes.find((prefix) =>
    segment.startsWith(prefix)
  );
  if (headPrefix !== undefined) {
    parseHeadSegment(segment, headPrefix, accumulator, diagnostics);
    return;
  }

  if (segment.startsWith(rightEyeSegmentPrefix)) {
    parseEyeSegment(
      segment,
      rightEyeSegmentPrefix,
      "right",
      accumulator,
      diagnostics
    );
    return;
  }

  if (segment.startsWith(leftEyeSegmentPrefix)) {
    parseEyeSegment(
      segment,
      leftEyeSegmentPrefix,
      "left",
      accumulator,
      diagnostics
    );
    return;
  }

  if (segment.includes("#")) {
    recordMalformedSegment(
      diagnostics,
      segment,
      "Unsupported iFacialMocap transform segment"
    );
    return;
  }

  parseBlendshapeSegment(segment, blendshapes, diagnostics);
}

function parseSendDataVersion(
  segment: string,
  accumulator: ParsedFrameAccumulator,
  diagnostics: MutableParserDiagnostics
): void {
  const sendDataVersion = segment.slice(sendDataVersionPrefix.length).trim();

  if (sendDataVersion.length === 0) {
    recordMalformedSegment(
      diagnostics,
      segment,
      "sendDataVersion segment is missing a value"
    );
    return;
  }

  accumulator.sendDataVersion = sendDataVersion;
}

function parseHeadSegment(
  segment: string,
  prefix: string,
  accumulator: ParsedFrameAccumulator,
  diagnostics: MutableParserDiagnostics
): void {
  const values = parseNumberList(segment, prefix, 6, diagnostics);

  if (values === null) {
    return;
  }

  const [rotX, rotY, rotZ, posX, posY, posZ] = values;
  if (
    rotX === undefined ||
    rotY === undefined ||
    rotZ === undefined ||
    posX === undefined ||
    posY === undefined ||
    posZ === undefined
  ) {
    return;
  }

  accumulator.head = {
    rotationEulerDeg: createVector3(rotX, rotY, rotZ),
    positionRaw: createVector3(posX, posY, posZ)
  };
}

function parseEyeSegment(
  segment: string,
  prefix: string,
  side: "left" | "right",
  accumulator: ParsedFrameAccumulator,
  diagnostics: MutableParserDiagnostics
): void {
  const values = parseNumberList(segment, prefix, 3, diagnostics);

  if (values === null) {
    return;
  }

  const [rotX, rotY, rotZ] = values;
  if (rotX === undefined || rotY === undefined || rotZ === undefined) {
    return;
  }

  const eyeFrame = {
    rotationEulerDeg: createVector3(rotX, rotY, rotZ)
  };

  if (side === "left") {
    accumulator.leftEye = eyeFrame;
    return;
  }

  accumulator.rightEye = eyeFrame;
}

function parseBlendshapeSegment(
  segment: string,
  blendshapes: Record<string, number>,
  diagnostics: MutableParserDiagnostics
): void {
  const delimiter = segment.includes("&") ? "&" : "-";
  const delimiterIndex = segment.indexOf(delimiter);

  if (delimiterIndex <= 0 || delimiterIndex === segment.length - 1) {
    recordMalformedSegment(
      diagnostics,
      segment,
      "Blendshape segment is missing a name/value delimiter"
    );
    return;
  }

  const name = segment.slice(0, delimiterIndex).trim();
  const valueText = segment.slice(delimiterIndex + 1).trim();

  if (name.length === 0) {
    recordMalformedSegment(
      diagnostics,
      segment,
      "Blendshape segment is missing a name"
    );
    return;
  }

  const value = Number(valueText);
  if (!Number.isFinite(value)) {
    recordMalformedSegment(
      diagnostics,
      segment,
      `Blendshape ${name} has a non-numeric value`
    );
    return;
  }

  blendshapes[name] = value;
}

function parseNumberList(
  segment: string,
  prefix: string,
  expectedCount: number,
  diagnostics: MutableParserDiagnostics
): number[] | null {
  const valueText = segment.slice(prefix.length);
  const parts = valueText.split(",").map((part) => part.trim());

  if (parts.length !== expectedCount) {
    recordMalformedSegment(
      diagnostics,
      segment,
      `Expected ${expectedCount} comma-separated values`
    );
    return null;
  }

  const values: number[] = [];

  for (const part of parts) {
    if (part.length === 0) {
      recordMalformedSegment(
        diagnostics,
        segment,
        "Transform segment contains an empty numeric value"
      );
      return null;
    }

    const value = Number(part);
    if (!Number.isFinite(value)) {
      recordMalformedSegment(
        diagnostics,
        segment,
        "Transform segment contains a non-numeric value"
      );
      return null;
    }

    values.push(value);
  }

  return values;
}

function createParsedFrame(input: {
  readonly rawFrame: string;
  readonly options: IFacialMocapFrameParserOptions;
  readonly blendshapes: Readonly<Record<string, number>>;
  readonly accumulator: ParsedFrameAccumulator;
  readonly diagnostics: MutableParserDiagnostics;
}): IFacialMocapParsedFrame {
  const parsedFrame: IFacialMocapParsedFrame = {
    source: "ifacialmocap",
    timestampMs: input.options.timestampMs ?? Date.now(),
    rawFrame: input.rawFrame,
    blendshapes: input.blendshapes,
    diagnostics: toParserDiagnostics(input.diagnostics),
    ...(input.options.sequence === undefined
      ? {}
      : { sequence: input.options.sequence }),
    ...(input.accumulator.sendDataVersion === undefined
      ? {}
      : { sendDataVersion: input.accumulator.sendDataVersion }),
    ...(input.accumulator.head === undefined
      ? {}
      : { head: input.accumulator.head }),
    ...createParsedEyes(input.accumulator)
  };

  return parsedFrame;
}

function createParsedEyes(
  accumulator: ParsedFrameAccumulator
): Pick<IFacialMocapParsedFrame, "eyes"> | Record<string, never> {
  if (
    accumulator.leftEye === undefined &&
    accumulator.rightEye === undefined
  ) {
    return {};
  }

  return {
    eyes: {
      ...(accumulator.leftEye === undefined
        ? {}
        : { left: accumulator.leftEye }),
      ...(accumulator.rightEye === undefined
        ? {}
        : { right: accumulator.rightEye })
    }
  };
}

function toParserDiagnostics(
  diagnostics: MutableParserDiagnostics
): IFacialMocapParserDiagnostics {
  return {
    malformedSegmentCount: diagnostics.malformedSegmentCount,
    parseWarnings: diagnostics.parseWarnings,
    ...(diagnostics.lastParseError === undefined
      ? {}
      : { lastParseError: diagnostics.lastParseError })
  };
}

function recordMalformedSegment(
  diagnostics: MutableParserDiagnostics,
  segment: string,
  reason: string
): void {
  const warning = `${reason}: ${formatSegmentForWarning(segment)}`;
  diagnostics.malformedSegmentCount += 1;
  diagnostics.parseWarnings.push(warning);
  diagnostics.lastParseError = warning;
}

function formatSegmentForWarning(segment: string): string {
  const trimmed = segment.trim();

  if (trimmed.length <= 120) {
    return trimmed.length > 0 ? trimmed : "<empty>";
  }

  return `${trimmed.slice(0, 117)}...`;
}

function stripTcpFrameDelimiter(frameText: string): string {
  let strippedFrameText = frameText;

  while (strippedFrameText.endsWith(tcpFrameDelimiter)) {
    strippedFrameText = strippedFrameText
      .slice(0, -tcpFrameDelimiter.length)
      .trimEnd();
  }

  return strippedFrameText;
}

function createVector3(x: number, y: number, z: number): TrackingVector3 {
  return { x, y, z };
}
