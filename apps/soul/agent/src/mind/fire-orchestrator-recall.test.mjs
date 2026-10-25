// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createFireOrchestrator, PROGRESSIVE_CONTINUITY_INSTRUCTION } from "./fire-orchestrator.mjs";
import { createTranscriptBuffer } from "../ears/transcript-buffer.mjs";
import { createSpeechStreamer } from "../voice/speech-streamer.mjs";
import { createFakeStreamPlayer } from "../test-support/fake-stream-player.mjs";
import { createFakeVoiceEngine, defaultFakeChunks } from "../test-support/fake-voice-engine.mjs";
import { NG_WORDS } from "./ng-words.mjs";

// 発火オーケストレータの思い出しの目印と黙って渡す前置き（記憶の作り直し Wave 3 Domain D）。
// 本物の頭・本物の声は使わない（fake session・fake speak・fake player）。

function makeFakeSpeak() {
  const spoken = [];
  return {
    spoken,
    speakImpl: async (text) => {
      spoken.push(text);
      return { timeline: [], rttMs: 0, wavDurationSec: 0, wavPath: "C:/tmp/fake.wav" };
    }
  };
}

const fakeChannel = { sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 0 }) };
const fakePlayer = { play() {} };

function bufferWithYou(text = "前回どこまで行ったっけ") {
  const buffer = createTranscriptBuffer();
  buffer.append({ startMs: 100, endMs: 900, text });
  return buffer;
}

/** @param {(input: any, askOptions: any) => any} ask @param {object} [extra] */
function makeOrch(ask, extra = {}) {
  const fakeSpeak = makeFakeSpeak();
  const recalls = [];
  const states = [];
  const buffer = bufferWithYou();
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { ask },
    speakImpl: fakeSpeak.speakImpl,
    channel: fakeChannel,
    player: fakePlayer,
    onState: (s) => states.push(s),
    onRecallRequest: (info) => recalls.push({ ...info, stateAtEmit: orch.getState() }),
    ...extra
  });
  return { orch, fakeSpeak, recalls, buffer, states };
}

test("一括: <recall> は声にも会話ログにも出さず、返事が終わったあと（idle）に頼みごとを渡す", { timeout: 5000 }, async () => {
  const { orch, fakeSpeak, recalls, buffer } = makeOrch(async () => ({
    replyText: "ちょっと記録見てくるね<recall エルデンリング 前回どこまで>"
  }));
  const result = await orch.fire();
  assert.equal(result.fired, true);
  assert.deepEqual(fakeSpeak.spoken, ["ちょっと記録見てくるね"]);
  const soul = buffer.all().filter((e) => e.speaker === "soul");
  assert.deepEqual(soul.map((e) => e.text), ["ちょっと記録見てくるね"]);
  assert.deepEqual(recalls, [{ request: "エルデンリング 前回どこまで", fireId: result.fireId, stateAtEmit: "idle" }]);
  orch.dispose();
});

test("一括: 目印が 2 つなら 2 回渡す・目印なしなら渡さない・空の頼みは渡さない", { timeout: 5000 }, async () => {
  const replies = ["見てくる<recall A><recall B>", "うん", "見てくる<recall>"];
  const { orch, recalls } = makeOrch(async () => ({ replyText: replies.shift() }));
  await orch.fire();
  await orch.fire();
  await orch.fire();
  assert.deepEqual(recalls.map((r) => r.request), ["A", "B"]);
  orch.dispose();
});

test("逐次: delta で読んだ tags から目印を拾う（最後の replyText に無くても逐次の部品が読んだものを使う）", { timeout: 5000 }, async () => {
  const { orch, recalls } = makeOrch(async (_input, askOptions) => {
    askOptions.onTextDelta("見てくる。<rec");
    askOptions.onTextDelta("all 前回の");
    askOptions.onTextDelta(" ボス>");
    // 逐次の部品が拾ったことを確かめるため、最後の replyText には目印を入れない。
    return { replyText: "見てくる。" };
  });
  const result = await orch.fire();
  assert.equal(result.fired, true);
  assert.deepEqual(recalls.map((r) => r.request), ["前回の ボス"]);
  orch.dispose();
});

