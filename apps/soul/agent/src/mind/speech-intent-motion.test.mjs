import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadDistributionSpeechMotionCatalog } from "../test-support/distribution-speech-motion-catalog.mjs";
const catalog = await loadDistributionSpeechMotionCatalog();

import { createSpeechIntentMotion, decideSpeechIntentMotion } from "./speech-intent-motion.mjs";
import { createSpeechIntentNoneRecorder } from "./speech-intent-none-recorder.mjs";
import { createSpeechIntentSectionRecorder } from "./speech-intent-section-recorder.mjs";
import { createSpeechIntentDelivery } from "./speech-intent-delivery.mjs";

const section = {
  sceneId: "scene", utteranceId: "utterance", generation: 1, sectionId: "section", sectionIndex: 0,
  intent: "原文の意図", text: "区間の本文", context: [{ speaker: "partner", text: "文脈" }]
};

const answer = (choice) => ({ type: "choice", choice });
function answers(performance, attention) {
  return {
    speech_intent_performance: performance,
    speech_intent_attention: attention
  };
}

test("one decision request uses two independent questions and preserves both selections", async () => {
  const { intent, text, context } = section;
  const outcomes = [
    ["none", "unknown", "unsupported", "unsupported-performance"],
    ["receive", "unknown", "unsupported", "unknown-attention-target"],
    ["ask", "viewers", "unsupported", "unproduced-pair"],
    ["startled-recoil", "partner", "unsupported", "unproduced-pair"],
    ["invalid", "game", "failure", "shape"]
  ];
  const requests = [];
  for (const [performanceId, attentionTargetId, kind, reason] of outcomes) {
    const result = await decideSpeechIntentMotion(section, async (request) => {
      requests.push(request);
      return { answers: answers(answer(performanceId), answer(attentionTargetId)), latencyMs: 5 };
    }, catalog);
    assert.deepEqual(result, { kind, reason, performanceId, attentionTargetId, latencyMs: 5 });
  }
  assert.equal(requests.length, outcomes.length);
  for (const { input, questions } of requests) {
    assert.deepEqual(JSON.parse(input), { intent, text, context });
    assert.deepEqual(questions.map(({ choices }) => choices.map(({ value }) => value)), [
      [...Object.keys(catalog.performances), "none"],
      ["partner", "game", "viewers", "unknown"]
    ]);
  }
  assert.deepEqual(await decideSpeechIntentMotion(section, async () => ({
    answers: answers(answer("receive"), { type: "refusal" }), latencyMs: 5
  }), catalog), { kind: "failure", reason: "refusal", performanceId: "receive", attentionTargetId: null, latencyMs: 5 });
  assert.deepEqual(await decideSpeechIntentMotion(section, async () => {
    throw Object.assign(new Error("test"), { kind: "network", latencyMs: 7 });
  }, catalog), { kind: "failure", reason: "network", latencyMs: 7 });
  let called = false;
  assert.deepEqual(await decideSpeechIntentMotion({ ...section, text: " \n " }, () => { called = true; }),
    { kind: "skipped", reason: "empty-text" });
  assert.equal(called, false);
});

test("an unresolved decision cannot block start or play after reset", async () => {
  const decision = Promise.withResolvers();
  const requests = [];
  const motion = createSpeechIntentMotion({
    channel: { async sendMotion(request) { requests.push(request); return { result: "accepted" }; } },
    getCatalog: () => catalog,
    judge: () => decision.promise,
    recordUnsupported: () => assert.fail("unexpected unsupported record")
  });
  const prepared = motion.prepare(section);
  assert.equal(motion.prepare({ ...section }), prepared);
  const started = motion.start(section);
  assert.equal(motion.start({ ...section }), started);
  assert.deepEqual(await started.begin, { kind: "accepted" });
  await motion.reset();
  decision.resolve({ answers: answers(answer("receive"), answer("partner")), latencyMs: 50 });
  assert.equal((await prepared).kind, "selected");
  assert.deepEqual(await started.playback, { kind: "skipped" });
  assert.deepEqual(requests.map(({ op }) => op), ["begin", "cancel"]);
});

