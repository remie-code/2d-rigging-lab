// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  createStreamPlayer,
  parseStreamPlayerLine,
  splitPcm,
  buildStreamPlayerScript,
  buildDefaultStreamPlayerArgs,
  STREAM_PLAYER_CSHARP_SOURCE,
  DEFAULT_MAX_DATA_BYTES
} from "./stream-player.mjs";

/**
 * 常駐プロセスの代役（spawn 差し替え用）。stdin に書かれた行を lines に溜め、stdout/exit は
 * テストが emit で起こす。実音は鳴らない。
 */
function makeFakeChild() {
  const child = new EventEmitter();
  /** @type {string[]} */
  const lines = [];
  let pending = "";
  const stream = () => {
    const s = new EventEmitter();
    s.destroyed = false;
    s.setEncoding = () => s;
    s.end = () => {
      s.ended = true;
    };
    s.destroy = () => {
      s.destroyed = true;
    };
    return s;
  };
  child.stdin = stream();
  child.stdin.write = (chunk) => {
    pending += chunk;
    let nl;
    while ((nl = pending.indexOf("\n")) >= 0) {
      lines.push(pending.slice(0, nl));
      pending = pending.slice(nl + 1);
    }
    return true;
  };
  child.stdout = stream();
  child.stderr = stream();
  child.killed = false;
  child.kill = () => {
    child.killed = true;
  };
  child.unref = () => {
    child.unrefed = true;
  };
  /** @param {string} text */
  child.out = (text) => child.stdout.emit("data", text);
  child.lines = lines;
  return child;
}

/** 偽の子プロセスを注入した player と、届いたイベントの列を作る。 */
function makePlayer(extra = {}) {
  const child = makeFakeChild();
  /** @type {any[]} */
  const events = [];
  let clock = 1000;
  const player = createStreamPlayer({
    spawnImpl: () => /** @type {any} */ (child),
    onEvent: (event) => events.push(event),
    nowImpl: () => clock++,
    ...extra
  });
  return { player, child, events };
}

/** DATA 行の base64 をつないで元の PCM に戻す。 */
function decodeDataLines(lines, id) {
  const parts = lines
    .filter((line) => line.startsWith(`DATA\t${id}\t`))
    .map((line) => Buffer.from(line.split("\t")[2], "base64"));
  return new Uint8Array(Buffer.concat(parts));
}

// ── 行プロトコル（送る側）────────────────────────────────────────────────

test("open は OPEN 行を送り、今の発話になる", () => {
  const { player, child } = makePlayer();
  try {
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    assert.deepEqual(child.lines, ["OPEN\tu-1\t24000\t1"]);
    assert.deepEqual(player.current(), { id: "u-1", started: false, endSent: false });
  } finally {
    player.dispose();
  }
});

test("write は PCM を base64 の DATA 行で送り、つなぐと元に戻る", () => {
  const { player, child } = makePlayer();
  try {
    const pcm = new Uint8Array([1, 2, 3, 4, 250, 251]);
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    assert.equal(player.write("u-1", pcm), true);
    assert.deepEqual(child.lines.slice(1), [`DATA\tu-1\t${Buffer.from(pcm).toString("base64")}`]);
  } finally {
    player.dispose();
  }
});

test("write は maxDataBytes ごとに DATA 行を分け、順に送る（1 行を大きくしすぎない）", () => {
  const { player, child } = makePlayer({ maxDataBytes: 1000 });
  try {
    const pcm = new Uint8Array(2500).map((_, i) => i % 256);
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    player.write("u-1", pcm);
    const data = child.lines.filter((line) => line.startsWith("DATA\t"));
    // 1000 は 4 の倍数なのでそのまま: 1000 + 1000 + 500。
    assert.deepEqual(
      data.map((line) => Buffer.from(line.split("\t")[2], "base64").length),
      [1000, 1000, 500]
    );
    assert.deepEqual(decodeDataLines(child.lines, "u-1"), pcm);
  } finally {
    player.dispose();
  }
});

