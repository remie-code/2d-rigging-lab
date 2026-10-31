// @ts-check
/**
 * Discord モード Domain C: 体験の口の言葉と判定の組が場の段から渡ること（discord-mode.md §3.4・§8 の b・§4.3）— cockpit-server の側。
 *
 *  - 体験の口の wording / teaching / judgeSet の形の確かめ（normalizeVenueWords）。配信の口は 3 つとも null。
 *  - venueContext(): 開いている場の体験の種類・語の組・教えの名前（閉じていれば null）。cockpit.mjs が②の保存・①・編集画面で読む。
 *  - 判定の組: 場を開くとき（始める 3）に作り直す speak-now がその場の体験の問いの組を使う（相槌の内部指示も）。配信は今の問い。
 *  - 語の組: 思い出しの係（始める 3 で作り直す）が④の頼み（job.wording）と①に渡す結果の文面にその場の語の組を使う。
 * 本物の server・loopback の HTTP・偽の耳 / orchestrator / 発火の予定 / 体験の口だけ。差す語は仮の語（本物の通話の語の組と
 * Discord の問いは Domain F）。実データ・本物の LLM・外部 API・Discord には触れない。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createCockpitServer, normalizeVenueExperience, normalizeVenueWords } from "./cockpit-server.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";
import { STREAM_WORDING } from "../mind/venue-wording.mjs";
import {
  STREAM_SPEAK_NOW_QUESTIONS,
  SPEAK_NOW_BACKCHANNEL_INSTRUCTION,
  buildSpeakNowInstructions,
  buildSpeakNowChoices
} from "../mind/speak-now.mjs";
import { buildRecallNotFoundInstruction } from "../mind/recall.mjs";

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

const FAKE_WORDING = Object.freeze({
  keeper: "〈仮の置き場〉",
  venue: "〈仮の場〉",
  transcriptKind: "〈仮の材料〉",
  speakers: "〈仮の話者の説明〉。",
  records: "〈仮の記録〉",
  partner: "〈仮の相手〉",
  conventionsNote: "〈仮の決まりの一文〉"
});

const FAKE_SPEAK_NOW = Object.freeze({
  hostLabel: "仮の話し手",
  buildInstructions: (/** @type {{ name: string }} */ p) => `仮の問い（${p.name}）`,
  buildChoices: () => [
    { value: "wait", description: "仮の待つ" },
    { value: "backchannel", description: "仮の相槌" }
  ],
  backchannelInstruction: "仮の相槌の指示。"
});

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

function makeScheduler() {
  return () => ({
    handleVadEvent() {},
    handleTranscript() {},
    handleChatMessage() {},
    setEnabled() {},
    isEnabled: () => true,
    setVerbosity() {},
    getVerbosity: () => "normal",
    silenceBudgetRemaining: () => 0,
    commentBudgetRemaining: () => 0,
    dispose() {}
  });
}

/** ロールの束の偽物（④の job を記録する）。 @param {any[]} jobs */
function makeRole(jobs) {
  return {
    id: () => "chappy",
    identity: () => MODEL_IDENTITIES.chappy,
    hooks: {},
    voice: { prepare: () => ({ ok: true }), startResources: () => {} },
    recall: {
      run: (/** @type {any} */ job) => {
        jobs.push(job);
        return Promise.resolve({ found: false, summary: "" });
      }
    }
  };
}

/**
 * Discord の体験の口の偽物（人 1 人の耳。言葉と判定の組を持つ）。
 * @param {{ wording?: any; teaching?: any; judgeSet?: any }} words
 */
function makeDiscordMouth(words) {
  const record = { /** @type {any} */ hear: null };
  const mouth = {
    prepareEntrance: () => ({ ok: true, plan: null, voiceKind: "aivis" }),
    openEntrance: async (/** @type {any} */ _plan, /** @type {any} */ venue) => {
      const ears = venue.createEars();
      const mouthFor = venue.earTranscriptMouth({ engine: "discord-stt" });
      ears.add("p1", { vad: null, async start() {}, async dispose() {} });
      record.hear = (/** @type {string} */ text) => {
        const r = venue.transcriptBuffer.append({ startMs: 0, endMs: 900, text, displayName: "たろう", speakerId: "id-p1" });
        if (r.appended) mouthFor(r.entry, { latencyMs: 10, audioCtx: null });
      };
      await ears.start();
      return { ok: true, ears };
    },
    closeEntrance: () => {},
    ...words
  };
  return { mouth, record };
}

