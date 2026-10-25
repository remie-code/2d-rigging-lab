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
  brainPostErrorText,
  memoryRecordPostErrorText,
  memoryStatusLabel,
  STT_ENGINE_OPTIONS,
  sttEngineSelection,
  TTS_ENGINE_OPTIONS,
  ttsEngineSelection,
  COMPACT_THRESHOLD_DEFAULT_TOKENS,
  COMPACT_THRESHOLD_MIN_TOKENS,
  COMPACT_THRESHOLD_MAX_TOKENS,
  COMPACT_THRESHOLD_STEP_TOKENS,
  COMPACT_THRESHOLD_NOTE,
  compactThresholdOptions,
  compactThresholdSelection,
  compactThresholdStatusLabel,
  compactThresholdPostErrorText
} from "./settings.mjs";
import {
  DEFAULT_COMPACT_THRESHOLD_TOKENS,
  COMPACT_THRESHOLD_TOKENS_MIN,
  COMPACT_THRESHOLD_TOKENS_MAX
} from "../../mind/context-compactor.mjs";

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
  assert.equal(brainPostErrorText({ status: 503, ok: false, j: null }), "brain control not available"); // 多頭化 Domain C。
  for (const fn of [visionTargetPostErrorText, audioDevicePostErrorText, channelPostErrorText, brainPostErrorText]) {
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
  assert.equal(requestErrorText("brain", e), "brain error: Error: net"); // 多頭化 Domain C。
});

// ── 配信間記憶: 「今日を記録」と最後に記録した時刻の表示導出（settings-drawer「記憶」区画） ─────
//    記憶の作り直し Wave 2 で ON/OFF（memoryToggleView・memoryPostErrorText）と「N 件を搭載」を撤去。

