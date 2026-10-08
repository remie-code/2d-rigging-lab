import { describe, expect, it } from "vitest";

import { parseIFacialMocapFrame } from "./ifacialmocap-frame-parser";
import { normalizeIFacialMocapParsedFrame } from "./ifacialmocap-normalizer";

describe("iFacialMocap normalizer", () => {
  it("normalizes blendshape values from 0..100 to 0..1", () => {
    const result = normalizeIFacialMocapParsedFrame(
      parseIFacialMocapFrame("eyeBlinkLeft-0|jawOpen-50|mouthSmileRight-100|", {
        timestampMs: 1000
      })
    );

    expect(result.trackingFrame.blendshapes).toEqual({
      eyeBlinkLeft: 0,
      jawOpen: 0.5,
      mouthSmileRight: 1
    });
    expect(result.diagnostics.normalizationWarnings).toEqual([]);
  });

  it("clamps out-of-range blendshape values and records diagnostics", () => {
    const result = normalizeIFacialMocapParsedFrame(
      parseIFacialMocapFrame("eyeBlinkLeft--10|jawOpen-125|", {
        timestampMs: 1000
      })
    );

    expect(result.trackingFrame.blendshapes).toEqual({
      eyeBlinkLeft: 0,
      jawOpen: 1
    });
    expect(result.diagnostics.normalizationWarnings).toHaveLength(2);
    expect(result.trackingFrame.debug?.normalizationWarnings).toEqual(
      result.diagnostics.normalizationWarnings
    );
  });

  it("keeps missing head and eyes absent without inventing values", () => {
    const result = normalizeIFacialMocapParsedFrame(
      parseIFacialMocapFrame("jawOpen-10|", { timestampMs: 1000 })
    );

    expect(result.trackingFrame.head).toEqual({});
    expect(result.trackingFrame.eyes).toBeUndefined();
  });

  it("preserves head position raw values while keeping rotations in degrees", () => {
    const result = normalizeIFacialMocapParsedFrame(
      parseIFacialMocapFrame("=head#10,20,30,0.1,0.2,0.3|", {
        timestampMs: 1000,
        sequence: 7
      })
    );

    expect(result.trackingFrame).toMatchObject({
      source: "ifacialmocap",
      timestampMs: 1000,
      sequence: 7,
      transport: "udp",
      head: {
        rotationEulerDeg: { x: 10, y: 20, z: 30 },
        positionRaw: { x: 0.1, y: 0.2, z: 0.3 }
      }
    });
  });

  it("preserves parser diagnostics on the tracking frame debug payload", () => {
    const result = normalizeIFacialMocapParsedFrame(
      parseIFacialMocapFrame("jawOpen-20|badSegment|", {
        timestampMs: 1000
      })
    );

    expect(result.trackingFrame.debug?.malformedSegmentCount).toBe(1);
    expect(result.trackingFrame.debug?.parseWarnings).toHaveLength(1);
    expect(result.trackingFrame.debug?.lastParseError).toContain("badSegment");
  });
});
