// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

import {
  createCockpitServer,
  assertLoopbackHost,
  parseDshowDeviceList,
  enumerateDevices,
  createInMemorySettingsStore,
  DEFAULT_COCKPIT_HOST
} from "./cockpit-server.mjs";
import { createTranscriptBuffer } from "../ears/transcript-buffer.mjs";
import { createFireOrchestrator } from "../mind/fire-orchestrator.mjs";

// 魂コクピット・サーバの機械テスト（S2.5 Domain A）。pipeline / デバイス列挙 / spawn を全注入し、
// 実マイク・実 ffmpeg・実 whisper・実 ONNX を一切使わずに HTTP/SSE/結線/クリーンシャットダウンを固定する。
// ライブチャネルは SSE なので素の node:http クライアントで読む（undici WS の相性問題は SSE で消える）。

// ── テスト用 HTTP/SSE クライアント（依存ゼロ）─────────────────────────────

/** @param {string} url @param {{method?:string, body?:string}} [opts] */
function httpRequest(url, opts = {}) {
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
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      }
    );
    req.on("error", reject);
    if (body != null) req.write(body);
    req.end();
  });
}

async function getJson(url) {
  const r = await httpRequest(url);
  return { status: r.status, json: r.body ? JSON.parse(r.body) : null, headers: r.headers };
}
async function postJson(url, obj) {
  const r = await httpRequest(url, { method: "POST", body: obj != null ? JSON.stringify(obj) : "" });
  return { status: r.status, json: r.body ? JSON.parse(r.body) : null };
}

/** SSE クライアント: フレームを貯め、waitFor(predicate) で特定イベントを有界待ちする。 */
function openSseClient(url) {
  const u = new URL(url);
  /** @type {Array<{event:string, data:any}>} */
  const events = [];
  /** @type {Array<{pred:Function, resolve:Function, timer:any}>} */
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
          const evt = parseFrame(raw);
          if (evt) {
            events.push(evt);
            flush();
          }
        }
      });
    }
  );
  req.on("error", () => {});
  req.end();

  function parseFrame(raw) {
    let event = "message";
    let data = "";
    for (const line of raw.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (data === "") return null;
    return { event, data: JSON.parse(data) };
  }
  function flush() {
    for (let i = waiters.length - 1; i >= 0; i -= 1) {
      const w = waiters[i];
      const found = events.find((e) => w.pred(e));
      if (found) {
        clearTimeout(w.timer);
        waiters.splice(i, 1);
        w.resolve(found);
      }
    }
  }
  return {
    events,
    /** @param {(e:{event:string,data:any})=>boolean} pred */
    waitFor(pred, ms = 3000) {
      return new Promise((resolve, reject) => {
        const existing = events.find(pred);
        if (existing) {
          resolve(existing);
          return;
        }
        const timer = setTimeout(() => {
          const i = waiters.findIndex((w) => w.timer === timer);
          if (i >= 0) waiters.splice(i, 1);
          reject(new Error("sse waitFor timed out"));
        }, ms);
        if (typeof timer.unref === "function") timer.unref();
        waiters.push({ pred, resolve, timer });
      });
    },
    close() {
      req.destroy();
    }
  };
}

// ── fake 耳パイプライン ───────────────────────────────────────────────

/** factory に渡された callbacks を握り、テストからイベントを発火できる fake。 */
function makeFakePipeline() {
  const record = {
    /** @type {any} */ options: null,
    started: false,
    disposed: false,
    /** @type {ReturnType<typeof createTranscriptBuffer>} */ buffer: /** @type {any} */ (null),
    startShouldThrow: /** @type {Error|null} */ (null)
  };
  const factory = (options) => {
    record.options = options;
    const buffer = createTranscriptBuffer({ nowImpl: () => 1000 });
    record.buffer = buffer;
    return {
      transcriptBuffer: buffer,
      async start() {
        if (record.startShouldThrow) throw record.startShouldThrow;
        record.started = true;
      },
      async dispose() {
        record.disposed = true;
      },
      isDisposed: () => record.disposed,
      streamMs: () => 0,
      stats: () => ({})
    };
  };
  return { factory, record };
}

