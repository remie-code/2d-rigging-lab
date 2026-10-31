// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  parseCockpitArgs,
  openCockpitBrowser,
  buildRoleSessionSystemPrompt,
  createLazyChannel,
  createSessionProxy,
  createInstructionRevisionController,
  createConversationInstructionHooks,
  createVisionTargetHooks,
  createAudioDeviceHooks,
  createSelfFireHooks,
  createBargeInHooks,
  createVerbosityHooks,
  createRoleHooks,
  resolveRoleVoice,
  applyRoleHotwords,
  createChatSourceHooks,
  createSttEngineHooks,
  createTtsEngineHooks,
  createVoiceEngineManager,
  voiceDiagnosticReason,
  formatSttLatencyLine,
  formatCaptureEventLine,
  createSpeakStartHooks,
  formatSpeakNowLine,
  createCommentBusyHooks,
  formatCommentJudgmentLine,
  shouldSkipMemoryCheckpoint,
  createMemoryRecorder,
  createRoleMemoryPlaces,
  createStreamVenueHooks,
  resolveWriterBrainDef,
  isMcpConfigReadFailureWarning,
  formatRecallEventLine,
  raceMemoryRecordWithTimeout,
  MEMORY_CHECKPOINT_INTERVAL_MS,
  SHUTDOWN_MEMORY_TIMEOUT_MS
} from "./cockpit.mjs";
import { createTranscriptBuffer } from "../src/ears/transcript-buffer.mjs";
import { createFireOrchestrator, resolveConversationInstructionProfile } from "../src/mind/fire-orchestrator.mjs";
import { MCP_CONFIG_READ_FAILED_WARNING } from "../src/mind/codex-session.mjs";
import { listSoulSkills, loadSoulSkills } from "../src/mind/soul-skills.mjs";
import { MODEL_IDENTITIES } from "../src/mind/model-identity.mjs";
import {
  createRoleInstructionStore,
  normalizeRole,
  readRole,
  roleFromIdentity,
  writeRole,
  writeRoleInstructions
} from "../src/roles/role-store.mjs";

// 起動導線のうち注入可能な純関数部分のテスト（S3 Domain B）。
// 実 SDK / 実 TTS / 実器 / 実マイクは使わない（fake connectImpl のみ）。

// ── parseCockpitArgs ──────────────────────────────────────────────────

