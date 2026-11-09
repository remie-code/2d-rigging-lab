// @ts-check
/**
 * 咳払いの落とし（段階 2）Domain A の 2 回目「親の側」— 場（cockpit-server）の結線を確かめる。
 * 計画: discussion/ai-cohost/implementation/orchestration/cough-filter-stage2-plan.md §4 A の 2〜6・8。
 *
 *  - SSE `discard` の形: reason "cough" のときだけ text と speech が載る・blank の形は今のまま・discarded に咳の分が入る（§4 A の 3）。
 *  - 設定（文字数の上限・Speech の線）は Start ごとに読まれ、耳と子の係に届く（§4 A の 6）。
 *  - 文字と確率は SSE `discard` にしか出ない: 診断の放送・警告・snapshot・正本・標準出力 / 標準エラーに出ない（§4 A の 4）。
 *  - モデルが無い・読み込めないとき: Start は成功・警告は場ごとに 1 回・決まった英語の 1 行・切ったときは警告しない（§4 A の 5）。
 *  - Discord の人ごとの耳でも同じく落ち、同じ SSE が出る・誰の咳かは載せない・2 人で「判定なし」でも警告は 1 回（§4 A の 8）。
 *
 * 耳は本物の createEarPipeline に偽の部品（取り込み・VAD・ローカルの文字起こしの係）を差すか、偽の耳を使う。本物のマイク・sherpa・
 * CED-tiny・Discord・LLM・外部 API は使わない。設定ファイルは OS の一時フォルダだけ（終わったら消す）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCockpitServer, COUGH_FILTER_OFF_WARNINGS, COUGH_FILTER_OFF_WARNING_ID } from "./cockpit-server.mjs";
import { createFileSettingsStore } from "./cockpit-settings-store.mjs";
import { createTranscriptBuffer } from "../ears/transcript-buffer.mjs";
import { createDiscordExperience } from "../discord/discord-experience.mjs";
import { createFakeDiscord } from "../test-support/fake-discord.mjs";
import { sinePcm, silencePcm, concatInt16, int16ToBytesLE } from "../ears/fixtures-audio.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";

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

/**
 * 標準出力・標準エラー（`[cockpit]` の行の出口）を拾う。書き込みは元の口へもそのまま流す（テストの走らせ役の報告も
 * 標準出力を通るので、握りつぶすと別のテストの結果が消える）。
 */
function captureStdio() {
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;
  /** @type {string[]} */
  const writes = [];
  /** @param {any} original */
  const tee = (original) =>
    function (/** @type {any} */ chunk, /** @type {any[]} */ ...rest) {
      writes.push(typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk));
      return original.call(this, chunk, ...rest);
    };
  process.stdout.write = /** @type {any} */ (tee(originalOut));
  process.stderr.write = /** @type {any} */ (tee(originalErr));
  return {
    text: () => writes.join(""),
    restore() {
      process.stdout.write = originalOut;
      process.stderr.write = originalErr;
    }
  };
}

/** 偽の耳（pipelineFactory）。場の正本（積む口）と診断の口を握る。 */
function makeFakePipeline() {
  const record = { /** @type {any} */ options: null, /** @type {any} */ buffer: null };
  const factory = (/** @type {any} */ options) => {
    record.options = options;
    record.buffer = options?.transcriptBuffer ?? createTranscriptBuffer({ nowImpl: () => 1000 });
    return {
      transcriptBuffer: record.buffer,
      async start() {},
      async dispose() {},
      isDisposed: () => false,
      streamMs: () => 0,
      stats: () => ({})
    };
  };
  return { factory, record };
}

/** 本物の耳に差す決定論の VAD（RMS > 0.1 → 0.9 / それ以外 0.05）。 */
const fakeVadFactory = () => ({
  async init() {},
  /** @param {Float32Array} frame */
  async process(frame) {
    let sum = 0;
    for (let i = 0; i < frame.length; i += 1) sum += frame[i] * frame[i];
    return Math.sqrt(sum / frame.length) > 0.1 ? 0.9 : 0.05;
  },
  reset() {},
  async dispose() {}
});

/**
 * 偽物のローカルの文字起こしの係（本物の耳の localSttFactory）。転写は順に results を返す（全部の耳で共有の順番）。
 * @param {{ results: Array<{ text: string; speech: number | null }>; audioTagging?: { enabled: boolean; reason: string | null } }} p
 */
