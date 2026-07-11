import type { RuntimePlayerMappingSlotId } from "../../../preload/model-mapping-bridge-contract";

/**
 * Control Channel contract (C4 §3 外殻). The contract-of-record is the pure-JSON
 * schema + exchange examples living next to this file
 * ({@link ./channel-envelope-schema.json},
 * {@link ./channel-intent-set-payload-schema.json},
 * {@link ./channel-exchange-examples.json}). These TS types are the正の写像 —
 * kept byte-synced with the JSON by `channel-protocol-contract.test.ts`, so the
 *器 (this repo) and the 魂 (soul zone, Domain D) share one shape. The soul reads
 * the JSON only; nothing TS-specific leaks into the wire contract.
 *
 * The outer envelope is an ADDITIVE EXTENSION基礎 (C4 §2): new `kind`s are added
 * by later closed problems (C5 envelope intents, C6 phoneme timelines) without
 * changing the envelope. v0 owned exactly one kind (`intent.set`); C5 adds
 * `intent.envelope` ADDITIVELY — the `intent.set` shape/validation/examples are
 * byte-identical, only the announced kind set grows.
 */

/** Wire protocol version. v0 speaks version 1 only. */
export const runtimePlayerControlChannelProtocolVersion = 1 as const;

export type RuntimePlayerControlChannelProtocolVersion =
  typeof runtimePlayerControlChannelProtocolVersion;

/**
 * The request kinds this server understands (advertised in `server.hello`).
 * v0 = `intent.set`; C5 adds `intent.envelope` additively. Growth is additive:
 * older souls simply never send a kind they were not told about, and a soul that
 * only ever sends `intent.set` keeps working unchanged (C4 §3.4/§3.5 寛容規則).
 */
export const runtimePlayerControlChannelSupportedKinds = [
  "intent.set",
  "intent.envelope"
] as const;

export type RuntimePlayerControlChannelRequestKind =
  (typeof runtimePlayerControlChannelSupportedKinds)[number];

/**
 * The complete, finalized rejection code enumeration (C4 §3.3). A contract
 * violation is refused with one of these codes and the connection is KEPT
 * (§3.5). Rejections never clamp — an out-of-range value is refused, not
 * silently rounded.
 *
 *  - `unknownKind`          : envelope `kind` is not a supported kind.
 *  - `invalidPayload`       : payload failed to parse for its kind.
 *  - `unknownSlot`          : `slotId` is not a semantic-slot vocabulary member.
 *  - `slotValueOutOfRange`  : `value` is outside the slot's normalized domain.
 *  - `slotNotWritable`      : the loaded model has no enabled+targeted slot here.
 *  - `channelClosed`        : the channel is not accepting intents right now.
 */
export const runtimePlayerControlChannelRejectionCodes = [
  "unknownKind",
  "invalidPayload",
  "unknownSlot",
  "slotValueOutOfRange",
  "slotNotWritable",
  "channelClosed"
] as const;

export type RuntimePlayerControlChannelRejectionCode =
  (typeof runtimePlayerControlChannelRejectionCodes)[number];

/**
 * Request envelope (client → 器). `id` is the client-assigned correlation id
 * echoed back as `replyTo`; `kind` is the additive-extension slot; `payload` is
 * kind-specific.
 */
export type RuntimePlayerControlChannelRequestEnvelope = {
  readonly v: RuntimePlayerControlChannelProtocolVersion;
  readonly id: string;
  readonly kind: string;
  readonly payload: unknown;
};

/** Accepted response (器 → client). */
export type RuntimePlayerControlChannelAcceptedResponse = {
  readonly v: RuntimePlayerControlChannelProtocolVersion;
  readonly replyTo: string;
  readonly result: "accepted";
};

/** Rejected response (器 → client). Carries the enumerated `error.code`. */
export type RuntimePlayerControlChannelRejectedResponse = {
  readonly v: RuntimePlayerControlChannelProtocolVersion;
  readonly replyTo: string;
  readonly result: "rejected";
  readonly error: {
    readonly code: RuntimePlayerControlChannelRejectionCode;
    readonly message: string;
  };
};

export type RuntimePlayerControlChannelResponseEnvelope =
  | RuntimePlayerControlChannelAcceptedResponse
  | RuntimePlayerControlChannelRejectedResponse;

/**
 * Capabilities announcement (器 → client, immediately on connect, C4 §3.4). The
 * soul asks the 器 what it can do; unknown future kinds simply do not appear
 * here for an older 器.
 */
export type RuntimePlayerControlChannelServerHello = {
  readonly v: RuntimePlayerControlChannelProtocolVersion;
  readonly kind: "server.hello";
  readonly payload: {
    readonly protocol: RuntimePlayerControlChannelProtocolVersion;
    readonly supportedKinds: readonly RuntimePlayerControlChannelRequestKind[];
  };
};

/**
 * v0 `intent.set` payload (C4 §5). `slotId` rides the existing semantic-slot
 * vocabulary (no new vocabulary invented); `value` is the slot's normalized
 * value; `ttlMs` is optional — omitted means the 器's default window applies
 * (C4 §4 TTL統一機構).
 */
export type RuntimePlayerControlChannelIntentSetPayload = {
  readonly slotId: RuntimePlayerMappingSlotId;
  readonly value: number;
  readonly ttlMs?: number;
};

/**
 * C5 `intent.envelope` payload (C5 §2). `slotId` rides the same semantic-slot
 * vocabulary; `peak` is the slot's normalized target value (out-of-range is
 * refused with `slotValueOutOfRange`, never clamped — same rule as `intent.set`'s
 * `value`, so centered slots keep their full -1..1 domain including negatives);
 * `attackMs`/`sustainMs`/`decayMs` are the非負 curve durations the 器 draws at 60Hz.
 * A malformed shape (non-finite / negative duration / zero-life) is refused with
 * `invalidPayload` — NO new rejection code is added (裁定4). Release is the universal
 * non-exposed default, so it is deliberately absent from the wire payload.
 *
 * NOTE — name collision (C5 命名規律): this "envelope" is the animation envelope
 * (attack/sustain/decay), a DIFFERENT concept from the C4 message 封筒
 * (channel-envelope-schema.json). This payload's schema is
 * channel-intent-envelope-payload-schema.json; the two must not be conflated.
 */
export type RuntimePlayerControlChannelIntentEnvelopePayload = {
  readonly slotId: RuntimePlayerMappingSlotId;
  readonly peak: number;
  readonly attackMs: number;
  readonly sustainMs: number;
  readonly decayMs: number;
};
