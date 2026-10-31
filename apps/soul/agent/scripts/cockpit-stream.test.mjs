// @ts-check
// 配信の組み直し Domain D: 場（配信を始める / 終える）の約束のテスト（stream-restructure.md §3・scope §19・wave 計画 §1 Domain D）。
// 本物の cockpit-server（HTTP）と、cockpit.mjs の場の口（createStreamVenueHooks）・保存の係（createMemoryRecorder）・
// 記憶の置き場（createRoleMemoryPlaces）・器（createLazyChannel）・終わりの手順（createCockpitShutdown）を、偽物の耳・
// orchestrator・判定・器の接続・頭のセッション・②でつなぐ。実データ・本物の LLM・外部 API・マイクには触れない
// （ファイルを書くのは OS の一時フォルダだけ）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createStreamVenueHooks,
  createMemoryRecorder,
  createRoleMemoryPlaces,
  createLazyChannel,
  createCockpitShutdown,
  BODY_CONNECT_FAILED_MESSAGE,
  BODY_URL_NOT_SET_MESSAGE,
  SHUTDOWN_MEMORY_TIMEOUT_MS
} from "./cockpit.mjs";
import { createCockpitServer, createInMemorySettingsStore } from "../src/cockpit/cockpit-server.mjs";
import { createTranscriptBuffer } from "../src/ears/transcript-buffer.mjs";
import { createFireScheduler } from "../src/mind/fire-scheduler.mjs";
import { createSessionUsageLog } from "../src/mind/session-usage-log.mjs";

// ── 偽物 ─────────────────────────────────────────────────────────────

/** microtask / I/O を一巡させる。 */
const settle = () => new Promise((r) => setImmediate(r));

/**
 * 偽の耳（転写の正本は本物の transcript-buffer・onAppend で onTranscript を通す = ear-pipeline と同じ購読）。
 * @param {string[]} [events]
 */
function makeEars(events = []) {
  const record = {
    /** @type {any} */ options: null,
    /** @type {any} */ buffer: null,
    created: 0,
    disposed: 0,
    /** @type {Error | null} */ startShouldThrow: null
  };
  const factory = (/** @type {any} */ options) => {
    record.created += 1;
    record.options = options;
    const buffer = createTranscriptBuffer({ nowImpl: () => 1000 });
    record.buffer = buffer;
    buffer.onAppend((entry) => options.onTranscript(entry, { latencyMs: 10, audioCtx: null }));
    return {
      transcriptBuffer: buffer,
      async start() {
        if (record.startShouldThrow) throw record.startShouldThrow;
        events.push("ears.start");
      },
      async dispose() {
        record.disposed += 1;
        events.push("ears.dispose");
      },
      isDisposed: () => false,
      streamMs: () => 0,
      stats: () => ({})
    };
  };
  return { factory, record };
}

/** 偽の orchestrator（キル・復帰・状態を記録）。 @param {string[]} [events] */
function makeOrchestrator(events = []) {
  const record = { state: "idle", fireCount: 0, killCount: 0, reviveCount: 0, /** @type {any[]} */ fires: [], /** @type {any} */ hooks: null };
  const factory = (/** @type {any} */ hooks) => {
    record.hooks = hooks;
    return {
    async fire(/** @type {any} */ options) {
      record.fireCount += 1;
      record.fires.push(options);
      return { fired: true };
    },
    getState: () => record.state,
    async kill() {
      record.killCount += 1;
      events.push("orchestrator.kill");
      return { killed: true, severed: record.state !== "idle" };
    },
    revive() {
      record.reviveCount += 1;
      events.push("orchestrator.revive");
    },
    getKilled: () => false,
    async interrupt() {
      return { interrupted: true };
    },
    dispose() {}
    };
  };
  return { factory, record };
}

/** 判定の偽物（結果を手で返す）。 */
function makeJudge() {
  /** @type {Array<{ request: any; resolve: (r: any) => void }>} */
  const calls = [];
  const judge = (/** @type {any} */ request) =>
    new Promise((resolve) => {
      calls.push({ request, resolve });
    });
  return { judge, calls };
}

/** 偽のチャット器官（工場の呼び出しと stop を記録）。 @param {string[]} events @param {{ startThrows?: boolean }} [opts] */
function makeChat(events, opts = {}) {
  const record = { created: 0, stopped: 0, /** @type {string[]} */ sources: [] };
  const factory = (/** @type {{ source: string }} */ { source }) => {
    record.created += 1;
    record.sources.push(source);
    return {
      async start() {
        events.push(`chat.start:${source}`);
        if (opts.startThrows) throw new Error("network down (fake)");
      },
      stop() {
        record.stopped += 1;
        events.push("chat.stop");
      },
      getState: () => "live",
      getSource: () => source,
      onMessage: () => () => {},
      onStatus: () => () => {},
      onDiagnostic: () => () => {}
    };
  };
  return { factory, record };
}

