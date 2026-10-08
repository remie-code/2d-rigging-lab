// @ts-check
/**
 * 発話同期オーケストレーション（S1 Domain B）— apps/soul/agent。一文 → 口 + 声。
 *
 * 一文を受け取り、TTS で声を合成しつつ器へ口の動き（intent.speech timeline）を送り、両者を
 * 同期して開始させる。S1 の歩くスケルトンの縦串の一区間（Domain C の LLM 応答文 → ここ →
 * 器の口 + スピーカー）。
 *
 * ── パイプライン ───────────────────────────────────────────────────────
 *   1. `/audio_query` で moras 平坦化列 + prePhonemeSec/postPhonemeSec を得る（tts-client）。
 *   2. `/synthesis` で WAV バイト列を得る。
 *   3. `wavDurationSec(wav)` で WAV 実長を測る（Domain A 純関数の再利用）。
 *   4. `buildSpeechTimeline(moras, wavSec, pre, post, sConfig)` で timeline を組む
 *      （Domain A 純関数の再利用。timeMs は WAV 実時間軸・先頭無音 pre 込み）。
 *   5. WAV を temp ファイルに書き出しておく（再生を最速化するため送出前に準備）。
 *   6. channel へ intent.speech を送る。
 *   7. **accepted を受けた瞬間に player.play(wavPath)** — 器の口が動き始めた t=0 に声を合わせる。
 *      WAV 先頭 0.1s の無音が器の口の立ち上がり（attack）と概ね相殺する（同期方式・§3 Domain B）。
 *
 * ── 失敗の扱い ─────────────────────────────────────────────────────────
 *   - rejected: throw（呼び出し側が拾う）。接続は閉じない（維持したまま次の一文を試せる）。
 *   - timeline 512 超: buildSpeechTimeline がそのまま throw（S1 は文分割しない・裁定4）。
 */

import { wavDurationSec } from "./wav-duration.mjs";
import { buildSpeechTimeline } from "./mora-timeline.mjs";
import { parseAudioQuery, createTtsClient } from "./tts-client.mjs";
import { writeOwnedTempWav } from "./audio-player.mjs";
import { performance } from "node:perf_hooks";

/**
 * 一文の TTS/timeline/WAV を準備する。Channel 送出と再生は行わない。
 *
 * @param {string} text  合成・発話する一文。
 * @param {object} deps
 * @param {{ audioQuery: (text: string) => Promise<any>; synthesis: (query: any) => Promise<Uint8Array> }} [deps.tts]
 *   TTS クライアント。省略時は ttsBaseUrl/speaker から生成。
 * @param {string} [deps.ttsBaseUrl]  tts 省略時のベース URL。
 * @param {number|string} [deps.speaker]  tts 省略時の話者 ID。
 * @param {undefined | { vowelMap?: Record<string, number> }} [deps.sConfig]  母音別 s の差し替え。
 * @param {(bytes: Uint8Array) => string} [deps.writeWav]  WAV → temp パス（テスト差し替え用）。既定 writeTempWav。
 * @param {() => number} [deps.nowImpl]  再生開始時刻の時計（既定 Date.now）。テストで決定論固定するための注入点。
 * @param {(event: string, fields?: Record<string, unknown>) => void} [deps.onTrace] passive diagnostic hook (no bodies).
 * @returns {Promise<{
 *   timeline: Array<{ timeMs: number; vowel: string; s: number }>;
 *   wavDurationSec: number;
 *   wavPath: string;
 *   rawMoraCount: number;
 *   wavBytes: number | null;
 *   speechChars: number;
 *   cleanup: (() => boolean) | null;
 *   ownedTempDirectory: string | null;
 * }>}
 * @throws {Error} timeline 過大 / TTS・合成・WAV書出しの失敗。
 */
