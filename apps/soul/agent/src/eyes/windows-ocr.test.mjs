import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import { recognizeScreenText } from "./windows-ocr.mjs";

const frame = { jpegBase64: "dGVzdA==", capturedAtMs: 123 };
const line = { text: "ティフォロス", x: 0, y: 1, w: 2, h: 1 };
const emptyFrame = { width: 8, height: 2, lines: [], damageExclusions: [], strokeMask: "AIA=" };

function fakePowerShell(onInput) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killCount = 0;
  child.kill = () => child.killCount++;
  const spawnImpl = (_path, _args, options) => {
    assert.deepEqual(options.stdio, ["pipe", "pipe", "pipe"]);
    let input = "";
    child.stdin.setEncoding("utf8");
    child.stdin.on("data", (chunk) => { input += chunk; });
    child.stdin.once("end", () => onInput(child, input));
    return child;
  };
  return { child, spawnImpl };
}

function reply(stdout, code = 0) {
  return (child, input) => {
    assert.equal(input, frame.jpegBase64);
    // Simulate the child exiting before all of its stdout has been read.
    const bytes = Buffer.from(stdout);
    const split = bytes.findIndex((byte) => byte >= 0x80) + 1;
    child.stdout.write(bytes.subarray(0, split));
    child.emit("exit", code);
    child.stdout.end(bytes.subarray(split));
    child.emit("close", code);
  };
}

test("OCR preserves frame time, Unicode, geometry, damage evidence and the packed mask", async () => {
  const damage = { text: "182 に", x: 5, y: 0, w: 3, h: 1, rereadText: "1821" };
  const stdout = JSON.stringify({ ...emptyFrame, lines: [line], damageExclusions: [damage] });
  const { child, spawnImpl } = fakePowerShell(reply(stdout));
  assert.deepEqual(await recognizeScreenText(frame, { spawnImpl }), {
    capturedAtMs: 123, width: 8, height: 2, lines: [line], damageExclusions: [damage],
    strokeMask: { width: 8, height: 2, data: Buffer.from([0, 128]) }
  });
  assert.equal(child.killCount, 1);
});

test("OCR separates a successful blank frame from a missing language or failed process", async () => {
  const blank = fakePowerShell(reply(JSON.stringify(emptyFrame)));
  assert.deepEqual((await recognizeScreenText(frame, blank)).lines, []);

  for (const [stdout, code, kind] of [
    ['{"unavailable":true}', 0, "unavailable"],
    ["not JSON", 0, "failed"],
    [JSON.stringify({ ...emptyFrame, strokeMask: "" }), 0, "failed"],
    [JSON.stringify(emptyFrame), 1, "failed"]
  ]) {
    const { spawnImpl } = fakePowerShell(reply(stdout, code));
    assert.equal((await recognizeScreenText(frame, { spawnImpl })).error.kind, kind);
  }
});

test("OCR decodes exact color-tile signatures and ignores malformed optional evidence", async () => {
  const hashes = Buffer.from("01234567");
  const evidence = {...emptyFrame, tileSize: 8, pixelTiles: hashes.toString("base64")};
  const valid = fakePowerShell(reply(JSON.stringify(evidence)));
  assert.deepEqual((await recognizeScreenText(frame, valid)).pixelTiles, {width: 8, height: 2, tileSize: 8, data: hashes});
  const malformed = fakePowerShell(reply(JSON.stringify({...evidence, pixelTiles: "AAA="})));
  assert.equal((await recognizeScreenText(frame, malformed)).pixelTiles, undefined);
});

test("OCR cancellation stops the process and discards late output", async () => {
  const controller = new AbortController();
  const { child, spawnImpl } = fakePowerShell(() => controller.abort());
  const result = await recognizeScreenText(frame, { signal: controller.signal, spawnImpl });
  assert.equal(result.error.kind, "aborted");
  child.emit("close", 0);
  assert.equal(child.killCount, 1);

  await recognizeScreenText(frame, {
    signal: controller.signal,
    spawnImpl: () => assert.fail("spawned after cancellation")
  }).then((result) => assert.equal(result.error.kind, "aborted"));
});

test("OCR timeout stops an unresponsive process", async () => {
  const { child, spawnImpl } = fakePowerShell(() => {});
  // The real child keeps the event loop alive until the timeout.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    assert.equal((await recognizeScreenText(frame, { spawnImpl, timeoutMs: 10 })).error.kind, "timeout");
    assert.equal(child.killCount, 1);
  } finally {
    clearInterval(keepAlive);
  }
});
