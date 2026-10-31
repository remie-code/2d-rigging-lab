// @ts-check
/**
 * 発話の運び手（SpeechStreamer・声の差し替え Wave 2 Domain C）— apps/soul/agent。
 *
 * 合意: discussion/ai-cohost/implementation/orchestration/voice-swap-wave-plan.md §0・§2・「Wave 1 からの申し送り」。
 * 旧 `progressive-speech-delivery.mjs` + `tts-playback-coordinator.mjs` + `speak.mjs` の activate を
 * 1 つにまとめ、声の差し替え口（VoiceEngine）・流し込みプレイヤー（stream-player.mjs）・器の
 * `intent.speechStream`（channel-client の openSpeech/appendSpeech/endSpeech）の上に載せ直したもの。
 * Codex の文ごとの読み上げも、Claude の一括の読み上げ（1 文だけの列 = {@link speakOnce}）も、ここを通る。
 *
 * ── 1 世代（= 1 Fire）の流れ ────────────────────────────────────────────────
 *  - `enqueue(文)` のたびに engine.synthesize を始める（次の文は前の文が鳴っている間に裏で溜めてよい）。
 *  - 再生は FIFO で 1 本ずつ。準備の終わる順が前後しても、鳴らす順は enqueue 順のまま。
 *  - 鳴らす番が来て、形式（format）と最初の音（または end）が揃ったら:
 *      器へ openSpeech → accepted を受けたら player.open → 溜めた口の時間割を appendSpeech（音より先）→
 *      溜めた音を player.write → 続きも届くたびに同じ順で流す → engine の end で player.end + endSpeech。
 *  - 器は任意（配信の組み直し Domain C・stream-restructure.md §4）。体の無いロールでは channel を渡さない。
 *    そのときは器への送信（openSpeech / appendSpeech / endSpeech）と口の release をすべて飛ばし、
 *    鳴らす番が来たらすぐ player.open して手元の再生器だけで鳴らす。時間割は器が無くても engine から受け取って
 *    貯める（割り込みの「どこまで声に出たか」の材料・snapshot()）。
 *  - player の STARTED（実際に鳴り始めた）で「声が出た」、ENDED（全部鳴り終わった）でその文を完了にし、
 *    次の文へ進む。STOPPED / ERROR / 異常終了・タイムアウトは世代全体を閉じる。
 *
 * ── 約束（申し送り 2〜4）─────────────────────────────────────────────────────
 *  - openSpeech は、その文を鳴らす番が来てから送る（前の文の再生中に送ると前の口を早く置き換える）。
 *  - 器は古い id の append/end にも accepted を返すので、accepted を「効いた」と読まない。どの発話が
 *    今のものかは自分の FIFO（`active`）だけで決める。
 *  - どの終わり方でも、開けた口を開けっぱなしにしない。自然に終わる経路は endSpeech を送る。
 *    中断・失敗・dispose の経路は player.stop のあと口の release（mouth-open=0）を送る（`releaseMouth`）。
 *    endSpeech が届かなかったときも、鳴り終わりで release を送る。
 *  - 口の t=0 は器が open を受理した時刻。声は player.open のあと鳴り始める（ずれは今と同程度）。
 *    器が無いときは口が無いので t=0 も無い。player.open は鳴らす番が来た時点で呼ぶ。割り込みの切断点は
 *    器の有無に関係なく、時間割と player の STARTED の時刻から求める（fire-orchestrator の computeSpokenPrefix）。
 *
 * ── 割り込み・キル ─────────────────────────────────────────────────────────
 *  `bargeIn()`（最初の STARTED の後だけ効く）/ `kill()` / `dispose()` / `abort(cause)`: 世代を閉じ、鳴っている
 *  文の player.stop（同期）→ 口の release、すべての文の synthesize に signal で中止を伝える。
 *
 * ── 遅延の計測（engine に依存しない名前・fire-latency.mjs）──────────────────────────
 *  `voice.synthesis.requested`（engine に頼んだ）→ `voice.audio.first_chunk`（最初の音のかたまり）→
 *  `voice.player.started`（STARTED）。どれも jobId（`<generationId>:sentence-<n>`）付き・本文なし。
 */

import { isVoiceEngine } from "./engines/voice-engine.mjs";
import { MOUTH_CLOSE_SLOT_ID, MOUTH_CLOSE_TTL_MS } from "../mind/barge-in.mjs";

/** STARTED を待つ上限（最初の音を書いてから）。 */
export const DEFAULT_PLAYBACK_START_TIMEOUT_MS = 5000;
/** ENDED を待つ余裕（STARTED + 音の長さ + この値）。 */
export const DEFAULT_PLAYBACK_COMPLETION_MARGIN_MS = 750;
/** 器の intent.speechStream append 1 回の上限（契約）。 */
export const SPEECH_STREAM_APPEND_MAX_ITEMS = 512;

