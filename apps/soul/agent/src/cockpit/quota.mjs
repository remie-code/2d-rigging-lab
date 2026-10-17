// @ts-check
/**
 * 残量ゲージの材料（Codex の週の使用率・ElevenLabs の月のクレジット）— apps/soul/agent。
 *
 * 合意: discussion/ai-cohost/implementation/screens/cockpit-glance-redesign.md §7・§8・§9.2、取り方は
 * discussion/ai-cohost/research/quota-sources-2026-10.md。意図せずチャッピーが止まる最有力候補なので、「残り」の
 * 割合とリセット時刻を snapshot と SSE で画面へ届ける。取れないときは不明（null）。20% 未満・5% 未満の区分は
 * 画面でも出せるように値だけ渡す（警告は ./warnings.mjs が同じしきい値で出す）。
 *
 * ── Codex（頭が Codex のときだけ）──────────────────────────────────────────────
 *  同梱 App Server の `account/rateLimits/read`（codex-session の readRateLimits）を、App Server が起動した後
 *  （最初の ask の後）と発火のたびに読み、`account/rateLimits/updated` 通知でマージし、数分おきに読み直す。
 *  App Server が起動していない（まだ喋っていない・頭が Claude）間は不明。週の窓（10080 分）を優先して見る。
 *  止まっているか（ordinaryUsageAllowed === false / rateLimitReachedType あり）も `limited` で渡す。
 *
 * ── ElevenLabs（耳を使っていなくても操縦席が動いている間）─────────────────────────────
 *  `GET /v1/user/subscription` を 10 分おき（起動時に 1 回）。`character_count ÷ character_limit` と
 *  `next_character_count_reset_unix`。キーは `.env.elevenlabs.local`（loadElevenLabsApiKey・process.env に入れない）。
 *  キーの値・アカウント情報は状態にもログにも載せない（数値だけを取り出す）。
 *
 * 依存（読み口・時計・タイマ）は注入。テストは fake で実 API・実 Codex に繋がない。
 */

import { loadElevenLabsApiKey } from "../ears/elevenlabs-stt.mjs";

/** ElevenLabs の契約情報の口（user_read 権限のキーで読める）。 */
export const ELEVENLABS_SUBSCRIPTION_URL = "https://api.elevenlabs.io/v1/user/subscription";
/** ElevenLabs を読み直す間隔（10 分・§9.2）。 */
export const ELEVENLABS_QUOTA_INTERVAL_MS = 10 * 60 * 1000;
/** Codex を読み直す間隔（数分おき・研究の推測「数分」の中庸として 5 分）。 */
export const CODEX_QUOTA_INTERVAL_MS = 5 * 60 * 1000;
/** ElevenLabs の 1 回の読みのタイムアウト。 */
export const ELEVENLABS_QUOTA_TIMEOUT_MS = 10_000;
/** 残り 20% 未満で琥珀（§9.2）。 */
export const QUOTA_LOW_PERCENT = 20;
/** 残り 5% 未満で赤（§9.2）。 */
export const QUOTA_CRITICAL_PERCENT = 5;
/** Codex の週の窓（分）。 */
export const CODEX_WEEKLY_WINDOW_MINS = 10080;

/** @param {unknown} v */
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
/** @param {number} v */
const clampPercent = (v) => Math.min(100, Math.max(0, Math.round(v * 10) / 10));

/**
 * @typedef {{
 *   remainingPercent: number;
 *   usedPercent: number;
 *   resetsAtMs: number | null;
 *   windowMins: number | null;
 *   limited: boolean;
 *   reachedType: string | null;
 *   limitId: string | null;
 *   updatedAtMs: number;
 * }} CodexQuota
 * @typedef {{
 *   remainingPercent: number;
 *   used: number;
 *   limit: number;
 *   resetsAtMs: number | null;
 *   updatedAtMs: number;
 * }} ElevenLabsQuota
 * @typedef {{ codex: CodexQuota | null; elevenlabs: ElevenLabsQuota | null }} QuotaSnapshot
 */