/** 偽のタイマ（fire-scheduler の setTimeoutImpl / clearTimeoutImpl に注入する）。 */
function makeTimers() {
  /** @type {Map<number, () => void>} */
  const pending = new Map();
  let nextId = 1;
  return {
    pending,
    setTimeoutImpl: /** @type {any} */ ((/** @type {() => void} */ fn) => {
      const id = nextId++;
      pending.set(id, fn);
      return id;
    }),
    clearTimeoutImpl: /** @type {any} */ ((/** @type {number} */ id) => {
      pending.delete(id);
    }),
    /** 今張られているタイマを全部鳴らす（鳴らした数を返す）。 */
    runAll() {
      const due = [...pending.entries()];
      pending.clear();
      for (const [, fn] of due) fn();
      return due.length;
    }
  };
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

/**
 * cockpit.mjs の main() と同じ並びで、本物の場の口・保存の係・記憶の置き場を組む（ファイルには書かない）。
 * @param {object} [over]
 * @param {string[]} [over.events]
 * @param {{ current: any }} [over.roleRef]  今のロール（{ id, name: { canonical }, body }）。
 * @param {any} [over.channel]  器（{ getUrl, connect, close }）。
 * @param {(entries: any[], place: any) => Promise<any>} [over.writeImpl]  ②（既定はすぐ書いたことにする）。
 * @param {number} [over.memoryTimeoutMs]
 */
function makeVenue(over = {}) {
  const events = over.events ?? [];
  const roleRef = over.roleRef ?? { current: { id: "chappy", name: { canonical: "チャッピー" }, body: false } };
  /** @type {any[]} */
  const usageLogs = [];
  /** @type {Array<{ dir: string; startedAtMs: number }>} */
  const identities = [];
  /** @type {Array<{ entries: string[]; place: any }>} */
  const written = [];
  let clock = Date.UTC(2026, 9, 31, 3, 0, 0);
  const sessions = { opened: 0, closed: 0, live: false };
  /** @type {any} */
  let server = null;
  const memoryPlaces = createRoleMemoryPlaces({
    root: join("C:", "tmp", "stream-venue-test"),
    currentRole: () => roleRef.current,
    startedAtMs: clock,
    prepareImpl: async (/** @type {any} */ options) => {
      events.push(`memory.prepare:${options.dir.split(/[\\/]/).pop()}`);
      return { ok: true };
    },
    createIdentityImpl: (/** @type {any} */ options) => {
      identities.push({ dir: options.dir, startedAtMs: options.startedAtMs });
      return { get: () => ({ dateJst: "2026-10-31", baseName: `base-${options.startedAtMs}` }) };
    }
  });
  /** @type {any} */
  let venue = null;
  const recorder = createMemoryRecorder({
    getLiveEntries: () => (server ? server.getTranscript() : []),
    getPlace: () => memoryPlaces.place(),
    writeImpl:
      over.writeImpl ??
      (async (entries, place) => {
        written.push({ entries: entries.map((e) => e.text), place });
        events.push(`memory.write:${entries.length}`);
        return { written: true };
      }),
    onSaved: (info) => venue.noteSaved(info)
  });
  venue = createStreamVenueHooks({
    memoryPlaces,
    memoryRecorder: recorder,
    renewUsageLog: (startedAtMs) => {
      usageLogs.push(startedAtMs);
      events.push("usageLog.renew");
    },
    openSession: () => {
      sessions.opened += 1;
      sessions.live = true;
      events.push("session.open");
    },
    closeSession: async () => {
      if (sessions.live) sessions.closed += 1;
      sessions.live = false;
      events.push("session.close");
    },
    hasBody: () => roleRef.current.body !== false,
    channel: over.channel ?? {
      getUrl: () => {
        events.push("channel.getUrl");
        return "ws://127.0.0.1:1/control";
      },
      connect: async () => {
        events.push("channel.connect");
      },
      close: async () => {
        events.push("channel.close");
      }
    },
    isStreamOpen: () => server != null && server.streamStatus().phase === "open",
    getEntries: () => (server ? server.getTranscript() : []),
    nowImpl: () => (clock += 60_000),
    ...(over.memoryTimeoutMs != null ? { memoryTimeoutMs: over.memoryTimeoutMs } : {})
  });
  return {
    events,
    roleRef,
    usageLogs,
    identities,
    written,
    sessions,
    memoryPlaces,
    recorder,
    venue,
    /** @param {any} s */
    attach(s) {
      server = s;
    }
  };
}

/**
 * 本物の server に場の口を渡して立てる。
 * @param {ReturnType<typeof makeVenue>} v
 * @param {object} [extra]
 */
async function startServer(v, extra = {}) {
  const ears = makeEars(v.events);
  const orchestrator = makeOrchestrator(v.events);
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    fireOrchestratorFactory: /** @type {any} */ (orchestrator.factory),
    streamHooks: v.venue.hooks,
    memoryStatus: () => ({ lastRecordAtMs: v.venue.lastRecordAtMs(), recording: v.recorder.isRecording() }),
    onMemoryRecord: () => v.recorder.record(),
    onEarsStarted: () => v.events.push("eyes+voice.start"),
    onEarsStopped: () => v.events.push("eyes.stop"),
    ...extra
  });
  v.attach(server);
  const url = await server.listen(0);
  return { server, url, ears, orchestrator };
}

/** 偽の役（ロールの選択の口）。 */
function makeRoleWiring(roleRef) {
  /** @type {string[]} */
  const calls = [];
  return {
    calls,
    onSetRole: async (/** @type {string} */ id) => {
      calls.push(id);
      roleRef.current = { id, name: { canonical: id === "cody" ? "コーディ" : "チャッピー" }, body: roleRef.current.body };
      return { ok: true };
    },
    roleStatus: () => ({ id: roleRef.current.id, displayName: roleRef.current.name.canonical, brain: "codex", body: roleRef.current.body, roles: [] })
  };
}

// ── 1. 始めるの順と中身 ─────────────────────────────────────────────────

test("配信を始める: ロールを固める → 場の記録を作り直す → KILL を OFF → 積み残しを捨てる → 耳・目・声 → 頭のセッション → 器 → YouTube の順", async () => {
  const v = makeVenue({ roleRef: { current: { id: "chappy", name: { canonical: "チャッピー" }, body: true } } });
  const chat = makeChat(v.events);
  /** @type {number} */
  let schedulersMade = 0;
  const { server, url, orchestrator } = await startServer(v, {
    chatClientFactory: chat.factory,
    chatSourceStatus: () => ({ source: "https://youtube.example/live" }),
    fireSchedulerFactory: (/** @type {any} */ opts) => {
      schedulersMade += 1;
      v.events.push("scheduler.create");
      return createFireScheduler(opts);
    }
  });
  try {
    // 場が閉じている間に KILL を ON にしておく（始めるで OFF に戻る）。
    await post(url, "/api/kill", { killed: true });
    assert.equal((await state(url)).killed, true);
    assert.equal((await state(url)).stream.phase, "closed");
    v.events.length = 0;
    const started = await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal(started.status, 200);
    assert.equal(started.json.stream.phase, "open");
    assert.equal(started.json.stream.error, null);
    assert.equal(started.json.killed, false, "KILL は場の始まりで OFF に戻る");
    assert.equal(started.json.ears, "listening");
    assert.equal(started.json.chat.connected, true, "保存してある YouTube の URL があればつなぐ");
    assert.deepEqual(v.events, [
      "usageLog.renew",
      "memory.prepare:chappy",
      "orchestrator.revive",
      "scheduler.create",
      "ears.start",
      "eyes+voice.start",
      "session.open",
      "channel.getUrl",
      "channel.connect",
      "chat.start:https://youtube.example/live"
    ]);
    assert.equal(orchestrator.record.reviveCount, 1, "始めるが orchestrator のキルも戻す");
    assert.equal(schedulersMade, 2, "発火の予定は始めるのたびに作り直す（起動時の 1 つ + 始めるの 1 つ）");
    assert.equal(v.sessions.opened, 1, "頭のセッションは場の始まりで作る（最初の発火まで遅らせない）");
  } finally {
    await server.close();
  }
});

