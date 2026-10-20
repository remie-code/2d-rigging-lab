// @ts-check
/**
 * AivisSpeech の声の差し替え口（声の差し替え Wave 2 Domain C）— apps/soul/agent。
 *
 * 旧 `speak.mjs` の `prepareSpeech` の 1〜4 を VoiceEngine の形（wave-plan §0）に包み直したもの。
 * AivisSpeech は文を 1 回で全部返すので、「1 回で全部届く流し込み」として
 * format → timeline → audio（WAV の PCM 部）→ end を一度に出す（時間割を音より先にして、器への append が
 * 音より先に届くようにする）。
 *
 * ── パイプライン（旧 prepareSpeech と同じ順・同じ時間割）──────────────────────────
 *   1. `/audio_query` で moras 平坦化列 + prePhonemeSec/postPhonemeSec を得る（tts-client）。
 *   2. `/synthesis` で WAV バイト列を得る。
 *   3. `wavDurationSec(wav)` で WAV 実長を測る。
 *   4. `buildSpeechTimeline(moras, wavSec, pre, post, sConfig)` で口の時間割を組む（WAV 全体の長さを
 *      モーラ数で均等割り。timeMs は WAV 先頭からの通し値＝音声先頭からの通し値）。
 *   5. WAV から PCM 部分を取り出す（サンプルレート・チャンネル数はヘッダから）。一時 WAV は作らない。
 *
 * ── 診断（本文を含まない）───────────────────────────────────────────────
 *  onTrace へ旧 prepareSpeech と同じ名前（`tts.audio_query.*` / `tts.synthesis.*` / `speech.wav.inspect.*` /
 *  `speech.timeline.*`）で流す。失敗は旧と同じ code / diagnosticStage を付けて投げる。遅延の計測は
 *  engine に依存しない名前で SpeechStreamer が出す（ここの名前は AivisSpeech の内訳の診断用）。
 *
 * ── 中止 ───────────────────────────────────────────────────────────────
 *  `signal` を fetch へ渡し、段の合間でも見る。中止されたら `AbortError`（code `voice_synthesis_aborted`）。
 */

import { performance } from "node:perf_hooks";

import { createTtsClient, parseAudioQuery } from "../tts-client.mjs";
import { wavDurationSec } from "../wav-duration.mjs";
import { readWavPcm } from "../wav-pcm.mjs";
import { buildSpeechTimeline } from "../mora-timeline.mjs";
import { createEngineStatusCell } from "./engine-status.mjs";

/**
 * @param {object} [deps]
 * @param {{ audioQuery: (text: string, options?: { signal?: AbortSignal }) => Promise<any>; synthesis: (query: any, options?: { signal?: AbortSignal }) => Promise<Uint8Array> }} [deps.tts]
 *   TTS クライアント。省略時は ttsBaseUrl/speaker から生成。
 * @param {string} [deps.ttsBaseUrl]  tts 省略時のベース URL。
 * @param {number|string} [deps.speaker]  tts 省略時の話者 ID。
 * @param {undefined | { vowelMap?: Record<string, number> }} [deps.sConfig]  母音別 s の差し替え。
 * @returns {import("./voice-engine.mjs").VoiceEngine}
 */
export function createAivisVoiceEngine(deps = {}) {
  const tts = deps.tts ?? createTtsClient({ baseUrl: deps.ttsBaseUrl, speaker: deps.speaker });
  const sConfig = deps.sConfig;
  // HTTP をその都度叩くだけなので、つなぎっぱなしの接続は持たない（常に up・dispose で down）。
  const status = createEngineStatusCell("up");
  let disposed = false;

  return {
    kind: "aivis",
    get status() {
      return status.get();
    },
    onStatus: (listener) => status.onStatus(listener),
    synthesize(text, options = {}) {
      if (typeof text !== "string" || text.length === 0) {
        throw new TypeError("synthesize(text): text must be a non-empty string.");
      }
      if (disposed) throw new Error("aivis voice engine already disposed.");
      return synthesizeOnce(text, { tts, sConfig, signal: options.signal, onTrace: options.onTrace });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      status.set("down");
      status.clear();
    }
  };
}

/**
 * @param {string} text
 * @param {{ tts: any; sConfig: any; signal?: AbortSignal; onTrace?: (event: string, fields?: Record<string, unknown>) => void }} ctx
 * @returns {AsyncGenerator<import("./voice-engine.mjs").VoiceChunk>}
 */
