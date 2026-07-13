// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { listWindows, buildListScriptText, parseListStdout, DEFAULT_LIST_TIMEOUT_MS } from "./window-list.mjs";

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

// ── 純関数: スクリプト組み立て ──────────────────────────────────────────

test("buildListScriptText: Get-Process + MainWindowTitle フィルタ + ConvertTo-Json", () => {
  const script = buildListScriptText();
  assert.ok(script.includes("Get-Process"));
  assert.ok(script.includes("MainWindowTitle"));
  assert.ok(script.includes("ConvertTo-Json"));
});

// ── 純関数: stdout パース ───────────────────────────────────────────────

test("parseListStdout: 複数件の JSON 配列", () => {
  const stdout = JSON.stringify([
    { Id: 111, ProcessName: "GameApp", MainWindowTitle: "My Game" },
    { Id: 222, ProcessName: "notepad", MainWindowTitle: "無題 - メモ帳" }
  ]);
  const result = parseListStdout(stdout);
  assert.deepEqual(result, {
    windows: [
      { pid: 111, processName: "GameApp", title: "My Game" },
      { pid: 222, processName: "notepad", title: "無題 - メモ帳" }
    ]
  });
});

test("parseListStdout: 単一オブジェクト（PowerShell 5.1 の ConvertTo-Json 1 件配列崩れ）を配列化", () => {
  const stdout = JSON.stringify({ Id: 999, ProcessName: "solo", MainWindowTitle: "Only Window" });
  const result = parseListStdout(stdout);
  assert.deepEqual(result, { windows: [{ pid: 999, processName: "solo", title: "Only Window" }] });
});

test("parseListStdout: 空配列 '[]' → 空", () => {
  assert.deepEqual(parseListStdout("[]"), { windows: [] });
});

test("parseListStdout: 'null'（PowerShell が空結果で null を出す既知の癖）→ 空", () => {
  assert.deepEqual(parseListStdout("null"), { windows: [] });
});

test("parseListStdout: 空文字列 → 空", () => {
  assert.deepEqual(parseListStdout(""), { windows: [] });
  assert.deepEqual(parseListStdout("   \n"), { windows: [] });
});

test("parseListStdout: 壊れた JSON は failed", () => {
  const result = parseListStdout("{not valid json");
  assert.ok("error" in result);
  if (!("error" in result)) throw new Error("unreachable");
  assert.equal(result.error.kind, "failed");
});

// ── listWindows: fake spawn で往復を固定 ────────────────────────────────

test("listWindows: 成功時に windows 配列を返す", async () => {
  const fakeChild = makeFakeChild();
  const p = listWindows({ spawnImpl: () => fakeChild });
  fakeChild.stdout.emit(
    "data",
    Buffer.from(JSON.stringify([{ Id: 42, ProcessName: "app", MainWindowTitle: "Title" }]))
  );
  fakeChild.emit("exit", 0);
  const result = await p;
  assert.deepEqual(result, { windows: [{ pid: 42, processName: "app", title: "Title" }] });
});

test("listWindows: 0 件は失敗ではなく空配列", async () => {
  const fakeChild = makeFakeChild();
  const p = listWindows({ spawnImpl: () => fakeChild });
  fakeChild.stdout.emit("data", Buffer.from("[]"));
  fakeChild.emit("exit", 0);
  const result = await p;
  assert.deepEqual(result, { windows: [] });
});

test("listWindows: powershell が非0終了 + stdout 空なら failed", async () => {
  const fakeChild = makeFakeChild();
  const p = listWindows({ spawnImpl: () => fakeChild });
  fakeChild.stderr.emit("data", Buffer.from("fatal script error"));
  fakeChild.emit("exit", 1);
  const result = await p;
  assert.ok("error" in result);
  if (!("error" in result)) throw new Error("unreachable");
  assert.equal(result.error.kind, "failed");
  assert.ok(result.error.message.includes("fatal script error"));
});

test("listWindows: タイムアウトで kind:timeout（実時間を待たない）", async () => {
  const fakeChild = makeFakeChild();
  const setTimeoutImpl = (fn) => {
    fn();
    return { unref() {} };
  };
  const result = await listWindows({
    spawnImpl: () => fakeChild,
    setTimeoutImpl,
    clearTimeoutImpl: () => {},
    timeoutMs: 1234
  });
  assert.ok("error" in result);
  if (!("error" in result)) throw new Error("unreachable");
  assert.equal(result.error.kind, "timeout");
  assert.ok(result.error.message.includes("1234"));
});

test("listWindows: 既定タイムアウトは DEFAULT_LIST_TIMEOUT_MS", async () => {
  const fakeChild = makeFakeChild();
  const p = listWindows({ spawnImpl: () => fakeChild });
  fakeChild.stdout.emit("data", Buffer.from("[]"));
  fakeChild.emit("exit", 0);
  await p;
  assert.equal(DEFAULT_LIST_TIMEOUT_MS, 3000);
});
