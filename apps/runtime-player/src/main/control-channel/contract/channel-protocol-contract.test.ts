import { describe, expect, it } from "vitest";

import { runtimePlayerMappingSlotIds } from "../../../preload/model-mapping-bridge-contract";
import {
  semanticSlotDefinitions,
  type SemanticSlotSourceKind
} from "../../live-mapping/semantic-slot-definitions";
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
  runtimePlayerControlChannelSpeechVowels,
  runtimePlayerControlChannelSupportedKinds
} from "./channel-protocol-contract";
import envelopeSchema from "./channel-envelope-schema.json";
import intentSetPayloadSchema from "./channel-intent-set-payload-schema.json";
import intentEnvelopePayloadSchema from "./channel-intent-envelope-payload-schema.json";
import intentSpeechPayloadSchema from "./channel-intent-speech-payload-schema.json";
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

  it("emits a server.hello that matches the schema and examples (announces all three kinds, C6 additive)", () => {
    const hello = createControlChannelServerHello();

    expect(hello).toStrictEqual({
      v: 1,
      kind: "server.hello",
      payload: {
        protocol: 1,
        supportedKinds: ["intent.set", "intent.envelope", "intent.speech"]
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