/** 決定論 fake ffmpeg 子プロセス（stderr にデバイス一覧を吐いて exit）。 */
function fakeSpawn(stderrText, { exitCode = 1, emitError = false } = {}) {
  return () => {
    const child = /** @type {any} */ (new EventEmitter());
    const stderr = new Readable({ read() {} });
    child.stderr = stderr;
    child.stdout = null;
    child.kill = () => {};
    if (emitError) {
      process.nextTick(() => child.emit("error", new Error("spawn ENOENT")));
      return child;
    }
    process.nextTick(() => {
      stderr.push(stderrText);
      stderr.push(null);
    });
    // data 配送が終わってから（stderr 'end'）exit を出す（parse が全文を見る）。
    stderr.on("end", () => child.emit("exit", exitCode, null));
    return child;
  };
}

const DSHOW_NEW_FORMAT = [
  "[dshow @ 000] DirectShow video devices (some may be both video and audio devices)",
  '[dshow @ 000] "HD WebCam" (video)',
  '[dshow @ 000]   Alternative name "@device_pnp_\\\\?\\usb#vid_1"',
  "[dshow @ 000] DirectShow audio devices",
  '[dshow @ 000] "Microphone (Realtek(R) Audio)" (audio)',
  '[dshow @ 000]   Alternative name "@device_cm_{111}"',
  '[dshow @ 000] "PicoStreamingMicrophone" (audio)',
  '[dshow @ 000]   Alternative name "@device_cm_{222}"'
].join("\n");

const DSHOW_OLD_FORMAT = [
  "[dshow @ 000] DirectShow video devices",
  '[dshow @ 000]  "Integrated Camera"',
  '[dshow @ 000]     Alternative name "@device_pnp_1"',
  "[dshow @ 000] DirectShow audio devices",
  '[dshow @ 000]  "マイク (USB Audio)"',
  '[dshow @ 000]     Alternative name "@device_cm_2"'
].join("\n");

// ── パース単体 ─────────────────────────────────────────────────────────

test("parseDshowDeviceList: 新形式 (audio) サフィックスから音声デバイスを抽出する", () => {
  const { audio, video } = parseDshowDeviceList(DSHOW_NEW_FORMAT);
  assert.deepEqual(
    audio.map((d) => d.name),
    ["Microphone (Realtek(R) Audio)", "PicoStreamingMicrophone"]
  );
  assert.equal(audio[0].alternativeName, "@device_cm_{111}");
  assert.equal(audio[1].alternativeName, "@device_cm_{222}");
  assert.deepEqual(video.map((d) => d.name), ["HD WebCam"]);
});

test("parseDshowDeviceList: 旧形式（セクション見出し）でも音声デバイスを抽出する", () => {
  const { audio, video } = parseDshowDeviceList(DSHOW_OLD_FORMAT);
  assert.deepEqual(audio.map((d) => d.name), ["マイク (USB Audio)"]);
  assert.equal(audio[0].alternativeName, "@device_cm_2");
  assert.deepEqual(video.map((d) => d.name), ["Integrated Camera"]);
});

test("parseDshowDeviceList: 空/雑テキストは空配列（throw しない）", () => {
  assert.deepEqual(parseDshowDeviceList(""), { audio: [], video: [] });
  assert.deepEqual(parseDshowDeviceList("no devices here\njust noise"), { audio: [], video: [] });
});

// ── enumerateDevices（spawn 注入）─────────────────────────────────────

