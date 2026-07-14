// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  visionTargetLabel,
  micDeviceListView,
  windowListView,
  audioDeviceListView,
  initialDeviceSelection,
  visionTargetPostErrorText,
  audioDevicePostErrorText,
  channelPostErrorText,
  chatConnectErrorText,
  CHAT_EMPTY_SOURCE_ERROR,
  earsStartFailureText,
  requestErrorText,
  shouldAutoOpenSettings
} from "./settings.mjs";

test("visionTargetLabel: title 無しは not configured（applyVisionTarget :317-322）", () => {
  assert.equal(visionTargetLabel({ title: "FooGame" }), "FooGame");
  assert.equal(visionTargetLabel({ title: null }), "not configured");
  assert.equal(visionTargetLabel(null), "not configured");
  assert.equal(visionTargetLabel(undefined), "not configured");
});

test("micDeviceListView: 一覧 → option 列・エラー欄（loadDevices :704-726）", () => {
  assert.deepEqual(micDeviceListView({ devices: [{ name: "MV7+" }, { name: "Realtek" }], error: null }), {
    options: [
      { value: "MV7+", label: "MV7+" },
      { value: "Realtek", label: "Realtek" }
    ],
    errorText: ""
  });
  // 空 + error なし → "(no input devices)"（:711）。
  assert.deepEqual(micDeviceListView({ devices: [], error: null }), {
    options: [{ value: "", label: "(no input devices)" }],
    errorText: ""
  });
  // 空 + error あり → "(device enumeration failed)" + エラー欄（:711 :722）。
  assert.deepEqual(micDeviceListView({ devices: [], error: "ffmpeg missing" }), {
    options: [{ value: "", label: "(device enumeration failed)" }],
    errorText: "devices: ffmpeg missing"
  });
  // 一覧あり + error あり → 一覧は出しつつエラー欄も出す（:722 は無条件）。
  assert.deepEqual(micDeviceListView({ devices: [{ name: "A" }], error: "partial" }).errorText, "devices: partial");
});

test("windowListView: value=title・label='title (processName)'（loadWindows :592-613）", () => {
  assert.deepEqual(windowListView({ windows: [{ title: "FooGame", processName: "foo.exe" }], error: null }), {
    options: [{ value: "FooGame", label: "FooGame (foo.exe)" }],
    errorText: ""
  });
  assert.deepEqual(windowListView({ windows: [], error: null }), {
    options: [{ value: "", label: "(no windows)" }],
    errorText: ""
  });
  assert.deepEqual(windowListView({ windows: [], error: "ps failed" }), {
    options: [{ value: "", label: "(window enumeration failed)" }],
    errorText: "windows: ps failed"
  });
});

test("audioDeviceListView: 一覧 → option 列・エラー欄（loadAudioDevices :656-677）", () => {
  assert.deepEqual(audioDeviceListView({ devices: [{ name: "Headphones (MV7+)" }], error: null }), {
    options: [{ value: "Headphones (MV7+)", label: "Headphones (MV7+)" }],
    errorText: ""
  });
  assert.deepEqual(audioDeviceListView({ devices: [], error: null }), {
    options: [{ value: "", label: "(no output devices)" }],
    errorText: ""
  });
  assert.deepEqual(audioDeviceListView({ devices: [], error: "ps failed" }), {
    options: [{ value: "", label: "(device enumeration failed)" }],
    errorText: "devices: ps failed"
  });
});

test("initialDeviceSelection: preferred が一覧にあれば選択・無ければ先頭（selectDeviceIfPresent :698-703 :721）", () => {
  const options = [
    { value: "A", label: "A" },
    { value: "B", label: "B" }
  ];
  assert.equal(initialDeviceSelection(options, "B"), "B"); // lastDevice 初期選択。
  assert.equal(initialDeviceSelection(options, "Z"), "A"); // 一覧に無ければ先頭（DOM 既定と同値）。
  assert.equal(initialDeviceSelection(options, null), "A");
  assert.equal(initialDeviceSelection([], "A"), ""); // 空一覧。
});

test("設定 POST の失敗文言: 503 は各未注入文言・!ok は set failed・成功は null（:624-627 :688-691 :762-765）", () => {
  assert.equal(
    visionTargetPostErrorText({ status: 503, ok: false, j: null }),
    "vision target control not available"
  );
  assert.equal(
    audioDevicePostErrorText({ status: 503, ok: false, j: null }),
    "audio device control not available"
  );
  assert.equal(channelPostErrorText({ status: 503, ok: false, j: null }), "channel control not available");
  for (const fn of [visionTargetPostErrorText, audioDevicePostErrorText, channelPostErrorText]) {
    assert.equal(fn({ status: 500, ok: false, j: { error: "boom" } }), "set failed: boom");
    assert.equal(fn({ status: 500, ok: false, j: {} }), "set failed: error"); // error 欠落。
    assert.equal(fn({ status: 200, ok: true, j: {} }), null); // 成功はエラーなし。
  }
});