/**
 * RateLimitSnapshot から見る窓を選ぶ（週の窓 → primary → secondary）。
 * @param {any} snapshot
 * @returns {{ usedPercent: number; windowDurationMins: number | null; resetsAt: number | null } | null}
 */
export function pickCodexWindow(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const candidates = [snapshot.primary, snapshot.secondary].filter((w) => w && typeof w === "object" && isNum(w.usedPercent));
  return candidates.find((w) => w.windowDurationMins === CODEX_WEEKLY_WINDOW_MINS) ?? candidates[0] ?? null;
}

/** @param {unknown} sec  Unix 秒 → ms（数でなければ null）。 */
const unixSecToMs = (sec) => (isNum(sec) ? Math.round(/** @type {number} */ (sec) * 1000) : null);

/**
 * `account/rateLimits/read` の応答 → 残量。読めなければ null。
 * @param {any} response  GetAccountRateLimitsResponse。
 * @param {number} nowMs
 * @returns {CodexQuota | null}
 */
export function normalizeCodexRateLimits(response, nowMs) {
  if (!response || typeof response !== "object") return null;
  const byId = response.rateLimitsByLimitId && typeof response.rateLimitsByLimitId === "object" ? response.rateLimitsByLimitId : null;
  const snapshot = (byId && byId.codex) || response.rateLimits;
  const window = pickCodexWindow(snapshot);
  if (!window) return null;
  const reachedType = typeof snapshot.rateLimitReachedType === "string" ? snapshot.rateLimitReachedType : null;
  return {
    remainingPercent: clampPercent(100 - window.usedPercent),
    usedPercent: clampPercent(window.usedPercent),
    resetsAtMs: unixSecToMs(window.resetsAt),
    windowMins: isNum(window.windowDurationMins) ? window.windowDurationMins : null,
    limited: response.ordinaryUsageAllowed === false || reachedType != null,
    reachedType,
    limitId: typeof snapshot.limitId === "string" ? snapshot.limitId : null,
    updatedAtMs: nowMs
  };
}

/**
 * `account/rateLimits/updated` の差分を直前の残量にマージする。差分の null（取れない値）は前の値を消さない
 * （プロトコルの注記どおり）。別の limitId の差分は混ぜない。
 * @param {CodexQuota | null} prev
 * @param {any} update  RateLimitSnapshot（差分）。
 * @param {number} nowMs
 * @returns {CodexQuota | null}
 */
export function mergeCodexRateLimitUpdate(prev, update, nowMs) {
  if (!update || typeof update !== "object") return prev;
  const updateLimitId = typeof update.limitId === "string" ? update.limitId : null;
  if (updateLimitId != null && updateLimitId !== "codex" && prev?.limitId != null && updateLimitId !== prev.limitId) return prev;
  const window = pickCodexWindow(update);
  const reachedType = typeof update.rateLimitReachedType === "string" ? update.rateLimitReachedType : prev?.reachedType ?? null;
  if (!window) {
    if (!prev) return null;
    return { ...prev, reachedType, limited: prev.limited || reachedType != null, updatedAtMs: nowMs };
  }
  return {
    remainingPercent: clampPercent(100 - window.usedPercent),
    usedPercent: clampPercent(window.usedPercent),
    resetsAtMs: unixSecToMs(window.resetsAt) ?? prev?.resetsAtMs ?? null,
    windowMins: isNum(window.windowDurationMins) ? window.windowDurationMins : prev?.windowMins ?? null,
    limited: (prev?.limited ?? false) || reachedType != null,
    reachedType,
    limitId: updateLimitId ?? prev?.limitId ?? null,
    updatedAtMs: nowMs
  };
}

/**
 * `GET /v1/user/subscription` の応答 → 残量（数値だけ取り出す）。読めなければ null。
 * @param {any} json
 * @param {number} nowMs
 * @returns {ElevenLabsQuota | null}
 */
export function normalizeElevenLabsSubscription(json, nowMs) {
  if (!json || typeof json !== "object") return null;
  const used = json.character_count;
  const limit = json.character_limit;
  if (!isNum(used) || !isNum(limit) || limit <= 0) return null;
  return {
    remainingPercent: clampPercent(100 * (1 - used / limit)),
    used,
    limit,
    resetsAtMs: unixSecToMs(json.next_character_count_reset_unix),
    updatedAtMs: nowMs
  };
}

