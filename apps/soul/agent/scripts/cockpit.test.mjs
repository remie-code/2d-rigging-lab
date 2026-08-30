// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseCockpitArgs,
  buildBrainSessionSystemPrompt,
  createLazyChannel,
  createSessionProxy,
  createInstructionRevisionController,
  createConversationInstructionHooks,
  createVisionTargetHooks,
  createAudioDeviceHooks,
  createSelfFireHooks,
  createBargeInHooks,
  createVerbosityHooks,
  createBrainHooks,
  createChatSourceHooks,
  createMemoryHooks,
  shouldSkipMemoryCheckpoint,
  createMemoryRecorder,
  raceMemoryRecordWithTimeout,
  MEMORY_CHECKPOINT_INTERVAL_MS,
  MEMORY_INJECT_MAX_CHARS,
  SHUTDOWN_MEMORY_TIMEOUT_MS
} from "./cockpit.mjs";
import { createTranscriptBuffer } from "../src/ears/transcript-buffer.mjs";
import { createFireOrchestrator, resolveConversationInstructionProfile } from "../src/mind/fire-orchestrator.mjs";

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
  assert.equal(lazy.acceptedConnectionGeneration(), 1, "accepted Fire reserves the next logical generation");
  const r1 = await lazy.sendSpeech([{ timeMs: 0, vowel: "a", s: 1 }]);
  assert.equal(r1.result, "accepted");
  assert.equal(lazy.connectionGeneration(), 1);
  assert.equal(lazy.acceptedConnectionGeneration(), 1, "cached connection keeps its accepted generation");
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

test("createLazyChannel: close-before-reply invalidates only the failed generation and next Fire reconnects once", async () => {
  let connects = 0;
  let closes = 0;
  const sends = [];
  const lazy = createLazyChannel("ws://127.0.0.1:1/channel?token=t", {
    connectImpl: async () => {
      const generation = ++connects;
      return {
        async sendSpeech() {
          sends.push(generation);
          if (generation === 1) {
            const error = new Error("closed");
            error.code = "channel_closed";
            throw error;
          }
          return { result: "accepted", error: null, rttMs: 1 };
        },
        async close() { closes += 1; }
      };
    }
  });
  await assert.rejects(() => lazy.sendSpeech([]), (error) => error.code === "channel_closed");
  assert.equal(lazy.acceptedConnectionGeneration(), 2, "terminal failure reserves only the next Fire generation");
  assert.deepEqual(await lazy.sendSpeech([]), { result: "accepted", error: null, rttMs: 1 });
  assert.equal(lazy.connectionGeneration(), 2);
  assert.deepEqual(sends, [1, 2], "failed request is not retried; later request uses one fresh generation");
  assert.equal(connects, 2);
  await Promise.resolve();
  assert.equal(closes, 1);
  await lazy.close();
});

test("createLazyChannel: reply timeout is ambiguous, never retries current request, and next Fire reconnects", async () => {
  let connects = 0;
  const sends = [];
  const lazy = createLazyChannel("ws://127.0.0.1:1/channel?token=t", {
    connectImpl: async () => {
      const generation = ++connects;
      return {
        async sendSpeech() {
          sends.push(generation);
          if (generation === 1) {
            const error = new Error("timeout");
            error.code = "reply_timeout";
            throw error;
          }
          return { result: "accepted", error: null, rttMs: 1 };
        },
        async close() {}
      };
    }
  });
  await assert.rejects(() => lazy.sendSpeech([]), (error) => error.code === "reply_timeout");
  await lazy.sendSpeech([]);
  assert.deepEqual(sends, [1, 2]);
  await lazy.close();
});

test("createLazyChannel: local 4096 preflight failure preserves the healthy cached connection", async () => {
  let connects = 0;
  let sends = 0;
  const lazy = createLazyChannel("ws://127.0.0.1:1/channel?token=t", {
    connectImpl: async () => {
      connects += 1;
      return {
        async sendSpeech() {
          sends += 1;
          if (sends === 1) {
            const error = new Error("oversize");
            error.code = "speech_envelope_oversize";
            throw error;
          }
          return { result: "accepted", error: null, rttMs: 1 };
        },
        async close() {}
      };
    }
  });
  await assert.rejects(() => lazy.sendSpeech([]), (error) => error.code === "speech_envelope_oversize");
  await lazy.sendSpeech([]);
  assert.equal(connects, 1);
  assert.equal(sends, 2);
  await lazy.close();
});

test("createLazyChannel: superseded in-flight connect failure cannot clear the newer exact cache", async () => {
  let rejectOld;
  let connects = 0;
  const lazy = createLazyChannel("ws://127.0.0.1:1/channel?token=old", {
    connectImpl: async (url) => {
      connects += 1;
      if (url.includes("old")) {
        await new Promise((_, reject) => { rejectOld = reject; });
      }
      return {
        async sendSpeech() { return { result: "accepted", error: null, rttMs: 1 }; },
        async close() {}
      };
    }
  });
  const oldRequest = lazy.sendSpeech([]);
  await Promise.resolve();
  lazy.setUrl("ws://127.0.0.1:2/channel?token=new");
  const newRequest = lazy.sendSpeech([]);
  rejectOld(new Error("old connect failed late"));
  await assert.rejects(() => oldRequest, /old connect failed late/);
  assert.equal((await newRequest).result, "accepted");
  assert.equal((await lazy.sendSpeech([])).result, "accepted");
  assert.equal(connects, 2, "late old failure did not evict the newer cached generation");
  await lazy.close();
});

// ── createSessionProxy（S5: ask の string | content配列 透過）─────────────────

test("createSessionProxy: URL 未設定なら ask は明示エラー（ensureFireResources を呼ばない・spawn しない）", { timeout: 5000 }, async () => {
  let ensureCalled = false;
  const proxy = createSessionProxy({
    getUrl: () => null,
    ensureFireResources: () => {
      ensureCalled = true;
    },
    getSession: () => {
      throw new Error("getSession should not be called when URL is unset");
    }
  });
  await assert.rejects(() => proxy.ask("hello"), /Channel URL is not set/);
  assert.equal(ensureCalled, false);
});

test("createSessionProxy: desired Channel URL is applied at the next accepted Fire boundary before URL validation", { timeout: 5000 }, async () => {
  let appliedUrl = null;
  let created = 0;
  const fakeSession = { ask: async () => ({ replyText: "ready" }) };
  const proxy = createSessionProxy({
    getUrl: () => appliedUrl,
    ensureSessionCurrent: async () => {
      appliedUrl = "ws://127.0.0.1:1/channel?token=next";
    },
    ensureFireResources: () => {
      created += 1;
    },
    getSession: () => fakeSession
  });

  const out = await proxy.ask("next fire");
  assert.equal(out.replyText, "ready");
  assert.equal(created, 1);
});

test("createSessionProxy: 文字列入力を session.ask へそのまま透過する（無退行）", { timeout: 5000 }, async () => {
  const calls = [];
  let ensureCalled = false;
  const fakeSession = {
    async ask(input) {
      calls.push(input);
      return { replyText: "こたえ" };
    }
  };
  const proxy = createSessionProxy({
    getUrl: () => "ws://127.0.0.1:1/channel?token=t",
    ensureFireResources: () => {
      ensureCalled = true;
    },
    getSession: () => fakeSession
  });
  const out = await proxy.ask("こんにちは");
  assert.equal(ensureCalled, true);
  assert.deepEqual(calls, ["こんにちは"]);
  assert.equal(out.replyText, "こたえ");
});