test("既定の分割は 16KiB で、1 秒ぶんの 24kHz モノラルは 3 行に分かれる", () => {
  const { player, child } = makePlayer();
  try {
    const pcm = new Uint8Array(48000);
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    player.write("u-1", pcm);
    const data = child.lines.filter((line) => line.startsWith("DATA\t"));
    assert.equal(DEFAULT_MAX_DATA_BYTES, 16384);
    assert.equal(data.length, 3);
    for (const line of data) assert.ok(line.length < 22000, `line too long: ${line.length}`);
    assert.deepEqual(decodeDataLines(child.lines, "u-1"), pcm);
  } finally {
    player.dispose();
  }
});

test("write は subarray（byteOffset つき）でも見えている範囲だけを送る", () => {
  const { player, child } = makePlayer();
  try {
    const whole = new Uint8Array([9, 9, 1, 2, 3, 4, 9, 9]);
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    player.write("u-1", whole.subarray(2, 6));
    assert.deepEqual([...decodeDataLines(child.lines, "u-1")], [1, 2, 3, 4]);
  } finally {
    player.dispose();
  }
});

test("空の write は行を送らない", () => {
  const { player, child } = makePlayer();
  try {
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    assert.equal(player.write("u-1", new Uint8Array(0)), true);
    assert.deepEqual(child.lines, ["OPEN\tu-1\t24000\t1"]);
  } finally {
    player.dispose();
  }
});

test("end は END 行を送り、二度目は送らない", () => {
  const { player, child } = makePlayer();
  try {
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    assert.equal(player.end("u-1"), true);
    assert.equal(player.end("u-1"), false);
    assert.deepEqual(child.lines, ["OPEN\tu-1\t24000\t1", "END\tu-1"]);
    assert.equal(player.current()?.endSent, true);
  } finally {
    player.dispose();
  }
});

test("別 id の write/end・END 後の write は送らずに false（古い発話の残りを捨てる）", () => {
  const { player, child } = makePlayer();
  try {
    assert.equal(player.write("u-0", new Uint8Array([1, 2])), false); // open 前
    assert.equal(player.end("u-0"), false);
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    assert.equal(player.write("u-0", new Uint8Array([1, 2])), false);
    assert.equal(player.end("u-0"), false);
    player.end("u-1");
    assert.equal(player.write("u-1", new Uint8Array([1, 2])), false);
    assert.deepEqual(child.lines, ["OPEN\tu-1\t24000\t1", "END\tu-1"]);
  } finally {
    player.dispose();
  }
});

test("open は前の発話を置き換える（OPEN を送り直し、以後は新しい id だけが通る）", () => {
  const { player, child } = makePlayer();
  try {
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    player.write("u-1", new Uint8Array([1, 2]));
    player.open("u-2", { sampleRate: 48000, channels: 2 });
    assert.equal(player.write("u-1", new Uint8Array([3, 4])), false);
    assert.equal(player.write("u-2", new Uint8Array([5, 6, 7, 8])), true);
    assert.deepEqual(
      child.lines.map((line) => line.split("\t").slice(0, 2).join("\t")),
      ["OPEN\tu-1", "DATA\tu-1", "OPEN\tu-2", "DATA\tu-2"]
    );
    assert.equal(child.lines[2], "OPEN\tu-2\t48000\t2");
    assert.equal(player.current()?.id, "u-2");
  } finally {
    player.dispose();
  }
});

test("stop は STOP 行を送り、今の発話を空にする（以後の write/end は送らない）", () => {
  const { player, child } = makePlayer();
  try {
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    player.stop();
    assert.equal(player.current(), null);
    assert.equal(player.write("u-1", new Uint8Array([1, 2])), false);
    assert.equal(player.end("u-1"), false);
    assert.deepEqual(child.lines, ["OPEN\tu-1\t24000\t1", "STOP"]);
  } finally {
    player.dispose();
  }
});

// ── 返りの行と状態遷移 ─────────────────────────────────────────────────