test("enumerateDevices: 注入 spawn の stderr をパースして音声デバイスを返す", async () => {
  const result = await enumerateDevices({
    inputFormat: "dshow",
    spawnImpl: /** @type {any} */ (fakeSpawn(DSHOW_NEW_FORMAT))
  });
  assert.equal(result.error, null);
  assert.equal(result.inputFormat, "dshow");
  assert.deepEqual(result.devices.map((d) => d.name), ["Microphone (Realtek(R) Audio)", "PicoStreamingMicrophone"]);
});

test("enumerateDevices: spawn error は devices 空 + error 文字列（throw しない）", async () => {
  const result = await enumerateDevices({
    inputFormat: "dshow",
    spawnImpl: /** @type {any} */ (fakeSpawn("", { emitError: true }))
  });
  assert.deepEqual(result.devices, []);
  assert.match(result.error ?? "", /ffmpeg spawn failed/);
});

test("enumerateDevices: spawnImpl が throw しても error に落ちる", async () => {
  const result = await enumerateDevices({
    inputFormat: "dshow",
    spawnImpl: /** @type {any} */ (() => {
      throw new Error("boom");
    })
  });
  assert.deepEqual(result.devices, []);
  assert.match(result.error ?? "", /ffmpeg spawn failed: boom/);
});

// ── loopback バインドの固定（blocking 基準 3）──────────────────────────

test("assertLoopbackHost: 非 loopback host は throw する（外部露出の構造的防止）", () => {
  assert.throws(() => assertLoopbackHost("0.0.0.0"), /loopback/);
  assert.throws(() => assertLoopbackHost("192.168.1.10"), /loopback/);
  assert.equal(assertLoopbackHost("127.0.0.1"), "127.0.0.1");
});

test("createCockpitServer: 非 loopback host を渡すと構築時点で throw する", () => {
  assert.throws(() => createCockpitServer({ host: "0.0.0.0" }), /loopback/);
});

test("cockpit: listen は 127.0.0.1 にバインドする（url が loopback）", async () => {
  const server = createCockpitServer({ enumerateDevicesImpl: async () => ({ devices: [], inputFormat: "dshow", error: null }) });
  try {
    const url = await server.listen(0);
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal(server.url(), url);
    assert.equal(server.isListening(), true);
  } finally {
    await server.close();
  }
});

// ── HTTP エンドポイント ────────────────────────────────────────────────

test("cockpit GET /: プレースホルダ HTML を配信する", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const r = await httpRequest(`${url}/`);
    assert.equal(r.status, 200);
    assert.match(String(r.headers["content-type"]), /text\/html/);
    assert.match(r.body, /Soul Cockpit/);
  } finally {
    await server.close();
  }
});

test("cockpit GET /: indexHtml 注入で本体を差し替えられる（Domain B 用フック）", async () => {
  const server = createCockpitServer({ indexHtml: "<h1>REAL PAGE</h1>" });
  try {
    const url = await server.listen(0);
    const r = await httpRequest(`${url}/`);
    assert.equal(r.status, 200);
    assert.match(r.body, /REAL PAGE/);
  } finally {
    await server.close();
  }
});

test("cockpit GET /api/devices: 列挙結果と lastDevice を返す", async () => {
  const settings = createInMemorySettingsStore("PicoStreamingMicrophone");
  const server = createCockpitServer({
    settingsStore: settings,
    enumerateDevicesImpl: async () => ({
      devices: [{ name: "Mic A", alternativeName: null }, { name: "Mic B", alternativeName: null }],
      inputFormat: "dshow",
      error: null
    })
  });
  try {
    const url = await server.listen(0);
    const { status, json } = await getJson(`${url}/api/devices`);
    assert.equal(status, 200);
    assert.deepEqual(json.devices.map((/** @type {any} */ d) => d.name), ["Mic A", "Mic B"]);
    assert.equal(json.inputFormat, "dshow");
    assert.equal(json.lastDevice, "PicoStreamingMicrophone");
    assert.equal(json.error, null);
  } finally {
    await server.close();
  }
});