test("createSessionProxy: content ブロック配列入力を session.ask へそのまま透過する（視覚発火の口）", { timeout: 5000 }, async () => {
  const calls = [];
  const fakeSession = {
    async ask(input) {
      calls.push(input);
      return { replyText: "みえた" };
    }
  };
  const proxy = createSessionProxy({
    getUrl: () => "ws://127.0.0.1:1/channel?token=t",
    ensureFireResources: () => {},
    getSession: () => fakeSession
  });
  const blocks = [
    { type: "image", source: { type: "base64", data: "ZmFrZQ==", media_type: "image/jpeg" } },
    { type: "text", text: "今の画面を見て反応してください。" }
  ];
  const out = await proxy.ask(blocks);
  assert.equal(calls.length, 1);
  assert.ok(Array.isArray(calls[0]));
  assert.deepEqual(calls[0], blocks);
  assert.equal(out.replyText, "みえた");
});

test("createSessionProxy: onTextDelta ask option を lazy App Server session へ同一参照で透過する", { timeout: 5000 }, async () => {
  const calls = [];
  const onTextDelta = () => {};
  const askOptions = { onTextDelta };
  const proxy = createSessionProxy({
    getUrl: () => "ws://127.0.0.1:1/channel?token=t",
    ensureFireResources: () => {},
    getSession: () => ({
      async ask(input, options) {
        calls.push({ input, options });
        return { replyText: "逐次応答。" };
      }
    })
  });

  await proxy.ask("こんにちは", askOptions);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, "こんにちは");
  assert.equal(calls[0].options, askOptions);
  assert.equal(calls[0].options.onTextDelta, onTextDelta);
});

test("C1 production seam: Fire → lazy session proxy → Codex delta → safe sentence enqueue を一 turn で貫通する", { timeout: 5000 }, async () => {
  const buffer = createTranscriptBuffer();
  buffer.append({ startMs: 0, endMs: 1, text: "返事して" });
  const enqueued = [];
  const spoken = [];
  let askCount = 0;
  const appServerLikeSession = {
    async ask(_input, askOptions) {
      askCount += 1;
      askOptions.onTextDelta("最初。");
      assert.deepEqual(enqueued.map((chunk) => chunk.text), ["最初。"]);
      askOptions.onTextDelta("<nod>残り");
      return { replyText: "最初。<nod>残り" };
    }
  };
  const proxy = createSessionProxy({
    getUrl: () => "ws://127.0.0.1:1/channel?token=t",
    ensureFireResources: () => {},
    getSession: () => appServerLikeSession
  });
  const orchestrator = createFireOrchestrator({
    getBuffer: () => buffer,
    session: proxy,
    speakImpl: async (text) => {
      spoken.push(text);
      return { timeline: [], wavDurationSec: 0, playbackStartedAtMs: Date.now() };
    },
    channel: {},
    player: { play() {} },
    onProgressiveSentence: (chunk) => enqueued.push(chunk)
  });

  const result = await orchestrator.fire();
  assert.equal(askCount, 1);
  assert.deepEqual(enqueued, [
    { text: "最初。", index: 0, final: false },
    { text: "残り", index: 1, final: true }
  ]);
  assert.deepEqual(spoken, ["最初。残り"]);
  assert.equal(result.fired, true);
  orchestrator.dispose();
});

// ── createVisionTargetHooks（S5: 対象ウインドウ設定の settings ⇄ cockpit-server/orchestrator 橋渡し）───

/** fake settings（cockpit-settings-store と同型の getVisionTarget/setVisionTarget を持つ最小 fake）。 */
function makeFakeVisionSettings(initial = null) {
  let current = initial;
  return {
    getVisionTarget: () => current,
    setVisionTarget: (title) => {
      current = title ?? null;
    }
  };
}

test("createVisionTargetHooks: getVisionTarget は settings.getVisionTarget をそのまま返す", { timeout: 5000 }, () => {
  const settings = makeFakeVisionSettings("Sample Game");
  const hooks = createVisionTargetHooks(settings);
  assert.equal(hooks.getVisionTarget(), "Sample Game");
});

test("createVisionTargetHooks: onSetVisionTarget は settings.setVisionTarget へ橋渡しする", { timeout: 5000 }, () => {
  const settings = makeFakeVisionSettings(null);
  const hooks = createVisionTargetHooks(settings);
  hooks.onSetVisionTarget("Another Window");
  assert.equal(settings.getVisionTarget(), "Another Window");
  assert.equal(hooks.getVisionTarget(), "Another Window");
  // null/undefined はクリア。
  hooks.onSetVisionTarget(null);
  assert.equal(settings.getVisionTarget(), null);
});

test("createVisionTargetHooks: visionTargetStatus は現在の title を { title } で返す", { timeout: 5000 }, () => {
  const settings = makeFakeVisionSettings(null);
  const hooks = createVisionTargetHooks(settings);
  assert.deepEqual(hooks.visionTargetStatus(), { title: null });
  hooks.onSetVisionTarget("Sample Game");
  assert.deepEqual(hooks.visionTargetStatus(), { title: "Sample Game" });
});

test("createVisionTargetHooks: settings.setVisionTarget が throw しても onSetVisionTarget は握って続行する", { timeout: 5000 }, () => {
  const settings = {
    getVisionTarget: () => null,
    setVisionTarget: () => {
      throw new Error("disk full");
    }
  };
  const hooks = createVisionTargetHooks(settings);
  assert.doesNotThrow(() => hooks.onSetVisionTarget("Sample Game"));
});

// ── createAudioDeviceHooks（S6「会話が続く」: 出力デバイス設定の settings ⇄ cockpit-server 橋渡し）───

/** fake settings（cockpit-settings-store と同型の getAudioDevice/setAudioDevice を持つ最小 fake）。 */
function makeFakeAudioDeviceSettings(initial = null) {
  let current = initial;
  return {
    getAudioDevice: () => current,
    setAudioDevice: (name) => {
      current = name ?? null;
    }
  };
}

test("createAudioDeviceHooks: getAudioDevice は settings.getAudioDevice をそのまま返す", { timeout: 5000 }, () => {
  const settings = makeFakeAudioDeviceSettings("ヘッドホン (2- Shure MV7+)");
  const hooks = createAudioDeviceHooks(settings);
  assert.equal(hooks.getAudioDevice(), "ヘッドホン (2- Shure MV7+)");
});

test("createAudioDeviceHooks: onSetAudioDevice は settings.setAudioDevice へ橋渡しする", { timeout: 5000 }, () => {
  const settings = makeFakeAudioDeviceSettings(null);
  const hooks = createAudioDeviceHooks(settings);
  hooks.onSetAudioDevice("スピーカー (Realtek(R) Audio)");
  assert.equal(settings.getAudioDevice(), "スピーカー (Realtek(R) Audio)");
  assert.equal(hooks.getAudioDevice(), "スピーカー (Realtek(R) Audio)");
  // null/undefined はクリア。
  hooks.onSetAudioDevice(null);
  assert.equal(settings.getAudioDevice(), null);
});

test("createAudioDeviceHooks: audioDeviceStatus は現在の name を { name } で返す", { timeout: 5000 }, () => {
  const settings = makeFakeAudioDeviceSettings(null);
  const hooks = createAudioDeviceHooks(settings);
  assert.deepEqual(hooks.audioDeviceStatus(), { name: null });
  hooks.onSetAudioDevice("ヘッドホン (2- Shure MV7+)");
  assert.deepEqual(hooks.audioDeviceStatus(), { name: "ヘッドホン (2- Shure MV7+)" });
});