test("配信を始める: 記憶の本体のファイル名・頭の文脈の記録のファイルは場ごとに新しくなる（置き場の準備も場の始まりで待つ）", async () => {
  const v = makeVenue();
  const { server, url } = await startServer(v);
  try {
    assert.equal(v.identities.length, 0, "起動しただけでは置き場を作らない");
    await post(url, "/api/stream/start", { device: "Mic" });
    const first = v.memoryPlaces.place();
    assert.ok(first);
    assert.equal(first.streamNo, 1);
    await post(url, "/api/stream/stop");
    await post(url, "/api/stream/start", { device: "Mic" });
    const second = v.memoryPlaces.place();
    assert.ok(second);
    assert.notEqual(second, first);
    assert.equal(second.streamNo, 2);
    assert.equal(v.identities.length, 2);
    assert.notEqual(v.identities[0].startedAtMs, v.identities[1].startedAtMs, "本体のファイル名は場の始まりの時刻から作る");
    assert.notEqual(first.streamRecord.get().baseName, second.streamRecord.get().baseName);
    assert.equal(v.usageLogs.length, 2, "頭の文脈の記録も場ごとに作り直す");
    assert.notEqual(v.usageLogs[0], v.usageLogs[1]);
    assert.deepEqual(v.events.filter((e) => e.startsWith("memory.prepare")), ["memory.prepare:chappy", "memory.prepare:chappy"]);
  } finally {
    await server.close();
  }
});

test("頭の文脈の記録（本物の createSessionUsageLog・一時フォルダ）: 場の始まりの時刻ごとに別のファイルになる", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "stream-usage-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  /** @type {any[]} */
  const logs = [];
  const venue = createStreamVenueHooks({
    memoryPlaces: { beginStream() {}, place: () => null, streamNo: () => 0 },
    memoryRecorder: { record: async () => {}, whenIdle: async () => {}, isRecording: () => false },
    renewUsageLog: (startedAtMs) => logs.push(createSessionUsageLog({ dir, startedAtMs })),
    openSession: () => {},
    closeSession: async () => {},
    hasBody: () => false,
    channel: { getUrl: () => null, connect: async () => {}, close: async () => {} },
    nowImpl: (() => {
      let now = Date.UTC(2026, 9, 31, 12, 0, 0);
      return () => (now += 3_600_000);
    })()
  });
  await venue.hooks.renewRecords();
  await venue.hooks.renewRecords();
  assert.equal(logs.length, 2);
  assert.notEqual(logs[0].path, logs[1].path);
  logs[0].append({ type: "test", n: 1 });
  logs[1].append({ type: "test", n: 2 });
  await Promise.all(logs.map((l) => l.flush()));
  assert.equal(existsSync(logs[0].path) && existsSync(logs[1].path), true);
});

test("配信を始める: 前の場の積み残し（走っている speak-now の判定・忙しい間の積み残し・取っておいたコメント・弾く判定の待ち）は次の場に混ざらない", async () => {
  const v = makeVenue();
  const speakJudge = makeJudge();
  const reactJudge = makeJudge();
  /** @type {Array<(d: any) => void>} */
  const guards = [];
  const { server, url, ears, orchestrator } = await startServer(v, {
    selfFireInitialEnabled: true,
    speakStartModeInitial: "speak-now",
    speakNowJudge: speakJudge.judge,
    commentReactJudge: reactJudge.judge,
    nowImpl: () => 1000, // 偽の耳の appendedAtMs（1000）と同じ時計 = 判定の窓に入る。
    commentGuard: () => new Promise((resolve) => guards.push(resolve))
  });
  try {
    await post(url, "/api/stream/start", { device: "Mic" });
    // 走っている判定（返事待ち）を 1 つ作る。
    ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "これどう思う？", speaker: "you" });
    await settle();
    assert.equal(speakJudge.calls.length, 1);
    // 忙しい間の積み残しと、取っておいたコメントと、弾く判定の待ちを作る。
    orchestrator.record.state = "speaking";
    ears.record.buffer.append({ startMs: 1000, endMs: 2000, text: "あとで答えて", speaker: "you" });
    server.ingestChatMessage({ text: "こんにちは", displayName: "moco", messageId: "c1" });
    await settle();
    guards[0]({ pass: true, kind: "ok", latencyMs: 10 });
    await settle();
    server.ingestChatMessage({ text: "まだ判定中", displayName: "moco", messageId: "c2" });
    await settle();
    assert.equal(server.getQuietGap()?.judging, true, "積み残しがある");
    orchestrator.record.state = "idle";
    // 終えて、始め直す。
    await post(url, "/api/stream/stop");
    await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal(server.getQuietGap()?.judging, false, "積み残しは捨てられている");
    // 前の場の判定の結果がいま返っても、新しい場では発火しない。
    const firesBefore = orchestrator.record.fireCount;
    speakJudge.calls[0].resolve({ choice: "respond", probs: { respond: 0.9 }, latencyMs: 5 });
    guards[1]?.({ pass: true, kind: "ok", latencyMs: 10 });
    await settle();
    await settle();
    assert.equal(orchestrator.record.fireCount, firesBefore, "前の場の判定で発火しない");
    assert.deepEqual(ears.record.buffer.all().map((e) => e.text), [], "前の場のコメントは新しい場の転写に積まれない");
  } finally {
    await server.close();
  }
});

test("配信を始める: 思い出しの係は作り直す（前の場で走っていた④の結果は次の場に届けない）", async () => {
  const v = makeVenue();
  /** @type {Array<(r: any) => void>} */
  const runs = [];
  const { server, url, orchestrator } = await startServer(v, {
    selfFireInitialEnabled: true,
    recallRunner: () => new Promise((resolve) => runs.push(resolve)),
    recallJudge: async () => ({ answers: { avoid: { choice: "no", probability: 0.1 } }, latencyMs: 1 })
  });
  try {
    await post(url, "/api/stream/start", { device: "Mic" });
    // ①の返事の思い出しの目印 → 係が④を走らせる（返事待ちのまま場を終える）。
    orchestrator.record.hooks.onRecallRequest({ request: "前に話した宝箱の話", fireId: 1 });
    await settle();
    assert.equal(runs.length, 1);
    await post(url, "/api/stream/stop");
    await post(url, "/api/stream/start", { device: "Mic" });
    const firesBefore = orchestrator.record.fireCount;
    runs[0]({ found: true, summary: "宝箱は右の部屋にあった" });
    await settle();
    await settle();
    assert.equal(orchestrator.record.fireCount, firesBefore, "前の場の④の結果で発火しない");
    // 新しい場の係は普通に動く。
    orchestrator.record.hooks.onRecallRequest({ request: "新しい頼み", fireId: 2 });
    await settle();
    assert.equal(runs.length, 2);
  } finally {
    await server.close();
  }
});

// ── 2. 体ありで器につながらない / 体なし ─────────────────────────────────────

