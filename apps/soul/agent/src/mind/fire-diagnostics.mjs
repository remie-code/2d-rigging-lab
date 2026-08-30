// @ts-check
/** Passive local Fire diagnostics; it never records Fire content or blocks Fire on disk I/O. */
import { appendFile, mkdir, readdir, rm } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_FIRE_DIAGNOSTICS_DIR = join(here, "..", "..", "fire-diagnostics");
export const FIRE_DIAGNOSTIC_RETENTION = 5;
export const FIRE_DIAGNOSTIC_MAX_QUEUE = 128;

/** @param {number} value */
function safeFileStamp(value) {
  return new Date(value).toISOString().replace(/[:.]/g, "-");
}

/** @param {unknown} error */
function failureMetadata(error) {
  return {
    name:
      error instanceof Error
        ? error.name
        : error && typeof error === "object" && typeof /** @type {any} */ (error).name === "string"
          ? /** @type {any} */ (error).name
          : typeof error,
    code:
      error && typeof error === "object" && typeof /** @type {any} */ (error).code === "string"
        ? /** @type {any} */ (error).code
        : null
  };
}

/**
 * A serialized, bounded async JSONL writer. `record()` deliberately has no
 * Promise return: the production Fire path cannot await filesystem work.
 *
 * @param {{ dir?: string; nowImpl?: () => number; monotonicNowImpl?: () => number; retention?: number; maxQueue?: number; fs?: { appendFile: Function; mkdir: Function; readdir: Function; rm: Function } }} [options]
 */
export function createFireDiagnostics(options = {}) {
  const dir = options.dir ?? DEFAULT_FIRE_DIAGNOSTICS_DIR;
  const nowImpl = options.nowImpl ?? Date.now;
  const monotonicNowImpl = options.monotonicNowImpl ?? (() => performance.now());
  const retention = options.retention ?? FIRE_DIAGNOSTIC_RETENTION;
  const maxQueue = options.maxQueue ?? FIRE_DIAGNOSTIC_MAX_QUEUE;
  const fs = options.fs ?? { appendFile, mkdir, readdir, rm };
  let active = null;
  let sequence = 0;
  /** @type {Array<() => Promise<void>>} */
  const queue = [];
  let draining = false;
  let dropped = 0;
  /** @type {Array<() => void>} */
  const idleWaiters = [];

  const notifyIdle = () => {
    if (draining || queue.length > 0) return;
    for (const resolve of idleWaiters.splice(0)) resolve();
  };
  const drain = () => {
    if (draining) return;
    draining = true;
    void (async () => {
      while (queue.length > 0) {
        const task = queue.shift();
        try {
          await task?.();
        } catch {
          // Per-operation failure is isolated; later events still persist.
        }
      }
      draining = false;
      notifyIdle();
    })();
  };
  /** @param {() => Promise<void>} task */
  const enqueue = (task) => {
    if (queue.length >= maxQueue) {
      dropped += 1;
      return;
    }
    queue.push(task);
    drain();
  };
  const prune = async () => {
    await fs.mkdir(dir, { recursive: true });
    const files = (await fs.readdir(dir)).filter((name) => /^fire-.*\.jsonl$/.test(name)).sort().reverse();
    for (const file of files.slice(Math.max(0, retention))) {
      await fs.rm(join(dir, file), { force: true });
    }
  };
  /** @param {string} event @param {Record<string, unknown>} [fields] */
  const write = (event, fields = {}) => {
    if (active == null) return;
    const monotonicMs = monotonicNowImpl();
    const record = {
      schema: "soul-fire-diagnostic-v1",
      fireId: active.fireId,
      event,
      wallTimeMs: nowImpl(),
      monotonicMs,
      ...fields
    };
    if (event === "player.play.enqueued") active.playbackEnqueuedAtMonotonicMs = monotonicMs;
    if (event === "player.child" && fields.marker === "STARTED") {
      record.sincePlaybackEnqueueMs =
        active.playbackEnqueuedAtMonotonicMs == null ? null : monotonicMs - active.playbackEnqueuedAtMonotonicMs;
      record.sinceFireAcceptedMs = monotonicMs - active.acceptedAtMonotonicMs;
    }
    const path = active.path;
    enqueue(async () => {
      await fs.mkdir(dir, { recursive: true });
      await fs.appendFile(path, `${JSON.stringify(record)}\n`, "utf8");
    });
  };

  return {
    /** @param {Record<string, unknown>} [accepted] */
    begin(accepted = {}) {
      const startedAtMs = nowImpl();
      const acceptedAtMonotonicMs = monotonicNowImpl();
      const fireId = `soul-${startedAtMs}-${(sequence += 1)}`;
      active = {
        fireId,
        path: join(dir, `fire-${safeFileStamp(startedAtMs)}-${sequence}.jsonl`),
        acceptedAtMonotonicMs,
        playbackEnqueuedAtMonotonicMs: null
      };
      write("fire.accepted", { accepted });
      enqueue(prune);
      return { fireId, path: active.path };
    },
    /** @param {string} event @param {Record<string, unknown>} [fields] */
    record(event, fields = {}) {
      write(event, fields);
    },
    /** @param {string} stage @param {unknown} error */
    fail(stage, error) {
      write("fire.failed", { stage, failure: failureMetadata(error) });
      active = null;
    },
    /** @param {Record<string, unknown>} [fields] */
    finish(fields = {}) {
      write("fire.completed", fields);
      active = null;
    },
    getActivePath() {
      return active?.path ?? null;
    },
    /** Test/lifecycle seam only; never use it from the Fire path. */
    flush() {
      if (!draining && queue.length === 0) return Promise.resolve();
      return new Promise((resolve) => idleWaiters.push(resolve));
    },
    getQueueStats() {
      return { queued: queue.length, draining, dropped, maxQueue };
    }
  };
}