test("createAudioDeviceHooks: settings.setAudioDevice が throw しても onSetAudioDevice は握って続行する", { timeout: 5000 }, () => {
  const settings = {
    getAudioDevice: () => null,
    setAudioDevice: () => {
      throw new Error("disk full");
    }
  };
  const hooks = createAudioDeviceHooks(settings);
  assert.doesNotThrow(() => hooks.onSetAudioDevice("Some Device"));
});

// ── createSelfFireHooks（S6「会話が続く」: 自発発火 ON/OFF トグルの settings 橋渡し）───────────

/** fake settings（cockpit-settings-store と同型の getSelfFireEnabled/setSelfFireEnabled を持つ最小 fake）。 */
function makeFakeSelfFireSettings(initial = null) {
  let current = initial;
  return {
    getSelfFireEnabled: () => current,
    setSelfFireEnabled: (enabled) => {
      current = enabled === true;
    }
  };
}

test("createSelfFireHooks: 未記憶（null）なら defaultEnabled にフォールバックする（既定 false）", { timeout: 5000 }, () => {
  const settings = makeFakeSelfFireSettings(null);
  const hooks = createSelfFireHooks(settings);
  assert.equal(hooks.resolveInitialEnabled(), false);
});

test("createSelfFireHooks: defaultEnabled を明示指定できる", { timeout: 5000 }, () => {
  const settings = makeFakeSelfFireSettings(null);
  const hooks = createSelfFireHooks(settings, true);
  assert.equal(hooks.resolveInitialEnabled(), true);
});

test("createSelfFireHooks: 記憶済みの bool（true/false）は defaultEnabled より優先される", { timeout: 5000 }, () => {
  const settingsTrue = makeFakeSelfFireSettings(true);
  assert.equal(createSelfFireHooks(settingsTrue, false).resolveInitialEnabled(), true);
  const settingsFalse = makeFakeSelfFireSettings(false);
  assert.equal(createSelfFireHooks(settingsFalse, true).resolveInitialEnabled(), false);
});

test("createSelfFireHooks: onSetSelfFireEnabled は settings.setSelfFireEnabled へ橋渡しし・次回 resolveInitialEnabled に反映する", { timeout: 5000 }, () => {
  const settings = makeFakeSelfFireSettings(null);
  const hooks = createSelfFireHooks(settings, false);
  hooks.onSetSelfFireEnabled(true);
  assert.equal(settings.getSelfFireEnabled(), true);
  assert.equal(hooks.resolveInitialEnabled(), true);
});

test("createSelfFireHooks: settings.setSelfFireEnabled が throw しても onSetSelfFireEnabled は握って続行する", { timeout: 5000 }, () => {
  const settings = {
    getSelfFireEnabled: () => null,
    setSelfFireEnabled: () => {
      throw new Error("disk full");
    }
  };
  const hooks = createSelfFireHooks(settings);
  assert.doesNotThrow(() => hooks.onSetSelfFireEnabled(true));
});

// ── createBargeInHooks（「朗読と合いの手」: barge-in ON/OFF トグルの settings 橋渡し・
//    createSelfFireHooks の写経・**既定 ON**は非対称）────────────────────────────────

/** fake settings（cockpit-settings-store と同型の getBargeInEnabled/setBargeInEnabled を持つ最小 fake）。 */
function makeFakeBargeInSettings(initial = null) {
  let current = initial;
  return {
    getBargeInEnabled: () => current,
    setBargeInEnabled: (enabled) => {
      current = enabled === true;
    }
  };
}

test("createBargeInHooks: 未記憶（null）なら defaultEnabled にフォールバックする（既定 true・selfFire とは非対称）", { timeout: 5000 }, () => {
  const settings = makeFakeBargeInSettings(null);
  const hooks = createBargeInHooks(settings);
  assert.equal(hooks.resolveInitialEnabled(), true);
});

test("createBargeInHooks: defaultEnabled を明示指定できる", { timeout: 5000 }, () => {
  const settings = makeFakeBargeInSettings(null);
  const hooks = createBargeInHooks(settings, false);
  assert.equal(hooks.resolveInitialEnabled(), false);
});

test("createBargeInHooks: 記憶済みの bool（true/false）は defaultEnabled より優先される", { timeout: 5000 }, () => {
  const settingsTrue = makeFakeBargeInSettings(true);
  assert.equal(createBargeInHooks(settingsTrue, false).resolveInitialEnabled(), true);
  const settingsFalse = makeFakeBargeInSettings(false);
  assert.equal(createBargeInHooks(settingsFalse, true).resolveInitialEnabled(), false);
});

test("createBargeInHooks: onSetBargeInEnabled は settings.setBargeInEnabled へ橋渡しし・次回 resolveInitialEnabled に反映する", { timeout: 5000 }, () => {
  const settings = makeFakeBargeInSettings(null);
  const hooks = createBargeInHooks(settings, true);
  hooks.onSetBargeInEnabled(false);
  assert.equal(settings.getBargeInEnabled(), false);
  assert.equal(hooks.resolveInitialEnabled(), false);
});

test("createBargeInHooks: settings.setBargeInEnabled が throw しても onSetBargeInEnabled は握って続行する", { timeout: 5000 }, () => {
  const settings = {
    getBargeInEnabled: () => null,
    setBargeInEnabled: () => {
      throw new Error("disk full");
    }
  };
  const hooks = createBargeInHooks(settings);
  assert.doesNotThrow(() => hooks.onSetBargeInEnabled(true));
});

// ── createMemoryHooks（配信間記憶: 記憶 ON/OFF トグルの settings 橋渡し・
//    createBargeInHooks の完全写経・**既定 ON**は createBargeInHooks と同じ非対称）─────────────

/** fake settings（cockpit-settings-store と同型の getMemoryEnabled/setMemoryEnabled を持つ最小 fake）。 */
function makeFakeMemorySettings(initial = null) {
  let current = initial;
  return {
    getMemoryEnabled: () => current,
    setMemoryEnabled: (enabled) => {
      current = enabled === true;
    }
  };
}

test("createMemoryHooks: 未記憶（null）なら defaultEnabled にフォールバックする（既定 true・裁定 1）", { timeout: 5000 }, () => {
  const settings = makeFakeMemorySettings(null);
  const hooks = createMemoryHooks(settings);
  assert.equal(hooks.resolveInitialEnabled(), true);
});

test("createMemoryHooks: defaultEnabled を明示指定できる", { timeout: 5000 }, () => {
  const settings = makeFakeMemorySettings(null);
  const hooks = createMemoryHooks(settings, false);
  assert.equal(hooks.resolveInitialEnabled(), false);
});

test("createMemoryHooks: 記憶済みの bool（true/false）は defaultEnabled より優先される", { timeout: 5000 }, () => {
  const settingsTrue = makeFakeMemorySettings(true);
  assert.equal(createMemoryHooks(settingsTrue, false).resolveInitialEnabled(), true);
  const settingsFalse = makeFakeMemorySettings(false);
  assert.equal(createMemoryHooks(settingsFalse, true).resolveInitialEnabled(), false);
});

