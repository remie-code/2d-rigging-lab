// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

import { parseListDevicesStdout, listAudioDevices } from "./audio-devices.mjs";

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
