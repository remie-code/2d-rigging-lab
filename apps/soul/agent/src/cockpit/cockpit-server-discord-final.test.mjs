// @ts-check
/**
 * Discord モード 全体の突き合わせの直し（reviews/discord-mode/final.md §2-1・§3、計画 Status の Domain G の追認 (1)・案 a）—
 * 場が閉じている間に Connect した YouTube の器官が Discord の場の間も生きていても、そのコメントは弾く判定にも会話の正本にも
 * 回さずに捨てる（設計 §4.3「Discord にはコメントが無い」・計画 §5「配信と通話の記録が混ざらない」）。捨てるときは何も出さない
 * （診断もログも出さない）。器官は畳まない（ユーザーの Connect は切らない）。配信の場に戻れば同じ器官のコメントは今まで通り積む。
 *
 * 本物の cockpit-server と本物の src/discord/discord-experience.mjs を、偽の Discord（src/test-support/fake-discord.mjs）でつなぐ。
 * 偽のチャット器官は onMessage の手を覚えて、テストからコメントを流せる（器官の onMessage → ingestChatMessage の道を通す）。
 * 本物の Discord・LLM・外部 API は呼ばない。設定ファイルは OS の一時フォルダだけ（終わったら消す）。テストの id は明らかな偽の値。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCockpitServer } from "./cockpit-server.mjs";
import { createFileSettingsStore } from "./cockpit-settings-store.mjs";
import { createDiscordExperience } from "../discord/discord-experience.mjs";
import { createFakeDiscord } from "../test-support/fake-discord.mjs";
import { createFakeClock } from "../test-support/fake-clock.mjs";
import { createFireScheduler } from "../mind/fire-scheduler.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";

const GUILD = "guild-fake-final1";
const CHANNEL = "channel-fake-final1";
const FAKE_TOKEN = "fake.discord-token_for-final-fix";
const KEY_FILE = ".env.discord-chappy.local";
const VIEWER = "偽の視聴者さん";
const COMMENT = "通話に混ざるコメント（偽）";

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

/** @param {() => boolean} pred @param {number} [timeoutMs] */
async function waitUntil(pred, timeoutMs = 3000) {
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

/** @param {string} url @param {string} path */
async function get(url, path) {
  const r = await fetch(`${url}${path}`);
  return { status: r.status, json: /** @type {any} */ (await r.json()) };
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

/** 偽の耳（配信のマイクの耳と Discord の人ごとの耳）。 */
function makeFakeEars() {
  return (/** @type {any} */ options) => ({
    transcriptBuffer: options.transcriptBuffer,
    async start() {
      if (typeof options.captureFactory === "function") options.captureFactory({ onPcm: () => {} });
    },
    async dispose() {},
    isDisposed: () => false,
    streamMs: () => 0,
    stats: () => ({})
  });
}

/** 偽の orchestrator（fire を記録する）。 */
function makeOrchestrator() {
  const record = { /** @type {any[]} */ fires: [] };
  const factory = () => ({
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
  });
  return { factory, record };
}

/** 本物の発火の予定（偽の時計・タイマは実時間で走らない）。 @param {ReturnType<typeof createFakeClock>} clock */
function makeScheduler(clock) {
  return (/** @type {any} */ options) =>
    createFireScheduler({
      ...options,
      setTimeoutImpl: clock.setTimeoutImpl,
      clearTimeoutImpl: clock.clearTimeoutImpl,
      nowImpl: clock.now,
      rng: () => 0
    });
}

/**
 * 偽のチャット器官。onMessage の手を覚え、`emit(msg)` で今生きている器官からコメントを流す（器官の道を通す）。
 * Connect の回数（sources）と stop の回数（stops）を数える。
 */
function makeChat() {
  const record = { /** @type {string[]} */ sources: [], stops: 0 };
  /** @type {Array<(msg: any) => void>} */
  let handlers = [];
  const factory = (/** @type {{ source: string }} */ opts) => {
    record.sources.push(opts.source);
    let state = "idle";
    /** @type {Array<(msg: any) => void>} */
    const mine = [];
    return {
      async start() {
        state = "live";
      },
      stop() {
        record.stops += 1;
        state = "dead";
        handlers = handlers.filter((h) => !mine.includes(h));
      },
      getState: () => state,
      getSource: () => opts.source,
      onMessage: (/** @type {(msg: any) => void} */ fn) => {
        mine.push(fn);
        handlers.push(fn);
        return () => {
          handlers = handlers.filter((h) => h !== fn);
        };
      },
      onStatus: () => () => {},
      onDiagnostic: () => () => {},
      async idle() {}
    };
  };
  /** @param {{ text: string; displayName?: string; messageId?: string }} msg */
  const emit = (msg) => {
    assert.ok(handlers.length > 0, "器官の onMessage の手が生きている");
    for (const h of [...handlers]) h(msg);
  };
  return { factory, record, emit, handlerCount: () => handlers.length };
}

/** 門（開くまで待たせる）。 */
function makeGate() {
  /** @type {() => void} */
  let release = () => {};
  let armed = false;
  /** @type {Promise<void>} */
  let opened = Promise.resolve();
  return {
    arm() {
      armed = true;
      opened = new Promise((r) => {
        release = () => {
          armed = false;
          r();
        };
      });
    },
    wait: () => (armed ? opened : Promise.resolve()),
    release: () => release(),
    isArmed: () => armed
  };
}

/**
 * ロールの束の偽物。saveFinal の転写を finals に残す。renewRecords / openSession / saveFinal は門で止められる。
 * @param {{ renew: ReturnType<typeof makeGate>; session: ReturnType<typeof makeGate>; save: ReturnType<typeof makeGate>; waiting: Set<string>; finals: any[][] }} p
 */
function makeRole(p) {
  /** @param {string} name @param {ReturnType<typeof makeGate>} gate */
  const held = async (name, gate) => {
    if (!gate.isArmed()) return;
    p.waiting.add(name);
    await gate.wait();
    p.waiting.delete(name);
  };
  return {
    id: () => "chappy",
    identity: () => MODEL_IDENTITIES.chappy,
    discordBotKeyFile: () => KEY_FILE,
    discordBotKeyFileRefused: () => false,
    hooks: {
      renewRecords: async () => {
        await held("renewRecords", p.renew);
      },
      openSession: async () => {
        await held("openSession", p.session);
        return { ok: true };
      },
      connectBody: () => ({ ok: true }),
      closeSession: () => {},
      closeBody: () => {},
      saveFinal: async (/** @type {any[]} */ transcript) => {
        p.finals.push(Array.isArray(transcript) ? transcript.map((e) => ({ ...e })) : []);
        await held("saveFinal", p.save);
      }
    },
    voice: { prepare: () => ({ ok: true }), startResources: () => {} },
    recall: null
  };
}

/** 本物の server + 本物の Discord の体験の口 + 偽の Discord + 偽のチャット器官。 */
async function startServer() {
  const dir = mkdtempSync(join(tmpdir(), "discord-final-server-"));
  const settingsPath = join(dir, "cockpit-settings.local.json");
  const settings = createFileSettingsStore({ path: settingsPath });
  settings.setDiscordPrep({ guildId: GUILD, channelId: CHANNEL, sttEngine: "elevenlabs" });
  /** @type {string[]} */
  const logs = [];
  const fake = createFakeDiscord({
    guilds: [{ id: GUILD, name: "試しのサーバー", channels: [{ id: CHANNEL, name: "一般" }], members: {} }]
  });
  const discord = createDiscordExperience({
    settings,
    currentKeyFile: () => KEY_FILE,
    currentKeyFileRefused: () => false,
    loadToken: () => ({ ok: true, token: FAKE_TOKEN }),
    loadLibraries: fake.loadLibraries,
    log: (line) => logs.push(line),
    loginTimeoutMs: 300,
    readyTimeoutMs: 300
  });
  const clock = createFakeClock();
  const orchestrator = makeOrchestrator();
  const chat = makeChat();
  const gates = { renew: makeGate(), session: makeGate(), save: makeGate() };
  /** @type {Set<string>} */
  const waiting = new Set();
  /** @type {any[][]} */
  const finals = [];
  /** @type {any[]} */
  const guardCalls = [];
  /** @type {any[]} */
  const reactCalls = [];
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (makeFakeEars()),
    fireOrchestratorFactory: /** @type {any} */ (orchestrator.factory),
    fireSchedulerFactory: /** @type {any} */ (makeScheduler(clock)),
    chatClientFactory: /** @type {any} */ (chat.factory),
    commentGuard: (/** @type {any} */ request) => {
      guardCalls.push(request);
      return { pass: true, kind: "ok" };
    },
    commentReactJudge: async (/** @type {any} */ request) => {
      reactCalls.push(request);
      return { choice: "ignore", probs: { react: 0.1, ignore: 0.9 }, latencyMs: 5 };
    },
    speakNowJudge: async () => ({ choice: "wait", probs: { wait: 0.9 }, latencyMs: 5 }),
    speakStartModeInitial: "speak-now",
    selfFireInitialEnabled: true,
    roles: [makeRole({ ...gates, waiting, finals })],
    experiences: { discord },
    elevenLabsApiKeyProvider: () => ({ ok: true, apiKey: "fake-elevenlabs-key" }),
    localSttModelCheck: () => ({ ok: true }),
    onEyesStart: () => {},
    onEyesStop: () => {}
  });
  const url = await server.listen(0);
  return {
    server,
    url,
    logs,
    chat,
    gates,
    waiting,
    finals,
    guardCalls,
    reactCalls,
    async cleanup() {
      try {
        await server.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  };
}

/** @param {Array<{ event: string; data: any }>} events */
const viewerTranscripts = (events) => events.filter((e) => e.event === "transcript" && e.data && e.data.speaker === "viewer");
/** コメントの取り込みに関わる診断（chatBufferAbsent・chatIngestError）と、弾いた知らせ。 @param {Array<{ event: string; data: any }>} events */
const commentNoise = (events) =>
  events.filter(
    (e) =>
      (e.event === "diagnostic" && e.data && (e.data.type === "chatBufferAbsent" || e.data.type === "chatIngestError")) ||
      (e.event === "chatDiagnostic" && e.data && e.data.kind === "commentRejected")
  );
/** 名前も本文も、どの放送・ログにも出ていない。 @param {Array<{ event: string; data: any }>} events @param {string[]} logs */
function assertNoCommentLeak(events, logs) {
  const wire = JSON.stringify(events) + JSON.stringify(logs);
  assert.equal(wire.includes(VIEWER), false, "視聴者の名前を出さない");
  assert.equal(wire.includes(COMMENT), false, "コメントの本文を出さない");
}

// ── 1. 閉じている間に Connect → Discord の場 → コメントが届く → 何にも入らない ─────────────────────────────

test("全体の直し: 閉じている間に Connect した器官のコメントは、Discord の場では正本・放送・判定・最後の保存のどれにも入らない（器官は畳まない）", async () => {
  const h = await startServer();
  const sse = openEvents(h.url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    // 場が閉じている間は今まで通りつなげる。
    assert.equal((await post(h.url, "/api/chat/connect", { source: "fake-video-closed" })).status, 200);
    assert.deepEqual(h.chat.record.sources, ["fake-video-closed"]);
    const opened = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal(opened.status, 200, JSON.stringify(opened.json.error));
    assert.equal(opened.json.stream.experience, "discord");

    // 器官の onMessage と同じ道でコメントが届く。
    h.chat.emit({ text: COMMENT, displayName: VIEWER, messageId: "msg-final-1" });
    h.chat.emit({ text: `${COMMENT}その2`, displayName: VIEWER, messageId: "msg-final-2" });
    await tick(40);

    assert.deepEqual(
      h.server.getTranscript().filter((/** @type {any} */ e) => e.speaker === "viewer"),
      [],
      "正本に viewer の行が無い"
    );
    const snap = (await get(h.url, "/api/state")).json;
    assert.deepEqual(
      snap.transcripts.filter((/** @type {any} */ e) => e.speaker === "viewer"),
      [],
      "snapshot の transcripts に viewer の行が無い"
    );
    assert.deepEqual(viewerTranscripts(sse.events), [], "SSE の transcript に viewer が出ない");
    assert.deepEqual(commentNoise(sse.events), [], "捨てるときは診断も弾いた知らせも出さない");
    assert.equal(h.guardCalls.length, 0, "弾く判定（commentGuard）を呼ばない");
    assert.equal(h.reactCalls.length, 0, "コメント反応の判定を呼ばない");

    // 閉じる: 最後の保存の転写にも viewer の行が無い。
    assert.equal((await post(h.url, "/api/stream/stop")).status, 200);
    assert.equal(h.finals.length, 1, "最後の保存を 1 回頼む");
    assert.deepEqual(
      h.finals[0].filter((e) => e.speaker === "viewer"),
      [],
      "saveFinal の転写に viewer の行が無い"
    );
    // 器官は畳まれていない（ユーザーの Connect は切らない）。
    assert.equal(h.chat.record.stops, 0, "器官を stop しない");
    assert.deepEqual(h.chat.record.sources, ["fake-video-closed"], "器官を作り直さない");
    assert.ok(h.chat.handlerCount() > 0, "onMessage の手は生きたまま");
    assertNoCommentLeak(sse.events, h.logs);
  } finally {
    sse.close();
    await h.cleanup();
  }
});

// ── 2. 同じ器官のまま Discord を閉じて配信を始める → 今どおり積まれる ────────────────────────────────

test("全体の直し: 同じ器官のまま Discord を閉じて配信を始めると、コメントは今まで通り判定を通って積まれ・放送される", async () => {
  const h = await startServer();
  const sse = openEvents(h.url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    assert.equal((await post(h.url, "/api/chat/connect", { source: "fake-video-closed" })).status, 200);
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    h.chat.emit({ text: COMMENT, displayName: VIEWER, messageId: "msg-final-discord" });
    await tick(30);
    assert.equal((await post(h.url, "/api/stream/stop")).status, 200);
    assert.equal(h.guardCalls.length, 0);

    // 配信の場: 閉じている間に Connect した器官をそのまま持ち込む（作り直さない）。
    const stream = await post(h.url, "/api/stream/start", { device: "Mic" });
    assert.equal(stream.status, 200, JSON.stringify(stream.json.error));
    assert.equal(stream.json.stream.experience, "stream");
    assert.deepEqual(h.chat.record.sources, ["fake-video-closed"], "同じ器官のまま");
    assert.equal(h.chat.record.stops, 0);

    h.chat.emit({ text: "配信のコメント（偽）", displayName: VIEWER, messageId: "msg-final-stream" });
    await waitUntil(() => viewerTranscripts(sse.events).length === 1);
    assert.equal(h.guardCalls.length, 1, "弾く判定を通る");
    assert.equal(h.guardCalls[0].text, "配信のコメント（偽）");
    const viewers = h.server.getTranscript().filter((/** @type {any} */ e) => e.speaker === "viewer");
    assert.equal(viewers.length, 1, "正本に積まれる");
    assert.equal(viewers[0].text, "配信のコメント（偽）");
    assert.equal(viewers[0].displayName, VIEWER);
    const wire = viewerTranscripts(sse.events)[0].data;
    assert.equal(wire.text, "配信のコメント（偽）", "放送される");
    assert.equal(wire.commentId, "msg-final-stream");
    // speak-now の配信では今まで通り反応の判定へ回る。
    await waitUntil(() => h.reactCalls.length === 1);
    await post(h.url, "/api/stream/stop");
    assert.equal(
      h.finals[h.finals.length - 1].filter((e) => e.speaker === "viewer").length,
      1,
      "配信の最後の保存には viewer の行が入る（今まで通り）"
    );
  } finally {
    sse.close();
    await h.cleanup();
  }
});

// ── 3. Discord の開きかけ・閉じかけに届いたコメントも捨てる ─────────────────────────────────────

test("全体の直し: Discord の開きかけ（正本ができる前・できた後）と閉じかけに届いたコメントも、何も出さずに捨てる", async () => {
  const h = await startServer();
  const sse = openEvents(h.url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    assert.equal((await post(h.url, "/api/chat/connect", { source: "fake-video-closed" })).status, 200);

    // 開きかけ（段 2: 正本ができる前）。
    h.gates.renew.arm();
    h.gates.session.arm();
    const opening = post(h.url, "/api/stream/start", { experience: "discord" });
    await waitUntil(() => h.waiting.has("renewRecords"));
    assert.equal((await get(h.url, "/api/state")).json.stream.phase, "opening");
    h.chat.emit({ text: COMMENT, displayName: VIEWER, messageId: "msg-final-opening-1" });
    await tick(20);
    // 開きかけ（段 8: 正本ができた後・頭のセッションを作っている間）。
    h.gates.renew.release();
    await waitUntil(() => h.waiting.has("openSession"));
    assert.equal((await get(h.url, "/api/state")).json.stream.phase, "opening");
    h.chat.emit({ text: COMMENT, displayName: VIEWER, messageId: "msg-final-opening-2" });
    await tick(20);
    assert.deepEqual(
      h.server.getTranscript().filter((/** @type {any} */ e) => e.speaker === "viewer"),
      [],
      "開きかけの正本に viewer の行が無い"
    );
    h.gates.session.release();
    const opened = await opening;
    assert.equal(opened.status, 200, JSON.stringify(opened.json.error));
    assert.equal(opened.json.stream.experience, "discord");
    assert.deepEqual(
      opened.json.transcripts.filter((/** @type {any} */ e) => e.speaker === "viewer"),
      [],
      "開いたあとの snapshot にも viewer の行が無い"
    );

    // 閉じかけ（最後の保存を待っている間）。
    h.gates.save.arm();
    const closing = post(h.url, "/api/stream/stop");
    await waitUntil(() => h.waiting.has("saveFinal"));
    assert.equal((await get(h.url, "/api/state")).json.stream.phase, "closing");
    h.chat.emit({ text: COMMENT, displayName: VIEWER, messageId: "msg-final-closing" });
    await tick(20);
    h.gates.save.release();
    assert.equal((await closing).status, 200);

    assert.deepEqual(
      h.finals[0].filter((e) => e.speaker === "viewer"),
      [],
      "saveFinal の転写に viewer の行が無い"
    );
    assert.deepEqual(viewerTranscripts(sse.events), [], "SSE の transcript に viewer が出ない");
    assert.deepEqual(commentNoise(sse.events), [], "開きかけ・閉じかけでも診断（chatBufferAbsent など）を出さない");
    assert.equal(h.guardCalls.length, 0, "弾く判定を呼ばない");
    assert.equal(h.reactCalls.length, 0, "コメント反応の判定を呼ばない");
    assert.equal(h.chat.record.stops, 0, "器官を stop しない");
    assertNoCommentLeak(sse.events, h.logs);

    // 閉じたあと（場が無い）は今まで通り chatBufferAbsent の診断（配信の既存の仕様・変えない）。
    h.chat.emit({ text: "閉じたあとのコメント（偽）", displayName: "別の偽の視聴者" });
    await waitUntil(() => sse.events.some((e) => e.event === "diagnostic" && e.data.type === "chatBufferAbsent"));
  } finally {
    sse.close();
    await h.cleanup();
  }
});
