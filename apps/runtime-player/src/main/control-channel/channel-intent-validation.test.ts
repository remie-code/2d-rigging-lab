import { describe, expect, it } from "vitest";

import type {
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingSlotId
} from "../../preload/model-mapping-bridge-contract";
import {
  validateControlChannelIntentEnvelope,
  validateControlChannelIntentSet,
  validateControlChannelIntentSpeech
} from "./channel-intent-validation";
import { runtimePlayerControlChannelSpeechMaxTimelineLength } from "./contract/channel-protocol-contract";

function writableSlot(
  slotId: RuntimePlayerMappingSlotId
): RuntimePlayerMappingSlot {
  return {
    slotId,
    label: slotId,
    group: "head",
    target: {
      parameterId: `param_${slotId}`,
      displayName: slotId,
      min: -30,
      max: 30,
      default: 0
    },
    enabled: true,
    invert: false,
    strength: 1,
    status: "mapped",
    warningMessages: []
  };
}

function disabledSlot(
  slotId: RuntimePlayerMappingSlotId
): RuntimePlayerMappingSlot {
  return {
    ...writableSlot(slotId),
    target: null,
    enabled: false,
    status: "missing-target",
    warningMessages: ["missing"]
  };
}

const slotsWith = (
  ...slots: readonly RuntimePlayerMappingSlot[]
): (() => readonly RuntimePlayerMappingSlot[]) => () => slots;

describe("validateControlChannelIntentSet", () => {
  it("accepts a valid in-range writable intent (with ttlMs)", () => {
    const result = validateControlChannelIntentSet({
      payload: { slotId: "head-horizontal", value: 0.4, ttlMs: 800 },
      getCurrentSlots: slotsWith(writableSlot("head-horizontal"))
    });

    expect(result).toStrictEqual({
      ok: true,
      slotId: "head-horizontal",
      value: 0.4,
      ttlMs: 800
    });
  });

  it("accepts a valid intent without ttlMs (ttlMs undefined)", () => {
    const result = validateControlChannelIntentSet({
      payload: { slotId: "eye-blink-left", value: 1 },
      getCurrentSlots: slotsWith(writableSlot("eye-blink-left"))
    });

    expect(result).toStrictEqual({
      ok: true,
      slotId: "eye-blink-left",
      value: 1,
      ttlMs: undefined
    });
  });

  it("rejects a non-record payload with invalidPayload", () => {
    expect(
      validateControlChannelIntentSet({
        payload: "not-an-object",
        getCurrentSlots: slotsWith()
      })
    ).toMatchObject({ ok: false, code: "invalidPayload" });
  });

  it("rejects a non-finite value with invalidPayload", () => {
    for (const value of ["left", Number.NaN, Number.POSITIVE_INFINITY, null]) {
      expect(
        validateControlChannelIntentSet({
          payload: { slotId: "head-horizontal", value },
          getCurrentSlots: slotsWith(writableSlot("head-horizontal"))
        })
      ).toMatchObject({ ok: false, code: "invalidPayload" });
    }
  });

  it("rejects a non-positive or non-numeric ttlMs with invalidPayload", () => {
    for (const ttlMs of [0, -5, "800"]) {
      expect(
        validateControlChannelIntentSet({
          payload: { slotId: "head-horizontal", value: 0.1, ttlMs },
          getCurrentSlots: slotsWith(writableSlot("head-horizontal"))
        })
      ).toMatchObject({ ok: false, code: "invalidPayload" });
    }
  });

  it("rejects an unknown slotId with unknownSlot", () => {
    expect(
      validateControlChannelIntentSet({
        payload: { slotId: "left-elbow", value: 0.2 },
        getCurrentSlots: slotsWith()
      })
    ).toMatchObject({ ok: false, code: "unknownSlot" });
  });

  it("rejects an out-of-range centered value with slotValueOutOfRange (no clamp)", () => {
    for (const value of [1.5, -1.5]) {
      expect(
        validateControlChannelIntentSet({
          payload: { slotId: "head-horizontal", value },
          getCurrentSlots: slotsWith(writableSlot("head-horizontal"))
        })
      ).toMatchObject({ ok: false, code: "slotValueOutOfRange" });
    }
  });

  it("rejects an out-of-range weight value with slotValueOutOfRange", () => {
    for (const value of [1.2, -0.1]) {
      expect(
        validateControlChannelIntentSet({
          payload: { slotId: "eye-blink-left", value },
          getCurrentSlots: slotsWith(writableSlot("eye-blink-left"))
        })
      ).toMatchObject({ ok: false, code: "slotValueOutOfRange" });
    }
  });

  it("accepts range boundary values", () => {
    expect(
      validateControlChannelIntentSet({
        payload: { slotId: "head-horizontal", value: -1 },
        getCurrentSlots: slotsWith(writableSlot("head-horizontal"))
      })
    ).toMatchObject({ ok: true });
    expect(
      validateControlChannelIntentSet({
        payload: { slotId: "eye-blink-left", value: 0 },
        getCurrentSlots: slotsWith(writableSlot("eye-blink-left"))
      })
    ).toMatchObject({ ok: true });
  });

  it("rejects a disabled/untargeted slot with slotNotWritable", () => {
    expect(
      validateControlChannelIntentSet({
        payload: { slotId: "body-z", value: 0.3 },
        getCurrentSlots: slotsWith(disabledSlot("body-z"))
      })
    ).toMatchObject({ ok: false, code: "slotNotWritable" });
  });

  it("rejects any slot when no model is loaded (null slots) with slotNotWritable", () => {
    expect(
      validateControlChannelIntentSet({
        payload: { slotId: "head-horizontal", value: 0.2 },
        getCurrentSlots: () => null
      })
    ).toMatchObject({ ok: false, code: "slotNotWritable" });
  });

  it("rejects a slot absent from the current mapping with slotNotWritable", () => {
    expect(
      validateControlChannelIntentSet({
        payload: { slotId: "head-horizontal", value: 0.2 },
        getCurrentSlots: slotsWith(writableSlot("eye-blink-left"))
      })
    ).toMatchObject({ ok: false, code: "slotNotWritable" });
  });
});

