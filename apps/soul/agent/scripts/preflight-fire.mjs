// @ts-check
/**
 * 発火疎通 preflight（S3 Domain A・機械ゲート）— apps/soul/agent。
 * **実 SDK / 実 TTS / 実器 / 実マイクを一切使わない**（人間ゲートの領分）。cockpit-server を
 * fake session/speak/channel/player で組んだ**実**発火オーケストレータで結線し、loopback に起動して:
 *
 *   POST /api/ears/start（fake pipeline）→ 会話ログに you 発話を 1 件積む
 *   POST /api/fire      → 実 orchestrator が窓収集 → fake ask → fake speak → soul 記録
 *   SSE /api/events     → soul(thinking→speaking→idle) + soul transcript が流れる
 *
 * を実 HTTP + 実 SSE で確認し、clean close（ハングなし）して終了コードで返す（preflight-cockpit の型）。
 *
 * 使い方: node apps/soul/agent/scripts/preflight-fire.mjs
 *   exit 0 = PASS / exit 1 = 失敗。標準出力に RESULT: PASS / EXIT=0 を出す。
 */

import http from "node:http";

import { createCockpitServer } from "../src/cockpit/cockpit-server.mjs";
import { createFireOrchestrator } from "../src/mind/fire-orchestrator.mjs";
import { createTranscriptBuffer } from "../src/ears/transcript-buffer.mjs";

const log = (msg) => process.stdout.write(`[preflight-fire] ${msg}\n`);

/** @param {string} url @param {{method?:string, body?:string}} [opts] */
function request(url, opts = {}) {
  const method = opts.method ?? "GET";
  const body = opts.body;
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = body != null ? { "content-type": "application/json", "content-length": Buffer.byteLength(body) } : {};
    const req = http.request(
      { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on("error", reject);
    if (body != null) req.write(body);
    req.end();
  });
}

/** 素の node:http SSE クライアント（waitFor で有界待ち）。 */
function openSse(url) {
  const u = new URL(url);
  /** @type {Array<{event:string,data:any}>} */
  const events = [];
  /** @type {Array<{pred:Function,resolve:Function,reject:Function,timer:any}>} */
  const waiters = [];
  let buffer = "";
  const req = http.request(
    { hostname: u.hostname, port: u.port, path: u.pathname, method: "GET", headers: { accept: "text/event-stream" } },
    (res) => {
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        buffer += chunk;
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          let event = "message";
          let data = "";
          for (const line of raw.split("\n")) {
            if (line.startsWith(":")) continue;
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data += line.slice(5).trim();
          }
          if (data === "") continue;
          const evt = { event, data: JSON.parse(data) };
          events.push(evt);
          for (let i = waiters.length - 1; i >= 0; i -= 1) {
            const found = events.find((e) => waiters[i].pred(e));
            if (found) {
              clearTimeout(waiters[i].timer);
              const w = waiters[i];
              waiters.splice(i, 1);
              w.resolve(found);
            }
          }
        }
      });
    }
  );
  req.on("error", () => {});
  req.end();
  return {
    /** @param {(e:{event:string,data:any})=>boolean} pred */
    waitFor(pred, ms = 3000) {
      return new Promise((resolve, reject) => {
        const existing = events.find(pred);
        if (existing) return resolve(existing);
        const timer = setTimeout(() => reject(new Error("sse waitFor timed out")), ms);
        if (typeof timer.unref === "function") timer.unref();
        waiters.push({ pred, resolve, reject, timer });
      });
    },
    close() {
      req.destroy();
    }
  };
}

async function main() {
  // fake pipeline: 実バッファ（実時計）を持ち、start/dispose だけの無音スタブ。
  const buffer = createTranscriptBuffer(); // 既定 Date.now = 窓内に収まる。
  const fakePipelineFactory = () => ({
    transcriptBuffer: buffer,
    async start() {},
    async dispose() {},
    isDisposed: () => false,
    streamMs: () => 0,
    stats: () => ({})
  });

  let askedText = "";
  let spokenText = "";
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fakePipelineFactory),
    fireOrchestratorFactory: (hooks) =>
      createFireOrchestrator({
        ...hooks,
        session: {
          async ask(t) {
            askedText = t;
            return { replyText: "はーい、どうしたの？" };
          }
        },
        speakImpl: async (text) => {
          spokenText = text;
          return { timeline: [], rttMs: 0, wavDurationSec: 0, wavPath: "fake" };
        },
        channel: { sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 0 }) },
        player: { play() {} }
      })
  });

  let failed = false;
  const fail = (msg) => {
    log(`FAIL: ${msg}`);
    failed = true;
  };

  /** @type {ReturnType<typeof openSse> | null} */
  let sse = null;
  try {
    const url = await server.listen(0);
    log(`server listening at ${url} (loopback)`);
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) fail(`bound URL is not loopback: ${url}`);

    sse = openSse(`${url}/api/events`);
    await sse.waitFor((e) => e.event === "state");

    // 耳起動（fake）→ 会話ログに you 発話を積む。
    const started = await request(`${url}/api/ears/start`, { method: "POST", body: "{}" });
    log(`POST /api/ears/start → ${started.status}`);
    buffer.append({ startMs: 100, endMs: 900, text: "ねえ、聞いてる？" });

    // Fire。
    const fired = await request(`${url}/api/fire`, { method: "POST", body: "{}" });
    let fireJson = null;
    try {
      fireJson = JSON.parse(fired.body);
    } catch {
      /* leave null */
    }
    log(`POST /api/fire   → ${fired.status} fired=${fireJson && fireJson.fired} reply=${fireJson && fireJson.replyText}`);
    if (fired.status !== 202 || !fireJson || fireJson.fired !== true) fail("POST /api/fire did not return 202 fired:true");
    if (!/you: ねえ、聞いてる？/.test(askedText)) fail(`injection missing recent you utterance: ${JSON.stringify(askedText)}`);
    if (spokenText !== "はーい、どうしたの？") fail(`speak was not called with reply text: ${JSON.stringify(spokenText)}`);

    // soul が会話ログへ追記された（正本）。
    const all = buffer.all();
    const last = all[all.length - 1];
    if (!last || last.speaker !== "soul" || last.text !== "はーい、どうしたの？") fail("soul entry was not appended to transcript buffer");

    // SSE: soul 状態列 + soul transcript。
    await sse.waitFor((e) => e.event === "soul" && e.data.state === "thinking");
    await sse.waitFor((e) => e.event === "fire" && e.data.accepted === true);
    await sse.waitFor((e) => e.event === "soul" && e.data.state === "speaking");
    const soulLine = await sse.waitFor((e) => e.event === "transcript" && e.data.speaker === "soul");
    if (soulLine.data.text !== "はーい、どうしたの？") fail("soul transcript SSE line missing/wrong");
    await sse.waitFor((e) => e.event === "soul" && e.data.state === "idle");
    log("SSE soul(thinking→speaking→idle) + soul transcript observed");

    log(failed ? "RESULT: FAIL" : "RESULT: PASS (fire → ask → speak → soul recorded; SSE observed; no real SDK/TTS/mic)");
  } catch (error) {
    log(`FAILED: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    failed = true;
  } finally {
    if (sse) sse.close();
    await server.close();
    log("server closed (no hang)");
  }
  log(`EXIT=${failed ? 1 : 0}`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(
    `[preflight-fire] FAILED (setup): ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exit(1);
});
