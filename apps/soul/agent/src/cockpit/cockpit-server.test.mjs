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
  const record = {
    /** @type {any} */ hooks: null,
    fireCount: 0,
    disposed: false,
    state: "idle",
    // S5: fire() へ渡された fireOptions を記録（{vision:true} 等）。既存呼び出し（fire()）は
    // undefined のまま記録されるだけで、この記録追加自体は既存テストの挙動に影響しない。
    /** @type {any} */ lastFireOptions: undefined,
    // S8「キルスイッチ」: kill()/revive() の呼び出し記録 + born-killed（factory 呼び出し時の
    // hooks.initialKilled）を捕捉する（既存テストには一切影響しない追加のみ）。
    killed: false,
    killCount: 0,
    reviveCount: 0,
    /** @type {number | undefined} */ lastKillAtMs: undefined,
    /** @type {boolean | undefined} */ initialKilledSeen: undefined
  };
  const factory = (hooks) => {
    record.hooks = hooks;
    record.initialKilledSeen = hooks && hooks.initialKilled;
    record.killed = hooks && hooks.initialKilled === true;
    return {
      /** @param {any} [fireOptions] */
      async fire(fireOptions) {
        record.fireCount += 1;
        record.lastFireOptions = fireOptions;
        if (drive) drive(hooks, record);
        return fireResult ?? { fired: true, replyText: "はい", injectedChars: 12, includedCount: 1 };
      },
      getState: () => record.state,
      /** @param {number} [atMs] */
      async kill(atMs) {
        record.killCount += 1;
        record.killed = true;
        record.lastKillAtMs = atMs;
        return { killed: true, severed: false };
      },
      revive() {
        record.reviveCount += 1;
        record.killed = false;
      },
      getKilled: () => record.killed,
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

// ── 演出イベントの SSE 結線（S4 Domain B）─────────────────────────────────
//
//  orchestrator の onExpression フック（語ごとの {word, args?, applied, rejected}・domain-a.md §7）が
//  SSE "expression" イベントとして broadcast されることを固定する（onFire→"fire" と同型）。

test("cockpit SSE: fire() の onExpression が expression イベントで流れる（演出行の材料）", async () => {
  const fake = makeFakeOrchestrator({
    fireResult: { fired: true, replyText: "そうだね", injectedChars: 8, includedCount: 1, expressions: [{ word: "nod", applied: 1, rejected: 0 }] },
    drive: (hooks) => {
      hooks.onState("thinking");
      hooks.onFire({ accepted: true, injectedChars: 8, includedCount: 1, atMs: 1000 });
      hooks.onState("speaking");
      hooks.onExpression({ word: "nod", applied: 1, rejected: 0 });
      hooks.onExpression({ word: "smile", args: "x=.3", applied: 3, rejected: 1 });
      hooks.onState("idle");
    }
  });
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fake.factory) });
  const url = await server.listen(0);
  const client = openSseClient(`${url}/api/events`);
  try {
    await client.waitFor((e) => e.event === "state"); // 接続確立。
    await postJson(`${url}/api/fire`, {});

    const nod = await client.waitFor((e) => e.event === "expression" && e.data.word === "nod");
    assert.equal(nod.data.applied, 1);
    assert.equal(nod.data.rejected, 0);
    // args とスロット拒否ありも素通しで届く（部分適用は正常系・domain-a.md §6）。
    const smile = await client.waitFor((e) => e.event === "expression" && e.data.word === "smile");
    assert.equal(smile.data.args, "x=.3");
    assert.equal(smile.data.applied, 3);
    assert.equal(smile.data.rejected, 1);
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

test("cockpit /api/fire: 実 orchestrator の演出タグが sendEnvelope→onExpression→SSE expression まで縦貫通", async () => {
  const fake = makeFakePipeline();
  /** @type {any[]} */
  const envelopes = [];
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fake.factory),
    fireOrchestratorFactory: (hooks) =>
      createFireOrchestrator({
        ...hooks,
        session: {
          async ask() {
            return { replyText: "そうだね<nod>" }; // 読み上げは "そうだね"・演出は nod。
          }
        },
        speakImpl: async () => ({ timeline: [], rttMs: 0, wavDurationSec: 0, wavPath: "x" }),
        channel: {
          sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 0 }),
          sendEnvelope: async (payload) => {
            envelopes.push(payload);
            return { result: "accepted", error: null, rttMs: 0 };
          }
        },
        player: { play() {} },
        nowImpl: () => 2000,
        windowMs: 100000
      })
  });
  const url = await server.listen(0);
  const sse = openSseClient(`${url}/api/events`);
  try {
    await sse.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/ears/start`, { device: "Mic" });
    fake.record.buffer.append({ startMs: 100, endMs: 900, text: "ねえ" });

    const r = await postJson(`${url}/api/fire`, {});
    assert.equal(r.status, 202);
    assert.equal(r.json.fired, true);
    assert.equal(r.json.replyText, "そうだね"); // タグは剥離済み（読み上げ・会話ログ）。

    // 演出は sendEnvelope（nod = head-vertical 1 スロット）で送られ、SSE expression で届く。
    const expr = await sse.waitFor((e) => e.event === "expression" && e.data.word === "nod");
    assert.equal(expr.data.applied, 1);
    assert.equal(expr.data.rejected, 0);
    assert.equal(envelopes.length, 1);
    assert.equal(envelopes[0].slotId, "head-vertical");
    sse.close();
  } finally {
    await server.close();
  }
});

// ── soul 転写の二重放送回帰（S3 追撃 domain-c）─────────────────────────────
//
//  実 ear-pipeline は `buffer.onAppend((entry) => onTranscript(entry, meta))` を購読するため、
//  発火オーケストレータが soul を **同じ** transcriptBuffer に append すると onTranscript（耳の正経路）
//  経由でも SSE transcript(speaker:"soul") が飛ぶ。加えて orchestrator の onSoulTranscript フックが
//  cockpit の broadcastSoulTranscript から transcript(speaker:"soul") を飛ばす＝**二重放送**。
//  既存 makeFakePipeline は onAppend を購読しない（テストが手動で onTranscript を発火する設計）ため
//  この二重を再現できず、既存の縦貫通テストも soul transcript を waitFor で 1 個取るだけで回数を
//  固定していない。よって実 pipeline の onAppend→onTranscript 契約を**このテスト専用**に再現する
//  pipeline double で回数を固定する（修正前は 2・修正後は 1）。

/** 実 ear-pipeline の onAppend→onTranscript 契約を再現する pipeline double（このテスト専用）。 */
function makeOnAppendPipeline() {
  const record = { /** @type {any} */ options: null, /** @type {any} */ buffer: null, disposed: false };
  const factory = (/** @type {any} */ options) => {
    record.options = options;
    const buffer = createTranscriptBuffer({ nowImpl: () => 1000 });
    record.buffer = buffer;
    // ear-pipeline.mjs:179-181 と同じ購読（you も soul も同じ列に積まれ、onAppend で onTranscript を通る）。
    buffer.onAppend((entry) => {
      options.onTranscript(entry, { latencyMs: NaN, audioCtx: null });
    });
    return {
      transcriptBuffer: buffer,
      async start() {},
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

test("cockpit /api/fire: soul 転写は二重放送されない（実 pipeline の onAppend→onTranscript 契約下で 1 回）", async () => {
  const fake = makeOnAppendPipeline();
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fake.factory),
    fireOrchestratorFactory: (hooks) =>
      createFireOrchestrator({
        ...hooks,
        session: {
          async ask() {
            return { replyText: "はーい" };
          }
        },
        speakImpl: async () => ({ timeline: [], rttMs: 0, wavDurationSec: 0, wavPath: "x" }),
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
    // 会話ログに you 発話を 1 件積む（onAppend 経由で transcript(you) が 1 回飛ぶ・正常）。
    fake.record.buffer.append({ startMs: 100, endMs: 900, text: "ねえ" });

    const r = await postJson(`${url}/api/fire`, {});
    assert.equal(r.status, 202);
    assert.equal(r.json.fired, true);

    // 決定論的収束点: soul 状態が idle に戻るまで待つ。finally の idle 遷移は
    // buffer.append(soul) + onSoulTranscript の**後**に来るため、両 transcript 放送は既に発火済み。
    await sse.waitFor((e) => e.event === "soul" && e.data.state === "idle");
    // 2 個目が遅れて来ないことを積極確認する（有界の猶予）。
    await new Promise((res) => setTimeout(res, 50));

    const soulTranscripts = sse.events.filter((e) => e.event === "transcript" && e.data.speaker === "soul");
    assert.equal(
      soulTranscripts.length,
      1,
      `soul transcript は 1 回だけ放送されるべき（実測 ${soulTranscripts.length}）`
    );
    // you の転写は onAppend 経路で 1 回のまま（回帰でついで確認）。
    const youTranscripts = sse.events.filter((e) => e.event === "transcript" && e.data.speaker === "you");
    assert.equal(youTranscripts.length, 1);
  } finally {
    sse.close();
    await server.close();
  }
});

// ── 視覚発火の口（S5「目が開く」・Domain C 前半）───────────────────────────────
//
//  GET /api/windows・POST /api/vision-target・POST /api/vision-fire は POST /api/channel・POST /api/fire
//  の写経（domain-c.md §）。listWindowsImpl は必ず fake 注入する（既定は実 PowerShell 起動＝Domain A
//  window-list.mjs の listWindows・このテストファイルでは一度も実行しない）。

test("cockpit GET /api/windows: listWindowsImpl の成功結果（.windows）を返す", async () => {
  const server = createCockpitServer({
    listWindowsImpl: async () => ({
      windows: [
        { pid: 111, processName: "notepad", title: "Sample - メモ帳" },
        { pid: 222, processName: "game", title: "Sample Game" }
      ]
    })
  });
  try {
    const url = await server.listen(0);
    const r = await getJson(`${url}/api/windows`);
    assert.equal(r.status, 200);
    assert.equal(r.json.error, null);
    assert.equal(r.json.windows.length, 2);
    assert.equal(r.json.windows[1].title, "Sample Game");
  } finally {
    await server.close();
  }
});

test("cockpit GET /api/windows: listWindowsImpl の失敗（.error）は windows:[] + error を返す（実起動しない）", async () => {
  const server = createCockpitServer({
    listWindowsImpl: async () => ({ error: { kind: "timeout", message: "window listing timed out after 3000ms" } })
  });
  try {
    const url = await server.listen(0);
    const r = await getJson(`${url}/api/windows`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.windows, []);
    assert.match(r.json.error, /timed out/);
  } finally {
    await server.close();
  }
});

test("cockpit GET /api/windows: 未注入時は既定実装（Domain A listWindows）が使われる（呼び出しの型のみ確認・実起動しない）", () => {
  // 既定 listWindowsImpl は実 PowerShell を起動するため実行はしない。ここでは createCockpitServer が
  // listWindowsImpl 未指定でも throw せず構築できる（既定値が代入される）ことだけを確認する。
  const server = createCockpitServer({});
  assert.equal(typeof server.listen, "function");
});

test("cockpit POST /api/vision-target: onSetVisionTarget 未注入なら 503", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/vision-target`, { title: "Sample Game" });
    assert.equal(r.status, 503);
    assert.match(r.json.error, /vision target control not available/);
    // visionTargetStatus 未注入なら state.visionTarget は null。
    const s = await getJson(`${url}/api/state`);
    assert.equal(s.json.visionTarget, null);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/vision-target: title をフックへ橋渡しし・state に visionTargetStatus を載せる", async () => {
  let received = /** @type {string | null | undefined} */ (undefined);
  let current = /** @type {string | null} */ (null);
  const server = createCockpitServer({
    onSetVisionTarget: (title) => {
      received = title;
      current = title;
    },
    visionTargetStatus: () => ({ title: current })
  });
  try {
    const url = await server.listen(0);
    const s0 = await getJson(`${url}/api/state`);
    assert.equal(s0.json.visionTarget.title, null);

    const r = await postJson(`${url}/api/vision-target`, { title: "  Sample Game — Main Window  " });
    assert.equal(r.status, 200);
    // フックは trim 済みのタイトルを受ける。
    assert.equal(received, "Sample Game — Main Window");
    assert.equal(r.json.visionTarget.title, "Sample Game — Main Window");

    // 空文字はクリア（null をフックへ）。
    const rc = await postJson(`${url}/api/vision-target`, { title: "   " });
    assert.equal(rc.status, 200);
    assert.equal(received, null);
    assert.equal(rc.json.visionTarget.title, null);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/vision-fire: orchestrator 未注入なら 503", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/vision-fire`, {});
    assert.equal(r.status, 503);
    assert.match(r.json.error, /fire not available/);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/vision-fire: fire({ vision: true }) を呼び・受理は 202", async () => {
  const fake = makeFakeOrchestrator({
    fireResult: { fired: true, replyText: "画面見えたよ", injectedChars: 5, includedCount: 1, vision: true }
  });
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fake.factory) });
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/vision-fire`, {});
    assert.equal(r.status, 202);
    assert.equal(r.json.fired, true);
    assert.equal(r.json.replyText, "画面見えたよ");
    // 通常 /api/fire ではなく vision:true で呼ばれたことを固定。
    assert.deepEqual(fake.record.lastFireOptions, { vision: true });
    assert.equal(fake.record.fireCount, 1);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/vision-fire: 対象未設定は 200 で {fired:false, reason:'vision-no-target'}", async () => {
  const fake = makeFakeOrchestrator({
    fireResult: { fired: false, reason: "vision-no-target" }
  });
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fake.factory) });
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/vision-fire`, {});
    assert.equal(r.status, 200);
    assert.equal(r.json.fired, false);
    assert.equal(r.json.reason, "vision-no-target");
    assert.deepEqual(fake.record.lastFireOptions, { vision: true });
  } finally {
    await server.close();
  }
});

