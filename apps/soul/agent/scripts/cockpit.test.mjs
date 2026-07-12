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

test("createLazyChannel: sendEnvelope も接続を張り委譲する・sendSpeech と接続を共有する（S4）", { timeout: 5000 }, async () => {
  let connects = 0;
  /** @type {unknown[]} */
  const envelopes = [];
  const lazy = createLazyChannel("ws://127.0.0.1:1/channel?token=t", {
    connectImpl: /** @type {any} */ (async () => {
      connects += 1;
      return {
        sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 1 }),
        sendEnvelope: async (/** @type {unknown} */ intent) => {
          envelopes.push(intent);
          return { result: "accepted", error: null, rttMs: 1 };
        },
        close: async () => {}
      };
    })
  });

  assert.equal(connects, 0, "構築時点では接続しない（lazy）");
  const intent = { slotId: "head-tilt", peak: 0.2, attackMs: 100, sustainMs: 2000, decayMs: 300 };
  const r = await lazy.sendEnvelope(intent);
  assert.equal(r.result, "accepted");
  // 続く sendSpeech は同じ接続を再利用（speech と envelope は 1 本の接続を共有）。
  await lazy.sendSpeech([]);
  assert.equal(connects, 1, "envelope と speech は接続を共有する");
  assert.deepEqual(envelopes, [intent]);
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

// ── createLazyChannel: URL 後入力/変更（S3 追撃 domain-c）─────────────────────

test("createLazyChannel: URL 未設定なら sendSpeech は明示エラー（spawn 前の発火を弾く）", { timeout: 5000 }, async () => {
  let connects = 0;
  const lazy = createLazyChannel(null, {
    connectImpl: /** @type {any} */ (async () => {
      connects += 1;
      return { sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 1 }), close: async () => {} };
    })
  });
  assert.equal(lazy.getUrl(), null);
  assert.equal(lazy.connectionStatus(), "unset");
  await assert.rejects(() => lazy.sendSpeech([]), /channel URL is not set/);
  assert.equal(connects, 0, "URL 未設定では接続を試みない（spawn しない）");
});

test("createLazyChannel: setUrl で後から URL を設定すると次の fire で接続する", { timeout: 5000 }, async () => {
  let connects = 0;
  /** @type {string[]} */
  const connectedUrls = [];
  const lazy = createLazyChannel(null, {
    connectImpl: /** @type {any} */ (async (u) => {
      connects += 1;
      connectedUrls.push(u);
      return { sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 1 }), close: async () => {} };
    })
  });
  lazy.setUrl("ws://127.0.0.1:1/channel?token=t");
  assert.equal(lazy.getUrl(), "ws://127.0.0.1:1/channel?token=t");
  assert.equal(lazy.connectionStatus(), "idle");
  const r = await lazy.sendSpeech([]);
  assert.equal(r.result, "accepted");
  assert.equal(connects, 1);
  assert.equal(lazy.connectionStatus(), "connected");
  assert.deepEqual(connectedUrls, ["ws://127.0.0.1:1/channel?token=t"]);
});

test("createLazyChannel: URL 変更は既存接続キャッシュを破棄し・旧接続を畳み・新 URL で再接続する", { timeout: 5000 }, async () => {
  let connects = 0;
  let closed = 0;
  /** @type {string[]} */
  const connectedUrls = [];
  const lazy = createLazyChannel("ws://127.0.0.1:1/channel?token=old", {
    connectImpl: /** @type {any} */ (async (u) => {
      connects += 1;
      connectedUrls.push(u);
      return {
        sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 1 }),
        close: async () => {
          closed += 1;
        }
      };
    })
  });
  await lazy.sendSpeech([]); // old に接続。
  assert.equal(connects, 1);

  lazy.setUrl("ws://127.0.0.1:2/channel?token=new"); // 変更 → 旧キャッシュ破棄。
  // 旧接続の close は非同期 best-effort。マイクロタスクを 1 巡させて確定させる。
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(closed, 1, "旧接続は畳まれる");

  await lazy.sendSpeech([]); // new に再接続。
  assert.equal(connects, 2);
  assert.deepEqual(connectedUrls, ["ws://127.0.0.1:1/channel?token=old", "ws://127.0.0.1:2/channel?token=new"]);
});

test("createLazyChannel: 同一 URL の setUrl は接続を切らない（現状維持）", { timeout: 5000 }, async () => {
  let connects = 0;
  let closed = 0;
  const lazy = createLazyChannel("ws://127.0.0.1:1/channel?token=t", {
    connectImpl: /** @type {any} */ (async () => {
      connects += 1;
      return {
        sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 1 }),
        close: async () => {
          closed += 1;
        }
      };
    })
  });
  await lazy.sendSpeech([]);
  assert.equal(connects, 1);
  lazy.setUrl("ws://127.0.0.1:1/channel?token=t"); // 同一 → no-op。
  await Promise.resolve();
  assert.equal(closed, 0, "同一 URL では既存接続を切らない");
  await lazy.sendSpeech([]);
  assert.equal(connects, 1, "接続は再利用される");
});