test("配信を始める（体あり）: 器につながらなければ場は開かず「runtime-player が起動していないか、channel が開いていない」を返し、起こしたものを畳む", async () => {
  const events = /** @type {string[]} */ ([]);
  const roleRef = { current: { id: "chappy", name: { canonical: "チャッピー" }, body: true } };
  // 本物の器（createLazyChannel）に、つながらない接続の口を渡す（runtime-player が起動していない代わり）。
  const lazy = createLazyChannel("ws://127.0.0.1:1/control", {
    connectImpl: async () => {
      events.push("channel.connect");
      throw Object.assign(new Error("connect ECONNREFUSED"), { code: "channel_socket_error" });
    }
  });
  const v = makeVenue({
    events,
    roleRef,
    channel: {
      getUrl: () => lazy.getUrl(),
      connect: () => lazy.connect(),
      close: async () => {
        events.push("channel.close");
        await lazy.close();
      }
    }
  });
  const role = makeRoleWiring(roleRef);
  const { server, url, ears } = await startServer(v, { onSetRole: role.onSetRole, roleStatus: role.roleStatus });
  try {
    const started = await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal(started.status, 500);
    assert.equal(started.json.error, BODY_CONNECT_FAILED_MESSAGE);
    assert.match(started.json.error, /runtime-player が起動していないか、channel が開いていない/);
    const s = started.json.state;
    assert.equal(s.stream.phase, "closed", "場は開かない");
    assert.equal(s.stream.error, BODY_CONNECT_FAILED_MESSAGE, "メイン画面から押したときにも見える所（snapshot）に残る");
    assert.equal(s.ears, "stopped");
    assert.equal(ears.record.disposed, 1, "起こした耳は畳む");
    assert.equal(v.sessions.opened, 1);
    assert.equal(v.sessions.live, false, "作った頭のセッションは畳む");
    assert.ok(events.includes("eyes.stop"), "目も止める");
    assert.ok(events.indexOf("channel.connect") < events.indexOf("channel.close"));
    assert.equal(lazy.connectionStatus(), "error");
    // 閉じた状態に戻っているので、ロールを選び直せる・もう一度始められる（理由は次の始めるで作り直される）。
    assert.equal((await post(url, "/api/role", { role: "cody" })).status, 200);
    const again = await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal(again.status, 500);
    assert.equal(again.json.state.stream.error, BODY_CONNECT_FAILED_MESSAGE);
  } finally {
    await server.close();
  }
});

test("配信を始める（体あり）: 器の URL が入っていなければ場は開かず、URL を入れる案内を返す", async () => {
  const v = makeVenue({
    roleRef: { current: { id: "chappy", name: { canonical: "チャッピー" }, body: true } },
    channel: { getUrl: () => null, connect: async () => assert.fail("URL が無いのにつながない"), close: async () => {} }
  });
  const { server, url } = await startServer(v);
  try {
    const started = await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal(started.status, 500);
    assert.equal(started.json.error, BODY_URL_NOT_SET_MESSAGE);
    assert.equal(started.json.state.stream.phase, "closed");
  } finally {
    await server.close();
  }
});

test("配信を始める（体なし）: 器を見ない・つながない（URL が無くても開く）", async () => {
  const events = /** @type {string[]} */ ([]);
  const v = makeVenue({
    events,
    roleRef: { current: { id: "mio", name: { canonical: "ミオ" }, body: false } },
    channel: {
      getUrl: () => assert.fail("体なしは器の URL を見ない"),
      connect: async () => assert.fail("体なしは器につながない"),
      close: async () => {
        events.push("channel.close");
      }
    }
  });
  const { server, url } = await startServer(v);
  try {
    const started = await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal(started.status, 200);
    assert.equal(started.json.stream.phase, "open");
    assert.equal(events.includes("channel.close"), false);
  } finally {
    await server.close();
  }
});

test("createLazyChannel.connect: 今の URL でつないでおく（つながっていればそのまま）・つながらなければ投げて次にもう一度・close のあとはつなぎ直せる", async () => {
  /** @type {string[]} */
  const calls = [];
  let fail = true;
  const lazy = createLazyChannel("ws://127.0.0.1:9/control", {
    connectImpl: async (/** @type {string} */ url) => {
      calls.push(url);
      if (fail) throw new Error("ECONNREFUSED");
      return { sendSpeech: async () => {}, sendEnvelope: async () => {}, close: async () => calls.push("closed") };
    }
  });
  await assert.rejects(() => lazy.connect(), /ECONNREFUSED/);
  assert.equal(lazy.connectionStatus(), "error");
  fail = false;
  await lazy.connect();
  assert.equal(lazy.connectionStatus(), "connected");
  await lazy.connect();
  assert.equal(calls.filter((c) => c !== "closed").length, 2, "つながっていれば張り直さない");
  await lazy.close();
  assert.equal(lazy.connectionStatus(), "idle", "畳んだら idle（URL は残す）");
  await lazy.connect();
  assert.deepEqual(calls, ["ws://127.0.0.1:9/control", "ws://127.0.0.1:9/control", "closed", "ws://127.0.0.1:9/control"]);
  const unset = createLazyChannel(null);
  await assert.rejects(() => unset.connect(), /not set/);
});

// ── 3. YouTube ───────────────────────────────────────────────────────────

test("配信を始める: 保存してある YouTube の URL につながらなくても場は開く（器官は畳む）", async () => {
  const v = makeVenue();
  const chat = makeChat(v.events, { startThrows: true });
  const { server, url } = await startServer(v, {
    chatClientFactory: chat.factory,
    chatSourceStatus: () => ({ source: "https://youtube.example/old-live" })
  });
  try {
    const started = await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal(started.status, 200);
    assert.equal(started.json.stream.phase, "open");
    assert.equal(started.json.chat.connected, false);
    assert.equal(chat.record.created, 1);
    assert.equal(chat.record.stopped, 1);
  } finally {
    await server.close();
  }
});

test("配信を始める: YouTube の URL が無ければつながない・場を開く前に Connect 済みならそのまま（作り直さない）", async () => {
  const v = makeVenue();
  const chat = makeChat(v.events);
  let source = /** @type {string | null} */ (null);
  const { server, url } = await startServer(v, { chatClientFactory: chat.factory, chatSourceStatus: () => ({ source }) });
  try {
    await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal(chat.record.created, 0);
    await post(url, "/api/stream/stop");
    source = "https://youtube.example/live";
    await post(url, "/api/chat/connect", { source });
    assert.equal(chat.record.created, 1);
    const started = await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal(started.json.chat.connected, true);
    assert.equal(chat.record.created, 1, "Connect 済みの器官を作り直さない");
  } finally {
    await server.close();
  }
});

// ── 4. 場が開いている間 / 閉じている間 ───────────────────────────────────────