test("cockpit SSE: fire({vision:true}) の onVisionCaptured が visionCaptured イベントで流れる（サムネ込み）", async () => {
  const fake = makeFakeOrchestrator({
    fireResult: { fired: true, replyText: "見えた", vision: true },
    drive: (hooks) => {
      hooks.onVisionCaptured({
        title: "Sample Game",
        width: 1024,
        height: 576,
        jpegBase64: "AAAA",
        elapsedMs: 600
      });
    }
  });
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fake.factory) });
  const url = await server.listen(0);
  const client = openSseClient(`${url}/api/events`);
  try {
    await client.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/vision-fire`, {});
    const captured = await client.waitFor((e) => e.event === "visionCaptured");
    assert.equal(captured.data.title, "Sample Game");
    assert.equal(captured.data.width, 1024);
    assert.equal(captured.data.height, 576);
    assert.equal(captured.data.jpegBase64, "AAAA");
    assert.equal(captured.data.elapsedMs, 600);
  } finally {
    client.close();
    await server.close();
  }
});

test("cockpit SSE: onUsage が usage イベントで流れる（通常 Fire・視覚発火共通）", async () => {
  const fake = makeFakeOrchestrator({
    fireResult: { fired: true, replyText: "はい" },
    drive: (hooks) => {
      hooks.onUsage({ usage: { input_tokens: 284, output_tokens: 12 }, vision: false });
    }
  });
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fake.factory) });
  const url = await server.listen(0);
  const client = openSseClient(`${url}/api/events`);
  try {
    await client.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/fire`, {});
    const usage = await client.waitFor((e) => e.event === "usage");
    assert.equal(usage.data.usage.input_tokens, 284);
    assert.equal(usage.data.vision, false);
  } finally {
    client.close();
    await server.close();
  }
});

test("cockpit SSE: fireVisionError（onDiagnostic 経由）は diagnostic イベントに kind を載せる（ゴースト行の材料）", async () => {
  const fake = makeFakeOrchestrator({
    fireResult: { fired: false, reason: "vision-capture-failed", kind: "minimized" },
    drive: (hooks) => {
      hooks.onDiagnostic({ type: "fireVisionError", kind: "minimized", message: "window is minimized" });
    }
  });
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fake.factory) });
  const url = await server.listen(0);
  const client = openSseClient(`${url}/api/events`);
  try {
    await client.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/vision-fire`, {});
    const diag = await client.waitFor((e) => e.event === "diagnostic" && e.data.type === "fireVisionError");
    assert.equal(diag.data.kind, "minimized");
    assert.equal(diag.data.message, "window is minimized");
  } finally {
    client.close();
    await server.close();
  }
});

// ── Channel URL の操縦席入力（S3 追撃 domain-c）─────────────────────────────

test("cockpit POST /api/channel: onSetChannelUrl 未注入なら 503", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/channel`, { url: "ws://127.0.0.1:1/channel?token=t" });
    assert.equal(r.status, 503);
    assert.match(r.json.error, /channel control not available/);
    // channelStatus 未注入なら state.channel は null。
    const s = await getJson(`${url}/api/state`);
    assert.equal(s.json.channel, null);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/channel: URL をフックに橋渡しし・state に redact 済み channelStatus を載せる", async () => {
  let received = /** @type {string | null | undefined} */ (undefined);
  let configured = false;
  const server = createCockpitServer({
    onSetChannelUrl: (u) => {
      received = u;
      configured = u != null;
    },
    // Domain B 相当: token を伏せた status を返す（cockpit-server は生 URL を state に載せない）。
    channelStatus: () =>
      configured
        ? { configured: true, url: "ws://127.0.0.1:1/channel?token=<redacted>", connection: "idle" }
        : { configured: false, url: null, connection: "unset" }
  });
  try {
    const url = await server.listen(0);
    // 初期は未設定。
    const s0 = await getJson(`${url}/api/state`);
    assert.equal(s0.json.channel.configured, false);

    const r = await postJson(`${url}/api/channel`, { url: "  ws://127.0.0.1:1/channel?token=secret  " });
    assert.equal(r.status, 200);
    // フックは trim 済みの生 URL を受ける。
    assert.equal(received, "ws://127.0.0.1:1/channel?token=secret");
    // 応答 snapshot は redact 済み（token=secret は含まれない）。
    assert.equal(r.json.channel.configured, true);
    assert.match(r.json.channel.url, /token=<redacted>/);
    assert.doesNotMatch(JSON.stringify(r.json), /secret/);

    // 空文字はクリア（null をフックへ）。
    const rc = await postJson(`${url}/api/channel`, { url: "   " });
    assert.equal(rc.status, 200);
    assert.equal(received, null);
    assert.equal(rc.json.channel.configured, false);
  } finally {
    await server.close();
  }
});