test("createMemoryHooks: onSetMemoryEnabled は settings.setMemoryEnabled へ橋渡しし・次回 resolveInitialEnabled に反映する", { timeout: 5000 }, () => {
  const settings = makeFakeMemorySettings(null);
  const hooks = createMemoryHooks(settings, true);
  hooks.onSetMemoryEnabled(false);
  assert.equal(settings.getMemoryEnabled(), false);
  assert.equal(hooks.resolveInitialEnabled(), false);
});

test("createMemoryHooks: settings.setMemoryEnabled が throw しても onSetMemoryEnabled は握って続行する", { timeout: 5000 }, () => {
  const settings = {
    getMemoryEnabled: () => null,
    setMemoryEnabled: () => {
      throw new Error("disk full");
    }
  };
  const hooks = createMemoryHooks(settings);
  assert.doesNotThrow(() => hooks.onSetMemoryEnabled(true));
});

// ── shouldSkipMemoryCheckpoint（inventory §2-4「転写が前回記録から不変ならスキップ」の純判定）───

test("shouldSkipMemoryCheckpoint: 現在の件数が前回記録時と同じならスキップ(true)", { timeout: 5000 }, () => {
  assert.equal(shouldSkipMemoryCheckpoint(12, 12), true);
  assert.equal(shouldSkipMemoryCheckpoint(0, 0), true);
});

test("shouldSkipMemoryCheckpoint: 現在の件数が前回記録時と異なればスキップしない(false)", { timeout: 5000 }, () => {
  assert.equal(shouldSkipMemoryCheckpoint(13, 12), false);
  assert.equal(shouldSkipMemoryCheckpoint(0, 5), false);
});

// ── createMemoryRecorder（配信間記憶: 一つの記録動作・チェックポイント/手動/shutdown 最終版が共有）───
//
//  実 generateDigest/saveDigest（memory.mjs）は使わず fake 注入する（実 LLM/実 FS 消費ゼロ）。
//  main() の recordMemory はこのファクトリの戻り値そのものであり、ここで固定した不変条件が
//  main() の実際の呼び出し（checkpoint/手動/shutdown）にもそのまま効く。

test("createMemoryRecorder: OFF（isEnabled=false）なら generateDigest/saveDigest を一切呼ばない（blocking #4）", { timeout: 5000 }, async () => {
  let generateCalls = 0;
  let saveCalls = 0;
  const recordMemory = createMemoryRecorder({
    isEnabled: () => false,
    getLiveEntries: () => [{ text: "hello", speaker: "you" }],
    getBrainDef: () => ({ create: () => ({}) }),
    generateDigestImpl: async () => {
      generateCalls += 1;
      return "digest";
    },
    saveDigestImpl: () => {
      saveCalls += 1;
      return "/tmp/x.md";
    },
    dir: "/tmp/memories",
    getStartedAtMs: () => 1000
  });
  await recordMemory();
  assert.equal(generateCalls, 0);
  assert.equal(saveCalls, 0);
});

test("createMemoryRecorder: 空転写（generateDigest が null を返す）なら saveDigest を呼ばない・onSaved も呼ばない", { timeout: 5000 }, async () => {
  let saveCalls = 0;
  let savedCalls = 0;
  const recordMemory = createMemoryRecorder({
    isEnabled: () => true,
    getLiveEntries: () => [],
    getBrainDef: () => ({ create: () => ({}) }),
    generateDigestImpl: async () => null,
    saveDigestImpl: () => {
      saveCalls += 1;
      return "/tmp/x.md";
    },
    dir: "/tmp/memories",
    getStartedAtMs: () => 1000,
    onSaved: () => {
      savedCalls += 1;
    }
  });
  await recordMemory();
  assert.equal(saveCalls, 0);
  assert.equal(savedCalls, 0);
});

test("createMemoryRecorder: 成功経路は generateDigest→saveDigest(dir/startedAtMs 付き)→onSaved(atMs/entriesLength) の順で呼ぶ", { timeout: 5000 }, async () => {
  /** @type {any[]} */
  const calls = [];
  const entries = [{ text: "a" }, { text: "b" }, { text: "c" }];
  const recordMemory = createMemoryRecorder({
    isEnabled: () => true,
    getLiveEntries: () => entries,
    getBrainDef: () => ({ id: "fake-brain", create: () => ({}) }),
    generateDigestImpl: async (opts) => {
      calls.push({ kind: "generate", brainDef: opts.brainDef, entries: opts.entries });
      return "今日の出来事のダイジェスト";
    },
    saveDigestImpl: (digest, opts) => {
      calls.push({ kind: "save", digest, dir: opts.dir, startedAtMs: opts.startedAtMs });
      return "/tmp/memories/2026-07-19T00-00-00.md";
    },
    dir: "/tmp/memories",
    getStartedAtMs: () => 1784000000000,
    onSaved: (info) => calls.push({ kind: "saved", ...info })
  });
  await recordMemory();
  assert.equal(calls.length, 3);
  assert.equal(calls[0].kind, "generate");
  assert.deepEqual(calls[0].entries, entries);
  assert.equal(calls[0].brainDef.id, "fake-brain");
  assert.equal(calls[1].kind, "save");
  assert.equal(calls[1].digest, "今日の出来事のダイジェスト");
  assert.equal(calls[1].dir, "/tmp/memories");
  assert.equal(calls[1].startedAtMs, 1784000000000);
  assert.equal(calls[2].kind, "saved");
  assert.equal(calls[2].entriesLength, 3);
  assert.equal(typeof calls[2].atMs, "number");
});

test("createMemoryRecorder: entriesOverride 指定時はライブ転写（getLiveEntries）を呼ばず override をそのまま使う", { timeout: 5000 }, async () => {
  let liveCalls = 0;
  /** @type {any[]} */
  let seenEntries = null;
  const override = [{ text: "final entry" }];
  const recordMemory = createMemoryRecorder({
    isEnabled: () => true,
    getLiveEntries: () => {
      liveCalls += 1;
      return [{ text: "should not be used" }];
    },
    getBrainDef: () => ({ create: () => ({}) }),
    generateDigestImpl: async (opts) => {
      seenEntries = opts.entries;
      return "digest";
    },
    saveDigestImpl: () => "/tmp/x.md",
    dir: "/tmp/memories",
    getStartedAtMs: () => 1000
  });
  await recordMemory(override);
  assert.equal(liveCalls, 0);
  assert.deepEqual(seenEntries, override);
});

test("createMemoryRecorder: generateDigest が throw しても握って続行する（onError に渡る・呼び出し元は投げられない）", { timeout: 5000 }, async () => {
  /** @type {unknown[]} */
  const errors = [];
  const recordMemory = createMemoryRecorder({
    isEnabled: () => true,
    getLiveEntries: () => [{ text: "hi" }],
    getBrainDef: () => ({ create: () => ({}) }),
    generateDigestImpl: async () => {
      throw new Error("LLM を起動できませんでした");
    },
    saveDigestImpl: () => {
      throw new Error("should not be called");
    },
    dir: "/tmp/memories",
    getStartedAtMs: () => 1000,
    onError: (error) => errors.push(error)
  });
  await assert.doesNotReject(() => recordMemory());
  assert.equal(errors.length, 1);
  assert.match(/** @type {Error} */ (errors[0]).message, /LLM を起動できませんでした/);
});