test("READY → STARTED → ENDED の順にイベントになり、ENDED で今の発話が空になる", async () => {
  const { player, child, events } = makePlayer();
  try {
    const ready = player.whenReady();
    child.out("READY\tスピーカー (Realtek(R) Audio)\n");
    assert.equal(await ready, true);
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    player.write("u-1", new Uint8Array(4));
    child.out("STARTED\tu-1\n");
    assert.equal(player.current()?.started, true);
    player.end("u-1");
    child.out("ENDED\tu-1\n");
    assert.equal(player.current(), null);
    assert.deepEqual(events, [
      { type: "ready", device: "スピーカー (Realtek(R) Audio)", atMs: 1000 },
      { type: "started", id: "u-1", atMs: 1001 },
      { type: "ended", id: "u-1", atMs: 1002 }
    ]);
    assert.equal(await player.whenReady(), true); // READY 後は即 true
  } finally {
    player.dispose();
  }
});

test("今の発話でない id の STARTED/ENDED は古い発話の残りとして捨てる", () => {
  const { player, child, events } = makePlayer();
  try {
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    player.open("u-2", { sampleRate: 24000, channels: 1 });
    child.out("STARTED\tu-1\nENDED\tu-1\n");
    assert.deepEqual(events, []);
    assert.equal(player.current()?.id, "u-2");
    child.out("STARTED\tu-2\n");
    assert.deepEqual(events.map((e) => [e.type, e.id]), [["started", "u-2"]]);
  } finally {
    player.dispose();
  }
});

test("STOPPED は id つき・id なしのどちらもイベントとして届く", () => {
  const { player, child, events } = makePlayer();
  try {
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    player.stop();
    child.out("STOPPED\tu-1\n");
    player.stop();
    child.out("STOPPED\n");
    assert.deepEqual(events.map((e) => [e.type, e.id]), [["stopped", "u-1"], ["stopped", null]]);
  } finally {
    player.dispose();
  }
});

test("ERROR は今の発話のものなら発話を空にし、どの id でも届ける", () => {
  const { player, child, events } = makePlayer();
  try {
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    child.out("ERROR\tother\tsomething\n");
    assert.equal(player.current()?.id, "u-1");
    child.out("ERROR\t\tinit: no device\n");
    assert.equal(player.current()?.id, "u-1");
    child.out("ERROR\tu-1\t0x88890004 COMException: device invalidated\n");
    assert.equal(player.current(), null);
    assert.deepEqual(
      events.map((e) => [e.type, e.id, e.message]),
      [
        ["error", "other", "something"],
        ["error", null, "init: no device"],
        ["error", "u-1", "0x88890004 COMException: device invalidated"]
      ]
    );
  } finally {
    player.dispose();
  }
});

test("stdout が行の途中で切れて届いても 1 行ずつ解釈する（CRLF も可）", () => {
  const { player, child, events } = makePlayer();
  try {
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    child.out("STAR");
    child.out("TED\tu");
    assert.deepEqual(events, []);
    child.out("-1\r\nEND");
    child.out("ED\tu-1\n");
    assert.deepEqual(events.map((e) => [e.type, e.id]), [["started", "u-1"], ["ended", "u-1"]]);
  } finally {
    player.dispose();
  }
});

test("onOutput/onError は生の行を受け取り、知らない行もそのまま流れる", () => {
  /** @type {string[]} */
  const out = [];
  /** @type {string[]} */
  const err = [];
  const { player, child, events } = makePlayer({
    onOutput: (line) => out.push(line),
    onError: (line) => err.push(line)
  });
  try {
    child.out("SOMETHING\tnew\nREADY\tdev\n");
    child.stderr.emit("data", "device-set: dev\n");
    assert.deepEqual(out, ["SOMETHING\tnew", "READY\tdev"]);
    assert.deepEqual(err, ["device-set: dev"]);
    assert.deepEqual(events.map((e) => e.type), ["ready"]);
  } finally {
    player.dispose();
  }
});

