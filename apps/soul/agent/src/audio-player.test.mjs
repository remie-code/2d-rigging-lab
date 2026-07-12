// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createAudioPlayer, writeTempWav } from "./audio-player.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ECHO_PLAYER = path.join(here, "test-support", "echo-player.mjs");

/** 無音エコープロセスを注入した player を作る（PowerShell の代役）。 */
function makeEchoPlayer(onOutput) {
  return createAudioPlayer({
    command: process.execPath,
    args: [ECHO_PLAYER],
    onOutput
  });
}

test("writeTempWav は WAV を temp に書き出しバイト一致・.wav 拡張子", () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const wavPath = writeTempWav(bytes);
  assert.ok(existsSync(wavPath));
  assert.ok(wavPath.endsWith(".wav"));
  assert.deepEqual([...readFileSync(wavPath)], [1, 2, 3, 4, 5]);
});

test("writeTempWav は Uint8Array 以外で TypeError", () => {
  assert.throws(() => writeTempWav([1, 2, 3]), TypeError);
});

test("play の指示は子プロセスへ往復する（stdin パス → stdout エコー・無音）", async () => {
  const outputs = [];
  let resolveLine;
  const gotLine = new Promise((resolve) => {
    resolveLine = resolve;
  });
  const player = makeEchoPlayer((line) => {
    outputs.push(line);
    resolveLine();
  });
  try {
    player.play("C:/tmp/utterance-1.wav");
    await withTimeout(gotLine, 4000, "echo line");
    assert.deepEqual(outputs, ["played:C:/tmp/utterance-1.wav"]);
  } finally {
    player.dispose();
  }
});

test("複数 play は順に往復する（常駐 1 プロセスで連続指示）", async () => {
  const outputs = [];
  let resolveAll;
  const gotAll = new Promise((resolve) => {
    resolveAll = resolve;
  });
  const player = makeEchoPlayer((line) => {
    outputs.push(line);
    if (outputs.length === 3) {
      resolveAll();
    }
  });
  try {
    player.play("a.wav");
    player.play("b.wav");
    player.play("c.wav");
    await withTimeout(gotAll, 4000, "3 echo lines");
    assert.deepEqual(outputs, ["played:a.wav", "played:b.wav", "played:c.wav"]);
  } finally {
    player.dispose();
  }
});

test("play は改行を除去して 1 行プロトコルを守る", async () => {
  const outputs = [];
  let resolveLine;
  const gotLine = new Promise((resolve) => {
    resolveLine = resolve;
  });
  const player = makeEchoPlayer((line) => {
    outputs.push(line);
    resolveLine();
  });
  try {
    player.play("has\nnewline.wav");
    await withTimeout(gotLine, 4000, "echo line");
    // 改行が除去され 1 行に畳まれている。
    assert.deepEqual(outputs, ["played:hasnewline.wav"]);
  } finally {
    player.dispose();
  }
});

test("dispose 後の play は throw", async () => {
  const player = makeEchoPlayer(() => {});
  player.dispose();
  assert.throws(() => player.play("x.wav"), /disposed/);
});

test("play は空文字で TypeError", () => {
  const player = makeEchoPlayer(() => {});
  try {
    assert.throws(() => player.play(""), TypeError);
  } finally {
    player.dispose();
  }
});

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
