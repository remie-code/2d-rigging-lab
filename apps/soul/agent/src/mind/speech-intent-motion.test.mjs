import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadDistributionSpeechMotionCatalog } from "../test-support/distribution-speech-motion-catalog.mjs";
const catalog = await loadDistributionSpeechMotionCatalog();

import { createSpeechIntentMotion, decideSpeechIntentMotion } from "./speech-intent-motion.mjs";
import { createSpeechIntentNoneRecorder } from "./speech-intent-none-recorder.mjs";

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
