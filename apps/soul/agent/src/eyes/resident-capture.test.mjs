// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  buildResidentCaptureRequestLine,
  buildResidentCaptureScriptText,
  createResidentCapture,
  RESIDENT_CAPTURE_TIMEOUT_MS,
  RESIDENT_MAX_START_FAILURES,
  RESIDENT_RESTART_DELAY_MS,
  RESIDENT_STARTUP_TIMEOUT_MS
} from "./resident-capture.mjs";
import { DEFAULT_JPEG_QUALITY, DEFAULT_MAX_SIDE } from "./window-capture.mjs";

/** parseCaptureStdout の形式ガード（100 字以上）を通る base64 風データ。 */
const PLAUSIBLE_BASE64 = "A".repeat(200);

/**
 * 偽物の撮る係（常駐 PowerShell を模した ChildProcess）。実 powershell.exe は一切起動しない。
 * stdin に書かれた要求行を `requests` に溜め、テストが stdout へ応答を流す。
 */
function makeFakeChild() {
  const child = new EventEmitter();
  /** @type {string[]} */
  const requests = [];
  const flags = { killed: false, stdoutDestroyed: false, stderrDestroyed: false, stdinDestroyed: false, unrefed: false };
  const stdin = new EventEmitter();
  /** @type {any} */ (stdin).write = (/** @type {string} */ s) => {
    requests.push(s);
    return true;
  };
  /** @type {any} */ (stdin).destroy = () => {
    flags.stdinDestroyed = true;
  };
  const stdout = new EventEmitter();
  /** @type {any} */ (stdout).destroy = () => {
    flags.stdoutDestroyed = true;
  };
  const stderr = new EventEmitter();
  /** @type {any} */ (stderr).destroy = () => {
    flags.stderrDestroyed = true;
  };
  Object.assign(child, {
    stdin,
    stdout,
    stderr,
    requests,
    flags,
    kill() {
      flags.killed = true;
    },
    unref() {
      flags.unrefed = true;
    },
    /** @param {string} text */
    out(text) {
      stdout.emit("data", Buffer.from(text, "utf8"));
    }
  });
  return /** @type {any} */ (child);
}

/** 実時間を待たない偽タイマ。 */
function makeFakeTimers() {
  /** @type {Array<{ fn: () => void; ms: number; cleared: boolean; fired: boolean }>} */
  const timers = [];
  return {
    timers,
    setTimeoutImpl: (/** @type {() => void} */ fn, /** @type {number} */ ms) => {
      const t = { fn, ms, cleared: false, fired: false, unref() {} };
      timers.push(t);
      return t;
    },
    clearTimeoutImpl: (/** @type {any} */ t) => {
      if (t) t.cleared = true;
    },
    /** その ms で登録された生きているタイマを発火する（無ければ throw）。 */
    fire(/** @type {number} */ ms) {
      const t = timers.find((x) => x.ms === ms && !x.cleared && !x.fired);
      if (!t) throw new Error(`no pending timer for ${ms}ms`);
      t.fired = true;
      t.fn();
    },
    pending(/** @type {number} */ ms) {
      return timers.filter((x) => x.ms === ms && !x.cleared && !x.fired).length;
    }
  };
}

/**
 * 偽物の撮る係を注入した createResidentCapture を作る。
 * @param {object} [extra]
 */
function setup(extra = {}) {
  /** @type {any[]} */
  const children = [];
  /** @type {any[]} */
  const spawnCalls = [];
  const spawnImpl = (/** @type {string} */ cmd, /** @type {string[]} */ args, /** @type {any} */ opts) => {
    spawnCalls.push({ cmd, args, opts });
    const c = makeFakeChild();
    children.push(c);
    return c;
  };
  const timers = makeFakeTimers();
  let clock = 1000;
  /** @type {string[]} */
  const fallbackCalls = [];
  /** @type {any[]} */
  const events = [];
  const rc = createResidentCapture({
    spawnImpl,
    nowImpl: () => clock,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl,
    fallbackCaptureImpl: async (title) => {
      fallbackCalls.push(title);
      return { jpegBase64: PLAUSIBLE_BASE64, width: 10, height: 10, elapsedMs: 600 };
    },
    onEvent: (e) => events.push(e),
    ...extra
  });
  return {
    rc,
    children,
    spawnCalls,
    timers,
    fallbackCalls,
    events,
    /** @param {number} ms */
    advance(ms) {
      clock += ms;
    },
    last: () => children[children.length - 1]
  };
}

