// @ts-check
// 記憶の整理 Domain C: 場を閉じる道（配信を終える・通話を終える・Ctrl+C）への③整理役の結線（organization.md §5・§7・
// memory-organization-wave-plan.md §4）。
// 本物の cockpit-server（HTTP）・cockpit.mjs の場の口（createStreamVenueHooks）・保存の係（createMemoryRecorder）・記憶の置き場
// （createRoleMemoryPlaces）・整理の係（createMemoryOrganiserRunner）・終わりの手順（createCockpitShutdown）と、本物の③
// （startMemoryOrganiser）を、偽の git の口・偽の頭・偽の耳でつなぐ。実データ・本物の LLM・外部 API には触れない
// （ファイルを書くのは OS の一時フォルダだけ・本物の git も一時フォルダの中だけ）。操縦席は起動しない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import {
  createStreamVenueHooks,
  createMemoryRecorder,
  createRoleMemoryPlaces,
  createCockpitShutdown,
  createMemoryOrganiserRunner,
  MEMORY_BACKUP_ROOT,
  ORGANISER_WRITER_BUSY_WARNING,
  ORGANISER_START_FAILED_WARNING
} from "./cockpit.mjs";
import { createCockpitServer } from "../src/cockpit/cockpit-server.mjs";
import { createTranscriptBuffer } from "../src/ears/transcript-buffer.mjs";
import {
  startMemoryOrganiser,
  checkOrganiseDue,
  DEFAULT_MEMORY_BACKUP_ROOT,
  ORGANISER_ABORTED_WARNING,
  ORGANISER_BACKUP_FAILED_WARNING,
  ORGANISER_LOG_FAILED_WARNING,
  ORGANISE_INTERVAL_MS
} from "../src/mind/memory-organizer.mjs";
import { readMemoryHead } from "../src/memory/memory-store.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/** microtask / I/O を一巡させる。 */
const settle = () => new Promise((r) => setImmediate(r));

/** @param {() => boolean} cond */
async function until(cond, label = "condition") {
  for (let i = 0; i < 2000; i += 1) {
    if (cond()) return;
    await settle();
  }
  assert.fail(`timed out waiting for ${label}`);
}

/** @type {any} */
const unrefTimeout = (/** @type {() => void} */ fn, /** @type {number} */ ms) => {
  const timer = setTimeout(fn, ms);
  timer.unref();
  return timer;
};

const HEAD = "1".repeat(40);
const ORGANISED_COMMIT = "c0ffee1234567890c0ffee1234567890c0ffee12";

// ── 偽物 ─────────────────────────────────────────────────────────────

/** 偽の耳（転写の正本は本物の transcript-buffer）。 */
function makeEars() {
  const record = { /** @type {any} */ buffer: null };
  const factory = (/** @type {any} */ options) => {
    const buffer = options?.transcriptBuffer ?? createTranscriptBuffer({ nowImpl: () => 1000 });
    record.buffer = buffer;
    buffer.onAppend((entry) => options.onTranscript(entry, { latencyMs: 10, audioCtx: null }));
    return {
      transcriptBuffer: buffer,
      async start() {},
      async dispose() {},
      isDisposed: () => false,
      streamMs: () => 0,
      stats: () => ({})
    };
  };
  return { factory, record };
}

function makeOrchestrator() {
  return (/** @type {any} */ _hooks) => ({
    async fire() {
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
  });
}

/**
 * 偽の③の頭（create）。hang なら release() まで答えない。
 * @param {string[]} events @param {{ hang?: boolean }} [opts]
 */
function makeBrain(events, opts = {}) {
  const rec = { created: 0, disposed: 0, /** @type {any[]} */ options: [], /** @type {string[]} */ asks: [], release: () => {} };
  const create = (/** @type {any} */ options) => {
    rec.created += 1;
    rec.options.push(options);
    /** @type {(v: any) => void} */
    let answer = () => {};
    const answered = new Promise((r) => {
      answer = r;
    });
    rec.release = () => answer({ replyText: "済み" });
    return {
      async ask(/** @type {string} */ content) {
        rec.asks.push(content);
        events.push(`organiser.ask:${options.cwd.split(/[\\/]/).pop()}`);
        if (!opts.hang) return { replyText: "済み" };
        return answered;
      },
      async dispose() {
        rec.disposed += 1;
        events.push("organiser.dispose");
      }
    };
  };
  return { create, rec };
}

/**
 * 本物の startMemoryOrganiser に偽の git の口を差す（控えのファイルだけ一時フォルダに書く）。
 * @param {string[]} events @param {{ backupFails?: boolean }} [opts]
 */
function makeOrganiserStart(events, opts = {}) {
  /** @type {any[]} */
  const starts = [];
  const bodies = [{ path: "topic/2026-11-01.md", object: "b".repeat(40) }];
  const startImpl = (/** @type {any} */ options) => {
    starts.push(options);
    events.push(`organiser.start:${options.roleId}`);
    return startMemoryOrganiser({
      ...options,
      discardImpl: async () => ({ ok: true }),
      resetImpl: async () => {
        events.push("organiser.reset");
        return { ok: true };
      },
      bundleImpl: async (/** @type {any} */ { file }) => {
        if (opts.backupFails) return { ok: false, error: "fake" };
        writeFileSync(file, "fake bundle");
        return { ok: true };
      },
      headImpl: async () => ({ ok: true, head: HEAD }),
      treeFilesImpl: async () => ({ ok: true, files: bodies }),
      stageFilesImpl: async () => ({ ok: true, files: bodies }),
      commitImpl: async () => {
        events.push("organiser.commit");
        return { ok: true, committed: true, commit: ORGANISED_COMMIT };
      },
      commitEmptyImpl: async () => ({ ok: true, committed: true, commit: ORGANISED_COMMIT })
    });
  };
  return { startImpl: /** @type {any} */ (startImpl), starts };
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

/** SSE を読む（state の snapshot を積む）。 @param {string} url */
function openEvents(url) {
  /** @type {any[]} */
  const states = [];
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
          if (event === "state" && data) states.push(JSON.parse(data));
        }
      }
    } catch {
      // 閉じた。
    }
  })();
  return { states, close: () => ac.abort() };
}

