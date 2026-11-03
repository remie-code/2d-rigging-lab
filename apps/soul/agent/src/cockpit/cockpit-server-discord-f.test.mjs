// @ts-check
/**
 * Discord モード Domain F: Discord の判定と言葉が場の段で効くこと（discord-mode.md §8・§3.4・scope §22・§23）— cockpit-server の側。
 *
 *  - Discord の場では話し始めを speak-now に固定する（ロールの方式が「従来」でも判定で話し始める・ロールの方式は書き換えない）。
 *    方式の切り替え（POST /api/speak-start）は Discord の場の間は 409 で断る（何も変えない）。配信は今まで通りロールの方式。
 *  - Discord の場では自発の発火の予定（沈黙・区切り・合いの手・呼びかけ）を作らない: 予定を作り直さず、タイマが 1 本も張られない。
 *    自発のつまみは「判定で話し始めるかどうか」の ON/OFF として効く。配信は今まで通り予定を作る（沈黙のタイマが張られる）。
 *  - 名前を呼ばれても器は判定を飛ばさない（判定が待つなら発火しない）。
 *  - snapshot: Discord の場の間は speakStart = "speak-now"・speakStartFixed = true。配信は speakStart = ロールの方式・
 *    speakStartFixed = false。
 *  - 判定の組と語の組: Discord の体験の口（createDiscordExperience）の言葉で speak-now・「避けるか」・④が組まれる。
 * 本物の server・loopback の HTTP・偽の耳 / orchestrator / 体験の口・本物の発火の予定（偽の時計）だけ。実データ・本物の LLM・
 * 外部 API・Discord には触れない（createDiscordExperience は作るだけで開かない・鍵の口も差し替える）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createCockpitServer, normalizeVenueExperience, DISCORD_SPEAK_START_FIXED_MESSAGE } from "./cockpit-server.mjs";
import { createFireScheduler } from "../mind/fire-scheduler.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";
import { CALL_WORDING } from "../mind/venue-wording.mjs";
import {
  DISCORD_SPEAK_NOW_QUESTIONS,
  SPEAK_NOW_BACKCHANNEL_INSTRUCTION,
  buildDiscordSpeakNowChoices,
  buildDiscordSpeakNowInstructions,
  buildSpeakNowInstructions
} from "../mind/speak-now.mjs";
import {
  DISCORD_RECALL_AVOID_QUESTIONS,
  RECALL_AVOID_QUESTION_NAME,
  buildDiscordRecallAvoidInstructions,
  buildRecallAvoidInstructions
} from "../mind/recall.mjs";
import { createDiscordExperience } from "../discord/discord-experience.mjs";
import { createFakeClock } from "../test-support/fake-clock.mjs";

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

/** @param {() => boolean} pred @param {number} [timeoutMs] */
async function waitUntil(pred, timeoutMs = 2000) {
  const until = Date.now() + timeoutMs;
  while (!pred()) {
    if (Date.now() > until) throw new Error("waitUntil timed out");
    await tick(5);
  }
}