test("onEvent は解除でき、投げる購読者がいても他の購読者に届く", () => {
  const { player, child, events } = makePlayer();
  try {
    /** @type {string[]} */
    const second = [];
    player.onEvent(() => {
      throw new Error("boom");
    });
    const off = player.onEvent((e) => second.push(e.type));
    child.out("READY\tdev\n");
    off();
    child.out("STOPPED\n");
    assert.deepEqual(events.map((e) => e.type), ["ready", "stopped"]);
    assert.deepEqual(second, ["ready"]);
  } finally {
    player.dispose();
  }
});

// ── 異常終了・dispose ──────────────────────────────────────────────────

test("常駐プロセスの異常終了は exit イベント（再生中の id つき）になり、以後の操作は投げる", async () => {
  const { player, child, events } = makePlayer();
  const ready = player.whenReady();
  player.open("u-1", { sampleRate: 24000, channels: 1 });
  child.emit("exit", 3, null);
  assert.equal(await ready, false);
  assert.equal(await player.whenReady(), false);
  assert.equal(player.isAlive(), false);
  assert.equal(player.current(), null);
  assert.deepEqual(events, [{ type: "exit", id: "u-1", code: 3, signal: null, atMs: 1000 }]);
  assert.throws(() => player.open("u-2", { sampleRate: 24000, channels: 1 }), /exited/);
  assert.throws(() => player.write("u-2", new Uint8Array(2)), /exited/);
  assert.throws(() => player.end("u-2"), /exited/);
  assert.throws(() => player.stop(), /exited/);
  player.dispose();
});

test("起動失敗（child の error）も exit イベント 1 回にまとまる（続く exit は重ねない）", () => {
  const { player, child, events } = makePlayer();
  child.emit("error", new Error("spawn powershell.exe ENOENT"));
  child.emit("exit", null, null);
  assert.deepEqual(events, [
    { type: "exit", id: null, code: null, signal: null, message: "spawn powershell.exe ENOENT", atMs: 1000 }
  ]);
  player.dispose();
});

test("stdin の error（EPIPE）で投げない", () => {
  const { player, child } = makePlayer();
  try {
    assert.doesNotThrow(() => child.stdin.emit("error", new Error("write EPIPE")));
  } finally {
    player.dispose();
  }
});

test("dispose は stdin を閉じて kill・パイプを畳み、以後はイベントを届けず操作は投げる", async () => {
  const { player, child, events } = makePlayer();
  const ready = player.whenReady();
  player.dispose();
  player.dispose(); // 二度目は何もしない
  assert.equal(await ready, false);
  assert.equal(child.stdin.ended, true);
  assert.equal(child.killed, true);
  assert.equal(child.stdout.destroyed, true);
  assert.equal(child.unrefed, true);
  child.out("READY\tdev\n");
  child.emit("exit", null, "SIGTERM");
  assert.deepEqual(events, []);
  assert.equal(player.isAlive(), false);
  assert.throws(() => player.open("u-1", { sampleRate: 24000, channels: 1 }), /disposed/);
  assert.throws(() => player.stop(), /disposed/);
});

// ── デバイス名・入力の検査 ──────────────────────────────────────────────

test("deviceName は env SOUL_AUDIO_DEVICE_NAME で渡り、未指定なら足さない", () => {
  /** @type {any} */
  let capturedEnv = null;
  const spawnImpl = (_cmd, _args, opts) => {
    capturedEnv = opts.env;
    return /** @type {any} */ (makeFakeChild());
  };
  const named = createStreamPlayer({ spawnImpl, env: { EXISTING: "1" }, deviceName: "ヘッドホン (2- Shure MV7+)" });
  assert.equal(capturedEnv.SOUL_AUDIO_DEVICE_NAME, "ヘッドホン (2- Shure MV7+)");
  assert.equal(capturedEnv.EXISTING, "1");
  named.dispose();
  const unnamed = createStreamPlayer({ spawnImpl, env: { EXISTING: "1" } });
  assert.equal("SOUL_AUDIO_DEVICE_NAME" in capturedEnv, false);
  unnamed.dispose();
});

