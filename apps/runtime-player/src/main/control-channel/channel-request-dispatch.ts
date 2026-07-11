import type { RuntimePlayerMappingSlot } from "../../preload/model-mapping-bridge-contract";
import {
  runtimePlayerControlChannelSupportedKinds,
  type RuntimePlayerControlChannelResponseEnvelope
} from "./contract/channel-protocol-contract";
import { validateControlChannelIntentSet } from "./channel-intent-validation";
import {
  createControlChannelAcceptedResponse,
  createControlChannelRejectedResponse,
  parseControlChannelRequestEnvelope
} from "./channel-protocol-messages";

/**
 * The pure decision core of the Control Channel server (C4 §3). Turns one raw
 * client text frame + the current server context into either "ignore" (malformed
 * envelope → keep connection, no reply) or "reply" (a response envelope plus,
 * when accepted, the overlay write the server should apply). Keeping this
 * socket-free makes every rejection code, the accepted+overlay path, the
 * unknown-kind keep-alive, and channelClosed unit-testable without a live server.
 *
 * The overlay expiry instant is FIXED here at acceptance time (C4 §4):
 * `receivedAtMs + (ttlMs ?? defaultWindowMs)`. The server just writes it.
 */

export type ControlChannelOverlayWrite = {
  readonly slotId: string;
  readonly value: number;
  readonly expiresAtMs: number;
};

export type ControlChannelRequestDispatch =
  | { readonly kind: "ignore" }
  | {
      readonly kind: "reply";
      readonly reply: RuntimePlayerControlChannelResponseEnvelope;
      readonly overlay?: ControlChannelOverlayWrite;
    };

export type DispatchControlChannelRequestInput = {
  readonly text: string;
  /**
   * Whether the channel is currently accepting intents. False while the channel
   * is Closed / closing → the request is rejected with `channelClosed`.
   */
  readonly accepting: boolean;
  readonly getCurrentSlots: () => readonly RuntimePlayerMappingSlot[] | null;
  /** Wall-clock instant the request was received (overlay expiry anchor). */
  readonly receivedAtMs: number;
  /** Default TTL window applied when the intent omits `ttlMs` (C4 §4). */
  readonly defaultWindowMs: number;
};

export function dispatchControlChannelRequest(
  input: DispatchControlChannelRequestInput
): ControlChannelRequestDispatch {
  const envelope = parseControlChannelRequestEnvelope(input.text);
  if (envelope === null) {
    // Not a correlatable envelope: drop silently, keep the connection (§3.5).
    return { kind: "ignore" };
  }

  if (!input.accepting) {
    return {
      kind: "reply",
      reply: createControlChannelRejectedResponse({
        replyTo: envelope.id,
        code: "channelClosed",
        message: "The control channel is not accepting intents."
      })
    };
  }

  if (!isSupportedKind(envelope.kind)) {
    // Unknown kind: reject, but the connection stays open (§3.5).
    return {
      kind: "reply",
      reply: createControlChannelRejectedResponse({
        replyTo: envelope.id,
        code: "unknownKind",
        message: `Unsupported request kind: ${envelope.kind}.`
      })
    };
  }

  const validation = validateControlChannelIntentSet({
    payload: envelope.payload,
    getCurrentSlots: input.getCurrentSlots
  });

  if (!validation.ok) {
    return {
      kind: "reply",
      reply: createControlChannelRejectedResponse({
        replyTo: envelope.id,
        code: validation.code,
        message: validation.message
      })
    };
  }

  const ttlMs = validation.ttlMs ?? input.defaultWindowMs;
  return {
    kind: "reply",
    reply: createControlChannelAcceptedResponse(envelope.id),
    overlay: {
      slotId: validation.slotId,
      value: validation.value,
      expiresAtMs: input.receivedAtMs + ttlMs
    }
  };
}

function isSupportedKind(kind: string): boolean {
  return (runtimePlayerControlChannelSupportedKinds as readonly string[])
    .includes(kind);
}
