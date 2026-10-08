// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  buildPowerShellInvocationArgs,
  runPowerShellScript,
  withUtf8OutputPrelude,
  DEFAULT_POWERSHELL_PATH
} from "./powershell-exec.mjs";

/**
 * child_process.ChildProcess を模した最小フェイク（EventEmitter + stdout/stderr サブエミッタ）。
 * 実 powershell.exe は一切起動しない。
 */
function makeFakeChild() {
  const child = new EventEmitter();
  /** @type {any} */ (child).stdout = new EventEmitter();
  /** @type {any} */ (child).stderr = new EventEmitter();
  /** @type {any} */ (child).stdout.destroy = () => {};
  /** @type {any} */ (child).stderr.destroy = () => {};
  /** @type {any} */ (child).stdin = { destroy() {} };
  let killed = false;
  /** @type {any} */ (child).kill = () => {
    killed = true;
  };
  /** @type {any} */ (child).unref = () => {};
  /** @type {any} */ (child).wasKilled = () => killed;
  return child;
}

// ── 純関数: 起動引数組み立て ────────────────────────────────────────────

test("buildPowerShellInvocationArgs: プロファイル無効化 + -Command でスクリプトを渡す", () => {
  const args = buildPowerShellInvocationArgs("Write-Output 'hi'");
  assert.deepEqual(args, [
    "-NoProfile",
    "-NonInteractive",
    "-NoLogo",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    "Write-Output 'hi'"
  ]);
});

test("withUtf8OutputPrelude: スクリプト先頭に UTF-8 出力エンコーディング設定を差し込む", () => {
  const wrapped = withUtf8OutputPrelude("Write-Output 'hi'");
  assert.ok(wrapped.startsWith("[Console]::OutputEncoding"));
  assert.ok(wrapped.includes("UTF8Encoding"));
  assert.ok(wrapped.endsWith("Write-Output 'hi'"));
});

test("runPowerShellScript: 実行するスクリプトに UTF-8 出力前置きが差し込まれる（実機の文字化け対策）", async () => {
  const fakeChild = makeFakeChild();
  /** @type {any[]} */
  const spawnCalls = [];
  const spawnImpl = (cmd, args, opts) => {
    spawnCalls.push({ cmd, args, opts });
    return fakeChild;
  };
  const p = runPowerShellScript("Write-Output 'inner-script'", { spawnImpl });
  fakeChild.emit("exit", 0);
  await p;
  const passedScript = spawnCalls[0].args[spawnCalls[0].args.length - 1];
  assert.ok(passedScript.startsWith("[Console]::OutputEncoding"));
  assert.ok(passedScript.includes("Write-Output 'inner-script'"));
});

// ── 常駐: fake spawn で正常系・異常系・タイムアウトを固定 ──────────────────

test("正常終了: stdout/stderr/code/elapsedMs を集めて timedOut:false で解決", async () => {
  /** @type {any[]} */
  const spawnCalls = [];
  const fakeChild = makeFakeChild();
  const spawnImpl = (cmd, args, opts) => {
    spawnCalls.push({ cmd, args, opts });
    return fakeChild;
  };
  let clock = 1000;
  const nowImpl = () => clock;

  const resultPromise = runPowerShellScript("Write-Output 'ok'", {
    spawnImpl,
    nowImpl,
    powershellPath: "C:/fake/powershell.exe"
  });

  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0].cmd, "C:/fake/powershell.exe");

  fakeChild.stdout.emit("data", Buffer.from("ok\n"));
  clock = 1123;
  fakeChild.emit("exit", 0);

  const result = await resultPromise;
  assert.equal(result.timedOut, false);
  if (result.timedOut) throw new Error("unreachable");
  assert.equal(result.code, 0);
  assert.equal(result.stdout, "ok\n");
  assert.equal(result.stderr, "");
  assert.equal(result.elapsedMs, 123);
  assert.equal(fakeChild.wasKilled(), true); // 終了処理は成功時も後始末する
});

test("既定 powershellPath は DEFAULT_POWERSHELL_PATH", async () => {
  const fakeChild = makeFakeChild();
  let usedCmd = null;
  const spawnImpl = (cmd) => {
    usedCmd = cmd;
    return fakeChild;
  };
  const p = runPowerShellScript("Write-Output 'x'", { spawnImpl });
  fakeChild.emit("exit", 0);
  await p;
  assert.equal(usedCmd, DEFAULT_POWERSHELL_PATH);
});

test("spawn error: code:null + stderr にメッセージを積んで正常終了扱いで解決", async () => {
  const fakeChild = makeFakeChild();
  const spawnImpl = () => fakeChild;
  const resultPromise = runPowerShellScript("Write-Output 'x'", { spawnImpl });
  fakeChild.emit("error", new Error("ENOENT: powershell.exe not found"));
  const result = await resultPromise;
  assert.equal(result.timedOut, false);
  if (result.timedOut) throw new Error("unreachable");
  assert.equal(result.code, null);
  assert.ok(result.stderr.includes("ENOENT"));
});

test("タイムアウト: setTimeoutImpl 即時発火で timedOut:true・子プロセスを kill", async () => {
  const fakeChild = makeFakeChild();
  const spawnImpl = () => fakeChild;
  // 即座に発火する fake timer（実時間を待たない）。
  const setTimeoutImpl = (fn) => {
    fn();
    return { unref() {} };
  };
  const clearTimeoutImpl = () => {};

  const result = await runPowerShellScript("Write-Output 'x'", {
    spawnImpl,
    setTimeoutImpl,
    clearTimeoutImpl,
    timeoutMs: 5000
  });
  assert.equal(result.timedOut, true);
  assert.equal(fakeChild.wasKilled(), true);
});

test("タイムアウト後に exit が来ても二重解決しない（settled ガード）", async () => {
  const fakeChild = makeFakeChild();
  const spawnImpl = () => fakeChild;
  const setTimeoutImpl = (fn) => {
    fn();
    return { unref() {} };
  };
  const result = await runPowerShellScript("Write-Output 'x'", {
    spawnImpl,
    setTimeoutImpl,
    clearTimeoutImpl: () => {},
    timeoutMs: 5000
  });
  assert.equal(result.timedOut, true);
  // タイムアウト確定後に遅れて exit が来ても例外にならない（Promise は既に解決済み）。
  assert.doesNotThrow(() => fakeChild.emit("exit", 0));
});

test("正常終了時に clearTimeoutImpl が呼ばれる（タイマの取り消し漏れなし）", async () => {
  const fakeChild = makeFakeChild();
  const spawnImpl = () => fakeChild;
  let cleared = false;
  const setTimeoutImpl = () => ({ unref() {} });
  const clearTimeoutImpl = () => {
    cleared = true;
  };
  const resultPromise = runPowerShellScript("Write-Output 'x'", {
    spawnImpl,
    setTimeoutImpl,
    clearTimeoutImpl,
    timeoutMs: 5000
  });
  fakeChild.emit("exit", 0);
  await resultPromise;
  assert.equal(cleared, true);
});