test("場が開いている間: ロール・マイク・文字起こしは替えられない（409）。YouTube の Connect・ゲームの窓は触れる", async () => {
  const v = makeVenue();
  const chat = makeChat(v.events);
  const role = makeRoleWiring(v.roleRef);
  const settings = createInMemorySettingsStore();
  /** @type {Array<string | null>} */
  const targets = [];
  const { server, url, ears } = await startServer(v, {
    settingsStore: settings,
    sttEngineInitial: "whisper",
    onSetRole: role.onSetRole,
    roleStatus: role.roleStatus,
    chatClientFactory: chat.factory,
    onSetVisionTarget: (/** @type {string | null} */ t) => targets.push(t),
    visionTargetStatus: () => ({ title: targets[targets.length - 1] ?? null })
  });
  try {
    await post(url, "/api/stream/start", { device: "Mic A", sttEngine: "whisper" });
    // ロール
    const refusedRole = await post(url, "/api/role", { role: "cody" });
    assert.equal(refusedRole.status, 409);
    assert.match(refusedRole.json.error, /配信の途中はロールを替えられない/);
    assert.deepEqual(role.calls, []);
    // マイク・文字起こし（替える口は始めるだけ。場が開いている間の始めるは断る・後方互換の別名も同じ）。
    for (const path of ["/api/stream/start", "/api/ears/start"]) {
      const refused = await post(url, path, { device: "Mic B", sttEngine: "elevenlabs" });
      assert.equal(refused.status, 409, path);
    }
    const s = await state(url);
    assert.equal(s.device, "Mic A");
    assert.equal(s.stt.engine, "whisper");
    assert.equal(settings.getLastDevice(), "Mic A");
    assert.equal(ears.record.created, 1, "耳を作り直さない");
    // YouTube の URL と Connect・ゲームの窓は触れる。
    const connected = await post(url, "/api/chat/connect", { source: "https://youtube.example/live" });
    assert.equal(connected.status, 200);
    assert.equal(connected.json.chat.connected, true);
    const target = await post(url, "/api/vision-target", { title: "FooGame" });
    assert.equal(target.status, 200);
    assert.equal(target.json.visionTarget.title, "FooGame");
  } finally {
    await server.close();
  }
});

test("場が閉じかけ（記録中）の間も: ロールを替えられない・始められない・もう一度の終えるは断る（同時の操作は断る）", async () => {
  /** @type {Array<() => void>} */
  const releases = [];
  const v = makeVenue({
    writeImpl: () =>
      new Promise((resolve) => {
        releases.push(() => resolve({ written: true }));
      })
  });
  const role = makeRoleWiring(v.roleRef);
  const { server, url, ears } = await startServer(v, { onSetRole: role.onSetRole, roleStatus: role.roleStatus });
  try {
    await post(url, "/api/stream/start", { device: "Mic" });
    ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "一言" });
    const stopping = post(url, "/api/stream/stop");
    while (releases.length === 0) await settle();
    const s = await state(url);
    assert.equal(s.stream.phase, "closing");
    assert.equal(s.memory.recording, true, "記録中");
    assert.equal((await post(url, "/api/role", { role: "cody" })).status, 409);
    assert.equal((await post(url, "/api/stream/start", { device: "Mic" })).status, 409);
    const again = await post(url, "/api/stream/stop");
    assert.equal(again.status, 409);
    assert.match(again.json.error, /配信を終えている途中/);
    releases[0]();
    const stopped = await stopping;
    assert.equal(stopped.status, 200);
    assert.equal(stopped.json.stream.phase, "closed");
    assert.equal((await post(url, "/api/role", { role: "cody" })).status, 200, "閉じたらロールを選び直せる");
  } finally {
    await server.close();
  }
});

test("場が閉じている間: 「今日を記録」は断る（409・保存を頼まない）・20 分ごとの保存は何もしない。開いている間は動く", async () => {
  const v = makeVenue();
  const { server, url, ears } = await startServer(v);
  try {
    const refused = await post(url, "/api/memory-record");
    assert.equal(refused.status, 409);
    assert.equal(v.venue.checkpoint(), false);
    assert.deepEqual(v.written, []);
    await post(url, "/api/stream/start", { device: "Mic" });
    ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "一言目" });
    assert.equal((await post(url, "/api/memory-record")).status, 200);
    assert.deepEqual(v.written.map((w) => w.entries), [["一言目"]]);
    assert.equal(v.venue.checkpoint(), false, "前の保存から増えていなければ頼まない");
    ears.record.buffer.append({ startMs: 1000, endMs: 2000, text: "二言目" });
    assert.equal(v.venue.checkpoint(), true);
    await v.recorder.whenIdle();
    assert.deepEqual(v.written.map((w) => w.entries), [["一言目"], ["一言目", "二言目"]]);
    await post(url, "/api/stream/stop");
    assert.equal((await post(url, "/api/memory-record")).status, 409);
    assert.equal(v.venue.checkpoint(), false);
  } finally {
    await server.close();
  }
});

// ── 5. 終えるの順 ─────────────────────────────────────────────────────────

test("配信を終える: 写し → 畳む（YouTube・判定・発火の予定・声を止める・目・耳・頭のセッション・器）→ 記憶の最後の保存を待つ間は「記録中」→ 閉じる → ロールを選び直せる", async () => {
  /** @type {Array<() => void>} */
  const releases = [];
  const v = makeVenue({
    roleRef: { current: { id: "chappy", name: { canonical: "チャッピー" }, body: true } },
    writeImpl: (entries) =>
      new Promise((resolve) => {
        v.events.push(`memory.write:${entries.map((e) => e.text).join("/")}`);
        releases.push(() => resolve({ written: true }));
      })
  });
  const chat = makeChat(v.events);
  const role = makeRoleWiring(v.roleRef);
  const { server, url, ears, orchestrator } = await startServer(v, {
    chatClientFactory: chat.factory,
    chatSourceStatus: () => ({ source: "https://youtube.example/live" }),
    onSetRole: role.onSetRole,
    roleStatus: role.roleStatus,
    selfFireInitialEnabled: true,
    fireSchedulerFactory: (/** @type {any} */ opts) => {
      const s = createFireScheduler(opts);
      return {
        ...s,
        dispose: () => {
          v.events.push("scheduler.dispose");
          s.dispose();
        }
      };
    }
  });
  try {
    await post(url, "/api/stream/start", { device: "Mic" });
    ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "一言" });
    ears.record.buffer.append({ startMs: 1000, endMs: 2000, text: "二言" });
    orchestrator.record.state = "speaking"; // 喋っている途中で終える。
    v.events.length = 0;
    const stopping = post(url, "/api/stream/stop");
    while (releases.length === 0) await settle();
    // 記憶の最後の保存を待っている間: 場は閉じかけ（画面の「記録中」）・ロールはまだ替えられない。
    const during = await state(url);
    assert.equal(during.stream.phase, "closing");
    assert.equal(during.memory.recording, true);
    assert.equal(during.ears, "stopped", "耳はもう畳んである");
    orchestrator.record.state = "idle";
    releases[0]();
    const stopped = await stopping;
    assert.equal(stopped.status, 200);
    assert.equal(stopped.json.stream.phase, "closed");
    assert.equal(stopped.json.chat.connected, false);
    assert.deepEqual(v.events, [
      "chat.stop",
      "scheduler.dispose",
      "orchestrator.kill",
      "eyes.stop",
      "ears.dispose",
      "session.close",
      "channel.close",
      "memory.write:一言/二言"
    ]);
    assert.equal(stopped.json.killed, false, "終えるで KILL の表示は替えない");
    assert.equal((await post(url, "/api/role", { role: "cody" })).status, 200, "閉じたらロールを選び直せる");
  } finally {
    await server.close();
  }
});

