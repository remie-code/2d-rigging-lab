// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  captureWindow,
  buildCaptureScriptText,
  parseCaptureStdout,
  escapePsSingleQuoted,
  DEFAULT_MAX_SIDE,
  DEFAULT_JPEG_QUALITY
} from "./window-capture.mjs";

/** child_process.ChildProcess を模した最小フェイク（実 powershell.exe は一切起動しない）。 */
function makeFakeChild() {
  const child = new EventEmitter();
  /** @type {any} */ (child).stdout = new EventEmitter();
  /** @type {any} */ (child).stderr = new EventEmitter();
  /** @type {any} */ (child).stdout.destroy = () => {};
  /** @type {any} */ (child).stderr.destroy = () => {};
  /** @type {any} */ (child).stdin = { destroy() {} };
  /** @type {any} */ (child).kill = () => {};
  /** @type {any} */ (child).unref = () => {};
  return child;
}

/** 妥当な長さの base64（MIN_PLAUSIBLE_BASE64_LENGTH=100 を超える）を作る。 */
const PLAUSIBLE_BASE64 = "A".repeat(200);

// ── 純関数: エスケープ・スクリプト組み立て ────────────────────────────────

test("escapePsSingleQuoted: シングルクォートを二重化", () => {
  assert.equal(escapePsSingleQuoted("It's a game"), "It''s a game");
  assert.equal(escapePsSingleQuoted("no quotes"), "no quotes");
});

test("buildCaptureScriptText: タイトルをエスケープして埋め込み・maxSide/quality が反映される", () => {
  const script = buildCaptureScriptText("Bob's Game", { maxSide: 640, jpegQuality: 50 });
  assert.ok(script.includes("$title = 'Bob''s Game'"));
  assert.ok(script.includes("$maxSide = 640"));
  assert.ok(script.includes("[int64]50"));
  assert.ok(script.includes("PrintWindow"));
  assert.ok(script.includes("IsIconic"));
});

test("buildCaptureScriptText: 既定値（1024 / 75）が使われる", () => {
  const script = buildCaptureScriptText("Title");
  assert.ok(script.includes(`$maxSide = ${DEFAULT_MAX_SIDE}`));
  assert.ok(script.includes(`[int64]${DEFAULT_JPEG_QUALITY}`));
});

// ── 純関数: stdout パース ───────────────────────────────────────────────

test("parseCaptureStdout: CAPTURE_OK を正しくパース", () => {
  const stdout = `CAPTURE_OK\n800\n600\n${PLAUSIBLE_BASE64}\n`;
  const parsed = parseCaptureStdout(stdout);
  assert.ok(!("error" in parsed));
  if ("error" in parsed) throw new Error("unreachable");
  assert.equal(parsed.width, 800);
  assert.equal(parsed.height, 600);
  assert.equal(parsed.jpegBase64, PLAUSIBLE_BASE64);
});

test("parseCaptureStdout: notFound", () => {
  const parsed = parseCaptureStdout("CAPTURE_FAIL\nnotFound\nwindow not found: Foo\n");
  assert.deepEqual(parsed, { error: { kind: "notFound", message: "window not found: Foo" } });
});

test("parseCaptureStdout: minimized", () => {
  const parsed = parseCaptureStdout("CAPTURE_FAIL\nminimized\nwindow is minimized\n");
  assert.deepEqual(parsed, { error: { kind: "minimized", message: "window is minimized" } });
});

test("parseCaptureStdout: failed（PrintWindow false）", () => {
  const parsed = parseCaptureStdout("CAPTURE_FAIL\nfailed\nPrintWindow returned false\n");
  assert.deepEqual(parsed, { error: { kind: "failed", message: "PrintWindow returned false" } });
});

test("parseCaptureStdout: 未知の kind は failed へフォールバック（成功にはしない）", () => {
  const parsed = parseCaptureStdout("CAPTURE_FAIL\nsomethingWeird\nboom\n");
  assert.ok("error" in parsed);
  if (!("error" in parsed)) throw new Error("unreachable");
  assert.equal(parsed.error.kind, "failed");
  assert.ok(parsed.error.message.includes("somethingWeird"));
});

test("parseCaptureStdout: 空 stdout は failed", () => {
  const parsed = parseCaptureStdout("");
  assert.ok("error" in parsed);
  if (!("error" in parsed)) throw new Error("unreachable");
  assert.equal(parsed.error.kind, "failed");
});

test("parseCaptureStdout: 認識不能な先頭行は failed", () => {
  const parsed = parseCaptureStdout("SOMETHING_ELSE\nabc\n");
  assert.ok("error" in parsed);
  if (!("error" in parsed)) throw new Error("unreachable");
  assert.equal(parsed.error.kind, "failed");
});

test("parseCaptureStdout: CAPTURE_OK だが寸法が不正なら failed（成功を捏造しない）", () => {
  const parsed = parseCaptureStdout(`CAPTURE_OK\nNaN\n600\n${PLAUSIBLE_BASE64}\n`);
  assert.ok("error" in parsed);
  if (!("error" in parsed)) throw new Error("unreachable");
  assert.equal(parsed.error.kind, "failed");
});