function makeFakeLocalStt({ results, audioTagging = { enabled: true, reason: null } }) {
  const rec = { /** @type {any[]} */ options: [], calls: 0 };
  const factory = (/** @type {any} */ opts) => {
    rec.options.push(opts);
    const info = { loadMs: 10, decodingMethod: "greedy_search", hotwordsUsed: [], hotwordsDropped: [], audioTagging };
    opts.onReady?.(info);
    return {
      ready: Promise.resolve(info),
      async transcribe() {
        const r = results[rec.calls] ?? { text: "ふつうの話", speech: null };
        rec.calls += 1;
        return { text: r.text, rawText: r.text, ms: 5, tagged: r.speech !== null, speech: r.speech, tagMs: r.speech !== null ? 12 : null };
      },
      hasExited: () => false,
      isDisposed: () => false,
      pending: () => 0,
      dispose() {}
    };
  };
  return { factory: /** @type {any} */ (factory), rec };
}

/** 「無音 → 正弦波 480ms → 無音」（1 発話）。 */
const utterancePcm = () => concatInt16(silencePcm({ durationMs: 400 }), sinePcm({ freq: 440, durationMs: 480 }), silencePcm({ durationMs: 160 }));

// ── 1. SSE discard の形（§4 A の 3）────────────────────────────────────────────

test("咳の SSE discard: reason cough のときだけ text と speech が載る・blank の形は今のまま・discarded に咳の分が入る", async () => {
  const fake = makeFakePipeline();
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fake.factory),
    localSttModelCheck: () => ({ ok: true }),
    sttEngineInitial: "zipformer"
  });
  const url = await server.listen(0);
  const sse = openEvents(url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    assert.equal((await post(url, "/api/stream/start", { device: "Mic" })).status, 200);
    fake.record.buffer.discard({ startMs: 1000, endMs: 1400, text: "うん", reason: "cough", speech: 0.05 });
    fake.record.buffer.append({ startMs: 2000, endMs: 2100, text: "   " });
    await waitUntil(() => sse.events.filter((e) => e.event === "discard").length === 2);
    const [cough, blank] = sse.events.filter((e) => e.event === "discard").map((e) => e.data);
    assert.deepEqual(cough, { startMs: 1000, endMs: 1400, reason: "cough", appended: 0, discarded: 1, text: "うん", speech: 0.05 });
    assert.deepEqual(blank, { startMs: 2000, endMs: 2100, reason: "blank", appended: 0, discarded: 2 }, "blank に text を載せない");
    assert.deepEqual(Object.keys(blank), ["startMs", "endMs", "reason", "appended", "discarded"]);
    const state = await get(url, "/api/state");
    assert.equal(state.json.discarded, 2, "snapshot の discarded に咳の分が入る");
    assert.equal(state.json.appended, 0);
    assert.equal(JSON.stringify(state.json).includes("うん"), false, "snapshot に落とした文字は載らない");
    assert.equal(server.getTranscript().length, 0);
  } finally {
    sse.close();
    await server.close();
  }
});

// ── 2. 本物の耳を通す: Start ごとの設定・落とし・文字の漏れ（§4 A の 2・4・6）──────────────────

