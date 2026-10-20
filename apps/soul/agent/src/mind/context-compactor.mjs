// @ts-check
/**
 * 隙間で手動の圧縮（Codex の頭のみ）— apps/soul/agent（長い配信の文脈・context-growth-2026-10.md §5・§6）。
 *
 * 長い配信で頭の会話（Codex の thread）が膨らむと応答が遅くなる。Codex の自動圧縮の設定には頼らず、
 * 「直近の ask の入力トークン（文脈の大きさ）が目安の量（既定 20 万トークン）を超え、かつ隙間にいる」ときだけ、
 * 頭のセッションの `compact()`（thread/compact/start → 人格の指示の差し込み直し）を呼ぶ。目安は量で持つ
 * （遅さの段差は約 23 万トークンという量で出た・頭によって窓の大きさが違う・context-growth-2026-10.md §8）。
 * 目安は操縦席の設定（頭脳・会話のタブ）から変えられ、setThresholdTokens で走っている部品にすぐ効く。
 *
 * 隙間（§6）: チャッピーが空いている・判定の待ちがない・配信者の喋り終わりから 3 秒以上・前の圧縮から
 * 10 分以上。返事が終わるたび（noteReplyFinished）と数秒おき（start の周期）に確かめる。
 *
 * ここは判断と呼び出しの順番だけを持つ（純粋な判定 decideCompaction + 時計・タイマ・取得口の注入）。
 * 圧縮中の発火を待たせる（上限 60 秒）のは頭のセッション（codex-session.mjs）の ask の側。
 * 見え方（ターミナル 1 行・ログのタブ 1 行・記録ファイル 1 行）は onEvent を受けた結線層（cockpit.mjs）が出す。
 * 本文は扱わない（数字と理由だけ）。
 */

/**
 * 圧縮を始める大きさの既定（直近の入力トークンがこれを超えたら）。2 時間の配信で約 23 万トークンを超えたところから
 * 最初の文字が 5〜6 秒 → 11〜13 秒へ段差で遅くなったため、段差の手前の 20 万にした（context-growth-2026-10.md §8）。
 */
export const DEFAULT_COMPACT_THRESHOLD_TOKENS = 200_000;
/** 設定で選べる目安の下限（5 万トークン）。設定ファイル・操縦席の API の範囲の検証に使う。 */
export const COMPACT_THRESHOLD_TOKENS_MIN = 50_000;
/** 設定で選べる目安の上限（45 万トークン）。 */
export const COMPACT_THRESHOLD_TOKENS_MAX = 450_000;
/** 配信者の喋り終わりから、この時間だけ黙っていたら隙間とみなす。 */
export const DEFAULT_COMPACT_QUIET_MS = 3000;
/** 前の圧縮（の試み）から、この時間が経つまでは次を試さない。 */
export const DEFAULT_COMPACT_MIN_INTERVAL_MS = 10 * 60 * 1000;
/** 数秒おきに確かめる周期。 */
export const DEFAULT_COMPACT_CHECK_INTERVAL_MS = 5000;

/**
 * @typedef {object} QuietGap  結線層（cockpit-server）が渡す今の状況。
 * @property {boolean} soulIdle  チャッピーが空いている（idle で、発火の Promise も片付いている）。
 * @property {boolean} judging  判定の待ちがある（話し始め・コメント反応の判定が進行中 / 積み残し）。
 * @property {boolean} userSpeaking  配信者が今喋っている（VAD の speechStart から end / cancel まで）。
 * @property {number | null} lastSpeechEndAtMs  配信者の喋り終わりの時刻（壁時計・まだ無ければ null）。
 */

/**
 * @typedef {object} ContextUsage  頭のセッションの getContextUsage()。
 * @property {number | null} lastInputTokens
 * @property {number | null} modelContextWindow
 * @property {number | null} [totalInputTokens]
 */

/**
 * 設定の目安（トークン数）を検証する。整数で COMPACT_THRESHOLD_TOKENS_MIN 以上 COMPACT_THRESHOLD_TOKENS_MAX 以下なら
 * その値、それ以外（範囲外・小数・数でない）は null（= 呼び出し側で既定）。設定ファイルと操縦席の API が共有する。
 * @param {unknown} v
 * @returns {number | null}
 */
export function normalizeCompactThresholdTokens(v) {
  return typeof v === "number" && Number.isInteger(v) && v >= COMPACT_THRESHOLD_TOKENS_MIN && v <= COMPACT_THRESHOLD_TOKENS_MAX
    ? v
    : null;
}

