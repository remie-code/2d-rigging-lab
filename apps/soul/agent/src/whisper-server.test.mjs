// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createWhisperServer,
  buildWhisperServerArgs,
  resolveWhisperServerPath,
  resolveWhisperModelPath,
  DEFAULT_WHISPER_PORT,
  DEFAULT_WHISPER_HOST,
  DEFAULT_WHISPER_LANGUAGE,
  DEFAULT_WHISPER_SERVER_PATH,
  DEFAULT_WHISPER_MODEL_PATH
} from "./whisper-server.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
// 実 whisper-server の代役 = 合成バイトを吐いて居座る/即死するダミー子プロセス（Domain A の型を再利用）。
const FAKE_CHILD = path.join(here, "test-support", "fake-ffmpeg.mjs");

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ── 純関数: 引数組み立て・パス解決 ──────────────────────────────────────

test("buildWhisperServerArgs: モデル・host・port・言語(既定 ja)が並ぶ", () => {
  const args = buildWhisperServerArgs({ modelPath: "C:/m/kotoba.bin" });
  const joined = args.join(" ");
  assert.ok(joined.includes("-m C:/m/kotoba.bin"));
  assert.ok(joined.includes(`--host ${DEFAULT_WHISPER_HOST}`));
  assert.ok(joined.includes(`--port ${DEFAULT_WHISPER_PORT}`));
  assert.ok(joined.includes(`-l ${DEFAULT_WHISPER_LANGUAGE}`));
});

test("buildWhisperServerArgs: port/threads/extraArgs/language を上書きできる", () => {
  const args = buildWhisperServerArgs({
    modelPath: "m.bin",
    host: "0.0.0.0",
    port: 9000,
    language: "auto",
    threads: 8,
    extraArgs: ["--no-gpu"]
  });
  const joined = args.join(" ");
  assert.ok(joined.includes("--host 0.0.0.0"));
  assert.ok(joined.includes("--port 9000"));
  assert.ok(joined.includes("-l auto"));
  assert.ok(joined.includes("-t 8"));
  assert.equal(args[args.length - 1], "--no-gpu");
});

test("buildWhisperServerArgs: 既定出力に -nfa が含まれる（flash-attn は既定 OFF）", () => {
  const args = buildWhisperServerArgs({ modelPath: "m.bin" });
  assert.ok(args.includes("-nfa"), `expected -nfa in ${JSON.stringify(args)}`);
});

test("buildWhisperServerArgs: flashAttn:true（抑止オプション）で -nfa が出ない", () => {
  const args = buildWhisperServerArgs({ modelPath: "m.bin", flashAttn: true });
  assert.ok(!args.includes("-nfa"), `expected no -nfa in ${JSON.stringify(args)}`);
});

test("buildWhisperServerArgs: language 空文字なら -l を付けない・不正値は throw", () => {
  const args = buildWhisperServerArgs({ modelPath: "m.bin", language: "" });
  assert.ok(!args.includes("-l"));
  assert.throws(() => buildWhisperServerArgs({ modelPath: "" }), TypeError);
  assert.throws(() => buildWhisperServerArgs({ modelPath: "m.bin", port: 0 }), RangeError);
  assert.throws(() => buildWhisperServerArgs({ modelPath: "m.bin", port: 70000 }), RangeError);
  assert.throws(() => buildWhisperServerArgs({ modelPath: "m.bin", threads: -1 }), RangeError);
});

test("resolveWhisperServerPath / resolveWhisperModelPath: option > env > vendor 既定", () => {
  assert.equal(resolveWhisperServerPath("C:/x/server.exe", {}), "C:/x/server.exe");
  assert.equal(
    resolveWhisperServerPath(undefined, { WHISPER_SERVER_PATH: "D:/w/server.exe" }),
    "D:/w/server.exe"
  );
  assert.equal(resolveWhisperServerPath(undefined, {}), DEFAULT_WHISPER_SERVER_PATH);
  assert.ok(DEFAULT_WHISPER_SERVER_PATH.endsWith(path.join("vendor", "whisper", "whisper-server.exe")));

  assert.equal(resolveWhisperModelPath("C:/x/m.bin", {}), "C:/x/m.bin");
  assert.equal(resolveWhisperModelPath(undefined, { WHISPER_MODEL_PATH: "D:/m.bin" }), "D:/m.bin");
  assert.equal(resolveWhisperModelPath(undefined, {}), DEFAULT_WHISPER_MODEL_PATH);
  assert.ok(
    DEFAULT_WHISPER_MODEL_PATH.endsWith(
      path.join("vendor", "models", "ggml-kotoba-whisper-v2.0-q5_0.bin")
    )
  );
});

// ── ライフサイクル: 起動 → ヘルスチェック → dispose（実機非依存）─────────────

test("ready: HTTP が応答し始めたら解決する（接続拒否 N 回 → 応答）", async () => {
  let fetchCalls = 0;
  const server = createWhisperServer({
    serverPath: process.execPath,
    args: [FAKE_CHILD, "--bytes", "0", "--stay"],
    pollIntervalMs: 1,
    fetchImpl: /** @type {any} */ (
      async () => {
        fetchCalls += 1;
        if (fetchCalls < 3) {
          throw new Error("ECONNREFUSED"); // まだ listen していない
        }
        return { ok: false, status: 404 }; // 404 でも「HTTP 応答あり = listen 済み」
      }
    )
  });
  try {
    await withTimeout(server.ready, 8000, "ready");
    assert.ok(fetchCalls >= 3);
    assert.equal(server.isDisposed(), false);
    assert.equal(server.baseUrl, `http://${DEFAULT_WHISPER_HOST}:${DEFAULT_WHISPER_PORT}`);
  } finally {
    server.dispose();
  }
});

