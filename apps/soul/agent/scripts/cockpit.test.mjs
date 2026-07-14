// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseCockpitArgs,
  createLazyChannel,
  createSessionProxy,
  createVisionTargetHooks,
  createAudioDeviceHooks,
  createSelfFireHooks,
  createVerbosityHooks,
  createChatSourceHooks
} from "./cockpit.mjs";

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