/** 要求行から id とタイトルを取り出す。 @param {string} line */
function parseRequest(line) {
  const m = /^CAPTURE (\S+) (\S+)\n$/.exec(line);
  if (!m) throw new Error(`malformed request: ${JSON.stringify(line)}`);
  return { id: m[1], title: Buffer.from(m[2], "base64").toString("utf8") };
}

// ── 純関数 ─────────────────────────────────────────────────────────────

test("buildResidentCaptureScriptText: 入出力 UTF-8・型の読み込みはループより前に 1 回だけ・画像の作り方は今と同じ", () => {
  const script = buildResidentCaptureScriptText();
  assert.ok(script.includes("[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)"));
  assert.ok(script.includes("[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)"));
  assert.equal(script.split("Add-Type -TypeDefinition").length - 1, 1);
  assert.equal(script.split("Add-Type -AssemblyName System.Drawing").length - 1, 1);
  const loopAt = script.indexOf("while ($true)");
  assert.ok(loopAt > script.indexOf("Add-Type -TypeDefinition"));
  assert.ok(loopAt > script.indexOf("RESIDENT_READY"));
  assert.ok(script.includes("PrintWindow($hwnd, $hdc, 2)"));
  assert.ok(script.includes("IsIconic"));
  assert.ok(script.includes("$_.MainWindowTitle -eq $title"));
  assert.ok(script.includes(`$maxSide = ${DEFAULT_MAX_SIDE}`));
  assert.ok(script.includes(`[int64]${DEFAULT_JPEG_QUALITY}`));
  assert.ok(script.includes("CAPTURE_END $id"));
  // stdin が閉じたら抜ける（Node 側が落ちても取り残されない）。
  assert.ok(script.includes("if ($null -eq $line) { break }"));
});

test("buildResidentCaptureScriptText: maxSide / jpegQuality を反映", () => {
  const script = buildResidentCaptureScriptText({ maxSide: 640, jpegQuality: 50 });
  assert.ok(script.includes("$maxSide = 640"));
  assert.ok(script.includes("[int64]50"));
});

test("buildResidentCaptureRequestLine: タイトルを UTF-8 base64 で 1 行に包む（日本語・空白・改行でも壊れない）", () => {
  const title = "撮る係 test - メモ帳\nsecond";
  const line = buildResidentCaptureRequestLine("7", title);
  assert.equal(line.split("\n").length, 2);
  assert.ok(line.endsWith("\n"));
  assert.deepEqual(parseRequest(line), { id: "7", title });
});

// ── 起動 ──────────────────────────────────────────────────────────────

test("start: 1 回だけ起動（冪等）・-Command に常駐スクリプト・stdin も pipe", () => {
  const h = setup();
  assert.equal(h.rc.status(), "stopped");
  h.rc.start();
  h.rc.start();
  assert.equal(h.spawnCalls.length, 1);
  const { cmd, args, opts } = h.spawnCalls[0];
  assert.equal(cmd, "powershell.exe");
  assert.equal(args[args.length - 2], "-Command");
  assert.ok(args[args.length - 1].includes("RESIDENT_READY"));
  assert.deepEqual(opts.stdio, ["pipe", "pipe", "pipe"]);
  assert.equal(h.rc.status(), "starting");
  h.advance(450);
  h.last().out("RESIDENT_READY\n");
  assert.equal(h.rc.status(), "ready");
  assert.deepEqual(h.events.find((e) => e.type === "ready"), { type: "ready", startupMs: 450 });
  // 起動の上限タイマは片付いている。
  assert.equal(h.timers.pending(RESIDENT_STARTUP_TIMEOUT_MS), 0);
  h.rc.stop();
});