test("createMemoryRecorder: saveDigest が throw しても握って続行する（Domain A 申し送り 2・onSaved は呼ばれない）", { timeout: 5000 }, async () => {
  /** @type {unknown[]} */
  const errors = [];
  let savedCalls = 0;
  const recordMemory = createMemoryRecorder({
    isEnabled: () => true,
    getLiveEntries: () => [{ text: "hi" }],
    getBrainDef: () => ({ create: () => ({}) }),
    generateDigestImpl: async () => "digest",
    saveDigestImpl: () => {
      throw new Error("ENOSPC: disk full");
    },
    dir: "/tmp/memories",
    getStartedAtMs: () => 1000,
    onSaved: () => {
      savedCalls += 1;
    },
    onError: (error) => errors.push(error)
  });
  await assert.doesNotReject(() => recordMemory());
  assert.equal(savedCalls, 0);
  assert.equal(errors.length, 1);
  assert.match(/** @type {Error} */ (errors[0]).message, /ENOSPC/);
});

// ── raceMemoryRecordWithTimeout（配信間記憶: shutdown 最終生成の best-effort + timeout・blocking #3）──

test("raceMemoryRecordWithTimeout: promise が先に解決すれば timeout を待たず即座に返る", { timeout: 5000 }, async () => {
  const start = Date.now();
  await raceMemoryRecordWithTimeout(Promise.resolve("done"), 5000);
  assert.ok(Date.now() - start < 1000, "解決済み promise で 5000ms の timeout を待ってはいけない");
});

test("raceMemoryRecordWithTimeout: promise が解決しなくても timeoutMs で必ず返る（shutdown が固まらない・blocking #3）", { timeout: 5000 }, async () => {
  const neverResolves = new Promise(() => {});
  const start = Date.now();
  await raceMemoryRecordWithTimeout(neverResolves, 30);
  assert.ok(Date.now() - start < 1000, "timeoutMs 経過後は待たずに返らねばならない");
});

test("raceMemoryRecordWithTimeout: promise が reject しても握って捨てる（呼び出し元に伝播しない）", { timeout: 5000 }, async () => {
  const rejecting = Promise.reject(new Error("record failed"));
  await assert.doesNotReject(() => raceMemoryRecordWithTimeout(rejecting, 5000));
});

test("raceMemoryRecordWithTimeout: setTimeoutImpl を注入できる（fire-scheduler/barge-in と同型のタイマ注入規律）", { timeout: 5000 }, async () => {
  /** @type {any[]} */
  const calls = [];
  const fakeSetTimeout = (/** @type {any} */ cb, /** @type {any} */ ms) => {
    calls.push(ms);
    cb(); // 即時発火（実タイマを使わない決定論テスト）。
    return 0;
  };
  const neverResolves = new Promise(() => {});
  await raceMemoryRecordWithTimeout(neverResolves, 12345, /** @type {any} */ (fakeSetTimeout));
  assert.deepEqual(calls, [12345]);
});

// ── 決め打った定数の値の固定（回帰ガード・具体値の根拠は domain-b.md 参照）───────────────────

test("配信間記憶の決め打ち定数: MEMORY_CHECKPOINT_INTERVAL_MS=20分・MEMORY_INJECT_MAX_CHARS=4500・SHUTDOWN_MEMORY_TIMEOUT_MS=15秒", { timeout: 5000 }, () => {
  assert.equal(MEMORY_CHECKPOINT_INTERVAL_MS, 20 * 60 * 1000);
  assert.equal(MEMORY_INJECT_MAX_CHARS, 4500);
  assert.equal(SHUTDOWN_MEMORY_TIMEOUT_MS, 15000);
});

// ── shutdown 型ハーネス（配信間記憶・★重要な配管事実 + blocking #3）─────────────────────────
//
//  main() の shutdown 相当を、実 server/session/player を使わない最小ハーネスで再現する（brain 切替
//  ×in-flight テストと同じ流儀）。固定する不変条件: (a) 転写スナップショットは server.close() より
//  前に確保する（close 後は pipeline が dispose されて転写が取れない・★重要な配管事実）、
//  (b) 記憶生成がハング/失敗しても、best-effort + timeout（raceMemoryRecordWithTimeout）に束縛され、
//  後続の常駐リソース dispose（session/player/lazyChannel）は必ず走る（blocking #3）。

test("shutdown 型ハーネス: 転写は close() より前に確保し、記憶生成がハングしても後続 dispose は必ず走る", { timeout: 5000 }, async () => {
  /** @type {string[]} */
  const events = [];
  let pipelineAlive = true;
  const fakeServer = {
    getTranscript: () => {
      if (!pipelineAlive) throw new Error("pipeline already disposed — post-close 転写取得は許されない");
      return ["a", "b", "c"];
    },
    close: async () => {
      pipelineAlive = false;
      events.push("server.close");
    }
  };
  const fakeSession = { dispose: async () => events.push("session.dispose") };
  const fakePlayer = { dispose: () => events.push("player.dispose") };
  const fakeLazyChannel = { close: async () => events.push("lazyChannel.close") };
  const hangingRecordMemory = () => new Promise(() => {}); // 絶対に解決しない（記憶生成のハングを模す）。

  // main() の shutdown 相当（★配管事実どおり finalEntries は close() より前に確保）。
  const finalEntries = fakeServer.getTranscript();
  events.push(`finalEntries:${finalEntries.length}`);
  await fakeServer.close();
  await raceMemoryRecordWithTimeout(hangingRecordMemory(), 20);
  await fakeSession.dispose();
  fakePlayer.dispose();
  await fakeLazyChannel.close();

  assert.deepEqual(events, [
    "finalEntries:3",
    "server.close",
    "session.dispose",
    "player.dispose",
    "lazyChannel.close"
  ]);
});

test("shutdown 型ハーネス: 記憶生成が reject しても後続 dispose は必ず走る", { timeout: 5000 }, async () => {
  /** @type {string[]} */
  const events = [];
  const fakeSession = { dispose: async () => events.push("session.dispose") };
  const failingRecordMemory = () => Promise.reject(new Error("digest generation failed"));

  await raceMemoryRecordWithTimeout(failingRecordMemory(), 5000);
  await fakeSession.dispose();

  assert.deepEqual(events, ["session.dispose"]);
});

// ── createVerbosityHooks（wave 計画「口数配線」§2 裁定 A: 口数モードの settings 橋渡し）───────────

/** fake settings（cockpit-settings-store と同型の getVerbosityMode/setVerbosityMode を持つ最小 fake）。 */
function makeFakeVerbositySettings(initial = null) {
  let current = initial;
  return {
    getVerbosityMode: () => current,
    setVerbosityMode: (mode) => {
      current = mode;
    }
  };
}

test("createVerbosityHooks: 未記憶（null）なら既定 \"normal\" にフォールバックする", { timeout: 5000 }, () => {
  const settings = makeFakeVerbositySettings(null);
  const hooks = createVerbosityHooks(settings);
  assert.equal(hooks.resolveInitialVerbosity(), "normal");
});

test("createVerbosityHooks: defaultMode を明示指定できる", { timeout: 5000 }, () => {
  const settings = makeFakeVerbositySettings(null);
  const hooks = createVerbosityHooks(settings, "chatty");
  assert.equal(hooks.resolveInitialVerbosity(), "chatty");
});

test("createVerbosityHooks: 記憶済みの既知3モードは defaultMode より優先される", { timeout: 5000 }, () => {
  const settingsQuiet = makeFakeVerbositySettings("quiet");
  assert.equal(createVerbosityHooks(settingsQuiet, "normal").resolveInitialVerbosity(), "quiet");
  const settingsChatty = makeFakeVerbositySettings("chatty");
  assert.equal(createVerbosityHooks(settingsChatty, "normal").resolveInitialVerbosity(), "chatty");
});