for (const engine of ["zipformer", "haas"]) test(`配信の耳（${engine}）: 設定は Start ごとに読まれて子の係と比べに届く・咳は落ちて SSE discard だけに文字と確率が出る`, async () => {
  /** @type {any[]} */
  let settingsNow = [{ coughMaxChars: 4, coughSpeechThreshold: 0.1 }];
  let reads = 0;
  const local = makeFakeLocalStt({
    results: [
      { text: "うん", speech: 0.05 }, // 1 回目の Start: 線 0.1 より低い → 落とす
      { text: "はい", speech: 0.9 }, // 1 回目: 通す
      { text: "えっ", speech: 0.2 } // 2 回目の Start: 線 0.3 より低い → 落とす（線は設定で変わる）
    ]
  });
  /** @type {any[]} */
  const captures = [];
  /** @type {any[]} */
  const sttLogs = [];
  const savedEngines = [];
  const stdio = captureStdio();
  const server = createCockpitServer({
    onSttLatency: (/** @type {any} */ info) => sttLogs.push(info),
    localSttModelCheck: () => ({ ok: true }),
    localSttSettings: () => {
      reads += 1;
      return settingsNow[0];
    },
    sttEngineInitial: engine,
    onSetSttEngine: (value) => { savedEngines.push(value); },
    pipelineOptions: {
      segmenter: { minSpeechMs: 100, minSilenceMs: 64, speechPadMs: 0 },
      vadFactory: fakeVadFactory,
      localSttFactory: local.factory,
      captureFactory: (/** @type {any} */ o) => {
        captures.push(o);
        return { dispose() {} };
      }
    }
  });
  const url = await server.listen(0);
  const sse = openEvents(url);
  try {
    await waitUntil(() => sse.events.some((e) => e.event === "state"));
    const start = await post(url, "/api/stream/start", { device: "Mic", sttEngine: engine });
    assert.equal(start.status, 200, JSON.stringify(start.json.error));
    assert.equal(reads, 1, "Start で読む");
    assert.equal(local.rec.options[0].audioTaggingMaxChars, 4, "文字数の上限は子の係へ");
    assert.equal(local.rec.options[0].engine, engine);
    assert.deepEqual(savedEngines, [engine]);
    captures.at(-1).onPcm(int16ToBytesLE(utterancePcm()));
    await waitUntil(() => local.rec.calls === 1);
    captures.at(-1).onPcm(int16ToBytesLE(utterancePcm()));
    await waitUntil(() => sse.events.some((e) => e.event === "transcript" && e.data.text === "はい"));
    await waitUntil(() => sse.events.some((e) => e.event === "discard"));
    const disc = sse.events.filter((e) => e.event === "discard").map((e) => e.data);
    assert.equal(disc.length, 1);
    assert.equal(disc[0].reason, "cough");
    assert.equal(disc[0].text, "うん");
    assert.equal(disc[0].speech, 0.05);
    assert.equal(disc[0].discarded, 1);
    assert.deepEqual(server.getTranscript().map((/** @type {any} */ e) => e.text), ["はい"], "正本に咳は積まれない");

    // 次の Start で設定を読み直す（上限 6・線 0.3）。
    await post(url, "/api/stream/stop");
    settingsNow = [{ coughMaxChars: 6, coughSpeechThreshold: 0.3 }];
    assert.equal((await post(url, "/api/stream/start", { device: "Mic" })).status, 200);
    assert.equal(reads, 2, "Start ごとに読む");
    assert.equal(local.rec.options[1].audioTaggingMaxChars, 6);
    captures.at(-1).onPcm(int16ToBytesLE(utterancePcm()));
    await waitUntil(() => sse.events.filter((e) => e.event === "discard").length === 2);
    const second = sse.events.filter((e) => e.event === "discard")[1].data;
    assert.deepEqual([second.reason, second.text, second.speech], ["cough", "えっ", 0.2]);
    await tick(20);

    // 文字と確率が出るのは SSE discard だけ（§4 A の 4）。
    const words = ["うん", "えっ"];
    const notDiscard = sse.events.filter((e) => e.event !== "discard");
    for (const w of words) {
      assert.equal(JSON.stringify(notDiscard).includes(w), false, `discard 以外の放送に ${w} が出ている`);
      assert.equal(JSON.stringify((await get(url, "/api/state")).json).includes(w), false, `snapshot に ${w}`);
      assert.equal(JSON.stringify(server.getTranscript()).includes(w), false);
      assert.equal(stdio.text().includes(w), false, `標準出力 / 標準エラーに ${w}`);
      assert.equal(JSON.stringify(sttLogs).includes(w), false, `遅延のログ（[cockpit] stt latency の材料）に ${w}`);
    }
    // 遅延のログ（[cockpit] stt latency の行）は積まれた行の分だけ（落とした咳は数えない）・方式と数だけ。
    assert.equal(sttLogs.length, 1);
    assert.deepEqual(Object.keys(sttLogs[0]).sort(), ["engine", "latencyMs"]);
    const diagnostics = sse.events.filter((e) => e.event === "diagnostic").map((e) => e.data);
    const coughDiags = diagnostics.filter((d) => d.type === "transcriptDiscarded");
    assert.equal(coughDiags.length, 2);
    assert.ok(coughDiags.every((d) => d.reason === "cough" && d.message === null));
    for (const p of ["0.05", "0.2"]) assert.equal(JSON.stringify(diagnostics).includes(p), false, `診断に確率 ${p}`);
    const warnings = sse.events.filter((e) => e.event === "warnings");
    for (const w of words) assert.equal(JSON.stringify(warnings).includes(w), false);
    assert.equal(
      (await get(url, "/api/state")).json.warnings.some((/** @type {any} */ w) => w.kind === "cough-filter-off"),
      false,
      "判定ありなら警告しない"
    );
  } finally {
    stdio.restore();
    sse.close();
    await server.close();
  }
});