test("createInMemorySettingsStore: channel URL の get/set 口を持つ", () => {
  const store = createInMemorySettingsStore("Mic", "ws://127.0.0.1:1/channel?token=t");
  assert.equal(store.getLastDevice(), "Mic");
  assert.equal(store.getLastChannelUrl(), "ws://127.0.0.1:1/channel?token=t");
  store.setLastChannelUrl("ws://127.0.0.1:2/channel?token=u");
  assert.equal(store.getLastChannelUrl(), "ws://127.0.0.1:2/channel?token=u");
  store.setLastChannelUrl(null);
  assert.equal(store.getLastChannelUrl(), null);
  assert.equal(store.getLastDevice(), "Mic"); // device は独立。
});

// ── S6「会話が続く」自発発火スケジューラの結線（薄い・呼びかけ経路の縦串）────────────────
//
//  核心（自発 3 種の判定・不応期・確率・ジッター・予算・OFF トグル）は純ロジック側（fire-scheduler.mjs）で
//  fake clock/注入 RNG により全分岐テスト済み。ここは cockpit-server の結線が正しく糸を張っているか——
//  転写 onAppend → scheduler.handleTranscript → onFireRequest → fireOrchestrator.fire の**縦串**を、
//  タイマ不要で即時に判定する「呼びかけ（call）」で固定する（turn-end/silence はタイマ依存ゆえ純ロジック側）。

test("cockpit self-fire: 呼びかけ命中の you 転写が fireOrchestrator.fire() を呼ぶ（自発 ON・onAppend 経路）", async () => {
  const fakePipe = makeOnAppendPipeline();
  const fakeOrch = makeFakeOrchestrator({ fireResult: { fired: true, replyText: "はーい" } });
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fakePipe.factory),
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory),
    selfFireInitialEnabled: true
  });
  try {
    const url = await server.listen(0);
    await postJson(`${url}/api/ears/start`, { device: "Mic" });

    // 名前を含まない you 発話 → 呼びかけ非該当 → fire は呼ばれない。
    fakePipe.record.buffer.append({ startMs: 0, endMs: 900, text: "こんにちは" });
    assert.equal(fakeOrch.record.fireCount, 0);

    // 呼びかけ命中の you 発話 → fire が 1 回。S6 追撃（Domain E）: call は視覚優先（vision:"preferred"）へ
    // 格上げ（対象あれば画像付き・無/失敗なら画像なしの通常発火へ劣化）。従来 fire() 引数なしから変更。
    fakePipe.record.buffer.append({ startMs: 1000, endMs: 2000, text: "コーディこれ見て" });
    assert.equal(fakeOrch.record.fireCount, 1);
    assert.deepEqual(fakeOrch.record.lastFireOptions, { vision: "preferred" }); // call は視覚優先（Domain E 裁定）。

    // soul 発話が名前を含んでも自己応答しない（scheduler は soul を除外）。
    fakeOrch.record.hooks.onSoulTranscript({ seq: 2, startMs: 0, endMs: 0, text: "コーディだよ", speaker: "soul", appendedAtMs: 1000 });
    // ↑ onSoulTranscript は放送経路。転写バッファへの soul append（onAppend 経由）でも呼びかけ照合しないことを確認:
    fakePipe.record.buffer.append({ startMs: 3000, endMs: 3500, text: "コーディだよ", speaker: "soul" });
    assert.equal(fakeOrch.record.fireCount, 1);
  } finally {
    await server.close();
  }
});

test("cockpit self-fire: 自発 OFF（既定）では呼びかけ命中でも fire を呼ばない", async () => {
  const fakePipe = makeOnAppendPipeline();
  const fakeOrch = makeFakeOrchestrator({ fireResult: { fired: true, replyText: "はーい" } });
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fakePipe.factory),
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory)
    // selfFireInitialEnabled 未指定 = 既定 OFF。
  });
  try {
    const url = await server.listen(0);
    await postJson(`${url}/api/ears/start`, { device: "Mic" });
    fakePipe.record.buffer.append({ startMs: 0, endMs: 900, text: "コーディこれ見て" });
    assert.equal(fakeOrch.record.fireCount, 0);

    // setSelfFireEnabled(true) で ON にすると以後は呼びかけで fire する（Domain D のトグル継ぎ目）。
    assert.equal(server.setSelfFireEnabled(true), true);
    fakePipe.record.buffer.append({ startMs: 1000, endMs: 2000, text: "ねえコーディー" });
    assert.equal(fakeOrch.record.fireCount, 1);
  } finally {
    await server.close();
  }
});

test("cockpit self-fire: busy 中（state≠idle）は呼びかけでも fire 要求を出さない", async () => {
  const fakePipe = makeOnAppendPipeline();
  const fakeOrch = makeFakeOrchestrator({ fireResult: { fired: true } });
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fakePipe.factory),
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory),
    selfFireInitialEnabled: true
  });
  try {
    const url = await server.listen(0);
    await postJson(`${url}/api/ears/start`, { device: "Mic" });
    fakeOrch.record.state = "speaking"; // busy。
    fakePipe.record.buffer.append({ startMs: 0, endMs: 900, text: "コーディ" });
    assert.equal(fakeOrch.record.fireCount, 0);
    fakeOrch.record.state = "idle"; // busy 解除で通る。
    fakePipe.record.buffer.append({ startMs: 1000, endMs: 2000, text: "コーディ" });
    assert.equal(fakeOrch.record.fireCount, 1);
  } finally {
    await server.close();
  }
});

test("cockpit self-fire: state snapshot の selfFire.enabled と setSelfFireEnabled/selfFireStatus", async () => {
  const fakeOrch = makeFakeOrchestrator({});
  const server = createCockpitServer({
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory),
    selfFireInitialEnabled: true
  });
  try {
    const url = await server.listen(0);
    const s1 = await getJson(`${url}/api/state`);
    assert.deepEqual(s1.json.selfFire, { enabled: true });
    assert.deepEqual(server.selfFireStatus(), { enabled: true });

    assert.equal(server.setSelfFireEnabled(false), false);
    const s2 = await getJson(`${url}/api/state`);
    assert.deepEqual(s2.json.selfFire, { enabled: false });
  } finally {
    await server.close();
  }
});

test("cockpit self-fire: orchestrator 未注入なら scheduler 無し（selfFire:null・setSelfFireEnabled は no-op）", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const s = await getJson(`${url}/api/state`);
    assert.equal(s.json.selfFire, null);
    assert.equal(server.selfFireStatus(), null);
    assert.equal(server.setSelfFireEnabled(true), false); // scheduler 無し = no-op。
    // 口数モードも scheduler 無しなら null（selfFire と同型）。
    assert.equal(s.json.verbosity, null);
  } finally {
    await server.close();
  }
});

// ── S7「視聴者が混ざる」チャット取り込み経路の結線（薄い・★二重発火/二重放送の断ち）────────────
//
//  核心（comment/comment-call 判定・不応期・確率・予算）は純ロジック側（fire-scheduler.mjs）で fake
//  clock/注入 RNG により全分岐テスト済み。ここは cockpit-server の取り込み経路が正しく糸を張っているか
//  ——ingestChatMessage → append(viewer) + SSE viewer 行放送 + scheduler.handleChatMessage → onFireRequest
//  → fireOrchestrator.fire の縦串を、確実に返る comment-call で固定する（comment は確率依存ゆえ純ロジック側）。
//  ★ viewer append が handleTranscript の you 経路（call 照合）を誤起動しないこと・viewer 行が二重放送
//  されないことも固定する（接ぎ目リスク）。

