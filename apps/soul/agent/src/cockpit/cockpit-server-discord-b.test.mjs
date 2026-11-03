// @ts-check
/**
 * Discord モード Domain B: 場と体験の分離・ロールの一覧と束・声と目を場の共通の段へ・API と snapshot の体験の種類
 * （discord-mode.md §4・§5・§12.3）— cockpit-server の側。
 *
 *  - 配信のふるまいが変わらないこと（開く順・失敗のときの畳み方・閉じる順・close()）を、呼ばれた順を記録する偽物で固定する。
 *  - ロールの一覧（場の間は固める）・ロールごとの束（名前・場の口・声・④）をサーバが束から引くこと。
 *  - 体験の口（配信は中にある・Discord は外から渡せる形）と API / snapshot の experience。
 * 本物の server・loopback の HTTP・偽の耳 / orchestrator / 発火の予定 / 体験の口だけ。実データ・本物の LLM・外部 API・
 * Discord には触れない。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createCockpitServer, DISCORD_EXPERIENCE_UNAVAILABLE_MESSAGE, VENUE_EXPERIENCES } from "./cockpit-server.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";

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
 * 偽の耳（配信のマイクの耳）。作る・起こす・畳むを events に記録する。畳むときにサーバの正本が残っているかも記録する。
 * @param {string[]} events @param {{ getServer?: () => any }} [opts]
 */
function makeEars(events, opts = {}) {
  const record = {
    /** @type {any} */ options: null,
    created: 0,
    disposed: 0,
    /** @type {number | null} */ transcriptAtDispose: null,
    /** @type {Error | null} */ startShouldThrow: null
  };
  const factory = (/** @type {any} */ options) => {
    record.created += 1;
    record.options = options;
    events.push("ears.create");
    return {
      transcriptBuffer: options.transcriptBuffer,
      async start() {
        events.push("ears.start");
        if (record.startShouldThrow) throw record.startShouldThrow;
      },
      async dispose() {
        record.disposed += 1;
        const server = opts.getServer?.();
        record.transcriptAtDispose = server ? server.getTranscript().length : null;
        events.push("ears.dispose");
      },
      isDisposed: () => false,
      streamMs: () => 0,
      stats: () => ({})
    };
  };
  /** 耳ごとの口を真似て 1 行積む（本物の耳と同じ）。 @param {string} text */
  const hear = (text) => {
    const r = record.options.transcriptBuffer.append({ startMs: 0, endMs: 900, text });
    if (r.appended) record.options.onTranscript(r.entry, { latencyMs: 50, audioCtx: null });
    return r;
  };
  return { factory, record, hear };
}