describe("validateControlChannelIntentEnvelope", () => {
  const validEnvelope = {
    slotId: "head-horizontal",
    peak: 0.8,
    attackMs: 120,
    sustainMs: 600,
    decayMs: 400
  };

  it("accepts a valid in-range writable envelope", () => {
    const result = validateControlChannelIntentEnvelope({
      payload: validEnvelope,
      getCurrentSlots: slotsWith(writableSlot("head-horizontal"))
    });

    expect(result).toStrictEqual({
      ok: true,
      slotId: "head-horizontal",
      peak: 0.8,
      attackMs: 120,
      sustainMs: 600,
      decayMs: 400
    });
  });

  it("accepts a NEGATIVE peak on a centered slot (peak sign is a domain concern, not a parse failure)", () => {
    // Centered slots keep their full -1..1 domain; a leftward head envelope must be
    // as expressive as the set path. Negative peak is IN range → accepted (NOT
    // invalidPayload). See report §裁量.
    expect(
      validateControlChannelIntentEnvelope({
        payload: { ...validEnvelope, peak: -0.8 },
        getCurrentSlots: slotsWith(writableSlot("head-horizontal"))
      })
    ).toMatchObject({ ok: true, peak: -0.8 });
  });

  it("accepts a zero-duration phase as long as the envelope has some life", () => {
    // attackMs=0 (instant rise) is fine while sustain/decay give it drive time.
    expect(
      validateControlChannelIntentEnvelope({
        payload: { ...validEnvelope, attackMs: 0, decayMs: 0 },
        getCurrentSlots: slotsWith(writableSlot("head-horizontal"))
      })
    ).toMatchObject({ ok: true, attackMs: 0, sustainMs: 600, decayMs: 0 });
  });

  it("rejects a non-record payload with invalidPayload", () => {
    expect(
      validateControlChannelIntentEnvelope({
        payload: "not-an-object",
        getCurrentSlots: slotsWith()
      })
    ).toMatchObject({ ok: false, code: "invalidPayload" });
  });

  it("rejects a non-finite peak with invalidPayload", () => {
    for (const peak of [
      "high",
      Number.NaN,
      Number.POSITIVE_INFINITY,
      null,
      undefined
    ]) {
      expect(
        validateControlChannelIntentEnvelope({
          payload: { ...validEnvelope, peak },
          getCurrentSlots: slotsWith(writableSlot("head-horizontal"))
        })
      ).toMatchObject({ ok: false, code: "invalidPayload" });
    }
  });

  it("rejects a negative / non-finite / non-numeric duration with invalidPayload", () => {
    const badDurations = [-1, Number.NaN, Number.POSITIVE_INFINITY, "120", null];
    for (const key of ["attackMs", "sustainMs", "decayMs"] as const) {
      for (const bad of badDurations) {
        expect(
          validateControlChannelIntentEnvelope({
            payload: { ...validEnvelope, [key]: bad },
            getCurrentSlots: slotsWith(writableSlot("head-horizontal"))
          })
        ).toMatchObject({ ok: false, code: "invalidPayload" });
      }
    }
  });

  it("rejects a zero-life envelope (attack+sustain+decay=0) with invalidPayload (裁定4, no new code)", () => {
    expect(
      validateControlChannelIntentEnvelope({
        payload: { ...validEnvelope, attackMs: 0, sustainMs: 0, decayMs: 0 },
        getCurrentSlots: slotsWith(writableSlot("head-horizontal"))
      })
    ).toMatchObject({ ok: false, code: "invalidPayload" });
  });

  it("rejects a missing/empty slotId with invalidPayload", () => {
    for (const slotId of ["", 42, undefined]) {
      expect(
        validateControlChannelIntentEnvelope({
          payload: { ...validEnvelope, slotId },
          getCurrentSlots: slotsWith()
        })
      ).toMatchObject({ ok: false, code: "invalidPayload" });
    }
  });

  it("rejects an unknown slotId with unknownSlot", () => {
    expect(
      validateControlChannelIntentEnvelope({
        payload: { ...validEnvelope, slotId: "left-elbow" },
        getCurrentSlots: slotsWith()
      })
    ).toMatchObject({ ok: false, code: "unknownSlot" });
  });

  it("rejects an out-of-range peak with slotValueOutOfRange (no clamp)", () => {
    for (const peak of [1.5, -1.5]) {
      expect(
        validateControlChannelIntentEnvelope({
          payload: { ...validEnvelope, peak },
          getCurrentSlots: slotsWith(writableSlot("head-horizontal"))
        })
      ).toMatchObject({ ok: false, code: "slotValueOutOfRange" });
    }
  });

  it("rejects an out-of-range weight-slot peak (0..1) including negatives with slotValueOutOfRange", () => {
    for (const peak of [1.2, -0.1]) {
      expect(
        validateControlChannelIntentEnvelope({
          payload: { ...validEnvelope, slotId: "mouth-smile", peak },
          getCurrentSlots: slotsWith(writableSlot("mouth-smile"))
        })
      ).toMatchObject({ ok: false, code: "slotValueOutOfRange" });
    }
  });

  it("rejects a disabled/untargeted slot with slotNotWritable", () => {
    expect(
      validateControlChannelIntentEnvelope({
        payload: { ...validEnvelope, slotId: "body-z", peak: 0.3 },
        getCurrentSlots: slotsWith(disabledSlot("body-z"))
      })
    ).toMatchObject({ ok: false, code: "slotNotWritable" });
  });

  it("rejects any slot when no model is loaded (null slots) with slotNotWritable", () => {
    expect(
      validateControlChannelIntentEnvelope({
        payload: validEnvelope,
        getCurrentSlots: () => null
      })
    ).toMatchObject({ ok: false, code: "slotNotWritable" });
  });
});