test("cockpit S7 chat: viewer コメント取り込みで append + viewer 行を 1 回だけ放送（自発 OFF・二重放送しない）", async () => {
  const fakePipe = makeOnAppendPipeline();
  const fakeOrch = makeFakeOrchestrator({ fireResult: { fired: true } });
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fakePipe.factory),
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory)
    // selfFireInitialEnabled 未指定 = OFF（発火の確率非決定性を排して合流/放送だけを見る）。
  });
  const url = await server.listen(0);
  const sse = openSseClient(`${url}/api/events`);
  try {
    await sse.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/ears/start`, { device: "Mic" });

    server.ingestChatMessage({ text: "こんばんは！", displayName: "ハナコ", kind: "text" });

    // 合流: 転写バッファに viewer エントリ（displayName 付き・startMs/endMs=0）が 1 件。
    const viewers = fakePipe.record.buffer.all().filter((/** @type {any} */ e) => e.speaker === "viewer");
    assert.equal(viewers.length, 1);
    assert.equal(viewers[0].displayName, "ハナコ");
    assert.equal(viewers[0].startMs, 0);
    assert.equal(viewers[0].endMs, 0);
    assert.equal(viewers[0].text, "こんばんは！");

    // 放送: viewer 行の transcript イベントが 1 回だけ（耳の onTranscript は viewer を除外＝二重放送しない）。
    const b = await sse.waitFor((e) => e.event === "transcript" && e.data.speaker === "viewer");
    assert.equal(b.data.displayName, "ハナコ");
    await new Promise((r) => setTimeout(r, 50)); // 遅れて 2 個目が来ないことを積極確認。
    assert.equal(sse.events.filter((e) => e.event === "transcript" && e.data.speaker === "viewer").length, 1);

    // 自発 OFF ゆえ fire は呼ばれない。
    assert.equal(fakeOrch.record.fireCount, 0);
  } finally {
    sse.close();
    await server.close();
  }
});

test("cockpit S7 chat: comment-call は fire({vision:preferred}) を 1 回・kind が selfFire SSE に載る（★ 二重発火しない）", async () => {
  const fakePipe = makeOnAppendPipeline();
  const fakeOrch = makeFakeOrchestrator({ fireResult: { fired: true, replyText: "はーい" } });
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fakePipe.factory),
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory),
    selfFireInitialEnabled: true
  });
  const url = await server.listen(0);
  const sse = openSseClient(`${url}/api/events`);
  try {
    await sse.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/ears/start`, { device: "Mic" });

    // コメント本文に呼びかけ（音声 needle にもテキスト needle にも命中する「コーディ」）。
    // ★ handleTranscript(viewer) が you 経路を誤起動すれば "call" も出て fireCount=2 になる。
    server.ingestChatMessage({ text: "コーディこれ見て", displayName: "Taro", kind: "text" });

    // 同期的に fire は 1 回だけ（comment-call のみ・call は出ない＝二重発火の断ち）。
    assert.equal(fakeOrch.record.fireCount, 1);
    assert.deepEqual(fakeOrch.record.lastFireOptions, { vision: "preferred" }); // S7 も視覚優先。

    // selfFire SSE に kind:"comment-call" が載る（call ではない）。
    const evt = await sse.waitFor((e) => e.event === "selfFire");
    assert.equal(evt.data.kind, "comment-call");
    assert.equal(evt.data.fired, true);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(sse.events.filter((e) => e.event === "selfFire").length, 1);
    assert.equal(sse.events.filter((e) => e.event === "selfFire" && e.data.kind === "call").length, 0);

    // viewer 行も 1 回だけ放送（二重放送しない）。
    assert.equal(sse.events.filter((e) => e.event === "transcript" && e.data.speaker === "viewer").length, 1);
  } finally {
    sse.close();
    await server.close();
  }
});

test("cockpit S7 chat: 耳未起動（バッファ無し）は chatBufferAbsent 診断のみ・append/fire しない", async () => {
  const fakeOrch = makeFakeOrchestrator({ fireResult: { fired: true } });
  const server = createCockpitServer({
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory),
    selfFireInitialEnabled: true
    // pipelineFactory 未指定 + ears 未 start = pipeline null = 正本バッファ無し（合流先が無い）。
  });
  const url = await server.listen(0);
  const sse = openSseClient(`${url}/api/events`);
  try {
    await sse.waitFor((e) => e.event === "state");
    server.ingestChatMessage({ text: "コーディ見て", displayName: "A", kind: "text" });

    // 診断（ゴースト行材料）だけ出る。合流先が無いので append/fire しない（盲目発火しない）。
    const diag = await sse.waitFor((e) => e.event === "diagnostic" && e.data.type === "chatBufferAbsent");
    assert.match(diag.data.message, /ears not running/);
    assert.equal(fakeOrch.record.fireCount, 0);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(sse.events.filter((e) => e.event === "transcript" && e.data.speaker === "viewer").length, 0);
  } finally {
    sse.close();
    await server.close();
  }
});

test("cockpit S7 chat: broadcastChatStatus / broadcastChatDiagnostic が SSE に載る（状態表示/ゴースト行材料）", async () => {
  const server = createCockpitServer({});
  const url = await server.listen(0);
  const sse = openSseClient(`${url}/api/events`);
  try {
    await sse.waitFor((e) => e.event === "state");
    server.broadcastChatStatus("live");
    const st = await sse.waitFor((e) => e.event === "chatStatus");
    assert.equal(st.data.status, "live");

    server.broadcastChatDiagnostic({ kind: "notLive", message: "not live yet", atMs: 42, delayMs: 1000, attempt: 2 });
    const cd = await sse.waitFor((e) => e.event === "chatDiagnostic");
    assert.equal(cd.data.kind, "notLive");
    assert.match(cd.data.message, /not live/);
    assert.equal(cd.data.attempt, 2);
  } finally {
    sse.close();
    await server.close();
  }
});

test("cockpit S7 chat: 空コメントは捨てる（append/broadcast/fire しない）", async () => {
  const fakePipe = makeOnAppendPipeline();
  const fakeOrch = makeFakeOrchestrator({ fireResult: { fired: true } });
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fakePipe.factory),
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory),
    selfFireInitialEnabled: true
  });
  const url = await server.listen(0);
  const sse = openSseClient(`${url}/api/events`);
  try {
    await sse.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/ears/start`, { device: "Mic" });
    server.ingestChatMessage({ text: "   \n ", displayName: "A", kind: "text" });
    assert.equal(fakePipe.record.buffer.all().length, 0);
    assert.equal(fakeOrch.record.fireCount, 0);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(sse.events.filter((e) => e.event === "transcript").length, 0);
  } finally {
    sse.close();
    await server.close();
  }
});

// ── S7 Domain C: チャット器官の Connect/停止ライフサイクル（cockpit-server 所有・POST 駆動・factory 注入）──
//
//  Domain B が敷いた取り込み経路（ingestChatMessage/broadcastChatStatus/broadcastChatDiagnostic）へ、
//  実チャット器官（Domain A createLiveChatClient・ここでは fake 注入）の onMessage/onStatus/onDiagnostic を
//  **cockpit-server が Connect 時に繋ぐ**縦串を固定する。実 YouTube/実ネット/実 SDK には一切出ない
//  （fake 器官 factory のみ）。生成→start→フック結線→ingest（viewer 行 SSE）→chatStatus/chatDiagnostic
//  SSE→停止（畳み）→close の全ライフサイクルを決定論で駆動する。

/**
 * fake チャット器官 factory（createLiveChatClient と同型の口・実ネットに出ない）。テストが
 * emitMessage/emitStatus/emitDiagnostic で器官のフックを駆動できる。
 */
function makeFakeChatClientFactory() {
  const record = { /** @type {any[]} */ clients: [] };
  const factory = (/** @type {{ source: string }} */ opts) => {
    const source = opts.source;
    const msgL = new Set();
    const stL = new Set();
    const dgL = new Set();
    let state = "idle";
    let started = false;
    let stopped = false;
    const client = {
      // 器官 API（Domain A createLiveChatClient の口）。
      async start() {
        started = true;
        state = "connecting";
      },
      stop() {
        stopped = true;
        state = "dead";
      },
      getState: () => state,
      getSource: () => source,
      /** @param {(m:any)=>void} fn */ onMessage: (fn) => (msgL.add(fn), () => msgL.delete(fn)),
      /** @param {(s:string)=>void} fn */ onStatus: (fn) => (stL.add(fn), () => stL.delete(fn)),
      /** @param {(i:any)=>void} fn */ onDiagnostic: (fn) => (dgL.add(fn), () => dgL.delete(fn)),
      async idle() {},
      // テスト駆動ヘルパ（器官がフックを呼ぶのを模す）。
      isStarted: () => started,
      isStopped: () => stopped,
      /** @param {any} m */ emitMessage: (m) => msgL.forEach((f) => /** @type {any} */ (f)(m)),
      /** @param {string} s */ emitStatus: (s) => {
        state = s;
        stL.forEach((f) => /** @type {any} */ (f)(s));
      },
      /** @param {any} i */ emitDiagnostic: (i) => dgL.forEach((f) => /** @type {any} */ (f)(i)),
      listenerCounts: () => ({ msg: msgL.size, st: stL.size, dg: dgL.size })
    };
    record.clients.push(client);
    return client;
  };
  return { factory, record, get last() { return record.clients[record.clients.length - 1]; } };
}

test("cockpit S7 chat Connect: factory から器官生成・start・onMessage→viewer 行・onStatus→chatStatus・onDiagnostic→chatDiagnostic を結線", async () => {
  const fakePipe = makeOnAppendPipeline();
  const fakeOrch = makeFakeOrchestrator({ fireResult: { fired: true } });
  const fakeChat = makeFakeChatClientFactory();
  /** @type {string[]} */ const persisted = [];
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fakePipe.factory),
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory),
    chatClientFactory: /** @type {any} */ (fakeChat.factory),
    onSetChatSource: (s) => persisted.push(/** @type {any} */ (s)),
    selfFireInitialEnabled: true
  });
  const url = await server.listen(0);
  const sse = openSseClient(`${url}/api/events`);
  try {
    await sse.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/ears/start`, { device: "Mic" }); // ★ 耳を起動した状態で Connect（合流先バッファ）。

    const r = await postJson(`${url}/api/chat/connect`, { source: "https://youtube.com/watch?v=abc" });
    assert.equal(r.status, 200);
    // factory は {source} で 1 回呼ばれ・start 済み・フック 3 種を結線している。
    assert.equal(fakeChat.record.clients.length, 1);
    const client = fakeChat.last;
    assert.equal(client.getSource(), "https://youtube.com/watch?v=abc");
    assert.equal(client.isStarted(), true);
    assert.deepEqual(client.listenerCounts(), { msg: 1, st: 1, dg: 1 });
    // source は永続化フックへ橋渡し（次回起動で入力欄に復元）。
    assert.deepEqual(persisted, ["https://youtube.com/watch?v=abc"]);
    // snapshot.chat が connected を反映。
    assert.equal(r.json.chat.connected, true);

    // onMessage → ingestChatMessage → viewer 行 SSE（displayName 付き）。器官の外から hooks 経由で合流。
    client.emitMessage({ text: "こんばんは", displayName: "ハナコ" });
    const vrow = await sse.waitFor((e) => e.event === "transcript" && e.data.speaker === "viewer");
    assert.equal(vrow.data.displayName, "ハナコ");
    assert.equal(vrow.data.text, "こんばんは");

    // onStatus → chatStatus SSE（状態表示材料）。
    client.emitStatus("live");
    const st = await sse.waitFor((e) => e.event === "chatStatus");
    assert.equal(st.data.status, "live");
    // getState が live を返す＝snapshot.chat.state も live。
    const s2 = await getJson(`${url}/api/state`);
    assert.equal(s2.json.chat.state, "live");

    // onDiagnostic → chatDiagnostic SSE（ゴースト行材料）。
    client.emitDiagnostic({ kind: "notLive", message: "waiting", atMs: 1, delayMs: 1000, attempt: 1 });
    const cd = await sse.waitFor((e) => e.event === "chatDiagnostic");
    assert.equal(cd.data.kind, "notLive");
    assert.equal(cd.data.attempt, 1);
  } finally {
    sse.close();
    await server.close();
  }
});

