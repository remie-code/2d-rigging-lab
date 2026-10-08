// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

import {
  createAudioPlayer,
  writeTempWav,
  writeOwnedTempWav,
  parseListDevicesStdout,
  listAudioDevices
} from "./audio-player.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
// S6: プロトコルが「生パス 1 行」→「PLAY/STOP + 状態応答行」に変わったため（wave-plan §3 Domain A の
// 意図的変更）、無音の代役プロセスも新プロトコルを喋る fake-media-player.mjs に差し替える。
const FAKE_MEDIA_PLAYER = path.join(here, "..", "test-support", "fake-media-player.mjs");

/** 無音の疑似 MediaPlayer プロセスを注入した player を作る（PowerShell WinRT の代役）。 */
function makeFakePlayer(onOutput, extra = {}) {
  return createAudioPlayer({
    command: process.execPath,
    args: [FAKE_MEDIA_PLAYER],
    onOutput,
    ...extra
  });
}

/** onOutput 行が cond を満たすまで待つ小道具（実プロセス往復の非同期を吸収）。 */
function collectUntil(cond, timeoutMs = 4000) {
  const lines = [];
  let resolveFn;
  let timer;
  const done = new Promise((resolve, reject) => {
    resolveFn = resolve;
    timer = setTimeout(() => reject(new Error(`timed out; got ${JSON.stringify(lines)}`)), timeoutMs);
  }).finally(() => clearTimeout(timer));
  const onOutput = (line) => {
    lines.push(line);
    if (cond(lines)) resolveFn();
  };
  return { onOutput, lines, done };
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

test("writeOwnedTempWav は owned WAV+directory を exact once cleanup し custom parent は削除しない", () => {
  const owned = writeOwnedTempWav(new Uint8Array([1, 2, 3]));
  assert.equal(existsSync(owned.wavPath), true);
  assert.equal(existsSync(owned.ownedDirectory), true);
  assert.equal(owned.cleanup(), true);
  assert.equal(owned.cleanup(), false);
  assert.equal(existsSync(owned.wavPath), false);
  assert.equal(existsSync(owned.ownedDirectory), false);

  const customDirectory = mkdtempSync(path.join(tmpdir(), "soul-agent-custom-"));
  try {
    const custom = writeOwnedTempWav(new Uint8Array([4, 5]), { dir: customDirectory });
    assert.equal(custom.ownedDirectory, null);
    custom.cleanup();
    assert.equal(existsSync(custom.wavPath), false);
    assert.equal(existsSync(customDirectory), true);
  } finally {
    rmSync(customDirectory, { recursive: true, force: true });
  }
});

test("playbackId 指定は PLAYID と generation-qualified marker を使い legacy PLAY は不変", () => {
  const commands = [];
  const lines = [];
  const fakeChild = makeFakeChild();
  fakeChild.stdin.write = (command) => { commands.push(command); return true; };
  const player = createAudioPlayer({ spawnImpl: () => fakeChild, onOutput: (line) => lines.push(line) });
  try {
    player.play("same.wav", "generation-2:job-1");
    player.play("legacy.wav");
    assert.deepEqual(commands, [
      "PLAYID\tgeneration-2:job-1\tsame.wav\n",
      "PLAY legacy.wav\n"
    ]);
    fakeChild.stdout.emit("data", "STARTED\tgeneration-2:job-1\tsame.wav\n");
    assert.deepEqual(lines, ["STARTED\tgeneration-2:job-1\tsame.wav"]);
  } finally {
    player.dispose();
  }
});

test("play は PLAY 行を送り STARTED を受け取る（往復・無音）", async () => {
  const { onOutput, lines, done } = collectUntil((ls) => ls.length >= 1);
  const player = makeFakePlayer(onOutput);
  try {
    player.play("C:/tmp/utterance-1.wav");
    await done;
    assert.deepEqual(lines, ["STARTED\tC:/tmp/utterance-1.wav"]);
  } finally {
    player.dispose();
  }
});

test("複数 play は順に往復する（常駐 1 プロセスで連続指示・Source 差し替え）", async () => {
  const { onOutput, lines, done } = collectUntil((ls) => ls.length >= 3);
  const player = makeFakePlayer(onOutput);
  try {
    player.play("a.wav");
    player.play("b.wav");
    player.play("c.wav");
    await done;
    assert.deepEqual(lines, ["STARTED\ta.wav", "STARTED\tb.wav", "STARTED\tc.wav"]);
  } finally {
    player.dispose();
  }
});

test("play は改行を除去して 1 行プロトコルを守る", async () => {
  const { onOutput, lines, done } = collectUntil((ls) => ls.length >= 1);
  const player = makeFakePlayer(onOutput);
  try {
    player.play("has\nnewline.wav");
    await done;
    // 改行が除去され 1 行に畳まれている（PLAY 行が 1 本のまま届く）。
    assert.deepEqual(lines, ["STARTED\thasnewline.wav"]);
  } finally {
    player.dispose();
  }
});

test("stop は STOP 行を送り STOPPED を受け取る（barge-in の途中停止）", async () => {
  const { onOutput, lines, done } = collectUntil(
    (ls) => ls.some((l) => l.startsWith("STOPPED")),
    4000
  );
  const player = makeFakePlayer(onOutput);
  try {
    player.play("x.wav");
    player.stop();
    await done;
    assert.deepEqual(lines, ["STARTED\tx.wav", "STOPPED\tx.wav"]);
  } finally {
    player.dispose();
  }
});

test("isPlaying は STARTED で true・ENDED で false（再生実区間の粗い問い合わせ口）", async () => {
  const player = makeFakePlayer(() => {});
  try {
    assert.equal(player.isPlaying(), false); // 開始前
    player.play("y.wav");
    await waitFor(() => player.isPlaying() === true, 4000); // STARTED 後
    assert.equal(player.isPlaying(), true);
    // 自然完了（fake は END トリガで ENDED を返す）を送り、false に戻ることを確認。
    player.child.stdin.write("END\n");
    await waitFor(() => player.isPlaying() === false, 4000);
    assert.equal(player.isPlaying(), false);
  } finally {
    player.dispose();
  }
});

test("isPlaying は STOPPED でも false（途中停止後は再生していない）", async () => {
  const player = makeFakePlayer(() => {});
  try {
    player.play("z.wav");
    await waitFor(() => player.isPlaying() === true, 4000);
    player.stop();
    await waitFor(() => player.isPlaying() === false, 4000);
    assert.equal(player.isPlaying(), false);
  } finally {
    player.dispose();
  }
});

test("deviceName は env SOUL_AUDIO_DEVICE_NAME で子プロセスへ渡る（出力デバイス指定）", async () => {
  // fake-media-player は起動時 env のデバイス名を DEVICE 行で吐く（env 受け渡しの結合確認）。
  const { onOutput, lines, done } = collectUntil((ls) => ls.some((l) => l.startsWith("DEVICE")));
  const player = makeFakePlayer(onOutput, { deviceName: "ヘッドホン (2- Shure MV7+)" });
  try {
    await done;
    assert.ok(lines.includes("DEVICE\tヘッドホン (2- Shure MV7+)"));
  } finally {
    player.dispose();
  }
});

test("deviceName は spawnImpl に渡る env に SOUL_AUDIO_DEVICE_NAME として乗る（純部品・決定論）", () => {
  let capturedEnv = null;
  const fakeChild = makeFakeChild();
  const spawnImpl = (_cmd, _args, opts) => {
    capturedEnv = opts.env;
    return fakeChild;
  };
  const player = createAudioPlayer({
    spawnImpl,
    env: { EXISTING: "1" },
    deviceName: "スピーカー (Realtek(R) Audio)"
  });
  assert.equal(capturedEnv.SOUL_AUDIO_DEVICE_NAME, "スピーカー (Realtek(R) Audio)");
  assert.equal(capturedEnv.EXISTING, "1"); // 基底 env を壊さない。
  player.dispose();
});

test("deviceName 未指定なら env に SOUL_AUDIO_DEVICE_NAME を足さない（既定デバイス＝S1 無退行）", () => {
  let capturedEnv = null;
  const fakeChild = makeFakeChild();
  const spawnImpl = (_cmd, _args, opts) => {
    capturedEnv = opts.env;
    return fakeChild;
  };
  const player = createAudioPlayer({ spawnImpl, env: { EXISTING: "1" } });
  assert.equal("SOUL_AUDIO_DEVICE_NAME" in capturedEnv, false);
  player.dispose();
});

test("play は空文字で TypeError", () => {
  const player = makeFakePlayer(() => {});
  try {
    assert.throws(() => player.play(""), TypeError);
  } finally {
    player.dispose();
  }
});

test("dispose 後の play/stop は throw", async () => {
  const player = makeFakePlayer(() => {});
  player.dispose();
  assert.throws(() => player.play("x.wav"), /disposed/);
  assert.throws(() => player.stop(), /disposed/);
});

// ── listAudioDevices / parseListDevicesStdout（操縦席のデバイス選択 UI の純部品）─────

test("parseListDevicesStdout: 複数デバイスの JSON 配列を { id, name } 配列へ", () => {
  const stdout = JSON.stringify([
    { id: "\\\\?\\SWD#a", name: "BenQ EX2510S (NVIDIA High Definition Audio)" },
    { id: "\\\\?\\SWD#b", name: "ヘッドホン (2- Shure MV7+)" }
  ]);
  const result = parseListDevicesStdout(stdout);
  assert.deepEqual(result, {
    devices: [
      { id: "\\\\?\\SWD#a", name: "BenQ EX2510S (NVIDIA High Definition Audio)" },
      { id: "\\\\?\\SWD#b", name: "ヘッドホン (2- Shure MV7+)" }
    ]
  });
});

test("parseListDevicesStdout: 単一オブジェクト（PS5.1 ConvertTo-Json の 1 要素の癖）を配列へ正規化", () => {
  const stdout = JSON.stringify({ id: "x", name: "スピーカー (Pico Streaming Speaker)" });
  const result = parseListDevicesStdout(stdout);
  assert.deepEqual(result, { devices: [{ id: "x", name: "スピーカー (Pico Streaming Speaker)" }] });
});

test("parseListDevicesStdout: 空文字列/null は 0 件（失敗ではない）", () => {
  assert.deepEqual(parseListDevicesStdout(""), { devices: [] });
  assert.deepEqual(parseListDevicesStdout("   "), { devices: [] });
  assert.deepEqual(parseListDevicesStdout("null"), { devices: [] });
});

test("parseListDevicesStdout: 壊れ JSON は failed", () => {
  const result = parseListDevicesStdout("{not json");
  assert.ok("error" in result && result.error.kind === "failed");
});

test("parseListDevicesStdout: id/name 欠落エントリは黙って除外（成功を捏造しない側に倒す）", () => {
  const stdout = JSON.stringify([{ id: "ok", name: "good" }, { id: "no-name" }, { name: "no-id" }]);
  assert.deepEqual(parseListDevicesStdout(stdout), { devices: [{ id: "ok", name: "good" }] });
});

test("listAudioDevices: fake spawn で JSON 列挙を返す（縦の配線）", async () => {
  const spawnImpl = fakeSpawnEmitting({
    stdout: JSON.stringify([{ id: "id1", name: "dev1" }, { id: "id2", name: "dev2" }]),
    code: 0
  });
  const result = await listAudioDevices({ spawnImpl });
  assert.deepEqual(result, { devices: [{ id: "id1", name: "dev1" }, { id: "id2", name: "dev2" }] });
});

test("listAudioDevices: タイムアウトは { error: timeout }", async () => {
  // setTimeout を同期発火させてタイムアウト経路を決定論で踏む。
  const spawnImpl = fakeSpawnEmitting({ stdout: "", code: null, neverExit: true });
  const result = await listAudioDevices({
    spawnImpl,
    timeoutMs: 1234,
    setTimeoutImpl: (fn) => {
      fn();
      return 0;
    },
    clearTimeoutImpl: () => {}
  });
  assert.ok("error" in result && result.error.kind === "timeout");
});

// ── テスト小道具 ───────────────────────────────────────────────────────────

/** stdin/stdout/stderr を備えた最小の fake ChildProcess（spawn 差し替え用）。 */
function makeFakeChild() {
  const child = new EventEmitter();
  const sink = () => {
    const s = new EventEmitter();
    s.write = () => true;
    s.end = () => {};
    s.destroy = () => {};
    s.destroyed = false;
    s.setEncoding = () => s;
    return s;
  };
  child.stdin = sink();
  child.stdout = sink();
  child.stderr = sink();
  child.kill = () => {};
  child.unref = () => {};
  return child;
}

/** runPowerShellScript が使う形の fake spawn（exit code + stdout を 1 回吐く）。 */
function fakeSpawnEmitting({ stdout = "", stderr = "", code = 0, neverExit = false }) {
  return () => {
    const child = new EventEmitter();
    child.stdout = Readable.from([stdout]);
    child.stderr = Readable.from([stderr]);
    child.kill = () => {};
    child.unref = () => {};
    if (!neverExit) {
      setImmediate(() => child.emit("exit", code));
    }
    return child;
  };
}

/** cond が真になるまで小刻みにポーリングして待つ（実プロセス往復の非同期を吸収）。 */
function waitFor(cond, timeoutMs = 4000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (cond()) return resolve(undefined);
      if (Date.now() - start > timeoutMs) return reject(new Error("waitFor timed out"));
      setTimeout(tick, 20);
    };
    tick();
  });
}
