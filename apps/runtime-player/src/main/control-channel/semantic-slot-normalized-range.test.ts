import { describe, expect, it } from "vitest";

import { semanticSlotDefinitions } from "../live-mapping/semantic-slot-definitions";
import { semanticSlotNormalizedRange } from "./semantic-slot-normalized-range";

describe("semanticSlotNormalizedRange", () => {
  it("returns -1..1 for centered slots", () => {
    for (const kind of ["head-centered", "gaze-centered", "body-x", "body-z"] as const) {
      expect(semanticSlotNormalizedRange(kind)).toStrictEqual({
        min: -1,
        max: 1
      });
    }
  });

  it("returns 0..1 for weight and vowel slots", () => {
    for (
      const kind of [
        "blink-left",
        "blink-right",
        "mouth-open",
        "mouth-smile",
        "mouth-vowel"
      ] as const
    ) {
      expect(semanticSlotNormalizedRange(kind)).toStrictEqual({
        min: 0,
        max: 1
      });
    }
  });

  it("classifies every declared semantic slot definition", () => {
    for (const definition of semanticSlotDefinitions) {
      const range = semanticSlotNormalizedRange(definition.sourceKind);
      expect(range.min).toBeLessThan(range.max);
    }
  });
});
