import { describe, expect, it } from "vitest";

import type {
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingSlotId
} from "../../preload/model-mapping-bridge-contract";
import { validateControlChannelIntentSet } from "./channel-intent-validation";

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