/** 意図した中止（失敗ではない）。 */
const CANCEL_CAUSES = new Set(["killed", "barge-in", "disposed"]);

let nextStreamerSerial = 0;
let nextGenerationNumber = 0;

/**
 * @typedef {{
 *   generationId: string;
 *   status: "open" | "completed" | "cancelled" | "failed";
 *   terminalCause: string | null;
 *   llmCompleted: boolean;
 *   enqueuedSentenceCount: number;
 *   completedSentenceCount: number;
 *   playedText: string;
 *   hasAudiblyStarted: boolean;
 *   playedChunks: Array<{ jobId: string; index: number; text: string; playbackId: string | null }>;
 *   activePlaybackId: string | null;
 *   active: null | { jobId: string; index: number; playbackId: string; started: boolean; startedAtMs: number | null; timeline: Array<{ timeMs: number; vowel: string; s: number }> };
 *   stoppedActive: null | { jobId: string; index: number; playbackId: string; started: boolean; startedAtMs: number | null; timeline: Array<{ timeMs: number; vowel: string; s: number }>; stoppedAtMs: number };
 *   queuedJobIds: string[];
 * }} SpeechStreamerSnapshot
 */

/**
 * 1 世代の発話の運び手を作る。
 *
 * @param {object} options
 * @param {import("./engines/voice-engine.mjs").VoiceEngine} options.engine  声の差し替え口。
 * @param {{ open: Function; write: Function; end: Function; stop: Function; onEvent: (listener: (event: any) => void) => () => void }} options.player
 *   流し込みプレイヤー（stream-player.mjs の createStreamPlayer の返り、または同じ形）。
 * @param {{ openSpeech: Function; appendSpeech: Function; endSpeech: Function; sendSet?: Function } | null} [options.channel]
 *   器への接続（channel-client の connectChannel の返り、または同じ形）。null / 未指定 = 体なし（器への送信を
 *   飛ばし、手元の再生器だけで鳴らす）。渡すなら openSpeech/appendSpeech/endSpeech が要る。
 * @param {string} [options.generationId]  世代名（診断と jobId の接頭辞）。
 * @param {(info: { cause: string; jobId: string; playbackId: string }) => unknown | Promise<unknown>} [options.releaseMouth]
 *   口の release（既定: channel.sendSet で mouth-open=0・ttl 400ms）。失敗は握る。器が無い（体なし）ときは呼ばない。
 * @param {(event: string, fields?: Record<string, unknown>) => void} [options.onTrace]  診断（本文なし）。
 * @param {(info: { jobId: string; index: number; playbackId: string; atMs: number }) => void} [options.onPlaybackStarted]
 * @param {(info: { jobId: string; index: number; playbackId: string }) => void} [options.onPlaybackActivated]
 *   器が open を受理して player.open した時点（器が無いときは player.open した時点・一括の読み上げの「鳴らし始めた」）。
 * @param {number} [options.playbackStartTimeoutMs]
 * @param {number} [options.playbackCompletionMarginMs]
 * @param {() => number} [options.nowImpl]  STARTED が atMs を持たないときの時計（既定 Date.now）。
 * @param {typeof setTimeout} [options.setTimeoutImpl]
 * @param {typeof clearTimeout} [options.clearTimeoutImpl]
 */
