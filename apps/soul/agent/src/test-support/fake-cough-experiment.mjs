// @ts-check
/**
 * 咳払いの聞き取り実験のテスト用の偽物 — apps/soul/agent。
 *  - 偽物の sherpa（OfflineRecognizer + AudioTagging・受け取ったサンプルの長さと設定を記録する）
 *  - 同じプロセスの中で実験の子の中身（cough-experiment-worker-core.mjs）を動かす偽物の fork（本物の sherpa・本物の
 *    子プロセスは使わない。IPC の往復は structuredClone で写す = advanced serialization と同じく Int16Array が通る）
 *  - 偽物のマイク（captureFactory）と、音の大きさで決める偽物の VAD
 */

import { EventEmitter } from "node:events";
import { createCoughExperimentWorkerCore, parseTaggerArgs } from "../../scripts/cough-experiment-worker-core.mjs";

/** 偽物の tokens.txt（hotwords の既定「チャッピー」「コーディ」を表せる）。 */
export const FAKE_TOKENS = "<blk> 0\nチ 1\nャ 2\nッ 3\nピ 4\nー 5\nコ 6\nデ 7\nィ 8\nう 9\nん 10\n";

/** 偽物の class_labels_indices.csv（見出し + 527 行）。 */
export const FAKE_LABELS_CSV = [
  "index,mid,display_name",
  ...Array.from({ length: 527 }, (_, i) => `${i},/m/${i},"label ${i}"`)
].join("\n");

/**
 * @param {{
 *   textFor?: (samples: Float32Array) => string;
 *   eventsFor?: (samples: Float32Array) => Array<{ name: string; prob: number; index: number }>;
 *   throwOnTaggerCreate?: Error | null;
 *   throwOnCompute?: Error | null;
 * }} [opts]
 */
export function makeFakeSherpaWithTagging(opts = {}) {
  const rec = {
    /** @type {any[]} */ recognizerConfigs: [],
    /** @type {any[]} */ taggerConfigs: [],
    /** @type {number[]} */ recognizedLengths: [],
    /** @type {number[]} */ taggedLengths: [],
    /** @type {Float32Array[]} */ taggedSamples: [],
    /** @type {number[]} */ computeTopK: []
  };
  const textFor = opts.textFor ?? (() => "うん");
  const eventsFor =
    opts.eventsFor ??
    (() => [
      { name: "Throat clearing", prob: 0.44, index: 48 },
      { name: "Speech", prob: 0.31, index: 0 },
      { name: "Cough", prob: 0.02, index: 47 }
    ]);
  const makeStream = () => {
    const s = { samples: /** @type {Float32Array | null} */ (null), sampleRate: 0 };
    return {
      /** @param {{ samples: Float32Array; sampleRate: number }} w */
      acceptWaveform(w) {
        s.samples = w.samples;
        s.sampleRate = w.sampleRate;
      },
      _s: s
    };
  };
  class OfflineRecognizer {
    /** @param {any} config */
    constructor(config) {
      rec.recognizerConfigs.push(config);
    }
    createStream() {
      return makeStream();
    }
    /** @param {any} stream */
    async decodeAsync(stream) {
      rec.recognizedLengths.push(stream._s.samples.length);
      return { text: textFor(stream._s.samples) };
    }
  }
  class AudioTagging {
    /** @param {any} config */
    constructor(config) {
      if (opts.throwOnTaggerCreate) throw opts.throwOnTaggerCreate;
      rec.taggerConfigs.push(config);
    }
    createStream() {
      return makeStream();
    }
    /** @param {any} stream @param {number} topK */
    compute(stream, topK) {
      if (opts.throwOnCompute) throw opts.throwOnCompute;
      rec.computeTopK.push(topK);
      rec.taggedLengths.push(stream._s.samples.length);
      rec.taggedSamples.push(stream._s.samples);
      return eventsFor(stream._s.samples);
    }
  }
  return { sherpa: { OfflineRecognizer, AudioTagging }, rec };
}

/**
 * 同じプロセスの中で実験の子の中身を動かす偽物の fork。
 * @param {any} sherpa
 */
export function makeInProcessFork(sherpa) {
  const rec = {
    /** @type {Array<{ modulePath: string; args: string[]; opts: any }>} */ calls: [],
    /** @type {any[]} */ toChild: [],
    /** @type {any[]} */ fromChild: [],
    killed: 0
  };
  const forkImpl = (/** @type {string} */ modulePath, /** @type {string[]} */ args, /** @type {any} */ opts) => {
    rec.calls.push({ modulePath, args, opts });
    const child = /** @type {any} */ (new EventEmitter());
    child.stdout = null;
    child.stderr = null;
    child.connected = true;
    let alive = true;
    const core = createCoughExperimentWorkerCore({
      loadSherpa: () => sherpa,
      readTextFile: (p) => (p.endsWith("tokens.txt") ? FAKE_TOKENS : FAKE_LABELS_CSV),
      tagger: parseTaggerArgs(args),
      send: (m) => {
        const copy = structuredClone(m);
        rec.fromChild.push(copy);
        setImmediate(() => {
          if (alive) child.emit("message", copy);
        });
      },
      exit: (code) =>
        setImmediate(() => {
          alive = false;
          child.emit("exit", code, null);
        })
    });
    child.send = (/** @type {any} */ m) => {
      const copy = structuredClone(m);
      rec.toChild.push(copy);
      setImmediate(() => {
        if (alive) void core.handle(copy);
      });
      return true;
    };
    child.kill = () => {
      rec.killed += 1;
      alive = false;
    };
    child.disconnect = () => {
      child.connected = false;
    };
    child.unref = () => {};
    return child;
  };
  return { forkImpl: /** @type {any} */ (forkImpl), rec };
}

/** 偽物のマイク（onPcm を握る）。 */
export function makeFakeCapture() {
  const rec = { /** @type {any} */ options: null, disposed: false };
  const captureFactory = (/** @type {any} */ opts) => {
    rec.options = opts;
    return {
      restartCount: () => 0,
      isDisposed: () => rec.disposed,
      currentChild: () => null,
      dispose: () => {
        rec.disposed = true;
      }
    };
  };
  return { captureFactory, rec };
}

/** 音の大きさで決める偽物の VAD（RMS > 0.1 → 0.9 / それ以外 0.05）。 */
export function fakeVadFactory() {
  return {
    modelPath: "(fake)",
    frameSamples: 512,
    async init() {},
    /** @param {Float32Array} frame */
    async process(frame) {
      let sum = 0;
      for (let i = 0; i < frame.length; i += 1) sum += frame[i] * frame[i];
      return Math.sqrt(sum / frame.length) > 0.1 ? 0.9 : 0.05;
    },
    reset() {},
    async dispose() {}
  };
}