test("createVerbosityHooks: 記憶済みの未知値は defaultMode にフォールバックする（防御的）", { timeout: 5000 }, () => {
  const settings = makeFakeVerbositySettings("bogus");
  const hooks = createVerbosityHooks(settings, "normal");
  assert.equal(hooks.resolveInitialVerbosity(), "normal");
});

test("createVerbosityHooks: onSetVerbosity は settings.setVerbosityMode へ橋渡しし・次回 resolveInitialVerbosity に反映する", { timeout: 5000 }, () => {
  const settings = makeFakeVerbositySettings(null);
  const hooks = createVerbosityHooks(settings, "normal");
  hooks.onSetVerbosity("chatty");
  assert.equal(settings.getVerbosityMode(), "chatty");
  assert.equal(hooks.resolveInitialVerbosity(), "chatty");
});

test("createVerbosityHooks: settings.setVerbosityMode が throw しても onSetVerbosity は握って続行する", { timeout: 5000 }, () => {
  const settings = {
    getVerbosityMode: () => null,
    setVerbosityMode: () => {
      throw new Error("disk full");
    }
  };
  const hooks = createVerbosityHooks(settings);
  assert.doesNotThrow(() => hooks.onSetVerbosity("chatty"));
});

// ── createBrainHooks（多頭化 Domain B: 頭脳選択の settings 橋渡し・createVerbosityHooks の写経）─────

/** fake settings（cockpit-settings-store と同型の getBrainChoice/setBrainChoice を持つ最小 fake）。 */
function makeFakeBrainSettings(initial = null) {
  let current = initial;
  return {
    getBrainChoice: () => current,
    setBrainChoice: (choice) => {
      current = choice;
    }
  };
}

test("createBrainHooks: 未記憶（null）なら既定 \"claude\" にフォールバックする（無退行）", { timeout: 5000 }, () => {
  const settings = makeFakeBrainSettings(null);
  const hooks = createBrainHooks(settings);
  assert.equal(hooks.resolveInitialBrain(), "claude");
});

test("createBrainHooks: defaultChoice を明示指定できる", { timeout: 5000 }, () => {
  const settings = makeFakeBrainSettings(null);
  const hooks = createBrainHooks(settings, "codex");
  assert.equal(hooks.resolveInitialBrain(), "codex");
});

test("createBrainHooks: 記憶済みの既知2頭（claude/codex）は defaultChoice より優先される", { timeout: 5000 }, () => {
  const settingsClaude = makeFakeBrainSettings("claude");
  assert.equal(createBrainHooks(settingsClaude, "codex").resolveInitialBrain(), "claude");
  const settingsCodex = makeFakeBrainSettings("codex");
  assert.equal(createBrainHooks(settingsCodex, "claude").resolveInitialBrain(), "codex");
});

test("createBrainHooks: registry 駆動（2026-07-17 追撃）— 追加2頭（codex-55/codex-56-sol）も BRAIN_IDS 経由で優先される", { timeout: 5000 }, () => {
  const settings55 = makeFakeBrainSettings("codex-55");
  assert.equal(createBrainHooks(settings55, "claude").resolveInitialBrain(), "codex-55");
  const settingsSol = makeFakeBrainSettings("codex-56-sol");
  assert.equal(createBrainHooks(settingsSol, "claude").resolveInitialBrain(), "codex-56-sol");
});

test("createBrainHooks: 記憶済みの未知値は defaultChoice にフォールバックする（防御的）", { timeout: 5000 }, () => {
  const settings = makeFakeBrainSettings("gpt");
  const hooks = createBrainHooks(settings, "claude");
  assert.equal(hooks.resolveInitialBrain(), "claude");
});

test("createBrainHooks: onSetBrain は settings.setBrainChoice へ橋渡しし・次回 resolveInitialBrain に反映する", { timeout: 5000 }, () => {
  const settings = makeFakeBrainSettings(null);
  const hooks = createBrainHooks(settings, "claude");
  hooks.onSetBrain("codex");
  assert.equal(settings.getBrainChoice(), "codex");
  assert.equal(hooks.resolveInitialBrain(), "codex");
});

test("createBrainHooks: settings.setBrainChoice が throw しても onSetBrain は握って続行する", { timeout: 5000 }, () => {
  const settings = {
    getBrainChoice: () => null,
    setBrainChoice: () => {
      throw new Error("disk full");
    }
  };
  const hooks = createBrainHooks(settings);
  assert.doesNotThrow(() => hooks.onSetBrain("codex"));
});

test("buildBrainSessionSystemPrompt: all four brains resolve the canonical self-name", { timeout: 5000 }, () => {
  const expected = new Map([
    ["claude", "コーディ（Cody）"],
    ["codex", "チャッピー（Chappy）"],
    ["codex-55", "チャッピー（Chappy）"],
    ["codex-56-sol", "チャッピー（Chappy）"]
  ]);
  for (const [brainId, selfName] of expected) {
    const prompt = buildBrainSessionSystemPrompt(brainId);
    assert.ok(prompt.startsWith(`あなたの名前は${selfName}です。`), brainId);
    assert.match(prompt, /相方/);
  }
  // Persisted/defensive unknown values retain Claude/Cody fallback.
  assert.ok(buildBrainSessionSystemPrompt("unknown").startsWith("あなたの名前はコーディ（Cody）です。"));
});

test("buildBrainSessionSystemPrompt: override follows identity and precedes optional memory", { timeout: 5000 }, () => {
  const prompt = buildBrainSessionSystemPrompt("codex-56-sol", "memory section", {
    "codex-56-sol": "custom conversation body"
  });
  assert.ok(prompt.indexOf("あなたの名前はチャッピー（Chappy）です。") >= 0);
  assert.ok(prompt.indexOf("あなたの名前はチャッピー（Chappy）です。") < prompt.indexOf("custom conversation body"));
  assert.ok(prompt.indexOf("custom conversation body") < prompt.indexOf("memory section"));
});

// ── 頭の切替 × in-flight（不変条件の固定・brain-swap.md §9 (a')）──────────────────────────────
//
//  main() の session/currentBrain/ensureFireResources/onSetBrain 配線と同型の最小ハーネスで、実 read-path
//  コード（createSessionProxy = cockpit.mjs の実体）を通して「切替は accepted Fire snapshot を乱さず、
//  次の ask 境界で新頭へ置換される」不変条件を固定する。