test("cockpit GET /api/state: 初期は stopped・health unknown・転写空", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const { status, json } = await getJson(`${url}/api/state`);
    assert.equal(status, 200);
    assert.equal(json.ears, "stopped");
    assert.equal(json.device, null);
    assert.equal(json.health.whisper.status, "unknown");
    assert.equal(json.health.ffmpeg.status, "unknown");
    assert.equal(json.appended, 0);
    assert.equal(json.discarded, 0);
    assert.equal(json.uptimeMs, 0);
    assert.deepEqual(json.transcripts, []);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/ears/start → stop: 耳の起動停止と state 反映・デバイス記憶", async () => {
  const fake = makeFakePipeline();
  const settings = createInMemorySettingsStore();
  let clock = 1_000_000;
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fake.factory),
    settingsStore: settings,
    nowImpl: () => clock
  });
  try {
    const url = await server.listen(0);

    const start = await postJson(`${url}/api/ears/start`, { device: "PicoStreamingMicrophone" });
    assert.equal(start.status, 200);
    assert.equal(start.json.ears, "listening");
    assert.equal(fake.record.started, true);
    // start 成功 = whisper/ffmpeg 楽観的 up。
    assert.equal(start.json.health.whisper.status, "up");
    assert.equal(start.json.health.ffmpeg.status, "up");
    // デバイスは記憶される（raw 値）。capture には正規化して渡る。
    assert.equal(settings.getLastDevice(), "PicoStreamingMicrophone");
    assert.equal(fake.record.options.capture.device, "audio=PicoStreamingMicrophone");
    assert.equal(server.earsStatus(), "listening");

    // uptime は listening 中に進む。
    clock += 5000;
    const state = await getJson(`${url}/api/state`);
    assert.equal(state.json.ears, "listening");
    assert.equal(state.json.device, "PicoStreamingMicrophone");
    assert.equal(state.json.uptimeMs, 5000);

    const stop = await postJson(`${url}/api/ears/stop`, {});
    assert.equal(stop.status, 200);
    assert.equal(stop.json.ears, "stopped");
    assert.equal(stop.json.uptimeMs, 0);
    assert.equal(fake.record.disposed, true);
    assert.equal(server.earsStatus(), "stopped");
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/ears/start: start 失敗は 500 + error・状態は stopped に畳む", async () => {
  const fake = makeFakePipeline();
  fake.record.startShouldThrow = new Error("failed to bring up ears (spawn ENOENT)");
  const server = createCockpitServer({ pipelineFactory: /** @type {any} */ (fake.factory) });
  try {
    const url = await server.listen(0);
    const start = await postJson(`${url}/api/ears/start`, { device: "Mic" });
    assert.equal(start.status, 500);
    assert.match(start.json.error, /failed to bring up ears/);
    assert.equal(start.json.state.ears, "stopped");
    assert.equal(start.json.state.health.whisper.status, "down");
    assert.equal(server.earsStatus(), "stopped");
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/ears/start: device 未指定なら settings の lastDevice にフォールバック", async () => {
  const fake = makeFakePipeline();
  const settings = createInMemorySettingsStore("Remembered Mic");
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fake.factory),
    settingsStore: settings
  });
  try {
    const url = await server.listen(0);
    const start = await postJson(`${url}/api/ears/start`, {});
    assert.equal(start.status, 200);
    assert.equal(start.json.device, "Remembered Mic");
    assert.equal(fake.record.options.capture.device, "audio=Remembered Mic");
  } finally {
    await server.close();
  }
});

test("cockpit GET /api/state: 転写バッファ履歴が transcripts に載る（タブ開き直し復元）", async () => {
  const fake = makeFakePipeline();
  const server = createCockpitServer({ pipelineFactory: /** @type {any} */ (fake.factory) });
  try {
    const url = await server.listen(0);
    await postJson(`${url}/api/ears/start`, { device: "Mic" });
    // 正本に 2 件積む（append-only）。
    fake.record.buffer.append({ startMs: 0, endMs: 1500, text: "こんにちは" });
    fake.record.buffer.append({ startMs: 1600, endMs: 3300, text: "テスト中です" });
    const state = await getJson(`${url}/api/state`);
    assert.equal(state.json.transcripts.length, 2);
    assert.equal(state.json.transcripts[0].text, "こんにちは");
    assert.equal(state.json.transcripts[0].speaker, "you");
    assert.equal(state.json.appended, 2);
  } finally {
    await server.close();
  }
});

