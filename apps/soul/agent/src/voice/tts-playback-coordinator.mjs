// @ts-check
/**
 * 文 chunk の準備と FIFO 再生をつなぐ小さな coordinator。
 *
 * Fire / transcript / Runtime protocol を持たない。TTS preparation は並列に終わって
 * よいが、`play` は queue 順かつ自然な ENDED の後にだけ起動する。player 側との相関は
 * `playbackId` を境界へ渡すことで行い、古い generation の signal を新しい再生へ誤適用しない。
 */

/**
 * @typedef {{ jobId: string; artifact: unknown; playbackId: string }} PlaybackStart
 */

/**
 * @param {{
 *   play: (start: PlaybackStart) => void | Promise<void>;
 *   stop?: () => void;
 *   onTerminal?: (event: { jobId: string; cause: string; error?: unknown }) => void;
 * }} deps
 */
export function createTtsPlaybackCoordinator(deps) {
  if (deps == null || typeof deps !== "object" || typeof deps.play !== "function") {
    throw new TypeError("createTtsPlaybackCoordinator requires deps.play().");
  }
  const jobs = [];
  const knownIds = new Set();
  let active = null;
  const coordinatorId = ++nextCoordinatorId;
  let nextPlayback = 0;
  let closed = false;
  let failure = null;

  /** @param {any} job @param {string} cause */
  const cleanup = (job, cause) => {
    if (job.cleaned || typeof job.cleanup !== "function") return;
    // A cancelled preparation may produce its temp WAV after its terminal event.
    // Keep cleanup armed until that artifact actually exists.
    if (job.artifact === undefined) return;
    job.cleaned = true;
    try {
      job.cleanup({ jobId: job.jobId, artifact: job.artifact, cause });
    } catch {
      // Cleanup must not resurrect or reorder queue work.
    }
  };

  /** @param {any} job @param {string} cause @param {unknown} [error] */
  const terminal = (job, cause, error) => {
    if (job.terminal) return;
    job.terminal = true;
    cleanup(job, cause);
    try {
      deps.onTerminal?.({ jobId: job.jobId, cause, ...(error === undefined ? {} : { error }) });
    } catch {
      // Observability cannot affect queue state.
    }
  };

  /** @param {string} cause @param {unknown} [error] */
  const abort = (cause, error) => {
    if (closed) return false;
    closed = true;
    failure = error ?? cause;
    const oldActive = active;
    active = null;
    if (oldActive) {
      terminal(oldActive.job, cause, error);
      try {
        deps.stop?.();
      } catch {
        // The generation is closed regardless of a stop transport failure.
      }
    }
    for (const job of jobs) {
      if (job !== oldActive?.job) terminal(job, cause, error);
    }
    return true;
  };

  const pump = () => {
    if (closed || active) return;
    // Do not let a later completed TTS job overtake an earlier preparation.
    const job = jobs.find((candidate) => !candidate.terminal);
    if (!job || job.state !== "ready") return;
    // `playbackId` crosses the adapter boundary; it must not repeat if a new
    // Fire/coordinator is created while a child callback from an old one lingers.
    const playbackId = `playback-${coordinatorId}-${++nextPlayback}`;
    active = { job, playbackId };
    job.state = "playing";
    try {
      const maybePromise = deps.play({ jobId: job.jobId, artifact: job.artifact, playbackId });
      Promise.resolve(maybePromise).catch((error) => {
        if (active?.job === job && active.playbackId === playbackId) {
          abort("play-failed", error);
        }
      });
    } catch (error) {
      if (active?.job === job && active.playbackId === playbackId) {
        abort("play-failed", error);
      }
    }
  };

  /** @param {any} job @param {unknown} artifact */
  const prepared = (job, artifact) => {
    if (closed || job.terminal || job.state !== "preparing") {
      job.artifact = artifact;
      cleanup(job, "late-preparation");
      return;
    }
    job.artifact = artifact;
    job.state = "ready";
    pump();
  };

  return {
    /**
     * TTS preparationを登録する。準備完了の順が前後しても、開始は enqueue 順のまま。
     * @param {{ jobId: string; prepare: (input: { jobId: string }) => unknown | Promise<unknown>; cleanup?: (input: { jobId: string; artifact: unknown; cause: string }) => void }} input
     */
    enqueue(input) {
      if (closed) throw new Error(`playback coordinator is closed (${String(failure ?? "cancelled")}).`);
      if (!input || typeof input.jobId !== "string" || input.jobId.length === 0 || typeof input.prepare !== "function") {
        throw new TypeError("enqueue requires a non-empty jobId and prepare().");
      }
      if (knownIds.has(input.jobId)) throw new Error(`duplicate TTS job id: ${input.jobId}`);
      knownIds.add(input.jobId);
      const job = { jobId: input.jobId, prepare: input.prepare, cleanup: input.cleanup, artifact: undefined, state: "preparing", terminal: false, cleaned: false };
      jobs.push(job);
      Promise.resolve()
        .then(() => job.prepare({ jobId: job.jobId }))
        .then((artifact) => prepared(job, artifact), (error) => {
          if (!closed && !job.terminal) {
            terminal(job, "prepare-failed", error);
            abort("prepare-failed", error);
          }
        });
      return { jobId: job.jobId };
    },
    /**
     * Player adapter は child marker を構造化し、開始に渡された playbackId と同じ時だけ渡す。
     * ENDED だけが FIFO を次へ進める。STOPPED/ERROR は generation 全体を閉じる。
     * @param {{ type: "ENDED" | "ERROR" | "STOPPED"; playbackId: string; error?: unknown }} signal
     */
    handleTerminal(signal) {
      if (!active || !signal || signal.playbackId !== active.playbackId) return false;
      const completed = active;
      active = null;
      if (signal.type === "ENDED") {
        terminal(completed.job, "completed");
        pump();
        return true;
      }
      terminal(completed.job, signal.type.toLowerCase(), signal.error);
      abort(signal.type.toLowerCase(), signal.error);
      return true;
    },
    /** Timer is deliberately not a playback-completion authority in this primitive. */
    handleTimer(_playbackId) {
      return false;
    },
    kill() { return abort("killed"); },
    bargeIn() { return abort("barge-in"); },
    dispose() { return abort("disposed"); },
    /** @returns {{ activePlaybackId: string | null; queuedJobIds: string[]; closed: boolean }} */
    snapshot() {
      return {
        activePlaybackId: active?.playbackId ?? null,
        queuedJobIds: jobs.filter((job) => !job.terminal).map((job) => job.jobId),
        closed
      };
    }
  };
}

// Deliberately module-lifetime, not coordinator-lifetime. This coordinator is
// a narrow in-process primitive, so this monotonically distinguishes every
// generation it can receive callbacks from.
let nextCoordinatorId = 0;