export function createSpeechStreamer(options) {
  if (!options || typeof options !== "object") {
    throw new TypeError("createSpeechStreamer(options): options is required.");
  }
  const { engine, player, channel } = options;
  if (!isVoiceEngine(engine)) {
    throw new TypeError("createSpeechStreamer requires a voice engine (synthesize/onStatus/dispose).");
  }
  if (!player || ["open", "write", "end", "stop", "onEvent"].some((m) => typeof player[m] !== "function")) {
    throw new TypeError("createSpeechStreamer requires a stream player (open/write/end/stop/onEvent).");
  }
  // 器は任意（体なし = null / 未指定）。渡すなら発話の 3 つの口が揃っていること。
  const hasChannel = channel != null;
  if (hasChannel && ["openSpeech", "appendSpeech", "endSpeech"].some((m) => typeof channel[m] !== "function")) {
    throw new TypeError("createSpeechStreamer requires channel.openSpeech/appendSpeech/endSpeech() (or no channel when bodyless).");
  }

  const generationId =
    typeof options.generationId === "string" && options.generationId.length > 0
      ? options.generationId
      : `speech-${++nextGenerationNumber}`;
  // playbackId は player と器の境界を越える。Fire やプロセス内の別の運び手から遅れて届いた事象を
  // 取り違えないよう、運び手ごとに通し番号を付ける（generationId が繰り返されても重ならない）。
  const serial = ++nextStreamerSerial;
  const playbackPrefix = `${generationId.replace(/[\t\r\n\s]/g, "_")}:p${serial}`;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const now = options.nowImpl ?? Date.now;
  const playbackStartTimeoutMs = options.playbackStartTimeoutMs ?? DEFAULT_PLAYBACK_START_TIMEOUT_MS;
  const playbackCompletionMarginMs = Math.min(
    5000,
    Math.max(100, options.playbackCompletionMarginMs ?? DEFAULT_PLAYBACK_COMPLETION_MARGIN_MS)
  );
  const releaseMouthImpl =
    options.releaseMouth ??
    (async () => {
      if (typeof channel?.sendSet !== "function") return;
      await channel.sendSet({ slotId: MOUTH_CLOSE_SLOT_ID, value: 0, ttlMs: MOUTH_CLOSE_TTL_MS });
    });

  /** @type {any[]} */
  const jobs = [];
  /** @type {any | null} */
  let active = null;
  /**
   * 世代を閉じたときに鳴らしていた文（閉じた時刻つき）。閉じた後も「どこまで鳴ったか」を出せるように残す
   * （一括の読み上げが鳴らし始めた後に失敗したとき、鳴った分を求める材料）。
   * @type {SpeechStreamerSnapshot["stoppedActive"]}
   */
  let stoppedActive = null;
  let llmCompleted = false;
  let closed = false;
  let settled = false;
  /** @type {"open" | "completed" | "cancelled" | "failed"} */
  let status = "open";
  /** @type {string | null} */
  let terminalCause = null;
  /** @type {unknown} */
  let failure = null;
  let hasAudiblyStarted = false;
  let enqueuedSentenceCount = 0;
  let completedSentenceCount = 0;
  let playedText = "";
  /** @type {Promise<void> | null} */
  let releasing = null;
  /** @type {(value: SpeechStreamerSnapshot) => void} */
  let resolveCompletion = () => {};
  /** @type {Promise<SpeechStreamerSnapshot>} */
  const completion = new Promise((resolve) => {
    resolveCompletion = resolve;
  });

  const trace = (/** @type {string} */ event, /** @type {Record<string, unknown>} */ fields = {}) => {
    if (typeof options.onTrace !== "function") return;
    try {
      options.onTrace(event, { generationId, ...fields });
    } catch {
      // Passive diagnostics cannot affect delivery.
    }
  };
  const notify = (/** @type {Function | undefined} */ fn, /** @type {unknown} */ info) => {
    if (typeof fn !== "function") return;
    try {
      fn(info);
    } catch {
      // State observers do not own delivery.
    }
  };

  /** @returns {SpeechStreamerSnapshot} */
  const snapshot = () => ({
    generationId,
    status,
    terminalCause,
    llmCompleted,
    enqueuedSentenceCount,
    completedSentenceCount,
    playedText,
    hasAudiblyStarted,
    playedChunks: jobs
      .filter((job) => job.completed)
      .map((job) => ({ jobId: job.jobId, index: job.index, text: job.text, playbackId: job.playbackId })),
    activePlaybackId: active && active.openAttempted ? active.playbackId : null,
    active: active
      ? {
          jobId: active.jobId,
          index: active.index,
          playbackId: active.playbackId,
          started: active.started,
          startedAtMs: active.startedAtMs,
          timeline: active.timeline.slice()
        }
      : null,
    stoppedActive: stoppedActive ? { ...stoppedActive, timeline: stoppedActive.timeline.slice() } : null,
    queuedJobIds: jobs.filter((job) => !job.terminal).map((job) => job.jobId)
  });

  const clearTimers = (/** @type {any} */ job) => {
    if (job.startTimer != null) {
      clearTimeoutImpl(job.startTimer);
      job.startTimer = null;
    }
    if (job.completionTimer != null) {
      clearTimeoutImpl(job.completionTimer);
      job.completionTimer = null;
    }
  };

  /** 口の release（失敗は握る・settle はこれを待つ）。器が無い（体なし）なら口も無いので何もしない。 */
  const releaseMouth = (/** @type {any} */ job, /** @type {string} */ cause) => {
    if (!hasChannel) return Promise.resolve();
    const run = Promise.resolve()
      .then(() => releaseMouthImpl({ cause, jobId: job.jobId, playbackId: job.playbackId }))
      .then(
        () => trace("speech.mouth.released", { jobId: job.jobId, playbackId: job.playbackId, cause }),
        (error) =>
          trace("speech.mouth.release_failed", {
            jobId: job.jobId,
            playbackId: job.playbackId,
            cause,
            failureName: error instanceof Error ? error.name : typeof error,
            failureCode: typeof error?.code === "string" ? error.code : null
          })
      );
    releasing = releasing ? releasing.then(() => run) : run;
    return run;
  };

  const finishIfSettled = () => {
    if (settled || (!llmCompleted && status === "open")) return;
    if (active != null || jobs.some((job) => !job.terminal)) return;
    settled = true;
    if (status === "open") {
      status = "completed";
      terminalCause = "completed";
    }
    unsubscribePlayer();
    const finalize = () => {
      trace("speech.delivery.settled", {
        status,
        terminalCause,
        enqueuedSentenceCount,
        completedSentenceCount,
        playedChars: playedText.length
      });
      resolveCompletion(snapshot());
    };
    if (releasing) void releasing.then(finalize, finalize);
    else finalize();
  };

  const markTerminal = (/** @type {any} */ job, /** @type {string} */ cause, /** @type {unknown} */ error) => {
    if (job.terminal) return;
    job.terminal = true;
    job.terminalCause = cause;
    clearTimers(job);
    try {
      job.controller.abort();
    } catch {
      // A synthesis that already finished ignores the signal.
    }
    trace("speech.job.terminal", {
      jobId: job.jobId,
      playbackId: job.playbackId,
      cause,
      speechChars: job.text.length,
      completedSentenceCount,
      failureName: error instanceof Error ? error.name : error == null ? null : typeof error,
      failureCode: typeof (/** @type {any} */ (error)?.code) === "string" ? /** @type {any} */ (error).code : null
    });
  };

  /**
   * 世代を閉じる（冪等）。鳴っている文は player.stop → 口の release。全文の synthesize を中止する。
   * @param {string} cause
   * @param {unknown} [error]
   * @param {number} [atMs]  閉じた時刻（player の事象が持つ atMs。無ければ now()）。
   */
  const abort = (cause, error, atMs) => {
    if (closed || settled) return false;
    closed = true;
    failure = error ?? null;
    status = CANCEL_CAUSES.has(cause) ? "cancelled" : "failed";
    terminalCause = cause;
    const oldActive = active;
    active = null;
    if (oldActive) {
      stoppedActive = {
        jobId: oldActive.jobId,
        index: oldActive.index,
        playbackId: oldActive.playbackId,
        started: oldActive.started,
        startedAtMs: oldActive.startedAtMs,
        timeline: oldActive.timeline.slice(),
        stoppedAtMs: typeof atMs === "number" && Number.isFinite(atMs) ? atMs : now()
      };
    }
    if (oldActive && (oldActive.phase === "open" || oldActive.phase === "ending")) {
      try {
        player.stop();
      } catch (stopError) {
        trace("speech.player.stop_failed", {
          jobId: oldActive.jobId,
          failureName: stopError instanceof Error ? stopError.name : typeof stopError
        });
      }
    }
    for (const job of jobs) markTerminal(job, cause, error);
    if (oldActive && oldActive.openAttempted && !oldActive.completed) releaseMouth(oldActive, cause);
    finishIfSettled();
    return true;
  };

  const completeJob = (/** @type {any} */ job) => {
    job.completed = true;
    completedSentenceCount += 1;
    playedText += job.text;
    markTerminal(job, "completed");
    // endSpeech が届かなかった文は、鳴り終わりで口を release する（開けっぱなしにしない）。
    if (job.endSpeechFailed) releaseMouth(job, "end-failed");
    if (active === job) active = null;
    pump();
    finishIfSettled();
  };

  const armStartTimer = (/** @type {any} */ job) => {
    if (job.startTimer != null || job.started) return;
    job.startTimer = setTimeoutImpl(() => {
      job.startTimer = null;
      if (active !== job || job.started || closed) return;
      trace("speech.playback.start_timeout", { jobId: job.jobId, playbackId: job.playbackId });
      abort("error", diagnosticError("stream player STARTED timeout", "player_start_timeout", "player.started"));
    }, playbackStartTimeoutMs);
  };

  const armCompletionTimer = (/** @type {any} */ job) => {
    if (job.completionTimer != null || job.phase !== "ending") return;
    if (!job.started && job.audioBytes > 0) return;
    const bytesPerSecond = job.format ? job.format.sampleRate * job.format.channels * 2 : 0;
    const durationMs = bytesPerSecond > 0 ? (job.audioBytes / bytesPerSecond) * 1000 : 0;
    const elapsedMs = job.started && job.startedAtMs != null ? Math.max(0, now() - job.startedAtMs) : 0;
    const waitMs = Math.max(0, durationMs + playbackCompletionMarginMs - elapsedMs);
    job.completionTimer = setTimeoutImpl(() => {
      job.completionTimer = null;
      if (active !== job || closed) return;
      trace("speech.playback.completion_timeout", { jobId: job.jobId, playbackId: job.playbackId, waitMs });
      abort("error", diagnosticError("stream player ENDED timeout", "player_end_timeout", "player.ended"));
    }, waitMs);
  };

  /**
   * 器へ append / end を送る。呼んだ順に同じ接続へ載るので（open の受理の後・append は音より先・end は最後）、
   * 返りを待たずに次を送ってよい。返りは非同期に見て、拒否・失敗だけを扱う。
   */
  const sendToRuntime = (/** @type {any} */ job, /** @type {"append" | "end"} */ op, /** @type {() => Promise<any>} */ send, /** @type {Record<string, unknown>} */ fields = {}) => {
    let pending;
    try {
      pending = Promise.resolve(send());
    } catch (error) {
      pending = Promise.reject(error);
    }
    void pending.then(
      (outcome) => {
        if (outcome && outcome.result === "accepted") return;
        trace("speech.channel.rejected", { jobId: job.jobId, op, result: outcome?.result ?? null, ...fields });
        handleSendFailure(job, op, rejectionError(op, outcome), fields);
      },
      (error) => handleSendFailure(job, op, withDiagnostic(error, "channel_request_failed", "control_channel.reply"), fields)
    );
  };

  const handleSendFailure = (/** @type {any} */ job, /** @type {string} */ op, /** @type {any} */ error, /** @type {Record<string, unknown>} */ fields) => {
    trace("speech.channel.failed", {
      jobId: job.jobId,
      op,
      failureName: error.name,
      failureCode: error.code,
      failureStage: error.diagnosticStage,
      ...fields
    });
    if (op === "end") {
      job.endSpeechFailed = true;
      if (job.completed) releaseMouth(job, "end-failed");
      return;
    }
    if (active === job && !closed) abort("play-failed", error);
  };

  const flush = (/** @type {any} */ job) => {
    if (job !== active || closed || job.phase !== "open") return;
    // 口の時間割を音より先に送る（データ切れによる口形の跳びを避ける・申し送り 2）。器が無ければ送らない
    // （時間割は job.timeline に貯めたまま・割り込みの材料）。
    while (hasChannel && job.timelineSent < job.timeline.length) {
      const batch = job.timeline.slice(job.timelineSent, job.timelineSent + SPEECH_STREAM_APPEND_MAX_ITEMS);
      job.timelineSent += batch.length;
      sendToRuntime(job, "append", () => channel.appendSpeech(job.playbackId, batch), { timelineCount: batch.length });
    }
    while (job.audioWritten < job.audio.length) {
      const pcm = job.audio[job.audioWritten];
      job.audio[job.audioWritten] = null;
      job.audioWritten += 1;
      let written;
      try {
        written = player.write(job.playbackId, pcm);
      } catch (error) {
        abort("play-failed", withDiagnostic(error, "player_write_failed", "player.write"));
        return;
      }
      if (written === false) {
        abort("play-failed", diagnosticError("stream player lost the utterance", "player_ownership_lost", "player.write"));
        return;
      }
      armStartTimer(job);
    }
    if (!job.synthDone) return;
    job.phase = "ending";
    let ended;
    try {
      ended = player.end(job.playbackId);
    } catch (error) {
      abort("play-failed", withDiagnostic(error, "player_end_failed", "player.end"));
      return;
    }
    if (ended === false) {
      abort("play-failed", diagnosticError("stream player lost the utterance", "player_ownership_lost", "player.end"));
      return;
    }
    if (hasChannel) sendToRuntime(job, "end", () => channel.endSpeech(job.playbackId));
    trace("speech.playback.input_completed", {
      jobId: job.jobId,
      playbackId: job.playbackId,
      pcmBytes: job.audioBytes,
      timelineCount: job.timeline.length
    });
    armCompletionTimer(job);
  };

  const activate = async (/** @type {any} */ job) => {
    job.phase = "opening";
    job.openAttempted = true;
    trace("speech.playback.activating", {
      jobId: job.jobId,
      playbackId: job.playbackId,
      speechChars: job.text.length,
      timelineCount: job.timeline.length
    });
    /** @type {any} */
    let outcome = null;
    if (!hasChannel) {
      // 体なし: 器の受理を待たず、すぐ手元の再生器を開く（openSpeech を送らない）。
      openPlayer(job, null);
      return;
    }
    try {
      outcome = await channel.openSpeech(job.playbackId);
    } catch (error) {
      const failed = withDiagnostic(error, "channel_request_failed", "control_channel.reply");
      trace("speech.channel.failed", {
        jobId: job.jobId,
        op: "open",
        failureName: failed.name,
        failureCode: failed.code,
        failureStage: failed.diagnosticStage
      });
      if (active === job && !closed) abort("play-failed", failed);
      return;
    }
    if (active !== job || closed) return;
    if (!outcome || outcome.result !== "accepted") {
      trace("speech.channel.rejected", { jobId: job.jobId, op: "open", result: outcome?.result ?? null });
      abort("play-failed", rejectionError("open", outcome));
      return;
    }
    // 口の t=0 = 器の受理。声はこの後に鳴り始める（今と同じ流儀）。
    openPlayer(job, outcome);
  };

  /**
   * 手元の再生器を開いて、溜めた分を流し始める（器の受理の後・器が無ければ鳴らす番が来た時点）。
   * @param {any} job
   * @param {any} outcome  器の open の返り（器が無ければ null）。
   */
  const openPlayer = (job, outcome) => {
    try {
      player.open(job.playbackId, { sampleRate: job.format.sampleRate, channels: job.format.channels });
    } catch (error) {
      abort("play-failed", withDiagnostic(error, "player_open_failed", "player.open"));
      return;
    }
    job.phase = "open";
    trace("speech.playback.activated", {
      jobId: job.jobId,
      playbackId: job.playbackId,
      requestId: typeof outcome?.requestId === "string" ? outcome.requestId : null,
      serializedUtf8Bytes: typeof outcome?.serializedUtf8Bytes === "number" ? outcome.serializedUtf8Bytes : null,
      sampleRate: job.format.sampleRate,
      channels: job.format.channels,
      ...(hasChannel ? {} : { bodyless: true })
    });
    notify(options.onPlaybackActivated, { jobId: job.jobId, index: job.index, playbackId: job.playbackId });
    flush(job);
  };

  /** 鳴らす番の文を、揃った分だけ進める。 */
  const advance = (/** @type {any} */ job) => {
    if (job !== active || closed) return;
    if (job.phase === "queued") {
      if (job.format == null) {
        if (job.synthDone) {
          abort("prepare-failed", diagnosticError("voice engine ended without a format", "voice_format_missing", "voice.synthesis"));
        }
        return;
      }
      if (job.audio.length === 0 && !job.synthDone) return;
      void activate(job);
      return;
    }
    flush(job);
  };

  const pump = () => {
    if (closed || active != null) return;
    const job = jobs.find((candidate) => !candidate.terminal);
    if (!job) return;
    active = job;
    advance(job);
  };

  const acceptChunk = (/** @type {any} */ job, /** @type {any} */ chunk) => {
    if (!chunk || typeof chunk !== "object") return;
    switch (chunk.type) {
      case "format": {
        if (job.format != null) return;
        const { sampleRate, channels } = chunk;
        if (!Number.isInteger(sampleRate) || sampleRate <= 0 || (channels !== 1 && channels !== 2)) {
          throw diagnosticError("voice engine produced an unusable format", "voice_format_invalid", "voice.synthesis");
        }
        job.format = { sampleRate, channels };
        return;
      }
      case "audio": {
        if (!(chunk.pcm instanceof Uint8Array) || chunk.pcm.byteLength === 0) return;
        if (job.audioBytes === 0) {
          trace("voice.audio.first_chunk", { jobId: job.jobId, pcmBytes: chunk.pcm.byteLength });
        }
        job.audio.push(chunk.pcm);
        job.audioBytes += chunk.pcm.byteLength;
        return;
      }
      case "timeline": {
        if (!Array.isArray(chunk.entries)) return;
        for (const entry of chunk.entries) job.timeline.push(entry);
        return;
      }
      case "end":
        job.synthDone = true;
        trace("voice.synthesis.completed", {
          jobId: job.jobId,
          pcmBytes: job.audioBytes,
          timelineCount: job.timeline.length
        });
        return;
      default:
        return;
    }
  };

  const synthesize = (/** @type {any} */ job) => {
    trace("voice.synthesis.requested", { jobId: job.jobId, speechChars: job.text.length, engine: engine.kind ?? null });
    const failSynthesis = (/** @type {unknown} */ error) => {
      if (job.terminal || closed || job.controller.signal.aborted) return;
      const failed = withDiagnostic(error, "voice_synthesis_failed", "voice.synthesis");
      trace("voice.synthesis.failed", { jobId: job.jobId, failureName: failed.name, failureCode: failed.code });
      abort("prepare-failed", failed);
    };
    /** @type {AsyncIterable<any>} */
    let iterable;
    try {
      iterable = engine.synthesize(job.text, {
        signal: job.controller.signal,
        onTrace: (event, fields) => trace(event, { jobId: job.jobId, ...fields })
      });
    } catch (error) {
      // 同期に投げる engine でも、enqueue の呼び出し元を巻き込まない（世代の失敗として扱う）。
      queueMicrotask(() => failSynthesis(error));
      return;
    }
    void (async () => {
      try {
        for await (const chunk of iterable) {
          if (job.terminal || closed) return;
          acceptChunk(job, chunk);
          advance(job);
          if (job.synthDone) return;
        }
        if (job.terminal || closed || job.synthDone) return;
        // end を出さずに終わった列も、そこで終わりとみなす。
        acceptChunk(job, { type: "end" });
        advance(job);
      } catch (error) {
        failSynthesis(error);
      }
    })();
  };

  const onPlayerEvent = (/** @type {any} */ event) => {
    if (settled || closed || !event || typeof event !== "object") return;
    const job = active;
    if (!job || (job.phase !== "open" && job.phase !== "ending")) return;
    if (event.type === "exit") {
      trace("speech.player.exit", { jobId: job.jobId, playbackId: job.playbackId, code: event.code ?? null });
      abort("error", diagnosticError("stream player process exited", "player_exited", "player.exit"), event.atMs);
      return;
    }
    if (event.id !== job.playbackId) {
      if (event.type === "started" || event.type === "ended") {
        trace("speech.player.event_ignored", { event: event.type, reason: "ownership-mismatch" });
      }
      return;
    }
    switch (event.type) {
      case "started": {
        if (job.started) return;
        job.started = true;
        job.startedAtMs = typeof event.atMs === "number" && Number.isFinite(event.atMs) ? event.atMs : now();
        hasAudiblyStarted = true;
        if (job.startTimer != null) {
          clearTimeoutImpl(job.startTimer);
          job.startTimer = null;
        }
        trace("voice.player.started", { jobId: job.jobId, playbackId: job.playbackId });
        notify(options.onPlaybackStarted, {
          jobId: job.jobId,
          index: job.index,
          playbackId: job.playbackId,
          atMs: job.startedAtMs
        });
        armCompletionTimer(job);
        return;
      }
      case "ended":
        if (job.phase !== "ending") {
          trace("speech.player.event_ignored", { event: "ended", reason: "input-open" });
          return;
        }
        trace("voice.player.ended", { jobId: job.jobId, playbackId: job.playbackId });
        completeJob(job);
        return;
      case "stopped":
        trace("speech.player.stopped", { jobId: job.jobId, playbackId: job.playbackId });
        abort("stopped", undefined, event.atMs);
        return;
      case "error":
        trace("speech.player.error", { jobId: job.jobId, playbackId: job.playbackId });
        abort("error", diagnosticError("stream player error", "player_error", "player.error"), event.atMs);
        return;
      default:
        return;
    }
  };

  let playerSubscribed = true;
  const offPlayer = player.onEvent(onPlayerEvent);
  const unsubscribePlayer = () => {
    if (!playerSubscribed) return;
    playerSubscribed = false;
    try {
      if (typeof offPlayer === "function") offPlayer();
    } catch {
      // best-effort
    }
  };

  return {
    generationId,
    /**
     * 文を足す（同期）。合成はすぐ始め、鳴らすのは前の文が鳴り終わってから。
     * @param {{ text: string; index?: number; final?: boolean }} chunk
     * @returns {{ jobId: string }}
     */
    enqueue(chunk) {
      if (closed || settled || llmCompleted) {
        throw new Error(`speech streamer generation is not accepting sentences (${status}).`);
      }
      if (!chunk || typeof chunk.text !== "string" || chunk.text.length === 0) {
        throw new TypeError("enqueue({ text }): text must be a non-empty string.");
      }
      const index = Number.isInteger(chunk.index) ? /** @type {number} */ (chunk.index) : jobs.length;
      const jobId = `${generationId}:sentence-${index + 1}`;
      if (jobs.some((job) => job.jobId === jobId)) throw new Error(`duplicate speech job id: ${jobId}`);
      const job = {
        jobId,
        index,
        text: chunk.text,
        final: chunk.final === true,
        playbackId: `${playbackPrefix}-s${index + 1}`,
        controller: new AbortController(),
        format: /** @type {null | { sampleRate: number; channels: number }} */ (null),
        /** @type {Array<Uint8Array | null>} */
        audio: [],
        audioWritten: 0,
        audioBytes: 0,
        /** @type {Array<{ timeMs: number; vowel: string; s: number }>} */
        timeline: [],
        timelineSent: 0,
        synthDone: false,
        /** @type {"queued" | "opening" | "open" | "ending"} */
        phase: "queued",
        openAttempted: false,
        started: false,
        /** @type {number | null} */
        startedAtMs: null,
        completed: false,
        terminal: false,
        /** @type {string | null} */
        terminalCause: null,
        endSpeechFailed: false,
        /** @type {any} */
        startTimer: null,
        /** @type {any} */
        completionTimer: null
      };
      jobs.push(job);
      enqueuedSentenceCount += 1;
      trace("speech.job.enqueued", { jobId, index, speechChars: job.text.length, final: job.final });
      synthesize(job);
      pump();
      return { jobId };
    },
    /** もう文は来ない。全部鳴り終わる（または閉じる）と解決する。 */
    finish() {
      if (!llmCompleted) {
        llmCompleted = true;
        trace("speech.input.completed", { enqueuedSentenceCount });
      }
      finishIfSettled();
      return completion;
    },
    whenSettled() {
      return completion;
    },
    abort,
    /** 最初の STARTED の前は割り込みにしない（同じ世代のまま続ける）。 */
    bargeIn() {
      if (!hasAudiblyStarted) return false;
      return abort("barge-in");
    },
    kill() {
      return abort("killed");
    },
    dispose() {
      const changed = abort("disposed");
      unsubscribePlayer();
      return changed;
    },
    /** 世代を閉じた失敗（なければ null）。本文は含まない。 */
    failure() {
      return failure;
    },
    snapshot
  };
}

