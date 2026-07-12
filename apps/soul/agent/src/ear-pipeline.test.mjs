// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createEarPipeline, EAR_DEFAULTS } from "./ear-pipeline.mjs";
import { sinePcm, silencePcm, concatInt16, int16ToBytesLE } from "./fixtures-audio.mjs";
import { wavDurationSec } from "./wav-duration.mjs";

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