test("brain 切替×in-flight: accepted session survives the setting write and is replaced at the next Fire", { timeout: 5000 }, async () => {
  /** @type {any} */ let session = null;
  let currentBrain = "claude";
  let contextRevision = 0;
  let sessionContextRevision = null;
  /** @type {string[]} */ const created = []; // ensureFireResources が生成した頭の記録。
  /** @type {string[]} */ const disposed = []; // dispose された頭の記録。
  /** @type {((v:any)=>void) | null} */ let pendingResolve = null;
  let pendingClaude = true;
  const ttsConfig = Object.freeze({ baseUrl: "http://127.0.0.1:10101", speaker: "fixed-speaker" });
  /** @type {any} */ let player = null;
  let playerCreations = 0;

  // 頭ごとの fake session（claude の ask は pending のまま＝in-flight を模す）。
  const makeFakeHead = (/** @type {string} */ brain) => {
    /** @type {any} */
    const head = {
      brain,
      systemPrompt: buildBrainSessionSystemPrompt(brain),
      disposed: false,
      ask: (/** @type {string} */ input) => {
        if (brain === "claude" && pendingClaude) {
          pendingClaude = false;
          return new Promise((resolve) => {
            pendingResolve = resolve;
          });
        }
        return Promise.resolve({ replyText: `${brain}:${input}`, usage: {}, ttftMs: null, elapsedMs: 1 });
      },
      dispose: async () => {
        head.disposed = true;
        disposed.push(brain);
      }
    };
    return head;
  };

  // main() の ensureFireResources 頭分岐（registry 経由の生成）と同型。
  const ensureFireResources = () => {
    if (session == null) {
      session = makeFakeHead(currentBrain);
      sessionContextRevision = contextRevision;
      created.push(currentBrain);
    }
    if (player == null) {
      playerCreations += 1;
      player = { ttsConfig };
    }
  };
  // main() の onSetBrain（永続化は割愛・desired revision の更新だけ）と同型。
  const onSetBrain = async (/** @type {string} */ choice) => {
    currentBrain = choice;
    contextRevision += 1;
  };
  const ensureSessionCurrent = async () => {
    if (session == null || sessionContextRevision === contextRevision) return;
    const stale = session;
    await stale.dispose();
    if (session === stale) {
      session = null;
      sessionContextRevision = null;
    }
  };

  // 実 read-path（cockpit.mjs の createSessionProxy そのもの）を通す。URL は設定済み（ask を弾かない）。
  const proxy = createSessionProxy({
    getUrl: () => "ws://127.0.0.1:1/channel?token=x",
    ensureSessionCurrent,
    ensureFireResources,
    getSession: () => session
  });

  // 1 発目（claude）: ask は pending のまま（in-flight）。
  const inflight = proxy.ask("hello");
  await Promise.resolve();
  assert.deepEqual(created, ["claude"]);
  const claudeHead = session;
  assert.equal(claudeHead.systemPrompt, buildBrainSessionSystemPrompt("claude"));
  const configuredPlayer = player;
  assert.equal(playerCreations, 1);

  // in-flight 中の setting write は accepted session/player を変更しない。
  await onSetBrain("codex");
  assert.equal(claudeHead.disposed, false);
  assert.deepEqual(disposed, []);
  assert.equal(session, claudeHead);

  // 次の ask 境界が旧 session を dispose して新頭（codex）を生成する。
  const next = await proxy.ask("hi");
  assert.equal(claudeHead.disposed, true);
  assert.deepEqual(disposed, ["claude"]);
  assert.deepEqual(created, ["claude", "codex"]);
  assert.equal(next.replyText, "codex:hi");
  assert.equal(session.systemPrompt, buildBrainSessionSystemPrompt("codex"));
  assert.equal(player, configuredPlayer, "brain swap must not reconstruct the configured TTS player");
  assert.equal(player.ttsConfig, ttsConfig, "brain swap must preserve TTS base URL/speaker config");
  assert.equal(playerCreations, 1, "brain swap must not create a second TTS dependency");

  // Reverse direction: GPT → Claude also waits for the next Fire/session.
  const codexHead = session;
  await onSetBrain("claude");
  assert.equal(session, codexHead, "setting write does not dispose the accepted resource");
  const reverse = await proxy.ask("back");
  assert.deepEqual(disposed, ["claude", "codex"]);
  assert.equal(reverse.replyText, "claude:back");
  assert.equal(session.systemPrompt, buildBrainSessionSystemPrompt("claude"));
  assert.deepEqual(created, ["claude", "codex", "claude"]);
  assert.equal(player, configuredPlayer);
  assert.equal(playerCreations, 1);

  // in-flight だった claude の ask は既存の dispose 意味論に委ねる（ここでは強制解決して leak を防ぐ）。
  assert.equal(typeof pendingResolve, "function");
  /** @type {(v:any)=>void} */ (pendingResolve)({ replyText: "late", usage: {}, ttftMs: null, elapsedMs: 1 });
  await inflight;
});

// ── createChatSourceHooks（S7「視聴者が混ざる」: 配信 source の settings ⇄ cockpit-server 橋渡し）───

/** fake settings（cockpit-settings-store と同型の getChatSource/setChatSource を持つ最小 fake）。 */
function makeFakeChatSourceSettings(initial = null) {
  let current = initial;
  return {
    getChatSource: () => current,
    setChatSource: (source) => {
      current = source ?? null;
    }
  };
}

test("createChatSourceHooks: onSetChatSource は settings.setChatSource へ橋渡しする", { timeout: 5000 }, () => {
  const settings = makeFakeChatSourceSettings(null);
  const hooks = createChatSourceHooks(settings);
  hooks.onSetChatSource("https://youtube.com/watch?v=xyz");
  assert.equal(settings.getChatSource(), "https://youtube.com/watch?v=xyz");
  // null/undefined はクリア。
  hooks.onSetChatSource(null);
  assert.equal(settings.getChatSource(), null);
});

test("createChatSourceHooks: chatSourceStatus は現在の source を { source } で返す", { timeout: 5000 }, () => {
  const settings = makeFakeChatSourceSettings(null);
  const hooks = createChatSourceHooks(settings);
  assert.deepEqual(hooks.chatSourceStatus(), { source: null });
  hooks.onSetChatSource("dQw4w9WgXcQ");
  assert.deepEqual(hooks.chatSourceStatus(), { source: "dQw4w9WgXcQ" });
});

test("createChatSourceHooks: settings.setChatSource が throw しても onSetChatSource は握って続行する", { timeout: 5000 }, () => {
  const settings = {
    getChatSource: () => null,
    setChatSource: () => {
      throw new Error("disk full");
    }
  };
  const hooks = createChatSourceHooks(settings);
  assert.doesNotThrow(() => hooks.onSetChatSource("https://youtube.com/watch?v=xyz"));
});