/**
 * 1 文だけの発話（Claude 経路の一括の読み上げ）。器が open を受理して鳴らし始めたら返る（器が無い = 体なしなら
 * 手元の再生器を開いた時点で返る・deps.channel を渡さない）。
 * それより前の失敗（合成・器の拒否・送信失敗）は投げる。返りの `ended` は ENDED（または中断・失敗）で
 * 解決する（WAV 長のタイマーは使わない）。
 *
 * @param {string} text
 * @param {object} deps
 * @param {import("./engines/voice-engine.mjs").VoiceEngine} deps.engine
 * @param {any} deps.player
 * @param {any} [deps.channel]  器（null / 未指定 = 体なし）。
 * @param {string} [deps.generationId]
 * @param {(event: string, fields?: Record<string, unknown>) => void} [deps.onTrace]
 * @param {(info: { cause: string; jobId: string; playbackId: string }) => unknown} [deps.releaseMouth]
 * @param {(info: any) => void} [deps.onPlaybackStarted]
 * @param {() => number} [deps.nowImpl]
 * @param {typeof setTimeout} [deps.setTimeoutImpl]
 * @param {typeof clearTimeout} [deps.clearTimeoutImpl]
 * @param {typeof createSpeechStreamer} [deps.createStreamer]
 * @returns {Promise<{
 *   ended: Promise<{ status: string; cause: string | null; error: unknown; atMs: number | null }>;
 *   snapshot: () => { timeline: Array<{ timeMs: number; vowel: string; s: number }>; startedAtMs: number | null };
 *   stop: (cause: string) => Promise<void>;
 * }>}
 */