/**
 * cockpit.mjs の main() と同じ並びで、本物の場の口・保存の係・置き場・整理の係を組む（偽の git・頭）。
 * @param {object} [over]
 * @param {boolean} [over.due=true]
 * @param {boolean} [over.hang]  ③の頼みを release() まで答えさせない。
 * @param {boolean} [over.backupFails]
 * @param {(entries: any[]) => Promise<any>} [over.writeImpl]
 * @param {number} [over.memoryTimeoutMs]
 * @param {string} [over.roleId="chappy"]
 * @param {{ roleRef: any; recorder: any; runner: any; server: () => any }} [over.shared]  ロールを 2 つ並べるとき。
 */
function makeVenue(over = {}) {
  /** @type {string[]} */
  const events = [];
  /** @type {string[]} */
  const lines = [];
  /** @type {string[]} */
  const warnings = [];
  const roleId = over.roleId ?? "chappy";
  const root = mkdtempSync(join(tmpdir(), "organiser-c-memories-"));
  const backupRoot = mkdtempSync(join(tmpdir(), "organiser-c-backups-"));
  /** @type {any} */
  let server = null;
  const memoryPlaces = createRoleMemoryPlaces({
    root,
    currentRole: () => ({ id: roleId, name: { canonical: roleId } }),
    startedAtMs: Date.UTC(2026, 10, 5, 3, 0, 0),
    prepareImpl: async () => ({ ok: true }),
    createRecordLogImpl: () => ({ dateJst: "2026-11-05", files: () => [], note: () => {} })
  });
  /** @type {any} */
  let venue = null;
  const recorder = createMemoryRecorder({
    getLiveEntries: () => (server ? server.getTranscript() : []),
    getPlace: () => memoryPlaces.place(),
    writeImpl:
      over.writeImpl ??
      (async (entries) => {
        events.push(`memory.write:${entries.length}`);
        return { written: true };
      }),
    onSaved: (info) => venue.noteSaved(info),
    onRecordingChange: () => server?.memoryStatusChanged()
  });
  const brain = makeBrain(events, { hang: over.hang });
  const organiserStart = makeOrganiserStart(events, { backupFails: over.backupFails });
  /** @type {string[]} */
  const dueDirs = [];
  const runner = createMemoryOrganiserRunner({
    getCreate: () => brain.create,
    backupRoot,
    onLine: (line) => lines.push(line),
    onWarning: (line) => warnings.push(line),
    onRunningChange: (running) => {
      events.push(`organising:${running}`);
      server?.setMemoryOrganising(running);
    },
    headImpl: async () => ({ ok: true, head: HEAD }),
    checkDueImpl: async (/** @type {any} */ { dir }) => {
      dueDirs.push(dir);
      return over.due === false ? { due: false, reason: "recent", lastAtMs: 0, commit: HEAD } : { due: true, reason: "never" };
    },
    startImpl: organiserStart.startImpl
  });
  venue = createStreamVenueHooks({
    memoryPlaces,
    memoryRecorder: recorder,
    openSession: () => {},
    closeSession: async () => {},
    hasBody: () => false,
    channel: { getUrl: () => null, connect: async () => {}, close: async () => {} },
    isStreamOpen: () => server != null && server.streamStatus().phase === "open",
    getEntries: () => (server ? server.getTranscript() : []),
    ...(over.memoryTimeoutMs != null ? { memoryTimeoutMs: over.memoryTimeoutMs } : {}),
    // ②の待ちの上限のタイマーでテストのプロセスを引き留めない。
    setTimeoutImpl: unrefTimeout,
    organiser: runner
  });
  return {
    events,
    lines,
    warnings,
    root,
    backupRoot,
    memoryPlaces,
    recorder,
    venue,
    runner,
    brain,
    organiserStart,
    dueDirs,
    /** @param {any} s */
    attach(s) {
      server = s;
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
      rmSync(backupRoot, { recursive: true, force: true });
    }
  };
}