/**
 * 圧縮を始めてよいかの判定（純関数）。目安は量（直近の入力トークンが thresholdTokens を超えたら・ちょうどは含めない）。
 * inputTokens は判定に使った直近の入力トークン、ratio は窓（modelContextWindow）に対する割合の参考
 * （窓が分からなければ null・判定には使わない）。
 * @param {{ usage: ContextUsage | null; gap: QuietGap | null; nowMs: number; lastAttemptAtMs: number | null; thresholdTokens: number; quietMs: number; minIntervalMs: number }} input
 * @returns {{ ok: true; inputTokens: number; ratio: number | null } | { ok: false; reason: string; inputTokens?: number; ratio?: number | null }}
 */
export function decideCompaction(input) {
  const { usage, gap, nowMs, lastAttemptAtMs, thresholdTokens, quietMs, minIntervalMs } = input;
  const inputTokens = usage?.lastInputTokens;
  if (typeof inputTokens !== "number" || !Number.isFinite(inputTokens)) return { ok: false, reason: "no-usage" };
  const window = usage?.modelContextWindow;
  const ratio = typeof window === "number" && window > 0 ? inputTokens / window : null;
  const seen = { inputTokens, ratio };
  if (!(inputTokens > thresholdTokens)) return { ok: false, reason: "below-threshold", ...seen };
  if (lastAttemptAtMs != null && nowMs - lastAttemptAtMs < minIntervalMs) return { ok: false, reason: "too-soon", ...seen };
  if (!gap) return { ok: false, reason: "no-gap-info", ...seen };
  if (!gap.soulIdle) return { ok: false, reason: "soul-busy", ...seen };
  if (gap.judging) return { ok: false, reason: "judging", ...seen };
  if (gap.userSpeaking) return { ok: false, reason: "user-speaking", ...seen };
  if (gap.lastSpeechEndAtMs != null && nowMs - gap.lastSpeechEndAtMs < quietMs) return { ok: false, reason: "user-recent", ...seen };
  return { ok: true, ...seen };
}

/**
 * started の lastInputTokens は判定に使った直近の入力トークン、thresholdTokens はそのときの目安、ratio は窓に対する
 * 割合の参考（窓が分からなければ null）。
 * @typedef {{ type: "started"; atMs: number; lastInputTokens: number; thresholdTokens: number; ratio: number | null; totalInputTokens: number | null; modelContextWindow: number | null }
 *   | { type: "finished"; atMs: number; ok: boolean; durationMs: number | null; reason: string | null; message: string | null; personaInjected: boolean; personaDeferred: boolean; compactionInputTokens: number | null }} CompactionEvent
 */

/**
 * @param {object} options
 * @param {() => ({ compact: () => Promise<any>; getContextUsage: () => ContextUsage | null } | null | undefined)} options.getSession
 *   今の頭のセッション（Codex のときだけ返す・それ以外は null）。
 * @param {() => QuietGap | null} options.getQuietGap  隙間の材料（cockpit-server）。
 * @param {(event: CompactionEvent) => void} [options.onEvent]  圧縮の開始と終了（本文なし）。
 * @param {number} [options.thresholdTokens]  圧縮を始める大きさ（直近の入力トークン・既定 20 万）。走っている間は
 *   setThresholdTokens で差し替える（次の確認から効く）。
 * @param {number} [options.quietMs]
 * @param {number} [options.minIntervalMs]
 * @param {number} [options.checkIntervalMs]
 * @param {() => number} [options.nowImpl]
 * @param {() => number} [options.monotonicNowImpl]
 * @param {typeof setInterval} [options.setIntervalImpl]
 * @param {typeof clearInterval} [options.clearIntervalImpl]
 * @param {typeof setTimeout} [options.setTimeoutImpl]
 */
