// @ts-check
/**
 * 頭の文脈の記録（起動ごと 1 ファイルの JSONL）— apps/soul/agent（長い配信の文脈・context-growth-2026-10.md §5・§6）。
 *
 * 発火ごとに 1 行（発火番号・頭・今回と累計の入力トークン・キャッシュ分・扱える最大量・最初の文字までの時間・
 * 画像の有無・渡した行数と文字数）と、圧縮の開始・終了を 1 行ずつ `session-usage/<起動時刻>.jsonl` に追記する。
 * **会話の本文は書かない**（数字と種類だけ）。配信を通して読み返し、圧縮のしきい値を決める材料にする。
 *
 * 応答の遅れの直し（latency-fix-plan.md §2-5）: 返事ごとの遅延の内訳（type: "latency"・文字起こし・判定・画面・
 * 最初の文字・最初の文・TTS・声・その他・合計、きっかけの種類、頭・文字起こし・声のエンジン名）も 1 行ずつ足す。
 * 操縦席の SSE "latency" と同じレコード（cockpit-server の onReplyLatency）から作る。配信どうしで比べる材料。
 *
 * fire-diagnostics.mjs と同じ流儀: ディスク I/O は直列の非同期キューで行い、発火の経路は待たない・止めない
 * （書けなくても握る）。ファイルは最初の 1 行で作り、そのときに古いものを消して直近 SESSION_USAGE_RETENTION
 * 個（今回の分を含む）だけ残す。置き場は apps/soul/agent/.gitignore 済み。
 */