/** @param {ReturnType<typeof makeVenue>} v @param {object} [extra] */
async function startServer(v, extra = {}) {
  const ears = makeEars();
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    fireOrchestratorFactory: /** @type {any} */ (makeOrchestrator()),
    streamHooks: v.venue.hooks,
    memoryStatus: () => ({ lastRecordAtMs: v.venue.lastRecordAtMs(), recording: v.recorder.isRecording() }),
    onMemoryRecord: () => v.recorder.record(),
    ...extra
  });
  v.attach(server);
  const url = await server.listen(0);
  return { server, url, ears };
}

/** @param {ReturnType<typeof makeVenue>} v @param {any} server @param {string[]} log */
function makeShutdown(v, server, log) {
  return createCockpitShutdown({
    write: (line) => log.push(line.trim()),
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

// ── 1. 閉じる道 ─────────────────────────────────────────────────────────

test("配信を終える（時期）: 閉じの書き出しのあとに③が走り、終わるまで閉じかけ（stream.organising が true → false）→ 閉じる", async () => {
  const v = makeVenue({ hang: true });
  const { server, url, ears } = await startServer(v);
  const sse = openEvents(url);
  try {
    await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal((await state(url)).stream.organising, false, "開いている間は false");
    ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "一言" });
    const stopping = post(url, "/api/stream/stop");
    await until(() => v.brain.rec.asks.length === 1, "organiser ask");
    const during = await state(url);
    assert.equal(during.stream.phase, "closing", "整理の間も閉じかけのまま");
    assert.equal(during.stream.organising, true, "整理中の印");
    assert.equal(during.memory.recording, false, "②は終わっている");
    // 閉じかけの間は今どおり、始める・ロールの切り替えを断る。
    assert.equal((await post(url, "/api/stream/start", { device: "Mic" })).status, 409);
    v.brain.rec.release();
    const stopped = await stopping;
    assert.equal(stopped.status, 200);
    assert.equal(stopped.json.stream.phase, "closed");
    assert.equal(stopped.json.stream.organising, false);
    assert.deepEqual(v.events, [
      "memory.write:1",
      "organiser.start:chappy",
      "organising:true",
      "organiser.ask:chappy",
      "organiser.dispose",
      "organiser.commit",
      "organising:false"
    ]);
    assert.deepEqual(v.lines, ["memory: organising (role chappy)", "memory: organised (commit c0ffee1)"]);
    assert.deepEqual(v.warnings, []);
    // ③の作り方は書き出し役と同じ（cwd = その場のロールの記憶のフォルダ・workspace-write・最後の答えだけ・使い捨て）。
    const options = v.brain.rec.options[0];
    assert.equal(options.cwd, join(v.root, "chappy"));
    assert.equal(options.sandbox, "workspace-write");
    assert.equal(options.finalAnswerOnly, true);
    assert.equal(options.ephemeral, true);
    assert.equal(v.organiserStart.starts[0].backupRoot, v.backupRoot);
    assert.equal(v.organiserStart.starts[0].dir, join(v.root, "chappy"));
    // SSE: 閉じかけ（印なし）→ 閉じかけ（整理中）→ 閉じた の順に押す。
    await until(() => {
      const last = sse.states[sse.states.length - 1];
      return last != null && last.stream.phase === "closed" && sse.states.some((t) => t.stream.organising === true);
    }, "sse");
    const phases = sse.states.map((s) => `${s.stream.phase}${s.stream.organising ? "+organising" : ""}`);
    const firstOrganising = phases.indexOf("closing+organising");
    assert.ok(firstOrganising > phases.indexOf("closing"), phases.join(","));
    assert.ok(phases.lastIndexOf("closed") > firstOrganising, phases.join(","));
  } finally {
    sse.close();
    await server.close();
    v.cleanup();
  }
});

test("配信を終える（時期・新しい文字起こしなし）: 書き出しは頼まないが③は走る", async () => {
  const v = makeVenue();
  const { server, url } = await startServer(v);
  try {
    await post(url, "/api/stream/start", { device: "Mic" });
    const stopped = await post(url, "/api/stream/stop");
    assert.equal(stopped.json.stream.phase, "closed");
    assert.equal(v.events.some((e) => e.startsWith("memory.write")), false, "②は頼まない");
    assert.equal(v.brain.rec.created, 1, "③は走る");
    assert.deepEqual(v.lines, ["memory: organising (role chappy)", "memory: organised (commit c0ffee1)"]);
  } finally {
    await server.close();
    v.cleanup();
  }
});

test("配信を終える（時期でない）: ③を呼ばない・何も出さない・閉じは今どおり（印は一度も立たない）", async () => {
  const v = makeVenue({ due: false });
  const { server, url, ears } = await startServer(v);
  const sse = openEvents(url);
  try {
    await post(url, "/api/stream/start", { device: "Mic" });
    ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "一言" });
    const stopped = await post(url, "/api/stream/stop");
    assert.equal(stopped.status, 200);
    assert.equal(stopped.json.stream.phase, "closed");
    assert.deepEqual(v.events, ["memory.write:1"]);
    assert.deepEqual(v.dueDirs, [join(v.root, "chappy")], "時期はそのロールの置き場で見る");
    assert.equal(v.organiserStart.starts.length, 0);
    assert.equal(v.brain.rec.created, 0);
    assert.deepEqual(v.lines, []);
    assert.deepEqual(v.warnings, []);
    await settle();
    assert.equal(sse.states.some((s) => s.stream.organising === true), false);
    assert.deepEqual(readdirSync(v.backupRoot), [], "控えの置き場を作らない");
  } finally {
    sse.close();
    await server.close();
    v.cleanup();
  }
});

