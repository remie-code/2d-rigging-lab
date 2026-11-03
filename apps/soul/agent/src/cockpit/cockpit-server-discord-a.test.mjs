// @ts-check
/**
 * Discord モード Domain A: 会話の正本を場へ・話者の形（discord-mode.md §3.1・§3.2）— cockpit-server の側。
 *
 *  - 場が開くとき（配信を始める）に場が正本を作り、耳に積む口として渡す。
 *  - サーバで正本を読む所は、耳の返す正本ではなく場の正本を読む（耳が無くても正本はある）。
 *  - 正本の購読は場が 1 回だけ張る（耳が 2 本で同じ正本に積んでも、発火の予定・speak-now・放送は 1 行 1 回）。
 *  - 配信のふるまい（you の放送・soul / viewer を耳の口で放送しない除外・speak-now・遅延のログ）は変わらない。
 *  - id は放送・ログ・判定の入力に出ない。soul の名前も放送に新たに出ない。
 * 本物の server・loopback の HTTP・偽の耳 / orchestrator / 判定 / 発火の予定だけ。実データ・本物の LLM・外部 API には触れない。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createCockpitServer } from "./cockpit-server.mjs";
import { createTranscriptBuffer } from "../ears/transcript-buffer.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";

const PERSON_ID = "discord-user-424242";
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
  return /** @type {any} */ (await (await fetch(`${url}/api/state`)).json());
}

/** SSE を読む（events に積む）。 @param {string} url */
function openEvents(url) {
  /** @type {Array<{ event: string; data: any }>} */
  const events = [];
  const ac = new AbortController();
  (async () => {
    try {
      const r = await fetch(`${url}/api/events`, { signal: ac.signal });
      const reader = /** @type {any} */ (r.body).getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          let event = "message";
          let data = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (data) events.push({ event, data: JSON.parse(data) });
        }
      }
    } catch {
      // 閉じた。
    }
  })();
  return { events, close: () => ac.abort() };
}

/**
 * 偽の耳。正本の受け取り方を選べる:
 *  - "venue"（既定）: 渡された正本を自分の transcriptBuffer として返す（本物の耳と同じ）。
 *  - "own": 渡された正本を無視して自分の正本を返す（サーバが耳の返す正本を読んでいないことを確かめる）。
 * どちらも onAppend は張らない（本物の耳が渡された正本に張らないのと同じ）。
 * @param {{ mode?: "venue" | "own" }} [p]
 */
function makeEars({ mode = "venue" } = {}) {
  const record = {
    /** @type {any} */ options: null,
    /** @type {any} */ venue: null,
    /** @type {any} */ own: null,
    created: 0
  };
  const factory = (/** @type {any} */ options) => {
    record.created += 1;
    record.options = options;
    record.venue = options.transcriptBuffer ?? null;
    record.own = createTranscriptBuffer({ nowImpl: () => 1000 });
    return {
      transcriptBuffer: mode === "own" ? record.own : record.venue,
      async start() {},
      async dispose() {},
      isDisposed: () => false,
      streamMs: () => 0,
      stats: () => ({})
    };
  };
  /**
   * 耳ごとの口を真似て 1 行積む（本物の耳と同じ: 正本に積み、積めたら onTranscript に遅延を添えて直に渡す）。
   * @param {any} input @param {{ latencyMs: number | null; audioCtx: number | null }} [meta]
   */
  const earAppend = (input, meta = { latencyMs: 100, audioCtx: null }) => {
    const result = record.venue.append(input);
    if (result.appended) record.options.onTranscript(result.entry, meta);
    return result;
  };
  return { factory, record, earAppend };
}

/** 発火の予定の偽物（handleTranscript に来た行を数える）。 */
function makeSchedulerCapture() {
  const record = { /** @type {any[]} */ transcripts: [], /** @type {any[]} */ chats: [] };
  const factory = () => ({
    handleVadEvent() {},
    handleTranscript(/** @type {any} */ entry) {
      record.transcripts.push(entry);
    },
    handleChatMessage(/** @type {any} */ msg) {
      record.chats.push(msg);
    },
    setEnabled() {},
    isEnabled: () => true,
    setVerbosity() {},
    getVerbosity: () => "normal",
    silenceBudgetRemaining: () => 0,
    commentBudgetRemaining: () => 0,
    dispose() {}
  });
  return { factory, record };
}

