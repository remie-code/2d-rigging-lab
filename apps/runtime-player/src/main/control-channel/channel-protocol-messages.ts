import {
  runtimePlayerControlChannelProtocolVersion,
  runtimePlayerControlChannelSupportedKinds,
  type RuntimePlayerControlChannelAcceptedResponse,
  type RuntimePlayerControlChannelRejectedResponse,
  type RuntimePlayerControlChannelRejectionCode,
  type RuntimePlayerControlChannelRequestEnvelope,
  type RuntimePlayerControlChannelServerHello
} from "./contract/channel-protocol-contract";

/**
 * Wire (de)serialization for the Control Channel envelopes (C4 §3). Parsing a
 * request envelope requires a non-empty `id` (needed to correlate a reply) and a
 * string `kind`. A message that is not a valid envelope (not JSON, missing id or
 * kind) cannot be correlated, so it is dropped silently — the tolerant rule
 * (§3.5): the connection is kept, no reply is fabricated. `payload` is passed
 * through untouched for the kind-specific validator.
 */

export function parseControlChannelRequestEnvelope(
  text: string
): RuntimePlayerControlChannelRequestEnvelope | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.id !== "string" || value.id.length === 0) {
    return null;
  }

  if (typeof value.kind !== "string" || value.kind.length === 0) {
    return null;
  }

  return {
    v: runtimePlayerControlChannelProtocolVersion,
    id: value.id,
    kind: value.kind,
    payload: value.payload
  };
}

export function createControlChannelServerHello():
  RuntimePlayerControlChannelServerHello {
  return {
    v: runtimePlayerControlChannelProtocolVersion,
    kind: "server.hello",
    payload: {
      protocol: runtimePlayerControlChannelProtocolVersion,
      supportedKinds: runtimePlayerControlChannelSupportedKinds
    }
  };
}

export function createControlChannelAcceptedResponse(
  replyTo: string
): RuntimePlayerControlChannelAcceptedResponse {
  return {
    v: runtimePlayerControlChannelProtocolVersion,
    replyTo,
    result: "accepted"
  };
}

export function createControlChannelRejectedResponse(input: {
  readonly replyTo: string;
  readonly code: RuntimePlayerControlChannelRejectionCode;
  readonly message: string;
}): RuntimePlayerControlChannelRejectedResponse {
  return {
    v: runtimePlayerControlChannelProtocolVersion,
    replyTo: input.replyTo,
    result: "rejected",
    error: {
      code: input.code,
      message: input.message
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
