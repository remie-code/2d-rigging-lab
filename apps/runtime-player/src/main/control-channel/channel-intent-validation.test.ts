import { describe, expect, it } from "vitest";

import type {
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingSlotId
} from "../../preload/model-mapping-bridge-contract";
import {
  validateControlChannelIntentEnvelope,
  validateControlChannelIntentSet
} from "./channel-intent-validation";

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