// ── 3. モデルが無い・読み込めないとき（§4 A の 5）──────────────────────────────────

test("判定なし: Start は成功・警告は場ごとに 1 回（決まった英語の 1 行・パスや子の文言を入れない）・切ったときは警告しない", async () => {
  const local = makeFakeLocalStt({
    results: [],
    audioTagging: { enabled: false, reason: "audio tagging model not found (missing model.int8.onnx, class_labels_indices.csv)" }
  });
  const server = createCockpitServer({
    localSttModelCheck: () => ({ ok: true }),
    sttEngineInitial: "zipformer",
    pipelineOptions: {
      vadFactory: fakeVadFactory,
      localSttFactory: local.factory,
      captureFactory: () => ({ dispose() {} })
    }
  });
  const url = await server.listen(0);
  try {
    const start = await post(url, "/api/stream/start", { device: "Mic" });
    assert.equal(start.status, 200, "CED-tiny が無くても Start は成功");
    assert.equal(start.json.ears, "listening");
    const offs = start.json.warnings.filter((/** @type {any} */ w) => w.kind === "cough-filter-off");
    assert.equal(offs.length, 1);
    assert.equal(offs[0].id, COUGH_FILTER_OFF_WARNING_ID);
    assert.equal(offs[0].severity, "warn");
    assert.equal(offs[0].message, "咳の聞き分けが止まっている（モデルが無い）");
    assert.equal(offs[0].message, COUGH_FILTER_OFF_WARNINGS["model-not-found"].message);
    assert.match(offs[0].detail, /fetch-local-stt-models\.mjs/);
    assert.equal(offs[0].detail.endsWith("node apps/soul/agent/scripts/fetch-local-stt-models.mjs --only ced-tiny"), true, "取得のコマンドは一字も変えない");
    assert.equal(offs[0].source, "zipformer");
    assert.equal(offs[0].count, 1);
    assert.equal(/\n/.test(offs[0].message), false, "1 行");
  } finally {
    await server.close();
  }

  // 同じ場で何度知らせても 1 回（Discord の人数ぶんの耳を模す）・failed-to-load が後から来ても足さない・新しい場では数え直す。
  const fake = makeFakePipeline();
  const server2 = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fake.factory),
    localSttModelCheck: () => ({ ok: true }),
    sttEngineInitial: "zipformer"
  });
  const url2 = await server2.listen(0);
  try {
    await post(url2, "/api/stream/start", { device: "Mic" });
    const diag = fake.record.options.onDiagnostic;
    diag({ type: "audioTaggingOff", engine: "zipformer", reason: "model-not-found" });
    diag({ type: "audioTaggingOff", engine: "zipformer", reason: "model-not-found" });
    diag({ type: "audioTaggingOff", engine: "zipformer", reason: "failed-to-load" });
    let offs = (await get(url2, "/api/state")).json.warnings.filter((/** @type {any} */ w) => w.kind === "cough-filter-off");
    assert.equal(offs.length, 1);
    assert.equal(offs[0].count, 1, "場ごとに 1 回");
    // 新しい場（Stop → Start）では数え直す（同じ id の出来事として 1 回足される）。
    await post(url2, "/api/stream/stop");
    await post(url2, "/api/stream/start", { device: "Mic" });
    fake.record.options.onDiagnostic({ type: "audioTaggingOff", engine: "zipformer", reason: "failed-to-load" });
    fake.record.options.onDiagnostic({ type: "audioTaggingOff", engine: "zipformer", reason: "failed-to-load" });
    offs = (await get(url2, "/api/state")).json.warnings.filter((/** @type {any} */ w) => w.kind === "cough-filter-off");
    assert.equal(offs.length, 1);
    assert.equal(offs[0].count, 2, "新しい場で 1 回だけ足された");
    assert.equal(offs[0].message, "咳の聞き分けが止まっている（モデルを読み込めない）");
  } finally {
    await server2.close();
  }

  // 利用者が切った（not-configured / disabled）は警告しない。
  const fake3 = makeFakePipeline();
  const server3 = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fake3.factory),
    localSttModelCheck: () => ({ ok: true }),
    sttEngineInitial: "zipformer"
  });
  const url3 = await server3.listen(0);
  try {
    await post(url3, "/api/stream/start", { device: "Mic" });
    fake3.record.options.onDiagnostic({ type: "audioTaggingOff", engine: "zipformer", reason: "disabled" });
    fake3.record.options.onDiagnostic({ type: "audioTaggingOff", engine: "zipformer", reason: "not-configured" });
    fake3.record.options.onDiagnostic({ type: "audioTaggingOff", engine: "zipformer", reason: "C:\\some\\path" });
    const st = (await get(url3, "/api/state")).json;
    assert.equal(st.warnings.some((/** @type {any} */ w) => w.kind === "cough-filter-off"), false);
    // 決まった語でない reason（文言が紛れ込んだ場合）は警告の板に載らない。
    assert.equal(JSON.stringify(st.warnings).includes("some"), false);
  } finally {
    await server3.close();
  }
});

