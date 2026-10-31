// @ts-check
// Discord モード Domain B: cockpit.mjs の側（discord-mode.md §4.4・§5）。
//  - createVenueRoleBundle: main() の今の 1 つずつの変数（今のロール・場の口・声の engine と再生器・④）を包む「ロールごとの束」。
//  - 束を本物の cockpit-server に渡しても、配信の始める・終えるの並びが今と同じ（声の engine は耳の前・再生器と目は耳の後）。
//  - main() の結線（main は export されず走らせられないので、ソースの並びで固定する・前例と同じ流儀）。
// 本物の cockpit-server（loopback の HTTP）と偽の耳・orchestrator・器・頭のセッション・保存の係だけ。実データ・本物の LLM・
// 外部 API・マイク・Discord には触れない。ファイルは書かない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createVenueRoleBundle, createStreamVenueHooks } from "./cockpit.mjs";
import { createCockpitServer } from "../src/cockpit/cockpit-server.mjs";
import { MODEL_IDENTITIES } from "../src/mind/model-identity.mjs";

/** @param {string} url @param {string} path @param {unknown} [body] */
async function post(url, path, body = {}) {
  const r = await fetch(`${url}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: /** @type {any} */ (await r.json()) };
}

// ── createVenueRoleBundle ──────────────────────────────────────────────────

test("createVenueRoleBundle: 束の口は呼んだ時点の今のロールを読む・場の口は同じものを渡す・声と④は素通し", async () => {
  const roleRef = { id: "chappy", identity: MODEL_IDENTITIES.chappy };
  const streamHooks = { renewRecords() {}, openSession() {} };
  /** @type {any[]} */
  const calls = [];
  const bundle = createVenueRoleBundle({
    currentId: () => roleRef.id,
    identity: () => roleRef.identity,
    streamHooks,
    prepareVoice: (kind) => {
      calls.push(["prepare", kind]);
      return { ok: kind === "aivis", reason: kind === "aivis" ? undefined : "no key (test)" };
    },
    startVoiceResources: () => calls.push(["resources"]),
    recallRunner: async (job) => {
      calls.push(["recall", job.request]);
      return { found: false, summary: "" };
    }
  });
  assert.ok(Object.isFrozen(bundle));
  assert.equal(bundle.id(), "chappy");
  assert.equal(bundle.identity(), MODEL_IDENTITIES.chappy);
  roleRef.id = "cody";
  roleRef.identity = MODEL_IDENTITIES.cody;
  assert.equal(bundle.id(), "cody", "ロールを替えても束を作り直さない（今のロールを読む）");
  assert.equal(bundle.identity(), MODEL_IDENTITIES.cody);
  assert.equal(bundle.hooks, streamHooks, "場の口は同じもの（ゲッターを先に引かない）");
  assert.deepEqual(bundle.voice.prepare("aivis"), { ok: true, reason: undefined });
  assert.deepEqual(bundle.voice.prepare("elevenlabs"), { ok: false, reason: "no key (test)" });
  bundle.voice.startResources();
  assert.deepEqual(await bundle.recall?.run({ request: "前の配信", entries: [], nowMs: 0 }), { found: false, summary: "" });
  assert.deepEqual(calls, [["prepare", "aivis"], ["prepare", "elevenlabs"], ["resources"], ["recall", "前の配信"]]);
});

test("createVenueRoleBundle: 再生器が起きなくても投げない（警告の 1 行だけ・本文やキーは入れない）・④が無ければ recall は null", () => {
  /** @type {string[]} */
  const warnings = [];
  const bundle = createVenueRoleBundle({
    currentId: () => "mio",
    identity: () => MODEL_IDENTITIES.cody,
    streamHooks: {},
    prepareVoice: () => ({ ok: true }),
    startVoiceResources: () => {
      throw new Error("player spawn failed (fake)");
    },
    onWarning: (line) => warnings.push(line)
  });
  assert.doesNotThrow(() => bundle.voice.startResources());
  assert.deepEqual(warnings, ["voice resources failed to start: player spawn failed (fake)"]);
  assert.equal(bundle.recall, null);
  const silent = createVenueRoleBundle({
    currentId: () => "mio",
    identity: () => MODEL_IDENTITIES.cody,
    streamHooks: {},
    prepareVoice: () => ({ ok: true }),
    startVoiceResources: () => {
      throw new Error("boom");
    },
    onWarning: () => {
      throw new Error("log failed");
    }
  });
  assert.doesNotThrow(() => silent.voice.startResources(), "知らせの失敗でも投げない");
});

// ── 束を本物の server に渡す（配信の並びが今と同じ）──────────────────────────────

test("束を cockpit-server に渡す: 配信を始める・終えるの並びが今と同じ（場の記録 → 声の engine → 耳 → 再生器 → 目 → 頭 → 器 / 目 → 耳 → 頭 → 器 → 最後の保存）", async () => {
  /** @type {string[]} */
  const events = [];
  /** @type {any} */
  let server = null;
  let streamNo = 0;
  /** @type {any} */
  let place = null;
  const venue = createStreamVenueHooks({
    memoryPlaces: {
      beginStream: () => {
        streamNo += 1;
        place = { streamNo, ready: Promise.resolve().then(() => void events.push("memory.prepare")) };
      },
      place: () => place,
      streamNo: () => streamNo
    },
    memoryRecorder: {
      record: async (entries = []) => void events.push(`memory.record:${entries.map((e) => e.text).join("/")}`),
      whenIdle: async () => {},
      isRecording: () => false
    },
    renewUsageLog: () => void events.push("usageLog.renew"),
    openSession: () => void events.push("session.open"),
    closeSession: async () => void events.push("session.close"),
    hasBody: () => true,
    channel: {
      getUrl: () => {
        events.push("channel.getUrl");
        return "ws://127.0.0.1:1/control";
      },
      connect: async () => void events.push("channel.connect"),
      close: async () => void events.push("channel.close")
    },
    isStreamOpen: () => server != null && server.streamStatus().phase === "open",
    getEntries: () => (server ? server.getTranscript() : []),
    nowImpl: () => 1_000
  });
  const roleRef = { id: "chappy" };
  const bundle = createVenueRoleBundle({
    currentId: () => roleRef.id,
    identity: () => MODEL_IDENTITIES.chappy,
    streamHooks: venue.hooks,
    prepareVoice: (kind) => {
      events.push(`voice.prepare:${kind}`);
      return { ok: true };
    },
    startVoiceResources: () => void events.push("voice.resources")
  });
  /** @type {any} */
  let earOptions = null;
  server = createCockpitServer({
    pipelineFactory: /** @type {any} */ ((/** @type {any} */ options) => {
      earOptions = options;
      return {
        transcriptBuffer: options.transcriptBuffer,
        async start() {
          events.push("ears.start");
        },
        async dispose() {
          events.push("ears.dispose");
        },
        isDisposed: () => false,
        streamMs: () => 0,
        stats: () => ({})
      };
    }),
    roles: [bundle],
    onEyesStart: () => void events.push("eyes.start"),
    onEyesStop: () => void events.push("eyes.stop")
  });
  const url = await server.listen(0);
  try {
    const started = await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal(started.status, 200);
    assert.equal(started.json.stream.experience, "stream");
    assert.deepEqual(events, [
      "usageLog.renew",
      "memory.prepare",
      "voice.prepare:aivis",
      "ears.start",
      "voice.resources",
      "eyes.start",
      "session.open",
      "channel.getUrl",
      "channel.connect"
    ]);
    assert.equal(started.json.brain.identity.id, "chappy", "名前は束から");
    const r = earOptions.transcriptBuffer.append({ startMs: 0, endMs: 900, text: "一言" });
    earOptions.onTranscript(r.entry, { latencyMs: 10, audioCtx: null });
    events.length = 0;
    const stopped = await post(url, "/api/stream/stop");
    assert.equal(stopped.status, 200);
    assert.deepEqual(events, ["eyes.stop", "ears.dispose", "session.close", "channel.close", "memory.record:一言"]);
  } finally {
    await server.close();
  }
  assert.equal(events.at(-1), "eyes.stop", "close() でも目を止める");
});

// ── main() の結線（ソースの並び）────────────────────────────────────────────

test("場の結線（main）: ロールの束を 1 つ作って roles で渡し、目は onEyesStart / onEyesStop・個別のロールの口は渡さない", () => {
  const source = readFileSync(new URL("./cockpit.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const main = source.slice(source.indexOf("async function main()"));
  assert.match(main, /const venueRole = createVenueRoleBundle\(\{\n\s+currentId: \(\) => roleHooks\.currentId\(\),\n\s+identity: getCurrentRoleIdentity,\n\s+streamHooks: streamVenue\.hooks,/);
  assert.match(main, /prepareVoice: \(kind\) => \{\n\s+desiredTtsEngine = kind;\n\s+return voiceEngines\.prepare\(kind\);\n\s+\},/, "声の engine の用意は耳を開く前（方式を覚えてから）");
  assert.match(main, /startVoiceResources: ensureVoiceResources,\n\s+recallRunner,/);
  const call = main.slice(main.indexOf("server = createCockpitServer({"), main.indexOf("const url = await server.listen();"));
  assert.ok(call.length > 0);
  assert.match(call, /roles: \[venueRole\],/);
  assert.match(call, /onEyesStart: \(\) => residentCapture\.start\(\),/);
  assert.match(call, /onEyesStop: \(\) => residentCapture\.stop\(\),/);
  for (const old of [/currentRoleIdentity:/, /streamHooks:/, /onPrepareVoiceEngine:/, /onEarsStarted:/, /onEarsStopped:/, /\brecallRunner,/]) {
    assert.doesNotMatch(call, old, `ロールの口は束から（${old}）`);
  }
});
