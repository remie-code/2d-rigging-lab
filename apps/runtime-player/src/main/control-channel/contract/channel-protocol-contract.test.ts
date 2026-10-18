import { describe, expect, it } from "vitest";

import { runtimePlayerMappingSlotIds } from "../../../preload/model-mapping-bridge-contract";
import {
  semanticSlotDefinitions,
  type SemanticSlotSourceKind
} from "../../live-mapping/semantic-slot-definitions";
import type { RuntimePlayerMappingSlot } from "../../../preload/model-mapping-bridge-contract";
import { validateControlChannelIntentSpeechStream } from "../channel-intent-validation";
import { semanticSlotNormalizedRange } from "../semantic-slot-normalized-range";
import {
  createControlChannelAcceptedResponse,
  createControlChannelRejectedResponse,
  createControlChannelServerHello,
  parseControlChannelRequestEnvelope
} from "../channel-protocol-messages";
import {
  runtimePlayerControlChannelProtocolVersion,
  runtimePlayerControlChannelRejectionCodes,
  runtimePlayerControlChannelSpeechMaxTimelineLength,
  runtimePlayerControlChannelSpeechStreamMaxUtteranceLength,
  runtimePlayerControlChannelSpeechStreamOps,
  runtimePlayerControlChannelSpeechVowels,
  runtimePlayerControlChannelSupportedKinds
} from "./channel-protocol-contract";
import envelopeSchema from "./channel-envelope-schema.json";
import intentSetPayloadSchema from "./channel-intent-set-payload-schema.json";
import intentEnvelopePayloadSchema from "./channel-intent-envelope-payload-schema.json";
import intentSpeechPayloadSchema from "./channel-intent-speech-payload-schema.json";
import intentSpeechStreamPayloadSchema from "./channel-intent-speech-stream-payload-schema.json";
import exchangeExamples from "./channel-exchange-examples.json";

