// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createLocalSttClient, DEFAULT_LOCAL_STT_WORKER_PATH } from "./local-stt-client.mjs";
import { encodeWav } from "../../voice/wav-encode.mjs";

// 親から子プロセスを扱う係の機械テスト。(1) 偽物の fork（EventEmitter）で IPC・ready・異常終了・dispose を、
// (2) 本物の fork + 偽物の子プロセス（test-support/fake-local-stt-worker.mjs）で IPC の往復と落ちたときの検知を固定する。
// 本物の sherpa-onnx-node は読まない。

const FAKE_WORKER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "test-support",
  "fake-local-stt-worker.mjs"
);

/** 偽物の fork（子へ送ったものを記録し、テストから子のふるまいを起こす）。 */
function makeFakeFork() {
  const rec = {
    /** @type {any[]} */ calls: [],
    /** @type {any[]} */ sent: [],
    killed: 0,
    disconnected: 0,
    unrefed: 0,
    /** @type {any} */ child: null
  };
  const forkImpl = (/** @type {string} */ modulePath, /** @type {string[]} */ args, /** @type {any} */ opts) => {
    rec.calls.push({ modulePath, args, opts });
    const child = /** @type {any} */ (new EventEmitter());
    child.stdout = null;
    child.stderr = null;
    child.connected = true;
    child.send = (/** @type {any} */ m) => {
      rec.sent.push(m);
      return true;
    };
    child.kill = () => {
      rec.killed += 1;
    };
    child.disconnect = () => {
      rec.disconnected += 1;
      child.connected = false;
    };
    child.unref = () => {
      rec.unrefed += 1;
    };
    rec.child = child;
    return child;
  };
  return { forkImpl: /** @type {any} */ (forkImpl), rec };
}

const wav16k = (/** @type {number} */ n) => encodeWav(new Int16Array(n).fill(7), { sampleRate: 16000, channels: 1, bitsPerSample: 16 });

test("local-stt-client: fork の形（入口・advanced serialization・ipc）と init（engine・モデルのファイル・スレッド・hotwords）", async () => {
  const f = makeFakeFork();
  const client = createLocalSttClient({ engine: "zipformer", modelsDir: "/models", threads: 2, hotwords: ["チャッピー"], hotwordsScore: 2.5, forkImpl: f.forkImpl });
  try {
    assert.equal(f.rec.calls.length, 1);
    assert.equal(f.rec.calls[0].modulePath, DEFAULT_LOCAL_STT_WORKER_PATH);
    assert.equal(path.basename(DEFAULT_LOCAL_STT_WORKER_PATH), "local-stt-worker.mjs");
    assert.equal(f.rec.calls[0].opts.serialization, "advanced");
    assert.deepEqual(f.rec.calls[0].opts.stdio, ["ignore", "pipe", "pipe", "ipc"]);
    assert.deepEqual(f.rec.calls[0].opts.execArgv, []);
    const init = f.rec.sent[0];
    assert.equal(init.type, "init");
    assert.equal(init.engine, "zipformer");
    assert.equal(init.threads, 2);
    assert.deepEqual(init.hotwords, ["チャッピー"]);
    assert.equal(init.hotwordsScore, 2.5);
    assert.equal(init.files.encoder, path.join("/models", "zipformer-ja-reazonspeech-2024-08-01-int8", "encoder-epoch-99-avg-1.int8.onnx"));
  } finally {
    client.dispose();
  }
});

test("local-stt-client: ready（読み込み時間）→ transcribe は Int16Array を送り、id で応答を突き合わせる（順不同でもよい）", async () => {
  const f = makeFakeFork();
  /** @type {any[]} */
  const readies = [];
  const client = createLocalSttClient({ engine: "parakeet", threads: 2, forkImpl: f.forkImpl, onReady: (i) => readies.push(i) });
  try {
    // ready 前の転写は失敗。
    await assert.rejects(client.transcribe(wav16k(10)), /not ready/);
    f.rec.child.emit("message", { type: "ready", loadMs: 1234, decodingMethod: "greedy_search", hotwordsUsed: [], hotwordsDropped: [] });
    const info = await client.ready;
    assert.equal(info.loadMs, 1234);
    assert.equal(readies.length, 1);

    const p1 = client.transcribe(wav16k(100));
    const p2 = client.transcribe(wav16k(200));
    const [r1, r2] = f.rec.sent.slice(1);
    assert.equal(r1.type, "transcribe");
    assert.ok(r1.pcm instanceof Int16Array);
    assert.equal(r1.pcm.length, 100);
    assert.equal(r1.pcm[0], 7);
    assert.equal(r2.pcm.length, 200);
    assert.notEqual(r1.id, r2.id);
    assert.equal(client.pending(), 2);
    // 後の要求から先に返ってきても取り違えない。
    f.rec.child.emit("message", { type: "result", id: r2.id, text: " 二つ目 ", ms: 30 });
    f.rec.child.emit("message", { type: "result", id: r1.id, text: "一つ目", ms: 20 });
    assert.deepEqual(await p1, { text: "一つ目", rawText: "一つ目", ms: 20 });
    assert.deepEqual(await p2, { text: "二つ目", rawText: " 二つ目 ", ms: 30 });
    // 1 発話の失敗。
    const p3 = client.transcribe(wav16k(5));
    f.rec.child.emit("message", { type: "error", id: f.rec.sent[3].id, message: "decode failed" });
    await assert.rejects(p3, /decode failed/);
    // 16kHz mono 以外の WAV は送らずに失敗。
    await assert.rejects(client.transcribe(encodeWav(new Int16Array(4), { sampleRate: 8000 })), /16kHz mono/);
    assert.equal(f.rec.sent.length, 4);
  } finally {
    client.dispose();
  }
});

