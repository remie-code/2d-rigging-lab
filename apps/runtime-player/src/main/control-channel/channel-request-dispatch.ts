import type { RuntimePlayerMappingSlot } from "../../preload/model-mapping-bridge-contract";
import {
  runtimePlayerControlChannelSupportedKinds,
  type RuntimePlayerControlChannelResponseEnvelope
} from "./contract/channel-protocol-contract";
import {
  validateControlChannelIntentEnvelope,
  validateControlChannelIntentSet,
  validateControlChannelIntentSpeech
} from "./channel-intent-validation";
import {
  createControlChannelAcceptedResponse,
  createControlChannelRejectedResponse,
  parseControlChannelRequestEnvelope
} from "./channel-protocol-messages";
import type { SpeechMora } from "./speech-timeline-state";

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

/**
 * The envelope write for an accepted `intent.envelope` (C5 §2). The spec is the
 * Domain A store's {@link RuntimePlayerControlChannelEnvelopeSpec}. Unlike the
 * overlay write, there is NO absolute instant here: `startAtMs` = the acceptance
 * time is supplied by the server (`setEnvelope(slotId, spec, nowMs())`), keeping
 * this decision core timing-symmetric with the curve store's own clock ownership.
 */
export type ControlChannelEnvelopeWrite = {
  readonly slotId: string;
  readonly spec: {
    readonly peak: number;
    readonly attackMs: number;
    readonly sustainMs: number;
    readonly decayMs: number;
  };
};

/**
 * The speech write for an accepted `intent.speech` (C6 §2). Carries the validated
 * mora列 (Domain A's {@link SpeechMora} shape). Like the envelope write there is NO
 * absolute instant here: `startAtMs` = the acceptance time is supplied by the server
 * (`setSpeech(moras, nowMs())`), so the group evaluator owns its own clock.
 */
export type ControlChannelSpeechWrite = {
  readonly moras: readonly SpeechMora[];
};

export type ControlChannelRequestDispatch =
  | { readonly kind: "ignore" }
  | {
      readonly kind: "reply";
      readonly reply: RuntimePlayerControlChannelResponseEnvelope;
      readonly overlay?: ControlChannelOverlayWrite;
      readonly envelope?: ControlChannelEnvelopeWrite;
      readonly speech?: ControlChannelSpeechWrite;
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

  // Branch on the (now three) supported kinds. intent.set → overlay write (C4 path,
  // UNCHANGED); intent.envelope → envelope write into the per-slot curve machine;
  // intent.speech → speech write into the Domain A group timeline evaluator.
  if (envelope.kind === "intent.speech") {
    return dispatchIntentSpeech(envelope.id, envelope.payload, input);
  }
  if (envelope.kind === "intent.envelope") {
    return dispatchIntentEnvelope(envelope.id, envelope.payload, input);
  }
  return dispatchIntentSet(envelope.id, envelope.payload, input);
}

function dispatchIntentSet(
  id: string,
  payload: unknown,
  input: DispatchControlChannelRequestInput
): ControlChannelRequestDispatch {
  const validation = validateControlChannelIntentSet({
    payload,
    getCurrentSlots: input.getCurrentSlots
  });

  if (!validation.ok) {
    return {
      kind: "reply",
      reply: createControlChannelRejectedResponse({
        replyTo: id,
        code: validation.code,
        message: validation.message
      })
    };
  }

  const ttlMs = validation.ttlMs ?? input.defaultWindowMs;
  return {
    kind: "reply",
    reply: createControlChannelAcceptedResponse(id),
    overlay: {
      slotId: validation.slotId,
      value: validation.value,
      expiresAtMs: input.receivedAtMs + ttlMs
    }
  };
}

function dispatchIntentEnvelope(
  id: string,
  payload: unknown,
  input: DispatchControlChannelRequestInput
): ControlChannelRequestDispatch {
  const validation = validateControlChannelIntentEnvelope({
    payload,
    getCurrentSlots: input.getCurrentSlots
  });

  if (!validation.ok) {
    return {
      kind: "reply",
      reply: createControlChannelRejectedResponse({
        replyTo: id,
        code: validation.code,
        message: validation.message
      })
    };
  }

  return {
    kind: "reply",
    reply: createControlChannelAcceptedResponse(id),
    envelope: {
      slotId: validation.slotId,
      spec: {
        peak: validation.peak,
        attackMs: validation.attackMs,
        sustainMs: validation.sustainMs,
        decayMs: validation.decayMs
      }
    }
  };
}

function dispatchIntentSpeech(
  id: string,
  payload: unknown,
  input: DispatchControlChannelRequestInput
): ControlChannelRequestDispatch {
  const validation = validateControlChannelIntentSpeech({
    payload,
    getCurrentSlots: input.getCurrentSlots
  });

  if (!validation.ok) {
    return {
      kind: "reply",
      reply: createControlChannelRejectedResponse({
        replyTo: id,
        code: validation.code,
        message: validation.message
      })
    };
  }

  return {
    kind: "reply",
    reply: createControlChannelAcceptedResponse(id),
    speech: {
      moras: validation.moras
    }
  };
}

function isSupportedKind(kind: string): boolean {
  return (runtimePlayerControlChannelSupportedKinds as readonly string[])
    .includes(kind);
}