test("cockpit: 未知ルートは 404 JSON", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const { status, json } = await getJson(`${url}/api/nope`);
    assert.equal(status, 404);
    assert.match(json.error, /not found/);
  } finally {
    await server.close();
  }
});

// ── SSE ライブチャネル疎通 ─────────────────────────────────────────────

test("cockpit SSE /api/events: 接続で初期 state・転写/VAD/死活がクライアントへ届く", async () => {
  const fake = makeFakePipeline();
  const server = createCockpitServer({ pipelineFactory: /** @type {any} */ (fake.factory) });
  const url = await server.listen(0);
  const client = openSseClient(`${url}/api/events`);
  try {
    // 接続直後の初期 state（stopped）。
    const initial = await client.waitFor((e) => e.event === "state");
    assert.equal(initial.data.ears, "stopped");

    // 耳起動 → state が listening で push。
    await postJson(`${url}/api/ears/start`, { device: "Mic" });
    const listening = await client.waitFor((e) => e.event === "state" && e.data.ears === "listening");
    assert.equal(listening.data.health.whisper.status, "up");

    // VAD イベント（(speaking) ライブ行の材料）。
    fake.record.options.onVadEvent({ type: "speechStart", tMs: 1000 });
    const vad = await client.waitFor((e) => e.event === "vad");
    assert.equal(vad.data.type, "speechStart");
    assert.equal(vad.data.tMs, 1000);

    // 転写 append（正経路・latency 付き）。
    fake.record.options.onTranscript(
      { seq: 0, startMs: 970, endMs: 2100, text: "こんにちは", appendedAtMs: 1 },
      { latencyMs: 1499.6, audioCtx: 256 }
    );
    const tx = await client.waitFor((e) => e.event === "transcript");
    assert.equal(tx.data.text, "こんにちは");
    assert.equal(tx.data.speaker, "you");
    assert.equal(tx.data.latencyMs, 1499.6);
    assert.equal(tx.data.audioCtx, 256);

    // discard（空転写破棄・footer 材料）。buffer.append(blank) が onDiscard を発火。
    fake.record.buffer.append({ startMs: 3000, endMs: 3200, text: "   " });
    const disc = await client.waitFor((e) => e.event === "discard");
    assert.equal(disc.data.reason, "blank");
    assert.equal(disc.data.discarded, 1);

    // whisper 死 → health が down（2 経路監視の GUI 反映）。
    fake.record.options.onDiagnostic({ type: "whisperDown", phase: "runtime", code: null, signal: "SIGKILL" });
    const down = await client.waitFor((e) => e.event === "state" && e.data.health.whisper.status === "down");
    assert.match(down.data.health.whisper.reason, /whisper-server down/);
  } finally {
    client.close();
    await server.close();
  }
});

// ── UI 接続が切れても魂は生存（blocking 基準 5）──────────────────────────

test("cockpit: SSE 接続が切れても pipeline は生き続ける（UI は使い捨て）", async () => {
  const fake = makeFakePipeline();
  const server = createCockpitServer({ pipelineFactory: /** @type {any} */ (fake.factory) });
  try {
    const url = await server.listen(0);
    await postJson(`${url}/api/ears/start`, { device: "Mic" });

    const client = openSseClient(`${url}/api/events`);
    await client.waitFor((e) => e.event === "state");
    // ブラウザタブを閉じる相当（SSE 接続を切る）。
    client.close();

    // 接続断が pipeline を畳まないことを確認する。
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(fake.record.disposed, false);
    const state = await getJson(`${url}/api/state`);
    assert.equal(state.json.ears, "listening");
  } finally {
    await server.close();
  }
});