test("capture: 起動完了の前は毎回起動（今の captureWindow）に戻す", async () => {
  const h = setup();
  h.rc.start();
  const r = await h.rc.capture("Game");
  assert.ok(!("error" in r));
  assert.deepEqual(h.fallbackCalls, ["Game"]);
  assert.equal(h.last().requests.length, 0);
  const ev = h.events.find((e) => e.type === "capture");
  assert.equal(ev.via, "spawn");
  assert.equal(ev.fallbackReason, "starting");
  h.rc.stop();
});

test("capture: 止まっている（耳が止まっている）ときも毎回起動に戻す", async () => {
  const h = setup();
  const r = await h.rc.capture("Game");
  assert.ok(!("error" in r));
  assert.deepEqual(h.fallbackCalls, ["Game"]);
  assert.equal(h.spawnCalls.length, 0);
  assert.equal(h.events[0].fallbackReason, "stopped");
});

test("capture: title が非文字列/空文字なら TypeError（captureWindow と同じ）", async () => {
  const h = setup();
  await assert.rejects(() => h.rc.capture(""), TypeError);
  await assert.rejects(() => h.rc.capture(/** @type {any} */ (undefined)), TypeError); // 意図的な型不正呼び出し
});

// ── 撮影 ──────────────────────────────────────────────────────────────

test("capture: 撮る係に頼み、終端行で { jpegBase64, width, height, elapsedMs } を返す", async () => {
  const h = setup();
  h.rc.start();
  const child = h.last();
  child.out("RESIDENT_READY\n");
  const p = h.rc.capture("ゲーム - 窓");
  assert.equal(child.requests.length, 1);
  const req = parseRequest(child.requests[0]);
  assert.equal(req.title, "ゲーム - 窓");
  h.advance(48);
  child.out(`CAPTURE_OK\n1024\n576\n${PLAUSIBLE_BASE64}\nCAPTURE_END ${req.id}\n`);
  const r = await p;
  assert.deepEqual(r, { jpegBase64: PLAUSIBLE_BASE64, width: 1024, height: 576, elapsedMs: 48 });
  assert.deepEqual(h.fallbackCalls, []);
  const ev = h.events.find((e) => e.type === "capture");
  assert.deepEqual(ev, { type: "capture", via: "resident", elapsedMs: 48, ok: true, kind: null });
  // 撮影の上限タイマは片付いている。
  assert.equal(h.timers.pending(RESIDENT_CAPTURE_TIMEOUT_MS), 0);
  h.rc.stop();
});

test("capture: 応答が細切れ（UTF-8 の途中で切れる）でも組み立てる・notFound はそのまま {error}", async () => {
  const h = setup();
  h.rc.start();
  const child = h.last();
  child.out("RESIDENT_READY\n");
  const p = h.rc.capture("ゲーム");
  const { id } = parseRequest(child.requests[0]);
  const bytes = Buffer.from(`CAPTURE_FAIL\nnotFound\nwindow not found: ゲーム\nCAPTURE_END ${id}\n`, "utf8");
  // 「ゲ」(3 バイト) の途中で割る。
  const cut = bytes.indexOf(Buffer.from("ゲ", "utf8")) + 1;
  child.stdout.emit("data", bytes.subarray(0, cut));
  child.stdout.emit("data", bytes.subarray(cut));
  const r = await p;
  assert.deepEqual(r, { error: { kind: "notFound", message: "window not found: ゲーム" } });
  const ev = h.events.find((e) => e.type === "capture");
  assert.equal(ev.ok, false);
  assert.equal(ev.kind, "notFound");
  h.rc.stop();
});

test("capture: 2 回続けて頼める（要求ごとに id が変わる・前の応答の残りを混ぜない）", async () => {
  const h = setup();
  h.rc.start();
  const child = h.last();
  child.out("RESIDENT_READY\n");
  const p1 = h.rc.capture("A");
  const id1 = parseRequest(child.requests[0]).id;
  child.out(`CAPTURE_FAIL\nminimized\nwindow is minimized\nCAPTURE_END ${id1}\n`);
  assert.deepEqual(await p1, { error: { kind: "minimized", message: "window is minimized" } });
  const p2 = h.rc.capture("B");
  const id2 = parseRequest(child.requests[1]).id;
  assert.notEqual(id1, id2);
  child.out(`CAPTURE_OK\n800\n600\n${PLAUSIBLE_BASE64}\nCAPTURE_END ${id2}\n`);
  const r2 = await p2;
  assert.ok(!("error" in r2));
  h.rc.stop();
});