/** @param {{ extra?: object; jobs?: any[] }} [p] */
async function startServer(p = {}) {
  const ears = makeEars();
  const orchestrator = makeOrchestrator();
  /** @type {any[]} */
  const judgeRequests = [];
  /** @type {string[]} */
  const answers = [];
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    fireOrchestratorFactory: /** @type {any} */ (orchestrator.factory),
    fireSchedulerFactory: /** @type {any} */ (makeScheduler()),
    commentGuard: () => ({ pass: true, kind: "ok" }),
    roles: [makeRole(p.jobs ?? [])],
    speakStartModeInitial: "speak-now",
    selfFireInitialEnabled: true,
    speakNowJudge: async (/** @type {any} */ request) => {
      judgeRequests.push(request);
      const choice = answers.shift() ?? "wait";
      return { choice, probs: { [choice]: 0.9 }, latencyMs: 5 };
    },
    recallJudge: async () => ({ answers: {} }),
    backchannelMinIntervalMs: 0,
    ...(p.extra ?? {})
  });
  const url = await server.listen(0);
  return { server, url, ears, orchestrator, judgeRequests, answers };
}

// ── 1. 形の確かめ ─────────────────────────────────────────────────────────

test("Domain C normalizeVenueWords: 無ければ 3 つとも null（配信の既定）・正しい形は揃えて通す", () => {
  assert.deepEqual(normalizeVenueWords({}), { wording: null, teaching: null, judgeSet: null });
  assert.deepEqual(normalizeVenueWords({ wording: null, teaching: null, judgeSet: null }), { wording: null, teaching: null, judgeSet: null });
  const words = normalizeVenueWords({ wording: { ...FAKE_WORDING }, teaching: "venue-discord", judgeSet: { speakNow: FAKE_SPEAK_NOW } });
  assert.deepEqual(words.wording, FAKE_WORDING);
  assert.ok(Object.isFrozen(words.wording));
  assert.equal(words.teaching, "venue-discord");
  assert.equal(words.judgeSet?.speakNow.hostLabel, "仮の話し手");
  assert.equal(words.judgeSet?.speakNow.buildInput, STREAM_SPEAK_NOW_QUESTIONS.buildInput, "欠けた項目は配信の項目で埋める");
  assert.deepEqual(normalizeVenueWords({ judgeSet: {} }).judgeSet, { speakNow: null });
});

test("Domain C normalizeVenueWords: 形が崩れていれば投げる（語の組の過不足・教えの名前・判定の組の項目）", () => {
  assert.throws(() => normalizeVenueWords({ wording: { venue: "通話" } }), TypeError);
  assert.throws(() => normalizeVenueWords({ teaching: "discord" }), /venue teaching name/);
  assert.throws(() => normalizeVenueWords({ teaching: "venue-../x" }), /venue teaching name/);
  assert.throws(() => normalizeVenueWords({ judgeSet: { recallAvoid: {} } }), /unknown items: recallAvoid/);
  assert.throws(() => normalizeVenueWords({ judgeSet: { speakNow: { buildChoices: 1 } } }), TypeError);
  assert.throws(() => normalizeVenueWords({ judgeSet: [] }), TypeError);
});

test("Domain C 体験の口: normalizeVenueExperience は言葉と判定の組を揃えて持つ・崩れた口を渡すとサーバを作るときに投げる", () => {
  const base = { openEntrance: () => ({ ok: true }), closeEntrance: () => {} };
  const plain = normalizeVenueExperience("discord", base);
  assert.equal(plain?.wording, null);
  assert.equal(plain?.teaching, null);
  assert.equal(plain?.judgeSet, null);
  const worded = normalizeVenueExperience("discord", { ...base, wording: FAKE_WORDING, teaching: "venue-discord" });
  assert.deepEqual(worded?.wording, FAKE_WORDING);
  assert.equal(worded?.teaching, "venue-discord");
  assert.throws(() => createCockpitServer({ experiences: { discord: { ...base, wording: { venue: "x" } } } }), TypeError);
});

// ── 2. venueContext ──────────────────────────────────────────────────────

test("Domain C venueContext: 閉じていれば null・配信は語の組も教えも null・Discord の場はその口の言葉・閉じたら null", async () => {
  const discord = makeDiscordMouth({ wording: FAKE_WORDING, teaching: "venue-discord" });
  const h = await startServer({ extra: { experiences: { discord: discord.mouth } } });
  try {
    assert.equal(h.server.venueContext(), null);
    assert.equal((await post(h.url, "/api/stream/start", { device: "Mic" })).status, 200);
    assert.deepEqual(h.server.venueContext(), { experience: "stream", wording: null, teaching: null });
    await post(h.url, "/api/stream/stop");
    assert.equal(h.server.venueContext(), null);
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    const ctx = h.server.venueContext();
    assert.equal(ctx?.experience, "discord");
    assert.deepEqual(ctx?.wording, FAKE_WORDING);
    assert.equal(ctx?.teaching, "venue-discord");
    assert.ok(Object.isFrozen(ctx));
    await post(h.url, "/api/stream/stop");
    assert.equal(h.server.venueContext(), null);
  } finally {
    await h.server.close();
  }
});

