// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseCockpitArgs, createLazyChannel } from "./cockpit.mjs";

// 起動導線のうち注入可能な純関数部分のテスト（S3 Domain B）。
// 実 SDK / 実 TTS / 実器 / 実マイクは使わない（fake connectImpl のみ）。

// ── parseCockpitArgs ──────────────────────────────────────────────────

test("parseCockpitArgs: no flags → everything undefined (S2.5 挙動不変の入口)", { timeout: 5000 }, () => {
  const args = parseCockpitArgs([]);
  assert.equal(args.port, undefined);
  assert.equal(args.help, false);
  assert.equal(args.channel, undefined);
  assert.equal(args.ttsBaseUrl, undefined);
  assert.equal(args.speaker, undefined);
  assert.equal(args.fireWindowMin, undefined);
  assert.equal(args.fireMaxChars, undefined);
});

test("parseCockpitArgs: --port keeps existing behaviour", { timeout: 5000 }, () => {
  assert.equal(parseCockpitArgs(["--port", "9000"]).port, 9000);
  assert.equal(parseCockpitArgs(["--help"]).help, true);
  assert.equal(parseCockpitArgs(["-h"]).help, true);
});

test("parseCockpitArgs: S3 fire flags are parsed (channel / tts / window / maxChars)", { timeout: 5000 }, () => {
  const args = parseCockpitArgs([
    "--channel", "ws://127.0.0.1:17310/channel?token=abc",
    "--tts-base-url", "http://127.0.0.1:10101",
    "--speaker", "888753760",
    "--fire-window-min", "3",
    "--fire-max-chars", "2000"
  ]);
  assert.equal(args.channel, "ws://127.0.0.1:17310/channel?token=abc");
  assert.equal(args.ttsBaseUrl, "http://127.0.0.1:10101");
  assert.equal(args.speaker, "888753760");
  assert.equal(args.fireWindowMin, 3);
  assert.equal(args.fireMaxChars, 2000);
});

// ── createLazyChannel（初回 fire 時接続・成功キャッシュ・失敗は再試行）──────────

test("createLazyChannel: connects on first sendSpeech and reuses the connection", { timeout: 5000 }, async () => {
  let connects = 0;
  /** @type {unknown[]} */
  const sent = [];
  const lazy = createLazyChannel("ws://127.0.0.1:1/channel?token=t", {
    connectImpl: /** @type {any} */ (async () => {
      connects += 1;
      return {
        sendSpeech: async (/** @type {unknown} */ timeline) => {
          sent.push(timeline);
          return { result: "accepted", error: null, rttMs: 1 };
        },
        close: async () => {}
      };
    })
  });

  assert.equal(connects, 0, "構築時点では接続しない（lazy）");
  const r1 = await lazy.sendSpeech([{ timeMs: 0, vowel: "a", s: 1 }]);
  assert.equal(r1.result, "accepted");
  await lazy.sendSpeech([]);
  assert.equal(connects, 1, "2 回目の sendSpeech は接続を再利用する");
  assert.equal(sent.length, 2);
});

test("createLazyChannel: connect failure throws and is retried on the next call", { timeout: 5000 }, async () => {
  let connects = 0;
  const lazy = createLazyChannel("ws://127.0.0.1:1/channel?token=t", {
    connectImpl: /** @type {any} */ (async () => {
      connects += 1;
      if (connects === 1) throw new Error("connection refused");
      return {
        sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 1 }),
        close: async () => {}
      };
    })
  });

  await assert.rejects(() => lazy.sendSpeech([]), /connection refused/);
  // 失敗はキャッシュされない = 次の fire で再接続を試みる（器を後から立ててよい）。
  const r = await lazy.sendSpeech([]);
  assert.equal(r.result, "accepted");
  assert.equal(connects, 2);
});

test("createLazyChannel: close() closes the cached connection; no-op when never connected", { timeout: 5000 }, async () => {
  let closed = 0;
  const lazy = createLazyChannel("ws://127.0.0.1:1/channel?token=t", {
    connectImpl: /** @type {any} */ (async () => ({
      sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 1 }),
      close: async () => {
        closed += 1;
      }
    }))
  });

  await lazy.close(); // 未接続 close は no-op（throw しない）。
  assert.equal(closed, 0);

  await lazy.sendSpeech([]);
  await lazy.close();
  assert.equal(closed, 1);

  await lazy.close(); // 冪等。
  assert.equal(closed, 1);
});