test("配信を終える（体なし）: 器の close は体の有無に関わらず行う（体ありの発火のあと体なしへ替えたときの開きっぱなしを防ぐ）", async () => {
  const events = /** @type {string[]} */ ([]);
  const v = makeVenue({
    events,
    roleRef: { current: { id: "mio", name: { canonical: "ミオ" }, body: false } },
    channel: {
      getUrl: () => assert.fail("体なしは器の URL を見ない"),
      connect: async () => assert.fail("体なしは器につながない"),
      close: async () => {
        events.push("channel.close");
      }
    }
  });
  const { server, url } = await startServer(v);
  try {
    await post(url, "/api/stream/start", { device: "Mic" });
    await post(url, "/api/stream/stop");
    assert.deepEqual(events.filter((e) => e === "channel.close"), ["channel.close"]);
  } finally {
    await server.close();
  }
});

test("配信を終える: 最後の保存は頼んだ時点のロールの置き場に書く・前の保存から増えていなければ頼まない", async () => {
  const v = makeVenue();
  const { server, url, ears } = await startServer(v);
  try {
    await post(url, "/api/stream/start", { device: "Mic" });
    ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "一言" });
    await post(url, "/api/memory-record");
    await v.recorder.whenIdle();
    assert.equal(v.written.length, 1);
    await post(url, "/api/stream/stop");
    assert.equal(v.written.length, 1, "「今日を記録」の直後に終えても②を空回りさせない");
    await post(url, "/api/stream/start", { device: "Mic" });
    ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "次の場" });
    await post(url, "/api/stream/stop");
    assert.equal(v.written.length, 2);
    assert.equal(v.written[1].place.roleId, "chappy");
    assert.equal(v.written[1].place.streamNo, 2);
  } finally {
    await server.close();
  }
});

// ── 6. Ctrl+C ───────────────────────────────────────────────────────────

/** createCockpitShutdown を本物の server・場の口で組む（finalize はプロセスを終えずに記録するだけ）。 */
function makeShutdown(v, server, log) {
  return createCockpitShutdown({
    write: (line) => log.push(line.trim()),
    beforeClose: () => log.push("compactor.dispose"),
    server,
    venue: v.venue,
    disposeRest: async () => {
      log.push("disposeRest");
    },
    finalize: async () => {
      log.push("finalize");
    }
  });
}

test("Ctrl+C: 場が開いていれば「配信を終える」と同じ道（写し → 畳む → 最後の保存）を通ってから畳む", async () => {
  const v = makeVenue();
  const { server, url, ears } = await startServer(v);
  /** @type {string[]} */
  const log = [];
  await post(url, "/api/stream/start", { device: "Mic" });
  ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "最後の一言" });
  v.events.length = 0;
  await makeShutdown(v, server, log)();
  assert.deepEqual(v.written.map((w) => w.entries), [["最後の一言"]]);
  const upToSave = v.events.slice(0, v.events.indexOf("memory.write:1") + 1);
  assert.deepEqual(upToSave.slice(-5), ["eyes.stop", "ears.dispose", "session.close", "channel.close", "memory.write:1"], "終えると同じ並び（その後で server.close）");
  assert.equal(log[0], "[cockpit] closing…");
  assert.ok(log.indexOf("compactor.dispose") < log.indexOf("disposeRest"));
  assert.deepEqual(log.slice(-2), ["disposeRest", "finalize"]);
  assert.equal(server.isListening(), false, "server.close() まで済む");
});

test("Ctrl+C: 場が閉じていれば保存を頼まない（場の外では記録しない）", async () => {
  const v = makeVenue();
  const { server, url, ears } = await startServer(v);
  /** @type {string[]} */
  const log = [];
  await post(url, "/api/stream/start", { device: "Mic" });
  ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "保存済み" });
  await post(url, "/api/stream/stop");
  assert.equal(v.written.length, 1);
  await makeShutdown(v, server, log)();
  assert.equal(v.written.length, 1, "閉じた場で Ctrl+C しても②を走らせない");
  assert.equal(log.some((l) => l.includes("配信を終えます")), false);
  assert.deepEqual(log.slice(-2), ["disposeRest", "finalize"]);
});

test("Ctrl+C: 2 回目の Ctrl+C で記録の待ちを打ち切る（保存がハングしても畳むところまで進む）", async () => {
  const v = makeVenue({ writeImpl: () => new Promise(() => {}), memoryTimeoutMs: 60_000 });
  const { server, url, ears } = await startServer(v);
  /** @type {string[]} */
  const log = [];
  await post(url, "/api/stream/start", { device: "Mic" });
  ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "書き出しがハングする" });
  const shutdown = makeShutdown(v, server, log);
  const first = shutdown();
  while (!v.recorder.isRecording()) await settle();
  await settle();
  await shutdown(); // 2 回目の Ctrl+C。
  await first;
  assert.ok(log.includes("[cockpit] 記録の書き出しを待たずに終了します。"));
  assert.deepEqual(log.slice(-2), ["disposeRest", "finalize"]);
  assert.equal(server.streamStatus().phase, "closed");
});