test("配信を終える: ②が上限を過ぎてもまだ走っていれば③は走らせない（同じフォルダで同時に走らせない・見送りの 1 行）", async () => {
  /** @type {Array<() => void>} */
  const releases = [];
  const v = makeVenue({
    memoryTimeoutMs: 20,
    writeImpl: () =>
      new Promise((resolve) => {
        releases.push(() => resolve({ written: true }));
      })
  });
  const { server, url, ears } = await startServer(v);
  try {
    await post(url, "/api/stream/start", { device: "Mic" });
    ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "長い書き出し" });
    const stopped = await post(url, "/api/stream/stop");
    assert.equal(stopped.json.stream.phase, "closed", "②の上限（今どおり）で閉じる");
    assert.equal(v.recorder.isRecording(), true, "②はまだ走っている");
    assert.equal(v.organiserStart.starts.length, 0, "③は始めない");
    assert.deepEqual(v.warnings, [ORGANISER_WRITER_BUSY_WARNING]);
    assert.deepEqual(v.lines, []);
    releases[0]();
    await v.recorder.whenIdle();
    assert.equal(v.organiserStart.starts.length, 0, "②が終わっても③は後から走らない（次の閉じでやり直す）");
  } finally {
    await server.close();
    v.cleanup();
  }
});

test("配信を終える: 走らなかった回（控えが作れない）は B の 1 行だけ（重ねない）・開始の 1 行と合わせて 2 行", async () => {
  const v = makeVenue({ backupFails: true });
  const { server, url } = await startServer(v);
  try {
    await post(url, "/api/stream/start", { device: "Mic" });
    const stopped = await post(url, "/api/stream/stop");
    assert.equal(stopped.json.stream.phase, "closed");
    assert.equal(v.brain.rec.created, 0, "頭を呼ばない");
    assert.deepEqual(v.lines, ["memory: organising (role chappy)"]);
    assert.deepEqual(v.warnings, [ORGANISER_BACKUP_FAILED_WARNING]);
  } finally {
    await server.close();
    v.cleanup();
  }
});

test("通話を終える（Discord の場）: 同じ POST /api/stream/stop → closeStream → saveFinal の道で③が走る（閉じかけの間は印）", async () => {
  const v = makeVenue({ hang: true });
  /** @type {any} */
  let hear = null;
  const discord = {
    prepareEntrance: () => ({ ok: true, plan: null, voiceKind: "aivis" }),
    openEntrance: async (/** @type {any} */ _plan, /** @type {any} */ venue) => {
      const ears = venue.createEars();
      ears.add("p1", { vad: null, async start() {}, async dispose() {} });
      hear = (/** @type {string} */ text) =>
        venue.transcriptBuffer.append({ startMs: 0, endMs: 900, text, displayName: "たろう", speakerId: "id-p1" });
      await ears.start();
      return { ok: true, ears };
    },
    closeEntrance: () => {}
  };
  const { server, url } = await startServer(v, { experiences: { discord } });
  try {
    const started = await post(url, "/api/stream/start", { experience: "discord" });
    assert.equal(started.json.stream.experience, "discord");
    hear("通話の一言");
    const stopping = post(url, "/api/stream/stop");
    await until(() => v.brain.rec.asks.length === 1, "organiser ask");
    const during = await state(url);
    assert.equal(during.stream.experience, "discord");
    assert.equal(during.stream.phase, "closing");
    assert.equal(during.stream.organising, true);
    v.brain.rec.release();
    const stopped = await stopping;
    assert.equal(stopped.json.stream.phase, "closed");
    assert.deepEqual(v.events.slice(0, 3), ["memory.write:1", "organiser.start:chappy", "organising:true"]);
    assert.deepEqual(v.lines, ["memory: organising (role chappy)", "memory: organised (commit c0ffee1)"]);
  } finally {
    await server.close();
    v.cleanup();
  }
});