describe("Control Channel contract JSON ↔ TS sync", () => {
  it("keeps the envelope schema's protocol/kinds/codes synced with the TS types", () => {
    expect(envelopeSchema.protocolVersion).toBe(
      runtimePlayerControlChannelProtocolVersion
    );
    expect(envelopeSchema.supportedKinds).toStrictEqual(
      [...runtimePlayerControlChannelSupportedKinds]
    );
    expect(envelopeSchema.rejectionCodes).toStrictEqual(
      [...runtimePlayerControlChannelRejectionCodes]
    );
    expect(
      envelopeSchema.$defs.rejectedResponse.properties.error.properties.code.enum
    ).toStrictEqual([...runtimePlayerControlChannelRejectionCodes]);
  });

  it("keeps the intent.set payload schema's slotId enum synced with the slot vocabulary", () => {
    expect(intentSetPayloadSchema.properties.slotId.enum).toStrictEqual(
      [...runtimePlayerMappingSlotIds]
    );
  });

  it("keeps the intent.envelope payload schema's slotId enum synced with the slot vocabulary", () => {
    // Additive C5 kind: envelope payloads ride the SAME slot vocabulary as
    // intent.set, so the enum must stay pinned to the registry too.
    expect(intentEnvelopePayloadSchema.properties.slotId.enum).toStrictEqual(
      [...runtimePlayerMappingSlotIds]
    );
  });

  it("keeps the intent.envelope payload schema's slotId enum byte-identical to intent.set (additive, same vocabulary)", () => {
    expect(intentEnvelopePayloadSchema.properties.slotId.enum).toStrictEqual(
      intentSetPayloadSchema.properties.slotId.enum
    );
  });

  it("keeps the intent.speech payload schema's vowel enum synced with the speech vowel vocabulary (C6 additive)", () => {
    expect(
      intentSpeechPayloadSchema.properties.timeline.items.properties.vowel.enum
    ).toStrictEqual([...runtimePlayerControlChannelSpeechVowels]);
  });

  it("keeps the intent.speech payload schema's maxItems synced with the timeline cap (裁定4 512)", () => {
    expect(intentSpeechPayloadSchema.properties.timeline.maxItems).toBe(
      runtimePlayerControlChannelSpeechMaxTimelineLength
    );
    // The first variable-length payload must also declare a floor of 1 (empty is
    // rejected with invalidPayload).
    expect(intentSpeechPayloadSchema.properties.timeline.minItems).toBe(1);
  });

  it("keeps the intent.speechStream payload schema's ops synced with the TS op vocabulary (voice swap additive)", () => {
    expect(intentSpeechStreamPayloadSchema.ops).toStrictEqual([
      ...runtimePlayerControlChannelSpeechStreamOps
    ]);
    const { $defs } = intentSpeechStreamPayloadSchema;
    expect([
      $defs.open.properties.op.const,
      $defs.append.properties.op.const,
      $defs.end.properties.op.const
    ]).toStrictEqual([...runtimePlayerControlChannelSpeechStreamOps]);
    expect(intentSpeechStreamPayloadSchema.oneOf).toStrictEqual(
      runtimePlayerControlChannelSpeechStreamOps.map((op) => ({
        $ref: `#/$defs/${op}`
      }))
    );
  });

  it("keeps the intent.speechStream append slice identical to the intent.speech mora列 (per-append 512, same item)", () => {
    const appendTimeline =
      intentSpeechStreamPayloadSchema.$defs.append.properties.timeline;
    expect(appendTimeline.maxItems).toBe(
      runtimePlayerControlChannelSpeechMaxTimelineLength
    );
    expect(appendTimeline.minItems).toBe(1);
    // The mora item (timeMs / vowel / s, with their bounds and the vowel enum) is the SAME
    // contract as intent.speech's — the stream is that mora列 delivered in slices.
    expect(appendTimeline.items).toStrictEqual(
      intentSpeechPayloadSchema.properties.timeline.items
    );
  });

  it("keeps the intent.speechStream whole-utterance cap and mouth-vowel range synced (4096, 0..1)", () => {
    expect(intentSpeechStreamPayloadSchema.maxUtteranceTimelineLength).toBe(
      runtimePlayerControlChannelSpeechStreamMaxUtteranceLength
    );
    expect(intentSpeechStreamPayloadSchema.normalizedRanges).toStrictEqual({
      "mouth-vowel": semanticSlotNormalizedRange("mouth-vowel")
    });
  });

  it("emits a server.hello that matches the schema and examples (announces all four kinds, voice swap additive)", () => {
    const hello = createControlChannelServerHello();

    expect(hello).toStrictEqual({
      v: 1,
      kind: "server.hello",
      payload: {
        protocol: 1,
        supportedKinds: [
          "intent.set",
          "intent.envelope",
          "intent.speech",
          "intent.speechStream"
        ]
      }
    });
    expect(exchangeExamples.happyPath.messages[0]?.message).toStrictEqual(hello);
  });

  it("parses every worked example request envelope", () => {
    const requestExamples = [
      ...exchangeExamples.happyPath.messages
        .filter((entry) => entry.direction === "clientToServer")
        .map((entry) => entry.message),
      ...exchangeExamples.envelopePath.messages
        .filter((entry) => entry.direction === "clientToServer")
        .map((entry) => entry.message),
      ...exchangeExamples.speechPath.messages
        .filter((entry) => entry.direction === "clientToServer")
        .map((entry) => entry.message),
      ...exchangeExamples.speechStreamPath.messages
        .filter((entry) => entry.direction === "clientToServer")
        .map((entry) => entry.message),
      ...exchangeExamples.rejections.map((entry) => entry.request)
    ];

    for (const example of requestExamples) {
      const parsed = parseControlChannelRequestEnvelope(
        JSON.stringify(example)
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.id).toBe(example.id);
      expect(parsed?.kind).toBe(example.kind);
    }
  });

  it("carries a worked intent.envelope exchange whose accepted reply matches the builder", () => {
    const request = exchangeExamples.envelopePath.messages.find(
      (entry) => entry.direction === "clientToServer"
    );
    expect(request?.message.kind).toBe("intent.envelope");

    const accepted = exchangeExamples.envelopePath.messages.find(
      (entry) =>
        entry.direction === "serverToClient" &&
        "result" in entry.message &&
        entry.message.result === "accepted"
    );
    expect(accepted?.message).toStrictEqual(
      createControlChannelAcceptedResponse("req-70")
    );
  });

  it("carries a worked intent.speech exchange whose accepted reply matches the builder (C6 additive)", () => {
    const request = exchangeExamples.speechPath.messages.find(
      (entry) => entry.direction === "clientToServer"
    );
    expect(request?.message.kind).toBe("intent.speech");
    // The fixture phrase 「これじっさいのところどうなってるの」: 15 moras, a same-vowel run
    // (o×5, indices 5..9), monotonically increasing timeMs, vowels from the vocabulary,
    // s in the mouth-vowel 0..1 domain.
    const timeline = request?.message.payload?.timeline ?? [];
    expect(timeline).toHaveLength(15);
    let previous = -Infinity;
    for (const mora of timeline) {
      expect(mora.timeMs).toBeGreaterThan(previous);
      previous = mora.timeMs;
      expect([...runtimePlayerControlChannelSpeechVowels]).toContain(mora.vowel);
      expect(mora.s).toBeGreaterThanOrEqual(0);
      expect(mora.s).toBeLessThanOrEqual(1);
    }
    expect(timeline.slice(5, 10).map((mora) => mora.vowel)).toStrictEqual([
      "o",
      "o",
      "o",
      "o",
      "o"
    ]);

    const accepted = exchangeExamples.speechPath.messages.find(
      (entry) =>
        entry.direction === "serverToClient" &&
        "result" in entry.message &&
        entry.message.result === "accepted"
    );
    expect(accepted?.message).toStrictEqual(
      createControlChannelAcceptedResponse("req-90")
    );
  });

  it("carries a worked intent.speechStream exchange (open → append×2 → end, then a stale tail) that validates and whose replies match the builder", () => {
    const messages = exchangeExamples.speechStreamPath.messages;
    const requests = messages
      .filter((entry) => entry.direction === "clientToServer")
      .map((entry) => entry.message as unknown as {
        id: string;
        kind: string;
        payload: {
          op: string;
          utteranceId: string;
          timeline?: { timeMs: number; vowel: string; s: number }[];
        };
      });
    expect(requests.map((request) => request.kind)).toStrictEqual(
      requests.map(() => "intent.speechStream")
    );
    expect(
      requests.map((request) => `${request.payload.op}:${request.payload.utteranceId}`)
    ).toStrictEqual([
      "open:u-1",
      "append:u-1",
      "append:u-1",
      "end:u-1",
      "open:u-2",
      "append:u-1"
    ]);

    // Every request payload passes the 器's own validator (mouth group writable), and the
    // u-1 appends continue strictly after each other (発話内で単調増加).
    const mouthGroup = [
      "mouth-open",
      "mouth-vowel-a",
      "mouth-vowel-i",
      "mouth-vowel-u",
      "mouth-vowel-e",
      "mouth-vowel-o"
    ] as const;
    const writable = (): readonly RuntimePlayerMappingSlot[] =>
      mouthGroup.map((slotId) => ({
        slotId,
        label: slotId,
        group: "mouth",
        target: {
          parameterId: `param_${slotId}`,
          displayName: slotId,
          min: 0,
          max: 1,
          default: 0
        },
        enabled: true,
        invert: false,
        strength: 1,
        status: "mapped",
        warningMessages: []
      }));
    let previous = -Infinity;
    for (const request of requests) {
      expect(
        validateControlChannelIntentSpeechStream({
          payload: request.payload,
          getCurrentSlots: writable
        }).ok
      ).toBe(true);
      if (request.payload.op === "append" && request.id !== "req-125") {
        for (const mora of request.payload.timeline ?? []) {
          expect(mora.timeMs).toBeGreaterThan(previous);
          previous = mora.timeMs;
        }
      }
    }

    // Each request gets an accepted reply correlated by replyTo (the stale tail too).
    const replies = messages
      .filter((entry) => entry.direction === "serverToClient")
      .map((entry) => entry.message);
    expect(replies).toStrictEqual(
      requests.map((request) => createControlChannelAcceptedResponse(request.id))
    );
  });

  it("matches the accepted-response builder against the happy path example", () => {
    const accepted = exchangeExamples.happyPath.messages.find(
      (entry) => entry.direction === "serverToClient" &&
        "result" in entry.message &&
        entry.message.result === "accepted"
    );
    expect(accepted?.message).toStrictEqual(
      createControlChannelAcceptedResponse("req-42")
    );
  });

  it("covers every rejection code with a worked example whose builder matches", () => {
    const exampleCodes = exchangeExamples.rejections.map(
      (entry) => entry.code
    );
    expect([...exampleCodes].sort()).toStrictEqual(
      [...runtimePlayerControlChannelRejectionCodes].sort()
    );

    for (const rejection of exchangeExamples.rejections) {
      const built = createControlChannelRejectedResponse({
        replyTo: rejection.request.id,
        code: rejection.response.error
          .code as (typeof runtimePlayerControlChannelRejectionCodes)[number],
        message: rejection.response.error.message
      });
      expect(rejection.response).toStrictEqual(built);
      expect(runtimePlayerControlChannelRejectionCodes).toContain(
        rejection.response.error.code
      );
    }
  });
});