export async function prepareSpeech(text, deps) {
  if (typeof text !== "string" || text.length === 0) {
    throw new TypeError("speak(text): text must be a non-empty string.");
  }
  if (deps == null || typeof deps !== "object") {
    throw new TypeError("speak(text, deps): deps is required.");
  }
  const { sConfig } = deps;
  const tts =
    deps.tts ??
    createTtsClient({ baseUrl: deps.ttsBaseUrl, speaker: deps.speaker });
  const trace = (event, fields = {}) => {
    if (typeof deps.onTrace !== "function") return;
    try {
      deps.onTrace(event, fields);
    } catch {
      // Diagnostic failures must not affect speech.
    }
  };

  // 1. audio_query → moras 平坦化 + pre/post 無音秒。
  let query;
  try {
    const startedAt = performance.now();
    trace("tts.audio_query.started", { speechChars: text.length });
    query = await tts.audioQuery(text);
    trace("tts.audio_query.request_completed", { durationMs: performance.now() - startedAt });
  } catch (error) {
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
  let wav;
  try {
    const startedAt = performance.now();
    trace("tts.synthesis.started", { rawMoraCount: moras.length });
    wav = await tts.synthesis(query);
    trace("tts.synthesis.request_completed", { durationMs: performance.now() - startedAt });
  } catch (error) {
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

  // 4. timeline（WAV 実時間軸・pre 込み）。512 超はここで throw（伝播）。
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

  // 5. WAV を temp に書き出しておく（accepted 直後の play を最速化）。
  let wavPath;
  let cleanup = null;
  let ownedTempDirectory = null;
  try {
    if (typeof deps.writeWav === "function") {
      wavPath = deps.writeWav(wav);
    } else {
      const owned = writeOwnedTempWav(wav);
      wavPath = owned.wavPath;
      ownedTempDirectory = owned.ownedDirectory;
      cleanup = owned.cleanup;
    }
  } catch (error) {
    const failure = withDiagnostic(error, "speech_wav_write_failed", "speech.wav.write");
    trace("speech.wav.write.failed", { wavBytes, failureName: failure.name, failureCode: failure.code });
    throw failure;
  }

  return {
    timeline,
    wavDurationSec: wavSec,
    wavPath,
    rawMoraCount: moras.length,
    wavBytes,
    speechChars: text.length,
    cleanup,
    ownedTempDirectory
  };
}

/**
 * Activate one already-prepared speech artifact. This is the Wave 2 queue
 * boundary: only the FIFO-active job calls it, awaits Control Channel
 * acceptance, and then starts the matching Soul WAV.
 *
 * @param {{ timeline: Array<any>; wavDurationSec: number; wavPath: string; rawMoraCount?: number; wavBytes?: number | null; speechChars?: number }} artifact
 * @param {object} deps
 * @param {{ sendSpeech: (timeline: unknown) => Promise<{ result: string; error: unknown; rttMs: number }> }} deps.channel
 * @param {{ play: (wavPath: string) => void }} deps.player
 * @param {() => number} [deps.nowImpl]
 * @param {(event: string, fields?: Record<string, unknown>) => void} [deps.onTrace]
 */
export async function activatePreparedSpeech(artifact, deps) {
  if (!artifact || typeof artifact !== "object" || !Array.isArray(artifact.timeline) || typeof artifact.wavPath !== "string") {
    throw new TypeError("activatePreparedSpeech(artifact): prepared speech artifact is required.");
  }
  if (deps == null || typeof deps !== "object") {
    throw new TypeError("activatePreparedSpeech(artifact, deps): deps is required.");
  }
  const { channel, player } = deps;
  if (!channel || typeof channel.sendSpeech !== "function") {
    throw new TypeError("deps.channel with sendSpeech() is required.");
  }
  if (!player || typeof player.play !== "function") {
    throw new TypeError("deps.player with play() is required.");
  }
  const nowImpl = deps.nowImpl ?? Date.now;
  const trace = (event, fields = {}) => {
    if (typeof deps.onTrace !== "function") return;
    try {
      deps.onTrace(event, fields);
    } catch {
      // Diagnostic failures must not affect speech.
    }
  };

  // 6. intent.speech を送出。
  let outcome;
  try {
    outcome = await channel.sendSpeech(artifact.timeline);
  } catch (error) {
    const failure = withDiagnostic(error, "channel_request_failed", "control_channel.reply");
    trace("speech.channel.failed", {
      timelineCount: artifact.timeline.length,
      failureName: failure.name,
      failureCode: failure.code,
      failureStage: failure.diagnosticStage
    });
    throw failure;
  }

  // 7. accepted → 即再生。rejected は throw（接続は維持）。
  if (outcome.result !== "accepted") {
    trace("speech.channel.rejected", { timelineCount: artifact.timeline.length, result: outcome.result });
    const detail =
      outcome.error && typeof outcome.error === "object"
        ? `${/** @type {any} */ (outcome.error).code ?? "unknown"}: ${
            /** @type {any} */ (outcome.error).message ?? ""
          }`
        : String(outcome.error ?? outcome.result);
    throw diagnosticError(`intent.speech rejected: ${detail}`, "speech_rejected", "control_channel.rejection");
  }
  player.play(artifact.wavPath);
  trace("player.play.enqueued", {
    timelineCount: artifact.timeline.length,
    wavBytes: artifact.wavBytes ?? null,
    wavDurationSec: artifact.wavDurationSec
  });
  // 声が鳴り始めた t=0（accepted 直後に play を送出した瞬間）。barge-in の切断点算出材料。
  const playbackStartedAtMs = nowImpl();

  return {
    rttMs: outcome.rttMs,
    playbackStartedAtMs,
    requestId: typeof outcome.requestId === "string" ? outcome.requestId : null,
    serializedUtf8Bytes:
      typeof outcome.serializedUtf8Bytes === "number" ? outcome.serializedUtf8Bytes : null
  };
}

export async function speak(text, deps) {
  const artifact = await prepareSpeech(text, deps);
  const activated = await activatePreparedSpeech(artifact, deps);
  return {
    timeline: artifact.timeline,
    wavDurationSec: artifact.wavDurationSec,
    wavPath: artifact.wavPath,
    rttMs: activated.rttMs,
    playbackStartedAtMs: activated.playbackStartedAtMs
  };
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
  return diagnosticError(String(error), code, diagnosticStage);
}