test("ready: 子プロセスが ready 前に死んだら reject する（モデルパス不正等の早期失敗）", async () => {
  const server = createWhisperServer({
    serverPath: process.execPath,
    args: [FAKE_CHILD, "--bytes", "0", "--exit", "3"], // 即異常終了
    pollIntervalMs: 1,
    fetchImpl: /** @type {any} */ (
      async () => {
        throw new Error("ECONNREFUSED");
      }
    )
  });
  try {
    await withTimeout(
      assert.rejects(server.ready, /exited before ready \(code 3/),
      8000,
      "early-exit rejection"
    );
    assert.equal(server.hasExited(), true);
  } finally {
    server.dispose();
  }
});

test("ready: readyTimeoutMs 超過で reject する（実時間を待たない注入時計）", async () => {
  let clock = 0;
  const server = createWhisperServer({
    serverPath: process.execPath,
    args: [FAKE_CHILD, "--bytes", "0", "--stay"],
    readyTimeoutMs: 100,
    pollIntervalMs: 1,
    nowImpl: () => {
      clock += 40; // 呼ばれるたびに 40ms 進む偽時計 → 数イテレーションで期限超過
      return clock;
    },
    fetchImpl: /** @type {any} */ (
      async () => {
        throw new Error("ECONNREFUSED"); // 永遠に listen しない
      }
    )
  });
  try {
    await withTimeout(
      assert.rejects(server.ready, /not ready within 100ms/),
      8000,
      "ready timeout rejection"
    );
  } finally {
    server.dispose();
  }
});

test("dispose: ポーリング中の dispose で ready は reject し、孤児を残さず冪等", async () => {
  const server = createWhisperServer({
    serverPath: process.execPath,
    args: [FAKE_CHILD, "--bytes", "0", "--stay"],
    pollIntervalMs: 1,
    fetchImpl: /** @type {any} */ (
      async () => {
        throw new Error("ECONNREFUSED");
      }
    )
  });
  const child = server.currentChild();
  assert.ok(child); // spawn 済み
  // 子が立ち上がる猶予を少し置いてから畳む。
  await new Promise((r) => setTimeout(r, 100));
  server.dispose();
  assert.equal(server.isDisposed(), true);
  server.dispose(); // 冪等（二重 dispose で throw しない）
  await withTimeout(
    assert.rejects(server.ready, /disposed before ready/),
    8000,
    "disposed rejection"
  );
  // kill された子の終了を裏取り（孤児なし）。
  await withTimeout(
    new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve(undefined);
        return;
      }
      child.on("exit", () => resolve(undefined));
    }),
    8000,
    "child reaped"
  );
});

test("ready 後の dispose: 子プロセスが畳まれ exit 通知は disposed 後に来ない", async () => {
  let exitInfo = null;
  const server = createWhisperServer({
    serverPath: process.execPath,
    args: [FAKE_CHILD, "--bytes", "0", "--stay"],
    pollIntervalMs: 1,
    fetchImpl: /** @type {any} */ (async () => ({ ok: true, status: 200 })),
    onExit: (info) => {
      exitInfo = info;
    }
  });
  const child = server.currentChild();
  try {
    await withTimeout(server.ready, 8000, "ready");
  } finally {
    server.dispose();
  }
  await withTimeout(
    new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve(undefined);
        return;
      }
      child.on("exit", () => resolve(undefined));
    }),
    8000,
    "child reaped after dispose"
  );
  // dispose 起因の exit は onExit に通知されない（disposed 早期 return）。
  assert.equal(exitInfo, null);
});

test("onExit 正経路: ready 後の非 dispose 死で onExit が発火する（S2 Domain C・note 3 回収）", async () => {
  /** @type {any} */
  let exitInfo = null;
  let resolveExit;
  const exited = new Promise((resolve) => {
    resolveExit = resolve;
  });
  const server = createWhisperServer({
    serverPath: process.execPath,
    args: [FAKE_CHILD, "--bytes", "0", "--stay"],
    pollIntervalMs: 1,
    fetchImpl: /** @type {any} */ (async () => ({ ok: true, status: 200 })),
    onExit: (info) => {
      exitInfo = info;
      resolveExit();
    }
  });
  try {
    await withTimeout(server.ready, 8000, "ready");
    // dispose を経由しない死（クラッシュ相当）: 子を直接 kill する。
    server.currentChild().kill();
    await withTimeout(exited, 8000, "onExit fired");
    assert.ok(exitInfo, "onExit が届く");
    // Windows の kill() は TerminateProcess（code 1）、POSIX は SIGTERM。どちらかで死んだことを固定。
    assert.ok(exitInfo.code !== null || exitInfo.signal !== null);
    assert.equal(server.hasExited(), true);
    assert.equal(server.isDisposed(), false, "dispose していないのに死を観測できる");
  } finally {
    server.dispose();
  }
});

test("stderr/stdout 行が onStderr/onStdout に流れる（ログ消費経路）", async () => {
  /** @type {string[]} */
  const stderrLines = [];
  let resolveGot;
  const got = new Promise((resolve) => {
    resolveGot = resolve;
  });
  const server = createWhisperServer({
    serverPath: process.execPath,
    args: [FAKE_CHILD, "--bytes", "0", "--stderr", "whisper_model_load: loading model", "--stay"],
    pollIntervalMs: 1,
    fetchImpl: /** @type {any} */ (async () => ({ ok: true, status: 200 })),
    onStderr: (line) => {
      stderrLines.push(line);
      resolveGot();
    }
  });
  try {
    await withTimeout(got, 8000, "stderr line");
    assert.ok(stderrLines.includes("whisper_model_load: loading model"));
  } finally {
    server.dispose();
  }
});