test("場にロールが 2 つ: ロールごとの置き場に別々の③（saveFinal の順に・それぞれのフォルダと控えの区切り）", async () => {
  /** @type {string[]} */
  const events = [];
  /** @type {string[]} */
  const lines = [];
  const root = mkdtempSync(join(tmpdir(), "organiser-c-memories-"));
  const backupRoot = mkdtempSync(join(tmpdir(), "organiser-c-backups-"));
  /** @type {any} */
  let server = null;
  const brain = makeBrain(events);
  const organiserStart = makeOrganiserStart(events);
  const runner = createMemoryOrganiserRunner({
    getCreate: () => brain.create,
    backupRoot,
    onLine: (line) => lines.push(line),
    onWarning: (line) => lines.push(`WARN ${line}`),
    onRunningChange: (running) => server?.setMemoryOrganising(running),
    headImpl: async () => ({ ok: true, head: HEAD }),
    checkDueImpl: async () => ({ due: true, reason: "never" }),
    startImpl: organiserStart.startImpl
  });
  const recorder = createMemoryRecorder({
    getLiveEntries: () => [],
    writeImpl: async () => ({ written: true })
  });
  const makeRole = (/** @type {string} */ id) => {
    const places = createRoleMemoryPlaces({
      root,
      currentRole: () => ({ id, name: { canonical: id } }),
      startedAtMs: 0,
      prepareImpl: async () => ({ ok: true }),
      createRecordLogImpl: () => ({ dateJst: "2026-11-05", files: () => [], note: () => {} })
    });
    const venue = createStreamVenueHooks({
      memoryPlaces: places,
      memoryRecorder: recorder,
      openSession: () => {},
      closeSession: async () => {},
      hasBody: () => false,
      channel: { getUrl: () => null, connect: async () => {}, close: async () => {} },
      setTimeoutImpl: unrefTimeout,
      organiser: runner
    });
    return { id: () => id, identity: () => ({ id, displayName: id }), hooks: venue.hooks };
  };
  const ears = makeEars();
  server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (ears.factory),
    fireOrchestratorFactory: /** @type {any} */ (makeOrchestrator()),
    roles: [makeRole("chappy"), makeRole("cody")]
  });
  const url = await server.listen(0);
  try {
    assert.equal((await post(url, "/api/stream/start", { device: "Mic" })).status, 200);
    const stopped = await post(url, "/api/stream/stop");
    assert.equal(stopped.json.stream.phase, "closed");
    assert.deepEqual(
      organiserStart.starts.map((s) => [s.roleId, s.dir]),
      [
        ["chappy", join(root, "chappy")],
        ["cody", join(root, "cody")]
      ]
    );
    assert.deepEqual(events.filter((e) => e.startsWith("organiser.ask")), ["organiser.ask:chappy", "organiser.ask:cody"]);
    assert.deepEqual(lines, [
      "memory: organising (role chappy)",
      "memory: organised (commit c0ffee1)",
      "memory: organising (role cody)",
      "memory: organised (commit c0ffee1)"
    ]);
    assert.deepEqual(readdirSync(backupRoot).sort(), ["chappy", "cody"], "控えはロールごとの区切り");
  } finally {
    await server.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(backupRoot, { recursive: true, force: true });
  }
});

// ── 2. Ctrl+C ───────────────────────────────────────────────────────────