test("chatConnectErrorText: 503/400/!ok の文言・成功は null（:787-791）", () => {
  assert.equal(
    chatConnectErrorText({ status: 503, ok: false, j: null }),
    "chat not available (start cockpit normally to enable live chat)"
  );
  assert.equal(
    chatConnectErrorText({ status: 400, ok: false, j: { error: "chat source is required" } }),
    "invalid source: chat source is required"
  );
  assert.equal(chatConnectErrorText({ status: 500, ok: false, j: { error: "boom" } }), "connect failed: boom");
  assert.equal(chatConnectErrorText({ status: 500, ok: false, j: null }), "connect failed: error");
  assert.equal(chatConnectErrorText({ status: 200, ok: true, j: {} }), null);
  assert.equal(CHAT_EMPTY_SOURCE_ERROR, "enter a stream URL / video ID first"); // :779
});

test("earsStartFailureText: !ok（409/500）は start failed・成功は null（:740-742）", () => {
  assert.equal(
    earsStartFailureText({ ok: false, j: { error: "ears are transitioning; retry shortly." } }),
    "start failed: ears are transitioning; retry shortly."
  );
  assert.equal(earsStartFailureText({ ok: false, j: {} }), "start failed: error");
  assert.equal(earsStartFailureText({ ok: true, j: {} }), null);
});

test("requestErrorText: 各 fetch catch の prefix（現 cockpit.html の catch と 1:1）", () => {
  const e = new Error("net");
  assert.equal(requestErrorText("loadDevices", e), "failed to load devices: Error: net"); //   :724
  assert.equal(requestErrorText("loadWindows", e), "failed to load windows: Error: net"); //   :611
  assert.equal(requestErrorText("loadAudioDevices", e), "failed to load audio devices: Error: net"); // :675
  assert.equal(requestErrorText("earsStart", e), "start error: Error: net"); //                :748
  assert.equal(requestErrorText("earsStop", e), "stop error: Error: net"); //                  :809
  assert.equal(requestErrorText("visionTarget", e), "vision target error: Error: net"); //     :629
  assert.equal(requestErrorText("audioDevice", e), "audio device error: Error: net"); //       :693
  assert.equal(requestErrorText("channel", e), "channel error: Error: net"); //                :768
  assert.equal(requestErrorText("chatConnect", e), "chat connect error: Error: net"); //       :794
  assert.equal(requestErrorText("chatDisconnect", e), "chat disconnect error: Error: net"); // :802
});

test("shouldAutoOpenSettings: 設定が全て空のときだけ true（導線 §4・初回自動展開）", () => {
  // 初回（設定空）: channel 未設定・視界/出力先/chat source 未記憶・耳停止 → 自動展開。
  assert.equal(
    shouldAutoOpenSettings({
      ears: "stopped",
      device: null,
      channel: null,
      visionTarget: null,
      audioDevice: null,
      chat: { source: null, connected: false, state: null }
    }),
    true
  );
  // channel の { configured:false } / visionTarget・audioDevice の値 null 形も「空」扱い。
  assert.equal(
    shouldAutoOpenSettings({
      device: null,
      channel: { configured: false },
      visionTarget: { title: null },
      audioDevice: { name: null },
      chat: { source: null }
    }),
    true
  );
});

test("shouldAutoOpenSettings: どれか 1 つでも記憶済み/稼働中なら false（二回目以降は観測直行）", () => {
  const empty = {
    device: null,
    channel: null,
    visionTarget: null,
    audioDevice: null,
    chat: { source: null }
  };
  assert.equal(shouldAutoOpenSettings({ ...empty, channel: { configured: true, url: "ws://x" } }), false);
  assert.equal(shouldAutoOpenSettings({ ...empty, visionTarget: { title: "FooGame" } }), false);
  assert.equal(shouldAutoOpenSettings({ ...empty, audioDevice: { name: "MV7+" } }), false);
  assert.equal(shouldAutoOpenSettings({ ...empty, chat: { source: "vid1", connected: false } }), false);
  assert.equal(shouldAutoOpenSettings({ ...empty, device: "MV7+" }), false); // 耳が稼働中（開き直し）。
  // snapshot 欠落（取得失敗系）は開かない = 誤展開防止。
  assert.equal(shouldAutoOpenSettings(null), false);
  assert.equal(shouldAutoOpenSettings(undefined), false);
});
