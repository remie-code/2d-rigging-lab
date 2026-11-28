import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createIncrementalSentenceTagBuffer } from "./incremental-sentence-tag-buffer.mjs";
import { createSpeechIntentSectionRecorder } from "./speech-intent-section-recorder.mjs";
import { createDecisionsQuestionsJudge } from "./speak-now-decisions.mjs";
import {
  createSpeechSentenceMotionInput,
  createSpeechSentenceMotionRecorder,
  decideSpeechSentenceMotion
} from "./speech-sentence-motion.mjs";

const catalog = {
  performances: { receive: "納得", surprise: "驚き" },
  attentionTargets: { game: "ゲーム画面", partner: "話し相手" },
  pairs: [{ performanceId: "receive", attentionTargetId: "game", clipId: "receive-game" }],
  definitionArchive: {
    directory: "archive",
    definitions: { receive: { sha256: "definition-hash", status: "saved" } }
  }
};

function choose(performanceId, attentionTargetId) {
  return async ({ questions }) => ({
    answers: {
      [questions[0].name]: { type: "choice", choice: performanceId },
      [questions[1].name]: { type: "choice", choice: attentionTargetId }
    },
    latencyMs: 5
  });
}

test("each judge request identifies its own completed sentence and only earlier reply sentences", async () => {
  const recentConversation = [{ speaker: "配信者", text: "さっきの攻撃力を見て" }];
  const buildInput = createSpeechSentenceMotionInput({ recentConversation, gameScreenShared: true });
  recentConversation[0].text = "後から更新された会話";
  const buffer = createIncrementalSentenceTagBuffer();
  const first = "料理が効いてるね。";
  const second = "お、今の一撃…！";
  const judgeCalls = [];
  const judge = async (request) => {
    judgeCalls.push(request);
    return choose("receive", "game")(request);
  };
  const decisions = buffer.append(first + second).sentences.map((sentence) =>
    decideSpeechSentenceMotion(buildInput(sentence), judge, catalog));
  await Promise.all(decisions);
  assert.deepEqual(judgeCalls.map(({ input }) => JSON.parse(input)), [
    { sentence: first, recentConversation: [{ speaker: "配信者", text: "さっきの攻撃力を見て" }], precedingSentences: [] },
    { sentence: second, recentConversation: [{ speaker: "配信者", text: "さっきの攻撃力を見て" }], precedingSentences: [first] }
  ]);
  for (const { questions } of judgeCalls) {
    assert.equal(questions.length, 2);
    assert.ok(questions.every(({ instructions }) => instructions.includes("演じるのは sentence の一文")));
    assert.deepEqual(questions.map(({ choices }) => choices.map(({ value }) => value)), [
      ["receive", "surprise", "none"], ["game", "partner", "unknown"]
    ]);
  }
});

test("the Decisions payload caches only the stable performance catalog and versions it by content", async () => {
  const sent = [];
  const judge = createDecisionsQuestionsJudge({
    apiKeyProvider: () => ({ ok: true, apiKey: "fixture" }),
    async fetchImpl(_url, { body }) {
      sent.push(JSON.parse(body));
      return Response.json({ answers: [
        { name: "speech_sentence_performance", type: "choice", choice: "receive" },
        { name: "speech_sentence_attention", type: "choice", choice: "game" }
      ] });
    }
  });
  const recentConversation = [{ speaker: "配信者", text: "架空の会話" }];
  const buildInput = createSpeechSentenceMotionInput({ recentConversation, gameScreenShared: true });
  const first = "これは最初の文。";
  const second = "これは次の文。";
  const inputs = [buildInput(first), buildInput(second)];
  for (const [index, performances] of [catalog.performances, { surprise: "驚き", receive: "納得" },
    { receive: "深い納得", surprise: "驚き" }, { ...catalog.performances, search: "探索" }, { receive: "納得" }].entries()) {
    assert.equal((await decideSpeechSentenceMotion(inputs[index === 0 ? 0 : 1], judge, { ...catalog, performances })).kind, "selected");
  }
  assert.equal(sent.length, 5);
  const [initial, reordered, updated, added, removed] = sent;
  assert.deepEqual(initial.prompt_cache_options, { mode: "explicit", ttl: "30m" });
  assert.match(initial.prompt_cache_key, /^chappy-motion-[0-9a-f]{32}$/);
  assert.deepEqual(initial.input[0], { role: "developer", content: [{ type: "input_text",
    text: '演技候補の定義（各行は選択値とその意味）\nreceive\t"納得"\nsurprise\t"驚き"\nnone\t"どの演技にも明確に当てはまらない。"',
    prompt_cache_breakpoint: { mode: "explicit" } }] });
  assert.deepEqual(reordered.input[0], initial.input[0]);
  assert.equal(reordered.prompt_cache_key, initial.prompt_cache_key);
  for (const request of [updated, added, removed]) {
    assert.notDeepEqual(request.input[0], initial.input[0]);
    assert.notEqual(request.prompt_cache_key, initial.prompt_cache_key);
  }
  for (const [index, request] of [initial, reordered].entries()) {
    const [prefix, dynamic] = request.input;
    assert.equal(request.input.length, 2);
    assert.equal(dynamic.role, "user");
    assert.deepEqual(JSON.parse(dynamic.content), { sentence: [first, second][index], recentConversation,
      precedingSentences: index === 0 ? [] : [first] });
    assert.ok(!prefix.content[0].text.includes(recentConversation[0].text));
    assert.deepEqual(request.questions.map(({ name }) => name), ["speech_sentence_performance", "speech_sentence_attention"]);
    assert.deepEqual(request.questions[0].choices, [{ value: "receive" }, { value: "surprise" }, { value: "none" }]);
    assert.deepEqual(request.questions[1].choices, [{ value: "game", description: "ゲーム画面" },
      { value: "partner", description: "話し相手" }, { value: "unknown", description: "この一文の対象を特定できない。" }]);
  }
});