test("local-stt-client: ready 前の fatal / 終了は ready の reject（onExit は呼ばない）", async () => {
  const f = makeFakeFork();
  let exits = 0;
  const client = createLocalSttClient({ engine: "zipformer", threads: 2, forkImpl: f.forkImpl, onExit: () => (exits += 1) });
  f.rec.child.emit("message", { type: "fatal", message: "bad model" });
  await assert.rejects(client.ready, /failed to load: bad model/);
  f.rec.child.emit("exit", 1, null);
  assert.equal(exits, 0);
  assert.equal(client.hasExited(), true);
  client.dispose();

  const g = makeFakeFork();
  const c2 = createLocalSttClient({ engine: "parakeet", threads: 2, forkImpl: g.forkImpl, onExit: () => (exits += 1) });
  g.rec.child.emit("exit", null, "SIGKILL");
  await assert.rejects(c2.ready, /exited \(code null, signal SIGKILL\)/);
  assert.equal(exits, 0);
  c2.dispose();
});

test("local-stt-client: ready 後に落ちたら onExit・応答待ちは全部 reject・以後の転写も失敗", async () => {
  const f = makeFakeFork();
  /** @type {any[]} */
  const exits = [];
  const client = createLocalSttClient({ engine: "zipformer", threads: 2, forkImpl: f.forkImpl, onExit: (i) => exits.push(i) });
  f.rec.child.emit("message", { type: "ready", loadMs: 1 });
  await client.ready;
  const p = client.transcribe(wav16k(10));
  f.rec.child.emit("exit", 3, null);
  await assert.rejects(p, /process exited \(code 3/);
  assert.deepEqual(exits, [{ code: 3, signal: null }]);
  await assert.rejects(client.transcribe(wav16k(10)), /not running/);
  assert.equal(client.pending(), 0);
  client.dispose();
});

test("local-stt-client: dispose は応答待ちを reject → kill → IPC を切る → unref（冪等・onExit は呼ばない）", async () => {
  const f = makeFakeFork();
  let exits = 0;
  const client = createLocalSttClient({ engine: "zipformer", threads: 2, forkImpl: f.forkImpl, onExit: () => (exits += 1) });
  f.rec.child.emit("message", { type: "ready", loadMs: 1 });
  await client.ready;
  const p = client.transcribe(wav16k(10));
  client.dispose();
  client.dispose();
  await assert.rejects(p, /disposed/);
  assert.equal(f.rec.killed, 1);
  assert.equal(f.rec.disconnected, 1);
  assert.equal(f.rec.unrefed, 1);
  f.rec.child.emit("exit", null, "SIGTERM"); // kill の結果の exit
  assert.equal(exits, 0);
  assert.equal(client.isDisposed(), true);
  await assert.rejects(client.transcribe(wav16k(10)), /disposed/);
});

test("local-stt-client: ready が来なければ readyTimeoutMs で reject して子を畳む", async () => {
  const f = makeFakeFork();
  /** @type {Array<() => void>} */
  const timers = [];
  const client = createLocalSttClient({
    engine: "zipformer",
    threads: 2,
    forkImpl: f.forkImpl,
    readyTimeoutMs: 50,
    setTimeoutImpl: /** @type {any} */ ((/** @type {() => void} */ fn) => {
      timers.push(fn);
      return timers.length;
    }),
    clearTimeoutImpl: /** @type {any} */ (() => {})
  });
  timers[0]();
  await assert.rejects(client.ready, /not ready within 50ms/);
  assert.equal(f.rec.killed, 1);
  client.dispose();
});

// ── 本物の fork + 偽物の子プロセス ─────────────────────────────────────

test("local-stt-client（本物の fork）: ready → 転写の往復（Int16Array が IPC を越える）→ dispose で子が終わる", { timeout: 20000 }, async () => {
  const client = createLocalSttClient({ engine: "zipformer", threads: 2, hotwords: ["チャッピー"], workerPath: FAKE_WORKER, workerArgs: ["ok"] });
  try {
    const info = await client.ready;
    assert.equal(info.loadMs, 5);
    assert.equal(info.decodingMethod, "modified_beam_search");
    assert.deepEqual(info.hotwordsUsed, ["チャッピー"]);
    const r = await client.transcribe(wav16k(321));
    assert.deepEqual(r, { text: "n=321", rawText: " n=321 ", ms: 1 });
  } finally {
    client.dispose();
  }
  assert.equal(client.isDisposed(), true);
});

test("local-stt-client（本物の fork）: 子が落ちたら応答待ちは失敗・onExit に終了コード", { timeout: 20000 }, async () => {
  /** @type {any[]} */
  const exits = [];
  const client = createLocalSttClient({
    engine: "parakeet",
    threads: 2,
    workerPath: FAKE_WORKER,
    workerArgs: ["crash-on-transcribe"],
    onExit: (i) => exits.push(i)
  });
  try {
    await client.ready;
    await assert.rejects(client.transcribe(wav16k(10)), /process exited \(code 3/);
    assert.deepEqual(exits, [{ code: 3, signal: null }]);
  } finally {
    client.dispose();
  }
});

test("local-stt-client（本物の fork）: 読み込みの失敗（fatal）は ready の reject", { timeout: 20000 }, async () => {
  const client = createLocalSttClient({ engine: "zipformer", threads: 2, workerPath: FAKE_WORKER, workerArgs: ["fatal"] });
  try {
    await assert.rejects(client.ready, /fake model load failure/);
  } finally {
    client.dispose();
  }
});