test("Ctrl+C（閉じかけの整理の最中）: ③はすぐ打ち切り（abort）、終えるは整理を待たずに進む・打ち切りの 1 行は B の 1 行だけ", async () => {
  const v = makeVenue({ hang: true });
  const { server, url } = await startServer(v);
  /** @type {string[]} */
  const log = [];
  await post(url, "/api/stream/start", { device: "Mic" });
  const stopping = post(url, "/api/stream/stop");
  await until(() => v.brain.rec.asks.length === 1, "organiser ask");
  assert.equal(v.runner.isRunning(), true);
  // 頼みは答えないまま（release しない）。Ctrl+C で終わりまで進む。
  await makeShutdown(v, server, log)();
  const stopped = await stopping.catch(() => null);
  assert.ok(stopped === null || stopped.json.stream.phase === "closed");
  assert.equal(v.runner.isRunning(), false);
  assert.equal(v.brain.rec.disposed, 1, "セッションを閉じる");
  assert.ok(v.events.includes("organiser.reset"), "走る前の先頭へ戻す");
  assert.equal(v.events.includes("organiser.commit"), false, "コミットしない");
  assert.deepEqual(v.lines, ["memory: organising (role chappy)"], "終わりの 1 行は C からは出さない");
  assert.deepEqual(v.warnings, [ORGANISER_ABORTED_WARNING], "打ち切りの 1 行は B の 1 行だけ");
  assert.deepEqual(log.slice(-2), ["disposeRest", "finalize"]);
  assert.equal(server.streamStatus().phase, "closed");
  v.cleanup();
});

test("Ctrl+C（閉じの書き出しの最中）: ②は今どおり待ち、そのあと③は始めない", async () => {
  /** @type {Array<() => void>} */
  const releases = [];
  const v = makeVenue({
    writeImpl: (entries) =>
      new Promise((resolve) => {
        v.events.push(`memory.write:${entries.length}`);
        releases.push(() => resolve({ written: true }));
      })
  });
  const { server, url, ears } = await startServer(v);
  /** @type {string[]} */
  const log = [];
  await post(url, "/api/stream/start", { device: "Mic" });
  ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "一言" });
  const stopping = post(url, "/api/stream/stop");
  await until(() => releases.length === 1, "writer");
  const shutdown = makeShutdown(v, server, log)();
  await settle();
  assert.equal(log.includes("finalize"), false, "②を待っている");
  releases[0]();
  await shutdown;
  await stopping.catch(() => null);
  assert.equal(v.organiserStart.starts.length, 0, "③は始めない");
  assert.equal(v.brain.rec.created, 0);
  assert.deepEqual(v.lines, []);
  assert.deepEqual(v.warnings, []);
  assert.deepEqual(log.slice(-2), ["disposeRest", "finalize"]);
  v.cleanup();
});

test("Ctrl+C（場が開いている）: 終えると同じ道で②は書くが、③は走らせない（整理は場を閉じる操作のときだけ）", async () => {
  const v = makeVenue();
  const { server, url, ears } = await startServer(v);
  /** @type {string[]} */
  const log = [];
  await post(url, "/api/stream/start", { device: "Mic" });
  ears.record.buffer.append({ startMs: 0, endMs: 1000, text: "最後の一言" });
  await makeShutdown(v, server, log)();
  assert.deepEqual(v.events, ["memory.write:1"]);
  assert.equal(v.organiserStart.starts.length, 0);
  assert.deepEqual(v.lines, []);
  assert.deepEqual(v.warnings, []);
  assert.equal(log[0], "[cockpit] closing…");
  assert.deepEqual(log.slice(-2), ["disposeRest", "finalize"]);
  v.cleanup();
});

test("createCockpitShutdown: 最初の 1 回で venue.stopOrganising を終えるより前に呼ぶ（2 回目は呼ばない）", async () => {
  /** @type {string[]} */
  const calls = [];
  let release = () => {};
  const shutdown = createCockpitShutdown({
    write: () => {},
    server: {
      streamStatus: () => ({ phase: "closing" }),
      endStream: () => {
        calls.push("endStream");
        return new Promise((r) => {
          release = () => r(undefined);
        });
      },
      close: async () => {
        calls.push("close");
      }
    },
    venue: {
      skipMemoryWait: () => {
        calls.push("skipMemoryWait");
        return false;
      },
      waitForRunningSaves: async () => {},
      stopOrganising: () => calls.push("stopOrganising")
    },
    disposeRest: async () => {},
    finalize: async () => {
      calls.push("finalize");
    }
  });
  const first = shutdown();
  await shutdown();
  release();
  await first;
  assert.deepEqual(calls, ["stopOrganising", "endStream", "skipMemoryWait", "close", "finalize"]);
});

// ── 3. 整理の係（createMemoryOrganiserRunner）の単体 ─────────────────────

/** @param {object} [over] */
function makeRunner(over = {}) {
  /** @type {string[]} */
  const lines = [];
  /** @type {string[]} */
  const warnings = [];
  /** @type {boolean[]} */
  const running = [];
  /** @type {any[]} */
  const starts = [];
  const runner = createMemoryOrganiserRunner({
    getCreate: () => () => assert.fail("not used"),
    backupRoot: "C:\\unused-backups",
    onLine: (l) => lines.push(l),
    onWarning: (l) => warnings.push(l),
    onRunningChange: (r) => running.push(r),
    headImpl: async () => ({ ok: true, head: HEAD }),
    checkDueImpl: async () => ({ due: true, reason: "never" }),
    startImpl: /** @type {any} */ (
      (/** @type {any} */ options) => {
        starts.push(options);
        return { done: Promise.resolve({ status: "organised", commit: ORGANISED_COMMIT, changed: false }), abort: async () => ({}) };
      }
    ),
    ...over
  });
  return { runner, lines, warnings, running, starts };
}