test("decision preserves raw choices and fills only unknown attention for a recognized performance during sharing", async () => {
  const cases = [
    [true, "receive", "unknown", "selected", undefined, "game"],
    [false, "receive", "unknown", "unsupported", "unknown-attention-target", null],
    [true, "surprise", "unknown", "unsupported", "unproduced-pair", "game"],
    [true, "receive", "partner", "unsupported", "unproduced-pair", "partner"],
    [true, "none", "unknown", "unsupported", "unsupported-performance", null]
  ];
  for (const [gameScreenShared, performanceId, attentionTargetId, kind, reason, effectiveAttentionTargetId] of cases) {
    const input = createSpeechSentenceMotionInput({ recentConversation: [], gameScreenShared })("本当だ。");
    const result = await decideSpeechSentenceMotion(input, choose(performanceId, attentionTargetId), catalog);
    assert.deepEqual(result, { kind, ...(reason ? { reason } : {}),
      performanceId, attentionTargetId, effectiveAttentionTargetId, latencyMs: 5 });
  }
});

test("sentence records retain the input, raw decision, chosen definition and playback beside readable old sections", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "speech-sentence-motion-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const identity = { sceneId: "s", utteranceId: "u", generation: 1, sectionId: "u:0", sectionIndex: 0 };
  const oldSection = { ...identity, text: "旧記録。", intent: "納得" };
  const oldPath = await createSpeechIntentSectionRecorder({ directory })(oldSection);
  const oldBefore = await readFile(oldPath, "utf8");

  const decisionInput = createSpeechSentenceMotionInput({ recentConversation: [], gameScreenShared: true })("そうだね。");
  const decision = await decideSpeechSentenceMotion(decisionInput, choose("receive", "unknown"), catalog);
  const motionPlayback = { result: "accepted", visibility: "unobserved", requests: [{ op: "play", status: "accepted" }] };
  const audioPlayback = { result: "ended" };
  const section = { ...identity, sectionId: "u:1", sectionIndex: 1, decisionInput, decision, catalog,
    audioPlayback, motionPlayback };
  const path = await createSpeechSentenceMotionRecorder({ directory })(section);
  assert.equal(await readFile(oldPath, "utf8"), oldBefore);
  const { recordedAt: oldTime, ...oldRecord } = JSON.parse(oldBefore);
  assert.ok(oldTime);
  assert.deepEqual(oldRecord, { version: 1, ...oldSection });
  const { recordedAt, ...record } = JSON.parse(await readFile(path, "utf8"));
  assert.ok(recordedAt);
  assert.deepEqual(record, {
    ...identity, sectionId: "u:1", sectionIndex: 1, version: 2, kind: "sentence", text: "そうだね。",
    decisionInput, decision, audioPlayback, motionPlayback,
    definition: { sha256: "definition-hash", archiveDirectory: "archive", archiveStatus: "saved", clipId: "receive-game" }
  });
});
