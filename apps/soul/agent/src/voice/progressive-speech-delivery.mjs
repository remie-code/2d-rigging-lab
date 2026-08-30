// @ts-check
/**
 * Wave 2 production adapter for one Fire's sentence delivery generation.
 *
 * The Wave 1B coordinator owns FIFO and terminal idempotence. This adapter owns
 * only the concrete prepare -> Control Channel acceptance -> AudioPlayer marker
 * correlation seam and a played watermark for the later C3 projection.
 */

import { createTtsPlaybackCoordinator } from "./tts-playback-coordinator.mjs";
import { activatePreparedSpeech, prepareSpeech } from "./speak.mjs";

let nextDeliveryGeneration = 0;

/**
 * @param {object} options
 * @param {string} [options.generationId]
 * @param {{sendSpeech: Function}} options.channel
 * @param {{play: Function; stop?: Function; subscribeOutput?: (listener: (line: string) => void) => (() => void)}} options.player
 * @param {object} [options.speakDeps]
 * @param {typeof prepareSpeech} [options.prepareSpeechImpl]
 * @param {typeof activatePreparedSpeech} [options.activateSpeechImpl]
 * @param {(artifact: any) => void} [options.cleanupArtifact]
 * @param {(event: string, fields?: Record<string, unknown>) => void} [options.onTrace]
 * @param {(info: {jobId: string; playbackId: string; artifact: any}) => void} [options.onPlaybackStarted]
 * @param {number} [options.playbackStartTimeoutMs]
 * @param {number} [options.playbackCompletionMarginMs]
 * @param {typeof setTimeout} [options.setTimeoutImpl]
 * @param {typeof clearTimeout} [options.clearTimeoutImpl]
 */
