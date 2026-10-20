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
 * `intent.envelope` ADDITIVELY; C6 adds `intent.speech` ADDITIVELY; the voice swap adds
 * `intent.speechStream` ADDITIVELY — the earlier shapes/validation/examples stay
 * byte-identical, only the announced kind set grows.
 */

/** Wire protocol version. v0 speaks version 1 only. */
export const runtimePlayerControlChannelProtocolVersion = 1 as const;

export type RuntimePlayerControlChannelProtocolVersion =
  typeof runtimePlayerControlChannelProtocolVersion;

/**
 * The request kinds this server understands (advertised in `server.hello`).
 * v0 = `intent.set`; C5 adds `intent.envelope`; C6 adds `intent.speech`; the voice
 * swap adds `intent.speechStream` (the streamed form of the same mora列), all
 * additively. Growth is additive: older souls simply never send a kind they were
 * not told about, and a soul that only ever sends `intent.set` keeps working
 * unchanged (C4 §3.4/§3.5 寛容規則).
 */
export const runtimePlayerControlChannelSupportedKinds = [
  "intent.set",
  "intent.envelope",
  "intent.speech",
  "intent.speechStream"
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

/**
 * The five Japanese vowels an `intent.speech` mora speaks in (C6 §2). The 器 is
 * language-neutral: the phoneme→vowel mapping lives 魂側 (設計 §6), so the wire
 * contract only carries a vowel LABEL, never a slot id — the 器 maps the label to
 * the fixed 6-slot mouth group internally. This const is the source of truth the
 * speech payload schema's `vowel` enum is byte-synced against.
 */
export const runtimePlayerControlChannelSpeechVowels = [
  "a",
  "i",
  "u",
  "e",
  "o"
] as const;

export type RuntimePlayerControlChannelSpeechVowel =
  (typeof runtimePlayerControlChannelSpeechVowels)[number];

/**
 * The maximum mora-timeline length an `intent.speech` payload may carry (C6 §7
 * 裁定4). `intent.speech` is the FIRST variable-length payload in the contract, so
 * an unbounded timeline is a DoS surface on the heart's per-tick scan. Over the cap
 * the request is refused with `invalidPayload` (拒否語彙の不増殖 — no new code, never
 * clamped). This const is the source of truth the speech payload schema's
 * `maxItems` is byte-synced against.
 */
export const runtimePlayerControlChannelSpeechMaxTimelineLength = 512;

/**
 * C6 `intent.speech` payload (C6 §2). A VARIABLE-LENGTH mora列 — the first variable
 * payload in the contract. Each mora is `{ timeMs, vowel, s }`: `timeMs` is the
 * relative time (ms from timeline start, monotonically increasing, non-negative);
 * `vowel` is one of the five vowel LABELS (a/i/u/e/o) — NOT a slot id, the 器 maps it
 * to the fixed 6-slot mouth group (mouth-open + mouth-vowel-*) itself; `s` is the
 * opening strength in the mouth-vowel normalized domain 0..1 (out-of-range is refused
 * with `slotValueOutOfRange`, never clamped). A malformed shape — non-record, empty
 * timeline, non-monotonic/negative/non-finite `timeMs`, unknown `vowel`, non-finite
 * `s`, or a timeline longer than {@link runtimePlayerControlChannelSpeechMaxTimelineLength}
 * — is refused with `invalidPayload`; NO new rejection code is added (裁定4). There is
 * deliberately NO attack field: attack ≈ the mora interval, derived by the 器's group
 * evaluator (設計 §3.2), not carried on the wire.
 *
 * NOTE — name collision (C6 命名規律): "speech timeline" is the GROUP mouth timeline
 * (5 vowels + mouth.open evaluated as a unit), a DIFFERENT concept from the C5
 * per-slot animation "envelope" (attack/sustain/decay) and the C4 message 封筒. This
 * payload's schema is channel-intent-speech-payload-schema.json.
 */
export type RuntimePlayerControlChannelIntentSpeechPayload = {
  readonly timeline: readonly {
    readonly timeMs: number;
    readonly vowel: RuntimePlayerControlChannelSpeechVowel;
    readonly s: number;
  }[];
};

/**
 * The three operations of an `intent.speechStream` request (voice swap Wave 1 Domain A).
 * `open` starts a new utterance (replacing the previous one; its acceptance instant is
 * the utterance's t=0), `append` adds the next slice of the SAME mora列, `end` says no
 * more slices follow. This const is the source of truth the speech stream payload
 * schema's `op` consts are byte-synced against.
 */
export const runtimePlayerControlChannelSpeechStreamOps = [
  "open",
  "append",
  "end"
] as const;

export type RuntimePlayerControlChannelSpeechStreamOp =
  (typeof runtimePlayerControlChannelSpeechStreamOps)[number];

/**
 * The maximum total mora count ONE streamed utterance may accumulate across all of its
 * `append`s (voice swap Wave 1 Domain A). Each `append` is still capped at
 * {@link runtimePlayerControlChannelSpeechMaxTimelineLength} (512); this whole-utterance
 * cap keeps the group evaluator's per-tick scan bounded the same way the 512 cap does for
 * `intent.speech`. An `append` that would exceed it is refused with `invalidPayload`
 * (拒否語彙の不増殖 — no new code, never truncated). Source of truth for the schema's
 * `maxUtteranceTimelineLength`.
 */
export const runtimePlayerControlChannelSpeechStreamMaxUtteranceLength = 4096;

/** One mora on the wire — the SAME item shape `intent.speech` carries. */
export type RuntimePlayerControlChannelSpeechMoraPayload = {
  readonly timeMs: number;
  readonly vowel: RuntimePlayerControlChannelSpeechVowel;
  readonly s: number;
};

/**
 * Voice swap `intent.speechStream` payload — the STREAMED form of the `intent.speech`
 * mora列, so the soul can hand the 器 the mouth timeline while the voice is still being
 * synthesized. One utterance = `open` → `append`×N → `end`, all naming the same
 * `utteranceId` (a non-empty soul-chosen string):
 *
 *  - `open`   : start the utterance. Replaces the previous utterance (whose later
 *               `append`/`end` are then ignored). t=0 = the 器's acceptance instant of
 *               this `open` (the same anchoring rule as `intent.speech`).
 *  - `append` : the next 1..512 moras. `timeMs` is relative to the utterance's t=0 and
 *               strictly increasing WITHIN the utterance (the first mora of an append
 *               must be after the previous append's last mora); at most 4096 moras per
 *               utterance. Item shape/domain is exactly `intent.speech`'s.
 *  - `end`    : no more moras. Until `end` the 器 holds the last vowel when the data runs
 *               out; after `end` the usual terminal (hold the last interval → release
 *               over 400ms) applies. Safety net (not a payload field; the 器's
 *               `RUNTIME_PLAYER_SPEECH_STREAM_STALL_END_MS`, voice swap Wave 2 / Domain
 *               A2): once the data has run out (the later of the last mora's absolute
 *               time and the acceptance instant of the slice that carried it), 2000ms
 *               with neither a further `append` nor `end` makes the 器 treat the
 *               utterance as ended at that instant (the same terminal as an `end`
 *               accepted then); its later `append`/`end` are ignored.
 *
 * An `append`/`end` naming an utteranceId that is not the current open utterance (a
 * stale tail of a replaced/stopped one) is accepted and ignored. A malformed shape, a
 * non-monotonic continuation or an over-cap utterance is refused with `invalidPayload`;
 * an out-of-domain `s` with `slotValueOutOfRange`; an unwritable mouth group (open /
 * append) with `slotNotWritable` — NO new rejection code. Schema:
 * channel-intent-speech-stream-payload-schema.json.
 */
export type RuntimePlayerControlChannelIntentSpeechStreamPayload =
  | { readonly op: "open"; readonly utteranceId: string }
  | {
      readonly op: "append";
      readonly utteranceId: string;
      readonly timeline: readonly RuntimePlayerControlChannelSpeechMoraPayload[];
    }
  | { readonly op: "end"; readonly utteranceId: string };