test("none recorder publishes one complete original per section across concurrent attempts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "speech-intent-none-"));
  try {
    const record = createSpeechIntentNoneRecorder({ directory });
    const [first, second] = await Promise.all([record(section, "ended"), record(section, "ended")]);
    assert.equal(first, second);
    assert.equal((await readdir(directory)).length, 1);
    const { recordedAt, ...stored } = JSON.parse(await readFile(first, "utf8"));
    assert.ok(Number.isFinite(Date.parse(recordedAt)));
    assert.deepEqual(stored, { version: 1, result: "none", playbackState: "ended", ...section });
    await record({ ...section, reason: "unproduced-pair" }, "interrupted");
    assert.deepEqual(JSON.parse(await readFile(first, "utf8")), { recordedAt, ...stored });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("unsupported records wait for final text and both decisions in either order, including after the next section starts", async () => {
  const judgeReplies = [];
  const records = [];
  const motion = createSpeechIntentMotion({
    channel: { async sendMotion() { return { result: "accepted" }; } },
    getCatalog: () => catalog,
    async recordSection() { return "all-fixture.json"; },
    judge() {
      const reply = Promise.withResolvers();
      judgeReplies.push(reply);
      return reply.promise;
    },
    async recordUnsupported(snapshot, status) { records.push({ snapshot, status }); return "fixture.json"; }
  });
  const { text, context, ...key } = section;
  const following = { ...key, sectionIndex: 1, sectionId: "following" };
  const none = { answers: answers(answer("none"), answer("unknown")), latencyMs: 12 };
  const early = motion.prepare(key, { text, context });
  await new Promise(setImmediate);
  judgeReplies[0].resolve(none);
  assert.equal((await early).kind, "unsupported");
  assert.equal(records.length, 0);
  await motion.start(key).begin;
  void motion.prepare(following, { text, context });
  await motion.start(following).begin;
  const finalText = text + "。続きの一文。";
  const recordFields = {
    context, text: finalText, decisionInput: { text, start: 0, end: text.length },
    reason: "unsupported-performance", performanceId: "none", attentionTargetId: "unknown", latencyMs: 12
  };
  assert.deepEqual(await motion.finalize(key, { text: finalText }), { kind: "saved", path: "fixture.json" });
  assert.deepEqual(records, [{
    snapshot: { ...section, ...recordFields, finalPlaybackState: "superseded" }, status: "pending"
  }]);

  const late = motion.finalize(following, { text: finalText });
  assert.equal(records.length, 1);
  await motion.finish(following);
  judgeReplies[1].resolve(none);
  assert.deepEqual(await late, { kind: "saved", path: "fixture.json" });
  assert.deepEqual(records[1], {
    snapshot: { ...following, ...recordFields, finalPlaybackState: "playing" }, status: "ended"
  });
});

test("persists a captured section interrupted before motion decision or audio enqueue", async () => {
  const stored = Promise.withResolvers();
  const motion = createSpeechIntentMotion({
    channel: { sendMotion() { assert.fail("no request before playback"); } },
    getCatalog() { assert.fail("no catalog needed"); },
    async recordSection(record) {
      stored.resolve(record);
      return "fixture.json";
    }
  });
  const delivery = createSpeechIntentDelivery({ motion, ...section, trace() {} });
  delivery.tag("言いかけた意図", "<intent 言いかけた意図>");
  delivery.interrupt();
  delivery.text("まだ本文の途中");
  delivery.close();
  delivery.close();
  delivery.retire();
  const recorded = await stored.promise;
  assert.equal(recorded.text, "まだ本文の途中");
  assert.equal(recorded.rawIntentTag, "<intent 言いかけた意図>");
  assert.deepEqual(recorded.context, section.context);
  assert.equal(recorded.decisionInput, null);
  assert.deepEqual(recorded.decision, { kind: "undecided", reason: "interrupted-before-decision" });
  assert.equal(recorded.finalPlaybackState, "interrupted-before-start");
  assert.deepEqual(recorded.motionPlayback, { result: "not-requested", reason: null, visibility: "unobserved", requests: [] });
  assert.deepEqual(recorded.audioPlayback, { ranges: [{ start: 0, end: 7, state: "not-enqueued" }] });
});

test("records an ambiguous play reply and preserves the version from the decision's connection", async () => {
  const recordWritten = Promise.withResolvers();
  const playSent = Promise.withResolvers();
  const reply = Promise.withResolvers();
  const oldDefinition = { sha256: "a".repeat(64), status: "pending" };
  const newDefinition = { sha256: "b".repeat(64), status: "saved" };
  const withArchive = (entry) => ({
    ...catalog,
    definitionArchive: { directory: "archive", definitions: { ask: entry } },
    pairs: catalog.pairs.map((pair) => ({ ...pair, clipId: "fixture-clip" }))
  });
  let advertised = withArchive(oldDefinition);
  const motion = createSpeechIntentMotion({
    getCatalog: () => advertised,
    channel: {
      sendMotion({ op }) {
        if (op !== "play") return Promise.resolve({ result: "accepted" });
        playSent.resolve();
        return reply.promise;
      }
    },
    async judge() {
      return { answers: answers(answer("ask"), answer("partner")) };
    },
    async recordSection(record) { recordWritten.resolve(record); return "fixture.json"; }
  });
  await motion.prepare(section);
  motion.start(section);
  await playSent.promise;
  await motion.finish(section);
  const finalized = motion.finalize(section, { text: section.text });
  assert.strictEqual(motion.finalize(section, { text: "duplicate" }), finalized);
  advertised = withArchive(newDefinition);
  await motion.retire();
  reply.reject(Object.assign(new Error("fixture connection loss"), { code: "channel_closed" }));
  assert.deepEqual(await finalized, { kind: "saved", path: "fixture.json" });
  const record = await recordWritten.promise;
  assert.deepEqual(record.definition, {
    sha256: oldDefinition.sha256, archiveStatus: "pending", archiveDirectory: "archive", clipId: "fixture-clip"
  });
  assert.equal(record.text, section.text);
  assert.deepEqual(record.motionPlayback, {
    result: "failure", reason: "channel_closed", visibility: "unobserved",
    requests: [{ op: "begin", status: "accepted", reason: undefined },
      { op: "play", status: "reply-unknown", reason: "channel_closed" },
      { op: "end", status: "accepted", reason: undefined }]
  });
});

test("preserves a known performance version for an unproduced pair and handles legacy hello", async () => {
  const recorded = [];
  const sha256 = "c".repeat(64);
  const versions = [
    { catalog: { ...catalog, definitionArchive: { directory: "archive", definitions: { ask: { sha256, status: "failed" } } } },
      definition: { sha256, archiveDirectory: "archive", archiveStatus: "failed", clipId: null } },
    { catalog, definition: { sha256: null, archiveDirectory: null, archiveStatus: "unavailable", clipId: null } }
  ];
  for (const [index, item] of versions.entries()) {
    const motion = createSpeechIntentMotion({
      channel: { async sendMotion() { return { result: "accepted" }; } },
      getCatalog: () => item.catalog,
      async judge() { return { answers: answers(answer("ask"), answer("viewers")) }; },
      async recordSection(record) { recorded.push(record); return "fixture.json"; }
    });
    const current = { ...section, sectionIndex: index };
    await motion.prepare(current);
    await motion.finalize(current, { text: current.text });
    assert.deepEqual(recorded[index].definition, item.definition);
    assert.equal(recorded[index].decision.reason, "unproduced-pair");
  }
});

test("all-section recorder publishes a single complete file for concurrent duplicate records", async () => {
  const directory = await mkdtemp(join(tmpdir(), "all-motion-recording-"));
  try {
    const write = createSpeechIntentSectionRecorder({ directory });
    const record = { ...section, decision: { kind: "selected" } };
    const [path, duplicate] = await Promise.all([write(record), write(record)]);
    assert.equal(path, duplicate);
    assert.equal((await readdir(directory)).length, 1);
    const { recordedAt, ...stored } = JSON.parse(await readFile(path, "utf8"));
    assert.ok(Number.isFinite(Date.parse(recordedAt)));
    assert.deepEqual(stored, { version: 1, ...record });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