test("cockpit S7 chat Connect: 結線した onMessage 経由の呼びかけコメントで fire({vision:preferred}) が 1 回（縦串）", async () => {
  const fakePipe = makeOnAppendPipeline();
  const fakeOrch = makeFakeOrchestrator({ fireResult: { fired: true } });
  const fakeChat = makeFakeChatClientFactory();
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fakePipe.factory),
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory),
    chatClientFactory: /** @type {any} */ (fakeChat.factory),
    selfFireInitialEnabled: true
  });
  const url = await server.listen(0);
  const sse = openSseClient(`${url}/api/events`);
  try {
    await sse.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/ears/start`, { device: "Mic" });
    await postJson(`${url}/api/chat/connect`, { source: "vid123" });
    // 器官が呼びかけコメントを配信 → onMessage → ingest → scheduler.handleChatMessage → comment-call 確実発火。
    fakeChat.last.emitMessage({ text: "コーディこれ見て", displayName: "Taro" });
    assert.equal(fakeOrch.record.fireCount, 1);
    assert.deepEqual(fakeOrch.record.lastFireOptions, { vision: "preferred" });
    const evt = await sse.waitFor((e) => e.event === "selfFire");
    assert.equal(evt.data.kind, "comment-call");
    assert.equal(evt.data.fired, true);
  } finally {
    sse.close();
    await server.close();
  }
});

test("cockpit S7 chat Disconnect: stop() + フック購読解除で畳み・以後のコメントは合流しない", async () => {
  const fakePipe = makeOnAppendPipeline();
  const fakeChat = makeFakeChatClientFactory();
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fakePipe.factory),
    chatClientFactory: /** @type {any} */ (fakeChat.factory)
  });
  const url = await server.listen(0);
  const sse = openSseClient(`${url}/api/events`);
  try {
    await sse.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/ears/start`, { device: "Mic" });
    await postJson(`${url}/api/chat/connect`, { source: "vid" });
    const client = fakeChat.last;

    const r = await postJson(`${url}/api/chat/disconnect`, {});
    assert.equal(r.status, 200);
    assert.equal(client.isStopped(), true); // 器官は stop（dead）。
    assert.deepEqual(client.listenerCounts(), { msg: 0, st: 0, dg: 0 }); // フック全撤去。
    assert.equal(r.json.chat.connected, false);

    // 畳んだ後に器官がメッセージを出しても合流しない（購読解除済み＝取り込み経路に届かない）。
    client.emitMessage({ text: "遅れコメント", displayName: "X" });
    await new Promise((res) => setTimeout(res, 30));
    assert.equal(fakePipe.record.buffer.all().filter((/** @type {any} */ e) => e.speaker === "viewer").length, 0);
  } finally {
    sse.close();
    await server.close();
  }
});

test("cockpit S7 chat Connect 再操作: 既存器官を畳んで新 source で作り直す（同一インスタンス restart なし）", async () => {
  const fakeChat = makeFakeChatClientFactory();
  const server = createCockpitServer({ chatClientFactory: /** @type {any} */ (fakeChat.factory) });
  try {
    const url = await server.listen(0);
    await postJson(`${url}/api/chat/connect`, { source: "streamA" });
    const first = fakeChat.last;
    assert.equal(first.getSource(), "streamA");

    // 再 Connect（別配信）: ended で dead に落ちた器官の restart は無い＝新器官を作る。
    await postJson(`${url}/api/chat/connect`, { source: "streamB" });
    assert.equal(fakeChat.record.clients.length, 2);
    assert.equal(first.isStopped(), true); // 旧器官は畳まれた。
    const second = fakeChat.last;
    assert.equal(second.getSource(), "streamB");
    assert.equal(second.isStopped(), false);
  } finally {
    await server.close();
  }
});

test("cockpit S7 chat close(): 稼働中のチャット器官も畳む（stop・タイマ/プロセスを残さない）", async () => {
  const fakeChat = makeFakeChatClientFactory();
  const server = createCockpitServer({ chatClientFactory: /** @type {any} */ (fakeChat.factory) });
  const url = await server.listen(0);
  await postJson(`${url}/api/chat/connect`, { source: "vid" });
  const client = fakeChat.last;
  assert.equal(client.isStopped(), false);
  await server.close();
  assert.equal(client.isStopped(), true); // close で畳まれた。
});

test("cockpit S7 chat Connect: factory 未注入なら 503（chat not available・器官を作らない）", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/chat/connect`, { source: "vid" });
    assert.equal(r.status, 503);
    assert.match(r.json.error, /chat not available/);
  } finally {
    await server.close();
  }
});

test("cockpit S7 chat Connect: 空 source は 400（factory を呼ばない・停止は disconnect の領分）", async () => {
  const fakeChat = makeFakeChatClientFactory();
  const server = createCockpitServer({ chatClientFactory: /** @type {any} */ (fakeChat.factory) });
  try {
    const url = await server.listen(0);
    const r1 = await postJson(`${url}/api/chat/connect`, { source: "   " });
    assert.equal(r1.status, 400);
    const r2 = await postJson(`${url}/api/chat/connect`, {}); // body なし。
    assert.equal(r2.status, 400);
    assert.equal(fakeChat.record.clients.length, 0); // 器官を作っていない。
  } finally {
    await server.close();
  }
});

test("cockpit S7 chat: state snapshot の chat.source は chatSourceStatus 由来（Connect 前でも記憶を復元）", async () => {
  const server = createCockpitServer({
    chatSourceStatus: () => ({ source: "remembered-vid" })
  });
  try {
    const url = await server.listen(0);
    const s = await getJson(`${url}/api/state`);
    assert.equal(s.json.chat.source, "remembered-vid"); // 入力欄の既定に復元できる。
    assert.equal(s.json.chat.connected, false); // まだ Connect していない。
    assert.equal(s.json.chat.state, null);
  } finally {
    await server.close();
  }
});

/**
 * throw する fake チャット器官 factory（生成時 throw / start() reject の 2 モード）。Connect の防波堤
 * （foldChatClient + 500）が盲目の 200 を返さない・器官を畳んでリークを残さないことを固定する。実ネット不出。
 * @param {"factory-throw"|"start-reject"} mode
 */
function makeThrowingChatClientFactory(mode) {
  const record = { /** @type {any[]} */ clients: [] };
  const factory = (/** @type {{ source: string }} */ opts) => {
    if (mode === "factory-throw") throw new Error("factory boom"); // 器官を作る前に投げる。
    const msgL = new Set();
    const stL = new Set();
    const dgL = new Set();
    let stopped = false;
    let state = "idle";
    const client = {
      async start() {
        throw new Error("start boom"); // 生成後・start で投げる（フックは既に結線済み）。
      },
      stop() {
        stopped = true;
        state = "dead";
      },
      getState: () => state,
      getSource: () => opts.source,
      /** @param {(m:any)=>void} fn */ onMessage: (fn) => (msgL.add(fn), () => msgL.delete(fn)),
      /** @param {(s:string)=>void} fn */ onStatus: (fn) => (stL.add(fn), () => stL.delete(fn)),
      /** @param {(i:any)=>void} fn */ onDiagnostic: (fn) => (dgL.add(fn), () => dgL.delete(fn)),
      isStopped: () => stopped,
      listenerCounts: () => ({ msg: msgL.size, st: stL.size, dg: dgL.size })
    };
    record.clients.push(client);
    return client;
  };
  return { factory, record, get last() { return record.clients[record.clients.length - 1]; } };
}

test("cockpit S7 chat Connect: 生成/start の想定外 throw は foldChatClient で畳んで 500（盲目の 200 を返さない・リーク無し）", async () => {
  // ① start() reject: 器官は生成されフックも結線されるが start が投げる → 畳んで 500。
  //    作った器官は stop（dead）+ フック全撤去（タイマ/購読を残さない）・snapshot は connected=false。
  const rejecting = makeThrowingChatClientFactory("start-reject");
  const server = createCockpitServer({ chatClientFactory: /** @type {any} */ (rejecting.factory) });
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/chat/connect`, { source: "vid" });
    assert.equal(r.status, 500);
    assert.match(r.json.error, /chat connect failed/);
    assert.equal(rejecting.record.clients.length, 1); // 器官は 1 個生成された。
    assert.equal(rejecting.last.isStopped(), true); // foldChatClient で stop（dead）。
    assert.deepEqual(rejecting.last.listenerCounts(), { msg: 0, st: 0, dg: 0 }); // フック全撤去（リーク無し）。
    const s = await getJson(`${url}/api/state`);
    assert.equal(s.json.chat.connected, false); // 盲目の「接続済み」を残さない。
    assert.equal(s.json.chat.state, null);
  } finally {
    await server.close();
  }

  // ② factory 自体の throw: 器官が生成される前に投げる → 畳んで 500（器官ゼロ・connected=false）。
  const throwing = makeThrowingChatClientFactory("factory-throw");
  const server2 = createCockpitServer({ chatClientFactory: /** @type {any} */ (throwing.factory) });
  try {
    const url2 = await server2.listen(0);
    const r2 = await postJson(`${url2}/api/chat/connect`, { source: "vid" });
    assert.equal(r2.status, 500);
    assert.match(r2.json.error, /chat connect failed/);
    assert.equal(throwing.record.clients.length, 0); // 器官は作られていない。
    const s2 = await getJson(`${url2}/api/state`);
    assert.equal(s2.json.chat.connected, false);
  } finally {
    await server2.close();
  }
});