import { appendFile, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SESSION_USAGE_DIR = join(here, "..", "..", "session-usage");
/** 残すファイルの数（起動 20 回分・今回を含む）。 */
export const SESSION_USAGE_RETENTION = 20;
export const SESSION_USAGE_MAX_QUEUE = 256;
export const SESSION_USAGE_SCHEMA = "soul-session-usage-v1";

const FILE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.jsonl$/;

/** @param {number} startedAtMs */
export function sessionUsageFileName(startedAtMs) {
  return `${new Date(startedAtMs).toISOString().replace(/[:.]/g, "-")}.jsonl`;
}

/** @param {unknown} v */
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * 発火の orchestrator の onAskRecord（本文なし）から、記録の 1 行を作る（純関数）。
 * @param {any} info
 * @returns {Record<string, unknown>}
 */
export function fireUsageRecord(info) {
  const tokenUsage = info?.tokenUsage ?? null;
  const last = tokenUsage?.last ?? null;
  const total = tokenUsage?.total ?? null;
  return {
    type: "fire",
    fireId: num(info?.fireId),
    brain: typeof info?.brain === "string" ? info.brain : null,
    lastInputTokens: num(last?.inputTokens),
    lastCachedInputTokens: num(last?.cachedInputTokens),
    totalInputTokens: num(total?.inputTokens),
    totalCachedInputTokens: num(total?.cachedInputTokens),
    modelContextWindow: num(tokenUsage?.modelContextWindow),
    ttftMs: num(info?.ttftMs),
    vision: info?.vision === true,
    windowMode: typeof info?.windowMode === "string" ? info.windowMode : null,
    includedCount: num(info?.includedCount),
    injectedChars: num(info?.injectedChars)
  };
}

/**
 * 圧縮の開始・終了（context-compactor の onEvent）から、記録の 1 行を作る（純関数）。
 * @param {any} event
 * @param {string | null} brain
 * @returns {Record<string, unknown>}
 */
export function compactionUsageRecord(event, brain) {
  if (event?.type === "started") {
    return {
      type: "compactStarted",
      brain,
      ratio: num(event.ratio),
      lastInputTokens: num(event.lastInputTokens),
      totalInputTokens: num(event.totalInputTokens),
      modelContextWindow: num(event.modelContextWindow)
    };
  }
  return {
    type: "compactFinished",
    brain,
    ok: event?.ok === true,
    durationMs: num(event?.durationMs),
    reason: typeof event?.reason === "string" ? event.reason : null,
    personaInjected: event?.personaInjected === true,
    personaDeferred: event?.personaDeferred === true,
    compactionInputTokens: num(event?.compactionInputTokens)
  };
}

/**
 * 返事の遅延（cockpit-server の onReplyLatency が渡す、SSE "latency" と同じレコード）から、記録の 1 行を作る（純関数）。
 * 数字・種類・エンジン名だけを拾う（きっかけはコメントの ID や確率などを落とし、種類と speak-now の選択だけ）。
 * @param {any} record
 * @returns {Record<string, unknown>}
 */
export function replyLatencyUsageRecord(record) {
  const segments = record?.segments ?? {};
  const cause = record?.cause && typeof record.cause === "object" ? record.cause : null;
  const str = (/** @type {unknown} */ v) => (typeof v === "string" ? v : null);
  return {
    type: "latency",
    fireId: num(record?.fireId),
    causeType: str(cause?.type),
    causeChoice: str(cause?.choice),
    spoken: record?.spoken === true,
    vision: record?.vision === true,
    level: str(record?.level),
    brain: str(record?.brain),
    sttEngine: str(record?.stt),
    voiceEngine: str(record?.voice),
    transcribeMs: num(segments.transcribeMs),
    judgeMs: num(segments.judgeMs),
    screenMs: num(segments.screenMs),
    llmFirstMs: num(segments.llmFirstMs),
    firstSentenceMs: num(segments.firstSentenceMs),
    ttsMs: num(segments.ttsMs),
    voiceMs: num(segments.voiceMs),
    otherMs: num(record?.otherMs),
    totalMs: num(record?.totalMs)
  };
}

/**
 * @param {{ dir?: string; startedAtMs?: number; nowImpl?: () => number; retention?: number; maxQueue?: number; fs?: { appendFile: Function; mkdir: Function; readdir: Function; rm: Function } }} [options]
 */
export function createSessionUsageLog(options = {}) {
  const dir = options.dir ?? DEFAULT_SESSION_USAGE_DIR;
  const nowImpl = options.nowImpl ?? Date.now;
  const startedAtMs = options.startedAtMs ?? nowImpl();
  const retention = options.retention ?? SESSION_USAGE_RETENTION;
  const maxQueue = options.maxQueue ?? SESSION_USAGE_MAX_QUEUE;
  const fs = options.fs ?? { appendFile, mkdir, readdir, rm };
  const fileName = sessionUsageFileName(startedAtMs);
  const path = join(dir, fileName);
  let pruned = false;
  let dropped = 0;
  /** @type {Array<() => Promise<void>>} */
  const queue = [];
  let draining = false;
  /** @type {Array<(value?: unknown) => void>} */
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
          // 書けなくても次の行は試す（記録は発火を止めない）。
        }
      }
      draining = false;
      notifyIdle();
    })();
  };
  const prune = async () => {
    const files = (await fs.readdir(dir)).filter((name) => FILE_RE.test(name) && name !== fileName).sort().reverse();
    for (const file of files.slice(Math.max(0, retention - 1))) {
      await fs.rm(join(dir, file), { force: true });
    }
  };

  return {
    path,
    /**
     * 1 行追記する（待たない・throw しない）。record に本文を入れないのは呼び出し側の規律（fireUsageRecord /
     * compactionUsageRecord は数字と種類だけを拾う）。
     * @param {Record<string, unknown>} record
     */
    append(record) {
      if (queue.length >= maxQueue) {
        dropped += 1;
        return;
      }
      const line = `${JSON.stringify({ schema: SESSION_USAGE_SCHEMA, wallTimeMs: nowImpl(), ...record })}\n`;
      queue.push(async () => {
        await fs.mkdir(dir, { recursive: true });
        if (!pruned) {
          pruned = true;
          try {
            await prune();
          } catch {
            // 古いファイルを消せなくても記録は続ける。
          }
        }
        await fs.appendFile(path, line, "utf8");
      });
      drain();
    },
    /** テスト・終了時用（発火の経路からは呼ばない）。 */
    flush() {
      if (!draining && queue.length === 0) return Promise.resolve();
      return new Promise((resolve) => idleWaiters.push(resolve));
    },
    getStats() {
      return { queued: queue.length, draining, dropped };
    }
  };
}