test("逐次（本物の運び手）: 文ごとの読み上げでも目印は声に出ず、鳴り終わったあとに渡す", { timeout: 5000 }, async () => {
  const player = createFakeStreamPlayer();
  const engine = createFakeVoiceEngine({ synthesizeImpl: (text) => (async function* () { yield* defaultFakeChunks(text); })() });
  const recalls = [];
  const buffer = bufferWithYou();
  const accepted = async () => ({ result: "accepted", error: null, rttMs: 1 });
  const orch = createFireOrchestrator({
    getBuffer: () => buffer,
    session: {
      async ask(_input, askOptions) {
        askOptions.onTextDelta("見てくる。");
        askOptions.onTextDelta("<recall 前回");
        askOptions.onTextDelta("のボス>");
        return { replyText: "見てくる。<recall 前回のボス>" };
      }
    },
    channel: { openSpeech: accepted, appendSpeech: accepted, endSpeech: accepted, sendSet: accepted },
    player,
    progressivePlayback: true,
    speechStreamerFactory: (options) => createSpeechStreamer({ ...options, engine }),
    onRecallRequest: (info) => recalls.push(info)
  });
  const firePromise = orch.fire();
  for (let i = 0; i < 10 && player.opened.length === 0; i += 1) await new Promise((r) => setImmediate(r));
  assert.equal(player.opened.length, 1);
  assert.equal(recalls.length, 0, "鳴り終わる前には渡さない");
  player.emitFor("started", 0);
  player.emitFor("ended", 0);
  const result = await firePromise;
  assert.equal(result.fired, true);
  assert.equal(result.replyText, "見てくる。");
  assert.deepEqual(recalls.map((r) => r.request), ["前回のボス"]);
  orch.dispose();
});

test("渡さない返事: ask の失敗・NG で没・in-flight のキル", { timeout: 5000 }, async () => {
  // ask の失敗。
  const failed = makeOrch(async (_input, askOptions) => {
    askOptions.onTextDelta("見てくる。<recall A>\n");
    throw new Error("turn failed");
  });
  assert.equal((await failed.orch.fire()).reason, "error");
  assert.deepEqual(failed.recalls, []);
  failed.orch.dispose();

  // NG で没。
  const ng = makeOrch(async () => ({ replyText: `${NG_WORDS[0]}<recall A>` }));
  assert.equal((await ng.orch.fire()).reason, "ng-blocked");
  assert.deepEqual(ng.recalls, []);
  ng.orch.dispose();

  // ask の後にキル。
  /** @type {any} */
  let orchRef = null;
  const killedCase = makeOrch(async () => {
    await orchRef.kill();
    return { replyText: "見てくる<recall A>" };
  });
  orchRef = killedCase.orch;
  assert.equal((await killedCase.orch.fire()).reason, "killed-inflight");
  assert.deepEqual(killedCase.recalls, []);
  killedCase.orch.dispose();
});

test("deferInstruction: 次の ask の先頭に 1 回だけ黙って前置きし、会話ログには残らない", { timeout: 5000 }, async () => {
  const inputs = [];
  const { orch, buffer } = makeOrch(async (input) => {
    inputs.push(input);
    return { replyText: "うん" };
  });
  assert.equal(orch.deferInstruction("[内部の会話継続情報: 記録の要約]"), true);
  assert.equal(orch.deferInstruction("   "), false, "空は積まない");
  await orch.fire();
  await orch.fire();
  assert.ok(inputs[0].startsWith("[内部の会話継続情報: 記録の要約]\n\n"), "1 回目の ask の先頭");
  assert.ok(!inputs[1].includes("記録の要約"), "2 回目には付かない");
  assert.ok(!buffer.all().some((e) => e.text.includes("記録の要約")), "会話ログには残らない");
  orch.dispose();
  assert.equal(orch.deferInstruction("x"), false, "dispose 後は積まない");
});

test("deferInstruction: この 1 発の指示（fire({instruction})）より前・progressive correction より後ろ、上限 3 件", { timeout: 5000 }, async () => {
  const inputs = [];
  const { orch } = makeOrch(async (input) => {
    inputs.push(input);
    return { replyText: "うん" };
  });
  for (const n of [1, 2, 3, 4]) orch.deferInstruction(`note${n}`);
  await orch.fire({ instruction: "[内部の指示: 思い出しの結果]" });
  const text = inputs[0];
  assert.ok(!text.includes("note1"), "古い方から捨てる");
  assert.ok(text.indexOf("note2") < text.indexOf("note4"));
  assert.ok(text.indexOf("note4") < text.indexOf("[内部の指示: 思い出しの結果]"));
  assert.ok(!text.includes(PROGRESSIVE_CONTINUITY_INSTRUCTION));
  orch.dispose();
});
