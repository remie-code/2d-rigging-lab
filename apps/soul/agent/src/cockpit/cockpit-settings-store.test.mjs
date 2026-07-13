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