test("Domain C venueContext: 閉じる段の最後の保存（saveFinal）の時点ではまだその場の言葉が読める", async () => {
  /** @type {any[]} */
  const seen = [];
  /** @type {any} */
  let server = null;
  const discord = makeDiscordMouth({ wording: FAKE_WORDING });
  const role = makeRole([]);
  role.hooks = { saveFinal: () => void seen.push(server.venueContext()) };
  const ears = makeEars();
  server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    roles: [role],
    experiences: { discord: discord.mouth }
  });
  const url = await server.listen(0);
  try {
    await post(url, "/api/stream/start", { experience: "discord" });
    await post(url, "/api/stream/stop");
    assert.equal(seen.length, 1);
    assert.deepEqual(seen[0]?.wording, FAKE_WORDING);
  } finally {
    await server.close();
  }
});

// ── 3. 判定の組（speak-now）────────────────────────────────────────────────

test("Domain C 判定の組: Discord の場の speak-now はその口の問いの組で判定し、相槌の発火もその内部指示・配信に戻すと今の問い", async () => {
  const discord = makeDiscordMouth({ judgeSet: { speakNow: FAKE_SPEAK_NOW } });
  const h = await startServer({ extra: { experiences: { discord: discord.mouth } } });
  try {
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    h.answers.push("backchannel");
    discord.record.hear("どう思う？");
    await waitUntil(() => h.orchestrator.record.fires.length === 1);
    assert.equal(h.judgeRequests[0].instructions, "仮の問い（チャッピー）");
    assert.deepEqual(h.judgeRequests[0].choices, FAKE_SPEAK_NOW.buildChoices());
    assert.equal(h.judgeRequests[0].input, "仮の話し手(たろう): どう思う？");
    assert.equal(h.orchestrator.record.fires[0].instruction, "仮の相槌の指示。");
    await post(h.url, "/api/stream/stop");

    assert.equal((await post(h.url, "/api/stream/start", { device: "Mic" })).status, 200);
    h.answers.push("backchannel");
    h.ears.hear("配信の発言");
    await waitUntil(() => h.orchestrator.record.fires.length === 2);
    assert.equal(h.judgeRequests[1].instructions, buildSpeakNowInstructions({ name: "チャッピー", verbosity: "normal" }));
    assert.deepEqual(h.judgeRequests[1].choices, buildSpeakNowChoices("チャッピー"));
    assert.equal(h.judgeRequests[1].input, "配信者: 配信の発言");
    assert.equal(h.orchestrator.record.fires[1].instruction, SPEAK_NOW_BACKCHANNEL_INSTRUCTION);
  } finally {
    await h.server.close();
  }
});

test("Domain C 判定の組: 判定の組を持たない Discord の口は今の配信の問いのまま（null = 既定）", async () => {
  const discord = makeDiscordMouth({});
  const h = await startServer({ extra: { experiences: { discord: discord.mouth } } });
  try {
    await post(h.url, "/api/stream/start", { experience: "discord" });
    discord.record.hear("やあ");
    await waitUntil(() => h.judgeRequests.length === 1);
    assert.equal(h.judgeRequests[0].instructions, buildSpeakNowInstructions({ name: "チャッピー", verbosity: "normal" }));
    assert.equal(h.judgeRequests[0].input, "配信者(たろう): やあ");
  } finally {
    await h.server.close();
  }
});

// ── 4. 語の組（思い出しの係）──────────────────────────────────────────────

test("Domain C 語の組: 思い出しの係は場の語の組を④の頼み（job.wording）と①に渡す結果の文面に使う・配信は null（今の文面）", async () => {
  /** @type {any[]} */
  const jobs = [];
  const discord = makeDiscordMouth({ wording: FAKE_WORDING });
  const h = await startServer({ jobs, extra: { experiences: { discord: discord.mouth } } });
  try {
    await post(h.url, "/api/stream/start", { experience: "discord" });
    h.orchestrator.record.hooks.onRecallRequest({ request: "前回", fireId: 1 });
    await waitUntil(() => h.orchestrator.record.fires.length === 1);
    assert.deepEqual(jobs[0].wording, FAKE_WORDING);
    assert.equal(h.orchestrator.record.fires[0].instruction, buildRecallNotFoundInstruction({ request: "前回", wording: FAKE_WORDING }));
    await post(h.url, "/api/stream/stop");

    await post(h.url, "/api/stream/start", { device: "Mic" });
    h.orchestrator.record.hooks.onRecallRequest({ request: "前回", fireId: 2 });
    await waitUntil(() => h.orchestrator.record.fires.length === 2);
    assert.equal(jobs[1].wording, null);
    assert.equal(h.orchestrator.record.fires[1].instruction, buildRecallNotFoundInstruction({ request: "前回" }));
    assert.ok(h.orchestrator.record.fires[1].instruction.includes(STREAM_WORDING.records));
  } finally {
    await h.server.close();
  }
});