test("不正な id・形式・PCM は送る前に投げる", () => {
  const { player, child } = makePlayer();
  try {
    assert.throws(() => player.open("", { sampleRate: 24000, channels: 1 }), TypeError);
    assert.throws(() => player.open("a\tb", { sampleRate: 24000, channels: 1 }), TypeError);
    assert.throws(() => player.open("a\nb", { sampleRate: 24000, channels: 1 }), TypeError);
    assert.throws(() => player.open("u", { sampleRate: 24000.5, channels: 1 }), RangeError);
    assert.throws(() => player.open("u", { sampleRate: 4000, channels: 1 }), RangeError);
    assert.throws(() => player.open("u", { sampleRate: 24000, channels: 3 }), RangeError);
    player.open("u", { sampleRate: 24000, channels: 1 });
    assert.throws(() => player.write("u", /** @type {any} */ ([1, 2])), TypeError);
    assert.deepEqual(child.lines, ["OPEN\tu\t24000\t1"]);
  } finally {
    player.dispose();
  }
});

// ── 純部品 ─────────────────────────────────────────────────────────────

test("parseStreamPlayerLine は返りの行を解釈し、知らない行は null", () => {
  assert.deepEqual(parseStreamPlayerLine("READY\tスピーカー (Realtek(R) Audio)"), {
    type: "ready",
    device: "スピーカー (Realtek(R) Audio)"
  });
  assert.deepEqual(parseStreamPlayerLine("STARTED\tu-1"), { type: "started", id: "u-1" });
  assert.deepEqual(parseStreamPlayerLine("ENDED\tu-1"), { type: "ended", id: "u-1" });
  assert.deepEqual(parseStreamPlayerLine("STOPPED"), { type: "stopped", id: null });
  assert.deepEqual(parseStreamPlayerLine("STOPPED\tu-1"), { type: "stopped", id: "u-1" });
  assert.deepEqual(parseStreamPlayerLine("ERROR\tu-1\tbad\tthing"), { type: "error", id: "u-1", message: "bad\tthing" });
  assert.deepEqual(parseStreamPlayerLine("ERROR\t\tcompile failed"), { type: "error", id: null, message: "compile failed" });
  assert.deepEqual(parseStreamPlayerLine("ERROR\tlegacy"), { type: "error", id: null, message: "legacy" });
  assert.equal(parseStreamPlayerLine("STARTED"), null);
  assert.equal(parseStreamPlayerLine("STARTED\t"), null);
  assert.equal(parseStreamPlayerLine("DEVICE\tx"), null);
});

test("splitPcm は 4 の倍数の大きさで切り、コピーせず元の範囲を指す", () => {
  const pcm = new Uint8Array(10).map((_, i) => i);
  const pieces = splitPcm(pcm, 6); // 6 → 4 に丸める
  assert.deepEqual(pieces.map((p) => [...p]), [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9]]);
  assert.equal(pieces[0].buffer, pcm.buffer);
  assert.deepEqual(splitPcm(new Uint8Array(0), 16), []);
  assert.equal(splitPcm(pcm, 1).length, 3); // 下限 4
});

test("既定の起動スクリプトは C# を base64 で埋め込み、二重引用符を含まずコマンドライン上限に収まる", () => {
  const args = buildDefaultStreamPlayerArgs();
  const script = args[args.length - 1];
  assert.equal(args[args.length - 2], "-Command");
  assert.equal(script, buildStreamPlayerScript());
  assert.equal(script.includes('"'), false);
  assert.ok(script.includes("SOUL_AUDIO_DEVICE_NAME"));
  assert.ok(script.includes("[SoulVoice.Host]::Run"));
  // Windows の CreateProcess のコマンドライン上限は 32767 文字。余裕を持って 30000 未満に保つ。
  const commandLineLength = ["powershell.exe", ...args].join(" ").length;
  assert.ok(commandLineLength < 30000, `command line too long: ${commandLineLength}`);
  const encoded = /FromBase64String\('([A-Za-z0-9+/=]+)'\)/.exec(script)?.[1] ?? "";
  assert.equal(Buffer.from(encoded, "base64").toString("utf8"), STREAM_PLAYER_CSHARP_SOURCE);
  // C# は ASCII のみ（PowerShell 5.1 の Add-Type に渡す前提を崩さない）。
  assert.equal(/[^\x00-\x7f]/.test(STREAM_PLAYER_CSHARP_SOURCE), false);
});