test("capture: 返事待ちの間に来た 2 件目は毎回起動に戻す（同時に頼むのは 1 件だけ）", async () => {
  const h = setup();
  h.rc.start();
  const child = h.last();
  child.out("RESIDENT_READY\n");
  const p1 = h.rc.capture("A");
  const r2 = await h.rc.capture("B");
  assert.ok(!("error" in r2));
  assert.deepEqual(h.fallbackCalls, ["B"]);
  assert.equal(h.events.find((e) => e.type === "capture").fallbackReason, "busy");
  const id1 = parseRequest(child.requests[0]).id;
  child.out(`CAPTURE_OK\n800\n600\n${PLAUSIBLE_BASE64}\nCAPTURE_END ${id1}\n`);
  assert.ok(!("error" in (await p1)));
  assert.equal(child.requests.length, 1);
  h.rc.stop();
});

// ── 上限超え・落ちた・起動失敗 ─────────────────────────────────────────

test("2 秒の上限を超えたら、その回は timeout・撮る係は畳んで待たずに立ち上げ直す", async () => {
  const h = setup();
  h.rc.start();
  const first = h.last();
  first.out("RESIDENT_READY\n");
  const p = h.rc.capture("Slow");
  h.timers.fire(RESIDENT_CAPTURE_TIMEOUT_MS);
  const r = await p;
  assert.deepEqual(r, { error: { kind: "timeout", message: `capture timed out after ${RESIDENT_CAPTURE_TIMEOUT_MS}ms` } });
  // 古い子は kill → stdio destroy → unref 済み。
  assert.equal(first.flags.killed, true);
  assert.equal(first.flags.stdinDestroyed, true);
  assert.equal(first.flags.stdoutDestroyed, true);
  assert.equal(first.flags.stderrDestroyed, true);
  assert.equal(first.flags.unrefed, true);
  // 待たずに立ち上げ直している。
  assert.equal(h.spawnCalls.length, 2);
  assert.equal(h.rc.status(), "starting");
  // 古い子の遅れた応答・exit は無視する。
  first.out(`CAPTURE_OK\n800\n600\n${PLAUSIBLE_BASE64}\nCAPTURE_END 1\n`);
  first.emit("exit", 1);
  assert.equal(h.spawnCalls.length, 2);
  assert.equal(h.rc.status(), "starting");
  h.last().out("RESIDENT_READY\n");
  assert.equal(h.rc.status(), "ready");
  h.rc.stop();
});

test("返事待ちの間に撮る係が落ちたら、その回は failed・少し待って立ち上げ直す", async () => {
  const h = setup();
  h.rc.start();
  const first = h.last();
  first.out("RESIDENT_READY\n");
  const p = h.rc.capture("Game");
  first.emit("exit", 1);
  const r = await p;
  assert.ok("error" in r);
  if (!("error" in r)) throw new Error("unreachable");
  assert.equal(r.error.kind, "failed");
  assert.equal(first.flags.killed, true);
  assert.equal(h.rc.status(), "starting");
  assert.equal(h.spawnCalls.length, 1);
  h.timers.fire(RESIDENT_RESTART_DELAY_MS);
  assert.equal(h.spawnCalls.length, 2);
  h.last().out("RESIDENT_READY\n");
  assert.equal(h.rc.status(), "ready");
  h.rc.stop();
});