/** 偽の orchestrator（hooks を握る）。 */
function makeOrchestrator() {
  const record = { /** @type {any} */ hooks: null, fires: 0 };
  const factory = (/** @type {any} */ hooks) => {
    record.hooks = hooks;
    return {
      async fire() {
        record.fires += 1;
        return { fired: true };
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
      dispose() {}
    };
  };
  return { factory, record };
}

/** 判定の偽物（呼ばれた入力を記録・答えは返さない）。 */
function makeJudge() {
  /** @type {any[]} */
  const calls = [];
  const judge = (/** @type {any} */ request) => {
    calls.push(request);
    return new Promise(() => {});
  };
  return { judge, calls };
}

/** @param {object} [extra] @param {{ mode?: "venue" | "own" }} [earsOpts] */
async function startServer(extra = {}, earsOpts = {}) {
  const ears = makeEars(earsOpts);
  const scheduler = makeSchedulerCapture();
  const orchestrator = makeOrchestrator();
  /** @type {any[]} */
  const logs = [];
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    fireOrchestratorFactory: /** @type {any} */ (orchestrator.factory),
    fireSchedulerFactory: /** @type {any} */ (scheduler.factory),
    commentGuard: () => ({ pass: true, kind: "ok" }),
    currentRoleIdentity: () => MODEL_IDENTITIES.chappy,
    onSttLatency: (/** @type {any} */ info) => logs.push({ kind: "stt", info }),
    onSpeakNowJudgment: (/** @type {any} */ info) => logs.push({ kind: "speakNow", info }),
    ...extra
  });
  const url = await server.listen(0);
  return { server, url, ears, scheduler, orchestrator, logs };
}

// ── 場が正本を作り、耳に渡す ─────────────────────────────────────────────────

test("Domain A 場の正本: 配信を始めると場が正本を作って耳に渡す・終えると手放す（閉じている間は正本が無い）", async () => {
  const h = await startServer();
  try {
    assert.deepEqual(h.server.getTranscript(), []);
    const started = await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.equal(started.status, 200);
    assert.ok(h.ears.record.venue, "耳に積む口（正本）が渡る");
    assert.equal(typeof h.ears.record.venue.append, "function");
    h.ears.earAppend({ startMs: 0, endMs: 900, text: "こんにちは" });
    assert.deepEqual(h.server.getTranscript().map((e) => e.text), ["こんにちは"]);
    assert.equal(h.orchestrator.record.hooks.getBuffer(), h.ears.record.venue, "頭の口も同じ正本を読む");
    await post(h.url, "/api/stream/stop");
    assert.deepEqual(h.server.getTranscript(), [], "終えた後は正本が無い（従来どおり）");
    assert.equal(h.orchestrator.record.hooks.getBuffer(), null);
    // 次の場は新しい正本。
    await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.deepEqual(h.server.getTranscript(), []);
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.server.close();
  }
});

// ── サーバで正本を読む所は場の正本を読む ──────────────────────────────────────

