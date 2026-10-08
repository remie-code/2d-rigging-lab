import { describe, expect, it } from "vitest";

import { parseIFacialMocapFrame } from "./ifacialmocap-frame-parser";

describe("iFacialMocap frame parser", () => {
  it("parses blendshape segments with v1 dash delimiters", () => {
    const parsed = parseIFacialMocapFrame(
      "eyeBlinkLeft-0|jawOpen-55.5|mouthSmileRight-100|",
      { timestampMs: 1000, sequence: 1 }
    );

    expect(parsed.source).toBe("ifacialmocap");
    expect(parsed.timestampMs).toBe(1000);
    expect(parsed.sequence).toBe(1);
    expect(parsed.blendshapes).toEqual({
      eyeBlinkLeft: 0,
      jawOpen: 55.5,
      mouthSmileRight: 100
    });
    expect(parsed.diagnostics).toEqual({
      malformedSegmentCount: 0,
      parseWarnings: []
    });
  });

  it("parses head rotation and raw position", () => {
    const parsed = parseIFacialMocapFrame(
      "=head#1,2,3,4,5,6|",
      { timestampMs: 1000 }
    );

    expect(parsed.head).toEqual({
      rotationEulerDeg: { x: 1, y: 2, z: 3 },
      positionRaw: { x: 4, y: 5, z: 6 }
    });
  });

  it("parses right and left eye rotations", () => {
    const parsed = parseIFacialMocapFrame(
      "rightEye#7,8,9|leftEye#-1,-2,-3|",
      { timestampMs: 1000 }
    );

    expect(parsed.eyes).toEqual({
      right: {
        rotationEulerDeg: { x: 7, y: 8, z: 9 }
      },
      left: {
        rotationEulerDeg: { x: -1, y: -2, z: -3 }
      }
    });
  });

  it("parses sendDataVersion v2 ampersand-delimited blendshapes", () => {
    const parsed = parseIFacialMocapFrame(
      "sendDataVersion=v2|eyeBlinkLeft&25|jawOpen&100|=head#0,0,0,1,2,3|",
      { timestampMs: 1000 }
    );

    expect(parsed.sendDataVersion).toBe("v2");
    expect(parsed.blendshapes).toEqual({
      eyeBlinkLeft: 25,
      jawOpen: 100
    });
    expect(parsed.head?.positionRaw).toEqual({ x: 1, y: 2, z: 3 });
    expect(parsed.diagnostics.malformedSegmentCount).toBe(0);
  });

  it("preserves malformed segment diagnostics and last parse error", () => {
    const parsed = parseIFacialMocapFrame(
      "eyeBlinkLeft-50|badSegment|jawOpen-not-a-number|=head#1,2,3|leftEye#1,2|",
      { timestampMs: 1000 }
    );

    expect(parsed.blendshapes).toEqual({
      eyeBlinkLeft: 50
    });
    expect(parsed.head).toBeUndefined();
    expect(parsed.eyes).toBeUndefined();
    expect(parsed.diagnostics.malformedSegmentCount).toBe(4);
    expect(parsed.diagnostics.parseWarnings).toHaveLength(4);
    expect(parsed.diagnostics.lastParseError).toContain("leftEye#1,2");
  });

  it("parses TCP delimiter-stripped samples and strips delimiter suffixes", () => {
    const stripped = parseIFacialMocapFrame(
      "eyeBlinkLeft-10|rightEye#1,2,3",
      { timestampMs: 1000 }
    );
    const withDelimiter = parseIFacialMocapFrame(
      "eyeBlinkLeft-10|rightEye#1,2,3___iFacialMocap",
      { timestampMs: 1000 }
    );

    expect(stripped.blendshapes.eyeBlinkLeft).toBe(10);
    expect(stripped.eyes?.right?.rotationEulerDeg).toEqual({
      x: 1,
      y: 2,
      z: 3
    });
    expect(withDelimiter.blendshapes).toEqual(stripped.blendshapes);
    expect(withDelimiter.eyes).toEqual(stripped.eyes);
  });
});