describe("validateControlChannelIntentSpeech", () => {
  const MOUTH_GROUP_SLOTS: readonly RuntimePlayerMappingSlotId[] = [
    "mouth-open",
    "mouth-vowel-a",
    "mouth-vowel-i",
    "mouth-vowel-u",
    "mouth-vowel-e",
    "mouth-vowel-o"
  ];
  const mouthGroupWritable = (): readonly RuntimePlayerMappingSlot[] =>
    MOUTH_GROUP_SLOTS.map((slotId) => writableSlot(slotId));

  const validTimeline = [
    { timeMs: 0, vowel: "o", s: 0.6 },
    { timeMs: 120, vowel: "e", s: 0.7 },
    { timeMs: 250, vowel: "a", s: 0.5 }
  ];

  it("accepts a valid mora timeline and returns the validated moras", () => {
    const result = validateControlChannelIntentSpeech({
      payload: { timeline: validTimeline },
      getCurrentSlots: mouthGroupWritable
    });

    expect(result).toStrictEqual({ ok: true, moras: validTimeline });
  });

  it("accepts a single-mora timeline (floor of the variable-length payload)", () => {
    expect(
      validateControlChannelIntentSpeech({
        payload: { timeline: [{ timeMs: 0, vowel: "a", s: 0.5 }] },
        getCurrentSlots: mouthGroupWritable
      })
    ).toMatchObject({ ok: true });
  });

  it("accepts a timeline exactly AT the 512 cap but rejects one OVER it with invalidPayload (裁定4, no clamp)", () => {
    const atCap = Array.from(
      { length: runtimePlayerControlChannelSpeechMaxTimelineLength },
      (_unused, index) => ({ timeMs: index * 100, vowel: "a", s: 0.5 })
    );
    expect(
      validateControlChannelIntentSpeech({
        payload: { timeline: atCap },
        getCurrentSlots: mouthGroupWritable
      })
    ).toMatchObject({ ok: true });

    const overCap = Array.from(
      { length: runtimePlayerControlChannelSpeechMaxTimelineLength + 1 },
      (_unused, index) => ({ timeMs: index * 100, vowel: "a", s: 0.5 })
    );
    expect(
      validateControlChannelIntentSpeech({
        payload: { timeline: overCap },
        getCurrentSlots: mouthGroupWritable
      })
    ).toMatchObject({ ok: false, code: "invalidPayload" });
  });

  it("rejects a non-record payload with invalidPayload", () => {
    for (const payload of ["not-an-object", 42, null, []]) {
      expect(
        validateControlChannelIntentSpeech({
          payload,
          getCurrentSlots: mouthGroupWritable
        })
      ).toMatchObject({ ok: false, code: "invalidPayload" });
    }
  });

  it("rejects a non-array / empty timeline with invalidPayload", () => {
    for (const timeline of ["nope", 3, null, undefined, {}, []]) {
      expect(
        validateControlChannelIntentSpeech({
          payload: { timeline },
          getCurrentSlots: mouthGroupWritable
        })
      ).toMatchObject({ ok: false, code: "invalidPayload" });
    }
  });

  it("rejects a non-record mora with invalidPayload", () => {
    expect(
      validateControlChannelIntentSpeech({
        payload: { timeline: [{ timeMs: 0, vowel: "a", s: 0.5 }, "mora"] },
        getCurrentSlots: mouthGroupWritable
      })
    ).toMatchObject({ ok: false, code: "invalidPayload" });
  });

  it("rejects a non-finite / negative timeMs with invalidPayload", () => {
    for (const timeMs of [Number.NaN, Number.POSITIVE_INFINITY, "0", -1, null]) {
      expect(
        validateControlChannelIntentSpeech({
          payload: { timeline: [{ timeMs, vowel: "a", s: 0.5 }] },
          getCurrentSlots: mouthGroupWritable
        })
      ).toMatchObject({ ok: false, code: "invalidPayload" });
    }
  });

  it("rejects a non-monotonic timeMs (≤ previous) with invalidPayload", () => {
    // Equal to previous (not strictly increasing) is rejected…
    expect(
      validateControlChannelIntentSpeech({
        payload: {
          timeline: [
            { timeMs: 0, vowel: "a", s: 0.5 },
            { timeMs: 100, vowel: "i", s: 0.5 },
            { timeMs: 100, vowel: "u", s: 0.5 }
          ]
        },
        getCurrentSlots: mouthGroupWritable
      })
    ).toMatchObject({ ok: false, code: "invalidPayload" });
    // …and so is a decrease.
    expect(
      validateControlChannelIntentSpeech({
        payload: {
          timeline: [
            { timeMs: 0, vowel: "a", s: 0.5 },
            { timeMs: 200, vowel: "i", s: 0.5 },
            { timeMs: 150, vowel: "u", s: 0.5 }
          ]
        },
        getCurrentSlots: mouthGroupWritable
      })
    ).toMatchObject({ ok: false, code: "invalidPayload" });
  });

  it("rejects an unknown vowel label with invalidPayload", () => {
    for (const vowel of ["x", "A", "", 0, null, "aa"]) {
      expect(
        validateControlChannelIntentSpeech({
          payload: { timeline: [{ timeMs: 0, vowel, s: 0.5 }] },
          getCurrentSlots: mouthGroupWritable
        })
      ).toMatchObject({ ok: false, code: "invalidPayload" });
    }
  });

  it("rejects a non-finite s with invalidPayload (a SHAPE failure, distinct from range)", () => {
    for (const s of [Number.NaN, Number.POSITIVE_INFINITY, "0.5", null]) {
      expect(
        validateControlChannelIntentSpeech({
          payload: { timeline: [{ timeMs: 0, vowel: "a", s }] },
          getCurrentSlots: mouthGroupWritable
        })
      ).toMatchObject({ ok: false, code: "invalidPayload" });
    }
  });

  it("rejects an out-of-range (finite) s with slotValueOutOfRange (mouth-vowel 0..1, no clamp)", () => {
    for (const s of [1.5, -0.1]) {
      expect(
        validateControlChannelIntentSpeech({
          payload: { timeline: [{ timeMs: 0, vowel: "a", s }] },
          getCurrentSlots: mouthGroupWritable
        })
      ).toMatchObject({ ok: false, code: "slotValueOutOfRange" });
    }
  });

  it("accepts s at the 0 and 1 domain boundaries", () => {
    expect(
      validateControlChannelIntentSpeech({
        payload: {
          timeline: [
            { timeMs: 0, vowel: "a", s: 0 },
            { timeMs: 100, vowel: "i", s: 1 }
          ]
        },
        getCurrentSlots: mouthGroupWritable
      })
    ).toMatchObject({ ok: true });
  });

  it("rejects with slotNotWritable when any one of the 6 mouth-group slots is not writable", () => {
    // All 6 present except mouth-vowel-u → the group is not fully writable.
    const missingOne = MOUTH_GROUP_SLOTS.filter(
      (slotId) => slotId !== "mouth-vowel-u"
    ).map((slotId) => writableSlot(slotId));
    expect(
      validateControlChannelIntentSpeech({
        payload: { timeline: validTimeline },
        getCurrentSlots: () => missingOne
      })
    ).toMatchObject({ ok: false, code: "slotNotWritable" });
  });

  it("rejects with slotNotWritable when a mouth-group slot is disabled/untargeted", () => {
    const withDisabled = MOUTH_GROUP_SLOTS.map((slotId) =>
      slotId === "mouth-open" ? disabledSlot(slotId) : writableSlot(slotId)
    );
    expect(
      validateControlChannelIntentSpeech({
        payload: { timeline: validTimeline },
        getCurrentSlots: () => withDisabled
      })
    ).toMatchObject({ ok: false, code: "slotNotWritable" });
  });

  it("rejects with slotNotWritable when no model is loaded (null slots)", () => {
    expect(
      validateControlChannelIntentSpeech({
        payload: { timeline: validTimeline },
        getCurrentSlots: () => null
      })
    ).toMatchObject({ ok: false, code: "slotNotWritable" });
  });

  it("orders checks so a shape failure beats a range failure (invalidPayload wins over slotValueOutOfRange)", () => {
    // A timeline with BOTH a non-monotonic timeMs AND an out-of-range s: the shape
    // failure (invalidPayload) is reported, not the range one.
    expect(
      validateControlChannelIntentSpeech({
        payload: {
          timeline: [
            { timeMs: 0, vowel: "a", s: 0.5 },
            { timeMs: 0, vowel: "i", s: 1.5 }
          ]
        },
        getCurrentSlots: mouthGroupWritable
      })
    ).toMatchObject({ ok: false, code: "invalidPayload" });
  });
});