describe("Control Channel contract normalizedRanges ↔ TS classifier sync", () => {
  const normalizedRanges = intentSetPayloadSchema.normalizedRanges as Record<
    string,
    { readonly min: number; readonly max: number }
  >;

  it("declares a normalizedRange for exactly the sourceKinds the slots use", () => {
    // The JSON `normalizedRanges` block is what the soul zone reads to learn the
    // value domain of each slot. Anchor its key set to the actual slot registry
    // (semanticSlotDefinitions) so that adding a new sourceKind without updating
    // the contract JSON — or leaving an orphan range — fails this test.
    const sourceKindsInUse = new Set(
      semanticSlotDefinitions.map((definition) => definition.sourceKind)
    );
    const schemaKeys = new Set(Object.keys(normalizedRanges));
    expect(schemaKeys).toStrictEqual(sourceKindsInUse);
  });

  it("keeps each normalizedRange synced with semanticSlotNormalizedRange()", () => {
    // The runtime rejects out-of-range values using semanticSlotNormalizedRange();
    // the JSON must not silently drift from that TS source of truth.
    for (const [sourceKind, range] of Object.entries(normalizedRanges)) {
      expect(range).toStrictEqual(
        semanticSlotNormalizedRange(sourceKind as SemanticSlotSourceKind)
      );
    }
  });

  it("keeps the intent.envelope schema's normalizedRanges byte-identical to intent.set (peak shares value's domain)", () => {
    // The envelope `peak` is validated against the SAME normalized domain as the
    // set `value`, so both schemas must carry the identical range table (additive,
    // no drift) — this is what the soul reads to learn peak's domain.
    expect(intentEnvelopePayloadSchema.normalizedRanges).toStrictEqual(
      intentSetPayloadSchema.normalizedRanges
    );
  });

  it("keeps the intent.speech schema's mouth-vowel range synced with semanticSlotNormalizedRange() (s shares mouth-vowel's domain)", () => {
    // The speech mora `s` is validated against the mouth-vowel normalized domain
    // (0..1); the JSON must not drift from the TS source of truth the runtime rejects
    // against. The schema carries only the mouth-vowel range (the sole slot family the
    // group evaluator drives).
    expect(intentSpeechPayloadSchema.normalizedRanges).toStrictEqual({
      "mouth-vowel": semanticSlotNormalizedRange("mouth-vowel")
    });
    // The per-item s bounds must match the same domain.
    const sSchema = intentSpeechPayloadSchema.properties.timeline.items.properties.s;
    expect({ min: sSchema.minimum, max: sSchema.maximum }).toStrictEqual(
      semanticSlotNormalizedRange("mouth-vowel")
    );
  });
});