async function* synthesizeOnce(text, ctx) {
  const { tts, sConfig, signal } = ctx;
  const trace = (/** @type {string} */ event, /** @type {Record<string, unknown>} */ fields = {}) => {
    if (typeof ctx.onTrace !== "function") return;
    try {
      ctx.onTrace(event, fields);
    } catch {
      // Diagnostic failures must not affect speech.
    }
  };
  const requestOptions = signal ? { signal } : {};

  // 1. audio_query → moras 平坦化 + pre/post 無音秒。
  throwIfAborted(signal);
  let query;
  try {
    const startedAt = performance.now();
    trace("tts.audio_query.started", { speechChars: text.length });
    query = await tts.audioQuery(text, requestOptions);
    trace("tts.audio_query.request_completed", { durationMs: performance.now() - startedAt });
  } catch (error) {
    throwIfAborted(signal);
    const failure = withDiagnostic(error, "tts_audio_query_failed", "tts.audio_query");
    trace("tts.audio_query.failed", { failureName: failure.name, failureCode: failure.code });
    throw failure;
  }
  let moras;
  let prePhonemeSec;
  let postPhonemeSec;
  try {
    ({ moras, prePhonemeSec, postPhonemeSec } = parseAudioQuery(query));
  } catch (error) {
    const failure = withDiagnostic(error, "tts_audio_query_invalid", "tts.audio_query.parse");
    trace("tts.audio_query.parse.failed", { failureName: failure.name, failureCode: failure.code });
    throw failure;
  }
  trace("tts.audio_query.completed", { rawMoraCount: moras.length, prePhonemeSec, postPhonemeSec });

  // 2. synthesis → WAV バイト列。
  throwIfAborted(signal);
  let wav;
  try {
    const startedAt = performance.now();
    trace("tts.synthesis.started", { rawMoraCount: moras.length });
    wav = await tts.synthesis(query, requestOptions);
    trace("tts.synthesis.request_completed", { durationMs: performance.now() - startedAt });
  } catch (error) {
    throwIfAborted(signal);
    const failure = withDiagnostic(error, "tts_synthesis_failed", "tts.synthesis");
    trace("tts.synthesis.failed", { failureName: failure.name, failureCode: failure.code });
    throw failure;
  }
  const wavBytes = wav && typeof wav === "object" && typeof wav.byteLength === "number" ? wav.byteLength : null;
  trace("tts.synthesis.completed", { wavBytes });

  // 3. WAV 実長。
  let wavSec;
  try {
    wavSec = wavDurationSec(wav);
  } catch (error) {
    const failure = withDiagnostic(error, "speech_wav_invalid", "speech.wav.inspect");
    trace("speech.wav.inspect.failed", { wavBytes, failureName: failure.name, failureCode: failure.code });
    throw failure;
  }

  // 4. 口の時間割（WAV 実時間軸・pre 込み）。発話全体の上限 4096 超はここで throw（伝播）。器へは
  //    SpeechStreamer が 1 回 512 要素以下に分けて append する。
  let timeline;
  try {
    const startedAt = performance.now();
    trace("speech.timeline.started", { rawMoraCount: moras.length, wavBytes, wavDurationSec: wavSec });
    ({ timeline } = buildSpeechTimeline(moras, wavSec, prePhonemeSec, postPhonemeSec, sConfig));
    trace("speech.timeline.build_completed", { durationMs: performance.now() - startedAt });
  } catch (error) {
    const failure = withDiagnostic(error, "timeline_build_failed", "speech.timeline.build");
    trace("speech.timeline.failed", {
      rawMoraCount: moras.length,
      wavBytes,
      wavDurationSec: wavSec,
      failureName: failure.name,
      failureCode: failure.code
    });
    throw failure;
  }
  trace("speech.timeline.built", {
    rawMoraCount: moras.length,
    timelineCount: timeline.length,
    wavBytes,
    wavDurationSec: wavSec
  });

  // 5. PCM 部分（サンプルレート・チャンネル数は WAV ヘッダから）。
  let pcm;
  try {
    pcm = readWavPcm(/** @type {Uint8Array} */ (wav));
  } catch (error) {
    const failure = withDiagnostic(error, "speech_wav_invalid", "speech.wav.inspect");
    trace("speech.wav.inspect.failed", { wavBytes, failureName: failure.name, failureCode: failure.code });
    throw failure;
  }

  throwIfAborted(signal);
  // 口の時間割を音より先に出す（器へ append が音より先に届き、データ切れで口形が跳ばない・申し送り 2）。
  yield { type: "format", sampleRate: pcm.sampleRate, channels: pcm.channels };
  yield { type: "timeline", entries: timeline };
  if (pcm.pcm.byteLength > 0) yield { type: "audio", pcm: pcm.pcm };
  yield { type: "end" };
}

/** @param {AbortSignal | undefined} signal */
function throwIfAborted(signal) {
  if (!signal || !signal.aborted) return;
  const error = new Error("voice synthesis aborted.");
  error.name = "AbortError";
  /** @type {any} */ (error).code = "voice_synthesis_aborted";
  /** @type {any} */ (error).diagnosticStage = "voice.synthesis.abort";
  throw error;
}

/** @param {string} message @param {string} code @param {string} diagnosticStage */
function diagnosticError(message, code, diagnosticStage) {
  const error = new Error(message);
  /** @type {any} */ (error).code = code;
  /** @type {any} */ (error).diagnosticStage = diagnosticStage;
  return error;
}

/** @param {unknown} error @param {string} code @param {string} diagnosticStage */
function withDiagnostic(error, code, diagnosticStage) {
  if (error instanceof Error) {
    if (typeof /** @type {any} */ (error).code !== "string") /** @type {any} */ (error).code = code;
    if (typeof /** @type {any} */ (error).diagnosticStage !== "string") {
      /** @type {any} */ (error).diagnosticStage = diagnosticStage;
    }
    return /** @type {any} */ (error);
  }
  return /** @type {any} */ (diagnosticError(String(error), code, diagnosticStage));
}