// ── 実プロセス往復（node で書いた無音の代役）──────────────────────────────

/**
 * 常駐側の約束を JS で写した無音の代役。最初の DATA で STARTED、END で ENDED、STOP で STOPPED を返し、
 * 別 id の DATA/END は無視する。env CRASH_ON の行を読んだら終了コード 3 で落ちる。
 */
const FAKE_RESIDENT_SCRIPT = String.raw`
const crashOn = process.env.CRASH_ON;
let id = null, started = false, ended = false, buf = "";
const out = (line) => process.stdout.write(line + "\n");
out("READY\t" + (process.env.SOUL_AUDIO_DEVICE_NAME || "default"));
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
    if (crashOn && line.startsWith(crashOn)) process.exit(3);
    const [kind, lineId, rest] = line.split("\t");
    if (kind === "OPEN") { id = lineId; started = false; ended = false; }
    else if (kind === "DATA" && lineId === id && !ended) {
      if (!started && Buffer.from(rest, "base64").length > 0) { started = true; out("STARTED\t" + id); }
    } else if (kind === "END" && lineId === id && !ended) { ended = true; out("ENDED\t" + id); id = null; }
    else if (kind === "STOP") { out(id ? "STOPPED\t" + id : "STOPPED"); id = null; }
  }
});
process.stdin.on("end", () => process.exit(0));
`;

/** @param {(events: any[]) => boolean} cond */
function waitForEvents(events, cond, timeoutMs = 4000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (cond(events)) return resolve(undefined);
      if (Date.now() - start > timeoutMs) return reject(new Error(`timed out; got ${JSON.stringify(events)}`));
      setTimeout(tick, 10);
    };
    tick();
  });
}

test("実プロセス往復: READY → OPEN/DATA/END → STARTED/ENDED、STOP → STOPPED（無音の代役）", async () => {
  /** @type {any[]} */
  const events = [];
  const player = createStreamPlayer({
    command: process.execPath,
    args: ["-e", FAKE_RESIDENT_SCRIPT],
    deviceName: "ヘッドホン (2- Shure MV7+)",
    onEvent: (e) => events.push(e)
  });
  try {
    assert.equal(await player.whenReady(), true);
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    player.write("u-1", new Uint8Array(40000));
    player.end("u-1");
    await waitForEvents(events, (es) => es.some((e) => e.type === "ended"));
    player.open("u-2", { sampleRate: 24000, channels: 1 });
    player.write("u-2", new Uint8Array(8));
    await waitForEvents(events, (es) => es.some((e) => e.type === "started" && e.id === "u-2"));
    player.stop();
    await waitForEvents(events, (es) => es.some((e) => e.type === "stopped"));
    assert.deepEqual(
      events.map((e) => [e.type, e.type === "ready" ? e.device : e.id]),
      [
        ["ready", "ヘッドホン (2- Shure MV7+)"],
        ["started", "u-1"],
        ["ended", "u-1"],
        ["started", "u-2"],
        ["stopped", "u-2"]
      ]
    );
  } finally {
    player.dispose();
  }
});

test("実プロセス往復: 再生中に落ちると exit イベント（code 3・再生中の id）", async () => {
  /** @type {any[]} */
  const events = [];
  const player = createStreamPlayer({
    command: process.execPath,
    args: ["-e", FAKE_RESIDENT_SCRIPT],
    env: { ...process.env, CRASH_ON: "END" },
    onEvent: (e) => events.push(e)
  });
  try {
    assert.equal(await player.whenReady(), true);
    player.open("u-1", { sampleRate: 24000, channels: 1 });
    player.write("u-1", new Uint8Array(8));
    player.end("u-1");
    await waitForEvents(events, (es) => es.some((e) => e.type === "exit"));
    const exit = events.find((e) => e.type === "exit");
    assert.equal(exit.code, 3);
    assert.equal(exit.id, "u-1");
    assert.equal(player.isAlive(), false);
  } finally {
    player.dispose();
  }
});