// ── クリーンシャットダウン（blocking 基準 5・ハング教訓）────────────────────

test("cockpit close(): pipeline を dispose し・冪等・ハンドルを残さない", async () => {
  const fake = makeFakePipeline();
  const server = createCockpitServer({ pipelineFactory: /** @type {any} */ (fake.factory) });
  const url = await server.listen(0);
  await postJson(`${url}/api/ears/start`, { device: "Mic" });
  // ライブ接続を開いたまま close する（全 SSE 応答を end する経路の検証）。
  const client = openSseClient(`${url}/api/events`);
  await client.waitFor((e) => e.event === "state");

  await server.close();
  assert.equal(fake.record.disposed, true);
  assert.equal(server.isListening(), false);

  // 冪等: 2 回目の close は何もしない（throw しない）。
  await server.close();

  // close 後のリクエストは 503（サーバは応答を返して終わる）。
  await assert.rejects(() => httpRequest(`${url}/api/state`));
  client.close();
});

// ── 発火結線（S3 Domain A・追加的）─────────────────────────────────────────

/** factory に渡された hooks を握り、fire() の挙動を注入できる fake orchestrator。 */
function makeFakeOrchestrator({ fireResult, drive } = {}) {
  const record = { /** @type {any} */ hooks: null, fireCount: 0, disposed: false, state: "idle" };
  const factory = (hooks) => {
    record.hooks = hooks;
    return {
      async fire() {
        record.fireCount += 1;
        if (drive) drive(hooks, record);
        return fireResult ?? { fired: true, replyText: "はい", injectedChars: 12, includedCount: 1 };
      },
      getState: () => record.state,
      dispose: () => {
        record.disposed = true;
      }
    };
  };
  return { factory, record };
}