// ── S6 Domain D: 操縦席の口（自発 ON/OFF トグル + 出力デバイス選択 + タイムラインマーカー）───────────
//
//  GET /api/audio-devices・POST /api/audio-device・POST /api/self-fire は GET /api/windows・
//  POST /api/vision-target の写経（domain-d.md §）。listAudioDevicesImpl は必ず fake 注入する
//  （既定は実 PowerShell 起動＝Domain A audio-player.mjs の listAudioDevices・このテストファイルでは
//  一度も実行しない）。

test("cockpit GET /api/audio-devices: listAudioDevicesImpl の成功結果（.devices）を返す", async () => {
  const server = createCockpitServer({
    listAudioDevicesImpl: async () => ({
      devices: [
        { id: "{a}", name: "BenQ EX2510S (NVIDIA High Definition Audio)" },
        { id: "{b}", name: "ヘッドホン (2- Shure MV7+)" }
      ]
    })
  });
  try {
    const url = await server.listen(0);
    const r = await getJson(`${url}/api/audio-devices`);
    assert.equal(r.status, 200);
    assert.equal(r.json.error, null);
    assert.equal(r.json.devices.length, 2);
    assert.equal(r.json.devices[1].name, "ヘッドホン (2- Shure MV7+)");
  } finally {
    await server.close();
  }
});

test("cockpit GET /api/audio-devices: listAudioDevicesImpl の失敗（.error）は devices:[] + error を返す（実起動しない）", async () => {
  const server = createCockpitServer({
    listAudioDevicesImpl: async () => ({ error: { kind: "timeout", message: "device listing timed out after 8000ms" } })
  });
  try {
    const url = await server.listen(0);
    const r = await getJson(`${url}/api/audio-devices`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.devices, []);
    assert.match(r.json.error, /timed out/);
  } finally {
    await server.close();
  }
});

test("cockpit GET /api/audio-devices: 未注入時は既定実装（Domain A listAudioDevices）が使われる（呼び出しの型のみ確認・実起動しない）", () => {
  // 既定 listAudioDevicesImpl は実 PowerShell を起動するため実行はしない。ここでは createCockpitServer が
  // listAudioDevicesImpl 未指定でも throw せず構築できる（既定値が代入される）ことだけを確認する。
  const server = createCockpitServer({});
  assert.equal(typeof server.listen, "function");
});

test("cockpit POST /api/audio-device: onSetAudioDevice 未注入なら 503", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/audio-device`, { name: "Some Device" });
    assert.equal(r.status, 503);
    assert.match(r.json.error, /audio device control not available/);
    // audioDeviceStatus 未注入なら state.audioDevice は null。
    const s = await getJson(`${url}/api/state`);
    assert.equal(s.json.audioDevice, null);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/audio-device: name をフックへ橋渡しし・state に audioDeviceStatus を載せる", async () => {
  let received = /** @type {string | null | undefined} */ (undefined);
  let current = /** @type {string | null} */ (null);
  const server = createCockpitServer({
    onSetAudioDevice: (name) => {
      received = name;
      current = name;
    },
    audioDeviceStatus: () => ({ name: current })
  });
  try {
    const url = await server.listen(0);
    const s0 = await getJson(`${url}/api/state`);
    assert.equal(s0.json.audioDevice.name, null);

    const r = await postJson(`${url}/api/audio-device`, { name: "  ヘッドホン (2- Shure MV7+)  " });
    assert.equal(r.status, 200);
    // フックは trim 済みの名前を受ける。
    assert.equal(received, "ヘッドホン (2- Shure MV7+)");
    assert.equal(r.json.audioDevice.name, "ヘッドホン (2- Shure MV7+)");

    // 空文字はクリア（null をフックへ = 既定デバイスへ）。
    const rc = await postJson(`${url}/api/audio-device`, { name: "   " });
    assert.equal(rc.status, 200);
    assert.equal(received, null);
    assert.equal(rc.json.audioDevice.name, null);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/self-fire: scheduler 未生成（orchestrator 未注入）なら 503", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/self-fire`, { enabled: true });
    assert.equal(r.status, 503);
    assert.match(r.json.error, /self-fire control not available/);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/self-fire: enabled を切り替え・state.selfFire に反映する", async () => {
  const fakeOrch = makeFakeOrchestrator({});
  const server = createCockpitServer({
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory)
    // selfFireInitialEnabled 未指定 = 既定 OFF。
  });
  try {
    const url = await server.listen(0);
    const s0 = await getJson(`${url}/api/state`);
    assert.deepEqual(s0.json.selfFire, { enabled: false });

    const r = await postJson(`${url}/api/self-fire`, { enabled: true });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.selfFire, { enabled: true });
    assert.deepEqual(server.selfFireStatus(), { enabled: true });

    const r2 = await postJson(`${url}/api/self-fire`, { enabled: false });
    assert.equal(r2.status, 200);
    assert.deepEqual(r2.json.selfFire, { enabled: false });
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/self-fire: onSetSelfFireEnabled 永続化フックへ橋渡しする（未注入でも 503 にならない）", async () => {
  const persisted = [];
  const fakeOrch = makeFakeOrchestrator({});
  const server = createCockpitServer({
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory),
    onSetSelfFireEnabled: (enabled) => {
      persisted.push(enabled);
    }
  });
  try {
    const url = await server.listen(0);
    await postJson(`${url}/api/self-fire`, { enabled: true });
    assert.deepEqual(persisted, [true]);
    await postJson(`${url}/api/self-fire`, { enabled: false });
    assert.deepEqual(persisted, [true, false]);
  } finally {
    await server.close();
  }
});

// ── POST /api/verbosity（wave 計画「口数配線」§2 裁定 A・POST /api/self-fire の写経）───────────

