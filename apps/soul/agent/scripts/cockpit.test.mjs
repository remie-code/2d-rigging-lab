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

// ── 頭の切替 × in-flight（不変条件の固定・brain-swap.md §9 (a')）──────────────────────────────
//
//  main() の session/currentBrain/ensureFireResources/onSetBrain 配線と同型の最小ハーネスで、実 read-path
//  コード（createSessionProxy = cockpit.mjs の実体）を通して「切替は現 session を dispose→null にし、次の
//  ask は新頭で生成される」不変条件を固定する。実 SDK/実頭は使わず頭ごとの fake session を生成する
//  （実消費ゼロ）。in-flight（pending の ask）は既存の dispose 意味論に委ね、切替をブロックしないことも示す。

test("brain 切替×in-flight: 切替は現 session を dispose→null にし、次の ask は新頭で生成される", { timeout: 5000 }, async () => {
  /** @type {any} */ let session = null;
  let currentBrain = "claude";
  /** @type {string[]} */ const created = []; // ensureFireResources が生成した頭の記録。
  /** @type {string[]} */ const disposed = []; // dispose された頭の記録。
  /** @type {((v:any)=>void) | null} */ let pendingResolve = null;

  // 頭ごとの fake session（claude の ask は pending のまま＝in-flight を模す）。
  const makeFakeHead = (/** @type {string} */ brain) => {
    /** @type {any} */
    const head = {
      brain,
      disposed: false,
      ask: (/** @type {string} */ input) => {
        if (brain === "claude") {
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
      created.push(currentBrain);
    }
  };
  // main() の effectful onSetBrain（永続化は割愛・dispose→null のホットスワップ部分だけを再現）と同型。
  const onSetBrain = async (/** @type {string} */ choice) => {
    currentBrain = choice;
    if (session != null) {
      try {
        await session.dispose();
      } catch {
        // best-effort
      }
      session = null;
    }
  };

  // 実 read-path（cockpit.mjs の createSessionProxy そのもの）を通す。URL は設定済み（ask を弾かない）。
  const proxy = createSessionProxy({
    getUrl: () => "ws://127.0.0.1:1/channel?token=x",
    ensureFireResources,
    getSession: () => session
  });

  // 1 発目（claude）: ask は pending のまま（in-flight）。
  const inflight = proxy.ask("hello");
  assert.deepEqual(created, ["claude"]);
  const claudeHead = session;

  // in-flight 中に codex へ切替: 現 session（claude）が dispose→null される（切替はブロックされない）。
  await onSetBrain("codex");
  assert.equal(claudeHead.disposed, true);
  assert.deepEqual(disposed, ["claude"]);
  assert.equal(session, null);

  // 次の ask は新頭（codex）で生成される。
  const next = await proxy.ask("hi");
  assert.deepEqual(created, ["claude", "codex"]);
  assert.equal(next.replyText, "codex:hi");

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