test("Domain A 場の正本: サーバは耳の返す正本ではなく場の正本を読む（snapshot・getTranscript・頭・判定・コメント・終えるときの写し・放送の数）", async () => {
  /** @type {any[]} */
  const saved = [];
  const judge = makeJudge();
  const h = await startServer(
    {
      streamHooks: { saveFinal: (/** @type {any} */ transcript) => void saved.push(transcript) },
      speakStartModeInitial: "speak-now",
      selfFireInitialEnabled: true,
      speakNowJudge: judge.judge
    },
    { mode: "own" }
  );
  const sse = openEvents(h.url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    await post(h.url, "/api/stream/start", { device: "Mic" });
    // 耳の返した自分の正本に積んでも、サーバには見えない。
    h.ears.record.own.append({ startMs: 0, endMs: 900, text: "耳の自前の正本" });
    // 場の正本に積んだ行が見える。
    h.ears.earAppend({ startMs: 0, endMs: 900, text: "場の正本の一言" });
    h.ears.record.venue.append({ startMs: 0, endMs: 0, text: "   " }); // 破棄（discard の放送）
    h.server.ingestChatMessage({ text: "コメント", displayName: "みけ", messageId: "m-1" });
    h.orchestrator.record.hooks.onSoulTranscript(
      h.ears.record.venue.append({ startMs: 0, endMs: 0, text: "魂の返事", speaker: "soul" }).entry
    );

    assert.deepEqual(h.server.getTranscript().map((e) => e.text), ["場の正本の一言", "コメント", "魂の返事"]);
    const s = await state(h.url);
    assert.deepEqual(s.transcripts.map((/** @type {any} */ e) => e.text), ["場の正本の一言", "コメント", "魂の返事"]);
    assert.equal(s.appended, 3);
    assert.equal(s.discarded, 1);
    assert.equal(h.orchestrator.record.hooks.getBuffer(), h.ears.record.venue);
    // 判定の入力（speak-now）も場の正本から作る。
    await waitUntil(() => judge.calls.length >= 1);
    assert.match(judge.calls[0].input, /配信者: 場の正本の一言/);
    // 放送の数（appended / discarded）も場の正本の数。
    await waitUntil(() => sse.events.some((e) => e.event === "discard"));
    const you = sse.events.find((e) => e.event === "transcript" && e.data.text === "場の正本の一言");
    assert.equal(you?.data.appended, 1);
    assert.equal(sse.events.find((e) => e.event === "discard")?.data.discarded, 1);
    // 終えるときの写しも場の正本。
    await post(h.url, "/api/stream/stop");
    assert.deepEqual(saved[0].map((/** @type {any} */ e) => e.text), ["場の正本の一言", "コメント", "魂の返事"]);
  } finally {
    sse.close();
    await h.server.close();
  }
});

test("Domain A 場の正本: 耳が無くても正本はある（配信を始める途中・耳を開く前に届いたコメントも積める）", async () => {
  /** @type {(v?: unknown) => void} */
  let release = () => {};
  const h = await startServer({
    onPrepareVoiceEngine: () =>
      new Promise((r) => {
        release = () => r({ ok: true });
      })
  });
  try {
    const starting = post(h.url, "/api/stream/start", { device: "Mic" });
    await waitUntil(() => h.server.streamStatus().phase === "opening");
    await tick(20);
    assert.equal(h.ears.record.created, 0, "まだ耳は無い");
    h.server.ingestChatMessage({ text: "早めのコメント", displayName: "みけ", messageId: "m-early" });
    assert.deepEqual(h.server.getTranscript().map((e) => [e.speaker, e.text]), [["viewer", "早めのコメント"]]);
    release();
    await starting;
    assert.equal(h.ears.record.venue.all()[0].text, "早めのコメント", "耳は同じ正本に積む");
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.server.close();
  }
});

// ── 購読は場が 1 回だけ（N 重にならない）・配信のふるまい ─────────────────────────

test("Domain A 購読: 耳 2 本で同じ正本に積んでも、発火の予定・speak-now・放送は 1 行 1 回（soul / viewer は耳の口で放送しない）", async () => {
  const judge = makeJudge();
  const h = await startServer({ speakStartModeInitial: "speak-now", selfFireInitialEnabled: true, speakNowJudge: judge.judge });
  const sse = openEvents(h.url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    await post(h.url, "/api/stream/start", { device: "Mic" });
    // 2 本目の耳（Discord の人ごとの耳を模す）: 同じ正本と同じ耳ごとの口を使う。
    const venue = h.ears.record.venue;
    const onTranscript = h.ears.record.options.onTranscript;
    const earB = (/** @type {any} */ input) => {
      const r = venue.append(input);
      if (r.appended) onTranscript(r.entry, { latencyMs: 200, audioCtx: null });
    };
    h.ears.earAppend({ startMs: 0, endMs: 900, text: "Aの一言" });
    earB({ startMs: 0, endMs: 900, text: "Bの一言" });
    venue.append({ startMs: 0, endMs: 0, text: "魂の返事", speaker: "soul" });
    h.server.ingestChatMessage({ text: "コメント", displayName: "みけ", messageId: "m-2" });

    assert.deepEqual(
      h.scheduler.record.transcripts.map((e) => e.text),
      ["Aの一言", "Bの一言", "魂の返事", "コメント"],
      "発火の予定へは 1 行 1 回（soul / viewer も・従来どおり）"
    );
    await tick(30);
    const youEvents = sse.events.filter((e) => e.event === "transcript" && e.data.speaker === "you");
    assert.deepEqual(youEvents.map((e) => e.data.text), ["Aの一言", "Bの一言"], "you は耳ごとの口で 1 回だけ放送");
    assert.deepEqual(youEvents.map((e) => e.data.latencyMs), [100, 200], "遅延は耳ごとの口から");
    assert.equal(sse.events.filter((e) => e.event === "transcript" && e.data.speaker === "soul").length, 0, "soul は耳の口で放送しない");
    assert.equal(sse.events.filter((e) => e.event === "transcript" && e.data.speaker === "viewer").length, 1, "viewer は取り込み経路の 1 本だけ");
    // speak-now の判定は you の行 1 件ごとに 1 回（耳が 2 本でも 2 重にならない）。
    assert.deepEqual(judge.calls.map((c) => c.input), ["配信者: Aの一言", "配信者: Aの一言\n配信者: Bの一言"]);
    // 遅延のログは you の行ごとに 1 回（数字だけ）。
    assert.deepEqual(
      h.logs.filter((l) => l.kind === "stt").map((l) => l.info),
      [
        { engine: "whisper", latencyMs: 100 },
        { engine: "whisper", latencyMs: 200 }
      ]
    );
    await post(h.url, "/api/stream/stop");
  } finally {
    sse.close();
    await h.server.close();
  }
});