test("parseCockpitArgs: no flags → everything undefined (S2.5 挙動不変の入口)", { timeout: 5000 }, () => {
  const args = parseCockpitArgs([]);
  assert.equal(args.port, undefined);
  assert.equal(args.help, false);
  assert.equal(args.open, false);
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

test("--open is opt-in and preserves a custom port", () => {
  const args = parseCockpitArgs(["--open", "--port", "9000"]);
  assert.equal(args.open, true);
  assert.equal(args.port, 9000);
});

test("openCockpitBrowser passes the listening URL to Windows without a shell", () => {
  const calls = [];
  openCockpitBrowser("http://127.0.0.1:9000/", (file, args, options, callback) => {
    calls.push({ file, args, options });
    callback(null);
  });
  assert.deepEqual(calls, [{
    file: "rundll32.exe",
    args: ["url.dll,FileProtocolHandler", "http://127.0.0.1:9000/"],
    options: { windowsHide: true }
  }]);
});

test("openCockpitBrowser failure leaves a manual URL and does not throw", () => {
  for (const synchronous of [false, true]) {
    const warnings = [];
    openCockpitBrowser("http://127.0.0.1:9000/", (_file, _args, _options, callback) => {
      const error = new Error("test launch failure");
      if (synchronous) throw error;
      callback(error);
    }, (message) => warnings.push(message));
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Open http:\/\/127\.0\.0\.1:9000\/ manually/);
  }
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

test("createLazyChannel: intent.speechStream（open/append/end）も同じ接続へ呼んだ順に委譲する（声の差し替え Wave 2）", { timeout: 5000 }, async () => {
  let connects = 0;
  /** @type {any[]} */
  const calls = [];
  const lazy = createLazyChannel("ws://127.0.0.1:1/channel?token=t", {
    connectImpl: /** @type {any} */ (async () => {
      connects += 1;
      const accepted = async () => ({ result: "accepted", error: null, rttMs: 1 });
      return {
        openSpeech: async (/** @type {string} */ id) => { calls.push(["open", id]); return accepted(); },
        appendSpeech: async (/** @type {string} */ id, /** @type {any} */ timeline) => { calls.push(["append", id, timeline]); return accepted(); },
        endSpeech: async (/** @type {string} */ id) => { calls.push(["end", id]); return accepted(); },
        close: async () => {}
      };
    })
  });
  const timeline = [{ timeMs: 0, vowel: "a", s: 0.5 }];
  const pending = [lazy.openSpeech("u1"), lazy.appendSpeech("u1", timeline), lazy.endSpeech("u1")];
  const replies = await Promise.all(pending);
  assert.ok(replies.every((r) => r.result === "accepted"));
  assert.equal(connects, 1);
  assert.deepEqual(calls, [["open", "u1"], ["append", "u1", timeline], ["end", "u1"]]);
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

// ── 配信間記憶（記憶の作り直し Wave 2 Domain C）──────────────────────────────────────────
//  記憶の ON/OFF（createMemoryHooks・memoryEnabled）と起動時の搭載（MEMORY_INJECT_MAX_CHARS）は撤去した。

test("撤去: 記憶の ON/OFF の橋渡しと起動時の搭載の定数は cockpit.mjs から無くなっている", { timeout: 5000 }, async () => {
  const mod = await import("./cockpit.mjs");
  for (const name of ["createMemoryHooks", "MEMORY_INJECT_MAX_CHARS"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(mod, name), false, name);
  }
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

// ── resolveWriterBrainDef（②の頭は Codex に固定・申し送り 1）────────────────────────────────

test("resolveWriterBrainDef: Codex の頭ならその頭、Claude の頭や不明なら既定の Codex", { timeout: 5000 }, () => {
  const brains = {
    claude: { id: "claude", create: () => null },
    "claude-opus-55": { id: "claude-opus-55", create: () => null },
    codex: { id: "codex", create: () => null },
    "codex-61-sol": { id: "codex-61-sol", create: () => null }
  };
  assert.equal(resolveWriterBrainDef("codex-61-sol", brains).id, "codex-61-sol");
  assert.equal(resolveWriterBrainDef("codex", brains).id, "codex");
  assert.equal(resolveWriterBrainDef("claude", brains).id, "codex");
  assert.equal(resolveWriterBrainDef("claude-opus-55", brains).id, "codex");
  assert.equal(resolveWriterBrainDef("codex-unknown", brains).id, "codex");
  assert.equal(resolveWriterBrainDef(undefined, brains).id, "codex");
  // 本物の registry でも Codex の行が返る。
  assert.equal(resolveWriterBrainDef("claude").id, "codex");
});

// ── isMcpConfigReadFailureWarning（config/read の失敗を alert にする判定）────────────────────

test("isMcpConfigReadFailureWarning: codex-session の config/read 失敗の警告だけを拾う", { timeout: 5000 }, () => {
  assert.equal(isMcpConfigReadFailureWarning("codex-session: could not read the MCP server list; user MCP servers may start."), true);
  assert.equal(isMcpConfigReadFailureWarning("codex-session: ignored App Server message — unsupported notification x"), false);
  assert.equal(isMcpConfigReadFailureWarning(undefined), false);
});

test("isMcpConfigReadFailureWarning: codex-session の定数との一致で判定し、文言の一部だけでは拾わない（Wave 2 からの申し送り 2）", { timeout: 5000 }, () => {
  assert.equal(isMcpConfigReadFailureWarning(MCP_CONFIG_READ_FAILED_WARNING), true);
  assert.equal(isMcpConfigReadFailureWarning(`[x] ${MCP_CONFIG_READ_FAILED_WARNING}`), false);
  assert.equal(isMcpConfigReadFailureWarning("codex-session: could not read the MCP server list"), false);
});

test("formatRecallEventLine: 思い出しの係の出来事の 1 行（頼みごと・記憶の中身は書かない）", { timeout: 5000 }, () => {
  assert.equal(formatRecallEventLine({ phase: "started" }), "[cockpit] recall: started\n");
  assert.equal(
    formatRecallEventLine({ phase: "found", avoidProbability: 0.234, judgeFailed: false }),
    "[cockpit] recall: found avoid=0.23\n"
  );
  assert.equal(formatRecallEventLine({ phase: "found", avoidProbability: null, judgeFailed: true }), "[cockpit] recall: found judge=error\n");
  assert.equal(formatRecallEventLine({ phase: "deferred", reason: "killed" }), "[cockpit] recall: deferred reason=killed\n");
  assert.equal(
    formatRecallEventLine(/** @type {any} */ ({ phase: "started", request: "前回どこまで" })),
    "[cockpit] recall: started\n",
    "頼みごとが渡っても書かない"
  );
});

test("formatRecallEventLine（Wave 3 仕上げ）: 自発 OFF で黙って渡した（silent）・④の失敗を届けた（failed）を添える", { timeout: 5000 }, () => {
  assert.equal(formatRecallEventLine({ phase: "found", silent: true }), "[cockpit] recall: found silent\n");
  assert.equal(formatRecallEventLine({ phase: "not-found", failed: true }), "[cockpit] recall: not-found failed\n");
  assert.equal(formatRecallEventLine({ phase: "not-found", silent: true, failed: true }), "[cockpit] recall: not-found silent failed\n");
  assert.equal(formatRecallEventLine({ phase: "failed", reason: "recall-error" }), "[cockpit] recall: failed reason=recall-error\n");
});

// ── createMemoryRecorder（保存の係: 定期/手動/耳の Stop/Ctrl+C が共有・直列）───────────────────
//  本物の②（writeStreamRecord）は使わず fake の writeImpl を注入する（実 LLM/実 FS 消費ゼロ）。

/** 解決を外から操れる writeImpl（呼ばれた材料を記録する）。 */
function makeControlledWrite() {
  /** @type {Array<{ entries: any[]; resolve: (v: any) => void; reject: (e: any) => void }>} */
  const pending = [];
  /** @type {any[][]} */
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const writeImpl = (/** @type {any[]} */ entries) =>
    new Promise((resolve, reject) => {
      calls.push(entries);
      active += 1;
      maxActive = Math.max(maxActive, active);
      pending.push({
        entries,
        resolve: (v) => {
          active -= 1;
          resolve(v);
        },
        reject: (e) => {
          active -= 1;
          reject(e);
        }
      });
    });
  return { writeImpl, pending, calls, maxActive: () => maxActive };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("createMemoryRecorder: 1 回の保存で writeImpl を呼び、成り立てば onSaved(atMs/entriesLength/commit)", { timeout: 5000 }, async () => {
  const w = makeControlledWrite();
  /** @type {any[]} */
  const saved = [];
  const recorder = createMemoryRecorder({
    getLiveEntries: () => ["a", "b"],
    writeImpl: w.writeImpl,
    onSaved: (info) => saved.push(info),
    nowImpl: () => 4242
  });
  const done = recorder.record();
  assert.equal(recorder.isRecording(), true);
  assert.deepEqual(w.calls, [["a", "b"]]);
  w.pending[0].resolve({ written: true, commit: { ok: true, committed: true, commit: "abc" } });
  await done;
  assert.deepEqual(saved, [{ atMs: 4242, entriesLength: 2, commit: { ok: true, committed: true, commit: "abc" } }]);
  await recorder.whenIdle();
  assert.equal(recorder.isRecording(), false);
});

test("createMemoryRecorder: 空の転写では走らせない（writeImpl を呼ばない）", { timeout: 5000 }, async () => {
  const w = makeControlledWrite();
  const recorder = createMemoryRecorder({ getLiveEntries: () => [], writeImpl: w.writeImpl });
  await recorder.record();
  await recorder.record([]);
  assert.equal(w.calls.length, 0);
  assert.equal(recorder.isRecording(), false);
});

test("createMemoryRecorder: 直列（走っている間の保存は 1 件だけ待たせ、終わってから 1 回だけ走る・同時に 2 つは走らない）", { timeout: 5000 }, async () => {
  const w = makeControlledWrite();
  /** @type {boolean[]} */
  const recordingChanges = [];
  const recorder = createMemoryRecorder({
    getLiveEntries: () => ["live"],
    writeImpl: w.writeImpl,
    onRecordingChange: (v) => recordingChanges.push(v)
  });
  const first = recorder.record(["1"]);
  const second = recorder.record(["1", "2"]);
  const third = recorder.record(["1", "2", "3"]); // 待っている 1 件を新しい材料に差し替える。
  await tick();
  assert.equal(w.calls.length, 1, "走っている間は次を始めない");
  assert.equal(second, third, "待たせるのは 1 件だけ（同じ待ちに合流する）");
  w.pending[0].resolve({ written: true });
  await first;
  await tick();
  assert.equal(w.calls.length, 2);
  assert.deepEqual(w.calls[1], ["1", "2", "3"], "待っている 1 件は最新の材料で 1 回だけ走る");
  w.pending[1].resolve({ written: true });
  await second;
  await recorder.whenIdle();
  assert.equal(w.calls.length, 2);
  assert.equal(w.maxActive(), 1, "同時に走るのは 1 つまで");
  assert.deepEqual(recordingChanges, [true, false], "走り始めと、待たせた分まで全部終わったときだけ知らせる");
});

test("createMemoryRecorder: 待っている材料を件数の少ない材料で上書きしない（耳の Stop の転写を後の空・短い転写で消さない）", { timeout: 5000 }, async () => {
  const w = makeControlledWrite();
  const recorder = createMemoryRecorder({ getLiveEntries: () => [], writeImpl: w.writeImpl });
  recorder.record(["running"]);
  const queued = recorder.record(["s1", "s2", "s3"]); // 耳の Stop で取った転写。
  recorder.record(["new"]); // その後に始め直した耳の短い転写（定期など）。
  recorder.record(); // ライブは空（走らせない）。
  w.pending[0].resolve({ written: true });
  await tick();
  await tick();
  assert.deepEqual(w.calls[1], ["s1", "s2", "s3"]);
  w.pending[1].resolve({ written: true });
  await queued;
});

test("createMemoryRecorder: 1 回の失敗は onError に渡して続け、待たせた分も走る（呼び出し元は reject されない）", { timeout: 5000 }, async () => {
  const w = makeControlledWrite();
  /** @type {any[]} */
  const errors = [];
  /** @type {any[]} */
  const saved = [];
  const recorder = createMemoryRecorder({
    getLiveEntries: () => [],
    writeImpl: w.writeImpl,
    onError: (e) => errors.push(e),
    onSaved: (info) => saved.push(info)
  });
  const first = recorder.record(["a"]);
  const second = recorder.record(["a", "b"]);
  w.pending[0].reject(new Error("writer failed (fake)"));
  await assert.doesNotReject(() => first);
  await tick();
  w.pending[1].resolve({ written: true });
  await assert.doesNotReject(() => second);
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]), /writer failed/);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].entriesLength, 2);
});

test("createMemoryRecorder: written:false（空転写など）では onSaved を呼ばない", { timeout: 5000 }, async () => {
  const w = makeControlledWrite();
  /** @type {any[]} */
  const saved = [];
  const recorder = createMemoryRecorder({ getLiveEntries: () => ["x"], writeImpl: w.writeImpl, onSaved: (i) => saved.push(i) });
  const p = recorder.record();
  w.pending[0].resolve({ written: false });
  await p;
  assert.equal(saved.length, 0);
});

test("createMemoryRecorder: entriesOverride 指定時はライブ転写（getLiveEntries）を呼ばない", { timeout: 5000 }, async () => {
  const w = makeControlledWrite();
  let liveCalls = 0;
  const recorder = createMemoryRecorder({
    getLiveEntries: () => {
      liveCalls += 1;
      return ["live"];
    },
    writeImpl: w.writeImpl
  });
  const p = recorder.record(["override"]);
  w.pending[0].resolve({ written: true });
  await p;
  assert.equal(liveCalls, 0);
  assert.deepEqual(w.calls, [["override"]]);
});

// ── 配信を終える → 保存の係 → ②（記憶の作り直し Wave 2 の「耳の Stop → 保存」を配信の組み直し Domain D で場の関数に
//    合わせて書き直したもの・本物の cockpit-server + 本物の createStreamVenueHooks の最小ハーネス）─────────

test("配信を終えると保存される: 終えるときの転写が②の材料になり、終えた後の定期保存は空回りしない", { timeout: 5000 }, async () => {
  const { createCockpitServer } = await import("../src/cockpit/cockpit-server.mjs");
  const { createTranscriptBuffer: makeBuffer } = await import("../src/ears/transcript-buffer.mjs");
  /** @type {any} */
  let buffer = null;
  const pipelineFactory = () => {
    buffer = makeBuffer({ nowImpl: () => 1000 });
    return {
      transcriptBuffer: buffer,
      async start() {},
      async dispose() {},
      isDisposed: () => false,
      streamMs: () => 0,
      stats: () => ({})
    };
  };
  /** @type {any[][]} */
  const written = [];
  /** @type {any} */
  let server = null;
  /** @type {any} */
  let venue = null;
  const recorder = createMemoryRecorder({
    getLiveEntries: () => (server ? server.getTranscript() : []),
    writeImpl: async (entries) => {
      written.push(entries.map((e) => e.text));
      return { written: true };
    },
    onSaved: (info) => venue.noteSaved(info)
  });
  venue = createStreamVenueHooks({
    memoryPlaces: { beginStream() {}, place: () => null, streamNo: () => 0 },
    memoryRecorder: recorder,
    openSession: () => {},
    closeSession: async () => {},
    hasBody: () => false,
    channel: { getUrl: () => null, connect: async () => {}, close: async () => {} },
    isStreamOpen: () => server.streamStatus().phase === "open",
    getEntries: () => server.getTranscript()
  });
  server = createCockpitServer({ pipelineFactory: /** @type {any} */ (pipelineFactory), streamHooks: venue.hooks });
  try {
    const url = await server.listen(0);
    const post = (/** @type {string} */ p) =>
      fetch(`${url}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ device: "Mic" }) });
    await post("/api/stream/start");
    buffer.append({ startMs: 0, endMs: 1000, text: "ダミーA" });
    buffer.append({ startMs: 1000, endMs: 2000, text: "ダミーB" });
    const stop = await post("/api/stream/stop");
    assert.equal(stop.status, 200);
    assert.deepEqual(written, [["ダミーA", "ダミーB"]]);
    assert.equal(venue.lastRecordedSeq(), 2);
    // 終えた後: 場が閉じているので、定期保存は何も走らせない（ライブの転写も空）。
    assert.equal(venue.checkpoint(), false);
    await recorder.record();
    assert.equal(written.length, 1);
  } finally {
    await server.close();
  }
});

// ── raceMemoryRecordWithTimeout（配信間記憶: Ctrl+C の最後の保存の best-effort + timeout）──

test("raceMemoryRecordWithTimeout: promise が先に解決すれば timeout を待たず即座に返る", { timeout: 5000 }, async () => {
  const start = Date.now();
  await raceMemoryRecordWithTimeout(Promise.resolve("done"), 5000);
  assert.ok(Date.now() - start < 1000, "解決済み promise で 5000ms の timeout を待ってはいけない");
});

test("raceMemoryRecordWithTimeout: promise が解決しなくても timeoutMs で必ず返る（shutdown が固まらない）", { timeout: 5000 }, async () => {
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

// ── 決め打った定数の値の固定（回帰ガード）───────────────────

test("配信間記憶の決め打ち定数: MEMORY_CHECKPOINT_INTERVAL_MS=20分・SHUTDOWN_MEMORY_TIMEOUT_MS=90秒（②の所要時間に合わせた）", { timeout: 5000 }, () => {
  assert.equal(MEMORY_CHECKPOINT_INTERVAL_MS, 20 * 60 * 1000);
  assert.equal(SHUTDOWN_MEMORY_TIMEOUT_MS, 90_000);
});

// ── shutdown 型ハーネス（配信間記憶・★重要な配管事実 + 固まらない）─────────────────────────
//
//  main() の shutdown 相当を、実 server/session/player を使わない最小ハーネスで再現する。固定する不変条件:
//  (a) 転写スナップショットは server.close() より前に確保する（close 後は pipeline が dispose されて転写が取れない）、
//  (b) 最後の保存は走っている保存の終わりも待つ（直列）、(c) ハング/失敗しても timeout に束縛され、後続の dispose は必ず走る。
//  配信の組み直し Domain D: main() の shutdown そのものは createCockpitShutdown（場が開いていれば server.endStream =
//  closeStream が写し → 畳む → 最後の保存の順を受け持つ）になった。その並びは scripts/cockpit-stream.test.mjs が本物の
//  server と場の口で固定する。ここは保存の待ち方（直列・上限）の不変条件として残す。

test("shutdown 型ハーネス: 転写は close() より前に確保し、最後の保存は走っている保存の後に走り、後続 dispose は必ず走る", { timeout: 5000 }, async () => {
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
  const w = makeControlledWrite();
  const recorder = createMemoryRecorder({ getLiveEntries: () => [], writeImpl: w.writeImpl });
  recorder.record(["periodic"]); // Ctrl+C の時点で定期保存が走っている。
  const fakeSession = { dispose: async () => events.push("session.dispose") };

  // main() の shutdown 相当（★配管事実どおり finalEntries は close() より前に確保）。
  const finalEntries = fakeServer.getTranscript();
  events.push(`finalEntries:${finalEntries.length}`);
  await fakeServer.close();
  const memoryDone = Promise.all([recorder.record(finalEntries), recorder.whenIdle()]);
  const raced = raceMemoryRecordWithTimeout(memoryDone, 1000);
  await tick();
  assert.equal(w.calls.length, 1, "走っている保存が終わるまで最後の保存は始めない");
  w.pending[0].resolve({ written: true });
  await tick();
  await tick();
  assert.deepEqual(w.calls[1], ["a", "b", "c"]);
  w.pending[1].resolve({ written: true });
  await raced;
  events.push("memory.done");
  await fakeSession.dispose();

  assert.deepEqual(events, ["finalEntries:3", "server.close", "memory.done", "session.dispose"]);
});

test("shutdown 型ハーネス: 最後の保存がハングしても timeout で抜け、後続 dispose は必ず走る", { timeout: 5000 }, async () => {
  /** @type {string[]} */
  const events = [];
  const recorder = createMemoryRecorder({ getLiveEntries: () => [], writeImpl: () => new Promise(() => {}) });
  const fakeSession = { dispose: async () => events.push("session.dispose") };
  await raceMemoryRecordWithTimeout(Promise.all([recorder.record(["x"]), recorder.whenIdle()]), 20);
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

// ── createRoleHooks（配信の組み直し Domain A: 頭の選択 → ロールの選択・旧 createBrainHooks の置き換え）─────────
//
//  ロールの置き場は OS temp のフォルダ（本物の apps/soul/agent/roles/ には触れない）。設定は最小の fake。

/** @param {any} t */
function makeRolesDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "cockpit-roles-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** fake settings（getRoleChoice / setRoleChoice / getBrainChoice・cockpit-settings-store と同じ形）。 */
function makeFakeRoleSettings({ roleChoice = null, brainChoice = null } = {}) {
  const state = { roleChoice, brainChoice, writes: /** @type {Array<string | null>} */ ([]) };
  return {
    state,
    getRoleChoice: () => state.roleChoice,
    setRoleChoice: (/** @type {string | null} */ id) => {
      state.roleChoice = id;
      state.writes.push(id);
    },
    getBrainChoice: () => state.brainChoice
  };
}

const MIO_ROLE = Object.freeze({
  id: "mio",
  name: { canonical: "ミオ", display: "みお", latin: "Mio" },
  nameHints: { whisperPrompt: "みお、ミオ。", voiceCallVariants: ["ミオ"], commentCallVariants: ["Mio", "ミオ"], hotwords: ["ミオ"] },
  brain: "codex-astra",
  voice: { engine: "elevenlabs", aivisSpeaker: 1234, elevenLabsVoiceId: "voice-mio" },
  verbosity: "chatty",
  speakStartMode: "classic",
  body: false
});

/** @param {string} dir */
function writeChappyAndCody(dir) {
  writeRole({ dir, role: roleFromIdentity(MODEL_IDENTITIES.chappy, { brain: "codex-61-sol", verbosity: "quiet" }) });
  writeRole({ dir, role: roleFromIdentity(MODEL_IDENTITIES.cody, { brain: "claude-opus-55", speakStartMode: "classic" }) });
}

test("createRoleHooks: 起動時は roleChoice のロール・無ければ今までの頭の系統（GPT 系 → chappy・それ以外 → cody）・それも無ければ最初のロール", (t) => {
  const dir = makeRolesDir(t);
  writeChappyAndCody(dir);
  assert.equal(createRoleHooks({ rolesDir: dir, settings: makeFakeRoleSettings({ roleChoice: "chappy" }) }).currentId(), "chappy");
  assert.equal(createRoleHooks({ rolesDir: dir, settings: makeFakeRoleSettings({ brainChoice: "codex-astra" }) }).currentId(), "chappy");
  assert.equal(createRoleHooks({ rolesDir: dir, settings: makeFakeRoleSettings({ brainChoice: "claude-opus-55" }) }).currentId(), "cody");
  assert.equal(createRoleHooks({ rolesDir: dir, settings: makeFakeRoleSettings() }).currentId(), "cody", "未記憶は今までの既定（Claude/Cody）");
  // 覚えたロールが置き場に無ければ系統で選ぶ。
  assert.equal(
    createRoleHooks({ rolesDir: dir, settings: makeFakeRoleSettings({ roleChoice: "gone", brainChoice: "codex" }) }).currentId(),
    "chappy"
  );
  const onlyMio = makeRolesDir(t);
  writeRole({ dir: onlyMio, role: MIO_ROLE });
  const hooks = createRoleHooks({ rolesDir: onlyMio, settings: makeFakeRoleSettings({ brainChoice: "codex" }) });
  assert.equal(hooks.currentId(), "mio");
  assert.equal(hooks.isPersisted(), true);
  assert.deepEqual(hooks.list(), [{ id: "mio", displayName: "みお", brain: "codex-astra" }]);
});

test("createRoleHooks: ロールが 1 つも無ければ手元だけの既定（こーでぃーの名前）で動き、置き場には書かない", (t) => {
  const root = makeRolesDir(t);
  const rolesDir = join(root, "roles");
  const hooks = createRoleHooks({ rolesDir, settings: makeFakeRoleSettings() });
  assert.equal(hooks.currentId(), "cody");
  assert.equal(hooks.isPersisted(), false);
  assert.equal(hooks.identity().canonicalName, "コーディ");
  hooks.roleSettings.setVerbosityMode("chatty");
  assert.equal(hooks.current().verbosity, "chatty", "手元の値は替わる");
  assert.equal(existsSync(rolesDir), false, "roles/ を作らない（次の起動で引っ越しが走れる）");
  assert.deepEqual(hooks.knownIds(), []);
});

test("createRoleHooks: select は置き場から読み直して今のロールにし roleChoice に覚える・読めなければ ok:false で今のまま", (t) => {
  const dir = makeRolesDir(t);
  writeChappyAndCody(dir);
  const settings = makeFakeRoleSettings();
  const hooks = createRoleHooks({ rolesDir: dir, settings });
  assert.equal(hooks.currentId(), "cody");
  // 起動のあとで足したロールも、選べば読める（一覧も読み直す）。
  writeRole({ dir, role: MIO_ROLE });
  const selected = hooks.select("mio");
  assert.equal(selected.ok, true);
  assert.equal(hooks.currentId(), "mio");
  assert.deepEqual(settings.state.writes, ["mio"]);
  assert.deepEqual(hooks.knownIds(), ["chappy", "cody", "mio"]);
  const missing = hooks.select("nobody");
  assert.equal(missing.ok, false);
  assert.match(/** @type {any} */ (missing).reason, /ロール nobody を読めない/);
  assert.equal(hooks.currentId(), "mio");
  assert.deepEqual(settings.state.writes, ["mio"]);
  // roleChoice の書き込みに失敗しても選択は止めない。
  const throwing = { ...makeFakeRoleSettings(), setRoleChoice: () => { throw new Error("disk full"); } };
  const hooks2 = createRoleHooks({ rolesDir: dir, settings: throwing });
  assert.equal(hooks2.select("chappy").ok, true);
});

test("createRoleHooks: 口数・話し始め・声の方式は今のロールから引き、hooks の set はロールの role.json に書く（値の出どころ = ロール）", (t) => {
  const dir = makeRolesDir(t);
  writeChappyAndCody(dir);
  const settings = makeFakeRoleSettings({ roleChoice: "chappy" });
  const hooks = createRoleHooks({ rolesDir: dir, settings });
  const verbosity = createVerbosityHooks(hooks.roleSettings);
  const speakStart = createSpeakStartHooks({ ...hooks.roleSettings, getBackchannelMinIntervalSec: () => 3 });
  const tts = createTtsEngineHooks(hooks.roleSettings);
  assert.equal(verbosity.resolveInitialVerbosity(), "quiet");
  assert.equal(speakStart.resolveInitialSpeakStartMode(), "speak-now");
  assert.equal(speakStart.resolveBackchannelMinIntervalMs(), 3000, "相槌の間隔は設定ファイルのまま");
  assert.equal(tts.resolveInitialTtsEngine(), "aivis");
  verbosity.onSetVerbosity("chatty");
  speakStart.onSetSpeakStartMode("classic");
  tts.onSetTtsEngine("elevenlabs");
  const onDisk = /** @type {any} */ (readRole({ dir, id: "chappy" })).role;
  assert.equal(onDisk.verbosity, "chatty");
  assert.equal(onDisk.speakStartMode, "classic");
  assert.equal(onDisk.voice.engine, "elevenlabs");
  // ほかのロールは触らない。
  assert.equal(/** @type {any} */ (readRole({ dir, id: "cody" })).role.verbosity, "normal");
  // ロールを替えれば、そのロールの値が出てくる。
  hooks.select("cody");
  assert.equal(createVerbosityHooks(hooks.roleSettings).resolveInitialVerbosity(), "normal");
  assert.equal(createSpeakStartHooks(hooks.roleSettings).resolveInitialSpeakStartMode(), "classic");
  // 書き込みに失敗しても操作は止めない。
  const failing = createRoleHooks({ rolesDir: dir, settings, writeRoleImpl: () => { throw new Error("disk full"); } });
  assert.doesNotThrow(() => createVerbosityHooks(failing.roleSettings).onSetVerbosity("quiet"));
});

test("名前はロールから引ける: cody / chappy 以外の名前でも、名前の一文・whisper の手がかり・呼ばれ方がそのまま通る", (t) => {
  const dir = makeRolesDir(t);
  writeRole({ dir, role: MIO_ROLE });
  const hooks = createRoleHooks({ rolesDir: dir, settings: makeFakeRoleSettings({ roleChoice: "mio" }) });
  const identity = hooks.identity();
  assert.equal(identity.id, "mio");
  assert.equal(identity.displayName, "みお");
  assert.equal(identity.whisperPrompt, "みお、ミオ。");
  assert.deepEqual([...identity.voiceCallVariants], ["ミオ"]);
  const prompt = buildRoleSessionSystemPrompt(identity, "ミオの性格の指示", "");
  assert.equal(prompt, "あなたの名前はミオ（Mio）です。ミオの性格の指示");
  // 指示が無ければ既定の本文、教えは固定の部分として後ろに付く。
  const plain = buildRoleSessionSystemPrompt(identity);
  assert.ok(plain.startsWith("あなたの名前はミオ（Mio）です。あなたは配信の相方です。"));
  assert.ok(plain.endsWith(loadSoulSkills()));
});

test("buildRoleSessionSystemPrompt: cody / chappy の名前は今までと同じ一文・指示を上書きしても教えは消えない（記憶の作り直し Wave 3）", () => {
  const teaching = loadSoulSkills();
  assert.match(teaching, /<recall 頼みごと>/);
  for (const [identity, selfName] of [
    [MODEL_IDENTITIES.cody, "コーディ（Cody）"],
    [MODEL_IDENTITIES.chappy, "チャッピー（Chappy）"]
  ]) {
    const plain = buildRoleSessionSystemPrompt(identity);
    assert.ok(plain.startsWith(`あなたの名前は${selfName}です。`));
    assert.ok(plain.endsWith(teaching));
    const overridden = buildRoleSessionSystemPrompt(identity, "まったく別の会話指示");
    assert.ok(overridden.includes("まったく別の会話指示"));
    assert.ok(overridden.endsWith(teaching), "上書きしても教えは残る");
    assert.doesNotMatch(overridden, /これまでの配信で起きたことの記憶/);
  }
  // 形の壊れた名前は既定（コーディ）。
  assert.ok(buildRoleSessionSystemPrompt({ id: "x" }).startsWith("あなたの名前はコーディ（Cody）です。"));
});

test("会話指示の口: 今のロールの instructions.md に書き、知らないロールは isKnownId で断る（配信の組み直し Domain A）", (t) => {
  const dir = makeRolesDir(t);
  writeChappyAndCody(dir);
  writeRoleInstructions({ dir, id: "chappy", text: "チャッピーの指示" });
  const roleHooks = createRoleHooks({ rolesDir: dir, settings: makeFakeRoleSettings({ roleChoice: "chappy" }) });
  const revision = createInstructionRevisionController();
  const hooks = createConversationInstructionHooks(
    createRoleInstructionStore({ dir, knownIds: () => roleHooks.knownIds() }),
    () => roleHooks.currentId(),
    revision
  );
  assert.equal(hooks.isKnownId("chappy"), true);
  assert.equal(hooks.isKnownId("mio"), false);
  assert.equal(hooks.getProfile().body, "チャッピーの指示", "既定は今のロール");
  assert.equal(hooks.getProfile("cody").hasOverride, false);
  assert.equal(hooks.save("cody", "こーでぃーの指示"), true);
  assert.equal(revision.getRevision(), 1);
  assert.equal(readFileSync(join(dir, "cody", "instructions.md"), "utf8"), "こーでぃーの指示");
  assert.equal(hooks.reset("cody"), true);
  assert.equal(revision.getRevision(), 2);
  assert.equal(hooks.getProfile("cody").hasOverride, false);
  assert.throws(() => hooks.save("mio", "x"), /unknown role/);
  assert.equal(revision.getRevision(), 2, "書けなければ revision は進まない");
  // 置き場の口が isKnown を持たなければ通す（形の確かめは API）。
  const legacy = createConversationInstructionHooks({ getConversationInstructionProfile: () => ({}) }, () => "x");
  assert.equal(legacy.isKnownId("anything"), true);
});

test("resolveRoleVoice: --speaker はロールの話者を上書きし、無ければロールの値・それも無ければ既定（undefined）・ElevenLabs の声の id はロールから", () => {
  const role = normalizeRole("mio", MIO_ROLE);
  assert.deepEqual(resolveRoleVoice(role, {}), { speaker: 1234, voiceId: "voice-mio" });
  assert.deepEqual(resolveRoleVoice(role, { speaker: "999" }), { speaker: "999", voiceId: "voice-mio" });
  const plain = roleFromIdentity(MODEL_IDENTITIES.chappy);
  assert.deepEqual(resolveRoleVoice(plain, {}), { speaker: undefined, voiceId: undefined });
  assert.deepEqual(resolveRoleVoice(plain, parseCockpitArgs(["--speaker", "42"])), { speaker: "42", voiceId: undefined });
});

test("applyRoleHotwords: ロールの hotwords があればそれ（空 = なし）・null なら設定ファイルか既定のまま", () => {
  const local = { threads: 2, preRollMs: 200, silencePadMs: 300, hotwords: ["チャッピー", "コーディ"], hotwordsScore: 1.5 };
  assert.deepEqual(applyRoleHotwords(local, normalizeRole("mio", MIO_ROLE)).hotwords, ["ミオ"]);
  assert.equal(applyRoleHotwords(local, normalizeRole("mio", MIO_ROLE)).threads, 2);
  assert.equal(applyRoleHotwords(local, roleFromIdentity(MODEL_IDENTITIES.cody)), local);
  assert.deepEqual(applyRoleHotwords(local, roleFromIdentity(MODEL_IDENTITIES.cody, { hotwords: [] })).hotwords, []);
});

// ── 頭の切替 × in-flight（不変条件の固定・brain-swap.md §9 (a')）──────────────────────────────
//
//  main() の session/currentBrain/ensureFireResources/onSetBrain 配線と同型の最小ハーネスで、実 read-path
//  コード（createSessionProxy = cockpit.mjs の実体）を通して「切替は accepted Fire snapshot を乱さず、
//  次の ask 境界で新頭へ置換される」不変条件を固定する。配信の組み直し Domain A: 切替はロールの選択（onSetRole）に
//  なり、名前はロールから引く。ここでは頭の系統に合わせたロールの名前（GPT 系 = チャッピー）で指示を組む。

/** @param {string} brain */
const promptForBrain = (brain) =>
  buildRoleSessionSystemPrompt(brain.startsWith("codex") ? MODEL_IDENTITIES.chappy : MODEL_IDENTITIES.cody);

for (const targetBrain of ["codex", "codex-astra"]) {
test(`brain 切替×in-flight: ${targetBrain} accepted session survives the setting write and is replaced at the next Fire`, { timeout: 5000 }, async () => {
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
      systemPrompt: promptForBrain(brain),
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
  assert.equal(claudeHead.systemPrompt, promptForBrain("claude"));
  const configuredPlayer = player;
  assert.equal(playerCreations, 1);

  // in-flight 中の setting write は accepted session/player を変更しない。
  await onSetBrain(targetBrain);
  assert.equal(claudeHead.disposed, false);
  assert.deepEqual(disposed, []);
  assert.equal(session, claudeHead);

  // 次の ask 境界が旧 session を dispose して新頭（codex）を生成する。
  const next = await proxy.ask("hi");
  assert.equal(claudeHead.disposed, true);
  assert.deepEqual(disposed, ["claude"]);
  assert.deepEqual(created, ["claude", targetBrain]);
  assert.equal(next.replyText, `${targetBrain}:hi`);
  assert.equal(session.systemPrompt, promptForBrain(targetBrain));
  assert.equal(player, configuredPlayer, "brain swap must not reconstruct the configured TTS player");
  assert.equal(player.ttsConfig, ttsConfig, "brain swap must preserve TTS base URL/speaker config");
  assert.equal(playerCreations, 1, "brain swap must not create a second TTS dependency");

  // Reverse direction: GPT → Claude also waits for the next Fire/session.
  const codexHead = session;
  await onSetBrain("claude");
  assert.equal(session, codexHead, "setting write does not dispose the accepted resource");
  const reverse = await proxy.ask("back");
  assert.deepEqual(disposed, ["claude", targetBrain]);
  assert.equal(reverse.replyText, "claude:back");
  assert.equal(session.systemPrompt, promptForBrain("claude"));
  assert.deepEqual(created, ["claude", targetBrain, "claude"]);
  assert.equal(player, configuredPlayer);
  assert.equal(playerCreations, 1);

  // in-flight だった claude の ask は既存の dispose 意味論に委ねる（ここでは強制解決して leak を防ぐ）。
  assert.equal(typeof pendingResolve, "function");
  /** @type {(v:any)=>void} */ (pendingResolve)({ replyText: "late", usage: {}, ttftMs: null, elapsedMs: 1 });
  await inflight;
});
}

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

test("conversation instruction revision: production session seam reuses, replaces only on next accepted Fire, and preserves brain/TTS", { timeout: 5000 }, async () => {
  const currentBrain = "codex-61-sol";
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
    const systemPrompt = buildRoleSessionSystemPrompt(
      MODEL_IDENTITIES.chappy,
      resolveConversationInstructionProfile(currentBrain, overrides).body
    );
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

  assert.equal(currentBrain, "codex-61-sol");
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

test("createConversationInstructionHooks: getSoulSkills は①に足す教えと同じ一覧を返す（読むだけの表示用・Wave 3 仕上げ）", () => {
  const settings = {
    getConversationInstructionProfile: () => ({ body: "default", hasOverride: false }),
    setConversationInstruction: () => true,
    resetConversationInstruction: () => true
  };
  const hooks = createConversationInstructionHooks(settings, () => "claude");
  const skills = hooks.getSoulSkills();
  assert.deepEqual(skills, listSoulSkills());
  // 応答の遅れの直し（latency-fix-plan.md §2-4）: 表情タグ・画面の教えも固定のファイルになり、同じ一覧に並ぶ。
  assert.deepEqual(skills.map((s) => [s.name, s.path]), [
    ["expression", "skills/expression.md"],
    ["screen", "skills/screen.md"],
    ["recall", "skills/recall.md"]
  ]);
  assert.equal(skills.map((s) => s.body).join("\n\n"), loadSoulSkills(), "①に足す本文と同じ");
  const injected = createConversationInstructionHooks(settings, () => "claude", undefined, () => [{ name: "x", path: "skills/x.md", body: "b" }]);
  assert.deepEqual(injected.getSoulSkills(), [{ name: "x", path: "skills/x.md", body: "b" }]);
});

// ── createSttEngineHooks / formatSttLatencyLine（操縦席の文字起こし選択・cockpit-stt-selection.md）────────

test("createSttEngineHooks: 未記憶/未知値は whisper・記憶済みの既知値は復元する", { timeout: 5000 }, () => {
  /** @param {string | null} v */
  const settingsWith = (v) => ({ getSttEngine: () => v, setSttEngine: () => {} });
  assert.equal(createSttEngineHooks(settingsWith(null)).resolveInitialSttEngine(), "whisper");
  assert.equal(createSttEngineHooks(settingsWith("google")).resolveInitialSttEngine(), "whisper");
  assert.equal(createSttEngineHooks(settingsWith("elevenlabs")).resolveInitialSttEngine(), "elevenlabs");
  assert.equal(createSttEngineHooks(settingsWith("whisper"), "elevenlabs").resolveInitialSttEngine(), "whisper");
  // ローカルの文字起こし（Parakeet / Zipformer）も既知値として復元する。
  assert.equal(createSttEngineHooks(settingsWith("zipformer")).resolveInitialSttEngine(), "zipformer");
  assert.equal(createSttEngineHooks(settingsWith("parakeet")).resolveInitialSttEngine(), "parakeet");
});

test("createSttEngineHooks: onSetSttEngine は settings へ橋渡しし・throw は握る", { timeout: 5000 }, () => {
  /** @type {string | null} */
  let stored = null;
  const hooks = createSttEngineHooks({ getSttEngine: () => stored, setSttEngine: (e) => { stored = e; } });
  hooks.onSetSttEngine("elevenlabs");
  assert.equal(hooks.resolveInitialSttEngine(), "elevenlabs");
  const throwing = createSttEngineHooks({
    getSttEngine: () => null,
    setSttEngine: () => {
      throw new Error("disk full");
    }
  });
  assert.doesNotThrow(() => throwing.onSetSttEngine("whisper"));
});

test("formatSttLatencyLine: 数字だけの 1 行（物差しが無いときは -）", { timeout: 5000 }, () => {
  assert.equal(formatSttLatencyLine({ engine: "elevenlabs", latencyMs: 512.4 }), "[cockpit] stt latency: engine=elevenlabs ms=512\n");
  assert.equal(formatSttLatencyLine({ engine: "whisper", latencyMs: null }), "[cockpit] stt latency: engine=whisper ms=-\n");
  assert.equal(formatSttLatencyLine({ engine: "whisper", latencyMs: NaN }), "[cockpit] stt latency: engine=whisper ms=-\n");
});

// ── formatCaptureEventLine（画面キャプチャの撮る係・vision-capture-latency §4）────────

test("formatCaptureEventLine: 撮影ごと・起動停止ごとに数字と種類だけの 1 行（タイトルは書かない）", { timeout: 5000 }, () => {
  assert.equal(
    formatCaptureEventLine({ type: "capture", via: "resident", elapsedMs: 48.6, ok: true, kind: null }),
    "[cockpit] capture: via=resident ms=49 result=ok\n"
  );
  assert.equal(
    formatCaptureEventLine({ type: "capture", via: "resident", elapsedMs: 2001, ok: false, kind: "timeout" }),
    "[cockpit] capture: via=resident ms=2001 result=timeout\n"
  );
  assert.equal(
    formatCaptureEventLine({ type: "capture", via: "spawn", elapsedMs: 612, ok: true, kind: null, fallbackReason: "starting" }),
    "[cockpit] capture: via=spawn ms=612 result=ok fallback=starting\n"
  );
  assert.equal(formatCaptureEventLine({ type: "starting" }), "[cockpit] capture helper: starting\n");
  assert.equal(formatCaptureEventLine({ type: "ready", startupMs: 448 }), "[cockpit] capture helper: ready ms=448\n");
  assert.equal(
    formatCaptureEventLine({ type: "exited", code: 1, willRestart: true, reason: "exited" }),
    "[cockpit] capture helper: exited code=1 restart=yes reason=exited\n"
  );
  assert.match(formatCaptureEventLine({ type: "gaveUp", failures: 3 }), /^\[cockpit\] capture helper: gave up after 3 failed starts/);
  assert.equal(formatCaptureEventLine({ type: "stopped" }), "[cockpit] capture helper: stopped\n");
});

// ── createSpeakStartHooks / formatSpeakNowLine（speak-now 合意 §5: 話し始めの切替の保存・判定ログ）────────

test("createSpeakStartHooks: 初回（未記憶）・未知値は speak-now・記憶済みは復元・切替は settings へ（失敗寛容）", { timeout: 5000 }, () => {
  let stored = /** @type {string | null} */ (null);
  const settings = {
    getSpeakStartMode: () => stored,
    setSpeakStartMode: (/** @type {string | null} */ m) => {
      stored = m;
    }
  };
  const hooks = createSpeakStartHooks(settings);
  assert.equal(hooks.resolveInitialSpeakStartMode(), "speak-now", "初回既定は speak-now");
  stored = "bogus";
  assert.equal(hooks.resolveInitialSpeakStartMode(), "speak-now");
  hooks.onSetSpeakStartMode("classic");
  assert.equal(stored, "classic");
  assert.equal(hooks.resolveInitialSpeakStartMode(), "classic");
  const failing = createSpeakStartHooks({
    getSpeakStartMode: () => null,
    setSpeakStartMode: () => {
      throw new Error("disk full");
    }
  });
  assert.doesNotThrow(() => failing.onSetSpeakStartMode("speak-now"));
});

test("createSpeakStartHooks: 相槌どうしの最小間隔は settings の秒 → ミリ秒・未設定/読めない/getter なしは undefined（= 既定 8 秒）", { timeout: 5000 }, () => {
  /** @type {number | null} */
  let sec = null;
  const base = { getSpeakStartMode: () => null, setSpeakStartMode: () => {} };
  const hooks = createSpeakStartHooks({ ...base, getBackchannelMinIntervalSec: () => sec });
  assert.equal(hooks.resolveBackchannelMinIntervalMs(), undefined);
  sec = 5;
  assert.equal(hooks.resolveBackchannelMinIntervalMs(), 5_000);
  sec = 0;
  assert.equal(hooks.resolveBackchannelMinIntervalMs(), 0, "0 は歯止めなし");
  sec = -3;
  assert.equal(hooks.resolveBackchannelMinIntervalMs(), undefined);
  assert.equal(createSpeakStartHooks(base).resolveBackchannelMinIntervalMs(), undefined, "getter なし");
  const failing = createSpeakStartHooks({
    ...base,
    getBackchannelMinIntervalSec: () => {
      throw new Error("broken");
    }
  });
  assert.equal(failing.resolveBackchannelMinIntervalMs(), undefined);
});

test("formatSpeakNowLine: 遅延・選択・確率の 1 行（本文なし）・失敗は理由", { timeout: 5000 }, () => {
  assert.equal(
    formatSpeakNowLine({
      ok: true,
      trigger: "transcript",
      choice: "initiate",
      probability: 0.4512,
      probs: { wait: 0.2, backchannel: 0.15, respond: 0.18, initiate: 0.4512, look: 0.02 },
      latencyMs: 812.4,
      action: "fire"
    }),
    "[cockpit] speak-now: ms=812 choice=initiate p=0.45 action=fire trigger=transcript probs=wait:0.20,backchannel:0.15,respond:0.18,initiate:0.45,look:0.02\n"
  );
  // 画面を見る（look・experiments/04-look-request.md）も同じ 1 行。
  assert.equal(
    formatSpeakNowLine({
      ok: true,
      trigger: "transcript",
      choice: "look",
      probability: 0.58,
      probs: { wait: 0.11, backchannel: 0.05, respond: 0.21, initiate: 0.05, look: 0.58 },
      latencyMs: 610,
      action: "fire"
    }),
    "[cockpit] speak-now: ms=610 choice=look p=0.58 action=fire trigger=transcript probs=wait:0.11,backchannel:0.05,respond:0.21,initiate:0.05,look:0.58\n"
  );
  assert.equal(
    formatSpeakNowLine({
      ok: true,
      trigger: "transcript",
      choice: "backchannel",
      probability: 0.41,
      probs: { wait: 0.3, backchannel: 0.41, respond: 0.2, initiate: 0.09 },
      latencyMs: 640,
      action: "skip-interval"
    }),
    "[cockpit] speak-now: ms=640 choice=backchannel p=0.41 action=skip-interval trigger=transcript probs=wait:0.30,backchannel:0.41,respond:0.20,initiate:0.09,look:-\n"
  );
  assert.equal(
    formatSpeakNowLine({ ok: false, trigger: "after-busy", error: "タイムアウト（3 秒）", latencyMs: 3000 }),
    "[cockpit] speak-now: error ms=3000 trigger=after-busy reason=タイムアウト（3 秒）\n"
  );
  assert.equal(
    formatSpeakNowLine({ ok: false, trigger: "transcript", error: "キーが見つからない", latencyMs: null }),
    "[cockpit] speak-now: error ms=- trigger=transcript reason=キーが見つからない\n"
  );
});

// ── createCommentBusyHooks / formatCommentJudgmentLine（コメント反応の合意 §2・§3）────────────────

test("createCommentBusyHooks: 未記憶・未知値は hold（あとで拾う）・記憶済みは復元・切替は settings へ（失敗寛容）・鮮度と件数", { timeout: 5000 }, () => {
  let stored = /** @type {string | null} */ (null);
  /** @type {{ maxAgeSec: number | null; maxCount: number | null }} */
  let hold = { maxAgeSec: null, maxCount: null };
  const settings = {
    getCommentBusyPolicy: () => stored,
    setCommentBusyPolicy: (/** @type {string | null} */ p) => {
      stored = p;
    },
    getCommentHold: () => hold
  };
  const hooks = createCommentBusyHooks(settings);
  assert.equal(hooks.resolveInitialCommentBusyPolicy(), "hold");
  stored = "bogus";
  assert.equal(hooks.resolveInitialCommentBusyPolicy(), "hold");
  hooks.onSetCommentBusyPolicy("drop");
  assert.equal(stored, "drop");
  assert.equal(hooks.resolveInitialCommentBusyPolicy(), "drop");
  assert.deepEqual(hooks.resolveCommentHold(), { maxAgeMs: undefined, maxCount: undefined });
  hold = { maxAgeSec: 30, maxCount: 5 };
  assert.deepEqual(hooks.resolveCommentHold(), { maxAgeMs: 30_000, maxCount: 5 });
  const failing = createCommentBusyHooks({
    getCommentBusyPolicy: () => null,
    setCommentBusyPolicy: () => {
      throw new Error("disk full");
    },
    getCommentHold: () => {
      throw new Error("broken");
    }
  });
  assert.doesNotThrow(() => failing.onSetCommentBusyPolicy("hold"));
  assert.deepEqual(failing.resolveCommentHold(), { maxAgeMs: undefined, maxCount: undefined });
});

test("formatCommentJudgmentLine: 弾く判定・反応する判定の 1 行（コメント本文なし）", { timeout: 5000 }, () => {
  assert.equal(
    formatCommentJudgmentLine({ stage: "guard", commentId: "m1", pass: true, kind: "ok", verdict: "ok", hijackProbability: 0.021, latencyMs: 180.4, error: null }),
    "[cockpit] comment-guard: ms=180 id=m1 action=pass verdict=ok hijack=0.02\n"
  );
  assert.equal(
    formatCommentJudgmentLine({ stage: "guard", commentId: "m2", pass: false, kind: "hijack", verdict: "refusal", hijackProbability: 0.81, latencyMs: 200 }),
    "[cockpit] comment-guard: ms=200 id=m2 action=reject:hijack verdict=refusal hijack=0.81\n"
  );
  assert.equal(
    formatCommentJudgmentLine({ stage: "guard", commentId: "m3", pass: false, kind: "error", verdict: null, hijackProbability: null, latencyMs: 5000, error: "タイムアウト（5 秒）" }),
    "[cockpit] comment-guard: ms=5000 id=m3 action=reject:error verdict=- hijack=- reason=タイムアウト（5 秒）\n"
  );
  assert.equal(
    formatCommentJudgmentLine({ stage: "react", ok: true, trigger: "comment", commentId: "m4", choice: "react", probability: 0.92, latencyMs: 240, action: "fire" }),
    "[cockpit] comment-react: ms=240 id=m4 choice=react p=0.92 action=fire trigger=comment\n"
  );
  assert.equal(
    formatCommentJudgmentLine({ stage: "react", ok: false, trigger: "after-busy", commentId: "m5", error: "キーが見つからない", latencyMs: null }),
    "[cockpit] comment-react: error ms=- id=m5 trigger=after-busy reason=キーが見つからない\n"
  );
  assert.equal(
    formatCommentJudgmentLine({ stage: "react", ok: true, skipped: true, commentId: "m6", action: "hold" }),
    "[cockpit] comment-react: id=m6 action=hold\n"
  );
});

// ── 操縦席の作り直し 1 回目（データ側）: 残量の読み口・遅延のしきい値・遅延の 1 行 ─────────────────────

test("isCodexBrainId / createCodexQuotaReader: 頭が Codex で readRateLimits を持つセッションのときだけ読む（それ以外は null = 不明）", async () => {
  const { isCodexBrainId, createCodexQuotaReader } = await import("./cockpit.mjs");
  assert.equal(isCodexBrainId("codex"), true);
  assert.equal(isCodexBrainId("codex-61-sol"), true);
  assert.equal(isCodexBrainId("claude"), false);
  assert.equal(isCodexBrainId("claude-opus-55"), false);
  assert.equal(isCodexBrainId(undefined), false);
  let brain = "claude";
  /** @type {any} */
  let session = { readRateLimits: async () => ({ rateLimits: { primary: { usedPercent: 1 } } }) };
  const read = createCodexQuotaReader({ getBrain: () => brain, getSession: () => session });
  assert.equal(await read(), null, "頭が Claude なら読まない");
  brain = "codex-61-sol";
  assert.equal((await read()).rateLimits.primary.usedPercent, 1);
  session = { ask() {} };
  assert.equal(await read(), null, "readRateLimits の無いセッション");
  session = null;
  assert.equal(await read(), null, "まだセッションが無い");
});

test("resolveLatencyThresholdsFromSettings: settings の latencyWarnSec / latencyAlertSec・未設定や読めなければ 4 / 6 秒", async () => {
  const { resolveLatencyThresholdsFromSettings } = await import("./cockpit.mjs");
  assert.deepEqual(resolveLatencyThresholdsFromSettings({ getLatencyThresholds: () => ({ warnSec: 3, alertSec: 5 }) }), { warnSec: 3, alertSec: 5 });
  assert.deepEqual(resolveLatencyThresholdsFromSettings({ getLatencyThresholds: () => ({ warnSec: null, alertSec: null }) }), { warnSec: 4, alertSec: 6 });
  assert.deepEqual(resolveLatencyThresholdsFromSettings({}), { warnSec: 4, alertSec: 6 });
  assert.deepEqual(
    resolveLatencyThresholdsFromSettings({
      getLatencyThresholds: () => {
        throw new Error("x");
      }
    }),
    { warnSec: 4, alertSec: 6 }
  );
});

test("formatReplyLatencyLine: 数字ときっかけの種類だけの 1 行（測れない区間は -）", async () => {
  const { formatReplyLatencyLine } = await import("./cockpit.mjs");
  const line = formatReplyLatencyLine({
    fireId: 3,
    cause: { type: "speak-now", choice: "respond", triggerSeq: 41 },
    spoken: true,
    segments: { transcribeMs: 512.4, judgeMs: 812, screenMs: null, llmFirstMs: 900, firstSentenceMs: 300, ttsMs: 400, voiceMs: 200 },
    otherMs: 100,
    totalMs: 3224,
    level: "ok"
  });
  assert.equal(
    line,
    "[cockpit] latency: fire=3 cause=speak-now total=3224 level=ok stt=512 judge=812 screen=- llm=900 sentence=300 tts=400 voice=200 other=100\n"
  );
  assert.match(formatReplyLatencyLine({ fireId: 4, cause: null, spoken: false, segments: {}, totalMs: null, level: null }), /cause=- total=- level=- .* spoken=no\n$/);
  // 声の差し替え Wave 3: 鳴らした声の engine（voice）があれば末尾に足す（TTS / 声の区間を engine ごとに見比べる）。
  assert.match(
    formatReplyLatencyLine({ fireId: 5, cause: null, spoken: true, segments: { ttsMs: 130, voiceMs: 60 }, totalMs: 900, level: "ok", voice: "elevenlabs" }),
    /tts=130 voice=60 other=- voiceEngine=elevenlabs\n$/
  );
});

test("resolveContextCompactionOptions: settings の compact* キー・未設定や読めなければ 20 万トークン / 3 秒 / 10 分", async () => {
  const { resolveContextCompactionOptions } = await import("./cockpit.mjs");
  assert.deepEqual(
    resolveContextCompactionOptions({ getContextCompaction: () => ({ thresholdTokens: 250_000, quietSec: 5, minIntervalMin: 15 }) }),
    { thresholdTokens: 250_000, quietMs: 5000, minIntervalMs: 900_000 }
  );
  const defaults = { thresholdTokens: 200_000, quietMs: 3000, minIntervalMs: 600_000 };
  assert.deepEqual(resolveContextCompactionOptions({ getContextCompaction: () => ({ thresholdTokens: null, quietSec: null, minIntervalMin: null }) }), defaults);
  assert.deepEqual(
    resolveContextCompactionOptions({ getContextCompaction: () => ({ thresholdTokens: /** @type {any} */ (10), quietSec: null, minIntervalMin: null }) }),
    defaults,
    "範囲外は既定"
  );
  assert.deepEqual(resolveContextCompactionOptions({}), defaults);
  assert.deepEqual(resolveContextCompactionOptions({ getContextCompaction: () => { throw new Error("x"); } }), defaults);
});

test("formatContextCompactionLine: 圧縮の開始・終了・失敗をターミナルに 1 行（数字と理由だけ）", async () => {
  const { formatContextCompactionLine } = await import("./cockpit.mjs");
  assert.equal(
    formatContextCompactionLine({ type: "started", lastInputTokens: 201_234, thresholdTokens: 200_000, ratio: 0.4237, modelContextWindow: 475_000, totalInputTokens: 3_000_000 }),
    "[cockpit] context compaction started: last input 201234 tokens > threshold 200000 (42% of window 475000, total 3000000)\n"
  );
  assert.equal(
    formatContextCompactionLine({ type: "started", lastInputTokens: 201_234, thresholdTokens: 200_000, ratio: null, modelContextWindow: null, totalInputTokens: null }),
    "[cockpit] context compaction started: last input 201234 tokens > threshold 200000 (- of window -, total -)\n",
    "窓が分からなくても量で読める"
  );
  assert.equal(
    formatContextCompactionLine({ type: "finished", ok: true, durationMs: 12_345, personaInjected: true }),
    "[cockpit] context compaction finished: 12.3s (persona re-injected)\n"
  );
  assert.equal(
    formatContextCompactionLine({ type: "finished", ok: true, durationMs: 1000, personaInjected: false, personaDeferred: true }),
    "[cockpit] context compaction finished: 1.0s (persona deferred to next turn)\n"
  );
  assert.equal(
    formatContextCompactionLine({ type: "finished", ok: false, durationMs: 500, reason: "failed", message: "codex-session: compaction timed out." }),
    "[cockpit] context compaction failed: 0.5s reason=failed — codex-session: compaction timed out.\n"
  );
});

test("createContextCompactionHooks: 設定画面で変えたら走っている compactor の目安を差し替え、settings に保存する（保存失敗でも効く）", async () => {
  const { createContextCompactionHooks } = await import("./cockpit.mjs");
  const { createContextCompactor } = await import("../src/mind/context-compactor.mjs");
  const compactor = createContextCompactor({ getSession: () => null, getQuietGap: () => null, thresholdTokens: 200_000 });
  /** @type {any[]} */
  const saved = [];
  const hooks = createContextCompactionHooks({ setCompactThresholdTokens: (t) => saved.push(t) }, compactor);
  assert.deepEqual(hooks.contextCompactionStatus(), { thresholdTokens: 200_000 });
  hooks.onSetCompactThresholdTokens(150_000);
  assert.equal(compactor.getThresholdTokens(), 150_000, "その場で差し替わる（次の確認から効く）");
  assert.deepEqual(saved, [150_000], "次回起動用に保存");
  assert.deepEqual(hooks.contextCompactionStatus(), { thresholdTokens: 150_000 });
  const failing = createContextCompactionHooks({ setCompactThresholdTokens: () => { throw new Error("disk"); } }, compactor);
  failing.onSetCompactThresholdTokens(300_000);
  assert.equal(compactor.getThresholdTokens(), 300_000, "保存に失敗しても走っている部品には効く");
  createContextCompactionHooks({}, compactor).onSetCompactThresholdTokens(250_000);
  assert.equal(compactor.getThresholdTokens(), 250_000, "setter の無い settings でも throw しない");
  compactor.dispose();
});

test("contextCompactionUsageRecord: 開始の記録に、そのときの目安 thresholdTokens を足す（他のキーは compactionUsageRecord のまま）", async () => {
  const { contextCompactionUsageRecord } = await import("./cockpit.mjs");
  assert.deepEqual(
    contextCompactionUsageRecord(
      { type: "started", lastInputTokens: 201_234, thresholdTokens: 200_000, ratio: 0.42, totalInputTokens: 3_000_000, modelContextWindow: 475_000 },
      "codex-61-sol"
    ),
    { type: "compactStarted", brain: "codex-61-sol", ratio: 0.42, lastInputTokens: 201_234, totalInputTokens: 3_000_000, modelContextWindow: 475_000, thresholdTokens: 200_000 }
  );
  const finished = contextCompactionUsageRecord({ type: "finished", ok: true, durationMs: 7000, personaInjected: true }, "codex-61-sol");
  assert.equal(finished.type, "compactFinished");
  assert.equal("thresholdTokens" in finished, false);
});

test("圧縮の目安の結線: 設定画面の口（onSetCompactThresholdTokens / contextCompactionStatus）を cockpit-server へ渡し、SSE に量を載せる", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("./cockpit.mjs", import.meta.url), "utf8");
  assert.match(source, /createContextCompactionHooks\(settings, contextCompactor\)/);
  assert.match(source, /onSetCompactThresholdTokens: contextCompactionHooks\.onSetCompactThresholdTokens/);
  assert.match(source, /contextCompactionStatus: contextCompactionHooks\.contextCompactionStatus/);
  assert.match(source, /sessionUsageLog\.append\(contextCompactionUsageRecord\(event, currentBrain\)\)/);
  assert.match(source, /phase: "started", inputTokens: event\.lastInputTokens, thresholdTokens: event\.thresholdTokens/);
});

test("resolveCodexServiceTier: Codex の頭は ON で priority・OFF で default（明示）・Claude の頭は null（送らない）", async () => {
  const { resolveCodexServiceTier } = await import("./cockpit.mjs");
  assert.equal(resolveCodexServiceTier("codex-61-sol", true), "priority");
  assert.equal(resolveCodexServiceTier("codex", false), "default");
  assert.equal(resolveCodexServiceTier("codex-astra", true), "priority");
  assert.equal(resolveCodexServiceTier("claude", true), null);
  assert.equal(resolveCodexServiceTier("claude-opus-55", false), null);
  assert.equal(resolveCodexServiceTier(null, true), null);
});

test("createCodexFastHooks: 既定 OFF・記憶を復元・切り替えを保存して次の段に効かせる・モデルの対応を頭ごとに覚える", async () => {
  const { createCodexFastHooks } = await import("./cockpit.mjs");
  /** @type {boolean[]} */
  const saved = [];
  const hooks = createCodexFastHooks({ getCodexFastMode: () => null, setCodexFastMode: (v) => saved.push(v) });
  assert.equal(hooks.isEnabled(), false, "未記憶は既定 OFF");
  assert.equal(hooks.serviceTierFor("codex-61-sol"), "default");
  assert.deepEqual(hooks.codexFastStatus("codex-61-sol"), { enabled: false, applicable: true, supported: null });
  hooks.onSetCodexFastMode(true);
  assert.deepEqual(saved, [true], "次回起動用に保存");
  assert.equal(hooks.serviceTierFor("codex-61-sol"), "priority", "次の受理から priority");
  assert.equal(hooks.serviceTierFor("claude"), null, "Claude の頭には送らない");
  assert.deepEqual(hooks.codexFastStatus("claude"), { enabled: true, applicable: false, supported: null });
  // model/list で読んだ段（codex-session の onServiceTiers）。変わったときだけ true（SSE で押す合図）。
  assert.equal(hooks.noteServiceTiers("codex-61-sol", ["priority"]), true);
  assert.equal(hooks.noteServiceTiers("codex-61-sol", ["priority"]), false, "同じなら押さない");
  assert.deepEqual(hooks.codexFastStatus("codex-61-sol"), { enabled: true, applicable: true, supported: true });
  assert.equal(hooks.noteServiceTiers("codex", []), true);
  assert.deepEqual(hooks.codexFastStatus("codex"), { enabled: true, applicable: true, supported: false }, "priority を持たないモデル");
  hooks.noteServiceTiers("codex-astra", null);
  assert.equal(hooks.codexFastStatus("codex-astra").supported, null, "読めなければ不明");
  hooks.onSetCodexFastMode(false);
  assert.equal(hooks.serviceTierFor("codex-61-sol"), "default", "OFF に戻すと default を送る");
  assert.equal(createCodexFastHooks({ getCodexFastMode: () => true }).isEnabled(), true, "記憶した ON を復元");
  const failing = createCodexFastHooks({ getCodexFastMode: () => { throw new Error("disk"); }, setCodexFastMode: () => { throw new Error("disk"); } });
  assert.equal(failing.isEnabled(), false, "読めなければ既定");
  failing.onSetCodexFastMode(true);
  assert.equal(failing.isEnabled(), true, "保存に失敗しても次の返事には効く");
});

test("Codex の fast の結線: 受理の configuration に段・①のセッションに onServiceTiers・cockpit-server に口を渡す", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("./cockpit.mjs", import.meta.url), "utf8");
  assert.match(source, /const codexFastHooks = createCodexFastHooks\(settings, false\);/);
  assert.match(source, /serviceTier: codexFastHooks\.serviceTierFor\(currentBrain\)/, "受理の時点の設定 = 次の返事から効く");
  assert.match(
    source,
    /onServiceTiers: \(\/\*\* @type \{any\} \*\/ info\) => \{\s*if \(codexFastHooks\.noteServiceTiers\(sessionBrain, info\?\.serviceTiers\)\) server\?\.codexFastStatusChanged\(\);/
  );
  assert.match(source, /onSetCodexFastMode,\s*codexFastStatus: \(\) => codexFastHooks\.codexFastStatus\(currentBrain\)/);
  // ②書き出し役・④思い出し役は段を渡さない（通常のまま）。
  const writer = source.slice(source.indexOf("const memoryRecorder = createMemoryRecorder"), source.indexOf("const memoryStatus = () =>"));
  assert.ok(writer.length > 0);
  assert.doesNotMatch(writer, /serviceTier/);
});

test("頭の作り直しの結線: 古い頭を畳んだら操縦席の「圧縮中」を戻す（resetContextCompaction）", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("./cockpit.mjs", import.meta.url), "utf8");
  assert.match(
    source,
    /await stale\.dispose\(\);[\s\S]{0,400}?server\?\.resetContextCompaction\(\);[\s\S]{0,80}?if \(session === stale\)/,
    "stale の dispose の後、session を null に戻す前に戻す"
  );
});

// ── createTtsEngineHooks / createVoiceEngineManager（声の差し替え Wave 3 Domain E）──────────────────
//  engine の工場は偽物（ElevenLabs に繋がない・AivisSpeech も叩かない）。キーは偽物の読み口で渡し、
//  作る・使い回す・作り直す・dispose・status の配線を固定する。

const FAKE_TTS_KEY = "sk_fake_tts_key_do_not_leak";

/** 偽物の VoiceEngine 工場（作った engine と渡された deps を記録する）。 */
function makeFakeVoiceFactory({ throwFor = /** @type {string | null} */ (null) } = {}) {
  /** @type {Array<{ kind: string; deps: any; engine: any }>} */
  const made = [];
  /** @param {string} kind @param {any} deps */
  const createEngine = (kind, deps) => {
    if (throwFor === kind) throw new RangeError(`unknown voice engine kind: ${kind} (known: aivis).`);
    /** @type {Set<(s: string) => void>} */
    const listeners = new Set();
    const engine = {
      kind,
      status: kind === "elevenlabs" ? "connecting" : "up",
      disposed: false,
      /** @param {(s: string) => void} fn */
      onStatus(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      /** @param {string} s */
      emit(s) {
        engine.status = s;
        for (const fn of [...listeners]) fn(s);
      },
      listenerCount: () => listeners.size,
      synthesize() {
        throw new Error("not used");
      },
      dispose() {
        engine.disposed = true;
      }
    };
    made.push({ kind, deps, engine });
    return engine;
  };
  return { createEngine, made };
}

test("createTtsEngineHooks: 未記憶/未知値は aivis・記憶済みの既知値は復元・set は settings へ橋渡しし throw は握る", { timeout: 5000 }, () => {
  /** @param {string | null} v */
  const settingsWith = (v) => ({ getTtsEngine: () => v, setTtsEngine: () => {} });
  assert.equal(createTtsEngineHooks(settingsWith(null)).resolveInitialTtsEngine(), "aivis");
  assert.equal(createTtsEngineHooks(settingsWith("voicevox")).resolveInitialTtsEngine(), "aivis");
  assert.equal(createTtsEngineHooks(settingsWith("elevenlabs")).resolveInitialTtsEngine(), "elevenlabs");
  /** @type {string | null} */
  let stored = null;
  const hooks = createTtsEngineHooks({ getTtsEngine: () => stored, setTtsEngine: (e) => { stored = e; } });
  hooks.onSetTtsEngine("elevenlabs");
  assert.equal(hooks.resolveInitialTtsEngine(), "elevenlabs");
  const throwing = createTtsEngineHooks({
    getTtsEngine: () => null,
    setTtsEngine: () => {
      throw new Error("disk full");
    }
  });
  assert.doesNotThrow(() => throwing.onSetTtsEngine("aivis"));
});

test("createVoiceEngineManager: aivis を作り・同じ種類の Start は使い回し・種類が変われば古い engine を dispose して作り直す", { timeout: 5000 }, () => {
  const f = makeFakeVoiceFactory();
  /** @type {any[]} */ const statuses = [];
  let keyReads = 0;
  const mgr = createVoiceEngineManager({
    createEngine: f.createEngine,
    loadApiKey: () => {
      keyReads += 1;
      return { ok: true, apiKey: FAKE_TTS_KEY };
    },
    aivisDeps: () => ({ ttsBaseUrl: "http://aivis.test", speaker: 7 }),
    elevenLabsDeps: () => ({ readingClient: { marker: "reading" } }),
    onStatus: (info) => statuses.push(info)
  });
  assert.equal(mgr.current(), null);
  assert.deepEqual(mgr.prepare("aivis"), { ok: true });
  assert.equal(f.made.length, 1);
  assert.deepEqual(f.made[0].deps, { ttsBaseUrl: "http://aivis.test", speaker: 7 });
  assert.equal(keyReads, 0, "aivis はキーを読まない");
  const aivis = f.made[0].engine;
  assert.equal(mgr.current(), aivis);
  assert.equal(mgr.currentKind(), "aivis");

  // 同じ種類の Start は作り直さない（Wave 2 と同じく使い回し）。
  assert.deepEqual(mgr.prepare("aivis"), { ok: true });
  assert.equal(f.made.length, 1);

  // 種類が変われば古い engine を dispose し、ElevenLabs のキーを読んで作り直す。
  assert.deepEqual(mgr.prepare("elevenlabs"), { ok: true });
  assert.equal(aivis.disposed, true);
  assert.equal(aivis.listenerCount(), 0, "古い engine の status 購読も外す");
  assert.equal(f.made.length, 2);
  const el = f.made[1].engine;
  assert.equal(f.made[1].kind, "elevenlabs");
  assert.equal(f.made[1].deps.apiKey, FAKE_TTS_KEY);
  assert.deepEqual(f.made[1].deps.readingClient, { marker: "reading" });
  assert.equal(typeof f.made[1].deps.onReadingsFallback, "function");
  assert.equal(keyReads, 1);
  assert.equal(mgr.current(), el);

  // 戻すとまた作り直す（ElevenLabs は dispose）。
  assert.deepEqual(mgr.prepare("aivis"), { ok: true });
  assert.equal(el.disposed, true);
  assert.equal(f.made.length, 3);

  // status の通知は「種類つき」で、作ったときの今の値も知らせる。
  assert.deepEqual(statuses.slice(0, 2), [
    { engine: "aivis", status: "up", reason: null },
    { engine: "elevenlabs", status: "connecting", reason: null }
  ]);
  // 終了時に畳む。
  mgr.dispose();
  assert.equal(f.made[2].engine.disposed, true);
  assert.equal(mgr.current(), null);
  // キーは status の通知に載らない。
  assert.equal(JSON.stringify(statuses).includes(FAKE_TTS_KEY), false);
});

test("createVoiceEngineManager: 声（話者・声の id）が替われば種類が同じでも engine を作り直す（配信の組み直し Domain A・voiceKey）", { timeout: 5000 }, () => {
  const f = makeFakeVoiceFactory();
  let voice = { speaker: 7, voiceId: undefined };
  const mgr = createVoiceEngineManager({
    createEngine: f.createEngine,
    loadApiKey: () => ({ ok: true, apiKey: FAKE_TTS_KEY }),
    aivisDeps: () => ({ ttsBaseUrl: "http://aivis.test", speaker: voice.speaker }),
    elevenLabsDeps: () => ({ readingClient: { marker: "reading" }, ...(voice.voiceId ? { voiceId: voice.voiceId } : {}) }),
    voiceKey: () => JSON.stringify(voice)
  });
  assert.deepEqual(mgr.prepare("aivis"), { ok: true });
  const first = f.made[0].engine;
  // 声が同じなら使い回す（今までと同じ）。
  assert.deepEqual(mgr.prepare("aivis"), { ok: true });
  assert.equal(f.made.length, 1);
  // 話者が替われば（ロールを替えた）古い engine を dispose して、新しい話者で作り直す。
  voice = { speaker: 1234, voiceId: undefined };
  assert.deepEqual(mgr.prepare("aivis"), { ok: true });
  assert.equal(first.disposed, true);
  assert.equal(f.made.length, 2);
  assert.equal(f.made[1].deps.speaker, 1234);
  // Start より前の Fire（ensure）も、声が替わっていれば作り直す。
  voice = { speaker: 1234, voiceId: "voice-b" };
  const ensured = mgr.ensure("aivis");
  assert.equal(f.made.length, 3);
  assert.equal(ensured, f.made[2].engine);
  assert.equal(f.made[1].engine.disposed, true);
  assert.equal(mgr.ensure("aivis"), ensured, "同じ声なら ensure は今の engine");
  // ElevenLabs の声の id も同じ（替われば作り直し・deps に voiceId が載る）。
  assert.deepEqual(mgr.prepare("elevenlabs"), { ok: true });
  assert.equal(f.made[3].deps.voiceId, "voice-b");
  voice = { speaker: 1234, voiceId: "voice-c" };
  assert.deepEqual(mgr.prepare("elevenlabs"), { ok: true });
  assert.equal(f.made.length, 5);
  assert.equal(f.made[4].deps.voiceId, "voice-c");
  mgr.dispose();
});

test("createVoiceEngineManager: engine の onStatus を今の engine の分だけ流す（作り直した古い engine の通知は捨てる）", { timeout: 5000 }, () => {
  const f = makeFakeVoiceFactory();
  /** @type {any[]} */ const statuses = [];
  const mgr = createVoiceEngineManager({
    createEngine: f.createEngine,
    loadApiKey: () => ({ ok: true, apiKey: FAKE_TTS_KEY }),
    onStatus: (info) => statuses.push(info)
  });
  mgr.prepare("elevenlabs");
  const el = f.made[0].engine;
  el.emit("up");
  el.emit("reconnecting");
  el.emit("up");
  assert.deepEqual(
    statuses.map((s) => s.status),
    ["connecting", "up", "reconnecting", "up"]
  );
  mgr.prepare("aivis");
  const n = statuses.length;
  el.emit("down"); // dispose 後の古い engine の通知。
  assert.equal(statuses.length, n);
});

test("createVoiceEngineManager: ElevenLabs のキーが無ければ作らず理由を返す（古い engine も持たない・自動で aivis に戻さない）", { timeout: 5000 }, () => {
  const f = makeFakeVoiceFactory();
  /** @type {any[]} */ const statuses = [];
  const mgr = createVoiceEngineManager({
    createEngine: f.createEngine,
    loadApiKey: () => ({ ok: false, reason: "ElevenLabs のキーが見つからない（テスト）" }),
    onStatus: (info) => statuses.push(info)
  });
  mgr.prepare("aivis");
  const aivis = f.made[0].engine;
  assert.deepEqual(mgr.prepare("elevenlabs"), { ok: false, reason: "ElevenLabs のキーが見つからない（テスト）" });
  assert.equal(f.made.length, 1, "工場は呼ばない");
  assert.equal(aivis.disposed, true);
  assert.equal(mgr.current(), null);
  assert.deepEqual(statuses.at(-1), { engine: "elevenlabs", status: "down", reason: "ElevenLabs のキーが見つからない（テスト）" });
  // Start より前の Fire と同じ道（ensure）は理由の Error を投げる。
  assert.throws(() => mgr.ensure("elevenlabs"), /ElevenLabs のキーが見つからない（テスト）/);
  // 読み口が投げても同じく失敗に畳む。
  const throwing = createVoiceEngineManager({
    createEngine: f.createEngine,
    loadApiKey: () => {
      throw new Error("io");
    }
  });
  assert.deepEqual(throwing.prepare("elevenlabs"), { ok: false, reason: "ElevenLabs のキーが見つからない" });
});

test("createVoiceEngineManager: 工場が投げたら（elevenlabs が未登録など）理由を返す・キーは理由に入らない", { timeout: 5000 }, () => {
  const f = makeFakeVoiceFactory({ throwFor: "elevenlabs" });
  const mgr = createVoiceEngineManager({
    createEngine: f.createEngine,
    loadApiKey: () => ({ ok: true, apiKey: FAKE_TTS_KEY })
  });
  const r = mgr.prepare("elevenlabs");
  assert.equal(r.ok, false);
  assert.match(/** @type {any} */ (r).reason, /^声の engine を作れない（elevenlabs: unknown voice engine kind: elevenlabs/);
  assert.equal(/** @type {any} */ (r).reason.includes(FAKE_TTS_KEY), false);
  assert.equal(mgr.current(), null);
});

test("createVoiceEngineManager: ensure は今の engine を返し・無ければその種類で作る（Start より前の Fire）", { timeout: 5000 }, () => {
  const f = makeFakeVoiceFactory();
  const mgr = createVoiceEngineManager({ createEngine: f.createEngine });
  const a = mgr.ensure("aivis");
  assert.equal(a, f.made[0].engine);
  assert.equal(mgr.ensure("aivis"), a);
  assert.equal(f.made.length, 1);
});

test("createVoiceEngineManager: onReadingsFallback は deps 経由で上へ届き・通知先の throw は握る", { timeout: 5000 }, () => {
  const f = makeFakeVoiceFactory();
  let fallbacks = 0;
  const mgr = createVoiceEngineManager({
    createEngine: f.createEngine,
    loadApiKey: () => ({ ok: true, apiKey: FAKE_TTS_KEY }),
    onReadingsFallback: () => {
      fallbacks += 1;
      throw new Error("warn board down");
    },
    onStatus: () => {
      throw new Error("status sink down");
    }
  });
  assert.deepEqual(mgr.prepare("elevenlabs"), { ok: true });
  assert.doesNotThrow(() => f.made[0].deps.onReadingsFallback({ reason: "x" }));
  assert.equal(fallbacks, 1);
  assert.doesNotThrow(() => f.made[0].engine.emit("reconnecting"));
});

test("voiceDiagnosticReason: 切断・接続失敗・サーバーのエラーを短い理由に・繋がれば null・他は undefined・制御文字を除き 80 字で切る", { timeout: 5000 }, () => {
  assert.equal(voiceDiagnosticReason({ type: "ttsDisconnected", reason: "code=1006", message: null }), "closed code=1006");
  assert.equal(voiceDiagnosticReason({ type: "ttsDisconnected", reason: null }), "closed code=?");
  assert.equal(voiceDiagnosticReason({ type: "ttsConnectFailed", reason: "closed code=1008" }), "接続できない（closed code=1008）");
  assert.equal(voiceDiagnosticReason({ type: "ttsConnectFailed", reason: "no open within 10000ms" }), "接続できない（no open within 10000ms）");
  assert.equal(voiceDiagnosticReason({ type: "ttsServerError", reason: "input_timeout_exceeded" }), "サーバーのエラー（input_timeout_exceeded）");
  assert.equal(voiceDiagnosticReason({ type: "ttsConnected", reason: null }), null);
  assert.equal(voiceDiagnosticReason({ type: "ttsReconnected", reason: null }), null);
  for (const other of [{ type: "ttsRestarted", reason: "abort" }, { type: "ttsMessageParseError" }, { type: "sttDisconnected", reason: "code=1006" }, null, "x"]) {
    assert.equal(voiceDiagnosticReason(other), undefined);
  }
  // message は使わない（engine は常に null だが、来ても載せない）。
  assert.equal(voiceDiagnosticReason({ type: "ttsDisconnected", reason: "code=1006", message: "本文やキー" }), "closed code=1006");
  const long = /** @type {string} */ (voiceDiagnosticReason({ type: "ttsConnectFailed", reason: `a\nb\t${"z".repeat(200)}` }));
  assert.equal(long.length, 80);
  assert.ok(long.startsWith("接続できない（a b z"));
  assert.ok(long.endsWith("…"));
});

test("createVoiceEngineManager: ElevenLabs の診断の理由を reconnecting / down の reason に載せ・繋がれば消し・古い engine の診断は捨てる", { timeout: 5000 }, () => {
  const f = makeFakeVoiceFactory();
  /** @type {any[]} */ const statuses = [];
  const mgr = createVoiceEngineManager({
    createEngine: f.createEngine,
    loadApiKey: () => ({ ok: true, apiKey: FAKE_TTS_KEY }),
    onStatus: (info) => statuses.push(info)
  });
  mgr.prepare("elevenlabs");
  const { engine: el, deps } = f.made[0];
  assert.equal(typeof deps.onDiagnostic, "function", "ElevenLabs の deps に onDiagnostic を渡す");
  deps.onDiagnostic({ type: "ttsConnected", reason: null, message: null });
  el.emit("up");
  // engine は診断を出してから status を変える（up のうちは知らせ直さない）。
  deps.onDiagnostic({ type: "ttsDisconnected", reason: "code=1006", message: null });
  assert.deepEqual(statuses.at(-1), { engine: "elevenlabs", status: "up", reason: null });
  el.emit("reconnecting");
  assert.deepEqual(statuses.at(-1), { engine: "elevenlabs", status: "reconnecting", reason: "closed code=1006" });
  // 状態はそのままで理由だけ変わったら知らせ直す。
  deps.onDiagnostic({ type: "ttsConnectFailed", reason: "closed code=1008", message: null });
  assert.deepEqual(statuses.at(-1), { engine: "elevenlabs", status: "reconnecting", reason: "接続できない（closed code=1008）" });
  // 理由に関係しない診断は何もしない。
  const n = statuses.length;
  deps.onDiagnostic({ type: "ttsRestarted", reason: "abort", message: null });
  assert.equal(statuses.length, n);
  // 繋がれば理由は消える。
  deps.onDiagnostic({ type: "ttsReconnected", reason: null, message: null });
  el.emit("up");
  assert.deepEqual(statuses.at(-1), { engine: "elevenlabs", status: "up", reason: null });
  // サーバーのエラー → down でもその理由。
  deps.onDiagnostic({ type: "ttsServerError", reason: "protocol_violation", message: null });
  el.emit("down");
  assert.deepEqual(statuses.at(-1), { engine: "elevenlabs", status: "down", reason: "サーバーのエラー（protocol_violation）" });
  // 作り直した後の古い engine の診断は捨てる。
  mgr.prepare("aivis");
  const m = statuses.length;
  deps.onDiagnostic({ type: "ttsDisconnected", reason: "code=1006", message: null });
  el.emit("reconnecting");
  assert.equal(statuses.length, m);
  // aivis の deps には onDiagnostic を足さない。
  assert.equal("onDiagnostic" in f.made[1].deps, false);
  assert.equal(JSON.stringify(statuses).includes(FAKE_TTS_KEY), false);
});

test("createVoiceEngineManager: 落ちた（down の）ElevenLabs は同じ種類でも Start で dispose して作り直し、キーを読み直す", { timeout: 5000 }, () => {
  const f = makeFakeVoiceFactory();
  let keyReads = 0;
  let key = "sk_fake_old_key";
  const mgr = createVoiceEngineManager({
    createEngine: f.createEngine,
    loadApiKey: () => {
      keyReads += 1;
      return { ok: true, apiKey: key };
    }
  });
  assert.deepEqual(mgr.prepare("elevenlabs"), { ok: true });
  const first = f.made[0].engine;
  assert.equal(f.made[0].deps.apiKey, "sk_fake_old_key");
  // connecting / up / reconnecting のうちは使い回す（キーも読まない）。
  for (const s of ["connecting", "up", "reconnecting"]) {
    if (s !== "connecting") first.emit(s);
    assert.deepEqual(mgr.prepare("elevenlabs"), { ok: true });
    assert.equal(f.made.length, 1, `${s} は使い回し`);
  }
  assert.equal(keyReads, 1);
  // 無効なキーで down → キーを直して Start → 古い engine を dispose し、新しいキーで作り直す。
  first.emit("down");
  key = "sk_fake_new_key";
  assert.deepEqual(mgr.prepare("elevenlabs"), { ok: true });
  assert.equal(first.disposed, true);
  assert.equal(first.listenerCount(), 0);
  assert.equal(keyReads, 2);
  assert.equal(f.made.length, 2);
  assert.equal(f.made[1].deps.apiKey, "sk_fake_new_key");
  assert.equal(mgr.current(), f.made[1].engine);
  // 作り直すときにキーが無くなっていたら Start 失敗（古い engine は dispose 済み・engine は持たない）。
  let hasKey = true;
  const noKey = createVoiceEngineManager({
    createEngine: f.createEngine,
    loadApiKey: () => (hasKey ? { ok: true, apiKey: FAKE_TTS_KEY } : { ok: false, reason: "キーなし（テスト）" })
  });
  assert.deepEqual(noKey.prepare("elevenlabs"), { ok: true });
  const dead = f.made.at(-1)?.engine;
  dead.emit("down");
  hasKey = false;
  assert.deepEqual(noKey.prepare("elevenlabs"), { ok: false, reason: "キーなし（テスト）" });
  assert.equal(dead.disposed, true);
  assert.equal(noKey.current(), null);
  // aivis は down でも作り直さない（AivisSpeech の engine は状態を持たない・今どおり）。
  const aivisMgr = createVoiceEngineManager({ createEngine: f.createEngine });
  aivisMgr.prepare("aivis");
  const aivis = f.made.at(-1)?.engine;
  aivis.emit("down");
  const count = f.made.length;
  aivisMgr.prepare("aivis");
  assert.equal(f.made.length, count);
  mgr.dispose();
});

test("声の警告の理由の結線: 本物の ElevenLabs engine の切断・接続失敗が tts-reconnecting / tts-down の detail に出て・繋がれば消える", { timeout: 10000 }, async () => {
  const { createCockpitServer } = await import("../src/cockpit/cockpit-server.mjs");
  const { createVoiceEngine } = await import("../src/voice/engines/voice-engine.mjs");
  const { createFakeWebSocketClass } = await import("../src/test-support/fake-websocket.mjs");
  const { createFakeClock } = await import("../src/test-support/fake-clock.mjs");
  const { FakeWebSocket, sockets } = createFakeWebSocketClass();
  const clock = createFakeClock();
  /** @type {any} */
  let server;
  const mgr = createVoiceEngineManager({
    createEngine: (kind, deps) =>
      createVoiceEngine(/** @type {any} */ (kind), {
        ...deps,
        readingClient: null,
        WebSocketImpl: FakeWebSocket,
        setTimeoutImpl: clock.setTimeoutImpl,
        clearTimeoutImpl: clock.clearTimeoutImpl
      }),
    loadApiKey: () => ({ ok: true, apiKey: FAKE_TTS_KEY }),
    onStatus: (info) => server?.setVoiceEngineStatus(info)
  });
  server = createCockpitServer({});
  const url = await server.listen(0);
  const state = async () => (await fetch(`${url}/api/state`)).json();
  /** @param {any} s @param {string} kind */
  const warning = (s, kind) => s.warnings.find((/** @type {any} */ w) => w.kind === kind);
  try {
    assert.deepEqual(mgr.prepare("elevenlabs"), { ok: true });
    // 最初の接続に失敗 → down（理由つき）。
    sockets[0].serverClose(1008, `bad key ${FAKE_TTS_KEY}`);
    let s = await state();
    assert.equal(s.tts.status, "down");
    assert.equal(warning(s, "tts-down")?.detail, "接続できない（closed code=1008）");
    // 裏の繋ぎ直しで繋がる → 警告は消え・理由も消える。
    clock.advance(1000);
    sockets[1].serverOpen();
    s = await state();
    assert.equal(s.tts.status, "up");
    assert.equal(s.tts.reason, null);
    assert.deepEqual(s.warnings, []);
    // 繋がった後に切れる → reconnecting（closed code=1006）。
    sockets[1].serverClose(1006, "closed with secret text");
    s = await state();
    assert.equal(s.tts.status, "reconnecting");
    assert.equal(warning(s, "tts-reconnecting")?.detail, "closed code=1006");
    // 繋ぎ直しも失敗 → 状態は reconnecting のまま、理由だけ変わる。
    clock.advance(1000);
    sockets[2].serverClose(1011);
    s = await state();
    assert.equal(warning(s, "tts-reconnecting")?.detail, "接続できない（closed code=1011）");
    clock.advance(2000);
    sockets[3].serverOpen();
    s = await state();
    assert.deepEqual(s.warnings, []);
    const text = JSON.stringify(s);
    assert.equal(text.includes(FAKE_TTS_KEY), false);
    assert.equal(text.includes("secret"), false, "close の reason 文は載せない");
  } finally {
    mgr.dispose();
    await server.close();
  }
});

test("声の選択の結線: Start で ttsEngine の engine を用意し・作り直し・status が警告になり・キー切れは Start 失敗", { timeout: 10000 }, async () => {
  const { createCockpitServer } = await import("../src/cockpit/cockpit-server.mjs");
  const f = makeFakeVoiceFactory();
  let keyOk = true;
  /** @type {any} */
  let server;
  const mgr = createVoiceEngineManager({
    createEngine: f.createEngine,
    loadApiKey: () => (keyOk ? { ok: true, apiKey: FAKE_TTS_KEY } : { ok: false, reason: "ElevenLabs のキーが見つからない（テスト）" }),
    onStatus: (info) => server?.setVoiceEngineStatus(info),
    onReadingsFallback: () => server?.reportVoiceReadingsFallback()
  });
  /** @type {string | null} */
  let stored = null;
  const hooks = createTtsEngineHooks({ getTtsEngine: () => stored, setTtsEngine: (e) => { stored = e; } });
  const pipelineFactory = () => {
    const buffer = createTranscriptBuffer({ nowImpl: () => 1000 });
    return {
      transcriptBuffer: buffer,
      async start() {},
      async dispose() {},
      isDisposed: () => false,
      streamMs: () => 0,
      stats: () => ({})
    };
  };
  server = createCockpitServer({
    pipelineFactory: /** @type {any} */ (pipelineFactory),
    ttsEngineInitial: hooks.resolveInitialTtsEngine(),
    onSetTtsEngine: hooks.onSetTtsEngine,
    onPrepareVoiceEngine: (kind) => mgr.prepare(kind)
  });
  const url = await server.listen(0);
  /** @param {string} p @param {any} body */
  const post = async (p, body) => {
    const r = await fetch(`${url}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json() };
  };
  const state = async () => (await fetch(`${url}/api/state`)).json();
  try {
    // 既定 aivis で Start。
    let r = await post("/api/ears/start", { device: "Mic" });
    assert.equal(r.status, 200);
    assert.equal(f.made.length, 1);
    assert.equal(f.made[0].kind, "aivis");
    assert.deepEqual(r.json.tts, { engine: "aivis", status: "up", reason: null });
    assert.equal(stored, "aivis");
    await post("/api/ears/stop", {});

    // ElevenLabs に切り替えて Start → aivis を dispose して作り直し、繋ぎ始め。
    r = await post("/api/ears/start", { device: "Mic", ttsEngine: "elevenlabs" });
    assert.equal(r.status, 200);
    assert.equal(f.made[0].engine.disposed, true);
    assert.equal(f.made[1].kind, "elevenlabs");
    assert.equal(r.json.tts.status, "connecting");
    assert.equal(stored, "elevenlabs");

    // engine の status が警告になる（reconnecting = warn → up で消える → down = alert）。
    const el = f.made[1].engine;
    el.emit("reconnecting");
    let s = await state();
    assert.equal(s.warnings.find((/** @type {any} */ w) => w.kind === "tts-reconnecting")?.severity, "warn");
    el.emit("up");
    s = await state();
    assert.deepEqual(s.warnings, []);
    el.emit("down");
    s = await state();
    assert.equal(s.warnings.find((/** @type {any} */ w) => w.kind === "tts-down")?.severity, "alert");
    el.emit("up");

    // 読みが取れない → 一回きりの warn。
    f.made[1].deps.onReadingsFallback({});
    s = await state();
    assert.equal(s.warnings.find((/** @type {any} */ w) => w.kind === "tts-readings-fallback")?.lifetime, "event");

    // 同じ種類の Start は使い回し（作り直さない）。
    await post("/api/ears/stop", {});
    r = await post("/api/ears/start", { device: "Mic" });
    assert.equal(r.status, 200);
    assert.equal(f.made.length, 2);

    // aivis に戻してから、キーが無い状態で ElevenLabs を選ぶと Start 失敗（理由つき）・engine は持たない。
    await post("/api/ears/stop", {});
    await post("/api/ears/start", { device: "Mic", ttsEngine: "aivis" });
    await post("/api/ears/stop", {});
    keyOk = false;
    r = await post("/api/ears/start", { device: "Mic", ttsEngine: "elevenlabs" });
    assert.equal(r.status, 500);
    assert.equal(r.json.error, "ElevenLabs のキーが見つからない（テスト）");
    assert.equal(r.json.state.ears, "stopped");
    assert.equal(r.json.state.tts.status, "down");
    assert.equal(mgr.current(), null);
    assert.equal(f.made[2].engine.disposed, true);
    // キーは state のどこにも載らない。
    assert.equal(JSON.stringify(await state()).includes(FAKE_TTS_KEY), false);
  } finally {
    await server.close();
    mgr.dispose();
  }
});

// ── 記憶をロールごとに（配信の組み直し Domain B）──────────────────────────────────────────
//  保存の係が置き場（ロールの記憶のフォルダ）を頼んだ時点で取ること、置き場がロールに付いていくこと、main() の結線。
//  本物の②④は使わない。置き場の準備は偽物か、OS temp の本物の git だけ（apps/soul/agent/memories/ には触れない）。

/** 解決を外から操れる writeImpl（材料と置き場を記録する）。 */
function makePlacedWrite() {
  /** @type {Array<{ entries: any[]; place: any; resolve: (v: any) => void }>} */
  const pending = [];
  const writeImpl = (/** @type {any[]} */ entries, /** @type {any} */ place) =>
    new Promise((resolve) => {
      pending.push({ entries, place, resolve });
    });
  return { writeImpl, pending };
}

test("createMemoryRecorder: 置き場は保存を頼んだ時点のもの（走っている・待っている保存は、あとでロールが替わっても前のロールのフォルダに書く）", { timeout: 5000 }, async () => {
  const w = makePlacedWrite();
  const chappy = { roleId: "chappy" };
  const cody = { roleId: "cody" };
  let current = chappy;
  const recorder = createMemoryRecorder({ getLiveEntries: () => [], getPlace: () => current, writeImpl: w.writeImpl });
  const first = recorder.record(["c1"]); // 走る（チャッピー）。
  const queuedChappy = recorder.record(["c1", "c2"]); // 耳の Stop の転写（チャッピー）が待つ。
  current = cody; // 耳が止まっている間にロールを替えた。
  const queuedCody = recorder.record(["k1"]); // こーでぃーの頼みは、チャッピーの待ちに合流しない。
  const mergedCody = recorder.record(["k1", "k2"]); // 同じ置き場の待ちには合流する（今まで通り）。
  assert.notEqual(queuedChappy, queuedCody);
  assert.equal(queuedCody, mergedCody);
  await tick();
  assert.equal(w.pending.length, 1);
  assert.equal(w.pending[0].place, chappy);
  w.pending[0].resolve({ written: true });
  await first;
  await tick();
  assert.deepEqual(w.pending[1].entries, ["c1", "c2"]);
  assert.equal(w.pending[1].place, chappy, "待っていた保存は頼んだときのロールのフォルダ");
  w.pending[1].resolve({ written: true });
  await queuedChappy;
  await tick();
  assert.deepEqual(w.pending[2].entries, ["k1", "k2"]);
  assert.equal(w.pending[2].place, cody);
  w.pending[2].resolve({ written: true });
  await queuedCody;
  await recorder.whenIdle();
  assert.equal(w.pending.length, 3, "直列のまま（置き場ごとに 1 回ずつ）");
});

test("createMemoryRecorder: getPlace が投げたら置き場は null（保存の係は止まらず writeImpl が断る）", { timeout: 5000 }, async () => {
  const w = makePlacedWrite();
  const recorder = createMemoryRecorder({
    getLiveEntries: () => [],
    getPlace: () => {
      throw new Error("boom");
    },
    writeImpl: w.writeImpl
  });
  const done = recorder.record(["x"]);
  assert.equal(w.pending[0].place, null);
  w.pending[0].resolve({ written: false });
  await done;
});

/** 偽物の置き場の準備（呼ばれた引数を記録・結果は差し替え可）。 */
function makeFakePlaceDeps(roleRef, { prepareResult = { ok: true } } = {}) {
  /** @type {any[]} */
  const prepared = [];
  /** @type {any[]} */
  const identities = [];
  return {
    prepared,
    identities,
    deps: {
      root: join("C:", "tmp", "memories-root"),
      currentRole: () => roleRef.current,
      startedAtMs: 1234,
      prepareImpl: async (/** @type {any} */ options) => {
        prepared.push(options);
        return typeof prepareResult === "function" ? prepareResult(options) : prepareResult;
      },
      createIdentityImpl: (/** @type {any} */ options) => {
        identities.push(options);
        return { get: () => ({ dateJst: "2026-10-31", baseName: `${options.dir}-base` }) };
      }
    }
  };
}

test("createRoleMemoryPlaces: 今のロールの置き場（memories/<role-id>/・準備は呼び名の種・本体のファイル名）をロールごとに 1 回だけ作る", async () => {
  const chappy = roleFromIdentity(MODEL_IDENTITIES.chappy);
  const cody = roleFromIdentity(MODEL_IDENTITIES.cody);
  const ref = { current: chappy };
  const fake = makeFakePlaceDeps(ref);
  const places = createRoleMemoryPlaces(fake.deps);
  const a = places.place();
  assert.ok(a);
  assert.equal(a.roleId, "chappy");
  assert.equal(a.dir, join(fake.deps.root, "chappy"));
  await a.ready;
  assert.deepEqual(fake.prepared, [{ dir: join(fake.deps.root, "chappy"), soulName: "チャッピー" }]);
  assert.deepEqual(fake.identities, [{ dir: join(fake.deps.root, "chappy"), startedAtMs: 1234 }]);
  assert.equal(places.place(), a, "同じロールなら同じ置き場（準備も本体のファイル名も作り直さない）");
  ref.current = cody;
  const b = places.place();
  assert.ok(b);
  assert.notEqual(b, a);
  assert.equal(b.dir, join(fake.deps.root, "cody"));
  await b.ready;
  assert.deepEqual(fake.prepared[1], { dir: join(fake.deps.root, "cody"), soulName: "コーディ" });
  ref.current = chappy;
  assert.equal(places.place(), a, "戻したロールは前の置き場（同じ本体のファイル名）");
  assert.equal(fake.prepared.length, 2);
});

test("createRoleMemoryPlaces: 記憶の引っ越しが失敗した起動（available: false）では何も準備せず null", async () => {
  const ref = { current: roleFromIdentity(MODEL_IDENTITIES.chappy) };
  const fake = makeFakePlaceDeps(ref);
  const places = createRoleMemoryPlaces({ ...fake.deps, available: false });
  assert.equal(places.place(), null);
  assert.deepEqual(fake.prepared, []);
  assert.deepEqual(fake.identities, []);
});

test("createRoleMemoryPlaces: 準備の失敗は onPrepareFailed へ（ready は reject しない・配信を止めない）", async () => {
  const ref = { current: roleFromIdentity(MODEL_IDENTITIES.cody) };
  /** @type {any[]} */
  const failures = [];
  const failing = makeFakePlaceDeps(ref, { prepareResult: { ok: false, error: "git init: git not found" } });
  const place = createRoleMemoryPlaces({ ...failing.deps, onPrepareFailed: (info) => failures.push(info) }).place();
  await place?.ready;
  assert.deepEqual(failures, [{ roleId: "cody", error: "git init: git not found" }]);
  const throwing = makeFakePlaceDeps(ref, {
    prepareResult: () => {
      throw new Error("boom");
    }
  });
  const place2 = createRoleMemoryPlaces({ ...throwing.deps, onPrepareFailed: (info) => failures.push(info) }).place();
  await place2?.ready;
  assert.deepEqual(failures[1], { roleId: "cody", error: "boom" });
});

test("createRoleMemoryPlaces: 本物の git で、ロールごとのフォルダと git ができ、新しいロールの種は呼び名に差し替わる", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "cockpit-role-memory-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const memoriesRoot = join(root, "memories");
  const mio = normalizeRole("mio", { name: { canonical: "ミオ", display: "みお" } });
  const ref = { current: /** @type {any} */ (roleFromIdentity(MODEL_IDENTITIES.chappy)) };
  const places = createRoleMemoryPlaces({ root: memoriesRoot, currentRole: () => ref.current, startedAtMs: Date.UTC(2026, 9, 31, 3) });
  await places.place()?.ready;
  ref.current = mio;
  const mioPlace = places.place();
  await mioPlace?.ready;
  assert.ok(existsSync(join(memoriesRoot, "chappy", ".git")));
  assert.ok(existsSync(join(memoriesRoot, "mio", ".git")));
  assert.equal(existsSync(join(memoriesRoot, ".git")), false, "記憶の根には git を作らない");
  const seed = readFileSync(join(memoriesRoot, "chappy", "_conventions.md"), "utf8");
  const mioConventions = readFileSync(join(memoriesRoot, "mio", "_conventions.md"), "utf8");
  assert.ok(seed.includes("チャッピー"));
  assert.ok(!mioConventions.includes("チャッピー"));
  assert.equal(mioConventions.split("ミオ").join("チャッピー"), seed);
  assert.deepEqual(mioPlace?.streamRecord.get(), { dateJst: "2026-10-31", baseName: "2026-10-31" });
});

test("記憶をロールごとにの結線: 引っ越し（写しのフォルダを共有）→ 置き場の準備の順、記憶の 4 か所は今のロールの置き場", async () => {
  const source = readFileSync(new URL("./cockpit.mjs", import.meta.url), "utf8");
  const main = source.slice(source.indexOf("async function main()"));
  // 写しのフォルダは 1 つの値を設定の分と記憶の分で共有する。
  assert.match(main, /const migrationBackup = migrationBackupDir\(DEFAULT_MIGRATION_BACKUP_ROOT, Date\.now\(\)\);/);
  assert.match(main, /runStartupMigration\(\{[\s\S]{0,200}?memoriesDir: DEFAULT_MEMORY_DIR,\s*backupDir: migrationBackup\s*\}\)/);
  // 記憶の引っ越しは、記憶のフォルダの置き場を作るより前。配信の組み直し Domain D: 置き場の準備は起動時ではなく場の始まりで
  // 待つ（createStreamVenueHooks の renewRecords・streamHooks として cockpit-server へ渡す）。
  const migrateAt = main.indexOf("runStartupMigration({");
  const placesAt = main.indexOf("createRoleMemoryPlaces({");
  const venueAt = main.indexOf("const streamVenue = createStreamVenueHooks({");
  assert.ok(migrateAt > 0 && migrateAt < placesAt && placesAt < venueAt);
  assert.doesNotMatch(main, /await memoryPlaces\.place\(\)\?\.ready;/, "起動時には準備を待たない");
  assert.match(main, /streamHooks: streamVenue\.hooks,/);
  const venueFn = source.slice(source.indexOf("export function createStreamVenueHooks"), source.indexOf("export function isMcpConfigReadFailureWarning"));
  assert.match(venueFn, /deps\.memoryPlaces\.beginStream\(startedAtMs\);\s*await deps\.memoryPlaces\.place\(\)\?\.ready;/, "場の始まりで置き場を作り直して準備を待つ");
  assert.match(main, /available: startupMigration\.memories\.status !== "failed"/);
  // 記憶の根をそのまま記憶のフォルダとして渡さない（準備・本体のファイル名・②・④）。
  assert.doesNotMatch(source, /dir: DEFAULT_MEMORY_DIR/);
  assert.doesNotMatch(source, /createStreamRecordIdentity\(\{ dir: DEFAULT_MEMORY_DIR/);
  const writer = source.slice(source.indexOf("const memoryRecorder = createMemoryRecorder"), source.indexOf("const memoryStatus = () =>"));
  assert.match(writer, /getPlace: \(\) => memoryPlaces\.place\(\)/);
  assert.match(writer, /record: place\.streamRecord\.get\(\),\s*dir: place\.dir,/);
  assert.match(writer, /const recallRunner = async \(job\) => \{\s*const place = memoryPlaces\.place\(\);[\s\S]*?dir: place\.dir,/);
  // 配信の組み直し Domain D: ロールの切り替えでは置き場の準備を待たない（応答を git init で遅らせない・場の始まりで待つ）。
  const onSetRole = main.slice(main.indexOf("const onSetRole = async (id) =>"), main.indexOf("const roleStatus = () =>"));
  assert.doesNotMatch(onSetRole, /memoryPlaces\.place\(\)/);
});

// ── 配信の組み直し Domain C: 体なしの声（stream-restructure.md §4）─────────────────────────────────
//  器の URL の確かめは「ロールに体があるときだけ」。体なしは URL が無くても頭に聞き、発火を受理し、器を渡さない。

test("createSessionProxy（体なし）: URL が無くても頭に聞ける・体ありは今どおり断る・体の有無は聞くたびに読む", { timeout: 5000 }, async () => {
  let body = false;
  let created = 0;
  const asked = [];
  const proxy = createSessionProxy({
    getUrl: () => null,
    hasBody: () => body,
    ensureFireResources: () => {
      created += 1;
    },
    getSession: () => ({ ask: async (/** @type {any} */ input) => { asked.push(input); return { replyText: "ok" }; } })
  });
  const out = await proxy.ask("体なし");
  assert.equal(out.replyText, "ok");
  assert.deepEqual(asked, ["体なし"]);
  assert.equal(created, 1);
  body = true;
  await assert.rejects(() => proxy.ask("体あり"), /Channel URL is not set/);
  assert.equal(created, 1, "体ありで URL が無ければ今どおり spawn しない");
});

test("resolveFireChannel: 体ありは URL が無ければ今と同じ文面で断る・あれば器と URL・体なしは URL を見ず器を渡さない", async () => {
  const { resolveFireChannel, CHANNEL_URL_NOT_SET_MESSAGE } = await import("./cockpit.mjs");
  assert.equal(CHANNEL_URL_NOT_SET_MESSAGE, "Channel URL is not set — set it in the cockpit (Channel field) before firing.");
  const unset = createLazyChannel(null);
  assert.throws(() => resolveFireChannel({ body: true, channel: unset }), (/** @type {any} */ e) => e.message === CHANNEL_URL_NOT_SET_MESSAGE);
  let getUrlCalls = 0;
  const watched = { getUrl: () => { getUrlCalls += 1; return null; } };
  assert.deepEqual(resolveFireChannel({ body: false, channel: watched }), { body: false, channel: null, channelUrl: null });
  assert.equal(getUrlCalls, 0, "体なしは URL を見ない");
  const set = createLazyChannel("ws://127.0.0.1:1/channel?token=x");
  const resolved = resolveFireChannel({ body: true, channel: set });
  assert.equal(resolved.body, true);
  assert.equal(resolved.channel, set);
  assert.equal(resolved.channelUrl, "ws://127.0.0.1:1/channel?token=x");
});

test("体なしの受理（本番の器の取り方 + 本物の orchestrator）: URL が無くても発火を受理して器なしで鳴らす・体ありは今どおり受理しない", { timeout: 5000 }, async () => {
  const { resolveFireChannel } = await import("./cockpit.mjs");
  /** @param {boolean} body */
  const run = async (body) => {
    const buffer = createTranscriptBuffer();
    buffer.append({ startMs: 0, endMs: 100, text: "ねえ" });
    const lazy = createLazyChannel(null);
    const fires = [];
    const diags = [];
    const spoken = [];
    const session = { ask: async () => ({ replyText: "うん" }) };
    const orch = createFireOrchestrator({
      getBuffer: () => buffer,
      session,
      channel: /** @type {any} */ (lazy),
      player: { play() {} },
      speakImpl: async (/** @type {string} */ text, /** @type {any} */ deps) => {
        spoken.push({ text, channel: deps.channel });
        return {};
      },
      // cockpit.mjs の acquireAcceptedFireResources と同じ器の取り方（受理の時点の体から）。
      acquireFireResources: async () => {
        const fireChannel = resolveFireChannel({ body, channel: lazy });
        return { session, channel: fireChannel.channel, body: fireChannel.body, configuration: { channelUrl: fireChannel.channelUrl } };
      },
      onFire: (f) => fires.push(f),
      onDiagnostic: (d) => diags.push(d)
    });
    const result = await orch.fire();
    orch.dispose();
    return { result, fires, diags, spoken };
  };
  const bodyless = await run(false);
  assert.equal(bodyless.result.fired, true);
  assert.equal(bodyless.fires[0].accepted, true);
  assert.deepEqual(bodyless.spoken, [{ text: "うん", channel: null }]);
  assert.deepEqual(bodyless.diags, []);
  const withBody = await run(true);
  assert.equal(withBody.result.fired, false);
  assert.equal(withBody.result.reason, "error");
  assert.match(withBody.result.message, /Channel URL is not set/);
  assert.equal(withBody.fires.length, 0, "体ありで URL が無ければ受理しない（今どおり）");
  assert.equal(withBody.spoken.length, 0);
});

test("体なしの結線（main）: 体は使う時点で今のロールから読む（受理・頭に聞く・セッション作り・器の差し替え・器の状態・教え）", async () => {
  // 作業コピーの改行（CRLF / LF）に依らず読む。
  const source = readFileSync(new URL("./cockpit.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.match(source, /const currentBody = \(\) => roleHooks\.current\(\)\.body !== false;/);
  assert.match(source, /hasBody: currentBody,/, "頭に聞くたびに体を読む");
  assert.match(source, /const fireChannel = resolveFireChannel\(\{ body: currentBody\(\), channel: lazyChannel \}\);/, "受理のたびに体を読む");
  assert.match(source, /channel: fireChannel\.channel,\n\s+body: fireChannel\.body,/);
  assert.match(source, /channelUrl: fireChannel\.channelUrl,/);
  assert.match(source, /if \(currentBody\(\) && appliedChannelRevision !== channelRevision\) \{\n\s+lazyChannel\.setUrl\(desiredChannelUrl\);/, "器の URL の差し替えは体があるときだけ");
  assert.match(source, /loadSoulSkills\(\{ names: soulSkillNamesForBody\(sessionHasBody\), onWarning: onBrainWarning \}\)/, "体なしは表情の教えを①に渡さない");
  assert.match(source, /sessionBody !== currentBody\(\)\);/, "体の有無が替われば次の Fire の境目でセッションを作り直す");
  assert.match(source, /\(\) => listSoulSkills\(\{ names: soulSkillNamesForBody\(currentBody\(\)\) \}\)/, "編集画面に見せる教えも体に合わせる");
  assert.match(source, /connection: lazyChannel\.connectionStatus\(\),\n\s+body: currentBody\(\)/, "器の状態に体の有無を載せる");
  assert.equal(/acquireAcceptedFireResources = async \(\) => \{\n\s+await applyDesiredFireSettings\(\);\n\s+if \(lazyChannel\.getUrl\(\) == null\)/.test(source), false, "受理で URL を無条件には確かめない");
});

test("buildRoleSessionSystemPrompt（体なし）: 体なしの教えで作った①には表情の教えが入らない・体ありは今どおり入る", async () => {
  const { soulSkillNamesForBody } = await import("../src/mind/soul-skills.mjs");
  const expression = listSoulSkills().find((skill) => skill.name === "expression");
  assert.ok(expression);
  const identity = MODEL_IDENTITIES.cody;
  const bodyless = buildRoleSessionSystemPrompt(identity, "指示", loadSoulSkills({ names: soulSkillNamesForBody(false) }));
  const withBody = buildRoleSessionSystemPrompt(identity, "指示", loadSoulSkills({ names: soulSkillNamesForBody(true) }));
  assert.equal(bodyless.includes(expression.body), false);
  assert.equal(withBody.includes(expression.body), true);
  assert.equal(withBody, buildRoleSessionSystemPrompt(identity, "指示"), "体ありは今と同じ①");
});

test("createConversationInstructionHooks（体なし）: 編集画面に見せる教えに表情の教えが出ない", async () => {
  const { soulSkillNamesForBody } = await import("../src/mind/soul-skills.mjs");
  const hooks = createConversationInstructionHooks(
    { getConversationInstructionProfile: () => ({}) },
    () => "mio",
    createInstructionRevisionController(),
    () => listSoulSkills({ names: soulSkillNamesForBody(false) })
  );
  assert.deepEqual(hooks.getSoulSkills().map((s) => s.name), ["screen", "recall"]);
});

test("formatReplyLatencyLine（体なし）: 体なしの返事は末尾に body=none（体ありは今と同じ行）", async () => {
  const { formatReplyLatencyLine } = await import("./cockpit.mjs");
  const base = { fireId: 6, cause: null, spoken: true, segments: { ttsMs: 130, voiceMs: 20 }, totalMs: 900, level: "ok", voice: "aivis" };
  assert.match(formatReplyLatencyLine({ ...base, bodyless: true }), /voiceEngine=aivis body=none\n$/);
  assert.equal(formatReplyLatencyLine(base).includes("body="), false);
});