export async function speakOnce(text, deps) {
  if (typeof text !== "string" || text.length === 0) {
    throw new TypeError("speakOnce(text): text must be a non-empty string.");
  }
  if (deps == null || typeof deps !== "object") {
    throw new TypeError("speakOnce(text, deps): deps is required.");
  }
  const factory = deps.createStreamer ?? createSpeechStreamer;
  /** @type {(value: boolean) => void} */
  let resolveActivated = () => {};
  const activated = new Promise((resolve) => {
    resolveActivated = resolve;
  });
  const streamer = factory({
    engine: deps.engine,
    player: deps.player,
    channel: deps.channel,
    ...(deps.generationId ? { generationId: deps.generationId } : {}),
    ...(deps.onTrace ? { onTrace: deps.onTrace } : {}),
    ...(deps.releaseMouth ? { releaseMouth: deps.releaseMouth } : {}),
    ...(deps.onPlaybackStarted ? { onPlaybackStarted: deps.onPlaybackStarted } : {}),
    ...(deps.nowImpl ? { nowImpl: deps.nowImpl } : {}),
    ...(deps.setTimeoutImpl ? { setTimeoutImpl: deps.setTimeoutImpl } : {}),
    ...(deps.clearTimeoutImpl ? { clearTimeoutImpl: deps.clearTimeoutImpl } : {}),
    onPlaybackActivated: () => resolveActivated(true)
  });
  streamer.enqueue({ text, index: 0, final: true });
  const settled = streamer.finish();
  const first = await Promise.race([activated, settled.then(() => false)]);
  if (!first) {
    const outcome = await settled;
    if (outcome.status !== "completed") {
      const error = streamer.failure();
      throw error instanceof Error
        ? error
        : diagnosticError(`speech delivery failed (${outcome.terminalCause ?? "unknown"}).`, "speech_delivery_failed", "speech.delivery");
    }
  }
  /**
   * 中断・失敗のあとも切断点を出せるよう、最後に見た時間割と STARTED 時刻を覚えておく。鳴らしている文が
   * 無くなった後は、世代を閉じたときに鳴らしていた文（stoppedActive）を見る。
   */
  let lastSeen = { timeline: /** @type {Array<any>} */ ([]), startedAtMs: /** @type {number | null} */ (null) };
  const look = () => {
    const snap = streamer.snapshot();
    const current = snap.active ?? snap.stoppedActive;
    if (current) lastSeen = { timeline: current.timeline, startedAtMs: current.startedAtMs };
    return lastSeen;
  };
  look();
  return {
    ended: settled.then((outcome) => {
      return {
        status: outcome.status,
        cause: outcome.terminalCause,
        error: streamer.failure(),
        atMs: outcome.stoppedActive ? outcome.stoppedActive.stoppedAtMs : null
      };
    }),
    snapshot: look,
    async stop(cause) {
      look();
      streamer.abort(cause);
      await streamer.whenSettled();
    }
  };
}

/** @param {string} op @param {any} outcome */
function rejectionError(op, outcome) {
  const detail =
    outcome && outcome.error && typeof outcome.error === "object"
      ? `${outcome.error.code ?? "unknown"}: ${outcome.error.message ?? ""}`
      : String(outcome?.error ?? outcome?.result ?? "no reply");
  return diagnosticError(`intent.speechStream ${op} rejected: ${detail}`, "speech_rejected", "control_channel.rejection");
}

/** @param {string} message @param {string} code @param {string} diagnosticStage */
function diagnosticError(message, code, diagnosticStage) {
  const error = new Error(message);
  /** @type {any} */ (error).code = code;
  /** @type {any} */ (error).diagnosticStage = diagnosticStage;
  return /** @type {any} */ (error);
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