test("cockpit POST /api/fire: orchestrator 未注入なら 503（S2.5 無退行）", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/fire`, {});
    assert.equal(r.status, 503);
    assert.match(r.json.error, /fire not available/);
    assert.equal(server.fireState(), null);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/fire: 受理は 202・fire() の結果 JSON を返す", async () => {
  const fake = makeFakeOrchestrator({
    fireResult: { fired: true, replyText: "ひるごはん食べよ", injectedChars: 20, includedCount: 2 }
  });
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fake.factory) });
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/fire`, {});
    assert.equal(r.status, 202);
    assert.equal(r.json.fired, true);
    assert.equal(r.json.replyText, "ひるごはん食べよ");
    assert.equal(r.json.includedCount, 2);
    assert.equal(r.json.state, "idle"); // getState() から補完される。
    assert.equal(fake.record.fireCount, 1);
    // getBuffer フックは pipeline?.transcriptBuffer（耳未起動なら null）。
    assert.equal(fake.record.hooks.getBuffer(), null);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/fire: busy は 200 で {fired:false, reason:'busy', state}", async () => {
  const fake = makeFakeOrchestrator({
    fireResult: { fired: false, reason: "busy", state: "thinking" }
  });
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fake.factory) });
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/fire`, {});
    assert.equal(r.status, 200);
    assert.equal(r.json.fired, false);
    assert.equal(r.json.reason, "busy");
    assert.equal(r.json.state, "thinking");
  } finally {
    await server.close();
  }
});

test("cockpit: close() で orchestrator を dispose する", async () => {
  const fake = makeFakeOrchestrator({});
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fake.factory) });
  const url = await server.listen(0);
  await postJson(`${url}/api/fire`, {});
  await server.close();
  assert.equal(fake.record.disposed, true);
});

test("cockpit SSE: fire() の onState/onFire が soul/fire イベントで流れる", async () => {
  const fake = makeFakeOrchestrator({
    fireResult: { fired: true, replyText: "はい", injectedChars: 8, includedCount: 1 },
    drive: (hooks) => {
      hooks.onState("thinking");
      hooks.onFire({ accepted: true, injectedChars: 8, includedCount: 1, atMs: 1000 });
      hooks.onState("speaking");
      hooks.onSoulTranscript({ seq: 1, startMs: 0, endMs: 0, text: "はい", speaker: "soul", appendedAtMs: 1000 });
      hooks.onState("idle");
    }
  });
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fake.factory) });
  const url = await server.listen(0);
  const client = openSseClient(`${url}/api/events`);
  try {
    await client.waitFor((e) => e.event === "state"); // 接続確立。
    await postJson(`${url}/api/fire`, {});

    const thinking = await client.waitFor((e) => e.event === "soul" && e.data.state === "thinking");
    assert.equal(thinking.data.state, "thinking");
    const fire = await client.waitFor((e) => e.event === "fire" && e.data.accepted === true);
    assert.equal(fire.data.includedCount, 1);
    const speaking = await client.waitFor((e) => e.event === "soul" && e.data.state === "speaking");
    assert.equal(speaking.data.state, "speaking");
    // soul の発話行は既存 transcript イベント（speaker:"soul"）で再利用される。
    const soulLine = await client.waitFor((e) => e.event === "transcript" && e.data.speaker === "soul");
    assert.equal(soulLine.data.text, "はい");
    await client.waitFor((e) => e.event === "soul" && e.data.state === "idle");
  } finally {
    client.close();
    await server.close();
  }
});

test("cockpit /api/fire: 実 orchestrator を結線し縦貫通（fake session/speak・実バッファ）", async () => {
  const fake = makeFakePipeline();
  let askedText = "";
  let spokenText = "";
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fake.factory),
    fireOrchestratorFactory: (hooks) =>
      createFireOrchestrator({
        ...hooks,
        session: {
          async ask(t) {
            askedText = t;
            return { replyText: "はーい、なあに？" };
          }
        },
        speakImpl: async (text) => {
          spokenText = text;
          return { timeline: [], rttMs: 0, wavDurationSec: 0, wavPath: "x" };
        },
        channel: { sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 0 }) },
        player: { play() {} },
        // fake buffer の nowImpl は () => 1000。窓を広く取り nowMs を合わせて窓内に収める。
        nowImpl: () => 2000,
        windowMs: 100000
      })
  });
  const url = await server.listen(0);
  const sse = openSseClient(`${url}/api/events`);
  try {
    await sse.waitFor((e) => e.event === "state");

    await postJson(`${url}/api/ears/start`, { device: "Mic" });
    // 会話ログに you 発話を 1 件積む（正本）。
    fake.record.buffer.append({ startMs: 100, endMs: 900, text: "ねえ" });

    const r = await postJson(`${url}/api/fire`, {});
    assert.equal(r.status, 202);
    assert.equal(r.json.fired, true);
    assert.equal(r.json.replyText, "はーい、なあに？");

    // 注入に直近 you 発話が話者ラベル付きで入る。
    assert.match(askedText, /you: ねえ/);
    // speak は応答テキストで呼ばれた。
    assert.equal(spokenText, "はーい、なあに？");
    // soul が会話ログへ追記される（正本・speaker:"soul"）。
    const all = fake.record.buffer.all();
    assert.equal(all[all.length - 1].speaker, "soul");
    assert.equal(all[all.length - 1].text, "はーい、なあに？");

    // SSE で soul 状態列と soul transcript が流れる。
    await sse.waitFor((e) => e.event === "soul" && e.data.state === "thinking");
    await sse.waitFor((e) => e.event === "fire" && e.data.accepted === true);
    const soulLine = await sse.waitFor((e) => e.event === "transcript" && e.data.speaker === "soul");
    assert.equal(soulLine.data.text, "はーい、なあに？");
    await sse.waitFor((e) => e.event === "soul" && e.data.state === "idle");

    sse.close();
  } finally {
    await server.close();
  }
});
