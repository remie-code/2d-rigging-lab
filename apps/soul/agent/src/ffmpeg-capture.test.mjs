// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createFfmpegCapture,
  buildFfmpegArgs,
  resolveFfmpegPath
} from "./ffmpeg-capture.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const FAKE_FFMPEG = path.join(here, "test-support", "fake-ffmpeg.mjs");

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ── 純関数: 引数組み立て・パス解決 ──────────────────────────────────────

test("buildFfmpegArgs: 16kHz mono s16le を pipe:1 へ", () => {
  const args = buildFfmpegArgs({ inputFormat: "dshow", device: 'audio=Mic', sampleRate: 16000, channels: 1 });
  const joined = args.join(" ");
  assert.ok(joined.includes("-f dshow"));
  assert.ok(joined.includes("-i audio=Mic"));
  assert.ok(joined.includes("-ar 16000"));
  assert.ok(joined.includes("-ac 1"));
  assert.ok(joined.includes("pcm_s16le"));
  assert.ok(joined.includes("-f s16le"));
  assert.ok(args[args.length - 1] === "pipe:1");
});

test("buildFfmpegArgs: inputFormat 空なら -f 入力指定を付けない", () => {
  const args = buildFfmpegArgs({ inputFormat: "", device: undefined });
  // 入力側 -f は無いが、出力側 -f s16le は残る。
  const fIndexes = args.map((a, i) => (a === "-f" ? i : -1)).filter((i) => i >= 0);
  assert.equal(fIndexes.length, 1);
  assert.equal(args[fIndexes[0] + 1], "s16le");
});

test("resolveFfmpegPath: option > env > 既定 ffmpeg", () => {
  assert.equal(resolveFfmpegPath("C:/tools/ffmpeg.exe", {}), "C:/tools/ffmpeg.exe");
  assert.equal(resolveFfmpegPath(undefined, { FFMPEG_PATH: "D:/x/ffmpeg.exe" }), "D:/x/ffmpeg.exe");
  assert.equal(resolveFfmpegPath(undefined, {}), "ffmpeg");
});

// ── 常駐: 合成 PCM 往復（実 ffmpeg・実マイク不要）────────────────────────

test("stdout の合成 PCM が onPcm に往復する（ダミー子プロセス注入）", async () => {
  let total = 0;
  /** @type {number[]} */
  const firstBytes = [];
  let resolveEnough;
  const gotEnough = new Promise((resolve) => {
    resolveEnough = resolve;
  });
  const capture = createFfmpegCapture({
    ffmpegPath: process.execPath,
    args: [FAKE_FFMPEG, "--bytes", "2048", "--stay"],
    onPcm: (chunk) => {
      for (let i = 0; i < chunk.length && firstBytes.length < 4; i += 1) firstBytes.push(chunk[i]);
      total += chunk.length;
      if (total >= 2048) resolveEnough();
    }
  });
  try {
    await withTimeout(gotEnough, 8000, "2048 PCM bytes");
    assert.ok(total >= 2048);
    assert.deepEqual(firstBytes, [0, 1, 2, 3]); // fake の増加パターン
  } finally {
    capture.dispose();
  }
});

test("異常終了で再起動し、maxRestarts で打ち切る", async () => {
  const exits = [];
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });
  let totalBytes = 0;
  const capture = createFfmpegCapture({
    ffmpegPath: process.execPath,
    args: [FAKE_FFMPEG, "--bytes", "16", "--exit", "1"], // 16 byte 書いて即異常終了
    maxRestarts: 3,
    restartDelayMs: 5,
    restartResetMs: 1e9, // このテスト中は予算リセットさせない
    onPcm: (chunk) => {
      totalBytes += chunk.length;
    },
    onExit: (info) => {
      exits.push(info);
      if (!info.willRestart) resolveDone();
    }
  });
  try {
    await withTimeout(done, 15000, "restart exhaustion");
    // 初回 + 3 再起動 = 4 回 exit。最後は willRestart:false で打ち切り。
    assert.equal(exits.length, 4);
    assert.deepEqual(exits.map((e) => e.willRestart), [true, true, true, false]);
    assert.equal(capture.restartCount(), 3);
    assert.equal(totalBytes, 64); // 4 spawn * 16 byte
  } finally {
    capture.dispose();
  }
});

test("dispose は --stay 子プロセスを畳み、以後 exit コールバックは来ない（冪等）", async () => {
  let exitCalls = 0;
  const capture = createFfmpegCapture({
    ffmpegPath: process.execPath,
    args: [FAKE_FFMPEG, "--bytes", "8", "--stay"],
    onExit: () => {
      exitCalls += 1;
    }
  });
  const child = capture.currentChild();
  assert.ok(child); // spawn 済み
  // 少し待って子が立ち上がってから dispose。
  await new Promise((r) => setTimeout(r, 100));
  capture.dispose();
  assert.equal(capture.isDisposed(), true);
  capture.dispose(); // 冪等（二重 dispose で throw しない）
  // dispose 後は再起動しない・exit コールバックは disposed 早期 return で来ない。
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(exitCalls, 0);
  assert.equal(capture.restartCount(), 0);
});

test("stderr の行が onError に流れる", async () => {
  const errors = [];
  let resolveErr;
  const gotErr = new Promise((resolve) => {
    resolveErr = resolve;
  });
  const capture = createFfmpegCapture({
    ffmpegPath: process.execPath,
    args: [FAKE_FFMPEG, "--bytes", "8", "--stderr", "device warn", "--stay"],
    onError: (line) => {
      errors.push(line);
      resolveErr();
    }
  });
  try {
    await withTimeout(gotErr, 8000, "stderr line");
    assert.ok(errors.includes("device warn"));
  } finally {
    capture.dispose();
  }
});