test("conversation instruction revision: production session seam reuses, replaces only on next accepted Fire, and preserves brain/memory/TTS", { timeout: 5000 }, async () => {
  const currentBrain = "codex-55";
  const memoryText = "memory section stays unchanged";
  const overrides = { codex: "other brain must remain untouched" };
  const settings = {
    getConversationInstructionOverrides: () => ({ ...overrides }),
    getConversationInstructionProfile: (brainId) => resolveConversationInstructionProfile(brainId, overrides),
    setConversationInstruction: (brainId, instruction) => {
      overrides[brainId] = instruction;
      return true;
    },
    resetConversationInstruction: (brainId) => {
      delete overrides[brainId];
      return true;
    }
  };
  const revision = createInstructionRevisionController();
  const instructionHooks = createConversationInstructionHooks(settings, () => currentBrain, revision);
  /** @type {any[]} */ const sessions = [];
  /** @type {any} */ let session = null;
  let sessionInstructionRevision = null;
  let player = null;
  let playerCreations = 0;
  /** @type {Array<((value: any) => void) | null>} */ const pendingResolves = [];
  const createdRevisions = [];
  const deferredSession = (index) =>
    new Promise((resolve) => {
      pendingResolves[index] = resolve;
    });
  const makeSession = () => {
    const index = sessions.length;
    const systemPrompt = buildBrainSessionSystemPrompt(currentBrain, memoryText, overrides);
    const head = {
      index,
      systemPrompt,
      disposed: 0,
      async ask(input) {
        if (index < 2) {
          return deferredSession(index);
        }
        return { replyText: `reply:${index}:${input.slice(0, 8)}`, usage: { input_tokens: index }, ttftMs: null, elapsedMs: 1 };
      },
      async dispose() {
        head.disposed += 1;
      }
    };
    sessions.push(head);
    createdRevisions.push(revision.getRevision());
    return head;
  };
  const ensureFireResources = () => {
    if (session == null) {
      session = makeSession();
      sessionInstructionRevision = revision.getRevision();
    }
    if (player == null) {
      player = { ttsConfig: { baseUrl: "fake://tts", speaker: "stable" } };
      playerCreations += 1;
    }
  };
  const ensureSessionCurrent = async () => {
    if (session == null || sessionInstructionRevision === revision.getRevision()) return;
    const stale = session;
    await stale.dispose();
    if (session === stale) {
      session = null;
      sessionInstructionRevision = null;
    }
  };
  const proxy = createSessionProxy({
    getUrl: () => "ws://127.0.0.1:1/channel?token=fake",
    ensureFireResources,
    ensureSessionCurrent,
    getSession: () => session
  });
  const buffer = createTranscriptBuffer({ nowImpl: () => 1000 });
  buffer.append({ startMs: 0, endMs: 1000, text: "今どうなってる？" });
  const spoken = [];
  const usages = [];
  const orchestrator = createFireOrchestrator({
    getBuffer: () => buffer,
    session: proxy,
    speakImpl: async (text) => {
      spoken.push(text);
      return { timeline: [], wavDurationSec: 0, playbackStartedAtMs: 1000 };
    },
    channel: {},
    player: { play() {} },
    nowImpl: () => 1000,
    onUsage: (info) => usages.push(info)
  });

  // First Fire creates the default session and remains pending. A save marks the revision stale but does not
  // dispose/relabel the in-flight session; the second Fire is rejected by the real busy state machine.
  const firstFire = orchestrator.fire();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sessions.length, 1);
  const firstSession = sessions[0];
  assert.equal(firstSession.systemPrompt.includes("other brain must remain untouched"), false);
  assert.equal(firstSession.systemPrompt.includes(memoryText), true);
  assert.equal(instructionHooks.save(currentBrain, "custom body while first answer is pending"), true);
  assert.equal(firstSession.disposed, 0);
  const busyWhileFirstPending = await orchestrator.fire();
  assert.deepEqual(busyWhileFirstPending, { fired: false, reason: "busy", state: "thinking" });
  assert.equal(sessions.length, 1);
  pendingResolves[0]({ replyText: "first answer", usage: { input_tokens: 1 }, ttftMs: null, elapsedMs: 1 });
  const firstResult = await firstFire;
  assert.equal(firstResult.fired, true);
  assert.equal(firstSession.disposed, 0, "save does not interrupt the in-flight answer");

  // The following accepted Fire performs exactly one stale-session replacement and uses the selected brain's
  // custom body. The second fake answer is kept pending so reset can be tested against another in-flight request.
  const customFire = orchestrator.fire();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sessions.length, 2);
  assert.equal(sessions[1].systemPrompt.includes("custom body while first answer is pending"), true);
  assert.equal(sessions[1].systemPrompt.includes(memoryText), true);
  assert.equal(sessions[1].systemPrompt.startsWith("あなたの名前はチャッピー（Chappy）です。"), true);
  assert.equal(sessions[0].disposed, 1);
  assert.equal(instructionHooks.reset(currentBrain), true);
  assert.equal(sessions[1].disposed, 0, "reset while asking does not interrupt the in-flight answer");
  const busyWhileSecondPending = await orchestrator.fire();
  assert.equal(busyWhileSecondPending.reason, "busy");
  pendingResolves[1]({ replyText: "second answer", usage: { input_tokens: 2 }, ttftMs: null, elapsedMs: 1 });
  assert.equal((await customFire).fired, true);

  // Reset was durable while the session was pending; the next accepted Fire replaces it once with the default
  // body. A later idle save follows the same boundary, and an unchanged revision reuses the resulting session.
  const defaultFire = await orchestrator.fire();
  assert.equal(defaultFire.fired, true);
  assert.equal(sessions.length, 3);
  assert.equal(sessions[2].systemPrompt.includes("custom body while first answer is pending"), false);
  assert.equal(sessions[2].systemPrompt.includes(memoryText), true);
  assert.equal(sessions[1].disposed, 1);

  assert.equal(instructionHooks.save(currentBrain, "custom body saved while idle"), true);
  assert.equal(sessions[2].disposed, 0, "idle save leaves the current session in place");
  const idleSaveFire = await orchestrator.fire();
  assert.equal(idleSaveFire.fired, true);
  assert.equal(sessions.length, 4);
  assert.equal(sessions[3].systemPrompt.includes("custom body saved while idle"), true);
  assert.equal(sessions[2].disposed, 1);

  const reused = sessions[3];
  const repeatedFire = await orchestrator.fire();
  assert.equal(repeatedFire.fired, true);
  assert.equal(sessions.length, 4, "unchanged revision reuses the same session");
  assert.equal(session, reused);
  assert.equal(reused.disposed, 0);

  assert.equal(currentBrain, "codex-55");
  assert.equal(memoryText, "memory section stays unchanged");
  assert.equal(playerCreations, 1, "instruction revisions do not recreate the TTS player");
  assert.equal(player.ttsConfig.speaker, "stable");
  assert.equal(usages.length, 5);
  assert.equal(spoken.length, 5);
  orchestrator.dispose();
});

test("createSessionProxy: stale instruction session is disposed before the next Fire", { timeout: 5000 }, async () => {
  const events = [];
  const session = {
    async ask(input) {
      events.push(["ask", input]);
      return { replyText: "ok" };
    },
    async dispose() {
      events.push(["dispose"]);
    }
  };
  let currentRevision = 1;
  const proxy = createSessionProxy({
    getUrl: () => "ws://127.0.0.1:1/channel?token=t",
    ensureFireResources: () => events.push(["ensure"]),
    ensureSessionCurrent: async () => {
      if (currentRevision === 2) await session.dispose();
    },
    getSession: () => session
  });
  await proxy.ask("first");
  currentRevision = 2;
  await proxy.ask("second");
  assert.deepEqual(events, [["ensure"], ["ask", "first"], ["dispose"], ["ensure"], ["ask", "second"]]);
});

test("instruction revision/hooks: revision advances only after a successful durable write", () => {
  const revision = createInstructionRevisionController();
  let value = null;
  const settings = {
    getConversationInstructionOverrides: () => (value == null ? {} : { claude: value }),
    getConversationInstructionProfile: () => ({ body: value ?? "default", hasOverride: value != null }),
    setConversationInstruction: (_id, next) => {
      value = next;
      return true;
    },
    resetConversationInstruction: () => {
      value = null;
      return true;
    }
  };
  const hooks = createConversationInstructionHooks(settings, () => "claude", revision);
  assert.equal(hooks.getRevision(), 0);
  assert.equal(hooks.save("claude", "custom"), true);
  assert.equal(hooks.getRevision(), 1);
  assert.equal(hooks.reset("claude"), true);
  assert.equal(hooks.getRevision(), 2);
  settings.setConversationInstruction = () => false;
  assert.equal(hooks.save("claude", "not persisted"), false);
  assert.equal(hooks.getRevision(), 2);
});