test("cockpit POST /api/verbosity: scheduler 未生成（orchestrator 未注入）なら 503", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/verbosity`, { mode: "chatty" });
    assert.equal(r.status, 503);
    assert.match(r.json.error, /verbosity control not available/);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/verbosity: 妥当な mode を切り替え・state.verbosity に反映する", async () => {
  const fakeOrch = makeFakeOrchestrator({});
  const server = createCockpitServer({
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory)
    // verbosityInitialMode 未指定 = 既定 "normal"。
  });
  try {
    const url = await server.listen(0);
    const s0 = await getJson(`${url}/api/state`);
    assert.equal(s0.json.verbosity, "normal");

    const r = await postJson(`${url}/api/verbosity`, { mode: "chatty" });
    assert.equal(r.status, 200);
    assert.equal(r.json.verbosity, "chatty");

    const r2 = await postJson(`${url}/api/verbosity`, { mode: "quiet" });
    assert.equal(r2.status, 200);
    assert.equal(r2.json.verbosity, "quiet");
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/verbosity: 無効 mode（未知値/非文字列/欠落）は 400・state は変わらない", async () => {
  const fakeOrch = makeFakeOrchestrator({});
  const server = createCockpitServer({
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory)
  });
  try {
    const url = await server.listen(0);
    for (const bad of [{ mode: "bogus" }, { mode: 123 }, {}]) {
      const r = await postJson(`${url}/api/verbosity`, bad);
      assert.equal(r.status, 400, `mode=${JSON.stringify(bad)} は 400`);
      assert.match(r.json.error, /invalid verbosity mode/);
    }
    const s = await getJson(`${url}/api/state`);
    assert.equal(s.json.verbosity, "normal", "無効入力後も state は変わらない");
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/verbosity: 起動時 verbosityInitialMode が scheduler に反映される", async () => {
  const fakeOrch = makeFakeOrchestrator({});
  const server = createCockpitServer({
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory),
    verbosityInitialMode: "chatty"
  });
  try {
    const url = await server.listen(0);
    const s = await getJson(`${url}/api/state`);
    assert.equal(s.json.verbosity, "chatty");
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/verbosity: onSetVerbosity 永続化フックへ橋渡しする（未注入でも 503 にならない）", async () => {
  const persisted = [];
  const fakeOrch = makeFakeOrchestrator({});
  const server = createCockpitServer({
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory),
    onSetVerbosity: (mode) => {
      persisted.push(mode);
    }
  });
  try {
    const url = await server.listen(0);
    await postJson(`${url}/api/verbosity`, { mode: "chatty" });
    assert.deepEqual(persisted, ["chatty"]);
    await postJson(`${url}/api/verbosity`, { mode: "quiet" });
    assert.deepEqual(persisted, ["chatty", "quiet"]);
    // 無効 mode は onSetVerbosity を呼ばない（切替自体が起きていない）。
    await postJson(`${url}/api/verbosity`, { mode: "bogus" });
    assert.deepEqual(persisted, ["chatty", "quiet"]);
  } finally {
    await server.close();
  }
});

// ── POST /api/kill（S8「キルスイッチ」・POST /api/self-fire / /api/verbosity の写経）───────────
//
//  キル状態の正本はサーバ側に一つ（cockpit-server.mjs の `killed` 変数）。orchestrator へは生成時
//  （initialKilled・born-killed）と遷移時（kill()/revive()）の両方で伝播する。POST /api/kill は
//  fire() の Promise には一切依存しない（レスポンス正本は snapshot + kill() 自身の戻り値のみ）。

test("cockpit POST /api/kill: orchestrator 未注入なら 503", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/kill`, { killed: true });
    assert.equal(r.status, 503);
    assert.match(r.json.error, /kill control not available/);
  } finally {
    await server.close();
  }
});

test("cockpit GET /api/state: snapshot に killed キーが載る（初期 false・orchestrator 未注入でも既定 false）", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const s = await getJson(`${url}/api/state`);
    assert.equal(s.json.killed, false);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/kill: {killed:true} → 200・snapshot.killed:true・orchestrator.kill() が呼ばれる・SSE state が流れる", async () => {
  const fakeOrch = makeFakeOrchestrator({});
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory) });
  const url = await server.listen(0);
  const client = openSseClient(`${url}/api/events`);
  try {
    await client.waitFor((e) => e.event === "state");
    const r = await postJson(`${url}/api/kill`, { killed: true });
    assert.equal(r.status, 200);
    assert.equal(r.json.killed, true);
    assert.equal(fakeOrch.record.killCount, 1);
    assert.equal(fakeOrch.record.killed, true);
    // broadcastState() が SSE "state" に killed:true を乗せて流れる。
    const evt = await client.waitFor((e) => e.event === "state" && e.data.killed === true);
    assert.equal(evt.data.killed, true);
    // GET /api/state も反映済み。
    const s = await getJson(`${url}/api/state`);
    assert.equal(s.json.killed, true);
  } finally {
    client.close();
    await server.close();
  }
});

test("cockpit POST /api/kill: {killed:false} → 200・snapshot.killed:false・orchestrator.revive() が呼ばれる", async () => {
  const fakeOrch = makeFakeOrchestrator({});
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory) });
  try {
    const url = await server.listen(0);
    // まず kill してから revive する。
    await postJson(`${url}/api/kill`, { killed: true });
    assert.equal(fakeOrch.record.killCount, 1);
    const r = await postJson(`${url}/api/kill`, { killed: false });
    assert.equal(r.status, 200);
    assert.equal(r.json.killed, false);
    assert.equal(fakeOrch.record.reviveCount, 1);
    assert.equal(fakeOrch.record.killed, false);
    const s = await getJson(`${url}/api/state`);
    assert.equal(s.json.killed, false);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/kill: 非 boolean（文字列）は 400・state は変わらない", async () => {
  const fakeOrch = makeFakeOrchestrator({});
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory) });
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/kill`, { killed: "yes" });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /killed must be a boolean/);
    assert.equal(fakeOrch.record.killCount, 0);
    const s = await getJson(`${url}/api/state`);
    assert.equal(s.json.killed, false);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/kill: body 欠落（killed が undefined）は 400", async () => {
  const fakeOrch = makeFakeOrchestrator({});
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory) });
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/kill`, {});
    assert.equal(r.status, 400);
    assert.match(r.json.error, /killed must be a boolean/);
  } finally {
    await server.close();
  }
});

test("cockpit S8 born-killed: fireOrchestratorFactory の hooks に initialKilled（サーバ現況）が渡る", async () => {
  // サーバ起動直後は killed 初期 false ゆえ、生成時に渡る initialKilled も false（born-killed 配線の存在確認）。
  const fakeOrch = makeFakeOrchestrator({});
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory) });
  try {
    await server.listen(0);
    assert.equal(fakeOrch.record.initialKilledSeen, false);
  } finally {
    await server.close();
  }
});

// ── POST /api/brain（多頭化 Domain B・POST /api/verbosity / /api/kill の写経）─────────────────
//
//  頭脳の切替継ぎ目。永続化 + 現 session の dispose→null（次発火から新頭）は cockpit.mjs の onSetBrain が
//  担う（責務境界: cockpit-server は brain の中身を知らない）。snapshot の brain は brainStatus() 経由で
//  頭札 + 資格情報の存在確認（credentialHealth）を載せる。onSetBrain 未注入なら 503（未注入ゲート）。

/** cockpit.mjs の onSetBrain/brainStatus 配線と同型の最小 fake（現在の頭を保持し切替を記録する）。 */
function makeFakeBrainWiring(initial = "claude") {
  let currentBrain = initial;
  const record = { calls: /** @type {string[]} */ ([]) };
  return {
    record,
    onSetBrain: async (/** @type {string} */ choice) => {
      record.calls.push(choice);
      currentBrain = choice;
    },
    // 資格情報は存在確認のみ（テストは boolean 固定・中身は読まない=実 auth.json に触れない）。
    brainStatus: () => ({ brain: currentBrain, credentialHealth: true })
  };
}