test("撤去: 記憶の ON/OFF の表示導出は無い", async () => {
  const mod = await import("./settings.mjs");
  assert.equal(Object.prototype.hasOwnProperty.call(mod, "memoryToggleView"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(mod, "memoryPostErrorText"), false);
});

test("memoryRecordPostErrorText: 503 は未注入文言・!ok は set failed・成功は null", () => {
  assert.equal(memoryRecordPostErrorText({ status: 503, ok: false, j: null }), "memory record control not available");
  assert.equal(memoryRecordPostErrorText({ status: 500, ok: false, j: { error: "boom" } }), "set failed: boom");
  assert.equal(memoryRecordPostErrorText({ status: 500, ok: false, j: {} }), "set failed: error"); // error 欠落。
  assert.equal(memoryRecordPostErrorText({ status: 200, ok: true, j: {} }), null); // 成功はエラーなし。
});

test("requestErrorText: memoryRecord の prefix", () => {
  const e = new Error("net");
  assert.equal(requestErrorText("memoryRecord", e), "memory record error: Error: net");
});

test("memoryStatusLabel: memory が null/undefined は not available", () => {
  assert.equal(memoryStatusLabel(null), "not available");
  assert.equal(memoryStatusLabel(undefined), "not available");
});

test("memoryStatusLabel: 「最後に記録: ...」（まだなら まだ記録なし・記録中は（記録中…））で、件数は出さない", () => {
  assert.equal(memoryStatusLabel({ lastRecordAtMs: null, recording: false }), "最後に記録: まだ記録なし");
  // lastRecordAtMs はローカル時刻 HH:MM:SS へ変換される（format-time.mjs の formatClock を再利用）。
  const epochMs = new Date(2026, 6, 19, 21, 5, 9).getTime(); // 2026-07-19 21:05:09（ローカル）。
  assert.equal(memoryStatusLabel({ lastRecordAtMs: epochMs, recording: false }), "最後に記録: 21:05:09");
  assert.equal(memoryStatusLabel({ lastRecordAtMs: epochMs, recording: true }), "最後に記録: 21:05:09（記録中…）");
  assert.equal(memoryStatusLabel({ lastRecordAtMs: null, recording: true }), "最後に記録: まだ記録なし（記録中…）");
  // 古い形（count）が来ても件数は出さない。
  assert.doesNotMatch(memoryStatusLabel(/** @type {any} */ ({ count: 3, lastRecordAtMs: null })), /件/);
});

test("STT_ENGINE_OPTIONS / sttEngineSelection: 文字起こしの選択肢（whisper / ElevenLabs）と state.stt からの復元", () => {
  assert.deepEqual(
    STT_ENGINE_OPTIONS.map((o) => [o.value, o.label]),
    [
      ["whisper", "ローカル（whisper）"],
      ["elevenlabs", "ElevenLabs"]
    ]
  );
  assert.equal(sttEngineSelection({ engine: "elevenlabs" }), "elevenlabs");
  assert.equal(sttEngineSelection({ engine: "whisper" }), "whisper");
  assert.equal(sttEngineSelection({ engine: "google" }), null);
  assert.equal(sttEngineSelection(null), null);
});

test("TTS_ENGINE_OPTIONS / ttsEngineSelection: 声の選択肢（AivisSpeech / ElevenLabs）と state.tts からの復元", () => {
  assert.deepEqual(
    TTS_ENGINE_OPTIONS.map((o) => [o.value, o.label]),
    [
      ["aivis", "AivisSpeech"],
      ["elevenlabs", "ElevenLabs"]
    ]
  );
  assert.equal(ttsEngineSelection({ engine: "elevenlabs" }), "elevenlabs");
  assert.equal(ttsEngineSelection({ engine: "aivis" }), "aivis");
  assert.equal(ttsEngineSelection({ engine: "voicevox" }), null);
  assert.equal(ttsEngineSelection({}), null);
  assert.equal(ttsEngineSelection(null), null);
});

// ── 圧縮を始める大きさ（設定「頭脳・会話」タブ）─────────────────────────────

test("圧縮の目安の定数: 画面の写しは src/mind/context-compactor.mjs と同じ値（既定 20 万・5 万〜45 万・1 万刻み）", () => {
  assert.equal(COMPACT_THRESHOLD_DEFAULT_TOKENS, DEFAULT_COMPACT_THRESHOLD_TOKENS);
  assert.equal(COMPACT_THRESHOLD_MIN_TOKENS, COMPACT_THRESHOLD_TOKENS_MIN);
  assert.equal(COMPACT_THRESHOLD_MAX_TOKENS, COMPACT_THRESHOLD_TOKENS_MAX);
  assert.equal(COMPACT_THRESHOLD_STEP_TOKENS, 10_000);
  assert.match(COMPACT_THRESHOLD_NOTE, /Codex の頭のときだけ/);
});

test("compactThresholdOptions: 5 万〜45 万を 1 万刻み・既定に（既定）・刻みに乗らない今の値は差し込む", () => {
  const options = compactThresholdOptions(200_000);
  assert.equal(options.length, 41);
  assert.deepEqual(options[0], { value: "50000", label: "5 万トークン" });
  assert.deepEqual(options.at(-1), { value: "450000", label: "45 万トークン" });
  assert.deepEqual(options.find((o) => o.value === "200000"), { value: "200000", label: "20 万トークン（既定）" });
  assert.equal(options.filter((o) => o.label.includes("既定")).length, 1);
  assert.deepEqual(compactThresholdOptions(null), options, "今の値が無くても同じ並び");
  const withOdd = compactThresholdOptions(235_000);
  assert.equal(withOdd.length, 42);
  const i = withOdd.findIndex((o) => o.value === "235000");
  assert.deepEqual(withOdd[i], { value: "235000", label: "23.5 万トークン" });
  assert.deepEqual([withOdd[i - 1].value, withOdd[i + 1].value], ["230000", "240000"], "昇順に差し込む");
  assert.equal(compactThresholdOptions(10_000).length, 41, "範囲外の値は差し込まない");
});

test("compactThresholdSelection / compactThresholdStatusLabel: snapshot の compaction から選択と表示", () => {
  assert.equal(compactThresholdSelection({ thresholdTokens: 200_000 }), "200000");
  assert.equal(compactThresholdSelection({ thresholdTokens: 10_000 }), null);
  assert.equal(compactThresholdSelection(null), null);
  assert.equal(compactThresholdSelection(undefined), null);
  assert.equal(compactThresholdStatusLabel({ thresholdTokens: 200_000 }), "いま 20 万トークン（既定）");
  assert.equal(compactThresholdStatusLabel({ thresholdTokens: 250_000 }), "いま 25 万トークン（既定は 20 万）");
  assert.equal(compactThresholdStatusLabel({ thresholdTokens: 230_097 }), "いま 23 万トークン（既定は 20 万）");
  assert.equal(compactThresholdStatusLabel(null), "not available");
  assert.equal(compactThresholdStatusLabel({}), "not available");
});

test("compactThresholdPostErrorText / requestErrorText: POST /api/compact-threshold の失敗文言", () => {
  assert.equal(compactThresholdPostErrorText({ status: 200, ok: true, j: {} }), null);
  assert.equal(compactThresholdPostErrorText({ status: 503, ok: false, j: {} }), "compaction control not available");
  assert.equal(
    compactThresholdPostErrorText({ status: 400, ok: false, j: { error: "tokens must be an integer from 50000 to 450000" } }),
    "set failed: tokens must be an integer from 50000 to 450000"
  );
  assert.equal(requestErrorText("compactThreshold", new Error("net")), "compaction threshold error: Error: net");
});