export function createContextCompactor(options) {
  const getSession = options.getSession;
  const getQuietGap = options.getQuietGap;
  const onEvent = options.onEvent;
  let thresholdTokens = positiveOr(options.thresholdTokens, DEFAULT_COMPACT_THRESHOLD_TOKENS);
  const quietMs = nonNegativeOr(options.quietMs, DEFAULT_COMPACT_QUIET_MS);
  const minIntervalMs = nonNegativeOr(options.minIntervalMs, DEFAULT_COMPACT_MIN_INTERVAL_MS);
  const checkIntervalMs = positiveOr(options.checkIntervalMs, DEFAULT_COMPACT_CHECK_INTERVAL_MS);
  const nowImpl = options.nowImpl ?? Date.now;
  const setIntervalImpl = options.setIntervalImpl ?? setInterval;
  const clearIntervalImpl = options.clearIntervalImpl ?? clearInterval;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;

  let running = false;
  let disposed = false;
  /** @type {number | null} */
  let lastAttemptAtMs = null;
  /** @type {any} */
  let timer = null;

  const emit = (/** @type {CompactionEvent} */ event) => {
    try {
      onEvent?.(event);
    } catch {
      // 見え方の失敗で圧縮を止めない。
    }
  };

  /**
   * 確かめて、条件がそろっていれば圧縮する（片付くまで待てる Promise・throw しない）。
   * @returns {Promise<{ started: boolean; reason?: string }>}
   */
  const check = async () => {
    if (disposed) return { started: false, reason: "disposed" };
    if (running) return { started: false, reason: "running" };
    let session = null;
    let usage = null;
    let gap = null;
    try {
      session = getSession();
      if (!session || typeof session.compact !== "function" || typeof session.getContextUsage !== "function") {
        return { started: false, reason: "no-session" };
      }
      usage = session.getContextUsage();
      gap = getQuietGap();
    } catch {
      return { started: false, reason: "unavailable" };
    }
    const nowMs = nowImpl();
    const decision = decideCompaction({ usage, gap, nowMs, lastAttemptAtMs, thresholdTokens, quietMs, minIntervalMs });
    if (!decision.ok) return { started: false, reason: /** @type {{ reason: string }} */ (decision).reason };
    running = true;
    lastAttemptAtMs = nowMs;
    emit({
      type: "started",
      atMs: nowMs,
      lastInputTokens: decision.inputTokens,
      thresholdTokens,
      ratio: decision.ratio,
      totalInputTokens: typeof usage?.totalInputTokens === "number" ? usage.totalInputTokens : null,
      modelContextWindow: typeof usage?.modelContextWindow === "number" ? usage.modelContextWindow : null
    });
    /** @type {any} */
    let result = null;
    try {
      result = await session.compact();
    } catch (error) {
      result = { compacted: false, reason: "failed", message: error instanceof Error ? error.message : String(error) };
    } finally {
      running = false;
    }
    emit({
      type: "finished",
      atMs: nowImpl(),
      ok: result?.compacted === true,
      durationMs: typeof result?.durationMs === "number" ? result.durationMs : null,
      reason: result?.compacted === true ? null : typeof result?.reason === "string" ? result.reason : "failed",
      message: typeof result?.message === "string" ? result.message : null,
      personaInjected: result?.personaInjected === true,
      personaDeferred: result?.personaDeferred === true,
      compactionInputTokens:
        typeof result?.compactionUsage?.last?.inputTokens === "number" ? result.compactionUsage.last.inputTokens : null
    });
    return { started: true };
  };

  return {
    check,
    /** 返事が終わった（発火が片付いた）。発火の後始末（判定の再開など）を先に済ませてから確かめる。 */
    noteReplyFinished() {
      if (disposed) return;
      setTimeoutImpl(() => {
        void check();
      }, 0);
    },
    /** 数秒おきに確かめ始める（冪等）。プロセスの生存には寄与させない。 */
    start() {
      if (disposed || timer != null) return;
      timer = setIntervalImpl(() => {
        void check();
      }, checkIntervalMs);
      if (timer && typeof timer.unref === "function") timer.unref();
    },
    isRunning: () => running,
    /** 今の目安（圧縮を始める大きさ・トークン）。 */
    getThresholdTokens: () => thresholdTokens,
    /**
     * 目安を差し替える（操縦席の設定から・次の確認から効く）。正の数でなければ変えない。返り値は差し替え後の目安。
     * 範囲（5 万〜45 万）の検証は呼び出し側（設定ファイル・操縦席の API）が normalizeCompactThresholdTokens で行う。
     * @param {number} tokens
     * @returns {number}
     */
    setThresholdTokens(tokens) {
      thresholdTokens = positiveOr(tokens, thresholdTokens);
      return thresholdTokens;
    },
    /** 畳む（以後は確かめない。進行中の圧縮は頭のセッションの dispose が畳む）。 */
    dispose() {
      disposed = true;
      if (timer != null) clearIntervalImpl(timer);
      timer = null;
    }
  };
}

/** @param {unknown} v @param {number} fallback */
function positiveOr(v, fallback) {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
}

/** @param {unknown} v @param {number} fallback */
function nonNegativeOr(v, fallback) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
}