const PLACE = Object.freeze({ roleId: "chappy", dir: "C:\\fake-memories\\chappy", ready: Promise.resolve() });

test("整理の係: 変更なしの回は空のコミットの 1 行・走っている間だけ onRunningChange・頭は getCreate の値", async () => {
  const create = () => ({});
  const r = makeRunner({ getCreate: () => create });
  assert.equal(await r.runner.organiseIfDue(PLACE), "organised");
  assert.deepEqual(r.lines, ["memory: organising (role chappy)", "memory: organised (no changes, commit c0ffee1)"]);
  assert.deepEqual(r.running, [true, false]);
  assert.equal(r.starts[0].create, create);
  assert.equal(r.starts[0].roleId, "chappy");
  assert.equal(r.starts[0].dir, PLACE.dir);
  assert.equal(r.starts[0].backupRoot, "C:\\unused-backups");
  assert.deepEqual(r.warnings, []);
});

test("整理の係: ③の頼みに待つ上限を渡さない（渡されても通さない・記憶の整理 Domain D）", async () => {
  const r = makeRunner({ askTimeoutMs: 50 });
  assert.equal(await r.runner.organiseIfDue(PLACE), "organised");
  assert.equal(r.starts.length, 1);
  assert.equal("askTimeoutMs" in r.starts[0], false);
  assert.deepEqual(Object.keys(r.starts[0]).sort(), ["backupRoot", "create", "dir", "onWarning", "roleId"]);
});

test("整理の係: 置き場が無い・git の先頭が無い・時期でない・止めたあとは何もしない（何も出さない）", async () => {
  const none = makeRunner();
  assert.equal(await none.runner.organiseIfDue(null), "unavailable");
  const noHead = makeRunner({ headImpl: async () => ({ ok: true, head: null }) });
  assert.equal(await noHead.runner.organiseIfDue(PLACE), "not-prepared");
  const noGit = makeRunner({ headImpl: async () => ({ ok: false, error: "memory folder is not prepared (no .git)" }) });
  assert.equal(await noGit.runner.organiseIfDue(PLACE), "not-prepared");
  const recent = makeRunner({ checkDueImpl: async () => ({ due: false, reason: "recent", lastAtMs: 0, commit: HEAD }) });
  assert.equal(await recent.runner.organiseIfDue(PLACE), "not-due");
  const stopped = makeRunner();
  stopped.runner.stop();
  assert.equal(await stopped.runner.organiseIfDue(PLACE), "stopped");
  for (const r of [none, noHead, noGit, recent, stopped]) {
    assert.deepEqual(r.lines, []);
    assert.deepEqual(r.warnings, []);
    assert.deepEqual(r.starts, []);
    assert.deepEqual(r.running, []);
  }
});

test("整理の係: 時期を見ている間に止めたら始めない・始められなければ 1 行", async () => {
  /** @type {(v: any) => void} */
  let answerDue = () => {};
  const r = makeRunner({ checkDueImpl: () => new Promise((resolve) => (answerDue = resolve)) });
  const pending = r.runner.organiseIfDue(PLACE);
  await settle();
  r.runner.stop();
  answerDue({ due: true, reason: "never" });
  assert.equal(await pending, "stopped");
  assert.deepEqual(r.starts, []);
  const bad = makeRunner({
    startImpl: /** @type {any} */ (
      () => {
        throw new TypeError("bad");
      }
    )
  });
  assert.equal(await bad.runner.organiseIfDue(PLACE), "start-failed");
  assert.deepEqual(bad.warnings, [ORGANISER_START_FAILED_WARNING]);
  assert.deepEqual(bad.lines, []);
  assert.deepEqual(bad.running, []);
});