/**
 * ElevenLabs の契約情報を 1 回読む。キーが無い・HTTP エラー・タイムアウトは throw（理由にキーは含めない）。
 * @param {{ apiKeyProvider?: () => ({ ok: true; apiKey: string } | { ok: false; reason: string }); fetchImpl?: typeof fetch; timeoutMs?: number; url?: string }} [options]
 * @returns {Promise<any>}
 */
export async function fetchElevenLabsSubscription(options = {}) {
  const apiKeyProvider = options.apiKeyProvider ?? (() => loadElevenLabsApiKey());
  const fetchImpl = options.fetchImpl ?? ((/** @type {any} */ url, /** @type {any} */ init) => globalThis.fetch(url, init));
  const timeoutMs = options.timeoutMs ?? ELEVENLABS_QUOTA_TIMEOUT_MS;
  /** @type {any} */
  let key;
  try {
    key = apiKeyProvider();
  } catch {
    key = null;
  }
  if (!key || key.ok !== true || typeof key.apiKey !== "string" || key.apiKey.length === 0) {
    throw new Error("ElevenLabs のキーが見つからない");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof (/** @type {any} */ (timer).unref) === "function") /** @type {any} */ (timer).unref();
  try {
    /** @type {any} */
    let res;
    try {
      res = await fetchImpl(options.url ?? ELEVENLABS_SUBSCRIPTION_URL, {
        method: "GET",
        headers: { "xi-api-key": key.apiKey },
        signal: controller.signal
      });
    } catch (error) {
      throw new Error(controller.signal.aborted ? "ElevenLabs の残量: タイムアウト" : "ElevenLabs の残量: 通信失敗");
    }
    if (!res || !res.ok) throw new Error(`ElevenLabs の残量: HTTP ${res ? Number(res.status) || 0 : 0}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 残量の監視（両方の値の正本・読み直しのタイマ・変化の通知）。
 * @param {object} options
 * @param {() => Promise<any | null>} [options.readCodex]  `account/rateLimits/read` の応答を返す（App Server が
 *   起動していない・頭が Codex でなければ null）。未注入なら Codex は常に不明。
 * @param {() => Promise<any>} [options.readElevenLabs]  `GET /v1/user/subscription` の JSON を返す（失敗は throw）。
 *   未注入なら ElevenLabs は常に不明。
 * @param {(snapshot: QuotaSnapshot) => void} [options.onChange]  値が変わったとき（読んだ時刻だけの変化は通知しない）。
 * @param {() => number} [options.nowImpl=Date.now]
 * @param {number} [options.codexIntervalMs=CODEX_QUOTA_INTERVAL_MS]
 * @param {number} [options.elevenLabsIntervalMs=ELEVENLABS_QUOTA_INTERVAL_MS]
 * @param {typeof setInterval} [options.setIntervalImpl]
 * @param {typeof clearInterval} [options.clearIntervalImpl]
 */
export function createQuotaMonitor(options = {}) {
  const nowImpl = options.nowImpl ?? Date.now;
  const setIntervalImpl = options.setIntervalImpl ?? setInterval;
  const clearIntervalImpl = options.clearIntervalImpl ?? clearInterval;
  const codexIntervalMs = options.codexIntervalMs ?? CODEX_QUOTA_INTERVAL_MS;
  const elevenLabsIntervalMs = options.elevenLabsIntervalMs ?? ELEVENLABS_QUOTA_INTERVAL_MS;
  /** @type {QuotaSnapshot} */
  let state = { codex: null, elevenlabs: null };
  /** @type {Set<(snapshot: QuotaSnapshot) => void>} */
  const listeners = new Set();
  if (typeof options.onChange === "function") listeners.add(options.onChange);
  /** @type {any[]} */
  let timers = [];
  let stopped = false;
  /** 読みの世代（Codex を不明に戻した後に、前の読みの結果が遅れて着いても上書きしない）。 */
  let codexGeneration = 0;
  /** @type {Promise<void> | null} */
  let codexInFlight = null;
  /** @type {Promise<void> | null} */
  let elevenInFlight = null;

  /** 読んだ時刻を除いた比較用の形。 */
  const comparable = (/** @type {QuotaSnapshot} */ s) =>
    JSON.stringify({
      codex: s.codex ? { ...s.codex, updatedAtMs: 0 } : null,
      elevenlabs: s.elevenlabs ? { ...s.elevenlabs, updatedAtMs: 0 } : null
    });
  /** @param {Partial<QuotaSnapshot>} patch */
  const update = (patch) => {
    const next = { ...state, ...patch };
    const changed = comparable(next) !== comparable(state);
    state = next;
    if (!changed) return;
    for (const fn of [...listeners]) {
      try {
        fn(snapshot());
      } catch {
        // 通知先の失敗で監視を止めない。
      }
    }
  };
  const snapshot = () => ({ codex: state.codex ? { ...state.codex } : null, elevenlabs: state.elevenlabs ? { ...state.elevenlabs } : null });

  const refreshCodex = () => {
    if (typeof options.readCodex !== "function" || stopped) return Promise.resolve();
    if (codexInFlight) return codexInFlight;
    const generation = codexGeneration;
    const readCodex = options.readCodex;
    codexInFlight = (async () => {
      /** @type {CodexQuota | null} */
      let next = null;
      try {
        next = normalizeCodexRateLimits(await readCodex(), nowImpl());
      } catch {
        next = null; // 取れないときは不明。
      }
      if (generation === codexGeneration && !stopped) update({ codex: next });
    })().finally(() => {
      codexInFlight = null;
    });
    return codexInFlight;
  };

  const refreshElevenLabs = () => {
    if (typeof options.readElevenLabs !== "function" || stopped) return Promise.resolve();
    if (elevenInFlight) return elevenInFlight;
    const readElevenLabs = options.readElevenLabs;
    elevenInFlight = (async () => {
      /** @type {ElevenLabsQuota | null} */
      let next = null;
      try {
        next = normalizeElevenLabsSubscription(await readElevenLabs(), nowImpl());
      } catch {
        next = null;
      }
      if (!stopped) update({ elevenlabs: next });
    })().finally(() => {
      elevenInFlight = null;
    });
    return elevenInFlight;
  };

  return {
    /** タイマを張る（ElevenLabs は起動時に 1 回読む。Codex は App Server が起動するまで読んでも不明なので待つ）。 */
    start() {
      if (stopped || timers.length > 0) return;
      const every = (/** @type {() => void} */ fn, /** @type {number} */ ms) => {
        const t = setIntervalImpl(fn, ms);
        if (t && typeof (/** @type {any} */ (t).unref) === "function") /** @type {any} */ (t).unref();
        timers.push(t);
      };
      if (typeof options.readElevenLabs === "function") {
        void refreshElevenLabs();
        every(() => void refreshElevenLabs(), elevenLabsIntervalMs);
      }
      if (typeof options.readCodex === "function") every(() => void refreshCodex(), codexIntervalMs);
    },
    /** タイマを外す（冪等）。以後の読みの結果は捨てる。 */
    stop() {
      stopped = true;
      for (const t of timers) clearIntervalImpl(t);
      timers = [];
    },
    /** Codex を今すぐ読む（App Server の起動後・発火のたび）。 */
    refreshCodex,
    /** ElevenLabs を今すぐ読む。 */
    refreshElevenLabs,
    /** `account/rateLimits/updated` の差分をマージする。 */
    mergeCodexUpdate(/** @type {any} */ rateLimits) {
      if (stopped) return;
      update({ codex: mergeCodexRateLimitUpdate(state.codex, rateLimits, nowImpl()) });
    },
    /** Codex を不明に戻す（頭が Codex でなくなった）。読みかけの結果も捨てる。 */
    clearCodex() {
      codexGeneration += 1;
      update({ codex: null });
    },
    /** 今の値（コピー）。 */
    snapshot,
    /**
     * 変化の購読（cockpit-server の quotaSource 契約）。
     * @param {(snapshot: QuotaSnapshot) => void} fn
     * @returns {() => void}
     */
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}
