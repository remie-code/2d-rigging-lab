import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGameDialogueOcrScheduler,
  resolveStreamGameOcrInterval
} from "./game-dialogue-ocr-scheduler.mjs";

const frame = (capturedAtMs, text) => ({
  capturedAtMs,
  width: 1474,
  height: 829,
  lines: text ? [{ text, x: 500, y: 600, w: 200, h: 24 }] : []
});

function harness(options) {
  const timers = new Map();
  let now = 0;
  const scheduler = createGameDialogueOcrScheduler({
    nowImpl: () => now,
    setIntervalImpl(run, delay) {
      const id = Symbol();
      timers.set(id, { run, delay });
      return id;
    },
    clearIntervalImpl: (id) => timers.delete(id),
    ...options
  });
  return {
    ...scheduler,
    timers,
    tick() {
      const [{ run, delay }] = timers.values();
      now += delay;
      return run();
    }
  };
}

test("external interval controls sampling ticks and invalid values restore the default", async () => {
  for (const raw of [undefined, "", "0", "-10", "20.5", "1e3", "2500ms", "2147483648", "Infinity"]) {
    assert.equal(resolveStreamGameOcrInterval(raw), 1000);
  }
  for (const [raw, ms] of [[undefined, 1000], [" 900 ", 900], ["2500", 2500]]) {
    const sampledAt = [];
    const scheduler = harness({
      intervalMs: resolveStreamGameOcrInterval(raw),
      captureImpl: async () => ({ jpegBase64: "sample" }),
      recognizeImpl: async ({ capturedAtMs }) => {
        sampledAt.push(capturedAtMs);
        return frame(capturedAtMs);
      }
    });
    scheduler.setSource({ addGameScreen: assert.fail }, "Game");
    await new Promise(setImmediate);
    await scheduler.tick();
    await scheduler.tick();
    assert.deepEqual(sampledAt, [0, ms, 2 * ms]);
    scheduler.setSource(null);
    assert.equal(scheduler.timers.size, 0);
  }
});

test("slow recognition skips ticks and cancellation keeps a stale result out of a new venue", async () => {
  let finish;
  let signal;
  let sampleCount = 0;
  const scheduler = harness({
    captureImpl: async () => ({ jpegBase64: "sample" }),
    recognizeImpl: ({ capturedAtMs }, options) => {
      signal = options.signal;
      if (++sampleCount === 1) return frame(capturedAtMs, "前の場の台詞");
      if (sampleCount === 2) {
        return new Promise((resolve) => { finish = () => resolve(frame(capturedAtMs, "まったく違う文")); });
      }
      return frame(capturedAtMs, "再開した場の文");
    }
  });
  const oldBuffer = { addGameScreen: assert.fail };
  const newBuffer = { addGameScreen: assert.fail };
  scheduler.setSource(oldBuffer, "Game");
  await new Promise(setImmediate);
  const stale = scheduler.tick();
  await scheduler.tick();
  await scheduler.tick();
  assert.equal(sampleCount, 2);

  scheduler.setSource(null);
  assert.equal(signal.aborted, true);
  scheduler.setSource(newBuffer, "Game");
  await scheduler.tick();
  assert.equal(sampleCount, 2);
  finish();
  await stale;
  await scheduler.tick();
  assert.equal(sampleCount, 3);
});

test("window loss and same-title replacement discard pending display without resetting order", async () => {
  const inputs = [
    { jpegBase64: "消えた窓の台詞", windowIdentity: "1:100" },
    { error: { kind: "notFound" } },
    { jpegBase64: "別の場面の古い文章", windowIdentity: "1:100" },
    { jpegBase64: "鉄塔の明かりが見える。", windowIdentity: "4:200" },
    { jpegBase64: "山小屋の手前で待っている。", windowIdentity: "4:200" }
  ];
  const blocks = [];
  const scheduler = harness({
    captureImpl: async () => inputs.shift(),
    recognizeImpl: async ({ capturedAtMs, jpegBase64 }) => frame(capturedAtMs, jpegBase64)
  });
  scheduler.setSource({ addGameScreen: (block) => blocks.push(block) }, "Game");
  await new Promise(setImmediate);
  for (let index = 0; index < 4; index++) await scheduler.tick();
  assert.deepEqual(blocks.map(({ text, displayOrder }) => ({ text, displayOrder })), [
    { text: "鉄塔の明かりが見える。", displayOrder: 3 }
  ]);
});