/** 偽の orchestrator（hooks を握る・状態は手で替える）。 @param {string[]} [events] */
function makeOrchestrator(events = []) {
  const record = { /** @type {any} */ hooks: null, state: "idle" };
  const factory = (/** @type {any} */ hooks) => {
    record.hooks = hooks;
    return {
      async fire() {
        return { fired: true };
      },
      getState: () => record.state,
      async kill() {
        events.push("orchestrator.kill");
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

/** 発火の予定の偽物（handleTranscript に来た行を数える）。 */
function makeScheduler() {
  const record = { /** @type {any[]} */ transcripts: [] };
  const factory = () => ({
    handleVadEvent() {},
    handleTranscript(/** @type {any} */ entry) {
      record.transcripts.push(entry);
    },
    handleChatMessage() {},
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

/**
 * ロールの束の偽物（場の口・声・④を events に記録する）。
 * @param {string} name @param {string[]} events
 * @param {{ identity?: any; voiceFails?: string | null; openSessionFails?: string | null; recall?: (job: any) => any; earsRecord?: any }} [opts]
 */
function makeRole(name, events, opts = {}) {
  /** @type {any[]} */
  const saved = [];
  const role = {
    saved,
    id: () => name,
    identity: () => opts.identity ?? MODEL_IDENTITIES.chappy,
    hooks: {
      renewRecords: () => void events.push(`${name}.renewRecords`),
      openSession: () => {
        events.push(`${name}.openSession`);
        return opts.openSessionFails ? { ok: false, reason: opts.openSessionFails } : { ok: true };
      },
      connectBody: () => {
        events.push(`${name}.connectBody`);
        return { ok: true };
      },
      closeSession: () => void events.push(`${name}.closeSession`),
      closeBody: () => void events.push(`${name}.closeBody`),
      saveFinal: (/** @type {any[]} */ transcript) => {
        saved.push(transcript);
        events.push(`${name}.saveFinal:${transcript.length}`);
      }
    },
    voice: {
      prepare: (/** @type {string} */ kind) => {
        events.push(`${name}.voice.prepare:${kind}${opts.earsRecord && opts.earsRecord.created > 0 ? "(ears made)" : ""}`);
        return opts.voiceFails ? { ok: false, reason: opts.voiceFails } : { ok: true };
      },
      startResources: () => void events.push(`${name}.voice.resources`)
    },
    recall: opts.recall ? { run: opts.recall } : null
  };
  return role;
}

/**
 * 本物の server を立てる（ロールの束・偽の耳・目の口を記録）。
 * @param {{ roles?: any; extra?: object }} [p]
 */
async function startServer(p = {}) {
  /** @type {string[]} */
  const events = [];
  /** @type {any} */
  let server = null;
  const ears = makeEars(events, { getServer: () => server });
  const orchestrator = makeOrchestrator(events);
  const scheduler = makeScheduler();
  const roles = p.roles ?? [makeRole("chappy", events, { earsRecord: ears.record })];
  /** @type {any[]} */
  const logs = [];
  server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    fireOrchestratorFactory: /** @type {any} */ (orchestrator.factory),
    fireSchedulerFactory: /** @type {any} */ (scheduler.factory),
    commentGuard: () => ({ pass: true, kind: "ok" }),
    roles: typeof roles === "function" ? roles : roles,
    onSetSttEngine: (/** @type {string} */ engine) => void events.push(`stt.save:${engine}`),
    onSetTtsEngine: (/** @type {string} */ engine) => void events.push(`tts.save:${engine}`),
    onEarsStarted: () => void events.push("eyes.start(old name)"),
    onEarsStopped: () => void events.push("eyes.stop(old name)"),
    onEyesStart: () => void events.push("eyes.start"),
    onEyesStop: () => void events.push("eyes.stop"),
    onSttLatency: (/** @type {any} */ info) => logs.push(info),
    ...(p.extra ?? {})
  });
  const url = await server.listen(0);
  return { server, url, ears, orchestrator, scheduler, events, logs, roles };
}

// ── 1. 配信のふるまいが変わらない（開く順・失敗・閉じる順・close）──────────────────────────────

test("Domain B 配信の開く順: 場の記録 → 耳の下見（方式の記憶）→ 声の engine の用意（耳を作る前）→ 耳 → 再生器 → 目 → 頭のセッション → 器・experience は stream", async () => {
  const h = await startServer();
  try {
    const started = await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.equal(started.status, 200);
    assert.equal(started.json.stream.phase, "open");
    assert.equal(started.json.stream.experience, "stream");
    assert.equal(started.json.ears, "listening");
    assert.deepEqual(h.events, [
      "chappy.renewRecords",
      "stt.save:whisper",
      "tts.save:aivis",
      "chappy.voice.prepare:aivis",
      "ears.create",
      "ears.start",
      "chappy.voice.resources",
      "eyes.start(old name)",
      "eyes.start",
      "chappy.openSession",
      "chappy.connectBody"
    ]);
    assert.equal(h.server.streamStatus().experience, "stream");
    assert.equal((await state(h.url)).stream.experience, "stream");
  } finally {
    await h.server.close();
  }
});

test("Domain B 配信の閉じる順: 目 → 正本を手放す → 耳を畳む → 頭のセッション → 器 → 最後の保存（写しは畳む前）・閉じたら experience は null", async () => {
  const h = await startServer();
  try {
    await post(h.url, "/api/stream/start", { device: "Mic" });
    h.ears.hear("一言");
    h.events.length = 0;
    const stopped = await post(h.url, "/api/stream/stop");
    assert.equal(stopped.status, 200);
    assert.deepEqual(h.events, [
      "eyes.stop(old name)",
      "eyes.stop",
      "ears.dispose",
      "chappy.closeSession",
      "chappy.closeBody",
      "chappy.saveFinal:1"
    ]);
    assert.equal(h.ears.record.transcriptAtDispose, 0, "正本は耳を畳む前に手放す（従来どおり・閉じた後と記録中は正本が無い）");
    assert.deepEqual(h.roles[0].saved[0].map((/** @type {any} */ e) => e.text), ["一言"], "写しは畳む前に取る");
    assert.equal(stopped.json.stream.phase, "closed");
    assert.equal(stopped.json.stream.experience, null);
    assert.equal(stopped.json.ears, "stopped");
    assert.equal(h.server.streamStatus().experience, null);
  } finally {
    await h.server.close();
  }
});

test("Domain B 配信: 声の engine を用意できなければ耳を作らずに場を開かない（目・再生器も起こさない・目の停止も呼ばない・tts down）", async () => {
  /** @type {string[]} */
  const events = [];
  const h = await startServer({ roles: [makeRole("chappy", events, { voiceFails: "声を用意できない（テスト）" })] });
  // startServer の events とは別に、ロールの束の events を見る（耳・目は h.events）。
  try {
    const r = await post(h.url, "/api/stream/start", { device: "Mic", ttsEngine: "elevenlabs" });
    assert.equal(r.status, 500);
    assert.equal(r.json.error, "声を用意できない（テスト）");
    assert.deepEqual(events, ["chappy.renewRecords", "chappy.voice.prepare:elevenlabs", "chappy.closeBody"]);
    assert.deepEqual(h.events, ["stt.save:whisper", "tts.save:elevenlabs"], "耳は作らない・目は起こさない・目の停止も呼ばない");
    assert.equal(h.ears.record.created, 0);
    assert.equal(r.json.state.ears, "stopped");
    assert.deepEqual(r.json.state.tts, { engine: "elevenlabs", status: "down", reason: "声を用意できない（テスト）" });
    assert.deepEqual(r.json.state.stt, { engine: "whisper", status: "unknown", reason: null });
    assert.equal(r.json.state.stream.phase, "closed");
    assert.equal(r.json.state.stream.error, "声を用意できない（テスト）");
    assert.equal(r.json.state.stream.experience, null);
    assert.deepEqual(h.server.getTranscript(), [], "正本も手放す");
  } finally {
    await h.server.close();
  }
});

test("Domain B 配信: 文字起こしのキー切れが先なら声の engine は用意しない（下見で止まる）", async () => {
  /** @type {string[]} */
  const events = [];
  const h = await startServer({
    roles: [makeRole("chappy", events)],
    extra: { elevenLabsApiKeyProvider: () => ({ ok: false, reason: "no key (test)" }) }
  });
  try {
    const r = await post(h.url, "/api/stream/start", { device: "Mic", sttEngine: "elevenlabs" });
    assert.equal(r.status, 500);
    assert.equal(r.json.error, "no key (test)");
    assert.deepEqual(events, ["chappy.renewRecords", "chappy.closeBody"]);
    assert.equal(h.ears.record.created, 0);
  } finally {
    await h.server.close();
  }
});

test("Domain B 配信: 耳が起きなければ再生器・目を起こさない（目の停止も耳の dispose も呼ばない）", async () => {
  const h = await startServer();
  h.ears.record.startShouldThrow = new Error("whisper spawn failed (fake)");
  try {
    const r = await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.equal(r.status, 500);
    assert.equal(r.json.error, "whisper spawn failed (fake)");
    assert.deepEqual(h.events, [
      "chappy.renewRecords",
      "stt.save:whisper",
      "tts.save:aivis",
      "chappy.voice.prepare:aivis",
      "ears.create",
      "ears.start",
      "chappy.closeBody"
    ]);
    assert.equal(h.ears.record.disposed, 0, "起きなかった耳は自分で畳む約束（サーバは畳まない）");
    assert.equal(r.json.state.health.whisper.status, "down");
  } finally {
    await h.server.close();
  }
});

test("Domain B 配信: 頭のセッションを作れなければ、目 → 耳 → 頭のセッション → 器の順で畳んで開かない", async () => {
  /** @type {string[]} */
  const roleEvents = [];
  const h = await startServer({ roles: [makeRole("chappy", roleEvents, { openSessionFails: "頭が無い（テスト）" })] });
  try {
    const r = await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.equal(r.status, 500);
    assert.equal(r.json.error, "頭が無い（テスト）");
    assert.deepEqual(roleEvents.slice(-3), ["chappy.openSession", "chappy.closeSession", "chappy.closeBody"]);
    assert.deepEqual(h.events.slice(-3), ["eyes.stop(old name)", "eyes.stop", "ears.dispose"]);
    assert.equal(h.ears.record.disposed, 1);
    assert.equal(r.json.state.stream.experience, null);
  } finally {
    await h.server.close();
  }
});

test("Domain B close(): 場の共通の段と同じ口で畳む（正本を手放す → 耳 → 目・旧名と新しい名の両方）", async () => {
  const h = await startServer();
  await post(h.url, "/api/stream/start", { device: "Mic" });
  h.ears.hear("一言");
  h.events.length = 0;
  await h.server.close();
  assert.deepEqual(h.events, ["ears.dispose", "eyes.stop(old name)", "eyes.stop"]);
  assert.equal(h.ears.record.transcriptAtDispose, 0, "正本は耳を畳む前に手放す（従来の close() と同じ）");
  assert.equal(h.server.earsStatus(), "stopped");
  assert.deepEqual(h.server.streamStatus(), { phase: "closed", error: null, openedAtMs: null, experience: null });
  assert.equal(h.roles[0].saved.length, 0, "close() は記憶の保存を頼まない");
});

// ── 2. 耳の束 ───────────────────────────────────────────────────────────

test("Domain B 耳の束: 配信のマイクの耳は束の 1 本（VAD は束を通って場へ・喋っているかは束が覚える）", async () => {
  const h = await startServer();
  const sse = openEvents(h.url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.equal(h.server.getQuietGap()?.userSpeaking, false);
    h.ears.record.options.onVadEvent({ type: "speechStart", tMs: 100 });
    assert.equal(h.server.getQuietGap()?.userSpeaking, true);
    h.ears.record.options.onVadEvent({ type: "speechEnd", tMs: 900, startMs: 100, endMs: 900, durationMs: 800 });
    assert.equal(h.server.getQuietGap()?.userSpeaking, false);
    await waitUntil(() => sse.events.filter((e) => e.event === "vad").length >= 2);
    assert.deepEqual(sse.events.filter((e) => e.event === "vad").map((e) => e.data.type), ["speechStart", "speechEnd"]);
    await post(h.url, "/api/stream/stop");
    assert.equal(h.server.getQuietGap()?.userSpeaking, false, "畳んだら喋っていない");
  } finally {
    sse.close();
    await h.server.close();
  }
});

// ── 3. ロールの一覧と束 ──────────────────────────────────────────────────────

test("Domain B ロールの束: サーバは名前を束から引く（snapshot の identity・soul の行の id と名前・whisper の手がかり）", async () => {
  /** @type {string[]} */
  const events = [];
  const h = await startServer({ roles: [makeRole("chappy", events, { identity: MODEL_IDENTITIES.chappy })] });
  try {
    const s = await state(h.url);
    assert.equal(s.brain.identity.id, "chappy");
    assert.deepEqual(h.orchestrator.record.hooks.getSoulSpeaker(), { id: "chappy", name: MODEL_IDENTITIES.chappy.canonicalName });
    await post(h.url, "/api/stream/start", { device: "Mic" });
    const provider = h.ears.record.options.whisper.promptProvider;
    assert.equal(typeof provider, "function", "束に名前があれば whisper の手がかりの口を渡す");
    const prompt = provider();
    const expected = MODEL_IDENTITIES.chappy.whisperPrompt;
    assert.equal(prompt, typeof expected === "string" && expected.length > 0 ? expected : undefined);
  } finally {
    await h.server.close();
  }
});

test("Domain B ロールの一覧: 場の間は一覧ごと固める（途中で一覧が替わっても、閉じるまで始めたときのロールの口を呼ぶ）", async () => {
  /** @type {string[]} */
  const events = [];
  const chappy = makeRole("chappy", events, { identity: MODEL_IDENTITIES.chappy });
  const cody = makeRole("cody", events, { identity: MODEL_IDENTITIES.cody });
  let current = [chappy];
  const h = await startServer({ roles: () => current });
  try {
    await post(h.url, "/api/stream/start", { device: "Mic" });
    current = [cody];
    assert.equal((await state(h.url)).brain.identity.id, "chappy", "場の間は固めた一覧の名前");
    await post(h.url, "/api/stream/stop");
    assert.deepEqual(
      events.filter((e) => e.startsWith("cody.")),
      [],
      "場の途中で替わった一覧のロールの口は呼ばない"
    );
    assert.ok(events.includes("chappy.saveFinal:0"));
    assert.equal((await state(h.url)).brain.identity.id, "cody", "閉じたら今の一覧");
    await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.ok(events.includes("cody.renewRecords"));
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.server.close();
  }
});

test("Domain B ロールの一覧（長さ 2・備え）: 場の口・声はロールごとに順に呼ぶ・最後の保存は同じ写しで両方・片方が開けなければ両方畳む", async () => {
  /** @type {string[]} */
  const events = [];
  const a = makeRole("a", events);
  const b = makeRole("b", events);
  const h = await startServer({ roles: [a, b] });
  try {
    await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.deepEqual(events, [
      "a.renewRecords",
      "b.renewRecords",
      "a.voice.prepare:aivis",
      "b.voice.prepare:aivis",
      "a.voice.resources",
      "b.voice.resources",
      "a.openSession",
      "b.openSession",
      "a.connectBody",
      "b.connectBody"
    ]);
    h.ears.hear("一言");
    events.length = 0;
    await post(h.url, "/api/stream/stop");
    assert.deepEqual(events, ["a.closeSession", "b.closeSession", "a.closeBody", "b.closeBody", "a.saveFinal:1", "b.saveFinal:1"]);
    assert.equal(a.saved[0], b.saved[0], "同じ写し");
  } finally {
    await h.server.close();
  }
  /** @type {string[]} */
  const events2 = [];
  const h2 = await startServer({ roles: [makeRole("a", events2), makeRole("b", events2, { openSessionFails: "b の頭が無い" })] });
  try {
    const r = await post(h2.url, "/api/stream/start", { device: "Mic" });
    assert.equal(r.status, 500);
    assert.equal(r.json.error, "b の頭が無い");
    assert.deepEqual(events2.slice(-4), ["a.closeSession", "b.closeSession", "a.closeBody", "b.closeBody"]);
  } finally {
    await h2.server.close();
  }
});

test("Domain B ロールの束の④: 思い出しの係は先頭のロールの recall.run で走る・束に④が無ければ係を作らない", async () => {
  /** @type {string[]} */
  const runs = [];
  /** @type {string[]} */
  const events = [];
  const h = await startServer({
    roles: [
      makeRole("chappy", events, {
        recall: (/** @type {any} */ job) => {
          runs.push(job.request);
          return new Promise(() => {});
        }
      })
    ],
    extra: { recallJudge: () => new Promise(() => {}) }
  });
  try {
    await post(h.url, "/api/stream/start", { device: "Mic" });
    h.orchestrator.record.hooks.onRecallRequest({ request: "前の配信の話", fireId: 1 });
    await waitUntil(() => runs.length === 1);
    assert.deepEqual(runs, ["前の配信の話"]);
  } finally {
    await h.server.close();
  }
  const none = await startServer({ roles: [makeRole("chappy", [])] });
  try {
    await post(none.url, "/api/stream/start", { device: "Mic" });
    assert.doesNotThrow(() => none.orchestrator.record.hooks.onRecallRequest({ request: "x", fireId: 1 }));
  } finally {
    await none.server.close();
  }
});

// ── 4. API と snapshot の experience ───────────────────────────────────────────

test("Domain B API: experience を省けば配信・\"stream\" も配信・閉じている間は null・語彙は stream / discord", async () => {
  assert.deepEqual([...VENUE_EXPERIENCES], ["stream", "discord"]);
  const h = await startServer();
  try {
    assert.equal((await state(h.url)).stream.experience, null);
    const a = await post(h.url, "/api/stream/start", { device: "Mic", experience: "stream" });
    assert.equal(a.status, 200);
    assert.equal(a.json.stream.experience, "stream");
    await post(h.url, "/api/stream/stop");
    const b = await post(h.url, "/api/ears/start", { device: "Mic", experience: null });
    assert.equal(b.status, 200, "別名の道も同じ");
    assert.equal(b.json.stream.experience, "stream");
    await post(h.url, "/api/ears/stop");
  } finally {
    await h.server.close();
  }
});

test("Domain B API: Discord の口が無いのに experience: \"discord\" は 503 で断る（場は開かない・stream.error に残さない）・知らない値は 400", async () => {
  const h = await startServer();
  try {
    const d = await post(h.url, "/api/stream/start", { device: "Mic", experience: "discord" });
    assert.equal(d.status, 503);
    assert.equal(d.json.error, DISCORD_EXPERIENCE_UNAVAILABLE_MESSAGE);
    assert.equal(d.json.state.stream.phase, "closed");
    assert.equal(d.json.state.stream.error, null);
    assert.equal(d.json.state.stream.experience, null);
    assert.equal((await post(h.url, "/api/ears/start", { experience: "discord" })).status, 503);
    const internal = await h.server.startStream({ device: "Mic", experience: "discord" });
    assert.equal(internal.ok, false);
    assert.equal(internal.status, 503);
    for (const bad of ["voice", "Discord", 1, true, {}]) {
      const r = await post(h.url, "/api/stream/start", { device: "Mic", experience: bad });
      assert.equal(r.status, 400, `未知の ${JSON.stringify(bad)}`);
      assert.equal(r.json.error, "invalid experience");
    }
    assert.equal((await h.server.startStream({ experience: "voice" })).status, 400);
    assert.deepEqual(h.events, [], "どの口も呼ばない（場の記録も耳も）");
    // 配信が開いている間の始めるは、体験に関わらず配信の断りの文面（409）。
    await post(h.url, "/api/stream/start", { device: "Mic" });
    const busy = await post(h.url, "/api/stream/start", { device: "Mic", experience: "discord" });
    assert.equal(busy.status, 409);
    assert.equal(busy.json.error, "配信の途中（配信を終えてから始め直す）");
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.server.close();
  }
});

// ── 5. 体験の口（Discord の口は外から渡せる形） ──────────────────────────────────

/**
 * Discord の体験の口の偽物（Domain D で src/discord/ の部品が作る形を、場の段から呼ばれる順で記録する）。人ごとの耳 2 本を
 * 場の口（正本・耳ごとの口・耳の束）で作る。
 * @param {string[]} events @param {{ openFails?: string | null }} [opts]
 */
function makeDiscordMouth(events, opts = {}) {
  /** @type {any} */
  const record = { venue: null, ears: null, people: {} };
  const mouth = {
    prepareEntrance: (/** @type {any} */ request) => {
      events.push(`discord.prepare:${request.experience}`);
      return { ok: true, plan: { channel: "fake-channel" }, voiceKind: "aivis" };
    },
    abortEntrance: () => void events.push("discord.abort"),
    openEntrance: async (/** @type {any} */ plan, /** @type {any} */ venue) => {
      events.push(`discord.open:${plan.channel}`);
      record.venue = venue;
      if (opts.openFails) return { ok: false, reason: opts.openFails };
      const ears = venue.createEars();
      const mouthFor = venue.earTranscriptMouth({ engine: "discord-stt" });
      for (const [key, name, latencyMs] of /** @type {const} */ ([["p1", "たろう", 100], ["p2", "はなこ", 200]])) {
        const person = {
          vad: ears.vadMouth(key),
          async start() {
            events.push(`${key}.start`);
          },
          async dispose() {
            events.push(`${key}.dispose`);
          },
          /** @param {string} text */
          hear(text) {
            const r = venue.transcriptBuffer.append({ startMs: 0, endMs: 900, text, displayName: name, speakerId: `id-${key}` });
            if (r.appended) mouthFor(r.entry, { latencyMs, audioCtx: null });
          }
        };
        ears.add(key, person);
        record.people[key] = person;
      }
      await ears.start();
      record.ears = ears;
      return { ok: true, ears };
    },
    closeEntrance: (/** @type {any} */ info) => void events.push(`discord.close:${JSON.stringify(info)}`),
    afterOpen: () => void events.push("discord.afterOpen"),
    foldAfterOpen: () => void events.push("discord.foldAfterOpen"),
    busyMessage: (/** @type {string} */ phase) => `VC の場（${phase}）`
  };
  return { mouth, record };
}

test("Domain B 体験の口（Discord の偽物）: 同じ場の段で開いて閉じる・人ごとの耳は同じ正本と耳ごとの口で 1 行 1 回・耳の束の喋っているか", async () => {
  /** @type {string[]} */
  const events = [];
  const discord = makeDiscordMouth(events);
  const h = await startServer({
    roles: [makeRole("chappy", events)],
    extra: { experiences: { discord: discord.mouth } }
  });
  const sse = openEvents(h.url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    const r = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal(r.status, 200);
    assert.equal(r.json.stream.experience, "discord");
    assert.deepEqual(events, [
      "chappy.renewRecords",
      "discord.prepare:discord",
      "chappy.voice.prepare:aivis",
      "discord.open:fake-channel",
      "p1.start",
      "p2.start",
      "chappy.voice.resources",
      "chappy.openSession",
      "chappy.connectBody",
      "discord.afterOpen"
    ]);
    assert.deepEqual(h.events.filter((e) => e.startsWith("eyes")), ["eyes.start(old name)", "eyes.start"], "目は場の共通の段");
    assert.equal(h.ears.record.created, 0, "配信の耳は作らない");
    assert.equal(discord.record.venue.transcriptBuffer != null, true);
    assert.equal(discord.record.venue.roles.length, 1);
    // 人ごとの耳 2 本: 同じ正本と同じ耳ごとの口。発火の予定・放送は 1 行 1 回、遅延は耳ごと。
    discord.record.people.p1.hear("一言");
    discord.record.people.p2.hear("二言");
    assert.deepEqual(h.server.getTranscript().map((/** @type {any} */ e) => e.text), ["一言", "二言"]);
    assert.deepEqual(h.scheduler.record.transcripts.map((e) => e.text), ["一言", "二言"]);
    await waitUntil(() => sse.events.filter((e) => e.event === "transcript").length >= 2);
    const you = sse.events.filter((e) => e.event === "transcript");
    assert.deepEqual(you.map((e) => [e.data.text, e.data.displayName, e.data.latencyMs]), [["一言", "たろう", 100], ["二言", "はなこ", 200]]);
    assert.equal(JSON.stringify(sse.events).includes("id-p1"), false, "id は放送に出ない");
    assert.deepEqual(h.logs, [{ engine: "discord-stt", latencyMs: 100 }, { engine: "discord-stt", latencyMs: 200 }]);
    // 耳の束: 誰か 1 人でも喋っていれば喋っている。
    discord.record.people.p1.vad({ type: "speechStart", tMs: 0 });
    discord.record.people.p2.vad({ type: "speechStart", tMs: 0 });
    discord.record.people.p1.vad({ type: "speechEnd", tMs: 10 });
    assert.equal(h.server.getQuietGap()?.userSpeaking, true);
    discord.record.people.p2.vad({ type: "speechEnd", tMs: 20 });
    assert.equal(h.server.getQuietGap()?.userSpeaking, false);
    // 開いている間の断りの文面は体験の口の文面。
    const busy = await post(h.url, "/api/stream/start", {});
    assert.equal(busy.status, 409);
    assert.equal(busy.json.error, "VC の場（open）");
    // 閉じる: 開いたあとの片付け → 目 → 耳の束 → 入口 → 頭のセッション → 器 → 最後の保存。
    events.length = 0;
    h.events.length = 0;
    const stopped = await post(h.url, "/api/stream/stop");
    assert.equal(stopped.status, 200);
    assert.deepEqual(events, [
      "discord.foldAfterOpen",
      "p1.dispose",
      "p2.dispose",
      'discord.close:{"hadEars":true,"shutdown":false}',
      "chappy.closeSession",
      "chappy.closeBody",
      "chappy.saveFinal:2"
    ]);
    assert.deepEqual(h.events.filter((e) => e.startsWith("eyes")), ["eyes.stop(old name)", "eyes.stop"]);
    assert.equal(stopped.json.stream.experience, null);
    // 閉じたあとは配信も開ける。
    const again = await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.equal(again.json.stream.experience, "stream");
    await post(h.url, "/api/stream/stop");
  } finally {
    sse.close();
    await h.server.close();
  }
});

test("Domain B 体験の口（Discord の偽物）: 入口が開けなければ場を開かずに理由を出す（再生器・目は起こさない・正本は手放す）", async () => {
  /** @type {string[]} */
  const events = [];
  const discord = makeDiscordMouth(events, { openFails: "VC に入れない（テスト）" });
  const h = await startServer({ roles: [makeRole("chappy", events)], extra: { experiences: { discord: discord.mouth } } });
  try {
    const r = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal(r.status, 500);
    assert.equal(r.json.error, "VC に入れない（テスト）");
    assert.equal(r.json.state.stream.error, "VC に入れない（テスト）");
    assert.equal(r.json.state.stream.experience, null);
    assert.deepEqual(events, [
      "chappy.renewRecords",
      "discord.prepare:discord",
      "chappy.voice.prepare:aivis",
      "discord.open:fake-channel",
      "chappy.closeBody"
    ]);
    assert.deepEqual(h.events.filter((e) => e.startsWith("eyes")), []);
    assert.deepEqual(h.server.getTranscript(), []);
  } finally {
    await h.server.close();
  }
});

test("Domain B 体験の口: 入口を開く口・閉じる口の無いものは体験の口として受け取らない（\"discord\" は 503 のまま）", async () => {
  const h = await startServer({ extra: { experiences: { discord: { prepareEntrance: () => ({ ok: true }) } } } });
  try {
    const r = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal(r.status, 503);
  } finally {
    await h.server.close();
  }
});

// ── 6. Domain A の持ち越し: 正本が無ければ入口を開かない ───────────────────────────

test("Domain B 正本の防御: 入口を開く時に場の正本が無ければ（開く途中でサーバを閉じた）耳を作らずに開かない", async () => {
  /** @type {(v?: unknown) => void} */
  let release = () => {};
  /** @type {string[]} */
  const events = [];
  const role = makeRole("chappy", events);
  role.voice.prepare = () =>
    new Promise((r) => {
      release = () => r({ ok: true });
    });
  const h = await startServer({ roles: [role] });
  const opening = h.server.startStream({ device: "Mic" });
  await waitUntil(() => h.server.streamStatus().phase === "opening" && h.events.includes("tts.save:aivis"));
  await h.server.close(); // 正本を手放す。
  release();
  const r = await opening;
  assert.equal(r.ok, false);
  assert.equal(r.error, "会話の正本が無い（入口を開けない）");
  assert.equal(h.ears.record.created, 0, "耳に自前の正本を持たせて開かない");
  assert.equal(h.server.streamStatus().phase, "closed");
});
