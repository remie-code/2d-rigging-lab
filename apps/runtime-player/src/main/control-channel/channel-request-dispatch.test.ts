import { describe, expect, it } from "vitest";

import type {
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingSlotId
} from "../../preload/model-mapping-bridge-contract";
import { dispatchControlChannelRequest } from "./channel-request-dispatch";

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

const baseInput = {
  accepting: true,
  getCurrentSlots: () => [writableSlot("head-horizontal")],
  receivedAtMs: 10_000,
  defaultWindowMs: 1000
};

function request(id: string, kind: string, payload: unknown): string {
  return JSON.stringify({ v: 1, id, kind, payload });
}

describe("dispatchControlChannelRequest", () => {
  it("ignores a malformed envelope (no id) without replying, keeping the connection", () => {
    const dispatch = dispatchControlChannelRequest({
      ...baseInput,
      text: JSON.stringify({ v: 1, kind: "intent.set", payload: {} })
    });
    expect(dispatch).toStrictEqual({ kind: "ignore" });
  });

  it("ignores non-JSON text without replying", () => {
    const dispatch = dispatchControlChannelRequest({
      ...baseInput,
      text: "not-json{"
    });
    expect(dispatch).toStrictEqual({ kind: "ignore" });
  });

  it("rejects any request with channelClosed when not accepting", () => {
    const dispatch = dispatchControlChannelRequest({
      ...baseInput,
      accepting: false,
      text: request("req-1", "intent.set", {
        slotId: "head-horizontal",
        value: 0.2
      })
    });
    expect(dispatch).toStrictEqual({
      kind: "reply",
      reply: {
        v: 1,
        replyTo: "req-1",
        result: "rejected",
        error: {
          code: "channelClosed",
          message: "The control channel is not accepting intents."
        }
      }
    });
  });

  it("rejects an unknown kind with unknownKind and no overlay", () => {
    const dispatch = dispatchControlChannelRequest({
      ...baseInput,
      text: request("req-2", "intent.wave", {})
    });
    expect(dispatch).toMatchObject({
      kind: "reply",
      reply: { replyTo: "req-2", result: "rejected", error: { code: "unknownKind" } }
    });
    expect(dispatch.kind === "reply" && dispatch.overlay).toBeUndefined();
  });

  it("accepts a valid intent and computes the overlay expiry from ttlMs", () => {
    const dispatch = dispatchControlChannelRequest({
      ...baseInput,
      text: request("req-3", "intent.set", {
        slotId: "head-horizontal",
        value: 0.4,
        ttlMs: 800
      })
    });
    expect(dispatch).toStrictEqual({
      kind: "reply",
      reply: { v: 1, replyTo: "req-3", result: "accepted" },
      overlay: {
        slotId: "head-horizontal",
        value: 0.4,
        expiresAtMs: 10_800
      }
    });
  });

  it("uses the default window when ttlMs is omitted", () => {
    const dispatch = dispatchControlChannelRequest({
      ...baseInput,
      text: request("req-4", "intent.set", {
        slotId: "head-horizontal",
        value: 0.1
      })
    });
    expect(dispatch).toMatchObject({
      kind: "reply",
      reply: { replyTo: "req-4", result: "accepted" },
      overlay: { slotId: "head-horizontal", value: 0.1, expiresAtMs: 11_000 }
    });
  });

  it("surfaces validation rejection codes without an overlay", () => {
    const outOfRange = dispatchControlChannelRequest({
      ...baseInput,
      text: request("req-5", "intent.set", {
        slotId: "head-horizontal",
        value: 5
      })
    });
    expect(outOfRange).toMatchObject({
      kind: "reply",
      reply: { replyTo: "req-5", error: { code: "slotValueOutOfRange" } }
    });
    expect(outOfRange.kind === "reply" && outOfRange.overlay).toBeUndefined();

    const notWritable = dispatchControlChannelRequest({
      ...baseInput,
      getCurrentSlots: () => null,
      text: request("req-6", "intent.set", {
        slotId: "head-horizontal",
        value: 0.2
      })
    });
    expect(notWritable).toMatchObject({
      kind: "reply",
      reply: { replyTo: "req-6", error: { code: "slotNotWritable" } }
    });
  });

  it("accepts an intent.envelope and returns an envelope write (no overlay)", () => {
    const dispatch = dispatchControlChannelRequest({
      ...baseInput,
      text: request("req-7", "intent.envelope", {
        slotId: "head-horizontal",
        peak: 0.8,
        attackMs: 120,
        sustainMs: 600,
        decayMs: 400
      })
    });
    expect(dispatch).toStrictEqual({
      kind: "reply",
      reply: { v: 1, replyTo: "req-7", result: "accepted" },
      envelope: {
        slotId: "head-horizontal",
        spec: { peak: 0.8, attackMs: 120, sustainMs: 600, decayMs: 400 }
      }
    });
    // The envelope write carries NO absolute expiry (server supplies startAtMs) and
    // does NOT ride the overlay field.
    expect(dispatch.kind === "reply" && dispatch.overlay).toBeUndefined();
  });

  it("surfaces envelope validation rejection codes (existing enumeration only) without a write", () => {
    const zeroLife = dispatchControlChannelRequest({
      ...baseInput,
      text: request("req-8", "intent.envelope", {
        slotId: "head-horizontal",
        peak: 0.5,
        attackMs: 0,
        sustainMs: 0,
        decayMs: 0
      })
    });
    expect(zeroLife).toMatchObject({
      kind: "reply",
      reply: { replyTo: "req-8", error: { code: "invalidPayload" } }
    });
    expect(zeroLife.kind === "reply" && zeroLife.envelope).toBeUndefined();

    const outOfRange = dispatchControlChannelRequest({
      ...baseInput,
      text: request("req-9", "intent.envelope", {
        slotId: "head-horizontal",
        peak: 5,
        attackMs: 100,
        sustainMs: 100,
        decayMs: 100
      })
    });
    expect(outOfRange).toMatchObject({
      kind: "reply",
      reply: { replyTo: "req-9", error: { code: "slotValueOutOfRange" } }
    });
    expect(outOfRange.kind === "reply" && outOfRange.envelope).toBeUndefined();
  });

  it("still rejects an envelope with channelClosed when not accepting (kind-agnostic gate)", () => {
    const dispatch = dispatchControlChannelRequest({
      ...baseInput,
      accepting: false,
      text: request("req-10", "intent.envelope", {
        slotId: "head-horizontal",
        peak: 0.5,
        attackMs: 100,
        sustainMs: 100,
        decayMs: 100
      })
    });
    expect(dispatch).toMatchObject({
      kind: "reply",
      reply: { replyTo: "req-10", error: { code: "channelClosed" } }
    });
  });
});