test("起動完了の前に続けて落ちたら諦める（以後は毎回起動）・次の start() でまた試す", async () => {
  const h = setup();
  h.rc.start();
  for (let i = 0; i < RESIDENT_MAX_START_FAILURES; i += 1) {
    h.last().emit("exit", 1);
    if (i < RESIDENT_MAX_START_FAILURES - 1) h.timers.fire(RESIDENT_RESTART_DELAY_MS);
  }
  assert.equal(h.rc.status(), "gaveUp");
  assert.equal(h.spawnCalls.length, RESIDENT_MAX_START_FAILURES);
  assert.equal(h.timers.pending(RESIDENT_RESTART_DELAY_MS), 0);
  assert.ok(h.events.some((e) => e.type === "gaveUp"));
  const r = await h.rc.capture("Game");
  assert.ok(!("error" in r));
  assert.deepEqual(h.fallbackCalls, ["Game"]);
  h.rc.start();
  assert.equal(h.spawnCalls.length, RESIDENT_MAX_START_FAILURES + 1);
  assert.equal(h.rc.status(), "starting");
  h.rc.stop();
});

test("起動完了が上限内に来なければ畳んで立ち上げ直す（失敗 1 回として数える）", () => {
  const h = setup();
  h.rc.start();
  const first = h.last();
  h.timers.fire(RESIDENT_STARTUP_TIMEOUT_MS);
  assert.equal(first.flags.killed, true);
  // 畳んだ子の exit は二重に数えない。
  first.emit("exit", 1);
  assert.equal(h.timers.pending(RESIDENT_RESTART_DELAY_MS), 1);
  h.timers.fire(RESIDENT_RESTART_DELAY_MS);
  assert.equal(h.spawnCalls.length, 2);
  h.rc.stop();
});

test("spawn 自体の error（powershell.exe が無い等）でも Node を落とさず立ち上げ直しに回る", () => {
  const h = setup();
  h.rc.start();
  h.last().emit("error", new Error("ENOENT"));
  assert.equal(h.rc.status(), "starting");
  assert.equal(h.timers.pending(RESIDENT_RESTART_DELAY_MS), 1);
  h.rc.stop();
  assert.equal(h.timers.pending(RESIDENT_RESTART_DELAY_MS), 0);
});

// ── 停止 ──────────────────────────────────────────────────────────────

test("stop: kill → stdio destroy → unref・返事待ちは failed・後から exit が来ても立ち上げ直さない（冪等）", async () => {
  const h = setup();
  h.rc.start();
  const child = h.last();
  child.out("RESIDENT_READY\n");
  const p = h.rc.capture("Game");
  h.rc.stop();
  h.rc.stop();
  const r = await p;
  assert.deepEqual(r, { error: { kind: "failed", message: "capture helper stopped" } });
  assert.deepEqual(child.flags, {
    killed: true,
    stdoutDestroyed: true,
    stderrDestroyed: true,
    stdinDestroyed: true,
    unrefed: true
  });
  assert.equal(h.rc.status(), "stopped");
  child.emit("exit", null);
  assert.equal(h.spawnCalls.length, 1);
  assert.equal(h.timers.pending(RESIDENT_RESTART_DELAY_MS), 0);
  assert.equal(h.events.filter((e) => e.type === "stopped").length, 1);
  // 止めた後の撮影は毎回起動に戻る。
  const r2 = await h.rc.capture("Game");
  assert.ok(!("error" in r2));
  assert.deepEqual(h.fallbackCalls, ["Game"]);
});

test("stop → start で新しい撮る係を起動し直す（耳の Stop → Start）", () => {
  const h = setup();
  h.rc.start();
  h.last().out("RESIDENT_READY\n");
  h.rc.stop();
  h.rc.start();
  assert.equal(h.spawnCalls.length, 2);
  assert.equal(h.rc.status(), "starting");
  h.last().out("RESIDENT_READY\n");
  assert.equal(h.rc.status(), "ready");
  h.rc.stop();
});

test("落ちた後の立ち上げ直し待ちの間に stop したら、立ち上げ直さない", () => {
  const h = setup();
  h.rc.start();
  h.last().out("RESIDENT_READY\n");
  h.last().emit("exit", 1);
  assert.equal(h.timers.pending(RESIDENT_RESTART_DELAY_MS), 1);
  h.rc.stop();
  assert.equal(h.timers.pending(RESIDENT_RESTART_DELAY_MS), 0);
  assert.equal(h.spawnCalls.length, 1);
});
