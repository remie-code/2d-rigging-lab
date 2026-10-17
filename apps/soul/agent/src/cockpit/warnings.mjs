// @ts-check
/**
 * 上の帯の警告の正本（操縦席の作り直し 1 回目・データ側）— apps/soul/agent。
 *
 * 合意: discussion/ai-cohost/implementation/screens/cockpit-glance-redesign.md §3・§9.2。異常があるときだけ小さな警告を
 * 出す。警告は 2 種類に分ける:
 *  - 状態で決まるもの（lifetime "state"）: 文字起こしの停止・繋ぎ直し中、マイクの取り込みの停止、チャットの切断・
 *    繋ぎ直し中、残量が少ない（残り 20% 未満・5% 未満は赤）、Codex の使用上限。直ったら消える。
 *  - 一回きりの出来事（lifetime "event"）: 判定のエラー、頭のエラー（fireError）、OpenAI の残高切れ（429
 *    credit_balance_exhausted）。60 秒で消える（同じ出来事が続けば消えるまでの時間を延ばし、回数を数える）。
 * 表示（文言の出し方・並べ方・色）は画面（2 回目）の領分。ここは「今出ている警告の一覧」を snapshot と SSE に
 * 載せられる形で持つだけ。文言は短い日本語（画面がそのまま使ってよい）、detail は補足（会話やコメントの本文は
 * 入れない。呼び出し側が伏せた文言だけを渡す）。
 *
 * 純ロジック + 注入タイマ（決定論テスト用）。
 */

import { QUOTA_LOW_PERCENT, QUOTA_CRITICAL_PERCENT } from "./quota.mjs";

/** 一回きりの出来事が消えるまで（60 秒・§9.2）。 */
export const WARNING_EVENT_TTL_MS = 60_000;

/**
 * @typedef {"warn" | "alert"} WarningSeverity
 * @typedef {{ kind: string; severity: WarningSeverity; message: string; detail?: string | null; source?: string | null }} WarningSpec
 * @typedef {{
 *   id: string;
 *   kind: string;
 *   lifetime: "state" | "event";
 *   severity: WarningSeverity;
 *   message: string;
 *   detail: string | null;
 *   source: string | null;
 *   sinceMs: number;
 *   lastAtMs: number;
 *   count: number;
 *   expiresAtMs: number | null;
 * }} CockpitWarning
 */

/**
 * 判定のエラーの文言が OpenAI の残高切れ（429 credit_balance_exhausted）か。
 * @param {unknown} message
 */
export function isCreditExhaustedError(message) {
  return typeof message === "string" && /credit_balance_exhausted/i.test(message);
}

/**
 * 残量から「残量が少ない」の警告を作る（20% 未満は warn・5% 未満は alert・それ以外や不明は null）。
 * @param {string} label  "Codex" / "ElevenLabs"
 * @param {{ remainingPercent: number } | null | undefined} quota
 * @returns {WarningSpec | null}
 */
export function quotaLowWarning(label, quota) {
  if (!quota || typeof quota.remainingPercent !== "number" || !Number.isFinite(quota.remainingPercent)) return null;
  const r = quota.remainingPercent;
  if (r >= QUOTA_LOW_PERCENT) return null;
  return {
    kind: "quota-low",
    severity: r < QUOTA_CRITICAL_PERCENT ? "alert" : "warn",
    message: `${label} の残りが少ない（${Math.floor(r)}%）`,
    source: label.toLowerCase()
  };
}

/**
 * 警告の一覧を持つ板を作る。
 * @param {object} [options]
 * @param {() => number} [options.nowImpl=Date.now]
 * @param {number} [options.eventTtlMs=WARNING_EVENT_TTL_MS]
 * @param {typeof setTimeout} [options.setTimeoutImpl]
 * @param {typeof clearTimeout} [options.clearTimeoutImpl]
 * @param {(list: CockpitWarning[]) => void} [options.onChange]  一覧が変わったとき（出た・消えた・内容が変わった）。
 */
export function createWarningBoard(options = {}) {
  const nowImpl = options.nowImpl ?? Date.now;
  const ttlMs = options.eventTtlMs ?? WARNING_EVENT_TTL_MS;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const onChange = typeof options.onChange === "function" ? options.onChange : () => {};
  /** @type {Map<string, CockpitWarning>} */
  const conditions = new Map();
  /** @type {Map<string, { warning: CockpitWarning; timer: any }>} */
  const events = new Map();
  let disposed = false;

  const notify = () => {
    if (disposed) return;
    try {
      onChange(list());
    } catch {
      // 通知先の失敗で板を壊さない。
    }
  };

  /** @returns {CockpitWarning[]} 赤を先に、同じ重さなら出た順。 */
  const list = () => {
    const all = [...conditions.values(), ...[...events.values()].map((e) => e.warning)].map((w) => ({ ...w }));
    return all.sort((a, b) => (a.severity === b.severity ? a.sinceMs - b.sinceMs : a.severity === "alert" ? -1 : 1));
  };

  /** @param {WarningSpec} spec */
  const sameContent = (/** @type {CockpitWarning} */ w, spec) =>
    w.kind === spec.kind &&
    w.severity === spec.severity &&
    w.message === spec.message &&
    w.detail === (spec.detail ?? null) &&
    w.source === (spec.source ?? null);

  return {
    /**
     * 状態で決まる警告を出す / 消す（null で消す）。内容が同じなら何もしない（出た時刻を保つ）。
     * @param {string} id  @param {WarningSpec | null} spec
     */
    setCondition(id, spec) {
      if (disposed) return;
      const prev = conditions.get(id);
      if (spec == null) {
        if (prev) {
          conditions.delete(id);
          notify();
        }
        return;
      }
      if (prev && sameContent(prev, spec)) return;
      const now = nowImpl();
      conditions.set(id, {
        id,
        kind: spec.kind,
        lifetime: "state",
        severity: spec.severity,
        message: spec.message,
        detail: spec.detail ?? null,
        source: spec.source ?? null,
        sinceMs: prev ? prev.sinceMs : now,
        lastAtMs: now,
        count: 1,
        expiresAtMs: null
      });
      notify();
    },
    /**
     * 一回きりの出来事を出す（eventTtlMs で消える）。同じ id が出ている間にまた起きたら、消えるまでを延ばして数える。
     * @param {string} id  @param {WarningSpec} spec
     */
    pushEvent(id, spec) {
      if (disposed) return;
      const now = nowImpl();
      const prev = events.get(id);
      if (prev) clearTimeoutImpl(prev.timer);
      const timer = setTimeoutImpl(() => {
        const cur = events.get(id);
        if (!cur || cur.timer !== timer) return;
        events.delete(id);
        notify();
      }, ttlMs);
      if (timer && typeof timer.unref === "function") timer.unref();
      events.set(id, {
        timer,
        warning: {
          id,
          kind: spec.kind,
          lifetime: "event",
          severity: spec.severity,
          message: spec.message,
          detail: spec.detail ?? null,
          source: spec.source ?? null,
          sinceMs: prev ? prev.warning.sinceMs : now,
          lastAtMs: now,
          count: prev ? prev.warning.count + 1 : 1,
          expiresAtMs: now + ttlMs
        }
      });
      notify();
    },
    /** 今出ている警告の一覧（コピー）。 */
    list,
    /** タイマを外す（以後は何もしない）。 */
    dispose() {
      disposed = true;
      for (const e of events.values()) clearTimeoutImpl(e.timer);
      events.clear();
      conditions.clear();
    }
  };
}