/** @param {string} url @param {string} path @param {unknown} [body] */
async function post(url, path, body = {}) {
  const r = await fetch(`${url}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: /** @type {any} */ (await r.json()) };
}

/** @param {string} url */
async function state(url) {
  const r = await fetch(`${url}/api/state`);
  return /** @type {any} */ (await r.json());
}

/** Discord の体験の口の言葉と判定の組（本物の createDiscordExperience が置くもの。開かない・鍵は読まない）。 */
function realDiscordWords() {
  const real = createDiscordExperience({
    settings: { getDiscordPrep: () => ({}), setDiscordPrep() {} },
    loadToken: () => ({ ok: false, reason: "テストでは鍵を読まない" }),
    loadLibraries: async () => {
      throw new Error("テストでは Discord の部品を読み込まない");
    }
  });
  return { wording: real.wording, teaching: real.teaching, judgeSet: real.judgeSet };
}

/** 偽の耳（配信のマイクの耳）。 */
function makeEars() {
  const record = { /** @type {any} */ options: null };
  const factory = (/** @type {any} */ options) => {
    record.options = options;
    return {
      transcriptBuffer: options.transcriptBuffer,
      async start() {},
      async dispose() {},
      isDisposed: () => false,
      streamMs: () => 0,
      stats: () => ({})
    };
  };
  /** @param {string} text */
  const hear = (text) => {
    const r = record.options.transcriptBuffer.append({ startMs: 0, endMs: 900, text });
    if (r.appended) record.options.onTranscript(r.entry, { latencyMs: 50, audioCtx: null });
  };
  return { factory, record, hear };
}

/** 偽の orchestrator（fire の呼び出しを記録する）。 */
function makeOrchestrator() {
  const record = { /** @type {any} */ hooks: null, /** @type {any[]} */ fires: [] };
  const factory = (/** @type {any} */ hooks) => {
    record.hooks = hooks;
    return {
      async fire(/** @type {any} */ options) {
        record.fires.push(options);
        return { fired: true, fireId: record.fires.length };
      },
      getState: () => "idle",
      async kill() {
        return { killed: true, severed: false };
      },
      revive() {},
      getKilled: () => false,
      async interrupt() {
        return { interrupted: true };
      },
      deferInstruction: () => true,
      dispose() {}
    };
  };
  return { factory, record };
}

/**
 * 本物の発火の予定（偽の時計）。作った数と、そのときの speakNowMode を記録する。
 * @param {ReturnType<typeof createFakeClock>} clock
 */
function makeRealScheduler(clock) {
  const record = { created: 0, /** @type {boolean[]} */ speakNowModes: [], /** @type {any[]} */ requests: [] };
  const factory = (/** @type {any} */ options) => {
    record.created += 1;
    record.speakNowModes.push(options.speakNowMode === true);
    return createFireScheduler({
      ...options,
      onFireRequest: (/** @type {any} */ req) => {
        record.requests.push(req);
        options.onFireRequest(req);
      },
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl,
      nowImpl: clock.now,
      rng: () => 0
    });
  };
  return { factory, record };
}

/** ロールの束の偽物（④は見つかった結果を返す）。 @param {any[]} jobs */
function makeRole(jobs) {
  return {
    id: () => "chappy",
    identity: () => MODEL_IDENTITIES.chappy,
    hooks: {},
    voice: { prepare: () => ({ ok: true }), startResources: () => {} },
    recall: {
      run: (/** @type {any} */ job) => {
        jobs.push(job);
        return Promise.resolve({ found: true, summary: "火山館まで" });
      }
    }
  };
}

/**
 * Discord の体験の口の偽物（人 2 人の耳・VAD の口つき）。言葉と判定の組は本物の Discord の口のもの。
 */
function makeDiscordMouth() {
  /** @type {any} */
  const record = { people: {} };
  const mouth = {
    prepareEntrance: () => ({ ok: true, plan: null, voiceKind: "aivis" }),
    openEntrance: async (/** @type {any} */ _plan, /** @type {any} */ venue) => {
      const ears = venue.createEars();
      const mouthFor = venue.earTranscriptMouth({ engine: "discord-stt" });
      for (const [key, name] of /** @type {const} */ ([["p1", "たろう"], ["p2", "はなこ"]])) {
        const person = {
          vad: ears.vadMouth(key),
          async start() {},
          async dispose() {},
          /** @param {string} text */
          hear(text) {
            const r = venue.transcriptBuffer.append({ startMs: 0, endMs: 900, text, displayName: name, speakerId: `fake-id-${key}` });
            if (r.appended) mouthFor(r.entry, { latencyMs: 10, audioCtx: null });
          }
        };
        ears.add(key, person);
        record.people[key] = person;
      }
      await ears.start();
      return { ok: true, ears };
    },
    closeEntrance: () => {},
    ...realDiscordWords()
  };
  return { mouth, record };
}

/**
 * @param {{ speakStartModeInitial?: "classic" | "speak-now"; selfFireInitialEnabled?: boolean; answers?: string[] }} [p]
 */
async function startServer(p = {}) {
  const clock = createFakeClock();
  const ears = makeEars();
  const orchestrator = makeOrchestrator();
  const scheduler = makeRealScheduler(clock);
  const discord = makeDiscordMouth();
  /** @type {any[]} */
  const jobs = [];
  /** @type {any[]} */
  const judgeRequests = [];
  /** @type {any[]} */
  const recallJudgeRequests = [];
  /** @type {string[]} */
  const answers = p.answers ?? [];
  /** @type {string[]} */
  const savedSpeakStart = [];
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    fireOrchestratorFactory: /** @type {any} */ (orchestrator.factory),
    fireSchedulerFactory: /** @type {any} */ (scheduler.factory),
    commentGuard: () => ({ pass: true, kind: "ok" }),
    roles: [makeRole(jobs)],
    speakStartModeInitial: p.speakStartModeInitial ?? "classic",
    selfFireInitialEnabled: p.selfFireInitialEnabled ?? true,
    onSetSpeakStartMode: (/** @type {string} */ mode) => void savedSpeakStart.push(mode),
    speakNowJudge: async (/** @type {any} */ request) => {
      judgeRequests.push(request);
      const choice = answers.shift() ?? "wait";
      return { choice, probs: { [choice]: 0.9 }, latencyMs: 5 };
    },
    recallJudge: async (/** @type {any} */ request) => {
      recallJudgeRequests.push(request);
      return { answers: { [RECALL_AVOID_QUESTION_NAME]: { type: "predicate", probability: 0.1 } } };
    },
    backchannelMinIntervalMs: 0,
    experiences: { discord: discord.mouth }
  });
  const url = await server.listen(0);
  return { server, url, clock, ears, orchestrator, scheduler, discord, jobs, judgeRequests, recallJudgeRequests, answers, savedSpeakStart };
}

// ── 1. 体験の口 ────────────────────────────────────────────────────────────

test("Domain F 体験の口: Discord の口は通話の語の組・Discord の教え・Discord の判定の組（speakNow / recallAvoid）を持ち、場の形の確かめを通る", () => {
  const words = realDiscordWords();
  assert.equal(words.wording, CALL_WORDING);
  assert.equal(words.teaching, "venue-discord");
  assert.equal(words.judgeSet.speakNow, DISCORD_SPEAK_NOW_QUESTIONS);
  assert.equal(words.judgeSet.recallAvoid, DISCORD_RECALL_AVOID_QUESTIONS);
  const normalized = normalizeVenueExperience("discord", makeDiscordMouth().mouth);
  assert.deepEqual(normalized?.wording, CALL_WORDING);
  assert.equal(normalized?.teaching, "venue-discord");
  assert.deepEqual({ ...normalized?.judgeSet?.speakNow }, { ...DISCORD_SPEAK_NOW_QUESTIONS });
  assert.deepEqual({ ...normalized?.judgeSet?.recallAvoid }, { ...DISCORD_RECALL_AVOID_QUESTIONS });
});

// ── 2. speak-now に固定・snapshot・方式の切り替え ────────────────────────────

test("Domain F 固定: ロールの方式が「従来」でも Discord の場では判定で話し始める（Discord の問い）・配信に戻ると「従来」のまま（判定しない）", async () => {
  const h = await startServer({ speakStartModeInitial: "classic", answers: ["respond"] });
  try {
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    h.discord.record.people.p1.hear("ねえ、どう思う？");
    await waitUntil(() => h.orchestrator.record.fires.length === 1);
    assert.equal(h.judgeRequests.length, 1);
    assert.equal(h.judgeRequests[0].instructions, buildDiscordSpeakNowInstructions({ name: "チャッピー", verbosity: "normal" }));
    assert.deepEqual(h.judgeRequests[0].choices, buildDiscordSpeakNowChoices("チャッピー"));
    assert.equal(h.judgeRequests[0].input, "参加者(たろう): ねえ、どう思う？");
    assert.equal(h.orchestrator.record.fires[0].cause.type, "speak-now");
    await post(h.url, "/api/stream/stop");

    assert.equal((await post(h.url, "/api/stream/start", { device: "Mic" })).status, 200);
    h.ears.hear("配信の発言");
    await tick(30);
    assert.equal(h.judgeRequests.length, 1, "配信はロールの方式（従来）のまま判定しない");
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.server.close();
  }
});

test("Domain F 固定: 相槌は Discord の相槌の指示で発火する・配信（speak-now）は今の指示", async () => {
  const h = await startServer({ speakStartModeInitial: "speak-now", answers: ["backchannel", "backchannel"] });
  try {
    await post(h.url, "/api/stream/start", { experience: "discord" });
    h.discord.record.people.p2.hear("それでさ");
    await waitUntil(() => h.orchestrator.record.fires.length === 1);
    assert.equal(h.orchestrator.record.fires[0].instruction, DISCORD_SPEAK_NOW_QUESTIONS.backchannelInstruction);
    await post(h.url, "/api/stream/stop");
    await post(h.url, "/api/stream/start", { device: "Mic" });
    h.ears.hear("それでね");
    await waitUntil(() => h.orchestrator.record.fires.length === 2);
    assert.equal(h.orchestrator.record.fires[1].instruction, SPEAK_NOW_BACKCHANNEL_INSTRUCTION);
    assert.equal(h.judgeRequests[1].instructions, buildSpeakNowInstructions({ name: "チャッピー", verbosity: "normal" }));
  } finally {
    await h.server.close();
  }
});

test("Domain F snapshot: Discord の場は speakStart = speak-now・speakStartFixed = true／配信と閉じている間はロールの方式・false", async () => {
  const h = await startServer({ speakStartModeInitial: "classic" });
  try {
    let s = await state(h.url);
    assert.equal(s.speakStart, "classic");
    assert.equal(s.speakStartFixed, false);
    const opened = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal(opened.json.speakStart, "speak-now");
    assert.equal(opened.json.speakStartFixed, true);
    s = await state(h.url);
    assert.equal(s.speakStart, "speak-now");
    assert.equal(s.speakStartFixed, true);
    const stopped = await post(h.url, "/api/stream/stop");
    assert.equal(stopped.json.speakStart, "classic", "閉じたらロールの方式に戻る（ロールの方式は書き換えていない）");
    assert.equal(stopped.json.speakStartFixed, false);
    const stream = await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.equal(stream.json.speakStart, "classic");
    assert.equal(stream.json.speakStartFixed, false);
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.server.close();
  }
});

test("Domain F 方式の切り替え: Discord の場の間の POST /api/speak-start は 409（固定の文面）で何も変えず保存もしない・閉じれば今まで通り替えられる", async () => {
  const h = await startServer({ speakStartModeInitial: "classic" });
  try {
    await post(h.url, "/api/stream/start", { experience: "discord" });
    const refused = await post(h.url, "/api/speak-start", { mode: "classic" });
    assert.equal(refused.status, 409);
    assert.equal(refused.json.error, DISCORD_SPEAK_START_FIXED_MESSAGE);
    assert.equal(refused.json.state.speakStart, "speak-now");
    assert.deepEqual(h.savedSpeakStart, [], "ロールの保存値を書かない");
    await post(h.url, "/api/stream/stop");
    // 配信の場の間は今まで通りの 409（配信の文面）。
    await post(h.url, "/api/stream/start", { device: "Mic" });
    const streamRefused = await post(h.url, "/api/speak-start", { mode: "speak-now" });
    assert.equal(streamRefused.status, 409);
    assert.notEqual(streamRefused.json.error, DISCORD_SPEAK_START_FIXED_MESSAGE);
    await post(h.url, "/api/stream/stop");
    // 閉じている間は替えられる（今まで通り）。
    const changed = await post(h.url, "/api/speak-start", { mode: "speak-now" });
    assert.equal(changed.status, 200);
    assert.equal(changed.json.speakStart, "speak-now");
    assert.deepEqual(h.savedSpeakStart, ["speak-now"]);
  } finally {
    await h.server.close();
  }
});

// ── 3. 自発の発火の予定を作らない ─────────────────────────────────────────────

test("Domain F 予定: 配信は今まで通り発火の予定を作り直し、沈黙のタイマが張られる（従来・speak-now のどちらでも）", async () => {
  for (const mode of /** @type {const} */ (["classic", "speak-now"])) {
    const h = await startServer({ speakStartModeInitial: mode });
    try {
      const before = h.scheduler.record.created;
      assert.equal(h.clock.pending().length, 0, "閉じている間は張らない（今まで通り）");
      await post(h.url, "/api/stream/start", { device: "Mic" });
      assert.equal(h.scheduler.record.created, before + 1, mode);
      assert.equal(h.scheduler.record.speakNowModes.at(-1), mode === "speak-now");
      assert.ok(h.clock.pending().length > 0, `${mode}: 沈黙のタイマが張られる`);
      h.clock.advance(10 * 60_000);
      assert.ok(h.scheduler.record.requests.some((r) => r.kind === "silence"), `${mode}: 沈黙の発火を頼む`);
      await post(h.url, "/api/stream/stop");
      assert.equal(h.clock.pending().length, 0, "閉じたら畳む");
    } finally {
      await h.server.close();
    }
  }
});

test("Domain F 予定: Discord の場では発火の予定を作らず、タイマが 1 本も張られない（VAD・転写・名前の呼びかけ・自発の切り替え・時間が経っても）", async () => {
  const h = await startServer({ speakStartModeInitial: "classic" });
  try {
    const before = h.scheduler.record.created;
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    assert.equal(h.scheduler.record.created, before, "予定を作り直さない");
    assert.deepEqual(h.clock.pending(), []);
    const { p1, p2 } = h.discord.record.people;
    p1.vad({ type: "speechStart", tMs: 0 });
    p1.vad({ type: "speechEnd", tMs: 900 });
    p1.hear("チャッピー、聞いてる？");
    p2.vad({ type: "speechStart", tMs: 1000 });
    p2.vad({ type: "speechEnd", tMs: 1900 });
    p2.hear("チャッピー、こっちも");
    await post(h.url, "/api/self-fire", { enabled: false });
    await post(h.url, "/api/self-fire", { enabled: true });
    assert.deepEqual(h.clock.pending(), [], "タイマが張られない");
    h.clock.advance(30 * 60_000);
    await waitUntil(() => h.judgeRequests.length === 2);
    await tick(30);
    assert.deepEqual(h.scheduler.record.requests, [], "沈黙・区切り・合いの手・呼びかけの発火を頼まない");
    assert.equal(h.orchestrator.record.fires.length, 0, "名前を呼ばれても、判定が待つなら発火しない（器が判定を飛ばさない）");
    // 閉じて配信を開けば、今まで通り予定を作る。
    await post(h.url, "/api/stream/stop");
    await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.equal(h.scheduler.record.created, before + 1);
    assert.ok(h.clock.pending().length > 0);
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.server.close();
  }
});

test("Domain F 自発のつまみ: Discord では「判定で話し始めるかどうか」の ON/OFF（OFF の間は判定しない・ON に戻すと判定する）", async () => {
  const h = await startServer({ speakStartModeInitial: "classic", selfFireInitialEnabled: false });
  try {
    await post(h.url, "/api/stream/start", { experience: "discord" });
    h.discord.record.people.p1.hear("一言目");
    await tick(30);
    assert.equal(h.judgeRequests.length, 0, "自発 OFF の間は判定しない");
    const on = await post(h.url, "/api/self-fire", { enabled: true });
    assert.equal(on.json.selfFire.enabled, true);
    h.discord.record.people.p1.hear("二言目");
    await waitUntil(() => h.judgeRequests.length === 1);
    assert.deepEqual(h.clock.pending(), [], "ON にしてもタイマは張らない");
  } finally {
    await h.server.close();
  }
});

// ── 4. 思い出し（語の組と「避けるか」）────────────────────────────────────────

test("Domain F 思い出し: Discord の場は④に通話の語の組・「避けるか」は Discord の問い／配信は今の問い", async () => {
  const h = await startServer({ speakStartModeInitial: "speak-now" });
  try {
    await post(h.url, "/api/stream/start", { experience: "discord" });
    h.discord.record.people.p1.hear("前回どこまで行ったっけ");
    h.orchestrator.record.hooks.onRecallRequest({ request: "前回どこまで", fireId: 1 });
    await waitUntil(() => h.recallJudgeRequests.length === 1);
    assert.equal(h.jobs[0].wording, CALL_WORDING);
    assert.deepEqual(h.recallJudgeRequests[0].questions, [
      { type: "predicate", name: RECALL_AVOID_QUESTION_NAME, instructions: buildDiscordRecallAvoidInstructions("チャッピー") }
    ]);
    assert.ok(h.recallJudgeRequests[0].input.includes("参加者(たろう): 前回どこまで行ったっけ"));
    await waitUntil(() => h.orchestrator.record.fires.some((f) => typeof f.instruction === "string" && f.instruction.includes("過去の配信や通話の記録")));
    await post(h.url, "/api/stream/stop");

    await post(h.url, "/api/stream/start", { device: "Mic" });
    h.ears.hear("前回の話");
    h.orchestrator.record.hooks.onRecallRequest({ request: "前回の話", fireId: 9 });
    await waitUntil(() => h.recallJudgeRequests.length === 2);
    assert.equal(h.jobs[1].wording, null);
    assert.deepEqual(h.recallJudgeRequests[1].questions, [
      { type: "predicate", name: RECALL_AVOID_QUESTION_NAME, instructions: buildRecallAvoidInstructions("チャッピー") }
    ]);
    assert.ok(h.recallJudgeRequests[1].input.includes("配信者: 前回の話"));
  } finally {
    await h.server.close();
  }
});