test("parseCaptureStdout: 白紙成功マーカー（極端に短い base64）を成功として通さない", () => {
  const parsed = parseCaptureStdout("CAPTURE_OK\n800\n600\nQQ==\n"); // 数バイトしかない壊れデータ
  assert.ok("error" in parsed);
  if (!("error" in parsed)) throw new Error("unreachable");
  assert.equal(parsed.error.kind, "failed");
  assert.ok(parsed.error.message.includes("implausibly short"));
});

// ── captureWindow: fake spawn で全分岐を固定 ────────────────────────────

test("captureWindow: title が非文字列/空文字なら TypeError（呼び出しミスは早期に弾く）", async () => {
  await assert.rejects(() => captureWindow(""), TypeError);
  // @ts-expect-error 意図的な型不正呼び出し
  await assert.rejects(() => captureWindow(undefined), TypeError);
  // @ts-expect-error 意図的な型不正呼び出し
  await assert.rejects(() => captureWindow(123), TypeError);
});

test("captureWindow: 成功時 jpegBase64/width/height/elapsedMs を返す", async () => {
  const fakeChild = makeFakeChild();
  const spawnImpl = () => fakeChild;
  let clock = 5000;
  const nowImpl = () => clock;

  const p = captureWindow("Game Window", { spawnImpl, nowImpl });
  fakeChild.stdout.emit("data", Buffer.from(`CAPTURE_OK\n1024\n576\n${PLAUSIBLE_BASE64}\n`));
  clock = 5064;
  fakeChild.emit("exit", 0);

  const result = await p;
  assert.ok(!("error" in result));
  if ("error" in result) throw new Error("unreachable");
  assert.equal(result.width, 1024);
  assert.equal(result.height, 576);
  assert.equal(result.jpegBase64, PLAUSIBLE_BASE64);
  assert.equal(result.elapsedMs, 64);
});

test("captureWindow: notFound", async () => {
  const fakeChild = makeFakeChild();
  const p = captureWindow("Ghost Window", { spawnImpl: () => fakeChild });
  fakeChild.stdout.emit("data", Buffer.from("CAPTURE_FAIL\nnotFound\nwindow not found: Ghost Window\n"));
  fakeChild.emit("exit", 0);
  const result = await p;
  assert.deepEqual(result, { error: { kind: "notFound", message: "window not found: Ghost Window" } });
});

test("captureWindow: minimized", async () => {
  const fakeChild = makeFakeChild();
  const p = captureWindow("Minimized App", { spawnImpl: () => fakeChild });
  fakeChild.stdout.emit("data", Buffer.from("CAPTURE_FAIL\nminimized\nwindow is minimized\n"));
  fakeChild.emit("exit", 0);
  const result = await p;
  assert.deepEqual(result, { error: { kind: "minimized", message: "window is minimized" } });
});

test("captureWindow: failed（PrintWindow 失敗）", async () => {
  const fakeChild = makeFakeChild();
  const p = captureWindow("Weird App", { spawnImpl: () => fakeChild });
  fakeChild.stdout.emit("data", Buffer.from("CAPTURE_FAIL\nfailed\nPrintWindow returned false\n"));
  fakeChild.emit("exit", 0);
  const result = await p;
  assert.deepEqual(result, { error: { kind: "failed", message: "PrintWindow returned false" } });
});

test("captureWindow: powershell が非0終了 + stdout 空なら failed", async () => {
  const fakeChild = makeFakeChild();
  const p = captureWindow("App", { spawnImpl: () => fakeChild });
  fakeChild.stderr.emit("data", Buffer.from("Add-Type : some fatal error"));
  fakeChild.emit("exit", 1);
  const result = await p;
  assert.ok("error" in result);
  if (!("error" in result)) throw new Error("unreachable");
  assert.equal(result.error.kind, "failed");
  assert.ok(result.error.message.includes("some fatal error"));
});

test("captureWindow: タイムアウトで kind:timeout（子プロセス kill 済み・実時間を待たない）", async () => {
  const fakeChild = makeFakeChild();
  let killed = false;
  /** @type {any} */ (fakeChild).kill = () => {
    killed = true;
  };
  const setTimeoutImpl = (fn) => {
    fn();
    return { unref() {} };
  };
  const result = await captureWindow("Slow App", {
    spawnImpl: () => fakeChild,
    setTimeoutImpl,
    clearTimeoutImpl: () => {},
    timeoutMs: 999
  });
  assert.ok("error" in result);
  if (!("error" in result)) throw new Error("unreachable");
  assert.equal(result.error.kind, "timeout");
  assert.ok(result.error.message.includes("999"));
  assert.equal(killed, true);
});

test("captureWindow: 白紙成功マーカー（極端に短い base64）は failed として中止", async () => {
  const fakeChild = makeFakeChild();
  const p = captureWindow("Blank App", { spawnImpl: () => fakeChild });
  fakeChild.stdout.emit("data", Buffer.from("CAPTURE_OK\n800\n600\nQQ==\n"));
  fakeChild.emit("exit", 0);
  const result = await p;
  assert.ok("error" in result);
  if (!("error" in result)) throw new Error("unreachable");
  assert.equal(result.error.kind, "failed");
});