test("Ctrl+C: 待ちが無いときの 2 回目は何もしない・保存の待ちの上限は SHUTDOWN_MEMORY_TIMEOUT_MS（既定）", async () => {
  const venue = createStreamVenueHooks({
    memoryPlaces: { beginStream() {}, place: () => null, streamNo: () => 0 },
    memoryRecorder: { record: async () => {}, whenIdle: async () => {}, isRecording: () => false },
    openSession: () => {},
    closeSession: async () => {},
    hasBody: () => false,
    channel: { getUrl: () => null, connect: async () => {}, close: async () => {} }
  });
  assert.equal(venue.skipMemoryWait(), false);
  /** @type {number[]} */
  const waited = [];
  let recording = true;
  const venue2 = createStreamVenueHooks({
    memoryPlaces: { beginStream() {}, place: () => null, streamNo: () => 0 },
    memoryRecorder: { record: async () => {}, whenIdle: () => new Promise(() => {}), isRecording: () => recording },
    openSession: () => {},
    closeSession: async () => {},
    hasBody: () => false,
    channel: { getUrl: () => null, connect: async () => {}, close: async () => {} },
    setTimeoutImpl: /** @type {any} */ ((/** @type {() => void} */ fn, /** @type {number} */ ms) => {
      waited.push(ms);
      fn();
      return 0;
    })
  });
  await venue2.waitForRunningSaves();
  assert.deepEqual(waited, [SHUTDOWN_MEMORY_TIMEOUT_MS]);
  recording = false;
  await venue2.waitForRunningSaves();
  assert.deepEqual(waited, [SHUTDOWN_MEMORY_TIMEOUT_MS], "走っていなければ待たない");
});

// ── 7. 場の終わりのあとに発火の予定のタイマが発火を頼まない（棚卸し §5・設計 §9）─────────────────────

test("発火の予定: 場が閉じている間はタイマを張らず、場の終わりで畳んだあとは発火を頼まない（耳の Stop のあとの沈黙の予定が消える）", async () => {
  const timers = makeTimers();
  const v = makeVenue();
  const { server, url, orchestrator } = await startServer(v, {
    selfFireInitialEnabled: true,
    fireSchedulerFactory: (/** @type {any} */ opts) =>
      createFireScheduler({ ...opts, setTimeoutImpl: timers.setTimeoutImpl, clearTimeoutImpl: timers.clearTimeoutImpl, rng: () => 0 })
  });
  try {
    assert.equal(timers.pending.size, 0, "起動しただけ（場が閉じている）では沈黙の予定を張らない");
    await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal(timers.pending.size, 1, "場が開くと沈黙の予定が張られる");
    timers.runAll();
    await settle();
    assert.equal(orchestrator.record.fireCount, 1, "場が開いている間は沈黙の予定が発火を頼む");
    assert.deepEqual(orchestrator.record.fires[0], { vision: true, cause: { type: "silence" } });
    assert.ok(timers.pending.size >= 1, "次の周期が張られている");
    await post(url, "/api/stream/stop");
    assert.equal(timers.pending.size, 0, "場の終わりで発火の予定を畳む（タイマが残らない）");
    // 自発の切り替え・口数の変更をしても、閉じている間はタイマを張らない。
    await post(url, "/api/self-fire", { enabled: false });
    await post(url, "/api/self-fire", { enabled: true });
    await post(url, "/api/verbosity", { mode: "chatty" });
    assert.equal(timers.pending.size, 0);
    assert.equal(timers.runAll(), 0);
    await settle();
    assert.equal(orchestrator.record.fireCount, 1, "場の終わりのあとは発火を頼まない");
    const s = await state(url);
    assert.deepEqual(s.selfFire, { enabled: true }, "自発の ON/OFF・口数は閉じている間も読み書きできる");
    assert.equal(s.verbosity, "chatty");
    // 次の場では引き継いだ値で作り直す。
    await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal(timers.pending.size, 1);
    assert.equal((await state(url)).verbosity, "chatty");
  } finally {
    await server.close();
  }
});

// ── 8. 2 つ目の場 ─────────────────────────────────────────────────────────

test("2 つ目の場: 前の場の lastRecordedSeq で新しい場の保存が飛ばされない（新しい場の転写は 0 から）", async () => {
  const v = makeVenue();
  const { server, url, ears } = await startServer(v);
  try {
    await post(url, "/api/stream/start", { device: "Mic" });
    for (const text of ["A1", "A2", "A3"]) ears.record.buffer.append({ startMs: 0, endMs: 1000, text });
    await post(url, "/api/stream/stop");
    assert.equal(v.venue.lastRecordedSeq(), 3);
    assert.notEqual(v.venue.lastRecordAtMs(), null);
    await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal(v.venue.lastRecordedSeq(), 0, "場の始まりで 0 に戻す");
    assert.equal(v.venue.lastRecordAtMs(), null, "この場ではまだ記録していない");
    assert.equal((await state(url)).memory.lastRecordAtMs, null);
    // 前の場と同じ件数（3 件）でも、新しい場の転写なので保存する。
    for (const text of ["B1", "B2", "B3"]) ears.record.buffer.append({ startMs: 0, endMs: 1000, text });
    assert.equal(v.venue.checkpoint(), true, "20 分ごとの保存も飛ばさない");
    await v.recorder.whenIdle();
    await post(url, "/api/stream/stop");
    assert.deepEqual(v.written.map((w) => w.entries), [["A1", "A2", "A3"], ["B1", "B2", "B3"]]);
  } finally {
    await server.close();
  }
});

test("2 つ目の場: 前の場の最後の保存が遅れて終わっても、新しい場の数え（lastRecordedSeq）を上書きしない", async () => {
  /** @type {Array<() => void>} */
  const releases = [];
  const v = makeVenue({
    writeImpl: () =>
      new Promise((resolve) => {
        releases.push(() => resolve({ written: true }));
      }),
    memoryTimeoutMs: 1
  });
  const { server, url, ears } = await startServer(v);
  try {
    await post(url, "/api/stream/start", { device: "Mic" });
    for (const text of ["A1", "A2"]) ears.record.buffer.append({ startMs: 0, endMs: 1000, text });
    await post(url, "/api/stream/stop"); // 待ちの上限（1ms）で閉じる。保存はまだ走っている。
    assert.equal(v.recorder.isRecording(), true);
    await post(url, "/api/stream/start", { device: "Mic" });
    releases[0](); // 前の場の保存がいま終わる。
    await v.recorder.whenIdle();
    assert.equal(v.venue.lastRecordedSeq(), 0, "前の場の保存は新しい場の数えにしない");
    assert.equal(v.venue.lastRecordAtMs(), null);
  } finally {
    await server.close();
  }
});

test("2 つ目の場: ロールを替えてから始めると、新しいロールの置き場（準備も場の始まり）に書く", async () => {
  const v = makeVenue();
  const role = makeRoleWiring(v.roleRef);
  const { server, url, ears } = await startServer(v, { onSetRole: role.onSetRole, roleStatus: role.roleStatus });
  try {
    await post(url, "/api/stream/start", { device: "Mic" });
    ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "チャッピーの場" });
    await post(url, "/api/stream/stop");
    v.events.length = 0;
    assert.equal((await post(url, "/api/role", { role: "cody" })).status, 200);
    assert.deepEqual(v.events.filter((e) => e.startsWith("memory.prepare")), [], "ロールの切り替えでは準備を待たない");
    await post(url, "/api/stream/start", { device: "Mic" });
    assert.deepEqual(v.events.filter((e) => e.startsWith("memory.prepare")), ["memory.prepare:cody"], "場の始まりで新しいロールの置き場を準備する");
    ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "こーでぃーの場" });
    await post(url, "/api/stream/stop");
    assert.deepEqual(v.written.map((w) => [w.place.roleId, w.entries]), [
      ["chappy", ["チャッピーの場"]],
      ["cody", ["こーでぃーの場"]]
    ]);
  } finally {
    await server.close();
  }
});

