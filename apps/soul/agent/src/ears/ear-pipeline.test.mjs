// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createEarPipeline, EAR_DEFAULTS } from "./ear-pipeline.mjs";
import { sinePcm, silencePcm, concatInt16, int16ToBytesLE } from "./fixtures-audio.mjs";
import { wavDurationSec } from "../voice/wav-duration.mjs";
import { DEFAULT_WHISPER_PROMPT } from "./whisper-inference.mjs";
import { createFakeWebSocketClass } from "../test-support/fake-websocket.mjs";

// 耳パイプライン結線の機械テスト（S2 Domain C）。全部品を注入し、実マイク・実 ONNX・
// 実 whisper-server・実ネットワークを一切使わずに縦貫通とライフサイクルを固定する。
//  - capture: fake factory（onPcm を握って合成 PCM を手で流す）
//  - VAD: エネルギーベースの決定論 fake（RMS > 0.1 → 0.9 / それ以外 0.05）
//  - whisper-server: ready/baseUrl/dispose/onExit だけを持つ fake
//  - transcribe: 記録・失敗・ハングを script できる fake

/** 有界の条件待ち（テスト自身がハングしない）。 */
async function until(cond, ms, label) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > (ms ?? 3000)) throw new Error(`timed out waiting for ${label ?? "condition"}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** テストハーネス一式を組む。 */
function makeHarness({ pipelineOptions = {}, transcribeImpl } = {}) {
  const record = {
    /** @type {any[]} */ vadEvents: [],
    /** @type {any[]} */ transcripts: [],
    /** @type {any[]} */ diagnostics: [],
    /** @type {any[]} */ transcribeCalls: [],
    disposed: { capture: false, vad: false, server: false },
    /** @type {any} */ captureOptions: null,
    /** @type {any} */ serverOptions: null
  };

  const captureFactory = (opts) => {
    record.captureOptions = opts;
    return {
      restartCount: () => 0,
      isDisposed: () => record.disposed.capture,
      currentChild: () => null,
      dispose: () => {
        record.disposed.capture = true;
      }
    };
  };

  const vadFactory = () => ({
    modelPath: "(fake)",
    frameSamples: 512,
    async init() {},
    /** RMS ベースの決定論 fake（正弦波 amp0.6 → 0.9 / 無音 → 0.05）。 */
    async process(frame) {
      let sum = 0;
      for (let i = 0; i < frame.length; i += 1) sum += frame[i] * frame[i];
      const rms = Math.sqrt(sum / frame.length);
      return rms > 0.1 ? 0.9 : 0.05;
    },
    reset() {},
    async dispose() {
      record.disposed.vad = true;
    }
  });

  const serverFactory = (opts) => {
    record.serverOptions = opts;
    return {
      ready: Promise.resolve(),
      baseUrl: "http://127.0.0.1:0",
      isDisposed: () => record.disposed.server,
      hasExited: () => false,
      currentChild: () => null,
      dispose: () => {
        record.disposed.server = true;
      }
    };
  };

  const defaultTranscribe = async (wav, opts) => {
    record.transcribeCalls.push({ wav, opts });
    return { text: `転写${record.transcribeCalls.length}`, rawText: ` 転写${record.transcribeCalls.length}\n` };
  };

  const pipeline = createEarPipeline({
    // テストを速く回すための短い区切り設定（結線の論理には影響しない）。
    segmenter: { minSpeechMs: 100, minSilenceMs: 64, speechPadMs: 0, ...(pipelineOptions.segmenter ?? {}) },
    ...pipelineOptions,
    captureFactory,
    vadFactory,
    serverFactory,
    transcribeImpl:
      transcribeImpl === undefined
        ? defaultTranscribe
        : (wav, opts) => {
            record.transcribeCalls.push({ wav, opts });
            return transcribeImpl(wav, opts, record.transcribeCalls.length);
          },
    onVadEvent: (e) => record.vadEvents.push(e),
    onTranscript: (entry, meta) => record.transcripts.push({ entry, meta }),
    onDiagnostic: (d) => record.diagnostics.push(d)
  });

  /** 合成 PCM をバイト列で耳に流す（ffmpeg stdout の代役）。 */
  const feed = (int16) => record.captureOptions.onPcm(int16ToBytesLE(int16));
  /** 「無音 → 発話 durationMs → 無音」を 1 発話として流す。 */
  const feedUtterance = (durationMs) =>
    feed(
      concatInt16(
        silencePcm({ durationMs: 96 }),
        sinePcm({ freq: 440, durationMs }),
        silencePcm({ durationMs: 160 })
      )
    );

  return { pipeline, record, feed, feedUtterance };
}

test("ear-pipeline: 縦貫通（合成 PCM → speechStart/End → 切り出し → 転写 → バッファ）", async () => {
  const h = makeHarness();
  await h.pipeline.start();
  try {
    h.feedUtterance(480);
    await until(() => h.pipeline.transcriptBuffer.size() === 1, 3000, "transcript appended");

    // VAD イベント: speechStart → speechEnd(silence)。
    const types = h.record.vadEvents.map((e) => e.type);
    assert.deepEqual(types, ["speechStart", "speechEnd"]);
    const end = h.record.vadEvents[1];
    assert.equal(end.reason, "silence");

    // 切り出された WAV の尺 ≈ 発話長（フレーム 32ms 粒度の丸めを許容）。
    assert.equal(h.record.transcribeCalls.length, 1);
    const wavSec = wavDurationSec(h.record.transcribeCalls[0].wav);
    assert.ok(Math.abs(wavSec - 0.48) < 0.1, `wav duration ≈ 0.48s; got ${wavSec}`);
    // 動的 audio_ctx（短発話は下限 256 に clamp）。
    assert.equal(h.record.transcribeCalls[0].opts.audioCtx, 256);

    // 正本に積まれ、onTranscript が meta（レイテンシ）付きで届く。
    const entry = h.pipeline.transcriptBuffer.all()[0];
    assert.equal(entry.text, "転写1");
    assert.ok(Math.abs(entry.startMs - 96) <= 64, `startMs ≈ 96; got ${entry.startMs}`);
    assert.ok(Math.abs(entry.endMs - 576) <= 64, `endMs ≈ 576; got ${entry.endMs}`);
    assert.equal(h.record.transcripts.length, 1);
    assert.ok(h.record.transcripts[0].meta.latencyMs >= 0);
    assert.equal(h.record.transcripts[0].meta.audioCtx, 256);
    assert.equal(h.pipeline.stats().asrDone, 1);
  } finally {
    await h.pipeline.dispose();
  }
});

test("ear-pipeline: transcribeImpl 未指定時は本番経路の whisper-inference が既定 prompt を常時注入する（wave-plan §2 裁定B）", async () => {
  // options.transcribeImpl を省略する = ear-pipeline.mjs:387-392 の
  // `createWhisperInference({ baseUrl: server.baseUrl, timeoutMs })`（options.prompt 省略）を実際に
  // 通す。ear-pipeline.mjs 自体は無改変（B-2 の設計裁定）——「既定 prompt が本番経路に自動で乗る」
  // ことを globalThis.fetch の一時差し替えのみで固定する（実 whisper-server/実ネット不使用）。
  const originalFetch = globalThis.fetch;
  /** @type {any[]} */
  const fetchCalls = [];
  globalThis.fetch = /** @type {any} */ (
    async (url, init) => {
      fetchCalls.push({ url, init });
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ text: "こんにちは" }) };
    }
  );

  /** @type {any} */
  const record = { captureOptions: null, transcripts: [] };
  const captureFactory = /** @type {any} */ (
    (opts) => {
      record.captureOptions = opts;
      return { dispose() {} };
    }
  );
  const vadFactory = /** @type {any} */ (
    () => ({
      async init() {},
      async process(frame) {
        let sum = 0;
        for (let i = 0; i < frame.length; i += 1) sum += frame[i] * frame[i];
        const rms = Math.sqrt(sum / frame.length);
        return rms > 0.1 ? 0.9 : 0.05;
      },
      reset() {},
      async dispose() {}
    })
  );
  const serverFactory = /** @type {any} */ (
    () => ({ ready: Promise.resolve(), baseUrl: "http://127.0.0.1:0", dispose() {} })
  );

  const pipeline = createEarPipeline({
    segmenter: { minSpeechMs: 100, minSilenceMs: 64, speechPadMs: 0 },
    captureFactory,
    vadFactory,
    serverFactory,
    // transcribeImpl を渡さない = 本番経路（options.transcribeImpl == null 分岐）を通す。
    onTranscript: (entry) => record.transcripts.push(entry)
  });

  try {
    await pipeline.start();
    const feed = (int16) => record.captureOptions.onPcm(int16ToBytesLE(int16));
    feed(
      concatInt16(
        silencePcm({ durationMs: 96 }),
        sinePcm({ freq: 440, durationMs: 300 }),
        silencePcm({ durationMs: 160 })
      )
    );
    await until(() => fetchCalls.length > 0, 3000, "本番経路の /inference fetch 呼び出し");
    await until(() => record.transcripts.length > 0, 3000, "transcript appended");

    const form = fetchCalls[0].init.body;
    assert.ok(form instanceof FormData);
    assert.equal(form.get("prompt"), DEFAULT_WHISPER_PROMPT);
  } finally {
    globalThis.fetch = originalFetch;
    await pipeline.dispose();
  }
});

test("ear-pipeline: whisper prompt provider は耳を再起動せず発話ごとに現在値を反映する", async () => {
  const originalFetch = globalThis.fetch;
  /** @type {any[]} */
  const fetchCalls = [];
  let activePrompt = "こーでぃー、コーディ。";
  globalThis.fetch = /** @type {any} */ (
    async (url, init) => {
      fetchCalls.push({ url, init });
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ text: "応答" }) };
    }
  );

  /** @type {any} */
  const record = { captureOptions: null, transcripts: [] };
  const captureFactory = /** @type {any} */ ((opts) => {
    record.captureOptions = opts;
    return { dispose() {} };
  });
  const vadFactory = /** @type {any} */ (
    () => ({
      async init() {},
      async process(frame) {
        let sum = 0;
        for (let i = 0; i < frame.length; i += 1) sum += frame[i] * frame[i];
        const rms = Math.sqrt(sum / frame.length);
        return rms > 0.1 ? 0.9 : 0.05;
      },
      reset() {},
      async dispose() {}
    })
  );
  const serverFactory = /** @type {any} */ (() => ({ ready: Promise.resolve(), baseUrl: "http://127.0.0.1:0", dispose() {} }));
  const pipeline = createEarPipeline({
    segmenter: { minSpeechMs: 100, minSilenceMs: 64, speechPadMs: 0 },
    whisper: { promptProvider: () => activePrompt },
    captureFactory,
    vadFactory,
    serverFactory,
    onTranscript: (entry) => record.transcripts.push(entry)
  });

  try {
    await pipeline.start();
    const feed = (int16) => record.captureOptions.onPcm(int16ToBytesLE(int16));
    const utterance = () =>
      feed(
        concatInt16(
          silencePcm({ durationMs: 96 }),
          sinePcm({ freq: 440, durationMs: 300 }),
          silencePcm({ durationMs: 160 })
        )
      );

    utterance();
    await until(() => record.transcripts.length === 1, 3000, "first dynamic transcript");
    activePrompt = "ちゃっぴー、チャッピー。";
    utterance();
    await until(() => record.transcripts.length === 2, 3000, "second dynamic transcript");

    assert.equal(fetchCalls.length, 2);
    assert.equal(fetchCalls[0].init.body.get("prompt"), "こーでぃー、コーディ。");
    assert.equal(fetchCalls[1].init.body.get("prompt"), "ちゃっぴー、チャッピー。");
  } finally {
    globalThis.fetch = originalFetch;
    await pipeline.dispose();
  }
});

test("ear-pipeline: maxSpeech 分割（長発話は 2×pad 重なり付きで複数転写・clamp 経由で安全）", async () => {
  const h = makeHarness({
    pipelineOptions: {
      segmenter: { minSpeechMs: 100, minSilenceMs: 64, speechPadMs: 16, maxSpeechMs: 320 }
    }
  });
  await h.pipeline.start();
  try {
    h.feedUtterance(1000); // 320ms ごとに強制区切り → 3 分割 + 末尾
    await until(() => h.pipeline.transcriptBuffer.size() >= 3, 3000, "3+ transcripts");
    const ends = h.record.vadEvents.filter((e) => e.type === "speechEnd");
    assert.ok(ends.length >= 3);
    assert.equal(ends[0].reason, "maxSpeech");
    // 隣接セグメントは 2×pad（32ms）重なる（意図された契約・リング切り出しはコピーなので安全）。
    const entries = h.pipeline.transcriptBuffer.all();
    assert.ok(entries[1].startMs < entries[0].endMs, "分割セグメントは重なる");
    for (const e of entries) {
      assert.ok(e.endMs - e.startMs <= 400, `各分割 ≤ 400ms; got ${e.endMs - e.startMs}`);
    }
  } finally {
    await h.pipeline.dispose();
  }
});

test("ear-pipeline: ASR 失敗は 1 発話を落として常駐は続く（診断イベント）", async () => {
  const h = makeHarness({
    transcribeImpl: async (_wav, _opts, n) => {
      if (n === 1) throw new Error("kaboom");
      return { text: "二回目", rawText: "二回目" };
    }
  });
  await h.pipeline.start();
  try {
    h.feedUtterance(200);
    await until(() => h.record.diagnostics.some((d) => d.type === "asrFailure"), 3000, "asrFailure diag");
    h.feedUtterance(200);
    await until(() => h.pipeline.transcriptBuffer.size() === 1, 3000, "2nd transcript");
    assert.equal(h.pipeline.transcriptBuffer.all()[0].text, "二回目");
    const stats = h.pipeline.stats();
    assert.equal(stats.asrFailed, 1);
    assert.equal(stats.asrDone, 1);
  } finally {
    await h.pipeline.dispose();
  }
});

test("ear-pipeline: 外側見張り（transcribe が返ってこなくても発話 1 個を落として続く）", async () => {
  const h = makeHarness({
    pipelineOptions: { asr: { utteranceTimeoutMs: 80 } },
    transcribeImpl: (_wav, _opts, n) => {
      if (n === 1) return new Promise(() => {}); // 永遠に pending（本文読み取り停止の模擬）
      return Promise.resolve({ text: "生還", rawText: "生還" });
    }
  });
  await h.pipeline.start();
  try {
    h.feedUtterance(200);
    await until(
      () => h.record.diagnostics.some((d) => d.type === "asrFailure" && /outer watchdog/.test(d.message)),
      3000,
      "watchdog diag"
    );
    h.feedUtterance(200);
    await until(() => h.pipeline.transcriptBuffer.size() === 1, 3000, "recovered transcript");
    assert.equal(h.pipeline.transcriptBuffer.all()[0].text, "生還");
  } finally {
    await h.pipeline.dispose();
  }
});

test("ear-pipeline: ASR は直列キュー・上限超過は最古を捨てる（診断付き）", async () => {
  /** @type {(() => void)[]} */
  const gates = [];
  const h = makeHarness({
    pipelineOptions: { asr: { queueMax: 2 } },
    transcribeImpl: (_wav, _opts, n) =>
      new Promise((resolve) => {
        gates.push(() => resolve({ text: `t${n}`, rawText: `t${n}` }));
      })
  });
  await h.pipeline.start();
  try {
    for (let i = 0; i < 6; i += 1) {
      h.feedUtterance(150);
    }
    // 6 発話 → 1 個目が実行中・キュー 2・溢れ 3。
    await until(() => h.record.transcribeCalls.length === 1, 3000, "first job running");
    await until(
      () => h.record.diagnostics.filter((d) => d.type === "asrDropped").length === 3,
      3000,
      "3 dropped"
    );
    // ゲートを順に開けると残りが直列に流れる（同時実行は常に 1）。
    while (h.pipeline.transcriptBuffer.size() < 3) {
      await until(() => gates.length > 0, 3000, "gate available");
      const gate = gates.shift();
      if (gate) gate();
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(h.pipeline.transcriptBuffer.size(), 3); // 実行中 1 + キュー 2
    assert.equal(h.pipeline.stats().asrDropped, 3);
  } finally {
    await h.pipeline.dispose();
  }
});

test("ear-pipeline: whisper-server の runtime 死 → 診断 + 以後の発話は skip・VAD イベントは生き続ける", async () => {
  const h = makeHarness();
  await h.pipeline.start();
  try {
    // ready 後の非 dispose 死（監視 2 経路目）を fake の onExit で発火。
    h.record.serverOptions.onExit({ code: 1, signal: null });
    assert.ok(h.record.diagnostics.some((d) => d.type === "whisperDown" && d.phase === "runtime"));
    h.feedUtterance(200);
    await until(() => h.record.diagnostics.some((d) => d.type === "asrSkipped"), 3000, "asrSkipped diag");
    // VAD イベント（S6 barge-in の土台）は死んでいない。
    assert.ok(h.record.vadEvents.some((e) => e.type === "speechStart"));
    assert.ok(h.record.vadEvents.some((e) => e.type === "speechEnd"));
    assert.equal(h.record.transcribeCalls.length, 0);
    assert.equal(h.pipeline.transcriptBuffer.size(), 0);
  } finally {
    await h.pipeline.dispose();
  }
});

test("ear-pipeline: 起動失敗（ready reject = spawn 失敗含む 1 経路目）は開いた分を畳んで throw", async () => {
  const record = { vadDisposed: false, serverDisposed: false, captureCreated: false };
  const pipeline = createEarPipeline({
    captureFactory: /** @type {any} */ (
      () => {
        record.captureCreated = true;
        return { dispose() {} };
      }
    ),
    vadFactory: /** @type {any} */ (
      () => ({
        async init() {},
        async process() {
          return 0;
        },
        reset() {},
        async dispose() {
          record.vadDisposed = true;
        }
      })
    ),
    serverFactory: /** @type {any} */ (
      () => {
        const ready = Promise.reject(new Error("spawn ENOENT (fake)"));
        ready.catch(() => {});
        return {
          ready,
          baseUrl: "http://127.0.0.1:0",
          dispose() {
            record.serverDisposed = true;
          }
        };
      }
    ),
    transcribeImpl: async () => ({ text: "", rawText: "" })
  });
  await assert.rejects(() => pipeline.start(), /failed to bring up ears.*spawn ENOENT/);
  assert.equal(pipeline.isDisposed(), true);
  assert.equal(record.vadDisposed, true);
  assert.equal(record.serverDisposed, true);
  assert.equal(record.captureCreated, false, "起動失敗時にマイクを開かない");
});

test("ear-pipeline: 外部購読者の listener throw は診断に落ち、onTranscript 配信と常駐は続く（契約テスト）", async () => {
  const h = makeHarness();
  await h.pipeline.start();
  try {
    // 外部購読者（S3 相当）が契約違反で throw する。
    h.pipeline.transcriptBuffer.onAppend(() => {
      throw new Error("S3 listener bug");
    });
    h.feedUtterance(200);
    await until(() => h.record.diagnostics.some((d) => d.type === "listenerError"), 3000, "listenerError diag");
    // 正本は壊れず、パイプライン自前の onTranscript は配信済み。
    assert.equal(h.pipeline.transcriptBuffer.size(), 1);
    assert.equal(h.record.transcripts.length, 1);
    // 常駐は続く（次の発話も通る）。
    h.feedUtterance(200);
    await until(() => h.pipeline.transcriptBuffer.size() === 2, 3000, "2nd transcript after listener bug");
    assert.equal(h.record.transcripts.length, 2);
  } finally {
    await h.pipeline.dispose();
  }
});

test("ear-pipeline: dispose 一発で全部品が畳まれ冪等・以後の PCM は無視", async () => {
  const h = makeHarness();
  await h.pipeline.start();
  h.feedUtterance(200);
  await until(() => h.pipeline.transcriptBuffer.size() === 1, 3000, "first transcript");
  await h.pipeline.dispose();
  assert.equal(h.pipeline.isDisposed(), true);
  assert.deepEqual(h.record.disposed, { capture: true, vad: true, server: true });
  await h.pipeline.dispose(); // 冪等
  const before = h.pipeline.stats().frames;
  h.feedUtterance(200); // dispose 後の PCM は無視される
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(h.pipeline.stats().frames, before);
  assert.equal(h.pipeline.transcriptBuffer.size(), 1);
});

test("ear-pipeline: 常駐既定（maxSpeechMs=20000 / threads=6）が部品へ渡る", async () => {
  const h = makeHarness();
  assert.equal(EAR_DEFAULTS.maxSpeechMs, 20000);
  assert.equal(EAR_DEFAULTS.threads, 6);
  await h.pipeline.start();
  try {
    assert.equal(h.record.serverOptions.threads, 6);
  } finally {
    await h.pipeline.dispose();
  }
});

// ── 文字起こしの分岐: ElevenLabs（操縦席の文字起こし選択・cockpit-stt-selection.md §3/§8）────────
//  WebSocket は fake（test-support/fake-websocket.mjs）を注入し、実 ElevenLabs には繋がない。

/** ElevenLabs engine のハーネス（既存 makeHarness に stt と fake WebSocket を足すだけ）。 */
function makeElevenLabsHarness({ nowImpl } = {}) {
  const wsClass = createFakeWebSocketClass();
  /** @type {Array<{ status: string; reason: string | null }>} */
  const sttStatuses = [];
  const h = makeHarness({
    pipelineOptions: {
      stt: { engine: "elevenlabs", apiKey: "sk_fake", elevenLabs: { WebSocketImpl: wsClass.FakeWebSocket } },
      onSttStatus: (status, info) => sttStatuses.push({ status, reason: info.reason }),
      ...(nowImpl ? { nowImpl } : {})
    }
  });
  /** start → fake の session_started まで。 */
  const startConnected = async () => {
    const p = h.pipeline.start();
    await until(() => wsClass.sockets.length === 1, 3000, "websocket created");
    wsClass.last().serverSessionStarted();
    await p;
  };
  return { ...h, wsClass, sttStatuses, startConnected };
}

test("ear-pipeline(elevenlabs): whisper-server を起動せず・接続（session_started）後にマイクを開く", async () => {
  const h = makeElevenLabsHarness();
  const p = h.pipeline.start();
  await until(() => h.wsClass.sockets.length === 1, 3000, "websocket created");
  assert.equal(h.record.captureOptions, null, "接続前はマイクを開かない");
  h.wsClass.last().serverSessionStarted();
  await p;
  try {
    assert.equal(h.record.serverOptions, null, "whisper-server は作らない");
    assert.notEqual(h.record.captureOptions, null);
    assert.equal(h.wsClass.last().headers["xi-api-key"], "sk_fake");
    assert.deepEqual(h.sttStatuses.map((s) => s.status), ["connecting", "up"]);
    assert.equal(h.pipeline.stats().sttEngine, "elevenlabs");
  } finally {
    await h.pipeline.dispose();
  }
  assert.equal(h.wsClass.last().closedByClientCode, 1000, "dispose で接続を閉じる");
  assert.equal(h.record.disposed.server, false);
});

test("ear-pipeline(elevenlabs): 接続失敗は start の reject（理由付き）・マイクは開かず畳む", async () => {
  const h = makeElevenLabsHarness();
  const p = h.pipeline.start();
  await until(() => h.wsClass.sockets.length === 1, 3000, "websocket created");
  h.wsClass.last().serverOpen();
  h.wsClass.last().serverSend({ message_type: "auth_error", error: "You must be authenticated to use this endpoint." });
  await assert.rejects(p, /failed to bring up ears \(ElevenLabs に接続できない（auth_error/);
  assert.equal(h.record.captureOptions, null);
  assert.equal(h.pipeline.isDisposed(), true);
  assert.equal(h.record.disposed.vad, true);
  assert.equal(h.sttStatuses.at(-1)?.status, "down");
});

test("ear-pipeline(elevenlabs): マイクの PCM を流し・手元 VAD の合図は今まで通り・commit 1 件 = 転写 1 件", async () => {
  let clock = 50_000;
  const h = makeElevenLabsHarness({ nowImpl: () => clock });
  await h.startConnected();
  try {
    h.feedUtterance(480);
    await until(() => h.record.vadEvents.some((e) => e.type === "speechEnd"), 3000, "speechEnd");
    assert.deepEqual(h.record.vadEvents.map((e) => e.type), ["speechStart", "speechEnd"]);
    // whisper には投げない。
    assert.equal(h.record.transcribeCalls.length, 0);
    // PCM は 100ms 単位で送られている（96+480+160ms ≈ 736ms → 7 本）。
    const chunks = h.wsClass.last().sentChunks();
    assert.equal(chunks.length, 7);
    assert.ok(chunks.every((c) => c.message_type === "input_audio_chunk" && c.commit === false));

    // commit が届くと転写 1 件（start = end = commit 到着時点のストリーム時刻）。
    clock += 480; // speechEnd から 480ms 後に commit 到着
    h.wsClass.last().serverCommit("こんにちは");
    assert.equal(h.pipeline.transcriptBuffer.size(), 1);
    const entry = h.pipeline.transcriptBuffer.all()[0];
    assert.equal(entry.text, "こんにちは");
    assert.equal(entry.speaker, "you");
    assert.equal(entry.startMs, entry.endMs);
    assert.equal(entry.endMs, h.pipeline.streamMs());
    assert.equal(h.record.transcripts.length, 1);
    assert.deepEqual(h.record.transcripts[0].meta, { latencyMs: 480, audioCtx: null });

    // 直前の commit 以降に speechEnd が無い commit は遅延なし（null）。
    clock += 300;
    h.wsClass.last().serverCommit("だから-");
    assert.equal(h.pipeline.transcriptBuffer.size(), 2);
    assert.equal(h.record.transcripts[1].meta.latencyMs, null);
    assert.equal(h.pipeline.stats().sttCommits, 2);
  } finally {
    await h.pipeline.dispose();
  }
});

test("ear-pipeline(elevenlabs): 空の commit は既存と同じく discarded として数える", async () => {
  const h = makeElevenLabsHarness();
  await h.startConnected();
  try {
    h.wsClass.last().serverCommit("   ");
    assert.equal(h.pipeline.transcriptBuffer.size(), 0);
    assert.equal(h.pipeline.transcriptBuffer.stats().discarded, 1);
    assert.equal(h.record.transcripts.length, 0);
    assert.ok(h.record.diagnostics.some((d) => d.type === "transcriptDiscarded" && d.reason === "blank"));
  } finally {
    await h.pipeline.dispose();
  }
});

test("ear-pipeline(elevenlabs): 切断は reconnecting を通知し・繋ぎ直し中の音は送らない（whisper へは切り替えない）", async () => {
  const h = makeElevenLabsHarness();
  await h.startConnected();
  try {
    const ws = h.wsClass.last();
    ws.serverClose(1006, "network");
    assert.equal(h.sttStatuses.at(-1)?.status, "reconnecting");
    const sentBefore = ws.sent.length;
    h.feedUtterance(200);
    await until(() => h.record.vadEvents.some((e) => e.type === "speechEnd"), 3000, "speechEnd");
    assert.equal(ws.sent.length, sentBefore, "繋ぎ直し中の音は捨てる");
    assert.equal(h.wsClass.sockets.length, 1, "再接続は待ち時間の後");
    assert.equal(h.record.serverOptions, null);
    assert.equal(h.record.transcribeCalls.length, 0);
  } finally {
    await h.pipeline.dispose();
  }
});

test("ear-pipeline: 未知の stt engine は生成時に throw", () => {
  assert.throws(() => createEarPipeline({ stt: { engine: /** @type {any} */ ("bogus") } }), /unknown stt engine/);
});

// ── ローカルの文字起こし（parakeet / zipformer・local-stt-wave-plan.md §1）──────────────────────
//  子プロセスの係は偽物（localSttFactory）。本物の fork・sherpa は使わない（local-stt-client.test.mjs の領分）。

/** 偽物のローカル文字起こしの係（ready を解決・転写を記録・dispose を記録）。 */
function makeFakeLocalStt({ readyError = /** @type {Error | null} */ (null) } = {}) {
  const rec = {
    /** @type {any} */ options: null,
    /** @type {Uint8Array[]} */ wavs: [],
    disposed: false
  };
  const factory = (/** @type {any} */ opts) => {
    rec.options = opts;
    const info = { loadMs: 10, decodingMethod: "greedy_search", hotwordsUsed: ["チャッピー"], hotwordsDropped: [] };
    const ready = readyError ? Promise.reject(readyError) : Promise.resolve(info);
    ready.catch(() => {});
    if (!readyError) opts.onReady?.(info);
    return {
      ready,
      async transcribe(/** @type {Uint8Array} */ wav) {
        rec.wavs.push(wav);
        return { text: `ローカル${rec.wavs.length}`, rawText: `ローカル${rec.wavs.length}`, ms: 5 };
      },
      hasExited: () => false,
      isDisposed: () => rec.disposed,
      pending: () => 0,
      dispose() {
        rec.disposed = true;
      }
    };
  };
  return { factory: /** @type {any} */ (factory), rec };
}

/** 前に 400ms の無音 → 正弦波 480ms → 無音 160ms（前の余白 200ms が本物の音から取れる長さ）。 */
const longLeadPcm = () =>
  concatInt16(silencePcm({ durationMs: 400 }), sinePcm({ freq: 440, durationMs: 480 }), silencePcm({ durationMs: 160 }));

/** WAV（44 byte ヘッダの canonical 形）→ Int16Array。 */
const wavSamples = (/** @type {Uint8Array} */ wav) => {
  const body = wav.slice(44);
  return new Int16Array(body.buffer, body.byteOffset, body.byteLength / 2);
};

test("ear-pipeline(local): whisper-server を起動せず・子プロセスの ready の後にマイクを開く・設定が子へ渡る", async () => {
  const local = makeFakeLocalStt();
  const h = makeHarness({
    pipelineOptions: {
      stt: { engine: "zipformer", local: { threads: 3, hotwords: ["チャッピー"], hotwordsScore: 2.5, modelsDir: "/m", client: { workerArgs: ["x"] } } },
      localSttFactory: local.factory
    }
  });
  await h.pipeline.start();
  try {
    assert.equal(h.record.serverOptions, null, "whisper-server は作らない");
    assert.notEqual(h.record.captureOptions, null);
    assert.equal(local.rec.options.engine, "zipformer");
    assert.equal(local.rec.options.threads, 3);
    assert.deepEqual(local.rec.options.hotwords, ["チャッピー"]);
    assert.equal(local.rec.options.hotwordsScore, 2.5);
    assert.equal(local.rec.options.modelsDir, "/m");
    assert.deepEqual(local.rec.options.workerArgs, ["x"]);
    assert.equal(h.pipeline.stats().sttEngine, "zipformer");
    const ready = h.record.diagnostics.find((d) => d.type === "localSttReady");
    assert.equal(ready.loadMs, 10);
    assert.equal(ready.hotwordsUsed, 1);
  } finally {
    await h.pipeline.dispose();
  }
  assert.equal(local.rec.disposed, true, "dispose で子プロセスを畳む");
});

test("ear-pipeline(local): 余白 = 本物の音を前に 200ms + 作り物の無音を前後に 300ms（転写の範囲はセグメンタのまま・audio_ctx なし）", async () => {
  const local = makeFakeLocalStt();
  const h = makeHarness({ pipelineOptions: { stt: { engine: "parakeet" }, localSttFactory: local.factory } });
  await h.pipeline.start();
  try {
    h.feed(longLeadPcm());
    await until(() => h.pipeline.transcriptBuffer.size() === 1, 3000, "transcript appended");
    const end = h.record.vadEvents.find((e) => e.type === "speechEnd");
    const call = h.record.transcribeCalls[0];
    assert.equal(call.opts, undefined, "audio_ctx は whisper だけ");
    const samples = wavSamples(call.wav);
    const expectMs = end.endMs - end.startMs + 200 + 2 * 300;
    assert.equal(samples.length, Math.round((expectMs / 1000) * 16000));
    // 前後 300ms は作り物の無音。
    const pad = 300 * 16;
    assert.ok(samples.subarray(0, pad).every((v) => v === 0));
    assert.ok(samples.subarray(samples.length - pad).every((v) => v === 0));
    // 前の余白 200ms のあとに発話の音が続く（余白の分だけ後ろにずれている）。
    assert.ok(samples.subarray(pad + 200 * 16, pad + 200 * 16 + 512).some((v) => v !== 0));
    // 転写の範囲はセグメンタの範囲（余白を含めない）。
    const entry = h.record.transcripts[0].entry;
    assert.equal(entry.startMs, end.startMs);
    assert.equal(entry.endMs, end.endMs);
  } finally {
    await h.pipeline.dispose();
  }
});

test("ear-pipeline(local): 余白は設定で変えられる（0 / 0 なら whisper と同じ長さ）・範囲外は既定", async () => {
  const local = makeFakeLocalStt();
  const h = makeHarness({
    pipelineOptions: { stt: { engine: "zipformer", local: { preRollMs: 0, silencePadMs: 0 } }, localSttFactory: local.factory }
  });
  await h.pipeline.start();
  try {
    h.feed(longLeadPcm());
    await until(() => h.pipeline.transcriptBuffer.size() === 1, 3000, "transcript appended");
    const end = h.record.vadEvents.find((e) => e.type === "speechEnd");
    assert.equal(Math.round(wavDurationSec(h.record.transcribeCalls[0].wav) * 1000), end.endMs - end.startMs);
  } finally {
    await h.pipeline.dispose();
  }

  const local2 = makeFakeLocalStt();
  const h2 = makeHarness({
    pipelineOptions: { stt: { engine: "zipformer", local: { preRollMs: 5000, silencePadMs: -1 } }, localSttFactory: local2.factory }
  });
  await h2.pipeline.start();
  try {
    h2.feed(longLeadPcm());
    await until(() => h2.pipeline.transcriptBuffer.size() === 1, 3000, "transcript appended");
    const end = h2.record.vadEvents.find((e) => e.type === "speechEnd");
    const ms = Math.round(wavDurationSec(h2.record.transcribeCalls[0].wav) * 1000);
    assert.equal(ms, end.endMs - end.startMs + 200 + 600, "範囲外は既定（200 / 300）");
  } finally {
    await h2.pipeline.dispose();
  }
});

test("ear-pipeline(local): 前の余白はストリームの先頭で切れる（無い音は作らない）", async () => {
  const local = makeFakeLocalStt();
  const h = makeHarness({ pipelineOptions: { stt: { engine: "zipformer" }, localSttFactory: local.factory } });
  await h.pipeline.start();
  try {
    h.feedUtterance(480); // 前の無音は 96ms だけ
    await until(() => h.pipeline.transcriptBuffer.size() === 1, 3000, "transcript appended");
    const end = h.record.vadEvents.find((e) => e.type === "speechEnd");
    assert.ok(end.startMs < 200);
    const ms = Math.round(wavDurationSec(h.record.transcribeCalls[0].wav) * 1000);
    assert.equal(ms, end.endMs + 600, "前の余白はストリームの先頭（0ms）まで");
    assert.equal(h.record.transcripts[0].entry.startMs, end.startMs);
  } finally {
    await h.pipeline.dispose();
  }
});

test("ear-pipeline(whisper): ローカルの余白の設定は whisper には効かない（今のまま）", async () => {
  const h = makeHarness({ pipelineOptions: { stt: { engine: "whisper", local: { preRollMs: 500, silencePadMs: 500 } } } });
  await h.pipeline.start();
  try {
    h.feed(longLeadPcm());
    await until(() => h.pipeline.transcriptBuffer.size() === 1, 3000, "transcript appended");
    const end = h.record.vadEvents.find((e) => e.type === "speechEnd");
    assert.equal(Math.round(wavDurationSec(h.record.transcribeCalls[0].wav) * 1000), end.endMs - end.startMs);
    assert.equal(typeof h.record.transcribeCalls[0].opts.audioCtx, "number");
  } finally {
    await h.pipeline.dispose();
  }
});

test("ear-pipeline(local): VAD の合図（speechStart / speechEnd の時刻）はエンジンによらず同じ", async () => {
  /** @param {any} pipelineOptions */
  const run = async (pipelineOptions) => {
    const h = makeHarness({ pipelineOptions });
    await h.pipeline.start();
    try {
      h.feed(longLeadPcm());
      await until(() => h.pipeline.transcriptBuffer.size() === 1, 3000, "transcript appended");
      return h.record.vadEvents.map((e) => ({ type: e.type, tMs: e.tMs, startMs: e.startMs, endMs: e.endMs }));
    } finally {
      await h.pipeline.dispose();
    }
  };
  const whisper = await run({});
  const local = await run({ stt: { engine: "zipformer" }, localSttFactory: makeFakeLocalStt().factory });
  assert.deepEqual(local, whisper);
});

test("ear-pipeline(local): transcribeImpl 未指定なら子プロセスの係の transcribe を使う（遅延の物差しは whisper の経路のまま）", async () => {
  const local = makeFakeLocalStt();
  const record = { /** @type {any} */ captureOptions: null };
  /** @type {any[]} */
  const transcripts = [];
  const pipeline = createEarPipeline({
    segmenter: { minSpeechMs: 100, minSilenceMs: 64, speechPadMs: 0 },
    stt: { engine: "zipformer" },
    localSttFactory: local.factory,
    captureFactory: /** @type {any} */ (
      (/** @type {any} */ o) => {
        record.captureOptions = o;
        return { dispose() {} };
      }
    ),
    vadFactory: /** @type {any} */ (
      () => ({
        async init() {},
        async process(/** @type {Float32Array} */ f) {
          let s = 0;
          for (let i = 0; i < f.length; i += 1) s += f[i] * f[i];
          return Math.sqrt(s / f.length) > 0.1 ? 0.9 : 0.05;
        },
        reset() {},
        async dispose() {}
      })
    ),
    onTranscript: (entry, meta) => transcripts.push({ entry, meta })
  });
  await pipeline.start();
  try {
    record.captureOptions.onPcm(int16ToBytesLE(longLeadPcm()));
    await until(() => transcripts.length === 1, 3000, "transcript");
    assert.equal(local.rec.wavs.length, 1);
    assert.equal(transcripts[0].entry.text, "ローカル1");
    assert.equal(typeof transcripts[0].meta.latencyMs, "number");
    assert.equal(transcripts[0].meta.audioCtx, null);
  } finally {
    await pipeline.dispose();
  }
});

test("ear-pipeline(local): 子プロセスの runtime 死 → localSttDown + 以後の発話は skip・VAD イベントは生き続ける", async () => {
  const local = makeFakeLocalStt();
  const h = makeHarness({ pipelineOptions: { stt: { engine: "zipformer" }, localSttFactory: local.factory } });
  await h.pipeline.start();
  try {
    local.rec.options.onExit({ code: 3221225477, signal: null });
    const down = h.record.diagnostics.find((d) => d.type === "localSttDown");
    assert.deepEqual(down, { type: "localSttDown", phase: "runtime", engine: "zipformer", code: 3221225477, signal: null });
    h.feedUtterance(200);
    await until(() => h.record.diagnostics.some((d) => d.type === "asrSkipped"), 3000, "asrSkipped diag");
    assert.equal(h.record.diagnostics.find((d) => d.type === "asrSkipped").reason, "localSttDown");
    assert.ok(h.record.vadEvents.some((e) => e.type === "speechStart"));
    assert.equal(h.record.transcribeCalls.length, 0);
    assert.equal(h.pipeline.stats().asrDown, true);
  } finally {
    await h.pipeline.dispose();
  }
});

test("ear-pipeline(local): ready の失敗（モデル読み込みの失敗）は start の reject・マイクは開かず畳む", async () => {
  const local = makeFakeLocalStt({ readyError: new Error("local STT (zipformer) failed to load: bad model") });
  const h = makeHarness({ pipelineOptions: { stt: { engine: "zipformer" }, localSttFactory: local.factory } });
  await assert.rejects(() => h.pipeline.start(), /failed to bring up ears.*bad model/);
  assert.equal(h.pipeline.isDisposed(), true);
  assert.equal(h.record.captureOptions, null);
  assert.equal(h.record.disposed.vad, true);
  assert.equal(local.rec.disposed, true);
});
