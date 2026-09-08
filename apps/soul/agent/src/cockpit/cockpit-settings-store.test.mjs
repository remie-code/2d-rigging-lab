// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createFileSettingsStore, DEFAULT_SETTINGS_PATH } from "./cockpit-settings-store.mjs";

// file-backed settings store の機械テスト（S2.5 Domain B）。全て OS temp のパスを注入し、
// 実設定ファイル（apps/soul/agent/cockpit-settings.local.json）に触れない（テスト非汚染）。

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "cockpit-settings-test-"));
}

test("settings store: set→get roundtrip persists the raw device name", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    assert.equal(store.getLastDevice(), null); // 未作成 = 記憶なし。
    store.setLastDevice("PicoStreamingMicrophone");
    assert.equal(store.getLastDevice(), "PicoStreamingMicrophone");
    // 別インスタンスでも読める = 実ファイルに永続している。
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getLastDevice(), "PicoStreamingMicrophone");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: setLastDevice(null) clears the remembered device", () => {
  const dir = tmpDir();
  try {
    const store = createFileSettingsStore({ path: join(dir, "settings.json") });
    store.setLastDevice("Mic A");
    assert.equal(store.getLastDevice(), "Mic A");
    store.setLastDevice(null);
    assert.equal(store.getLastDevice(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: missing / corrupt file → getLastDevice returns null (failure-tolerant)", () => {
  const dir = tmpDir();
  try {
    // 未作成ファイル。
    const missing = createFileSettingsStore({ path: join(dir, "nope.json") });
    assert.equal(missing.getLastDevice(), null);
    // 壊れた JSON。
    const badPath = join(dir, "bad.json");
    writeFileSync(badPath, "{ this is not json ", "utf8");
    const bad = createFileSettingsStore({ path: badPath });
    assert.equal(bad.getLastDevice(), null);
    // 想定外の shape（lastDevice が文字列でない）→ null。
    const oddPath = join(dir, "odd.json");
    writeFileSync(oddPath, JSON.stringify({ lastDevice: 123 }), "utf8");
    const odd = createFileSettingsStore({ path: oddPath });
    assert.equal(odd.getLastDevice(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: unwritable path → setLastDevice swallows the error (does not throw)", () => {
  const dir = tmpDir();
  try {
    // 親要素をファイルにする → mkdir/writeFile が必ず失敗する（ENOTDIR/EEXIST）。
    const fileAsParent = join(dir, "afile");
    writeFileSync(fileAsParent, "x", "utf8");
    const store = createFileSettingsStore({ path: join(fileAsParent, "child", "settings.json") });
    assert.doesNotThrow(() => store.setLastDevice("Mic"));
    // 書けていないので get も null（握って続行 = 起動を止めない）。
    assert.equal(store.getLastDevice(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: default path is the gitignored file inside apps/soul/agent", () => {
  assert.match(DEFAULT_SETTINGS_PATH.replace(/\\/g, "/"), /apps\/soul\/agent\/cockpit-settings\.local\.json$/);
});

test("conversation instruction settings: five brain overrides round-trip with the versioned additive key", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    for (const id of ["claude", "codex", "codex-55", "codex-56-sol", "codex-astra"]) {
      assert.equal(store.getConversationInstruction(id), null);
      assert.equal(store.setConversationInstruction(id, `custom:${id}`), true);
      assert.equal(store.getConversationInstruction(id), `custom:${id}`);
    }
    const reopened = createFileSettingsStore({ path });
    assert.deepEqual(reopened.getConversationInstructionOverrides(), {
      claude: "custom:claude",
      codex: "custom:codex",
      "codex-55": "custom:codex-55",
      "codex-56-sol": "custom:codex-56-sol",
      "codex-astra": "custom:codex-astra"
    });
    assert.equal(reopened.getConversationInstructionProfile("codex-55").body, "custom:codex-55");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("conversation instruction settings: Astra is additive and its choice persists without replacing existing instructions", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    const existing = ["claude", "codex", "codex-55", "codex-56-sol"];
    store.setBrainChoice("codex-56-sol");
    for (const id of existing) store.setConversationInstruction(id, `keep:${id}`);
    const defaultBody = store.getConversationInstructionProfile("codex-astra").body;
    store.setConversationInstruction("codex-astra", "astra custom");
    assert.equal(createFileSettingsStore({ path }).getBrainChoice(), "codex-56-sol");
    store.resetConversationInstruction("codex-astra");
    store.setBrainChoice("codex-astra");
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getBrainChoice(), "codex-astra");
    assert.equal(reopened.getConversationInstruction("codex-astra"), null);
    for (const id of existing) assert.equal(reopened.getConversationInstruction(id), `keep:${id}`);
    assert.equal(reopened.getConversationInstructionProfile("codex-astra").body, defaultBody);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("conversation instruction settings: direct-map and malformed/unknown values safely fall back", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    writeFileSync(
      path,
      JSON.stringify({
        conversationInstructions: {
          codex: "legacy direct-map value",
          unknown: "must be ignored",
          claude: "   ",
          "codex-55": 42
        }
      }),
      "utf8"
    );
    const store = createFileSettingsStore({ path });
    assert.equal(store.getConversationInstruction("codex"), "legacy direct-map value");
    assert.equal(store.getConversationInstruction("claude"), null);
    assert.deepEqual(store.getConversationInstructionOverrides(), { codex: "legacy direct-map value" });
    assert.equal(store.getConversationInstruction("not-a-brain"), null);
    assert.throws(() => store.setConversationInstruction("not-a-brain", "x"), /invalid/);
    assert.throws(() => store.setConversationInstruction("codex", "   "), /non-empty/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("conversation instruction settings: versioned overrides read back and corrupt shapes are ignored", () => {
  const dir = tmpDir();
  try {
    const versionedPath = join(dir, "versioned.json");
    writeFileSync(
      versionedPath,
      JSON.stringify({
        conversationInstructions: {
          version: 1,
          overrides: {
            claude: "versioned claude",
            "codex-56-sol": "versioned sol",
            unknown: "must be ignored",
            codex: "   "
          }
        }
      }),
      "utf8"
    );
    const versioned = createFileSettingsStore({ path: versionedPath });
    assert.deepEqual(versioned.getConversationInstructionOverrides(), {
      claude: "versioned claude",
      "codex-56-sol": "versioned sol"
    });
    assert.equal(versioned.getConversationInstruction("codex-56-sol"), "versioned sol");

    for (const [index, value] of ["not-an-object", [], { version: 1, overrides: [] }, { version: 1, overrides: null }].entries()) {
      const corruptPath = join(dir, `corrupt-${index}.json`);
      writeFileSync(corruptPath, JSON.stringify({ conversationInstructions: value }), "utf8");
      const corrupt = createFileSettingsStore({ path: corruptPath });
      assert.deepEqual(corrupt.getConversationInstructionOverrides(), {});
    }
    const invalidJsonPath = join(dir, "corrupt-json.json");
    writeFileSync(invalidJsonPath, "{ conversationInstructions: ", "utf8");
    assert.deepEqual(createFileSettingsStore({ path: invalidJsonPath }).getConversationInstructionOverrides(), {});
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("conversation instruction settings: reset removes only selected override", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    const ids = ["codex-astra", "claude", "codex", "codex-55", "codex-56-sol"];
    for (const id of ids) store.setConversationInstruction(id, `${id} custom`);
    for (const [index, id] of ids.entries()) {
      assert.equal(store.resetConversationInstruction(id), true);
      assert.equal(store.getConversationInstruction(id), null);
      for (const remaining of ids.slice(index + 1)) {
        assert.equal(store.getConversationInstruction(remaining), `${remaining} custom`);
      }
    }
    const reopened = createFileSettingsStore({ path });
    assert.deepEqual(reopened.getConversationInstructionOverrides(), {});
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("conversation instruction settings: failed durable write throws so callers do not advance revision", () => {
  const dir = tmpDir();
  try {
    const fileAsParent = join(dir, "afile");
    writeFileSync(fileAsParent, "x", "utf8");
    const store = createFileSettingsStore({ path: join(fileAsParent, "child", "settings.json") });
    assert.throws(() => store.setConversationInstruction("claude", "custom"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── Channel URL の永続化（S3 追撃 domain-c）─────────────────────────────

test("settings store: channel URL set→get roundtrip persists across instances", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    assert.equal(store.getLastChannelUrl(), null); // 未作成 = 記憶なし。
    store.setLastChannelUrl("ws://127.0.0.1:17310/channel?token=abc");
    assert.equal(store.getLastChannelUrl(), "ws://127.0.0.1:17310/channel?token=abc");
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getLastChannelUrl(), "ws://127.0.0.1:17310/channel?token=abc");
    // クリアも効く。
    store.setLastChannelUrl(null);
    assert.equal(createFileSettingsStore({ path }).getLastChannelUrl(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: device と channel URL は同居する（read-modify-write で片方が消えない）", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    store.setLastDevice("PicoStreamingMicrophone");
    store.setLastChannelUrl("ws://127.0.0.1:17310/channel?token=abc");
    // 別インスタンスで両方読める（後の set が前の set を上書き消去していない）。
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getLastDevice(), "PicoStreamingMicrophone");
    assert.equal(reopened.getLastChannelUrl(), "ws://127.0.0.1:17310/channel?token=abc");
    // device を変えても channel は残る。
    store.setLastDevice("Other Mic");
    const again = createFileSettingsStore({ path });
    assert.equal(again.getLastDevice(), "Other Mic");
    assert.equal(again.getLastChannelUrl(), "ws://127.0.0.1:17310/channel?token=abc");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: corrupt JSON → getLastChannelUrl returns null (failure-tolerant)", () => {
  const dir = tmpDir();
  try {
    const badPath = join(dir, "bad.json");
    writeFileSync(badPath, "{ not json", "utf8");
    const bad = createFileSettingsStore({ path: badPath });
    assert.equal(bad.getLastChannelUrl(), null);
    // 非文字列 shape → null。
    const oddPath = join(dir, "odd.json");
    writeFileSync(oddPath, JSON.stringify({ lastChannelUrl: 123 }), "utf8");
    assert.equal(createFileSettingsStore({ path: oddPath }).getLastChannelUrl(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 視覚発火の対象ウインドウ設定の永続化（S5「目が開く」）────────────────────

test("settings store: vision target set→get roundtrip persists across instances", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    assert.equal(store.getVisionTarget(), null); // 未作成 = 記憶なし。
    store.setVisionTarget("Sample Game — Main Window");
    assert.equal(store.getVisionTarget(), "Sample Game — Main Window");
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getVisionTarget(), "Sample Game — Main Window");
    // クリアも効く。
    store.setVisionTarget(null);
    assert.equal(createFileSettingsStore({ path }).getVisionTarget(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: device / channel URL / vision target は同居する（read-modify-write で他を消さない）", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    store.setLastDevice("PicoStreamingMicrophone");
    store.setLastChannelUrl("ws://127.0.0.1:17310/channel?token=abc");
    store.setVisionTarget("Sample Game");
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getLastDevice(), "PicoStreamingMicrophone");
    assert.equal(reopened.getLastChannelUrl(), "ws://127.0.0.1:17310/channel?token=abc");
    assert.equal(reopened.getVisionTarget(), "Sample Game");
    // vision target を変えても device / channel は残る。
    store.setVisionTarget("Other Window");
    const again = createFileSettingsStore({ path });
    assert.equal(again.getLastDevice(), "PicoStreamingMicrophone");
    assert.equal(again.getLastChannelUrl(), "ws://127.0.0.1:17310/channel?token=abc");
    assert.equal(again.getVisionTarget(), "Other Window");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: corrupt JSON → getVisionTarget returns null (failure-tolerant)", () => {
  const dir = tmpDir();
  try {
    const badPath = join(dir, "bad.json");
    writeFileSync(badPath, "{ not json", "utf8");
    const bad = createFileSettingsStore({ path: badPath });
    assert.equal(bad.getVisionTarget(), null);
    // 非文字列 shape → null。
    const oddPath = join(dir, "odd.json");
    writeFileSync(oddPath, JSON.stringify({ visionTarget: 123 }), "utf8");
    assert.equal(createFileSettingsStore({ path: oddPath }).getVisionTarget(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: vision target 用の unwritable path は set を握って続行する", () => {
  const dir = tmpDir();
  try {
    const fileAsParent = join(dir, "afile");
    writeFileSync(fileAsParent, "x", "utf8");
    const store = createFileSettingsStore({ path: join(fileAsParent, "child", "settings.json") });
    assert.doesNotThrow(() => store.setVisionTarget("Some Window"));
    assert.equal(store.getVisionTarget(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 出力デバイス設定の永続化（S6「会話が続く」・魂の声の出力先）─────────────────

test("settings store: audio device set→get roundtrip persists across instances", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    assert.equal(store.getAudioDevice(), null); // 未作成 = 記憶なし。
    store.setAudioDevice("ヘッドホン (2- Shure MV7+)");
    assert.equal(store.getAudioDevice(), "ヘッドホン (2- Shure MV7+)");
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getAudioDevice(), "ヘッドホン (2- Shure MV7+)");
    // クリアも効く。
    store.setAudioDevice(null);
    assert.equal(createFileSettingsStore({ path }).getAudioDevice(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: device / channel URL / vision target / audio device は同居する（他を消さない）", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    store.setLastDevice("PicoStreamingMicrophone");
    store.setLastChannelUrl("ws://127.0.0.1:17310/channel?token=abc");
    store.setVisionTarget("Sample Game");
    store.setAudioDevice("ヘッドホン (2- Shure MV7+)");
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getLastDevice(), "PicoStreamingMicrophone");
    assert.equal(reopened.getLastChannelUrl(), "ws://127.0.0.1:17310/channel?token=abc");
    assert.equal(reopened.getVisionTarget(), "Sample Game");
    assert.equal(reopened.getAudioDevice(), "ヘッドホン (2- Shure MV7+)");
    // audio device を変えても他は残る。
    store.setAudioDevice("スピーカー (Realtek(R) Audio)");
    const again = createFileSettingsStore({ path });
    assert.equal(again.getLastDevice(), "PicoStreamingMicrophone");
    assert.equal(again.getLastChannelUrl(), "ws://127.0.0.1:17310/channel?token=abc");
    assert.equal(again.getVisionTarget(), "Sample Game");
    assert.equal(again.getAudioDevice(), "スピーカー (Realtek(R) Audio)");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: corrupt JSON → getAudioDevice returns null (failure-tolerant)", () => {
  const dir = tmpDir();
  try {
    const badPath = join(dir, "bad.json");
    writeFileSync(badPath, "{ not json", "utf8");
    const bad = createFileSettingsStore({ path: badPath });
    assert.equal(bad.getAudioDevice(), null);
    // 非文字列 shape → null。
    const oddPath = join(dir, "odd.json");
    writeFileSync(oddPath, JSON.stringify({ audioDevice: 123 }), "utf8");
    assert.equal(createFileSettingsStore({ path: oddPath }).getAudioDevice(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: audio device 用の unwritable path は set を握って続行する", () => {
  const dir = tmpDir();
  try {
    const fileAsParent = join(dir, "afile");
    writeFileSync(fileAsParent, "x", "utf8");
    const store = createFileSettingsStore({ path: join(fileAsParent, "child", "settings.json") });
    assert.doesNotThrow(() => store.setAudioDevice("Some Device"));
    assert.equal(store.getAudioDevice(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 自発発火 ON/OFF トグルの永続化（S6「会話が続く」）───────────────────────

test("settings store: self-fire enabled set→get roundtrip persists across instances (bool)", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    assert.equal(store.getSelfFireEnabled(), null); // 未作成 = 記憶なし（bool の有無を区別）。
    store.setSelfFireEnabled(true);
    assert.equal(store.getSelfFireEnabled(), true);
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getSelfFireEnabled(), true);
    store.setSelfFireEnabled(false);
    assert.equal(createFileSettingsStore({ path }).getSelfFireEnabled(), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: self-fire enabled は他のキー（device/channel/vision/audio）と同居する", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    store.setLastDevice("PicoStreamingMicrophone");
    store.setVisionTarget("Sample Game");
    store.setAudioDevice("ヘッドホン (2- Shure MV7+)");
    store.setSelfFireEnabled(true);
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getLastDevice(), "PicoStreamingMicrophone");
    assert.equal(reopened.getVisionTarget(), "Sample Game");
    assert.equal(reopened.getAudioDevice(), "ヘッドホン (2- Shure MV7+)");
    assert.equal(reopened.getSelfFireEnabled(), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: corrupt / 非 bool JSON → getSelfFireEnabled returns null (failure-tolerant)", () => {
  const dir = tmpDir();
  try {
    const badPath = join(dir, "bad.json");
    writeFileSync(badPath, "{ not json", "utf8");
    const bad = createFileSettingsStore({ path: badPath });
    assert.equal(bad.getSelfFireEnabled(), null);
    // 非 bool shape → null（"true" 文字列や数値は bool ではない）。
    const oddPath = join(dir, "odd.json");
    writeFileSync(oddPath, JSON.stringify({ selfFireEnabled: "true" }), "utf8");
    assert.equal(createFileSettingsStore({ path: oddPath }).getSelfFireEnabled(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: self-fire enabled 用の unwritable path は set を握って続行する", () => {
  const dir = tmpDir();
  try {
    const fileAsParent = join(dir, "afile");
    writeFileSync(fileAsParent, "x", "utf8");
    const store = createFileSettingsStore({ path: join(fileAsParent, "child", "settings.json") });
    assert.doesNotThrow(() => store.setSelfFireEnabled(true));
    assert.equal(store.getSelfFireEnabled(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── barge-in ON/OFF トグルの永続化（「朗読と合いの手」・selfFireEnabled の写経・既定 ON は
//    呼び出し側 cockpit.mjs の createBargeInHooks が担う。store 自体は selfFireEnabled と同型）───

test("settings store: barge-in enabled set→get roundtrip persists across instances (bool)", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    assert.equal(store.getBargeInEnabled(), null); // 未作成 = 記憶なし（bool の有無を区別）。
    store.setBargeInEnabled(true);
    assert.equal(store.getBargeInEnabled(), true);
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getBargeInEnabled(), true);
    store.setBargeInEnabled(false);
    assert.equal(createFileSettingsStore({ path }).getBargeInEnabled(), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: barge-in enabled は他のキー（device/channel/vision/audio/self-fire）と同居する", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    store.setLastDevice("PicoStreamingMicrophone");
    store.setVisionTarget("Sample Game");
    store.setAudioDevice("ヘッドホン (2- Shure MV7+)");
    store.setSelfFireEnabled(true);
    store.setBargeInEnabled(false);
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getLastDevice(), "PicoStreamingMicrophone");
    assert.equal(reopened.getVisionTarget(), "Sample Game");
    assert.equal(reopened.getAudioDevice(), "ヘッドホン (2- Shure MV7+)");
    assert.equal(reopened.getSelfFireEnabled(), true);
    assert.equal(reopened.getBargeInEnabled(), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: corrupt / 非 bool JSON → getBargeInEnabled returns null (failure-tolerant)", () => {
  const dir = tmpDir();
  try {
    const badPath = join(dir, "bad.json");
    writeFileSync(badPath, "{ not json", "utf8");
    const bad = createFileSettingsStore({ path: badPath });
    assert.equal(bad.getBargeInEnabled(), null);
    // 非 bool shape → null（"true" 文字列や数値は bool ではない）。
    const oddPath = join(dir, "odd.json");
    writeFileSync(oddPath, JSON.stringify({ bargeInEnabled: "true" }), "utf8");
    assert.equal(createFileSettingsStore({ path: oddPath }).getBargeInEnabled(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: barge-in enabled 用の unwritable path は set を握って続行する", () => {
  const dir = tmpDir();
  try {
    const fileAsParent = join(dir, "afile");
    writeFileSync(fileAsParent, "x", "utf8");
    const store = createFileSettingsStore({ path: join(fileAsParent, "child", "settings.json") });
    assert.doesNotThrow(() => store.setBargeInEnabled(true));
    assert.equal(store.getBargeInEnabled(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── S7「視聴者が混ざる」: 視聴者チャット配信 source の永続化 ─────────────────────

test("settings store: chat source は set→get roundtrip で永続化する（別インスタンスでも読める）", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    assert.equal(store.getChatSource(), null); // 未作成 = 記憶なし。
    store.setChatSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.equal(store.getChatSource(), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getChatSource(), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: setChatSource(null) は記憶をクリアする", () => {
  const dir = tmpDir();
  try {
    const store = createFileSettingsStore({ path: join(dir, "settings.json") });
    store.setChatSource("dQw4w9WgXcQ");
    assert.equal(store.getChatSource(), "dQw4w9WgXcQ");
    store.setChatSource(null);
    assert.equal(store.getChatSource(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: chat source は他のキー（device/channel/vision/audio/self-fire）と同居する", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    store.setLastDevice("PicoStreamingMicrophone");
    store.setLastChannelUrl("ws://127.0.0.1:17310/channel?token=abc");
    store.setVisionTarget("Sample Game");
    store.setAudioDevice("ヘッドホン (2- Shure MV7+)");
    store.setSelfFireEnabled(true);
    store.setChatSource("https://youtube.com/watch?v=xyz");
    const reopened = createFileSettingsStore({ path });
    // どの set も他方を消していない（read-modify-write マージ）。
    assert.equal(reopened.getLastDevice(), "PicoStreamingMicrophone");
    assert.equal(reopened.getLastChannelUrl(), "ws://127.0.0.1:17310/channel?token=abc");
    assert.equal(reopened.getVisionTarget(), "Sample Game");
    assert.equal(reopened.getAudioDevice(), "ヘッドホン (2- Shure MV7+)");
    assert.equal(reopened.getSelfFireEnabled(), true);
    assert.equal(reopened.getChatSource(), "https://youtube.com/watch?v=xyz");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: chat source 用の unwritable path は set を握って続行する", () => {
  const dir = tmpDir();
  try {
    const fileAsParent = join(dir, "afile");
    writeFileSync(fileAsParent, "x", "utf8");
    const store = createFileSettingsStore({ path: join(fileAsParent, "child", "settings.json") });
    assert.doesNotThrow(() => store.setChatSource("dQw4w9WgXcQ"));
    assert.equal(store.getChatSource(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 口数モードの永続化（wave 計画「口数配線」§2 裁定 A・getVisionTarget/setVisionTarget の写経）───────

test("settings store: verbosity mode は set→get roundtrip で永続化する（別インスタンスでも読める）", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    assert.equal(store.getVerbosityMode(), null); // 未作成 = 記憶なし。
    store.setVerbosityMode("chatty");
    assert.equal(store.getVerbosityMode(), "chatty");
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getVerbosityMode(), "chatty");
    // クリアも効く。
    store.setVerbosityMode(null);
    assert.equal(createFileSettingsStore({ path }).getVerbosityMode(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: verbosity mode は他のキー（device/channel/vision/audio/self-fire/chat）と同居する", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    store.setLastDevice("PicoStreamingMicrophone");
    store.setLastChannelUrl("ws://127.0.0.1:17310/channel?token=abc");
    store.setVisionTarget("Sample Game");
    store.setAudioDevice("ヘッドホン (2- Shure MV7+)");
    store.setSelfFireEnabled(true);
    store.setChatSource("https://youtube.com/watch?v=xyz");
    store.setVerbosityMode("quiet");
    const reopened = createFileSettingsStore({ path });
    // どの set も他方を消していない（read-modify-write マージ）。
    assert.equal(reopened.getLastDevice(), "PicoStreamingMicrophone");
    assert.equal(reopened.getLastChannelUrl(), "ws://127.0.0.1:17310/channel?token=abc");
    assert.equal(reopened.getVisionTarget(), "Sample Game");
    assert.equal(reopened.getAudioDevice(), "ヘッドホン (2- Shure MV7+)");
    assert.equal(reopened.getSelfFireEnabled(), true);
    assert.equal(reopened.getChatSource(), "https://youtube.com/watch?v=xyz");
    assert.equal(reopened.getVerbosityMode(), "quiet");
    // verbosity mode を変えても他は残る。
    store.setVerbosityMode("chatty");
    const again = createFileSettingsStore({ path });
    assert.equal(again.getLastDevice(), "PicoStreamingMicrophone");
    assert.equal(again.getVerbosityMode(), "chatty");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: corrupt JSON → getVerbosityMode returns null (failure-tolerant)", () => {
  const dir = tmpDir();
  try {
    const badPath = join(dir, "bad.json");
    writeFileSync(badPath, "{ not json", "utf8");
    const bad = createFileSettingsStore({ path: badPath });
    assert.equal(bad.getVerbosityMode(), null);
    // 非文字列 shape → null。
    const oddPath = join(dir, "odd.json");
    writeFileSync(oddPath, JSON.stringify({ verbosityMode: 123 }), "utf8");
    assert.equal(createFileSettingsStore({ path: oddPath }).getVerbosityMode(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: verbosity mode 用の unwritable path は set を握って続行する", () => {
  const dir = tmpDir();
  try {
    const fileAsParent = join(dir, "afile");
    writeFileSync(fileAsParent, "x", "utf8");
    const store = createFileSettingsStore({ path: join(fileAsParent, "child", "settings.json") });
    assert.doesNotThrow(() => store.setVerbosityMode("chatty"));
    assert.equal(store.getVerbosityMode(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── brainChoice（多頭化 Domain B: 頭脳選択の settings 橋渡し・verbosityMode の写経）──────────────

test("settings store: brain choice は set→get roundtrip で永続化する（別インスタンスでも読める）", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    assert.equal(store.getBrainChoice(), null); // 未作成 = 記憶なし。
    store.setBrainChoice("codex");
    assert.equal(store.getBrainChoice(), "codex");
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getBrainChoice(), "codex");
    // クリアも効く。
    store.setBrainChoice(null);
    assert.equal(createFileSettingsStore({ path }).getBrainChoice(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: brain choice は他のキー（device/channel/vision/audio/self-fire/chat/verbosity）と同居する", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    store.setLastDevice("PicoStreamingMicrophone");
    store.setLastChannelUrl("ws://127.0.0.1:17310/channel?token=abc");
    store.setVisionTarget("Sample Game");
    store.setAudioDevice("ヘッドホン (2- Shure MV7+)");
    store.setSelfFireEnabled(true);
    store.setChatSource("https://youtube.com/watch?v=xyz");
    store.setVerbosityMode("quiet");
    store.setBrainChoice("codex");
    const reopened = createFileSettingsStore({ path });
    // どの set も他方を消していない（read-modify-write マージ）。
    assert.equal(reopened.getLastDevice(), "PicoStreamingMicrophone");
    assert.equal(reopened.getLastChannelUrl(), "ws://127.0.0.1:17310/channel?token=abc");
    assert.equal(reopened.getVisionTarget(), "Sample Game");
    assert.equal(reopened.getAudioDevice(), "ヘッドホン (2- Shure MV7+)");
    assert.equal(reopened.getSelfFireEnabled(), true);
    assert.equal(reopened.getChatSource(), "https://youtube.com/watch?v=xyz");
    assert.equal(reopened.getVerbosityMode(), "quiet");
    assert.equal(reopened.getBrainChoice(), "codex");
    // brain choice を変えても他は残る。
    store.setBrainChoice("claude");
    const again = createFileSettingsStore({ path });
    assert.equal(again.getLastDevice(), "PicoStreamingMicrophone");
    assert.equal(again.getVerbosityMode(), "quiet");
    assert.equal(again.getBrainChoice(), "claude");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: corrupt JSON → getBrainChoice returns null (failure-tolerant・不正型は寛容に扱う)", () => {
  const dir = tmpDir();
  try {
    const badPath = join(dir, "bad.json");
    writeFileSync(badPath, "{ not json", "utf8");
    const bad = createFileSettingsStore({ path: badPath });
    assert.equal(bad.getBrainChoice(), null);
    // 非文字列 shape → null。
    const oddPath = join(dir, "odd.json");
    writeFileSync(oddPath, JSON.stringify({ brainChoice: 123 }), "utf8");
    assert.equal(createFileSettingsStore({ path: oddPath }).getBrainChoice(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: brain choice 用の unwritable path は set を握って続行する", () => {
  const dir = tmpDir();
  try {
    const fileAsParent = join(dir, "afile");
    writeFileSync(fileAsParent, "x", "utf8");
    const store = createFileSettingsStore({ path: join(fileAsParent, "child", "settings.json") });
    assert.doesNotThrow(() => store.setBrainChoice("codex"));
    assert.equal(store.getBrainChoice(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── memoryEnabled トグルの永続化（配信間記憶・getBargeInEnabled の写経・既定 ON は
//    呼び出し側 cockpit.mjs の createMemoryHooks が担う。store 自体は bargeInEnabled と同型）───

test("settings store: memory enabled set→get roundtrip persists across instances (bool)", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    assert.equal(store.getMemoryEnabled(), null); // 未作成 = 記憶なし（bool の有無を区別）。
    store.setMemoryEnabled(true);
    assert.equal(store.getMemoryEnabled(), true);
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getMemoryEnabled(), true);
    store.setMemoryEnabled(false);
    assert.equal(createFileSettingsStore({ path }).getMemoryEnabled(), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: memory enabled は他のキー（device/channel/vision/audio/self-fire/barge-in/brain）と同居する", () => {
  const dir = tmpDir();
  const path = join(dir, "settings.json");
  try {
    const store = createFileSettingsStore({ path });
    store.setLastDevice("PicoStreamingMicrophone");
    store.setVisionTarget("Sample Game");
    store.setAudioDevice("ヘッドホン (2- Shure MV7+)");
    store.setSelfFireEnabled(true);
    store.setBargeInEnabled(false);
    store.setBrainChoice("codex");
    store.setMemoryEnabled(false);
    const reopened = createFileSettingsStore({ path });
    assert.equal(reopened.getLastDevice(), "PicoStreamingMicrophone");
    assert.equal(reopened.getVisionTarget(), "Sample Game");
    assert.equal(reopened.getAudioDevice(), "ヘッドホン (2- Shure MV7+)");
    assert.equal(reopened.getSelfFireEnabled(), true);
    assert.equal(reopened.getBargeInEnabled(), false);
    assert.equal(reopened.getBrainChoice(), "codex");
    assert.equal(reopened.getMemoryEnabled(), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: corrupt / 非 bool JSON → getMemoryEnabled returns null (failure-tolerant)", () => {
  const dir = tmpDir();
  try {
    const badPath = join(dir, "bad.json");
    writeFileSync(badPath, "{ not json", "utf8");
    const bad = createFileSettingsStore({ path: badPath });
    assert.equal(bad.getMemoryEnabled(), null);
    // 非 bool shape → null（"true" 文字列や数値は bool ではない）。
    const oddPath = join(dir, "odd.json");
    writeFileSync(oddPath, JSON.stringify({ memoryEnabled: "true" }), "utf8");
    assert.equal(createFileSettingsStore({ path: oddPath }).getMemoryEnabled(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("settings store: memory enabled 用の unwritable path は set を握って続行する", () => {
  const dir = tmpDir();
  try {
    const fileAsParent = join(dir, "afile");
    writeFileSync(fileAsParent, "x", "utf8");
    const store = createFileSettingsStore({ path: join(fileAsParent, "child", "settings.json") });
    assert.doesNotThrow(() => store.setMemoryEnabled(true));
    assert.equal(store.getMemoryEnabled(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