// ── id と名前が漏れない ────────────────────────────────────────────────────

test("Domain A 話者の形: id は放送・状態・ログ・判定の入力に出ない・soul の名前は放送に新たに出ない・名前のある you は判定で「配信者(名前)」", async () => {
  const judge = makeJudge();
  const h = await startServer({ speakStartModeInitial: "speak-now", selfFireInitialEnabled: true, speakNowJudge: judge.judge });
  const sse = openEvents(h.url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    await post(h.url, "/api/stream/start", { device: "Mic" });
    // soul の行に載るロールの id と名前（orchestrator に渡る口）。
    assert.deepEqual(h.orchestrator.record.hooks.getSoulSpeaker(), { id: "chappy", name: MODEL_IDENTITIES.chappy.canonicalName });
    const soulSpeaker = h.orchestrator.record.hooks.getSoulSpeaker();
    const soul = h.ears.record.venue.append({
      startMs: 0,
      endMs: 0,
      text: "魂の返事",
      speaker: "soul",
      displayName: soulSpeaker.name,
      speakerId: soulSpeaker.id
    }).entry;
    h.orchestrator.record.hooks.onSoulTranscript(soul);
    h.ears.earAppend({ startMs: 0, endMs: 900, text: "やあ", displayName: "たろう", speakerId: PERSON_ID });
    await waitUntil(() => judge.calls.length >= 1);
    await tick(30);

    const soulEvent = sse.events.find((e) => e.event === "transcript" && e.data.speaker === "soul");
    assert.equal(soulEvent?.data.displayName, null, "soul の名前は放送に載せない");
    const youEvent = sse.events.find((e) => e.event === "transcript" && e.data.speaker === "you");
    assert.equal(youEvent?.data.displayName, "たろう");
    const s = await state(h.url);
    const wire = JSON.stringify({ events: sse.events, state: s });
    assert.equal(wire.includes(PERSON_ID), false, "Discord の id は放送・状態に出ない");
    assert.equal(wire.includes("speakerId"), false);
    assert.equal(s.transcripts.find((/** @type {any} */ e) => e.speaker === "soul").displayName, null);
    assert.equal(JSON.stringify(h.logs).includes(PERSON_ID), false, "ログに id が出ない");
    assert.equal(JSON.stringify(h.logs).includes("たろう"), false, "ログに名前が出ない");
    assert.equal(JSON.stringify(h.logs).includes("やあ"), false, "ログに本文が出ない");
    assert.equal(judge.calls[0].input.includes(PERSON_ID), false);
    assert.equal(judge.calls[0].input.includes("chappy"), false);
    assert.match(judge.calls[0].input, /配信者\(たろう\): やあ/);
    // 正本には id と名前が残る（場の中の記録）。
    const recorded = h.server.getTranscript();
    assert.equal(recorded[0].speakerId, "chappy");
    assert.equal(recorded[1].speakerId, PERSON_ID);
    await post(h.url, "/api/stream/stop");
  } finally {
    sse.close();
    await h.server.close();
  }
});