// ── 4. Discord の人ごとの耳（§4 A の 8）──────────────────────────────────────────

const GUILD = "guild-fake-cough";
const CHANNEL = "channel-fake-cough";
const USER_A = "user-fake-cough-a";
const USER_B = "user-fake-cough-b";
const NAME_A = "たろう";
const NAME_B = "はなこ";
const FAKE_TOKEN = "fake.discord-token_for-cough-test";
const SECRET_WORDS = [USER_A, USER_B, NAME_A, NAME_B, GUILD, CHANNEL, FAKE_TOKEN, "discord-1", "discord-2"];

/** 本物の opusscript で 440Hz の音を 20ms ずつ Opus にする（48kHz・ステレオ）。 @param {any} OpusScript @param {number} ms */
function encodeTone(OpusScript, ms) {
  const encoder = new OpusScript(48000, 2, OpusScript.Application.AUDIO);
  try {
    /** @type {Buffer[]} */
    const packets = [];
    let n = 0;
    for (let f = 0; f < ms / 20; f += 1) {
      const frame = Buffer.alloc(960 * 2 * 2);
      for (let i = 0; i < 960; i += 1, n += 1) {
        const v = Math.round(Math.sin((2 * Math.PI * 440 * n) / 48000) * 0.6 * 32767);
        frame.writeInt16LE(v, i * 4);
        frame.writeInt16LE(v, i * 4 + 2);
      }
      packets.push(Buffer.from(encoder.encode(frame, 960)));
    }
    return packets;
  } finally {
    encoder.delete();
  }
}

/** ロールの束の偽物（場の口・声）。 */
function makeRole() {
  return {
    id: () => "chappy",
    identity: () => MODEL_IDENTITIES.chappy,
    discordBotKeyFile: () => ".env.discord-chappy.local",
    hooks: {
      renewRecords: () => {},
      openSession: async () => ({ ok: true }),
      connectBody: () => ({ ok: true }),
      closeSession: () => {},
      closeBody: () => {},
      saveFinal: () => {}
    },
    voice: { prepare: () => ({ ok: true }), startResources: () => {} },
    recall: null
  };
}

/**
 * 本物の server + 本物の Discord の体験の口 + 偽の Discord + 本物の耳（偽の VAD とローカルの文字起こしの係）。
 * @param {{ OpusScript: any; local: ReturnType<typeof makeFakeLocalStt>; engine?: string }} p
 */