test("cockpit POST /api/brain: onSetBrain 未注入なら 503", async () => {
  const server = createCockpitServer({});
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/brain`, { brain: "codex" });
    assert.equal(r.status, 503);
    assert.match(r.json.error, /brain control not available/);
  } finally {
    await server.close();
  }
});

test("cockpit GET /api/state: snapshot に brain が載る（既定 brain・credentialHealth boolean）", async () => {
  const wiring = makeFakeBrainWiring("claude");
  const server = createCockpitServer({ brainStatus: /** @type {any} */ (wiring.brainStatus) });
  try {
    const url = await server.listen(0);
    const s = await getJson(`${url}/api/state`);
    assert.deepEqual(s.json.brain, { brain: "claude", credentialHealth: true });
    assert.equal(typeof s.json.brain.credentialHealth, "boolean");
    // brainStatus 未注入なら null（未注入ゲートの対称・別サーバで確認）。
    const bare = createCockpitServer({});
    const bareUrl = await bare.listen(0);
    const bs = await getJson(`${bareUrl}/api/state`);
    assert.equal(bs.json.brain, null);
    await bare.close();
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/brain: {brain:\"codex\"} → 200・snapshot.brain.brain===\"codex\"・onSetBrain が呼ばれる・SSE state が流れる", async () => {
  const wiring = makeFakeBrainWiring("claude");
  const server = createCockpitServer({
    onSetBrain: /** @type {any} */ (wiring.onSetBrain),
    brainStatus: /** @type {any} */ (wiring.brainStatus)
  });
  const url = await server.listen(0);
  const client = openSseClient(`${url}/api/events`);
  try {
    await client.waitFor((e) => e.event === "state");
    const r = await postJson(`${url}/api/brain`, { brain: "codex" });
    assert.equal(r.status, 200);
    assert.equal(r.json.brain.brain, "codex");
    assert.deepEqual(wiring.record.calls, ["codex"]);
    // broadcastState() が SSE "state" に brain.brain:"codex" を乗せて流れる。
    const evt = await client.waitFor((e) => e.event === "state" && e.data.brain && e.data.brain.brain === "codex");
    assert.equal(evt.data.brain.brain, "codex");
    // GET /api/state も反映済み。
    const s = await getJson(`${url}/api/state`);
    assert.equal(s.json.brain.brain, "codex");
  } finally {
    client.close();
    await server.close();
  }
});

test("cockpit POST /api/brain: {brain:\"claude\"} → 200（Claude へ戻す）", async () => {
  const wiring = makeFakeBrainWiring("codex");
  const server = createCockpitServer({
    onSetBrain: /** @type {any} */ (wiring.onSetBrain),
    brainStatus: /** @type {any} */ (wiring.brainStatus)
  });
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/brain`, { brain: "claude" });
    assert.equal(r.status, 200);
    assert.equal(r.json.brain.brain, "claude");
    assert.deepEqual(wiring.record.calls, ["claude"]);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/brain: {brain:\"codex-55\"}/{brain:\"codex-56-sol\"} → 200（2026-07-17 追撃・4頭目まで受理）", async () => {
  const wiring = makeFakeBrainWiring("claude");
  const server = createCockpitServer({
    onSetBrain: /** @type {any} */ (wiring.onSetBrain),
    brainStatus: /** @type {any} */ (wiring.brainStatus)
  });
  try {
    const url = await server.listen(0);
    const r55 = await postJson(`${url}/api/brain`, { brain: "codex-55" });
    assert.equal(r55.status, 200);
    assert.equal(r55.json.brain.brain, "codex-55");
    const rSol = await postJson(`${url}/api/brain`, { brain: "codex-56-sol" });
    assert.equal(rSol.status, 200);
    assert.equal(rSol.json.brain.brain, "codex-56-sol");
    assert.deepEqual(wiring.record.calls, ["codex-55", "codex-56-sol"]);
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/brain: 不正値（gpt）は 400・onSetBrain を呼ばず state 不変", async () => {
  const wiring = makeFakeBrainWiring("claude");
  const server = createCockpitServer({
    onSetBrain: /** @type {any} */ (wiring.onSetBrain),
    brainStatus: /** @type {any} */ (wiring.brainStatus)
  });
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/brain`, { brain: "gpt" });
    assert.equal(r.status, 400);
    assert.match(r.json.error, /invalid brain/);
    assert.deepEqual(wiring.record.calls, []); // 切替は起きていない。
    const s = await getJson(`${url}/api/state`);
    assert.equal(s.json.brain.brain, "claude"); // 現況は不変。
  } finally {
    await server.close();
  }
});

test("cockpit POST /api/brain: body 欠落（brain が undefined）は 400", async () => {
  const wiring = makeFakeBrainWiring("claude");
  const server = createCockpitServer({
    onSetBrain: /** @type {any} */ (wiring.onSetBrain),
    brainStatus: /** @type {any} */ (wiring.brainStatus)
  });
  try {
    const url = await server.listen(0);
    const r = await postJson(`${url}/api/brain`, {});
    assert.equal(r.status, 400);
    assert.match(r.json.error, /invalid brain/);
    assert.deepEqual(wiring.record.calls, []);
  } finally {
    await server.close();
  }
});

// ── 多頭化 Domain C: 観測層（soul 行の latencyMs 実値化 + brain 札・usage の brain 札）──────────
//
//  broadcastSoulTranscript / onUsage の additive フィールド化を固定する（blocking #6 additive・
//  ワイヤ契約の既存フィールドは無変更）。latencyMs 実値の生成元（fire-orchestrator の
//  asked.elapsedMs 伝播）は fire-orchestrator.test.mjs 側で別途固定済み——ここは
//  「hooks.onSoulTranscript(entry) に entry.latencyMs が乗っていれば、そのまま SSE transcript の
//  latencyMs として流れる」という cockpit-server 側の配線だけを検証する。

test("cockpit SSE: onSoulTranscript の entry.latencyMs が transcript(speaker:soul) の latencyMs として実値で流れる（従来の null 固定から実値化）", async () => {
  const wiring = makeFakeBrainWiring("claude");
  const fake = makeFakeOrchestrator({
    fireResult: { fired: true, replyText: "はい" },
    drive: (hooks) => {
      hooks.onSoulTranscript({ seq: 1, startMs: 0, endMs: 0, text: "はい", speaker: "soul", appendedAtMs: 1000, latencyMs: 2345 });
    }
  });
  const server = createCockpitServer({
    fireOrchestratorFactory: /** @type {any} */ (fake.factory),
    brainStatus: /** @type {any} */ (wiring.brainStatus)
  });
  const url = await server.listen(0);
  const client = openSseClient(`${url}/api/events`);
  try {
    await client.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/fire`, {});
    const soulLine = await client.waitFor((e) => e.event === "transcript" && e.data.speaker === "soul");
    assert.equal(soulLine.data.latencyMs, 2345);
    // brain 札も additive で乗る（brainStatus() の現況・既定 claude）。
    assert.equal(soulLine.data.brain, "claude");
  } finally {
    client.close();
    await server.close();
  }
});

test("cockpit SSE: onSoulTranscript の entry に latencyMs が無ければ従来どおり null（後方互換・既存呼び出し形は壊れない）", async () => {
  const fake = makeFakeOrchestrator({
    fireResult: { fired: true, replyText: "はい" },
    drive: (hooks) => {
      // 既存呼び出し形（latencyMs フィールド無し・S3〜S8 の既存テストと同型）。
      hooks.onSoulTranscript({ seq: 1, startMs: 0, endMs: 0, text: "はい", speaker: "soul", appendedAtMs: 1000 });
    }
  });
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fake.factory) });
  const url = await server.listen(0);
  const client = openSseClient(`${url}/api/events`);
  try {
    await client.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/fire`, {});
    const soulLine = await client.waitFor((e) => e.event === "transcript" && e.data.speaker === "soul");
    assert.equal(soulLine.data.latencyMs, null);
    // brainStatus 未注入なら brain:null（audioDevice/channel と同型の未注入ゲート）。
    assert.equal(soulLine.data.brain, null);
  } finally {
    client.close();
    await server.close();
  }
});

test("cockpit SSE: onUsage に brain 札が additive で乗る（既存 usage フィールドは無変更）", async () => {
  const wiring = makeFakeBrainWiring("codex");
  const fake = makeFakeOrchestrator({
    fireResult: { fired: true, replyText: "はい" },
    drive: (hooks) => {
      hooks.onUsage({ usage: { input_tokens: 284, output_tokens: 12 }, vision: false });
    }
  });
  const server = createCockpitServer({
    fireOrchestratorFactory: /** @type {any} */ (fake.factory),
    brainStatus: /** @type {any} */ (wiring.brainStatus)
  });
  const url = await server.listen(0);
  const client = openSseClient(`${url}/api/events`);
  try {
    await client.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/fire`, {});
    const usage = await client.waitFor((e) => e.event === "usage");
    // 既存フィールドは無変更。
    assert.equal(usage.data.usage.input_tokens, 284);
    assert.equal(usage.data.vision, false);
    // brain 札が additive で乗る。
    assert.equal(usage.data.brain, "codex");
  } finally {
    client.close();
    await server.close();
  }
});

test("cockpit SSE: 自発発火の要求（fired:true）が selfFire イベントで流れる（kind 付き・タイムラインの自発発火マーカー材料）", async () => {
  const fakePipe = makeOnAppendPipeline();
  const fakeOrch = makeFakeOrchestrator({ fireResult: { fired: true, replyText: "はーい" } });
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fakePipe.factory),
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory),
    selfFireInitialEnabled: true
  });
  const url = await server.listen(0);
  const client = openSseClient(`${url}/api/events`);
  try {
    await client.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/ears/start`, { device: "Mic" });
    fakePipe.record.buffer.append({ startMs: 0, endMs: 900, text: "コーディこれ見て" });
    const evt = await client.waitFor((e) => e.event === "selfFire");
    assert.equal(evt.data.kind, "call");
    assert.equal(evt.data.fired, true);
    assert.equal(evt.data.reason, null);
  } finally {
    client.close();
    await server.close();
  }
});

test("cockpit SSE: 自発発火の要求（fired:false）が selfFire イベントで流れる（スケジューラ診断のゴースト行材料）", async () => {
  const fakePipe = makeOnAppendPipeline();
  const fakeOrch = makeFakeOrchestrator({ fireResult: { fired: false, reason: "empty-window" } });
  const server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (fakePipe.factory),
    fireOrchestratorFactory: /** @type {any} */ (fakeOrch.factory),
    selfFireInitialEnabled: true
  });
  const url = await server.listen(0);
  const client = openSseClient(`${url}/api/events`);
  try {
    await client.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/ears/start`, { device: "Mic" });
    fakePipe.record.buffer.append({ startMs: 0, endMs: 900, text: "コーディこれ見て" });
    const evt = await client.waitFor((e) => e.event === "selfFire");
    assert.equal(evt.data.kind, "call");
    assert.equal(evt.data.fired, false);
    assert.equal(evt.data.reason, "empty-window");
  } finally {
    client.close();
    await server.close();
  }
});

test("cockpit SSE: bargeIn 診断は elapsedMs/charsSpoken/totalChars/prefix を diagnostic イベントに載せる（barge-in マーカー行の材料）", async () => {
  const fake = makeFakeOrchestrator({
    fireResult: { fired: true, replyText: "こんにちは" },
    drive: (hooks) => {
      hooks.onDiagnostic({
        type: "bargeIn",
        elapsedMs: 350,
        charsSpoken: 3,
        totalChars: 10,
        prefix: "こんに"
      });
    }
  });
  const server = createCockpitServer({ fireOrchestratorFactory: /** @type {any} */ (fake.factory) });
  const url = await server.listen(0);
  const client = openSseClient(`${url}/api/events`);
  try {
    await client.waitFor((e) => e.event === "state");
    await postJson(`${url}/api/fire`, {});
    const diag = await client.waitFor((e) => e.event === "diagnostic" && e.data.type === "bargeIn");
    assert.equal(diag.data.elapsedMs, 350);
    assert.equal(diag.data.charsSpoken, 3);
    assert.equal(diag.data.totalChars, 10);
    assert.equal(diag.data.prefix, "こんに");
  } finally {
    client.close();
    await server.close();
  }
});