test("整理の係: 本物の git — .git の無いフォルダ・まだコミットの無いフォルダでは何もしない（控えの置き場を作らない・警告しない）", async () => {
  const base = mkdtempSync(join(tmpdir(), "organiser-c-git-"));
  try {
    const backupRoot = join(base, "backups");
    const noGit = join(base, "no-git");
    const empty = join(base, "empty");
    execFileSync("git", ["init", "--quiet", empty]);
    for (const dir of [noGit, empty]) {
      /** @type {string[]} */
      const out = [];
      const runner = createMemoryOrganiserRunner({
        getCreate: () => () => assert.fail("頭を作らない"),
        backupRoot,
        onLine: (l) => out.push(l),
        onWarning: (l) => out.push(l),
        startImpl: /** @type {any} */ (() => assert.fail("走らせない"))
      });
      assert.equal(await runner.organiseIfDue({ roleId: "chappy", dir, ready: Promise.resolve() }), "not-prepared", dir);
      assert.deepEqual(out, []);
    }
    assert.equal(existsSync(backupRoot), false, "控えの置き場を作らない");
    assert.equal(existsSync(noGit), false, "記憶のフォルダも作らない");
    // 念のため: 本物の口の読み方（ここで使うのは readMemoryHead）。
    assert.deepEqual(await readMemoryHead({ dir: empty }), { ok: true, head: null });
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("整理の係: 本物の checkOrganiseDue — 履歴が読めないときは B の 1 行だけ（走らせない）", async () => {
  /** @type {string[]} */
  const out = [];
  const runner = createMemoryOrganiserRunner({
    getCreate: () => () => assert.fail("頭を作らない"),
    backupRoot: "C:\\unused-backups",
    onLine: (l) => out.push(`LINE ${l}`),
    onWarning: (l) => out.push(`WARN ${l}`),
    headImpl: async () => ({ ok: true, head: HEAD }),
    checkDueImpl: (/** @type {any} */ options) => checkOrganiseDue({ ...options, logImpl: async () => ({ ok: false, error: "fake" }) }),
    startImpl: /** @type {any} */ (() => assert.fail("走らせない"))
  });
  assert.equal(await runner.organiseIfDue(PLACE), "not-due");
  assert.deepEqual(out, [`WARN ${ORGANISER_LOG_FAILED_WARNING}`]);
  // 7 日たっていない（本物の判定・注入した時計）なら何も出さない。
  /** @type {string[]} */
  const quiet = [];
  const nowMs = Date.UTC(2026, 10, 5, 3, 0, 0);
  const recentRunner = createMemoryOrganiserRunner({
    getCreate: () => () => assert.fail("頭を作らない"),
    backupRoot: "C:\\unused-backups",
    onLine: (l) => quiet.push(l),
    onWarning: (l) => quiet.push(l),
    now: () => new Date(nowMs),
    headImpl: async () => ({ ok: true, head: HEAD }),
    checkDueImpl: (/** @type {any} */ options) =>
      checkOrganiseDue({
        ...options,
        logImpl: async () => ({
          ok: true,
          commits: [{ commit: HEAD, committedAtMs: nowMs - ORGANISE_INTERVAL_MS + 60_000, subject: "整理役 2026-10-29 12:01:00 +09:00" }]
        })
      }),
    startImpl: /** @type {any} */ (() => assert.fail("走らせない"))
  });
  assert.equal(await recentRunner.organiseIfDue(PLACE), "not-due");
  assert.deepEqual(quiet, []);
});

// ── 4. 本番の結線（main）───────────────────────────────────────────────

test("本番の控えの置き場は DEFAULT_MEMORY_BACKUP_ROOT（apps/soul/agent/memory-backups）を main が明示して渡す・頭は②と同じ決め方", () => {
  assert.equal(MEMORY_BACKUP_ROOT, DEFAULT_MEMORY_BACKUP_ROOT);
  assert.equal(resolve(MEMORY_BACKUP_ROOT), resolve(here, "..", "memory-backups"));
  const source = readFileSync(new URL("./cockpit.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const main = source.slice(source.indexOf("async function main()"));
  assert.match(main, /const memoryOrganiser = createMemoryOrganiserRunner\(\{\n\s+getCreate: \(\) => resolveWriterBrainDef\(currentBrain\)\.create,\n\s+backupRoot: MEMORY_BACKUP_ROOT,/);
  assert.match(main, /onRunningChange: \(running\) => server\?\.setMemoryOrganising\(running\)/);
  assert.match(main, /onWarning: onBrainWarning,/);
  assert.match(main, /organiser: memoryOrganiser\n\s+\}\);/);
  assert.equal((main.match(/createMemoryOrganiserRunner\(/g) ?? []).length, 1, "係は 1 つ（置き場ごとに別の整理を走らせる）");
});

test("cockpit-server.setMemoryOrganising: 閉じかけの外では印を立てない（次の閉じかけに持ち越さない）・閉じたら下ろす", async () => {
  const v = makeVenue({ due: false });
  const { server, url } = await startServer(v);
  try {
    server.setMemoryOrganising(true);
    assert.equal((await state(url)).stream.organising, false, "閉じている間は立たない");
    await post(url, "/api/stream/start", { device: "Mic" });
    server.setMemoryOrganising(true);
    assert.equal((await state(url)).stream.organising, false, "開いている間も立たない");
    await post(url, "/api/stream/stop");
    assert.equal((await state(url)).stream.organising, false);
  } finally {
    await server.close();
    v.cleanup();
  }
});