test("createRoleMemoryPlaces.beginStream: 場の始まりで置き場を作り直す（場の番号・本体のファイル名・準備はもう一度＝冪等）", async () => {
  /** @type {any[]} */
  const prepared = [];
  /** @type {any[]} */
  const identities = [];
  const ref = { current: { id: "chappy", name: { canonical: "チャッピー" } } };
  const places = createRoleMemoryPlaces({
    root: join("C:", "tmp", "memories-root"),
    currentRole: () => ref.current,
    startedAtMs: 1,
    prepareImpl: async (/** @type {any} */ o) => {
      prepared.push(o.dir);
      return { ok: true };
    },
    createIdentityImpl: (/** @type {any} */ o) => {
      identities.push(o.startedAtMs);
      return { get: () => ({ dateJst: "x", baseName: String(o.startedAtMs) }) };
    }
  });
  assert.equal(places.streamNo(), 0);
  const before = places.place();
  assert.equal(before?.streamNo, 0);
  places.beginStream(1000);
  assert.equal(places.streamNo(), 1);
  const a = places.place();
  assert.notEqual(a, before);
  assert.equal(a?.streamNo, 1);
  assert.equal(places.place(), a, "同じ場・同じロールなら同じ置き場");
  places.beginStream(2000);
  const b = places.place();
  assert.notEqual(b, a);
  assert.deepEqual(identities, [1, 1000, 2000]);
  await b?.ready;
  assert.equal(prepared.length, 3);
});

// ── main() の結線（main は export されず走らせられないので、ソースの並びで固定する・Domain B / C と同じ流儀）──

test("場の結線（main）: 場の口を cockpit-server へ渡し、頭のセッションは「配信を始める」で作る（--channel の先充填はやめた）・Ctrl+C は終えると同じ道", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("./cockpit.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const main = source.slice(source.indexOf("async function main()"));
  assert.match(main, /streamHooks: streamVenue\.hooks,/);
  assert.match(main, /openSession: openStreamSession,\n\s+closeSession: disposeSession,\n\s+hasBody: currentBody,/, "器につなぐかは今のロールの体（resolveFireChannel と同じ）");
  assert.match(main, /const openStreamSession = async \(\) => \{\n\s+await disposeSession\(\);\n\s+ensureSession\(\);\n\s+\};/, "前のセッションを畳んでから作る");
  assert.doesNotMatch(main, /if \(args\.channel\) \{\n\s+ensureFireResources\(\);/, "起動時に頭のセッションを作らない");
  assert.doesNotMatch(main, /LLM セッションは起動時に先充填済み/);
  assert.doesNotMatch(main, /onEarsStopping/, "耳の Stop の記録の口は無い（終えるの saveFinal に 1 本化）");
  assert.match(main, /streamVenue\.checkpoint\(\);/, "20 分ごとの保存は場が開いている間だけ（checkpoint が判定する）");
  assert.match(main, /isStreamOpen: \(\) => server\?\.streamStatus\(\)\.phase === "open",/);
  assert.match(main, /const shutdown = createCockpitShutdown\(\{/);
  assert.match(main, /process\.on\("SIGINT", shutdown\);/);
  assert.match(main, /renewUsageLog: \(startedAtMs\) => \{\n\s+const previous = sessionUsageLog;\n\s+sessionUsageLog = createSessionUsageLog\(\{ startedAtMs \}\);/, "頭の文脈の記録は場ごとに作り直す");
  assert.match(main, /lastRecordAtMs: streamVenue\.lastRecordAtMs\(\)/, "記憶の現況は場ごとの数え");
});

test("Ctrl+C: 場が閉じていても、走っている保存（前の場の最後の保存の残り）は待つ（新しく頼まない・上限つき）", async () => {
  /** @type {Array<() => void>} */
  const releases = [];
  const v = makeVenue({
    writeImpl: () =>
      new Promise((resolve) => {
        releases.push(() => resolve({ written: true }));
      }),
    memoryTimeoutMs: 1
  });
  const { server, url, ears } = await startServer(v);
  /** @type {string[]} */
  const log = [];
  await post(url, "/api/stream/start", { device: "Mic" });
  ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "長い書き出し" });
  await post(url, "/api/stream/stop"); // 待ちの上限（1ms）で閉じる。保存はまだ走っている。
  assert.equal(v.recorder.isRecording(), true);
  const shutdown = makeShutdown(v, server, log);
  const done = shutdown();
  await settle();
  releases[0]();
  await done;
  assert.equal(releases.length, 1, "新しい保存は頼まない");
  assert.equal(v.recorder.isRecording(), false);
  assert.deepEqual(log.slice(-2), ["disposeRest", "finalize"]);
});

// ── 9. メイン画面（view-logic・設定のダイアログの結線） ─────────────────────────

test("設定のダイアログの Start / Stop は場の関数（/api/stream/start・/api/stream/stop）を通り、場が開いている間はマイク・文字起こしを触れない", async () => {
  const { readFileSync } = await import("node:fs");
  const drawer = readFileSync(new URL("../src/cockpit/ui/settings-drawer.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.match(drawer, /doFetch\("\/api\/stream\/start", \{/);
  assert.match(drawer, /doFetch\("\/api\/stream\/stop", \{ method: "POST" \}\)/);
  assert.doesNotMatch(drawer, /\/api\/ears\/(start|stop)/, "耳だけを起こす・止める道を残さない");
  assert.match(drawer, /const inputsLocked = streamLocksInputs\(settings && settings\.stream\);/);
  assert.match(drawer, /id="device-select"[\s\S]{0,200}?disabled=\$\{inputsLocked\}/);
  assert.match(drawer, /id="stt-engine-select"[\s\S]{0,200}?disabled=\$\{inputsLocked\}/);
  const app = readFileSync(new URL("../src/cockpit/ui/app.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.match(app, /doFetch\("\/api\/stream\/start", \{ method: "POST"/, "メイン画面の「配信を始める」");
  assert.match(app, /doFetch\("\/api\/stream\/stop", \{ method: "POST"/, "下の帯の「配信を終える」");
  assert.match(app, /preStream=\$\{isPreStream\(ears, settings\.stream\)\}/);
});