async function startDiscordCoughServer({ OpusScript, local, engine = "zipformer" }) {
  const dir = mkdtempSync(join(tmpdir(), "cough-discord-"));
  const settings = createFileSettingsStore({ path: join(dir, "cockpit-settings.local.json") });
  settings.setDiscordPrep({ guildId: GUILD, channelId: CHANNEL, sttEngine: engine });
  const fake = createFakeDiscord({
    guilds: [{ id: GUILD, name: "試しのサーバー", channels: [{ id: CHANNEL, name: "一般", rawPosition: 1 }], members: { [USER_A]: NAME_A, [USER_B]: NAME_B } }],
    OpusScript
  });
  /** @type {string[]} */
  const logs = [];
  const discord = createDiscordExperience({
    settings,
    currentKeyFile: () => ".env.discord-chappy.local",
    loadToken: () => /** @type {any} */ ({ ok: true, token: FAKE_TOKEN }),
    loadLibraries: async () => fake.loadLibraries(),
    log: (line) => logs.push(line),
    loginTimeoutMs: 200,
    readyTimeoutMs: 200
  });
  const server = createCockpitServer({
    commentGuard: () => ({ pass: true, kind: "ok" }),
    roles: [makeRole()],
    experiences: { discord },
    localSttModelCheck: () => ({ ok: true }),
    localSttSettings: () => settings.getLocalStt(),
    pipelineOptions: { vadFactory: fakeVadFactory, localSttFactory: local.factory }
  });
  const url = await server.listen(0);
  return {
    server,
    url,
    fake,
    logs,
    async cleanup() {
      try {
        await server.close();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  };
}

/** @param {any} h @param {any} OpusScript @param {string} userId */
async function speakOnce(h, OpusScript, userId) {
  h.fake.speak(userId);
  for (const packet of encodeTone(OpusScript, 1000)) h.fake.send(userId, packet);
  h.fake.endSpeech(userId);
}

test("Discord（2 人・人ごとの本物の耳）: どちらの咳も落ちて同じ SSE discard が出る・誰の咳かは載せない・ログと診断に文字が出ない", async () => {
  const o = /** @type {any} */ (await import("opusscript"));
  const OpusScript = o.default ?? o;
  const local = makeFakeLocalStt({ results: [{ text: "うん", speech: 0.05 }, { text: "ん", speech: 0.02 }] });
  const h = await startDiscordCoughServer({ OpusScript, local });
  const sse = openEvents(h.url);
  try {
    const r = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal(r.status, 200, JSON.stringify(r.json.error));
    await speakOnce(h, OpusScript, USER_A);
    await waitUntil(() => local.rec.calls === 1, 5000);
    await speakOnce(h, OpusScript, USER_B);
    await waitUntil(() => sse.events.filter((e) => e.event === "discard").length === 2, 5000);
    assert.equal(local.rec.options.length, 2, "人ごとに子の係が 1 つ");
    assert.ok(local.rec.options.every((x) => x.audioTaggingMaxChars === 4), "既定の上限 4 が人ごとの係へ");
    const disc = sse.events.filter((e) => e.event === "discard").map((e) => e.data);
    assert.deepEqual(
      disc.map((d) => [d.reason, d.text, d.speech, d.discarded]),
      [
        ["cough", "うん", 0.05, 1],
        ["cough", "ん", 0.02, 2]
      ]
    );
    for (const d of disc) assert.deepEqual(Object.keys(d).sort(), ["appended", "discarded", "endMs", "reason", "speech", "startMs", "text"]);
    // 誰の咳かは載せない（名前・id・耳の key）。
    for (const word of SECRET_WORDS) assert.equal(JSON.stringify(disc).includes(word), false, `discard に ${word}`);
    // 正本に咳は積まれない（入ったときの出来事の行だけ）。
    assert.deepEqual(
      h.server.getTranscript().filter((/** @type {any} */ e) => e.speaker !== "event"),
      []
    );
    const st = (await get(h.url, "/api/state")).json;
    assert.equal(st.discarded, 2);
    // 文字は discard 以外に出ない（診断・Discord のログ・警告）。
    const notDiscard = JSON.stringify(sse.events.filter((e) => e.event !== "discard"));
    for (const w of ["うん", "\"ん\""]) assert.equal(notDiscard.includes(w), false, `discard 以外の放送に ${w}`);
    assert.equal(h.logs.join("\n").includes("うん"), false);
    assert.equal(sse.events.filter((e) => e.event === "diagnostic").filter((e) => e.data.type === "transcriptDiscarded").length, 2);
    await post(h.url, "/api/stream/stop");
  } finally {
    sse.close();
    await h.cleanup();
  }
});

test("Discord Haas（2人）: 1ワーカーを共有し、転写は各話者に帰属し、咳払いだけを棄却", async () => {
  const o = /** @type {any} */ (await import("opusscript"));
  const OpusScript = o.default ?? o;
  const local = makeFakeLocalStt({
    results: [
      { text: "相づちA", speech: 0.9 },
      { text: "相づちB", speech: 0.9 },
      { text: "ぐっ", speech: 0.05 }
    ]
  });
  const h = await startDiscordCoughServer({ OpusScript, local });
  const sse = openEvents(h.url);
  try {
    const saved = await post(h.url, "/api/discord/prep", { sttEngine: "haas" });
    assert.equal(saved.status, 200);
    assert.equal((await get(h.url, "/api/discord/prep")).json.prep.sttEngine, "haas");
    const start = await post(h.url, "/api/stream/start", { experience: "discord" });
    assert.equal(start.status, 200, JSON.stringify(start.json.error));
    await speakOnce(h, OpusScript, USER_A);
    await waitUntil(() => local.rec.calls === 1, 5000);
    await speakOnce(h, OpusScript, USER_B);
    await waitUntil(() => local.rec.calls === 2, 5000);
    await speakOnce(h, OpusScript, USER_A);
    await waitUntil(() => sse.events.some((e) => e.event === "discard" && e.data.reason === "cough"), 5000);
    const transcript = h.server.getTranscript().filter((e) => e.speaker !== "event");
    assert.deepEqual(transcript.map((e) => [e.speakerId, e.text]), [[USER_A, "相づちA"], [USER_B, "相づちB"]]);
    assert.equal(local.rec.options.length, 1);
    assert.equal(local.rec.options[0].engine, "haas");
    await post(h.url, "/api/stream/stop");
  } finally {
    sse.close();
    await h.cleanup();
  }
});

test("Discord（2 人）: どちらの耳も「判定なし」を返しても警告は 1 回・場は開いて話は今までどおり積まれる", async () => {
  const o = /** @type {any} */ (await import("opusscript"));
  const OpusScript = o.default ?? o;
  const local = makeFakeLocalStt({
    results: [{ text: "こんにちは", speech: null }, { text: "やあ", speech: null }],
    audioTagging: { enabled: false, reason: "failed to load: cannot open C:\\Users\\someone\\vendor\\models\\model.int8.onnx" }
  });
  const h = await startDiscordCoughServer({ OpusScript, local });
  try {
    assert.equal((await post(h.url, "/api/stream/start", { experience: "discord" })).status, 200);
    await speakOnce(h, OpusScript, USER_A);
    await waitUntil(() => local.rec.calls === 1, 5000);
    await speakOnce(h, OpusScript, USER_B);
    await waitUntil(() => local.rec.calls === 2, 5000);
    await waitUntil(() => h.server.getTranscript().filter((/** @type {any} */ e) => e.speaker !== "event").length === 2, 5000);
    assert.equal(local.rec.options.length, 2);
    const st = (await get(h.url, "/api/state")).json;
    const offs = st.warnings.filter((/** @type {any} */ w) => w.kind === "cough-filter-off");
    assert.equal(offs.length, 1);
    assert.equal(offs[0].count, 1, "2 人の耳が知らせても 1 回");
    assert.equal(offs[0].message, "咳の聞き分けが止まっている（モデルを読み込めない）");
    const wire = JSON.stringify(st.warnings);
    assert.equal(wire.includes("someone"), false, "子の理由（パス）を警告に入れない");
    for (const word of SECRET_WORDS) assert.equal(wire.includes(word), false, `警告に ${word}`);
    await post(h.url, "/api/stream/stop");
  } finally {
    await h.cleanup();
  }
});

// ── 5. 文字の行き先の固定（§4 A の 4: ファイルに出ない）────────────────────────────────

test("落とした文字の行き先: 正本の onDiscard を購読する製品のコードは場の放送（cockpit-server）と実験の道具だけ（ファイル・ログへの新しい道を作らない）", async () => {
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const agentRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
  /** @type {string[]} */
  const hits = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name === "node_modules" || name === "vendor") continue;
        walk(full);
      } else if (name.endsWith(".mjs") && !name.endsWith(".test.mjs")) {
        if (readFileSync(full, "utf8").includes(".onDiscard(")) hits.push(full.slice(agentRoot.length + 1).split("\\").join("/"));
      }
    }
  };
  walk(join(agentRoot, "src"));
  walk(join(agentRoot, "scripts"));
  // 実験の道具は利用者が走らせたときだけ、実験の正本の区間を実験のフォルダに記録する（段階 1・本番の正本ではない）。
  assert.deepEqual(hits.sort(), ["scripts/cough-experiment.mjs", "src/cockpit/cockpit-server.mjs"]);
});