export function createProgressiveSpeechDelivery(options) {
  if (!options || typeof options !== "object") {
    throw new TypeError("createProgressiveSpeechDelivery(options): options is required.");
  }
  if (!options.channel || typeof options.channel.sendSpeech !== "function") {
    throw new TypeError("progressive delivery requires channel.sendSpeech().");
  }
  if (!options.player || typeof options.player.play !== "function") {
    throw new TypeError("progressive delivery requires player.play().");
  }

  const generationId =
    typeof options.generationId === "string" && options.generationId.length > 0
      ? options.generationId
      : `fire-delivery-${++nextDeliveryGeneration}`;
  const prepareSpeechImpl = options.prepareSpeechImpl ?? prepareSpeech;
  const activateSpeechImpl = options.activateSpeechImpl ?? activatePreparedSpeech;
  const speakDeps = options.speakDeps ?? {};
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const playbackStartTimeoutMs = options.playbackStartTimeoutMs ?? 5000;
  const playbackCompletionMarginMs = Math.min(5000, Math.max(100, options.playbackCompletionMarginMs ?? 750));
  const jobs = new Map();
  let llmCompleted = false;
  let settled = false;
  let status = "open";
  let terminalCause = null;
  let forcedCause = null;
  let activeMarker = null;
  // Barge-in ownership begins only after one generation-qualified STARTED and
  // deliberately survives an inter-sentence gap until this Fire settles.
  let hasAudiblyStarted = false;
  let enqueuedSentenceCount = 0;
  let completedSentenceCount = 0;
  let playedText = "";
  let resolveCompletion;
  const completion = new Promise((resolve) => {
    resolveCompletion = resolve;
  });

  const trace = (event, fields = {}) => {
    if (typeof options.onTrace !== "function") return;
    try {
      options.onTrace(event, { generationId, ...fields });
    } catch {
      // Passive diagnostics cannot affect delivery.
    }
  };

  const cleanupArtifact = (artifact) => {
    if (typeof options.cleanupArtifact === "function") {
      options.cleanupArtifact(artifact);
      return;
    }
    // Only the preparation writer may declare exact temp ownership. Never
    // infer or remove a custom path's parent directory.
    if (artifact && typeof artifact.cleanup === "function") artifact.cleanup();
  };

  const snapshot = () => ({
    generationId,
    status,
    terminalCause,
    llmCompleted,
    enqueuedSentenceCount,
    completedSentenceCount,
    playedText,
    hasAudiblyStarted,
    playedChunks: [...jobs.values()]
      .filter((job) => job.completed)
      .sort((a, b) => a.index - b.index)
      .map((job) => ({ jobId: job.jobId, index: job.index, text: job.text, playbackId: job.playbackId })),
    activePlaybackId: activeMarker?.playbackId ?? null,
    queuedJobIds: coordinator.snapshot().queuedJobIds
  });

  const finishIfSettled = () => {
    if (settled || (!llmCompleted && status === "open")) return;
    const queueState = coordinator.snapshot();
    if (queueState.activePlaybackId != null || queueState.queuedJobIds.length > 0) return;
    settled = true;
    if (status === "open") {
      status = "completed";
      terminalCause = "completed";
    }
    unsubscribeOutput();
    trace("progressive.delivery.settled", {
      status,
      terminalCause,
      enqueuedSentenceCount,
      completedSentenceCount,
      playedChars: playedText.length
    });
    resolveCompletion(snapshot());
  };

  const clearStartTimer = (marker) => {
    if (!marker || marker.startTimer == null) return;
    clearTimeoutImpl(marker.startTimer);
    marker.startTimer = null;
  };

  const clearCompletionTimer = (marker) => {
    if (!marker || marker.completionTimer == null) return;
    clearTimeoutImpl(marker.completionTimer);
    marker.completionTimer = null;
  };

  const coordinator = createTtsPlaybackCoordinator({
    play: async ({ jobId, artifact, playbackId }) => {
      const job = jobs.get(jobId);
      if (!job) throw new Error(`unknown progressive speech job: ${jobId}`);
      job.playbackId = playbackId;
      const marker = {
        jobId,
        playbackId,
        wavPath: artifact.wavPath,
        started: false,
        startTimer: null,
        completionTimer: null
      };
      activeMarker = marker;
      trace("progressive.playback.activating", {
        jobId,
        playbackId,
        speechChars: job.text.length,
        rawMoraCount: artifact.rawMoraCount ?? null,
        timelineCount: Array.isArray(artifact.timeline) ? artifact.timeline.length : null
      });
      const activated = await activateSpeechImpl(artifact, {
        ...speakDeps,
        channel: options.channel,
        player: {
          play(wavPath) {
            if (activeMarker !== marker || wavPath !== marker.wavPath) {
              throw new Error("progressive playback lost exact artifact ownership.");
            }
            options.player.play(wavPath, playbackId);
            marker.startTimer = setTimeoutImpl(() => {
              if (activeMarker !== marker || marker.started) return;
              trace("progressive.playback.start_timeout", { jobId, playbackId });
              coordinator.handleTerminal({
                type: "ERROR",
                playbackId,
                error: new Error("audio player STARTED marker timeout")
              });
            }, playbackStartTimeoutMs);
          }
        },
        onTrace: (event, fields) => trace(event, { jobId, playbackId, ...fields })
      });
      job.requestId = activated.requestId ?? null;
      job.serializedUtf8Bytes = activated.serializedUtf8Bytes ?? null;
      job.playbackStartedAtMs = activated.playbackStartedAtMs;
      trace("progressive.playback.activated", {
        jobId,
        playbackId,
        requestId: job.requestId,
        serializedUtf8Bytes: job.serializedUtf8Bytes,
        playbackStartedAtMs: job.playbackStartedAtMs
      });
    },
    stop: () => options.player.stop?.(),
    onTerminal: ({ jobId, cause, error }) => {
      const job = jobs.get(jobId);
      if (!job) return;
      if (activeMarker?.jobId === jobId) {
        clearStartTimer(activeMarker);
        clearCompletionTimer(activeMarker);
        activeMarker = null;
      }
      const effectiveCause = forcedCause ?? cause;
      job.terminalCause = effectiveCause;
      if (cause === "completed") {
        job.completed = true;
        completedSentenceCount += 1;
        playedText += job.text;
      } else if (status === "open") {
        status = ["killed", "barge-in", "disposed"].includes(effectiveCause) ? "cancelled" : "failed";
        terminalCause = effectiveCause;
      }
      trace("progressive.job.terminal", {
        jobId,
        playbackId: job.playbackId ?? null,
        cause: effectiveCause,
        speechChars: job.text.length,
        completedSentenceCount,
        failureName: error instanceof Error ? error.name : error == null ? null : typeof error,
        failureCode: typeof error?.code === "string" ? error.code : null
      });
      finishIfSettled();
    }
  });

  const handlePlayerOutput = (line) => {
    if (settled || typeof line !== "string") return false;
    const [markerType, markerPlaybackId = "", markerPath = ""] = line.split("\t", 4);
    const marker = activeMarker;
    if (!marker) {
      trace("progressive.player.marker_ignored", { marker: markerType, reason: "no-active-playback" });
      return false;
    }
    if (markerPlaybackId !== marker.playbackId || markerPath !== marker.wavPath) {
      trace("progressive.player.marker_ignored", { marker: markerType, reason: "ownership-mismatch" });
      return false;
    }
    if (markerType === "STARTED") {
      if (marker.started) return false;
      marker.started = true;
      hasAudiblyStarted = true;
      clearStartTimer(marker);
      const completionWatchdogMs =
        Math.max(0, Number(jobs.get(marker.jobId)?.artifact?.wavDurationSec) || 0) * 1000 +
        playbackCompletionMarginMs;
      marker.completionTimer = setTimeoutImpl(() => {
        if (activeMarker !== marker || !marker.started) return;
        trace("progressive.playback.completion_timeout", {
          jobId: marker.jobId,
          playbackId: marker.playbackId,
          completionWatchdogMs
        });
        coordinator.handleTerminal({
          type: "ERROR",
          playbackId: marker.playbackId,
          error: new Error("audio player ENDED marker timeout")
        });
      }, completionWatchdogMs);
      trace("progressive.player.started", { jobId: marker.jobId, playbackId: marker.playbackId });
      try {
        options.onPlaybackStarted?.({
          jobId: marker.jobId,
          playbackId: marker.playbackId,
          artifact: jobs.get(marker.jobId)?.artifact
        });
      } catch {
        // State observers do not own delivery.
      }
      return true;
    }
    if (markerType === "ERROR") {
      trace("progressive.player.error", { jobId: marker.jobId, playbackId: marker.playbackId });
      return coordinator.handleTerminal({
        type: "ERROR",
        playbackId: marker.playbackId,
        error: new Error("authenticated audio player error")
      });
    }
    if (markerType === "ENDED" || markerType === "STOPPED") {
      if (!marker.started) {
        trace("progressive.player.marker_ignored", { marker: markerType, reason: "not-started" });
        return false;
      }
      trace(`progressive.player.${markerType.toLowerCase()}`, {
        jobId: marker.jobId,
        playbackId: marker.playbackId
      });
      return coordinator.handleTerminal({ type: markerType, playbackId: marker.playbackId });
    }
    trace("progressive.player.marker_ignored", { marker: markerType, reason: "unknown-marker" });
    return false;
  };

  const unsubscribeOutput =
    typeof options.player.subscribeOutput === "function"
      ? options.player.subscribeOutput(handlePlayerOutput)
      : () => {};

  const abort = (cause, method = "dispose") => {
    if (settled || status !== "open") return false;
    forcedCause = cause;
    status = ["killed", "barge-in", "disposed"].includes(cause) ? "cancelled" : "failed";
    terminalCause = cause;
    const changed = coordinator[method]();
    finishIfSettled();
    return changed;
  };

  return {
    /** @param {{text: string; index: number; final: boolean}} chunk */
    enqueue(chunk) {
      if (settled || status !== "open" || llmCompleted) {
        throw new Error(`progressive delivery generation is not accepting sentences (${status}).`);
      }
      const jobId = `${generationId}:sentence-${chunk.index + 1}`;
      const job = {
        jobId,
        index: chunk.index,
        text: chunk.text,
        final: chunk.final,
        artifact: null,
        playbackId: null,
        completed: false,
        terminalCause: null
      };
      jobs.set(jobId, job);
      enqueuedSentenceCount += 1;
      trace("progressive.job.enqueued", { jobId, index: chunk.index, speechChars: chunk.text.length, final: chunk.final });
      coordinator.enqueue({
        jobId,
        prepare: async () => {
          trace("progressive.job.prepare_started", { jobId, speechChars: chunk.text.length });
          const artifact = await prepareSpeechImpl(chunk.text, {
            ...speakDeps,
            onTrace: (event, fields) => trace(event, { jobId, ...fields })
          });
          job.artifact = artifact;
          trace("progressive.job.prepare_completed", {
            jobId,
            speechChars: chunk.text.length,
            rawMoraCount: artifact.rawMoraCount ?? null,
            timelineCount: Array.isArray(artifact.timeline) ? artifact.timeline.length : null,
            wavBytes: artifact.wavBytes ?? null
          });
          return artifact;
        },
        cleanup: ({ artifact, cause }) => {
          cleanupArtifact(artifact);
          trace("progressive.job.cleaned", { jobId, cause });
        }
      });
      return { jobId };
    },
    finishLlm() {
      llmCompleted = true;
      trace("progressive.llm.completed", { enqueuedSentenceCount });
      finishIfSettled();
      return completion;
    },
    whenSettled() { return completion; },
    abort,
    kill() { return abort("killed", "kill"); },
    bargeIn() {
      // Confirmed listener speech before Soul's authenticated STARTED is not a
      // barge-in. Keep the same generation open for its later normal delivery.
      if (!hasAudiblyStarted) return false;
      return abort("barge-in", "bargeIn");
    },
    dispose() { return abort("disposed", "dispose"); },
    handlePlayerOutput,
    snapshot
  };
}
